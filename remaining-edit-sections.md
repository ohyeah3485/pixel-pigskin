# Current engine sections for remaining edits

Source: `src/game/engine.ts`, after the requested edits.

## BallEnt and initializer

```typescript
export interface BallEnt {
  state: 'held' | 'air' | 'loose';
  x: number; y: number; z: number;
  sx: number; sy: number;
  tx: number; ty: number;
  t: number; T: number; h: number;
  spin: number;
  wrId: number;
}

  ball: BallEnt = { state: 'held', x: 0, y: 0, z: 0, sx: 0, sy: 0, tx: 0, ty: 0, t: 0, T: 1, h: 6, spin: 0, wrId: -1 };
```

## snap()

```typescript
  snap() {
    if (this.phase !== 'presnap') return;
    playRandomQbCall(audio.muted);
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
    if (!this.cfg.drill && this.runSelected) { this.startRunHandoff(); this.runSelected = false; }
  }
```

## handoff()

```typescript
  private handoff() {
    const backs = this.players.filter((p) => p.side === 'off' && p.kind === 'wr');
    const back = backs[backs.length - 1];
    if (!back) return;
    back.route = []; back.ri = 0; back.state = 'idle';
    this.runPlayActive = true;
    this.becomeCarrier(back);
    this.ball.state = 'held'; this.ball.x = back.x; this.ball.y = back.y; this.ball.z = 1; this.ball.wrId = -1;
    this.setTicker('HANDOFF');
  }
```

## startRunHandoff()

```typescript
  private startRunHandoff() {
    const backs = this.players.filter((p) => p.side === 'off' && p.kind === 'wr');
    const back = backs[backs.length - 1];
    const qb = this.players[this.qbId];
    if (!back || !qb) { this.handoff(); return; }
    this.handoffFromX = back.x; this.handoffFromY = back.y;
    this.handoffT = this.handoffDuration;
    this.ball.state = 'held'; this.ball.x = qb.x; this.ball.y = qb.y; this.ball.z = 1; this.ball.wrId = -1;
  }
```

## updateRunHandoff()

```typescript
  private updateRunHandoff(dt: number) {
    const backs = this.players.filter((p) => p.side === 'off' && p.kind === 'wr');
    const back = backs[backs.length - 1];
    const qb = this.players[this.qbId];
    if (!back || !qb) { this.handoffT = 0; return; }
    this.handoffT = Math.max(0, this.handoffT - dt);
    const t = clamp(1 - this.handoffT / this.handoffDuration, 0, 1);
    const eased = t * t * (3 - 2 * t);
    back.x = lerp(this.handoffFromX, qb.x + 1, eased);
    back.y = lerp(this.handoffFromY, qb.y + 0.2 * this.offDir, eased);
    this.ball.x = lerp(qb.x, back.x, eased); this.ball.y = lerp(qb.y, back.y, eased); this.ball.z = 1;
    if (t >= 1) { this.handoffT = 0; this.handoff(); }
  }
```

## attemptTackle()

```typescript
  private attemptTackle(def: PlayerEnt, car: PlayerEnt) {
    const power = clamp(Math.hypot(def.vx - car.vx, def.vy - car.vy) / 10, 0.5, 1.4);
    this.startTackle(def, car, power);
    const gain = Math.floor((car.y - this.los) * this.offDir);
    if (gain > 0) this.fx.popup(car.x, car.y, `+${gain}`, '#eaffea', 8);
    this.endPlay('tackle', car.x, car.y, 0.55);
  }
```

## burn()

```typescript
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
```

## clampCamX()

```typescript
  clampCamX(x: number) {
    const l = this.camXLimit();
    return clamp(x, -l, l);
  }
```

## clampCamY()

```typescript
  clampCamY(y: number) {
    const a = this.camYMin();
    const b = this.camYMax();
    return a > b ? (a + b) / 2 : clamp(y, a, b);
  }
```

## beginKickReturn()

```typescript
  private beginKickReturn(returnSpot: number) {
    this.offDir = 1;
    if (this.kick.kind === 'punt') {
      this.los = clamp(Math.round(returnSpot), 2, FIELD_LENGTH - 2);
      this.ltg = Math.min(FIELD_LENGTH, this.los + 10);
      this.down = 1;
      this.convPlay = false;
      // Keep the punt formation intact at the catch.
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

## updateKick()

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
      if (k.returnToPlayer) {
        const kickDir = Math.sign(k.endY - k.startY) || 1;
        const coveredY = k.startY + kickDir * Math.min(9, Math.abs(k.endY - k.startY) * k.ballT);
        for (const p of this.players) if (p.side === 'def') p.y = coveredY;
      }
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
        this.beginKickReturn(k.endY);
      } else {
        this.beginCpuKickReturn(k.endY);
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
          this.beginCpuPossession(this.los);
        } else {
          this.nextPossession();
        }
      } else {
        this.postScore();
      }
    });
  }
```

## Presnap camera-target block

```typescript
    if (this.phase === 'presnap') {
      this.presnapT += dt;
      if (this.cpuOffense) this.updateCpuOffense();
      this.updatePlayerAnim(dt);
      for (const p of this.players) p.runPhase += dt * 2;
      this.cam.tx = 0;
      this.cam.ty = this.los + 10 * this.offDir;
      if (this.cfg.clocked) this.tickClock(dt * 0.3);
      return;
    }
```
