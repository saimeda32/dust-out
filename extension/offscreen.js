// Offscreen page: watches the camera for a finger snap with bundled MediaPipe.
import { FilesetResolver, HandLandmarker } from './vendor/mediapipe/vision_bundle.mjs';
import { makeSnapDetector } from './gesture-detect.js';

const send = (type, text) => chrome.runtime.sendMessage({ type, text }).catch(() => {});

async function makeMarker(vision, delegate) {
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: chrome.runtime.getURL('vendor/mediapipe/hand_landmarker.task'), delegate },
    runningMode: 'VIDEO',
    numHands: 2,
  });
}

async function cameraBlocked() {
  try { return (await navigator.permissions.query({ name: 'camera' })).state !== 'granted'; } catch (_) { return true; }
}

(async () => {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360, frameRate: 30 } });
  } catch (e) {
    // Only a missing permission needs the setup tab.
    if (e.name === 'NotAllowedError' && await cameraBlocked()) return send('hand-need-camera');
    return send('hand-failed', e.name === 'NotFoundError' ? 'No camera found for hand gesture.' : 'The camera is busy or unavailable for hand gesture (' + e.name + ').');
  }
  try {
    send('hand-status', 'Loading hand tracking...');
    const vision = await FilesetResolver.forVisionTasks(chrome.runtime.getURL('vendor/mediapipe/wasm'));
    let marker;
    try { marker = await makeMarker(vision, 'GPU'); } catch (_) { marker = await makeMarker(vision, 'CPU'); }
    send('hand-status', 'Hand gesture on. Snap with your hand in view.');
    // Frame-driven, so it keeps running in the background.
    const reader = new MediaStreamTrackProcessor({ track: stream.getVideoTracks()[0] }).readable.getReader();
    // One detector per hand, keyed by left/right (list order can change).
    const detect = { Left: makeSnapDetector(), Right: makeSnapDetector() };
    for (;;) {
      const { value: frame, done } = await reader.read();
      if (done) break;
      const t = performance.now();
      let res;
      try { res = marker.detectForVideo(frame, t); } finally { frame.close(); }
      const seen = {};
      (res.landmarks || []).forEach((hand, i) => {
        const side = (res.handedness && res.handedness[i] && res.handedness[i][0] && res.handedness[i][0].categoryName) || (i ? 'Right' : 'Left');
        seen[side] = hand;
      });
      for (const side of ['Left', 'Right']) if (detect[side](seen[side], t) === 'snap') send('hand-snap');
    }
  } catch (e) {
    send('hand-failed', 'Hand tracking stopped: ' + (e && e.message || e));
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
})();
