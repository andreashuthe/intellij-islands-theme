// Debug helper: prints TextMate scopes for a file.  node scripts/scopes.js <grammar.json> <file>
const fs = require('fs');
const path = require('path');
const tm = require('vscode-textmate');
const onig = require('vscode-oniguruma');
(async () => {
  await onig.loadWASM(fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm')).buffer);
  const lib = Promise.resolve({ createOnigScanner: s => new onig.OnigScanner(s), createOnigString: s => new onig.OnigString(s) });
  const [gfile, file] = process.argv.slice(2);
  const reg = new tm.Registry({ onigLib: lib, loadGrammar: async () => tm.parseRawGrammar(fs.readFileSync(gfile, 'utf8'), gfile) });
  const g = await reg.loadGrammar(JSON.parse(fs.readFileSync(gfile, 'utf8')).scopeName);
  let st = tm.INITIAL;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const r = g.tokenizeLine(line, st);
    for (const t of r.tokens) {
      const txt = line.slice(t.startIndex, t.endIndex);
      if (txt.trim()) console.log(JSON.stringify(txt).padEnd(28), t.scopes.slice(1).join(' '));
    }
    st = r.ruleStack;
  }
})();
