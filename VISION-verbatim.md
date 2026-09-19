# Vision — Dave's own words, verbatim

*Prompts are recorded here exactly as given, then interpreted. Interpretation is marked as such.*

## Prompt 1 — founding (2026-09-16, live session)

> Let's switch focus completely. Please start  new repo under jde company called Ilúvatar
>
> It will be an open source project to bring forth the workings of systems via music.

*Interpretation: a sonification project — systems (software, data, organizations, anything with
observable state over time) rendered as music so their workings can be heard. Beyond his words:
the README's first sketch of mappings and the three principles; the MIT license (open source, no
license named); the repo slug `iluvatar` (GitHub does not allow `ú` in repository names — the
display name stays Ilúvatar).*

## Prompt 2 — Datadog first, and the mapping problem (2026-09-16, live session)

> Great. Let's brainstorm how this will break down. The first data source I'd like to support is Datadog. Let's analyze the different ways in which we can ingest Datadog data in either a stream or a rapid succession polling so that we can then craft the state as an actual playing musical sound. We will also need to break down the individual metrics that we're tracking and have a way to map them onto some kind of musical entities. These entities could be melodies that we create, they could be samples that we play, etc. We can then map the quantity or the different numerical values that come with each metric to properties of those musical entities, such as volume, intensity, et cetera, et cetera. Let's start to brainstorm about ways we can make these connections and turn a string of input into an ongoing musical piece.

*Interpretation: written up as [docs/01-datadog-to-music.md](docs/01-datadog-to-music.md) — a
five-stage pipeline (Sources → Timeline → Mapping → Conductor → Sound engine), every Datadog
ingestion path with its freshness and limits, three mapping vocabularies (entities, properties,
metric kinds) and the transfer table between them, the rules that keep many signals one piece,
and a first three-voice piece. Beyond his words: the fixed playback delay, the Conductor stage,
the TypeScript core + browser Tone.js recommendation, and the three open questions at the end.*

## Prompt 3 — composer mode (2026-09-16, live session)

> Once we have this in, I'd like to start fleshing out a composer mode. In this mode, we will have the various inputs that are configured, as well as a way of creating the sound or connecting the sounds to them. So for example, we may be measuring traffic in visits per second. If we choose that, we can then choose either the MIDI instrument we want to play, perhaps the musical concept that we want to put at certain bounds. If traffic drops below a certain amount, maybe we want to introduce something else, such as a minor chord. If there is an increase in traffic beyond a certain bound or beyond a certain slope, maybe we want to trigger a certain melody. Etc., etc. A full implementation of this composer mode will allow someone to score the entirety of the possibility of things that could happen with their systems in a way that gives real musical depth to them.

*Interpretation: written up as [docs/02-composer-mode.md](docs/02-composer-mode.md) — a score
file (inputs, sounds, rules, coverage) with a rule language for thresholds, durations, slopes and
state changes; sounds as MIDI instruments, samples, synths, motifs, patterns and concepts; a
four-panel composer screen that always plays; and tools for "the entirety of the possibility":
a coverage map, a state grid, a scenario library, a silence audit. Beyond his words: YAML as the
score format, derived inputs as the way slopes are expressed, the scenario engine, and the build
order.*

## Prompt 4 — answers: mock two feeds, ambient, build the composer (2026-09-16, live session)

> 1 let's mock up two feeds: traffic and errors. These archetypes will set us explore the musical concepts
>
> 2 ambient
>
> 3 let's get the composer ui cooking and allow users to pick midi instruments, compose motifs and set ways in which the quantity and slope of the metrics informs the sound.

*Interpretation: no Datadog yet — a scenario engine produces two synthetic feeds, traffic
(visits/s) and errors (ratio), and those two archetypes are the material for exploring the
musical concepts. The piece is ambient. The first build is the composer screen: pick a General
MIDI instrument per sound, write motifs, and write rules where a metric's quantity and its slope
drive sound properties or trigger motifs. Beyond his words: the stack (TypeScript, Vite, React,
Tone.js for the clock, smplr for General MIDI SoundFont instruments), YAML score export, and
the decision to verify the screen with a headless browser while the sound itself is checked by ear.*

## Prompt 5 — composer-mode answers (2026-09-16, live session)

> 1 - both. An engineer and musician will collaborate
>
> 2 - not sure.
>
> 3 - yes, let's share from day 1

*Interpretation: the composer screen serves two people working together — the engineer binds
inputs and sets bounds against the data, the musician picks instruments and writes motifs — so
both vocabularies stay visible on one screen. Sounds: General MIDI first (uniform for everyone,
nothing to build), samples and synths later; Dave has not decided. Scores are shared from day one:
a `scores/` directory in this repo, one folder per score with its YAML and a README.*

## Prompt 6 — dramatic, looping scenarios with a length slider (2026-09-19, live session)

> Please update the scenarios to be more dramatic. An outage/recover should see error climb up to 100%, then slowly return to 0.
>
> Scenarios should loop forever.
>
> Please add a scenario duration slider that lets us control how long each scenario runs for so we can play with the nuance

*Interpretation: every scenario became a shape over one cycle (phase 0 to 1) so the same drama
plays at any length; a "scenario length" slider (20 s to 10 min) sets the cycle and keeps the
phase when moved. Beyond his words: the surge, lunch peak and slow bleed were made steeper too,
and every shape returns to its start so the loop wraps without a jump.*

## Prompt 7 — free form mode (2026-09-19, live session)

> Please add an option to turn off scenarios and go into a free form mode that lets the user manipulate each of the dials for the things being tracked.

*Interpretation: a Scenarios / Free form switch on the Inputs panel; in free form each feed-backed
input carries its own dial on its row, and derived inputs (the slope) follow the dial. Beyond his
words: switching to free form starts the dials at the current values so nothing jumps; the old
Manual scenario was folded into this.*

## Prompt 8 — a library of melodies (2026-09-19, live session)

> Please look up and integrate a whole bunch of classical melodies into a dropdown that we can choose when creating a sound. If possible, bring in many things from classical, popular, traditional, and other things as you can find that don't violate copyright law.

## Prompt 9 — a page to browse, preview, create and save (2026-09-19, live session)

> Please create a new page that lets us browse and preview these and create new ones and save them. If we don't have the infrastructure to save yet, you can save to local storage. When choosing a melody from the actual work screen, please pop up a modal so the melodies can be previewed before as they are chosen.

## Prompt 10 — ready-made sounds, not just melodies (2026-09-19, live session)

> In fact, instead of creating the melody at just that one notes level, have an option to choose preformed melodies along with instruments already put together instead of having the mode that we have now where you can choose the instrument, create the melody, all that stuff. So the user should be able to choose from a fully put together choice for that sound or use the current interface to make their own.

*Interpretation of 8–10, written up as [docs/03-sound-library.md](docs/03-sound-library.md): the
library is a set of "ready-made sounds" (presets) — a melody with its instrument, kind and level —
rather than melodies alone. 67 public domain tunes ship, each with a fitting General MIDI
instrument. On the composer, a "ready-made…" button per sound and "+ add a ready-made sound" open a
picker modal with previews; the build-your-own interface stays. A Library page browses, previews,
and edits; your own are saved in the browser. Beyond his words: the strict copyright rule (composer
dead before 1956 and published before 1929, or traditional), transposing each tune to C so the score
plays it in the piece's key, and the credit line under a sound's notes.*

*(More prompts appended below as Dave continues.)*
