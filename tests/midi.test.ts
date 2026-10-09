import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MidiOut, audioTimeToMidi, controlChange, noteOff, noteOn, pitchBend, type PortLike } from '../src/audio/midi';
import { defaultScore, scoreFromYaml, scoreToYaml } from '../src/core/score';

describe('MIDI messages', () => {
  it('note on/off carry the channel in the status byte (1–16 → 0–15)', () => {
    expect(noteOn(1, 60, 100)).toEqual([0x90, 60, 100]);
    expect(noteOn(16, 60, 100)).toEqual([0x9f, 60, 100]);
    expect(noteOff(3, 62)).toEqual([0x82, 62, 0]);
  });
  it('clamps to 7 bits and never sends velocity 0 as a note-on (that means note-off)', () => {
    expect(noteOn(1, 200, 0)).toEqual([0x90, 127, 1]);
    expect(noteOn(1, -4, 300)).toEqual([0x90, 0, 127]);
    expect(controlChange(1, 74, 63.6)).toEqual([0xb0, 74, 64]);
  });
  it('pitch bend: 0 cents is centre, +200 cents is the top of a ±2 semitone range', () => {
    expect(pitchBend(1, 0)).toEqual([0xe0, 0, 64]); // 8192
    expect(pitchBend(1, 18)).toEqual([0xe0, (8192 + 737) & 0x7f, (8192 + 737) >> 7]);
    expect(pitchBend(1, 1000)).toEqual([0xe0, 0x7f, 0x7f]);
  });
  it('audio-clock seconds become performance-clock milliseconds', () => {
    expect(audioTimeToMidi(10.25, 10, 5000)).toBe(5250);
    expect(audioTimeToMidi(9, 10, 5000)).toBe(5000); // past times go now
  });
});

describe('MidiOut', () => {
  let sent: { data: number[]; at?: number }[];
  let port: PortLike;
  let now: number;
  let out: MidiOut;
  beforeEach(async () => {
    vi.useFakeTimers();
    sent = []; now = 1000;
    port = { name: 'IAC Driver Bus 1', state: 'connected', send: (data, at) => { sent.push({ data, at }); } };
    const access = { outputs: new Map([['id1', port]]), onstatechange: null };
    out = new MidiOut({ requestMIDIAccess: async () => access }, () => now);
    await out.connect();
  });
  afterEach(() => vi.useRealTimers());

  it('is unsupported without the Web MIDI API, ready with it, and lists ports by name', () => {
    expect(new MidiOut({}).status).toBe('unsupported');
    expect(out.status).toBe('ready');
    expect(out.outputs()).toEqual(['IAC Driver Bus 1']);
    expect(out.has('IAC Driver Bus 1')).toBe(true);
    expect(out.has('Nope')).toBe(false);
  });

  it('a refused permission is reported, not thrown', async () => {
    const m = new MidiOut({ requestMIDIAccess: async () => { throw new Error('denied'); } });
    await m.connect();
    expect(m.status).toBe('denied');
  });

  it('note: on at its time, off at time + duration, the off held back until shortly before', () => {
    out.note('IAC Driver Bus 1', 2, 60, 90, 1100, 500);
    expect(sent).toEqual([{ data: [0x91, 60, 90], at: 1100 }]);
    vi.advanceTimersByTime(400); // off is due at 1600; sent 150 ms early = 450 ms after now
    expect(sent).toHaveLength(1);
    vi.advanceTimersByTime(100);
    expect(sent[1]).toEqual({ data: [0x81, 60, 0], at: 1600 });
  });

  it('stop ends a note early and cancels its pending off', () => {
    const stop = out.note('IAC Driver Bus 1', 1, 64, 80, 1000, 8000);
    stop(1300);
    expect(sent[1]).toEqual({ data: [0x80, 64, 0], at: 1300 });
    vi.advanceTimersByTime(10_000);
    expect(sent).toHaveLength(2);
  });

  it('the same pitch struck again ends the first, and the first one\'s later stop cannot cut the second', () => {
    const stopA = out.note('IAC Driver Bus 1', 1, 50, 80, 1000, 8000); // a drone note
    out.note('IAC Driver Bus 1', 1, 50, 80, 5000, 8000); // retriggered
    expect(sent.map((s) => s.data[0])).toEqual([0x90, 0x80, 0x90]); // on, off, on
    expect(sent[1].at).toBe(5000);
    stopA(5500); // the old drone's crossfade stop
    expect(sent).toHaveLength(3);
  });

  it('controllers are only sent when they change', () => {
    out.cc('IAC Driver Bus 1', 1, 74, 64); out.cc('IAC Driver Bus 1', 1, 74, 64.2); out.cc('IAC Driver Bus 1', 1, 74, 70);
    out.bend('IAC Driver Bus 1', 1, 0); out.bend('IAC Driver Bus 1', 1, 0);
    expect(sent.map((s) => s.data)).toEqual([[0xb0, 74, 64], [0xb0, 74, 70], [0xe0, 0, 64]]);
  });

  it('panic ends sounding notes and sends all-notes-off on each channel used', () => {
    out.note('IAC Driver Bus 1', 3, 60, 80, 1000, 8000);
    out.cc('IAC Driver Bus 1', 5, 7, 100);
    sent = [];
    out.panic();
    expect(sent.map((s) => s.data)).toContainEqual([0x82, 60, 0]);
    expect(sent.map((s) => s.data)).toContainEqual([0xb2, 123, 0]);
    expect(sent.map((s) => s.data)).toContainEqual([0xb4, 123, 0]);
    vi.advanceTimersByTime(10_000);
    expect(sent.filter((s) => s.data[0] === 0x82)).toHaveLength(1); // no second off later
  });

  it('a disconnected port is not listed and sends nothing', () => {
    port.state = 'disconnected';
    expect(out.outputs()).toEqual([]);
    out.note('IAC Driver Bus 1', 1, 60, 80, 1000, 100);
    expect(sent).toHaveLength(0);
  });
});

describe('score with a MIDI output', () => {
  it('round-trips through YAML and rejects a bad channel', () => {
    const s = defaultScore();
    s.sounds[0].output = { port: 'IAC Driver Bus 1', channel: 2 };
    expect(scoreFromYaml(scoreToYaml(s)).sounds[0].output).toEqual({ port: 'IAC Driver Bus 1', channel: 2 });
    s.sounds[0].output = { port: 'IAC Driver Bus 1', channel: 17 };
    expect(() => scoreFromYaml(scoreToYaml(s))).toThrow(/channel 1–16/);
  });
});
