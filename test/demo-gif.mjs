// Records docs/demo.gif and docs/demo.mp4: the real effect on the animated demo character. Run: node build.mjs && node test/demo-gif.mjs
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { serve } from './serve.mjs';

const site = await serve(8765);
const html = readFileSync(new URL('../bookmarklet/install.html', import.meta.url), 'utf8');
const code = decodeURIComponent(html.match(/class="[^"]*\bdrag\b[^"]*" href="([^"]+)"/)[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').slice(11));
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection'] });
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
await p.goto('http://localhost:8765/test/test.html?avatar');
await p.evaluate((c) => (0, eval)(c), code);
await p.evaluate(() => { join(); document.querySelector('[title^="Hide"]'); });
await p.waitForTimeout(1500);
await p.getByText('1. Save empty room').click();
await p.evaluate(() => { window.person = false; });
await p.waitForTimeout(5600);
await p.evaluate(() => { window.person = true; __dustOut.S.msg = ''; });
await p.waitForTimeout(800);
const out = new URL('./out/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
// Record in the page at a steady 10 frames a second (screenshots are too slow and uneven).
await p.evaluate(() => {
  window.frames_ = [];
  const v = document.getElementById('remote'), c = document.createElement('canvas');
  c.width = 960; c.height = 540;
  window.rec = setInterval(() => { c.getContext('2d').drawImage(v, 0, 0, 960, 540); frames_.push(c.toDataURL('image/png')); }, 100);
});
await p.waitForTimeout(1300);                                 // talking
await p.evaluate(() => { window.snapAt = performance.now(); }); // raises a hand and snaps
await p.waitForTimeout(560);
await p.keyboard.press('Alt+Shift+KeyV');                   // the snap triggers Dust Out
await p.waitForTimeout(3600);                                // crumbles while still seated
await p.evaluate(() => { window.snapAt = 0; window.person = false; }); // gets up and leaves
await p.waitForTimeout(3200);                                // gone: just the room
await p.evaluate(() => { window.person = true; });           // sits back down
await p.waitForTimeout(500);
await p.evaluate(() => __dustOut.toggle());                  // dust rewinds
await p.waitForTimeout(4300);
const data = await p.evaluate(() => { clearInterval(rec); return frames_; });
const shots = data.map((d, i) => { const f = out + 'f' + String(i).padStart(3, '0') + '.png'; writeFileSync(f, Buffer.from(d.split(',')[1], 'base64')); return f; });
await b.close(); site.close();
execFileSync('python3', ['-c', `
import sys
from PIL import Image
fs = sys.argv[1:]
ims = [Image.open(f).convert('RGB').resize((400, 225), Image.LANCZOS) for f in fs]
ims = [im.convert('P', palette=Image.ADAPTIVE, colors=80) for im in ims]
ims[0].save('docs/demo.gif', save_all=True, append_images=ims[1:], duration=100, loop=0, optimize=True)
`, ...shots]);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '10', '-i', out + 'f%03d.png', '-vf', 'scale=960:540:flags=lanczos', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', 'docs/demo.mp4']);
console.log('wrote docs/demo.gif from', shots.length, 'frames');
