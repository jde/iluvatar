/**
 * The browser stand-in for a synth: built like it (oscillators per voice, filter slope, mono or
 * poly, LFO destination) and driven by the same knobs. It does not sound identical — it lets a
 * composer hear what each knob does without owning the synth. docs/04-synths.md.
 */
import * as Tone from 'tone';
import { stepIndex } from './messages';
import type { Control, Profile, Role } from './types';

const exp = (lo: number, hi: number, v: number) => lo * Math.pow(hi / lo, Math.max(0, Math.min(1, v)));
const amount = (c: Control, v: number) => (c.bipolar ? Math.abs(v - 0.5) * 2 : v);

/** A knob position as the stand-in's engineering value. Pure, so it is unit-tested. */
export function roleValue(role: Role, c: Control, v: number): number {
  switch (role) {
    case 'cutoff': return exp(30, 18000, v); // Hz
    case 'resonance': return 0.7 + Math.pow(v, 1.5) * 18; // Q
    case 'amp_attack': case 'filter_attack': return exp(0.002, 8, v); // s
    case 'amp_decay': case 'filter_decay': case 'amp_release': case 'filter_release': return exp(0.005, 10, v);
    case 'amp_sustain': case 'filter_sustain': return v;
    case 'filter_env_amount': return (c.bipolar ? Math.max(0, v - 0.5) * 2 : v) * 6; // octaves (the stand-in only opens upward)
    case 'lfo_rate': return exp(0.05, 40, v); // Hz
    case 'lfo_depth': case 'mod_wheel': return amount(c, v);
    case 'osc_detune': return amount(c, v) * 60; // cents of spread between the oscillators
    case 'noise': return v <= 0.001 ? -Infinity : -40 + 34 * v; // dB
    case 'drive': return v * 0.8;
    case 'delay_time': return exp(0.03, 1.2, v);
    case 'delay_feedback': return v * 0.85;
    case 'delay_mix': case 'reverb_mix': return v;
    case 'portamento': return Math.pow(v, 2) * 1.5; // s
    case 'volume': case 'expression': return v <= 0.001 ? -Infinity : -40 + 40 * v; // dB
    default: return v;
  }
}

/** The wave a shape switch's step names, by its words ("SAW", "Square", "TRI"…), or null. */
export function waveFromStep(meaning: string): 'sawtooth' | 'square' | 'triangle' | 'sine' | null {
  const m = meaning.toLowerCase();
  if (/saw|ramp/.test(m)) return 'sawtooth';
  if (/squ|pulse|pwm|sqr/.test(m)) return 'square';
  if (/tri/.test(m)) return 'triangle';
  if (/sin/.test(m)) return 'sine';
  return null;
}

/** Roles the stand-in models. Other knobs move only the real synth. */
export const HEARD_ROLES: Role[] = ['cutoff', 'resonance', 'filter_env_amount', 'filter_attack', 'filter_decay', 'filter_sustain', 'filter_release',
  'amp_attack', 'amp_decay', 'amp_sustain', 'amp_release', 'lfo_rate', 'lfo_depth', 'mod_wheel', 'osc_detune', 'osc_shape', 'noise', 'drive',
  'delay_time', 'delay_feedback', 'delay_mix', 'reverb_mix', 'portamento', 'volume', 'expression'];

/** The control that drives each role in the stand-in: the first one on the panel with that role. */
export function standInControls(p: Profile): Map<Role, Control> {
  const m = new Map<Role, Control>();
  for (const [r, id] of Object.entries(p.standIn.use ?? {}) as [Role, string][]) { const c = p.controls.find((x) => x.id === id); if (c) m.set(r, c); }
  for (const c of p.controls) if (HEARD_ROLES.includes(c.role) && !m.has(c.role)) {
    if (c.role === 'osc_shape' && !(c.kind === 'switch' && c.steps?.some((s) => waveFromStep(s.meaning)))) continue;
    m.set(c.role, c);
  }
  return m;
}

type Synth = Tone.PolySynth<Tone.MonoSynth> | Tone.MonoSynth;

