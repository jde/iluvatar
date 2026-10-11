import { describe, expect, it } from 'vitest';
import { addressLabel, controlMessages, rawValue, stepIndex, stepValue } from '../src/synths/messages';
import { roleValue, standInControls, waveFromStep } from '../src/synths/standin';
import { PROFILES, normalize, profileById } from '../src/synths/profiles';
import { knobValues, mappedControl } from '../src/audio/engine';
import { defaultScore, scoreFromYaml, scoreToYaml } from '../src/core/score';
import type { Control } from '../src/synths/types';
import type { Sound } from '../src/core/types';

const cc = (o: Partial<Control>): Control => ({ id: 'x', label: 'X', section: 'S', role: 'other', kind: 'continuous', ...o });

describe('knob → MIDI messages', () => {
  it('7-bit CC', () => {
    expect(controlMessages(cc({ cc: 43 }), 1, 1)).toEqual([[0xb0, 43, 127]]);
    expect(controlMessages(cc({ cc: 43 }), 3, 0.5)).toEqual([[0xb2, 43, 64]]);
  });
  it('14-bit CC pair: MSB then LSB', () => {
    expect(controlMessages(cc({ cc: 16, ccLsb: 48 }), 1, 1)).toEqual([[0xb0, 16, 127], [0xb0, 48, 127]]);
    expect(controlMessages(cc({ cc: 16, ccLsb: 48 }), 1, 0.5)).toEqual([[0xb0, 16, 64], [0xb0, 48, 0]]); // 8192
  });
  it('NRPN: parameter select then data entry; 7-bit values use CC 6 alone', () => {
    expect(controlMessages(cc({ nrpn: { param: 72, max: 127 } }), 1, 1)).toEqual([[0xb0, 99, 0], [0xb0, 98, 72], [0xb0, 6, 127]]);
    expect(controlMessages(cc({ nrpn: { param: 200, max: 164 } }), 2, 1)).toEqual([[0xb1, 99, 1], [0xb1, 98, 72], [0xb1, 6, 1], [0xb1, 38, 36]]); // 164 = 1·128 + 36
  });
  it('no address, no messages; labels say what is sent', () => {
    expect(controlMessages(cc({}), 1, 1)).toEqual([]);
    expect(addressLabel(cc({ cc: 43 }))).toBe('CC 43');
    expect(addressLabel(cc({ cc: 16, ccLsb: 48 }))).toBe('CC 16/48');
    expect(addressLabel(cc({ nrpn: { param: 15, max: 164 } }))).toBe('NRPN 15');
    expect(rawValue(cc({ nrpn: { param: 15, max: 164 } }), 0.5)).toBe(82);
  });
  it('switches land in the middle of a step and read back to the same step', () => {
    const sw = cc({ cc: 50, kind: 'switch', steps: [{ from: 0, to: 42, meaning: 'SQR' }, { from: 43, to: 85, meaning: 'TRI' }, { from: 86, to: 127, meaning: 'SAW' }] });
    for (let i = 0; i < 3; i++) expect(stepIndex(sw, stepValue(sw, i))).toBe(i);
    expect(controlMessages(sw, 1, stepValue(sw, 1))).toEqual([[0xb0, 50, 64]]);
  });
});

describe('stand-in', () => {
  it('cutoff spans 30 Hz to 18 kHz exponentially; envelopes from ms to seconds', () => {
    expect(roleValue('cutoff', cc({}), 0)).toBeCloseTo(30);
    expect(roleValue('cutoff', cc({}), 1)).toBeCloseTo(18000);
    expect(roleValue('cutoff', cc({}), 0.5)).toBeCloseTo(Math.sqrt(30 * 18000));
    expect(roleValue('amp_attack', cc({}), 0)).toBeCloseTo(0.002);
    expect(roleValue('amp_release', cc({}), 1)).toBeCloseTo(10);
  });
  it('bipolar knobs are off at the centre', () => {
    expect(roleValue('osc_detune', cc({ bipolar: true }), 0.5)).toBe(0);
    expect(roleValue('filter_env_amount', cc({ bipolar: true }), 0.5)).toBe(0);
    expect(roleValue('filter_env_amount', cc({ bipolar: true }), 1)).toBe(6);
  });
  it('reads waves off switch labels', () => {
    expect(waveFromStep('SAW')).toBe('sawtooth');
    expect(waveFromStep('Square')).toBe('square');
    expect(waveFromStep('TRI')).toBe('triangle');
    expect(waveFromStep('Noise')).toBeNull();
  });
});

describe('the synth library', () => {
  it('has hardware and software synths', () => {
    expect(PROFILES.filter((p) => p.kind === 'hardware').length).toBeGreaterThanOrEqual(8);
    expect(PROFILES.filter((p) => p.kind === 'software').length).toBeGreaterThanOrEqual(3);
  });
  for (const p of PROFILES) {
    describe(`${p.maker} ${p.name}`, () => {
      it('every control has a valid MIDI address, a unique id, and a cited source', () => {
        expect(p.sources.length).toBeGreaterThan(0);
        expect(new Set(p.controls.map((c) => c.id)).size).toBe(p.controls.length);
        for (const c of p.controls) {
          if (c.cc !== undefined) { expect(c.cc).toBeGreaterThanOrEqual(0); expect(c.cc).toBeLessThanOrEqual(127); }
          if (c.ccLsb !== undefined) expect(c.ccLsb).toBeLessThanOrEqual(127);
          if (c.nrpn) { expect(c.nrpn.param).toBeLessThan(16384); expect(c.nrpn.max).toBeGreaterThan(0); }
          expect(c.cc !== undefined || !!c.nrpn).toBe(true);
          for (const s of c.steps ?? []) expect(s.to).toBeGreaterThanOrEqual(s.from);
        }
      });
      it('the default map points at real knobs', () => {
        for (const m of Object.values(p.defaultMap)) expect(p.controls.some((c) => c.id === m!.control)).toBe(true);
      });
      it('a channel 1–16, a bend range, and a stand-in', () => {
        expect(p.defaultChannel).toBeGreaterThanOrEqual(1); expect(p.defaultChannel).toBeLessThanOrEqual(16);
        expect(p.bendRangeSemitones).toBeGreaterThan(0);
        expect(p.voices).toBeGreaterThanOrEqual(1);
        expect(p.standIn.oscillators).toBeGreaterThanOrEqual(1);
      });
    });
  }
});

