import type {
  JamBlindTrack,
  JamFormat,
  JamInstrumentId,
  JamMode,
  JamPlayer,
  JamState,
} from '../types/duoplay';

export type JamSongCategory =
  | 'Pop & Hits'
  | 'Raï / Oriental / Chaabi'
  | 'Films & Séries'
  | 'Classiques faciles';

export interface JamGuideNote {
  noteId: string;
  beatMs: number;
}

export interface JamCuratedSong {
  id: string;
  title: string;
  artist: string;
  category: JamSongCategory;
  aliases: string[];
  recommendedInstrument: JamInstrumentId;
  guideNotes: JamGuideNote[];
}

export const JAM_INSTRUMENT_ROUND_SEC = 45;
export const JAM_BLINDTEST_ROUND_SEC = 30;
export const JAM_BUZZER_PAUSE_SEC = 6;
export const JAM_AIRPLAY_COOLDOWN_MS = 160;

/**
 * 26 curated songs spanning Pop & Hits, Raï / Oriental / Chaabi, Films & Séries, and Easy Classics.
 * Every song includes playable note IDs for ✨ Partition Lumineuse & 🤖 Devine l'IA (Instrument).
 */
export const JAM_SONG_BANK: JamCuratedSong[] = [
  // --- Pop & Hits (7) ---
  {
    id: 'bella-ciao',
    title: 'Bella Ciao',
    artist: 'La Casa de Papel',
    category: 'Pop & Hits',
    aliases: ['casa de papel', 'o bella ciao'],
    recommendedInstrument: 'piano',
    guideNotes: [
      { noteId: 'E4', beatMs: 0 },
      { noteId: 'A4', beatMs: 280 },
      { noteId: 'B4', beatMs: 560 },
      { noteId: 'C5', beatMs: 840 },
      { noteId: 'A4', beatMs: 1120 },
      { noteId: 'E4', beatMs: 1700 },
      { noteId: 'A4', beatMs: 1980 },
      { noteId: 'B4', beatMs: 2260 },
      { noteId: 'C5', beatMs: 2540 },
      { noteId: 'A4', beatMs: 2820 },
      { noteId: 'E4', beatMs: 3400 },
      { noteId: 'A4', beatMs: 3680 },
      { noteId: 'B4', beatMs: 3960 },
      { noteId: 'C5', beatMs: 4240 },
      { noteId: 'B4', beatMs: 4720 },
      { noteId: 'A4', beatMs: 5000 },
    ],
  },
  {
    id: 'happy-birthday',
    title: 'Happy Birthday',
    artist: 'Joyeux Anniversaire',
    category: 'Pop & Hits',
    aliases: ['joyeux anniversaire', 'bon anniversaire'],
    recommendedInstrument: 'piano',
    guideNotes: [
      { noteId: 'C4', beatMs: 0 },
      { noteId: 'C4', beatMs: 300 },
      { noteId: 'D4', beatMs: 580 },
      { noteId: 'C4', beatMs: 1020 },
      { noteId: 'F4', beatMs: 1460 },
      { noteId: 'E4', beatMs: 1920 },
      { noteId: 'C4', beatMs: 2650 },
      { noteId: 'C4', beatMs: 2950 },
      { noteId: 'D4', beatMs: 3240 },
      { noteId: 'C4', beatMs: 3680 },
      { noteId: 'G4', beatMs: 4120 },
      { noteId: 'F4', beatMs: 4580 },
    ],
  },
  {
    id: 'we-will-rock-you',
    title: 'We Will Rock You',
    artist: 'Queen',
    category: 'Pop & Hits',
    aliases: ['queen', 'rock you'],
    recommendedInstrument: 'darbouka',
    guideNotes: [
      { noteId: 'doum', beatMs: 0 },
      { noteId: 'doum', beatMs: 320 },
      { noteId: 'slap', beatMs: 660 },
      { noteId: 'doum', beatMs: 1320 },
      { noteId: 'doum', beatMs: 1640 },
      { noteId: 'slap', beatMs: 1980 },
      { noteId: 'doum', beatMs: 2640 },
      { noteId: 'doum', beatMs: 2960 },
      { noteId: 'slap', beatMs: 3300 },
      { noteId: 'doum', beatMs: 3960 },
      { noteId: 'doum', beatMs: 4280 },
      { noteId: 'slap', beatMs: 4620 },
    ],
  },
  {
    id: 'seven-nation-army',
    title: 'Seven Nation Army',
    artist: 'The White Stripes',
    category: 'Pop & Hits',
    aliases: ['white stripes', 'po po po', 'foot'],
    recommendedInstrument: 'piano',
    guideNotes: [
      { noteId: 'E4', beatMs: 0 },
      { noteId: 'E4', beatMs: 520 },
      { noteId: 'G4', beatMs: 780 },
      { noteId: 'E4', beatMs: 1120 },
      { noteId: 'D4', beatMs: 1460 },
      { noteId: 'C4', beatMs: 1800 },
      { noteId: 'D4', beatMs: 2450 },
      { noteId: 'E4', beatMs: 3000 },
      { noteId: 'E4', beatMs: 3520 },
      { noteId: 'G4', beatMs: 3780 },
      { noteId: 'E4', beatMs: 4120 },
      { noteId: 'D4', beatMs: 4460 },
      { noteId: 'C4', beatMs: 4800 },
    ],
  },
  {
    id: 'despacito',
    title: 'Despacito',
    artist: 'Luis Fonsi',
    category: 'Pop & Hits',
    aliases: ['fonsi', 'daddy yankee'],
    recommendedInstrument: 'guitar',
    guideNotes: [
      { noteId: 'chord_Am', beatMs: 0 },
      { noteId: 'chord_Am', beatMs: 620 },
      { noteId: 'chord_F', beatMs: 1240 },
      { noteId: 'chord_F', beatMs: 1860 },
      { noteId: 'chord_C', beatMs: 2480 },
      { noteId: 'chord_C', beatMs: 3100 },
      { noteId: 'chord_G', beatMs: 3720 },
      { noteId: 'chord_G', beatMs: 4340 },
    ],
  },
  {
    id: 'shape-of-you',
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    category: 'Pop & Hits',
    aliases: ['ed sheeran', 'sheeran'],
    recommendedInstrument: 'piano',
    guideNotes: [
      { noteId: 'D4', beatMs: 0 },
      { noteId: 'F4', beatMs: 320 },
      { noteId: 'D4', beatMs: 640 },
      { noteId: 'D4', beatMs: 960 },
      { noteId: 'F4', beatMs: 1280 },
      { noteId: 'D4', beatMs: 1600 },
      { noteId: 'E4', beatMs: 1920 },
      { noteId: 'G4', beatMs: 2240 },
      { noteId: 'E4', beatMs: 2560 },
      { noteId: 'C4', beatMs: 2880 },
      { noteId: 'E4', beatMs: 3200 },
      { noteId: 'D4', beatMs: 3520 },
    ],
  },
  {
    id: 'billie-jean',
    title: 'Billie Jean',
    artist: 'Michael Jackson',
    category: 'Pop & Hits',
    aliases: ['michael jackson', 'mj'],
    recommendedInstrument: 'darbouka',
    guideNotes: [
      { noteId: 'doum', beatMs: 0 },
      { noteId: 'ka', beatMs: 250 },
      { noteId: 'slap', beatMs: 500 },
      { noteId: 'ka', beatMs: 750 },
      { noteId: 'doum', beatMs: 1000 },
      { noteId: 'ka', beatMs: 1250 },
      { noteId: 'slap', beatMs: 1500 },
      { noteId: 'ka', beatMs: 1750 },
      { noteId: 'doum', beatMs: 2000 },
      { noteId: 'tek', beatMs: 2250 },
      { noteId: 'slap', beatMs: 2500 },
      { noteId: 'ka', beatMs: 2750 },
    ],
  },

  // --- Raï / Oriental / Chaabi (7) ---
  {
    id: 'rythme-chaabi',
    title: 'Rythme Chaabi',
    artist: 'Classique Marocain',
    category: 'Raï / Oriental / Chaabi',
    aliases: ['chaabi', 'chaabi marocain', 'maroc'],
    recommendedInstrument: 'darbouka',
    guideNotes: [
      { noteId: 'doum', beatMs: 0 },
      { noteId: 'tek', beatMs: 210 },
      { noteId: 'ka', beatMs: 420 },
      { noteId: 'doum', beatMs: 630 },
      { noteId: 'tek', beatMs: 840 },
      { noteId: 'slap', beatMs: 1050 },
      { noteId: 'doum', beatMs: 1260 },
      { noteId: 'tek', beatMs: 1470 },
      { noteId: 'ka', beatMs: 1680 },
      { noteId: 'doum', beatMs: 1890 },
      { noteId: 'slap', beatMs: 2100 },
      { noteId: 'tek', beatMs: 2310 },
    ],
  },
  {
    id: 'didi-khaled',
    title: 'Didi',
    artist: 'Cheb Khaled',
    category: 'Raï / Oriental / Chaabi',
    aliases: ['khaled', 'cheb khaled'],
    recommendedInstrument: 'oud',
    guideNotes: [
      { noteId: 'oud_D4', beatMs: 0 },
      { noteId: 'oud_Fs4', beatMs: 260 },
      { noteId: 'oud_G4', beatMs: 520 },
      { noteId: 'oud_A4', beatMs: 780 },
      { noteId: 'oud_G4', beatMs: 1040 },
      { noteId: 'oud_Fs4', beatMs: 1300 },
      { noteId: 'oud_Eb4', beatMs: 1560 },
      { noteId: 'oud_D4', beatMs: 1820 },
      { noteId: 'oud_D4', beatMs: 2240 },
      { noteId: 'oud_Fs4', beatMs: 2500 },
      { noteId: 'oud_A4', beatMs: 2760 },
      { noteId: 'oud_G4', beatMs: 3020 },
    ],
  },
  {
    id: 'aicha-khaled',
    title: 'Aïcha',
    artist: 'Cheb Khaled',
    category: 'Raï / Oriental / Chaabi',
    aliases: ['aicha', 'khaled'],
    recommendedInstrument: 'oud',
    guideNotes: [
      { noteId: 'oud_A4', beatMs: 0 },
      { noteId: 'oud_Bb4', beatMs: 320 },
      { noteId: 'oud_A4', beatMs: 640 },
      { noteId: 'oud_G4', beatMs: 960 },
      { noteId: 'oud_Fs4', beatMs: 1280 },
      { noteId: 'oud_G4', beatMs: 1600 },
      { noteId: 'oud_A4', beatMs: 1920 },
      { noteId: 'oud_G4', beatMs: 2360 },
      { noteId: 'oud_Fs4', beatMs: 2680 },
      { noteId: 'oud_Eb4', beatMs: 3000 },
      { noteId: 'oud_D4', beatMs: 3320 },
    ],
  },
  {
    id: 'abdel-kader',
    title: 'Abdel Kader',
    artist: '1, 2, 3 Soleils',
    category: 'Raï / Oriental / Chaabi',
    aliases: ['khaled rachid taha faudel', 'ya boualem', 'abdelkader'],
    recommendedInstrument: 'oud',
    guideNotes: [
      { noteId: 'oud_D4', beatMs: 0 },
      { noteId: 'oud_Eb4', beatMs: 280 },
      { noteId: 'oud_Fs4', beatMs: 560 },
      { noteId: 'oud_G4', beatMs: 840 },
      { noteId: 'oud_Fs4', beatMs: 1120 },
      { noteId: 'oud_Eb4', beatMs: 1400 },
      { noteId: 'oud_D4', beatMs: 1680 },
      { noteId: 'oud_A4', beatMs: 2140 },
      { noteId: 'oud_G4', beatMs: 2420 },
      { noteId: 'oud_Fs4', beatMs: 2700 },
      { noteId: 'oud_D4', beatMs: 2980 },
    ],
  },
  {
    id: 'ya-rayah',
    title: 'Ya Rayah',
    artist: 'Rachid Taha',
    category: 'Raï / Oriental / Chaabi',
    aliases: ['dahmane el harrachi', 'rachid taha', 'yarayah'],
    recommendedInstrument: 'oud',
    guideNotes: [
      { noteId: 'oud_D5', beatMs: 0 },
      { noteId: 'oud_C5', beatMs: 300 },
      { noteId: 'oud_Bb4', beatMs: 600 },
      { noteId: 'oud_A4', beatMs: 900 },
      { noteId: 'oud_G4', beatMs: 1200 },
      { noteId: 'oud_A4', beatMs: 1500 },
      { noteId: 'oud_Bb4', beatMs: 1800 },
      { noteId: 'oud_A4', beatMs: 2220 },
      { noteId: 'oud_G4', beatMs: 2520 },
      { noteId: 'oud_Fs4', beatMs: 2820 },
      { noteId: 'oud_D4', beatMs: 3120 },
    ],
  },
  {
    id: 'reggaeton',
    title: 'Reggaeton',
    artist: 'Rythme Dembow',
    category: 'Raï / Oriental / Chaabi',
    aliases: ['dembow', 'rythme reggaeton', 'latino'],
    recommendedInstrument: 'darbouka',
    guideNotes: [
      { noteId: 'doum', beatMs: 0 },
      { noteId: 'tek', beatMs: 360 },
      { noteId: 'doum', beatMs: 540 },
      { noteId: 'slap', beatMs: 780 },
      { noteId: 'doum', beatMs: 1080 },
      { noteId: 'tek', beatMs: 1440 },
      { noteId: 'doum', beatMs: 1620 },
      { noteId: 'slap', beatMs: 1860 },
      { noteId: 'doum', beatMs: 2160 },
      { noteId: 'tek', beatMs: 2520 },
      { noteId: 'doum', beatMs: 2700 },
      { noteId: 'slap', beatMs: 2940 },
    ],
  },
  {
    id: 'habibi-ya-nour',
    title: 'Nour El Ain',
    artist: 'Amr Diab',
    category: 'Raï / Oriental / Chaabi',
    aliases: ['habibi ya nour el ein', 'amr diab', 'habibi'],
    recommendedInstrument: 'oud',
    guideNotes: [
      { noteId: 'oud_A4', beatMs: 0 },
      { noteId: 'oud_G4', beatMs: 260 },
      { noteId: 'oud_Fs4', beatMs: 520 },
      { noteId: 'oud_G4', beatMs: 780 },
      { noteId: 'oud_A4', beatMs: 1040 },
      { noteId: 'oud_Bb4', beatMs: 1300 },
      { noteId: 'oud_A4', beatMs: 1680 },
      { noteId: 'oud_G4', beatMs: 1940 },
      { noteId: 'oud_Fs4', beatMs: 2200 },
      { noteId: 'oud_Eb4', beatMs: 2460 },
      { noteId: 'oud_D4', beatMs: 2720 },
    ],
  },

  // --- Films & Séries (6) ---
  {
    id: 'titanic',
    title: 'Titanic',
    artist: 'Céline Dion (My Heart Will Go On)',
    category: 'Films & Séries',
    aliases: ['my heart will go on', 'celine dion'],
    recommendedInstrument: 'piano',
    guideNotes: [
      { noteId: 'F4', beatMs: 0 },
      { noteId: 'F4', beatMs: 420 },
      { noteId: 'F4', beatMs: 740 },
      { noteId: 'F4', beatMs: 1080 },
      { noteId: 'E4', beatMs: 1420 },
      { noteId: 'F4', beatMs: 1760 },
      { noteId: 'F4', beatMs: 2240 },
      { noteId: 'E4', beatMs: 2580 },
      { noteId: 'F4', beatMs: 2920 },
      { noteId: 'G4', beatMs: 3320 },
      { noteId: 'A4', beatMs: 3740 },
      { noteId: 'G4', beatMs: 4180 },
    ],
  },
  {
    id: 'pink-panther',
    title: 'Pink Panther',
    artist: 'La Panthère Rose',
    category: 'Films & Séries',
    aliases: ['panthere rose', 'la panthere rose', 'henry mancini'],
    recommendedInstrument: 'piano',
    guideNotes: [
      { noteId: 'D4', beatMs: 0 },
      { noteId: 'E4', beatMs: 240 },
      { noteId: 'F4', beatMs: 680 },
      { noteId: 'G4', beatMs: 920 },
      { noteId: 'D4', beatMs: 1480 },
      { noteId: 'E4', beatMs: 1720 },
      { noteId: 'F4', beatMs: 2040 },
      { noteId: 'G4', beatMs: 2280 },
      { noteId: 'C5', beatMs: 2620 },
      { noteId: 'B4', beatMs: 2880 },
      { noteId: 'E4', beatMs: 3200 },
      { noteId: 'G4', beatMs: 3480 },
      { noteId: 'B4', beatMs: 3760 },
      { noteId: 'Bb4', beatMs: 4060 },
    ],
  },
  {
    id: 'star-wars',
    title: 'Star Wars',
    artist: 'Marche Impériale',
    category: 'Films & Séries',
    aliases: ['marche imperiale', 'dark vador', 'darth vader', 'imperial march'],
    recommendedInstrument: 'piano',
    guideNotes: [
      { noteId: 'G4', beatMs: 0 },
      { noteId: 'G4', beatMs: 480 },
      { noteId: 'G4', beatMs: 960 },
      { noteId: 'E4', beatMs: 1440 },
      { noteId: 'Bb4', beatMs: 1780 },
      { noteId: 'G4', beatMs: 2040 },
      { noteId: 'E4', beatMs: 2520 },
      { noteId: 'Bb4', beatMs: 2860 },
      { noteId: 'G4', beatMs: 3120 },
    ],
  },
  {
    id: 'harry-potter',
    title: 'Harry Potter',
    artist: "Hedwig's Theme",
    category: 'Films & Séries',
    aliases: ['hedwig', 'poudlard', 'john williams'],
    recommendedInstrument: 'piano',
    guideNotes: [
      { noteId: 'E4', beatMs: 0 },
      { noteId: 'A4', beatMs: 340 },
      { noteId: 'C5', beatMs: 820 },
      { noteId: 'B4', beatMs: 1060 },
      { noteId: 'A4', beatMs: 1380 },
      { noteId: 'E4', beatMs: 2040 },
      { noteId: 'B4', beatMs: 2440 },
      { noteId: 'A4', beatMs: 3000 },
      { noteId: 'Gs4', beatMs: 3560 },
    ],
  },
  {
    id: 'pirates-caraibes',
    title: 'Pirates des Caraïbes',
    artist: 'Hans Zimmer',
    category: 'Films & Séries',
    aliases: ['jack sparrow', 'pirates of the caribbean', 'hans zimmer'],
    recommendedInstrument: 'guitar',
    guideNotes: [
      { noteId: 'chord_Dm', beatMs: 0 },
      { noteId: 'chord_Dm', beatMs: 420 },
      { noteId: 'chord_F', beatMs: 840 },
      { noteId: 'chord_C', beatMs: 1260 },
      { noteId: 'chord_Dm', beatMs: 1680 },
      { noteId: 'chord_Am', beatMs: 2100 },
      { noteId: 'chord_Dm', beatMs: 2520 },
    ],
  },
  {
    id: 'mario-bros',
    title: 'Super Mario Bros',
    artist: 'Thème Nintendo',
    category: 'Films & Séries',
    aliases: ['mario', 'super mario', 'nintendo'],
    recommendedInstrument: 'piano',
    guideNotes: [
      { noteId: 'E4', beatMs: 0 },
      { noteId: 'E4', beatMs: 220 },
      { noteId: 'E4', beatMs: 560 },
      { noteId: 'C4', beatMs: 880 },
      { noteId: 'E4', beatMs: 1120 },
      { noteId: 'G4', beatMs: 1480 },
      { noteId: 'C4', beatMs: 2200 },
      { noteId: 'G4', beatMs: 2560 },
      { noteId: 'E4', beatMs: 2920 },
    ],
  },

  // --- Classiques faciles (6) ---
  {
    id: 'frere-jacques',
    title: 'Frère Jacques',
    artist: 'Comptine Classique',
    category: 'Classiques faciles',
    aliases: ['dormez vous', 'frere jacques'],
    recommendedInstrument: 'piano',
    guideNotes: [
      { noteId: 'C4', beatMs: 0 },
      { noteId: 'D4', beatMs: 360 },
      { noteId: 'E4', beatMs: 720 },
      { noteId: 'C4', beatMs: 1080 },
      { noteId: 'C4', beatMs: 1480 },
      { noteId: 'D4', beatMs: 1840 },
      { noteId: 'E4', beatMs: 2200 },
      { noteId: 'C4', beatMs: 2560 },
      { noteId: 'E4', beatMs: 2960 },
      { noteId: 'F4', beatMs: 3320 },
      { noteId: 'G4', beatMs: 3680 },
    ],
  },
  {
    id: 'au-clair-de-la-lune',
    title: 'Au Clair de la Lune',
    artist: 'Chanson Traditionnelle',
    category: 'Classiques faciles',
    aliases: ['clair de la lune', 'mon ami pierrot'],
    recommendedInstrument: 'piano',
    guideNotes: [
      { noteId: 'C4', beatMs: 0 },
      { noteId: 'C4', beatMs: 340 },
      { noteId: 'C4', beatMs: 680 },
      { noteId: 'D4', beatMs: 1020 },
      { noteId: 'E4', beatMs: 1420 },
      { noteId: 'D4', beatMs: 1960 },
      { noteId: 'C4', beatMs: 2480 },
      { noteId: 'E4', beatMs: 2820 },
      { noteId: 'D4', beatMs: 3160 },
      { noteId: 'D4', beatMs: 3500 },
      { noteId: 'C4', beatMs: 3860 },
    ],
  },
  {
    id: 'twinkle-star',
    title: 'Ah ! Vous dirai-je Maman',
    artist: 'Twinkle Twinkle Little Star',
    category: 'Classiques faciles',
    aliases: ['twinkle twinkle', 'little star', 'brille brille petite etoile', 'maman'],
    recommendedInstrument: 'piano',
    guideNotes: [
      { noteId: 'C4', beatMs: 0 },
      { noteId: 'C4', beatMs: 340 },
      { noteId: 'G4', beatMs: 680 },
      { noteId: 'G4', beatMs: 1020 },
      { noteId: 'A4', beatMs: 1360 },
      { noteId: 'A4', beatMs: 1700 },
      { noteId: 'G4', beatMs: 2040 },
      { noteId: 'F4', beatMs: 2640 },
      { noteId: 'F4', beatMs: 2980 },
      { noteId: 'E4', beatMs: 3320 },
      { noteId: 'E4', beatMs: 3660 },
      { noteId: 'D4', beatMs: 4000 },
      { noteId: 'D4', beatMs: 4340 },
      { noteId: 'C4', beatMs: 4680 },
    ],
  },
  {
    id: 'ode-a-la-joie',
    title: 'Ode à la Joie',
    artist: 'Beethoven',
    category: 'Classiques faciles',
    aliases: ['beethoven', 'hymne a la joie', '9e symphonie'],
    recommendedInstrument: 'piano',
    guideNotes: [
      { noteId: 'E4', beatMs: 0 },
      { noteId: 'E4', beatMs: 340 },
      { noteId: 'F4', beatMs: 680 },
      { noteId: 'G4', beatMs: 1020 },
      { noteId: 'G4', beatMs: 1360 },
      { noteId: 'F4', beatMs: 1700 },
      { noteId: 'E4', beatMs: 2040 },
      { noteId: 'D4', beatMs: 2380 },
      { noteId: 'C4', beatMs: 2720 },
      { noteId: 'C4', beatMs: 3060 },
      { noteId: 'D4', beatMs: 3400 },
      { noteId: 'E4', beatMs: 3740 },
      { noteId: 'E4', beatMs: 4100 },
      { noteId: 'D4', beatMs: 4520 },
      { noteId: 'D4', beatMs: 4820 },
    ],
  },
  {
    id: 'lettre-a-elise',
    title: 'La Lettre à Élise',
    artist: 'Beethoven',
    category: 'Classiques faciles',
    aliases: ['fur elise', 'pour elise', 'lettre a elise', 'elise'],
    recommendedInstrument: 'piano',
    guideNotes: [
      { noteId: 'C5', beatMs: 0 },
      { noteId: 'B4', beatMs: 240 },
      { noteId: 'C5', beatMs: 480 },
      { noteId: 'B4', beatMs: 720 },
      { noteId: 'C5', beatMs: 960 },
      { noteId: 'G4', beatMs: 1200 },
      { noteId: 'Bb4', beatMs: 1440 },
      { noteId: 'A4', beatMs: 1680 },
      { noteId: 'F4', beatMs: 1960 },
    ],
  },
  {
    id: 'zombie-cranberries',
    title: 'Zombie',
    artist: 'The Cranberries',
    category: 'Classiques faciles',
    aliases: ['cranberries'],
    recommendedInstrument: 'guitar',
    guideNotes: [
      { noteId: 'chord_Em', beatMs: 0 },
      { noteId: 'chord_Em', beatMs: 550 },
      { noteId: 'chord_C', beatMs: 1100 },
      { noteId: 'chord_C', beatMs: 1650 },
      { noteId: 'chord_G', beatMs: 2200 },
      { noteId: 'chord_G', beatMs: 2750 },
      { noteId: 'chord_Dm', beatMs: 3300 },
      { noteId: 'chord_Dm', beatMs: 3850 },
    ],
  },
];

