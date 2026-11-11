// Tokenizes a file with a TextMate grammar and resolves foreground/fontStyle with one of our themes
// (the same algorithm VS Code uses: vscode-textmate's theme matching).
const fs = require('fs');
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

async function colorize(themeFile, grammarFile, code) {
  const theme = JSON.parse(fs.readFileSync(themeFile, 'utf8'));
  const reg = new tm.Registry({
    onigLib: onigLib(),
    loadGrammar: async () => tm.parseRawGrammar(fs.readFileSync(grammarFile, 'utf8'), grammarFile),
    theme: { name: theme.name, settings: [{ settings: { foreground: theme.colors['editor.foreground'], background: theme.colors['editor.background'] } }, ...theme.tokenColors] },
  });
  const colorMap = reg.getColorMap();
  const g = await reg.loadGrammar(JSON.parse(fs.readFileSync(grammarFile, 'utf8')).scopeName);
  const out = [];
  let st = tm.INITIAL;
  for (const line of code.split('\n')) {
    const r = g.tokenizeLine2(line, st);
    const t = r.tokens;
    for (let i = 0; i < t.length; i += 2) {
      const start = t[i];
      const end = i + 2 < t.length ? t[i + 2] : line.length;
      const meta = t[i + 1];
      const fg = colorMap[(meta & 0b00000000111111111000000000000000) >>> 15];
      const fs_ = (meta & 0b00000000000000000111100000000000) >>> 11;
      const style = [fs_ & 1 ? 'italic' : '', fs_ & 2 ? 'bold' : '', fs_ & 4 ? 'underline' : '', fs_ & 8 ? 'strikethrough' : ''].filter(Boolean).join(' ');
      const text = line.slice(start, end);
      if (text.trim()) out.push({ text: text.trim(), fg: fg.toUpperCase(), style });
    }
    st = r.ruleStack;
  }
  return out;
}

module.exports = { colorize };
