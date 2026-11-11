// Pooled particles + floating popup text. Zero allocation in steady state.

export interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number;
  size: number; col: string;
  grav: number; drag: number;
  shape: number; // 0 square, 1 streak, 2 confetti
  rot: number; vr: number;
  alpha: number; fadeIn: number;
}

export interface Popup {
  x: number; y: number; txt: string; col: string;
  t: number; max: number; size: number; big: boolean;
}

const PMAX = 460;
const TMAX = 22;

export class Fx {
  parts: Particle[] = [];
  pops: Popup[] = [];
  private pi = 0;
  private ti = 0;

  constructor() {
    for (let i = 0; i < PMAX; i++) {
      this.parts.push({
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 2,
        col: '#fff', grav: 0, drag: 0, shape: 0, rot: 0, vr: 0, alpha: 1, fadeIn: 0,
      });
    }
    for (let i = 0; i < TMAX; i++) {
      this.pops.push({ x: 0, y: 0, txt: '', col: '#fff', t: 1e9, max: 1, size: 8, big: false });
    }
  }

  private next(): Particle {
    const p = this.parts[this.pi];
    this.pi = (this.pi + 1) % PMAX;
    return p;
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number,
    life: number, size: number, col: string, grav: number, drag: number, shape = 0, fadeIn = 0) {
    const p = this.next();
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = life; p.max = life; p.size = size; p.col = col;
    p.grav = grav; p.drag = drag; p.shape = shape;
    p.rot = Math.random() * 6.28; p.vr = (Math.random() - 0.5) * 12;
    p.alpha = 1; p.fadeIn = fadeIn;
  }

  grassBurst(x: number, y: number, n: number, pow = 1) {
    const cols = ['#3fa34d', '#2e8b3a', '#7ec850', '#c9b458'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28;
      const sp = (1.5 + Math.random() * 4) * pow;
      this.spawn(x, y, 0.2, Math.cos(a) * sp, Math.sin(a) * sp, 3 + Math.random() * 5 * pow,
        0.5 + Math.random() * 0.4, 1.6 + Math.random() * 1.6, cols[i % cols.length], -14, 0.92);
    }
  }

  tackleBurst(x: number, y: number) {
    this.grassBurst(x, y, 14, 1.5);
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * 6.28;
      this.spawn(x, y, 1.2, Math.cos(a) * 6, Math.sin(a) * 6, 6 + Math.random() * 6,
        0.45, 2.4, i % 2 ? '#ffffff' : '#ffd94d', -20, 0.94);
    }
  }

  catchFlash(x: number, y: number) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * 6.28;
      this.spawn(x, y, 1.4, Math.cos(a) * 7, Math.sin(a) * 7, 2, 0.28, 2, '#eaffea', -6, 0.9);
    }
  }

  confetti(x: number, y: number, n: number, cols: string[]) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const sp = 6 + Math.random() * 13;
      this.spawn(x + (Math.random() - 0.5) * 10, y + Math.random() * 3, 1 + Math.random() * 3,
        Math.cos(a) * sp * 0.55, Math.sin(a) * sp * 0.4, 9 + Math.random() * 9,
        1.5 + Math.random() * 1.4, 2 + Math.random() * 1.7, cols[i % cols.length], -5.5, 0.965, 2);
    }
  }

  sweat(x: number, y: number, dir: number) {
    this.spawn(x - dir * 0.8, y, 1.5, -dir * (2 + Math.random() * 2), (Math.random() - 0.5) * 3,
      4 + Math.random() * 3, 0.3, 1.4, '#bfe6ff', -16, 0.95);
  }

  trailDot(x: number, y: number, col: string) {
    this.spawn(x, y, 0.5, 0, 0, 0.6, 0.32, 2.6, col, 0, 1, 0, 0.06);
  }

  puff(x: number, y: number) {
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * 6.28;
      this.spawn(x, y, 0.25, Math.cos(a) * 2.4, Math.sin(a) * 2.4, 1.4 + Math.random() * 2,
        0.4, 2.4, '#cfe8c9', -3, 0.9);
    }
  }

  popup(x: number, y: number, txt: string, col = '#ffffff', size = 8, big = false) {
    const p = this.pops[this.ti];
    this.ti = (this.ti + 1) % TMAX;
    p.x = x; p.y = y; p.txt = txt; p.col = col; p.t = 0; p.max = big ? 1.5 : 1.0; p.size = size; p.big = big;
  }

  update(dt: number) {
    for (let i = 0; i < PMAX; i++) {
      const p = this.parts[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vz += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.z < 0) { p.z = 0; p.vz *= -0.4; p.vx *= 0.6; p.vy *= 0.6; }
      const dr = Math.pow(p.drag, dt * 60);
      p.vx *= dr; p.vy *= dr;
      p.rot += p.vr * dt;
      p.alpha = p.life < 0.25 ? Math.max(0, p.life / 0.25) : (p.fadeIn > 0 ? Math.min(1, (p.max - p.life) / p.fadeIn) : 1);
    }
    for (let i = 0; i < TMAX; i++) {
      const p = this.pops[i];
      if (p.t < p.max) p.t += dt;
    }
  }

  render(ctx: CanvasRenderingContext2D, px: (x: number, y: number) => [number, number], scale: number) {
    // particles
    for (let i = 0; i < PMAX; i++) {
      const p = this.parts[i];
      if (p.life <= 0) continue;
      const [sx, sy] = px(p.x, p.y);
      const s = p.size * (p.shape === 1 ? 2 : 1);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.col;
      if (p.shape === 2) {
        ctx.save();
        ctx.translate(sx, sy - p.z * scale);
        ctx.rotate(p.rot);
        ctx.fillRect(-s / 2, -s * 0.35, s, s * 0.7);
        ctx.restore();
      } else {
        const zz = p.z * scale * 0.8;
        ctx.fillRect(sx - s / 2, sy - zz - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
    // popups
    for (let i = 0; i < TMAX; i++) {
      const p = this.pops[i];
      if (p.t >= p.max) continue;
      const k = p.t / p.max;
      const [sx, sy] = px(p.x, p.y);
      const rise = k * 26 * (p.big ? 1.4 : 1);
      const pop = p.t < 0.12 ? 0.4 + (p.t / 0.12) * 0.6 : 1;
      const a = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.globalAlpha = a;
      ctx.font = `${Math.round(p.size * pop * (p.big ? 1.5 : 1))}px "Press Start 2P", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const yy = sy - rise - 18;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(3,12,6,0.9)';
      ctx.strokeText(p.txt, sx, yy);
      ctx.fillStyle = p.col;
      ctx.fillText(p.txt, sx, yy);
    }
    ctx.globalAlpha = 1;
  }
}