/**
 * 20 popular diverse artists for Solo Blind Test (Pop, Rap, Raï/Oriental, Classics).
 */
export const SOLO_BLINDTEST_ARTISTS: string[] = [
  'Stromae',
  'Aya Nakamura',
  'Dua Lipa',
  'The Weeknd',
  'Indila',
  'Gims',
  'Ninho',
  'Jul',
  'Cheb Khaled',
  'Soolking',
  'Saad Lamjarred',
  'ElGrandeToto',
  'Daft Punk',
  'Coldplay',
  'Billie Eilish',
  'Shakira',
  'Bruno Mars',
  'Adele',
  'Celine Dion',
  'Queen',
];

/**
 * 12 Musical Dares for missed rounds & final match loser.
 */
export const JAM_MUSICAL_DARES: string[] = [
  'Chante 5 secondes du refrain face caméra avec toute ton âme !',
  'Fais un play-back dramatique ultra-expressif sur la fin de l’extrait !',
  'Danse 5 secondes sur un solo de darbouka improvisé par ton partenaire !',
  'Imite un solo de guitare rock (air guitar) pendant 6 secondes sans rire !',
  'Fredonne la mélodie de votre chanson préférée en regardant la caméra !',
  'Déclare une phrase romantique en chantant façon opéra !',
  'Fais un beatbox de 5 secondes pour lancer la prochaine manche !',
  'Envoie un baiser de star à la caméra comme à la fin d’un concert au Stade de France !',
  'Chante « Joyeux Anniversaire » version slow ultra-romantique pendant 6 secondes !',
  'Fais une chorégraphie de mains synchronisée sur 4 temps face caméra !',
  'Prends ta meilleure pose de pochette d’album pendant 5 secondes sans cligner des yeux !',
  'Dédicace la prochaine chanson à ton partenaire avec une voix de présentateur radio !',
];

