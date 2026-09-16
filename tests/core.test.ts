import { describe, expect, it } from 'vitest';
import { normalize, smoothStep } from '../src/core/curves';
import { Timeline } from '../src/core/timeline';
import { scenarioAt, FeedEngine } from '../src/core/feeds';
import { parseMotif, noteToMidi, degreeToMidi, midiToNote } from '../src/core/motif';
import { RuleEngine } from '../src/core/rules';
import { defaultScore, scoreFromYaml, scoreToYaml } from '../src/core/score';
import type { Score } from '../src/core/types';

describe('curves', () => {
  it('linear maps and clamps', () => {
    expect(normalize(50, [0, 100], 'linear')).toBe(0.5);
    expect(normalize(-5, [0, 100], 'linear')).toBe(0);
    expect(normalize(500, [0, 100], 'linear')).toBe(1);
  });
  it('log spans decades', () => {
    const a = normalize(10, [1, 1000], 'log'), b = normalize(100, [1, 1000], 'log');
    expect(a).toBeCloseTo(1 / 3, 5); expect(b).toBeCloseTo(2 / 3, 5);
  });
  it('exp squares, steps quantize, NaN is 0', () => {
    expect(normalize(50, [0, 100], 'exp')).toBe(0.25);
    expect(normalize(60, [0, 100], 'steps')).toBe(0.5);
    expect(normalize(NaN, [0, 100], 'linear')).toBe(0);
  });
  it('smoothStep approaches the target with the time constant', () => {
    const v = smoothStep(0, 1, 1, 1);
    expect(v).toBeCloseTo(1 - Math.exp(-1), 6);
    expect(smoothStep(0, 1, 0, 1)).toBe(1);
  });
});

describe('timeline', () => {
  const inputs = defaultScore().inputs;
  it('stores values and computes slope per minute, filling the derived input', () => {
    const tl = new Timeline(inputs);
    for (let t = 0; t <= 60; t += 10) tl.push('traffic', t, 10 + t); // +1 per second = +60 per minute
    expect(tl.value('traffic')).toBe(70);
    expect(tl.slope('traffic', 60, 60)).toBeCloseTo(60, 6);
    expect(tl.value('traffic_slope')).toBeCloseTo(60, 6);
  });
  it('slope is NaN with one point and 0 when flat', () => {
    const tl = new Timeline(inputs);
    tl.push('traffic', 0, 5);
    expect(Number.isNaN(tl.slope('traffic', 60, 0))).toBe(true);
    tl.push('traffic', 10, 5); tl.push('traffic', 20, 5);
    expect(tl.slope('traffic', 60, 20)).toBe(0);
  });
  it('clear forgets every input', () => {
    const tl = new Timeline(inputs);
    tl.push('traffic', 0, 1); tl.push('traffic', 10, 2);
    tl.clear();
    expect(Number.isNaN(tl.value('traffic'))).toBe(true);
    expect(Number.isNaN(tl.value('traffic_slope'))).toBe(true);
  });
  it('drops samples older than the window', () => {
    const tl = new Timeline(inputs, 30);
    tl.push('traffic', 0, 1); tl.push('traffic', 40, 2);
    expect(tl.recent('traffic', 100).length).toBe(1);
  });
});

describe('feeds', () => {
  it('surge triples traffic after 50 s and outage recovers', () => {
    expect(scenarioAt('surge', 0).traffic).toBeLessThan(50);
    expect(scenarioAt('surge', 60).traffic).toBeGreaterThan(110);
    expect(scenarioAt('outage', 100).errors).toBeGreaterThan(0.5);
    expect(scenarioAt('outage', 200).errors).toBeLessThan(0.05);
  });
  it('engine emits once per second and manual values pass through', () => {
    const e = new FeedEngine();
    e.setScenario('manual', 0); e.manual = { traffic: 77, errors: 0.2 };
    expect(e.tick(0)?.values.traffic).toBe(77);
    expect(e.tick(0.5)).toBeNull();
    expect(e.tick(1.0)?.values.errors).toBe(0.2);
  });
});

