import { useEffect, useMemo, useReducer, useState } from 'react';
import { defaultScore, scoreFromYaml, scoreToYaml } from '../core/score';
import type { Score } from '../core/types';
import { Runtime } from '../runtime';
import { LibraryPage } from './library';
import { InputsPanel, RulesPanel, SoundsPanel, TimelinePanel } from './panels';

const STORAGE_KEY = 'iluvatar.score.v1';

function loadScore(): Score {
  try { const t = localStorage.getItem(STORAGE_KEY); if (t) return scoreFromYaml(t); } catch (e) { console.warn('stored score ignored', e); }
  return defaultScore();
}

export default function App() {
  const [score, setScoreState] = useState<Score>(loadScore);
  const rt = useMemo(() => new Runtime(score), []);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [err, setErr] = useState<string | null>(null);
  const [route, setRoute] = useState(() => location.hash);
  useEffect(() => { const on = () => setRoute(location.hash); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  const onLibrary = route.startsWith('#/library');

  useEffect(() => { rt.run(); return rt.subscribe(bump); }, [rt]);

  const update = (s: Score) => {
    setScoreState(s); rt.setScore(s);
    try { localStorage.setItem(STORAGE_KEY, scoreToYaml(s)); } catch { /* private mode etc. */ }
  };

  const exportYaml = () => {
    const blob = new Blob([scoreToYaml(score)], { type: 'text/yaml' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${score.name.replace(/\W+/g, '-').toLowerCase()}.yaml`; a.click();
  };
  const importYaml = async (f: File | undefined) => {
    if (!f) return;
    try { update(scoreFromYaml(await f.text())); setErr(null); } catch (e) { setErr(String(e)); }
  };

  return (
    <div className="app">
      <header>
        <h1>Ilúvatar <span className="hint">{onLibrary ? 'library' : `composer · ${score.name}`}</span></h1>
        <nav className="nav">
          <a href="#/" className={onLibrary ? '' : 'here'} data-testid="nav-composer">Composer</a>
          <a href="#/library" className={onLibrary ? 'here' : ''} data-testid="nav-library">Library</a>
        </nav>
        {onLibrary ? null : <div className="transport">
          {!rt.audio.started
            ? <button className="primary" onClick={() => rt.startAudio()} data-testid="start-audio">Start audio</button>
            : <button onClick={() => rt.togglePlay()} data-testid="play-pause">{rt.audio.playing ? '❚❚ pause' : '▶ play'}</button>}
          <label>bpm <input type="number" className="num" min={30} max={200} value={score.clock.bpm} onChange={(e) => update({ ...score, clock: { ...score.clock, bpm: +e.target.value } })} /></label>
          <label>key
            <select value={score.clock.key} onChange={(e) => update({ ...score, clock: { ...score.clock, key: e.target.value } })}>
              {['C', 'D', 'Eb', 'E', 'F', 'G', 'A', 'Bb', 'B'].map((k) => <option key={k}>{k}</option>)}
            </select>
          </label>
          <label>mode
            <select value={score.clock.mode} onChange={(e) => update({ ...score, clock: { ...score.clock, mode: e.target.value as Score['clock']['mode'] } })}>
              {['ionian', 'dorian', 'aeolian', 'lydian', 'mixolydian'].map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label>volume <input type="range" min={0} max={1} step={0.01} value={rt.audio.masterVolume} onChange={(e) => { rt.audio.setMasterVolume(+e.target.value); bump(); }} /></label>
          <button onClick={exportYaml}>export score</button>
          <label className="file">import <input type="file" accept=".yaml,.yml" onChange={(e) => importYaml(e.target.files?.[0])} /></label>
          <button className="ghost" onClick={() => { if (confirm('Replace the current score with the starter score?')) update(defaultScore()); }}>reset</button>
        </div>}
        {err && <p className="err">{err}</p>}
        {!onLibrary && <p className="hint">t = {rt.now.toFixed(0)} s · {rt.audio.started ? (rt.audio.playing ? 'playing' : 'paused') : 'press Start audio (browsers need a click before sound)'}</p>}
      </header>
      {onLibrary ? <LibraryPage rt={rt} /> : <main>
        <div className="col">
          <InputsPanel rt={rt} score={score} />
          <TimelinePanel rt={rt} score={score} />
        </div>
        <RulesPanel rt={rt} score={score} update={update} />
        <SoundsPanel rt={rt} score={score} update={update} />
      </main>}
    </div>
  );
}
