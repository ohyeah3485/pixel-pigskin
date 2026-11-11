import type { GameEngine, PlayerEnt, UIButton } from './engine';
import { FIELD_HALF_W } from './engine';
import { inkOn } from './teams';

const FONT = '"Press Start 2P", monospace';

const PAL = {
  turfA: '#2f8f3e',
  turfB: '#2a8236',
  line: '#f4f7ee',
  stands: '#0b1a12',
  crowd: ['#e85d5d', '#f5f0e1', '#f0c95c', '#6bb3f0', '#9ce37d', '#f0975c'],
};

function setFont(ctx: CanvasRenderingContext2D, px: number) { ctx.font = `${px}px ${FONT}`; }

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, px: number, col: string, align: CanvasTextAlign = 'center', shadow = true) {
  setFont(ctx, px);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (shadow) { ctx.fillStyle = 'rgba(2,10,5,0.85)'; ctx.fillText(s, x + 2, y + 2); }
  ctx.fillStyle = col;
  ctx.fillText(s, x, y);
}

const shakeTmp: [number, number] = [0, 0];

/** SIDE VIEW projection: downfield -> screen X, lateral -> screen Y */
type Proj = (wx: number, wy: number) => [number, number];

export function renderAll(e: GameEngine) {
  const ctx = e.bctx;
  e.traumaShake(shakeTmp);
  const shx = shakeTmp[0], shy = shakeTmp[1];
  const S = e.S * e.cam.zoom;
  const px: Proj = (wx, wy) => [
    e.vw * e.camBias + (wy - e.cam.y) * S + shx,
    e.vh / 2 + (wx - e.cam.x) * S + shy,
  ];

  ctx.clearRect(0, 0, e.vw, e.vh);
  drawField(e, ctx, px, S);
  drawEntities(e, ctx, px, S);
  drawBall(e, ctx, px, S);
  e.fx.render(ctx, px, S);
  drawAim(e, ctx, px, S);
  if (e.phase === 'kick') drawKickScene(e, ctx, px, S);
  drawJoystick(e, ctx, px, S);
  drawFlash(e, ctx);
  drawHUD(e, ctx);
  drawButtons(e, ctx);
  drawHints(e, ctx);
  if (e.phase === 'banner' && e.banner) drawBanner(e, ctx);
  if (e.paused) {
    ctx.fillStyle = 'rgba(2,10,5,0.55)';
    ctx.fillRect(0, 0, e.vw, e.vh);
    text(ctx, 'PAUSED', e.vw / 2, e.vh / 2 - 60, 18, '#aaff3c');
  }
}

// ---------------- field ----------------

