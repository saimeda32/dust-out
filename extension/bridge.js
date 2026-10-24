// Isolated-world bridge: the page can only toggle hand tracking (on needs a real click);
// snaps and status messages come back.
const toPage = (type, text) => window.postMessage({ dustOutExt: type, text }, location.origin);
const toExtension = (msg) => {
  try {
    chrome.runtime.sendMessage(msg).catch(() => {});
  } catch (_) {
    // Extension was reloaded since this page loaded.
    toPage('status', 'Reload this tab to use Dust Out again.');
    toPage('gesture-off');
  }
};

window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data || e.data.dustOut !== 'gesture') return;
  if (e.data.on && !navigator.userActivation.isActive) return; // the camera only starts from a click
  toExtension({ type: 'gesture', on: !!e.data.on });
});
window.addEventListener('pagehide', () => toExtension({ type: 'gesture', on: false }));

chrome.runtime.onMessage.addListener((m) => {
  if (m && ['snap', 'status', 'show', 'gesture-off'].includes(m.type)) toPage(m.type, m.text);
});
