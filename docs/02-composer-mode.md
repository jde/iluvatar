# Composer mode — scoring everything a system can do

*Design brainstorm, 2026-09-16. Source: Dave's Prompt 3 in [VISION-verbatim.md](../VISION-verbatim.md).
Builds on [01-datadog-to-music.md](01-datadog-to-music.md): composer mode is the authoring
surface for the Mapping and Conductor stages of that pipeline.*

## 0. What composer mode is

A person opens Ilúvatar, sees the inputs that are configured (say, *traffic in visits per second*,
*error ratio*, *checkout monitor*), and for each one decides what it sounds like: which instrument
plays it, which musical concept applies at which bounds, what is triggered when a value crosses a
line or when its slope changes. The result is a **score**: a file that says, for the whole space of
things the system can do, what the listener hears.

The three things a composer works with:

| Thing | Examples |
|---|---|
| **Inputs** | a Datadog metric (visits/s), a monitor's state, a log query, a derived value (slope of visits/s over 60 s) |
| **Sounds** | a MIDI instrument, a sample, a synth voice, a motif (written melody), a chord or mode, a rhythm pattern |
| **Connections** | continuous: *visits/s → density of the bass loop*; threshold: *visits/s below 5 → introduce a minor chord*; slope: *visits/s rising faster than 20 per minute → play the "surge" melody*; state: *monitor ALERT → shift to minor, play its motif* |

Everything the composer does produces a score file. The player reads score files. Scores are
shareable, so the open source community can publish scores for common stacks.

## 1. The score model

A score has five parts. This is the data model; the file format is YAML (readable in a diff, easy
to hand-edit) with a JSON schema.

```yaml
score:
  name: "Storefront, ambient"
  clock: { bpm: 72, key: D, mode: dorian }        # the Conductor's globals; rules may override mode

inputs:                                            # what we listen to (from Sources)
  visits:      { datadog: "sum:web.visits{service:storefront}.as_rate()", unit: "visits/s" }
  errors:      { datadog: "sum:web.errors{service:storefront}.as_rate() / sum:web.visits{service:storefront}.as_rate()", unit: "ratio" }
  checkout:    { monitor: 12345678 }                # state: OK | WARN | ALERT | NO_DATA
  visits_slope: { derive: { of: visits, slope_over: 60s } }   # derived inputs are first-class

sounds:                                            # what can sound (instruments + material)
  bass:     { kind: loop,   instrument: { midi: 33 },  pattern: "d2 . d2 a2 . f2 . d2" }   # GM 33 = fingered bass
  pad:      { kind: drone,  instrument: { midi: 89 } }                                     # GM 89 = warm pad
  surge:    { kind: motif,  instrument: { midi: 74 },  notes: "d5 f5 a5 d6 c6 a5" }        # GM 74 = flute
  alarm:    { kind: sample, file: "samples/bowed-metal.wav" }
  minor:    { kind: concept, chord: "i" }                                                  # a concept, not an instrument

rules:                                             # the connections
  - when: { input: visits, always: true }
    do:   { set: { sound: bass, property: density, range: [0, 200], curve: log, smooth: 2s } }

  - when: { input: visits, below: 5, for: 30s }              # threshold with duration (hysteresis)
    do:   { introduce: { concept: minor, on: pad, fade: 4s } }
    until: { input: visits, above: 8 }                        # explicit release condition

  - when: { input: visits_slope, above: 20 }                  # per minute, from the derive above
    do:   { trigger: { sound: surge, quantize: bar, cooldown: 2m } }

  - when: { input: checkout, becomes: ALERT }
    do:   [ { trigger: { sound: alarm } }, { set_mode: aeolian }, { set: { sound: pad, property: tension, value: 0.8 } } ]

  - when: { input: checkout, becomes: OK }
    do:   [ { set_mode: dorian }, { cadence: resolve } ]

coverage:                                          # what the composer has declared "scored" (see §5)
  visits: { ranges: [[0,5],[5,200],[200,inf]], slopes: [rising_fast] }
```

