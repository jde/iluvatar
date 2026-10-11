/**
 * A synth profile mirrors one real synth: its front panel (knobs and switches, named as printed),
 * the MIDI message each one answers to (from the maker's MIDI implementation chart), how to set the
 * synth up to listen, and how a browser stand-in of it is built. docs/04-synths.md.
 */
import type { Property } from '../core/types';

/** What a control does, in words every synth shares. The stand-in and the default map read these. */
export type Role =
  | 'cutoff' | 'resonance' | 'filter_env_amount' | 'filter_attack' | 'filter_decay' | 'filter_sustain' | 'filter_release'
  | 'amp_attack' | 'amp_decay' | 'amp_sustain' | 'amp_release'
  | 'lfo_rate' | 'lfo_depth' | 'osc_detune' | 'osc_shape' | 'osc_mix' | 'noise' | 'drive'
  | 'delay_time' | 'delay_feedback' | 'delay_mix' | 'reverb_mix' | 'portamento' | 'volume' | 'mod_wheel' | 'expression' | 'other';

export interface Step { from: number; to: number; meaning: string }

export interface Control {
  id: string;
  /** As printed on the panel (or shown in the plugin). */
  label: string;
  section: string;
  role: Role;
  kind: 'continuous' | 'switch';
  /** CC number (MSB when `ccLsb` is set). */
  cc?: number;
  /** 14-bit control: the LSB controller number. */
  ccLsb?: number;
  /** NRPN parameter number and its top value. */
  nrpn?: { param: number; max: number };
  /** Switch positions as value ranges 0–127 (or 0–max for NRPN). */
  steps?: Step[];
  /** Centre is "off" (envelope amounts, bipolar mod). */
  bipolar?: boolean;
  /** Software that listens only after MIDI learn: this CC is our suggestion, taught with "send". */
  suggested?: boolean;
  /** Where the knob sits in the stand-in's starting patch, 0..1. Default 0.5 (bipolar) or 0. */
  init?: number;
  notes?: string;
}

export interface StandIn {
  /** Oscillator shape the stand-in starts with (switch controls with role osc_shape change it). */
  wave: 'sawtooth' | 'square' | 'triangle' | 'sine';
  /** Oscillators per voice (2 detuned saws for a minilogue, 3 for a Model D). */
  oscillators: number;
  filter: { rolloff: -12 | -24; type: 'lowpass' | 'highpass' | 'bandpass' };
  /** Where the LFO goes when it has one depth knob. */
  lfoTo: 'pitch' | 'filter';
  /** Which panel control the stand-in listens to for a role, when the first one on the panel is not it. */
  use?: Partial<Record<Role, string>>;
}

export interface Profile {
  id: string;
  name: string;
  maker: string;
  kind: 'hardware' | 'software' | 'standard';
  popularity: string;
  /** 1 = monophonic: a drone's chord plays one note, as on the real thing. */
  voices: number;
  noteRange?: [number, number];
  defaultChannel: number;
  bendRangeSemitones: number;
  respondsTo: { cc7Volume?: boolean | null; cc1ModWheel?: boolean | null; velocity?: boolean | null; programChange?: boolean | null };
  /** Software that only listens after MIDI learn: the CCs are suggestions the user assigns. */
  learnOnly?: boolean;
  controls: Control[];
  /** What the score's five properties turn on this synth, and over which part of the knob's travel. */
  defaultMap: Partial<Record<Property, { control: string; range: [number, number] }>>;
  setup: string[];
  learnSteps?: string[];
  sources: { url: string; what: string }[];
  confidence: string;
  /** What the real synth will not let MIDI reach (analog knobs), in the maker's words where possible. */
  limits?: string;
  standIn: StandIn;
}
