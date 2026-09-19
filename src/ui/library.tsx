/**
 * The Library page: browse and preview every ready-made sound, make new ones, save them.
 * Saved to browser storage until there is a server to save to.
 */
import { useMemo, useState } from 'react';
import { LIBRARY, presetNotesInC, type Preset } from '../core/presets';
import { loadMine, removeMine, upsertMine } from '../core/presetStore';
import type { Runtime } from '../runtime';
import { AudioGate, blankPreset, copyToMine, credit, PresetBrowser, PresetEditor, PreviewButton } from './presets';

export function LibraryPage({ rt }: { rt: Runtime }) {
  const [mine, setMine] = useState<Preset[]>(loadMine);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Preset | null>(null);
  const presets = useMemo(() => [...mine, ...LIBRARY], [mine]);
  const selected = presets.find((p) => p.id === selectedId) ?? null;

  const save = (p: Preset) => { setMine(upsertMine(p)); setEditing(null); setSelectedId(p.id); };
  const remove = (id: string) => { setMine(removeMine(id)); setEditing(null); if (selectedId === id) setSelectedId(null); };

  return (
    <main className="library" data-page="library">
      <section className="panel">
        <h2>Ready-made sounds <span className="hint">{LIBRARY.length} public domain tunes with their instruments · {mine.length} of yours</span></h2>
        <div className="row">
          <button className="primary" onClick={() => { setEditing(blankPreset()); }} data-testid="new-preset">+ new sound</button>
          <AudioGate rt={rt} />
          <span className="hint">yours are saved in this browser</span>
        </div>
        <PresetBrowser rt={rt} presets={presets} selectedId={selectedId} onSelect={(p) => { setSelectedId(p.id); setEditing(null); }} />
      </section>
      <section className="panel">
        {editing ? (
          <>
            <h2>{mine.some((m) => m.id === editing.id) ? 'Edit' : 'New sound'}</h2>
            <PresetEditor rt={rt} initial={editing} onSave={save} onCancel={() => setEditing(null)} onDelete={mine.some((m) => m.id === editing.id) ? () => remove(editing.id) : undefined} />
          </>
        ) : selected ? (
          <div data-testid="preset-detail">
            <h2>{selected.title} <span className="hint">{credit(selected)}</span></h2>
            <p className="hint">{selected.instrument.replace(/_/g, ' ')} · {selected.kind} · level {Math.round(selected.volume * 100)} %{selected.tonic !== 'C' ? ` · written in ${selected.tonic}, shown here in C` : ''}{selected.grid === '16th' ? ' · steps are 16ths' : ''}</p>
            <pre className="notes">{presetNotesInC(selected)}</pre>
            <div className="row">
              <PreviewButton rt={rt} p={selected} testId="preview-detail" />
              {selected.category === 'mine'
                ? <button onClick={() => setEditing(selected)} data-testid="edit-preset">edit</button>
                : <button onClick={() => setEditing(copyToMine(selected))} data-testid="copy-preset">make a copy to edit</button>}
            </div>
          </div>
        ) : (
          <p className="hint">Pick a sound on the left to see its notes, or make a new one.</p>
        )}
      </section>
    </main>
  );
}
