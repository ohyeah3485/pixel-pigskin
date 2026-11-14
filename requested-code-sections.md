# Requested code sections

Exact excerpts from the current workspace. Player, phase, play and kick types are in `engine.ts`, not `types.ts`. The play-call panel and in-game hints are in `render.ts`; controls help is in `ui/Modals.tsx` and `ui/PauseOverlay.tsx`.

## types.ts — mode and related types

```typescript
export type ModeId = 'arcade' | 'seven7' | 'one1' | 'two2' | 'practice';
export type DrillSide = 'wr' | 'db';
export type DrillOpponent = 'ai' | 'local';
export type ActionKind = 'call_ball' | null;
```

## engine.ts — field dimensions, entity, phase, play and kick types

```typescript
export const FIELD_HALF_W = 26.65;
export const FIELD_LENGTH = 120;
export const ENDZONE_DEPTH = 10;

export type Phase = 'boot' | 'presnap' | 'fourth' | 'play' | 'kick' | 'conv' | 'banner' | 'over';
export type Play = 'qb' | 'air' | 'run' | 'dead';
export type DeadResult = 'none' | 'tackle' | 'oob' | 'inc' | 'sack' | 'int' | 'td' | 'whistle' | 'breakup';
export type KickKind = 'xp' | 'fg' | 'kickoff' | 'punt';

export interface PlayerEnt {
  id: number;
  side: 'off' | 'def';
  kind: 'qb' | 'wr' | 'ol' | 'db' | 'dl';
  slot: number;
  x: number; y: number;
  vx: number; vy: number;
  speed: number;
  chaseSpeed: number;
  route: RoutePt[];
  ri: number;
  assignment: number;
  zx: number; zy: number;
  role: 'man' | 'zone' | 'deep' | 'rush' | 'spy';
  press: boolean;
  cover: 'press' | 'backpedal' | 'trail' | 'zone';
  leverage: number;        // -1 inside shade, +1 outside shade
  reactT: number;          // recognition delay after the throw
  playBall: boolean;       // committed to attacking the catch point
  estX: number; estY: number;  // misread direction of the landing spot
  estMag: number;              // how badly he misjudged it (persists)
  flipT: number;           // hip-flip animation timer
  state: 'idle' | 'route' | 'seek' | 'cover' | 'rush' | 'block' | 'chase' | 'down' | 'whiff' | 'dive' | 'tackling' | 'tackled';
  t: number;
  shedAt: number;
  move: 'speed' | 'bull' | 'inside';
  stun: number;
  jam: number;
  jukeCd: number;
  face: number;          // facing angle (radians, world space)
  lean: number;          // -1..1 body lean for cuts
  runPhase: number;
  isCarrier: boolean;
  isQB: boolean;
  openness: number;
  downT: number;
  diveT: number;
  ctrl: boolean;
  pad: number;
  mass: number;
  radius: number;
  stumble: number;
  burst: number;
  // tackle ability (defender)
  gambleT: number;
  gambleTarget: number;
  gambleCd: number;
  gambleCdMax: number;
  // fatigue
  stam: number;
  gassed: number;
  drainFlash: number;
  // feedback
  lastResult: string;
  resultGood: boolean;
  resultT: number;
  // animation
  anim: 'idle' | 'run' | 'throw' | 'catch' | 'tackle' | 'fall' | 'celebrate' | 'dive' | 'spike' | 'dance';
  animT: number;
  fallDir: number;
  armT: number;          // reach / throw arm timer
}

export interface RoutePt { x: number; y: number; brk: boolean; }

export interface BallEnt {
  state: 'held' | 'air' | 'loose';
  x: number; y: number; z: number;
  sx: number; sy: number;
  tx: number; ty: number;
  t: number; T: number; h: number;
  spin: number;
  wrId: number;
}

export interface UIButton {
  id: string; x: number; y: number; w: number; h: number;
  label: string; sub?: string; color: string; cb: () => void; big?: boolean;
}

interface BannerLine { txt: string; col: string; size: number; }
interface Banner {
  lines: BannerLine[];
  t: number; dur: number; needTap: boolean;
  onDone: (() => void) | null;
  dim: number;
}

export interface KickState {
  kind: KickKind;
  sub: 'choose' | 'sweep' | 'runup' | 'flight' | 'result';
  t: number; arrow: number; dir: number;
  acc: number; good: boolean; doink: boolean;
  ballT: number;
  points: number;
  distance: number;
  window: number;
  startY: number;
  endY: number;
  returnSpot: number;
  returnToPlayer?: boolean;
  kickerSide?: 'off' | 'def';
  targetX?: number;
  returnLane?: -1 | 0 | 1;
}
```

## engine.ts — setupPlay

```typescript
  setupPlay(convFrom?: number) {
    const c = this.cfg;
    this.players = [];
    this.resetPlayState();
    const los = convFrom !== undefined ? convFrom : this.los;
    if (convFrom !== undefined) { this.los = convFrom; this.ltg = FIELD_LENGTH; this.down = 1; }

    let id = 0;
    const oT = this.offTeam();
    const dT = this.defTeam();
    const offSpeed = (this.mods.turbo ? 1.18 : 1) * this.ratingMul(oT.off);
    const defBoost = (this.mods.blitz ? 1.2 : 1) * this.ratingMul(dT.def);
    this.shell = this.callShell();
    this.shellRevealT = 0;

    const qb = this.mk(id++, 'off', 'qb', 0, 0, los - 5);
    qb.speed = 6.5 * offSpeed;
    qb.isQB = true;
    this.qbId = qb.id;
    this.players.push(qb);
    for (let i = -1; i <= 1; i++) {
      const ol = this.mk(id++, 'off', 'ol', 0, i * 2.6, los - 0.4);
      ol.speed = 5.2;
      this.players.push(ol);
    }
    const xs = slotXs(c.wr);
    const play = this.seasonPlays[Math.min(this.seasonPlayIdx, this.seasonPlays.length - 1)];
    xs.forEach((sx, i) => {
      const isRB = c.wr === 5 && i === 4;
      const pxx = isRB ? 7 : sx;
      const pyy = isRB ? los - 6.5 : los - 0.2;
      const wr = this.mk(id++, 'off', 'wr', i + 1, pxx, pyy);
      wr.speed = (6.8 + Math.random() * 0.5) * offSpeed;
      const rname = play?.routes[i] ?? (isRB ? 'flat' : pick(ROUTE_NAMES));
      wr.route = buildRoute(rname, pxx, los);
      wr.state = 'route';
      this.players.push(wr);
    });

    const extraRush = this.shell === 'blitz' ? 1 : 0;
    const dlCount = c.dl + extraRush;
    const dlXs = dlCount === 1 ? [0] : dlCount === 2 ? [-3.4, 3.4] : [-4.6, 0, 4.6];
    for (let i = 0; i < dlCount; i++) {
      const dl = this.mk(id++, 'def', 'dl', 0, dlXs[i] ?? 0, los + 1.9);
      dl.speed = (c.practice ? 5.0 : 5.8) * defBoost;
      dl.chaseSpeed = (c.practice ? 5.4 : 6.6) * defBoost;
      dl.move = pick(['speed', 'bull', 'inside']);
      dl.shedAt = rand(0.9, 2.0) * (this.mods.blitz ? 0.65 : 1) * (c.practice ? 1.7 : 1) * (dl.move === 'bull' ? 1.25 : 1);
      dl.role = 'rush';
      this.players.push(dl);
    }

    const wrs = this.players.filter((p) => p.kind === 'wr');
    const dbCount = Math.max(1, c.db - extraRush);
    const byOutside = [...wrs].sort((a, b) => Math.abs(b.x) - Math.abs(a.x));
    for (let i = 0; i < dbCount; i++) {
      const db = this.mk(id++, 'def', 'db', 0, 0, los + 2);
      const hips = c.practice ? rand(0.8, 0.92) : rand(0.95, 1.06);
      db.speed = 7.3 * hips * defBoost * (c.practice ? 0.88 : 1);
      db.chaseSpeed = (c.practice ? 5.6 : 7.5) * defBoost;
      db.state = 'cover';
      this.players.push(db);

      const assignMan = (idx: number) => {
        const t = byOutside[idx % byOutside.length];
        db.assignment = t.id;
        db.role = 'man';
        db.press = Math.random() < (this.shell === 'man' ? 0.6 : 0.25);
        db.cover = db.press ? 'press' : 'backpedal';
        // shade him toward the sideline so help lives inside
        db.leverage = t.x >= 0 ? 1 : -1;
        db.t = 0;
        db.x = t.x + db.leverage * 0.5;
        db.y = los + (db.press ? 1.2 : rand(4.5, 6.5));
      };
      if (this.shell === 'man' || this.shell === 'blitz') assignMan(i);
      else if (this.shell === 'cover2') {
        if (i < 2) { db.role = 'deep'; db.cover = 'zone'; db.zx = i === 0 ? -13 : 13; db.zy = los + 22; db.x = db.zx * 0.75; db.y = los + 11; db.speed *= 1.02; }
        else if (i < 4) { db.role = 'zone'; db.cover = 'zone'; db.zx = i === 2 ? -11 : 11; db.zy = los + 7; db.x = db.zx; db.y = los + 4; }
        else assignMan(i - 4);
      } else {
        if (i < 3) { db.role = 'deep'; db.cover = 'zone'; db.zx = i === 0 ? -17 : i === 1 ? 0 : 17; db.zy = los + 20; db.x = db.zx * 0.8; db.y = los + 10; }
        else if (i < 5) { db.role = 'zone'; db.cover = 'zone'; db.zx = i === 3 ? -9 : 9; db.zy = los + 8; db.x = db.zx; db.y = los + 5; }
        else { db.role = 'zone'; db.cover = 'zone'; db.zx = 0; db.zy = los + 6; db.x = 0; db.y = los + 6; }
      }
      db.x = clamp(db.x, -FIELD_HALF_W + 1, FIELD_HALF_W - 1);
    }

    if (!c.practice) {
      const lead = Math.max(0, this.scoreUs - this.scoreThem);
      const rb = 1 + Math.min(0.1, lead * 0.004) + (this.half - 1) * 0.03;
      for (const p of this.players) if (p.side === 'def') { p.speed *= rb; p.chaseSpeed *= Math.min(rb, 1.08); }
    }

    this.ball.state = 'held';
    this.ball.x = 0; this.ball.y = los; this.ball.z = 1;
    this.play = 'qb';
    this.playT = 0;
    this.cam.ty = this.clampCamY(los + 4);
    this.cam.tx = 0;
    this.cam.tzoom = 1;
  }
```

## engine.ts — selectRun

```typescript
  selectRun() {
    if (this.phase !== 'presnap' || this.cfg.drill || this.cpuOffense) return;
    this.runSelected = true;
    this.setTicker('RUN SELECTED - SNAP TO HAND OFF');
    audio.uiHover();
  }
```

## engine.ts — handoff

```typescript
  private handoff() {
    const backs = this.players.filter(p => p.side === 'off' && p.kind === 'wr');
    const back = backs[backs.length - 1];
    if (!back) return;
    const qb = this.players[this.qbId];
    if (qb) { back.x = qb.x + 2; back.y = qb.y; }
    back.route = []; back.ri = 0; back.state = 'idle';
    this.runPlayActive = true;
    this.becomeCarrier(back);
    this.ball.state = 'held';
    this.ball.x = back.x; this.ball.y = back.y; this.ball.z = 1;
    this.setTicker('HANDOFF');
  }
```