/**
 * Normalize musical answers: strip accents, lowercase, remove "(feat. ...)", "[Remix]", punctuation & leading articles.
 */
export function normalizeMusicalText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\((?:feat|ft|featuring|with|remix|radio edit|official|audio|video|live|remaster|version)[^)]*\)/gi, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/['’`\-_.,!?;:/\\&+"]/g, ' ')
    .replace(/\b(?:feat|ft|featuring)\b.*$/i, ' ')
    .replace(/\b(?:le|la|les|l|the|a|an|un|une|des)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }
  return prev[b.length];
}

function isFuzzyTargetMatch(normGuess: string, rawTarget: string): boolean {
  const normTarget = normalizeMusicalText(rawTarget);
  if (!normGuess || !normTarget || normGuess.length < 2) return false;
  if (normGuess === normTarget) return true;

  // Substring check when guess is substantial enough (at least 4 chars or >= 60% of target)
  if (normGuess.length >= 4 && (normTarget.includes(normGuess) || normGuess.includes(normTarget))) {
    const ratio = Math.min(normGuess.length, normTarget.length) / Math.max(normGuess.length, normTarget.length);
    if (ratio >= 0.55 || normGuess.length >= 5) return true;
  }

  // Levenshtein tolerance for typos
  const maxLen = Math.max(normGuess.length, normTarget.length);
  const dist = levenshteinDistance(normGuess, normTarget);
  const allowedDist = maxLen <= 4 ? 1 : maxLen <= 9 ? 2 : Math.floor(maxLen * 0.25);
  if (dist <= allowedDist) return true;

  // Token-level overlap for multi-word titles
  const targetTokens = normTarget.split(' ').filter((w) => w.length >= 3);
  const guessTokens = normGuess.split(' ').filter((w) => w.length >= 3);
  if (targetTokens.length > 0 && guessTokens.length > 0) {
    let matched = 0;
    for (const gt of guessTokens) {
      if (targetTokens.some((tt) => tt === gt || (Math.max(tt.length, gt.length) >= 4 && levenshteinDistance(tt, gt) <= 1))) {
        matched += 1;
      }
    }
    if (matched >= Math.ceil(targetTokens.length * 0.65) && matched >= 1) {
      return true;
    }
  }

  return false;
}

