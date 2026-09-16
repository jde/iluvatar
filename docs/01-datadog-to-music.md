# Datadog to music — how the pieces break down

*Brainstorm, 2026-09-16. Source: Dave's Prompt 2 in [VISION-verbatim.md](../VISION-verbatim.md).
Everything here is a proposal to be argued with. Facts about Datadog were checked against the
Datadog docs on 2026-09-16; sources at the bottom.*

## 0. The shape of the problem

A system produces a stream of numbers and events. Music is a stream of sounds on a clock. The
project is a pipeline between them with five stages. Every later section fills in one stage.

```
Datadog ──► 1 Sources ──► 2 Timeline ──► 3 Mapping ──► 4 Conductor ──► 5 Sound engine ──► ears
            (get data)    (settle it     (metric →     (keep it        (make sound)
                           on a clock)    music)        musical)
```

| Stage | Question it answers |
|---|---|
| Sources | How do we get the data out of Datadog, how fresh, how often? |
| Timeline | Data arrives late and in lumps; how do we turn it into steady signals on a clock? |
| Mapping | Which metric drives which musical thing, and by what curve? |
| Conductor | How do many independent signals stay one coherent piece of music? |
| Sound engine | What actually makes the sound? |

## 1. Sources — every way to get Datadog data out

Datadog has no public "subscribe to a metric" stream. Metrics are pull. Logs, monitor state
changes and events can be push. So the honest design is **pull for numbers, push for moments**.

| # | Path | Pull or push | Freshness | Limits and notes | Use it for |
|---|---|---|---|---|---|
| 1 | **Metrics query API** — `POST /api/v2/query/timeseries` (preferred) or `GET /api/v1/query` | Pull, polled | Points land 10–60 s after the fact (Agent flushes every 10 s, then ingestion). Query a rolling window, e.g. last 120 s every 10 s | v1 is documented at **1,600 queries/hour/org** (≈ one every 2.25 s); v2 limits are returned in response headers, not published. One query can carry several metrics and many series (`by {host}`) | The continuous signals: request rate, error rate, latency percentiles, CPU, memory, queue depth, host count |
| 2 | **Monitor webhooks** — Webhooks integration, custom JSON payload with `$ALERT_STATUS`, `$EVENT_TITLE`, `$ALERT_METRIC`, `$PRIORITY` | Push, instant on state change | Seconds after the monitor evaluates | Needs an HTTPS endpoint Datadog can reach (a tunnel for a laptop). Free | The moments: a monitor goes ALERT / WARNING / RECOVERED / NO DATA |
| 3 | **Log forwarding to a custom destination** (HTTPS endpoint, JSON, gzip) | Push, near real time | Seconds; retries with backoff for 2 h if our endpoint is down | HTTPS on port 443 or 8088 only; can forward any ingested log, indexed or not; filter with a log query so only the lines we want arrive | Discrete events with texture: errors, deploys, user actions, one sound per log line or per N lines |
| 4 | **Monitors API** — `GET /api/v1/monitor` with group states | Pull, polled | Whatever the monitor's evaluation cadence is | Cheap: one call returns every monitor's state | The "chord" of overall health; the key the piece is in |
| 5 | **Events API** — `GET /api/v2/events` (search) | Pull, polled | Minute-ish | Deploys, config changes, Datadog's own events | Phrase boundaries: a deploy ends one section and starts the next |
| 6 | **Logs search API** — `POST /api/v2/logs/events/search` | Pull, polled | Seconds to a minute | Rate limited; fine as a fallback when we cannot expose an HTTPS endpoint for #3 | Same as #3, later and lumpier |
| 7 | **Bypass Datadog: tap the Agent** — a DogStatsD or OpenTelemetry fan-out (Vector, or a second StatsD sink) sends the same points to Ilúvatar directly | Push, instant | Sub-second | Requires changing the monitored system's config; not "Datadog data" strictly | Later, for systems we own, when 10–60 s of lag is too much |

### What this means for "stream vs rapid polling"

- **Polling floor is about 10 s.** Datadog's own data is batched in 10 s flushes, so polling faster
  than that returns the same points. At 10 s per poll we use ~360 of the 1,600 hourly v1 queries;
  the v2 endpoint should be used anyway.
- **One poll, many metrics.** A single timeseries query can request every metric we play, so the
  poll count does not grow with the number of voices.
- **Push covers the moments that must not lag.** Monitor state changes and selected log lines
  arrive within seconds via #2 and #3. That is where the "something is wrong" sounds come from.
- **Data arrives out of order and revised.** The last 30–60 s of a metrics query is often still
  filling in. We never play the newest point directly; see Timeline.

### Credentials and where it runs

