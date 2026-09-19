/**
 * The sound library — ready-made sounds a composer can drop into a score: a melody together with
 * the instrument that plays it, whether it loops or is triggered, and a level. A "preset".
 *
 * Copyright rule for the shipped melodies (strict, both must hold, or the tune is traditional with
 * no known author):
 *   1. every composer died before 1956 (life + 70 years as of 2026, the longest common term), and
 *   2. the work was published before 1929 (public domain in the United States).
 * Arrangements, lyrics and recordings are NOT included — only the bare melody line, which is what
 * the rule above covers. Each entry names its source so the basis is auditable.
 *
 * Transcription: opening phrase only, one token per step. `grid` says what a step is (an 8th by
 * default; a 16th for fast tunes so the notation stays short). Written in the tune's own key;
 * `tonic` is that key's root. Choosing a preset transposes it to C (see presetNotesInC) because the
 * score plays everything "written in C" in the piece's key. Transcribed from memory of the standard
 * versions and checked only by parsing — not yet by ear. Corrections welcome by pull request.
 *
 * A composer's own presets live in browser storage (see presetStore.ts) with category "mine".
 */
import { KEY_ROOTS, midiToNote, parseMotif, transpose, type Motif } from './motif';
import type { Sound } from './types';

export type PresetCategory = 'classical' | 'traditional' | 'popular' | 'children' | 'carols' | 'world' | 'mine';
export const PRESET_CATEGORIES: { id: PresetCategory; label: string }[] = [
  { id: 'mine', label: 'Mine' },
  { id: 'classical', label: 'Classical' },
  { id: 'traditional', label: 'Traditional and folk' },
  { id: 'popular', label: 'Popular songs before 1929' },
  { id: 'children', label: "Children's songs" },
  { id: 'carols', label: 'Carols and hymns' },
  { id: 'world', label: 'World' },
];

export interface Preset {
  id: string;
  title: string;
  /** Composer, or "traditional (origin)". For your own: whatever you write. */
  by: string;
  /** Year of composition or first publication, as known. */
  year: string;
  category: PresetCategory;
  /** General MIDI instrument name (smplr). */
  instrument: string;
  kind: 'loop' | 'motif';
  /** Base level 0..1. */
  volume: number;
  /** Root of the key the notes are written in (a KEY_ROOTS name). Minor tunes use the minor tonic. */
  tonic: string;
  /** What one step is. */
  grid: '8th' | '16th';
  notes: string;
}