/**
 * Smart case/accent/typo-tolerant matcher for both Mode 1 (Instrument) and Mode 2 (Blind Test).
 * In Blind Test, matching either Track Title OR Artist Name validates the answer.
 */
export function matchMusicalAnswer(
  guess: string,
  targetTitle: string,
  targetArtist = '',
  aliases: string[] = [],
  acceptArtist = true,
): boolean {
  const normGuess = normalizeMusicalText(guess);
  if (normGuess.length < 2) return false;

  if (isFuzzyTargetMatch(normGuess, targetTitle)) return true;
  if (acceptArtist && targetArtist && isFuzzyTargetMatch(normGuess, targetArtist)) return true;
  if (acceptArtist && targetArtist && isFuzzyTargetMatch(normGuess, `${targetTitle} ${targetArtist}`)) {
    return true;
  }
  for (const alias of aliases) {
    if (isFuzzyTargetMatch(normGuess, alias)) return true;
  }
  return false;
}

/**
 * Compute points awarded based on speed and hints used:
 * - Blind Test: < 10s elapsed => +3 pts (⚡ Éclair), < 20s => +2 pts, else +1 pt
 * - Instrument: < 20s elapsed => +3 pts (⚡ Éclair), < 35s => +2 pts, else +1 pt
 * - Each hint deducts 0.5 pt (minimum 0.5 pt on a valid guess)
 */
