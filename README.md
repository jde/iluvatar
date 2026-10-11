# Ilúvatar

*Bring forth the workings of systems via music.*

Ilúvatar is an open source project that turns the inner workings of a system — a running
program, a data pipeline, a network, a company, an organism — into music, so that a person can
hear what it is doing, hear when it changes, and hear when something is wrong.

The name is from Tolkien: Ilúvatar is the one who brings the world into being through a great
music, and every part of the world is a theme in that music. This project is the reverse trip —
a system already exists, and we let its themes be heard.

## State of the project

- Form: **composer prototype, mock feeds**. Created 2026-09-16 by Dave Erwin.
- **Live: https://iluvatar.vercel.app** (Vercel, jde's team; every push to `main` deploys).
- Runs in the browser: two mock feeds (traffic, errors) with scenarios that loop forever over a
  length you set (20 s to 10 min) or a free form mode with a dial per input, a rule engine, General
  MIDI instruments, and a library of 67 public domain tunes as ready-made sounds (with a page to
  browse, preview, and make your own). **MIDI out**: press "connect MIDI" and any sound can play on a
  synth or music app instead of the browser (see below). No Datadog yet. The founding words are in [VISION-verbatim.md](VISION-verbatim.md).

## Run it

```
pnpm install
pnpm dev          # http://localhost:5173 — press "Start audio", pick a scenario or turn the dials
pnpm test         # core unit tests (vitest)
pnpm test:ui      # drives the composer in headless Chromium (playwright)
```

The composer screen: **Inputs** (scenario, live values, sparklines) · **Score** (rules: when an
input is always / below / above a bound for N seconds → drive a property, introduce a concept, or
trigger a motif) · **Sounds** (General MIDI instrument, loop / motif / drone, notes in a mini
notation, audition, or a ready-made sound from the library) · **Timeline** (what fired). Scores export and import as YAML; the shared ones
live in [scores/](scores/).
- First data source: **Datadog**. The breakdown — ingestion paths, metric-to-music mapping, the
  rules that keep it musical, and the first three-voice piece — is in
  [docs/01-datadog-to-music.md](docs/01-datadog-to-music.md) (2026-09-16).
- **The sound library** — ready-made sounds (a melody with its instrument), the picker, the
  Library page, and the copyright rule — is in [docs/03-sound-library.md](docs/03-sound-library.md)
  (2026-09-19).
- **Composer mode** — scoring everything a system can do: the score file, the rule language for
  bounds and slopes, the composer screen, scenarios and coverage — is in
  [docs/02-composer-mode.md](docs/02-composer-mode.md) (2026-09-16).

## Play it on a synth (MIDI out)

Works in Chrome, Edge and Firefox (not Safari).

1. Press **connect MIDI** in the top bar and allow it.
2. In a sound's **Output**, pick a MIDI port and a channel (1–16).
3. That sound's notes now go to the synth. The other sounds keep playing in the browser.

| What the rules drive | What the synth receives |
|---|---|
| Notes (loop, motif, drone) | Note on / note off |
| Level | CC 7 (volume) |
| Brightness | CC 74 (filter cutoff on most synths) |
| Tension | Pitch bend, up to 18 cents sharp (assumes the usual ±2 semitone bend range) |

No hardware: on a Mac, open Audio MIDI Setup → Window → Show MIDI Studio → double-click
**IAC Driver** → tick "Device is online". "IAC Driver Bus 1" then appears as an output, and
GarageBand or Logic can play it. If a score names a port that isn't connected, that sound plays in
the browser and says so. Pause sends all-notes-off.

## Real synths

Each sound can be played on one of 23 real synths (minilogue xd, MicroFreak, Bass Station II,
Prophet Rev2, Vital, Serum 2 and more). Pick it under **Synth** on a sound:

- With no MIDI port, a browser stand-in built like that synth plays, and its knobs work.
- On a MIDI port, the real synth plays, and rules can turn its real knobs ("drive Bass · CUTOFF").

Details, sources and known gaps: [docs/04-synths.md](docs/04-synths.md).

## What it will do (first sketch, to be revised)

| A system does this | You hear this |
|---|---|
| Runs normally | Its theme, steady |
| Gets busier | The theme thickens: more voices, faster |
| Something fails | A dissonance that resolves only when the failure does |
| A part starts, stops, or changes | A new voice enters, leaves, or modulates |

The first target is the simplest system that already emits events: a process log, a metrics
stream, a heartbeat. Later: anything with a state you can observe over time.

## Principles

1. **The music is true.** Every sound maps to something observable in the system. Nothing is
   decorative.
2. **Hearable in the background.** It should work as ambient sound while you do other things,
   and only demand attention when the system does.
3. **Open.** Sources, mappings, and instruments are open; anyone can bring their own system.

## License

MIT — see [LICENSE](LICENSE).