## engine.ts — changeSeasonPlay

```typescript
  changeSeasonPlay(dir: number) {
    this.runSelected = false;
    this.syncSeasonPlaybook();
    this.seasonPlayIdx = (this.seasonPlayIdx + dir + this.seasonPlays.length) % this.seasonPlays.length;
    this.seasonPlayName = this.seasonPlays[this.seasonPlayIdx].name;
    audio.uiHover();

    // Update routes visually on the field
    const play = this.seasonPlays[this.seasonPlayIdx];
    const wrs = this.players.filter(p => p.kind === 'wr');
    wrs.forEach((wr, i) => {
      const isRB = this.cfg.wr === 5 && i === 4;
      const rname = play?.routes[i] ?? (isRB ? 'flat' : 'go');
      wr.route = buildRoute(rname, wr.x, this.los);
    });
  }
```

## engine.ts — handleDown

```typescript
  private handleDown(e: PointerEvent) {
    audio.ensure();
    if (this.paused || this.destroyed) return;
    const [bx, by] = this.toBuf(e.clientX, e.clientY);
    for (const b of this.ui) {
      if (bx >= b.x && bx <= b.x + b.w && by >= b.y && by <= b.y + b.h) { audio.uiClick(); b.cb(); return; }
    }
    if (this.phase === 'banner') { if (this.banner && this.banner.t > 0.5) this.bannerDone(); return; }
    if (this.phase === 'kick' && this.kick.kind === 'kickoff') {
      if (this.kick.sub === 'choose') this.launchKickoff();
      return;
    }
    if (this.phase === 'kick') { this.kickStop(); return; }
    if (this.cpuOffense && (this.phase === 'presnap' || this.phase === 'play')) {
      if (e.pointerType !== 'mouse') {
        const [wx, wy] = this.toWorld(e.clientX, e.clientY);
        this.joy.active = true; this.joy.id = e.pointerId;
        this.joy.bx = wx; this.joy.by = wy; this.joy.dx = 0; this.joy.dy = 0;
      }
      return;
    }
    if (this.phase === 'presnap' && this.cfg.drill) { this.snap(); return; }
    // auto-snap: pulling back to aim auto-snaps the ball (like Retro Bowl)
    if (this.phase === 'presnap' && !this.cfg.drill) {
      this.snap();
      // now fall through into the qb aim code below
    }
    if (this.phase !== 'play') return;

    const [wx, wy] = this.toWorld(e.clientX, e.clientY);
    if (this.cfg.drill) { if (e.button === 0) this.drillAction(0); return; }

    if (this.play === 'qb') {
      if (e.button === 2) { this.startScramble(); return; }
      const [pbx, pby] = this.toBuf(e.clientX, e.clientY);
      this.aim.active = true;
      this.aim.ox = pbx;   // press origin in SCREEN (buffer) pixels
      this.aim.oy = pby;
      this.aim.dx = 0;
      this.aim.dy = 0;
      this.aim.power = 0;
      this.aim.valid = false;
      this.aim.wrId = -1;
      this.aimPid = e.pointerId;
    } else if (this.play === 'run') {
      if (e.pointerType === 'mouse') return;
      this.joy.active = true;
      this.joy.id = e.pointerId;
      this.joy.bx = wx; this.joy.by = wy;
      this.joy.dx = 0; this.joy.dy = 0;
    }
  }
```

## engine.ts — handleKey

```typescript
  private handleKey(e: KeyboardEvent, down: boolean) {
    const raw = e.key.toLowerCase();
    const k = raw === ' ' ? 'space' : raw;
    if (down && (['space', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k) || (k === 'tab' && !this.paused && (this.phase === 'play' || this.phase === 'presnap')))) e.preventDefault();
    this.keys[k] = down;
    this.sprinting = !!this.keys['shift'];
    if (!down || this.destroyed) return;

    const p2Playing = this.cfg.drill && this.twoP;
    if (k === 'm') { audio.setMuted(!audio.muted); return; }
    if (k === 'escape' || (k === 'p' && !p2Playing)) { this.setPaused(!this.paused); return; }
    if (this.paused) return;
    audio.ensure();

    if (k === 'tab' && this.cpuOffense && (this.phase === 'play' || this.phase === 'presnap')) { this.switchDefender(); return; }

    if (this.phase === 'banner' && (k === 'space' || k === 'enter')) {
      if (this.banner && this.banner.t > 0.5) this.bannerDone();
      return;
    }
    if (this.phase === 'fourth') {
      if (k === 'enter' || k === 'g') this.fourthGo();
      else if (k === 'p') this.punt();
      else if (k === 'f') this.tryFieldGoal();
      return;
    }
    if (this.phase === 'presnap') {
      if (this.cpuOffense) return;
      if (this.cfg.drill) {
        const wr = this.players.find((p) => p.kind === 'wr');
        if (wr && wr.ctrl) {
          if (wr.pad === 0 && (k === 'a' || k === 'd' || k === 'arrowleft' || k === 'arrowright')) {
            this.changeDrillRoute(k === 'a' || k === 'arrowleft' ? -1 : 1);
            return;
          }
          if (wr.pad === 1 && (k === 'j' || k === 'l')) {
            this.changeDrillRoute(k === 'j' ? -1 : 1);
            return;
          }
        }
      } else {
        if (k === 'r') { this.selectRun(); return; }
        if (k === 'q' || k === '[') { this.changeSeasonPlay(-1); return; }
        if (k === 'e' || k === ']') { this.changeSeasonPlay(1); return; }
      }
      if (k === 'space' || k === 'enter') { this.snap(); return; }
      return;
    }
    if (this.phase === 'kick') {
      if (this.kick.kind === 'kickoff') {
        if (this.kick.sub !== 'choose') return;
        if (k === '1' || k === 'a' || k === 'arrowleft') this.selectKickoffLane(-1);
        else if (k === '2' || k === 's' || k === 'arrowdown') this.selectKickoffLane(0);
        else if (k === '3' || k === 'd' || k === 'arrowright') this.selectKickoffLane(1);
        else if (k === 'space' || k === 'enter' || k === 'k') this.launchKickoff();
        return;
      }
      if (k === 'space' || k === 'k' || k === 'enter') this.kickStop();
      return;
    }
    if (this.phase === 'conv') { this.pickConv(k); return; }
    if (this.phase !== 'play') return;

    if (this.cfg.drill) {
      if (k === 'f' || k === 'space') this.drillAction(0);
      else if (k === 'p' && this.twoP) this.drillAction(1);
      else if (k === 'r' && !this.twoP) this.endRep('whistle');
      return;
    }
    if (this.play === 'qb' && !this.cpuOffense) {
      const n = parseInt(k, 10);
      if (n >= 1 && n <= 6) { this.throwToSlot(n); return; }
      if (k === 'space' || k === 'e') { this.startScramble(); return; }
    }
    if (k === 'r' && this.cfg.practice) {
      const focus = this.carrier() ?? this.players[this.qbId];
      this.endX = focus.x; this.endY = focus.y;
      this.play = 'dead';
      this.result = 'whistle';
      this.deadT = 0.5;
      audio.whistle(0.2);
    }
  }
```

## engine.ts — snap

```typescript
  snap() {
    if (this.phase !== 'presnap') return;
    audio.ensure();
    audio.hut(2);
    audio.snap();
    this.phase = 'play';
    this.play = 'qb';
    this.playT = 0;
    this.shellRevealT = 1.2;
    this.trauma = Math.min(1, this.trauma + 0.1);
    for (const p of this.players) {
      p.reactT = 0;
      p.playBall = false;
      p.estX = 0; p.estY = 0; p.estMag = 0;
      if (p.kind === 'dl') p.state = 'rush';
      if (p.kind === 'db' && p.press) {
        const wr = p.assignment >= 0 ? this.players[p.assignment] : null;
        if (wr && dist(p.x, p.y, wr.x, wr.y) < 2.2) wr.jam = 0.25;
      }
    }
    this.setTicker(this.cfg.drill ? `REP ${this.rep + 1} OF ${this.cfg.reps}` : this.downAndDist());
    if (!this.cfg.drill && this.runSelected) { this.handoff(); this.runSelected = false; }
  }
```

## engine.ts — throwToSlot

```typescript
  throwToSlot(n: number) {
    if (this.play !== 'qb' || this.cfg.drill) return;

    const wr = this.players.find((p) => p.kind === 'wr' && p.slot === n);
    const qb = this.players[this.qbId];
    if (!wr || !qb) return;

    let flight = this.flightTime(dist(qb.x, qb.y, wr.x, wr.y));
    let target = { x: wr.x, y: wr.y };

    // Recalculate the target as both the ball and receiver travel.
    for (let i = 0; i < 6; i++) {
      target = this.predictRoutePosition(wr, flight);
      flight = this.flightTime(dist(qb.x, qb.y, target.x, target.y));
    }

    this.aim.power = 0.78;
    this.throwAt(target.x, target.y, wr, true);
  }
```

## engine.ts — becomeCarrier

```typescript
  becomeCarrier(p: PlayerEnt, fromCatch = false) {
    const prev = this.carrier();
    if (prev) prev.isCarrier = false;
    this.carrierId = p.id;
    p.isCarrier = true;
    if (!this.cfg.drill && !this.cpuOffense && p.side === 'off') {
      const pad: 0 | 1 = this.cfg.id === 'two2' ? this.cur2P : 0;
      p.ctrl = true;
      p.pad = pad;
      if (pad === 0) { this.ctrlId = p.id; this.ctrlId2 = -1; }
      else this.ctrlId2 = p.id;
    }
    if (fromCatch) {
      p.anim = 'catch'; p.animT = 0; p.armT = 0.25;
      p.burst = 0;
      // clamp receiver speed to a proper carrier pace — no more rockets
      p.speed = Math.min(p.speed, 7.6);  // carrier pace, not route-running pace
      p.vx *= 0.25; p.vy *= 0.25;  // hard kill on route momentum
    }
    this.play = 'run';
    this.breaksLeft = 2;
    for (const d of this.players) {
      if (d.side === 'def') { d.state = 'chase'; d.assignment = -1; }
      else if (d.kind === 'wr' && d.id !== p.id) d.state = 'block';
    }
  }
```

## engine.ts — frameKickCamera

```typescript
  private frameKickCamera(startY: number, endY: number) {
    const span = Math.max(8, Math.abs(endY - startY));
    const sideMargin = this.landscape ? 72 : 40;

    this.cam.tzoom = clamp(
      (this.vw - sideMargin * 2) / (span * this.S),
      0.62,
      1.08,
    );

    // Center the kick's start and finish in the downfield screen direction.
    const screenOffset = (0.5 - this.camBias) * this.vw;
    this.cam.ty =
      (startY + endY) / 2 - screenOffset / (this.S * this.cam.tzoom);

    this.cam.tx = 0;
    this.cam.x = 0;
    this.cam.y = this.cam.ty;
    this.cam.zoom = this.cam.tzoom;
  }
```

## engine.ts — beginKickoffSequence

