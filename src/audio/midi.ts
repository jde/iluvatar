/**
 * MIDI out: the same notes the browser plays, sent to a synth, a DAW, or the Mac's IAC bus through
 * the Web MIDI API (Chrome, Edge, Firefox; not Safari). docs/02 §2 and step 7.
 * Ports are remembered by name (ids change between sessions); channels are 1–16 as on the hardware.
 */

export const CC = { volume: 7, brightness: 74, allNotesOff: 123 } as const;
/** Default pitch-bend range on GM synths: ±2 semitones. */
export const BEND_RANGE_CENTS = 200;

const clamp7 = (n: number) => Math.max(0, Math.min(127, Math.round(n)));
const status = (kind: number, channel: number) => kind | ((Math.max(1, Math.min(16, channel)) - 1) & 0x0f);

export const noteOn = (channel: number, note: number, velocity: number) => [status(0x90, channel), clamp7(note), Math.max(1, clamp7(velocity))];
export const noteOff = (channel: number, note: number) => [status(0x80, channel), clamp7(note), 0];
export const controlChange = (channel: number, cc: number, value: number) => [status(0xb0, channel), clamp7(cc), clamp7(value)];
/** Pitch bend from cents, given the receiver's bend range. 8192 is centre. */
export function pitchBend(channel: number, cents: number, rangeCents = BEND_RANGE_CENTS) {
  const v = Math.max(0, Math.min(16383, Math.round(8192 + (cents / rangeCents) * 8192)));
  return [status(0xe0, channel), v & 0x7f, v >> 7];
}

/** An audio-clock time (seconds, Tone/AudioContext) as a Web MIDI timestamp (ms, performance clock). */
export function audioTimeToMidi(time: number, audioNow: number, perfNow: number) {
  return perfNow + Math.max(0, time - audioNow) * 1000;
}

export type MidiStatus = 'unsupported' | 'idle' | 'asking' | 'ready' | 'denied';

/** What the engine needs from a MIDI port: send bytes now or at a performance-clock timestamp. */
export interface PortLike { name: string | null; state?: string; send(data: number[], timestamp?: number): void }
export interface AccessLike { outputs: Map<string, PortLike> | { values(): IterableIterator<PortLike> }; onstatechange: ((e: unknown) => void) | null }

export class MidiOut {
  status: MidiStatus;
  private access: AccessLike | null = null;
  /** Notes still sounding, so a stop or a panic can end them: key `${port}|${ch}|${note}` → off timer. */
  private sounding = new Map<string, { timer: ReturnType<typeof setTimeout> | null; port: string; channel: number; note: number; offAt: number }>();
  /** Last controller values sent per port/channel, so the step clock only sends changes. */
  private sent = new Map<string, number>();
  onChange: () => void = () => {};

  constructor(private nav: { requestMIDIAccess?: (o?: { sysex?: boolean }) => Promise<unknown> } | undefined = typeof navigator !== 'undefined' ? navigator : undefined,
    private now: () => number = () => performance.now()) {
    this.status = nav?.requestMIDIAccess ? 'idle' : 'unsupported';
  }

  /** Ask the browser for MIDI. Needs a click in some browsers; shows a permission prompt in others. */
  async connect(): Promise<void> {
    if (!this.nav?.requestMIDIAccess || this.status === 'ready') return;
    this.status = 'asking'; this.onChange();
    try {
      this.access = (await this.nav.requestMIDIAccess({ sysex: false })) as AccessLike;
      this.access.onstatechange = () => this.onChange(); // a synth plugged in or out
      this.status = 'ready';
    } catch (e) { console.warn('MIDI access refused', e); this.status = 'denied'; }
    this.onChange();
  }

  /** Names of the connected output ports. */
  outputs(): string[] {
    if (!this.access) return [];
    return [...this.access.outputs.values()].filter((p) => p.state !== 'disconnected').map((p) => p.name ?? '(unnamed port)');
  }

  has(port: string) { return this.outputs().includes(port); }

  private port(name: string): PortLike | undefined {
    if (!this.access) return undefined;
    return [...this.access.outputs.values()].find((p) => p.name === name && p.state !== 'disconnected');
  }

  private send(port: string, data: number[], at?: number) {
    try { this.port(port)?.send(data, at); } catch (e) { console.warn('MIDI send failed', port, e); }
  }

  /**
   * Play a note: note-on at `at`, note-off `duration` ms later. The note-off is held back on a timer
   * (sent ~150 ms early with its exact timestamp) so a stop can still cancel it — a note-off already
   * handed to the port would cut a later note of the same pitch. Returns the stop function.
   */
  note(port: string, channel: number, note: number, velocity: number, at: number, duration: number): (atMs?: number) => void {
    const key = `${port}|${channel}|${note}`;
    this.release(key, at); // the same pitch is still sounding on this channel: end it first
    this.send(port, noteOn(channel, note, velocity), at);
    const offAt = at + duration;
    const entry = { port, channel, note, offAt, timer: null as ReturnType<typeof setTimeout> | null };
    entry.timer = setTimeout(() => { if (this.sounding.get(key) === entry) { this.sounding.delete(key); this.send(port, noteOff(channel, note), offAt); } }, Math.max(0, offAt - this.now() - 150));
    this.sounding.set(key, entry);
    return (atMs?: number) => { if (this.sounding.get(key) === entry) this.release(key, atMs); };
  }

  private release(key: string, atMs?: number) {
    const e = this.sounding.get(key);
    if (!e) return;
    if (e.timer) clearTimeout(e.timer);
    this.sounding.delete(key);
    this.send(e.port, noteOff(e.channel, e.note), atMs === undefined ? undefined : Math.min(atMs, e.offAt));
  }

  /** A controller value; sent only when it changed. */
  cc(port: string, channel: number, cc: number, value: number) {
    const v = clamp7(value), key = `${port}|${channel}|cc${cc}`;
    if (this.sent.get(key) === v) return;
    this.sent.set(key, v);
    this.send(port, controlChange(channel, cc, v));
  }

  bend(port: string, channel: number, cents: number) {
    const msg = pitchBend(channel, cents), v = msg[1] | (msg[2] << 7), key = `${port}|${channel}|bend`;
    if (this.sent.get(key) === v) return;
    this.sent.set(key, v);
    this.send(port, msg);
  }

  /** End every note this app started, then send all-notes-off on each channel it used. */
  panic() {
    const used = new Set<string>();
    for (const [key, e] of this.sounding) { used.add(`${e.port}|${e.channel}`); this.release(key); }
    for (const k of this.sent.keys()) used.add(k.split('|').slice(0, 2).join('|'));
    for (const u of used) { const [port, ch] = u.split('|'); this.send(port, controlChange(+ch, CC.allNotesOff, 0)); }
    this.sent.clear();
  }
}
