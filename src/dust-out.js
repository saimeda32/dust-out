// Dust Out: snap on a video call, crumble into dust, come back. Runs only in this tab.
(() => {
  'use strict';
  if (window.__dustOut) { window.__dustOut.show(); return; }
  try { if (window.opener && window.opener.__dustOut) { window.opener.__dustOut.show(); return; } } catch (_) { /* opener is another site */ }
  // Set by the extension, which loads before the page; bookmark and console run later.
  const EXT = window.__dustOutExt === true;
  const CAMERA_FIRST = /(^|\.)meet\.google\.com$/.test(location.hostname);
  let ui = null; // the control card, once built
  try {

  const CRUMBLE = 6.2;   // seconds the dust animation takes
  const SPREAD = 2.8;    // seconds for the crumble to spread across your whole body
  const AWAY = 60;       // seconds before you come back on your own
  const SNAP_LAG = 0.35; // let people see the snap before the dust starts
  const RETURN = 3.2;    // seconds to come back: the dust rewinds faster than it left

  const md = navigator.mediaDevices;
  const RealProcessor = window.MediaStreamTrackProcessor;
  const realGUM = md.getUserMedia.bind(md);
  const now = () => performance.now() / 1000;

  const S = { state: 'live', t0: 0, anim: 0, armAt: 0, plate: null, plateVer: 0, wantPlate: false, cams: 0, calls: 0, msg: '' };

  function go(state) {
    S.state = state; S.t0 = now(); S.anim++;
    paint();
  }

  function toggle() {
    if (!S.plate) return say('Save the empty room first.');
    if (!S.cams) return say('Your camera is off.');
    if (S.armAt && now() - S.armAt > 2) S.armAt = 0;
    if (S.state === 'live' && !S.armAt) S.armAt = now() + SNAP_LAG;
    else if (S.state === 'gone') go('returning');
  }

  // Runs per camera frame, so it keeps time in background tabs.
  function tick() {
    const t = now() - S.t0;
    if (S.armAt && now() - S.armAt > 2) S.armAt = 0;
    if (S.armAt && now() >= S.armAt) { S.armAt = 0; if (S.state === 'live') go('vanishing'); }
    else if (S.state === 'vanishing' && t >= CRUMBLE) go('gone');
    else if (S.state === 'gone' && t >= AWAY) go('returning');
    else if (S.state === 'returning' && t >= RETURN) go('live');
  }

  const hash = (a, b) => {
    let n = Math.imul(a, 374761393) + Math.imul(b, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // Value noise, for uneven patches.
  const vnoise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(0, 1, x - xi), fy = smooth(0, 1, y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  const fbm = (x, y) => (vnoise(x, y) * 4 + vnoise(x * 2.1, y * 2.1) * 2 + vnoise(x * 4.3, y * 4.3)) / 7;

  const canvas = (read) => {
    const c = new OffscreenCanvas(2, 2);
    return [c, c.getContext('2d', read ? { willReadFrequently: true } : undefined)];
  };

  // One video pipeline: empty room, then the live you that hasn't crumbled, then dust.
  // Heavy work runs at ~640x360; the GPU scales it up.
  class Job {
    constructor(gen) {
      this.gen = gen;
      [this.cv, this.cx] = canvas();     // output, full size
      [this.hv, this.hx] = canvas(true); // working-size live frame, read back for dust colours
      [this.sm, this.sx] = canvas(true); // tiny live frame, for finding you
      [this.mk, this.mx] = canvas();     // tiny mask: where live you still shows
      [this.ck, this.kx] = canvas();     // tiny char layer
      [this.bd, this.bx] = canvas();     // live you, cut out by the mask, full size
      [this.pt, this.px] = canvas();     // dust, working size
      [this.lb, this.lbx] = canvas();    // live you, before merging with the still
      [this.st, this.stx] = canvas();    // still of you at the snap, in case you get up early
      [this.ms, this.msx] = canvas();    // tiny mask for the still
      this.key = ''; this.anim = -1;
    }

    process(frame) {
      // Only the current camera runs the effect.
      if (!S.active || S.active.readyState === 'ended') S.active = this.gen;
      if (S.active !== this.gen) return frame;
      tick();
      const w = frame.displayWidth, h = frame.displayHeight;
      S.dims = frame.format + ' ' + w + 'x' + h + ' coded ' + frame.codedWidth + 'x' + frame.codedHeight;
      if (S.wantPlate && now() - S.wantPlate > 2) { S.wantPlate = 0; say('Not saved: the video paused. Try again.'); } // you may be back in frame by now
      if (S.wantPlate) {
        S.wantPlate = 0;
        const [c, x] = canvas();
        c.width = w; c.height = h;
        x.drawImage(frame, 0, 0, w, h);
        S.plate = c; S.plateVer++; S.plateAR = w / h;
        if (ui) {
          const tc = ui.thumb.lastChild;
          tc.height = Math.round(tc.width * h / w);
          tc.getContext('2d').drawImage(c, 0, 0, tc.width, tc.height);
          ui.thumb.style.display = 'block';
        }
        say('Empty room saved. Check the picture has no one in it.');
      }
      if (S.state === 'live' || !S.plate) return frame;

      this.size(w, h);
      const { cx, q, W, H } = this;
      cx.globalCompositeOperation = 'copy';
      cx.drawImage(S.plate, 0, 0, w, h);
      cx.globalCompositeOperation = 'source-over';
      if (S.state === 'gone') return this.emit(frame, true);

      const back = S.state === 'returning';
      const t = now() - S.t0;
      // Coming back replays the crumble backwards, faster.
      const tt = back ? CRUMBLE * (1 - smooth(0, 1, t / RETURN)) : Math.min(CRUMBLE, t);
      this.hx.drawImage(frame, 0, 0, w / q, h / q);
      this.findYou();
      const live = this.hx.getImageData(0, 0, W, H).data;
      if (this.anim !== S.anim) {
        this.anim = S.anim;
        if (!back && Math.abs(w / h - S.plateAR) > 0.02) {
          go('live');
          say('The video shape changed. Save the empty room again.');
          return frame;
        }
        // Barely differs from the saved room: you were in it.
        if (!back && this.core < 0.06) {
          go('live');
          say("Couldn't find you. Save the empty room again, fully out of view.");
          return frame;
        }
        this.start(back);
        // Still from the snap, used if you get up before the crumble finishes.
        this.stx.globalCompositeOperation = 'copy';
        this.stx.drawImage(frame, 0, 0, w, h);
        this.stillBody = back ? new Float32Array(this.body.length) : this.body.slice();
        this.stillGrow = back ? new Uint8Array(this.grow.length) : this.grow.slice();
        this.stillLive = live.slice();
      }
      this.drawBody(frame, tt, back);
      this.drawDust(live, tt, back);
      cx.drawImage(this.bd, 0, 0);
      cx.drawImage(this.pt, 0, 0, W, H, 0, 0, W * q, H * q);
      return this.emit(frame);
    }

    // Return the input's pixel format; Teams freezes on anything else.
    emit(frame, still) {
      const f = frame.format, ts = frame.timestamp;
      if (f !== 'NV12' && f !== 'I420') return new VideoFrame(this.cv, { timestamp: ts });
      const { w, h } = this, cw = (w + 1) >> 1, ch = (h + 1) >> 1, U = w * h, V = U + cw * ch, size = V + cw * ch;
      const nv12 = f === 'NV12', key = f + w + 'x' + h;
      let out;
      if (still) {
        if (this.stillKey !== key + ':' + S.plateVer) {
          this.stillYuv = this.toYuv(this.cx.getImageData(0, 0, w, h).data, new Uint8Array(size), nv12);
          this.stillKey = key + ':' + S.plateVer;
        }
        out = this.stillYuv;
      } else {
        if (!this.yuvBuf || this.yuvBuf.length !== size) this.yuvBuf = new Uint8Array(size);
        out = this.toYuv(this.cx.getImageData(0, 0, w, h).data, this.yuvBuf, nv12);
      }
      return new VideoFrame(out, {
        format: f, codedWidth: w, codedHeight: h, timestamp: ts,
        colorSpace: { primaries: 'smpte170m', transfer: 'smpte170m', matrix: 'smpte170m', fullRange: false },
      });
    }

    toYuv(rgba, out, nv12) {
      const { w, h } = this, cw = (w + 1) >> 1, ch = (h + 1) >> 1, U = w * h, V = U + cw * ch;
      for (let i = 0, p = 0; i < U; i++, p += 4) out[i] = 16 + ((66 * rgba[p] + 129 * rgba[p + 1] + 25 * rgba[p + 2] + 128) >> 8);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const p = (2 * y * w + 2 * x) * 4, r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
        const u = 128 + ((-38 * r - 74 * g + 112 * b + 128) >> 8), v = 128 + ((112 * r - 94 * g - 18 * b + 128) >> 8);
        if (nv12) { const q = U + 2 * (y * cw + x); out[q] = u; out[q + 1] = v; }
        else { out[U + y * cw + x] = u; out[V + y * cw + x] = v; }
      }
      return out;
    }

    size(w, h) {
      const key = w + 'x' + h + ':' + S.plateVer;
      if (key === this.key) return;
      this.key = key; this.w = w; this.h = h;
      const q = this.q = Math.max(1, Math.round(h / 360)), g = this.g = 3;
      const W = this.W = Math.ceil(w / q), H = this.H = Math.ceil(h / q);
      const sw = this.sw = Math.ceil(W / g), sh = this.sh = Math.ceil(H / g), n = sw * sh;
      for (const c of [this.cv, this.bd, this.lb, this.st]) { c.width = w; c.height = h; }
      for (const c of [this.hv, this.pt]) { c.width = W; c.height = H; }
      for (const c of [this.sm, this.mk, this.ck, this.ms]) { c.width = sw; c.height = sh; }
      this.sx.globalCompositeOperation = 'copy';
      this.sx.drawImage(S.plate, 0, 0, w / (q * g), h / (q * g));
      this.plateSmall = this.sx.getImageData(0, 0, sw, sh).data;
      this.dust = new ImageData(W, H);
      this.mkImg = new ImageData(sw, sh);
      this.ckImg = new ImageData(sw, sh);
      this.msImg = new ImageData(sw, sh);
      this.body = new Float32Array(n);
      this.grow = new Uint8Array(n);
      this.sum = new Int32Array((sw + 1) * (sh + 1));
      this.anim = -1;
    }

    // Neighbour counts via a summed-area table.
    around(src, r, fn) {
      const { sw, sh, sum } = this, S1 = sw + 1;
      for (let y = 0; y < sh; y++) {
        let row = 0;
        for (let x = 0; x < sw; x++) { row += src[y * sw + x]; sum[(y + 1) * S1 + x + 1] = sum[y * S1 + x + 1] + row; }
      }
      for (let y = 0; y < sh; y++) {
        const y0 = Math.max(0, y - r), y1 = Math.min(sh, y + r + 1);
        for (let x = 0; x < sw; x++) {
          const x0 = Math.max(0, x - r), x1 = Math.min(sw, x + r + 1);
          fn(y * sw + x, sum[y1 * S1 + x1] - sum[y0 * S1 + x1] - sum[y1 * S1 + x0] + sum[y0 * S1 + x0]);
        }
      }
    }

    // Find you: compare a tiny frame with the saved room.
    findYou() {
      const { sw, sh, g, W, H } = this, n = sw * sh, pl = this.plateSmall;
      this.sx.drawImage(this.hv, 0, 0, W, H, 0, 0, W / g, H / g);
      const cur = this.sx.getImageData(0, 0, sw, sh).data;
      const m = new Uint8Array(n), keep = new Uint8Array(n), grow = this.grow, body = this.body;
      for (let i = 0; i < n; i++) {
        const j = i * 4;
        m[i] = Math.abs(cur[j] - pl[j]) + Math.abs(cur[j + 1] - pl[j + 1]) + Math.abs(cur[j + 2] - pl[j + 2]) > 50 ? 1 : 0;
      }
      let core = 0;
      this.around(m, 1, (i, c) => { if (m[i] && c >= 4) { keep[i] = 1; core++; } });
      this.around(keep, 1, (i, c) => { grow[i] = c ? 1 : 0; });
      this.around(grow, 1, (i, c) => { body[i] = c / 9; });
      this.core = S.core = core / n;
    }

    // Plan the crumble: a few starting spots, spreading unevenly.
    start(back) {
      const { sw, sh, W: w, H: h, grow } = this, n = sw * sh, g = this.g;
      const cells = [];
      for (let i = 0; i < n; i++) if (grow[i]) cells.push(i);
      const seeds = [0, 1, 2].map(() => cells[(Math.random() * cells.length) | 0] || 0);
      const dist = new Float32Array(n);
      let far = 1;
      for (let i = 0; i < n; i++) {
        const x = i % sw, y = (i / sw) | 0;
        let d = Infinity;
        for (const s of seeds) d = Math.min(d, Math.hypot(x - (s % sw), y - ((s / sw) | 0)));
        dist[i] = d;
        if (grow[i]) far = Math.max(far, d);
      }
      // Blow toward the side with more room.
      let mx = 0;
      for (const c of cells) mx += c % sw;
      const wind = cells.length && mx / cells.length > sw / 2 ? -1 : 1;
      const P = this.p = { active: new Uint8Array(n), color: new Uint8Array(n * g * g * 3) };
      for (const k of ['delay', 'edge', 'life', 'vx', 'vy', 'gvx', 'gvy', 'amp', 'freq', 'ph', 'z']) P[k] = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = i % sw, y = (i / sw) | 0, r = Math.random();
        // 3x3 cells flake off together.
        const fx = Math.floor(x / 3), fy = Math.floor(y / 3), fr = hash(fx + 101, fy + 57), fr2 = hash(fx + 7, fy + 211);
        // Starts slow, then speeds up.
        P.delay[i] = 0.1 + SPREAD * Math.pow(Math.min(1, 0.72 * dist[i] / far + 0.28 * fbm(x * 0.09, y * 0.09)), 0.6) + 0.06 * fr;
        P.edge[i] = (hash(x * 3 + 1, y * 7 + 3) - 0.5) * 0.14; // ragged break-up line
        const heavy = r < 0.12;
        P.life[i] = heavy ? 1.3 + 0.9 * Math.random() : 1.9 + 1.3 * Math.random();
        P.vx[i] = wind * (0.4 + 0.45 * Math.random()) * w;
        P.vy[i] = heavy ? (0.05 + 0.1 * Math.random()) * h : -(0.04 + 0.28 * Math.random()) * h;
        P.gvx[i] = wind * (0.3 + 0.35 * fr) * w;
        // Depth: most dust comes toward the camera.
        P.z[i] = -0.45 + 1.45 * Math.random();
        P.gvy[i] = -(0.02 + 0.12 * fr2) * h;
        // Shared swirl phase gives curling streams.
        P.amp[i] = (0.02 + 0.05 * Math.random()) * h;
        P.freq[i] = 3 + 5 * Math.random();
        P.ph[i] = fbm(x * 0.05 + 40, y * 0.05) * 9 + 0.6 * Math.random();
      }
      if (back) P.active.fill(1);
    }

    // Live you minus crumbled parts; the upscaled mask gives a soft edge.
    drawBody(frame, tt, back) {
      const { sw, sh, w, h, body, stillBody, p: P } = this, n = sw * sh, cell = this.g * this.q;
      const mk = this.mkImg.data, ms = this.msImg.data, ck = this.ckImg.data;
      for (let i = 0; i < n; i++) {
        const left = P.delay[i] + P.edge[i] - tt, on = smooth(-0.05, 0.05, left);
        mk[i * 4 + 3] = 255 * body[i] * on;
        ms[i * 4 + 3] = 255 * stillBody[i] * on;
        // Dark char before breaking off; green glow when coming back.
        const rim = on * (1 - smooth(0, 0.4, left));
        if (back) { ck[i * 4] = 90; ck[i * 4 + 1] = 255; ck[i * 4 + 2] = 170; ck[i * 4 + 3] = 255 * rim * 0.7; }
        else { ck[i * 4] = 34; ck[i * 4 + 1] = 26; ck[i * 4 + 2] = 22; ck[i * 4 + 3] = 255 * rim * 0.6; }
      }
      this.mx.putImageData(this.mkImg, 0, 0);
      this.msx.putImageData(this.msImg, 0, 0);
      this.kx.putImageData(this.ckImg, 0, 0);
      const cut = (x, src, mask) => {
        x.imageSmoothingQuality = 'high';
        x.globalCompositeOperation = 'copy';
        x.drawImage(src, 0, 0, w, h);
        x.globalCompositeOperation = 'destination-in';
        x.drawImage(mask, 0, 0, sw, sh, 0, 0, sw * cell, sh * cell);
        x.globalCompositeOperation = 'source-over';
      };
      cut(this.bx, this.st, this.ms);
      cut(this.lbx, frame, this.mk);
      const { bx } = this;
      bx.drawImage(this.lb, 0, 0);
      bx.globalCompositeOperation = 'source-atop';
      bx.drawImage(this.ck, 0, 0, sw, sh, 0, 0, sw * cell, sh * cell);
      bx.globalCompositeOperation = 'source-over';
    }

    drawDust(live, tt, back) {
      const { sw, g, W: w, H: h, grow, p: P } = this, n = sw * this.sh, out = this.dust.data;
      out.fill(0);
      const blend = (dx, dy, r, gg, b, a) => {
        if (dx < 0 || dy < 0 || dx >= w || dy >= h || a <= 0.004) return;
        const di = (dy * w + dx) * 4, da = out[di + 3] / 255, oa = a + da * (1 - a), k = da * (1 - a);
        out[di] = (r * a + out[di] * k) / oa;
        out[di + 1] = (gg * a + out[di + 1] * k) / oa;
        out[di + 2] = (b * a + out[di + 2] * k) / oa;
        out[di + 3] = oa * 255;
      };
      // Soft round speck.
      const splat = (cx, cy, rad, r, gg, b, a) => {
        const x0 = Math.floor(cx - rad), x1 = Math.ceil(cx + rad), y0 = Math.floor(cy - rad), y1 = Math.ceil(cy + rad), r2 = rad * rad;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const d2 = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
          if (d2 < r2) blend(x, y, r, gg, b, a * (1 - d2 / r2));
        }
      };
      const midX = w / 2, midY = h / 2, pl = this.plateSmall;
      // Position (pX, pY) and depth scale (pD) at progress p.
      let pX = 0, pY = 0, pD = 1;
      const pos = (i, p, x0, y0) => {
        const e = Math.pow(p, 1.6), sw = P.amp[i] * p;
        let ox = P.vx[i] * e + Math.sin(P.freq[i] * p + P.ph[i]) * sw;
        let oy = P.vy[i] * e + Math.cos(P.freq[i] * 0.8 * p + P.ph[i] * 1.3) * sw;
        const m = smooth(0.08, 0.35, p);
        ox = P.gvx[i] * e + (ox - P.gvx[i] * e) * m;
        oy = P.gvy[i] * e + (oy - P.gvy[i] * e) * m;
        pD = 1 + P.z[i] * Math.pow(p, 1.2) * 0.9;
        pX = midX + (x0 + ox - midX) * pD; pY = midY + (y0 + oy - midY) * pD;
      };
      const gg2 = g * g;
      for (let i = 0; i < n; i++) {
        const u = tt - P.delay[i] - P.edge[i];
        if (u <= 0) continue;
        const p = u / P.life[i];
        if (p >= 1) continue;
        const x0 = (i % sw) * g, y0 = ((i / sw) | 0) * g, base = i * gg2 * 3;
        let col = P.color;
        if (back) {
          if (!grow[i]) continue;
          col = null;
        } else if (!P.active[i]) {
          // Colours are taken the moment a piece breaks off.
          if (!grow[i] && !this.stillGrow[i]) continue;
          P.active[i] = 1;
          const from = grow[i] ? live : this.stillLive;
          for (let j = 0; j < g; j++) for (let k = 0; k < g; k++) {
            const si = (Math.min(h - 1, y0 + j) * w + Math.min(w - 1, x0 + k)) * 4, ci = base + (j * g + k) * 3;
            col[ci] = from[si]; col[ci + 1] = from[si + 1]; col[ci + 2] = from[si + 2];
          }
        }
        const px = (j, k, c) => col ? col[base + (j * g + k) * 3 + c] : live[(Math.min(h - 1, y0 + j) * w + Math.min(w - 1, x0 + k)) * 4 + c];
        pos(i, p, x0, y0);
        const X = pX, Y = pY, d = pD;
        const a = Math.pow(1 - p, 0.75);
        if (p < 0.22) {
          // Fresh chunk: real texture, shrinking.
          const ch = 0.45 * (1 - p / 0.22), s = Math.max(1, Math.round(g * (1 - p * 1.6)));
          const [tr, tg, tb] = back ? [90, 255, 170] : [34, 26, 22];
          for (let j = 0; j < s; j++) for (let k = 0; k < s; k++) {
            const r = px(j, k, 0), gr = px(j, k, 1), b = px(j, k, 2);
            blend((X + k) | 0, (Y + j) | 0, r + (tr - r) * ch, gr + (tg - gr) * ch, b + (tb - b) * ch, a);
          }
          continue;
        }
        // Dust keeps your colours, drifting toward ash.
        const c = g >> 1, fade = 0.3 * p;
        let r = px(c, c, 0) + (150 - px(c, c, 0)) * fade, gr = px(c, c, 1) + (142 - px(c, c, 1)) * fade, b = px(c, c, 2) + (134 - px(c, c, 2)) * fade;
        // Tint from the background behind it.
        const cxl = (X / g) | 0, cyl = (Y / g) | 0;
        if (cxl >= 0 && cyl >= 0 && cxl < sw && cyl < this.sh) {
          const li = (cyl * sw + cxl) * 4, k = 0.3 * p;
          r += (pl[li] - r) * k; gr += (pl[li + 1] - gr) * k; b += (pl[li + 2] - b) * k;
        }
        if (back) { const k = 0.55 * p; r += (90 - r) * k; gr += (255 - gr) * k; b += (170 - b) * k; }
        const rad = (g * 0.7 * (1 - 0.5 * p) + 0.6) * d, aa = d > 1 ? a / Math.sqrt(d) : a;
        splat(X, Y, rad, r, gr, b, aa);
        // Motion trail.
        pos(i, Math.max(0, p - 0.035), x0, y0);
        splat(pX, pY, rad * 0.8, r, gr, b, aa * 0.35);
      }
      this.px.putImageData(this.dust, 0, 0);
    }
  }

  // Process a copy of the app's track; the app keeps its own.
  function hook(src) {
    const proc = new RealProcessor({ track: src });
    const gen = new MediaStreamTrackGenerator({ kind: 'video' });
    const reader = proc.readable.getReader();
    const writer = gen.writable.getWriter();
    const job = new Job(gen);
    S.cams++; paint();
    (async () => {
      try {
        for (;;) {
          const { value: frame, done } = await reader.read();
          if (done) break;
          let out = frame;
          const t0 = performance.now();
          try { out = job.process(frame); } catch (e) { failed(e); }
          (S.fmts ||= {})[S.state + ':' + frame.format + '>' + out.format] = 1;
          const c = ((S.cost ||= {})[S.state] ||= [0, 0]); c[0] += performance.now() - t0; c[1]++;
          if (out !== frame) frame.close();
          try { await writer.write(out); } catch (e) { try { out.close(); } catch (_) {} throw e; }
        }
      } catch (_) { /* call ended */ }
      finally {
        reader.cancel().catch(() => {});
        try { gen.stop(); } catch (_) {}
        if (S.active === gen) S.active = null;
        S.cams--;
        if (!S.cams) { S.armAt = 0; S.wantPlate = 0; }
        paint();
      }
    })();
    return gen;
  }

  function failed(e) {
    S.err = (S.err || 0) + 1;
    S.lastErr = String(e && (e.stack || e.message) || e).slice(0, 300);
    console.warn('[dust-out]', e);
    if (S.err === 1 || S.err % 100 === 0) say('Effect error: ' + (e && e.message || e));
  }

  // Hook the video the app sends (after its background filter).
  const ours = new WeakMap();   // the meeting app's track -> our copy
  const theirs = new WeakMap(); // our copy -> the meeting app's track
  const views = []; // [window, its original srcObject accessor]: this tab, call pop-outs, frames
  const senders = new Map(); // sender -> [the meeting app's track, native replaceTrack], to undo on exit
  const isStream = (st) => st && typeof st.getVideoTracks === 'function';
  // Self-views often use a clone of the sent track; track clones and remote tracks.
  const family = new WeakMap(); // clone -> original
  const remote = new WeakSet();
  const rootOf = (t) => { let r = t; while (family.has(r)) r = family.get(r); return r; };
  // Our copy for track t, or null. `loose` allows a same-camera guess (visible tiles only).
  function copyFor(t, loose) {
    if (!t || t.kind !== 'video' || t.readyState !== 'live' || remote.has(t) || theirs.has(t)) return null;
    const own = ours.get(t);
    if (own) return own.readyState !== 'ended' ? own : null;
    const g = S.active, sent = g && theirs.get(g);
    if (!sent || g.readyState === 'ended') return null;
    if (rootOf(t) === rootOf(sent)) return g;
    if (!loose) return null;
    const a = t.getSettings ? t.getSettings() : {}, b = sent.getSettings ? sent.getSettings() : {};
    if (a.displaySurface || t.label !== sent.label) return null;
    if (a.width && b.width && (a.width !== b.width || a.height !== b.height)) return null;
    return g;
  }

  // Never break the app: on error, give back its own track.
  function wrap(t) {
    try { return wrapUnsafe(t); } catch (e) { failed(e); return t; }
  }
  function wrapUnsafe(t) {
    if (!t || t.kind !== 'video' || theirs.has(t) || t.readyState === 'ended') return t;
    if (typeof MediaStreamTrackProcessor === 'undefined') return t;
    // Skip screen sharing.
    const set = t.getSettings ? t.getSettings() : {};
    if (set.displaySurface || t.contentHint === 'detail' || t.contentHint === 'text') return t;
    let g = ours.get(t);
    if (!g || g.readyState === 'ended') {
      g = hook(t);
      ours.set(t, g); theirs.set(g, t);
      for (let i = views.length - 1; i > 0; i--) { try { if (views[i][0].closed) views.splice(i, 1); } catch (_) { views.splice(i, 1); } }
      for (const [win, desc] of views) {
        try {
          for (const el of win.document.querySelectorAll('video')) {
            const st = desc.get.call(el);
            if (isStream(st) && st.getVideoTracks().includes(t)) { desc.set.call(el, swapped(st, g)); follow(win); }
          }
        } catch (_) { /* window closed */ }
      }
    }
    if (S.active !== g && ui) { ui.preview.srcObject = new MediaStream([g]); ui.previewBox.style.display = 'block'; ui.preview.play().catch(() => {}); }
    if (EXT && !S.calls && ui) ui.box.style.display = ''; // first camera in a call: show the card
    S.active = g;
    S.calls++; paint();
    return g;
  }
  function swapped(st, g) {
    const m = new MediaStream([g, ...st.getAudioTracks()]);
    m.__dustOutOriginal = st;
    S.swaps = (S.swaps || 0) + 1;
    return m;
  }

  // Some sites (Meet) lock built-ins, so hooked objects are tracked here, not marked.
  const patched = new WeakSet();
  // Replace a property where possible; false if locked.
  function override(obj, key, desc) {
    try { if ('value' in desc) { obj[key] = desc.value; if (obj[key] === desc.value) return true; } } catch (_) {}
    try { Object.defineProperty(obj, key, Object.assign({ configurable: true }, desc)); return true; } catch (_) { return false; }
  }

  // Camera route, for sites that lock their call code (effect sits under their background).
  function patchCamera(win) {
    const devs = win.navigator.mediaDevices;
    if (!devs || patched.has(devs)) return;
    patched.add(devs);
    const real = devs.getUserMedia.bind(devs);
    const hooked = async (c) => {
      const st = await real(c);
      if (!c || !c.video) return st;
      const out = new MediaStream(st.getAudioTracks());
      for (const v of st.getVideoTracks()) out.addTrack(wrap(v));
      return out;
    };
    const ok = override(devs, 'getUserMedia', { value: hooked, writable: true }) ||
      override(win.MediaDevices.prototype, 'getUserMedia', { value: function (c) { return hooked(c); }, writable: true });
    S.route = ok ? 'camera' : 'none';
    const late = !EXT || document.readyState !== 'loading';
    if (!ok) say("This site locks its camera and call code, so Dust Out can't reach your video here.");
    else if (late) say('Turn your camera off and on once so Dust Out can take over.');
  }

  // Hook calls and video elements in a window (this tab, a pop-out, or a frame).
  function patchWin(win) {
    const PC = win.RTCPeerConnection && win.RTCPeerConnection.prototype, TX = win.RTCRtpSender && win.RTCRtpSender.prototype;
    // Meet: camera route only, so the effect is applied once.
    if (CAMERA_FIRST) patchCamera(win);
    else if (PC && TX && !patched.has(PC)) {
      patched.add(PC);
      const addTrack = PC.addTrack, addTransceiver = PC.addTransceiver, getSenders = PC.getSenders, getTransceivers = PC.getTransceivers;
      const replaceTrack = TX.replaceTrack, senderTrack = Object.getOwnPropertyDescriptor(TX, 'track').get;
      const replaceHook = function (t) { const w = t && wrap(t); if (w !== t) senders.set(this, [t, replaceTrack]); else senders.delete(this); return replaceTrack.call(this, w); };
      // The app still sees its own track.
      const trackHook = { get() { const t = senderTrack.call(this); return (t && theirs.get(t)) || t; } };
      const protoReplace = override(TX, 'replaceTrack', { value: replaceHook, writable: true });
      const protoTrack = override(TX, 'track', trackHook);
      // Locked prototype: hook each sender instead.
      const hookSender = (snd) => {
        if (!snd || patched.has(snd)) return snd;
        patched.add(snd);
        if (!protoReplace) override(snd, 'replaceTrack', { value: replaceHook, writable: true });
        if (!protoTrack) override(snd, 'track', trackHook);
        return snd;
      };
      const methods = {
        addTrack(t, ...st) { const w = wrap(t), snd = addTrack.call(this, w, ...st); if (w !== t) senders.set(snd, [t, replaceTrack]); return hookSender(snd); },
        addTransceiver(t, init) { const w = typeof t === 'string' ? t : wrap(t), x = addTransceiver.call(this, w, init); if (w !== t) senders.set(x.sender, [t, replaceTrack]); hookSender(x.sender); return x; },
        getSenders() { return getSenders.call(this).map(hookSender); },
        getTransceivers() { const xs = getTransceivers.call(this); xs.forEach((x) => hookSender(x.sender)); return xs; },
      };
      let protoPC = true;
      for (const [k, f] of Object.entries(methods)) protoPC = override(PC, k, { value: f, writable: true }) && protoPC;
      if (!protoPC) {
        // Locked prototype: hook each connection instead.
        const Real = win.RTCPeerConnection;
        const Hooked = new Proxy(Real, {
          construct(T, args, nt) {
            const pc = Reflect.construct(T, args, nt);
            for (const [k, f] of Object.entries(methods)) override(pc, k, { value: f, writable: true });
            return pc;
          },
        });
        if (!override(win, 'RTCPeerConnection', { value: Hooked, writable: true })) patchCamera(win);
      }
    }
    const TP = win.MediaStreamTrack && win.MediaStreamTrack.prototype;
    if (TP && !patched.has(TP)) {
      patched.add(TP);
      const clone = TP.clone;
      override(TP, 'clone', { value: function () { const c = clone.call(this); try { family.set(c, this); } catch (_) {} return c; }, writable: true });
      const mark = (proto, key) => {
        const d = proto && Object.getOwnPropertyDescriptor(proto, key);
        if (d && d.get) override(proto, key, { get() { const t = d.get.call(this); if (t) remote.add(t); return t; } });
      };
      mark(win.RTCRtpReceiver && win.RTCRtpReceiver.prototype, 'track');
      mark(win.RTCTrackEvent && win.RTCTrackEvent.prototype, 'track');
    }
    // Apps that render the self-view themselves get our copy.
    if (win.MediaStreamTrackProcessor && !patched.has(win.MediaStreamTrackProcessor)) {
      const Real = win === window ? RealProcessor : win.MediaStreamTrackProcessor;
      const Proc = new Proxy(Real, {
        construct(T, args, nt) {
          try {
            const init = args[0], g = init && copyFor(init.track);
            if (g) { args = [Object.assign({}, init, { track: g })]; S.renders = (S.renders || 0) + 1; }
          } catch (e) { failed(e); }
          return Reflect.construct(T, args, nt);
        },
      });
      patched.add(Proc); patched.add(win.MediaStreamTrackProcessor);
      override(win, 'MediaStreamTrackProcessor', { value: Proc, writable: true });
    }
    // Self-view video elements show our copy.
    const proto = win.HTMLMediaElement && win.HTMLMediaElement.prototype;
    if (!proto || patched.has(proto)) return;
    patched.add(proto);
    const desc = Object.getOwnPropertyDescriptor(proto, 'srcObject');
    const ourCopy = (st) => (isStream(st) && !st.__dustOutOriginal ? copyFor(st.getVideoTracks()[0]) : null);
    override(proto, 'srcObject', {
      get() { const st = desc.get.call(this); return (st && st.__dustOutOriginal) || st; },
      set(st) {
        let g = null;
        try { g = ourCopy(st); if (g) st = swapped(st, g); } catch (e) { failed(e); }
        desc.set.call(this, st);
        if (g) queueMicrotask(() => { try { follow(win); } catch (e) { failed(e); } });
      },
    });
    const old = views.findIndex(([w]) => w === win);
    if (old >= 0) views.splice(old, 1);
    views.push([win, desc]);
    for (const el of win.document.querySelectorAll('video')) {
      const st = desc.get.call(el), g = ourCopy(st);
      if (g) { desc.set.call(el, swapped(st, g)); follow(win); }
    }
    if (win !== window) win.addEventListener('keydown', onKey, true);
  }

  // The card follows the call into a pop-out. Chrome drops handlers on nodes in a closing
  // window, so it comes home on pagehide and handlers are re-bound on every move.
  let cardWin = window;
  function moveCard(win) {
    cardWin = win;
    win.document.body.append(ui.box);
    bindCard();
    ui.preview.play().catch(() => {});
  }
  const homing = new WeakSet();
  function follow(win) {
    if (!ui || win === window || win === cardWin || win.top !== win || !win.document.body) return;
    moveCard(win);
    if (!homing.has(win)) {
      homing.add(win);
      win.addEventListener('pagehide', () => { if (cardWin === win) moveCard(window); });
    }
  }

  // Leaving this tab: give calls their own camera back.
  window.addEventListener('pagehide', () => {
    for (const [snd, [t, native]] of senders) { try { native.call(snd, t).catch(() => {}); } catch (_) {} }
  });
  const sameOrigin = (win) => { try { return !!win.document; } catch (_) { return false; } };
  patchWin(window);
  // Patch pop-outs (polled, since they may load a new page).
  const realOpen = window.open;
  override(window, 'open', {
    writable: true,
    value: function (...args) {
      const win = realOpen.apply(this, args);
      if (win) {
        const iv = setInterval(() => {
          if (win.closed) {
            clearInterval(iv);
            if (cardWin === win) moveCard(window);
          } else if (sameOrigin(win)) patchWin(win);
        }, 300);
      }
      return win;
    },
  });
  // Same-origin frames, and self-views that appeared before hooking.
  setInterval(() => {
    for (let i = views.length - 1; i > 0; i--) { try { if (views[i][0].closed || !views[i][0].document) views.splice(i, 1); } catch (_) { views.splice(i, 1); } }
    for (const [win, desc] of views.slice()) {
      try { for (const f of win.document.querySelectorAll('iframe')) if (f.contentWindow && sameOrigin(f.contentWindow)) patchWin(f.contentWindow); } catch (_) {}
      try {
        for (const v of win.document.querySelectorAll('video')) {
          if (v === ui.preview) continue;
          const r = v.getBoundingClientRect();
          if (r.width < 40 || r.height < 40) continue; // hidden helper videos (e.g. the filter's input)
          const st = desc.get.call(v), g = isStream(st) && !st.__dustOutOriginal && copyFor(st.getVideoTracks()[0], true);
          if (g) desc.set.call(v, swapped(st, g));
        }
      } catch (e) { failed(e); }
    }
  }, 1000);

  // Snap detection: a sharp, high-pitched spike that dies within ~20 ms. "Teach my snap"
  // learns your snap's loudness and brightness.
  const TUNE_KEY = 'dustOut.tune';
  let tune = { jump: 18, bright: 0.35, level: -45 };
  try { const saved = JSON.parse(localStorage.getItem(TUNE_KEY)); if (saved && saved.level) tune = saved; } catch (_) {}
  let ear = null, lesson = null, lastSnap = 0;

  function heard(jump, bright, level, t) {
    if (lesson) {
      lesson.push({ jump, bright, level });
      say('Heard snap ' + lesson.length + ' of 3.');
      if (lesson.length < 3) return;
      const low = (k) => Math.min(...lesson.map((s) => s[k]));
      tune = { jump: Math.max(12, low('jump') - 6), bright: Math.max(0.15, low('bright') * 0.6), level: low('level') - 8 };
      try { localStorage.setItem(TUNE_KEY, JSON.stringify(tune)); } catch (_) {}
      lesson = null;
      ui.teach.textContent = 'Teach my snap';
      return say('Learned your snap. Snap to vanish.');
    }
    if (jump < tune.jump || bright < tune.bright || level < tune.level || t - lastSnap < 1.5) return;
    lastSnap = t;
    say('Heard a snap.');
    toggle();
  }

  let listenRun = 0;
  function stopLesson() { lesson = null; if (ui) ui.teach.textContent = 'Teach my snap'; }
  async function listen(on) {
    const run = ++listenRun; // a newer call (quick double-toggle) wins; older ones clean up
    if (ear) { ear.ac.close(); ear.st.getTracks().forEach((t) => t.stop()); ear = null; }
    if (!on) { stopLesson(); return paint(); }
    let st = null, ac = null;
    const drop = () => { if (st) st.getTracks().forEach((t) => t.stop()); if (ac) ac.close().catch(() => {}); };
    try {
      // Echo cancellation ignores snaps from your speakers.
      st = await realGUM({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
      ac = new AudioContext();
      if (run !== listenRun) return drop();
      if (ac.state === 'suspended') await ac.resume();
      if (run !== listenRun) return drop();
      const mic = ac.createMediaStreamSource(st);
      const hp = ac.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 2000;
      const both = ac.createChannelMerger(2);
      mic.connect(hp); hp.connect(both, 0, 0); mic.connect(both, 0, 1);
      // Big buffers, analysed in ~5 ms steps.
      const sp = ac.createScriptProcessor(1024, 2, 1);
      both.connect(sp); sp.connect(ac.destination);
      let floor = null, ev = null, hold = 0;
      sp.onaudioprocess = (e) => {
        const hiAll = e.inputBuffer.getChannelData(0), allAll = e.inputBuffer.getChannelData(1);
        for (let o = 0; o < hiAll.length; o += 256) step(hiAll.subarray(o, o + 256), allAll.subarray(o, o + 256));
      };
      const step = (hi, all) => {
        let eh = 0, ea = 0;
        for (let i = 0; i < hi.length; i++) { eh += hi[i] * hi[i]; ea += all[i] * all[i]; }
        const db = 10 * Math.log10(eh / hi.length + 1e-12), bright = eh / (ea + 1e-12);
        if (floor === null) floor = db;
        if (!ev) {
          floor += (db - floor) * (db > floor ? 0.02 : 0.1); // follow quiet fast, loud slowly
          floor = Math.max(floor, -75); // a real mic always hisses a little
        }
        if (hold > 0) { hold--; return; }
        if (ev) {
          ev.n++;
          if (db > ev.peak) { ev.peak = db; ev.at = ev.n; ev.bright = Math.max(ev.bright, bright); }
          if (ev.at > 2) { ev = null; hold = 30; return; } // rose too slowly: speech or music, not a snap
          if (ev.n - ev.at >= 4) { // ~20 ms after the peak
            if (ev.peak - db > 8) heard(ev.peak - ev.floor, ev.bright, ev.peak, now());
            ev = null;
            hold = 30; // ignore the snap's own echo and tail for ~160 ms
          }
          return;
        }
        if (db - floor > 10 && bright > 0.1) ev = { peak: db, floor, bright, n: 0, at: 0 };
      };
      ear = { ac, st };
      if (!lesson) say('Listening for your snap.');
    } catch (e) {
      drop();
      if (run !== listenRun) return;
      stopLesson();
      say('Could not use the mic. Use Option+Shift+V instead.');
      if (ui) ui.ear.checked = false;
    }
  }

  // Control card: plain DOM (strict page rules), addEventListener (survives window moves).
  function say(m) { S.msg = m; paint(); }
  function paint() {
    if (!ui) return;
    const left = Math.max(0, Math.ceil(AWAY - (now() - S.t0)));
    ui.status.textContent = !S.cams ? 'Waiting for your video. Join the meeting with your camera on. Already in? Turn your camera off and on. (Video hooks: ' + S.calls + ')'
      : { live: S.plate ? 'You are live. Snap to vanish.' : 'You are live.', vanishing: 'Turning to dust...', gone: 'Gone. Back in ' + left + 's', returning: 'Coming back...' }[S.state];
    ui.msg.textContent = S.msg;
    ui.go.textContent = S.state === 'gone' ? 'Come back now' : 'Vanish';
    ui.go.disabled = !S.plate || S.state === 'vanishing' || S.state === 'returning';
    ui.go.style.opacity = ui.go.disabled ? '0.45' : '1';
  }

  const el = (tag, css, text) => {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text) e.textContent = text;
    return e;
  };
  const btnCss = 'display:block;width:100%;margin-top:8px;padding:7px 10px;border:0;border-radius:8px;font:600 13px system-ui,sans-serif;cursor:pointer;';
  const box = el('div', 'position:fixed;left:16px;bottom:16px;z-index:2147483647;width:250px;padding:12px 14px;border-radius:12px;background:#16161a;color:#ececec;font:13px/1.45 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.45)');
  const head = el('div', 'display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:14px', 'Dust Out');
  const close = el('button', 'background:none;border:0;color:#999;font-size:18px;cursor:pointer;line-height:1', '×');
  close.title = 'Hide (Option+Shift+V still works)';
  const hide = () => { box.style.display = 'none'; };
  head.append(close);
  const status = el('div', 'margin-top:6px;color:#cfcfcf');
  const msg = el('div', 'margin-top:4px;color:#e2c48a;min-height:1em');
  const plateBtn = el('button', btnCss + 'background:#2b2b33;color:#ececec', '1. Save empty room (5s)');
  const goBtn = el('button', btnCss + 'background:#e2c48a;color:#16161a', 'Vanish');
  const earRow = el('label', 'display:flex;gap:6px;align-items:center;margin-top:10px;cursor:pointer');
  const earBox = el('input');
  earBox.type = 'checkbox';
  earRow.append(earBox, el('span', '', 'Listen for a finger snap'));
  const teachBtn = el('button', btnCss + 'background:#2b2b33;color:#ececec', 'Teach my snap');
  const handBtn = el('button', btnCss + 'background:#2b2b33;color:#ececec', 'Hand gesture');
  const hint = el('div', 'margin-top:8px;color:#8a8a8a;font-size:12px', 'Shortcut: Option+Shift+V');
  const diagBtn = el('button', 'margin-top:6px;padding:0;border:0;background:none;color:#8a8a8a;font:12px system-ui,sans-serif;text-decoration:underline;cursor:pointer', 'Copy diagnostics');
  const thumbCanvas = el('canvas', 'display:block;width:100%;border-radius:6px');
  thumbCanvas.width = 220;
  const thumb = el('div', 'display:none;margin-top:8px');
  thumb.append(el('div', 'color:#8a8a8a;font-size:12px;margin-bottom:4px', 'Saved empty room'), thumbCanvas);
  const previewBox = el('div', 'display:none;margin-top:8px');
  const preview = el('video', 'display:block;width:100%;border-radius:6px;background:#000');
  preview.muted = true; preview.autoplay = true; preview.playsInline = true;
  previewBox.append(el('div', 'color:#8a8a8a;font-size:12px;margin-bottom:4px', 'What others see'), preview);
  box.append(head, status, msg, previewBox, thumb, plateBtn, goBtn, earRow, teachBtn, ...(EXT ? [handBtn] : []), hint, diagBtn);
  // Extension: hidden until a camera joins a call.
  if (EXT) box.style.display = 'none';
  const mount = () => { if (!box.isConnected && cardWin === window) document.body.append(box); };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  ui = { box, status, msg, go: goBtn, ear: earBox, thumb, teach: teachBtn, preview, previewBox, hand: handBtn };

  function onKey(e) {
    if (e.altKey && e.shiftKey && e.code === 'KeyV') { e.preventDefault(); e.stopPropagation(); toggle(); }
  }
  function savePlate() {
    if (!S.cams) return say('Join the meeting with your camera on first.');
    if (S.state !== 'live') return say('Wait until you are back, then save the room.');
    let n = 5;
    plateBtn.disabled = true;
    say('Step out of the frame... ' + n);
    const iv = setInterval(() => {
      n--;
      if (n > 0) return say('Step out of the frame... ' + n);
      clearInterval(iv);
      plateBtn.disabled = false;
      if (S.state !== 'live' || !S.cams) return say('Not saved: you were mid-effect or the camera was off. Try again.');
      S.wantPlate = now();
    }, 1000);
  }
  const toggleEar = () => listen(earBox.checked);
  async function teach() {
    if (lesson) { stopLesson(); return say('Stopped.'); }
    lesson = [];
    teachBtn.textContent = 'Cancel';
    if (!ear) { earBox.checked = true; await listen(true); }
    if (lesson && ear) say('Snap 3 times, a second apart.');
  }
  // Hand gesture (extension only): hand tracking runs in the extension, which messages this tab.
  let lastWave = 0, handOn = false;
  function openHand() {
    handOn = !handOn;
    handBtn.textContent = handOn ? 'Hand gesture: on' : 'Hand gesture';
    window.postMessage({ dustOut: 'gesture', on: handOn }, location.origin);
    say(handOn ? 'Starting hand tracking...' : 'Hand gesture off.');
  }
  function sawSnap() {
    const t = now();
    if (t - lastWave < 1.5) return;
    lastWave = t;
    say('Saw a snap.');
    toggle();
  }
  function onExtension(e) {
    const d = e.data;
    if (EXT && d && e.source === window && d.dustOutExt) {
      if (d.dustOutExt === 'snap') sawSnap();
      else if (d.dustOutExt === 'status') say(String(d.text || ''));
      else if (d.dustOutExt === 'show') window.__dustOut.show();
      else if (d.dustOutExt === 'gesture-off') { handOn = false; handBtn.textContent = 'Hand gesture'; }
    }
  }
  window.addEventListener('message', onExtension);
  function copyDiag() {
    const d = {
      state: S.state, cams: S.cams, hooks: S.calls, swaps: S.swaps || 0, plate: S.plate ? S.plate.width + 'x' + S.plate.height : null,
      frame: S.dims || null, formats: Object.keys(S.fmts || {}), msPerFrame: Object.fromEntries(Object.entries(S.cost || {}).map(([k, [t, n]]) => [k, +(t / n).toFixed(1)])),
      route: S.route || 'call', youDetected: S.core != null ? +(S.core * 100).toFixed(1) + '%' : null, errors: S.err || 0, lastError: S.lastErr || null, msg: S.msg, windows: views.length, cardInPopout: cardWin !== window,
      previewSize: ui.preview.videoWidth + 'x' + ui.preview.videoHeight, renders: S.renders || 0,
      videos: views.flatMap(([w, desc]) => { try { return [...w.document.querySelectorAll('video')].filter((v) => v !== ui.preview).map((v) => {
        const st = desc.get.call(v), t = isStream(st) && st.getVideoTracks()[0], r = v.getBoundingClientRect();
        const kind = !t ? 'none' : theirs.has(t) ? 'effect' : remote.has(t) ? 'remote' : ours.has(t) ? 'sent' : family.has(t) ? 'dup' : 'other';
        return Math.round(r.width) + 'x' + Math.round(r.height) + ':' + kind + (t ? ':' + (t.label || '-').slice(0, 20) : '');
      }); } catch (_) { return []; } }),
      canvases: views.reduce((n, [w]) => { try { return n + [...w.document.querySelectorAll('canvas')].filter((c) => c.getBoundingClientRect().width > 200).length; } catch (_) { return n; } }, 0),
      sentLabel: S.active && theirs.get(S.active) ? theirs.get(S.active).label.slice(0, 20) || '-' : null, chrome: (navigator.userAgent.match(/Chrome\/[\d.]+/) || [''])[0],
    };
    const text = JSON.stringify(d);
    const win = cardWin;
    (win.navigator.clipboard ? win.navigator.clipboard.writeText(text) : Promise.reject())
      .then(() => say('Diagnostics copied. Paste them into your bug report.'))
      .catch(() => { console.log('[dust-out] diagnostics', text); say('Could not copy. Diagnostics are in the console (Cmd+Option+J).'); });
  }
  const handlers = [[diagBtn, 'click', copyDiag], [close, 'click', hide], [plateBtn, 'click', savePlate], [goBtn, 'click', toggle],
    [earBox, 'change', toggleEar], [teachBtn, 'click', teach], [handBtn, 'click', openHand]];
  function bindCard() { for (const [node, type, fn] of handlers) { node.removeEventListener(type, fn); node.addEventListener(type, fn); } }
  bindCard();
  window.addEventListener('keydown', onKey, true);
  setInterval(() => S.state === 'gone' && paint(), 500);
  paint();

  window.__dustOut = { show: () => { mount(); box.style.display = ''; }, toggle, S };
  } catch (e) {
    console.error('[dust-out] could not start:', e);
  }
})();
