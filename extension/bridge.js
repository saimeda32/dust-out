// Bridge between Dust Out in the meeting page and the rest of the extension. It runs in
// Chrome's isolated content-script world. The page can only ask it to turn hand tracking on
// (and only right after a real click) or off; it passes back snaps and short status messages.
const toPage = (type, text) => window.postMessage({ dustOutExt: type, text }, location.origin);
const toExtension = (msg) => {
  try {
    chrome.runtime.sendMessage(msg).catch(() => {});
  } catch (_) {
    // The extension was updated or reloaded since this page loaded.
    toPage('status', 'Reload this tab to use Dust Out again.');
    toPage('gesture-off');
  }
};

window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data || e.data.dustOut !== 'gesture') return;
  if (e.data.on && !navigator.userActivation.isActive) return; // the camera only starts from a click
  toExtension({ type: 'gesture', on: !!e.data.on });
});
// Leaving or reloading the page turns hand tracking off for it.
window.addEventListener('pagehide', () => toExtension({ type: 'gesture', on: false }));

chrome.runtime.onMessage.addListener((m) => {
  if (m && ['snap', 'status', 'show', 'gesture-off'].includes(m.type)) toPage(m.type, m.text);
});
