import { audio } from './audio';
import { Fx } from './fx';
import { MODES, Mods, ModeCfg, ModeId, FinalStats, DrillSide, Shell, SHELL_NAME } from './types';
import { Team, getTeam, randomOpponent } from './teams';
import { renderAll } from './render';

export const FIELD_HALF_W = 26.65;

export type Phase = 'boot' | 'presnap' | 'fourth' | 'play' | 'kick' | 'conv' | 'banner' | 'over';
export type Play = 'qb' | 'air' | 'run' | 'dead';
export type DeadResult = 'none' | 'tackle' | 'oob' | 'inc' | 'sack' | 'int' | 'td' | 'whistle' | 'breakup';
export type KickKind = 'xp' | 'fg';

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
  sub: 'sweep' | 'runup' | 'flight' | 'result';
  t: number; arrow: number; dir: number;
  acc: number; good: boolean; doink: boolean;
  ballT: number;
  points: number;
  distance: number;
  window: number;
}

/** a running tackle animation */
export interface TackleAnim {
  t: number; dur: number;
  x: number; y: number;
  defId: number; carId: number;
  dir: number;
  power: number;
}

export interface EngineCallbacks {
  onPause: (paused: boolean) => void;
  onOver: (stats: FinalStats) => void;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

interface PlayCall { name: string; routes: string[]; }

const SEASON_PLAYS_5: PlayCall[] = [
  { name: 'TRIPS FLOOD', routes: ['go', 'slant', 'post', 'out', 'flat'] },
  { name: 'DAGGER', routes: ['go', 'dig', 'post', 'flat', 'wheel'] },
  { name: 'SMASH', routes: ['corner', 'curl', 'go', 'corner', 'flat'] },
  { name: 'FOUR VERTS', routes: ['go', 'go', 'go', 'post', 'wheel'] },
  { name: 'Y-CROSS', routes: ['post', 'dig', 'go', 'comeback', 'flat'] },
  { name: 'QUICK GAME', routes: ['slant', 'out', 'post', 'curl', 'flat'] },
  { name: 'HB SCREEN', routes: ['go', 'slant', 'go', 'out', 'flat'] },
  { name: 'HB WHEEL', routes: ['post', 'curl', 'go', 'slant', 'wheel'] },
];

const SEASON_PLAYS_6: PlayCall[] = [
  { name: 'SPREAD FLOOD', routes: ['go', 'slant', 'post', 'corner', 'out', 'flat'] },
  { name: 'STICKS', routes: ['out', 'curl', 'post', 'curl', 'out', 'flat'] },
  { name: 'VERT CHOICE', routes: ['go', 'post', 'slant', 'go', 'dig', 'flat'] },
  { name: 'DOUBLE POST', routes: ['post', 'go', 'slant', 'go', 'post', 'out'] },
  { name: 'SCATTER', routes: ['corner', 'slant', 'dig', 'out', 'comeback', 'flat'] },
];

export const COST = { tackle: 0.14, tackleMiss: 0.38 };

const ROUTE_NAMES = ['go', 'post', 'corner', 'slant', 'out', 'in', 'curl', 'flat', 'comeback', 'dig', 'wheel'];

const P = (x: number, y: number, brk = false): RoutePt => ({ x, y, brk });

function buildRoute(name: string, sx: number, los: number): RoutePt[] {
  const inX = sx > 0.1 ? -1 : 1;
  const cx = (v: number) => clamp(v, -25, 25);
  switch (name) {
    case 'post': return [P(sx, los + 10, true), P(cx(sx + inX * 13), los + 33)];
    case 'corner': return [P(sx, los + 10, true), P(cx(sx - inX * 11), los + 29)];
    case 'slant': return [P(sx, los + 4.5, true), P(cx(sx + inX * 15), los + 20)];
    case 'out': return [P(sx, los + 8, true), P(cx(sx - inX * 9), los + 10)];
    case 'in': return [P(sx, los + 9, true), P(cx(sx + inX * 15), los + 11)];
    case 'curl': return [P(sx, los + 12, true), P(sx - inX * 1.5, los + 8, true), P(sx + inX * 6, los + 8)];
    case 'comeback': return [P(sx, los + 16, true), P(cx(sx - inX * 3), los + 11.5)];
    case 'dig': return [P(sx, los + 13, true), P(cx(sx + inX * 18), los + 14)];
    case 'flat': return [P(cx(sx - inX * 8), los + 2, true), P(cx(sx - inX * 12), los + 15)];
    case 'wheel': return [P(cx(sx - inX * 8), los + 2, true), P(cx(sx - inX * 10), los + 9, true), P(cx(sx - inX * 11), los + 32)];
    default: return [P(sx, los + 46)];
  }
}

function slotXs(n: number): number[] {
  if (n === 1) return [-14];
  if (n === 5) return [-22, -10.5, 22, 10.5, 7];
  return [-24, -15, -7, 7, 15, 24];
}

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  buf: HTMLCanvasElement;
  bctx: CanvasRenderingContext2D;
  cb: EngineCallbacks;

  vw = 960;
  vh = 600;
  S = 15;
  landscape = true;

  running = false;
  paused = false;
  destroyed = false;
  private raf = 0;
  private last = 0;
  private acc = 0;

  cfg: ModeCfg = MODES.arcade;
  mods: Mods = { bigHead: false, moonBall: false, turbo: false, blitz: false };
  drillSide: DrillSide = 'wr';
  twoP = false;
  wrId2 = -1;
  dbId2 = -1;

  // ---- teams ----
  team: Team = getTeam('kc');
  opp: Team = getTeam('sf');
  team2: Team = getTeam('phi');   // player 2 in 2P mode

  phase: Phase = 'boot';
  play: Play = 'dead';
  result: DeadResult = 'none';
  deadT = 0;

  players: PlayerEnt[] = [];
  ball: BallEnt = { state: 'held', x: 0, y: 0, z: 0, sx: 0, sy: 0, tx: 0, ty: 0, t: 0, T: 1, h: 6, spin: 0, wrId: -1 };
  carrierId = -1;
  qbId = -1;
  ctrlId = -1;
  ctrlId2 = -1;
  qbScramble = false;
  qbThrowT = 0;

  shell: Shell = 'man';
  shellRevealT = 0;

  los = 25;
  ltg = 35;
  down = 1;
  scoreUs = 0;
  scoreThem = 0;
  clock = 0;
  half = 1;
  possIdx = 0;
  cur2P: 0 | 1 = 0;
  p2: [number, number] = [0, 0];
  convValue = 0;
  convPlay = false;
  twoMinuteDone = false;

  rep = 0;
  drillYou = 0;
  drillOpp = 0;
  repMsg = '';
  aiThrowT = 0;
  aiHold = 1.4;
  carryStam: [number, number] = [1, 1];

  // season playbook
  seasonPlays: PlayCall[] = SEASON_PLAYS_5;
  seasonPlayIdx = 0;
  seasonPlayName = SEASON_PLAYS_5[0].name;

  // drill WR route choice
  drillRoutes = ['go', 'post', 'corner', 'slant', 'out', 'comeback', 'curl', 'dig'];
  drillRouteIdx = 0;
  forceDrillThrow = false;

  sprinting = false;
  breaksLeft = 2;

  // ---- aiming (Retro Bowl slingshot) ----
  aim = {
    active: false,     // finger/mouse is down and dragging
    ox: 0, oy: 0,      // origin (where the QB was at press)
    dx: 0, dy: 0,      // drag vector (pull-back from QB, world units)
    power: 0,           // 0..1 strength (how far they pulled)
    tx: 0, ty: 0,       // computed landing point
    wrId: -1,           // locked receiver (-1 = throw-away)
    valid: false,        // long enough to actually throw
  };
  joy = { active: false, id: -1, bx: 0, by: 0, dx: 0, dy: 0 };
  mouse = { x: 0, y: 0, inside: false, used: false };
  aimPid = -1;
  keys: Record<string, boolean> = {};

  cam = { x: 0, y: 25, tx: 0, ty: 25, zoom: 1, tzoom: 1 };
  trauma = 0;
  freezeT = 0;
  slowT = 0;
  slowScale = 1;
  flashA = 0;
  flashCol = '#ffffff';

  fx = new Fx();
  ui: UIButton[] = [];
  banner: Banner | null = null;
  kick: KickState = {
    kind: 'xp', sub: 'sweep', t: 0, arrow: 0, dir: 1, acc: 0,
    good: false, doink: false, ballT: 0, points: 1, distance: 20, window: 0.16,
  };
  tackleAnim: TackleAnim | null = null;

  time = 0;
  playT = 0;
  presnapT = 0;
  tickerMsg = '';
  tickerX = 0;
  isTouch = false;
  endX = 0;
  endY = 0;

  // --- online sync ---
  isRemote = false;       // if true, we are the guest just rendering the host's state
  remoteState: any = null;

  stats = freshStats();
  crowd: { s: number; y: number; c: number }[] = [];

  private onPointerDown = (e: PointerEvent) => this.handleDown(e);
  private onPointerMove = (e: PointerEvent) => this.handleMove(e);
  private onPointerUp = (e: PointerEvent) => this.handleUp(e);
  private onKeyDown = (e: KeyboardEvent) => this.handleKey(e, true);
  private onKeyUp = (e: KeyboardEvent) => this.handleKey(e, false);
  private onResize = () => this.resize();
  private onLeave = () => { this.mouse.inside = false; };
  private onCtx = (e: Event) => e.preventDefault();