export function computeJamPoints(
  mode: 'guess-instrument' | 'blind-test',
  elapsedSec: number,
  hintsUsed: number,
): { points: number; fastBonus: boolean } {
  const fastThreshold = mode === 'blind-test' ? 10 : 20;
  const midThreshold = mode === 'blind-test' ? 20 : 35;

  let base = 1;
  let fastBonus = false;
  if (elapsedSec < fastThreshold) {
    base = 3;
    fastBonus = true;
  } else if (elapsedSec < midThreshold) {
    base = 2;
  }

  const deduction = Math.max(0, hintsUsed) * 0.5;
  const points = Math.max(0.5, Number((base - deduction).toFixed(1)));
  return { points, fastBonus };
}

/**
 * Format first-letter hint from a title or artist (e.g. "Bella Ciao" -> "B____ C___").
 */
export function buildInitialsHint(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  return words
    .map((w) => {
      const first = w[0] ?? '';
      const rest = Math.max(1, Math.min(5, w.length - 1));
      return `${first.toUpperCase()}${'•'.repeat(rest)}`;
    })
    .join(' ');
}

export function pickRandomSong(excludeId?: string | null): JamCuratedSong {
  const pool = excludeId ? JAM_SONG_BANK.filter((s) => s.id !== excludeId) : JAM_SONG_BANK;
  const list = pool.length > 0 ? pool : JAM_SONG_BANK;
  return list[Math.floor(Math.random() * list.length)];
}

