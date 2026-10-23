# MediaPipe (bundled)

Unmodified files from Google's MediaPipe, used for the hand-gesture snap detector.

- `vision_bundle.mjs` and `wasm/vision_wasm_internal.*` from the npm package `@mediapipe/tasks-vision` 0.10.14
- `hand_landmarker.task` from https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task

Licensed under the Apache License 2.0 (see `LICENSE` in this folder). Copyright Google LLC.
They ship inside the extension so it never downloads code at runtime.
