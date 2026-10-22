// Procedural WebAudio sound engine – no assets required.
export type Channel = "master" | "effects" | "engine" | "radio";
export const CHANNELS: Channel[] = ["master", "effects", "engine", "radio"];
const MASTER_GAIN = 0.55;

export class Sfx {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  muted = false;
  volume: Record<Channel, number> = { master: 1, effects: 1, engine: 1, radio: 0.7 };
  private bus: Partial<Record<Exclude<Channel, "master">, GainNode>> = {};
  private engOsc: OscillatorNode | null = null;
  private engOsc2: OscillatorNode | null = null;
  private engFilter: BiquadFilterNode | null = null;
  private engGain: GainNode | null = null;
  private skidGain: GainNode | null = null;
  private skidFilter: BiquadFilterNode | null = null;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private lastCrash = 0;

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER_GAIN * this.volume.master;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp);
    comp.connect(ctx.destination);
    for (const ch of ["effects", "engine", "radio"] as const) {
      const g = ctx.createGain();
      g.gain.value = this.volume[ch];
      g.connect(this.bus.effects ?? this.master);
      this.bus[ch] = g;
    }
    const fx = this.bus.effects!, eng = this.bus.engine!;

    // noise buffer
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;

    // engine
    this.engOsc = ctx.createOscillator();
    this.engOsc.type = "sawtooth";
    this.engOsc2 = ctx.createOscillator();
    this.engOsc2.type = "square";
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = "lowpass";
    this.engFilter.frequency.value = 400;
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    this.engOsc.connect(this.engFilter);
    this.engOsc2.connect(g2);
    g2.connect(this.engFilter);
    this.engFilter.connect(this.engGain);
    this.engGain.connect(eng);
    this.engOsc.start();
    this.engOsc2.start();

    // skid noise
    const skid = ctx.createBufferSource();
    skid.buffer = buf;
    skid.loop = true;
    this.skidFilter = ctx.createBiquadFilter();
    this.skidFilter.type = "bandpass";
    this.skidFilter.frequency.value = 1800;
    this.skidFilter.Q.value = 3;
    this.skidGain = ctx.createGain();
    this.skidGain.gain.value = 0;
    skid.connect(this.skidFilter);
    this.skidFilter.connect(this.skidGain);
    this.skidGain.connect(eng);
    skid.start();

    // siren
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = "triangle";
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(fx);
    this.sirenOsc.start();
  }

  // output node for the radio (null before the first user interaction)
  get radioOut(): GainNode | null { return this.bus.radio ?? null; }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : MASTER_GAIN * this.volume.master, this.ctx.currentTime, 0.05);
  }

  setVolume(ch: Channel, v: number) {
    this.volume[ch] = Math.max(0, Math.min(1, v));
    if (!this.ctx) return;
    if (ch === "master") { if (!this.muted) this.master?.gain.setTargetAtTime(MASTER_GAIN * this.volume.master, this.ctx.currentTime, 0.05); }
    else this.bus[ch]?.gain.setTargetAtTime(this.volume[ch], this.ctx.currentTime, 0.05);
  }

  update(speed01: number, throttle: number, skid01: number, sirenLevel: number, t: number, active: boolean) {
    const ctx = this.ctx;
    if (!ctx || !this.engOsc || !this.engOsc2 || !this.engGain || !this.engFilter) return;
    const now = ctx.currentTime;
    // fake gearbox
    const gears = 5;
    const gp = speed01 * gears;
    const gearFrac = gp - Math.floor(Math.min(gp, gears - 0.001));
    const rpm = 0.25 + gearFrac * 0.6 + speed01 * 0.25;
    const f = 38 + rpm * 90;
    this.engOsc.frequency.setTargetAtTime(f, now, 0.04);
    this.engOsc2.frequency.setTargetAtTime(f * 0.5, now, 0.04);
    this.engFilter.frequency.setTargetAtTime(300 + rpm * 900 + throttle * 600, now, 0.05);
    this.engGain.gain.setTargetAtTime(active ? 0.09 + throttle * 0.05 : 0, now, 0.08);
    if (this.skidGain) this.skidGain.gain.setTargetAtTime(active ? skid01 * 0.16 : 0, now, 0.05);
    if (this.sirenOsc && this.sirenGain) {
      const wail = 700 + Math.sin(t * 5) * 220;
      this.sirenOsc.frequency.setTargetAtTime(wail, now, 0.03);
      this.sirenGain.gain.setTargetAtTime(active ? sirenLevel * 0.035 : 0, now, 0.2);
    }
  }

  private noise(dur: number, freq: number, gain: number, type: BiquadFilterType = "lowpass", sweepTo?: number) {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf || !this.master) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    if (sweepTo) filt.frequency.exponentialRampToValueAtTime(sweepTo, now + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.bus.effects ?? this.master);
    src.start(now, Math.random());
    src.stop(now + dur + 0.05);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, slideTo?: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const o = ctx.createOscillator();
    o.type = type;
    const g = ctx.createGain();
    const now = ctx.currentTime + delay;
    o.frequency.setValueAtTime(freq, now);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g);
    g.connect(this.bus.effects ?? this.master);
    o.start(now);
    o.stop(now + dur + 0.05);
  }

  crash(intensity: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastCrash < 0.08) return;
    this.lastCrash = now;
    const i = Math.min(1, intensity);
    this.noise(0.25 + i * 0.3, 900 + i * 1500, 0.25 + i * 0.5, "lowpass", 120);
    this.tone(90, 0.2, "square", 0.12 * i, 0, 40);
  }

  explosion() {
    this.noise(1.4, 1800, 0.9, "lowpass", 60);
    this.tone(70, 0.9, "sine", 0.5, 0, 25);
  }

  pickup(combo: number) {
    const base = 520 * Math.pow(1.06, Math.min(combo, 12));
    this.tone(base, 0.09, "square", 0.08);
    this.tone(base * 1.25, 0.09, "square", 0.08, 0.06);
    this.tone(base * 1.5, 0.16, "square", 0.08, 0.12);
  }

  powerup() {
    this.tone(300, 0.3, "sawtooth", 0.08, 0, 1200);
    this.tone(450, 0.3, "triangle", 0.08, 0.05, 1800);
  }

  nitro() {
    this.noise(0.6, 600, 0.35, "bandpass", 3000);
  }

  nearMiss() {
    this.noise(0.25, 2500, 0.2, "highpass", 600);
  }

  star() {
    this.tone(880, 0.12, "square", 0.07);
    this.tone(660, 0.2, "square", 0.07, 0.12);
  }

  bank() {
    this.tone(660, 0.08, "triangle", 0.1);
    this.tone(990, 0.18, "triangle", 0.1, 0.07);
  }

  shot() {
    this.noise(0.12, 2600, 0.5, "highpass", 400);
    this.tone(160, 0.08, "square", 0.18, 0, 60);
  }

  rocket() {
    this.noise(0.9, 400, 0.6, "bandpass", 2600);
    this.tone(90, 0.5, "sawtooth", 0.2, 0, 220);
  }

  throwIt() {
    this.noise(0.15, 1200, 0.15, "bandpass", 300);
  }

  empty() {
    this.tone(1200, 0.04, "square", 0.08);
    this.tone(900, 0.05, "square", 0.08, 0.05);
  }

  beep() {
    this.tone(1800, 0.06, "square", 0.08);
  }

  door() {
    this.noise(0.08, 500, 0.25, "lowpass", 200);
    this.tone(220, 0.08, "triangle", 0.12, 0, 120);
  }

  // a window breaks: crack, then shards falling
  glass() {
    this.noise(0.12, 5200, 0.5, "highpass", 2500);
    for (let i = 0; i < 6; i++) this.tone(2400 + Math.random() * 3000, 0.05, "triangle", 0.05, 0.08 + i * 0.05);
  }

  // car alarm: two tone horn
  alarm() {
    this.tone(880, 0.22, "square", 0.07, 0, 700);
    this.tone(660, 0.22, "square", 0.07, 0.25, 520);
  }

  land() {
    this.noise(0.25, 300, 0.4, "lowpass", 80);
  }

  gameOver() {
    this.tone(220, 0.5, "sawtooth", 0.12, 0, 110);
    this.tone(165, 0.8, "sawtooth", 0.12, 0.35, 55);
  }

  reload() {
    this.noise(0.05, 3000, 0.2, "highpass");
    this.tone(700, 0.04, "square", 0.06, 0.12);
    this.noise(0.06, 2500, 0.25, "highpass", 900);
  }

  punch() {
    this.noise(0.1, 700, 0.45, "lowpass", 150);
    this.tone(120, 0.08, "sine", 0.25, 0, 60);
  }

  swing() { this.noise(0.12, 1500, 0.12, "bandpass", 400); }

  shotgun() {
    this.noise(0.3, 1800, 0.8, "lowpass", 200);
    this.tone(90, 0.15, "square", 0.25, 0, 40);
  }

  cashier() {
    this.tone(1320, 0.07, "triangle", 0.1);
    this.tone(1760, 0.18, "triangle", 0.1, 0.07);
  }

  success() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, "square", 0.07, i * 0.11));
  }

  fail() {
    [392, 330, 262].forEach((f, i) => this.tone(f, 0.3, "sawtooth", 0.08, i * 0.16));
  }

  phone() {
    for (let i = 0; i < 3; i++) { this.tone(1400, 0.08, "square", 0.05, i * 0.18); this.tone(1100, 0.08, "square", 0.05, i * 0.18 + 0.08); }
  }

  checkpoint() {
    this.tone(880, 0.08, "triangle", 0.1);
    this.tone(1320, 0.12, "triangle", 0.1, 0.06);
  }

  // jet engine roar (police jets nearby, the player's jet)
  jet(level: number) {
    if (level <= 0.01) return;
    this.noise(0.12, 700 + level * 900, 0.22 * level, "bandpass", 300);
  }
  // helicopter rotor: short low noise bursts, called a few times per second while one is near
  rotor(level: number) {
    if (level <= 0.01) return;
    this.noise(0.07, 260, 0.35 * level, "lowpass", 90);
  }
}

export const sfx = new Sfx();
