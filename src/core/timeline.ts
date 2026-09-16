import type { Input, InputId } from './types';

export interface Sample { t: number; v: number }

/**
 * A ring buffer per input, plus derived inputs (slopes). Times are seconds on one clock.
 * docs/01 §2: every metric becomes a signal on a timeline; slopes are named derived inputs.
 */
export class Timeline {
  private buf = new Map<InputId, Sample[]>();
  constructor(private inputs: Input[], private keepSeconds = 600) {
    for (const i of inputs) this.buf.set(i.id, []);
  }

  setInputs(inputs: Input[]) {
    this.inputs = inputs;
    for (const i of inputs) if (!this.buf.has(i.id)) this.buf.set(i.id, []);
  }

  /** Push a raw sample for a fed input, then refresh every derived input at the same time. */
  push(id: InputId, t: number, v: number) {
    const arr = this.buf.get(id);
    if (!arr) return;
    arr.push({ t, v });
    while (arr.length && arr[0].t < t - this.keepSeconds) arr.shift();
    for (const d of this.inputs) {
      if (d.derive && d.derive.of === id) {
        const s = this.slope(id, d.derive.slope_over, t);
        const darr = this.buf.get(d.id)!;
        darr.push({ t, v: s });
        while (darr.length && darr[0].t < t - this.keepSeconds) darr.shift();
      }
    }
  }

  /** Forget everything — a scenario change is a new run. */
  clear() { for (const k of this.buf.keys()) this.buf.set(k, []); }

  /** Latest value, or NaN when there is no data. */
  value(id: InputId): number {
    const arr = this.buf.get(id);
    return arr && arr.length ? arr[arr.length - 1].v : NaN;
  }

  /** Samples within the last `seconds`. */
  recent(id: InputId, seconds: number, now?: number): Sample[] {
    const arr = this.buf.get(id) ?? [];
    const t = now ?? (arr.length ? arr[arr.length - 1].t : 0);
    return arr.filter((s) => s.t >= t - seconds);
  }

  /**
   * Least-squares slope over the window, expressed per minute. NaN until the points span at least
   * half the window — two samples a second apart would turn jitter into a "surge".
   */
  slope(id: InputId, windowSeconds: number, now?: number): number {
    const pts = this.recent(id, windowSeconds, now);
    if (pts.length < 2 || pts[pts.length - 1].t - pts[0].t < windowSeconds / 2) return NaN;
    const n = pts.length;
    let st = 0, sv = 0;
    for (const p of pts) { st += p.t; sv += p.v; }
    const mt = st / n, mv = sv / n;
    let num = 0, den = 0;
    for (const p of pts) { num += (p.t - mt) * (p.v - mv); den += (p.t - mt) * (p.t - mt); }
    if (den === 0) return 0;
    return (num / den) * 60;
  }
}
