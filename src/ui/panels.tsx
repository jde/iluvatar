import { useEffect, useRef } from 'react';
import { INSTRUMENT_NAMES } from '../audio/engine';
import { MAX_DURATION, MIN_DURATION, SCENARIOS, type ScenarioId } from '../core/feeds';
import { parseMotif } from '../core/motif';
import { CONCEPTS, PROPERTIES, type Action, type Condition, type Input, type Rule, type Score, type Sound } from '../core/types';
import type { Runtime } from '../runtime';

const fmt = (v: number, unit: string) => (Number.isFinite(v) ? (unit === 'ratio' ? `${(v * 100).toFixed(1)} %` : v.toFixed(1)) : '—');
const uid = (p: string) => `${p}${Math.random().toString(36).slice(2, 7)}`;

// ---------- Inputs ----------
export function InputsPanel({ rt, score }: { rt: Runtime; score: Score }) {
  const manual = rt.feeds.scenario === 'manual';
  return (
    <section className="panel" data-panel="inputs">
      <h2>Inputs <span className="hint">the engineer's side: what we listen to</span></h2>
      <label className="row">Scenario
        <select value={rt.feeds.scenario} onChange={(e) => rt.setScenario(e.target.value as ScenarioId)} data-testid="scenario">
          {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
      <p className="hint">{SCENARIOS.find((s) => s.id === rt.feeds.scenario)?.blurb}</p>
      {!manual && (
        <label className="row">Scenario length
          <input type="range" min={MIN_DURATION} max={MAX_DURATION} step={5} value={rt.feeds.duration} onChange={(e) => rt.setScenarioDuration(+e.target.value)} data-testid="scenario-duration" />
          <span className="value" data-testid="scenario-duration-value">{rt.feeds.duration} s</span>
          <span className="hint" data-testid="scenario-phase">loops forever · cycle {rt.feeds.phase(rt.now).cycle} · {Math.round(rt.feeds.phase(rt.now).u * 100)} %</span>
        </label>
      )}
      {manual && (
        <div className="manual">
          <label>Traffic {rt.feeds.manual.traffic.toFixed(0)} visits/s
            <input type="range" min={0} max={300} value={rt.feeds.manual.traffic} onChange={(e) => { rt.feeds.manual = { ...rt.feeds.manual, traffic: +e.target.value }; }} data-testid="manual-traffic" /></label>
          <label>Errors {(rt.feeds.manual.errors * 100).toFixed(1)} %
            <input type="range" min={0} max={100} value={rt.feeds.manual.errors * 100} onChange={(e) => { rt.feeds.manual = { ...rt.feeds.manual, errors: +e.target.value / 100 }; }} data-testid="manual-errors" /></label>
        </div>
      )}
      {score.inputs.map((i) => <InputRow key={i.id} rt={rt} input={i} />)}
    </section>
  );
}

function InputRow({ rt, input }: { rt: Runtime; input: Input }) {
  const v = rt.timeline.value(input.id);
  return (
    <div className="input-row" data-testid={`input-${input.id}`}>
      <div className="input-head">
        <strong>{input.label}</strong>
        <span className="value" data-testid={`value-${input.id}`}>{fmt(v, input.unit)}</span>
        <span className="unit">{input.unit}{input.derive ? ` · slope of ${input.derive.of} over ${input.derive.slope_over} s` : ''}</span>
      </div>
      <Sparkline rt={rt} id={input.id} range={input.range} />
    </div>
  );
}

function Sparkline({ rt, id, range }: { rt: Runtime; id: string; range: [number, number] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const pts = rt.timeline.recent(id, 300, rt.now);
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#3a3a3a'; ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    if (pts.length < 2) return;
    const [lo, hi] = range;
    ctx.strokeStyle = '#e8c36a'; ctx.lineWidth = 1.5; ctx.beginPath();
    pts.forEach((p, k) => { const x = w - ((rt.now - p.t) / 300) * w; const y = h - ((p.v - lo) / (hi - lo)) * (h - 4) - 2; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
  });
  return <canvas ref={ref} width={320} height={40} className="spark" />;
}

// ---------- Sounds ----------
export function SoundsPanel({ rt, score, update }: { rt: Runtime; score: Score; update: (s: Score) => void }) {
  const setSound = (id: string, patch: Partial<Sound>) => update({ ...score, sounds: score.sounds.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const add = () => update({ ...score, sounds: [...score.sounds, { id: uid('s'), label: 'New sound', kind: 'motif', instrument: 'marimba', notes: 'c5 e5 g5 c6', volume: 0.7 }] });
  const remove = (id: string) => update({ ...score, sounds: score.sounds.filter((s) => s.id !== id), rules: score.rules.filter((r) => r.do.sound !== id) });
  return (
    <section className="panel" data-panel="sounds">
      <h2>Sounds <span className="hint">the musician's side: instruments, loops, motifs, drones</span></h2>
      {score.sounds.map((s) => {
        const live = rt.audio.live.get(s.id);
        const parsed = s.kind === 'drone' ? null : parseMotif(s.notes ?? '');
        return (
          <div className="sound" key={s.id} data-testid={`sound-${s.id}`}>
            <div className="row">
              <input className="label" value={s.label} onChange={(e) => setSound(s.id, { label: e.target.value })} />
              <select value={s.kind} onChange={(e) => setSound(s.id, { kind: e.target.value as Sound['kind'] })}>
                <option value="loop">loop (repeats)</option><option value="motif">motif (triggered)</option><option value="drone">drone (held chord)</option>
              </select>
              <button onClick={() => rt.audio.audition(s.id)} disabled={!rt.audio.isLoaded(s.id)} title="Audition" data-testid={`audition-${s.id}`}>▶</button>
              <button className="ghost" onClick={() => remove(s.id)} title="Remove">✕</button>
            </div>
            <label className="row">Instrument
              <select value={s.instrument} onChange={(e) => setSound(s.id, { instrument: e.target.value })} data-testid={`instrument-${s.id}`}>
                {INSTRUMENT_NAMES.map((n, k) => <option key={n} value={n}>{k} · {n.replace(/_/g, ' ')}</option>)}
              </select>
              <span className="hint">{rt.audio.started ? (rt.audio.isLoaded(s.id) ? 'loaded' : 'loading…') : 'audio not started'}</span>
            </label>
            {s.kind === 'drone' ? (
              <label className="row">Chord degrees
                <input value={(s.degrees ?? []).join(' ')} onChange={(e) => setSound(s.id, { degrees: e.target.value.split(/\s+/).map(Number).filter((n) => Number.isFinite(n) && n > 0) })} />
                <span className="hint">scale degrees in the key: 1 5 8 10 = root, fifth, octave, third above</span>
              </label>
            ) : (
              <label className="row col">Notes <span className="hint">one token per 8th · "." rest · "a4:2" hold · written in C, played in the key</span>
                <textarea value={s.notes ?? ''} rows={2} onChange={(e) => setSound(s.id, { notes: e.target.value })} data-testid={`notes-${s.id}`} />
                {parsed && parsed.errors.length > 0 && <span className="err">{parsed.errors.join('; ')}</span>}
                {parsed && <span className="hint">{parsed.motif.notes.length} notes over {parsed.motif.length} steps</span>}
              </label>
            )}
            <label className="row">Level <input type="range" min={0} max={1} step={0.01} value={s.volume} onChange={(e) => setSound(s.id, { volume: +e.target.value })} /></label>
            {live && (
              <div className="live">
                {PROPERTIES.map((p) => <span key={p} className="meter" title={p}><i style={{ width: `${Math.round(live[p] * 100)}%` }} />{p}</span>)}
              </div>
            )}
          </div>
        );
      })}
      <button onClick={add} data-testid="add-sound">+ add sound</button>
    </section>
  );
}

// ---------- Rules ----------
export function RulesPanel({ rt, score, update }: { rt: Runtime; score: Score; update: (s: Score) => void }) {
  const setRule = (id: string, patch: Partial<Rule>) => update({ ...score, rules: score.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const add = () => update({ ...score, rules: [...score.rules, { id: uid('r'), input: score.inputs[0].id, when: { kind: 'always' }, do: { kind: 'set', sound: score.sounds[0].id, property: 'volume', range: [...score.inputs[0].range] as [number, number], curve: 'linear', smooth: 1 }, enabled: true }] });
  const remove = (id: string) => update({ ...score, rules: score.rules.filter((r) => r.id !== id) });
  return (
    <section className="panel" data-panel="rules">
      <h2>Score <span className="hint">how quantity and slope become sound</span></h2>
      {score.rules.map((r) => <RuleRow key={r.id} rt={rt} score={score} rule={r} set={(p) => setRule(r.id, p)} remove={() => remove(r.id)} />)}
      <button onClick={add} data-testid="add-rule">+ add rule</button>
    </section>
  );
}

function RuleRow({ rt, score, rule, set, remove }: { rt: Runtime; score: Score; rule: Rule; set: (p: Partial<Rule>) => void; remove: () => void }) {
  const input = score.inputs.find((i) => i.id === rule.input) ?? score.inputs[0];
  const v = rt.timeline.value(input.id);
  const holds = rule.enabled && rule.when.kind !== 'always' && Number.isFinite(v) && (rule.when.kind === 'below' ? v < rule.when.value : v > rule.when.value);
  const setWhen = (kind: Condition['kind']) => set({ when: kind === 'always' ? { kind } : { kind, value: rule.when.kind === 'always' ? (input.range[0] + input.range[1]) / 2 : rule.when.value, for: rule.when.kind === 'always' ? 10 : rule.when.for } });
  const setDo = (kind: Action['kind']) => {
    const sound = rule.do.sound === 'piece' ? score.sounds[0].id : rule.do.sound;
    const d: Action = kind === 'set' ? { kind, sound, property: 'volume', range: [...input.range] as [number, number], curve: 'linear', smooth: 1 }
      : kind === 'introduce' ? { kind, sound, concept: 'minor', fade: 4 } : { kind, sound, quantize: 'bar', cooldown: 60 };
    set({ do: d });
  };
  const step = input.unit === 'ratio' ? 0.005 : 1;
  return (
    <div className={`rule ${holds ? 'holds' : ''}`} data-testid={`rule-${rule.id}`}>
      <div className="row">
        <input type="checkbox" checked={rule.enabled} onChange={(e) => set({ enabled: e.target.checked })} title="enabled" />
        <span>when</span>
        <select value={rule.input} onChange={(e) => { const ni = score.inputs.find((i) => i.id === e.target.value)!; set({ input: ni.id, ...(rule.do.kind === 'set' ? { do: { ...rule.do, range: [...ni.range] as [number, number] } } : {}) }); }} data-testid={`rule-input-${rule.id}`}>
          {score.inputs.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
        </select>
        <select value={rule.when.kind} onChange={(e) => setWhen(e.target.value as Condition['kind'])} data-testid={`rule-when-${rule.id}`}>
          <option value="always">always</option><option value="below">is below</option><option value="above">is above</option>
        </select>
        {rule.when.kind !== 'always' && (
          <>
            <input type="number" step={step} value={rule.when.value} onChange={(e) => set({ when: { ...rule.when, value: +e.target.value } as Condition })} className="num" data-testid={`rule-threshold-${rule.id}`} />
            <input type="range" min={input.range[0]} max={input.range[1]} step={step} value={rule.when.value} onChange={(e) => set({ when: { ...rule.when, value: +e.target.value } as Condition })} title={`now ${fmt(v, input.unit)}`} />
            <span>for</span>
            <input type="number" min={0} value={rule.when.for} onChange={(e) => set({ when: { ...rule.when, for: +e.target.value } as Condition })} className="num" /> s
          </>
        )}
        <span className="hint">now {fmt(v, input.unit)}</span>
        <button className="ghost" onClick={remove} title="Remove">✕</button>
      </div>
      <div className="row indent">
        <span>→</span>
        <select value={rule.do.kind} onChange={(e) => setDo(e.target.value as Action['kind'])} data-testid={`rule-do-${rule.id}`}>
          <option value="set">drive</option><option value="introduce">introduce</option><option value="trigger">trigger</option>
        </select>
        {rule.do.kind === 'set' && (
          <>
            <select value={rule.do.sound} onChange={(e) => set({ do: { ...rule.do, sound: e.target.value } as Action })}>{score.sounds.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
            <select value={rule.do.property} onChange={(e) => set({ do: { ...rule.do, property: e.target.value } as Action })}>{PROPERTIES.map((p) => <option key={p} value={p}>{p}</option>)}</select>
            <span>from</span><input type="number" className="num" step={step} value={rule.do.range[0]} onChange={(e) => set({ do: { ...rule.do, range: [+e.target.value, (rule.do as any).range[1]] } as Action })} />
            <span>to</span><input type="number" className="num" step={step} value={rule.do.range[1]} onChange={(e) => set({ do: { ...rule.do, range: [(rule.do as any).range[0], +e.target.value] } as Action })} />
            <select value={rule.do.curve} onChange={(e) => set({ do: { ...rule.do, curve: e.target.value } as Action })}><option value="linear">linear</option><option value="log">log</option><option value="exp">exp</option><option value="steps">steps</option></select>
            <span>smooth</span><input type="number" className="num" step={0.1} min={0} value={rule.do.smooth} onChange={(e) => set({ do: { ...rule.do, smooth: +e.target.value } as Action })} /> s
          </>
        )}
        {rule.do.kind === 'introduce' && (
          <>
            <select value={rule.do.concept} onChange={(e) => set({ do: { ...rule.do, concept: e.target.value } as Action })}>{CONCEPTS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            <span>on</span>
            <select value={rule.do.sound} onChange={(e) => set({ do: { ...rule.do, sound: e.target.value } as Action })}><option value="piece">the whole piece</option>{score.sounds.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
            <span>fade</span><input type="number" className="num" min={0} value={rule.do.fade} onChange={(e) => set({ do: { ...rule.do, fade: +e.target.value } as Action })} /> s
            <span className="hint">releases when the condition reverses{rule.until ? ` (custom: ${rule.until.kind} ${'value' in rule.until ? rule.until.value : ''})` : ''}</span>
          </>
        )}
        {rule.do.kind === 'trigger' && (
          <>
            <select value={rule.do.sound} onChange={(e) => set({ do: { ...rule.do, sound: e.target.value } as Action })}>{score.sounds.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
            <span>on the next</span>
            <select value={rule.do.quantize} onChange={(e) => set({ do: { ...rule.do, quantize: e.target.value } as Action })}><option value="beat">beat</option><option value="bar">bar</option></select>
            <span>cooldown</span><input type="number" className="num" min={0} value={rule.do.cooldown} onChange={(e) => set({ do: { ...rule.do, cooldown: +e.target.value } as Action })} /> s
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Timeline ----------
export function TimelinePanel({ rt, score }: { rt: Runtime; score: Score }) {
  const log = [...rt.rules.log].reverse().slice(0, 12);
  const name = (id: string) => score.rules.find((r) => r.id === id) ? `${score.rules.findIndex((r) => r.id === id) + 1}` : id;
  return (
    <section className="panel timeline" data-panel="timeline">
      <h2>Timeline <span className="hint">what fired, when (seconds since start)</span></h2>
      <ul data-testid="firings">
        {log.length === 0 && <li className="hint">nothing has fired yet</li>}
        {log.map((l, k) => <li key={k}><span className="t">{l.t.toFixed(0)} s</span> rule {name(l.ruleId)}: {l.text}</li>)}
      </ul>
    </section>
  );
}
