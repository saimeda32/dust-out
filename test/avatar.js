// Demo mode (?avatar): an animated cartoon person in an illustrated room, used to record the
// demo for the README and website. They blink, breathe, glance around, talk, and can snap.
// window.person hides/shows them; window.snapAt = performance.now() plays a snap.
(() => {
  const W = 1280, H = 720;
  const room = document.createElement('canvas'); room.width = W; room.height = H;
  const r = room.getContext('2d');
  const wall = r.createLinearGradient(0, 0, W, H);
  wall.addColorStop(0, '#e9d8bd'); wall.addColorStop(0.6, '#d3bc9b'); wall.addColorStop(1, '#a88d70');
  r.fillStyle = wall; r.fillRect(0, 0, W, H);
  r.filter = 'blur(10px)';
  // Window with daylight, shelf with books and a plant, a lamp glow: soft like a real camera background.
  r.fillStyle = '#fbf3e3'; r.fillRect(70, 60, 300, 380);
  r.fillStyle = '#cfe0e6'; r.fillRect(90, 80, 120, 160); r.fillRect(230, 80, 120, 160); r.fillRect(90, 260, 120, 160); r.fillRect(230, 260, 120, 160);
  r.fillStyle = '#6a4f3a'; r.fillRect(860, 190, 360, 20); r.fillRect(860, 360, 360, 20);
  const books = [['#2f6f73', 34], ['#c0643c', 28], ['#e2b04a', 40], ['#5b4a7a', 30], ['#3f6b4a', 36], ['#b94a48', 26]];
  let x = 880; for (const [c, w] of books) { r.fillStyle = c; r.fillRect(x, 110 + (w % 3) * 6, w, 80 - (w % 3) * 6); r.fillRect(x + 8, 280, w, 80); x += w + 8; }
  r.fillStyle = '#4f7a46'; r.beginPath(); r.ellipse(1150, 300, 50, 60, 0, 0, 7); r.fill();
  r.fillStyle = '#b07a4f'; r.fillRect(1125, 330, 50, 30);
  const glow = r.createRadialGradient(1180, 560, 10, 1180, 560, 260);
  glow.addColorStop(0, 'rgba(255,222,160,0.8)'); glow.addColorStop(1, 'rgba(255,222,160,0)');
  r.fillStyle = glow; r.fillRect(880, 300, 400, 420);
  r.fillStyle = '#4a3a2e'; r.fillRect(0, 660, W, 60);
  r.filter = 'none';

  const skin = '#e3a983', skinShade = '#c98d68', hair = '#2e211b', shirt = '#2f6f73', shirtShade = '#24575b';
  const ease = (t) => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);

  function hand(ctx, x, y, s, snapped) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.ellipse(0, 0, 34, 40, 0, 0, 7); ctx.fill(); // palm
    ctx.fillStyle = skinShade;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-16 + i * 15, 22, 9, 16, 0, 0, 7); ctx.fill(); } // curled fingers
    ctx.fillStyle = skin;
    if (snapped) {
      ctx.beginPath(); ctx.ellipse(10, 36, 10, 24, 0.3, 0, 7); ctx.fill(); // middle finger down at the palm
      ctx.beginPath(); ctx.ellipse(30, -26, 10, 24, -0.5, 0, 7); ctx.fill(); // thumb out
    } else {
      ctx.beginPath(); ctx.ellipse(4, -46, 10, 26, 0.15, 0, 7); ctx.fill(); // middle finger up
      ctx.beginPath(); ctx.ellipse(20, -34, 10, 22, -0.6, 0, 7); ctx.fill(); // thumb pressed to it
    }
    ctx.restore();
  }

  window.drawAvatar = (ctx, t) => {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(room, 0, 0);
    if (!window.person) { ctx.restore(); return; }
    const breathe = Math.sin(t / 900) * 4, sway = Math.sin(t / 1700) * 8, tilt = Math.sin(t / 2300) * 0.04;
    const snapT = window.snapAt ? (t - window.snapAt) / 1000 : -1; // seconds since the snap started
    const raise = snapT < 0 ? 0 : snapT < 0.5 ? ease(snapT / 0.5) : 1;
    const snapped = snapT > 0.55;
    const cx = 640 + sway, base = 720;

    // Shoulders and shirt.
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.moveTo(cx - 290, base); ctx.bezierCurveTo(cx - 280, 560 + breathe, cx - 160, 520 + breathe, cx - 70, 515 + breathe);
    ctx.lineTo(cx + 70, 515 + breathe); ctx.bezierCurveTo(cx + 160, 520 + breathe, cx + 280, 560 + breathe, cx + 290, base);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = shirtShade;
    ctx.beginPath(); ctx.moveTo(cx - 60, 515 + breathe); ctx.lineTo(cx, 600 + breathe); ctx.lineTo(cx + 60, 515 + breathe); ctx.closePath(); ctx.fill();
    // Neck.
    ctx.fillStyle = skinShade; ctx.fillRect(cx - 38, 440 + breathe, 76, 90);
    ctx.fillStyle = skin; ctx.beginPath(); ctx.moveTo(cx - 38, 520 + breathe); ctx.lineTo(cx, 585 + breathe); ctx.lineTo(cx + 38, 520 + breathe); ctx.fill();

    // Head.
    ctx.save(); ctx.translate(cx, 330 + breathe * 0.6); ctx.rotate(tilt);
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.ellipse(-112, 10, 20, 32, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(112, 10, 20, 32, 0, 0, 7); ctx.fill(); // ears
    const face = ctx.createRadialGradient(-30, -30, 20, 0, 0, 150);
    face.addColorStop(0, '#efbb95'); face.addColorStop(1, skin);
    ctx.fillStyle = face; ctx.beginPath(); ctx.ellipse(0, 0, 108, 130, 0, 0, 7); ctx.fill();
    // Hair: a full top with a side sweep.
    ctx.fillStyle = hair;
    ctx.beginPath(); ctx.ellipse(0, -70, 116, 82, 0, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-116, -70); ctx.quadraticCurveTo(-40, -150, 70, -112); ctx.quadraticCurveTo(10, -78, -50, -60); ctx.quadraticCurveTo(-90, -40, -110, -10); ctx.fill();
    ctx.beginPath(); ctx.moveTo(116, -70); ctx.quadraticCurveTo(110, -20, 104, -8); ctx.lineTo(96, -60); ctx.fill();
    // Eyes: blink every few seconds, glance left and right.
    const blink = (t % 3800) < 140 ? 0.12 : 1, look = Math.sin(t / 1300) * 5;
    for (const ex of [-42, 42]) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, 0, 19, 15 * blink, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#3b2a20'; ctx.beginPath(); ctx.ellipse(ex + look, 2, 9, 9 * blink, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + look + 3, -2, 2.5 * blink, 0, 7); ctx.fill();
    }
    // Eyebrows lift at the snap.
    ctx.strokeStyle = hair; ctx.lineWidth = 7; ctx.lineCap = 'round';
    const brow = -30 - raise * 8;
    ctx.beginPath(); ctx.moveTo(-62, brow + 4); ctx.quadraticCurveTo(-42, brow - 8, -22, brow); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(22, brow); ctx.quadraticCurveTo(42, brow - 8, 62, brow + 4); ctx.stroke();
    // Nose and mouth: talking before the snap, a sly smile after.
    ctx.strokeStyle = skinShade; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-4, 20); ctx.quadraticCurveTo(-12, 46, 4, 50); ctx.stroke();
    const talk = raise > 0 ? 0 : Math.max(0, Math.sin(t / 110)) * Math.max(0, Math.sin(t / 700));
    ctx.fillStyle = '#7a3b34';
    ctx.beginPath(); ctx.ellipse(0, 78, 26 + raise * 6, 6 + talk * 12, 0, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = '#7a3b34'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-28 - raise * 6, 78); ctx.quadraticCurveTo(0, 86 + raise * 8, 28 + raise * 6, 74 - raise * 6); ctx.stroke();
    ctx.restore();

    // The snapping hand rises into view beside the face.
    if (raise > 0) {
      const hx = cx + 230, hy = 720 - raise * 330;
      ctx.fillStyle = shirt; ctx.beginPath(); ctx.moveTo(hx - 60, 720); ctx.lineTo(hx - 34, hy + 30); ctx.lineTo(hx + 34, hy + 30); ctx.lineTo(hx + 60, 720); ctx.fill();
      hand(ctx, hx, hy, 1.1, snapped);
      if (snapped && snapT < 0.9) { // little spark lines at the snap
        ctx.strokeStyle = 'rgba(255,240,200,' + (1 - (snapT - 0.55) / 0.35) + ')'; ctx.lineWidth = 5;
        for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, r0 = 70, r1 = 110; ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * r0, hy - 40 + Math.sin(a) * r0); ctx.lineTo(hx + Math.cos(a) * r1, hy - 40 + Math.sin(a) * r1); ctx.stroke(); }
      }
    }
    ctx.restore();
  };
})();
