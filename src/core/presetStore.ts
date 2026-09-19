/**
 * The composer's own presets, kept in browser storage until there is a server to save to.
 * Shipped presets come from presets.ts; these are the ones made on the Library page.
 */
import { LIBRARY, type Preset } from './presets';

const KEY = 'iluvatar.presets.v1';

export interface PresetStorage { getItem(k: string): string | null; setItem(k: string, v: string): void }

const storage = (): PresetStorage | null => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } };

export function loadMine(store: PresetStorage | null = storage()): Preset[] {
  try {
    const t = store?.getItem(KEY);
    if (!t) return [];
    const list = JSON.parse(t);
    return Array.isArray(list) ? list.filter((p) => p && typeof p.id === 'string' && typeof p.notes === 'string').map((p) => ({ ...p, category: 'mine' as const })) : [];
  } catch (e) { console.warn('stored presets ignored', e); return []; }
}

export function saveMine(list: Preset[], store: PresetStorage | null = storage()): void {
  store?.setItem(KEY, JSON.stringify(list));
}

/** Insert or replace by id. Returns the new list. */
export function upsertMine(p: Preset, store: PresetStorage | null = storage()): Preset[] {
  const mine = loadMine(store);
  const next = mine.some((x) => x.id === p.id) ? mine.map((x) => (x.id === p.id ? { ...p, category: 'mine' as const } : x)) : [...mine, { ...p, category: 'mine' as const }];
  saveMine(next, store);
  return next;
}

export function removeMine(id: string, store: PresetStorage | null = storage()): Preset[] {
  const next = loadMine(store).filter((x) => x.id !== id);
  saveMine(next, store);
  return next;
}

/** Everything choosable: yours first, then the shipped library. */
export function allPresets(store: PresetStorage | null = storage()): Preset[] { return [...loadMine(store), ...LIBRARY]; }

export const presetById = (id: string, store: PresetStorage | null = storage()) => allPresets(store).find((p) => p.id === id);

export const newPresetId = () => `mine-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