function drawField(e: GameEngine, ctx: CanvasRenderingContext2D, px: Proj, S: number) {
  const W = e.vw, H = e.vh;
  const oT = e.offTeam();
  const dT = e.defTeam();

  // sky / stands
  ctx.fillStyle = PAL.stands;
  ctx.fillRect(0, 0, W, H);

  const [, topY] = px(-FIELD_HALF_W, 0);
  const [, botY] = px(FIELD_HALF_W, 0);

  // crowd banks above and below the field
  for (const t of e.crowd) {
    const lateral = t.s === 0 ? -(FIELD_HALF_W + 2.5 + (t.c % 5) * 2.0) : FIELD_HALF_W + 2.5 + (t.c % 5) * 2.0;
    const downf = -14 + t.y * 130;
    const [sx, sy] = px(lateral, downf);
    if (sx < -6 || sx > W + 6 || sy < -6 || sy > H + 6) continue;
    ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(e.time * 2.2 + t.c * 2.7 + t.y * 40));
    ctx.fillStyle = PAL.crowd[t.c % PAL.crowd.length];
    ctx.fillRect(sx - 2, sy - 2, 4, 4);
  }
  ctx.globalAlpha = 1;

  // track surround
  {
    const [x0] = px(0, -14);
    const [x1] = px(0, 114);
    const [, y0] = px(-FIELD_HALF_W - 2.2, 0);
    const [, y1] = px(FIELD_HALF_W + 2.2, 0);
    ctx.fillStyle = '#15382a';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  // turf bands every 5 yards (vertical stripes in side view)
  for (let y = -10; y < 110; y += 5) {
    const [xa] = px(0, y);
    const [xb] = px(0, y + 5);
    if (xb < -20 || xa > W + 20) continue;
    const band = Math.floor((y + 10) / 5);
    if (y >= 100) ctx.fillStyle = dT.c1 === '#000000' ? '#1c1c1c' : dT.c1;
    else if (y < 0) ctx.fillStyle = oT.c1 === '#000000' ? '#1c1c1c' : oT.c1;
    else ctx.fillStyle = band % 2 === 0 ? PAL.turfA : PAL.turfB;
    ctx.fillRect(xa, topY, xb - xa, botY - topY);
    if (y >= 100 || y < 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(xa, topY, xb - xa, botY - topY);
    }
  }

  // yard lines
  for (let y = 0; y <= 100; y += 5) {
    const [sx] = px(0, y);
    if (sx < -10 || sx > W + 10) continue;
    ctx.fillStyle = PAL.line;
    ctx.globalAlpha = y % 10 === 0 ? 0.9 : 0.6;
    ctx.fillRect(sx - 1, topY, 2, botY - topY);
    ctx.globalAlpha = 1;
    if (y % 10 === 0 && y > 0 && y < 100) {
      const num = y <= 50 ? String(y) : String(100 - y);
      ctx.globalAlpha = 0.7;
      text(ctx, num, sx, topY + 26, 10, PAL.line);
      text(ctx, num, sx, botY - 26, 10, PAL.line);
      ctx.globalAlpha = 1;
    }
  }
  // hash marks
  for (let y = 0; y <= 100; y += 1) {
    const [sx] = px(0, y);
    if (sx < -4 || sx > W + 4) continue;
    const [, hy1] = px(-7, 0);
    const [, hy2] = px(7, 0);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = PAL.line;
    ctx.fillRect(sx - 0.75, hy1 - 3, 1.5, 6);
    ctx.fillRect(sx - 0.75, hy2 - 3, 1.5, 6);
    ctx.globalAlpha = 1;
  }

  // sidelines
  ctx.fillStyle = PAL.line;
  {
    const [x0] = px(0, -10);
    const [x1] = px(0, 110);
    ctx.fillRect(x0, topY - 2, x1 - x0, 4);
    ctx.fillRect(x0, botY - 2, x1 - x0, 4);
    const [gx0] = px(0, 0);
    const [gx1] = px(0, 100);
    ctx.fillRect(gx0 - 2, topY, 4, botY - topY);
    ctx.fillRect(gx1 - 2, topY, 4, botY - topY);
  }

  // endzone wordmarks (rotated to read along the endzone)
  drawEZText(e, ctx, px, 105, dT.name.toUpperCase(), inkOn(dT.c1));
  drawEZText(e, ctx, px, -5, oT.name.toUpperCase(), inkOn(oT.c1));

  // midfield logo
  {
    const [mx, my] = px(0, 50);
    if (mx > -90 && mx < W + 90) {
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = '#f4f7ee';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(mx, my, 7 * S, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.3;
      text(ctx, oT.abbr, mx, my, Math.max(10, S * 1.4), oT.c1 === '#000000' ? '#eaffea' : oT.c1);
      ctx.globalAlpha = 1;
    }
  }

  drawGoalPost(e, ctx, px, 100, S);
  drawGoalPost(e, ctx, px, 0, S);

  // LOS + first down markers
  if (e.phase !== 'kick') {
    const [lx] = px(0, e.los);
    ctx.fillStyle = '#4dd8ff';
    ctx.globalAlpha = 0.85;
    ctx.fillRect(lx - 1.5, topY, 3, botY - topY);
    ctx.globalAlpha = 1;
    if (e.ltg <= 100 && !e.cfg.drill) {
      const [fx] = px(0, e.ltg);
      ctx.fillStyle = '#ffd94d';
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(e.time * 5);
      ctx.fillRect(fx - 1.5, topY, 3, botY - topY);
      ctx.globalAlpha = 1;
      // chain marker on the near sideline
      ctx.fillStyle = '#ffd94d';
      ctx.fillRect(fx - 6, botY + 2, 12, 10);
      text(ctx, '1ST', fx, botY + 7, 6, '#1a1205', 'center', false);
    }
    // down marker
    if (!e.cfg.drill) {
      const [dx] = px(0, e.los);
      ctx.fillStyle = '#ff7a1f';
      ctx.fillRect(dx - 6, botY + 2, 12, 10);
      text(ctx, String(Math.min(e.down, 4)), dx, botY + 7, 6, '#1a0d00', 'center', false);
    }
  }

  // pylons
  for (const ey of [0, 100]) {
    for (const ex of [-FIELD_HALF_W, FIELD_HALF_W]) {
      const [sx, sy] = px(ex, ey);
      if (sx < -10 || sx > W + 10) continue;
      ctx.fillStyle = '#ff7a1f';
      ctx.fillRect(sx - 2, sy - 10, 4, 10);
      ctx.fillStyle = '#ffb066';
      ctx.fillRect(sx - 2, sy - 10, 4, 3);
    }
  }

  // route ghosts
  if ((e.cfg.drill && (e.phase === 'presnap' || e.playT < 1.2)) || (!e.cfg.drill && e.phase === 'presnap')) {
    const wrs = e.players.filter((p) => p.kind === 'wr');
    wrs.forEach((wr, i) => {
      const isDrill = e.cfg.drill;
      
      ctx.strokeStyle = isDrill ? 'rgba(170,255,60,0.5)' : (i === 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.5)');
      ctx.lineWidth = i === 0 ? 2.5 : 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      const [s0x, s0y] = px(wr.x, wr.y);
      ctx.moveTo(s0x, s0y);
      for (const r of wr.route) {
        const [sx, sy] = px(r.x, r.y);
        ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      if (isDrill && e.phase === 'presnap' && wr.ctrl) {
        const routeName = e.drillRoutes[e.drillRouteIdx].toUpperCase();
        ctx.fillStyle = '#ff9f3c';
        ctx.fillRect(s0x - 30, s0y - 50, 60, 16);
        text(ctx, `< ${routeName} >`, s0x, s0y - 42, 7, '#1a0205');
      }
    });
  }
}

function drawEZText(e: GameEngine, ctx: CanvasRenderingContext2D, px: Proj, atY: number, label: string, col: string) {
  const [sx, sy] = px(0, atY);
  if (sx < -140 || sx > e.vw + 140) return;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(atY > 50 ? -Math.PI / 2 : Math.PI / 2);
  ctx.globalAlpha = 0.85;
  text(ctx, label.slice(0, 11), 0, 0, 15, col);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawGoalPost(e: GameEngine, ctx: CanvasRenderingContext2D, px: Proj, atY: number, S: number) {
  const back = atY > 50 ? atY + 10 : atY - 10;
  const [sx, cy] = px(0, back);
  if (sx < -60 || sx > e.vw + 60) return;
  const [, topY] = px(-3.1, 0);
  const [, botY] = px(3.1, 0);
  const postH = 6.5 * S;
  const bar = topY - postH * 0.42;
  ctx.fillStyle = '#ffd94d';
  // stem up from the ground
  ctx.fillRect(sx - 2.5, bar, 5, cy - bar);
  // crossbar spanning the uprights
  ctx.fillRect(sx - 2.5, bar, 5, botY - topY);
  // the two uprights
  ctx.fillRect(sx - 3, topY - postH, 6, postH * 0.6);
  ctx.fillRect(sx - 3, botY - postH, 6, postH * 0.6);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(sx - 3, topY - postH, 6, 2);
  ctx.fillRect(sx - 3, botY - postH, 6, 2);
}

// ---------------- players ----------------

function drawEntities(e: GameEngine, ctx: CanvasRenderingContext2D, px: Proj, S: number) {
  // depth sort: higher lateral x is nearer the bottom of the screen -> drawn last
  const sorted = [...e.players].sort((a, b) => a.x - b.x);
  for (const p of sorted) drawPlayer(e, ctx, px, S, p);
}

interface Kit { jersey: string; dark: string; helmet: string; stripe: string; pants: string; skin: string; }

function kitFor(e: GameEngine, p: PlayerEnt): Kit {
  const t = p.side === 'off' ? e.offTeam() : e.defTeam();
  const jersey = t.c1 === '#000000' ? '#242424' : t.c1;
  return { jersey, dark: t.c2, helmet: t.c2, stripe: t.c3, pants: '#eef3ee', skin: '#c99a68' };
}

function drawPlayer(e: GameEngine, ctx: CanvasRenderingContext2D, px: Proj, S: number, p: PlayerEnt) {
  const [sx, sy] = px(p.x, p.y);
  if (sx < -50 || sx > e.vw + 50 || sy < -60 || sy > e.vh + 60) return;
  const kit = kitFor(e, p);
  const faceRight = Math.cos(p.face) >= 0 ? 1 : -1;  // facing downfield?
  const anim = p.anim;

  // ---- control / target rings (drawn flat on the turf) ----
  if (p.ctrl) {
    const padCol = p.pad === 1 ? '#b06bff' : '#ffd94d';
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(e.time * 6);
    ctx.strokeStyle = padCol;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(sx, sy + 2, 1.25 * S, 0.5 * S, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // shadow
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#04140a';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 2, 8, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const headMul = e.mods.bigHead ? 1.85 : 1;
  const run = Math.sin(p.runPhase * 2.4);
  const bob = anim === 'run' ? Math.abs(run) * 1.8 : anim === 'idle' ? Math.sin(p.runPhase) * 0.6 : 0;

  ctx.save();
  ctx.translate(sx, sy - bob);
  ctx.scale(faceRight, 1);

  // --- pose by animation ---
  let rot = 0;
  let drop = 0;
  if (anim === 'fall') {
    const k = Math.min(1, p.animT / 0.45);
    // fall backward if pushed from the front, forward if pushed from behind
    const pushedFromBehind = Math.cos(p.fallDir - p.face) > 0;
    rot = ease(k) * (Math.PI / 2) * (pushedFromBehind ? 1 : -1);
    drop = ease(k) * 6;
  } else if (anim === 'dive') {
    const k = Math.min(1, p.animT / 0.3);
    rot = ease(k) * 1.35;
    drop = ease(k) * 8;
  } else if (anim === 'tackle') {
    const k = Math.min(1, p.animT / 0.5);
    rot = ease(k) * 1.1;
    drop = ease(k) * 6;
  }
  ctx.rotate(rot);
  ctx.translate(0, drop);

  const lean = clamp(p.lean, -1, 1) * (anim === 'run' ? 1 : 0);
  ctx.transform(1, 0, -lean * 0.18, 1, 0, 0);

  // legs
  const legSwing = anim === 'run' ? run * 3.6 : anim === 'dive' || anim === 'tackle' ? 3.2 : 0;
  ctx.fillStyle = '#1b1f1c';
  ctx.fillRect(-4.2 + legSwing * 0.5, 0.2, 3.8, 1.7);
  ctx.fillRect(0.4 - legSwing * 0.5, 0.2, 3.8, 1.7);
  ctx.fillStyle = kit.pants;
  ctx.fillRect(-4 + legSwing * 0.5, -4.4, 3.5, 5);
  ctx.fillRect(0.5 - legSwing * 0.5, -4.4, 3.5, 5);
  ctx.fillStyle = kit.dark;
  ctx.fillRect(-4 + legSwing * 0.5, -1.6, 3.5, 1.3);
  ctx.fillRect(0.5 - legSwing * 0.5, -1.6, 3.5, 1.3);

  // torso
  ctx.fillStyle = kit.jersey;
  ctx.fillRect(-5, -13.4, 10, 9.4);
  ctx.fillStyle = kit.dark;
  ctx.fillRect(-5, -13.4, 10, 2.3);
  // number
  if (anim !== 'fall') {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const num = p.kind === 'qb' ? 1 : p.slot || (p.id % 9) + 1;
    ctx.fillRect(-1.7, -10.4, 1.4, 4);
    if (num % 2 === 0) ctx.fillRect(0.5, -10.4, 1.4, 4);
    else { ctx.fillRect(0.5, -10.4, 1.4, 1.5); ctx.fillRect(0.5, -7.8, 1.4, 1.6); }
  }
  // shoulder pads
  ctx.fillStyle = kit.jersey;
  ctx.fillRect(-6.5, -14, 13, 3.4);
  ctx.fillStyle = kit.stripe;
  ctx.fillRect(-6.5, -14, 13, 1.1);

  // arms — pose dependent
  ctx.fillStyle = kit.skin;
  if (anim === 'throw' && p.armT > 0) {
    const k = 1 - p.armT / 0.3;
    ctx.save();
    ctx.translate(4.2, -12.4);
    ctx.rotate(-2.1 + k * 2.6);
    ctx.fillRect(0, -1.2, 8, 2.4);
    ctx.restore();
    ctx.fillRect(-7.4, -12, 2.4, 5.6);
  } else if (anim === 'catch' && p.armT > 0) {
    ctx.fillRect(3.6, -17.5, 2.4, 7);
    ctx.fillRect(-6.6, -17.5, 2.4, 7);
    ctx.fillStyle = kit.stripe;
    ctx.fillRect(3.4, -18.6, 2.8, 2);
    ctx.fillRect(-6.8, -18.6, 2.8, 2);
  } else if (anim === 'dive' || anim === 'tackle') {
    ctx.fillRect(4.4, -13.4, 9, 2.6);
    ctx.fillRect(4.4, -10.4, 8, 2.4);
  } else if (anim === 'celebrate') {
    const w = Math.sin(e.time * 9) * 0.5;
    ctx.save(); ctx.translate(4.6, -13); ctx.rotate(-1.1 + w); ctx.fillRect(0, -1.2, 7.5, 2.4); ctx.restore();
    ctx.save(); ctx.translate(-4.6, -13); ctx.rotate(-2.0 - w); ctx.fillRect(-7.5, -1.2, 7.5, 2.4); ctx.restore();
  } else if (anim === 'spike') {
    const slam = p.animT > 0.16;
    ctx.save(); ctx.translate(-4.6, -13); ctx.rotate(-1.8); ctx.fillRect(-7.5, -1.2, 7.5, 2.4); ctx.restore();
    ctx.save(); ctx.translate(4.6, -13); ctx.rotate(slam ? 1.5 : -2.5); ctx.fillRect(0, -1.2, 7.5, 2.4); ctx.restore();
    if (!slam) {
      ctx.fillStyle = '#8a4b21'; ctx.fillRect(2.5, -23, 5.4, 3.6);
      ctx.fillStyle = '#fff'; ctx.fillRect(4.7, -23, 1, 3.6);
    } else {
      const bounce = Math.sin(Math.max(0, p.animT - 0.16) * 12) * 4;
      ctx.fillStyle = '#8a4b21'; ctx.fillRect(10, -2 - Math.abs(bounce), 5.4, 3.6);
      ctx.fillStyle = '#fff'; ctx.fillRect(12.2, -2 - Math.abs(bounce), 1, 3.6);
    }
  } else if (anim === 'dance') {
    drop = Math.abs(Math.sin(e.time * 12)) * 2;
    const w = Math.sin(e.time * 12) * 0.8;
    ctx.save(); ctx.translate(4.6, -13); ctx.rotate(-1.5 + w); ctx.fillRect(0, -1.2, 7.5, 2.4); ctx.restore();
    ctx.save(); ctx.translate(-4.6, -13); ctx.rotate(-1.5 - w); ctx.fillRect(-7.5, -1.2, 7.5, 2.4); ctx.restore();
  } else {
    const armSwing = anim === 'run' ? -run * 2.8 : 0;
    ctx.fillRect(-7.2, -12.8 + armSwing * 0.45, 2.4, 6.2);
    ctx.fillRect(4.8, -12.8 - armSwing * 0.45, 2.4, 6.2);
    ctx.fillStyle = kit.stripe;
    ctx.fillRect(-7.2, -7.4 + armSwing * 0.45, 2.4, 1.9);
    ctx.fillRect(4.8, -7.4 - armSwing * 0.45, 2.4, 1.9);
  }

  // ball in hands
  if (p.isCarrier && e.ball.state === 'held') {
    if (anim !== 'spike' || p.animT <= 0.16) {
      ctx.fillStyle = '#8a4b21';
      ctx.fillRect(4.2, -10.8, 5.4, 3.6);
      ctx.fillStyle = '#fff';
      ctx.fillRect(6.4, -10.8, 1, 3.6);
    }
  }

  // head + helmet
  const hw = 8.2 * headMul;
  const hy = -21 * headMul + (headMul - 1) * 6.5;
  ctx.fillStyle = kit.helmet;
  ctx.fillRect(-hw / 2, hy, hw, 6.8 * headMul);
  ctx.fillStyle = kit.stripe;
  ctx.fillRect(-1.1, hy, 2.2, 6.8 * headMul);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-hw / 2 + 1, hy + 1, hw - 2, 1.2);
  // facemask points the way you face
  ctx.fillStyle = '#c9ced2';
  ctx.fillRect(hw / 2 - 1, hy + 3.4, 2.6, 2.2);
  ctx.fillStyle = '#0b0f0c';
  ctx.fillRect(-hw / 2, -14.9, hw, 1.9);
  ctx.restore();

  // ---- status markers ----
  if (p.stun > 0.05) {
    for (let i = 0; i < 3; i++) {
      const a = e.time * 6 + (i * Math.PI * 2) / 3;
      ctx.fillStyle = '#ffd94d';
      ctx.fillRect(sx + Math.cos(a) * 9 - 1.5, sy - 24 + Math.sin(a) * 3, 3, 3);
    }
  }
  if (p.jam > 0.02) text(ctx, 'JAMMED', sx, sy - 32, 6, '#ff9f3c');
  if (p.stumble > 0 && p.anim !== 'fall') {
    const sh = Math.sin(e.time * 30) * 2;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#5c1d26';
    ctx.fillRect(sx - 34 + sh, sy - 52, 68, 13);
    text(ctx, 'OFF BALANCE', sx + sh, sy - 45.5, 6, '#ffb3bc', 'center', false);
    ctx.globalAlpha = 1;
  }

  // pressure alert
  if (p.isQB && e.play === 'qb' && e.phase === 'play' && !e.cfg.drill) {
    for (const d of e.players) {
      if (d.side !== 'def') continue;
      if (Math.hypot(d.x - p.x, d.y - p.y) < 3) { text(ctx, '!', sx, sy - 36, 11, '#ff4d5e'); break; }
    }
  }

  // receiver marker: yellow star above open receivers + number (Retro Bowl style)
  if (p.kind === 'wr' && e.play === 'qb' && e.phase === 'play' && !e.cfg.drill) {
    const cv = e.coverageOf(p);
    const isOpen = cv < 0.50;
    const isTargeted = e.aim.wrId === p.id;
    const bounce = Math.abs(Math.sin(e.time * 5 + p.id)) * 3;
    
    // Number Badge: GREEN = open (safe throw), GREY = covered (risky 70/20/10)
    const badgeBg = isTargeted ? '#aaff3c' : (isOpen ? '#1a3d1a' : '#2a2a2a');
    const badgeBorder = isOpen ? '#aaff3c' : '#666666';
    const badgeText = isTargeted ? '#07140c' : (isOpen ? '#aaff3c' : '#999999');
    ctx.fillStyle = badgeBg;
    ctx.strokeStyle = badgeBorder;
    ctx.lineWidth = isOpen ? 2 : 1.5;
    ctx.fillRect(sx - 8, sy - 46 - bounce, 16, 14);
    ctx.strokeRect(sx - 8, sy - 46 - bounce, 16, 14);
    text(ctx, String(p.slot), sx, sy - 39.5 - bounce, 8, badgeText, 'center', false);

    if (isOpen) {
      ctx.fillStyle = '#aaff3c';
      drawStar(ctx, sx, sy - 58 - bounce, 5, 5);
    }
  }

  if (p.ctrl) {
    const bounce = Math.abs(Math.sin(e.time * 6)) * 3;
    text(ctx, p.pad === 1 ? 'P2' : 'P1', sx, sy - 38 - bounce, 7, p.pad === 1 ? '#b06bff' : '#ffd94d');
  }

  // carrier chevron
  if (p.isCarrier && e.play === 'run') {
    const bounce = Math.abs(Math.sin(e.time * 6)) * 4;
    ctx.fillStyle = e.offColor().main;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 34 - bounce);
    ctx.lineTo(sx - 6, sy - 42 - bounce);
    ctx.lineTo(sx + 6, sy - 42 - bounce);
    ctx.closePath();
    ctx.fill();
  }

  // fatigue pip
  if ((p.ctrl || p.gassed > 0) && (p.stam < 0.5 || p.gassed > 0)) {
    const bw = 26;
    const by = sy + 10;
    ctx.fillStyle = 'rgba(4,16,9,0.85)';
    ctx.fillRect(sx - bw / 2 - 1, by - 1, bw + 2, 5);
    ctx.fillStyle = p.gassed > 0 ? '#ff4d5e' : p.stam > 0.28 ? '#ffd94d' : '#ff9f3c';
    ctx.fillRect(sx - bw / 2, by, bw * Math.max(0, p.stam), 3);
    if (p.gassed > 0) {
      const blink = Math.sin(e.time * 11) > 0;
      ctx.fillStyle = blink ? '#ff4d5e' : '#7a1622';
      ctx.fillRect(sx - 23, sy - 60, 46, 13);
      text(ctx, 'GASSED', sx, sy - 53.5, 6, blink ? '#1a0205' : '#ffb3bc', 'center', false);
    }
  }
}

function ease(k: number) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }

function drawBall(e: GameEngine, ctx: CanvasRenderingContext2D, px: Proj, S: number) {
  const b = e.ball;
  if (b.state === 'held') {
    if (e.carrier()) return;
    const holder = e.phase === 'play' && e.play === 'qb' ? e.players[e.qbId] : null;
    const [sx, sy] = px(holder ? holder.x : b.x, holder ? holder.y : b.y);
    ctx.fillStyle = '#8a4b21';
    ctx.fillRect(sx + 2, sy - 11, 5.4, 3.6);
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx + 4.4, sy - 11, 1, 3.6);
    return;
  }
  const [sx, sy] = px(b.x, b.y);
  ctx.globalAlpha = Math.max(0.06, 0.32 - b.z * 0.012);
  ctx.fillStyle = '#04140a';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 2, 5.5, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  const gy = sy - b.z * S * 0.8;
  ctx.save();
  ctx.translate(sx, gy);
  ctx.rotate(b.spin);
  const s = 1 + b.z * 0.015;
  ctx.scale(s, s);
  ctx.fillStyle = '#8a4b21';
  ctx.fillRect(-4.6, -2.5, 9.2, 5);
  ctx.fillStyle = '#a96a35';
  ctx.fillRect(-2.6, -2.5, 5.2, 5);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-1.8, -0.5, 3.6, 1);
  ctx.restore();
}