export class StandInVoice {
  private synth: Synth;
  private noise: Tone.NoiseSynth;
  private vibrato: Tone.Vibrato | null = null;
  private autoFilter: Tone.AutoFilter | null = null;
  private drive: Tone.Distortion;
  private delay: Tone.FeedbackDelay;
  private reverb: Tone.Freeverb;
  private out: Tone.Volume;
  private roles: Map<Role, Control>;
  private last = new Map<string, number | string>();
  private wave: string;

  constructor(readonly profile: Profile, destination: Tone.InputNode) {
    const s = profile.standIn;
    this.roles = standInControls(profile);
    this.wave = s.wave;
    const opts = {
      oscillator: (s.oscillators > 1 ? { type: `fat${s.wave}`, count: s.oscillators, spread: 12 } : { type: s.wave }) as any,
      filter: { type: s.filter.type, rolloff: s.filter.rolloff, Q: 1 },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0.7, release: 0.4 },
      filterEnvelope: { attack: 0.005, decay: 0.4, sustain: 0.4, release: 0.5, baseFrequency: 800, octaves: 2, exponent: 2 },
    };
    this.synth = profile.voices === 1 ? new Tone.MonoSynth(opts) : new Tone.PolySynth({ voice: Tone.MonoSynth, maxPolyphony: Math.max(2, profile.voices), options: opts });
    this.noise = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.005, decay: 0.3, sustain: 0.7, release: 0.4 }, volume: -Infinity });
    this.drive = new Tone.Distortion({ distortion: 0, wet: 0 });
    this.delay = new Tone.FeedbackDelay({ delayTime: 0.3, feedback: 0.3, wet: 0 });
    this.reverb = new Tone.Freeverb({ roomSize: 0.8, dampening: 3000, wet: 0 });
    this.out = new Tone.Volume(-6);
    const chain: Tone.ToneAudioNode[] = [this.drive];
    if (this.roles.has('lfo_depth') || this.roles.has('mod_wheel')) {
      if (s.lfoTo === 'pitch') { this.vibrato = new Tone.Vibrato({ frequency: 5, depth: 0, wet: 1 }); chain.push(this.vibrato); }
      else { this.autoFilter = new Tone.AutoFilter({ frequency: 2, baseFrequency: 300, octaves: 4, depth: 1, wet: 0 }).start(); chain.push(this.autoFilter); }
    }
    chain.push(this.delay, this.reverb, this.out);
    this.synth.connect(chain[0]); this.noise.connect(chain[0]);
    for (let i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1]);
    this.out.connect(destination);
  }

  /** Every knob's position (0..1, by control id) — the patch plus whatever the rules are turning. */
  apply(values: Record<string, number>, level: number) {
    const val = (r: Role) => { const c = this.roles.get(r); return c ? roleValue(r, c, values[c.id] ?? c.init ?? (c.bipolar ? 0.5 : 0)) : undefined; };
    const changed = (k: string, x: number | string | undefined) => { if (x === undefined || this.last.get(k) === x) return false; this.last.set(k, x); return true; };
    const env: Record<string, number> = {}, fenv: Record<string, number> = {};
    for (const [r, k] of [['amp_attack', 'attack'], ['amp_decay', 'decay'], ['amp_sustain', 'sustain'], ['amp_release', 'release']] as const) { const x = val(r); if (x !== undefined) env[k] = x; }
    for (const [r, k] of [['filter_attack', 'attack'], ['filter_decay', 'decay'], ['filter_sustain', 'sustain'], ['filter_release', 'release']] as const) { const x = val(r); if (x !== undefined) fenv[k] = x; }
    const cutoff = val('cutoff'), q = val('resonance'), octaves = val('filter_env_amount'), spread = val('osc_detune'), glide = val('portamento');
    if (cutoff !== undefined) fenv.baseFrequency = cutoff;
    if (octaves !== undefined) fenv.octaves = octaves;
    const shapeCtl = this.roles.get('osc_shape');
    if (shapeCtl) { const w = waveFromStep(shapeCtl.steps![stepIndex(shapeCtl, values[shapeCtl.id] ?? shapeCtl.init ?? 0)].meaning); if (w) this.wave = w; }
    const patch: any = {};
    if (Object.keys(env).length) patch.envelope = env;
    if (Object.keys(fenv).length) patch.filterEnvelope = fenv;
    if (q !== undefined) patch.filter = { Q: q };
    const osc: any = this.profile.standIn.oscillators > 1 ? { type: `fat${this.wave}`, ...(spread !== undefined ? { spread } : {}) } : { type: this.wave };
    patch.oscillator = osc;
    if (glide !== undefined) patch.portamento = glide;
    if (changed('patch', JSON.stringify(patch))) this.synth.set(patch);
    if (Object.keys(env).length && changed('noiseEnv', JSON.stringify(env))) this.noise.set({ envelope: env });
    const n = val('noise'); if (n !== undefined && changed('noise', n)) this.noise.volume.value = n;
    const d = val('drive'); if (d !== undefined && changed('drive', d)) { this.drive.distortion = d; this.drive.wet.value = d > 0.01 ? 1 : 0; }
    const dt = val('delay_time'), fb = val('delay_feedback'), dm = val('delay_mix'), rv = val('reverb_mix');
    if (dt !== undefined && changed('dt', dt)) this.delay.delayTime.rampTo(dt, 0.1);
    if (fb !== undefined && changed('fb', fb)) this.delay.feedback.rampTo(fb, 0.1);
    if (dm !== undefined && changed('dm', dm)) this.delay.wet.rampTo(dm, 0.1);
    if (rv !== undefined && changed('rv', rv)) this.reverb.wet.rampTo(rv, 0.1);
    const rate = val('lfo_rate'), depth = val('lfo_depth') ?? val('mod_wheel');
    if (this.vibrato) { if (rate !== undefined && changed('rate', rate)) this.vibrato.frequency.rampTo(rate, 0.1); if (depth !== undefined && changed('depth', depth)) this.vibrato.depth.rampTo(depth * 0.4, 0.1); }
    if (this.autoFilter) {
      if (rate !== undefined && changed('rate', rate)) this.autoFilter.frequency.rampTo(rate, 0.1);
      if (depth !== undefined && changed('depth', depth)) this.autoFilter.wet.rampTo(depth, 0.1);
      if (cutoff !== undefined && changed('afBase', cutoff)) this.autoFilter.baseFrequency = Math.max(30, cutoff / 4);
    }
    const vol = val('volume') ?? 0, expr = val('expression') ?? 0;
    const db = (Number.isFinite(vol) && Number.isFinite(expr) ? vol + expr : -Infinity) + 20 * Math.log10(Math.max(1e-4, level)) - 6;
    if (changed('vol', Math.round(db * 10))) this.out.volume.rampTo(Number.isFinite(db) ? db : -Infinity, 0.05);
  }

  /** Start a note; returns its stop. Velocity 0–127, times on the audio clock. */
  start(note: number, time: number, duration: number, velocity: number): (at?: number) => void {
    const f = Tone.Frequency(note, 'midi').toFrequency(), vel = Math.max(0.05, Math.min(1, velocity / 127));
    this.synth.triggerAttack(f, time, vel);
    this.noise.triggerAttack(time, vel);
    let done = false;
    const stop = (at?: number) => {
      if (done) return; done = true;
      const t = Math.max(at ?? Tone.now(), time + 0.01);
      if (this.synth instanceof Tone.PolySynth) this.synth.triggerRelease(f, t); else this.synth.triggerRelease(t);
      this.noise.triggerRelease(t);
    };
    const ms = (time + duration - Tone.now()) * 1000;
    setTimeout(() => stop(time + duration), Math.max(0, ms - 100));
    return stop;
  }

  dispose() {
    for (const n of [this.synth, this.noise, this.vibrato, this.autoFilter, this.drive, this.delay, this.reverb, this.out]) n?.dispose();
  }
}