### Rule anatomy

| Part | Options | Notes |
|---|---|---|
| `when` | `always`; `below` / `above` / `between`; `becomes` (state); `crosses` (up/down); slope via a derived input; `for: <duration>` | `for` is the hysteresis: the condition must hold that long before it fires. Slope is never computed inline; it is a derived input with a named window so it can be reused and audited |
| `do` | `set` (continuous property from the value), `introduce` / `remove` (a concept or voice, with fade), `trigger` (a motif or sample, quantized, with cooldown), `set_mode` / `set_key` / `set_tempo`, `cadence` (resolve, suspend, rest) | One rule may do several things, in order |
| `until` | Any `when` | For `introduce` rules, when the introduced thing leaves. Without it the concept stays until a later rule removes it |
| `priority` | integer | Two rules fighting over one property: higher wins; equal priority is a composer error surfaced in the UI |

### Derived inputs (bounds on slopes and more)

| Derive | Meaning |
|---|---|
| `slope_over: 60s` | Change per minute, least-squares over the window |
| `baseline: { over: 24h, stat: p50 }` | The value relative to its own recent normal, so "below" can mean "below normal", not below a fixed number |
| `ratio: [a, b]` | a divided by b |
| `count_of: { log_query }` per `window` | Log lines matching, per window |
| `age_of_last: { event }` | Seconds since the last deploy, last error |

## 2. Sounds: instruments and material

| Kind | What the composer picks | First implementation |
|---|---|---|
| **MIDI instrument** | A General MIDI program (0–127) or an external MIDI device and channel | In the browser: a General MIDI SoundFont player on Web Audio, so scores sound the same for everyone. Web MIDI out for people with hardware or a DAW |
| **Sample** | A file (wav/mp3), with root note and loop points | Drag in; stored next to the score; the community sample pack is a separate repo |
| **Synth voice** | A preset from a small built-in synth (Tone.js: FM, AM, subtractive) | A dozen presets; editable later |
| **Motif** | Notes written in a short notation (`d5 f5 a5 d6`), or recorded from a MIDI keyboard, or generated from a name | The name-seeded generator gives every monitor a motif without composing; a composer replaces the ones that matter |
| **Pattern** | A rhythm or loop in a mini-notation (Strudel-style strings) | Density, rate and swing are properties on it |
| **Concept** | Chord (`i`, `IV`, `V7sus4`), mode (dorian, aeolian), interval, texture (tremolo, sustain), articulation | Concepts are applied *to* a voice or the harmonic field. They are the vocabulary for "introduce a minor chord" |

## 3. The composer screen

One screen, four panels, always playing.