The metrics query and monitor endpoints need a Datadog **API key and Application key**. Those never
go in a browser. So the Sources stage runs as a small local process (CLI or service) that talks to
Datadog and exposes the settled timeline to whatever renders the sound. Push paths (#2, #3) need
that process reachable over HTTPS: a tunnel (Cloudflare, ngrok) on a laptop, or a hosted endpoint.

## 2. Timeline — from late, lumpy data to steady signals

Music needs a clock that never stutters. Datadog gives lumps every 10 s, each lump possibly
revising the last minute. The Timeline stage reconciles the two.

| Rule | Why |
|---|---|
| **Play with a fixed delay** behind real time, e.g. 45 s | By then the points are settled. Nobody can hear a 45 s lag on a background piece, and the alternative is notes that retroactively did not happen |
| **Every metric becomes a continuous signal** sampled at the musical control rate (say 20–50 times per second), by interpolating between Datadog's 10 s points | A number that jumps every 10 s sounds like a broken radio. Interpolated, it glides like a fader |
| **Every event becomes a timestamped trigger** on the same timeline | Log lines, monitor changes, deploys all become "at time t, this happened", quantized later by the Conductor |
| **The timeline is a ring buffer**, e.g. the last 10 minutes | Enough for baselines and for the "what just happened" replay; nothing is stored long term |
| **A late revision of an already-played second is dropped**, and counted | Honest: we log how often we played something that turned out wrong. If it is often, lengthen the delay |
| **Silence is a signal.** If a poll fails or a metric returns nothing, the signal goes to a "no data" state, not to zero | Zero would sound like calm. No data must sound like absence: the voice fades, or a hollow held tone |

## 3. Mapping — which metric drives which musical thing

Three vocabularies, and the mapping is a table between them.

### 3a. Musical entities (the things that can sound)

| Entity | What it is | Good for |
|---|---|---|
| **Drone / pad** | A sustained chord or tone, always on | The baseline of a whole service: "the system is up" |
| **Ostinato / loop** | A short repeating phrase (bass line, arpeggio, riff) | A steady process: request handling, a queue consumer, a cron |
| **Rhythm pattern** | Percussion on a grid | Throughput: each hit is N events; density = load |
| **Melody** | A written phrase, played when called | A monitor's identity: each monitor gets a motif; you learn to recognise "that's the database" |
| **One-shot sample** | A single sound: a chime, a click, a stinger | A discrete event: a deploy, an error log line, a recovered alert |
| **Harmonic field** | The global key, mode and chord | Overall health: major/consonant when green, tension when degraded |
| **Space** | Reverb size, stereo width | Scale: number of hosts, regions, users |

### 3b. Musical properties (the knobs on each entity)

| Property | Range | Ear reads it as |
|---|---|---|
| Volume | silent → loud | How much of this is happening |
| Density | sparse → busy (notes per bar) | Rate, throughput |
| Tempo / rate | slow → fast (of a loop, not the whole piece) | Speed of a process |
| Pitch / register | low → high, or transposition in the key | Level, size, or which instance |
| Brightness (filter) | dark → bright | Saturation, heat, pressure |
| Tension (dissonance) | consonant → dissonant | Error, deviation from normal |
| Stability (vibrato, jitter) | steady → wobbling | Variance, jitter, p99 far from p50 |
| Articulation | smooth → staccato | Smooth flow vs bursts |
| Pan / position | left → right | Which region, which shard |
| Space (reverb) | dry → vast | Scale |

### 3c. Datadog metric kinds, and their natural targets

| Metric kind | Examples | Natural musical target |
|---|---|---|
| **Rate / count** | requests/s, jobs/min, log lines/s | Density of a rhythm or ostinato; volume as a second dial |
| **Gauge (level)** | queue depth, connections, memory | Pitch/register or brightness of a drone |
| **Saturation (0–100%)** | CPU %, disk %, pool utilisation | Brightness (filter opens as it heats), then tension above a threshold |
| **Latency percentiles** | p50, p95, p99 | p50 → tempo of the loop; p99 − p50 gap → instability (vibrato, jitter) |
| **Error rate / ratio** | 5xx ratio, failed jobs ratio | Tension: minor mode, added dissonant notes, detuning proportional to the ratio |
| **Cardinality** | host count, pod count, active users | Number of voices playing the ostinato; reverb size |
| **Monitor state** | OK / WARN / ALERT / NO DATA | Harmonic field shift (major → suspended → minor), plus the monitor's motif played once on each change |
| **Events** | deploys, config changes | Cadence: end the phrase, one bar of rest, start again (new section) |
| **Log lines** | errors, specific messages | One-shot samples; different sample per log status or service |

### 3d. The transfer from number to knob

A raw number is useless until it is scaled. Each mapping row carries:

| Field | Meaning | Example |
|---|---|---|
| `source` | Datadog query | `sum:trace.http.request.hits{service:api}.as_rate()` |
| `entity` / `property` | What it drives | `rhythm.api` / `density` |
| `range` | What counts as 0 and 1 | `fixed: [0, 500]` or `baseline: p5..p95 over the last 24 h` |
| `curve` | Shape between 0 and 1 | `linear`, `log` (rates span decades), `exp` (only the top matters), `steps` (thresholds) |
| `smooth` | Time constant of the glide | `2s` for load, `0.2s` for errors (errors should be heard fast) |
| `hysteresis` | For discrete flips | Only change the mode after the value has crossed for 15 s |
| `silence` | Behaviour on no data | `fade`, `hold`, `hollow tone` |

Baselines matter more than absolute values. "Busy for this service at this hour" is what the ear
should hear as busy. The first version can use fixed ranges set by hand; the second learns a
rolling baseline from the ring buffer and from a longer history query at start-up.

## 4. Conductor — keeping many signals one piece of music

Ten independent knobs turning at once is noise. The Conductor is the set of rules that make it
music. This is where the project's taste lives.

| Rule | What it does |
|---|---|
| **One clock, one key** | A global tempo (e.g. 72 bpm) and a key/mode. Every entity plays on that grid and in that key. Continuous properties change any time; note events wait for the next beat subdivision |
| **Harmonic field from overall health** | The key stays; the mode and chord tension come from the monitors' aggregate state. Green: consonant. One warning: suspended chords. Alert: minor, added dissonance. Recovered: resolution back to consonance, which is the most satisfying sound in the whole system |
| **Sections** | Calm / busy / incident are musical sections with different textures, entered via hysteresis so the piece does not flicker between them |
| **Voice budget** | At most N voices audible; when a system has 200 hosts, the ostinato is played by 200-in-4 (density and width), not 200 instruments |
| **Motifs are stable** | Each monitored thing keeps the same motif for its lifetime, so the listener learns them. New things get new motifs from a generator seeded by their name |
| **Events are quantized, never dropped** | A deploy at beat 2.7 sounds on beat 3. Two errors in the same subdivision become one louder hit plus a count |
| **Attention economy** | Background by default. Only tension and one-shots are allowed to cut through. A recovery is celebrated once, briefly |
| **Replayable** | Because the timeline is a buffer, the last 10 minutes can be played back faster: "what did the incident sound like?" |

## 5. Sound engine — what makes the sound

| Option | Strengths | Costs | Fit |
|---|---|---|---|
| **Web Audio + Tone.js** (browser) | Samples, synths, precise scheduling on a musical clock, runs anywhere, easy to share a demo link, open source friendly | Browser tab must be open; the Datadog keys must sit in the local process, not the page | **First choice.** The local process serves the timeline over WebSocket; the page plays |
| **Strudel / TidalCycles** (pattern language) | Patterns are first-class; density/rate mappings are one-liners; live-codable | Another language for contributors; Strudel runs in the browser on Web Audio too | Strong candidate for the pattern layer inside the Tone.js page, later |
| **SuperCollider / Sonic Pi** | The deepest synthesis; OSC control | Heavy install; harder to share | For a "studio" renderer later |
| **MIDI / OSC out** | Drive Ableton, hardware, anything | Needs a DAW; not self-contained | An output option, not the first renderer |

Recommendation: a TypeScript core (Sources, Timeline, Mapping, Conductor) that emits a small
"score stream" over WebSocket, and a first renderer in the browser on Tone.js. The score stream is
the open interface: anyone can write a renderer (MIDI, SuperCollider, a light show).

## 6. The first piece — one service, three voices

The smallest thing that proves the idea end to end, against a real Datadog org:

| Voice | Source | Mapping |
|---|---|---|
| Ostinato (bass loop) | request rate of one service, polled every 10 s | density and volume, log curve, 2 s smoothing |
| Tension (harmonic field) | error ratio of the same service | detune and mode, exp curve, 0.2 s smoothing, hysteresis on the mode flip |
| Stinger (one-shot) | one monitor's webhook | motif on ALERT, resolution chord on RECOVERED |

Done when: with a laptop, a Datadog org, and a browser tab, you can hear the service breathe, hear
it get busy at lunch, and hear an alert fire and recover. Replay of the last 10 minutes works.

## 7. Open questions for Dave

1. Which Datadog org and which service is the first target? That fixes the metric names and the
   ranges.
2. Ambient piece (background, minutes-long phrases) or instrument (foreground, immediate)? The
   Conductor rules differ. This document assumes ambient.
3. Do you want to compose the motifs and pick the samples yourself, or should the first version
   generate them from names?

## Sources

- Datadog rate limits: https://docs.datadoghq.com/api/latest/rate-limits/ (v1 query timeseries
  limit of 1,600/hour/org appears on the endpoint page
  https://docs.datadoghq.com/api/latest/metrics/query-timeseries-points/ — "Datadog recommends
  using the v2 endpoint")
- Log forwarding to custom destinations: https://docs.datadoghq.com/logs/log_configuration/forwarding_custom_destinations/
- Webhooks integration and payload variables: https://docs.datadoghq.com/integrations/webhooks/
- DogStatsD 10 s flush interval: https://docs.datadoghq.com/metrics/custom_metrics/dogstatsd_metrics_submission/
