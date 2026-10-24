// Takes docs/card.png: the Dust Out card during a call on the synthetic test scene.
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { serve } from './serve.mjs';

const site = await serve(8765);
const html = readFileSync(new URL('../bookmarklet/install.html', import.meta.url), 'utf8');
const code = decodeURIComponent(html.match(/class="[^"]*\b(?:drag|chip)\b[^"]*" href="([^"]+)"/)[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').slice(11));
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection'] });
const p = await b.newPage({ viewport: { width: 1000, height: 820 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:8765/test/test.html?avatar');
await p.evaluate((c) => (0, eval)(c), code);
await p.evaluate(() => join());
await p.waitForTimeout(1500);
await p.getByText('1. Save empty room').click();
await p.evaluate(() => { window.person = false; });
await p.waitForTimeout(5600);
await p.evaluate(() => { window.person = true; __dustOut.S.msg = ''; __dustOut.S.state = 'live'; });
await p.waitForTimeout(1200);
await p.locator('div', { hasText: /^Dust Out/ }).filter({ has: p.getByText('What others see') }).last().screenshot({ path: new URL('../docs/card.png', import.meta.url).pathname });
await b.close(); site.close();
console.log('wrote docs/card.png');
