/**
 * The renderer: turns effects into sound. Tone.js keeps the clock (Transport, bpm, quantized
 * scheduling); smplr plays General MIDI SoundFont instruments (FluidR3_GM) on the same AudioContext.
 * docs/01 §5, docs/02 §2. Nothing in here knows about Datadog or rules — only sounds and effects.
 */
import * as Tone from 'tone';
import { Soundfont, getSoundfontNames, CacheStorage } from 'smplr';
import { smoothStep } from '../core/curves';
import { degreeToMidi, KEY_ROOTS, parseMotif, type Motif } from '../core/motif';
import type { Clock, Concept, Effect, Property, Sound, SoundId } from '../core/types';

export const INSTRUMENT_NAMES: string[] = getSoundfontNames();

type Params = Record<Property, number>;
const DEFAULT_PARAMS: Params = { volume: 1, density: 0.6, brightness: 0.6, tension: 0, register: 0.5 };

interface Voice {
  sound: Sound;
  inst: Soundfont | null;
  loading: Promise<void> | null;
  loadedInstrument: string | null;
  target: Params;
  current: Params;
  concepts: Set<Concept>;
  motif: Motif;
  step: number;
  droneStops: ((time?: number) => void)[];
  droneNotes: number[];
  droneRetriggerAt: number;
}

export class AudioEngine {
  private voices = new Map<SoundId, Voice>();
  private master: Tone.Gain | null = null;
  private reverb: Tone.Reverb | null = null;
  private clock: Clock = { bpm: 66, key: 'D', mode: 'ionian' };
  private storage = new CacheStorage('iluvatar-soundfonts');
  public started = false;
  public playing = false;
  public masterVolume = 0.8;
  /** Last (sound, property) values the renderer applied — the UI reads these. */
  public readonly live = new Map<SoundId, Params>();
  /** Instruments loaded for previews (the library page and the preset picker), by name. */
  private previewInstruments = new Map<string, Promise<Soundfont>>();
  private previewStops: ((time?: number) => void)[] = [];
  /** What is being previewed right now, for the UI: a preset id or a sound id. */
  public previewing: string | null = null;

  async start() {
    if (this.started) return;
    await Tone.start();
    this.master = new Tone.Gain(this.masterVolume);
    this.reverb = new Tone.Reverb({ decay: 7, wet: 0.35 });
    await this.reverb.ready;
    this.master.chain(this.reverb, Tone.getDestination());
    this.started = true;
    this.setClock(this.clock);
    // The step clock: one tick per 8th note drives loops, drone retriggers and parameter smoothing.
    Tone.getTransport().scheduleRepeat((time) => this.onStep(time), '8n');
  }

  play() { if (!this.started) return; Tone.getTransport().start(); this.playing = true; }
  pause() { Tone.getTransport().pause(); this.playing = false; for (const v of this.voices.values()) this.stopDrone(v); }

  setMasterVolume(v: number) { this.masterVolume = v; this.master?.gain.rampTo(v, 0.1); }

  setClock(c: Clock) {
    this.clock = c;
    if (this.started) Tone.getTransport().bpm.rampTo(c.bpm, 0.5);
    for (const v of this.voices.values()) if (v.sound.kind === 'drone') v.droneRetriggerAt = 0; // re-voice on next step
  }

  /** Create, update or remove voices so they match the score. Instrument loads are async and cached. */
  syncSounds(sounds: Sound[]) {
    const ids = new Set(sounds.map((s) => s.id));
    for (const [id, v] of this.voices) if (!ids.has(id)) { this.stopDrone(v); v.inst?.disconnect(); this.voices.delete(id); this.live.delete(id); }
    for (const s of sounds) {
      let v = this.voices.get(s.id);
      if (!v) {
        v = { sound: s, inst: null, loading: null, loadedInstrument: null, target: { ...DEFAULT_PARAMS }, current: { ...DEFAULT_PARAMS }, concepts: new Set(), motif: parseMotif(s.notes ?? '').motif, step: 0, droneStops: [], droneNotes: [], droneRetriggerAt: 0 };
        this.voices.set(s.id, v);
      }
      const notesChanged = v.sound.notes !== s.notes, degreesChanged = JSON.stringify(v.sound.degrees) !== JSON.stringify(s.degrees);
      v.sound = s;
      if (notesChanged) v.motif = parseMotif(s.notes ?? '').motif;
      if (degreesChanged) v.droneRetriggerAt = 0;
      if (this.started && v.loadedInstrument !== s.instrument && !v.loading) this.loadInstrument(v);
    }
  }

