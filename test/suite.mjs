// Full check of the built bookmark against a Teams-like page. Prints PASS/FAIL per check.
// Checks the bookmark version (the exact code on bookmarklet/install.html) against a page that
// behaves like Teams. Prints PASS/FAIL per check. Run: node build.mjs && node test/suite.mjs
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { serve } from './serve.mjs';

const site = await serve(8765);
const helperSite = await serve(8777, new URL('../bookmarklet/', import.meta.url).pathname);
const html = readFileSync(new URL('../bookmarklet/install.html', import.meta.url), 'utf8');
const href = html.match(/class="[^"]*\bdrag\b[^"]*" href="([^"]+)"/)[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const code = decodeURIComponent(href.slice('javascript:'.length));

const results = [];
const check = (name, ok, detail = '') => { results.push([ok, name, detail]); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  (' + detail + ')' : '')); };

const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 980, height: 700 } });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => { if (m.text().includes('[dust-out]')) errors.push(m.text()); });
await p.goto('http://localhost:8765/test/test.html');
await p.evaluate(() => ac.resume());
const S = () => p.evaluate(() => { const s = __dustOut.S; return { state: s.state, cams: s.cams, plate: !!s.plate, msg: s.msg }; });
const waitState = async (want, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if ((await S()).state === want) return true; await p.waitForTimeout(100); } return false; };
const saveRoom = async (personInFrame = false) => {
  await p.getByText('1. Save empty room').click();
  await p.evaluate((v) => { window.person = v; }, personInFrame);
  await p.waitForTimeout(5600);
  await p.evaluate(() => { window.person = true; });
  await p.waitForTimeout(400);
};

// A. Pre-join: click the bookmark (exact code from install.html).
await p.evaluate((c) => (0, eval)(c), code);
await p.waitForTimeout(300);
check('A1 bookmark shows the card', await p.evaluate(() => document.body.innerText.includes('Dust Out')));
check('A2 pre-join self-view untouched', await p.evaluate(() => document.getElementById('self').srcObject === filtered));
await p.evaluate((c) => (0, eval)(c), code);
check('A3 clicking the bookmark twice is harmless', await p.evaluate(() => document.querySelectorAll('div').length > 0 && Object.keys(window).filter((k) => k === '__dustOut').length === 1));

// B. Join the call.
await p.evaluate(() => join());
await p.waitForTimeout(1500);
const joined = await p.evaluate(() => ({
  cams: __dustOut.S.cams,
  senderIsTeams: sender.track === filtered.getVideoTracks()[0],
  selfGetterIsTeams: document.getElementById('self').srcObject === filtered,
  remote: document.getElementById('remote').videoWidth,
  preview: [...document.querySelectorAll('video')].some((v) => v.parentElement && v.parentElement.innerText.includes('What others see') && v.videoWidth > 0),
}));
check('B1 hooks the outgoing video', joined.cams === 1, 'cams=' + joined.cams);
check('B2 Teams still sees its own sender track', joined.senderIsTeams);
check('B3 Teams still reads its own self-view stream', joined.selfGetterIsTeams);
check('B4 the other side receives video', joined.remote > 0);
check('B5 card preview shows the outgoing video', joined.preview);

// S. Teams' own self-view tiles.
await p.evaluate(() => {
  window.postClone = filtered.getVideoTracks()[0].clone();
  const v = document.createElement('video'); v.id = 'bigPost'; v.muted = true; v.autoplay = true; v.style.cssText = 'width:320px;height:180px';
  document.body.append(v); v.srcObject = new MediaStream([postClone]);
});
await p.waitForTimeout(1500);
const sv = await p.evaluate(() => {
  const shows = (id) => nativeSrc.call(document.getElementById(id)).getVideoTracks()[0];
  const effect = (t) => !!t && t !== filtered.getVideoTracks()[0] && t.constructor.name === 'MediaStreamTrackGenerator';
  return {
    post: effect(shows('bigPost')), pre: effect(shows('bigPre')), hidden: !effect(shows('hidden')),
    remote: shows('remote') === document.getElementById('remote').srcObject.getVideoTracks()[0] && !effect(shows('remote')),
    getterPost: document.getElementById('bigPost').srcObject.getVideoTracks()[0] === postClone,
  };
});
check('S1 big self-view (duplicate made after the bookmark) shows the effect', sv.post);
check('S2 big self-view (duplicate made before the bookmark) shows the effect', sv.pre);
check('S3 hidden helper video (filter input) is left alone', sv.hidden);
check('S4 other people\'s video is left alone', sv.remote);
check('S5 Teams still reads its own stream from the self-view', sv.getterPost);
const rend = await p.evaluate(async () => {
  const before = __dustOut.S.renders || 0;
  const rd = new MediaStreamTrackProcessor({ track: postClone.clone() }).readable.getReader();
  const { value } = await rd.read(); value.close(); rd.cancel();
  const raw = new MediaStreamTrackProcessor({ track: preClone }).readable.getReader(); raw.cancel();
  return { redirected: (__dustOut.S.renders || 0) - before };
});
check('S6 Teams\' own renderer gets the effect for an exact duplicate only', rend.redirected === 1, 'redirected ' + rend.redirected);

