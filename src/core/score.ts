import yaml from 'js-yaml';
import type { Score } from './types';

/** The starter score: two feeds, three sounds, four rules. Shipped as scores/storefront-ambient too. */
export function defaultScore(): Score {
  return {
    name: 'Storefront, ambient',
    clock: { bpm: 66, key: 'D', mode: 'ionian' },
    inputs: [
      { id: 'traffic', label: 'Traffic', unit: 'visits/s', feed: 'traffic', range: [0, 200] },
      { id: 'errors', label: 'Errors', unit: 'ratio', feed: 'errors', range: [0, 1] },
      { id: 'traffic_slope', label: 'Traffic slope (60 s)', unit: 'visits/s per min', derive: { of: 'traffic', slope_over: 60 }, range: [-100, 100] },
    ],
    sounds: [
      { id: 'bass', label: 'Bass loop', kind: 'loop', instrument: 'acoustic_bass', notes: 'c2 . c2 g2 . e2 . c2 | c2 . bb2 g2 . e2 . c2', volume: 0.7 },
      { id: 'pad', label: 'Pad', kind: 'drone', instrument: 'pad_2_warm', degrees: [1, 5, 8, 10], volume: 0.5 },
      { id: 'surge', label: 'Surge motif', kind: 'motif', instrument: 'flute', notes: 'c5 e5 g5 c6 | b5:2 g5:2', volume: 0.8 },
    ],
    rules: [
      { id: 'r1', input: 'traffic', when: { kind: 'always' }, do: { kind: 'set', sound: 'bass', property: 'density', range: [0, 200], curve: 'log', smooth: 2 }, enabled: true },
      { id: 'r2', input: 'errors', when: { kind: 'always' }, do: { kind: 'set', sound: 'pad', property: 'tension', range: [0, 0.3], curve: 'exp', smooth: 0.3 }, enabled: true },
      { id: 'r3', input: 'traffic', when: { kind: 'below', value: 12, for: 20 }, do: { kind: 'introduce', concept: 'minor', sound: 'pad', fade: 4 }, until: { kind: 'above', value: 16, for: 5 }, enabled: true },
      { id: 'r4', input: 'traffic_slope', when: { kind: 'above', value: 40, for: 0 }, do: { kind: 'trigger', sound: 'surge', quantize: 'bar', cooldown: 60 }, enabled: true },
    ],
  };
}

export function scoreToYaml(score: Score): string {
  return yaml.dump(score, { noRefs: true, lineWidth: 120 });
}

export function scoreFromYaml(text: string): Score {
  const s = yaml.load(text) as Score;
  validate(s);
  return s;
}

/** Cheap structural check so a bad file fails loudly, not musically. */
export function validate(s: Score): void {
  if (!s || typeof s !== 'object') throw new Error('score is not an object');
  for (const k of ['name', 'clock', 'inputs', 'sounds', 'rules'] as const) if (!(k in s)) throw new Error(`score missing "${k}"`);
  const inputs = new Set(s.inputs.map((i) => i.id)), sounds = new Set(s.sounds.map((x) => x.id));
  for (const r of s.rules) {
    if (!inputs.has(r.input)) throw new Error(`rule ${r.id}: unknown input "${r.input}"`);
    const target = r.do.kind === 'introduce' ? r.do.sound : r.do.sound;
    if (target !== 'piece' && !sounds.has(target)) throw new Error(`rule ${r.id}: unknown sound "${target}"`);
  }
  for (const i of s.inputs) if (i.derive && !inputs.has(i.derive.of)) throw new Error(`input ${i.id}: derives from unknown "${i.derive.of}"`);
}