  constructor(canvas: HTMLCanvasElement, cb: EngineCallbacks) {
    this.canvas = canvas;
    this.cb = cb;
    this.ctx = canvas.getContext('2d')!;
    this.buf = document.createElement('canvas');
    this.bctx = this.buf.getContext('2d')!;
    this.isTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0) && !finePointer();

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerleave', this.onLeave);
    canvas.addEventListener('contextmenu', this.onCtx);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
    this.resize();
    for (let i = 0; i < 460; i++) {
      this.crowd.push({ s: i % 2, y: Math.random(), c: Math.floor(Math.random() * 6) });
    }
  }

  destroy() {
    this.destroyed = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointerleave', this.onLeave);
    this.canvas.removeEventListener('contextmenu', this.onCtx);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    audio.setCrowd(0);
  }

  resize() {
    const aw = Math.max(320, window.innerWidth);
    const ah = Math.max(320, window.innerHeight);
    const landscape = aw / ah > 1.1;
    this.landscape = landscape;
    const vw = landscape ? 960 : 600;
    const vh = landscape ? 600 : 860;
    if (vw !== this.vw || vh !== this.vh || this.buf.width !== vw) {
      this.vw = vw; this.vh = vh;
      this.buf.width = vw; this.buf.height = vh;
    }
    // SIDE VIEW: downfield runs along screen X, field width along screen Y.
    // Show ~62 yards of field downfield in landscape, ~40 in portrait.
    this.S = landscape ? vw / 86 : vw / 52;

    const aspect = vw / vh;
    let w = aw;
    let h = w / aspect;
    if (h > ah) { h = ah; w = h * aspect; }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = `${Math.round(w)}px`;
    this.canvas.style.height = `${Math.round(h)}px`;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.imageSmoothingEnabled = false;
  }

  /** horizontal focus point of the camera (fraction from left) */
  get camBias() { return 0.28; }

  /** downfield yards visible to the left / right of the focus */
  camYMin() { return -12 + (this.vw * this.camBias) / this.S; }
  camYMax() { return 112 - (this.vw * (1 - this.camBias)) / this.S; }
  clampCamY(y: number) {
    const a = this.camYMin();
    const b = this.camYMax();
    return a > b ? (a + b) / 2 : clamp(y, a, b);
  }
  camXLimit() {
    const halfView = this.vh / (2 * this.S);
    return Math.max(0, FIELD_HALF_W + 2.5 - halfView);
  }
  clampCamX(x: number) {
    const l = this.camXLimit();
    return clamp(x, -l, l);
  }

  // ---------------- lifecycle ----------------

  start(mode: ModeId, mods: Mods, drillSide: DrillSide = 'wr', twoPlayer = false, teamId = 'kc', oppId?: string) {
    this.cfg = MODES[mode];
    this.mods = { ...mods };
    this.drillSide = drillSide;
    this.twoP = mode === 'one1' && twoPlayer;
    this.team = getTeam(teamId);
    this.opp = oppId ? getTeam(oppId) : randomOpponent(teamId);
    this.team2 = this.opp;
    this.stats = freshStats();
    this.stats.mode = mode;
    this.stats.drill = this.cfg.drill;
    this.stats.drillSide = drillSide;
    this.stats.teamId = this.team.id;
    this.stats.oppId = this.opp.id;
    this.scoreUs = 0;
    this.scoreThem = 0;
    this.p2 = [0, 0];
    this.cur2P = 0;
    this.possIdx = 0;
    this.half = 1;
    this.clock = this.cfg.halfLen;
    this.down = 1;
    this.los = Math.floor(rand(20, 30));
    this.ltg = this.los + 10;
    this.convValue = 0;
    this.convPlay = false;
    this.twoMinuteDone = false;
    this.banner = null;
    this.freezeT = 0;
    this.slowT = 0;
    this.trauma = 0;
    this.time = 0;
    this.rep = 0;
    this.drillYou = 0;
    this.drillOpp = 0;
    this.carryStam = [1, 1];
    this.tackleAnim = null;
    this.tickerMsg = `${this.team.city.toUpperCase()} ${this.team.name.toUpperCase()} VS ${this.opp.city.toUpperCase()} ${this.opp.name.toUpperCase()}`;
    audio.ensure();
    audio.setCrowd(0.55);
    this.paused = false;

    if (this.cfg.drill) {
      this.setupDrill();
      const l1 = drillSide === 'wr' ? 'P1 = RECEIVER' : 'P1 = DEFENDER';
      const l2 = drillSide === 'wr' ? 'P2 = DEFENDER' : 'P2 = RECEIVER';
      this.showBanner(this.twoP ? [
        { txt: 'LOCAL 1 V 1', col: '#ff9f3c', size: 14 },
        { txt: `${l1}  WASD`, col: '#0fd3c3', size: 8 },
        { txt: `${l2}  IJKL`, col: '#b06bff', size: 8 },
      ] : [
        { txt: '1 V 1 DRILL', col: '#ff9f3c', size: 15 },
        { txt: drillSide === 'wr' ? 'YOU ARE THE RECEIVER' : 'YOU ARE THE DEFENDER', col: '#eaffea', size: 9 },
        { txt: `${this.cfg.reps} REPS - AI QB THROWING`, col: '#ffd94d', size: 8 },
      ], 2.2, false, () => { this.phase = 'presnap'; this.presnapT = 0; });
    } else {
      const possession = this.cfg.drives > 0;
      const lines: BannerLine[] = [
        { txt: `${this.team.abbr}  VS  ${this.opp.abbr}`, col: this.team.c1 === '#000000' ? '#eaffea' : this.team.c1, size: 16 },
        { txt: possession ? `DRIVE 1 OF ${this.cfg.drives * 2}` : `${this.cfg.name} - YOUR BALL`, col: '#eaffea', size: 9 },
      ];
      if (!possession) lines.push({ txt: `OPP RATING ${Math.round((this.opp.off + this.opp.def) / 2)}`, col: '#ffd94d', size: 8 });
      this.setupPlay();
      this.showBanner(lines, 1.8, false, () => { this.phase = 'presnap'; this.presnapT = 0; });
    }
    this.phase = 'banner';
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  setPaused(v: boolean) {
    if (this.phase === 'over' || this.paused === v) return;
    this.paused = v;
    audio.setCrowd(v ? 0.1 : 0.55);
    this.cb.onPause(v);
  }

  quitToMenu() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    audio.setCrowd(0);
  }

  showBanner(lines: BannerLine[], dur: number, needTap: boolean, onDone: (() => void) | null, dim = 0.55) {
    this.banner = { lines, t: 0, dur, needTap, onDone, dim };
    this.phase = 'banner';
  }

  private bannerDone() {
    const b = this.banner;
    this.banner = null;
    if (b?.onDone) b.onDone();
  }

  // ---------------- team helpers ----------------

  /** the team currently on offense */
  offTeam(): Team {
    if (this.cfg.id === 'two2') return this.cur2P === 0 ? this.team : this.team2;
    return this.team;
  }
  defTeam(): Team {
    if (this.cfg.id === 'two2') return this.cur2P === 0 ? this.team2 : this.team;
    return this.opp;
  }
  /** 0.9 - 1.1 speed scalar from a rating */
  private ratingMul(r: number) { return 0.9 + ((r - 55) / 44) * 0.2; }

  // ---------------- defense call ----------------

  private callShell(): Shell {
    if (this.cfg.practice) return 'man';
    const r = Math.random();
    if (this.mods.blitz) return r < 0.45 ? 'blitz' : r < 0.75 ? 'man' : 'cover3';
    if (this.down >= 3) return r < 0.3 ? 'blitz' : r < 0.55 ? 'cover3' : r < 0.8 ? 'man' : 'cover2';
    return r < 0.12 ? 'blitz' : r < 0.42 ? 'man' : r < 0.72 ? 'cover3' : 'cover2';
  }

  // ---------------- setup ----------------

  setupPlay(convFrom?: number) {
    const c = this.cfg;
    this.players = [];
    this.resetPlayState();
    const los = convFrom !== undefined ? convFrom : this.los;
    if (convFrom !== undefined) { this.los = convFrom; this.ltg = 100; this.down = 1; }

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
      db.speed = 7.2 * hips * defBoost * (c.practice ? 0.88 : 1);
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

  setupDrill() {
    this.players = [];
    this.resetPlayState();
    this.los = 30;
    this.ltg = 100;
    this.down = 1;
    let id = 0;
    const offSpeed = this.mods.turbo ? 1.18 : 1;
    const defBoost = this.mods.blitz ? 1.15 : 1;
    const side = Math.random() < 0.5 ? -1 : 1;
    const wx = side * rand(8, 16);

    const qb = this.mk(id++, 'off', 'qb', 0, 0, this.los - 6);
    qb.speed = 5.5;
    qb.isQB = true;
    this.qbId = qb.id;
    this.players.push(qb);

    const wr = this.mk(id++, 'off', 'wr', 1, wx, this.los - 0.2);
    wr.speed = 6.8 * offSpeed;
    this.drillRouteIdx = Math.floor(Math.random() * this.drillRoutes.length);
    wr.route = buildRoute(this.drillRoutes[this.drillRouteIdx], wx, this.los);
    wr.state = 'route';
    wr.stam = this.carryStam[0];
    this.players.push(wr);

    const db = this.mk(id++, 'def', 'db', 0, wx + rand(-0.6, 0.6), this.los + 1.4);
    db.speed = 7.2 * defBoost * 1.10;
    db.chaseSpeed = 7.5 * defBoost * 1.10;
    db.assignment = wr.id;
    db.role = 'man';
    db.press = Math.random() < 0.55;
    db.cover = db.press ? 'press' : 'backpedal';
    db.leverage = wx >= 0 ? 1 : -1;
    if (!db.press) db.y = this.los + rand(4, 6.5);
    db.state = 'cover';
    db.stam = this.carryStam[1];
    this.players.push(db);

    this.wrId2 = wr.id;
    this.dbId2 = db.id;
    const p1 = this.drillSide === 'wr' ? wr : db;
    p1.ctrl = true;
    p1.pad = 0;
    this.ctrlId = p1.id;
    if (this.twoP) {
      const p2 = this.drillSide === 'wr' ? db : wr;
      p2.ctrl = true;
      p2.pad = 1;
      this.ctrlId2 = p2.id;
    } else this.ctrlId2 = -1;

    const depth = wr.route[wr.route.length - 1].y - this.los;
    this.aiHold = clamp(0.75 + depth * 0.055, 0.9, 2.5) + rand(-0.15, 0.2);
    this.aiThrowT = 0;

    this.ball.state = 'held';
    this.ball.x = 0; this.ball.y = this.los; this.ball.z = 1;
    this.play = 'qb';
    this.playT = 0;
    this.cam.tx = this.clampCamX(wx * 0.5);
    this.cam.ty = this.clampCamY(this.los + 10);
    this.cam.tzoom = 1.05;
  }

  private resetPlayState() {
    this.forceDrillThrow = false;
    this.aim.active = false;
    this.aim.wrId = -1;
    this.aim.power = 0;
    this.aimPid = -1;
    this.joy.active = false;
    this.joy.id = -1;
    this.qbThrowT = 0;
    this.result = 'none';
    this.qbScramble = false;
    this.carrierId = -1;
    this.ctrlId = -1;
    this.ctrlId2 = -1;
    this.sprinting = false;
    this.breaksLeft = 2;
    this.tackleAnim = null;
  }

  private mk(id: number, side: 'off' | 'def', kind: PlayerEnt['kind'], slot: number, x: number, y: number): PlayerEnt {
    return {
      id, side, kind, slot, x, y, vx: 0, vy: 0, speed: 8, chaseSpeed: 8.5,
      route: [], ri: 0, assignment: -1, zx: 0, zy: 0, role: 'man', press: false,
      cover: 'backpedal', leverage: 1, reactT: 0, playBall: false, estX: 0, estY: 0, estMag: 0, flipT: 0,
      state: 'idle', t: 0, shedAt: 2, move: 'speed', stun: 0, jam: 0,
      jukeCd: 0, face: side === 'off' ? Math.PI / 2 : -Math.PI / 2, lean: 0,
      runPhase: Math.random() * 6, isCarrier: false, isQB: false, openness: 9, downT: 0,
      diveT: 0, ctrl: false, pad: -1,
      mass: kind === 'ol' || kind === 'dl' ? 1.55 : 1,
      radius: kind === 'ol' || kind === 'dl' ? 0.62 : 0.54,
      stumble: 0, burst: 0,
      gambleT: 0, gambleTarget: -1, gambleCd: 0, gambleCdMax: 1,
      stam: 1, gassed: 0, drainFlash: 0,
      lastResult: '', resultGood: false, resultT: 0,
      anim: 'idle', animT: 0, fallDir: 1, armT: 0,
    };
  }

  // ---------------- physics ----------------

  private resolveCollisions(dt: number) {
    const n = this.players.length;
    for (let i = 0; i < n; i++) {
      const a = this.players[i];
      if ((a.state === 'down' || a.state === 'tackled') && !a.isCarrier) continue;
      for (let j = i + 1; j < n; j++) {
        const b = this.players[j];
        if ((b.state === 'down' || b.state === 'tackled') && !b.isCarrier) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const minD = a.radius + b.radius;
        let d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD) continue;
        let d = Math.sqrt(d2);
        if (d < 1e-4) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d = 0.01; }
        const nx = dx / d, ny = dy / d;
        const overlap = minD - d;
        const total = a.mass + b.mass;
        a.x = clamp(a.x - nx * (b.mass / total) * overlap, -FIELD_HALF_W, FIELD_HALF_W);
        a.y -= ny * (b.mass / total) * overlap;
        b.x = clamp(b.x + nx * (a.mass / total) * overlap, -FIELD_HALF_W, FIELD_HALF_W);
        b.y += ny * (a.mass / total) * overlap;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel < 0) {
          const imp = rel * 0.55;
          a.vx += nx * imp * (b.mass / total) * 2;
          a.vy += ny * imp * (b.mass / total) * 2;
          b.vx -= nx * imp * (a.mass / total) * 2;
          b.vy -= ny * imp * (a.mass / total) * 2;
          const grind = Math.pow(0.55, dt * 2.4);
          a.vx *= grind; a.vy *= grind;
          b.vx *= grind; b.vy *= grind;
          if (Math.abs(rel) > 7 && Math.random() < dt * 8) {
            this.fx.grassBurst((a.x + b.x) / 2, (a.y + b.y) / 2, 2, 0.6);
          }
        }
      }
    }
  }

  // ---------------- fatigue ----------------

  private burn(p: PlayerEnt, amount: number, big = false) {
    p.stam = clamp(p.stam - amount, 0, 1);
    if (big) {
      p.drainFlash = 0.9;
      this.fx.popup(p.x, p.y - 1, `-${Math.round(amount * 100)}% GAS`, '#ff9f3c', 6);
    }
    if (p.stam <= 0.001 && p.gassed <= 0) {
      p.gassed = 2.6;
      p.stumble = Math.max(p.stumble, 0.5);
      this.setResult(p, 'GASSED OUT!', false);
      this.fx.popup(p.x, p.y, 'GASSED!', '#ff4d5e', 8);
      audio.groan();
    }
  }

  stamMul(p: PlayerEnt): number {
    if (p.gassed > 0) return 0.55;
    return p.stam > 0.5 ? 1 : 0.62 + 0.76 * p.stam;
  }

  private updateStamina(dt: number) {
    const live = this.phase === 'play';
    for (const p of this.players) {
      p.drainFlash = Math.max(0, p.drainFlash - dt);
      if (p.resultT > 0) p.resultT -= dt;
      if (p.gassed > 0) {
        p.gassed -= dt;
        p.stam = Math.min(0.45, p.stam + dt * 0.17);
        if (p.gassed <= 0) this.setResult(p, 'CAUGHT BREATH', true);
        continue;
      }
      if (!live) { p.stam = Math.min(1, p.stam + dt * 0.5); continue; }
      const sp = Math.hypot(p.vx, p.vy);
      const sprint = this.sprintingFor(p);
      if (sp > 6.2 || sprint) {
        p.stam = clamp(p.stam - (sprint ? 0.3 : 0.105) * dt * (sp / 8.5), 0, 1);
        if (p.stam <= 0.001) this.burn(p, 0, false);
      } else if (sp < 3.4) {
        p.stam = Math.min(1, p.stam + dt * (sp < 1 ? 0.3 : 0.2));
      }
    }
  }

  private sprintingFor(p: PlayerEnt): boolean {
    if (!this.sprinting) return false;
    return p.isCarrier && p.pad <= 0 && !this.cfg.drill;
  }

  get stamina(): number {
    const car = this.carrier();
    if (car) return car.stam;
    const qb = this.qbId >= 0 ? this.players[this.qbId] : null;
    return qb ? qb.stam : 1;
  }

  // ---------------- drill + playbook actions ----------------

  private syncSeasonPlaybook() {
    this.seasonPlays = this.cfg.wr >= 6 ? SEASON_PLAYS_6 : SEASON_PLAYS_5;
    this.seasonPlayIdx = ((this.seasonPlayIdx % this.seasonPlays.length) + this.seasonPlays.length) % this.seasonPlays.length;
    this.seasonPlayName = this.seasonPlays[this.seasonPlayIdx].name;
  }

  changeSeasonPlay(dir: number) {
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

  // ---------------- drill + playbook actions ----------------

  static MIN_STAM = 0.14;

  gassedFor(pad: number): boolean {
    const me = pad === 0 ? this.players[this.ctrlId] : this.players[this.ctrlId2];
    if (!me) return false;
    return me.gassed > 0 || me.stam < GameEngine.MIN_STAM;
  }
  stamFor(pad: number): number {
    const me = pad === 0 ? this.players[this.ctrlId] : this.players[this.ctrlId2];
    return me ? me.stam : 1;
  }

  /** the contextual action available for this pad */
  actionFor(pad: number): import('./types').ActionKind {
    if (!this.cfg.drill || this.phase !== 'play') return null;
    const me = pad === 0 ? this.players[this.ctrlId] : this.players[this.ctrlId2];
    if (!me || me.side !== 'off') return null;
    if (me.stumble > 0 || me.gambleCd > 0) return null;
    if (me.gassed > 0 || me.stam < GameEngine.MIN_STAM) return null;
    if (this.play === 'qb' && this.ball.state === 'held' && !this.forceDrillThrow) return 'call_ball';
    return null;
  }

  changeDrillRoute(dir: number) {
    const wr = this.players.find((p) => p.kind === 'wr');
    if (!wr) return;
    this.drillRouteIdx = (this.drillRouteIdx + dir + this.drillRoutes.length) % this.drillRoutes.length;
    wr.route = buildRoute(this.drillRoutes[this.drillRouteIdx], wr.x, this.los);
    audio.uiHover();
  }

  drillAction(pad = 0) {
    if (!this.cfg.drill) return;
    const me = pad === 0 ? this.players[this.ctrlId] : this.players[this.ctrlId2];
    if (!me || me.side !== 'off' || me.stumble > 0 || me.gambleCd > 0) return;
    if (me.gassed > 0 || me.stam < GameEngine.MIN_STAM) {
      this.setResult(me, 'TOO GASSED', false);
      this.fx.popup(me.x, me.y, 'NO GAS!', '#ff6b6b', 7);
      return;
    }
    if (this.actionFor(pad) !== 'call_ball') return;
    this.forceDrillThrow = true;
    this.fx.popup(me.x, me.y, 'BALL!', '#ffd94d', 8);
    audio.stepBurst();
  }

  private setCd(p: PlayerEnt, v: number) { p.gambleCd = v; p.gambleCdMax = v; }
  private setResult(p: PlayerEnt, txt: string, good: boolean) {
    p.lastResult = txt; p.resultGood = good; p.resultT = 1.1;
  }

  carrier(): PlayerEnt | null { return this.carrierId >= 0 ? this.players[this.carrierId] : null; }
  ctrl(): PlayerEnt | null { return this.ctrlId >= 0 ? this.players[this.ctrlId] : null; }

  // ---------------- input ----------------

  /** screen -> world for the SIDE view */
  private toWorld(cx: number, cy: number): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    const bx = ((cx - rect.left) / rect.width) * this.vw;
    const by = ((cy - rect.top) / rect.height) * this.vh;
    const S = this.S * this.cam.zoom;
    const wy = this.cam.y + (bx - this.vw * this.camBias) / S;   // downfield
    const wx = this.cam.x + (by - this.vh / 2) / S;              // lateral
    return [wx, wy];
  }

  private toBuf(cx: number, cy: number): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    return [((cx - rect.left) / rect.width) * this.vw, ((cy - rect.top) / rect.height) * this.vh];
  }

  private handleDown(e: PointerEvent) {
    audio.ensure();
    if (this.paused || this.destroyed) return;
    const [bx, by] = this.toBuf(e.clientX, e.clientY);
    for (const b of this.ui) {
      if (bx >= b.x && bx <= b.x + b.w && by >= b.y && by <= b.y + b.h) { audio.uiClick(); b.cb(); return; }
    }
    if (this.phase === 'banner') { if (this.banner && this.banner.t > 0.5) this.bannerDone(); return; }
    if (this.phase === 'kick') { this.kickStop(); return; }
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

  /**
   * Iteratively solve where to put the ball so it and the receiver arrive
   * together. bias < 0 throws it behind him, bias > 0 leads him further.
   */
  solveLead(qb: PlayerEnt, wr: PlayerEnt, bias: number): { x: number; y: number; T: number; d: number } {
    let T = this.flightTime(dist(qb.x, qb.y, wr.x, wr.y));
    let px = wr.x, py = wr.y;
    for (let i = 0; i < 5; i++) {
      px = wr.x + wr.vx * T;
      py = wr.y + wr.vy * T;
      T = this.flightTime(dist(qb.x, qb.y, px, py));
    }
    // nudge along his heading
    const sp = Math.hypot(wr.vx, wr.vy);
    if (sp > 0.6 && bias !== 0) {
      px += (wr.vx / sp) * bias * 5.5;
      py += (wr.vy / sp) * bias * 5.5;
    }
    px = clamp(px, -FIELD_HALF_W + 0.4, FIELD_HALF_W - 0.4);
    py = clamp(py, this.los - 8, 108.5);
    return { x: px, y: py, T, d: dist(qb.x, qb.y, px, py) };
  }

  /** is a defender sitting in the throwing lane? (drives arc + risk read) */
  laneRisk(tx: number, ty: number): number {
    const qb = this.players[this.qbId];
    if (!qb) return 0;
    const dx = tx - qb.x, dy = ty - qb.y;
    const len = Math.hypot(dx, dy) || 1;
    let risk = 0;
    for (const p of this.players) {
      if (p.side !== 'def' || p.state === 'down' || p.state === 'whiff') continue;
      // perpendicular distance from the throwing line
      const t = clamp(((p.x - qb.x) * dx + (p.y - qb.y) * dy) / (len * len), 0, 1);
      const cxp = qb.x + dx * t, cyp = qb.y + dy * t;
      const off = dist(p.x, p.y, cxp, cyp);
      if (off < 2.6) risk = Math.max(risk, (1 - off / 2.6) * (0.35 + t * 0.65));
    }
    return clamp(risk, 0, 1);
  }

  /**
   * How contested this receiver will be WHEN THE BALL GETS THERE — not right
   * now. Projects the receiver and every defender forward by the flight time,
   * which is what the thrower actually needs to know.
   */
  coverageOf(wr: PlayerEnt): number {
    const qb = this.qbId >= 0 ? this.players[this.qbId] : null;
    if (!qb) return 0;
    const sol = this.solveLead(qb, wr, 0);
    let nd = 1e9;
    for (const p of this.players) {
      if (p.side !== 'def' || p.state === 'down' || p.state === 'whiff') continue;
      // where he is now, plus how far he can close in the flight time
      // simple: how far is this defender from the catch point RIGHT NOW?
      const gap = dist(p.x, p.y, sol.x, sol.y);
      nd = Math.min(nd, gap);
    }
    // 2 yards = blanketed, 6+ yards = wide open
    return clamp(1 - (nd - 1.5) / 4.0, 0, 1);
  }

  flightTime(d: number) {
    let T = clamp(0.30 + d * 0.036, 0.40, 2.0);
    if (this.mods.moonBall) T *= 1.8;
    return T;
  }

  private releaseThrow() {
    if (this.aim.valid && this.play === 'qb' && this.aim.power > 0.08) {
      const wr = this.aim.wrId >= 0 ? this.players[this.aim.wrId] : undefined;
      this.throwAt(this.aim.tx, this.aim.ty, wr);
    }
    this.aim.active = false;
    this.aim.dx = 0;
    this.aim.dy = 0;
    this.aim.power = 0;
    this.aim.wrId = -1;
    this.aimPid = -1;
  }

  /** arc multiplier: loft it over anyone sitting in the lane */
  private arcFor(tx: number, ty: number): number {
    return 1 + this.laneRisk(tx, ty) * 1.35;
  }

  private handleMove(e: PointerEvent) {
    if (this.destroyed) return;
    const [wx, wy] = this.toWorld(e.clientX, e.clientY);
    if (e.pointerType === 'mouse') {
      this.mouse.x = wx; this.mouse.y = wy;
      this.mouse.inside = true;
      this.mouse.used = true;
    }
    if (this.paused) return;
    if (this.aim.active && e.pointerId === this.aimPid) {
      // Calculate drag in SCREEN SPACE (buffer pixels) for consistent feel
      const [cbx, cby] = this.toBuf(e.clientX, e.clientY);
      // drag vector from press point to current finger position
      const sdx = cbx - this.aim.ox;  // screen-right = downfield in side view
      const sdy = cby - this.aim.oy;  // screen-down = right of field
      const slen = Math.hypot(sdx, sdy);

      this.aim.dx = sdx;
      this.aim.dy = sdy;
      // power scales from 0..1 over ~140 screen pixels of drag
      this.aim.power = clamp(slen / 140, 0, 1);
      this.aim.valid = slen > 10;

      if (slen > 8) {
        const qb = this.players[this.qbId];
        const S = this.S * this.cam.zoom;
        // Convert screen drag to world throw direction (opposite of drag)
        // In side view: screen-X = downfield (+wy), screen-Y = lateral (+wx from bottom)
        const throwDownfield = -sdx / S;        // pulling left -> throw right (downfield)
        const throwLateral   = -sdy / S;        // pulling up -> throw toward bottom of screen

        // Scale: short pull = short throw, long pull = deep throw
        const baseDist = 6 + this.aim.power * 36;
        const scale = baseDist / Math.max(0.1, Math.hypot(throwDownfield, throwLateral));
        
        const rawY = clamp(qb.y + throwDownfield * scale, this.los - 8, 109);
        const rawX = clamp(qb.x + throwLateral   * scale, -FIELD_HALF_W + 0.5, FIELD_HALF_W - 0.5);

        this.aim.tx = rawX;
        this.aim.ty = rawY;

        // Snap to the nearest receiver's lead point
        let bestId = -1;
        let bestD = 7.0;
        for (const p of this.players) {
          if (p.kind !== 'wr' || p.state === 'down') continue;
          const sol = this.solveLead(qb, p, 0);
          const d = dist(sol.x, sol.y, rawX, rawY);
          if (d < bestD) { bestD = d; bestId = p.id; }
        }
        this.aim.wrId = bestId;
        if (bestId >= 0) {
          const wr = this.players[bestId];
          const sol = this.solveLead(qb, wr, 0);
          // Pull aim toward receiver's lead point (rubber-band snap)
          const pull = clamp(1 - bestD / 7.0, 0, 1) * 0.75;
          this.aim.tx = lerp(rawX, sol.x, pull);
          this.aim.ty = lerp(rawY, sol.y, pull);
        }
      }
    }
    if (this.joy.active && e.pointerId === this.joy.id) {
      let dx = wx - this.joy.bx;
      let dy = wy - this.joy.by;
      const len = Math.hypot(dx, dy);
      const max = 3.4;
      if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
      this.joy.dx = dx; this.joy.dy = dy;
    }
  }

  private handleUp(e: PointerEvent) {
    if (this.destroyed) return;
    if (this.aim.active && e.pointerId === this.aimPid) {
      this.releaseThrow();
    }
    if (this.joy.active && e.pointerId === this.joy.id) {
      this.joy.active = false;
      this.joy.id = -1;
    }
  }

  private handleKey(e: KeyboardEvent, down: boolean) {
    const raw = e.key.toLowerCase();
    const k = raw === ' ' ? 'space' : raw;
    if (down && ['space', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    this.keys[k] = down;
    this.sprinting = !!this.keys['shift'];
    if (!down || this.destroyed) return;

    const p2Playing = this.cfg.drill && this.twoP;
    if (k === 'm') { audio.setMuted(!audio.muted); return; }
    if (k === 'escape' || (k === 'p' && !p2Playing)) { this.setPaused(!this.paused); return; }
    if (this.paused) return;
    audio.ensure();

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
        if (k === 'q' || k === '[') { this.changeSeasonPlay(-1); return; }
        if (k === 'e' || k === ']') { this.changeSeasonPlay(1); return; }
      }
      if (k === 'space' || k === 'enter') { this.snap(); return; }
      return;
    }
    if (this.phase === 'kick' && (k === 'space' || k === 'k' || k === 'enter')) { this.kickStop(); return; }
    if (this.phase === 'conv') { this.pickConv(k); return; }
    if (this.phase !== 'play') return;

    if (this.cfg.drill) {
      if (k === 'f' || k === 'space') this.drillAction(0);
      else if (k === 'p' && this.twoP) this.drillAction(1);
      else if (k === 'r' && !this.twoP) this.endRep('whistle');
      return;
    }
    if (this.play === 'qb') {
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

  // ---------------- snap / throw ----------------

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
        if (wr && dist(p.x, p.y, wr.x, wr.y) < 2.2) wr.jam = 0.38;
      }
    }
    this.setTicker(this.cfg.drill ? `REP ${this.rep + 1} OF ${this.cfg.reps}` : this.downAndDist());
  }

  throwAt(tx: number, ty: number, wr?: PlayerEnt) {
    const qb = this.players[this.qbId];
    if (!qb || this.play !== 'qb') return;
    const d = dist(qb.x, qb.y, tx, ty);
    if (d < 2) return;
    const T = this.flightTime(d);
    let target = wr ?? null;
    if (!target) {
      let best = 1e9;
      for (const p of this.players) {
        if (p.kind !== 'wr') continue;
        const dd = dist(p.x + p.vx * T, p.y + p.vy * T, tx, ty);
        if (dd < best) { best = dd; target = p; }
      }
    }
    const b = this.ball;
    b.state = 'air';
    b.sx = qb.x; b.sy = qb.y;
    b.tx = clamp(tx, -FIELD_HALF_W, FIELD_HALF_W);
    b.ty = clamp(ty, this.los - 6, 109);
    b.t = 0; b.T = T;
    // height: low power = high lob, high power = flat bullet (matches Retro Bowl feel)
    const powerMul = 1.35 - this.aim.power * 0.7;   // 1.35 (lob) → 0.65 (bullet)
    b.h = (2.8 + d * 0.12) * (this.mods.moonBall ? 1.9 : 1) * this.arcFor(tx, ty) * powerMul;
    b.x = b.sx; b.y = b.sy; b.z = 1.4;
    b.wrId = target ? target.id : -1;
    this.play = 'air';
    this.stats.attempts++;
    this.qbThrowT = 0.35;
    qb.anim = 'throw';
    qb.animT = 0;
    qb.armT = 0.3;
    this.aim.active = false;
    this.aim.wrId = b.wrId;
    audio.throwWhoosh();
    if (target) target.state = 'seek';
    // defenders need a beat to read the throw, then decide if they can get there
    for (const p of this.players) {
      if (p.side !== 'def') continue;
      p.reactT = rand(0.04, 0.14) * (this.cfg.practice ? 2.2 : 1);
      p.playBall = false;
      p.estX = 0; p.estY = 0; p.estMag = 0;
    }
  }

  throwToSlot(n: number) {
    if (this.play !== 'qb' || this.cfg.drill) return;
    const wr = this.players.find((p) => p.kind === 'wr' && p.slot === n);
    if (!wr) return;
    const qb = this.players[this.qbId];
    const sol = this.solveLead(qb, wr, 0);
    this.aim.power = 0.6;   // keyboard passes use a medium bullet
    this.throwAt(sol.x, sol.y, wr);
  }

  startScramble() {
    if (this.play !== 'qb' || !this.cfg.canScramble || this.cfg.drill) return;
    const qb = this.players[this.qbId];
    this.qbScramble = true;
    this.becomeCarrier(qb);
    audio.stepBurst();
  }

  becomeCarrier(p: PlayerEnt, fromCatch = false) {
    const prev = this.carrier();
    if (prev) prev.isCarrier = false;
    this.carrierId = p.id;
    p.isCarrier = true;
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

  // ---------------- special teams ----------------

  fgDistance(): number { return Math.round(100 - this.los + 17); }
  fgInRange(): boolean { return this.fgDistance() <= 58; }

  fourthGo() { this.phase = 'presnap'; this.presnapT = 0; this.setTicker('GOING FOR IT!'); audio.uiClick(); }

  punt() {
    audio.uiClick();
    audio.throwWhoosh();
    const net = rand(34, 48);
    let spot = this.los + net;
    let msg = `PUNT NETS ${Math.round(net)} YARDS`;
    if (spot >= 100) { spot = 80; msg = 'TOUCHBACK'; }
    const fieldLeft = Math.max(2, 100 - spot);
    this.showBanner([
      { txt: 'PUNT TEAM', col: '#4dd8ff', size: 12 },
      { txt: msg, col: '#eaffea', size: 8 },
    ], 1.6, false, () => {
      if (this.cfg.cpuSim) this.cpuDrive(false, fieldLeft);
      else this.nextPossession();
    });
  }

  tryFieldGoal() {
    if (!this.fgInRange()) return;
    audio.uiClick();
    const d = this.fgDistance();
    this.beginKick(3, 'fg', d, clamp(0.30 - (d - 20) * 0.0042, 0.075, 0.30));
  }

  pickConv(k: string) {
    const c = this.cfg;
    if (c.conv === 'kick') {
      if (k === 'k' || k === '1' || k === 'enter') this.beginKick(1, 'xp', 20, 0.17);
      else if (k === 'g' || k === '2') this.beginConvPlay(97, 2);
    } else if (c.conv === 'play') {
      if (k === '1') this.beginConvPlay(95, 1);
      else if (k === '2') this.beginConvPlay(90, 2);
    }
  }

  beginKick(points: number, kind: KickKind = 'xp', distance = 20, window = 0.17) {
    this.kick = { kind, sub: 'sweep', t: 0, arrow: 0, dir: 1, acc: 0, good: false, doink: false, ballT: 0, points, distance, window };
    this.phase = 'kick';
    this.cam.tzoom = 1.2;
    this.cam.ty = this.clampCamY(this.los + 18);
    this.cam.tx = 0;
    audio.setCrowd(1.4);
  }

  kickStop() {
    const k = this.kick;
    if (k.sub !== 'sweep') return;
    k.acc = Math.abs(k.arrow - 0.5) * 2;
    k.good = k.acc <= k.window;
    k.doink = false;
    if (!k.good && k.acc <= k.window * 2.1) { k.good = Math.random() < 0.45; k.doink = Math.random() < 0.45; }
    k.sub = 'runup';
    k.t = 0;
    audio.whistle(0.12);
  }

  beginConvPlay(fromLos: number, value: number) {
    this.convValue = value;
    this.convPlay = true;
    this.down = 1;
    this.setupPlay(fromLos);
    this.setTicker(`CONVERSION FOR ${value}`);
    this.phase = 'presnap';
    this.presnapT = 0;
  }

  // ---------------- loop ----------------

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

  private stepSim(dt: number) {
    this.time += dt;
    this.fx.update(dt);
    this.trauma = Math.max(0, this.trauma - dt * 2.4);
    this.flashA = Math.max(0, this.flashA - dt * 3.2);
    this.shellRevealT = Math.max(0, this.shellRevealT - dt);
    const camLerp = this.play === 'air' ? 6.5 : 5.2;
    this.cam.x = lerp(this.cam.x, this.clampCamX(this.cam.tx), Math.min(1, dt * 4.5));
    this.cam.y = lerp(this.cam.y, this.clampCamY(this.cam.ty), Math.min(1, dt * camLerp));
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
      this.updatePlayerAnim(dt);
      for (const p of this.players) p.runPhase += dt * 2;
      this.cam.tx = 0;
      this.cam.ty = this.los + 10;
      if (this.cfg.clocked) this.tickClock(dt * 0.3);
      return;
    }
    if (this.phase === 'kick') { this.updateKick(dt); return; }
    if (this.phase === 'play') this.updatePlay(dt);
  }

  // ---------------- tackle animation ----------------

  private startTackle(def: PlayerEnt, car: PlayerEnt, power: number) {
    const dir = Math.atan2(car.y - def.y, car.x - def.x);
    this.tackleAnim = {
      t: 0, dur: 0.95,
      x: (def.x + car.x) / 2, y: (def.y + car.y) / 2,
      defId: def.id, carId: car.id, dir, power,
    };
    def.state = 'tackling';
    def.anim = 'tackle';
    def.animT = 0;
    def.face = dir;
    car.state = 'tackled';
    car.anim = 'fall';
    car.animT = 0;
    car.fallDir = dir;
    car.vx = Math.cos(dir) * 3.5 * power;
    car.vy = Math.sin(dir) * 3.5 * power;
    def.vx = Math.cos(dir) * 2.5;
    def.vy = Math.sin(dir) * 2.5;
    this.fx.tackleBurst(car.x, car.y);
    this.fx.grassBurst(car.x, car.y, 12, 1.4 * power);
    this.freezeT = 0.085 + power * 0.03;
    this.trauma = Math.min(1, this.trauma + 0.45 + power * 0.2);
    audio.tackle();
  }

  private updateTackleAnim(dt: number) {
    const ta = this.tackleAnim;
    if (!ta) return;
    ta.t += dt;
    const def = this.players[ta.defId];
    const car = this.players[ta.carId];
    if (def && car) {
      const k = Math.min(1, ta.t / ta.dur);
      // drive through contact then settle
      const drive = k < 0.3 ? 1 - k / 0.3 : 0;
      car.x = clamp(car.x + Math.cos(ta.dir) * drive * dt * 5 * ta.power, -FIELD_HALF_W, FIELD_HALF_W);
      car.y += Math.sin(ta.dir) * drive * dt * 5 * ta.power;
      def.x = clamp(def.x + Math.cos(ta.dir) * drive * dt * 4, -FIELD_HALF_W, FIELD_HALF_W);
      def.y += Math.sin(ta.dir) * drive * dt * 4;
      car.vx *= Math.pow(0.02, dt); car.vy *= Math.pow(0.02, dt);
      def.vx *= Math.pow(0.02, dt); def.vy *= Math.pow(0.02, dt);
      if (k >= 1) {
        def.state = 'down'; def.downT = 0.6;
        car.state = 'down'; car.downT = 1.6;
      }
    }
    if (ta.t >= ta.dur) this.tackleAnim = null;
  }

  // ---------------- play sim ----------------

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
        // come back to the football — urgency ramps as it arrives
        const urgency = 1.0 + 0.5 * k;
        this.steer(wr, b.tx, b.ty, wr.speed * urgency, dt, 10 + k * 6);
        if (b.T - b.t < 0.35) { wr.anim = 'catch'; wr.armT = 0.3; }
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
        if (p.isCarrier) this.aiCarrier(p, dt);
        else if (p.state === 'route') this.runRoute(p, dt);
        else if (p.state === 'seek' && this.ball.state !== 'air') p.state = 'block';
        else if (p.state === 'block') this.runBlock(p, dt);
      } else if (p.kind === 'ol') this.runOL(p, dt);
      else if (p.isQB && !p.isCarrier && this.play === 'qb' && !this.cfg.drill) this.pocketDrift(p, dt);
    }

    // ---- defense ----
    for (const p of this.players) {
      if (p.side !== 'def' || p.stun > 0 || p.state === 'down' || p.state === 'whiff' || p.state === 'tackling') continue;
      if (p.state === 'dive') { this.updateDive(p, dt); continue; }
      if (p.ctrl) continue;
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

    // ---- carrier: Retro Bowl style auto-run ----
    // The carrier jogs upfield automatically at a steady pace.
    // The player can ONLY move laterally (W/S or up/down arrows) to dodge.
    // No forward/backward acceleration — just like Retro Bowl.
    const car = this.carrier();
    if (car && this.play === 'run' && car.state !== 'tackled') {
      const autoSpeed = 3.4;  // steady upfield jog — never rockets
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
      // auto-run forward (downfield = +y in our coord system)
      const targetVy = autoSpeed;
      const targetVx = lateral * 3.0;  // lateral dodge speed
      car.vy += (targetVy - car.vy) * Math.min(1, dt * 6);
      car.vx += (targetVx - car.vx) * Math.min(1, dt * 8);
      // hard cap so nothing bugs out
      car.vy = clamp(car.vy, -1, autoSpeed * 1.05);
      car.vx = clamp(car.vx, -6, 6);
      car.x = clamp(car.x + car.vx * dt, -FIELD_HALF_W, FIELD_HALF_W);
      car.y += car.vy * dt;
      if (Math.hypot(car.vx, car.vy) > 0.6) car.face = Math.atan2(car.vy, car.vx);
      if (Math.random() < dt * 8) this.fx.grassBurst(car.x, car.y - 0.3, 1, 0.4);
      this.cam.tx = car.x * 0.85;
      this.cam.ty = car.y + 8;
      this.checkRunState();
    } else if (this.play === 'qb') {
      this.driveEntity(qb, dt, qb.speed * 0.8, true);
      if (this.cfg.canScramble && qb.y > this.los + 0.2) {
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
    if (pocket) p.y = clamp(p.y, this.los - 16, 108);
    if (Math.hypot(p.vx, p.vy) > 0.6) p.face = Math.atan2(p.vy, p.vx);
  }

  private checkRunState() {
    const car = this.carrier();
    if (!car || car.state === 'tackled') return;
    const gain = car.y - this.los;
    if (gain > this.stats.longest) this.stats.longest = Math.floor(gain);
    if (car.y >= 100) { this.onTouchdown(car); return; }
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
        if (d < 1.05) { this.landTackle(p, car); return; }
      }
      return;
    }
    for (const p of this.players) {
      if (p.side !== 'def' || p.stun > 0 || p.state === 'down' || p.state === 'whiff' || p.state === 'tackling') continue;
      const dd = dist(p.x, p.y, car.x, car.y);
      if (dd < 1.05) { this.attemptTackle(p, car); return; }
      if (dd < 2.6 && dd > 1.1 && p.diveT <= 0 && p.state === 'chase' && Math.random() < 0.02) {
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

  private updateDive(p: PlayerEnt, dt: number) {
    p.x = clamp(p.x + p.vx * dt, -FIELD_HALF_W, FIELD_HALF_W);
    p.y += p.vy * dt;
    p.vx *= Math.pow(0.25, dt);
    p.vy *= Math.pow(0.25, dt);
    const car = this.carrier();
    if (car && car.state !== 'tackled' && dist(p.x, p.y, car.x, car.y) < 1.35) {
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

  private landTackle(def: PlayerEnt, car: PlayerEnt) {
    const power = clamp(Math.hypot(def.vx, def.vy) / 11, 0.5, 1.4);
    this.startTackle(def, car, power);
    this.setResult(def, 'TACKLE MADE!', true);
    const gain = Math.floor(car.y - this.los);
    this.fx.popup(car.x, car.y, gain > 0 ? `STOPPED +${gain}` : 'STOPPED', '#ff6b6b', 8);
    this.endRep('tackle');
  }

  private deepestWR(): number {
    let d = this.los;
    for (const p of this.players) if (p.kind === 'wr') d = Math.max(d, p.y);
    return d;
  }

  private steer(p: PlayerEnt, tx: number, ty: number, speed: number, dt: number, agility = 7) {
    speed *= this.stamMul(p);
    const dx = tx - p.x, dy = ty - p.y;
    const l = Math.hypot(dx, dy);
    if (l < 0.05) { p.vx *= 0.8; p.vy *= 0.8; return; }
    const dvx = (dx / l) * speed, dvy = (dy / l) * speed;
    const prevFace = p.face;
    p.vx += (dvx - p.vx) * Math.min(1, dt * agility);
    p.vy += (dvy - p.vy) * Math.min(1, dt * agility);
    p.x = clamp(p.x + p.vx * dt, -FIELD_HALF_W, FIELD_HALF_W);
    p.y += p.vy * dt;
    if (Math.hypot(p.vx, p.vy) > 0.6) {
      p.face = Math.atan2(p.vy, p.vx);
      let df = p.face - prevFace;
      while (df > Math.PI) df -= Math.PI * 2;
      while (df < -Math.PI) df += Math.PI * 2;
      p.lean = clamp(lerp(p.lean, clamp(df / dt / 6, -1, 1), Math.min(1, dt * 8)), -1, 1);
    } else p.lean = lerp(p.lean, 0, Math.min(1, dt * 6));
  }

  private pocketDrift(p: PlayerEnt, dt: number) {
    if (this.keys['w'] || this.keys['a'] || this.keys['s'] || this.keys['d']) { p.vx *= 0.8; p.vy *= 0.8; return; }
    this.steer(p, p.x * 0.98, Math.max(this.los - 9, p.y - 2), 2.2, dt, 4);
  }

  /** route running with real breaks: gather, plant, explode out */
  private runRoute(p: PlayerEnt, dt: number) {
    if (this.play === 'run') { p.state = 'block'; return; }
    const base = p.speed * (p.jam > 0 ? 0.5 : 1);
    if (p.ri >= p.route.length) {
      this.steer(p, p.x + p.vx * 0.3, p.y + 6, base * 0.62, dt, 4);
      return;
    }
    const wp = p.route[p.ri];
    const d = dist(p.x, p.y, wp.x, wp.y);
    const arrive = wp.brk ? 1.5 : 1.2;
    if (d < arrive) {
      p.ri++;
      if (wp.brk) {
        // plant & cut: kill momentum, burst out of the break
        p.vx *= 0.3; p.vy *= 0.3;
        p.burst = 0.45;
        p.lean = p.lean > 0 ? -1 : 1;
        this.fx.grassBurst(p.x, p.y, 5, 0.9);
        audio.stepBurst();
      }
      return;
    }
    // gather down as the break approaches, explode after it
    let spd = base;
    if (wp.brk && d < 4.5) spd = base * lerp(0.62, 1, d / 4.5);
    if (p.burst > 0) spd = base * 1.12;
    this.steer(p, wp.x, wp.y, spd, dt, wp.brk && d < 3 ? 11 : 6.5);
  }

  /** AI carrier: auto-runs upfield at a steady jog, picks a lane to avoid defenders */
  private aiCarrier(p: PlayerEnt, dt: number) {
    const autoSpd = 3.4;
    let bestLat = 0;
    let bestScore = -1e9;
    for (let i = -3; i <= 3; i++) {
      const lat = i * 1.5;
      const nx = p.x + lat;
      const ny = p.y + autoSpd * 0.5;
      if (Math.abs(nx) > FIELD_HALF_W - 1) continue;
      let sc = -Math.abs(lat) * 0.3;
      for (const d of this.players) {
        if (d.side !== 'def' || d.state === 'down' || d.state === 'whiff') continue;
        sc -= Math.max(0, 7 - dist(nx, ny, d.x, d.y)) * 2;
      }
      if (sc > bestScore) { bestScore = sc; bestLat = lat; }
    }
    p.vy += (autoSpd - p.vy) * Math.min(1, dt * 6);
    p.vx += (bestLat * 0.8 - p.vx) * Math.min(1, dt * 7);
    p.vy = clamp(p.vy, -1, autoSpd * 1.05);
    p.vx = clamp(p.vx, -6, 6);
    p.x = clamp(p.x + p.vx * dt, -FIELD_HALF_W, FIELD_HALF_W);
    p.y += p.vy * dt;
    if (Math.hypot(p.vx, p.vy) > 0.6) p.face = Math.atan2(p.vy, p.vx);
  }

  private runBlock(p: PlayerEnt, dt: number) {
    const car = this.carrier();
    if (!car) { p.state = 'idle'; p.vx *= 0.9; p.vy *= 0.9; return; }
    let near: PlayerEnt | null = null;
    let nd = 15;
    for (const d of this.players) {
      if (d.side !== 'def' || d.stun > 0 || d.state === 'down' || d.state === 'whiff') continue;
      const dd = dist(d.x, d.y, car.x, car.y);
      if (dd < nd) { nd = dd; near = d; }
    }
    if (near) {
      this.steer(p, near.x + near.vx * 0.12, near.y + near.vy * 0.12, p.speed * 0.96, dt, 7);
      if (dist(p.x, p.y, near.x, near.y) < 1.15 && near.stun <= 0) {
        near.stun = this.cfg.practice ? 1.5 : 0.8;
        near.state = 'down';
        near.downT = near.stun;
        near.anim = 'fall';
        near.animT = 0;
        near.fallDir = Math.atan2(near.y - p.y, near.x - p.x);
        p.stun = 0.35;
        this.fx.tackleBurst(near.x, near.y);
        this.trauma = Math.min(1, this.trauma + 0.16);
        audio.block();
        if (Math.random() < 0.5) { this.fx.popup(near.x, near.y, 'PANCAKE!', '#ffd94d', 7); this.stats.pancakes++; }
      }
    } else this.steer(p, car.x + (p.slot - 3) * 1.6, car.y + 7, p.speed * 0.9, dt, 5);
  }

  private runOL(p: PlayerEnt, dt: number) {
    let near: PlayerEnt | null = null;
    let nd = 3.4;
    for (const d of this.players) {
      if (d.kind !== 'dl' || d.stun > 0) continue;
      const dd = dist(p.x, p.y, d.x, d.y);
      if (dd < nd) { nd = dd; near = d; }
    }
    if (near) this.steer(p, near.x, Math.min(this.los + 1.2, near.y), 4.4, dt, 8);
    else if (this.play === 'run' && this.carrier()) this.steer(p, this.los + 3 + p.slot, p.y, 4, dt, 6);
  }

  private runRusher(p: PlayerEnt, dt: number) {
    const qb = this.players[this.qbId];
    const car = this.carrier();
    if (this.play === 'air') { this.steer(p, this.ball.tx, this.ball.ty, p.chaseSpeed * 0.8, dt, 5); return; }
    if (this.play === 'run' && car && !car.isQB) { this.pursue(p, car, dt); return; }
    if (p.t < p.shedAt && !this.qbScramble && Math.abs(p.y - this.los) < 3) {
      p.t += dt;
      let blocker: PlayerEnt | null = null;
      let bd = 2.4;
      for (const o of this.players) {
        if (o.kind !== 'ol') continue;
        const dd = dist(p.x, p.y, o.x, o.y);
        if (dd < bd) { bd = dd; blocker = o; }
      }
      if (blocker) {
        const side = p.x < 0 ? -1 : 1;
        const gx = p.move === 'speed' ? blocker.x + side * 2.6 : p.move === 'inside' ? blocker.x - side * 1.8 : blocker.x;
        this.steer(p, gx, blocker.y + 0.5, p.move === 'bull' ? 2.4 : 3.6, dt, 6);
        return;
      }
    }
    if (p.t >= p.shedAt && p.t < p.shedAt + 0.12) this.fx.puff(p.x, p.y);
    this.steer(p, qb.x + qb.vx * 0.18, qb.y + qb.vy * 0.18, p.speed, dt, 6.4);
  }

  private runDB(p: PlayerEnt, dt: number) {
    const car = this.carrier();
    if (this.play === 'run' && car) { this.pursue(p, car, dt); return; }
    if (p.role === 'rush') { this.runRusher(p, dt); return; }

    // ---- ball in the air: read it, then only break if you can actually get there ----
    if (this.play === 'air') {
      p.reactT = Math.max(0, p.reactT - dt);
      const b = this.ball;
      const timeLeft = Math.max(0.01, b.T - b.t);
      if (p.reactT <= 0 && !p.playBall && p.estX === 0 && p.estY === 0) {
        const need = dist(p.x, p.y, b.tx, b.ty) / Math.max(1, p.speed);
        p.playBall = need <= timeLeft * 1.05;
        // tracking it over his shoulder: the less margin he has, the worse he
        // plays it — and being out of position is not something he recovers from
        const margin = timeLeft - need;
        const a = Math.random() * Math.PI * 2;
        p.estX = Math.cos(a);
        p.estY = Math.sin(a);
        p.estMag = clamp(2.2 - margin * 3.8, 0.1, 2.4) * rand(0.7, 1.2);
      }
      if (p.playBall) {
        // a good read stays glued; a bad read wanders and never recovers
        const err = p.estMag * (1 + Math.min(1.2, timeLeft * 0.7));
        this.steer(p, b.tx + p.estX * err, b.ty + p.estY * err, p.speed * 0.97, dt, 7);
      } else {
        // beaten to the spot — stop chasing the ball and play the man, so he
        // arrives to tackle rather than magically contesting the catch
        const wr = b.wrId >= 0 ? this.players[b.wrId] : null;
        const tx = wr ? lerp(wr.x, b.tx, 0.18) : b.tx;
        const ty = wr ? lerp(wr.y, b.ty, 0.18) : b.ty;
        this.steer(p, tx, ty, p.speed * 0.93, dt, 5);
      }
      return;
    }

    // ---- man coverage: press -> backpedal -> hip flip -> trail ----
    if (p.role === 'man') {
      const wr = p.assignment >= 0 ? this.players[p.assignment] : null;
      if (!wr) { this.steer(p, p.zx, this.los + 9, p.speed * 0.7, dt, 5); return; }
      p.flipT = Math.max(0, p.flipT - dt);
      const gap = wr.y - p.y;              // negative = DB is downfield of WR (good)
      const wrSpeedY = wr.vy;

      if (p.cover === 'press' && (p.t > 0.45 || dist(p.x, p.y, wr.x, wr.y) > 2.4)) {
        p.cover = 'backpedal';
      }
      if (p.cover === 'press') {
        p.t += dt;
        // mirror him at the line, deny the release
        this.steer(p, wr.x + p.leverage * 0.35, this.los + 1.2, p.speed * 0.55, dt, 7);
        wr.openness = dist(p.x, p.y, wr.x, wr.y);
        return;
      }
      // flip the hips once he threatens the cushion or runs past
      if (p.cover === 'backpedal' && (gap > -1.5 || wrSpeedY > p.speed * 0.65)) {
        p.cover = 'trail';
        p.flipT = 0.22;
        this.fx.grassBurst(p.x, p.y, 3, 0.6);
      } else if (p.cover === 'trail' && gap < -4.2 && wrSpeedY < 2.2) {
        p.cover = 'backpedal';   // he sat down, regain the cushion
      }

      const backpedal = p.cover === 'backpedal';
      // backpedalling he keeps a cushion downfield; once beaten he runs in
      // TRAIL position — a step behind the receiver's hip, not in front of him
      const cushion = backpedal ? 2.0 : -0.4;
      const lead = backpedal ? 0.05 : 0.14;
      const tx = wr.x + wr.vx * lead + p.leverage * (backpedal ? 0.8 : 0.5);
      const ty = wr.y + wr.vy * lead + cushion;
      // backpedaling is slower; a receiver who wins his break stays won
      let spd = p.speed * (backpedal ? 0.84 : 0.985);
      if (p.flipT > 0) spd *= 0.72;
      const d = dist(p.x, p.y, tx, ty);
      if (d < 1.0) spd *= 0.55;
      this.steer(p, tx, ty, spd, dt, backpedal ? 6.4 : 5.4);
      // face the receiver while backpedaling
      if (backpedal) p.face = Math.atan2(wr.y - p.y, wr.x - p.x);
      wr.openness = dist(p.x, p.y, wr.x, wr.y);
      return;
    }

    // ---- zone: own your area, squeeze the most dangerous threat in it ----
    const deep = p.role === 'deep';
    const radius = deep ? 15 : 9.5;
    let threat: PlayerEnt | null = null;
    let bestT = 1e9;
    for (const w of this.players) {
      if (w.kind !== 'wr' || w.state === 'down') continue;
      const inZone = dist(w.x, w.y, p.zx, p.zy);
      if (inZone > radius) continue;
      // the deepest / closest-to-my-landmark receiver is the threat
      const rank = deep ? -w.y : inZone;
      if (rank < bestT) { bestT = rank; threat = w; }
    }
    let gx = p.zx;
    let gy = p.zy;
    if (threat) {
      gx = lerp(p.zx, threat.x, deep ? 0.55 : 0.78);
      gy = lerp(p.zy, threat.y, deep ? 0.35 : 0.6);
      // deep defenders never let anything get behind them
      if (deep) gy = Math.max(gy, threat.y + 2.2, p.zy);
      else gy = clamp(gy, this.los + 2, p.zy + 5);
    } else if (deep) {
      gy = Math.max(p.zy, this.deepestWR() + 1.5);
    }
    const spd = threat ? p.speed * (deep ? 0.98 : 0.95) : p.speed * 0.65;
    this.steer(p, gx, gy, spd, dt, 5);
    for (const w of this.players) {
      if (w.kind !== 'wr') continue;
      w.openness = Math.min(w.openness, dist(p.x, p.y, w.x, w.y));
    }
  }

  private pursue(p: PlayerEnt, car: PlayerEnt, dt: number) {
    const sp = p.chaseSpeed;
    let t = dist(p.x, p.y, car.x, car.y) / Math.max(1, sp);
    for (let i = 0; i < 3; i++) {
      t = Math.hypot(car.x + car.vx * t - p.x, car.y + car.vy * t - p.y) / Math.max(1, sp);
    }
    t = clamp(t, 0, 1.1);
    const far = dist(p.x, p.y, car.x, car.y) > 13;
    this.steer(p, clamp(car.x + car.vx * t, -FIELD_HALF_W, FIELD_HALF_W), car.y + car.vy * t, sp * (far ? 0.96 : 1.02), dt, 8);
  }

  private attemptTackle(def: PlayerEnt, car: PlayerEnt) {
    let help = 0;
    for (const p of this.players) {
      if (p.side !== 'def' || p.id === def.id || p.state === 'down' || p.state === 'whiff') continue;
      if (dist(p.x, p.y, car.x, car.y) < 2.4) help++;
    }
    const sprintOn = this.sprinting && car.stam > 0.05 && car.isCarrier;
    let breakChance = 0.1 + (sprintOn ? 0.22 : 0) + (def.state === 'dive' ? 0.2 : 0) - help * 0.12;
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

  private sack(def: PlayerEnt, qb: PlayerEnt) {
    const power = clamp(Math.hypot(def.vx, def.vy) / 9, 0.6, 1.4);
    this.startTackle(def, qb, power);
    const loss = Math.max(1, Math.round(this.los - qb.y + 1));
    this.fx.popup(qb.x, qb.y, `SACKED -${loss}`, '#ff6b6b', 8);
    this.stats.rushYds -= loss;
    this.stats.sacks++;
    this.endPlay('sack', qb.x, qb.y, 0.55);
  }

  // ---------------- catch ----------------

  private resolveCatch() {
    const b = this.ball;
    const wr = b.wrId >= 0 ? this.players[b.wrId] : null;
    const wrD = wr ? dist(wr.x, wr.y, b.tx, b.ty) : 1e9;
    let dbD = 1e9;
    let picker: PlayerEnt | null = null;
    for (const p of this.players) {
      if (p.side !== 'def' || p.stun > 0 || p.state === 'down' || p.state === 'whiff') continue;
      const dd = dist(p.x, p.y, b.tx, b.ty);
      if (dd < dbD) { dbD = dd; picker = p; }
    }
    b.state = 'loose';

    if (this.cfg.drill) {
      const inRange = wr && wrD <= 2.3;
      const dbClose = picker !== null && dbD <= 2.0;
      if (dbClose && picker) {
        const better = dbD <= wrD + 0.3;
        if (Math.random() < (better ? 0.34 : 0.1)) { this.drillInt(b, picker); return; }
        if (Math.random() < (better ? 0.55 : 0.2)) { this.drillBreakup(b, picker); return; }
      }
      if (inRange) {
        b.state = 'held';
        this.stats.completions++;
        this.stats.catches++;
        this.becomeCarrier(wr!, true);
        this.fx.catchFlash(wr!.x, wr!.y);
        this.fx.popup(wr!.x, wr!.y, 'CAUGHT!', '#aaff3c', 8);
        audio.catchPop();
        if (this.drillSide === 'wr') audio.cheer(0.9); else audio.ooh();
        return;
      }
      this.fx.popup(b.tx, b.ty, 'INCOMPLETE', '#c9d4c9', 7);
      this.fx.puff(b.tx, b.ty);
      audio.dropThud();
      this.endRep('inc');
      return;
    }

    // --- coverage-based catch outcome (matches the number badge colors) ---
    // Green badge (open, cv < 0.42): almost always caught
    // Grey badge (covered, cv >= 0.42): 70% incomplete, 20% interception, 10% caught
    const uncontestedR = 4.5;
    if (wr && wrD <= uncontestedR) {
      const cv = this.coverageOf(wr);
      const tightlyCovered = cv >= 0.50;
      const roll = Math.random();
      
      if (tightlyCovered && !this.cfg.practice) {
        // grey badge: dangerous throw
        if (roll < 0.70) {
          // incomplete
          this.fx.popup(b.tx, b.ty, 'COVERED!', '#ff6b6b', 8);
          this.fx.puff(b.tx, b.ty);
          if (picker) { picker.anim = 'catch'; picker.armT = 0.3; }
          audio.ooh();
          this.endPlay('inc', b.tx, b.ty, 0.4);
          return;
        }
        if (roll < 0.90) {
          // interception
          this.pickSix(b, picker);
          return;
        }
        // 10% contested catch — still got it
        this.fx.popup(wr.x, wr.y + 1.6, 'THROUGH CONTACT!', '#ffd94d', 7);
      }
      
      // clean catch (open receiver or the 10% contested catch)
      b.state = 'held';
      this.stats.completions++;
      this.stats.catches++;
      const diving = wrD > 2.0;
      this.becomeCarrier(wr, true);
      if (diving) { wr.anim = 'dive'; wr.animT = 0; this.fx.grassBurst(wr.x, wr.y, 9, 1.1); }
      wr.openness = 99;
      this.fx.catchFlash(wr.x, wr.y);
      this.fx.popup(wr.x, wr.y, diving ? 'WHAT A GRAB!' : 'CAUGHT!', diving ? '#4dd8ff' : '#aaff3c', diving ? 8 : 7);
      audio.catchPop();
      if (b.ty - this.los >= 20 && !tightlyCovered) { this.fx.popup(wr.x, wr.y + 1.5, 'DIME!', '#4dd8ff', 8); audio.ding(); }
      this.aim.wrId = -1;
    } else if (picker && dbD <= 1.6 && dbD < 1.0) {
      if (this.cfg.practice) {
        this.fx.popup(picker.x, picker.y, 'DROPPED PICK!', '#ffd94d', 7);
        audio.ooh();
        this.fx.puff(b.tx, b.ty);
        this.endPlay('inc', b.tx, b.ty, 0.4);
        return;
      }
      this.pickSix(b, picker);
    } else {
      this.fx.popup(b.tx, b.ty, 'INCOMPLETE', '#c9d4c9', 7);
      this.fx.puff(b.tx, b.ty);
      audio.dropThud();
      this.endPlay('inc', b.tx, b.ty, 0.4);
    }
  }

  private pickSix(b: BallEnt, picker: PlayerEnt | null) {
    audio.turnover(); audio.groan();
    this.flashCol = '#ff2d46'; this.flashA = 0.34;
    this.trauma = Math.min(1, this.trauma + 0.5);
    this.stats.ints++;
    if (picker) {
      picker.state = 'down';
      picker.downT = 1.4;
      picker.anim = 'celebrate';
      picker.animT = 0;
    }
    this.endPlay('int', b.tx, b.ty, 0.9);
  }

  private drillBreakup(b: BallEnt, picker: PlayerEnt | null) {
    this.fx.popup(b.tx, b.ty, 'BROKEN UP!', '#ffd94d', 8);
    this.fx.puff(b.tx, b.ty);
    this.stats.breakups++;
    audio.ooh();
    if (picker) { this.fx.catchFlash(picker.x, picker.y); picker.anim = 'catch'; picker.armT = 0.3; }
    this.endRep('breakup');
  }

  private drillInt(b: BallEnt, picker: PlayerEnt) {
    this.fx.popup(b.tx, b.ty, 'PICKED!', '#ff4d5e', 9);
    this.fx.tackleBurst(b.tx, b.ty);
    this.stats.ints++;
    this.flashCol = this.drillSide === 'db' ? '#aaff3c' : '#ff2d46';
    this.flashA = 0.3;
    this.trauma = Math.min(1, this.trauma + 0.4);
    picker.state = 'down';
    picker.downT = 1.2;
    picker.anim = 'celebrate';
    picker.animT = 0;
    if (this.drillSide === 'db') audio.cheer(1.1); else { audio.turnover(); audio.groan(); }
    this.endRep('int');
  }

  endPlay(result: DeadResult, x: number, y: number, whistleDelay = 0.4) {
    this.play = 'dead';
    this.result = result;
    this.deadT = 1.05;
    this.endX = x; this.endY = y;
    this.aim.active = false;
    this.aim.wrId = -1;
    if (result !== 'td') audio.whistle(0.3, whistleDelay);
  }

  // ---------------- drill reps ----------------

  endRep(result: DeadResult) {
    this.play = 'dead';
    this.result = result;
    this.deadT = 1.35;
    const youWR = this.drillSide === 'wr';
    let msg = '';
    switch (result) {
      case 'td':
        if (youWR) { this.drillYou += 2; msg = 'TOUCHDOWN! +2'; } else { this.drillOpp += 2; msg = 'HE SCORED  +2 THEM'; }
        break;
      case 'tackle':
      case 'oob':
        if (youWR) { this.drillYou += 1; msg = 'CATCH MADE +1'; } else { this.drillOpp += 1; msg = 'CATCH ALLOWED +1 THEM'; }
        break;
      case 'breakup':
        if (youWR) { this.drillOpp += 1; msg = 'BROKEN UP  +1 THEM'; } else { this.drillYou += 1; msg = 'PASS BROKEN UP +1'; }
        break;
      case 'int':
        if (youWR) { this.drillOpp += 2; msg = 'INTERCEPTED  +2 THEM'; } else { this.drillYou += 2; msg = 'INTERCEPTION! +2'; }
        break;
      default:
        if (youWR) msg = 'INCOMPLETE  NO POINTS';
        else { this.drillYou += 1; msg = 'COVERED  +1'; }
        break;
    }
    this.repMsg = msg;
    this.setTicker(msg);
    if (result !== 'td') audio.whistle(0.3, 0.35);
  }

  private nextRep() {
    this.rep++;
    const wr = this.wrId2 >= 0 ? this.players[this.wrId2] : null;
    const db = this.dbId2 >= 0 ? this.players[this.dbId2] : null;
    const rest = (s: number) => clamp(s + 0.42, 0.3, 1);
    this.carryStam = [rest(wr ? wr.stam : 1), rest(db ? db.stam : 1)];
    if (this.rep >= this.cfg.reps) { this.gameOver(); return; }
    this.setupDrill();
    const you = this.drillSide === 'wr' ? this.carryStam[0] : this.carryStam[1];
    const foe = this.drillSide === 'wr' ? this.carryStam[1] : this.carryStam[0];
    this.showBanner([
      { txt: this.repMsg || 'NEXT REP', col: this.repMsg.includes('THEM') ? '#ff9f3c' : '#aaff3c', size: 10 },
      { txt: `REP ${this.rep + 1} OF ${this.cfg.reps}`, col: '#eaffea', size: 9 },
      { txt: this.twoP ? `P1 ${this.drillYou} - P2 ${this.drillOpp}` : `YOU ${this.drillYou} - CPU ${this.drillOpp}`, col: '#4dd8ff', size: 9 },
      { txt: `GAS ${Math.round(you * 100)}% vs ${Math.round(foe * 100)}%`, col: you < 0.5 ? '#ff9f3c' : '#aaff3c', size: 8 },
    ], 1.7, false, () => { this.phase = 'presnap'; this.presnapT = 0; });
  }

  /** CPU opponent in the drill */
  private aiDrill(dt: number) {
    if (this.twoP) return;
    const wr = this.wrId2 >= 0 ? this.players[this.wrId2] : null;
    const db = this.dbId2 >= 0 ? this.players[this.dbId2] : null;
    if (!wr || !db) return;
    if (this.drillSide !== 'wr') return;
    // CPU defender dives at the carrier
    if (db.gambleCd > 0 || db.stumble > 0 || db.state === 'dive' || db.state === 'tackling') return;
    if (db.gassed > 0 || db.stam < GameEngine.MIN_STAM) return;
    const car = this.carrier();
    if (car && this.play === 'run' && car.side === 'off') {
      const d = dist(db.x, db.y, car.x, car.y);
      if (d < 2.3 && Math.random() < dt * 5) {
        this.burn(db, COST.tackle);
        this.setCd(db, 0.8);
        db.state = 'dive';
        db.diveT = 0.42;
        db.anim = 'dive';
        db.animT = 0;
        const a = Math.atan2(car.y - db.y, car.x - db.x);
        db.vx = Math.cos(a) * 13;
        db.vy = Math.sin(a) * 13;
        db.face = a;
      }
    }
  }

  // ---------------- scoring / downs ----------------

  private onTouchdown(car: PlayerEnt) {
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
    this.fx.confetti(car.x, 104, 130, cols);
    this.fx.confetti(car.x - 8, 102, 60, cols);
    this.fx.confetti(car.x + 8, 102, 60, cols);
    audio.touchdownSting();
    audio.cheer(1.4);

    if (this.cfg.drill) { this.stats.tds++; this.endRep('td'); return; }
    const c = this.cfg;
    const pts = this.convPlay ? this.convValue : c.tdPoints;
    this.addScore(pts);
    this.stats.tds++;
    const gain = Math.floor(car.y - this.los);
    if (gain > this.stats.longest) this.stats.longest = gain;
    this.registerYards(car);
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

  private registerYards(car: PlayerEnt) {
    const gain = car.y - this.los;
    if (car.isQB && this.qbScramble) this.stats.rushYds += Math.max(0, Math.round(gain));
    else this.stats.passYds += Math.max(0, Math.round(gain));
  }

  private resolveDown() {
    const c = this.cfg;
    if (this.result === 'td') return;
    const r = this.result;
    this.result = 'none';
    if (r === 'tackle' || r === 'oob' || r === 'whistle') {
      const spot = Math.max(0, Math.min(99.2, this.endY));
      if (!this.convPlay) this.los = spot;
      const car = this.carrier();
      if (car) this.registerYards(car);
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
    if (r === 'int') { this.onTurnover('INTERCEPTED!', '#ff4d5e', Math.max(2, 100 - this.endY)); return; }

    if (c.practice) {
      this.down = 1;
      this.ltg = this.los + 10;
      if (this.los > 88) { this.los = 25; this.ltg = 35; }
      this.setupPlay();
      this.phase = 'presnap';
      this.presnapT = 0;
      return;
    }
    if (r !== 'inc' && this.los >= this.ltg) {
      this.down = 1;
      this.ltg = Math.min(100, this.los + 10);
      audio.firstDown();
      this.setTicker('1ST DOWN - MOVE THE CHAINS');
      this.flashCol = '#ffd94d';
      this.flashA = 0.12;
      if (this.checkClockBoundary()) return;
      this.nextSnap();
      return;
    }
    this.down++;
    if (this.down > 4) { this.onTurnover('TURNOVER ON DOWNS', '#ff9f3c', Math.max(2, 100 - this.los)); return; }
    if (this.checkClockBoundary()) return;
    this.nextSnap();
  }

  private nextSnap() {
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

  private onTurnover(text: string, col: string, fieldLeft: number) {
    audio.turnover(); audio.groan();
    this.flashCol = '#ff2d46';
    this.flashA = 0.22;
    const c = this.cfg;
    this.setTicker(text);
    this.showBanner([{ txt: text, col, size: 13 }], 1.7, false, () => {
      if (c.practice) {
        this.down = 1; this.los = 25; this.ltg = 35;
        this.setupPlay(); this.phase = 'presnap'; this.presnapT = 0;
        return;
      }
      if (c.cpuSim) this.cpuDrive(true, fieldLeft);
      else this.nextPossession();
    });
  }

  private postScore() {
    const c = this.cfg;
    if (c.practice) {
      this.down = 1; this.los = Math.floor(rand(20, 35)); this.ltg = this.los + 10;
      this.setupPlay();
      this.setTicker('AGAIN - RUN IT BACK');
      this.phase = 'presnap';
      this.presnapT = 0;
      return;
    }
    if (c.cpuSim) { this.cpuDrive(false, 75); return; }
    this.nextPossession();
  }

  // ---------------- CPU drives (rating aware) ----------------

  private cpuDrive(shortField: boolean, fieldLeft: number) {
    const c = this.cfg;
    if (!c.clocked || this.clock <= 0) { this.afterCpuDrive(); return; }
    const burn = rand(18, 38);
    const oppOff = this.opp.off;
    const myDef = this.team.def;
    // rating differential drives scoring odds
    let prob = 0.3 + (oppOff - myDef) * 0.006 + (c.id === 'seven7' ? 0.08 : 0);
    if (shortField) prob += clamp((100 - fieldLeft) * 0.004, 0, 0.25);
    prob += Math.max(0, this.scoreThem - this.scoreUs) * 0.002;
    prob = clamp(prob, 0.1, 0.62);
    const roll = Math.random();
    let lineTxt = '';
    let scored = 0;
    const star = pick(['K. COMET', 'D. ROCKET', 'J. BLUR', 'T. VECTOR', 'M. NOVA', 'R. SWIFT']);
    if (roll < prob) {
      scored = 7;
      lineTxt = `TD: ${star} ${Math.floor(rand(6, 44))} YD STRIKE`;
    } else if (roll < prob + 0.15 && Math.random() < 0.8) {
      scored = 3;
      lineTxt = `FG GOOD FROM ${Math.floor(rand(28, 46))}`;
    } else {
      lineTxt = pick(['PUNTS IT AWAY', 'STUFFED ON DOWNS', 'DRIVE STALLS', 'SACKED - PUNT', 'FUMBLES IT BACK']);
    }
    this.clock = Math.max(0, this.clock - burn);
    audio.setCrowd(0.8);
    if (scored === 7) { this.scoreThem += 7; audio.groan(); }
    else if (scored === 3) { this.scoreThem += 3; audio.ooh(); }
    this.showBanner([
      { txt: `${this.opp.abbr} POSSESSION`, col: '#ff6b6b', size: 11 },
      { txt: lineTxt, col: scored > 0 ? '#ffd94d' : '#c9d4c9', size: 8 },
      { txt: `${this.team.abbr} ${this.scoreUs}  -  ${this.opp.abbr} ${this.scoreThem}`, col: '#eaffea', size: 9 },
    ], 2.1, false, () => this.afterCpuDrive());
  }

  private afterCpuDrive() {
    if (this.checkClockBoundary()) return;
    this.los = Math.floor(rand(20, 35));
    this.ltg = this.los + 10;
    this.down = 1;
    this.setTicker('YOUR BALL - 1ST & 10');
    this.setupPlay();
    this.phase = 'presnap';
    this.presnapT = 0;
  }

  private nextPossession() {
    const c = this.cfg;
    this.possIdx++;
    if (this.possIdx >= c.drives * 2) { this.gameOver(); return; }
    this.cur2P = (this.possIdx % 2) as 0 | 1;
    this.los = Math.floor(rand(20, 32));
    this.ltg = this.los + 10;
    this.down = 1;
    this.setupPlay();
    const t = this.cur2P === 0 ? this.team : this.team2;
    const pn = this.cur2P === 0 ? 'PLAYER 1' : 'PLAYER 2';
    this.setTicker(`${pn} BALL`);
    this.showBanner([
      { txt: `${pn} - ${t.abbr}`, col: t.c1 === '#000000' ? '#eaffea' : t.c1, size: 13 },
      { txt: `DRIVE ${Math.floor(this.possIdx / 2) + 1} OF ${c.drives}`, col: '#eaffea', size: 8 },
      { txt: 'PRESS SPACE WHEN READY', col: '#ffd94d', size: 8 },
    ], 999, true, () => { this.phase = 'presnap'; this.presnapT = 0; });
  }

  private tickClock(dt: number) {
    if (!this.cfg.clocked || this.clock <= 0) return;
    const before = this.clock;
    this.clock = Math.max(0, this.clock - dt);
    if (this.half === 2 && before > 30 && this.clock <= 30 && !this.twoMinuteDone) {
      this.twoMinuteDone = true;
      this.setTicker('*** FINAL MINUTE WARNING ***');
      audio.ding();
    }
  }

  private runoffClock() {
    if (!this.cfg.clocked || this.clock <= 0) return;
    this.clock = Math.max(0, this.clock - rand(4, 10));
  }

  private checkClockBoundary(): boolean {
    const c = this.cfg;
    if (!c.clocked || this.clock > 0) return false;
    if (this.half === 1) {
      this.half = 2;
      this.clock = c.halfLen;
      audio.whistle(0.5);
      this.los = 25; this.ltg = 35; this.down = 1;
      this.setupPlay();
      this.setTicker('2ND HALF UNDERWAY');
      this.showBanner([
        { txt: 'HALFTIME', col: '#4dd8ff', size: 15 },
        { txt: `${this.team.abbr} ${this.scoreUs}  -  ${this.opp.abbr} ${this.scoreThem}`, col: '#ffffff', size: 11 },
      ], 2.1, false, () => { this.phase = 'presnap'; this.presnapT = 0; });
      return true;
    }
    this.gameOver();
    return true;
  }

  private addScore(n: number) {
    if (this.cfg.id === 'two2') this.p2[this.cur2P] += n;
    else this.scoreUs += n;
  }

  private gameOver() {
    audio.buzzer();
    audio.setCrowd(1.2);
    this.phase = 'over';
    this.play = 'dead';
    const s = this.stats;
    if (this.cfg.drill) {
      s.scoreUs = this.drillYou;
      s.scoreThem = this.drillOpp;
      s.reps = this.cfg.reps;
      s.wins = this.drillYou;
      s.twoP = this.twoP;
      if (this.twoP) s.winner = this.drillYou === this.drillOpp ? -1 : (this.drillYou > this.drillOpp ? 0 : 1);
    } else if (this.cfg.id === 'two2') {
      s.winner = this.p2[0] === this.p2[1] ? -1 : (this.p2[0] > this.p2[1] ? 0 : 1);
      s.scoreUs = Math.max(this.p2[0], this.p2[1]);
      s.scoreThem = Math.min(this.p2[0], this.p2[1]);
    } else {
      s.scoreUs = this.scoreUs;
      s.scoreThem = this.scoreThem;
    }
    s.p2 = [this.p2[0], this.p2[1]];
    this.setTicker('FINAL');
    setTimeout(() => { if (!this.destroyed) this.cb.onOver(s); }, 950);
  }

  // ---------------- kick ----------------

  private updateKick(dt: number) {
    const k = this.kick;
    k.t += dt;
    if (k.sub === 'sweep') {
      k.arrow += k.dir * dt * (k.kind === 'fg' ? 1.25 + k.distance * 0.008 : 1.3);
      if (k.arrow > 1) { k.arrow = 1; k.dir = -1; }
      if (k.arrow < 0) { k.arrow = 0; k.dir = 1; }
    } else if (k.sub === 'runup') {
      if (k.t > 0.7) { k.sub = 'flight'; k.t = 0; audio.snap(); this.trauma = Math.min(1, this.trauma + 0.18); }
    } else if (k.sub === 'flight') {
      k.ballT = Math.min(1, k.t / 1.15);
      if (k.ballT >= 1) {
        k.sub = 'result';
        k.t = 0;
        if (k.doink) audio.doink();
        if (k.good) { this.addScore(k.points); audio.kickGood(); } else audio.kickBad();
        this.showBanner([
          { txt: k.doink ? 'OFF THE UPRIGHT!' : k.good ? "IT'S GOOD!" : 'NO GOOD...', col: k.good ? '#aaff3c' : '#ff6b6b', size: 13 },
          { txt: `${k.kind === 'fg' ? `${k.distance} YD FIELD GOAL` : 'EXTRA POINT'}  ${k.good ? `+${k.points}` : '+0'}`, col: '#ffffff', size: 8 },
        ], 1.6, false, () => {
          this.cam.tzoom = 1;
          if (k.kind === 'fg') { if (this.cfg.cpuSim) this.cpuDrive(false, 75); else this.nextPossession(); }
          else this.postScore();
        });
      }
    }
  }

  // ---------------- animation ----------------

  private updatePlayerAnim(dt: number) {
    this.resolveCollisions(dt);
    for (const p of this.players) {
      const sp = Math.hypot(p.vx, p.vy);
      p.runPhase += dt * (3 + sp * 2.3);
      p.animT += dt;
      // state-driven animation selection
      if (p.state === 'tackled' || (p.state === 'down' && p.anim === 'fall')) p.anim = 'fall';
      else if (p.state === 'tackling') p.anim = 'tackle';
      else if (p.state === 'dive' || p.state === 'whiff') p.anim = 'dive';
      else if (p.anim === 'celebrate' || p.anim === 'spike' || p.anim === 'dance') { /* hold */ }
      else if (p.armT > 0 && (p.anim === 'throw' || p.anim === 'catch')) { /* hold */ }
      else p.anim = sp > 1.2 ? 'run' : 'idle';

      if (p.state === 'whiff') {
        p.x = clamp(p.x + p.vx * dt, -FIELD_HALF_W, FIELD_HALF_W);
        p.y += p.vy * dt;
        p.vx *= Math.pow(0.02, dt);
        p.vy *= Math.pow(0.02, dt);
      }
      if (p.kind === 'wr' && this.play === 'qb') {
        let nd = 1e9;
        for (const d of this.players) {
          if (d.side !== 'def' || d.kind !== 'db') continue;
          nd = Math.min(nd, dist(d.x, d.y, p.x, p.y));
        }
        p.openness = nd;
      }
    }
    // live mouse reticle
    // slingshot aim only shows while dragging — no live mouse reticle
  }

  // ---------------- HUD helpers ----------------

  downAndDist(): string {
    if (this.cfg.practice) return `1ST & ${Math.max(1, Math.ceil(this.ltg - this.los))}`;
    const d = Math.min(this.down, 4);
    const dn = ['', '1ST', '2ND', '3RD', '4TH'][d];
    const dst = this.ltg >= 99.5 ? 'GOAL' : String(Math.max(1, Math.ceil(this.ltg - this.los)));
    return `${dn} & ${dst}`;
  }

  clockStr(): string {
    const t = Math.max(0, Math.ceil(this.clock));
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  }

  shellName(): string { return SHELL_NAME[this.shell]; }

  offColor() {
    const t = this.offTeam();
    return { main: t.c1 === '#000000' ? '#3a3a3a' : t.c1, dark: t.c2, trail: t.c3 };
  }

  setTicker(msg: string) { this.tickerMsg = msg; this.tickerX = 0; }

  traumaShake(out: [number, number]) {
    const tr = this.trauma * this.trauma;
    const t = this.time * 60;
    out[0] = Math.sin(t * 1.3) * tr * 13;
    out[1] = Math.cos(t * 1.7) * tr * 11;
  }

  // --- online sync logic ---

  getNetworkState() {
    return {
      phase: this.phase,
      play: this.play,
      los: this.los,
      scoreUs: this.scoreUs,
      scoreThem: this.scoreThem,
      p2: this.p2,
      clock: this.clock,
      half: this.half,
      players: this.players.map(p => ({
        id: p.id, x: p.x, y: p.y, face: p.face, anim: p.anim, animT: p.animT, stun: p.stun, stam: p.stam
      })),
      ball: { x: this.ball.x, y: this.ball.y, z: this.ball.z, state: this.ball.state },
      cam: { tx: this.cam.tx, ty: this.cam.ty, tzoom: this.cam.tzoom },
      ticker: this.tickerMsg
    };
  }

  applyRemoteState() {
    const s = this.remoteState;
    if (!s) return;
    this.phase = s.phase;
    this.play = s.play;
    this.los = s.los;
    this.scoreUs = s.scoreUs;
    this.scoreThem = s.scoreThem;
    this.p2 = s.p2;
    this.clock = s.clock;
    this.half = s.half;
    this.tickerMsg = s.ticker;
    
    // Sync players
    s.players.forEach((rp: any) => {
      const lp = this.players.find(p => p.id === rp.id);
      if (lp) {
        lp.x = rp.x; lp.y = rp.y; lp.face = rp.face;
        lp.anim = rp.anim; lp.animT = rp.animT;
        lp.stun = rp.stun; lp.stam = rp.stam;
      }
    });

    // Sync ball
    this.ball.x = s.ball.x; this.ball.y = s.ball.y;
    this.ball.z = s.ball.z; this.ball.state = s.ball.state;

    // Sync camera
    this.cam.tx = s.cam.tx; this.cam.ty = s.cam.ty;
    this.cam.tzoom = s.cam.tzoom;
  }

  private render() {
    this.ui.length = 0;
    renderAll(this);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.buf, 0, 0, this.canvas.width, this.canvas.height);
  }
}

function finePointer(): boolean {
  try { return window.matchMedia('(pointer: fine)').matches; } catch { return false; }
}

function freshStats(): FinalStats {
  return {
    mode: 'arcade', scoreUs: 0, scoreThem: 0, p2: [0, 0], winner: -2,
    passYds: 0, rushYds: 0, completions: 0, attempts: 0, tds: 0, ints: 0,
    catches: 0, pancakes: 0, jukes: 0, longest: 0, sacks: 0,
    drill: false, drillSide: 'wr', reps: 0, wins: 0, breakups: 0, twoP: false,
    teamId: 'kc', oppId: 'sf',
  };
}