// Record what the other side receives.
await p.evaluate(() => {
  window.seen = {}; window.jumps = [];
  const c = new OffscreenCanvas(160, 90), x = c.getContext('2d', { willReadFrequently: true });
  let prev = null, prevState = null;
  const r = new MediaStreamTrackProcessor({ track: document.getElementById('remote').srcObject.getVideoTracks()[0] }).readable.getReader();
  (async () => { for (;;) { const { value: f, done } = await r.read(); if (done) break; const k = __dustOut.S.state; seen[k] = (seen[k] || 0) + 1;
    x.drawImage(f, 0, 0, 160, 90); f.close();
    const d = x.getImageData(0, 0, 160, 90).data;
    if (prev) { let s = 0; for (let i = 0; i < d.length; i += 4) s += Math.abs(d[i] - prev[i]) + Math.abs(d[i + 1] - prev[i + 1]) + Math.abs(d[i + 2] - prev[i + 2]); jumps.push([prevState + '>' + k, s / (160 * 90 * 3)]); }
    prev = d; prevState = k; } })();
});

// C. Toggle before saving the room.
await p.keyboard.press('Alt+Shift+KeyV');
await p.waitForTimeout(500);
check('C1 snapping before saving the room just asks to save it', (await S()).state === 'live' && /Save the empty room/.test((await S()).msg));

// D. Bad save: still in the frame.
await p.evaluate(() => { window.still = true; }); // holding still, as you would when saving
await saveRoom(true);
await p.keyboard.press('Alt+Shift+KeyV');
await p.waitForTimeout(1200);
const bad = await S();
await p.evaluate(() => { window.still = false; });
check('D1 room saved with you in it: stays live and explains', bad.state === 'live' && /Couldn't find you/.test(bad.msg), bad.msg);

// E. Good save, full cycle, getting up early (0.4 s after the snap).
await saveRoom(false);
check('E1 thumbnail of the saved room is shown, labelled', await p.evaluate(() => document.body.innerText.includes('Saved empty room')));
await p.keyboard.press('Alt+Shift+KeyV');
await p.waitForTimeout(400);
await p.evaluate(() => { window.person = false; });
check('E2 snap starts the crumble', await waitState('vanishing', 1000));
const tV = Date.now();
check('E3 crumble ends in the empty room', await waitState('gone', 9000), ((Date.now() - tV) / 1000).toFixed(1) + 's');
await p.waitForTimeout(1500);
await p.evaluate(() => { window.person = true; });
await p.waitForTimeout(300);
await p.getByText('Come back now').click();
check('E4 come back starts the return', await waitState('returning', 1000));
check('E5 return ends live', await waitState('live', 6000));
await p.waitForTimeout(500);
const stats = await p.evaluate(() => {
  const by = {};
  for (const [k, v] of jumps) (by[k] ||= []).push(v);
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  return { by: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, { n: v.length, avg: avg(v), max: Math.max(...v) }])), seen, fmts: Object.keys(__dustOut.S.fmts || {}), cost: __dustOut.S.cost };
});
const sw = (k) => stats.by[k] ? stats.by[k].max : null;
check('E6 every frame goes back in Teams\' format', stats.fmts.every((f) => f.split(':')[1].split('>')[0] === f.split('>')[1]), stats.fmts.join(' '));
check('E7 no visible jump when the snap starts', sw('live>vanishing') !== null && sw('live>vanishing') < 4, 'change ' + sw('live>vanishing')?.toFixed(2));
check('E8 no visible jump when the crumble ends', sw('vanishing>gone') !== null && sw('vanishing>gone') < 2, 'change ' + sw('vanishing>gone')?.toFixed(2));
check('E9 no visible jump when the return starts', sw('gone>returning') !== null && sw('gone>returning') < 2, 'change ' + sw('gone>returning')?.toFixed(2));
check('E10 no visible jump when the return ends', sw('returning>live') !== null && sw('returning>live') < 4, 'change ' + sw('returning>live')?.toFixed(2));
check('E11 dust keeps moving after you get up early', stats.by['vanishing>vanishing'] && stats.by['vanishing>vanishing'].avg > 0.5 && stats.by['vanishing>vanishing'].max < 10, 'avg change ' + stats.by['vanishing>vanishing']?.avg.toFixed(2) + ', max ' + stats.by['vanishing>vanishing']?.max.toFixed(2));
const ms = (k) => stats.cost[k] ? stats.cost[k][0] / stats.cost[k][1] : 0;
check('E12 effect fits in a 30 fps frame budget (test PC, no GPU)', ms('vanishing') < 33 && ms('returning') < 33, 'crumble ' + ms('vanishing').toFixed(1) + ' ms, return ' + ms('returning').toFixed(1) + ' ms, empty room ' + ms('gone').toFixed(1) + ' ms');


