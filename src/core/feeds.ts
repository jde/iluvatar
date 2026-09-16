/**
 * Mock feeds — traffic (visits/s) and errors (ratio 0..1) — produced by named scenarios.
 * docs/02 §3 Timeline: scenarios let a composer hear every rule without waiting for the system.
 * Deterministic given (scenario, t) apart from a small seeded jitter, so tests are stable.
 */
export type ScenarioId = 'quiet' | 'lunch_peak' | 'surge' | 'slow_bleed' | 'outage' | 'manual';

export const SCENARIOS: { id: ScenarioId; label: string; blurb: string }[] = [
  { id: 'quiet', label: 'Quiet night', blurb: 'Low steady traffic, almost no errors.' },
  { id: 'lunch_peak', label: 'Lunch peak', blurb: 'Traffic climbs to a peak over 2 minutes and eases.' },
  { id: 'surge', label: 'Surge', blurb: 'Traffic triples in 30 seconds, then holds.' },
  { id: 'slow_bleed', label: 'Slow bleed', blurb: 'Errors creep up from 0.5% to 20% over 3 minutes.' },
  { id: 'outage', label: 'Outage and recovery', blurb: 'At 60 s errors jump to 60% and traffic halves; at 150 s both recover.' },
  { id: 'manual', label: 'Manual', blurb: 'You set traffic and errors by hand.' },
];

export interface FeedValues { traffic: number; errors: number }

// Tiny seeded noise so the lines breathe without randomness between runs.
function jitter(t: number, seed: number, amp: number) {
  const x = Math.sin(t * 1.7 + seed) * 0.5 + Math.sin(t * 0.37 + seed * 2) * 0.5;
  return x * amp;
}

const smooth01 = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/** Scenario value at time t (seconds since the scenario started). */
export function scenarioAt(id: ScenarioId, t: number, manual: FeedValues = { traffic: 40, errors: 0.01 }): FeedValues {
  switch (id) {
    case 'quiet':
      return { traffic: 8 + jitter(t, 1, 1.5), errors: Math.max(0, 0.003 + jitter(t, 2, 0.002)) };
    case 'lunch_peak': {
      const rise = smooth01(t / 120), fall = smooth01((t - 180) / 120);
      const level = 20 + 160 * rise * (1 - fall);
      return { traffic: level + jitter(t, 3, 4), errors: Math.max(0, 0.01 + 0.01 * rise * (1 - fall) + jitter(t, 4, 0.003)) };
    }
    case 'surge': {
      const up = smooth01((t - 20) / 30);
      return { traffic: 40 + 80 * up + jitter(t, 5, 3), errors: Math.max(0, 0.01 + 0.03 * up + jitter(t, 6, 0.004)) };
    }
    case 'slow_bleed': {
      const b = smooth01(t / 180);
      return { traffic: 40 + jitter(t, 7, 3), errors: Math.max(0, 0.005 + 0.195 * b + jitter(t, 8, 0.005)) };
    }
    case 'outage': {
      const inOutage = t >= 60 && t < 150;
      const recover = smooth01((t - 150) / 20);
      const errors = inOutage ? 0.6 + jitter(t, 9, 0.05) : t >= 150 ? 0.6 * (1 - recover) + 0.01 : 0.01;
      const traffic = inOutage ? 20 + jitter(t, 10, 2) : t >= 150 ? 20 + 20 * recover : 40 + jitter(t, 10, 2);
      return { traffic, errors: Math.max(0, errors) };
    }
    case 'manual':
      return { ...manual };
  }
}

export class FeedEngine {
  private started = false;
  private startedAt = 0;
  private lastTick = 0;
  public scenario: ScenarioId = 'quiet';
  public manual: FeedValues = { traffic: 40, errors: 0.01 };

  /** Called each engine tick with the current clock time (seconds). Returns fresh values, once per second. */
  tick(now: number): { t: number; values: FeedValues } | null {
    if (!this.started) { this.started = true; this.startedAt = now; this.lastTick = now - 1; }
    if (now - this.lastTick < 1) return null;
    this.lastTick = now;
    return { t: now, values: scenarioAt(this.scenario, now - this.startedAt, this.manual) };
  }

  setScenario(id: ScenarioId, now: number) { this.scenario = id; this.started = true; this.startedAt = now; this.lastTick = now - 1; }
}