```
┌─ Inputs ─────────────┬─ Score (rules) ───────────────────────────┬─ Sounds ───────────┐
│ visits    12.4 /s ▂▃▅│ visits ──always──► bass.density (log)     │ bass    GM 33  ▶   │
│ errors    0.3 %   ▁▁▁│ visits ──< 5 for 30s──► + minor on pad    │ pad     GM 89  ▶   │
│ checkout  OK      ●  │ visits_slope ──> 20──► trigger surge      │ surge   motif  ▶   │
│ visits_slope +3/min  │ checkout ──becomes ALERT──► alarm, aeolian│ alarm   sample ▶   │
│ [+ add input]        │ [+ add rule]        ⚠ 2 unscored ranges   │ [+ add sound]      │
├─ Timeline ──────────────────────────────────────────────────────────────────────────────┤
│ ◀ 10 min ▶  ▁▂▃▅▇▅▃▂▁▁▁▂  rules fired: ▲surge 14:02  ●ALERT 14:05  ○OK 14:09            │
│ [live] [replay last 10 min] [scenario: traffic drop ▾] [scenario: surge] [scenario: alert] │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

| Panel | What you do there |
|---|---|
| **Inputs** | See every configured input with its live value and a sparkline. Add one from the Datadog metric picker, a monitor, a log query, or derive one from another |
| **Score** | The rules, one line each, readable as sentences. Click an input to add a rule from it; the bounds are chosen on a slider that shows the input's recent distribution, so "below 5" is placed against reality. Conflicts and gaps are flagged inline |
| **Sounds** | The instrument rack. Audition any sound with ▶. Pick a MIDI program, load a sample, write or record a motif, choose a concept |
| **Timeline** | What has been playing and which rules fired when. Three modes: **live**, **replay** of the ring buffer, and **scenario**: synthetic input curves (traffic drops to zero over 2 minutes; traffic doubles in 30 s; a monitor flips to ALERT then recovers) so the composer hears every rule without waiting for the system to do it |

### Interactions that matter

- **Everything is heard immediately.** Changing a rule changes the sound within a beat, on live data or on the running scenario.
- **Bounds are set against the data.** The threshold slider sits on a histogram of the last 24 h of that input, with p5/p50/p95 marked. Composers see where "low" is before they call it low.
- **Slope rules are explained.** Hovering a slope rule shows the window and the current slope value, so "rising faster than 20 per minute" is checkable.
- **Solo and mute** per input and per sound, as in any DAW.
- **Undo** across the score; the score is versioned in git by design (a YAML file).

## 4. From composing to playing

| Mode | Who | What runs |
|---|---|---|
| **Composer** | The person authoring | The full screen above, on live data plus scenarios |
| **Player** | Anyone listening | The score, the local Datadog process, and a renderer; a single page with play/pause, volume, and the timeline read-only |
| **Headless** | A server or a Raspberry Pi in the office | Same core, MIDI/OSC out or audio out, no screen |

The score file is the contract between them. A composer can hand a score to someone with a
different Datadog org by leaving inputs unbound (`datadog: "<your traffic metric>"`); the player
prompts once to bind them.

## 5. Scoring the entire possibility space

Dave's goal: a full score covers *everything* the system could do. Composer mode should make the
gaps visible.

| Tool | What it shows |
|---|---|
| **Coverage map** | For each input: its value range split into the bands the rules mention, shaded by whether any rule acts there; the transitions (rising, falling, becomes X) with or without a rule; "unscored" bands listed with one click to add a rule |
| **State grid** | For discrete inputs (monitors), a grid of states × states: which transitions are scored |
| **Scenario library** | A set of named scenarios every score should sound good on: quiet night, lunch peak, slow bleed (errors creeping up), sudden outage, recovery, deploy, no data. Running the library plays them back to back and lists rules that never fired |
| **Silence audit** | Any combination of inputs where nothing sounds, or where nothing *changes* for more than N minutes while the inputs did — the sound went flat while the system did not |
| **Dissonance budget** | Warns when several rules can stack tension at once beyond what a listener can parse |

A score is "complete" not when every number has a rule, but when every scenario in the library
sounds like what happened. That is the bar composer mode holds people to.

## 6. Build order

| Step | Delivers | Depends on |
|---|---|---|
| 1 | Score schema (YAML + JSON schema) and a player that runs a score against the timeline from doc 01 | doc 01's core |
| 2 | Scenario engine: synthetic input curves fed through the same pipeline | 1 |
| 3 | Composer screen, panels Inputs, Score, Sounds, Timeline in live and scenario modes | 1, 2 |
| 4 | Sounds: GM SoundFont player, samples, motif notation, name-seeded motif generator | 3 |
| 5 | Threshold slider on the input's histogram; slope and baseline derived inputs | 3 |
| 6 | Coverage map, state grid, scenario library, silence audit | 2, 3 |
| 7 | Web MIDI out, headless mode | 1 |

Step 1 and 2 are where the depth comes from: once scores are files and scenarios are repeatable,
composing is iteration, not waiting for incidents.

## 7. Questions for Dave

1. Is the composer a musician (writes motifs, picks chords) or an engineer (picks concepts from a
   menu)? The screen serves both, but the defaults differ.
2. Should the first sounds be General MIDI (same for everyone, dated timbre) or samples and synths
   (better sound, more to build)?
3. Do you want scores to be shareable from day one (a `scores/` directory in this repo with a
   README per score)?
