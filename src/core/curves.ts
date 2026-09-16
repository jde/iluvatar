import type { Curve } from './types';

/** Map a raw value onto 0..1 through a range and a curve. Clamped. */
export function normalize(value: number, range: [number, number], curve: Curve): number {
  const [lo, hi] = range;
  if (!Number.isFinite(value) || hi === lo) return 0;
  let t: number;
  if (curve === 'log') {
    // log scale for quantities that span decades (rates); guards against lo <= 0
    const l = Math.max(lo, 1e-6), h = Math.max(hi, l * 1.000001), v = Math.max(value, l);
    t = (Math.log(v) - Math.log(l)) / (Math.log(h) - Math.log(l));
  } else {
    t = (value - lo) / (hi - lo);
  }
  t = clamp01(t);
  if (curve === 'exp') t = t * t;
  if (curve === 'steps') t = Math.round(t * 4) / 4;
  return t;
}

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** One-pole smoothing toward a target: `smooth` is the time constant in seconds. */
export function smoothStep(current: number, target: number, smooth: number, dt: number): number {
  if (smooth <= 0 || dt <= 0) return target;
  const a = 1 - Math.exp(-dt / smooth);
  return current + (target - current) * a;
}