```typescript
  private beginKickoffSequence(returnToPlayer: boolean) {
    // Each team kicks from its own 35 toward the receiving team's 5.
    const startY = returnToPlayer ? FIELD_LENGTH - 35 : 35;
    const endY = returnToPlayer ? 5 : FIELD_LENGTH - 5;
    const kickerSide = returnToPlayer ? 'def' : 'off';
    const cpuLane = returnToPlayer ? pick([-1, 0, 1]) : 0;

    this.kick = {
      kind: 'kickoff', sub: 'choose', t: 0, arrow: 0.5, dir: 1,
      acc: 0, good: true, doink: false, ballT: 0, points: 0,
      distance: Math.abs(endY - startY), window: 0, startY, endY,
      returnSpot: endY, returnToPlayer,
      kickerSide,
      targetX: cpuLane * 14, returnLane: 0,
    };
    if (returnToPlayer) {
      this.cpuOffense = false;
      this.cpuKickReturn = false;
      // Build the actual return play before the ball is kicked. Preserve zoom.
      const zoom = this.cam.zoom, targetZoom = this.cam.tzoom;
      this.los = endY;
      this.ltg = Math.min(FIELD_LENGTH, endY + 10);
      this.down = 1;
      this.convPlay = false;
      this.setupPlay();
      this.cam.zoom = zoom;
      this.cam.tzoom = targetZoom;
      this.positionKickReturn(this.kick.targetX ?? 0, this.kick.returnLane ?? 0);
    }
    this.kickReturnActive = false;
    this.phase = 'kick';
    this.play = 'dead';
    const initialOffset = (0.45 - this.camBias) * this.vw / (this.S * this.cam.zoom);
    this.cam.x = 0;
    this.cam.tx = 0;
    this.cam.ty = startY - initialOffset;
    this.cam.y = this.cam.ty;
    this.setTicker(returnToPlayer
      ? 'OPPONENT KICKOFF - PICK A RETURN LANE'
      : 'KICKOFF - PICK A TARGET');
  }
```

## engine.ts — selectKickoffLane

```typescript
  selectKickoffLane(lane: number) {
    const k = this.kick;
    if (this.phase !== 'kick' || k.kind !== 'kickoff' || k.sub !== 'choose') return;
    const selected: -1 | 0 | 1 = lane < 0 ? -1 : lane > 0 ? 1 : 0;
    if (k.returnToPlayer) {
      k.returnLane = selected;
      this.positionKickReturn(k.targetX ?? 0, selected);
    } else k.targetX = selected * 14;
    audio.uiHover();
  }
```

## engine.ts — launchKickoff

```typescript
  launchKickoff() {
    const k = this.kick;
    if (this.phase !== 'kick' || k.kind !== 'kickoff' || k.sub !== 'choose') return;
    k.sub = 'runup';
    k.t = 0;
    k.ballT = 0;
    this.setTicker(k.returnToPlayer ? 'OPPONENT KICKOFF' : 'KICKOFF');
  }
```

## engine.ts — beginReceivedPunt

```typescript
  private beginReceivedPunt(returnSpot = 35) {
    const offenseDirection = -1;
    const startY = this.los - 15 * offenseDirection;

    this.kick = {
      kind: 'punt',
      sub: 'flight',
      t: 0,
      arrow: 0.5,
      dir: 1,
      acc: 0,
      good: true,
      doink: false,
      ballT: 0,
      points: 0,
      distance: Math.abs(startY - returnSpot),
      window: 0,
      startY,
      endY: returnSpot,
      returnSpot,
      returnToPlayer: true,
      kickerSide: 'def',
    };

    this.phase = 'kick';
    this.play = 'dead';
    this.positionPuntFormation('def', this.los, startY, returnSpot);
    this.frameKickCamera(startY, returnSpot);
    this.setTicker('OPPONENT PUNT - GET READY TO RETURN');
  }
```

## engine.ts — positionKickReturn

```typescript
  private positionKickReturn(targetX: number, returnLane: -1 | 0 | 1) {
    const returner = this.players.find((p) => p.side === 'off' && p.kind === 'wr');
    if (!returner) return;
    const catchX = clamp(targetX, -FIELD_HALF_W + 2, FIELD_HALF_W - 2);
    const laneX = clamp(returnLane * 14, -FIELD_HALF_W + 2, FIELD_HALF_W - 2);
    const blockers = this.players.filter((p) => p.side === 'off' && p !== returner && p.kind !== 'qb');
    const defenders = this.players.filter((p) => p.side === 'def');
    for (const p of this.players) {
      if (p.side === 'off') {
        if (p.kind === 'qb') {
          p.x = 0; p.y = Math.max(0, this.los - 8); p.state = 'idle';
        } else if (p === returner) {
          p.x = catchX; p.y = this.los; p.state = 'idle';
        } else {
          const i = blockers.indexOf(p);
          const blend = (i + 1) / (blockers.length + 1);
          const offset = (i % 3 - 1) * 2.5;
          p.x = clamp(catchX + (laneX - catchX) * blend + offset, -FIELD_HALF_W + 1, FIELD_HALF_W - 1);
          p.y = this.los + 3 + Math.floor(i / 3) * 2;
          p.route = []; p.ri = 0; p.state = 'block';
        }
      } else {
        const i = defenders.indexOf(p);
        const spread = (i - (defenders.length - 1) / 2) * 5.5;
        p.x = clamp(laneX + spread, -FIELD_HALF_W + 1, FIELD_HALF_W - 1);
        p.y = this.los + 12 + (i % 2) * 3.5;
        p.assignment = -1; p.role = 'rush'; p.state = 'chase';
      }
      p.vx = 0; p.vy = 0;
    }
    returner.x = catchX; returner.y = this.los;
    returner.vx = 0; returner.vy = 0;
    returner.route = []; returner.ri = 0;
  }
```

## engine.ts — switchDefender

```typescript
  switchDefender(nearest = false) {
    if (!this.cpuOffense) return;
    const defenders = this.players.filter(p => p.side === 'def' && p.state !== 'down' && p.state !== 'tackled');
    if (!defenders.length) return;
    const focus = this.carrier() ?? this.players[this.qbId];
    if (nearest && focus) defenders.sort((a, b) => dist(a.x, a.y, focus.x, focus.y) - dist(b.x, b.y, focus.x, focus.y));
    const index = nearest ? 0 : (defenders.findIndex(p => p.id === this.ctrlId) + 1) % defenders.length;
    for (const p of this.players) if (p.side === 'def') p.ctrl = false;
    const selected = defenders[index];
    selected.ctrl = true; selected.pad = 0;
    this.ctrlId = selected.id; this.ctrlId2 = -1;
  }
```

## engine.ts — beginCpuKickReturn

```typescript
  private beginCpuKickReturn(landingY: number) {
    this.cpuOffense = true;
    this.cpuKickReturn = true;
    this.los = landingY;
    this.ltg = Math.max(0, landingY - 10);
    this.down = 1;
    this.setupPlay();
    const returner = this.players.find(p => p.side === 'off' && p.kind === 'wr');
    if (!returner) { this.beginCpuPossession(FIELD_LENGTH - landingY); return; }
    const catchX = clamp(this.kick.targetX ?? 0, -FIELD_HALF_W + 2, FIELD_HALF_W - 2);
    const blockers = this.players.filter(p => p.side === 'off' && p !== returner && p.kind !== 'qb');
    const defenders = this.players.filter(p => p.side === 'def');
    for (const p of this.players) {
      p.ctrl = false; p.vx = 0; p.vy = 0;
      if (p === returner) { p.x = catchX; p.y = landingY; p.route = []; p.state = 'idle'; }
      else if (p.side === 'off' && p.kind === 'qb') { p.x = 0; p.y = Math.min(FIELD_LENGTH, landingY + 8); p.state = 'idle'; }
      else if (p.side === 'off') {
        const i = blockers.indexOf(p);
        p.x = clamp(catchX * 0.4 + (i - (blockers.length - 1) / 2) * 4, -24, 24);
        p.y = landingY - 3 - Math.floor(i / 3) * 2;
        p.route = []; p.state = 'block';
      } else {
        const i = defenders.indexOf(p);
        p.x = clamp((i - (defenders.length - 1) / 2) * 5.5, -24, 24);
        p.y = landingY - 12 - (i % 2) * 3.5;
        p.role = 'rush'; p.state = 'chase'; p.assignment = -1;
      }
    }
    this.kickReturnActive = true;
    this.becomeCarrier(returner);
    returner.ctrl = false;
    this.switchDefender(true);
    this.ball.state = 'held'; this.ball.x = returner.x; this.ball.y = returner.y; this.ball.z = 1;
    this.phase = 'play'; this.play = 'run'; this.playT = 0; this.deadT = 0;
    this.cam.tx = returner.x; this.cam.ty = returner.y - 8;
    this.setTicker('COVER THE KICK - TAB SWITCH DEFENDER');
  }
```

## engine.ts — beginCpuPossession

```typescript
  private beginCpuPossession(spot: number) {
    this.cpuOffense = true;
    this.cpuKickReturn = false;
    this.kickReturnActive = false;
    this.convPlay = false;
    this.los = clamp(spot, 0.5, FIELD_LENGTH - 0.8);
    this.ltg = Math.min(FIELD_LENGTH, this.los + 10);
    this.down = 1;
    this.startCpuSnap();
  }
```

## engine.ts — startCpuSnap

```typescript
  private startCpuSnap() {
    this.runSelected = false;
    this.setupPlay();
    this.switchDefender(true);
    this.phase = 'presnap'; this.presnapT = 0;
    this.setTicker('DEFEND - TAB SWITCH DEFENDER');
  }
```

## engine.ts — updateCpuOffense

```typescript
  private updateCpuOffense() {
    if (this.phase === 'presnap' && this.presnapT >= 1.2) {
      const yardsToGo = Math.max(1, this.ltg - this.los);
      const runChance = clamp(0.42 + (yardsToGo <= 2 ? 0.18 : 0) - (this.down === 3 && yardsToGo >= 8 ? 0.16 : 0), 0.22, 0.68);
      this.runSelected = this.cfg.canScramble && Math.random() < runChance;
      this.snap();
    } else if (this.phase === 'play' && this.play === 'qb' && this.playT >= 1.5) {
      const receivers = this.players.filter(p => p.side === 'off' && p.kind === 'wr');
      if (receivers.length) {
        receivers.sort((a, b) => {
          const nearest = (wr: PlayerEnt) => Math.min(...this.players.filter(p => p.side === 'def').map(p => dist(wr.x, wr.y, p.x, p.y)));
          return nearest(b) - nearest(a);
        });
        this.throwToSlot(receivers[0].slot);
      }
    }
  }
```

## engine.ts — beginKickReturn

```typescript
  private beginKickReturn(returnSpot: number, targetX = 0, returnLane: -1 | 0 | 1 = 0) {
    if (this.kick.kind !== 'kickoff') {
      this.los = clamp(Math.round(returnSpot), 2, FIELD_LENGTH - 2);
      this.ltg = Math.min(FIELD_LENGTH, this.los + 10);
      this.down = 1;
      this.convPlay = false;
      this.setupPlay();
      this.positionKickReturn(targetX, returnLane);
    }
    const returner = this.players.find((p) => p.side === 'off' && p.kind === 'wr');
    if (!returner) {
      this.phase = 'presnap';
      this.presnapT = 0;
      return;
    }
    returner.speed = Math.min(7.5, Math.max(6.8, returner.speed));
    returner.ctrl = true; returner.pad = 0;
    this.ctrlId = returner.id; this.ctrlId2 = -1;
    this.kickReturnActive = true;
    this.becomeCarrier(returner);
    returner.anim = 'catch'; returner.animT = 0; returner.armT = 0.25;
    this.ball.state = 'held'; this.ball.x = returner.x; this.ball.y = returner.y;
    this.ball.z = 1; this.ball.wrId = -1;
    this.phase = 'play'; this.play = 'run'; this.playT = 0; this.deadT = 0;
    this.result = 'none';
    this.cam.tx = returner.x; this.cam.ty = returner.y + 8;
    this.setTicker('KICK RETURN - WASD / ARROWS TO RUN');
    audio.setCrowd(0.75);
  }
```

