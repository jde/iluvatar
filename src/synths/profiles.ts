/**
 * The synth library. Two layers, kept apart on purpose:
 *  - research/*.json: what each maker's MIDI implementation chart says (CC/NRPN numbers, panel
 *    labels, setup steps, sources). Facts only; gaps stay null.
 *  - OVERLAY below: our choices — how the browser stand-in is built, where its knobs start, and
 *    which knob each of the score's properties turns by default.
 * docs/04-synths.md.
 */
import korgRoland from './research/korg-roland.json';
import arturiaNovation from './research/arturia-novation.json';
import moogSequentialBehringer from './research/moog-sequential-behringer.json';
import software from './research/software.json';
import type { Property } from '../core/types';
import type { Control, Profile, Role, StandIn } from './types';

const ROLES: Role[] = ['cutoff', 'resonance', 'filter_env_amount', 'filter_attack', 'filter_decay', 'filter_sustain', 'filter_release',
  'amp_attack', 'amp_decay', 'amp_sustain', 'amp_release', 'lfo_rate', 'lfo_depth', 'osc_detune', 'osc_shape', 'osc_mix', 'noise', 'drive',
  'delay_time', 'delay_feedback', 'delay_mix', 'reverb_mix', 'portamento', 'volume', 'mod_wheel', 'expression', 'other'];

interface Overlay {
  standIn: StandIn;
  /** Knob starting positions for the stand-in's patch (0..1). */
  init?: Record<string, number>;
  /** Controls whose centre is "off". */
  bipolar?: string[];
  /** Override the automatic property → knob map. */
  map?: Partial<Record<Property, { control: string; range: [number, number] } | null>>;
  voices?: number;
  noteRange?: [number, number];
  /** Shorter display names where the research record is long-winded. */
  name?: string;
  maker?: string;
}

type Raw = any;

/** Turn one research record into a profile: numbers checked, nulls dropped, controls without MIDI left out. */
export function normalize(r: Raw, o: Overlay | undefined): Profile {
  const seen = new Set<string>();
  const controls: Control[] = [];
  for (const c of r.controls ?? []) {
    const n = c.nrpn ? { param: c.nrpn.param ?? ((c.nrpn.msb ?? 0) << 7) + (c.nrpn.lsb ?? 0), max: c.nrpn.max ?? 127 } : undefined;
    const cc = Number.isInteger(c.cc) ? c.cc : undefined;
    if (cc === undefined && !n) continue; // no MIDI address: nothing we can turn
    let id = String(c.id); while (seen.has(id)) id += '_'; seen.add(id);
    const role: Role = ROLES.includes(c.role) ? c.role : 'other';
    const steps = Array.isArray(c.steps) && c.steps.length ? c.steps.filter((s: Raw) => Number.isFinite(s.from) && Number.isFinite(s.to)) : undefined;
    controls.push({
      id, label: c.label, section: c.section ?? 'NO PANEL KNOB', role,
      kind: c.kind === 'switch' ? 'switch' : 'continuous',
      ...(cc !== undefined ? { cc } : {}), ...(Number.isInteger(c.ccLsb) ? { ccLsb: c.ccLsb } : {}), ...(n ? { nrpn: n } : {}),
      ...(steps?.length ? { steps } : {}),
      ...(o?.bipolar?.includes(id) || c.bipolar ? { bipolar: true } : {}),
      ...(o?.init?.[id] !== undefined ? { init: o.init[id] } : ROLE_INIT[role] !== undefined ? { init: ROLE_INIT[role] } : {}),
      ...(c.notes ? { notes: c.notes } : {}),
      ...(r.fixedCcMap === false && c.default === false ? { suggested: true } : {}),
    });
  }
  // A suggested CC must not land on one the synth already uses (Vital always reads CC 74 as Slide):
  // move it to the first free number in MIDI's undefined block, 20–31.
  const taken = new Set(controls.filter((c) => !c.suggested && c.cc !== undefined).map((c) => c.cc));
  for (const c of controls) if (c.suggested && c.cc !== undefined) {
    if (taken.has(c.cc)) { let n = 20; while (taken.has(n) && n < 32) n++; c.notes = `${c.notes ? c.notes + ' ' : ''}Suggested CC ${c.cc} is taken on this synth, so CC ${n} is used instead.`; c.cc = n; }
    taken.add(c.cc);
  }
  const p: Profile = {
    id: r.id, name: o?.name ?? r.name, maker: o?.maker ?? r.maker, kind: r.kind === 'software' ? 'software' : r.kind === 'standard' ? 'standard' : 'hardware',
    popularity: r.popularity ?? '',
    voices: o?.voices ?? (Number.isInteger(r.voices) ? r.voices : 8),
    ...(o?.noteRange ? { noteRange: o.noteRange } : Array.isArray(r.noteRange) && r.noteRange.every(Number.isInteger) ? { noteRange: r.noteRange as [number, number] } : {}),
    defaultChannel: Number.isInteger(r.defaultChannel) ? r.defaultChannel : 1,
    bendRangeSemitones: Number.isFinite(r.bendRangeSemitones?.default) ? r.bendRangeSemitones.default : 2,
    respondsTo: r.respondsTo ?? {},
    ...(r.fixedCcMap === false ? { learnOnly: true } : {}),
    controls,
    defaultMap: {},
    setup: r.setup ?? [],
    ...(r.learnSteps ? { learnSteps: r.learnSteps } : {}),
    sources: r.sources ?? [],
    confidence: r.confidence ?? '',
    ...(typeof r.uncontrollable === 'string' ? { limits: r.uncontrollable } : {}),
    standIn: o?.standIn ?? { wave: 'sawtooth', oscillators: 2, filter: { type: 'lowpass', rolloff: -24 }, lfoTo: 'pitch' },
  };
  p.defaultMap = defaultMap(p, o?.map);
  return p;
}

