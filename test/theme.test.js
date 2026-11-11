// Run with: npm test   (pure Node; grammar based checks use the Java grammar of a VS Code in .vscode-test/,
// download one with `npm run test:vscode` – they are skipped otherwise)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build } = require('../scripts/build');
const { colorize } = require('./colorize');

const root = path.join(__dirname, '..');
const themeFile = v => path.join(root, 'themes', `islands-${v}-color-theme.json`);
const read = v => JSON.parse(fs.readFileSync(themeFile(v), 'utf8'));

function javaGrammar() {
  const base = path.join(root, '.vscode-test');
  if (!fs.existsSync(base)) return undefined;
  for (const d of fs.readdirSync(base).filter(d => d.startsWith('vscode-'))) {
    for (const app of ['resources/app', 'Visual Studio Code.app/Contents/Resources/app']) {
      const g = path.join(base, d, app, 'extensions/java/syntaxes/java.tmLanguage.json');
      if (fs.existsSync(g)) return g;
    }
  }
  return undefined;
}

test('committed themes are up to date with the generator', () => {
  for (const v of ['dark', 'light']) assert.deepEqual(read(v), JSON.parse(JSON.stringify(build(v))), `run "npm run build" (${v})`);
});

test('all colors are valid hex values', () => {
  for (const v of ['dark', 'light']) {
    const t = read(v);
    for (const [k, c] of Object.entries(t.colors)) assert.match(c, /^#[0-9A-F]{6}([0-9A-F]{2})?$/, `${v}: ${k}`);
    for (const r of t.tokenColors) if (r.settings.foreground) assert.match(r.settings.foreground, /^#[0-9A-F]{6}$/, `${v}: ${r.name}`);
    for (const [k, s] of Object.entries(t.semanticTokenColors)) if (s.foreground) assert.match(s.foreground, /^#[0-9A-F]{6}$/, `${v}: ${k}`);
  }
});

test('editor and UI base colors match IntelliJ Islands', () => {
  const d = read('dark').colors;
  assert.equal(d['editor.background'], '#191A1C');
  assert.equal(d['editor.foreground'], '#BCBEC4');
  assert.equal(d['sideBar.background'], '#191A1C');
  assert.equal(d['activityBar.background'], '#26282C'); // main window between the islands
  assert.equal(d['editor.selectionBackground'], '#214283');
  assert.equal(d['editorLineNumber.foreground'], '#4B5059');
  const l = read('light').colors;
  assert.equal(l['editor.background'], '#FFFFFF');
  assert.equal(l['editor.foreground'], '#080808');
  assert.equal(l['activityBar.background'], '#E9EAEE');
  assert.equal(l['editor.selectionBackground'], '#A6D2FF');
});

test('semantic tokens follow the IntelliJ attributes (JetBrains language server)', () => {
  const d = read('dark').semanticTokenColors;
  assert.deepEqual(d.property, { foreground: '#C77DBB', italic: false, bold: false });
  assert.deepEqual(d['property.static.readonly'], { foreground: '#C77DBB', italic: true, bold: false });
  assert.deepEqual(d['function.declaration'], { foreground: '#56A8F5', italic: false, bold: false });
  assert.deepEqual(d.function, { foreground: '#BCBEC4', italic: false, bold: false }); // calls are plain
  assert.deepEqual(d['method.static'], { foreground: '#BCBEC4', italic: true, bold: false }); // static calls italic
  assert.equal(d.typeParameter.foreground, '#16BAAC');
  assert.equal(d.decorator.foreground, '#B3AE60');
  assert.equal(d['variable:kotlin'].underline, true); // Kotlin `var`
  assert.equal(d['variable.readonly:kotlin'].underline, false);
  const l = read('light').semanticTokenColors;
  assert.equal(l.property.foreground, '#871094');
  assert.equal(l['function.declaration'].foreground, '#00627A');
});

const grammar = javaGrammar();
test('Java sample is colored like in IntelliJ', { skip: !grammar && 'no VS Code in .vscode-test (npm run test:vscode)' }, async () => {
  const code = fs.readFileSync(path.join(__dirname, 'samples', 'EntityRepositoryDao.java'), 'utf8');
  const expect = {
    dark: { keyword: '#CF8E6D', decl: '#56A8F5', text: '#BCBEC4', annotation: '#B3AE60', string: '#6AAB73', number: '#2AACB8', doc: '#5F826B', docTag: '#67A37C', field: '#C77DBB', comment: '#7A7E85', typeParam: '#16BAAC' },
    light: { keyword: '#0033B3', decl: '#00627A', text: '#080808', annotation: '#9E880D', string: '#067D17', number: '#1750EB', doc: '#8C8C8C', docTag: '#080808', field: '#871094', comment: '#8C8C8C', typeParam: '#007E8A' },
  };
  for (const v of ['dark', 'light']) {
    const e = expect[v];
    const tokens = await colorize(themeFile(v), grammar, code);
    const at = (text, n = 0) => tokens.filter(t => t.text === text)[n] ?? assert.fail(`${text} not found`);
    const check = (text, fg, style = '', n = 0) => {
      const t = at(text, n);
      assert.equal(t.fg, fg, `${v}: color of "${text}"`);
      if (style !== undefined) assert.equal(t.style.replace('underline', '').trim(), style, `${v}: style of "${text}"`);
    };
    check('public', e.keyword);
    check('void', e.keyword);
    check('null', e.keyword);
    check('this', e.keyword);
    check('contains', e.decl); // declaration
    check('lock', e.decl);
    check('@Repository', e.annotation);
    check('"entityRepository"', e.string);
    check('100', e.number);
    check('cache', e.field); // field declaration
    check('NONE', e.field); // field access
    check('// TODO: use a cache here', e.comment, v === 'dark' ? '' : 'italic');
    check('* Hibernate implementation of {@link EntityRepository}.', e.doc, 'italic');
    check('@see', e.docTag, 'italic');
    check('setHibernateTemplateComp', e.decl);
    check('T', e.typeParam);
    // calls, class names and packages use the default text color
    const call = tokens.find(t => t.text.includes('requireNonNull(getSessionFactory'));
    assert.equal(call?.fg, e.text, `${v}: method calls`);
    check('HibernateDaoSupport', v === 'dark' ? e.text : '#000000'); // IntelliJ Light: class names #000000
    check('org.hibernate.LockMode;', e.text);
  }
});
