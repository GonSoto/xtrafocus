// Renders every Chrome Web Store asset in store-assets/src/ to a PNG at the
// exact pixel size the store requires.
//
//   node store-assets/render.js
//
// The three screenshots embed the REAL popup (popup/popup.html + popup.css +
// popup.js + defaults.js), staged into a temp dir with chrome.storage stubbed
// so it renders outside an extension context. Nothing about the popup's markup
// or styling is mocked — only the storage reads that supply the toggle states.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(__dirname, 'src');
const OUT = __dirname;

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find((p) => fs.existsSync(p));

if (!CHROME) {
  console.error('No Chrome/Edge binary found — edit the CHROME list in this file.');
  process.exit(1);
}

// Each toggle state below is only what chrome.storage.sync would have returned;
// the popup then renders itself exactly as it does in the browser.
const STUB = `<script>
(function () {
  var q = new URLSearchParams(location.search);
  var state = q.get('state') || 'default';
  var overrides = {
    default: {},
    locked:  { hideFeed: true, hideSidebar: true },
    pause:   {}
  };
  var sync = Object.assign({}, overrides[state] || {});
  var pauseUntil = state === 'pause' ? Date.now() + 272000 : 0;
  window.chrome = {
    storage: {
      sync: {
        get: function (defaults, cb) { cb(Object.assign({}, defaults, sync)); },
        set: function () {}
      },
      local: {
        get: function (defaults, cb) { cb(Object.assign({}, defaults, { pauseUntil: pauseUntil })); },
        set: function () {},
        remove: function () {}
      },
      onChanged: { addListener: function () {} }
    }
  };
  window.addEventListener('load', function () {
    var list = document.getElementById('list');
    // ?section=N scrolls so section title N sits flush at the top of the list,
    // so a capture never starts on a half-clipped row.
    var s = q.get('section');
    if (s !== null) {
      var el = list.querySelectorAll('.section-title')[Number(s)];
      if (el) list.scrollTop = el.offsetTop - list.offsetTop;
    }
    var n = Number(q.get('scroll') || 0);
    if (n) list.scrollTop = n;
  });
})();
</script>
<style>
  /* Pin to the popup's real dimensions so the capture clips exactly like the
     browser's popup window does. */
  html, body { height: 560px !important; max-height: 560px !important; }
</style>`;

// `stage: true` writes the PNG into the staging dir instead of store-assets/ —
// used for the scrubbed x.com captures, which are an intermediate that the
// final composed screenshots then embed. Order matters: intermediates first.
const TARGETS = [
  { file: 'redact-before.html', out: 'home-scrubbed.png',       w: 1280, h: 800, stage: true },
  { file: 'redact-after.html',  out: 'home-after-scrubbed.png', w: 1280, h: 800, stage: true },
  { file: 'tile-small.html',    out: 'promo-tile-440x280.png',  w: 440,  h: 280 },
  { file: 'tile-marquee.html',  out: 'promo-marquee-1400x560.png', w: 1400, h: 560 },
  { file: 'shot-toggles.html',  out: 'screenshot-1-toggles.png', w: 1280, h: 800 },
  { file: 'shot-locking.html',  out: 'screenshot-2-locking.png', w: 1280, h: 800 },
  { file: 'shot-pause.html',    out: 'screenshot-3-pause.png',   w: 1280, h: 800 },
  { file: 'shot-before.html',   out: 'screenshot-4-before.png',  w: 1280, h: 800 },
  { file: 'shot-after.html',    out: 'screenshot-5-after.png',   w: 1280, h: 800 }
];

// Raw captures the redaction pages sit on top of. They stay out of the final
// upload set — only the scrubbed, composed versions ship.
const RAW_CAPTURES = ['home.png', 'home-after.png'];

// --- stage ---------------------------------------------------------------
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'xtrafocus-render-'));

fs.copyFileSync(path.join(ROOT, 'popup/popup.css'), path.join(stage, 'popup.css'));
fs.copyFileSync(path.join(ROOT, 'popup/popup.js'), path.join(stage, 'popup.js'));
fs.copyFileSync(path.join(ROOT, 'src/defaults.js'), path.join(stage, 'defaults.js'));
fs.copyFileSync(path.join(ROOT, 'icons/icon32.png'), path.join(stage, 'icon32.png'));
for (const f of fs.readdirSync(SRC)) fs.copyFileSync(path.join(SRC, f), path.join(stage, f));

for (const f of RAW_CAPTURES) {
  const src = path.join(OUT, f);
  if (!fs.existsSync(src)) {
    console.error(`Missing raw capture ${f} — see PUBLISH.md for how to retake it.`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(stage, f));
}

const popupHtml = fs
  .readFileSync(path.join(ROOT, 'popup/popup.html'), 'utf8')
  .replace('../icons/icon32.png', 'icon32.png')
  .replace('../src/defaults.js', 'defaults.js')
  .replace('</head>', STUB + '\n</head>');
fs.writeFileSync(path.join(stage, 'popup-render.html'), popupHtml);

// --- render --------------------------------------------------------------
fs.mkdirSync(OUT, { recursive: true });

for (const t of TARGETS) {
  const outPath = path.join(t.stage ? stage : OUT, t.out);
  execFileSync(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--allow-file-access-from-files',
    '--virtual-time-budget=5000',
    '--default-background-color=00000000',
    `--window-size=${t.w},${t.h}`,
    `--screenshot=${outPath}`,
    'file:///' + path.join(stage, t.file).replace(/\\/g, '/')
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const { size } = fs.statSync(outPath);
  const where = t.stage ? '(intermediate)' : '';
  console.log(`${t.out.padEnd(32)} ${t.w}x${t.h}  ${(size / 1024).toFixed(0)} KB ${where}`);
}

// KEEP=1 leaves the staging dir (with the intermediates) in place for inspection.
if (process.env.KEEP) {
  console.log('\nStaging kept at ' + stage);
} else {
  fs.rmSync(stage, { recursive: true, force: true });
}
console.log('\nDone — PNGs are in store-assets/');
