/**
 * The runtime wires the pipeline: feeds → timeline → rules → audio, ticking every 250 ms.
 * The UI owns the score; the runtime is told about score changes and exposes read-only state.
 */
import { AudioEngine } from './audio/engine';
import { FeedEngine, type FeedMode, type FeedValues, type ScenarioId } from './core/feeds';
import { RuleEngine } from './core/rules';
import { Timeline } from './core/timeline';
import type { Score } from './core/types';

export class Runtime {
  readonly feeds = new FeedEngine();
  readonly rules = new RuleEngine();
  readonly audio = new AudioEngine();
  timeline: Timeline;
  private score: Score;
  private timer: number | null = null;
  private listeners = new Set<() => void>();
  private t0 = performance.now();
  public now = 0;

  constructor(score: Score) { this.score = score; this.timeline = new Timeline(score.inputs); }

  setScore(score: Score) {
    const inputsChanged = JSON.stringify(score.inputs) !== JSON.stringify(this.score.inputs);
    this.score = score;
    if (inputsChanged) this.timeline.setInputs(score.inputs);
    this.audio.syncSounds(score.sounds);
    this.audio.setClock(score.clock);
    this.emit();
  }

  getScore() { return this.score; }

  setScenario(id: ScenarioId) { this.feeds.setScenario(id, this.now); this.timeline.clear(); this.rules.reset(); this.emit(); }
  setScenarioDuration(seconds: number) { this.feeds.setDuration(seconds, this.now); this.emit(); }
  setMode(mode: FeedMode) { this.feeds.setMode(mode, this.now); if (mode === 'scenario') { this.timeline.clear(); this.rules.reset(); } this.emit(); }
  /** Free form: a dial moved. The value lands on the timeline immediately, not at the next one-second tick. */
  setDial(feed: keyof FeedValues, value: number) {
    const values = this.feeds.setDial(feed, value);
    for (const i of this.score.inputs) if (i.feed === feed) this.timeline.push(i.id, this.now, values[feed]);
    this.emit();
  }

  async startAudio() { await this.audio.start(); this.audio.syncSounds(this.score.sounds); this.audio.play(); this.emit(); }
  togglePlay() { if (this.audio.playing) this.audio.pause(); else this.audio.play(); this.emit(); }

  run() {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => this.tick(), 250);
  }

  private tick() {
    this.now = (performance.now() - this.t0) / 1000;
    const fresh = this.feeds.tick(this.now);
    if (fresh) {
      for (const i of this.score.inputs) if (i.feed) this.timeline.push(i.id, fresh.t, fresh.values[i.feed]);
    }
    const effects = this.rules.evaluate(this.score, this.timeline, this.now);
    if (this.audio.started) this.audio.applyEffects(effects);
    this.emit();
  }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { for (const l of this.listeners) l(); }
}