## engine.ts — positionPuntFormation

```typescript
  private positionPuntFormation(kickingSide: 'off' | 'def', line: number, punterY: number, landingY: number) {
    const kickers = this.players.filter(p => p.side === kickingSide);
    const receivers = this.players.filter(p => p.side !== kickingSide);
    const punter = kickers.find(p => p.kind === 'qb') ?? kickers[0];
    const gunners = kickers.filter(p => p !== punter && (p.kind === 'wr' || p.kind === 'db')).slice(0, 2);
    const blockers = kickers.filter(p => p !== punter && !gunners.includes(p));
    const returner = receivers.find(p => p.kind === 'wr' || p.kind === 'db');
    for (const p of this.players) { p.ctrl = false; p.vx = 0; p.vy = 0; }
    if (punter) { punter.x = 0; punter.y = punterY; }
    gunners.forEach((p, i) => { p.x = i === 0 ? -FIELD_HALF_W + 2 : FIELD_HALF_W - 2; p.y = line; });
    blockers.forEach((p, i) => { p.x = clamp((i - (blockers.length - 1) / 2) * 4, -20, 20); p.y = line; });
    receivers.forEach((p, i) => {
      if (p === returner) { p.x = 0; p.y = landingY; }
      else { p.x = clamp((i - (receivers.length - 1) / 2) * 5, -24, 24); p.y = line + (kickingSide === 'off' ? 3 : -3); }
    });
  }
```

## engine.ts — beginPunt

```typescript
  private beginPunt() {
    const startY = this.los - 15;
    const endY = Math.min(FIELD_LENGTH + ENDZONE_DEPTH, this.los + 41);

    this.kick = {
      kind: 'punt',
      sub: 'sweep',
      t: 0,
      arrow: 0,
      dir: 1,
      acc: 0,
      good: false,
      doink: false,
      ballT: 0,
      points: 0,
      distance: 41,
      window: 0.2,
      startY,
      endY,
      returnSpot: 0,
      returnToPlayer: false,
      kickerSide: 'off',
    };

    this.phase = 'kick';
    this.positionPuntFormation('off', this.los, startY, endY);
    this.frameKickCamera(startY, endY);
    this.setTicker('PUNT');
    audio.throwWhoosh();
    audio.setCrowd(1.2);
  }
```

## engine.ts — punt

```typescript
  punt() {
    audio.uiClick();
    this.beginPunt();
  }
```

## engine.ts — finishPunt

```typescript
  private finishPunt() {
    const k = this.kick;
    const touchback = k.endY >= FIELD_LENGTH;
    const spot = touchback ? FIELD_LENGTH - 20 : k.endY;
    const returnYards = touchback
      ? 0
      : Math.round(rand(0, 12) * (1 - k.acc * 0.35));
    const fieldLeft = Math.max(2, FIELD_LENGTH - spot - returnYards);

    this.showBanner([
      { txt: 'PUNT', col: '#4dd8ff', size: 12 },
      {
        txt: touchback
          ? 'TOUCHBACK'
          : `PUNT ${Math.round(k.distance)} YDS / RETURN ${returnYards} YDS`,
        col: '#eaffea',
        size: 8,
      },
    ], 1.6, false, () => {
      if (this.cfg.cpuSim) {
        this.beginCpuPossession(fieldLeft);
      } else {
        this.nextPossession(false, true);
      }
    });
  }
```

## engine.ts — beginKick

```typescript
  beginKick(points: number, kind: KickKind = 'xp', distance = 20, window = 0.17) {
    const startY =
      kind === 'fg'
        ? Math.max(8, FIELD_LENGTH - (distance - 17))
        : FIELD_LENGTH - 8;
    const endY = FIELD_LENGTH + ENDZONE_DEPTH;

    this.kick = {
      kind,
      sub: 'sweep',
      t: 0,
      arrow: 0,
      dir: 1,
      acc: 0,
      good: false,
      doink: false,
      ballT: 0,
      points,
      distance,
      window,
      startY,
      endY,
      returnSpot: 0,
      returnToPlayer: false,
      kickerSide: 'off',
    };

    this.phase = 'kick';

    const targetY = endY;
    const visibleYards = this.vw / this.S;
    const sideMargin = Math.max(1, (visibleYards - (targetY - startY)) / 2);

    this.cam.ty = this.clampCamY(
      startY + (this.camBias * this.vw) / this.S - sideMargin,
    );
    this.cam.tx = 0;
    this.cam.tzoom = 1;
    audio.setCrowd(1.4);
  }
```

## engine.ts — kickStop

```typescript
  kickStop() {
    const k = this.kick;
    if (k.sub !== 'sweep') return;
    k.acc = Math.abs(k.arrow - 0.5) * 2;
    k.good = k.acc <= k.window;
    k.doink = false;

    if (k.kind === 'punt') {
      k.distance = clamp(34 + (1 - k.acc) * 14, 30, 49);
      k.endY = Math.min(FIELD_LENGTH + ENDZONE_DEPTH, this.los + k.distance);
      this.positionPuntFormation('off', this.los, k.startY, k.endY);
      this.frameKickCamera(k.startY, k.endY);
    } else if (!k.good && k.acc <= k.window * 2.1) {
      k.good = Math.random() < 0.45;
      k.doink = !k.good && Math.random() < 0.45;
    }
    k.sub = 'runup';
    k.t = 0;
    audio.whistle(0.12);
  }
```

## engine.ts — loop

```typescript
  private loop = (t: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (dt > 0.25) dt = 0.25;
    if (this.paused) { this.render(); return; }
    if (this.freezeT > 0) { this.freezeT -= dt; this.render(); return; }
    if (this.slowT > 0) { this.slowT -= dt; this.slowScale = lerp(this.slowScale, 0.35, Math.min(1, dt * 10)); }
    else this.slowScale = lerp(this.slowScale, 1, Math.min(1, dt * 6));
    this.acc += dt * this.slowScale;
    const step = 1 / 60;
    let n = 0;
    while (this.acc >= step && n < 5) { this.stepSim(step); this.acc -= step; n++; }
    this.render();
  };
```

## engine.ts — stepSim

```typescript
  private stepSim(dt: number) {
    this.time += dt;
    this.fx.update(dt);
    this.trauma = Math.max(0, this.trauma - dt * 2.4);
    this.flashA = Math.max(0, this.flashA - dt * 3.2);
    this.shellRevealT = Math.max(0, this.shellRevealT - dt);
    const camLerp = this.play === 'air' ? 6.5 : 5.2;
    this.cam.x = lerp(this.cam.x, this.clampCamX(this.cam.tx), Math.min(1, dt * 4.5));
    const cameraY = this.phase === 'kick' ? this.cam.ty : this.clampCamY(this.cam.ty);
    this.cam.y = lerp(this.cam.y, cameraY, Math.min(1, dt * camLerp));
    this.cam.zoom = lerp(this.cam.zoom, this.cam.tzoom, Math.min(1, dt * 4));
    this.tickerX -= dt * 46;
    if (this.tickerX < -2400) this.tickerX = 0;

    // If we are remote, we don't run physics. We just apply the state we got.
    if (this.isRemote && this.remoteState) {
      this.applyRemoteState();
      return;
    }

    this.updateTackleAnim(dt);

    if (this.phase === 'banner') {
      const b = this.banner;
      if (b) { b.t += dt; if (!b.needTap && b.t >= b.dur) this.bannerDone(); }
      this.updatePlayerAnim(dt);
      return;
    }
    if (this.phase === 'over' || this.phase === 'conv' || this.phase === 'fourth') { this.updatePlayerAnim(dt); return; }
    if (this.phase === 'presnap') {
      this.presnapT += dt;
      if (this.cpuOffense) this.updateCpuOffense();
      this.updatePlayerAnim(dt);
      for (const p of this.players) p.runPhase += dt * 2;
      this.cam.tx = 0;
      this.cam.ty = this.los + 10;
      if (this.cfg.clocked) this.tickClock(dt * 0.3);
      return;
    }
    if (this.phase === 'kick') { this.updateKick(dt); return; }
    if (this.phase === 'play') {
      if (this.cpuOffense) this.updateCpuOffense();
      this.updatePlay(dt);
    }
  }
```

## engine.ts — updatePlay

