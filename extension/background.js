// Runs hand tracking in an offscreen page and relays snaps to the meeting tab. Tab list lives in
// session storage (the worker sleeps); events are queued so the camera never stays on by mistake.
const OFFSCREEN = 'offscreen.html';
let queue = Promise.resolve();
const run = (job) => (queue = queue.then(job).catch((e) => console.warn('[dust-out]', e)));

const tabs = async () => (await chrome.storage.session.get('tabs')).tabs || [];
const setTabs = (list) => chrome.storage.session.set({ tabs: list });
const tell = (id, type, text) => chrome.tabs.sendMessage(id, { type, text }).catch(() => {});
const tellAll = async (type, text) => { for (const id of await tabs()) tell(id, type, text); };

async function stopAll(type, text) {
  if (text) await tellAll(type || 'status', text);
  await tellAll('gesture-off');
  await setTabs([]);
  if (await chrome.offscreen.hasDocument()) await chrome.offscreen.closeDocument();
}
async function forget(id) {
  const list = await tabs();
  if (!list.includes(id)) return;
  const left = list.filter((t) => t !== id);
  await setTabs(left);
  if (!left.length && await chrome.offscreen.hasDocument()) await chrome.offscreen.closeDocument();
}

chrome.runtime.onMessage.addListener((m, sender) => {
  const fromHandPage = !sender.tab && sender.url === chrome.runtime.getURL(OFFSCREEN);
  if (m.type === 'gesture' && sender.tab) {
    const id = sender.tab.id;
    run(async () => {
      if (!m.on) return forget(id);
      await setTabs([...(await tabs()).filter((t) => t !== id), id]);
      if (await chrome.offscreen.hasDocument()) return tell(id, 'status', 'Hand gesture on. Snap with your hand in view.');
      try {
        await chrome.offscreen.createDocument({ url: OFFSCREEN, reasons: ['USER_MEDIA'], justification: 'Watches your hand for a finger snap.' });
      } catch (e) {
        await stopAll('status', 'Hand tracking could not start: ' + e.message);
      }
    });
  } else if (fromHandPage && m.type === 'hand-snap') {
    // Most recent tab only.
    run(async () => { const list = await tabs(); if (list.length) tell(list[list.length - 1], 'snap'); });
  } else if (fromHandPage && m.type === 'hand-status') {
    run(() => tellAll('status', m.text));
  } else if (fromHandPage && m.type === 'hand-failed') {
    run(() => stopAll('status', m.text));
  } else if (fromHandPage && m.type === 'hand-need-camera') {
    run(async () => {
      await stopAll('status', 'Allow the camera in the Dust Out tab that just opened, then turn Hand gesture on again.');
      const { setupAt = 0 } = await chrome.storage.session.get('setupAt');
      if (Date.now() - setupAt > 30000) {
        await chrome.storage.session.set({ setupAt: Date.now() });
        chrome.tabs.create({ url: 'setup.html' });
      }
    });
  }
});

// Closing, reloading or leaving a tab stops hand tracking for it.
chrome.tabs.onRemoved.addListener((id) => run(() => forget(id)));
chrome.tabs.onUpdated.addListener((id, info) => { if (info.status === 'loading') run(() => forget(id)); });

// Site permission removed in Chrome settings: stop loading there.
chrome.permissions.onRemoved.addListener(async ({ origins = [] }) => {
  const ids = origins.map((o) => { try { return 'site-' + new URL(o.replace('/*', '/')).hostname; } catch (_) { return null; } }).filter(Boolean);
  const have = (await chrome.scripting.getRegisteredContentScripts()).map((s) => s.id);
  const drop = have.filter((s) => ids.some((i) => s === i || s === i + '-bridge'));
  if (drop.length) await chrome.scripting.unregisterContentScripts({ ids: drop });
});
