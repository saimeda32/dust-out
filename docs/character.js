// Cartoon call participants for the website and the demo. Moods: talk, listen, surprised, happy.
window.Character = function (o) {
  const W = 1280, H = 720;
  const look = Object.assign({
    skin: '#e3a983', shade: '#c98d68', hair: '#2e211b', hairStyle: 'short', shirt: '#2f6f73', shirtShade: '#24575b',
    glasses: false, earrings: false, gaze: 0,
    wall: ['#e9d8bd', '#d3bc9b', '#a88d70'], room: 'study',
  }, o || {});

  // Room, drawn once and blurred like a camera background.
  const room = document.createElement('canvas'); room.width = W; room.height = H;
  const r = room.getContext('2d');
  const wall = r.createLinearGradient(0, 0, W, H);
  wall.addColorStop(0, look.wall[0]); wall.addColorStop(0.6, look.wall[1]); wall.addColorStop(1, look.wall[2]);
  r.fillStyle = wall; r.fillRect(0, 0, W, H);
  r.filter = 'blur(10px)';
  if (look.room === 'study') {
    r.fillStyle = '#fbf3e3'; r.fillRect(70, 60, 300, 380);
    r.fillStyle = '#cfe0e6'; for (const [x, y] of [[90, 80], [230, 80], [90, 260], [230, 260]]) r.fillRect(x, y, 120, 160);
    r.fillStyle = '#6a4f3a'; r.fillRect(860, 190, 360, 20); r.fillRect(860, 360, 360, 20);
    let x = 880;
    for (const [c, w] of [['#2f6f73', 34], ['#c0643c', 28], ['#e2b04a', 40], ['#5b4a7a', 30], ['#3f6b4a', 36], ['#b94a48', 26]]) {
      r.fillStyle = c; r.fillRect(x, 110 + (w % 3) * 6, w, 80 - (w % 3) * 6); r.fillRect(x + 8, 280, w, 80); x += w + 8;
    }
    r.fillStyle = '#4f7a46'; r.beginPath(); r.ellipse(1150, 300, 50, 60, 0, 0, 7); r.fill();
    r.fillStyle = '#b07a4f'; r.fillRect(1125, 330, 50, 30);
  } else if (look.room === 'kitchen') {
    r.fillStyle = '#f2f6f8'; r.fillRect(0, 380, W, 340);                        // counter wall
    r.fillStyle = '#ffffff'; for (let i = 0; i < 6; i++) r.fillRect(60 + i * 210, 60, 180, 230); // cabinets
    r.fillStyle = '#c7d3da'; for (let i = 0; i < 6; i++) r.fillRect(140 + i * 210, 170, 20, 6);
    r.fillStyle = '#e9b44c'; r.beginPath(); r.arc(1080, 470, 40, 0, 7); r.fill();  // fruit bowl
    r.fillStyle = '#d9653b'; r.beginPath(); r.arc(1140, 480, 34, 0, 7); r.fill();
    r.fillStyle = '#5d8a5a'; r.fillRect(150, 400, 20, 90); r.beginPath(); r.ellipse(160, 380, 60, 50, 0, 0, 7); r.fill();
  } else if (look.room === 'gallery') {
    r.fillStyle = '#f7f1e6'; r.fillRect(820, 90, 300, 220);                       // framed picture
    r.fillStyle = '#e07a5f'; r.beginPath(); r.arc(930, 200, 55, 0, 7); r.fill();
    r.fillStyle = '#3d5a80'; r.fillRect(980, 150, 90, 120);
    r.fillStyle = '#c9a227'; r.fillRect(110, 120, 60, 420);                       // floor lamp
    r.beginPath(); r.ellipse(140, 120, 110, 60, 0, 0, 7); r.fill();
    r.fillStyle = '#3f5e44'; r.beginPath(); r.ellipse(1150, 560, 90, 150, 0, 0, 7); r.fill();
  }
  const glow = r.createRadialGradient(1180, 560, 10, 1180, 560, 260);
  glow.addColorStop(0, 'rgba(255,222,160,0.6)'); glow.addColorStop(1, 'rgba(255,222,160,0)');
  r.fillStyle = glow; r.fillRect(880, 300, 400, 420);
  r.fillStyle = 'rgba(40,30,25,0.55)'; r.fillRect(0, 660, W, 60);
  r.filter = 'none';

  const ease = (t) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));

  function hand(ctx, x, y, s, snapped) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = look.skin; ctx.beginPath(); ctx.ellipse(0, 0, 34, 40, 0, 0, 7); ctx.fill();
    ctx.fillStyle = look.shade;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-16 + i * 15, 22, 9, 16, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = look.skin;
    if (snapped) {
      ctx.beginPath(); ctx.ellipse(10, 36, 10, 24, 0.3, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(30, -26, 10, 24, -0.5, 0, 7); ctx.fill();
    } else {
      ctx.beginPath(); ctx.ellipse(4, -46, 10, 26, 0.15, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(20, -34, 10, 22, -0.6, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  function hairBack(ctx) {
    ctx.fillStyle = look.hair;
    if (look.hairStyle === 'bob') { ctx.beginPath(); ctx.ellipse(0, 10, 140, 165, 0, 0, 7); ctx.fill(); }
  }
  function hairFront(ctx) {
    ctx.fillStyle = look.hair;
    if (look.hairStyle === 'short') {
      ctx.beginPath(); ctx.ellipse(0, -70, 116, 82, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-116, -70); ctx.quadraticCurveTo(-40, -150, 70, -112); ctx.quadraticCurveTo(10, -78, -50, -60); ctx.quadraticCurveTo(-90, -40, -110, -10); ctx.fill();
      ctx.beginPath(); ctx.moveTo(116, -70); ctx.quadraticCurveTo(110, -20, 104, -8); ctx.lineTo(96, -60); ctx.fill();
    } else if (look.hairStyle === 'curly') {
      for (let i = 0; i < 15; i++) {
        const a = Math.PI + (i / 14) * Math.PI, rr = 30 + (i % 3) * 6;
        ctx.beginPath(); ctx.arc(Math.cos(a) * 112, -40 + Math.sin(a) * 108, rr, 0, 7); ctx.fill();
      }
      ctx.beginPath(); ctx.ellipse(0, -84, 100, 60, 0, 0, 7); ctx.fill();
    } else if (look.hairStyle === 'bob') {
      ctx.beginPath(); ctx.ellipse(0, -66, 120, 84, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-120, -66); ctx.quadraticCurveTo(-30, -20, 60, -64); ctx.quadraticCurveTo(100, -80, 120, -66); ctx.fill(); // fringe
    }
  }

  // state: { person, snapAt, mood } ; t: milliseconds
  function draw(ctx, t, state) {
    const s = state || {};
    ctx.drawImage(room, 0, 0);
    if (s.person === false) return;
    const mood = s.mood || 'listen';
    const breathe = Math.sin(t / 900) * 4, sway = Math.sin(t / 1700 + look.gaze) * 8;
    const nod = mood === 'listen' ? Math.max(0, Math.sin(t / 520)) * 6 : 0;
    const tilt = Math.sin(t / 2300 + look.gaze * 2) * 0.04 + (mood === 'surprised' ? -0.05 : 0);
    const snapT = s.snapAt ? (t - s.snapAt) / 1000 : -1;
    const raise = snapT < 0 ? 0 : snapT < 0.5 ? ease(snapT / 0.5) : 1;
    const snapped = snapT > 0.55;
    const cx = 640 + sway, base = 720;

    ctx.save(); ctx.translate(cx, 330 + breathe * 0.6 + nod); ctx.rotate(tilt); hairBack(ctx); ctx.restore();

    ctx.fillStyle = look.shirt;
    ctx.beginPath();
    ctx.moveTo(cx - 290, base); ctx.bezierCurveTo(cx - 280, 560 + breathe, cx - 160, 520 + breathe, cx - 70, 515 + breathe);
    ctx.lineTo(cx + 70, 515 + breathe); ctx.bezierCurveTo(cx + 160, 520 + breathe, cx + 280, 560 + breathe, cx + 290, base);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = look.shirtShade;
    ctx.beginPath(); ctx.moveTo(cx - 60, 515 + breathe); ctx.lineTo(cx, 600 + breathe); ctx.lineTo(cx + 60, 515 + breathe); ctx.closePath(); ctx.fill();
    ctx.fillStyle = look.shade; ctx.fillRect(cx - 38, 440 + breathe, 76, 90);
    ctx.fillStyle = look.skin; ctx.beginPath(); ctx.moveTo(cx - 38, 520 + breathe); ctx.lineTo(cx, 585 + breathe); ctx.lineTo(cx + 38, 520 + breathe); ctx.fill();

    ctx.save(); ctx.translate(cx, 330 + breathe * 0.6 + nod); ctx.rotate(tilt);
    ctx.fillStyle = look.skin;
    ctx.beginPath(); ctx.ellipse(-112, 10, 20, 32, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(112, 10, 20, 32, 0, 0, 7); ctx.fill();
    if (look.earrings) { ctx.fillStyle = '#e8c15a'; ctx.beginPath(); ctx.arc(-114, 46, 9, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(114, 46, 9, 0, 7); ctx.fill(); }
    const face = ctx.createRadialGradient(-30, -30, 20, 0, 0, 150);
    face.addColorStop(0, look.faceLight || '#efbb95'); face.addColorStop(1, look.skin);
    ctx.fillStyle = face; ctx.beginPath(); ctx.ellipse(0, 0, 108, 130, 0, 0, 7); ctx.fill();
    hairFront(ctx);

    // Eyes blink, glance and widen.
    const wide = mood === 'surprised' ? 1.35 : mood === 'happy' ? 0.6 : 1;
    const blink = ((t + look.gaze * 900) % 3800) < 140 ? 0.12 : 1;
    const glance = (look.gaze ? look.gaze * 7 : Math.sin(t / 1300) * 5);
    for (const ex of [-42, 42]) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, 0, 19, 15 * blink * wide, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#3b2a20'; ctx.beginPath(); ctx.ellipse(ex + glance, 2, mood === 'surprised' ? 7 : 9, (mood === 'surprised' ? 7 : 9) * blink * Math.min(1, wide), 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + glance + 3, -2, 2.5 * blink, 0, 7); ctx.fill();
    }
    if (look.glasses) {
      ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(-42, 0, 30, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(42, 0, 30, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-12, -2); ctx.quadraticCurveTo(0, -10, 12, -2); ctx.stroke();
    }
    ctx.strokeStyle = look.hair; ctx.lineWidth = 7; ctx.lineCap = 'round';
    const brow = -30 - raise * 8 - (mood === 'surprised' ? 16 : 0);
    ctx.beginPath(); ctx.moveTo(-62, brow + 4); ctx.quadraticCurveTo(-42, brow - 8, -22, brow); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(22, brow); ctx.quadraticCurveTo(42, brow - 8, 62, brow + 4); ctx.stroke();
    ctx.strokeStyle = look.shade; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-4, 20); ctx.quadraticCurveTo(-12, 46, 4, 50); ctx.stroke();

    ctx.fillStyle = '#7a3b34'; ctx.strokeStyle = '#7a3b34'; ctx.lineWidth = 4;
    if (mood === 'surprised') {
      ctx.beginPath(); ctx.ellipse(0, 84, 16, 22, 0, 0, 7); ctx.fill();
    } else if (mood === 'happy') {
      ctx.beginPath(); ctx.moveTo(-40, 70); ctx.quadraticCurveTo(0, 118, 40, 70); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(-26, 72, 52, 9);
    } else {
      const talk = raise > 0 || mood !== 'talk' ? 0 : Math.max(0, Math.sin(t / 110)) * Math.max(0, Math.sin(t / 700));
      ctx.beginPath(); ctx.ellipse(0, 78, 26 + raise * 6, 6 + talk * 12, 0, 0, Math.PI); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-28 - raise * 6, 78); ctx.quadraticCurveTo(0, 86 + raise * 8, 28 + raise * 6, 74 - raise * 6); ctx.stroke();
    }
    ctx.restore();

    if (raise > 0) {
      const hx = cx + 230, hy = 720 - raise * 330;
      ctx.fillStyle = look.shirt; ctx.beginPath(); ctx.moveTo(hx - 60, 720); ctx.lineTo(hx - 34, hy + 30); ctx.lineTo(hx + 34, hy + 30); ctx.lineTo(hx + 60, 720); ctx.fill();
      hand(ctx, hx, hy, 1.1, snapped);
      if (snapped && snapT < 0.9) {
        ctx.strokeStyle = 'rgba(255,240,200,' + (1 - (snapT - 0.55) / 0.35) + ')'; ctx.lineWidth = 5;
        for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * 70, hy - 40 + Math.sin(a) * 70); ctx.lineTo(hx + Math.cos(a) * 110, hy - 40 + Math.sin(a) * 110); ctx.stroke(); }
      }
    }
  }

  return { draw, width: W, height: H };
};

// The cast.
window.CAST = {
  you: {},
  alex: { skin: '#f0c4a3', shade: '#d9a582', faceLight: '#f8d6bc', hair: '#8a4a2a', hairStyle: 'curly', shirt: '#d9a03b', shirtShade: '#b9842a', glasses: true, gaze: -1, wall: ['#dfe9ef', '#c9d8e1', '#9fb3bf'], room: 'kitchen' },
  sam: { skin: '#9a6648', shade: '#7f513a', faceLight: '#b17a59', hair: '#1f1714', hairStyle: 'bob', shirt: '#e0725f', shirtShade: '#c25a49', earrings: true, gaze: -1, wall: ['#dfe7d6', '#c6d3b8', '#93a582'], room: 'gallery' },
};