```typescript
  private updatePlay(dt: number) {
    this.playT += dt;
    this.qbThrowT = Math.max(0, this.qbThrowT - dt);
    const qb = this.players[this.qbId];

    this.updateStamina(dt);
    for (const p of this.players) {
      p.stun = Math.max(0, p.stun - dt);
      p.jam = Math.max(0, p.jam - dt);
      p.jukeCd = Math.max(0, p.jukeCd - dt);
      p.diveT = Math.max(0, p.diveT - dt);
      p.stumble = Math.max(0, p.stumble - dt);
      p.burst = Math.max(0, p.burst - dt);
      p.gambleCd = Math.max(0, p.gambleCd - dt);
      p.armT = Math.max(0, p.armT - dt);
      if (p.state === 'down' || p.state === 'whiff') {
        p.downT -= dt;
        if (p.downT <= 0) p.state = p.side === 'def' ? 'chase' : 'idle';
      }
    }
    if (this.cfg.clocked) this.tickClock(dt);

    // ---- AI quarterback (drill) ----
    if (this.cfg.drill && this.play === 'qb') {
      this.aiThrowT += dt;
      const wr = this.players.find((p) => p.kind === 'wr');
      this.steer(qb, 0, Math.max(this.los - 9, qb.y - 2), 3, dt, 4);
      if (wr) {
        const isAi = !wr.ctrl;
        const autoThrow = isAi && this.aiThrowT >= this.aiHold;
        const humanThrow = wr.ctrl && this.forceDrillThrow;
        const timeoutThrow = wr.ctrl && this.aiThrowT >= 4.0; // avoid holding forever

        if (autoThrow || humanThrow || timeoutThrow) {
          this.forceDrillThrow = false;
          const sol = this.solveLead(qb, wr, 0);
          this.aim.power = rand(0.5, 0.9);
          // throw directly to the lead spot if the human called it, add variance for AI
          const errX = isAi ? rand(-1.2, 1.2) : 0;
          const errY = isAi ? rand(-1.0, 1.4) : 0;
          this.throwAt(sol.x + errX, sol.y + errY, wr);
        }
      }
    }

    // ---- ball ----
    if (this.ball.state === 'air') {
      const b = this.ball;
      b.t += dt;
      const k = Math.min(1, b.t / b.T);
      b.x = lerp(b.sx, b.tx, k);
      b.y = lerp(b.sy, b.ty, k);
      b.z = 1.4 + b.h * 4 * k * (1 - k);
      b.spin += dt * 16;
      this.cam.tx = b.tx * 0.9;
      this.cam.ty = lerp(b.sy, b.ty, k) + 2;
      const wr = b.wrId >= 0 ? this.players[b.wrId] : null;
      if (wr && !wr.ctrl && (wr.state === 'seek' || wr.state === 'route')) {
        // For a number-key pass, leave the receiver on his assigned route.
        // The normal offense update below advances that route.
        if (wr.id !== this.routePassId || wr.state !== 'route') {
          const urgency = 1.0 + 0.5 * k;
          this.steer(wr, b.tx, b.ty, wr.speed * urgency, dt, 10 + k * 6);
        }

        if (b.T - b.t < 0.35) {
          wr.anim = 'catch';
          wr.armT = 0.3;
        }
      }
      for (const p of this.players) {
        if (p.side === 'def' && p.playBall && p.stun <= 0 && p.state !== 'down' && !p.ctrl) {
          if (b.T - b.t < 0.3) { p.anim = 'catch'; p.armT = 0.25; }
        }
      }
      if (b.t >= b.T) { this.resolveCatch(); return; }
    }

    // ---- offense ----
    for (const p of this.players) {
      if (p.side !== 'off' || p.stun > 0 || p.state === 'down' || p.state === 'tackled' || p.ctrl) continue;
      if (p.kind === 'wr') {
        if (p.isCarrier) { /* moved once in the carrier section below */ }
        else if (p.state === 'route') this.runRoute(p, dt);
        else if (p.state === 'seek' && this.ball.state !== 'air') p.state = 'block';
        else if (p.state === 'block') this.runBlock(p, dt);
      } else if (p.kind === 'ol') {
        if (this.kickReturnActive) this.runBlock(p, dt);
        else this.runOL(p, dt);
      }
      else if (p.isQB && !p.isCarrier && this.play === 'qb' && !this.cfg.drill) this.pocketDrift(p, dt);
    }

    // ---- defense ----
    for (const p of this.players) {
      if (p.side !== 'def' || p.stun > 0 || p.state === 'down' || p.state === 'whiff' || p.state === 'tackling') continue;
      if (p.state === 'dive') { this.updateDive(p, dt); continue; }
      if (p.ctrl) {
        if (this.cpuOffense) this.driveEntity(p, dt, p.speed);
        continue;
      }
      if (p.kind === 'dl') this.runRusher(p, dt);
      else if (p.kind === 'db') this.runDB(p, dt);
    }

    // ---- drill control ----
    if (this.cfg.drill) {
      const me = this.ctrl();
      const me2 = this.ctrlId2 >= 0 ? this.players[this.ctrlId2] : null;
      // before the catch: free movement to run the route or cover
      // after the catch: auto-run upfield, lateral only (same as season games)
      const drillCar = this.carrier();
      for (const dp of [me, me2]) {
        if (!dp || dp.stun > 0 || dp.state === 'dive' || dp.state === 'tackling' || dp.state === 'tackled') continue;
        if (dp.isCarrier && drillCar) {
          // auto-run like Retro Bowl
          const autoSpd = 3.4;
          let lat = 0;
          if (dp.pad === 1) {
            if (this.keys['i']) lat -= 1;
            if (this.keys['k']) lat += 1;
          } else {
            if (this.keys['w'] || this.keys['arrowup']) lat -= 1;
            if (this.keys['s'] || this.keys['arrowdown']) lat += 1;
            if (this.joy.active) lat += this.joy.dx / 3.2;
          }
          lat = clamp(lat, -1, 1);
          dp.vy += (autoSpd - dp.vy) * Math.min(1, dt * 6);
          dp.vx += (lat * 3.0 - dp.vx) * Math.min(1, dt * 8);
          dp.vy = clamp(dp.vy, -1, autoSpd * 1.05);
          dp.vx = clamp(dp.vx, -6, 6);
          dp.x = clamp(dp.x + dp.vx * dt, -FIELD_HALF_W, FIELD_HALF_W);
          dp.y += dp.vy * dt;
          if (Math.hypot(dp.vx, dp.vy) > 0.6) dp.face = Math.atan2(dp.vy, dp.vx);
        } else {
          this.driveEntity(dp, dt, dp.speed * (dp.jam > 0 ? 0.55 : 1));
        }
      }
      this.aiDrill(dt);
      if (this.play === 'run') this.checkRunState();
      if (this.play !== 'air') {
        const car = this.carrier();
        const focusX = me2 && me ? (me.x + me2.x) / 2 : (me ? me.x : 0);
        this.cam.tx = clamp(focusX * 0.6, -this.camXLimit(), this.camXLimit());
        const focusY = car ? car.y + 4 : (me ? me.y + 2 : this.los + 5);
        this.cam.ty = this.clampCamY(focusY);
      }
      this.updatePlayerAnim(dt);
      if (this.play === 'dead') { this.deadT -= dt; if (this.deadT <= 0) this.nextRep(); }
      return;
    }

    const car = this.carrier();
    if (car && this.play === 'run' && car.state !== 'tackled') {
      if (car.ctrl) {
        this.driveEntity(car, dt, car.speed);
        this.cam.tx = car.x * 0.85;
        this.cam.ty = car.y + 8;
        this.checkRunState();
      } else if (this.cpuOffense) {
        this.aiCarrier(car, dt);
        this.cam.tx = car.x * 0.85;
        this.cam.ty = car.y + (this.cpuKickReturn ? -8 : 8);
        this.checkRunState();
      } else {
        const autoSpeed = 3.4;
        let lateral = 0;
        if (car.pad === 1) {
          if (this.keys['i']) lateral -= 1;
          if (this.keys['k']) lateral += 1;
        } else {
          if (this.keys['w'] || this.keys['arrowup']) lateral -= 1;
          if (this.keys['s'] || this.keys['arrowdown']) lateral += 1;
          if (this.joy.active) lateral += this.joy.dx / 3.2;
        }
        lateral = clamp(lateral, -1, 1);
        car.vy += (autoSpeed - car.vy) * Math.min(1, dt * 6);
        car.vx += (lateral * 3.0 - car.vx) * Math.min(1, dt * 8);
        car.vy = clamp(car.vy, -1, autoSpeed * 1.05);
        car.vx = clamp(car.vx, -6, 6);
        car.x = clamp(car.x + car.vx * dt, -FIELD_HALF_W, FIELD_HALF_W);
        car.y += car.vy * dt;
        if (Math.hypot(car.vx, car.vy) > 0.6) car.face = Math.atan2(car.vy, car.vx);
        this.cam.tx = car.x * 0.85;
        this.cam.ty = car.y + 8;
        this.checkRunState();
      }
    } else if (this.play === 'qb') {
      if (!this.cpuOffense) this.driveEntity(qb, dt, qb.speed * 0.8, true);
      if (!this.cpuOffense && this.cfg.canScramble && qb.y > this.los + 0.2) {
        this.qbScramble = true;
        this.becomeCarrier(qb);
        this.fx.popup(qb.x, qb.y, 'TUCK & RUN!', '#4dd8ff', 7);
      } else if (!this.cfg.canScramble && qb.y > this.los - 0.2) qb.y = this.los - 0.2;
      for (const p of this.players) {
        if (p.side !== 'def' || p.stun > 0 || p.state === 'down' || p.state === 'whiff') continue;
        if (dist(p.x, p.y, qb.x, qb.y) < 1.05) { this.sack(p, qb); return; }
      }
      this.cam.tx = qb.x * 0.4;
      this.cam.ty = this.los + 8 + Math.max(0, this.deepestWR() - this.los) * 0.32;
    }

    if (this.play === 'dead') { this.deadT -= dt; if (this.deadT <= 0) this.resolveDown(); }
    this.updatePlayerAnim(dt);
  }
```

## engine.ts — driveEntity

```typescript
  private driveEntity(p: PlayerEnt, dt: number, spd: number, pocket = false) {
    let ix = 0, iy = 0;
    if (p.pad === 1) {
      // SIDE VIEW: I/K move across the field, J/L move up/down the field
      if (this.keys['i']) ix -= 1;
      if (this.keys['k']) ix += 1;
      if (this.keys['l']) iy += 1;
      if (this.keys['j']) iy -= 1;
    } else {
      // SIDE VIEW: W/S move across the field, A/D move up/down the field
      if (this.keys['w'] || this.keys['arrowup']) ix -= 1;
      if (this.keys['s'] || this.keys['arrowdown']) ix += 1;
      if (this.keys['d'] || this.keys['arrowright']) iy += 1;
      if (this.keys['a'] || this.keys['arrowleft']) iy -= 1;
      if (this.joy.active) { ix += this.joy.dx / 3.2; iy += this.joy.dy / 3.2; }
    }
    // burst only happens on route breaks, not catch/run transitions
    spd *= p.stumble > 0 ? 0.32 : (p.burst > 0 && !p.isCarrier ? 1.12 : 1);
    spd *= this.stamMul(p);
    spd *= this.sprintingFor(p) ? 1.12 : 1;
    const il = Math.hypot(ix, iy);
    if (il > 0.01) {
      const nx = ix / Math.max(1, il), ny = iy / Math.max(1, il);
      p.vx += (nx * spd - p.vx) * Math.min(1, dt * 9);
      p.vy += (ny * spd - p.vy) * Math.min(1, dt * 9);
      if (!pocket && Math.hypot(p.vx, p.vy) > 2 && Math.random() < dt * 14) this.fx.grassBurst(p.x, p.y - 0.3, 1, 0.5);
    } else {
      p.vx *= Math.pow(0.02, dt);
      p.vy *= Math.pow(0.02, dt);
    }
    p.x = clamp(p.x + p.vx * dt, -FIELD_HALF_W, FIELD_HALF_W);
    p.y += p.vy * dt;
    if (pocket) p.y = clamp(p.y, this.los - 16, FIELD_LENGTH + 8);
    else if (p.isCarrier) p.y = clamp(p.y, 0, FIELD_LENGTH + 8);
    if (Math.hypot(p.vx, p.vy) > 0.6) p.face = Math.atan2(p.vy, p.vx);
  }
```

## engine.ts — checkRunState

```typescript
  private checkRunState() {
    const car = this.carrier();
    if (!car || car.state === 'tackled') return;
    const gain = car.y - this.los;
    if (!this.cpuOffense && gain > this.stats.longest) this.stats.longest = Math.floor(gain);
    if (this.cpuKickReturn ? car.y <= 0 : car.y >= FIELD_LENGTH) { this.onTouchdown(car); return; }
    if (Math.abs(car.x) >= FIELD_HALF_W - 0.15) {
      car.x = clamp(car.x, -FIELD_HALF_W, FIELD_HALF_W);
      if (this.cfg.drill) { this.endRep('oob'); return; }
      this.endPlay('oob', car.x, car.y);
      return;
    }
    if (this.cfg.drill) {
      // a committed dive brings the carrier down, OR running directly into them
      for (const p of this.players) {
        if (p.side !== 'def' || p.stun > 0 || p.state === 'down' || p.state === 'whiff' || p.state === 'tackling') continue;
        const d = dist(p.x, p.y, car.x, car.y);
        if (p.state === 'dive' && d < 1.35) { this.landTackle(p, car); return; }
        if (d <= p.radius + car.radius + 0.22) { this.landTackle(p, car); return; }
      }
      return;
    }
    for (const p of this.players) {
      if (p.side !== 'def' || p.stun > 0 || p.state === 'down' || p.state === 'whiff' || p.state === 'tackling') continue;
      const dd = dist(p.x, p.y, car.x, car.y);
      const tackleReach = p.radius + car.radius + 0.22;
      if (dd <= tackleReach) { this.attemptTackle(p, car); return; }
      if (dd < 2.6 && dd > tackleReach + 0.05 && p.diveT <= 0 && p.state === 'chase' && Math.random() < 0.02) {
        p.state = 'dive';
        p.diveT = 0.5;
        p.anim = 'dive';
        p.animT = 0;
        const a = Math.atan2(car.y + car.vy * 0.1 - p.y, car.x + car.vx * 0.1 - p.x);
        p.vx = Math.cos(a) * 13;
        p.vy = Math.sin(a) * 13;
        p.face = a;
      }
    }
  }
```

