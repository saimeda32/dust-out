// Checks the Chrome extension itself: loaded into Chrome for Testing, running on a Teams-like
// page and on a page with Google Meet's strict script rules. Prints PASS/FAIL per check.
// Run: node build.mjs && node test/ext-suite.mjs
// Needs Chrome for Testing (npx playwright install chromium) or set CHROME_FOR_TESTING.
import { chromium } from 'playwright-core';
import { readFileSync, readdirSync, mkdtempSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const ext = new URL('../extension', import.meta.url).pathname;
const testDir = new URL('.', import.meta.url).pathname;
const findChrome = () => {
  if (process.env.CHROME_FOR_TESTING) return process.env.CHROME_FOR_TESTING;
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  const dir = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
  return join(cache, dir, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
};

const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  (' + detail + ')' : '')); };

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'dust-out-')), {
  executablePath: findChrome(),
  headless: false,
  viewport: { width: 980, height: 700 },
  args: [
    '--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`,
    '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
    '--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection', '--autoplay-policy=no-user-gesture-required',
  ],
});

// Serve the test page as if it were Teams, and as if it were Meet with Meet's script rules.
const NONCE = 'dusttest';
await ctx.route('https://teams.microsoft.com/dust-test/**', (r) => {
  const f = new URL(r.request().url()).pathname.split('/').pop();
  r.fulfill({ contentType: 'text/html', body: readFileSync(join(testDir, f)) });
});
await ctx.route('https://meet.google.com/dust-test/**', (r) => r.fulfill({
  contentType: 'text/html',
  headers: { 'content-security-policy': `script-src 'nonce-${NONCE}' 'strict-dynamic'; require-trusted-types-for 'script'` },
  body: readFileSync(join(testDir, 'test.html'), 'utf8').replace(/<script>/g, `<script nonce="${NONCE}">`),
}));

let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
const extId = sw.url().split('/')[2];

const errors = [];
const open = async (url) => {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.text().includes('[dust-out]')) errors.push(m.text()); });
  await p.goto(url);
  await p.waitForTimeout(500);
  return p;
};

// A. Teams-like page.
const p = await open('https://teams.microsoft.com/dust-test/test.html');
const S = () => p.evaluate(() => { const s = __dustOut.S; return { state: s.state, cams: s.cams, msg: s.msg }; });
const waitState = async (want, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if ((await S()).state === want) return true; await p.waitForTimeout(100); } return false; };
check('A1 loads by itself before the page (no bookmark)', await p.evaluate(() => !!window.__dustOut));
check('A2 card stays hidden until a call starts', !(await p.evaluate(() => document.body.innerText.includes('Dust Out'))));
await p.evaluate(() => join());
await p.waitForTimeout(1500);
check('A3 card appears when your camera joins a call', await p.evaluate(() => document.body.innerText.includes('Dust Out')));
check('A4 hooks the outgoing video', (await S()).cams === 1);

// Save the room, then vanish while the person stays seated (so "gone" must hide them).
await p.getByText('1. Save empty room').click();
await p.evaluate(() => { window.person = false; });
await p.waitForTimeout(5600);
await p.evaluate(() => { window.person = true; });
await p.waitForTimeout(500);
await p.keyboard.press('Alt+Shift+KeyV');
check('A5 snap starts the crumble', await waitState('vanishing', 1500));
check('A6 crumble ends in the empty room', await waitState('gone', 9000));
await p.waitForTimeout(1500);
// Compare what each view shows with the empty room and with the live camera (person present).
const looks = await p.evaluate(() => {
  const small = (src) => { const c = document.createElement('canvas'); c.width = 96; c.height = 54; c.getContext('2d').drawImage(src, 0, 0, 96, 54); return c.getContext('2d').getImageData(0, 0, 96, 54).data; };
  const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return s / (a.length / 4 * 3); };
  const room = small(__dustOut.S.plate), cam = small(cv);
  const out = {};
  for (const id of ['remote', 'self', 'bigPre']) { const v = small(document.getElementById(id)); out[id] = { room: +diff(v, room).toFixed(1), camera: +diff(v, cam).toFixed(1) }; }
  return out;
});
const empty = (k) => looks[k].room < looks[k].camera * 0.5;
check('A7 the other side sees the empty room', empty('remote'), JSON.stringify(looks.remote));
check('A8 your self-view shows the empty room', empty('self'), JSON.stringify(looks.self));
check('A9 a big self-view made before the call shows it too', empty('bigPre'), JSON.stringify(looks.bigPre));
check('A10 frames go back in the page\'s format', await p.evaluate(() => Object.keys(__dustOut.S.fmts).every((f) => f.split(':')[1].split('>')[0] === f.split('>')[1])));
await p.getByText('Come back now').click();
check('A11 comes back live', await waitState('live', 6000));

