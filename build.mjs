// One source, two ways to use it. Run: node build.mjs
//   src/dust-out.js       -> extension/dust-out.js (Chrome extension)
//                         -> bookmarklet/install.html (drag-to-bookmarks page)
//   src/gesture-detect.js -> extension/ and bookmarklet/ (hand-gesture snap detector)
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const here = (p) => new URL(p, import.meta.url);
const core = readFileSync(here('./src/dust-out.js'), 'utf8');

copyFileSync(here('./src/dust-out.js'), here('./extension/dust-out.js'));
copyFileSync(here('./src/gesture-detect.js'), here('./extension/gesture-detect.js'));
copyFileSync(here('./src/gesture-detect.js'), here('./bookmarklet/gesture-detect.js'));

const href = 'javascript:' + encodeURIComponent(core);
const page = readFileSync(here('./bookmarklet/install.template.html'), 'utf8')
  .replace('__BOOKMARKLET__', href.replace(/&/g, '&amp;').replace(/"/g, '&quot;'));
writeFileSync(here('./bookmarklet/install.html'), page);
console.log('built extension/ and bookmarklet/install.html (' + href.length + ' chars)');