export function pickRandomMusicalDare(seedOffset = 0): string {
  const idx = (Math.floor(Math.random() * JAM_MUSICAL_DARES.length) + seedOffset) % JAM_MUSICAL_DARES.length;
  return JAM_MUSICAL_DARES[idx];
}

export function getOppositePlayer(p: JamPlayer): JamPlayer {
  return p === 'host' ? 'guest' : 'host';
}

export function createInitialJamState(
  mode: JamMode = 'guess-instrument',
  totalRounds: JamFormat = 5,
): JamState {
  return {
    phase: 'LOBBY',
    mode,
    totalRounds,
    round: 1,
    performer: 'host',
    scores: { host: 0, guest: 0 },
    instruments: { host: 'darbouka', guest: 'oud' },
    secretSongId: null,
    secretTitle: '',
    secretArtist: '',
    secretCategory: '',
    antiCheatMute: true,
    blindTrack: null,
    roundDurationSec: mode === 'blind-test' ? JAM_BLINDTEST_ROUND_SEC : JAM_INSTRUMENT_ROUND_SEC,
    timeLeftSec: mode === 'blind-test' ? JAM_BLINDTEST_ROUND_SEC : JAM_INSTRUMENT_ROUND_SEC,
    isPaused: false,
    buzzerLeftSec: 0,
    buzzerBy: null,
    hintCategoryUsed: false,
    hintArtistUsed: false,
    hintUnblurUsed: false,
    hintsCount: 0,
    lastWrongGuess: null,
    outcome: null,
    soloAiPerformer: false,
    finalDareText: JAM_MUSICAL_DARES[0],
    stateSeq: 1,
  };
}

