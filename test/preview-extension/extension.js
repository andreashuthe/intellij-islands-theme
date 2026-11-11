// Screenshot helper only: emulates the semantic tokens the JetBrains language server
// ("Java and Kotlin by IntelliJ IDEA") sends, so previews look like a real project.
// Very rough regex heuristics – good enough for the sample files in test/samples.
const vscode = require('vscode');

const TYPES = ['namespace', 'class', 'interface', 'enum', 'struct', 'typeParameter', 'decorator', 'parameter', 'variable', 'property', 'enumMember', 'function', 'method', 'keyword', 'label', 'type'];
const MODS = ['declaration', 'static', 'readonly', 'abstract', 'deprecated', 'defaultLibrary', 'modification'];
const legend = new vscode.SemanticTokensLegend(TYPES, MODS);

function scan(doc, rules) {
  const b = new vscode.SemanticTokensBuilder(legend);
  const text = doc.getText();
  const lines = text.split('\n');
  const marks = [];
  lines.forEach((line, ln) => {
    const code = line.replace(/"(?:[^"\\]|\\.)*"/g, m => ' '.repeat(m.length)).replace(/\/\/.*$/, m => ' '.repeat(m.length));
    if (/^\s*(\*|\/\*\*|\*\/)/.test(line)) return;
    for (const [re, type, mods] of rules) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(code))) {
        const g = m.length > 1 ? m[m.length - 1] : m[0];
        const col = m.index + m[0].lastIndexOf(g);
        if (marks.some(x => x.ln === ln && col < x.col + x.len && x.col < col + g.length)) continue;
        marks.push({ ln, col, len: g.length, type, mods: typeof mods === 'function' ? mods(g, ln) : mods });
      }
    }
  });
  marks.sort((a, b2) => a.ln - b2.ln || a.col - b2.col);
  for (const m of marks) b.push(new vscode.Range(m.ln, m.col, m.ln, m.col + m.len), m.type, m.mods);
  return b.build();
}

const word = names => new RegExp(`\\b(${names.join('|')})\\b`, 'g');

function java(doc) {
  const t = doc.getText();
  const fields = {};
  for (const m of t.matchAll(/^ {4}(?! )(?:private|protected|public)?\s*(static\s+)?(final\s+)?[\w<>[\], ]+?\s+(\w+)\s*(?:=|;)/gm)) {
    fields[m[3]] = [m[1] ? 'static' : null, m[2] ? 'readonly' : null].filter(Boolean);
  }
  const params = [...t.matchAll(/\(([^()]*)\)\s*\{/g)].flatMap(m => [...m[1].matchAll(/\w[\w<>]*\s+(\w+)\s*(?:,|$)/g)].map(x => x[1]));
  const rules = [];
  if (Object.keys(fields).length) rules.push([word(Object.keys(fields)), 'property', n => fields[n]]);
  rules.push([/\b([A-Z])\b/g, 'typeParameter', []]);
  rules.push([/@(\w+)/g, 'decorator', []]);
  if (params.length) rules.push([word([...new Set(params)]), 'parameter', []]);
  rules.push([/\b([A-Z][a-z]\w*)\b/g, 'class', []]);
  return scan(doc, rules);
}

function kotlin(doc) {
  const t = doc.getText();
  const topProps = [...t.matchAll(/^(?:const\s+)?val\s+(\w+)/gm)].map(m => m[1]);
  const props = {};
  for (const m of t.matchAll(/^ {4}(?:private\s+|override\s+)*(val|var)\s+(\w+)/gm)) props[m[2]] = m[1] === 'val' ? ['readonly'] : [];
  for (const m of t.matchAll(/(?:class \w+)?\((?:private\s+)?(val|var)\s+(\w+)/g)) props[m[2]] = m[1] === 'val' ? ['readonly'] : [];
  for (const m of t.matchAll(/,\s*(val|var)\s+(\w+)/g)) props[m[2]] = m[1] === 'val' ? ['readonly'] : [];
  const locals = {};
  for (const m of t.matchAll(/^ {8,}(val|var)\s+(\w+)/gm)) locals[m[2]] = m[1] === 'val' ? ['readonly'] : [];
  for (const m of t.matchAll(/for \((\w+) in/g)) locals[m[1]] = ['readonly'];
  const params = [...t.matchAll(/fun \w+\(([^)]*)\)/g)].flatMap(m => [...m[1].matchAll(/(\w+)\s*:/g)].map(x => x[1]));
  const decl = [...t.matchAll(/fun\s+(\w+)/g)].map(m => m[1]);
  const deprecated = [...t.matchAll(/@Deprecated[^\n]*\n\s*fun\s+(\w+)/g)].map(m => m[1]);
  const rules = [
    [/@(\w+)/g, 'decorator', []],
    [/fun\s+(\w+)/g, 'function', n => ['declaration', ...(deprecated.includes(n) ? ['deprecated'] : [])]],
    [/\.(now)\b/g, 'method', ['static']],
    [/\b(?!(?:if|for|while|when|class|fun|return|enum|data)\b)([a-z]\w*)(?=\s*(?:<[^>]*>)?\s*[({])/g, 'function', n => [
      ...(deprecated.includes(n) ? ['deprecated'] : []),
      ...(['mutableMapOf', 'listOf'].includes(n) ? ['static'] : []),
    ]],
  ];
  if (topProps.length) rules.push([word(topProps), 'property', ['static', 'readonly']]);
  if (Object.keys(locals).length) rules.push([word(Object.keys(locals)), 'variable', n => locals[n]]);
  if (Object.keys(props).length) rules.push([word(Object.keys(props)), 'property', n => props[n]]);
  if (params.length) rules.push([word([...new Set(params)]), 'parameter', ['readonly']]);
  rules.push([/\b(NEW|PAID)\b/g, 'enumMember', []]);
  rules.push([/\b([A-Z][a-z]\w*)\b/g, 'class', []]);
  return scan(doc, rules);
}

exports.activate = ctx => {
  ctx.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider({ language: 'java' }, { provideDocumentSemanticTokens: java }, legend),
    vscode.languages.registerDocumentSemanticTokensProvider({ language: 'kotlin' }, { provideDocumentSemanticTokens: kotlin }, legend),
  );
};
