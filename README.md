# Dust Out

**Snap your fingers on a video call and crumble into dust. A minute later, you're back.**

A free Chrome extension for Microsoft Teams and Google Meet. No AI, no accounts, and nothing leaves your computer except the video your meeting already sends.

![The demo character snaps, crumbles into dust, the room stays empty, then the dust rewinds and they're back](docs/demo.gif)

**[Install page](https://saimeda32.github.io/dust-out/)** · **[Download the extension](https://github.com/saimeda32/dust-out/releases/latest/download/dust-out-extension.zip)** · [Report a problem](https://github.com/saimeda32/dust-out/issues)

## Install (2 minutes)

1. **[Download the extension](https://github.com/saimeda32/dust-out/releases/latest/download/dust-out-extension.zip)** and unzip it. You get a folder called `dust-out-extension`.
2. In Chrome, open `chrome://extensions` (paste it into the address bar).
3. Turn on **Developer mode** (switch in the top right corner).
4. Click **Load unpacked** and choose the `dust-out-extension` folder.

Done. It turns itself on in Teams and Google Meet.

> Can't install extensions (for example on a work laptop)? Use the **bookmark** instead. It has to be dragged from a web page, so get it from the **[install page](https://saimeda32.github.io/dust-out/#bookmark)**.
>
> **The bookmark works on Teams only. It does not work on Google Meet:** Meet blocks bookmarks from running, so clicking it there does nothing. For Meet, install the extension.
>
> **Google Meet with extensions blocked too?** Run it from Chrome's developer console: save the code once as a console snippet, then start it before each call. Steps and a copy button are on the [install page](https://saimeda32.github.io/dust-out/#console).

## Use it in a call

<img src="docs/card.png" alt="The Dust Out card" width="220" align="right">

1. Open your meeting **in Chrome** and join with your camera on. The Dust Out card appears at the bottom left.
2. Click **Save empty room** and step fully out of view for 5 seconds. Check the **Saved empty room** picture on the card has no one in it, then sit back down.
3. **Snap your fingers**, or press **Option+Shift+V** (Alt+Shift+V on Windows). Stay seated for about 3 seconds while you crumble.
4. Leave. Everyone sees the empty room. Within a minute the dust flies back and you reform, or snap again to come back sooner.

**What others see** on the card is exactly what your call sends, so you can always check it's working.

To snap for real instead of using the shortcut: tick **Listen for a finger snap** and click **Teach my snap** (snap 3 times), or click **Hand gesture** to snap on camera.

<br clear="right">

## Where it works

| In Chrome | Extension | Bookmark |
|---|---|---|
| Microsoft Teams | Works | Works |
| Google Meet | Should work; not tried in a real call yet | **Doesn't work.** Meet blocks bookmarks |
| Webex, Jitsi, Whereby, Slack huddles, other browser meetings | Toolbar button, **Turn on for this site**, reload before joining. Untested | Might work, depending on the site. Untested |
| Zoom in the browser | Not supported yet | Not supported yet |
| Desktop apps | No, Chrome only | No, Chrome only |

## Something's not working?

- **Bookmark does nothing on Google Meet:** expected. Meet blocks bookmarks. Install the extension, then reload the Meet tab.
- **No card:** the meeting must be open in Chrome (not the desktop app) with your camera on. With the extension, you can also click its toolbar button and choose **Show the card**.
- **Snap does nothing:** save the empty room first, then try **Option+Shift+V**.
- **"Couldn't find you":** you were in the saved empty room, or the camera moved. Save it again.
- Still stuck? Click **Copy diagnostics** on the card and paste it into a [new issue](https://github.com/saimeda32/dust-out/issues).

## How it works

Browser meeting apps send your camera over WebRTC. Dust Out wraps the video your meeting sends, after the meeting's own background filter, and draws the effect on each frame. It finds you by comparing each frame with the saved empty room, then turns you into particles that keep your real colours and drift away with a bit of depth. The meeting app still sees its own video everywhere, so nothing else changes. Hand tracking uses Google's MediaPipe model, bundled inside the extension.

## Privacy

No servers, no accounts, no analytics. It only changes your own outgoing video, only on Teams, Google Meet and sites you turn on. The mic and camera are used only while snap detection is on, and only on your computer.

## For developers

```
npm install
npx playwright install chromium   # used by the extension tests
npm test                          # build, then run both test suites
```

The code is in `src/`. `node build.mjs` copies it into `extension/`, builds the install page in `docs/` and the extension zip. The cartoon cast (You, Alex and Sam) lives in `docs/character.js`; `node test/demo-gif.mjs` re-records the demo and the timeline the website uses to make Alex and Sam react.

## License

MIT. Bundled MediaPipe files are Apache 2.0 (`extension/vendor/mediapipe/LICENSE`).
