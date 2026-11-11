// Debug helper: node scripts/dump.js <languageId> <file> [dark|light]  → token, color, scopes
const fs = require('fs');
const path = require('path');
const { colorize } = require('../test/colorize');
(async () => {
  const [lang, file, variant = 'dark'] = process.argv.slice(2);
  const toks = await colorize(path.join(__dirname, '..', 'themes', `islands-${variant}-color-theme.json`), lang, fs.readFileSync(file, 'utf8'));
  const seen = new Set();
  for (const t of toks) {
    const k = t.text + t.fg + t.style;
    if (seen.has(k)) continue;
    seen.add(k);
    console.log(t.text.slice(0, 28).padEnd(29), (t.fg + ' ' + t.style).padEnd(16), t.scopes.slice(1).slice(-3).join(' '));
  }
})();