export function startJamMatch(
  mode: JamMode,
  totalRounds: JamFormat,
  soloAiPerformer = false,
): JamState {
  const base = createInitialJamState(mode, totalRounds);
  if (mode === 'concert-duo') {
    return {
      ...base,
      phase: 'PLAYING',
      soloAiPerformer: false,
      stateSeq: base.stateSeq + 1,
    };
  }
  return {
    ...base,
    phase: 'PREP',
    performer: soloAiPerformer ? 'guest' : 'host',
    soloAiPerformer,
    roundDurationSec: mode === 'blind-test' ? JAM_BLINDTEST_ROUND_SEC : JAM_INSTRUMENT_ROUND_SEC,
    timeLeftSec: mode === 'blind-test' ? JAM_BLINDTEST_ROUND_SEC : JAM_INSTRUMENT_ROUND_SEC,
    stateSeq: base.stateSeq + 1,
  };
}

export function launchInstrumentRound(
  state: JamState,
  opts: {
    songId: string | null;
    title: string;
    artist: string;
    category: string;
    instrument: JamInstrumentId;
    antiCheatMute: boolean;
  },
): JamState {
  return {
    ...state,
    phase: 'PLAYING',
    secretSongId: opts.songId,
    secretTitle: opts.title.trim(),
    secretArtist: opts.artist.trim(),
    secretCategory: opts.category.trim() || 'Libre',
    antiCheatMute: opts.antiCheatMute,
    instruments: {
      ...state.instruments,
      [state.performer]: opts.instrument,
    },
    roundDurationSec: JAM_INSTRUMENT_ROUND_SEC,
    timeLeftSec: JAM_INSTRUMENT_ROUND_SEC,
    isPaused: false,
    buzzerLeftSec: 0,
    buzzerBy: null,
    hintCategoryUsed: false,
    hintArtistUsed: false,
    hintUnblurUsed: false,
    hintsCount: 0,
    lastWrongGuess: null,
    outcome: null,
    stateSeq: state.stateSeq + 1,
  };
}

export function launchBlindTestRound(state: JamState, track: JamBlindTrack): JamState {
  const duration = Math.max(10, Math.min(45, track.duration || JAM_BLINDTEST_ROUND_SEC));
  return {
    ...state,
    phase: 'PLAYING',
    blindTrack: { ...track, duration },
    secretSongId: null,
    secretTitle: track.trackName.trim(),
    secretArtist: track.artistName.trim(),
    secretCategory: track.source === 'itunes' ? 'iTunes' : 'Libre',
    roundDurationSec: duration,
    timeLeftSec: duration,
    isPaused: false,
    buzzerLeftSec: 0,
    buzzerBy: null,
    hintCategoryUsed: false,
    hintArtistUsed: false,
    hintUnblurUsed: false,
    hintsCount: 0,
    lastWrongGuess: null,
    outcome: null,
    stateSeq: state.stateSeq + 1,
  };
}

export function triggerJamBuzzer(state: JamState, by: JamPlayer): JamState {
  if (state.phase !== 'PLAYING' || state.mode !== 'blind-test') return state;
  return {
    ...state,
    phase: 'BUZZER',
    isPaused: true,
    buzzerBy: by,
    buzzerLeftSec: JAM_BUZZER_PAUSE_SEC,
    stateSeq: state.stateSeq + 1,
  };
}

export function resolveJamRound(
  state: JamState,
  guessed: boolean,
  answerText?: string,
  dareOverride?: string,
): JamState {
  if (state.mode === 'concert-duo' || state.phase === 'REVEAL' || state.phase === 'MATCH_OVER') {
    return state;
  }
  const guesser = getOppositePlayer(state.performer);
  const elapsedSec = Math.max(0, state.roundDurationSec - state.timeLeftSec);
  const scoringMode = state.mode === 'blind-test' ? 'blind-test' : 'guess-instrument';

  const { points, fastBonus } = guessed
    ? computeJamPoints(scoringMode, elapsedSec, state.hintsCount)
    : { points: 0, fastBonus: false };

  const nextScores: Record<JamPlayer, number> = {
    ...state.scores,
    [guesser]: Number((state.scores[guesser] + points).toFixed(1)),
  };

  return {
    ...state,
    phase: 'REVEAL',
    isPaused: false,
    buzzerLeftSec: 0,
    scores: nextScores,
    outcome: {
      guessed,
      winner: guessed ? guesser : null,
      pointsAwarded: points,
      fastBonus,
      answerText,
      dareText: guessed ? undefined : dareOverride ?? pickRandomMusicalDare(state.round),
      revealTitle: state.blindTrack?.trackName || state.secretTitle || 'Morceau Mystère',
      revealArtist: state.blindTrack?.artistName || state.secretArtist || '',
      revealArtworkUrl: state.blindTrack?.artworkUrl,
    },
    stateSeq: state.stateSeq + 1,
  };
}