/** Brightness turns the filter cutoff, tension the resonance, volume the volume knob — the obvious knobs, where the synth has them. */
export function defaultMap(p: Profile, over: Overlay['map'] = {}): Profile['defaultMap'] {
  const first = (role: Role) => p.controls.find((c) => c.role === role && c.kind === 'continuous')?.id;
  const m: Profile['defaultMap'] = {};
  const auto: [Property, Role, [number, number]][] = [['brightness', 'cutoff', [0.15, 0.9]], ['tension', 'resonance', [0.05, 0.75]], ['volume', 'volume', [0, 1]]];
  for (const [prop, role, range] of auto) { const id = first(role); if (id) m[prop] = { control: id, range }; }
  for (const [k, v] of Object.entries(over ?? {}) as [Property, { control: string; range: [number, number] } | null][]) { if (v === null) delete m[k]; else m[k] = v; }
  return m;
}

/** Where the stand-in's knobs start when a synth's overlay says nothing: a plain, open patch. */
const ROLE_INIT: Partial<Record<Role, number>> = {
  cutoff: 0.62, resonance: 0.15, amp_attack: 0.02, amp_decay: 0.5, amp_sustain: 0.8, amp_release: 0.3,
  filter_attack: 0.05, filter_decay: 0.45, filter_sustain: 0.3, filter_release: 0.3, filter_env_amount: 0.4,
  lfo_rate: 0.4, lfo_depth: 0, mod_wheel: 0, osc_detune: 0.12, osc_mix: 0.8, noise: 0, drive: 0,
  delay_time: 0.4, delay_feedback: 0.3, delay_mix: 0, reverb_mix: 0.15, portamento: 0, volume: 0.8, expression: 1,
};

const lp24 = { type: 'lowpass', rolloff: -24 } as const, lp12 = { type: 'lowpass', rolloff: -12 } as const;

/**
 * Our choices per synth (see the header). Architecture (voices, oscillators, filter poles) from
 * each maker's spec sheet; starting knob positions are a plain patch, not a factory preset.
 */
