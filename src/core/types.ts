// The score model — see docs/02-composer-mode.md §1. Plain data; the whole score is one YAML file.

export type InputId = string;
export type SoundId = string;

export type Curve = 'linear' | 'log' | 'exp' | 'steps';

export interface Input {
  id: InputId;
  label: string;
  unit: string;
  /** For the mock feeds: which scenario channel feeds it. Later: a Datadog query. */
  feed?: 'traffic' | 'errors';
  /** Derived input: slope of another input over a window (units per minute). */
  derive?: { of: InputId; slope_over: number };
  /** Display range hint for sliders and sparklines. */
  range: [number, number];
}

export type SoundKind = 'loop' | 'drone' | 'motif';

export interface Sound {
  id: SoundId;
  label: string;
  kind: SoundKind;
  /** smplr General MIDI soundfont instrument name, e.g. "acoustic_grand_piano". */
  instrument: string;
  /** loop and motif: notes in mini-notation, e.g. "d2 . d2 a2 . f2 . d2" (one token per 8th). */
  notes?: string;
  /** drone: chord degrees relative to the key, e.g. [1, 5, 8] (root, fifth, octave). */
  degrees?: number[];
  /** Base level 0..1 before rules act. */
  volume: number;
}

/** Continuous properties a rule can drive. */
export type Property = 'volume' | 'density' | 'brightness' | 'tension' | 'register';
export const PROPERTIES: Property[] = ['volume', 'density', 'brightness', 'tension', 'register'];

/** Harmonic concepts a rule can introduce on a drone or the whole piece. */
export type Concept = 'minor' | 'suspended' | 'major' | 'sparse';
export const CONCEPTS: Concept[] = ['minor', 'suspended', 'major', 'sparse'];

export type Condition =
  | { kind: 'always' }
  | { kind: 'below'; value: number; for: number }
  | { kind: 'above'; value: number; for: number };

export type Action =
  | { kind: 'set'; sound: SoundId; property: Property; range: [number, number]; curve: Curve; smooth: number }
  | { kind: 'introduce'; concept: Concept; sound: SoundId | 'piece'; fade: number }
  | { kind: 'trigger'; sound: SoundId; quantize: 'beat' | 'bar'; cooldown: number };

export interface Rule {
  id: string;
  input: InputId;
  when: Condition;
  do: Action;
  /** For introduce: release condition. Default: the inverse of `when` without a hold. */
  until?: Condition;
  enabled: boolean;
}

export interface Clock {
  bpm: number;
  key: string; // e.g. "D"
  mode: 'ionian' | 'dorian' | 'aeolian' | 'lydian' | 'mixolydian';
}

export interface Score {
  name: string;
  clock: Clock;
  inputs: Input[];
  sounds: Sound[];
  rules: Rule[];
}

// What the evaluator emits each tick. The renderer only knows these.
export type Effect =
  | { kind: 'set'; sound: SoundId; property: Property; value: number; smooth: number; ruleId: string }
  | { kind: 'concept'; sound: SoundId | 'piece'; concept: Concept; active: boolean; fade: number; ruleId: string }
  | { kind: 'trigger'; sound: SoundId; quantize: 'beat' | 'bar'; ruleId: string; at: number };