  private loadInstrument(v: Voice) {
    const name = v.sound.instrument;
    const ctx = Tone.getContext().rawContext as AudioContext;
    const old = v.inst;
    const inst = new Soundfont(ctx, { instrument: name, kit: 'FluidR3_GM', storage: this.storage, destination: this.master!.input as AudioNode, loadLoopData: true });
    v.loading = inst.load.then(() => {
      old?.disconnect();
      v.inst = inst; v.loadedInstrument = name; v.loading = null; v.droneRetriggerAt = 0;
      if (v.sound.instrument !== name) this.loadInstrument(v); // changed again while loading
    }).catch((e) => { console.error('instrument load failed', name, e); v.loading = null; });
  }

  isLoaded(id: SoundId) { const v = this.voices.get(id); return !!v && v.inst !== null && v.loadedInstrument === v.sound.instrument; }

  /** Effects from the rule engine, once per tick. `set` updates targets; `concept` toggles; `trigger` schedules a motif. */
  applyEffects(effects: Effect[]) {
    for (const e of effects) {
      if (e.kind === 'set') { const v = this.voices.get(e.sound); if (v) { v.target[e.property] = e.value; (v as any)._smooth = e.smooth; } }
      else if (e.kind === 'concept') {
        const targets = e.sound === 'piece' ? [...this.voices.values()] : [this.voices.get(e.sound)].filter(Boolean) as Voice[];
        for (const v of targets) { if (e.active) v.concepts.add(e.concept); else v.concepts.delete(e.concept); v.droneRetriggerAt = 0; }
      } else if (e.kind === 'trigger') this.triggerMotif(e.sound, e.quantize);
    }
  }

  /** Play a sound's material once, now — the ▶ button in the Sounds panel. */
  audition(id: SoundId) {
    const v = this.voices.get(id);
    if (!v || !v.inst) return;
    if (v.sound.kind === 'drone') { this.stopDrone(v); this.startDrone(v, Tone.now(), 4); v.droneRetriggerAt = Tone.now() + 4; return; }
    this.playMotif(v, Tone.now());
  }

  private triggerMotif(id: SoundId, quantize: 'beat' | 'bar') {
    const v = this.voices.get(id);
    if (!v || !v.inst || !this.playing) return;
    const t = Tone.getTransport().nextSubdivision(quantize === 'bar' ? '1m' : '4n');
    this.playMotif(v, t);
  }

  private playMotif(v: Voice, at: number) {
    if (!v.inst) return;
    const stepDur = Tone.Time('8n').toSeconds();
    const shift = KEY_ROOTS[this.clock.key] ?? 0; // written in C, played in the key
    const reg = Math.round((v.current.register - 0.5) * 24);
    for (const n of v.motif.notes) {
      v.inst.start({ note: n.midi + shift + reg, time: at + n.step * stepDur, duration: n.steps * stepDur * 0.95, velocity: 40 + 80 * v.current.volume * v.sound.volume, lpfCutoffHz: this.cutoff(v), detune: this.detune(v) });
    }
  }

  /**
   * Play any material once with any instrument, outside the score — the ▶ in the library and the
   * picker. Notes are "written in C" and played in the current key, like a motif. Resolves when the
   * instrument has loaded and the notes are scheduled.
   */
  async preview(tag: string, instrument: string, notes: string, volume = 0.8): Promise<void> {
    if (!this.started) return;
    this.stopPreview();
    this.previewing = tag;
    const inst = await this.loadPreviewInstrument(instrument);
    if (this.previewing !== tag) return; // another preview started while loading
    const stepDur = Tone.Time('8n').toSeconds();
    const shift = KEY_ROOTS[this.clock.key] ?? 0;
    const motif = parseMotif(notes).motif;
    const at = Tone.now() + 0.05;
    for (const n of motif.notes) this.previewStops.push(inst.start({ note: n.midi + shift, time: at + n.step * stepDur, duration: n.steps * stepDur * 0.95, velocity: 40 + 80 * volume }));
    const total = motif.length * stepDur;
    window.setTimeout(() => { if (this.previewing === tag) this.previewing = null; }, total * 1000 + 300);
  }

