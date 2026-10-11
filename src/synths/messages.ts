/** A control's position (0..1) as the MIDI bytes its synth expects: 7-bit CC, 14-bit CC pair, or NRPN. */
import { controlChange } from '../audio/midi';
import type { Control } from './types';

/** For a switch, the middle of the chosen step's range, so the synth lands squarely on it. */
export function stepValue(c: Control, index: number): number {
  const s = c.steps![Math.max(0, Math.min(c.steps!.length - 1, index))];
  const top = c.nrpn ? c.nrpn.max : c.ccLsb !== undefined ? 16383 : 127;
  return Math.round((s.from + s.to) / 2) / top;
}

/** Which step a 0..1 position falls in. */
export function stepIndex(c: Control, v: number): number {
  if (!c.steps?.length) return 0;
  const top = c.nrpn ? c.nrpn.max : c.ccLsb !== undefined ? 16383 : 127, raw = v * top;
  const i = c.steps.findIndex((s) => raw >= s.from && raw <= s.to + 0.999);
  return i >= 0 ? i : raw < c.steps[0].from ? 0 : c.steps.length - 1;
}

/** The raw number sent (for dedupe and display). */
export function rawValue(c: Control, v: number): number {
  const x = Math.max(0, Math.min(1, v));
  if (c.nrpn) return Math.round(x * c.nrpn.max);
  if (c.ccLsb !== undefined) return Math.round(x * 16383);
  return Math.round(x * 127);
}

export function controlMessages(c: Control, channel: number, v: number): number[][] {
  const raw = rawValue(c, v);
  if (c.nrpn) {
    const p = c.nrpn.param;
    // NRPN: select the parameter (CC 99 MSB, CC 98 LSB), then data entry (CC 6, and CC 38 for 14-bit values).
    const select = [controlChange(channel, 99, p >> 7), controlChange(channel, 98, p & 0x7f)];
    // 7-bit parameters take their value in data entry MSB alone; wider ones split it over MSB and LSB.
    return c.nrpn.max <= 127 ? [...select, controlChange(channel, 6, raw)] : [...select, controlChange(channel, 6, raw >> 7), controlChange(channel, 38, raw & 0x7f)];
  }
  if (c.cc === undefined) return [];
  if (c.ccLsb !== undefined) return [controlChange(channel, c.cc, raw >> 7), controlChange(channel, c.ccLsb, raw & 0x7f)];
  return [controlChange(channel, c.cc, raw)];
}

/** "CC 43", "CC 19/51", "NRPN 15" — shown next to each knob. */
export function addressLabel(c: Control): string {
  if (c.nrpn) return `NRPN ${c.nrpn.param}`;
  if (c.cc === undefined) return 'no MIDI';
  return (c.ccLsb !== undefined ? `CC ${c.cc}/${c.ccLsb}` : `CC ${c.cc}`) + (c.suggested ? ' (learn)' : '');
}
