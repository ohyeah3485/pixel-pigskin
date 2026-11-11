// Tiny synthesized sound engine — zero assets, pure WebAudio.

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private crowdGain: GainNode | null = null;
  private crowdTarget = 0;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const Ctor: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);

      // shared noise buffer
      const len = this.ctx.sampleRate * 1.2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      // crowd bed: looped noise -> bandpass -> slow LFO gain wobble
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 640;
      bp.Q.value = 0.6;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.23;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 0.012;
      this.crowdGain = this.ctx.createGain();
      this.crowdGain.gain.value = 0;
      lfo.connect(lfoGain);
      lfoGain.connect(this.crowdGain.gain);
      src.connect(bp);
      bp.connect(this.crowdGain);
      this.crowdGain.connect(this.master);
      src.start();
      lfo.start();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.03);
    }
  }

  setCrowd(level: number) {
    this.crowdTarget = level;
    if (this.crowdGain && this.ctx) {
      this.crowdGain.gain.setTargetAtTime(0.025 * level, this.ctx.currentTime, 0.4);
    }
  }
  get crowdLevel() { return this.crowdTarget; }

  private tone(f0: number, f1: number, dur: number, vol: number, type: OscillatorType = 'square', delay = 0) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(30, f0), t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol: number, freq: number, type: BiquadFilterType = 'bandpass', q = 1, delay = 0) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t0 = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t0, Math.random() * 0.5);
    s.stop(t0 + dur + 0.05);
  }

  uiClick() { this.tone(760, 980, 0.07, 0.14, 'square'); }
  uiHover() { this.tone(340, 380, 0.045, 0.05, 'square'); }
  hut(n: number) {
    for (let i = 0; i < n; i++) this.tone(190, 150, 0.09, 0.22, 'sawtooth', i * 0.16);
  }
  snap() { this.noise(0.06, 0.3, 2200, 'highpass'); this.tone(140, 90, 0.08, 0.2, 'triangle'); }
  throwWhoosh() { this.noise(0.3, 0.16, 900, 'bandpass', 2); this.tone(300, 700, 0.25, 0.05, 'sine'); }
  catchPop() { this.tone(520, 760, 0.08, 0.2, 'square'); this.noise(0.05, 0.16, 3200, 'highpass'); }
  dropThud() { this.tone(160, 70, 0.12, 0.18, 'triangle'); }
  tackle() {
    this.noise(0.18, 0.5, 140, 'lowpass');
    this.tone(110, 45, 0.16, 0.4, 'triangle');
    this.noise(0.06, 0.2, 2600, 'highpass');
  }
  juke() { this.noise(0.16, 0.2, 1400, 'bandpass', 3); this.tone(700, 1200, 0.12, 0.08, 'sine'); }
  block() { this.noise(0.1, 0.3, 300, 'lowpass'); this.tone(200, 90, 0.09, 0.25, 'square'); }
  whistle(dur = 0.35, delay = 0) {
    // warbly pea-whistle
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    o.type = 'square';
    o.frequency.value = 2350;
    lfo.frequency.value = 34;
    lg.gain.value = 260;
    lfo.connect(lg);
    lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
    g.gain.setValueAtTime(0.12, t0 + dur - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
    lfo.start(t0); lfo.stop(t0 + dur + 0.05);
  }
  cheer(big = 1) {
    this.noise(0.9 * big, 0.5, 700, 'bandpass', 0.5);
    this.noise(0.7 * big, 0.3, 1600, 'bandpass', 0.7, 0.05);
    if (this.crowdGain && this.ctx) {
      this.crowdGain.gain.setTargetAtTime(0.11, this.ctx.currentTime, 0.05);
      this.crowdGain.gain.setTargetAtTime(0.03 * this.crowdTarget, this.ctx.currentTime + 0.9 * big, 0.8);
    }
  }
  groan() {
    this.tone(220, 130, 0.5, 0.14, 'sawtooth');
    this.noise(0.5, 0.16, 300, 'lowpass');
  }
  ooh() { this.tone(480, 300, 0.3, 0.1, 'sine'); this.noise(0.3, 0.14, 900, 'bandpass', 0.8); }
  ding() { this.tone(1240, 1240, 0.16, 0.16, 'triangle'); this.tone(1860, 1860, 0.2, 0.1, 'sine', 0.05); }
  buzzer() { this.tone(140, 140, 0.7, 0.22, 'sawtooth'); }
  touchdownSting() {
    const seq = [[523, 0], [659, 0.09], [784, 0.18], [1046, 0.3]];
    for (const [f, dl] of seq) this.tone(f, f, 0.16, 0.18, 'square', dl);
    this.tone(1318, 1318, 0.4, 0.12, 'square', 0.42);
  }
  firstDown() { this.tone(660, 660, 0.08, 0.14, 'square'); this.tone(880, 880, 0.14, 0.14, 'square', 0.09); }
  turnover() { this.tone(330, 220, 0.22, 0.2, 'sawtooth'); this.tone(220, 160, 0.3, 0.18, 'sawtooth', 0.14); }
  kickGood() { this.cheer(1.1); this.ding(); }
  kickBad() { this.groan(); }
  doink() { this.tone(300, 290, 0.3, 0.25, 'triangle'); }
  countdown(hi: boolean) { this.tone(hi ? 880 : 440, hi ? 880 : 440, hi ? 0.22 : 0.09, 0.2, 'square'); }
  stepBurst() { this.noise(0.045, 0.06, 1800, 'highpass'); }
}

export const audio = new AudioEngine();