// B. Hand gesture through the extension (no local server).
await p.getByRole('button', { name: 'Hand gesture', exact: true }).click();
let handMsg = '';
for (let i = 0; i < 40 && !/Hand gesture on|stopped|could not|Allow the camera/i.test(handMsg); i++) { await p.waitForTimeout(500); handMsg = (await S()).msg; }
check('B1 hand tracking starts inside the extension', /Hand gesture on/.test(handMsg), handMsg);
await p.waitForTimeout(3000);
check('B2 hand tracking keeps running on camera frames', !/stopped|busy|could not/i.test((await S()).msg), (await S()).msg);
const extPage = await open(`chrome-extension://${extId}/popup.html`);
// Only the hidden hand-tracking page may report snaps; anything else is ignored.
await p.evaluate(() => { __dustOut.S.msg = ''; });
await extPage.evaluate(() => chrome.runtime.sendMessage({ type: 'hand-snap' }));
await p.waitForTimeout(800);
check('B3 a fake snap from another extension page is ignored', !/Saw a snap/.test((await S()).msg), (await S()).msg);
// The extension -> meeting tab path for a real snap.
await sw.evaluate(async () => { const [t] = await chrome.tabs.query({ url: 'https://teams.microsoft.com/*' }); await chrome.tabs.sendMessage(t.id, { type: 'snap' }); });
await p.waitForTimeout(800);
check('B4 a snap from the extension reaches the meeting tab', /Saw a snap/.test((await S()).msg), (await S()).msg);
await p.evaluate(() => { __dustOut.S.armAt = 0; });
await p.getByText('Hand gesture: on').click();
await p.waitForTimeout(800);
check('B5 turning hand gesture off turns the camera off', !(await sw.evaluate(() => chrome.offscreen.hasDocument())));
// A page script (no click) can't switch the camera on. Chrome counts a click as recent for
// about 5 seconds, so wait that out first.
// (Test code itself counts as a click, so the fake page script fires on a timer after that.)
await p.evaluate(() => setTimeout(() => { window.activeAtPost = navigator.userActivation.isActive; window.postMessage({ dustOut: 'gesture', on: true }, location.origin); }, 6500));
await p.waitForTimeout(8500);
console.log('  (page had a recent click when it posted: ' + await p.evaluate(() => window.activeAtPost) + ')');
check('B6 a page script without your click can\'t start the camera', !(await sw.evaluate(() => chrome.offscreen.hasDocument())));
// Reloading the meeting tab while hand gesture is on turns the camera off.
await p.getByRole('button', { name: 'Hand gesture', exact: true }).click();
for (let i = 0; i < 20 && !(await sw.evaluate(() => chrome.offscreen.hasDocument())); i++) await p.waitForTimeout(250);
const wasOn = await sw.evaluate(() => chrome.offscreen.hasDocument());
await p.reload();
await p.waitForTimeout(1500);
check('B7 reloading the meeting turns the camera off', wasOn && !(await sw.evaluate(() => chrome.offscreen.hasDocument())));

// C. Page with Google Meet's strict script rules (where the bookmark is blocked).
const m = await open('https://meet.google.com/dust-test/test.html');
check('C1 runs despite Meet-style script rules', await m.evaluate(() => !!window.__dustOut));
await m.evaluate(() => join());
await m.waitForTimeout(1500);
check('C2 hooks the outgoing video there too', await m.evaluate(() => __dustOut.S.cams === 1));

// D. Toolbar popup.
check('D1 popup opens without errors', await extPage.evaluate(() => document.getElementById('state').textContent.length > 0));

check('Z1 no errors from Dust Out or the pages', errors.length === 0, errors.slice(0, 3).join(' | '));
const failed = results.filter((r) => !r).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed');
await ctx.close();
process.exit(failed ? 1 : 0);
