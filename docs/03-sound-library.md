# The sound library — ready-made sounds

*2026-09-19. Source: Dave's Prompts 8–10 in [VISION-verbatim.md](../VISION-verbatim.md).*

## What a ready-made sound is

A **preset**: a melody together with the instrument that plays it, whether it loops or is
triggered, and a level. Choosing one fills a sound on the composer in one step. The composer can
still build a sound by hand (instrument, kind, notes, level) exactly as before; the preset is the
shortcut, not a replacement.

| Where | What you can do |
|---|---|
| Composer, Sounds panel | "ready-made…" on any sound opens the picker; "+ add a ready-made sound" adds one. The picker previews before choosing (▶ plays the tune with its instrument, in the piece's key). Choosing writes instrument, kind, notes and level onto the sound and keeps a credit line under the notes ("from Für Elise — Beethoven, 1810"; "edited from" once the notes change) |
| Library page (`#/library`) | Browse every preset by category or search, preview, read the notes. "+ new sound" opens the editor (title, by, year, instrument, kind, notes, level, preview, save). "make a copy to edit" clones a shipped preset into yours. Yours are listed first, under the category "Mine" |
| Storage | Yours are saved in the browser (`localStorage`, key `iluvatar.presets.v1`) until there is a server. Shipped presets are code: `src/core/presets.ts` |

## What ships: 67 public domain tunes

| Category | Count | Examples |
|---|---|---|
| Classical | 25 | Ode to Joy, Für Elise, Toccata in D minor, Canon in D, Morning Mood, The Entertainer |
| Traditional and folk | 12 | Greensleeves, Scarborough Fair, Auld Lang Syne, Danny Boy, Oh! Susanna, Amazing Grace |
| Popular songs before 1929 | 3 | Happy Birthday to You, Daisy Bell, Take Me Out to the Ball Game |
| Children's songs | 12 | Twinkle Twinkle, Frère Jacques, Row Your Boat, Three Blind Mice |
| Carols and hymns | 11 | Silent Night, Joy to the World, Jingle Bells, Carol of the Bells |
| World | 4 | Sakura, Mo Li Hua, Korobeiniki, La Cucaracha |

Each entry is the opening phrase in the tune's own key, paired with a fitting General MIDI
instrument, and transposed to C when chosen (the score is written in C and played in the key).
Fast tunes use a 16th-note step and say so.

## The copyright rule

Both must hold, or the tune is traditional with no known author:

1. Every composer died before 1956 (life plus 70 years as of 2026, the longest common term).
2. The work was published before 1929 (public domain in the United States).

Only the bare melody line is included. Arrangements, lyrics and recordings are not, and are
often still protected even when the tune is not. Pop songs from 1929 on are excluded. A unit
test enforces the year rule on every shipped entry.

## Accuracy

The transcriptions are from memory of the standard versions, and are verified only by parsing and
by unit tests on transposition. Nobody has yet checked them by ear. Corrections are welcome by pull
request: edit the `notes` field in `src/core/presets.ts`.

## Adding a shipped preset

1. Confirm the copyright rule above.
2. Add an entry to `LIBRARY` in `src/core/presets.ts`: id, title, by, year, category, instrument
   (a name from smplr's General MIDI list), kind, volume, tonic, grid, notes.
3. `pnpm test` — the library tests check the id is unique, the instrument exists, the notes parse,
   there are at least four of them, and the year is before 1929.
