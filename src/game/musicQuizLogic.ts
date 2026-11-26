/**
 * Pure decoupled game rules, categories, scoring, round builder, and Solo AI
 * for "⚡ Quiz Éclair 4 Choix" (Music Quiz).
 */

import type {
  MusicQuizCategory,
  MusicQuizDuration,
  MusicQuizOption,
  MusicQuizPlayer,
  MusicQuizRoundPayload,
} from '../types/duoplay';
import { dedupeItunesTracks, normalizeTrackKey, type ItunesTrack } from '../services/itunesAudioEngine';

export interface MusicQuizCategorySpec {
  id: MusicQuizCategory;
  emoji: string;
  labelFr: string;
  labelEn: string;
  labelAr: string;
  primaryTerms: readonly string[];
  fallbackTerms: readonly string[];
}

export const MUSIC_QUIZ_CATEGORIES: readonly MusicQuizCategorySpec[] = [
  {
    id: 'all-hits',
    emoji: '🌍',
    labelFr: 'Tous les Hits',
    labelEn: 'All Hits',
    labelAr: 'أشهر الأغاني',
    primaryTerms: [
      'The Weeknd',
      'Saad Lamjarred',
      'Stromae',
      'Dua Lipa',
      'Aya Nakamura',
      'Bruno Mars',
      'Gims',
      'Rihanna',
      'Cheb Khaled',
      'Coldplay',
    ],
    fallbackTerms: ['Daft Punk', 'Shakira', 'Ed Sheeran', 'Indila'],
  },
  {
    id: 'pop-intl',
    emoji: '🎤',
    labelFr: 'Pop & International',
    labelEn: 'Pop & International',
    labelAr: 'بوب عالمي',
    primaryTerms: [
      'Dua Lipa',
      'The Weeknd',
      'Rihanna',
      'Bruno Mars',
      'Billie Eilish',
      'Taylor Swift',
      'Ed Sheeran',
      'Shakira',
      'Lady Gaga',
      'Coldplay',
    ],
    fallbackTerms: ['Adele', 'Beyonce', 'Justin Bieber', 'Sia'],
  },
  {
    id: 'rai-chaabi',
    emoji: '🪘',
    labelFr: 'Raï, Chaabi & Oriental',
    labelEn: 'Raï, Chaabi & Oriental',
    labelAr: 'راي وشعبي وشرقي',
    primaryTerms: [
      'Saad Lamjarred',
      'Cheb Khaled',
      'Cheb Hasni',
      'ElGrandeToto',
      'Manal',
      'Zouhair Bahaoui',
      'Nancy Ajram',
      'Amr Diab',
      'Cheb Mami',
      'Douzi',
    ],
    fallbackTerms: ['Faudel', 'Hatim Ammor', 'Sherine', 'Tamer Hosny'],
  },
  {
    id: 'rap',
    emoji: '🔥',
    labelFr: 'Rap FR & US',
    labelEn: 'French & US Rap',
    labelAr: 'راب فرنسي وأمريكي',
    primaryTerms: [
      'Ninho',
      'Jul',
      'Damso',
      'Orelsan',
      'Nekfeu',
      'Drake',
      'Eminem',
      'Kendrick Lamar',
      'Travis Scott',
      'PNL',
    ],
    fallbackTerms: ['Gims', 'Soprano', 'Post Malone', '50 Cent'],
  },
  {
    id: 'movies-disney',
    emoji: '🎬',
    labelFr: 'Films & Disney',
    labelEn: 'Movies & Disney',
    labelAr: 'أفلام وديزني',
    primaryTerms: [
      'Disney Frozen',
      'The Lion King',
      'Aladdin Disney',
      'Encanto',
      'Celine Dion Titanic',
      'Hans Zimmer',
      'Moana Disney',
      'Toy Story',
      'Beauty and the Beast',
      'Mulan Disney',
    ],
    fallbackTerms: ['Disney Hits', 'Soundtrack Movie', 'John Williams', 'Pixar'],
  },
] as const;

export const MUSIC_QUIZ_DURATIONS: readonly MusicQuizDuration[] = [5, 10, 15];
export const MUSIC_QUIZ_ROUND_SECONDS = 15;
export const MUSIC_QUIZ_REVEAL_MS = 3500;

