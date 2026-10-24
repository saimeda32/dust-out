// One source, every way to use it. Run: node build.mjs
//   src/dust-out.js       -> extension/dust-out.js (Chrome extension)
//                         -> docs/index.html (website, with the bookmark button)
//                         -> docs/dust-out.js (the code to paste into the console)
//   src/gesture-detect.js -> extension/ and bookmarklet/ (hand-gesture snap detector)
//   extension/            -> dist/dust-out-extension.zip (download for "Load unpacked")
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const here = (p) => new URL(p, import.meta.url);
const core = readFileSync(here('./src/dust-out.js'), 'utf8');

copyFileSync(here('./src/dust-out.js'), here('./extension/dust-out.js'));
copyFileSync(here('./src/gesture-detect.js'), here('./extension/gesture-detect.js'));
copyFileSync(here('./src/gesture-detect.js'), here('./bookmarklet/gesture-detect.js'));
copyFileSync(here('./src/dust-out.js'), here('./docs/dust-out.js')); // for "Copy the code" (console snippet)

const href = 'javascript:' + encodeURIComponent(core);
const page = (assets) => readFileSync(here('./site.template.html'), 'utf8')
  .replace('__BOOKMARKLET__', href.replace(/&/g, '&amp;').replace(/"/g, '&quot;'))
  .replaceAll('__ASSETS__', assets)
  .replace('__TIMELINE__', readFileSync(here('./docs/demo-timeline.json'), 'utf8').trim());
writeFileSync(here('./docs/index.html'), page(''));

// The extension as a zip with a clear folder name, for the download button.
const dist = here('./dist/').pathname;
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist + 'dust-out-extension', { recursive: true });
execFileSync('cp', ['-R', here('./extension/').pathname + '.', dist + 'dust-out-extension/']);
execFileSync('zip', ['-qr', 'dust-out-extension.zip', 'dust-out-extension'], { cwd: dist });
console.log('built extension/, docs/index.html, docs/dust-out.js, dist/dust-out-extension.zip');
