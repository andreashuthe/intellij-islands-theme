/**
 * Takes the README screenshots in a real VS Code (docs/*.png).
 *
 *   npm i --no-save playwright @vscode/test-electron
 *   xvfb-run -a node scripts/screenshots.js      # Linux; on macOS just `node scripts/screenshots.js`
 *
 * Optional: KOTLIN_GRAMMAR=/path/to/kotlin.tmLanguage.json to highlight the Kotlin sample with a grammar
 * (VS Code has none built in; the JetBrains extension brings its own).
 */
const { _electron } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const samples = path.join(root, 'test', 'samples');
const out = path.join(root, 'docs');
const W = 1440;
const H = 860;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function vscodePath() {
  if (process.env.VSCODE_PATH) return process.env.VSCODE_PATH;
  const { downloadAndUnzipVSCode } = require('@vscode/test-electron');
  return downloadAndUnzipVSCode('stable');
}

function previewExtension(tmp) {
  const dir = path.join(tmp, 'preview');
  fs.cpSync(path.join(root, 'test', 'preview-extension'), dir, { recursive: true });
  const grammar = process.env.KOTLIN_GRAMMAR;
  if (grammar && fs.existsSync(grammar)) {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    fs.copyFileSync(grammar, path.join(dir, 'kotlin.tmLanguage.json'));
    pkg.contributes.grammars = [{ language: 'kotlin', scopeName: 'source.kotlin', path: './kotlin.tmLanguage.json' }];
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
  }
  return dir;
}

async function shoot({ theme, files, name, sidebar = true, extraSettings = {} }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'islands-'));
  const userData = path.join(tmp, 'user');
  fs.mkdirSync(path.join(userData, 'User'), { recursive: true });
  fs.writeFileSync(path.join(userData, 'User', 'settings.json'), JSON.stringify({
    'workbench.colorTheme': theme,
    'workbench.startupEditor': 'none',
    'workbench.tips.enabled': false,
    'workbench.secondarySideBar.defaultVisibility': 'hidden',
    'chat.disableAIFeatures': true,
    'window.commandCenter': true,
    'window.title': '${activeEditorShort} — shop',
    'editor.fontFamily': 'JetBrains Mono',
    'editor.fontSize': 14,
    'editor.lineHeight': 1.6,
    'editor.minimap.enabled': false,
    'editor.stickyScroll.enabled': false,
    'editor.guides.indentation': true,
    'breadcrumbs.enabled': false,
    'git.enabled': false,
    'telemetry.telemetryLevel': 'off',
    'update.mode': 'none',
    'workbench.editor.enablePreview': false,
    'explorer.openEditors.visible': 0,
    ...extraSettings,
  }));
  const app = await _electron.launch({
    executablePath: await vscodePath(),
    args: [
      '--no-sandbox', '--disable-gpu', '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes',
      `--user-data-dir=${userData}`, `--extensions-dir=${path.join(tmp, 'ext')}`,
      `--extensionDevelopmentPath=${root}`, `--extensionDevelopmentPath=${previewExtension(tmp)}`,
      samples, ...files.map(f => path.join(samples, f)),
    ],
  });
  const w = await app.firstWindow();
  await w.setViewportSize({ width: W, height: H });
  await sleep(6000);
  for (let i = 0; i < 3; i++) {
    await w.keyboard.press('Escape');
    await sleep(200);
  }
  await w.evaluate(() => {
    const s = document.createElement('style');
    s.textContent = '.notifications-toasts,.notification-toast-container{display:none!important}';
    document.head.appendChild(s);
  });
  if (!sidebar) await w.keyboard.press('Control+B');
  // put the caret into the method so the current line and identifier highlights show
  const target = await w.evaluate(() => {
    const line = [...document.querySelectorAll('.editor-instance .view-line')].find(l => /public void lock|fun total|total\(|def total|Total\(|fn total/.test(l.textContent.replace(/ /g, ' ')));
    if (!line) return null;
    const b = line.getBoundingClientRect();
    return { x: b.x + 160, y: b.y + b.height / 2 };
  });
  if (target) await w.mouse.click(target.x, target.y);
  await w.mouse.move(W - 5, H - 5);
  await sleep(2500);
  // remove "[Extension Development Host]" / "[Superuser]" from the title / command center
  await w.evaluate(() => {
    const walk = document.createTreeWalker(document.querySelector('.part.titlebar') ?? document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode());) n.textContent = n.textContent.replace(/\s*\[(Extension Development Host|Superuser)\]\s*/g, ' ').trim();
  });
  await sleep(300);
  const file = path.join(out, `${name}.png`);
  await w.screenshot({ path: file, clip: { x: 0, y: 0, width: W, height: H } });
  await app.close();
  console.log('wrote', path.relative(root, file));
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const only = process.argv[2];
  const shots = [
    { name: 'dark-java', theme: 'Islands Dark', files: ['EntityRepositoryDao.java'] },
    { name: 'light-java', theme: 'Islands Light', files: ['EntityRepositoryDao.java'] },
    { name: 'dark-kotlin', theme: 'Islands Dark', files: ['OrderService.kt'] },
    { name: 'light-kotlin', theme: 'Islands Light', files: ['OrderService.kt'] },
    { name: 'dark-typescript', theme: 'Islands Dark', files: ['service.ts'] },
    { name: 'dark-python', theme: 'Islands Dark', files: ['orders.py'] },
    { name: 'dark-go', theme: 'Islands Dark', files: ['order.go'] },
    { name: 'dark-rust', theme: 'Islands Dark', files: ['order.rs'] },
    { name: 'dark-css', theme: 'Islands Dark', files: ['styles.css'] },
    { name: 'dark-php', theme: 'Islands Dark', files: ['OrderService.php'] },
    { name: 'dark-cpp', theme: 'Islands Dark', files: ['order.cpp'] },
    { name: 'light-typescript', theme: 'Islands Light', files: ['service.ts'] },
  ];
  for (const s of shots) if (!only || s.name === only) await shoot(s);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
