// Reads IntelliJ UI themes (*.theme.json) incl. parentTheme and named palette colors.
const fs = require('fs');
const path = require('path');
const { hex } = require('./scheme');

const SRC = path.join(__dirname, '..', 'jetbrains');
const read = f => JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8').replace(/^\s*\/\/.*$/gm, ''));

const FILES = {
  'Islands Dark': 'ManyIslandsDark.theme.json',
  'Islands Light': 'ManyIslandsLight.theme.json',
  ExperimentalDark: 'expUI_dark.theme.json',
  ExperimentalLight: 'expUI_light.theme.json',
  ExperimentalLightWithLightHeader: 'expUI_light_with_light_header.theme.json',
};
const PARENT_NAMES = { 'Light with Light Header': 'ExperimentalLightWithLightHeader' };

function flatten(o, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, prefix + k + '.', out);
    else out[prefix + k] = v;
  }
  return out;
}

/** Theme chain, child first. */
function chain(name) {
  const out = [];
  for (let n = name; n && FILES[n];) {
    const j = read(FILES[n]);
    out.push(j);
    n = PARENT_NAMES[j.parentTheme] ?? j.parentTheme;
  }
  return out;
}

function load(name) {
  const themes = chain(name);
  const palette = Object.assign({}, ...themes.slice().reverse().map(t => t.colors ?? {}));
  const ui = Object.assign({}, ...themes.slice().reverse().map(t => flatten(t.ui ?? {})));
  const color = (v, depth = 0) => {
    if (typeof v !== 'string' || depth > 20) return undefined;
    if (v.startsWith('#')) return hex(v);
    if (palette[v] !== undefined) return color(palette[v], depth + 1);
    return undefined;
  };
  /** UI key → color; "*.background" style wildcards are honored like the IDE does. */
  const get = key => {
    if (ui[key] !== undefined) return color(ui[key]);
    const suffix = key.slice(key.lastIndexOf('.') + 1);
    if (ui['*.' + suffix] !== undefined) return color(ui['*.' + suffix]);
    return undefined;
  };
  return { palette, ui, color, get, name, dark: !!themes[0].dark };
}

module.exports = { load };