export const LIBRARY: Preset[] = [
  // ---------- Classical ----------
  { id: 'ode-to-joy', instrument: 'string_ensemble_1', kind: 'motif', volume: 0.8, title: 'Ode to Joy (Symphony No. 9)', by: 'Ludwig van Beethoven', year: '1824', category: 'classical', tonic: 'C', grid: '8th',
    notes: 'e5:2 e5:2 f5:2 g5:2 | g5:2 f5:2 e5:2 d5:2 | c5:2 c5:2 d5:2 e5:2 | e5:3 d5 d5:4' },
  { id: 'fur-elise', instrument: 'acoustic_grand_piano', kind: 'motif', volume: 0.8, title: 'Für Elise', by: 'Ludwig van Beethoven', year: '1810', category: 'classical', tonic: 'A', grid: '16th',
    notes: 'e5 d#5 e5 d#5 e5 b4 d5 c5 a4:3 . c4 e4 a4 b4:3 . e4 g#4 b4 c5:3' },
  { id: 'beethoven-5', instrument: 'string_ensemble_1', kind: 'motif', volume: 0.8, title: 'Symphony No. 5, opening', by: 'Ludwig van Beethoven', year: '1808', category: 'classical', tonic: 'C', grid: '8th',
    notes: '. g5 g5 g5 eb5:4 | . f5 f5 f5 d5:4' },
  { id: 'moonlight', instrument: 'acoustic_grand_piano', kind: 'loop', volume: 0.8, title: 'Moonlight Sonata, arpeggio', by: 'Ludwig van Beethoven', year: '1801', category: 'classical', tonic: 'C#', grid: '8th',
    notes: 'g#4 c#5 e5 g#4 c#5 e5 g#4 c#5 e5 g#4 c#5 e5' },
  { id: 'eine-kleine', instrument: 'violin', kind: 'motif', volume: 0.8, title: 'Eine kleine Nachtmusik', by: 'Wolfgang Amadeus Mozart', year: '1787', category: 'classical', tonic: 'G', grid: '8th',
    notes: 'g4:2 . d4 g4:2 . d4 | g4 d4 g4 b4 d5:4 | c5:2 . a4 c5:2 . a4 | c5 a4 f#4 a4 d4:4' },
  { id: 'rondo-alla-turca', instrument: 'acoustic_grand_piano', kind: 'motif', volume: 0.8, title: 'Rondo alla Turca', by: 'Wolfgang Amadeus Mozart', year: '1783', category: 'classical', tonic: 'A', grid: '16th',
    notes: 'b4 a4 g#4 a4 c5:4 | d5 c5 b4 c5 e5:4 | f5 e5 d#5 e5 b5 a5 g#5 a5 b5 a5 g#5 a5 c6:4' },
  { id: 'mozart-k545', instrument: 'acoustic_grand_piano', kind: 'motif', volume: 0.8, title: 'Piano Sonata No. 16 in C', by: 'Wolfgang Amadeus Mozart', year: '1788', category: 'classical', tonic: 'C', grid: '8th',
    notes: 'c5:4 e5:2 g5:2 | b4:3 c5 d5:2 c5:2' },
  { id: 'mozart-40', instrument: 'violin', kind: 'motif', volume: 0.8, title: 'Symphony No. 40, opening', by: 'Wolfgang Amadeus Mozart', year: '1788', category: 'classical', tonic: 'G', grid: '8th',
    notes: 'eb5 d5 d5:2 eb5 d5 d5:2 | eb5 d5 d5 bb5:4 | bb5 a5 g5:2 g5 f5 eb5:2 | eb5 d5 c5:4' },
  { id: 'toccata-d-minor', instrument: 'church_organ', kind: 'motif', volume: 0.8, title: 'Toccata in D minor', by: 'Johann Sebastian Bach', year: 'c. 1704', category: 'classical', tonic: 'D', grid: '16th',
    notes: 'a5 g5 a5:3 . g5 f5 e5 d5 c#5 d5:4' },
  { id: 'jesu-joy', instrument: 'oboe', kind: 'motif', volume: 0.8, title: "Jesu, Joy of Man's Desiring", by: 'Johann Sebastian Bach', year: '1723', category: 'classical', tonic: 'G', grid: '8th',
    notes: 'g4 a4 b4 d5 c5 c5 e5 d5 d5 g5 f#5 g5 d5 b4 g4 a4 b4 c5 b4 a4 b4 g4 a4 b4' },
  { id: 'minuet-in-g', instrument: 'harpsichord', kind: 'motif', volume: 0.8, title: 'Minuet in G', by: 'Christian Petzold (Bach notebook)', year: '1725', category: 'classical', tonic: 'G', grid: '8th',
    notes: 'd5:2 g4 a4 b4 c5 | d5:2 g4:2 g4:2 | e5:2 c5 d5 e5 f#5 | g5:2 g4:2 g4:2' },
  { id: 'bach-prelude-c', instrument: 'harpsichord', kind: 'loop', volume: 0.8, title: 'Prelude in C (Well-Tempered Clavier)', by: 'Johann Sebastian Bach', year: '1722', category: 'classical', tonic: 'C', grid: '16th',
    notes: 'c4 e4 g4 c5 e5 g4 c5 e5 | c4 d4 a4 d5 f5 a4 d5 f5 | b3 d4 g4 d5 f5 g4 d5 f5 | c4 e4 g4 c5 e5 g4 c5 e5' },
  { id: 'cello-suite-1', instrument: 'cello', kind: 'loop', volume: 0.8, title: 'Cello Suite No. 1, Prelude', by: 'Johann Sebastian Bach', year: 'c. 1720', category: 'classical', tonic: 'G', grid: '16th',
    notes: 'g2 d3 b3 a3 b3 d3 b3 d3 | g2 d3 b3 a3 b3 d3 b3 d3 | g2 e3 c4 b3 c4 e3 c4 e3 | g2 e3 c4 b3 c4 e3 c4 e3' },
  { id: 'pachelbel-canon', instrument: 'violin', kind: 'loop', volume: 0.8, title: 'Canon in D, first voice', by: 'Johann Pachelbel', year: 'c. 1680', category: 'classical', tonic: 'D', grid: '8th',
    notes: 'f#5:2 e5:2 d5:2 c#5:2 | b4:2 a4:2 b4:2 c#5:2' },
  { id: 'vivaldi-spring', instrument: 'violin', kind: 'motif', volume: 0.8, title: 'Spring (The Four Seasons)', by: 'Antonio Vivaldi', year: '1725', category: 'classical', tonic: 'E', grid: '8th',
    notes: 'e5 g#5 g#5 g#5 f#5 e5 b5:3 . | b5 a5 g#5 f#5 e5 b5:3 .' },
  { id: 'haydn-surprise', instrument: 'pizzicato_strings', kind: 'motif', volume: 0.8, title: 'Surprise Symphony, Andante', by: 'Joseph Haydn', year: '1791', category: 'classical', tonic: 'C', grid: '8th',
    notes: 'c5:2 c5:2 e5:2 e5:2 g5:2 g5:2 e5:4 | f5:2 f5:2 d5:2 d5:2 b4:2 b4:2 g4:4' },
  { id: 'morning-mood', instrument: 'flute', kind: 'motif', volume: 0.8, title: 'Morning Mood (Peer Gynt)', by: 'Edvard Grieg', year: '1875', category: 'classical', tonic: 'E', grid: '8th',
    notes: 'b5 g#5 f#5 e5 f#5 g#5 | b5 g#5 f#5 e5 f#5 g#5 | b5 g#5 b5 c#6 g#5 c#6 | b5 g#5 f#5 e5:2' },
  { id: 'mountain-king', instrument: 'bassoon', kind: 'motif', volume: 0.8, title: 'In the Hall of the Mountain King', by: 'Edvard Grieg', year: '1875', category: 'classical', tonic: 'B', grid: '8th',
    notes: 'b4 c#5 d5 e5 f#5 d5 f#5:2 | f5 c#5 f5:2 f#5 d5 f#5:2' },
  { id: 'brahms-lullaby', instrument: 'music_box', kind: 'motif', volume: 0.8, title: 'Lullaby (Wiegenlied)', by: 'Johannes Brahms', year: '1868', category: 'classical', tonic: 'C', grid: '8th',
    notes: 'e5 e5 g5:4 | e5 e5 g5:4 | e5 g5 c6:2 b5:2 | a5:2 a5:2 g5:2' },
  { id: 'funeral-march', instrument: 'acoustic_grand_piano', kind: 'motif', volume: 0.8, title: 'Funeral March (Sonata No. 2)', by: 'Frédéric Chopin', year: '1839', category: 'classical', tonic: 'Bb', grid: '8th',
    notes: 'bb4:3 bb4 bb4:2 bb4:2 | db5:3 c5 c5:3 bb4 | bb4:3 a4 bb4:4' },
  { id: 'new-world-largo', instrument: 'english_horn', kind: 'motif', volume: 0.8, title: 'Largo (New World Symphony)', by: 'Antonín Dvořák', year: '1893', category: 'classical', tonic: 'C', grid: '8th',
    notes: 'e5:3 g5 g5:4 | e5:3 d5 c5:4 | e5:3 g5 g5:2 e5:2 | d5:8' },
  { id: 'zarathustra', instrument: 'trumpet', kind: 'motif', volume: 0.8, title: 'Also sprach Zarathustra, opening', by: 'Richard Strauss', year: '1896', category: 'classical', tonic: 'C', grid: '8th',
    notes: 'c4:4 g4:4 c5:4 | e5:2 eb5:6' },
  { id: 'gymnopedie-1', instrument: 'acoustic_grand_piano', kind: 'motif', volume: 0.8, title: 'Gymnopédie No. 1', by: 'Erik Satie', year: '1888', category: 'classical', tonic: 'D', grid: '8th',
    notes: 'f#5:2 a5:2 g5:2 | f#5:2 c#5:2 b4:2 | c#5:2 d5:2 a4:6' },
  { id: 'the-entertainer', instrument: 'honkytonk_piano', kind: 'motif', volume: 0.8, title: 'The Entertainer', by: 'Scott Joplin', year: '1902', category: 'classical', tonic: 'C', grid: '16th',
    notes: 'd5 d#5 e5 c6:2 e5 c6:2 e5 c6:4 | c6 d6 d#6 e6 c6 d6 e6:2 b5 d6 c6:4' },
  { id: 'dies-irae', instrument: 'choir_aahs', kind: 'loop', volume: 0.8, title: 'Dies irae (plainchant)', by: 'traditional (Latin chant)', year: '13th century', category: 'classical', tonic: 'D', grid: '8th',
    notes: 'f4:2 e4:2 f4:2 d4:2 e4:2 c4:2 d4:2 d4:2' },

  // ---------- Traditional and folk ----------
  { id: 'greensleeves', instrument: 'acoustic_guitar_nylon', kind: 'motif', volume: 0.8, title: 'Greensleeves', by: 'traditional (England)', year: '16th century', category: 'traditional', tonic: 'A', grid: '8th',
    notes: 'a4 | c5:2 d5 e5:2 f5 | e5:2 d5 b4:2 g4 | a4:2 b4 c5:2 a4 | a4:2 g#4 a4:2 b4 | g#4:3 e4:3' },
  { id: 'scarborough-fair', instrument: 'recorder', kind: 'motif', volume: 0.8, title: 'Scarborough Fair', by: 'traditional (England)', year: '17th century', category: 'traditional', tonic: 'D', grid: '8th',
    notes: 'd5:2 d5:2 a5:2 | a5:2 e5:3 f5 e5:2 | d5:6 | . a5:2 c6:2 | d6:2 c6:2 a5:2 | b5:2 g5:2 a5:6' },
  { id: 'auld-lang-syne', instrument: 'accordion', kind: 'motif', volume: 0.8, title: 'Auld Lang Syne', by: 'traditional (Scotland)', year: '1788', category: 'traditional', tonic: 'F', grid: '8th',
    notes: 'c4 | f4:3 e4 f4:2 a4:2 | g4:3 f4 g4:2 a4:2 | f4:3 f4 a4:2 c5:2 | d5:6' },
  { id: 'danny-boy', instrument: 'oboe', kind: 'motif', volume: 0.8, title: 'Danny Boy (Londonderry Air)', by: 'traditional (Ireland)', year: '1855', category: 'traditional', tonic: 'C', grid: '8th',
    notes: 'c4 d4 e4 f4 | g4:2 a4:2 f4:2 g4:2 | a4:2 bb4:2 a4:2 g4:2 | e4:2 c4:2 d4:4' },
  { id: 'god-save-the-king', instrument: 'brass_section', kind: 'motif', volume: 0.8, title: 'God Save the King', by: 'traditional (Britain)', year: '1744', category: 'traditional', tonic: 'C', grid: '8th',
    notes: 'c5:2 c5:2 d5:2 | b4:3 c5 d5:2 | e5:2 e5:2 f5:2 | e5:3 d5 c5:2 | d5:2 c5:2 b4:2 | c5:6' },
  { id: 'star-spangled-banner', instrument: 'trumpet', kind: 'motif', volume: 0.8, title: 'The Star-Spangled Banner', by: 'John Stafford Smith', year: '1773', category: 'traditional', tonic: 'C', grid: '8th',
    notes: 'g4 e4 | c4:2 e4:2 g4:2 | c5:4 e5 d5 | c5:2 e4:2 f#4:2 | g4:4' },
  { id: 'yankee-doodle', instrument: 'piccolo', kind: 'motif', volume: 0.8, title: 'Yankee Doodle', by: 'traditional (America)', year: '1750s', category: 'traditional', tonic: 'C', grid: '8th',
    notes: 'c5 c5 d5 e5 c5 e5 d5 g4 | c5 c5 d5 e5 c5:2 b4:2 | c5 c5 d5 e5 f5 e5 d5 c5 | b4 g4 a4 b4 c5:2 c5:2' },
  { id: 'oh-susanna', instrument: 'banjo', kind: 'motif', volume: 0.8, title: 'Oh! Susanna', by: 'Stephen Foster', year: '1848', category: 'traditional', tonic: 'C', grid: '8th',
    notes: 'c5 d5 | e5:2 g5:2 g5:3 a5 | g5:2 e5:2 c5:3 d5 | e5:2 e5:2 d5:2 c5:2 | d5:6 c5 d5' },
  { id: 'camptown-races', instrument: 'banjo', kind: 'motif', volume: 0.8, title: 'Camptown Races', by: 'Stephen Foster', year: '1850', category: 'traditional', tonic: 'C', grid: '8th',
    notes: 'g5:2 g5:2 e5:2 g5:2 | a5:2 g5:2 e5:4 | e5:2 d5:4 . | e5:2 d5:4 .' },
  { id: 'when-the-saints', instrument: 'trumpet', kind: 'motif', volume: 0.8, title: 'When the Saints Go Marching In', by: 'traditional (America)', year: '1896', category: 'traditional', tonic: 'C', grid: '8th',
    notes: 'c5 e5 f5 g5:8 | c5 e5 f5 g5:8 | c5 e5 f5 g5:2 e5:2 c5:2 e5:2 d5:8' },
  { id: 'amazing-grace', instrument: 'bagpipe', kind: 'motif', volume: 0.8, title: 'Amazing Grace', by: 'traditional (New Britain, 1829 tune)', year: '1779', category: 'traditional', tonic: 'C', grid: '8th',
    notes: 'g4:2 | c5:4 e5 c5 e5:4 d5:2 | c5:4 a4:2 g4:4 g4:2 | c5:4 e5 c5 e5:4 d5:2 | g5:8' },
  { id: 'clementine', instrument: 'harmonica', kind: 'motif', volume: 0.8, title: 'Oh My Darling, Clementine', by: 'Percy Montrose', year: '1884', category: 'traditional', tonic: 'C', grid: '8th',
    notes: 'c5:2 c5 c5:2 g4 | e5:2 e5 e5:2 c5 | c5:2 e5 g5:2 g5 | f5:2 e5 d5:4' },

  // ---------- Popular songs before 1929 ----------
  { id: 'happy-birthday', instrument: 'acoustic_grand_piano', kind: 'motif', volume: 0.8, title: 'Happy Birthday to You', by: 'Mildred and Patty Hill', year: '1893', category: 'popular', tonic: 'C', grid: '8th',
    notes: 'g4 g4 a4:2 g4:2 c5:2 b4:4 | g4 g4 a4:2 g4:2 d5:2 c5:4 | g4 g4 g5:2 e5:2 c5:2 b4:2 a4:2 | f5 f5 e5:2 c5:2 d5:2 c5:4' },
  { id: 'daisy-bell', instrument: 'accordion', kind: 'motif', volume: 0.8, title: 'Daisy Bell (Bicycle Built for Two)', by: 'Harry Dacre', year: '1892', category: 'popular', tonic: 'C', grid: '8th',
    notes: 'g5:6 | e5:6 | c5:6 | g4:6 | a4:2 b4:2 c5:2 | a4:4 c5:2 | g4:6' },
  { id: 'take-me-out', instrument: 'drawbar_organ', kind: 'motif', volume: 0.8, title: 'Take Me Out to the Ball Game', by: 'Albert Von Tilzer', year: '1908', category: 'popular', tonic: 'C', grid: '8th',
    notes: 'c5:2 c6:2 a5:2 | g5:2 e5:2 g5:2 | d5:6 | . c5:2 c6:2 | a5:2 g5:2 e5:2 | g5:6' },

  // ---------- Children's songs ----------
  { id: 'twinkle', instrument: 'music_box', kind: 'motif', volume: 0.8, title: 'Twinkle, Twinkle, Little Star', by: 'traditional (France, "Ah! vous dirai-je, maman")', year: '1761', category: 'children', tonic: 'C', grid: '8th',
    notes: 'c5:2 c5:2 g5:2 g5:2 a5:2 a5:2 g5:4 | f5:2 f5:2 e5:2 e5:2 d5:2 d5:2 c5:4' },
  { id: 'frere-jacques', instrument: 'recorder', kind: 'motif', volume: 0.8, title: 'Frère Jacques', by: 'traditional (France)', year: '18th century', category: 'children', tonic: 'C', grid: '8th',
    notes: 'c5:2 d5:2 e5:2 c5:2 | c5:2 d5:2 e5:2 c5:2 | e5:2 f5:2 g5:4 | e5:2 f5:2 g5:4 | g5 a5 g5 f5 e5:2 c5:2 | g5 a5 g5 f5 e5:2 c5:2 | c5:2 g4:2 c5:4 | c5:2 g4:2 c5:4' },
  { id: 'mary-had-a-little-lamb', instrument: 'xylophone', kind: 'motif', volume: 0.8, title: 'Mary Had a Little Lamb', by: 'Lowell Mason', year: '1830', category: 'children', tonic: 'C', grid: '8th',
    notes: 'e5:2 d5:2 c5:2 d5:2 | e5:2 e5:2 e5:4 | d5:2 d5:2 d5:4 | e5:2 g5:2 g5:4' },
  { id: 'london-bridge', instrument: 'glockenspiel', kind: 'motif', volume: 0.8, title: 'London Bridge Is Falling Down', by: 'traditional (England)', year: '18th century', category: 'children', tonic: 'C', grid: '8th',
    notes: 'g5:3 a5 g5:2 f5:2 | e5:2 f5:2 g5:4 | d5:2 e5:2 f5:4 | e5:2 f5:2 g5:4' },
  { id: 'row-your-boat', instrument: 'ocarina', kind: 'motif', volume: 0.8, title: 'Row, Row, Row Your Boat', by: 'traditional (America)', year: '1852', category: 'children', tonic: 'C', grid: '8th',
    notes: 'c5:3 c5:3 c5:2 d5 e5:3 | e5:2 d5 e5:2 f5 g5:6 | c6 c6 c6 g5 g5 g5 e5 e5 e5 c5 c5 c5 | g5:2 f5 e5:2 d5 c5:6' },
  { id: 'old-macdonald', instrument: 'harmonica', kind: 'motif', volume: 0.8, title: 'Old MacDonald Had a Farm', by: 'traditional (America)', year: '1917', category: 'children', tonic: 'C', grid: '8th',
    notes: 'c5:2 c5:2 c5:2 g4:2 a4:2 a4:2 g4:4 | e5:2 e5:2 d5:2 d5:2 c5:4' },
  { id: 'itsy-bitsy-spider', instrument: 'kalimba', kind: 'motif', volume: 0.8, title: 'The Itsy Bitsy Spider', by: 'traditional (America)', year: '1910', category: 'children', tonic: 'C', grid: '8th',
    notes: 'g4 c5:2 c5 c5:2 d5 | e5:3 e5:3 | e5 d5:2 c5 d5:2 | e5:3 c5:3' },
  { id: 'this-old-man', instrument: 'whistle', kind: 'motif', volume: 0.8, title: 'This Old Man', by: 'traditional (England)', year: '19th century', category: 'children', tonic: 'C', grid: '8th',
    notes: 'g5:2 e5:2 g5:4 | g5:2 e5:2 g5:4 | a5:2 g5:2 f5:2 e5:2 | d5:2 e5:2 f5:4' },
  { id: 'hot-cross-buns', instrument: 'recorder', kind: 'motif', volume: 0.8, title: 'Hot Cross Buns', by: 'traditional (England)', year: '1798', category: 'children', tonic: 'C', grid: '8th',
    notes: 'e5:2 d5:2 c5:4 | e5:2 d5:2 c5:4 | c5 c5 c5 c5 d5 d5 d5 d5 | e5:2 d5:2 c5:4' },
  { id: 'three-blind-mice', instrument: 'celesta', kind: 'motif', volume: 0.8, title: 'Three Blind Mice', by: 'traditional (England)', year: '1609', category: 'children', tonic: 'C', grid: '8th',
    notes: 'e5:2 d5:2 c5:4 | e5:2 d5:2 c5:4 | g5:2 f5 f5 e5:4 | g5:2 f5 f5 e5:4' },
  { id: 'baa-baa-black-sheep', instrument: 'marimba', kind: 'motif', volume: 0.8, title: 'Baa, Baa, Black Sheep', by: 'traditional (England)', year: '1744', category: 'children', tonic: 'C', grid: '8th',
    notes: 'c5:2 c5:2 g5:2 g5:2 a5 a5 a5 a5 g5:4 | f5:2 f5:2 e5:2 e5:2 d5:2 d5:2 c5:4' },
  { id: 'au-clair-de-la-lune', instrument: 'music_box', kind: 'motif', volume: 0.8, title: 'Au clair de la lune', by: 'traditional (France)', year: '18th century', category: 'children', tonic: 'C', grid: '8th',
    notes: 'c5:2 c5:2 c5:2 d5:2 e5:4 d5:4 | c5:2 e5:2 d5:2 d5:2 c5:8' },

  // ---------- Carols and hymns ----------
  { id: 'silent-night', instrument: 'acoustic_guitar_nylon', kind: 'motif', volume: 0.8, title: 'Silent Night', by: 'Franz Xaver Gruber', year: '1818', category: 'carols', tonic: 'C', grid: '8th',
    notes: 'g4:3 a4 g4:2 e4:6 | g4:3 a4 g4:2 e4:6 | d5:4 d5:2 b4:6 | c5:4 c5:2 g4:6' },
  { id: 'joy-to-the-world', instrument: 'tubular_bells', kind: 'motif', volume: 0.8, title: 'Joy to the World', by: 'Lowell Mason, after Handel', year: '1839', category: 'carols', tonic: 'C', grid: '8th',
    notes: 'c6:3 b5 a5:2 g5:3 f5 e5:2 d5:2 c5:3 | g5 a5:3 a5 b5:3 b5 c6:6' },
  { id: 'jingle-bells', instrument: 'glockenspiel', kind: 'motif', volume: 0.8, title: 'Jingle Bells', by: 'James Lord Pierpont', year: '1857', category: 'carols', tonic: 'C', grid: '8th',
    notes: 'e5:2 e5:2 e5:4 | e5:2 e5:2 e5:4 | e5:2 g5:2 c5:3 d5 | e5:8 | f5:2 f5:2 f5:3 f5 | f5:2 e5:2 e5:2 e5 e5 | e5:2 d5:2 d5:2 e5:2 | d5:4 g5:4' },
  { id: 'deck-the-halls', instrument: 'brass_section', kind: 'motif', volume: 0.8, title: 'Deck the Halls', by: 'traditional (Wales)', year: '16th century', category: 'carols', tonic: 'C', grid: '8th',
    notes: 'g5:3 f5 e5:2 d5:2 | c5:2 d5:2 e5:2 c5:2 | d5 e5 f5 d5 e5:3 d5 | c5:2 b4:2 c5:4' },
  { id: 'we-wish-you', instrument: 'choir_aahs', kind: 'motif', volume: 0.8, title: 'We Wish You a Merry Christmas', by: 'traditional (England)', year: '16th century', category: 'carols', tonic: 'F', grid: '8th',
    notes: 'c5 | f5:2 f5 g5 f5 e5 | d5:2 d5:2 d5:2 | g5:2 g5 a5 g5 f5 | e5:2 c5:2 c5:2 | a5:2 a5 bb5 a5 g5 | f5:2 d5:2 c5 c5 | d5:2 g5:2 e5:2 | f5:6' },
  { id: 'o-come-all-ye-faithful', instrument: 'church_organ', kind: 'motif', volume: 0.8, title: 'O Come, All Ye Faithful', by: 'John Francis Wade', year: '1751', category: 'carols', tonic: 'G', grid: '8th',
    notes: 'g4:4 g4:2 d4:4 g4:2 | a4:4 d4:4 | b4:2 a4:2 b4:2 c5:2 | b4:4 a4:2 g4:4' },
  { id: 'the-first-noel', instrument: 'orchestral_harp', kind: 'motif', volume: 0.8, title: 'The First Noel', by: 'traditional (England)', year: '1823', category: 'carols', tonic: 'C', grid: '8th',
    notes: 'e5 d5 | c5:2 d5:2 e5:2 f5:2 | g5:4 a5:2 b5:2 | c6:4 b5:2 a5:2 | g5:6' },
  { id: 'good-king-wenceslas', instrument: 'recorder', kind: 'motif', volume: 0.8, title: 'Good King Wenceslas', by: 'traditional (Finland, "Tempus adest floridum")', year: '1582', category: 'carols', tonic: 'C', grid: '8th',
    notes: 'c5:2 c5:2 c5:2 d5:2 | c5:2 c5:2 g4:4 | a4:2 g4:2 a4:2 b4:2 | c5:4 c5:4' },
  { id: 'god-rest-ye', instrument: 'cello', kind: 'motif', volume: 0.8, title: 'God Rest Ye Merry, Gentlemen', by: 'traditional (England)', year: '18th century', category: 'carols', tonic: 'E', grid: '8th',
    notes: 'e4:2 e4:2 b4:2 b4:2 | a4:2 g4:2 f#4:2 e4:2 | d4:2 e4:2 f#4:2 g4:2 | a4:2 b4:6' },
  { id: 'o-tannenbaum', instrument: 'accordion', kind: 'motif', volume: 0.8, title: 'O Tannenbaum', by: 'traditional (Germany)', year: '1824', category: 'carols', tonic: 'F', grid: '8th',
    notes: 'c5 | f5:3 f5 f5:4 g5:2 | a5:3 a5 a5:4 a5:2 | g5:2 a5:2 bb5:2 | e5:2 g5:2 f5:4' },
  { id: 'carol-of-the-bells', instrument: 'tubular_bells', kind: 'loop', volume: 0.8, title: 'Carol of the Bells (Shchedryk)', by: 'Mykola Leontovych', year: '1914', category: 'carols', tonic: 'A', grid: '8th',
    notes: 'e5:2 d5 e5 c5:2 | e5:2 d5 e5 c5:2 | e5:2 d5 e5 c5:2 | e5:2 d5 e5 c5:2' },

  // ---------- World ----------
  { id: 'sakura', instrument: 'koto', kind: 'motif', volume: 0.8, title: 'Sakura Sakura', by: 'traditional (Japan)', year: 'Edo period', category: 'world', tonic: 'A', grid: '8th',
    notes: 'a4:2 a4:2 b4:4 | a4:2 a4:2 b4:4 | a4:2 b4:2 c5:2 b4:2 | a4:2 b4 a4 f4:4 | e4:2 c4:2 e4:2 f4:2 | e4:2 e4 c4 b3:4' },
  { id: 'mo-li-hua', instrument: 'dulcimer', kind: 'motif', volume: 0.8, title: 'Mo Li Hua (Jasmine Flower)', by: 'traditional (China)', year: '18th century', category: 'world', tonic: 'C', grid: '8th',
    notes: 'e5 e5 g5:2 a5:2 c6 c6 a5:2 | g5:2 g5 a5 g5:4' },
  { id: 'korobeiniki', instrument: 'accordion', kind: 'motif', volume: 0.8, title: 'Korobeiniki', by: 'traditional (Russia)', year: '1861', category: 'world', tonic: 'A', grid: '8th',
    notes: 'e5:2 b4 c5 d5:2 c5 b4 | a4:2 a4 c5 e5:2 d5 c5 | b4:3 c5 d5:2 e5:2 | c5:2 a4:2 a4:4' },
  { id: 'la-cucaracha', instrument: 'trumpet', kind: 'motif', volume: 0.8, title: 'La Cucaracha', by: 'traditional (Mexico)', year: '19th century', category: 'world', tonic: 'F', grid: '8th',
    notes: 'c5 c5 c5 f5:3 a5:3 . | c5 c5 c5 f5:3 a5:3 . | f5:2 f5 e5:2 e5 d5:2 d5 c5:4' },
];

