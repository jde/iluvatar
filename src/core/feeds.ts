/**
 * Mock feeds — traffic (visits/s) and errors (ratio 0..1) — produced by named scenarios.
 * docs/02 §3 Timeline: scenarios let a composer hear every rule without waiting for the system.
 *
 * Every scenario is a shape over one cycle, phase u in [0, 1). The cycle length (seconds) is the
 * composer's "scenario length" slider, so the same drama can be played over 20 s or 10 min.
 * Scenarios loop forever; every shape ends where it starts so the wrap is seamless.
 * Deterministic given (scenario, t, duration) apart from a small seeded jitter, so tests are stable.
 */
export type ScenarioId = 'quiet' | 'lunch_peak' | 'surge' | 'slow_bleed' | 'outage' | 'manual';

export const SCENARIOS: { id: ScenarioId; label: string; blurb: string }[] = [
  { id: 'quiet', label: 'Quiet night', blurb: 'Low steady traffic, almost no errors.' },
  { id: 'lunch_peak', label: 'Lunch peak', blurb: 'Traffic climbs from 20 to 220 over the first 40 % of the cycle, holds, and eases back.' },
  { id: 'surge', label: 'Surge', blurb: 'Traffic jumps sevenfold in the first fifth of the cycle, holds, then falls back to baseline.' },
  { id: 'slow_bleed', label: 'Slow bleed', blurb: 'Errors creep from 0.5 % to 60 % over four fifths of the cycle while traffic drains, then a fix snaps them back.' },
  { id: 'outage', label: 'Outage and recovery', blurb: 'Errors climb to 100 % and traffic collapses; then errors slowly return to 0 over the second half of the cycle.' },
  { id: 'manual', label: 'Manual', blurb: 'You set traffic and errors by hand.' },
];

export const DEFAULT_DURATION = 180;
export const MIN_DURATION = 20;
export const MAX_DURATION = 600;

export interface FeedValues { traffic: number; errors: number }

// Tiny seeded noise so the lines breathe without randomness between runs.
function jitter(t: number, seed: number, amp: number) {
  const x = Math.sin(t * 1.7 + seed) * 0.5 + Math.sin(t * 0.37 + seed * 2) * 0.5;
  return x * amp;
}

/** Smooth 0→1 as x goes a→b (clamped). */
const ramp = (x: number, a: number, b: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The pure shape of a scenario at phase u in [0, 1): no jitter, exactly periodic. Manual is flat. */
export function shapeAt(id: ScenarioId, u: number, manual: FeedValues = { traffic: 40, errors: 0.01 }): FeedValues {
  u = ((u % 1) + 1) % 1;
  switch (id) {
    case 'quiet':
      return { traffic: 8, errors: 0.003 };
    case 'lunch_peak': {
      const level = ramp(u, 0.05, 0.4) * (1 - ramp(u, 0.6, 0.95));
      return { traffic: 20 + 200 * level, errors: 0.01 + 0.02 * level };
    }
    case 'surge': {
      const level = ramp(u, 0.05, 0.2) * (1 - ramp(u, 0.65, 0.9));
      return { traffic: 30 + 190 * level, errors: 0.01 + 0.07 * level };
    }
    case 'slow_bleed': {
      const bleed = ramp(u, 0, 0.8) * (1 - ramp(u, 0.8, 0.88));
      return { traffic: 40 - 25 * bleed, errors: 0.005 + 0.595 * bleed };
    }
    case 'outage': {
      // Errors: 1 % → 100 % fast (u 0.15–0.25), hold at 100 % to 0.45, then slowly back to 1 % by the end of the cycle.
      const down = ramp(u, 0.15, 0.25) * (1 - ramp(u, 0.45, 1.0));
      const errors = 0.01 + 0.99 * down;
      // Traffic collapses with the errors: 60 visits/s when clean, 3 when nothing works.
      return { traffic: 60 - 57 * down, errors };
    }
    case 'manual':
      return { ...manual };
  }
}

/** Scenario value at time t (seconds since the scenario started), looping every `duration` seconds. */
export function scenarioAt(id: ScenarioId, t: number, manual: FeedValues = { traffic: 40, errors: 0.01 }, duration = DEFAULT_DURATION): FeedValues {
  if (id === 'manual') return { ...manual };
  const s = shapeAt(id, (t / duration) % 1);
  const seed = SCENARIOS.findIndex((x) => x.id === id) * 2 + 1;
  const traffic = Math.max(0, s.traffic + jitter(t, seed, Math.max(0.5, s.traffic * 0.06)));
  // Error jitter fades to nothing as errors approach 100 %, so a full outage reads exactly 100 %.
  const eAmp = Math.max(0.001, s.errors * 0.08) * (1 - s.errors);
  const errors = Math.min(1, Math.max(0, s.errors + jitter(t, seed + 1, eAmp)));
  return { traffic, errors };
}

export class FeedEngine {
  private started = false;
  private startedAt = 0;
  private lastTick = 0;
  public scenario: ScenarioId = 'quiet';
  public manual: FeedValues = { traffic: 40, errors: 0.01 };
  /** Seconds per scenario cycle. */
  public duration = DEFAULT_DURATION;

  /** Called each engine tick with the current clock time (seconds). Returns fresh values, once per second. */
  tick(now: number): { t: number; values: FeedValues } | null {
    if (!this.started) { this.started = true; this.startedAt = now; this.lastTick = now - 1; }
    if (now - this.lastTick < 1) return null;
    this.lastTick = now;
    return { t: now, values: scenarioAt(this.scenario, now - this.startedAt, this.manual, this.duration) };
  }

  setScenario(id: ScenarioId, now: number) { this.scenario = id; this.started = true; this.startedAt = now; this.lastTick = now - 1; }

  /** Change the cycle length without jumping: the scenario stays at the same phase. */
  setDuration(d: number, now: number) {
    d = Math.min(MAX_DURATION, Math.max(MIN_DURATION, d));
    const { u } = this.phase(now);
    this.duration = d;
    this.startedAt = now - u * d;
  }

  /** Where in the loop we are: phase u in [0, 1) and the 1-based cycle number. */
  phase(now: number): { u: number; cycle: number } {
    const elapsed = Math.max(0, now - (this.started ? this.startedAt : now));
    return { u: (elapsed / this.duration) % 1, cycle: Math.floor(elapsed / this.duration) + 1 };
  }
}