// ---------------- aiming ----------------

/**
 * Retro Bowl slingshot: a dotted arc from the QB toward the landing spot.
 * Dots start small near the QB, grow as they travel, and arc up based on
 * power. While dragging you see the pull-back line too.
 */
function drawAim(e: GameEngine, ctx: CanvasRenderingContext2D, px: Proj, S: number) {
  if (e.phase !== 'play' || e.play !== 'qb' || e.cfg.drill) return;
  if (!e.aim.active || e.aim.power < 0.06) return;
  const qb = e.players[e.qbId];
  if (!qb) return;

  const tx = e.aim.tx, ty = e.aim.ty;
  const power = e.aim.power;
  const locked = e.aim.wrId >= 0 ? e.players[e.aim.wrId] : null;

  // ---- pull-back line (faint) — drag position in screen pixels ----
  {
    const slen = Math.hypot(e.aim.dx, e.aim.dy);
    if (slen > 10) {
      const [qsx, qsy] = px(qb.x, qb.y);
      // finger position in buffer coords = press origin + drag
      const fingX = e.aim.ox + e.aim.dx;
      const fingY = e.aim.oy + e.aim.dy;
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(qsx, qsy);
      ctx.lineTo(fingX, fingY);
      ctx.stroke();
      ctx.setLineDash([]);
      // grip handle at finger
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(fingX, fingY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fingX, fingY, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ---- dotted trajectory arc ----
  const d = Math.hypot(tx - qb.x, ty - qb.y);
  // ball height scales with power: bullet = flat, lob = high
  const h = (2.2 + d * 0.14) * (1 - power * 0.35) * (e.mods.moonBall ? 1.9 : 1);
  const N = Math.max(10, Math.round(d * 1.2));
  for (let i = 1; i <= N; i++) {
    const k = i / N;
    const wx = qb.x + (tx - qb.x) * k;
    const wy = qb.y + (ty - qb.y) * k;
    const z = h * 4 * k * (1 - k);
    const [sx, sy] = px(wx, wy);
    // dots grow from small to big — the Retro Bowl look
    const dotSize = 2.2 + k * 4.5;
    ctx.globalAlpha = 0.3 + k * 0.65;
    ctx.fillStyle = i <= N * 0.65 ? '#222222' : '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, sy - z * S * 0.75, dotSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ---- landing marker ----
  const [lx, ly] = px(tx, ty);
  const col = locked ? (e.coverageOf(locked) < 0.4 ? '#aaff3c' : e.coverageOf(locked) < 0.7 ? '#ffd94d' : '#ff4d5e') : '#aaaaaa';
  ctx.strokeStyle = col;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(lx, ly, 9, 0, Math.PI * 2);
  ctx.stroke();
  // crosshair ticks
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ctx.fillStyle = col;
    ctx.fillRect(lx + Math.cos(a) * 12 - 1.5, ly + Math.sin(a) * 12 - 1.5, 3, 3);
  }

  // ---- receiver lock indicator (star like Retro Bowl) ----
  if (locked) {
    const [wx, wy] = px(locked.x, locked.y);
    // star marker
    const pulse = 0.7 + 0.3 * Math.sin(e.time * 8);
    ctx.fillStyle = '#ffd94d';
    ctx.globalAlpha = pulse;
    drawStar(ctx, wx, wy - 22, 6, 5);
    ctx.globalAlpha = 1;
  }

  // ---- power indicator (bottom-left) ----
  {
    const pw = 80, ph = 8;
    const px2 = 16, py2 = e.vh - 56;
    ctx.fillStyle = 'rgba(4,16,9,0.85)';
    ctx.fillRect(px2 - 3, py2 - 14, pw + 6, ph + 24);
    text(ctx, 'POWER', px2 + pw / 2, py2 - 6, 6, '#7aa383', 'center', false);
    ctx.fillStyle = '#10261a';
    ctx.fillRect(px2, py2, pw, ph);
    const barCol = power > 0.85 ? '#ff4d5e' : power > 0.55 ? '#ffd94d' : '#aaff3c';
    ctx.fillStyle = barCol;
    ctx.fillRect(px2, py2, pw * power, ph);
    ctx.strokeStyle = '#04140b';
    ctx.lineWidth = 2;
    ctx.strokeRect(px2, py2, pw, ph);
  }
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, points: number) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const method = i === 0 ? 'moveTo' : 'lineTo';
    ctx[method](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function drawJoystick(e: GameEngine, ctx: CanvasRenderingContext2D, px: Proj, S: number) {
  if (!e.joy.active || e.play !== 'run') return;
  const [bx, by] = px(e.joy.bx, e.joy.by);
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#eaffea';
  ctx.beginPath();
  ctx.arc(bx, by, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(bx + e.joy.dy * S, by + e.joy.dx * S, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawFlash(e: GameEngine, ctx: CanvasRenderingContext2D) {
  if (e.flashA <= 0) return;
  ctx.globalAlpha = Math.min(0.5, e.flashA);
  ctx.fillStyle = e.flashCol;
  ctx.fillRect(0, 0, e.vw, e.vh);
  ctx.globalAlpha = 1;
}

// ---------------- kick ----------------

function drawKickerSprite(ctx: CanvasRenderingContext2D, x: number, y: number, kit: Kit, prog: number, done: boolean) {
  // shadow
  ctx.fillStyle = '#04140a';
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 7, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // legs
  ctx.fillStyle = '#1b1f1c';
  ctx.fillRect(x - 4, y + 0.5, 3.6, 1.6);
  ctx.fillRect(x + 0.4, y + 0.5, 3.6, 1.6);
  ctx.fillStyle = kit.pants;
  ctx.fillRect(x - 4, y - 4, 3.4, 5);
  if (done) {
    // follow-through: kicking leg up high
    ctx.save();
    ctx.translate(x + 2, y - 4);
    ctx.rotate(-1.2);
    ctx.fillRect(0, -1.5, 8, 3);
    ctx.restore();
  } else if (prog > 0.8) {
    // leg swing
    ctx.save();
    ctx.translate(x + 2, y - 4);
    ctx.rotate(-0.8 - (prog - 0.8) * 6);
    ctx.fillRect(0, -1.5, 8, 3);
    ctx.restore();
  } else {
    ctx.fillRect(x + 0.4, y - 4, 3.4, 5);
  }
  // torso
  ctx.fillStyle = kit.jersey;
  ctx.fillRect(x - 5, y - 13, 10, 9);
  ctx.fillStyle = kit.dark;
  ctx.fillRect(x - 5, y - 13, 10, 2);
  // shoulder pads
  ctx.fillStyle = kit.jersey;
  ctx.fillRect(x - 6, y - 14, 12, 3);
  // arms
  ctx.fillStyle = kit.skin;
  ctx.fillRect(x - 7, y - 12, 2.2, 5.5);
  ctx.fillRect(x + 4.8, y - 12, 2.2, 5.5);
  // helmet
  ctx.fillStyle = kit.helmet;
  ctx.fillRect(x - 4, y - 20, 8, 6.5);
  ctx.fillStyle = kit.stripe;
  ctx.fillRect(x - 1, y - 20, 2, 6.5);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x - 3, y - 19, 6, 1.2);
  ctx.fillStyle = '#c9ced2';
  ctx.fillRect(x + 3.5, y - 17, 2.2, 2);
}

function drawKickScene(e: GameEngine, ctx: CanvasRenderingContext2D, px: Proj, S: number) {
  const k = e.kick;
  const by0 = k.kind === 'fg' ? Math.max(8, 100 - (k.distance - 17)) : 92;
  const kit = kitFor(e, { side: 'off' } as PlayerEnt);

  if (k.sub === 'flight' || k.sub === 'result') {
    const t = k.ballT;
    const off = k.acc * 5.5 * (k.arrow > 0.5 ? 1 : -1);
    const wx = off * t;
    const wy = by0 + (110 - by0) * t;
    const wz = Math.sin(t * Math.PI) * 15 * (1 - t * 0.2);
    const [sx, sy] = px(wx, wy);
    // ball shadow
    ctx.globalAlpha = Math.max(0.06, 0.3 - wz * 0.012);
    ctx.fillStyle = '#04140a';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 2, 5, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // ball in flight with spin
    const bsy = sy - wz * S * 0.8;
    ctx.save();
    ctx.translate(sx, bsy);
    ctx.rotate(t * 8);
    ctx.fillStyle = '#8a4b21';
    ctx.fillRect(-4, -2.5, 8, 5);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-1.5, -0.5, 3, 1);
    ctx.restore();
    // kicker standing after the kick
    const [kx2, ky2] = px(0, by0);
    drawKickerSprite(ctx, kx2, ky2, kit, 1.0, true);
  } else {
    // ball on tee
    const [sx, sy] = px(0, by0);
    ctx.fillStyle = '#666';
    ctx.fillRect(sx - 1.5, sy - 5, 3, 5);
    ctx.fillStyle = '#8a4b21';
    ctx.fillRect(sx - 3, sy - 9, 6, 4);
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx - 1, sy - 8, 2, 2);
    // holder kneeling
    const [hx, hy] = px(-2, by0);
    ctx.fillStyle = '#04140a';
    ctx.beginPath();
    ctx.ellipse(hx, hy + 2, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = kit.jersey;
    ctx.fillRect(hx - 4, hy - 10, 8, 7);
    ctx.fillStyle = kit.pants;
    ctx.fillRect(hx - 3, hy - 3, 6, 4);
    ctx.fillStyle = kit.helmet;
    ctx.fillRect(hx - 3, hy - 16, 6, 5);
    // kicker approaching
    const prog = k.sub === 'runup' ? Math.min(1, k.t / 0.7) : 0;
    const [kx, ky] = px(3.5 - prog * 3.5, by0 - 7 + prog * 7);
    drawKickerSprite(ctx, kx, ky, kit, prog, false);
  }

  if (k.sub === 'sweep') {
    const mw = Math.min(380, e.vw - 120);
    const mx = e.vw / 2 - mw / 2, my = e.vh - 132, mh = 24;
    ctx.fillStyle = 'rgba(3,14,7,0.9)';
    ctx.fillRect(mx - 10, my - 38, mw + 20, mh + 70);
    ctx.strokeStyle = '#0f3d21';
    ctx.lineWidth = 3;
    ctx.strokeRect(mx - 10, my - 38, mw + 20, mh + 70);
    ctx.fillStyle = '#ff4d5e';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#ffd94d';
    ctx.fillRect(mx + mw * (0.5 - k.window * 2.1), my, mw * k.window * 4.2, mh);
    ctx.fillStyle = '#aaff3c';
    ctx.fillRect(mx + mw * (0.5 - k.window), my, mw * k.window * 2, mh);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mx + k.arrow * mw - 2.5, my - 7, 5, mh + 14);
    text(ctx, k.kind === 'fg' ? `${k.distance} YARD FIELD GOAL` : 'EXTRA POINT', e.vw / 2, my - 22, 9, '#eaffea');
    text(ctx, e.isTouch ? 'TAP TO KICK' : 'SPACE TO KICK', e.vw / 2, my + mh + 18, 8, '#aaff3c');
  }
}

// ---------------- HUD ----------------

function drawHUD(e: GameEngine, ctx: CanvasRenderingContext2D) {
  const W = e.vw;
  const c = e.cfg;
  ctx.fillStyle = 'rgba(3,13,7,0.92)';
  ctx.fillRect(0, 0, W, 58);
  ctx.fillStyle = '#0f3d21';
  ctx.fillRect(0, 58, W, 3);

  const oT = e.offTeam();
  const dT = e.defTeam();

  if (c.drill) {
    const p1Role = e.drillSide === 'wr' ? 'WR' : 'DB';
    const p2Role = e.drillSide === 'wr' ? 'DB' : 'WR';
    teamChip(ctx, 14, 8, e.twoP ? `P1 ${p1Role}` : `YOU ${p1Role}`, e.drillYou, '#ffd94d', '#1d1405', true);
    teamChip(ctx, W - 14 - 122, 8, e.twoP ? `P2 ${p2Role}` : `CPU ${p2Role}`, e.drillOpp, e.twoP ? '#b06bff' : '#d64045', '#1d0a0e', e.twoP);
    text(ctx, `REP ${Math.min(e.rep + 1, c.reps)} / ${c.reps}`, W / 2, 19, 10, '#eaffea');
    const hint = e.play === 'air' ? 'BALL IN THE AIR!' : e.play === 'run' ? 'RUN IT / BRING HIM DOWN' : 'ROUTE IS LIVE';
    text(ctx, hint, W / 2, 41, 8, '#aaff3c');
  } else {
    const us = c.id === 'two2' ? e.p2[0] : e.scoreUs;
    const them = c.id === 'two2' ? e.p2[1] : e.scoreThem;
    const leftT = c.id === 'two2' ? e.team : e.team;
    const rightT = c.id === 'two2' ? e.team2 : e.opp;
    teamChip(ctx, 14, 8, leftT.abbr, us, leftT.c1 === '#000000' ? '#3a3a3a' : leftT.c1, leftT.c2, c.id !== 'two2' || e.cur2P === 0);
    teamChip(ctx, W - 14 - 122, 8, rightT.abbr, them, rightT.c1 === '#000000' ? '#3a3a3a' : rightT.c1, rightT.c2, c.id === 'two2' && e.cur2P === 1);
    if (c.clocked) {
      const urgent = e.clock < 16 && e.half === 2;
      text(ctx, `H${e.half}  ${e.clockStr()}`, W / 2, 18, 12, urgent ? (Math.sin(e.time * 8) > 0 ? '#ff4d5e' : '#eaffea') : '#eaffea');
      text(ctx, e.downAndDist(), W / 2, 40, 10, '#ffd94d');
    } else if (c.id === 'two2') {
      text(ctx, `DRIVE ${Math.min(e.possIdx + 1, c.drives * 2)}/${c.drives * 2}`, W / 2, 18, 10, '#eaffea');
      text(ctx, e.downAndDist(), W / 2, 40, 10, '#ffd94d');
    } else {
      text(ctx, 'PRACTICE', W / 2, 18, 10, '#c5ff6b');
      text(ctx, `TDs ${e.stats.tds}   BEST ${e.stats.longest}`, W / 2, 40, 9, '#ffd94d');
    }
  }

  // ball-on strip
  if (!c.drill) {
    const bw = 170, bx = W / 2 - bw / 2, by = 64;
    ctx.fillStyle = 'rgba(3,14,7,0.8)';
    ctx.fillRect(bx - 4, by - 3, bw + 8, 13);
    ctx.fillStyle = '#123a1e';
    ctx.fillRect(bx, by, bw, 6);
    ctx.fillStyle = oT.c1 === '#000000' ? '#3a3a3a' : oT.c1;
    ctx.fillRect(bx, by, 5, 6);
    ctx.fillStyle = dT.c1 === '#000000' ? '#3a3a3a' : dT.c1;
    ctx.fillRect(bx + bw - 5, by, 5, 6);
    if (e.ltg <= 100) { ctx.fillStyle = '#ffd94d'; ctx.fillRect(bx + (e.ltg / 100) * bw - 1, by - 2, 2, 10); }
    ctx.fillStyle = '#4dd8ff';
    ctx.fillRect(bx + (e.los / 100) * bw - 1.5, by - 3, 3, 12);
  }

  // ticker
  const ty = 82;
  ctx.fillStyle = '#21060c';
  ctx.fillRect(0, ty, W, 18);
  ctx.fillStyle = '#3d0f18';
  ctx.fillRect(0, ty + 16, W, 2);
  setFont(ctx, 8);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const msg = `${e.tickerMsg}   ///   `;
  const w = ctx.measureText(msg).width || 200;
  const x = ((e.tickerX % w) + w) % w;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, ty, W, 18);
  ctx.clip();
  for (let i = -1; i < W / w + 2; i++) { ctx.fillStyle = '#ff5d75'; ctx.fillText(msg, x + i * w - w, ty + 10); }
  ctx.restore();

  // defensive shell
  if (!c.drill && (e.shellRevealT > 0 || e.phase === 'presnap')) {
    ctx.globalAlpha = e.phase === 'presnap' ? 0.5 : Math.min(1, e.shellRevealT / 0.4);
    text(ctx, e.phase === 'presnap' ? 'DEFENSE: ???' : `DEFENSE: ${e.shellName()}`, W / 2, ty + 32, 8, e.phase === 'presnap' ? '#7aa383' : '#ff8b9b');
    ctx.globalAlpha = 1;
  }

  // mods
  const mods: [boolean, string, string][] = [
    [e.mods.turbo, 'T', '#aaff3c'], [e.mods.moonBall, 'M', '#4dd8ff'],
    [e.mods.blitz, 'B', '#ff4d5e'], [e.mods.bigHead, 'H', '#ffd94d'],
  ];
  let mx = 12;
  for (const [on, ch, col] of mods) {
    if (!on) continue;
    ctx.fillStyle = '#04140b';
    ctx.fillRect(mx, ty + 24, 18, 18);
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.strokeRect(mx, ty + 24, 18, 18);
    text(ctx, ch, mx + 9, ty + 33, 8, col, 'center', false);
    mx += 22;
  }

  // sprint / stamina
  const car = e.carrier();
  if (car && e.play === 'run' && !c.drill) {
    const sw = 120, sx2 = 14, sy2 = ty + 48;
    const st = car.stam;
    const out = car.gassed > 0;
    ctx.fillStyle = 'rgba(3,14,7,0.85)';
    ctx.fillRect(sx2 - 3, sy2 - 3, sw + 6, 16);
    ctx.fillStyle = '#123a1e';
    ctx.fillRect(sx2, sy2, sw, 10);
    if (car.drainFlash > 0) {
      ctx.globalAlpha = 0.5 * (car.drainFlash / 0.9);
      ctx.fillStyle = '#ff4d5e';
      ctx.fillRect(sx2, sy2, sw * Math.min(1, st + 0.4), 10);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = out ? '#ff4d5e' : st > 0.5 ? '#aaff3c' : st > 0.25 ? '#ffd94d' : '#ff9f3c';
    ctx.fillRect(sx2, sy2, sw * st, 10);
    ctx.fillStyle = 'rgba(4,20,11,0.7)';
    for (let i = 1; i < 5; i++) ctx.fillRect(sx2 + (sw / 5) * i, sy2, 1.5, 10);
    text(ctx, out ? 'GASSED' : 'SPRINT', sx2 + sw / 2, sy2 + 5, 6, out ? '#ffffff' : '#04140b', 'center', false);
  }

  if (e.phase !== 'over') {
    const b: UIButton = { id: 'pause', x: W - 46, y: ty + 24, w: 34, h: 32, label: '', color: '#eaffea', cb: () => e.setPaused(true) };
    e.ui.push(b);
    ctx.fillStyle = 'rgba(3,14,7,0.85)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#1d5c33';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#eaffea';
    ctx.fillRect(b.x + 10, b.y + 8, 5, 16);
    ctx.fillRect(b.x + 19, b.y + 8, 5, 16);
  }

  if (e.phase === 'presnap') {
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(e.time * 5);
    if (e.cfg.drill) {
      text(ctx, e.isTouch ? 'TAP TO SNAP' : 'SPACE TO SNAP', W / 2, e.vh - 92, 9, '#ffffff');
    } else {
      text(ctx, 'DRAG BACK TO SNAP & THROW', W / 2, e.vh - 18, 8, '#ffffff');
    }
    ctx.globalAlpha = 1;
  }
}

function teamChip(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, score: number, col: string, dark: string, active: boolean) {
  const w = 122, h = 42;
  ctx.fillStyle = '#071b0e';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col;
  ctx.fillRect(x, y, 6, h);
  ctx.fillStyle = dark;
  ctx.fillRect(x + 6, y, w - 6, 3);
  ctx.strokeStyle = active ? col : '#1d3b26';
  ctx.lineWidth = active ? 3 : 1.5;
  ctx.strokeRect(x, y, w, h);
  text(ctx, label, x + 14, y + 14, 8, col === '#000000' ? '#eaffea' : col, 'left', false);
  text(ctx, String(score), x + w - 12, y + 26, 16, '#ffffff', 'right', false);
}

// ---------------- buttons ----------------

function drawButtons(e: GameEngine, ctx: CanvasRenderingContext2D) {
  const mid = e.vw / 2;
  const base = e.vh;

  if (e.phase === 'fourth') {
    ctx.fillStyle = 'rgba(2,9,4,0.6)';
    ctx.fillRect(0, 0, e.vw, e.vh);
    text(ctx, '4TH DOWN', mid, base - 230, 16, '#ffd94d');
    text(ctx, `${e.downAndDist()}  -  BALL ON ${Math.round(e.los)}`, mid, base - 198, 9, '#eaffea');
    const bw = Math.min(190, (e.vw - 80) / 3), bh = 68, gap = 14;
    const total = bw * 3 + gap * 2;
    const x0 = mid - total / 2;
    const inRange = e.fgInRange();
    const go: UIButton = { id: 'go', x: x0, y: base - 170, w: bw, h: bh, label: 'GO FOR IT', sub: '[ENTER]', color: '#aaff3c', cb: () => e.fourthGo() };
    const punt: UIButton = { id: 'punt', x: x0 + bw + gap, y: base - 170, w: bw, h: bh, label: 'PUNT', sub: '[P]', color: '#4dd8ff', cb: () => e.punt() };
    const fg: UIButton = {
      id: 'fg', x: x0 + (bw + gap) * 2, y: base - 170, w: bw, h: bh,
      label: 'FIELD GOAL', sub: inRange ? `${e.fgDistance()} YDS  [F]` : 'OUT OF RANGE',
      color: inRange ? '#ffd94d' : '#5f7a66', cb: () => e.tryFieldGoal(),
    };
    styledButton(ctx, go, '#113a1e');
    styledButton(ctx, punt, '#12303f');
    styledButton(ctx, fg, inRange ? '#3f3312' : '#1a241c', inRange ? 1 : 0.55);
    e.ui.push(go, punt);
    if (inRange) e.ui.push(fg);
    return;
  }

  if (e.phase === 'presnap') {
    if (!e.cfg.drill) {
      drawPlayCallPanel(e, ctx, mid, base);
    }
    if (e.isTouch) {
      if (e.cfg.drill) {
        const b: UIButton = { id: 'snap', x: mid - 88, y: base - 108, w: 176, h: 54, label: 'SNAP', color: '#aaff3c', cb: () => e.snap(), big: true };
        styledButton(ctx, b, '#113a1e', 0.75 + 0.25 * Math.sin(e.time * 6));
        e.ui.push(b);
        const wr = e.players.find(p => p.kind === 'wr');
        if (wr && wr.ctrl) {
          const bL: UIButton = { id: 'rL', x: mid - 150, y: base - 154, w: 46, h: 36, label: '<', color: '#ff9f3c', cb: () => e.changeDrillRoute(-1) };
          const bR: UIButton = { id: 'rR', x: mid + 104, y: base - 154, w: 46, h: 36, label: '>', color: '#ff9f3c', cb: () => e.changeDrillRoute(1) };
          styledButton(ctx, bL, '#1f1206');
          styledButton(ctx, bR, '#1f1206');
          e.ui.push(bL, bR);
          text(ctx, 'ROUTE', mid, base - 136, 8, '#ff9f3c');
        }
      }
    }
  }
  if (e.phase === 'play' && e.cfg.drill && e.play !== 'dead') {
    drawActionCard(e, ctx, 0);
    if (e.twoP) drawActionCard(e, ctx, 1);
    const action = e.actionFor(0);
    if (e.isTouch && action) {
      const b: UIButton = { id: 'act', x: e.vw - 150, y: base - 108, w: 132, h: 54, label: 'BALL!', color: '#ffd94d', cb: () => e.drillAction(0) };
      styledButton(ctx, b, '#3f3312');
      e.ui.push(b);
    }
  }
  if (e.phase === 'play' && e.play === 'qb' && e.isTouch && e.cfg.canScramble && !e.cfg.drill) {
    const b: UIButton = { id: 'run', x: e.vw - 110, y: base - 108, w: 88, h: 48, label: 'KEEP', sub: 'RUN', color: '#4dd8ff', cb: () => e.startScramble() };
    styledButton(ctx, b, '#12303f');
    e.ui.push(b);
  }
  if (e.phase === 'conv') {
    const c = e.cfg;
    text(ctx, 'EXTRA POINT', mid, base - 184, 12, '#eaffea');
    const bw = Math.min(180, (e.vw - 60) / 2);
    if (c.conv === 'kick') {
      const b1: UIButton = { id: 'kick1', x: mid - bw - 8, y: base - 150, w: bw, h: 64, label: 'KICK +1', sub: '[K]', color: '#aaff3c', cb: () => e.beginKick(1, 'xp', 20, 0.17) };
      const b2: UIButton = { id: 'conv2', x: mid + 8, y: base - 150, w: bw, h: 64, label: 'GO FOR 2', sub: '[G]', color: '#ffd94d', cb: () => e.beginConvPlay(97, 2) };
      styledButton(ctx, b1, '#113a1e'); styledButton(ctx, b2, '#3f3312');
      e.ui.push(b1, b2);
    } else {
      const b1: UIButton = { id: 'conv1', x: mid - bw - 8, y: base - 150, w: bw, h: 64, label: '+1 TRY', sub: 'FROM 5  [1]', color: '#aaff3c', cb: () => e.beginConvPlay(95, 1) };
      const b2: UIButton = { id: 'conv2', x: mid + 8, y: base - 150, w: bw, h: 64, label: '+2 TRY', sub: 'FROM 10  [2]', color: '#ffd94d', cb: () => e.beginConvPlay(90, 2) };
      styledButton(ctx, b1, '#113a1e'); styledButton(ctx, b2, '#3f3312');
      e.ui.push(b1, b2);
    }
  }
}

/** compact tackle readout for the drill */
function drawActionCard(e: GameEngine, ctx: CanvasRenderingContext2D, pad: number) {
  const me = pad === 0 ? e.players[e.ctrlId] : e.players[e.ctrlId2];
  if (!me) return;
  const isDef = me.side === 'def';
  const key = pad === 0 ? 'F' : 'P';
  const padCol = pad === 1 ? '#b06bff' : '#ffd94d';
  const action = e.actionFor(pad);
  const can = action !== null;
  const onCd = me.gambleCd > 0;
  const gassed = e.gassedFor(pad);
  const w = 176, h = 62;
  const x = pad === 0 ? 18 : e.vw - w - 18;
  const y = e.vh - h - (e.isTouch ? 124 : 40);
  const accent = gassed ? '#ff4d5e' : can ? (action === 'call_ball' ? '#ffd94d' : '#ff4d5e') : onCd ? '#ff8b6b' : '#3c5244';

  if (can) {
    ctx.globalAlpha = 0.18 + 0.14 * Math.sin(e.time * 8);
    ctx.fillStyle = accent;
    ctx.fillRect(x - 5, y - 5, w + 10, h + 10);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = 'rgba(4,16,9,0.93)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#04140b';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = padCol;
  ctx.fillRect(x, y, w, 14);
  text(ctx, e.twoP ? `PLAYER ${pad + 1}` : 'YOU', x + 7, y + 7.5, 7, '#07140c', 'left', false);
  text(ctx, isDef ? 'DEFENDER' : 'RECEIVER', x + w - 7, y + 7.5, 7, 'rgba(7,20,12,0.75)', 'right', false);

  // keycap
  const capS = 24, capX = x + 9, capY = y + 22;
  ctx.fillStyle = '#04140b';
  ctx.fillRect(capX, capY + 3, capS, capS);
  ctx.fillStyle = can ? accent : '#18301f';
  ctx.fillRect(capX, capY, capS, capS);
  ctx.fillStyle = can ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.08)';
  ctx.fillRect(capX, capY, capS, 2);
  text(ctx, key, capX + capS / 2, capY + capS / 2, 11, can ? '#1a0205' : '#5f8a66', 'center', false);
  const tx = capX + capS + 9;

  if (isDef) {
    if (gassed) text(ctx, 'NO GAS', tx, y + 30, 9, '#ff4d5e', 'left', false);
    else if (onCd) {
      text(ctx, 'RESET', tx, y + 28, 8, '#ff8b6b', 'left', false);
      const bw = w - (tx - x) - 14;
      ctx.fillStyle = '#10261a';
      ctx.fillRect(tx, y + 38, bw, 8);
      ctx.fillStyle = '#ff9f3c';
      ctx.fillRect(tx, y + 38, bw * (1 - Math.min(1, me.gambleCd / Math.max(0.01, me.gambleCdMax))), 8);
    } else if (can) {
      text(ctx, 'DIVE TACKLE', tx, y + 28, 9, accent, 'left', false);
      text(ctx, 'MISS = BIG GAS HIT', tx, y + 42, 6, '#7aa383', 'left', false);
    } else {
      text(ctx, 'COVER HIM', tx, y + 30, 8, '#48624f', 'left', false);
    }
  } else {
    if (gassed) text(ctx, 'NO GAS', tx, y + 30, 9, '#ff4d5e', 'left', false);
    else if (can) {
      text(ctx, 'CALL BALL', tx, y + 28, 9, accent, 'left', false);
      text(ctx, 'DEMAND THE PASS', tx, y + 42, 6, '#7aa383', 'left', false);
    } else {
      text(ctx, 'RUN THE ROUTE', tx, y + 28, 8, '#aaff3c', 'left', false);
      text(ctx, 'GET OPEN - CATCH', tx, y + 42, 6, '#7aa383', 'left', false);
    }
  }

  // stamina strip
  const bx = x + 9, by = y + h - 9, bw2 = w - 18;
  ctx.fillStyle = '#10261a';
  ctx.fillRect(bx, by, bw2, 5);
  ctx.fillStyle = me.gassed > 0 ? '#ff4d5e' : me.stam > 0.5 ? '#aaff3c' : '#ffd94d';
  ctx.fillRect(bx, by, bw2 * me.stam, 5);

  if (me.resultT > 0 && me.lastResult) {
    ctx.globalAlpha = Math.min(1, me.resultT / 0.3);
    ctx.fillStyle = me.resultGood ? '#1d5c33' : '#5c1d26';
    ctx.fillRect(x, y - 17, w, 16);
    text(ctx, me.lastResult, x + w / 2, y - 9, 7, me.resultGood ? '#aaff3c' : '#ffb3bc', 'center', false);
    ctx.globalAlpha = 1;
  }
}

/** Football Bros-style play call panel before the snap */
function drawPlayCallPanel(e: GameEngine, ctx: CanvasRenderingContext2D, mid: number, base: number) {
  const plays = e.seasonPlays;
  const idx = e.seasonPlayIdx;
  const pw = Math.min(520, e.vw - 40);
  const ph = 80;
  const px = mid - pw / 2;
  const py = base - ph - 34;

  // panel background
  ctx.fillStyle = 'rgba(4,18,9,0.94)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#1d5c33';
  ctx.lineWidth = 3;
  ctx.strokeRect(px, py, pw, ph);
  ctx.fillStyle = '#aaff3c';
  ctx.fillRect(px, py, pw, 3);

  // title
  text(ctx, 'CHOOSE PLAY', mid, py + 14, 8, '#aaff3c', 'center', false);
  if (!e.isTouch) text(ctx, '[ Q / E ]', mid, py + 26, 6, '#7aa383', 'center', false);

  // play cards
  const cardW = Math.min(80, (pw - 40) / Math.min(plays.length, 6));
  const totalCards = Math.min(plays.length, 6);
  const cardsW = totalCards * cardW + (totalCards - 1) * 6;
  const cx0 = mid - cardsW / 2;

  for (let i = 0; i < totalCards; i++) {
    const pi = (idx - Math.floor(totalCards / 2) + i + plays.length) % plays.length;
    const play = plays[pi];
    const active = pi === idx;
    const cx = cx0 + i * (cardW + 6);
    const cy = py + 34;
    const ch = 38;

    ctx.fillStyle = active ? '#1d5c33' : '#0a2216';
    ctx.fillRect(cx, cy, cardW, ch);
    ctx.strokeStyle = active ? '#aaff3c' : '#123a1e';
    ctx.lineWidth = active ? 3 : 1.5;
    ctx.strokeRect(cx, cy, cardW, ch);

    if (active) {
      ctx.fillStyle = '#aaff3c';
      ctx.fillRect(cx, cy, cardW, 3);
    }

    const nameSize = play.name.length > 9 ? 6 : 7;
    text(ctx, play.name, cx + cardW / 2, cy + 14, nameSize, active ? '#aaff3c' : '#5f8a66', 'center', false);

    // mini route glyphs
    const routes = play.routes;
    const rw = Math.min(cardW - 8, routes.length * 7);
    const rx0 = cx + cardW / 2 - rw / 2;
    routes.forEach((r, ri) => {
      const rx = rx0 + ri * 7;
      const ry = cy + 26;
      const col = active ? routeColor(r) : '#3c5244';
      ctx.fillStyle = col;
      // tiny dot + direction tick
      ctx.fillRect(rx, ry, 3, 3);
      if (r === 'go' || r === 'post' || r === 'wheel') ctx.fillRect(rx, ry - 4, 3, 4);
      else if (r === 'out' || r === 'corner') ctx.fillRect(rx - 3, ry, 3, 3);
      else if (r === 'slant' || r === 'in' || r === 'dig') ctx.fillRect(rx + 3, ry, 3, 3);
      else if (r === 'curl' || r === 'comeback') { ctx.fillRect(rx, ry - 3, 3, 3); ctx.fillRect(rx, ry + 3, 3, 3); }
      else ctx.fillRect(rx, ry - 3, 3, 3);
    });
  }

  // touch: < > buttons
  if (e.isTouch) {
    const bL: UIButton = { id: 'pL', x: px + 4, y: py + 36, w: 32, h: 34, label: '<', color: '#4dd8ff', cb: () => e.changeSeasonPlay(-1) };
    const bR: UIButton = { id: 'pR', x: px + pw - 36, y: py + 36, w: 32, h: 34, label: '>', color: '#4dd8ff', cb: () => e.changeSeasonPlay(1) };
    styledButton(ctx, bL, '#12303f');
    styledButton(ctx, bR, '#12303f');
    e.ui.push(bL, bR);
  }
}

function routeColor(r: string): string {
  switch (r) {
    case 'go': case 'wheel': return '#aaff3c';
    case 'post': case 'corner': return '#4dd8ff';
    case 'slant': case 'in': case 'dig': return '#ffd94d';
    case 'out': case 'comeback': return '#ff9f3c';
    case 'curl': case 'flat': return '#ff6b6b';
    default: return '#aaaaaa';
  }
}

function styledButton(ctx: CanvasRenderingContext2D, b: UIButton, bg: string, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = bg;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = '#04140b';
  ctx.lineWidth = 3;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = b.color;
  ctx.fillRect(b.x, b.y, b.w, 3);
  text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 - (b.sub ? 9 : 0), b.big ? 12 : 10, b.color);
  if (b.sub) text(ctx, b.sub, b.x + b.w / 2, b.y + b.h / 2 + 13, 7, '#c9d4c9');
  ctx.globalAlpha = 1;
}

// ---------------- hints ----------------

function drawHints(e: GameEngine, ctx: CanvasRenderingContext2D) {
  if (e.isTouch || e.phase === 'over' || e.phase === 'banner') return;
  let hints: string[] = [];
  if (e.phase === 'presnap') {
    hints = e.cfg.drill
      ? (e.twoP ? ['SPACE SNAP', 'WASD P1', 'IJKL P2', 'ESC PAUSE'] : ['SPACE SNAP', 'WASD MOVE', 'ESC PAUSE'])
      : ['Q/E PLAY', 'DRAG AUTO-SNAP', '1-6 TARGET'];
  } else if (e.phase === 'play' && e.cfg.drill) {
    hints = e.twoP ? ['WASD P1', 'IJKL P2', 'F/P TACKLE'] : ['WASD MOVE', 'F TACKLE', 'R RESET'];
  } else if (e.phase === 'play' && e.play === 'qb') {
    hints = ['CLICK THROW', '1-6 QUICK PASS', 'WASD MOVE', 'RMB SCRAMBLE'];
  } else if (e.play === 'run') {
    hints = ['W/S DODGE'];
  } else if (e.phase === 'fourth') {
    hints = ['ENTER GO', 'P PUNT', 'F FIELD GOAL'];
  } else if (e.phase === 'conv') {
    hints = e.cfg.conv === 'kick' ? ['K KICK', 'G GO FOR 2'] : ['1 ONE POINT', '2 TWO POINTS'];
  } else if (e.phase === 'kick') hints = ['SPACE KICK'];
  if (!hints.length) return;
  const y = e.vh - 22;
  ctx.fillStyle = 'rgba(3,13,7,0.82)';
  ctx.fillRect(0, y - 13, e.vw, 30);
  ctx.fillStyle = '#0f3d21';
  ctx.fillRect(0, y - 14, e.vw, 2);
  setFont(ctx, 7);
  ctx.textBaseline = 'middle';
  const gap = e.vw / (hints.length + 1);
  hints.forEach((hh, i) => {
    const parts = hh.split(' ');
    const key = parts[0];
    const act = parts.slice(1).join(' ');
    const x = gap * (i + 1);
    ctx.textAlign = 'left';
    const kw = ctx.measureText(key).width;
    const aw = ctx.measureText(act).width;
    const total = kw + 10 + aw;
    ctx.fillStyle = '#ffd94d';
    ctx.fillText(key, x - total / 2, y);
    ctx.fillStyle = '#7aa383';
    ctx.fillText(act, x - total / 2 + kw + 10, y);
  });
  ctx.textAlign = 'center';
}

// ---------------- banner ----------------

function drawBanner(e: GameEngine, ctx: CanvasRenderingContext2D) {
  const b = e.banner!;
  ctx.fillStyle = `rgba(2,9,4,${b.dim})`;
  ctx.fillRect(0, 0, e.vw, e.vh);
  const panelW = Math.min(640, e.vw - 60);
  const panelH = 36 + b.lines.length * 48;
  const py = e.vh / 2 - panelH / 2;
  const pxL = e.vw / 2 - panelW / 2;
  ctx.fillStyle = 'rgba(4,18,9,0.94)';
  ctx.fillRect(pxL, py, panelW, panelH);
  ctx.strokeStyle = '#1d5c33';
  ctx.lineWidth = 3;
  ctx.strokeRect(pxL, py, panelW, panelH);
  ctx.strokeStyle = 'rgba(170,255,60,0.25)';
  ctx.strokeRect(pxL + 6, py + 6, panelW - 12, panelH - 12);

  b.lines.forEach((ln, li) => {
    const chars = ln.txt.split('');
    const cw = ln.size * 1.05;
    const x0 = e.vw / 2 - (chars.length - 1) * cw * 0.5;
    const yBase = py + 46 + li * 48;
    ctx.textBaseline = 'middle';
    chars.forEach((ch, ci) => {
      const lt = b.t - (li * 0.16 + ci * 0.032);
      if (lt <= 0) return;
      const pop = lt < 0.12 ? 0.4 + (lt / 0.12) * 0.6 : 1;
      const jitter = lt < 0.12 ? (Math.random() - 0.5) * 3 : 0;
      setFont(ctx, Math.round(ln.size * pop));
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(2,10,5,0.9)';
      ctx.fillText(ch, x0 + ci * cw + 2, yBase + 2 + jitter);
      ctx.fillStyle = ln.col;
      ctx.fillText(ch, x0 + ci * cw, yBase + jitter);
    });
  });

  if (b.needTap || b.t > b.dur * 0.8) {
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(e.time * 6);
    text(ctx, e.isTouch ? 'TAP TO CONTINUE' : 'PRESS SPACE', e.vw / 2, py + panelH + 24, 8, '#ffd94d');
    ctx.globalAlpha = 1;
  }
}