/** Transpose so the tune's tonic becomes C, choosing the shift within −6..+5 semitones to stay in register. */
export function presetMotifInC(p: Preset): Motif {
  const root = KEY_ROOTS[p.tonic] ?? 0;
  let shift = (12 - root) % 12;
  if (shift > 5) shift -= 12;
  return transpose(parseMotif(p.notes).motif, shift);
}

/** The notes a composer sees after choosing a preset: written in C, bar lines every 8 steps. */
export function presetNotesInC(p: Preset): string {
  return p.tonic === 'C' ? p.notes : motifToText(presetMotifInC(p));
}

/** What choosing a preset writes onto a sound. The id, label are kept unless the label is the default. */
export function applyPreset(s: Sound, p: Preset): Sound {
  return { ...s, label: s.label === 'New sound' || s.preset ? p.title : s.label, kind: p.kind, instrument: p.instrument, notes: presetNotesInC(p), volume: p.volume, degrees: undefined, preset: p.id };
}

/** Inverse of parseMotif: one token per note start, rests merged, a bar line every 8 steps. */
export function motifToText(motif: Motif): string {
  const starts = new Map(motif.notes.map((n) => [n.step, n]));
  const out: string[] = [];
  let step = 0;
  while (step < motif.length) {
    if (step > 0 && step % 8 === 0) out.push('|');
    const n = starts.get(step);
    if (n) { out.push(n.steps > 1 ? `${midiToNote(n.midi)}:${n.steps}` : midiToNote(n.midi)); step += n.steps; continue; }
    let rest = 1;
    while (step + rest < motif.length && !starts.has(step + rest) && (step + rest) % 8 !== 0) rest++;
    out.push(rest > 1 ? `.:${rest}` : '.');
    step += rest;
  }
  return out.join(' ');
}