const OVERLAY: Record<string, Overlay> = {
  // 4 voices, 2 analog VCOs + multi engine, 2-pole filter. VCO PITCH and EG INT are centre-zero.
  'minilogue-xd': {
    standIn: { wave: 'sawtooth', oscillators: 2, filter: lp12, lfoTo: 'filter', use: { osc_shape: 'vco1_wave', osc_detune: 'vco2_pitch' } },
    bipolar: ['vco1_pitch', 'vco2_pitch', 'eg_int'],
    init: { vco1_wave: 0.83, vco2_wave: 0.83, vco2_pitch: 0.53, eg_int: 0.7, mixer_multi: 0, delay_dry_wet: 0, reverb_dry_wet: 0.2 },
  },
  // 3 voices (paraphonic), 1 VCO per voice, MS-20-style 2-pole filter; no volume CC, expression (CC 11) instead.
  'volca-keys': { standIn: { wave: 'sawtooth', oscillators: 1, filter: lp12, lfoTo: 'pitch' }, init: { vcf_eg_int: 0.5 } },
  // Juno-106 circuit: 4 voices, 1 DCO (saw + pulse + sub), 4-pole filter, LFO into the DCO.
  'ju-06a': { standIn: { wave: 'sawtooth', oscillators: 1, filter: lp24, lfoTo: 'pitch' }, init: { dco_sub: 0.3, vca_level: 0.8 } },
  // SH-101 circuit: 4 voices on the Boutique, 1 VCO (pulse, saw, sub), 4-pole filter.
  'sh-01a': { standIn: { wave: 'sawtooth', oscillators: 1, filter: lp24, lfoTo: 'pitch' }, init: { mix_saw: 0.8, mix_pulse: 0, mix_sub: 0.3 } },
  // 4-voice paraphonic, one digital oscillator, analog 2-pole filter.
  'microfreak': { standIn: { wave: 'sawtooth', oscillators: 1, filter: lp12, lfoTo: 'pitch' } },
  // 6 voices, 2 digital oscillators, analog 2-pole filter.
  'minifreak': { standIn: { wave: 'sawtooth', oscillators: 2, filter: lp12, lfoTo: 'filter' } },
  // Mono, 2 oscillators + sub, 12/24 dB filter (24 in the init patch), LFO 2 into the filter.
  'bassstation2': { standIn: { wave: 'sawtooth', oscillators: 2, filter: lp24, lfoTo: 'filter' }, voices: 1, init: { mix_sub: 0.4, mix_osc2: 0.6 } },
  // Duophonic, 2 oscillators + sub, ladder filter with slope switch (−24 dB at init), MULTIDRIVE.
  'subsequent-37': {
    standIn: { wave: 'sawtooth', oscillators: 2, filter: lp24, lfoTo: 'pitch', use: { drive: 'multidrive', osc_detune: 'osc2_freq' } },
    bipolar: ['osc2_freq', 'osc2_beat'], init: { osc2_freq: 0.52, mix_sub: 0.3, mix_osc2: 0.7, mix_fdbk: 0, filter_eg_amt: 0.5 },
  },
  // Mono, 2 oscillators, ladder filter — and almost nothing reachable by MIDI (see limits).
  'grandmother': { standIn: { wave: 'sawtooth', oscillators: 2, filter: lp24, lfoTo: 'pitch' }, voices: 1, bipolar: ['osc2_freq'], init: { osc2_freq: 0.52 } },
  // 8 voices (16 in the 16-voice model; layer A), 2 DCOs, 4-pole filter. Fine tune and envelope amount are centre-zero.
  'prophet-rev2': {
    standIn: { wave: 'sawtooth', oscillators: 2, filter: lp24, lfoTo: 'pitch', use: { osc_detune: 'osc2_fine' } },
    bipolar: ['osc1_fine', 'osc2_fine', 'filter_env_amt'], init: { osc2_fine: 0.56, filter_env_amt: 0.7, osc_mix: 0.5 },
  },
  // 5 voices, 2 VCOs + sub, 4-pole filter. Pitch and envelope amounts are centre-zero.
  'take-5': {
    standIn: { wave: 'sawtooth', oscillators: 2, filter: lp24, lfoTo: 'pitch', use: { osc_detune: 'osc2_pitch', drive: 'drive' } },
    bipolar: ['osc1_pitch', 'osc2_pitch', 'env1_amount', 'env2_amount', 'lfo1_amount', 'lfo2_amount'],
    init: { osc1_pitch: 0.5, osc2_pitch: 0.505, env1_amount: 0.7, env2_amount: 1, lfo1_amount: 0.5, lfo2_amount: 0.5, mix_osc2: 0.7, mix_sub: 0.2, overdrive: 0 },
  },
  // 12 voices, 2 DCOs, 2/4-pole filter (4 at init). Volume on CC 7, not the VCA level.
  'deepmind-12': {
    standIn: { wave: 'sawtooth', oscillators: 2, filter: lp24, lfoTo: 'pitch' },
    init: { osc2_level: 0.5, vca_level: 0.8, osc2_pitch: 0.5 }, bipolar: ['osc2_pitch'],
    map: { volume: { control: 'volume', range: [0, 1] } },
  },
  // Mono, 3 oscillators, ladder filter; MIDI reaches only notes, bend and the mod wheel.
  'model-d': { standIn: { wave: 'sawtooth', oscillators: 3, filter: lp24, lfoTo: 'pitch' }, voices: 1 },
  // Software: the stand-in follows each synth's init patch (oscillators, filter slope).
  'logic-retro-synth': { standIn: { wave: 'sawtooth', oscillators: 2, filter: lp24, lfoTo: 'pitch' } },
  'logic-alchemy': { standIn: { wave: 'sawtooth', oscillators: 2, filter: lp12, lfoTo: 'filter' } },
  'logic-es2': { standIn: { wave: 'sawtooth', oscillators: 3, filter: lp24, lfoTo: 'pitch' } },
  'garageband-synth-patches': { name: 'GarageBand synths', standIn: { wave: 'sawtooth', oscillators: 1, filter: lp24, lfoTo: 'pitch' } },
  'vital': { maker: 'Vital Audio', standIn: { wave: 'sawtooth', oscillators: 2, filter: lp12, lfoTo: 'pitch' } },
  'serum-2': { standIn: { wave: 'sawtooth', oscillators: 2, filter: lp12, lfoTo: 'pitch' } },
  'arturia-pigments': { standIn: { wave: 'sawtooth', oscillators: 2, filter: lp24, lfoTo: 'filter' } },
  'arturia-analog-lab': { standIn: { wave: 'sawtooth', oscillators: 2, filter: lp24, lfoTo: 'filter' } },
  'uhe-diva': { standIn: { wave: 'sawtooth', oscillators: 3, filter: lp24, lfoTo: 'pitch' } },
  'gm2-sound-controllers': { maker: 'MIDI standard:', name: 'General MIDI 2 sound controllers', standIn: { wave: 'sawtooth', oscillators: 1, filter: lp12, lfoTo: 'pitch' } },
};

const RESEARCH: Raw[] = [korgRoland, arturiaNovation, moogSequentialBehringer, software].flat();

export const PROFILES: Profile[] = RESEARCH.filter((r) => r && r.id && Array.isArray(r.controls)).map((r) => normalize(r, OVERLAY[r.id]));

export const profileById = (id: string | undefined) => (id ? PROFILES.find((p) => p.id === id) : undefined);
