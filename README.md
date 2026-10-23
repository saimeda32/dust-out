# Dust Out

Snap your fingers on a video call and crumble into dust. A minute later the dust flies back and you're there again.

![Dust Out on a test scene: a person crumbles into dust, the room stays, then they reform](docs/demo.gif)

It runs in Chrome on your own computer. It changes only your own outgoing video, it doesn't use any AI service, and no video or audio leaves your machine except what your meeting already sends.

## What it does

- You snap, or press **Option+Shift+V** (Alt+Shift+V on Windows). The crumble starts at a few spots and spreads, the edges char, flakes peel off and break into dust that keeps the colours of your shirt, hair and skin, and drifts away.
- The background stays, including a background filter from your meeting app. You crumble on top of it.
- After 60 seconds (or another snap) the dust rewinds and you reform, live.
- You stay live video until the moment you crumble. If you get up early, it finishes from a still taken at the snap.
- It notices a real finger snap two ways: by sound (it learns your snap in three tries), or by watching your hand on camera.

## Where it works

| Meeting app (in Chrome) | Status |
|---|---|
| Microsoft Teams | Works. This is where it was built and used. |
| Google Meet | Should work. Not yet tried in a real call, so reports are welcome. |
| Other browser meeting apps (Webex, Jitsi, Whereby, Slack huddles, ...) | Turn it on per site from the toolbar button. Most of these send video the same way, so it should work, but they're untested. |
| Zoom in the browser | Not supported yet. Zoom sends video differently. |
| Desktop apps | No. It only runs in Chrome. |

## Install

### Chrome extension (recommended)

1. Download this repo (green **Code** button, then **Download ZIP**) and unzip it.
2. Open `chrome://extensions`, switch on **Developer mode** (top right), click **Load unpacked** and pick the `extension` folder.
3. Pin Dust Out from the puzzle-piece menu so you can reach its button.

Teams and Google Meet are on straight away. For another meeting site, open it, click the Dust Out button and choose **Turn on for this site**. Chrome asks for permission for that one site.

### Bookmark (for computers where you can't install extensions)

Open `bookmarklet/install.html` in Chrome and drag the button to your bookmarks bar. It works on Teams. Google Meet blocks bookmarks from running code, so use the extension there. Instructions are on that page.

## Using it

1. Join your meeting with the camera on. A small Dust Out card appears at the bottom left with a **What others see** preview, which is exactly what your call is sending.
2. Click **Save empty room** and step out of view for five seconds. It uses this picture to tell you apart from the room and to show while you're gone. Check the thumbnail has no one in it.
3. Optional: **Teach my snap** (snap three times), or **Hand gesture** to snap on camera instead of by sound.
4. Snap. Stay seated for about three seconds while you crumble, then you can leave.

Keep the camera, lights and background filter the same as when you saved the room, or the swap will show.

## How it works

Browser meeting apps send your camera with WebRTC. Dust Out wraps the video track the app hands to WebRTC, after the app's own background filter, and draws the effect on each frame before it goes out. It finds you by comparing each frame with the saved empty room, then turns you into particles that move through a noise field with a little depth and a motion trail. The app still sees its own track everywhere it looks, so nothing else in the meeting changes.

Your self-view gets the same treatment, so you see what everyone else sees. If something goes wrong, it falls back to your normal video and shows the error on the card. **Copy diagnostics** on the card copies a short summary for bug reports.

Hand tracking uses Google's MediaPipe hand model, bundled inside the extension (see `extension/vendor/mediapipe`), so nothing is downloaded at runtime.

## Privacy

- No servers, no accounts, no analytics. It never sends anything anywhere.
- It only runs on Teams, Google Meet, and sites you turn on yourself.
- The microphone (snap by sound) and camera (hand gesture) are only used while those options are on, and only on your computer.

## Development

```
npm install
npx playwright install chromium   # Chrome for Testing, used by the extension tests
npm test                          # builds, then runs both test suites
```

`src/` holds the code. `node build.mjs` copies it into `extension/` and builds the bookmark page. The tests drive a page that behaves like a meeting app (camera frames in the same format Teams uses, a real two-way WebRTC call, pop-out windows, Meet's script rules) and check the effect, self-view, snap detection and hand-gesture path.

## License

MIT. The bundled MediaPipe files are Apache 2.0, see `extension/vendor/mediapipe/LICENSE`.