## engine.ts — updateDive

```typescript
  private updateDive(p: PlayerEnt, dt: number) {
    p.x = clamp(p.x + p.vx * dt, -FIELD_HALF_W, FIELD_HALF_W);
    p.y += p.vy * dt;
    p.vx *= Math.pow(0.25, dt);
    p.vy *= Math.pow(0.25, dt);
    const car = this.carrier();
    if (car && car.state !== 'tackled' && dist(p.x, p.y, car.x, car.y) <= p.radius + car.radius + 0.22) {
      if (this.cfg.drill) this.landTackle(p, car);
      else this.attemptTackle(p, car);
      return;
    }
    if (p.diveT <= 0) {
      p.state = 'whiff';
      p.downT = 0.7;
      if (this.cfg.drill && p.ctrl) {
        this.burn(p, COST.tackleMiss, true);
        this.setResult(p, 'MISSED THE TACKLE', false);
        this.fx.popup(p.x, p.y, 'MISSED!', '#ff6b6b', 7);
      }
    }
  }
```

## engine.ts — landTackle

```typescript
  private landTackle(def: PlayerEnt, car: PlayerEnt) {
    const power = clamp(Math.hypot(def.vx, def.vy) / 11, 0.5, 1.4);
    this.startTackle(def, car, power);
    this.setResult(def, 'TACKLE MADE!', true);
    const gain = Math.floor(car.y - this.los);
    this.fx.popup(car.x, car.y, gain > 0 ? `STOPPED +${gain}` : 'STOPPED', '#ff6b6b', 8);
    this.endRep('tackle');
  }
```

## engine.ts — aiCarrier

```typescript
  private aiCarrier(p: PlayerEnt, dt: number) {
    const autoSpd = 3.4;
    const direction = this.cpuKickReturn ? -1 : 1;
    let bestLat = 0;
    let bestScore = -1e9;
    for (let i = -3; i <= 3; i++) {
      const lat = i * 1.5;
      const nx = p.x + lat;
      const ny = p.y + direction * autoSpd * 0.5;
      if (Math.abs(nx) > FIELD_HALF_W - 1) continue;
      let sc = -Math.abs(lat) * 0.3;
      for (const d of this.players) {
        if (d.side !== 'def' || d.state === 'down' || d.state === 'whiff') continue;
        sc -= Math.max(0, 7 - dist(nx, ny, d.x, d.y)) * 2;
      }
      if (sc > bestScore) { bestScore = sc; bestLat = lat; }
    }
    p.vy += (direction * autoSpd - p.vy) * Math.min(1, dt * 6);
    p.vx += (bestLat * 0.8 - p.vx) * Math.min(1, dt * 7);
    p.vy = clamp(p.vy, -autoSpd * 1.05, autoSpd * 1.05);
    p.vx = clamp(p.vx, -6, 6);
    p.x = clamp(p.x + p.vx * dt, -FIELD_HALF_W, FIELD_HALF_W);
    p.y += p.vy * dt;
    if (Math.hypot(p.vx, p.vy) > 0.6) p.face = Math.atan2(p.vy, p.vx);
  }
```

## engine.ts — attemptTackle

```typescript
  private attemptTackle(def: PlayerEnt, car: PlayerEnt) {
    let help = 0;
    for (const p of this.players) {
      if (p.side !== 'def' || p.id === def.id || p.state === 'down' || p.state === 'whiff') continue;
      if (dist(p.x, p.y, car.x, car.y) < 2.4) help++;
    }
    const sprintOn = this.sprinting && car.stam > 0.05 && car.isCarrier;
    let breakChance = 0.025 + (sprintOn ? 0.07 : 0) + (def.state === 'dive' ? 0.04 : 0) - help * 0.10;
    breakChance = clamp(breakChance, 0, 0.14);
    if (this.breaksLeft <= 0) breakChance = 0;
    if (Math.random() < breakChance) {
      this.breaksLeft--;
      def.state = 'down';
      def.downT = 1.1;
      def.stun = 1.1;
      def.anim = 'fall';
      def.animT = 0;
      def.fallDir = Math.atan2(def.y - car.y, def.x - car.x);
      car.vx *= 0.7; car.vy *= 0.7;
      this.fx.tackleBurst(car.x, car.y);
      this.fx.popup(car.x, car.y, 'BROKE IT!', '#ffd94d', 8);
      this.trauma = Math.min(1, this.trauma + 0.35);
      this.freezeT = 0.05;
      this.burn(car, 0.12);
      audio.block();
      return;
    }
    const power = clamp(Math.hypot(def.vx - car.vx, def.vy - car.vy) / 10, 0.5, 1.4);
    this.startTackle(def, car, power);
    const gain = Math.floor(car.y - this.los);
    if (gain > 0) this.fx.popup(car.x, car.y, `+${gain}`, '#eaffea', 8);
    this.endPlay('tackle', car.x, car.y, 0.55);
  }
```

## engine.ts — endPlay

```typescript
  endPlay(result: DeadResult, x: number, y: number, whistleDelay = 0.4) {
    this.play = 'dead';
    this.result = result;
    this.deadT = 1.05;
    this.endX = x; this.endY = y;
    this.aim.active = false;
    this.aim.wrId = -1;
    if (result !== 'td') audio.whistle(0.3, whistleDelay);
  }
```

## engine.ts — onTouchdown

```typescript
  private onTouchdown(car: PlayerEnt) {
    const wasKickReturn = this.kickReturnActive;
    this.kickReturnActive = false;
    this.play = 'dead';
    this.result = 'td';
    this.deadT = 1.3;
    car.vx = 0; car.vy = 0;
    car.anim = pick(['celebrate', 'spike', 'dance']);
    car.animT = 0;
    car.face = Math.PI / 2; // face downfield
    this.slowT = 0.55;
    this.freezeT = 0.07;
    this.trauma = Math.min(1, this.trauma + 0.4);
    this.flashCol = this.offColor().main;
    this.flashA = 0.3;
    const cols = [this.offColor().main, '#ffffff', '#ffd94d', this.offColor().dark];
    const celebrationY = this.cpuKickReturn ? -4 : FIELD_LENGTH + 4;
    this.fx.confetti(car.x, celebrationY, 130, cols);
    this.fx.confetti(car.x - 8, celebrationY, 60, cols);
    this.fx.confetti(car.x + 8, celebrationY, 60, cols);
    audio.touchdownSting();
    audio.cheer(1.4);

    if (this.cfg.drill) { this.stats.tds++; this.endRep('td'); return; }
    const c = this.cfg;
    if (this.cpuOffense) {
      this.scoreThem += c.tdPoints + (c.conv === 'kick' ? 1 : 0);
      this.setTicker('OPPONENT TOUCHDOWN');
      this.showBanner([{ txt: 'OPPONENT TOUCHDOWN', col: '#ff6b6b', size: 13 }], 1.8, false, () => {
        this.cpuOffense = false; this.cpuKickReturn = false;
        if (this.checkClockBoundary()) return;
        if (c.specialTeams) this.beginKickoffSequence(true);
        else { this.los = 25; this.ltg = 35; this.down = 1; this.setupPlay(); this.phase = 'presnap'; this.presnapT = 0; }
      });
      return;
    }
    const pts = this.convPlay ? this.convValue : c.tdPoints;
    this.addScore(pts);
    this.stats.tds++;
    const gain = Math.floor(car.y - this.los);
    if (gain > this.stats.longest) this.stats.longest = gain;
    this.registerYards(car, wasKickReturn);
    audio.whistle(0.25, 0.5);
    this.setTicker('TOUCHDOWN!');
    if (this.convPlay) {
      this.convPlay = false;
      this.showBanner([{ txt: `+${pts}  CONVERSION!`, col: '#aaff3c', size: 13 }], 1.6, false, () => this.postScore());
      return;
    }
    this.showBanner([
      { txt: 'TOUCHDOWN!', col: this.offColor().main, size: 17 },
      { txt: `${this.offTeam().abbr}  +${pts}`, col: '#ffffff', size: 11 },
    ], 1.8, false, () => {
      if (c.conv === 'kick' || c.conv === 'play') this.phase = 'conv';
      else this.postScore();
    });
  }
```

## engine.ts — registerYards

```typescript
  private registerYards(car: PlayerEnt, wasKickReturn = false) {
    if (wasKickReturn || this.cpuOffense) return;

    const gain = car.y - this.los;
    if (this.runPlayActive || (car.isQB && this.qbScramble)) this.stats.rushYds += Math.max(0, Math.round(gain));
    else this.stats.passYds += Math.max(0, Math.round(gain));
  }
```

## engine.ts — resolveDown

```typescript
  private resolveDown() {
    const c = this.cfg;
    if (this.result === 'td') return;
    const r = this.result;
    this.result = 'none';

    if (this.kickReturnActive && this.cpuKickReturn) {
      const spot = FIELD_LENGTH - this.endY;
      this.kickReturnActive = false; this.cpuKickReturn = false;
      if (this.checkClockBoundary()) return;
      this.beginCpuPossession(spot);
      return;
    }
    if (this.kickReturnActive) {
      this.kickReturnActive = false;
      this.los = clamp(this.endY, 0.5, FIELD_LENGTH - 0.8);
      this.ltg = Math.min(FIELD_LENGTH, this.los + 10);
      this.down = 1;
      this.setTicker(`KICK RETURN - BALL AT ${Math.round(this.los)}`);

      if (this.checkClockBoundary()) return;

      this.setupPlay();
      this.phase = 'presnap';
      this.presnapT = 0;
      return;
    }

    if (r === 'tackle' || r === 'oob' || r === 'whistle') {
      const spot = Math.max(0, Math.min(FIELD_LENGTH - 0.8, this.endY));
      const car = this.carrier();
      if (car) this.registerYards(car);
      if (!this.convPlay) this.los = spot;
    }
    if (r === 'sack') this.los = Math.max(0.5, this.endY);

    if (this.convPlay) {
      this.convPlay = false;
      this.convValue = 0;
      this.showBanner(r === 'int'
        ? [{ txt: 'PICKED OFF!', col: '#ff4d5e', size: 12 }, { txt: 'NO POINTS', col: '#eaffea', size: 8 }]
        : [{ txt: 'CONVERSION FAILED', col: '#ffd94d', size: 11 }], 1.5, false, () => this.postScore());
      return;
    }
    if (r === 'int' && this.cpuOffense) {
      this.cpuOffense = false;
      this.los = clamp(FIELD_LENGTH - this.endY, 0.5, FIELD_LENGTH - 0.8);
      this.ltg = Math.min(FIELD_LENGTH, this.los + 10); this.down = 1;
      if (this.checkClockBoundary()) return;
      this.setupPlay(); this.phase = 'presnap'; this.presnapT = 0;
      this.setTicker('INTERCEPTION - YOUR BALL');
      return;
    }
    if (r === 'int') { this.onTurnover('INTERCEPTED!', '#ff4d5e', Math.max(2, FIELD_LENGTH - this.endY)); return; }

    if (c.practice) {
      this.down = 1;
      this.ltg = this.los + 10;
      if (this.los > FIELD_LENGTH - 12) { this.los = 25; this.ltg = 35; }
      this.setupPlay();
      this.phase = 'presnap';
      this.presnapT = 0;
      return;
    }
    if (r !== 'inc' && this.los >= this.ltg) {
      this.down = 1;
      this.ltg = Math.min(FIELD_LENGTH, this.los + 10);
      audio.firstDown();
      this.setTicker('1ST DOWN - MOVE THE CHAINS');
      this.flashCol = '#ffd94d';
      this.flashA = 0.12;
      if (this.checkClockBoundary()) return;
      this.nextSnap();
      return;
    }
    this.down++;
    if (this.down > 4 && this.cpuOffense) {
      this.cpuOffense = false;
      this.los = clamp(FIELD_LENGTH - this.los, 0.5, FIELD_LENGTH - 0.8);
      this.ltg = Math.min(FIELD_LENGTH, this.los + 10); this.down = 1;
      if (this.checkClockBoundary()) return;
      this.setupPlay(); this.phase = 'presnap'; this.presnapT = 0;
      this.setTicker('TURNOVER ON DOWNS - YOUR BALL');
      return;
    }
    if (this.down > 4) { this.onTurnover('TURNOVER ON DOWNS', '#ff9f3c', Math.max(2, FIELD_LENGTH - this.los)); return; }
    if (this.checkClockBoundary()) return;
    this.nextSnap();
  }
```

