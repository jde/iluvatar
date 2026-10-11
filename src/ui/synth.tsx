/**
 * The synth on a sound: pick a real synth, see its front panel (knobs named as printed, with the
 * MIDI message each answers to), set knobs, choose which knob each property turns, and read how to
 * set the real synth up. docs/04-synths.md.
 */
import { PROFILES, profileById } from '../synths/profiles';
import { addressLabel, stepIndex, stepValue } from '../synths/messages';
import { HEARD_ROLES } from '../synths/standin';
import { mappedControl } from '../audio/engine';
import { PROPERTIES, type Property, type Sound } from '../core/types';
import type { Profile } from '../synths/types';
import type { Runtime } from '../runtime';

const GROUPS: [Profile['kind'], string][] = [['hardware', 'Hardware synths'], ['software', 'Software synths'], ['standard', 'Standards']];

export function SynthRow({ sound: s, set }: { sound: Sound; set: (x: Sound['synth']) => void }) {
  return (
    <label className="row">Synth
      <select value={s.synth?.profile ?? ''} onChange={(e) => set(e.target.value ? { profile: e.target.value } : undefined)} data-testid={`synth-${s.id}`}>
        <option value="">none — General MIDI sound</option>
        {GROUPS.map(([k, label]) => {
          const ps = PROFILES.filter((p) => p.kind === k);
          return ps.length ? <optgroup key={k} label={label}>{ps.map((p) => <option key={p.id} value={p.id}>{p.maker} {p.name}</option>)}</optgroup> : null;
        })}
      </select>
    </label>
  );
}

export function SynthPanel({ rt, sound: s, set }: { rt: Runtime; sound: Sound; set: (x: Sound['synth']) => void }) {
  const p = profileById(s.synth?.profile);
  if (!s.synth) return null;
  if (!p) return <p className="err">Unknown synth "{s.synth.profile}" — this score was made with a newer synth library.</p>;
  const live = rt.audio.knobsLive.get(s.id);
  const onMidi = !!s.output && rt.audio.midi.has(s.output.port);
  const setKnob = (id: string, v: number) => set({ ...s.synth!, knobs: { ...s.synth!.knobs, [id]: v } });
  const resetKnob = (id: string) => { const k = { ...s.synth!.knobs }; delete k[id]; set({ ...s.synth!, knobs: k }); };
  const setMap = (prop: Property, id: string) => set({ ...s.synth!, map: { ...s.synth!.map, [prop]: id === '' ? null : id } });
  const sections = [...new Set(p.controls.map((c) => c.section))];
  const turnedBy = (id: string) => {
    const props = PROPERTIES.filter((x) => mappedControl(p, s, x) === id);
    return props.length ? props.join(', ') : null;
  };
  return (
    <div className="synth" data-testid={`synth-panel-${s.id}`}>
      <p className="hint">
        {onMidi ? <>Playing the real {p.name} on {s.output!.port}, channel {s.output!.channel}. Only knobs you set here or a rule turns are sent, so its own patch stays.</>
          : <>Playing a browser stand-in built like the {p.name} ({p.voices === 1 ? 'mono' : `${p.voices} voices`}, {p.standIn.oscillators} oscillator{p.standIn.oscillators > 1 ? 's' : ''}, {Math.abs(p.standIn.filter.rolloff) / 6}-pole filter). Dimmed knobs move only the real synth.</>}
        {p.learnOnly && <> This synth listens only after MIDI learn: the CC numbers below are suggestions — use "send" to teach it.</>}
      </p>
      {p.limits && <p className="hint" data-testid={`synth-limits-${s.id}`}>Not reachable over MIDI on the real {p.name}: {p.limits}</p>}
      <details>
        <summary>Front panel · {p.controls.length} controls</summary>
        {sections.map((sec) => (
          <div key={sec} className="synth-section">
            <h4>{sec}</h4>
            {p.controls.filter((c) => c.section === sec).map((c) => {
              const setting = s.synth!.knobs?.[c.id];
              const now = live?.values[c.id] ?? setting ?? c.init ?? (c.bipolar ? 0.5 : 0);
              const turning = live?.touched.has(c.id) && setting === undefined;
              const heard = onMidi || HEARD_ROLES.includes(c.role);
              const by = turnedBy(c.id);
              return (
                <div key={c.id} className={`knob ${heard ? '' : 'dim'}`} data-testid={`knob-${s.id}-${c.id}`} title={c.notes ?? ''}>
                  <span className="knob-label">{c.label}</span>
                  {c.kind === 'switch' && c.steps?.length
                    ? <select value={stepIndex(c, setting ?? now)} onChange={(e) => setKnob(c.id, stepValue(c, +e.target.value))} data-testid={`knob-input-${s.id}-${c.id}`}>
                        {c.steps.map((st, i) => <option key={i} value={i}>{st.meaning}</option>)}
                      </select>
                    : <input type="range" min={0} max={127} step={1} value={Math.round((setting ?? now) * 127)} onChange={(e) => setKnob(c.id, +e.target.value / 127)} data-testid={`knob-input-${s.id}-${c.id}`} />}
                  <span className="meter knob-meter"><i style={{ width: `${Math.round(now * 100)}%` }} />{Math.round(now * 127)}</span>
                  <span className="hint">{addressLabel(c)}{by ? ` · ${by}` : ''}{turning && !by ? ' · rule' : ''}</span>
                  {onMidi && <button className="ghost" onClick={() => rt.audio.sendKnobNow(s.id, c.id, now)} title="Send this knob now (use with MIDI learn)" data-testid={`send-${s.id}-${c.id}`}>send</button>}
                  {setting !== undefined && <button className="ghost" onClick={() => resetKnob(c.id)} title="Stop setting this knob">↺</button>}
                </div>
              );
            })}
          </div>
        ))}
      </details>
      <details>
        <summary>What the score's properties turn</summary>
        {PROPERTIES.map((prop) => (
          <label key={prop} className="row">{prop} →
            <select value={mappedControl(p, s, prop) ?? ''} onChange={(e) => setMap(prop, e.target.value)} data-testid={`map-${s.id}-${prop}`}>
              <option value="">nothing</option>
              {p.controls.map((c) => <option key={c.id} value={c.id}>{c.section} · {c.label}</option>)}
            </select>
          </label>
        ))}
        <p className="hint">density and register also shape the notes, whatever they turn here.</p>
      </details>
      <details>
        <summary>Set up the real {p.name}</summary>
        <ol className="steps">{[...p.setup, ...(p.learnSteps ?? [])].map((x, i) => <li key={i}>{x}</li>)}</ol>
        <p className="hint">Receives on channel {p.defaultChannel || 'any'} by default · pitch bend ±{p.bendRangeSemitones} semitones{p.noteRange ? ` · notes ${p.noteRange[0]}–${p.noteRange[1]}` : ''}.</p>
        <p className="hint">From: {p.sources.map((x, i) => <span key={i}>{i ? ' · ' : ''}<a href={x.url} target="_blank" rel="noreferrer">{x.what}</a></span>)}</p>
        <p className="hint">Accuracy: {p.confidence}</p>
      </details>
    </div>
  );
}
