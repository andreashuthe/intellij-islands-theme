// Tokenizes code with the TextMate grammars of a VS Code installation and resolves foreground / fontStyle with
// one of our themes – the same matching VS Code does (vscode-textmate).
const fs = require('fs');
const path = require('path');
const tm = require('vscode-textmate');
const onig = require('vscode-oniguruma');

let ready;
function onigLib() {
  ready ??= onig.loadWASM(fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm')).buffer).then(() => ({
    createOnigScanner: s => new onig.OnigScanner(s),
    createOnigString: s => new onig.OnigString(s),
  }));
  return ready;
}

/** The built-in extensions folder of a VS Code downloaded into .vscode-test/ (undefined if none). */
function vscodeExtensionsDir(root = path.join(__dirname, '..')) {
  const base = path.join(root, '.vscode-test');
  if (!fs.existsSync(base)) return undefined;
  for (const d of fs.readdirSync(base).filter(d => d.startsWith('vscode-')).sort().reverse()) {
    for (const app of ['resources/app', 'Visual Studio Code.app/Contents/Resources/app']) {
      const ext = path.join(base, d, app, 'extensions');
      if (fs.existsSync(ext)) return ext;
    }
  }
  return undefined;
}

/** scopeName → grammar file, and language id → scopeName, from the extensions' package.json files. */
function grammarIndex(extDir) {
  const byScope = {};
  const byLanguage = {};
  const injections = {};
  for (const e of fs.readdirSync(extDir)) {
    const pj = path.join(extDir, e, 'package.json');
    if (!fs.existsSync(pj)) continue;
    const grammars = JSON.parse(fs.readFileSync(pj, 'utf8')).contributes?.grammars ?? [];
    for (const g of grammars) {
      byScope[g.scopeName] = path.join(extDir, e, g.path);
      if (g.language) byLanguage[g.language] = g.scopeName; // the last registration wins, like in VS Code
      for (const target of g.injectTo ?? []) (injections[target] ??= []).push(g.scopeName);
    }
  }
  return { byScope, byLanguage, injections };
}

const registries = new Map();
function registry(themeFile, extDir) {
  const key = themeFile + '|' + extDir;
  if (registries.has(key)) return registries.get(key);
  const theme = JSON.parse(fs.readFileSync(themeFile, 'utf8'));
  const idx = grammarIndex(extDir);
  const reg = new tm.Registry({
    onigLib: onigLib(),
    loadGrammar: async scope => (idx.byScope[scope] ? tm.parseRawGrammar(fs.readFileSync(idx.byScope[scope], 'utf8'), idx.byScope[scope]) : null),
    getInjections: scope => idx.injections[scope],
    theme: { name: theme.name, settings: [{ settings: { foreground: theme.colors['editor.foreground'], background: theme.colors['editor.background'] } }, ...theme.tokenColors] },
  });
  const r = { reg, idx };
  registries.set(key, r);
  return r;
}

/**
 * @param themeFile  path of a *-color-theme.json
 * @param grammar    language id (e.g. "python") or a grammar file path
 * @returns [{ text, fg, style, scopes }]
 */
async function colorize(themeFile, grammar, code, extDir = vscodeExtensionsDir()) {
  let reg;
  let scopeName;
  if (fs.existsSync(grammar)) {
    // single grammar file (no embedded languages)
    extDir ??= path.dirname(grammar);
    scopeName = JSON.parse(fs.readFileSync(grammar, 'utf8')).scopeName;
    const theme = JSON.parse(fs.readFileSync(themeFile, 'utf8'));
    reg = new tm.Registry({
      onigLib: onigLib(),
      loadGrammar: async s => (s === scopeName ? tm.parseRawGrammar(fs.readFileSync(grammar, 'utf8'), grammar) : null),
      theme: { name: theme.name, settings: [{ settings: { foreground: theme.colors['editor.foreground'], background: theme.colors['editor.background'] } }, ...theme.tokenColors] },
    });
  } else {
    const r = registry(themeFile, extDir);
    reg = r.reg;
    scopeName = r.idx.byLanguage[grammar];
    if (!scopeName) throw new Error(`no grammar for ${grammar}`);
  }
  const colorMap = reg.getColorMap();
  const g = await reg.loadGrammar(scopeName);
  const out = [];
  let st = tm.INITIAL;
  let st1 = tm.INITIAL;
  for (const line of code.split('\n')) {
    const r = g.tokenizeLine2(line, st);
    const r1 = g.tokenizeLine(line, st1);
    const t = r.tokens;
    for (let i = 0; i < t.length; i += 2) {
      const start = t[i];
      const end = i + 2 < t.length ? t[i + 2] : line.length;
      const meta = t[i + 1];
      const fg = colorMap[(meta & 0b00000000111111111000000000000000) >>> 15];
      const fs_ = (meta & 0b00000000000000000111100000000000) >>> 11;
      const style = [fs_ & 1 ? 'italic' : '', fs_ & 2 ? 'bold' : '', fs_ & 4 ? 'underline' : '', fs_ & 8 ? 'strikethrough' : ''].filter(Boolean).join(' ');
      const text = line.slice(start, end);
      const scopes = r1.tokens.find(x => x.startIndex <= start && start < x.endIndex)?.scopes ?? [];
      if (text.trim()) out.push({ text: text.trim(), fg: fg.toUpperCase(), style, scopes });
    }
    st = r.ruleStack;
    st1 = r1.ruleStack;
  }
  return out;
}

module.exports = { colorize, vscodeExtensionsDir, grammarIndex };