## engine.ts — nextSnap

```typescript
  private nextSnap() {
    if (this.cpuOffense) {
      if (this.down === 4 && this.cfg.specialTeams) {
        const opponentLos = this.los;
        const landing = clamp(FIELD_LENGTH - (opponentLos + 41), 5, FIELD_LENGTH - 5);
        this.cpuOffense = false;
        this.los = FIELD_LENGTH - opponentLos;
        this.beginReceivedPunt(landing);
      } else this.startCpuSnap();
      return;
    }
    this.setupPlay();
    this.runoffClock();
    if (this.down === 4 && this.cfg.specialTeams && !this.convPlay) {
      this.phase = 'fourth';
      this.setTicker('4TH DOWN - MAKE THE CALL');
      return;
    }
    this.phase = 'presnap';
    this.presnapT = 0;
  }
```

## engine.ts — updateKick

```typescript
  private updateKick(dt: number) {
    const k = this.kick;
    k.t += dt;

    if (k.sub === 'sweep') {
      k.arrow += k.dir * dt * (k.kind === 'fg' ? 1.25 + k.distance * 0.008 : 1.3);
      if (k.arrow > 1) { k.arrow = 1; k.dir = -1; }
      if (k.arrow < 0) { k.arrow = 0; k.dir = 1; }
      return;
    }

    if (k.sub === 'runup') {
      const runupTime = k.kind === 'kickoff' ? 0.55 : 0.7;

      if (k.t > runupTime) {
        k.sub = 'flight';
        k.t = 0;
        audio.snap();
        this.trauma = Math.min(1, this.trauma + 0.18);
      }

      return;
    }

    if (k.sub !== 'flight') return;

    const flightDuration = k.kind === 'kickoff' ? Math.max(1.9, k.distance / 31.5) : 1.15;
    k.ballT = Math.min(1, k.t / flightDuration);
    if (k.kind === 'kickoff') {
      const ballX = (k.targetX ?? 0) * k.ballT;
      const ballY = k.startY + (k.endY - k.startY) * k.ballT;
      this.cam.tx = this.clampCamX(ballX);
      const lookAhead = (0.52 - this.camBias) * this.vw / (this.S * this.cam.tzoom);
      this.cam.ty = ballY - lookAhead;
    }
    if (k.kind === 'punt') {
      const progress = clamp(k.ballT, 0, 1);
      const ballY = k.startY + (k.endY - k.startY) * progress;
      this.frameKickCamera(ballY, k.endY);
    }
    if (k.ballT < 1) return;

    if (k.kind === 'kickoff') {
      if (k.returnToPlayer) {
        this.beginKickReturn(k.endY, k.targetX ?? 0, k.returnLane ?? 0);
      } else {
        if (this.cfg.cpuSim) this.beginCpuKickReturn(k.endY);
        else this.nextPossession(true);
      }
      return;
    }

    if (k.kind === 'punt') {
      if (k.returnToPlayer) {
        this.beginKickReturn(k.returnSpot);
      } else {
        this.finishPunt();
      }
      return;
    }

    k.sub = 'result';
    k.t = 0;

    if (k.doink) audio.doink();
    if (k.good) {
      this.addScore(k.points);
      audio.kickGood();
    } else {
      audio.kickBad();
    }

    this.showBanner([
      {
        txt: k.doink ? 'OFF THE UPRIGHT!' : k.good ? "IT'S GOOD!" : 'NO GOOD...',
        col: k.good ? '#aaff3c' : '#ff6b6b',
        size: 13,
      },
      {
        txt: `${k.kind === 'fg' ? `${k.distance} YD FIELD GOAL` : 'EXTRA POINT'}  ${k.good ? `+${k.points}` : '+0'}`,
        col: '#ffffff',
        size: 8,
      },
    ], 1.6, false, () => {
      if (k.kind === 'fg') {
        if (k.good) {
          if (this.cfg.cpuSim && this.cfg.specialTeams) {
            this.beginKickoffSequence(false);
          } else {
            this.nextPossession(this.cfg.specialTeams);
          }
        } else if (this.cfg.cpuSim) {
          this.beginCpuPossession(FIELD_LENGTH - this.los);
        } else {
          this.nextPossession();
        }
      } else {
        this.postScore();
      }
    });
  }
```

## App.tsx — RunPlayButton

```tsx
function RunPlayButton({ engineRef }: { engineRef: RefObject<GameEngine | null> }) {
  const [state, setState] = useState({ visible: false, selected: false });
  useEffect(() => {
    const update = () => {
      const engine = engineRef.current;
      const visible = !!engine && !engine.paused && engine.phase === 'presnap' && !engine.cfg.drill && !engine.cpuOffense;
      const selected = !!engine?.runSelected;
      setState(previous => previous.visible === visible && previous.selected === selected ? previous : { visible, selected });
    };
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [engineRef]);
  if (!state.visible) return null;
  return (
    <button
      type="button"
      aria-pressed={state.selected}
      onClick={() => engineRef.current?.selectRun()}
      className={`pix-btn absolute left-1/2 bottom-[26%] -translate-x-1/2 px-4 py-2 text-[10px] ${state.selected ? 'bg-[#1d5c33] text-[#aaff3c]' : 'bg-[#3f3312] text-[#ffd94d]'}`}
    >
      RUN [R]
    </button>
  );
}
```

## App.tsx — game canvas and Run button

```tsx
          <div className="relative">
            <canvas ref={canvasRef} className="game-canvas block" style={{ touchAction: 'none' }} />
            <RunPlayButton engineRef={engineRef} />
          </div>
```

## render.ts — renderAll

```typescript
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

  if (e.phase === 'kick') {
    drawKickScene(e, ctx, px, S);
  } else {
    drawEntities(e, ctx, px, S);
    drawBall(e, ctx, px, S);
    e.fx.render(ctx, px, S);
    drawAim(e, ctx, px, S);
  }
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
```

## render.ts — drawBall

```typescript
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
```

## render.ts — drawKickerSprite

```typescript
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
```

## render.ts — drawKickoffScene

```typescript
function drawKickoffScene(
  e: GameEngine,
  ctx: CanvasRenderingContext2D,
  px: Proj,
  S: number,
) {
  const k = e.kick;
  const kickSide: 'off' | 'def' = k.kickerSide === 'def' ? 'def' : 'off';
  const receiveSide: 'off' | 'def' = kickSide === 'off' ? 'def' : 'off';
  const kickerKit = kitFor(e, { side: kickSide } as PlayerEnt);
  const receiverKit = kitFor(e, { side: receiveSide } as PlayerEnt);

  const targetX = k.targetX ?? 0;
  const dir = k.endY >= k.startY ? 1 : -1;
  const t = k.sub === 'flight' ? clamp(k.ballT, 0, 1) : 0;
  const receiverLineY = k.endY - dir * 8;

  // Orange landing tracker.
  const [ringX, ringY] = px(targetX, k.endY);
  const pulse = 1 + 0.08 * Math.sin(e.time * 8);
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#ff7a1f';
  ctx.beginPath();
  ctx.ellipse(ringX, ringY + 2, 1.65 * S * pulse, 0.68 * S * pulse, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = '#ff7a1f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(ringX, ringY + 2, 1.35 * S * pulse, 0.52 * S * pulse, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // The human return formation is the same set of entities used after the catch.
  if (k.returnToPlayer) {
    drawEntities(e, ctx, px, S);
  } else {
    for (let i = -3; i <= 3; i++) {
      const [sx, sy] = px(clamp(i * 6.2, -24, 24), receiverLineY + (Math.abs(i) % 2) * 1.5);
      drawKickerSprite(ctx, sx, sy, receiverKit, 0, false);
    }
  }

  // Kicking team's coverage line.
  const coverageY = k.startY + (k.sub === 'flight' ? dir * t * 9 : 0);
  for (const wx of [-22, -16, -10, -4, 4, 10, 16, 22]) {
    const [sx, sy] = px(wx, coverageY);
    drawKickerSprite(ctx, sx, sy, kickerKit, 0, false);
  }

  // Kicker approaches the tee, then remains visible in follow-through.
  const runProg = k.sub === 'runup' ? clamp(k.t / 0.55, 0, 1) : 0;
  const kickerX = k.sub === 'runup' ? 3.5 * (1 - runProg) : 0;
  const kickerY = k.sub === 'runup'
    ? k.startY - dir * 7 * (1 - runProg)
    : k.startY;
  const [kx, ky] = px(kickerX, kickerY);
  drawKickerSprite(ctx, kx, ky, kickerKit, runProg, k.sub === 'flight');

  if (k.sub !== 'flight') {
    const [teeX, teeY] = px(0, k.startY);
    ctx.fillStyle = '#666';
    ctx.fillRect(teeX - 1.5, teeY - 5, 3, 5);
    ctx.fillStyle = '#8a4b21';
    ctx.fillRect(teeX - 3, teeY - 9, 6, 4);
    ctx.fillStyle = '#fff';
    ctx.fillRect(teeX - 1, teeY - 8, 2, 2);
  } else {
    const ballX = targetX * t;
    const ballY = k.startY + (k.endY - k.startY) * t;
    const height = Math.sin(Math.PI * t) * 10;
    const [sx, sy] = px(ballX, ballY);
    ctx.globalAlpha = Math.max(0.06, 0.3 - height * 0.018);
    ctx.fillStyle = '#04140a';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 2, 5, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(sx, sy - height * S * 0.8);
    ctx.rotate(t * 9);
    ctx.fillStyle = '#8a4b21';
    ctx.fillRect(-4.6, -2.5, 9.2, 5);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-1.8, -0.5, 3.6, 1);
    ctx.restore();
    if (!k.returnToPlayer && t > 0.70) {
      const approach = clamp((t - 0.70) / 0.30, 0, 1);
      const catcherY = receiverLineY + (k.endY - receiverLineY) * approach;
      const [cx, cy] = px(targetX, catcherY);
      drawKickerSprite(ctx, cx, cy, receiverKit, 0, false);
      text(ctx, 'RETURNER', cx, cy - 28, 6, '#ffb066');
    }
  }
  text(ctx, 'LANDING SPOT', ringX, ringY - 1.5 * S, 6, '#ffb066');

  // In narrow or portrait views, point toward the off-screen landing ring.
  const margin = 24;
  if (ringX < margin || ringX > e.vw - margin || ringY < margin || ringY > e.vh - margin) {
    const cx = e.vw / 2, cy = e.vh / 2;
    const dx = ringX - cx, dy = ringY - cy;
    const scale = Math.min((cx - margin) / Math.max(Math.abs(dx), 0.001),
      (cy - margin) / Math.max(Math.abs(dy), 0.001));
    const x = cx + dx * scale, y = cy + dy * scale;
    const angle = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = '#ff7a1f';
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-7, -7);
    ctx.lineTo(-7, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
```