describe('motif notation', () => {
  it('parses notes, rests, holds and bar lines', () => {
    const { motif, errors } = parseMotif('d5 f5 . a5:2 | c6');
    expect(errors).toEqual([]);
    expect(motif.length).toBe(6);
    expect(motif.notes.map((n) => [n.step, midiToNote(n.midi), n.steps])).toEqual([[0, 'd5', 1], [1, 'f5', 1], [3, 'a5', 2], [5, 'c6', 1]]);
  });
  it('reports unknown tokens and keeps going', () => {
    const { motif, errors } = parseMotif('d5 xx e5');
    expect(errors.length).toBe(1);
    expect(motif.notes.length).toBe(2);
  });
  it('note and degree math', () => {
    expect(noteToMidi('c4')).toBe(60); expect(noteToMidi('a4')).toBe(69); expect(noteToMidi('bb3')).toBe(58);
    expect(degreeToMidi(1, 2, 'dorian', 3)).toBe(50); // D3
    expect(degreeToMidi(3, 2, 'dorian', 3)).toBe(53); // F3 (minor third in dorian)
    expect(degreeToMidi(8, 2, 'dorian', 3)).toBe(62); // D4
  });
});

describe('rules', () => {
  const mk = (): Score => defaultScore();
  it('always/set emits a normalized value each tick', () => {
    const s = mk(), tl = new Timeline(s.inputs), re = new RuleEngine();
    tl.push('traffic', 0, 200); tl.push('errors', 0, 0);
    const fx = re.evaluate(s, tl, 0);
    const set = fx.find((f) => f.kind === 'set' && f.sound === 'bass');
    expect(set && set.kind === 'set' && set.value).toBe(1);
  });
  it('below-for introduces after the hold and releases on the until condition', () => {
    const s = mk(), tl = new Timeline(s.inputs), re = new RuleEngine();
    const concept = (t: number, v: number) => { tl.push('traffic', t, v); tl.push('errors', t, 0); return re.evaluate(s, tl, t).filter((f) => f.kind === 'concept'); };
    expect(concept(0, 5)).toEqual([]);          // hold started
    expect(concept(10, 5)).toEqual([]);         // 10 s < 20 s
    const on = concept(20, 5);
    expect(on.length).toBe(1); expect(on[0].kind === 'concept' && on[0].active).toBe(true);
    expect(concept(30, 5)).toEqual([]);         // stays on, no repeat
    expect(concept(40, 30)).toEqual([]);        // release needs 5 s above 16
    const off = concept(45, 30);
    expect(off.length).toBe(1); expect(off[0].kind === 'concept' && off[0].active).toBe(false);
  });
  it('slope trigger fires once per crossing and respects cooldown', () => {
    const s = mk(), tl = new Timeline(s.inputs), re = new RuleEngine();
    const fire = (t: number, v: number) => { tl.push('traffic', t, v); tl.push('errors', t, 0); return re.evaluate(s, tl, t).filter((f) => f.kind === 'trigger'); };
    fire(0, 40); fire(10, 40);
    expect(fire(20, 100).length).toBe(1);       // slope > 40/min → trigger
    expect(fire(30, 160).length).toBe(0);       // still holding, no re-fire
    fire(40, 160); fire(50, 160); fire(60, 160); fire(70, 160); fire(80, 160); // slope decays to 0 → condition released
    expect(fire(85, 400).length).toBe(1);       // 65 s since last fire ≥ 60 s cooldown → fires again
    expect(re.log.filter((l) => l.text === 'trigger surge').length).toBe(2);
  });
});

describe('score yaml', () => {
  it('round-trips and validates references', () => {
    const s = defaultScore();
    const back = scoreFromYaml(scoreToYaml(s));
    expect(back).toEqual(s);
    const bad = { ...s, rules: [{ ...s.rules[0], input: 'nope' }] };
    expect(() => scoreFromYaml(scoreToYaml(bad))).toThrow(/unknown input/);
  });
});
