/**
 * Motif notation: whitespace-separated tokens, one token per step (an 8th note by default).
 *   "d5 f5 a5 . d6"   notes and rests ('.' or '-' = rest)
 *   "d5:2"            hold for 2 steps
 *   "|"               bar line, ignored (for readability)
 * Notes are letter[#|b]octave. Output is a list of steps with midi numbers.
 */
export interface MotifNote { step: number; midi: number; steps: number }
export interface Motif { notes: MotifNote[]; length: number }

const LETTER: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

export function noteToMidi(tok: string): number | null {
  const m = /^([a-gA-G])([#b]?)(-?\d)$/.exec(tok);
  if (!m) return null;
  const semis = LETTER[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return (parseInt(m[3], 10) + 1) * 12 + semis;
}

export function midiToNote(midi: number): string {
  const names = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
  return names[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

export function parseMotif(text: string): { motif: Motif; errors: string[] } {
  const notes: MotifNote[] = [];
  const errors: string[] = [];
  let step = 0;
  for (const raw of text.trim().split(/\s+/).filter(Boolean)) {
    if (raw === '|') continue;
    const [tok, holdStr] = raw.split(':');
    const hold = holdStr ? Math.max(1, parseInt(holdStr, 10) || 1) : 1;
    if (tok === '.' || tok === '-') { step += hold; continue; }
    const midi = noteToMidi(tok);
    if (midi === null) { errors.push(`unknown token "${raw}"`); step += hold; continue; }
    notes.push({ step, midi, steps: hold });
    step += hold;
  }
  return { motif: { notes, length: step }, errors };
}

/** Transpose a motif so that written C maps to `keyRoot` (0..11) — the composer writes in C, the piece plays in the key. */
export function transpose(motif: Motif, semitones: number): Motif {
  return { length: motif.length, notes: motif.notes.map((n) => ({ ...n, midi: n.midi + semitones })) };
}

export const KEY_ROOTS: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };

/** Mode intervals from the root, in semitones. */
export const MODES: Record<string, number[]> = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

/** Scale degree (1-based, may exceed 7 for upper octaves) to a midi note in the key/mode, around `baseOctave`. */
export function degreeToMidi(degree: number, keyRoot: number, mode: string, baseOctave = 3): number {
  const scale = MODES[mode] ?? MODES.ionian;
  const d = degree - 1;
  const oct = Math.floor(d / 7), idx = ((d % 7) + 7) % 7;
  return (baseOctave + 1) * 12 + keyRoot + scale[idx] + oct * 12;
}