## render.ts — drawKickScene

```typescript
function drawKickScene(e: GameEngine, ctx: CanvasRenderingContext2D, px: Proj, S: number) {
  const k = e.kick;
  if (k.kind === 'kickoff') {
    drawKickoffScene(e, ctx, px, S);
    return;
  }
  const startY = k.startY;
  const targetY = k.endY;
  const kit = kitFor(e, { side: k.kickerSide === 'def' ? 'def' : 'off' } as PlayerEnt);
  if (k.kind === 'punt') drawEntities(e, ctx, px, S);

  if (k.sub === 'flight' || k.sub === 'result') {
    const t = clamp(k.ballT, 0, 1);
    const lateral = k.kind === 'punt' ? 0 : (k.arrow - 0.5) * 11 * t;
    const downfield = startY + (targetY - startY) * t;
    const height = Math.sin(t * Math.PI) * 8;

    const [sx, sy] = px(lateral, downfield);

    // Ball shadow
    ctx.globalAlpha = Math.max(0.06, 0.3 - height * 0.018);
    ctx.fillStyle = '#04140a';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 2, 5, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Ball flight
    ctx.save();
    ctx.translate(sx, sy - height * S * 0.8);
    ctx.rotate(t * 8);
    ctx.fillStyle = '#8a4b21';
    ctx.fillRect(-4, -2.5, 8, 5);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-1.5, -0.5, 3, 1);
    ctx.restore();

    // Kicker follow-through
    if (k.kind !== 'punt') {
      const [kx, ky] = px(0, startY);
      drawKickerSprite(ctx, kx, ky, kit, 1, true);
    }
  } else if (k.kind !== 'punt') {
    // Ball on the tee
    const [sx, sy] = px(0, startY);
    ctx.fillStyle = '#666';
    ctx.fillRect(sx - 1.5, sy - 5, 3, 5);
    ctx.fillStyle = '#8a4b21';
    ctx.fillRect(sx - 3, sy - 9, 6, 4);
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx - 1, sy - 8, 2, 2);

    // Holder
    const [hx, hy] = px(-2, startY);
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

    // Kicker approach
    const prog = k.sub === 'runup' ? Math.min(1, k.t / 0.7) : 0;
    const [kx, ky] = px(3.5 - prog * 3.5, startY - 7 + prog * 7);
    drawKickerSprite(ctx, kx, ky, kit, prog, false);
  }

  if (k.sub === 'sweep') {
    const mw = Math.min(380, e.vw - 120);
    const mx = e.vw / 2 - mw / 2;
    const my = e.vh - 132;
    const mh = 24;

    ctx.fillStyle = 'rgba(3,14,7,0.9)';
    ctx.fillRect(mx - 10, my - 38, mw + 20, mh + 70);
    ctx.strokeStyle = '#0f3d21';
    ctx.lineWidth = 3;
    ctx.strokeRect(mx - 10, my - 38, mw + 20, mh + 70);

    ctx.fillStyle = '#ff4d5e';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#ffd94d';
    ctx.fillRect(
      mx + mw * (0.5 - k.window * 2.1),
      my,
      mw * k.window * 4.2,
      mh,
    );
    ctx.fillStyle = '#aaff3c';
    ctx.fillRect(mx + mw * (0.5 - k.window), my, mw * k.window * 2, mh);
    ctx.fillStyle = '#fff';
    ctx.fillRect(mx + k.arrow * mw - 2.5, my - 7, 5, mh + 14);

    const label =
      k.kind === 'fg'
        ? `${k.distance} YARD FIELD GOAL`
        : k.kind === 'punt' ? 'PUNT' : 'EXTRA POINT';

    text(ctx, label, e.vw / 2, my - 22, 9, '#eaffea');
    text(
      ctx,
      e.isTouch ? 'TAP TO KICK' : 'SPACE TO KICK',
      e.vw / 2,
      my + mh + 18,
      8,
      '#aaff3c',
    );
  }
}
```

## render.ts — drawButtons

```typescript
function drawButtons(e: GameEngine, ctx: CanvasRenderingContext2D) {
  const mid = e.vw / 2;
  const base = e.vh;

  if (e.phase === 'kick' && e.kick.kind === 'kickoff' && e.kick.sub === 'choose') {
    const k = e.kick;
    const selected = k.returnToPlayer ? (k.returnLane ?? 0) : Math.sign(k.targetX ?? 0);
    const gap = 8;
    const bw = (e.vw - 48 - gap * 3) / 4;
    const bh = 52;
    const x0 = 24;
    const y = base - 105;
    const lanes: { lane: -1 | 0 | 1; label: string; key: string }[] = [
      { lane: -1, label: 'LEFT', key: '1' },
      { lane: 0, label: 'MIDDLE', key: '2' },
      { lane: 1, label: 'RIGHT', key: '3' },
    ];
    lanes.forEach(({ lane, label, key }, i) => {
      const active = selected === lane;
      const b: UIButton = {
        id: `kickLane${lane}`, x: x0 + i * (bw + gap), y, w: bw, h: bh,
        label, sub: `[${key}]`, color: active ? '#ff9f3c' : '#ffd94d',
        cb: () => e.selectKickoffLane(lane),
      };
      styledButton(ctx, b, active ? '#3f2410' : '#10261a');
      e.ui.push(b);
    });
    const launch: UIButton = {
      id: 'launchKickoff', x: x0 + 3 * (bw + gap), y, w: bw, h: bh,
      label: k.returnToPlayer ? 'READY' : 'KICK', sub: '[SPACE]',
      color: '#aaff3c', cb: () => e.launchKickoff(),
    };
    styledButton(ctx, launch, '#113a1e');
    e.ui.push(launch);
    return;
  }

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

  if (e.cpuOffense && e.isTouch && (e.phase === 'presnap' || e.phase === 'play')) {
    const switchPlayer: UIButton = { id: 'switchDefender', x: e.vw - 142, y: base - 90, w: 120, h: 48, label: 'SWITCH', sub: 'DEFENDER', color: '#ffd94d', cb: () => e.switchDefender() };
    styledButton(ctx, switchPlayer, '#3f3312');
    e.ui.push(switchPlayer);
  }
  if (e.phase === 'presnap') {
    if (!e.cfg.drill && !e.cpuOffense) {
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
      const b2: UIButton = { id: 'conv2', x: mid + 8, y: base - 150, w: bw, h: 64, label: 'GO FOR 2', sub: '[G]', color: '#ffd94d', cb: () => e.beginConvPlay(FIELD_LENGTH - 3, 2) };
      styledButton(ctx, b1, '#113a1e'); styledButton(ctx, b2, '#3f3312');
      e.ui.push(b1, b2);
    } else {
      const b1: UIButton = { id: 'conv1', x: mid - bw - 8, y: base - 150, w: bw, h: 64, label: '+1 TRY', sub: 'FROM 5  [1]', color: '#aaff3c', cb: () => e.beginConvPlay(FIELD_LENGTH - 5, 1) };
      const b2: UIButton = { id: 'conv2', x: mid + 8, y: base - 150, w: bw, h: 64, label: '+2 TRY', sub: 'FROM 10  [2]', color: '#ffd94d', cb: () => e.beginConvPlay(FIELD_LENGTH - 10, 2) };
      styledButton(ctx, b1, '#113a1e'); styledButton(ctx, b2, '#3f3312');
      e.ui.push(b1, b2);
    }
  }
}
```

## render.ts — drawPlayCallPanel

```typescript
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
```

## render.ts — drawHints

```typescript
function drawHints(e: GameEngine, ctx: CanvasRenderingContext2D) {
  if (e.isTouch || e.phase === 'over' || e.phase === 'banner') return;
  let hints: string[] = [];
  if (e.phase === 'presnap') {
    hints = e.cpuOffense ? ['WASD MOVE', 'TAB SWITCH DEFENDER'] : e.cfg.drill
      ? (e.twoP ? ['SPACE SNAP', 'WASD P1', 'IJKL P2', 'ESC PAUSE'] : ['SPACE SNAP', 'WASD MOVE', 'ESC PAUSE'])
      : ['Q/E PLAY', 'R RUN', 'DRAG AUTO-SNAP', '1-6 TARGET'];
  } else if (e.phase === 'play' && e.cpuOffense) {
    hints = ['WASD MOVE', 'TAB SWITCH DEFENDER'];
  } else if (e.phase === 'play' && e.cfg.drill) {
    hints = e.twoP ? ['WASD P1', 'IJKL P2', 'F/P TACKLE'] : ['WASD MOVE', 'F TACKLE', 'R RESET'];
  } else if (e.phase === 'play' && e.play === 'qb') {
    hints = ['CLICK THROW', '1-6 QUICK PASS', 'WASD MOVE', 'RMB SCRAMBLE'];
  } else if (e.play === 'run') {
    hints = ['W/S LATERAL', 'A/D FORWARD/BACK', 'SHIFT SPRINT'];
  } else if (e.phase === 'fourth') {
    hints = ['ENTER GO', 'P PUNT', 'F FIELD GOAL'];
  } else if (e.phase === 'conv') {
    hints = e.cfg.conv === 'kick' ? ['K KICK', 'G GO FOR 2'] : ['1 ONE POINT', '2 TWO POINTS'];
  } else if (e.phase === 'kick') {
    if (e.kick.kind === 'kickoff') hints = e.kick.sub === 'choose' ? ['1/2/3 SELECT LANE', 'SPACE START'] : ['KICKOFF'];
    else if (e.kick.kind === 'punt' && e.kick.returnToPlayer) hints = ['PUNT RETURN', 'GET READY'];
    else hints = [e.kick.kind === 'punt' ? 'SPACE PUNT' : 'SPACE KICK'];
  }
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
```

## ui/Modals.tsx — controls help

```tsx
        <Row k="SPACE" v="Snap the ball / kick" />
        <Row k="R" v="Select a run before the snap" />
        <Row k="TAB" v="Switch defenders during a CPU possession" />
        <Row k="A / D" v="Move back and forward down the field" />
        <Row k="W / S" v="Move across the field (toward either sideline)" />
        <Row k="SHIFT" v="Sprint — burns gas but helps you break tackles" />
        <Row k="1 - 6" v="Instant bullet to that numbered receiver" />
        <Row k="ENTER / P / F" v="4th down: Go for it / Punt / Field goal" />
        <Row k="K / G" v="Extra point: Kick or Go for 2" />
        <Row k="ESC" v="Pause" />
        <Row k="M" v="Mute" />
```

## ui/PauseOverlay.tsx — controls help

```tsx
          SPACE SNAP * R RUN * WASD MOVE * 1-6 PASS
          <br />
          CLICK THROW * SHIFT SPRINT * SPACE JUKE
          <br />
          TAB SWITCH DEFENDER * P PUNT * F FIELD GOAL
```