  stopPreview() { for (const s of this.previewStops) s(); this.previewStops = []; this.previewing = null; }

  private loadPreviewInstrument(name: string): Promise<Soundfont> {
    let p = this.previewInstruments.get(name);
    if (!p) {
      const ctx = Tone.getContext().rawContext as AudioContext;
      const inst = new Soundfont(ctx, { instrument: name, kit: 'FluidR3_GM', storage: this.storage, destination: this.master!.input as AudioNode, loadLoopData: true });
      p = inst.load.then(() => inst);
      p.catch(() => this.previewInstruments.delete(name));
      this.previewInstruments.set(name, p);
    }
    return p;
  }

  private cutoff(v: Voice) { return 250 + 9000 * Math.pow(v.current.brightness, 2); }
  private detune(v: Voice) { return v.current.tension * 18; } // cents, sharp: tension is heard as "off"

  private onStep(time: number) {
    const dt = Tone.Time('8n').toSeconds();
    for (const v of this.voices.values()) {
      const s = (v as any)._smooth ?? 1;
      for (const p of Object.keys(v.current) as Property[]) v.current[p] = smoothStep(v.current[p], v.target[p], s, dt);
      this.live.set(v.sound.id, { ...v.current });
      if (!v.inst) continue;
      v.inst.output.setVolume(Math.round(100 * v.current.volume * v.sound.volume));
      if (v.sound.kind === 'loop') this.loopStep(v, time, dt);
      if (v.sound.kind === 'drone' && time >= v.droneRetriggerAt) { this.stopDrone(v, time + 0.5); this.startDrone(v, time, 8); v.droneRetriggerAt = time + Tone.Time('2m').toSeconds(); }
    }
  }

  /** Density decides which steps of the written loop sound: downbeats first, then more as density rises. */
  private loopStep(v: Voice, time: number, stepDur: number) {
    if (v.motif.length === 0) return;
    const i = v.step % v.motif.length; v.step++;
    const note = v.motif.notes.find((n) => n.step === i);
    if (!note) return;
    const weight = i % 8 === 0 ? 0 : i % 4 === 0 ? 0.25 : i % 2 === 0 ? 0.5 : 0.8; // how much density a step needs
    let density = v.current.density;
    if (v.concepts.has('sparse')) density *= 0.4;
    if (density < weight) return;
    const shift = KEY_ROOTS[this.clock.key] ?? 0, reg = Math.round((v.current.register - 0.5) * 24);
    v.inst!.start({ note: note.midi + shift + reg, time, duration: note.steps * stepDur * 0.9, velocity: 50 + 60 * density, lpfCutoffHz: this.cutoff(v), detune: this.detune(v) });
  }

  private chord(v: Voice): number[] {
    const root = KEY_ROOTS[this.clock.key] ?? 0;
    const notes = (v.sound.degrees ?? [1, 5, 8]).map((d) => degreeToMidi(d, root, this.clock.mode, 3));
    const fix = (m: number) => {
      const iv = ((m - root) % 12 + 12) % 12;
      if (v.concepts.has('minor') && iv === 4) return m - 1;
      if (v.concepts.has('major') && iv === 3) return m + 1;
      if (v.concepts.has('suspended') && (iv === 3 || iv === 4)) return m + (iv === 3 ? 2 : 1);
      return m;
    };
    const out = notes.map(fix);
    if (v.current.tension > 0.15) out.push(root + 12 * 5 + 1); // a minor second above the root, high, as the tension tone
    return out;
  }

  private startDrone(v: Voice, time: number, seconds: number) {
    if (!v.inst) return;
    const notes = this.chord(v); v.droneNotes = notes;
    const tensionTone = notes[notes.length - 1];
    for (const m of notes) {
      const isTension = v.current.tension > 0.15 && m === tensionTone;
      const vel = isTension ? 20 + 70 * v.current.tension : 40 + 40 * v.current.volume;
      v.droneStops.push(v.inst.start({ note: m, time, duration: seconds, velocity: vel, lpfCutoffHz: this.cutoff(v), detune: this.detune(v) }));
    }
  }

  private stopDrone(v: Voice, at?: number) { for (const s of v.droneStops) s(at); v.droneStops = []; }
}
