import { normalize } from './curves';
import type { Timeline } from './timeline';
import type { Condition, Effect, Score } from './types';

/** Per-rule memory between ticks: when a condition started holding, when it last fired, whether a concept is on. */
interface RuleState { holdingSince: number | null; lastFired: number; active: boolean }

const inverse = (c: Condition): Condition | null =>
  c.kind === 'below' ? { kind: 'above', value: c.value, for: 0 } : c.kind === 'above' ? { kind: 'below', value: c.value, for: 0 } : null;

/**
 * Evaluates the score's rules against the timeline once per tick and returns effects.
 * Stateless in its inputs; stateful only in per-rule hold/cooldown/active memory.
 */
export class RuleEngine {
  private state = new Map<string, RuleState>();
  public log: { t: number; ruleId: string; text: string }[] = [];

  private st(id: string): RuleState {
    let s = this.state.get(id);
    if (!s) { s = { holdingSince: null, lastFired: -Infinity, active: false }; this.state.set(id, s); }
    return s;
  }

  /** Does the condition hold right now (ignoring `for`)? NaN values hold nothing. */
  static holds(c: Condition, value: number): boolean {
    if (c.kind === 'always') return true;
    if (!Number.isFinite(value)) return false;
    return c.kind === 'below' ? value < c.value : value > c.value;
  }

  private holdFor(c: Condition, value: number, s: RuleState, now: number): boolean {
    if (!RuleEngine.holds(c, value)) { s.holdingSince = null; return false; }
    if (s.holdingSince === null) s.holdingSince = now;
    const need = c.kind === 'always' ? 0 : c.for;
    return now - s.holdingSince >= need;
  }

  evaluate(score: Score, tl: Timeline, now: number): Effect[] {
    const out: Effect[] = [];
    for (const r of score.rules) {
      if (!r.enabled) continue;
      const s = this.st(r.id);
      const v = tl.value(r.input);
      const a = r.do;
      if (a.kind === 'set') {
        // Continuous mapping: while the condition holds, the value drives the property. Outside it, nothing is emitted.
        if (this.holdFor(r.when, v, s, now)) out.push({ kind: 'set', sound: a.sound, property: a.property, value: normalize(v, a.range, a.curve), smooth: a.smooth, ruleId: r.id });
        continue;
      }
      if (a.kind === 'introduce') {
        if (!s.active) {
          if (this.holdFor(r.when, v, s, now)) {
            s.active = true; s.holdingSince = null;
            out.push({ kind: 'concept', sound: a.sound, concept: a.concept, active: true, fade: a.fade, ruleId: r.id });
            this.log.push({ t: now, ruleId: r.id, text: `introduce ${a.concept} on ${a.sound}` });
          }
        } else {
          const rel = r.until ?? inverse(r.when);
          if (rel && this.holdFor(rel, v, s, now)) {
            s.active = false; s.holdingSince = null;
            out.push({ kind: 'concept', sound: a.sound, concept: a.concept, active: false, fade: a.fade, ruleId: r.id });
            this.log.push({ t: now, ruleId: r.id, text: `release ${a.concept} on ${a.sound}` });
          }
        }
        continue;
      }
      if (a.kind === 'trigger') {
        // Fires once per crossing: the condition must stop holding before it can fire again, and cooldown applies.
        const holdsNow = this.holdFor(r.when, v, s, now);
        if (holdsNow && !s.active && now - s.lastFired >= a.cooldown) {
          s.active = true; s.lastFired = now;
          out.push({ kind: 'trigger', sound: a.sound, quantize: a.quantize, ruleId: r.id, at: now });
          this.log.push({ t: now, ruleId: r.id, text: `trigger ${a.sound}` });
        }
        if (!RuleEngine.holds(r.when, v)) s.active = false;
      }
    }
    if (this.log.length > 200) this.log.splice(0, this.log.length - 200);
    return out;
  }

  reset() { this.state.clear(); this.log = []; }
}
