# 04 — Synths: real synths, their real knobs (2026-10-11)

A sound can be played on a real synth. Each synth in the library mirrors one real instrument:
its front panel (knobs named as printed), the MIDI message each knob answers to (from the
maker's MIDI implementation chart), how to set it up, and a browser stand-in built like it.

## How it works

| Piece | What it does |
|---|---|
| **Synth** (per sound) | Pick one from the library. The General MIDI instrument is replaced by the synth |
| **Output** browser | The synth's **stand-in** plays: built like it (voices, oscillators per voice, filter poles, mono or poly), driven by the same knobs. It does not claim to sound like the real one |
| **Output** MIDI port | The **real synth** plays. Its knobs are moved by the maker's CC, 14-bit CC or NRPN numbers |
| **Front panel** | Every MIDI-reachable knob and switch, by section. Setting a knob sends it. Dimmed knobs only move the real synth |
| **Rules** | "drive" can target any knob: *when Errors always → drive Bass · FILTER · RESONANCE* |
| **Properties** | brightness → cutoff, tension → resonance, volume → volume by default; remap or turn off per sound |

Rules of the road:
- Only knobs you set on the panel, or that a rule turns, are sent to hardware. The synth's own patch stays otherwise.
- A property moves its knob only once a rule drives that property. Volume is always applied.
- A mono synth plays one note of a drone's chord (its root), as the real one would.
- Notes outside a synth's range are folded in by octaves.
- Synths that use both CC and NRPN (Sequential, DeepMind, Bass Station II) are sent NRPN: full resolution.

## The library

**hardware**

| Synth | Voices | Controls | Messages | How it listens | Accuracy |
|---|---|---|---|---|---|
| Korg minilogue xd | 4 | 59 | CC | Fixed map | high |
| Korg volca keys | 3 | 16 | CC | Fixed map | high for the CC list |
| Roland JU-06A | 4 | 39 | CC | Fixed map | high for CC numbers |
| Roland SH-01A | 4 | 42 | CC | Fixed map | high for CC numbers |
| Arturia MicroFreak | 4 | 21 | CC | Fixed map | high for the 20 CC numbers |
| Arturia MiniFreak | 6 | 41 | CC | Fixed map | high for CC numbers |
| Novation Bass Station II | mono | 90 | CC + NRPN | Fixed map | high for CC and NRPN numbers |
| Moog Subsequent 37 | 2 | 37 | CC (some 14-bit) | Fixed map | high |
| Moog Grandmother | mono | 7 | CC (some 14-bit) | Most knobs analog — see limits | high |
| Sequential Prophet Rev2 | 8 | 48 | CC + NRPN | Fixed map | high |
| Sequential Take 5 | 5 | 50 | CC + NRPN | Fixed map | high for numbers |
| Behringer DeepMind 12 | 12 | 39 | CC + NRPN | Fixed map | medium-high |
| Behringer Model D | mono | 1 | CC | Most knobs analog — see limits | medium |

**software**

| Synth | Voices | Controls | Messages | How it listens | Accuracy |
|---|---|---|---|---|---|
| Apple Retro Synth (Logic Pro) | 8 | 5 | CC | MIDI learn (suggested CCs) | high for what is listed |
| Apple Alchemy (Logic Pro) | 8 | 5 | CC | MIDI learn (suggested CCs) | high for the Ctrl A-D defaults |
| Apple ES2 (Logic Pro) | 8 | 3 | CC | MIDI learn (suggested CCs) | high for documented behavior |
| Apple GarageBand synths | 8 | 4 | CC | MIDI learn (suggested CCs) | low for CC74/CC71 |
| Vital Audio Vital | 8 | 8 | CC | MIDI learn (suggested CCs) | high |
| Xfer Records Serum 2 | 8 | 6 | CC | MIDI learn (suggested CCs) | high for learn workflow |
| Arturia Pigments | 8 | 6 | CC | MIDI learn (suggested CCs) | high for documented items |
| Arturia Analog Lab | 8 | 12 | CC | MIDI learn (suggested CCs) | medium |
| u-he Diva | 8 | 8 | CC | MIDI learn (suggested CCs) | high for documented items |

**standard**

| Synth | Voices | Controls | Messages | How it listens | Accuracy |
|---|---|---|---|---|---|
| MIDI standard: General MIDI 2 sound controllers | 8 | 20 | CC | Fixed map | high for CC meanings |

Chosen as widely used, much-reviewed instruments. Each profile's popularity note, with its source
where one was found, is in its research file. No usage numbers were found for the software synths.

## Where the numbers come from

- `src/synths/research/*.json` — what each maker's documentation says. One record per synth, with
  sources (manual and page) and an accuracy note. Gaps are left null, never guessed.
- `src/synths/profiles.ts` — our choices on top: stand-in architecture, the starting patch, which
  knobs are centre-zero, and the default property → knob map.
- `tests/synths.test.ts` checks every profile: valid CC/NRPN numbers, unique ids, cited source,
  default map pointing at real knobs.

## Known gaps (from the research, not tested on hardware)

| Synth | Gap |
|---|---|
| minilogue xd | Korg's chart contradicts itself on SYNC and RING on/off values; "MIDI Rx CC" must be On |
| MicroFreak | Oscillator TYPE (CC 9) has no published value table |
| Bass Station II | Most switch positions are not published; mod wheel printed as "cc 0" |
| JU-06A, SH-01A | Switch positions are not published by Roland |
| DeepMind 12 | VCF envelope sustain CC is a misprint in Behringer's chart (left out; NRPN used) |
| Take 5 | OVERDRIVE has no CC (NRPN only); OS 2.0 additions not in the MIDI document |
| Grandmother, Model D | Filter, envelopes and mixer are analog: MIDI cannot reach them |
| Software synths | No fixed maps. Suggested CCs are taught with MIDI learn ("send" button). GarageBand's CC 74/71 response is unverified |

Switch positions without published values show as a 0–127 slider until measured on a real unit.