// G. Teams swaps the camera mid-call.
await p.evaluate(async () => { const t2 = filtered.getVideoTracks()[0].clone(); await sender.replaceTrack(null); await sender.replaceTrack(t2); window.t2 = t2; });
await p.waitForTimeout(800);
check('G1 camera off/on mid-call is re-hooked, Teams sees its own track', await p.evaluate(() => sender.track === t2) && (await S()).cams >= 1);

// H. Pop-out call window.
const [pop] = await Promise.all([ctx.waitForEvent('page'), p.evaluate(() => { window.callWin = window.open('/test/blank.html?popout', 'callpopout', 'popup,width=500,height=320'); })]);
await pop.waitForLoadState();
await p.waitForTimeout(700);
const swaps0 = await p.evaluate(() => __dustOut.S.swaps || 0);
await p.evaluate(() => { const v = callWin.document.createElement('video'); v.autoplay = true; v.muted = true; v.id = 'self'; callWin.document.body.append(v); v.srcObject = new callWin.MediaStream([t2]); });
await p.waitForTimeout(500);
check('H1 pop-out self-view shows the effect', (await p.evaluate(() => __dustOut.S.swaps || 0)) > swaps0);
check('H2 Teams still reads its own stream in the pop-out', await pop.evaluate(() => document.getElementById('self').srcObject.getVideoTracks()[0] === window.opener.t2));
await pop.bringToFront();
await pop.keyboard.press('Alt+Shift+KeyV');
await p.waitForTimeout(800);
check('H3 shortcut works inside the pop-out', (await S()).state === 'vanishing');
check('H4 the card moves into the pop-out', await pop.evaluate(() => document.body.innerText.includes('Dust Out')));
await waitState('gone', 9000);
await p.evaluate(() => __dustOut.toggle());
await waitState('live', 6000);
// The pop-out runs its own copy of the call.
const calls0 = await p.evaluate(() => __dustOut.S.calls);
const popOwn = await pop.evaluate(() => { const pc = new RTCPeerConnection(); const snd = pc.addTrack(window.opener.t2); return snd.track === window.opener.t2; });
check('H5 a call started inside the pop-out is hooked too', (await p.evaluate(() => __dustOut.S.calls)) > calls0 && popOwn);
await pop.close();
await p.waitForTimeout(700);
check('H6 the card comes back when the pop-out closes', await p.evaluate(() => document.body.innerText.includes('Dust Out')));

// L. Screen share is left alone.
const cams0 = (await S()).cams;
const shareHooked = await p.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 320; c.height = 180;
  const t = c.captureStream(5).getVideoTracks()[0]; t.contentHint = 'detail';
  const snd = new RTCPeerConnection().addTrack(t);
  return snd.track !== t;
});
await p.waitForTimeout(300);
check('L1 screen share is not touched', !shareHooked && (await S()).cams === cams0);

