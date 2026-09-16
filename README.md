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
- Runs in the browser: two mock feeds (traffic, errors) with scenarios, a rule engine, and General
  MIDI instruments. No Datadog yet. The founding words are in [VISION-verbatim.md](VISION-verbatim.md).

## Run it

```
pnpm install
pnpm dev          # http://localhost:5173 — press "Start audio", pick a scenario
pnpm test         # core unit tests (vitest)
pnpm test:ui      # drives the composer in headless Chromium (playwright)
```

The composer screen: **Inputs** (scenario, live values, sparklines) · **Score** (rules: when an
input is always / below / above a bound for N seconds → drive a property, introduce a concept, or
trigger a motif) · **Sounds** (General MIDI instrument, loop / motif / drone, notes in a mini
notation, audition) · **Timeline** (what fired). Scores export and import as YAML; the shared ones
live in [scores/](scores/).
- First data source: **Datadog**. The breakdown — ingestion paths, metric-to-music mapping, the
  rules that keep it musical, and the first three-voice piece — is in
  [docs/01-datadog-to-music.md](docs/01-datadog-to-music.md) (2026-09-16).
- **Composer mode** — scoring everything a system can do: the score file, the rule language for
  bounds and slopes, the composer screen, scenarios and coverage — is in
  [docs/02-composer-mode.md](docs/02-composer-mode.md) (2026-09-16).

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