export function advanceJamRound(state: JamState): JamState {
  if (state.totalRounds > 0 && state.round >= state.totalRounds) {
    return {
      ...state,
      phase: 'MATCH_OVER',
      finalDareText: pickRandomMusicalDare(state.round + 3),
      stateSeq: state.stateSeq + 1,
    };
  }
  const nextPerformer = state.soloAiPerformer ? 'guest' : getOppositePlayer(state.performer);
  return {
    ...state,
    phase: 'PREP',
    round: state.round + 1,
    performer: nextPerformer,
    secretSongId: null,
    secretTitle: '',
    secretArtist: '',
    secretCategory: '',
    blindTrack: null,
    timeLeftSec: state.mode === 'blind-test' ? JAM_BLINDTEST_ROUND_SEC : JAM_INSTRUMENT_ROUND_SEC,
    isPaused: false,
    buzzerLeftSec: 0,
    buzzerBy: null,
    hintCategoryUsed: false,
    hintArtistUsed: false,
    hintUnblurUsed: false,
    hintsCount: 0,
    lastWrongGuess: null,
    outcome: null,
    stateSeq: state.stateSeq + 1,
  };
}

/**
 * Compute mystery blur radius (px) for Blind Test album artwork.
 * Starts heavily blurred (28px ~ blur-2xl), clarifies slightly as time drops, and cuts by 50% if hint used.
 */
export function computeMysteryBlurPx(
  timeLeftSec: number,
  totalDurationSec: number,
  hintUnblurUsed: boolean,
  revealed: boolean,
): number {
  if (revealed) return 0;
  const progress = Math.max(0, Math.min(1, 1 - timeLeftSec / Math.max(1, totalDurationSec)));
  const baseBlur = 28 - progress * 12; // 28px -> 16px
  return Math.round(hintUnblurUsed ? baseBlur * 0.45 : baseBlur);
}

/**
 * Pure air-play hit detection for MediaPipe hand points across all 4 instruments.
 * - Enforces 160ms cooldown per zone/string.
 * - Darbouka / Piano / Oud: triggers on entering a new zone or fast downward strike (> 0.045 deltaY).
 * - Guitar: triggers instantly when fingertip crosses any of the 6 horizontal strings.
 */
export interface AirPlayTrackerMemory {
  lastZoneByHand: Record<number, string | null>;
  lastTriggerMsByZone: Record<string, number>;
}

export function createAirPlayMemory(): AirPlayTrackerMemory {
  return {
    lastZoneByHand: {},
    lastTriggerMsByZone: {},
  };
}

export function mapPointToInstrumentZone(
  instrument: JamInstrumentId,
  x: number,
  y: number,
): string | null {
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;

  if (instrument === 'darbouka') {
    const dx = x - 0.5;
    const dy = y - 0.54;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.22) return 'doum';
    if (y < 0.34 && Math.abs(dx) < 0.34) return 'slap';
    if (x < 0.5) return 'ka';
    return 'tek';
  }

  if (instrument === 'piano') {
    const whiteIds = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
    // Top 52% checks the 3 accidental black keys (Fs4, Gs4, Bb4)
    if (y < 0.52) {
      if (x >= 0.44 && x <= 0.54) return 'Fs4';
      if (x >= 0.565 && x <= 0.665) return 'Gs4';
      if (x >= 0.69 && x <= 0.79) return 'Bb4';
    }
    const idx = Math.max(0, Math.min(whiteIds.length - 1, Math.floor(x * whiteIds.length)));
    return whiteIds[idx];
  }

  if (instrument === 'oud') {
    const oudIds = ['oud_D4', 'oud_Eb4', 'oud_Fs4', 'oud_G4', 'oud_A4', 'oud_Bb4', 'oud_C5', 'oud_D5'];
    const idx = Math.max(0, Math.min(oudIds.length - 1, Math.floor(x * oudIds.length)));
    return oudIds[idx];
  }

  // Guitar: 6 horizontal strings spaced evenly between y=0.12 and y=0.84
  const stringIds = ['s6', 's5', 's4', 's3', 's2', 's1'];
  if (y < 0.06 || y > 0.9) return null;
  const norm = (y - 0.1) / 0.76;
  const idx = Math.max(0, Math.min(stringIds.length - 1, Math.floor(norm * stringIds.length)));
  return stringIds[idx];
}

export function detectAirPlayTriggers(
  instrument: JamInstrumentId,
  hands: { id: number; x: number; y: number; prevY: number }[],
  memory: AirPlayTrackerMemory,
  nowMs: number,
  cooldownMs = JAM_AIRPLAY_COOLDOWN_MS,
): string[] {
  const triggered: string[] = [];

  for (const h of hands) {
    if (instrument === 'guitar') {
      // Check every string Y coordinate crossed between prevY and y
      const stringIds = ['s6', 's5', 's4', 's3', 's2', 's1'];
      const minY = Math.min(h.prevY, h.y);
      const maxY = Math.max(h.prevY, h.y);
      for (let i = 0; i < stringIds.length; i += 1) {
        const sy = 0.16 + i * 0.132;
        if (minY <= sy && maxY >= sy && Math.abs(h.y - h.prevY) > 0.006) {
          const id = stringIds[i];
          const lastAt = memory.lastTriggerMsByZone[id] ?? -Infinity;
          if (nowMs - lastAt >= cooldownMs) {
            memory.lastTriggerMsByZone[id] = nowMs;
            triggered.push(id);
          }
        }
      }
      continue;
    }

    const zone = mapPointToInstrumentZone(instrument, h.x, h.y);
    const prevZone = memory.lastZoneByHand[h.id] ?? null;
    memory.lastZoneByHand[h.id] = zone;

    if (!zone) continue;

    const enteredNewZone = zone !== prevZone;
    const downwardStrike = h.y - h.prevY > 0.045;
    if (enteredNewZone || downwardStrike) {
      const lastAt = memory.lastTriggerMsByZone[zone] ?? -Infinity;
      if (nowMs - lastAt >= cooldownMs) {
        memory.lastTriggerMsByZone[zone] = nowMs;
        triggered.push(zone);
      }
    }
  }

  return triggered;
}
