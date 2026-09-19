/**
 * The sound library on screen: a browser with previews (shared by the Library page and the picker
 * modal on the composer), the picker modal itself, and the editor for your own presets.
 */
import { useEffect, useMemo, useState } from 'react';
import { INSTRUMENT_NAMES } from '../audio/engine';
import { parseMotif } from '../core/motif';
import { PRESET_CATEGORIES, presetNotesInC, type Preset, type PresetCategory } from '../core/presets';
import { allPresets, newPresetId } from '../core/presetStore';
import type { Runtime } from '../runtime';

export const credit = (p: Preset) => `${p.by}, ${p.year}`;
const instrumentLabel = (name: string) => name.replace(/_/g, ' ');

/** "Start audio" for screens that are not the composer header. */
export function AudioGate({ rt }: { rt: Runtime }) {
  if (rt.audio.started) return null;
  return <button className="primary" onClick={() => rt.startAudio()} data-testid="start-audio">Start audio to preview</button>;
}

export function PreviewButton({ rt, p, notes, testId }: { rt: Runtime; p: Preset; notes?: string; testId?: string }) {
  const on = rt.audio.previewing === p.id;
  return (
    <button onClick={(e) => { e.stopPropagation(); if (on) rt.audio.stopPreview(); else rt.preview(p, notes); }} disabled={!rt.audio.started} title={rt.audio.started ? 'Preview' : 'Start audio first'}
      data-testid={testId ?? `preview-${p.id}`} className={on ? 'on' : ''}>{on ? '■' : '▶'}</button>
  );
}

/** The list with category and search filters. `onChoose` adds a "use" button per row. */
export function PresetBrowser({ rt, presets, selectedId, onSelect, onChoose }: {
  rt: Runtime; presets: Preset[]; selectedId?: string | null; onSelect?: (p: Preset) => void; onChoose?: (p: Preset) => void;
}) {
  const [cat, setCat] = useState<PresetCategory | 'all'>('all');
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return presets.filter((p) => (cat === 'all' || p.category === cat) && (!needle || `${p.title} ${p.by} ${p.instrument}`.toLowerCase().includes(needle)));
  }, [presets, cat, q]);
  const counts = useMemo(() => Object.fromEntries(PRESET_CATEGORIES.map((c) => [c.id, presets.filter((p) => p.category === c.id).length])), [presets]);
  return (
    <div className="browser" data-testid="preset-browser">
      <div className="row">
        <select value={cat} onChange={(e) => setCat(e.target.value as PresetCategory | 'all')} data-testid="browser-category">
          <option value="all">all ({presets.length})</option>
          {PRESET_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label} ({counts[c.id]})</option>)}
        </select>
        <input placeholder="search title, composer, instrument" value={q} onChange={(e) => setQ(e.target.value)} data-testid="browser-search" />
        <span className="hint">{shown.length} shown</span>
      </div>
      <ul className="preset-list">
        {shown.length === 0 && <li className="hint">nothing matches</li>}
        {shown.map((p) => (
          <li key={p.id} className={`preset-row ${p.id === selectedId ? 'selected' : ''}`} data-testid={`preset-${p.id}`} onClick={() => onSelect?.(p)}>
            <PreviewButton rt={rt} p={p} />
            <div className="preset-text">
              <strong>{p.title}</strong> <span className="hint">{credit(p)}</span>
              <div className="hint">{instrumentLabel(p.instrument)} · {p.kind === 'loop' ? 'loop' : 'motif'}{p.grid === '16th' ? ' · steps are 16ths' : ''}{p.category === 'mine' ? ' · mine' : ''}</div>
            </div>
            {onChoose && <button className="primary" onClick={(e) => { e.stopPropagation(); onChoose(p); }} data-testid={`use-${p.id}`}>use</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The modal on the composer: preview, then choose. */
export function PresetPicker({ rt, title, onChoose, onClose }: { rt: Runtime; title: string; onChoose: (p: Preset) => void; onClose: () => void }) {
  const presets = useMemo(() => allPresets(), []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); rt.audio.stopPreview(); };
  }, [onClose, rt]);
  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="preset-picker">
      <div className="modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row modal-head">
          <h2>{title}</h2>
          <AudioGate rt={rt} />
          <span className="hint">▶ previews in the piece's key · <a href="#/library" onClick={onClose}>make your own in the library</a></span>
          <button className="ghost" onClick={onClose} title="Close" data-testid="picker-close">✕</button>
        </div>
        <PresetBrowser rt={rt} presets={presets} onChoose={(p) => { rt.audio.stopPreview(); onChoose(p); }} />
      </div>
    </div>
  );
}