describe('normalize', () => {
  it('drops knobs with no MIDI address, reads NRPN as msb/lsb, keeps nulls out', () => {
    const p = normalize({ id: 't', name: 'T', maker: 'M', kind: 'hardware', voices: null, defaultChannel: null, bendRangeSemitones: { default: null },
      controls: [{ id: 'a', label: 'A', role: 'cutoff', cc: 74 }, { id: 'b', label: 'B', role: 'nope', cc: null }, { id: 'c', label: 'C', role: 'other', cc: null, nrpn: { msb: 1, lsb: 2 } }],
      sources: [{ url: 'u', what: 'w' }] }, undefined);
    expect(p.controls.map((c) => c.id)).toEqual(['a', 'c']);
    expect(p.controls[1].nrpn).toEqual({ param: 130, max: 127 });
    expect(p.defaultChannel).toBe(1); expect(p.bendRangeSemitones).toBe(2);
    expect(p.defaultMap.brightness).toEqual({ control: 'a', range: [0.15, 0.9] });
  });
});

describe('knob values', () => {
  const p = normalize({ id: 't', name: 'T', maker: 'M', kind: 'hardware', controls: [
    { id: 'cut', label: 'CUTOFF', role: 'cutoff', cc: 43 }, { id: 'res', label: 'RES', role: 'resonance', cc: 44 }, { id: 'vol', label: 'VOL', role: 'volume', cc: 7 }, { id: 'lfo', label: 'RATE', role: 'lfo_rate', cc: 24 }],
    sources: [{ url: 'u', what: 'w' }] }, { standIn: { wave: 'sawtooth', oscillators: 2, filter: { type: 'lowpass', rolloff: -12 }, lfoTo: 'pitch' }, init: { cut: 0.6 } });
  const s: Sound = { id: 's', label: 'S', kind: 'loop', instrument: 'x', volume: 0.5, synth: { profile: 't' } };
  const cur = { volume: 1, density: 0.6, brightness: 1, tension: 0, register: 0.5 } as Record<string, number>;
  it('the patch holds until a rule drives a property; only touched knobs are sent', () => {
    const a = knobValues(p, s, cur, new Set());
    expect(a.values.cut).toBe(0.6); // patch
    expect(a.touched.has('cut')).toBe(false);
    expect(a.values.vol).toBe(0.5); // volume is always applied: level × property
    const b = knobValues(p, s, cur, new Set(['brightness']));
    expect(b.values.cut).toBeCloseTo(0.9); // top of the brightness range
    expect(b.touched.has('cut')).toBe(true);
  });
  it('a rule on a knob wins; the composer can remap or switch a property off', () => {
    const c = knobValues(p, s, { ...cur, 'knob:lfo': 0.3 }, new Set(['knob:lfo']));
    expect(c.values.lfo).toBe(0.3); expect(c.touched.has('lfo')).toBe(true);
    const s2: Sound = { ...s, synth: { profile: 't', map: { brightness: 'lfo', volume: null } } };
    expect(mappedControl(p, s2, 'brightness')).toBe('lfo');
    expect(mappedControl(p, s2, 'volume')).toBeNull();
    expect(knobValues(p, s2, cur, new Set(['brightness'])).values.lfo).toBe(1);
  });
  it('a panel setting is sent and kept', () => {
    const s3: Sound = { ...s, synth: { profile: 't', knobs: { res: 0.25 } } };
    const d = knobValues(p, s3, cur, new Set());
    expect(d.values.res).toBe(0.25); expect(d.touched.has('res')).toBe(true);
  });
  it('the stand-in uses the first control per role', () => {
    expect(standInControls(p).get('cutoff')?.id).toBe('cut');
  });
});

describe('scores with synths', () => {
  it('round-trip, and a rule on an unknown knob fails loudly', () => {
    const p = PROFILES[0];
    const sc = defaultScore();
    sc.sounds[0].synth = { profile: p.id, knobs: { [p.controls[0].id]: 0.4 } };
    sc.rules.push({ id: 'rk', input: 'traffic', when: { kind: 'always' }, do: { kind: 'set', sound: sc.sounds[0].id, property: `knob:${p.controls[0].id}`, range: [0, 200], curve: 'linear', smooth: 1 }, enabled: true });
    expect(scoreFromYaml(scoreToYaml(sc)).sounds[0].synth).toEqual(sc.sounds[0].synth);
    sc.rules[sc.rules.length - 1].do = { ...(sc.rules[sc.rules.length - 1].do as any), property: 'knob:nope' };
    expect(() => scoreFromYaml(scoreToYaml(sc))).toThrow(/no knob "nope"/);
    expect(profileById('nope')).toBeUndefined();
  });
});