// I. Snap sound: teach, then real snaps vs talking and typing.
await p.bringToFront();
// Quick double toggle of the listener must not double-count snaps.
await p.evaluate(() => { const b = [...document.querySelectorAll('input[type=checkbox]')][0]; b.click(); b.click(); b.click(); });
await p.waitForTimeout(800);
await p.getByText('Teach my snap').click();
await p.waitForTimeout(800);
await p.evaluate(() => play('snap', 0.5)); await p.waitForTimeout(900);
check('I0 one snap counts once (no double listening)', /Heard snap 1 of 3/.test((await S()).msg), (await S()).msg);
for (let i = 0; i < 2; i++) { await p.evaluate(() => play('snap', 0.5)); await p.waitForTimeout(900); }
check('I1 learns your snap from 3 snaps', /Learned your snap/.test((await S()).msg), (await S()).msg);
const fires = async (kind, amp) => {
  await p.waitForTimeout(1700);
  await p.evaluate(() => { __dustOut.S.msg = ''; });
  await p.evaluate(([k, a]) => play(k, a), [kind, amp]);
  await p.waitForTimeout(600);
  const fired = /Heard a snap/.test((await S()).msg);
  await p.evaluate(() => { __dustOut.S.armAt = 0; });
  return fired;
};
check('I2 a snap triggers it', await fires('snap', 0.5));
check('I3 a softer snap triggers it', await fires('snap', 0.35));
check('I4 talking does not trigger it', !(await fires('speech', 0.6)));
check('I5 loud talking does not trigger it', !(await fires('speech', 0.95)));
check('I6 typing clicks do not trigger it', !(await fires('click', 0.05)));

// J. Hand-gesture messages: only the helper's address is trusted.
await p.evaluate(() => { __dustOut.S.msg = ''; window.postMessage({ snapVanish: 'snap' }, '*'); });
await p.waitForTimeout(300);
check('J1 snap messages from other pages are ignored', !/Saw a snap/.test((await S()).msg));
const [helper] = await Promise.all([ctx.waitForEvent('page'), p.getByText('Hand gesture').click()]);
await helper.waitForLoadState();
await helper.evaluate(() => fakeSnap());
await p.waitForTimeout(400);
check('J2 the gesture helper can trigger it', /Saw a snap/.test((await S()).msg));
await p.evaluate(() => { __dustOut.S.armAt = 0; });
await helper.close();

// K. Hiding the card keeps the shortcut; the bookmark brings it back.
await p.locator('button[title^="Hide"]').click();
await p.evaluate((c) => (0, eval)(c), code);
check('K1 bookmark brings a hidden card back', await p.evaluate(() => document.body.innerText.includes('Dust Out')));

// R. Fixes from the second review.
// Listening off and on again must not go deaf.
await p.evaluate(() => { const b = [...document.querySelectorAll('input[type=checkbox]')][0]; b.click(); });
await p.waitForTimeout(400);
await p.evaluate(() => { const b = [...document.querySelectorAll('input[type=checkbox]')][0]; b.click(); });
await p.waitForTimeout(800);
check('R1 snaps are still heard after turning listening off and on', await fires('snap', 0.5));
// Hand gesture from the card while it's in a pop-out.
const [pop2] = await Promise.all([ctx.waitForEvent('page'), p.evaluate(() => { window.callWin2 = window.open('/test/blank.html?p2', 'callpopout2', 'popup,width=500,height=320'); })]);
await pop2.waitForLoadState();
await p.waitForTimeout(700);
await p.evaluate(() => { const v = callWin2.document.createElement('video'); v.muted = true; callWin2.document.body.append(v); v.srcObject = new callWin2.MediaStream([t2]); });
await p.waitForTimeout(500);
check('R2a card is in the second pop-out', await pop2.evaluate(() => document.body.innerText.includes('Dust Out')));
const [helper2] = await Promise.all([ctx.waitForEvent('page'), pop2.getByText('Hand gesture').click()]);
await helper2.waitForLoadState();
await p.evaluate(() => { __dustOut.S.msg = ''; });
await helper2.evaluate(() => fakeSnap());
await p.waitForTimeout(400);
check('R2b hand gesture works while the card is in the pop-out', /Saw a snap/.test((await S()).msg), (await S()).msg);
await p.evaluate(() => { __dustOut.S.armAt = 0; });
await helper2.close();
await pop2.close();
await p.waitForTimeout(700);
check('R2c card back home and buttons still work', await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Vanish') || x.textContent.includes('Come back')); return !!b && document.body.innerText.includes('Dust Out'); }));
// The main tab closing hands the call back its normal camera.
await p.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
await p.waitForTimeout(300);
check('R3 closing the tab gives the call its normal camera back', await p.evaluate(() => nativeSenderTrack.call(sender) === t2));

check('Z1 no errors from Snap Vanish or the page', errors.length === 0, errors.slice(0, 3).join(' | '));
const failed = results.filter((r) => !r[0]);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' passed');
await b.close();
site.close(); helperSite.close();
process.exit(failed.length ? 1 : 0);