export function blankPreset(): Preset {
  return { id: newPresetId(), title: 'My sound', by: '', year: String(new Date().getFullYear()), category: 'mine', instrument: 'marimba', kind: 'motif', volume: 0.8, tonic: 'C', grid: '8th', notes: 'c5 e5 g5 c6' };
}

/** Make an editable copy of a shipped preset, notes already in C. */
export function copyToMine(p: Preset): Preset {
  return { ...p, id: newPresetId(), title: p.category === 'mine' ? `${p.title} (copy)` : p.title, notes: presetNotesInC(p), tonic: 'C', category: 'mine' };
}

export function PresetEditor({ rt, initial, onSave, onCancel, onDelete }: { rt: Runtime; initial: Preset; onSave: (p: Preset) => void; onCancel: () => void; onDelete?: () => void }) {
  const [p, setP] = useState<Preset>(initial);
  useEffect(() => setP(initial), [initial]);
  const parsed = parseMotif(p.notes);
  const set = (patch: Partial<Preset>) => setP({ ...p, ...patch });
  const valid = p.title.trim().length > 0 && parsed.errors.length === 0 && parsed.motif.notes.length > 0;
  return (
    <div className="editor" data-testid="preset-editor">
      <label className="row">Title <input value={p.title} onChange={(e) => set({ title: e.target.value })} data-testid="editor-title" /></label>
      <label className="row">By <input value={p.by} onChange={(e) => set({ by: e.target.value })} placeholder="you, or where the tune is from" data-testid="editor-by" />
        <span>year</span><input className="num" value={p.year} onChange={(e) => set({ year: e.target.value })} /></label>
      <label className="row">Instrument
        <select value={p.instrument} onChange={(e) => set({ instrument: e.target.value })} data-testid="editor-instrument">
          {INSTRUMENT_NAMES.map((n, k) => <option key={n} value={n}>{k} · {instrumentLabel(n)}</option>)}
        </select>
        <select value={p.kind} onChange={(e) => set({ kind: e.target.value as Preset['kind'] })} data-testid="editor-kind">
          <option value="motif">motif (triggered)</option><option value="loop">loop (repeats)</option>
        </select>
      </label>
      <label className="row col">Notes <span className="hint">one token per 8th · "." rest · "a4:2" hold · "|" bar line · write in C, it plays in the piece's key</span>
        <textarea rows={3} value={p.notes} onChange={(e) => set({ notes: e.target.value })} data-testid="editor-notes" />
        {parsed.errors.length > 0 && <span className="err">{parsed.errors.join('; ')}</span>}
        <span className="hint">{parsed.motif.notes.length} notes over {parsed.motif.length} steps</span>
      </label>
      <label className="row">Level <input type="range" min={0} max={1} step={0.01} value={p.volume} onChange={(e) => set({ volume: +e.target.value })} /></label>
      <div className="row">
        <PreviewButton rt={rt} p={p} notes={p.notes} testId="preview-editor" />
        <AudioGate rt={rt} />
        <button className="primary" onClick={() => onSave({ ...p, tonic: 'C', category: 'mine' })} disabled={!valid} data-testid="editor-save">save</button>
        <button onClick={onCancel}>cancel</button>
        {onDelete && <button className="ghost" onClick={() => { if (confirm(`Delete "${p.title}"?`)) onDelete(); }} data-testid="editor-delete">delete</button>}
      </div>
    </div>
  );
}
