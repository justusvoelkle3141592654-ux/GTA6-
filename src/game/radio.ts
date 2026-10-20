import { mulberry32 } from "./world";

// generative radio: every station is a small step sequencer with its own style
export interface Station {
  id: string; name: string; genre: string; color: string;
  bpm: number;
  root: number;           // midi note of the key
  scale: number[];        // semitones of the scale
  chords: number[];       // scale degree per bar (4 bars loop)
  kick: string; snare: string; hat: string; // 16-step patterns, "x" = hit
  bass: string;           // 16 steps: "x" root, "o" fifth, "-" rest
  bassWave: OscillatorType; leadWave: OscillatorType; padWave: OscillatorType;
  leadDensity: number;    // chance of a lead note per 8th
  swing: number;          // 0..0.3
  seed: number;
}

export const STATIONS: Station[] = [
  {
    id: "bayfm", name: "BAY FM 88.4", genre: "Synthwave", color: "#ff3cac", bpm: 104, root: 45, scale: [0, 2, 3, 5, 7, 8, 10],
    chords: [0, 5, 3, 6], kick: "x---x---x---x---", snare: "----x-------x---", hat: "--x---x---x---x-", bass: "x-xox-xox-xox-xo",
    bassWave: "sawtooth", leadWave: "square", padWave: "sawtooth", leadDensity: 0.45, swing: 0, seed: 11,
  },
  {
    id: "palmera", name: "CLUB PALMERA 101", genre: "House", color: "#2bf0ff", bpm: 124, root: 48, scale: [0, 2, 4, 5, 7, 9, 11],
    chords: [0, 3, 4, 3], kick: "x---x---x---x---", snare: "----x-------x---", hat: "--x---x---x---xx", bass: "--x---x---x--ox-",
    bassWave: "square", leadWave: "triangle", padWave: "triangle", leadDensity: 0.3, swing: 0.08, seed: 23,
  },
  {
    id: "chill", name: "KANAL CHILL 94.2", genre: "Lo-Fi", color: "#ffd23f", bpm: 78, root: 50, scale: [0, 2, 3, 5, 7, 9, 10],
    chords: [0, 3, 6, 4], kick: "x-----x---x-----", snare: "----x-------x---", hat: "x-x-x-x-x-x-x-x-", bass: "x-----o---x-----",
    bassWave: "triangle", leadWave: "sine", padWave: "triangle", leadDensity: 0.35, swing: 0.22, seed: 37,
  },
];

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Radio {
  station = -1; // -1: off
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private next = 0; private step = 0;
  private playing = false;

  get current(): Station | null { return this.station >= 0 ? STATIONS[this.station] : null; }

  // next station (wraps through "off")
  cycle(): Station | null {
    this.station = this.station + 1 >= STATIONS.length ? -1 : this.station + 1;
    this.step = 0; this.next = 0;
    return this.current;
  }

  // call every frame; on = the player sits in a car and the game runs
  update(ctx: AudioContext | null, out: GainNode | null, on: boolean) {
    if (!ctx || !out) return;
    if (this.ctx !== ctx) { this.ctx = ctx; this.out = out; this.noise = this.makeNoise(ctx); }
    const st = this.current;
    if (!on || !st) { this.playing = false; return; }
    const now = ctx.currentTime;
    if (!this.playing || this.next < now) { this.next = now + 0.05; this.playing = true; }
    const dur = 60 / st.bpm / 4;
    while (this.next < now + 0.25) {
      const sw = this.step % 2 === 1 ? dur * st.swing : 0;
      this.playStep(st, this.step, this.next + sw, dur);
      this.next += dur; this.step++;
    }
  }

  private makeNoise(ctx: AudioContext) {
    const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  private playStep(st: Station, step: number, t: number, dur: number) {
    const s = step % 16, bar = Math.floor(step / 16);
    const deg = st.chords[bar % st.chords.length];
    const note = (d: number, oct = 0) => st.root + st.scale[((d % 7) + 7) % 7] + 12 * (oct + Math.floor(d / 7));
    if (st.kick[s] === "x") this.kick(t);
    if (st.snare[s] === "x") this.snare(t);
    if (st.hat[s] === "x") this.hat(t, s % 4 === 2 ? 0.05 : 0.03);
    const b = st.bass[s];
    if (b === "x" || b === "o") this.osc(midiHz(note(deg + (b === "o" ? 4 : 0), -1)), t, dur * 1.8, st.bassWave, 0.11, 600);
    if (s === 0) for (const k of [0, 2, 4]) this.osc(midiHz(note(deg + k, 1)), t, dur * 15, st.padWave, 0.025, 1400, 0.3);
    // lead: repeats every 8 bars (seeded per bar)
    if (s % 2 === 0) {
      const r = mulberry32(st.seed * 1000 + (bar % 8) * 16 + s);
      if (r() < st.leadDensity) this.osc(midiHz(note(deg + Math.floor(r() * 7), 2)), t, dur * (1 + Math.floor(r() * 3)), st.leadWave, 0.045, 2600);
    }
  }

  private osc(f: number, t: number, len: number, type: OscillatorType, gain: number, cutoff: number, attack = 0.01) {
    const ctx = this.ctx!, o = ctx.createOscillator(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    flt.type = "lowpass"; flt.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(flt); flt.connect(g); g.connect(this.out!);
    o.start(t); o.stop(t + len + 0.05);
  }

  private kick(t: number) {
    const ctx = this.ctx!, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g); g.connect(this.out!); o.start(t); o.stop(t + 0.3);
  }

  private noiseHit(t: number, len: number, type: BiquadFilterType, f: number, gain: number) {
    const ctx = this.ctx!, src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noise; flt.type = type; flt.frequency.value = f;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(flt); flt.connect(g); g.connect(this.out!);
    src.start(t, Math.random() * 0.5); src.stop(t + len + 0.02);
  }
  private snare(t: number) { this.noiseHit(t, 0.16, "bandpass", 1900, 0.22); }
  private hat(t: number, len: number) { this.noiseHit(t, len, "highpass", 7500, 0.07); }
}
