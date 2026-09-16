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

*(More prompts appended below as Dave continues.)*