export function getQuizCategorySpec(id: MusicQuizCategory): MusicQuizCategorySpec {
  return MUSIC_QUIZ_CATEGORIES.find((c) => c.id === id) ?? MUSIC_QUIZ_CATEGORIES[0];
}

/**
 * Clean overly verbose parenthetical tags so 4 choice buttons stay readable on phones.
 */
export function formatQuizTrackTitle(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length <= 36) return trimmed;
  const cleaned = trimmed
    .replace(/\s*\((?:Remastered|Radio Edit|Original Motion Picture Soundtrack|From [^)]+)\)/gi, '')
    .replace(/\s*-\s*Single\s*Version/gi, '')
    .trim();
  return cleaned.length > 0 ? cleaned : trimmed;
}

function shuffleWithRng<T>(items: readonly T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Builds `totalRounds` randomized 4-choice rounds from a pool of iTunes tracks.
 * Guarantees 4 unique choices per round (preferring distinct artists for distractors).
 */
export function buildQuizRoundsFromTracks(
  rawTracks: readonly ItunesTrack[],
  totalRounds: MusicQuizDuration,
  rng: () => number = Math.random,
): MusicQuizRoundPayload[] {
  const pool = dedupeItunesTracks([...rawTracks]);
  if (pool.length < 4) return [];

  const shuffledPool = shuffleWithRng(pool, rng);
  const selectedCorrect: ItunesTrack[] = [];
  for (let i = 0; i < totalRounds; i += 1) {
    selectedCorrect.push(shuffledPool[i % shuffledPool.length]);
  }

  return selectedCorrect.map((correctTrack, idx) => {
    const correctKey = normalizeTrackKey(correctTrack.trackName);
    const correctArtistLower = correctTrack.artistName.toLowerCase();

    const otherArtists = shuffleWithRng(
      pool.filter(
        (t) =>
          normalizeTrackKey(t.trackName) !== correctKey &&
          t.artistName.toLowerCase() !== correctArtistLower,
      ),
      rng,
    );
    const sameArtistFallback = shuffleWithRng(
      pool.filter(
        (t) =>
          normalizeTrackKey(t.trackName) !== correctKey &&
          t.artistName.toLowerCase() === correctArtistLower,
      ),
      rng,
    );

    const distractors = [...otherArtists, ...sameArtistFallback].slice(0, 3);
    const combined: { track: ItunesTrack; isCorrect: boolean }[] = [
      { track: correctTrack, isCorrect: true },
      ...distractors.map((track) => ({ track, isCorrect: false })),
    ];
    const shuffledOptions = shuffleWithRng(combined, rng);
    const correctIndex = shuffledOptions.findIndex((entry) => entry.isCorrect);

    const options: MusicQuizOption[] = shuffledOptions.map((entry) => ({
      title: formatQuizTrackTitle(entry.track.trackName),
      artist: entry.track.artistName,
    }));

    return {
      round: idx + 1,
      totalRounds,
      previewUrl: correctTrack.previewUrl,
      artworkUrl: correctTrack.artworkUrlHiRes || correctTrack.artworkUrl,
      options,
      correctIndex: correctIndex >= 0 ? correctIndex : 0,
      startTime: 0,
    };
  });
}

/**
 * Speed-tiered scoring for Quiz Éclair:
 * - < 5s  -> +3 pts
 * - < 10s -> +2 pts
 * - <= 15s -> +1 pt
 * - wrong -> 0 pts
 */
export function scoreQuizAnswer(elapsedSec: number, isCorrect: boolean): number {
  if (!isCorrect) return 0;
  const clamped = Math.max(0, elapsedSec);
  if (clamped < 5) return 3;
  if (clamped < 10) return 2;
  if (clamped <= MUSIC_QUIZ_ROUND_SECONDS + 0.5) return 1;
  return 0;
}

export interface QuizPlayerAnswer {
  optionIndex: number;
  elapsedSec: number;
  isCorrect: boolean;
}

export interface QuizRoundResolution {
  hostBasePoints: number;
  guestBasePoints: number;
  hostSpeedBonus: number;
  guestSpeedBonus: number;
  hostTotalPoints: number;
  guestTotalPoints: number;
  fastestPlayer: MusicQuizPlayer | null;
}

/**
 * Resolves a round's points for both players including the +1 pt speed bonus
 * awarded to the fastest player who answered correctly.
 */
export function resolveQuizRoundScores(
  hostAnswer: QuizPlayerAnswer | null,
  guestAnswer: QuizPlayerAnswer | null,
): QuizRoundResolution {
  const hostBase = hostAnswer ? scoreQuizAnswer(hostAnswer.elapsedSec, hostAnswer.isCorrect) : 0;
  const guestBase = guestAnswer ? scoreQuizAnswer(guestAnswer.elapsedSec, guestAnswer.isCorrect) : 0;

  let fastestPlayer: MusicQuizPlayer | null = null;
  const hostOk = Boolean(hostAnswer?.isCorrect);
  const guestOk = Boolean(guestAnswer?.isCorrect);

  if (hostOk && !guestOk) {
    fastestPlayer = 'host';
  } else if (!hostOk && guestOk) {
    fastestPlayer = 'guest';
  } else if (hostOk && guestOk && hostAnswer && guestAnswer) {
    fastestPlayer = hostAnswer.elapsedSec <= guestAnswer.elapsedSec ? 'host' : 'guest';
  }

  const hostSpeedBonus = fastestPlayer === 'host' ? 1 : 0;
  const guestSpeedBonus = fastestPlayer === 'guest' ? 1 : 0;

  return {
    hostBasePoints: hostBase,
    guestBasePoints: guestBase,
    hostSpeedBonus,
    guestSpeedBonus,
    hostTotalPoints: hostBase + hostSpeedBonus,
    guestTotalPoints: guestBase + guestSpeedBonus,
    fastestPlayer,
  };
}

/**
 * Solo Mode AI opponent: answers realistically between 3.0s and 11.0s (~72% accuracy).
 */
export function planSoloAiQuizAnswer(
  correctIndex: number,
  rng: () => number = Math.random,
): { optionIndex: number; delaySec: number; isCorrect: boolean } {
  const delaySec = Number((3 + rng() * 8).toFixed(2));
  const isCorrect = rng() < 0.72;
  if (isCorrect) {
    return { optionIndex: correctIndex, delaySec, isCorrect: true };
  }
  const wrongChoices = [0, 1, 2, 3].filter((idx) => idx !== correctIndex);
  const picked = wrongChoices[Math.floor(rng() * wrongChoices.length)] ?? 0;
  return { optionIndex: picked, delaySec, isCorrect: false };
}

/**
 * Offline / network-error emergency fallback track catalog so tests and zero-network
 * environments never lock up on an empty screen (real online browsers use live JSONP iTunes).
 */
export const EMERGENCY_QUIZ_FALLBACK_TRACKS: readonly ItunesTrack[] = [
  {
    trackId: 900001,
    trackName: 'Blinding Lights',
    artistName: 'The Weeknd',
    collectionName: 'After Hours',
    previewUrl: '',
    artworkUrl: '',
    artworkUrlHiRes: '',
  },
  {
    trackId: 900002,
    trackName: 'Lm3allem',
    artistName: 'Saad Lamjarred',
    collectionName: 'Lm3allem',
    previewUrl: '',
    artworkUrl: '',
    artworkUrlHiRes: '',
  },
  {
    trackId: 900003,
    trackName: 'Levitating',
    artistName: 'Dua Lipa',
    collectionName: 'Future Nostalgia',
    previewUrl: '',
    artworkUrl: '',
    artworkUrlHiRes: '',
  },
  {
    trackId: 900004,
    trackName: 'Aïcha',
    artistName: 'Cheb Khaled',
    collectionName: 'Sahra',
    previewUrl: '',
    artworkUrl: '',
    artworkUrlHiRes: '',
  },
  {
    trackId: 900005,
    trackName: 'Alors on danse',
    artistName: 'Stromae',
    collectionName: 'Cheese',
    previewUrl: '',
    artworkUrl: '',
    artworkUrlHiRes: '',
  },
];
