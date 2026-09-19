import { getSoundfontNames } from 'smplr';
import { describe, expect, it } from 'vitest';
import { KEY_ROOTS, parseMotif } from '../src/core/motif';
import { applyPreset, LIBRARY, motifToText, PRESET_CATEGORIES, presetMotifInC, presetNotesInC } from '../src/core/presets';
import { allPresets, loadMine, removeMine, upsertMine, type PresetStorage } from '../src/core/presetStore';
import type { Sound } from '../src/core/types';

const fakeStorage = (): PresetStorage => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } }; };

describe('the shipped library', () => {
  it('has a good number of tunes, unique ids, known categories and instruments', () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(60);
    expect(new Set(LIBRARY.map((p) => p.id)).size).toBe(LIBRARY.length);
    const cats = new Set(PRESET_CATEGORIES.map((c) => c.id));
    const instruments = new Set(getSoundfontNames());
    for (const p of LIBRARY) {
      expect(cats.has(p.category), p.id).toBe(true);
      expect(p.category, p.id).not.toBe('mine');
      expect(instruments.has(p.instrument), `${p.id}: ${p.instrument}`).toBe(true);
      expect(KEY_ROOTS[p.tonic], `${p.id}: tonic ${p.tonic}`).toBeDefined();
      expect(p.by.length, p.id).toBeGreaterThan(0);
    }
  });
  it('every tune parses cleanly, has at least four notes, and fits 64 steps', () => {
    for (const p of LIBRARY) {
      const { motif, errors } = parseMotif(p.notes);
      expect(errors, p.id).toEqual([]);
      expect(motif.notes.length, p.id).toBeGreaterThanOrEqual(4);
      expect(motif.length, p.id).toBeLessThanOrEqual(64);
    }
  });
  it('is public domain by the stated rule: nothing published 1929 or later', () => {
    for (const p of LIBRARY) {
      const y = parseInt(p.year, 10);
      if (Number.isFinite(y)) expect(y, `${p.id}: ${p.year}`).toBeLessThan(1929);
    }
  });
});

describe('transposition to C', () => {
  it('leaves C tunes alone and shifts others so the tonic lands on C, within a fifth', () => {
    const ode = LIBRARY.find((p) => p.id === 'ode-to-joy')!;
    expect(presetNotesInC(ode)).toBe(ode.notes);
    const elise = LIBRARY.find((p) => p.id === 'fur-elise')!; // A minor: up a minor third, not down a sixth
    expect(presetNotesInC(elise).startsWith('g5 f#5 g5 f#5 g5 d5 f5 d#5 | c5:3')).toBe(true);
    const minuet = LIBRARY.find((p) => p.id === 'minuet-in-g')!; // G: up a fourth
    expect(presetMotifInC(minuet).notes[0].midi).toBe(parseMotif('g5').motif.notes[0].midi);
    for (const p of LIBRARY) {
      const before = parseMotif(p.notes).motif, after = presetMotifInC(p);
      const shift = after.notes[0].midi - before.notes[0].midi;
      expect(Math.abs(shift), p.id).toBeLessThanOrEqual(6);
      // The first note keeps its interval from the tonic, now measured from C.
      expect((after.notes[0].midi % 12 + 12) % 12, p.id).toBe(((before.notes[0].midi - (KEY_ROOTS[p.tonic] ?? 0)) % 12 + 12) % 12);
    }
  });
  it('motifToText round-trips through parseMotif, merging rests and adding bar lines', () => {
    const text = 'c5:2 . e5 .:3 g5 | a5:8';
    const m = parseMotif(text).motif;
    expect(motifToText(m)).toBe('c5:2 . e5 .:3 g5 | a5:8');
    expect(parseMotif(motifToText(m)).motif).toEqual(m);
    for (const p of LIBRARY) expect(parseMotif(presetNotesInC(p)).motif, p.id).toEqual(presetMotifInC(p));
  });
});

describe('applying a preset to a sound', () => {
  it('copies instrument, kind, notes in C and level; names a default sound after the tune; keeps a custom name', () => {
    const p = LIBRARY.find((x) => x.id === 'greensleeves')!;
    const fresh: Sound = { id: 's1', label: 'New sound', kind: 'drone', instrument: 'marimba', degrees: [1, 5], volume: 0.5 };
    const a = applyPreset(fresh, p);
    expect(a).toMatchObject({ id: 's1', label: 'Greensleeves', kind: 'motif', instrument: 'acoustic_guitar_nylon', volume: 0.8, preset: 'greensleeves' });
    expect(a.degrees).toBeUndefined();
    expect(a.notes).toBe(presetNotesInC(p));
    const named = applyPreset({ ...fresh, label: 'Surge motif' }, p);
    expect(named.label).toBe('Surge motif');
    expect(applyPreset(a, LIBRARY[0]).label).toBe(LIBRARY[0].title); // a sound already made from a preset renames with the next one
  });
});

describe('my presets in storage', () => {
  it('saves, lists yours first, updates in place, deletes, and survives junk', () => {
    const st = fakeStorage();
    expect(loadMine(st)).toEqual([]);
    const p = { id: 'mine-1', title: 'Riff', by: 'me', year: '2026', category: 'mine' as const, instrument: 'marimba', kind: 'motif' as const, volume: 0.8, tonic: 'C', grid: '8th' as const, notes: 'c5 e5' };
    upsertMine(p, st);
    expect(loadMine(st)).toEqual([p]);
    expect(allPresets(st)[0].id).toBe('mine-1');
    expect(allPresets(st).length).toBe(LIBRARY.length + 1);
    upsertMine({ ...p, title: 'Riff 2' }, st);
    expect(loadMine(st).map((x) => x.title)).toEqual(['Riff 2']);
    removeMine('mine-1', st);
    expect(loadMine(st)).toEqual([]);
    st.setItem('iluvatar.presets.v1', 'not json');
    expect(loadMine(st)).toEqual([]);
    st.setItem('iluvatar.presets.v1', JSON.stringify([{ nope: true }, { id: 'x', notes: 'c5', category: 'classical' }]));
    expect(loadMine(st)).toEqual([{ id: 'x', notes: 'c5', category: 'mine' }]);
  });
});
