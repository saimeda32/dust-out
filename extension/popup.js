// Turn Dust Out on or off for the meeting site in the current tab. Teams and Meet are built in;
// any other site gets its own permission, asked for only when you turn it on here.
const BUILT_IN = ['https://teams.microsoft.com', 'https://teams.cloud.microsoft', 'https://teams.live.com', 'https://meet.google.com'];
const $ = (id) => document.getElementById(id);
const state = (text) => { $('state').textContent = text; };

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let url;
  try { url = new URL(tab.url); } catch (_) { url = null; }
  if (!url || url.protocol !== 'https:') return state('Open your meeting site in this tab first.');
  const origin = url.origin, pattern = origin + '/*', id = 'site-' + url.hostname;
  const showBtn = $('show'), siteBtn = $('site'), reloadBtn = $('reload');

  showBtn.addEventListener('click', async () => {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'show' });
      window.close();
    } catch (_) {
      state('Dust Out isn\'t running in this tab yet. Reload the tab (leave the call first).');
      reloadBtn.hidden = false;
    }
  });
  reloadBtn.addEventListener('click', () => { chrome.tabs.reload(tab.id); window.close(); });

  if (BUILT_IN.includes(origin)) { showBtn.hidden = false; return state('On for ' + url.hostname + '.'); }

  const registered = (await chrome.scripting.getRegisteredContentScripts({ ids: [id] })).length > 0;
  const on = registered && await chrome.permissions.contains({ origins: [pattern] });
  state((on ? 'On' : 'Off') + ' for ' + url.hostname + '.');
  siteBtn.hidden = false;
  showBtn.hidden = !on;
  siteBtn.textContent = on ? 'Turn off for this site' : 'Turn on for this site';
  siteBtn.addEventListener('click', async () => {
    try {
      if (on) {
        if (registered) await chrome.scripting.unregisterContentScripts({ ids: [id, id + '-bridge'] });
        await chrome.permissions.remove({ origins: [pattern] });
        state('Off for ' + url.hostname + '. It stops after this page reloads.');
      } else {
        if (!(await chrome.permissions.request({ origins: [pattern] }))) return state('Permission not given.');
        if (registered) await chrome.scripting.unregisterContentScripts({ ids: [id, id + '-bridge'] });
        await chrome.scripting.registerContentScripts([
          { id, matches: [pattern], js: ['ext-mode.js', 'dust-out.js'], world: 'MAIN', runAt: 'document_start', persistAcrossSessions: true },
          { id: id + '-bridge', matches: [pattern], js: ['bridge.js'], runAt: 'document_start', persistAcrossSessions: true },
        ]);
        state('On for ' + url.hostname + '. It starts after this page reloads, so do it before you join a call.');
      }
      // Reloading would drop you out of a live call, so it's your choice when.
      siteBtn.hidden = true;
      reloadBtn.hidden = false;
    } catch (e) {
      state('Something went wrong: ' + e.message);
    }
  });
})();
