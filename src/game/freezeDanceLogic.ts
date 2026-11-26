/**
 * Pure decoupled game state, vibes, random freeze durations, verdict scoring,
 * funny dares, and winner resolution for "🥶 1, 2, 3… Statue Musicale (Freeze Dance)".
 */

import type {
  FreezeDanceFormat,
  FreezeDanceState,
  FreezeDanceVerdict,
  FreezeDanceVibe,
  FreezeLandmarkAnchor,
} from '../types/duoplay';

/** 0.6s braking grace period right after the music cuts before locking baseline pose */
export const FREEZE_GRACE_MS = 600;
/** Normalized landmark micro-jitter deadzone ignored so natural webcam noise never false-triggers */
export const FREEZE_MOTION_DEADZONE = 0.015;
/** Fair normalized displacement threshold that triggers automatic "MOVED!" detection */
export const FREEZE_MOTION_THRESHOLD = 0.056;
/** Require 2 consecutive frames over threshold to eliminate single-frame landmark spikes */
export const FREEZE_SUSTAINED_FRAMES_REQUIRED = 2;

export interface FreezeMotionEvaluation {
  delta: number;
  stability: number; // 0..100
  violationFrames: number;
  caught: boolean;
}

/**
 * Pure scale-normalized MediaPipe landmark displacement between baseline statue pose
 * and live camera frame. Combines nose, eyes, chin translation and head roll tilt.
 */
export function computeFreezeLandmarkDelta(
  baseline: FreezeLandmarkAnchor,
  current: FreezeLandmarkAnchor,
): number {
  const noseDist = Math.hypot(current.noseX - baseline.noseX, current.noseY - baseline.noseY);
  const leftEyeDist = Math.hypot(
    current.leftEyeX - baseline.leftEyeX,
    current.leftEyeY - baseline.leftEyeY,
  );
  const rightEyeDist = Math.hypot(
    current.rightEyeX - baseline.rightEyeX,
    current.rightEyeY - baseline.rightEyeY,
  );
  const chinDist = Math.hypot(current.chinX - baseline.chinX, current.chinY - baseline.chinY);
  const tiltDelta = Math.abs(current.headTiltRad - baseline.headTiltRad) * 0.22;

  const baseEyeSpan = Math.max(
    0.05,
    Math.hypot(baseline.rightEyeX - baseline.leftEyeX, baseline.rightEyeY - baseline.leftEyeY),
  );
  // Gentle distance-from-camera normalization so closer/farther players face the same fair bar
  const normFactor = Math.min(1.55, Math.max(0.68, 0.14 / baseEyeSpan));

  const meanPointDelta = (noseDist * 1.2 + leftEyeDist + rightEyeDist + chinDist * 0.8) / 4;
  return meanPointDelta * normFactor + tiltDelta;
}

/**
 * Evaluates live stability (0..100%) and automatic "MOVED!" detection with jitter deadzone
 * and sustained-frame anti-glitch protection.
 */
export function evaluateFreezeMotion(
  baseline: FreezeLandmarkAnchor,
  current: FreezeLandmarkAnchor,
  prevViolationFrames = 0,
): FreezeMotionEvaluation {
  const delta = computeFreezeLandmarkDelta(baseline, current);
  const effective = Math.max(0, delta - FREEZE_MOTION_DEADZONE);
  const span = Math.max(0.001, FREEZE_MOTION_THRESHOLD - FREEZE_MOTION_DEADZONE);
  const stability = Math.round(Math.max(0, Math.min(100, (1 - effective / span) * 100)));

  const violationFrames = delta >= FREEZE_MOTION_THRESHOLD ? prevViolationFrames + 1 : 0;
  const caught = violationFrames >= FREEZE_SUSTAINED_FRAMES_REQUIRED;

  return {
    delta,
    stability,
    violationFrames,
    caught,
  };
}

export interface FreezeVibeSpec {
  id: FreezeDanceVibe;
  emoji: string;
  labelFr: string;
  labelEn: string;
  labelAr: string;
  primaryTerms: readonly string[];
  fallbackTerms: readonly string[];
}

export const FREEZE_DANCE_VIBES: readonly FreezeVibeSpec[] = [
  {
    id: 'party-pop',
    emoji: '💃',
    labelFr: 'Soirée & Pop Dance',
    labelEn: 'Party & Pop Dance',
    labelAr: 'سهرة وبوب دانس',
    primaryTerms: [
      'Dua Lipa',
      'David Guetta',
      'Calvin Harris',
      'Bruno Mars',
      'Lady Gaga',
      'Beyonce',
      'Pitbull',
      'Shakira',
    ],
    fallbackTerms: ['Rihanna', 'Katy Perry', 'Pharrell Williams', 'Major Lazer'],
  },
  {
    id: 'chaabi-rai',
    emoji: '🪘',
    labelFr: 'Chaabi & Raï Festif',
    labelEn: 'Festive Chaabi & Raï',
    labelAr: 'شعبي وراي احتفالي',
    primaryTerms: [
      'Saad Lamjarred',
      'Cheb Khaled',
      'Douzi',
      'Zouhair Bahaoui',
      'Faudel',
      'Reda Taliani',
      'Daoudi',
      'Hatim Ammor',
    ],
    fallbackTerms: ['Cheb Mami', 'Amr Diab', 'Nancy Ajram', 'ElGrandeToto'],
  },
  {
    id: 'reggaeton-latino',
    emoji: '🔥',
    labelFr: 'Reggaeton & Latino',
    labelEn: 'Reggaeton & Latino',
    labelAr: 'ريغيتون ولاتيني',
    primaryTerms: [
      'Bad Bunny',
      'Daddy Yankee',
      'J Balvin',
      'Karol G',
      'Maluma',
      'Ozuna',
      'Luis Fonsi',
      'Rosalia',
    ],
    fallbackTerms: ['Nicky Jam', 'Don Omar', 'Enrique Iglesias', 'Rauw Alejandro'],
  },
  {
    id: 'disco-funk',
    emoji: '🪩',
    labelFr: 'Disco & Funk',
    labelEn: 'Disco & Funk',
    labelAr: 'ديسكو وفانك',
    primaryTerms: [
      'Daft Punk',
      'Earth Wind and Fire',
      'ABBA',
      'Bee Gees',
      'Chic',
      'Donna Summer',
      'Michael Jackson',
      'Kool and the Gang',
    ],
    fallbackTerms: ['Boney M', 'Jamiroquai', 'Stevie Wonder', 'Gloria Gaynor'],
  },
] as const;

export const FREEZE_FUNNY_DARES: readonly string[] = [
  'Garde exactement cette pose 3 secondes de plus !',
  'Fais ta meilleure grimace face caméra !',
  'Reste en statue de musée les bras en l’air pendant 4 secondes !',
  'Envoie un clin d’œil ultra dramatique au ralenti !',
  'Fais un mini pas de robot jusqu’au prochain son !',
  'Pose tes deux mains sur les joues façon « Maman j’ai raté l’avion » !',
];

export const FREEZE_DANCE_MIN_MS = 4000;
export const FREEZE_DANCE_MAX_MS = 10000;
export const FREEZE_HOLD_MS = 4000;
export const FREEZE_VERDICT_MAX_MS = 6000;
export const FREEZE_INITIAL_LIVES = 3;
export const FREEZE_ROUNDS_TARGET = 5;

export function getFreezeVibeSpec(vibe: FreezeDanceVibe): FreezeVibeSpec {
  return FREEZE_DANCE_VIBES.find((v) => v.id === vibe) ?? FREEZE_DANCE_VIBES[0];
}

/**
 * Generates an unpredictable dance duration strictly between 4000ms and 10000ms.
 */
export function pickRandomDanceDurationMs(rng: () => number = Math.random): number {
  const r = Math.max(0, Math.min(0.999999, rng()));
  return Math.round(FREEZE_DANCE_MIN_MS + r * (FREEZE_DANCE_MAX_MS - FREEZE_DANCE_MIN_MS));
}

export function createInitialFreezeState(
  vibe: FreezeDanceVibe = 'party-pop',
  format: FreezeDanceFormat = 'lives-3',
): FreezeDanceState {
  return {
    phase: 'LOBBY',
    vibe,
    format,
    round: 0,
    maxRounds: format === 'rounds-5' ? FREEZE_ROUNDS_TARGET : 99,
    hostLives: FREEZE_INITIAL_LIVES,
    guestLives: FREEZE_INITIAL_LIVES,
    hostPoints: 0,
    guestPoints: 0,
    currentTrackTitle: '',
    currentTrackArtist: '',
    currentPreviewUrl: '',
    currentArtworkUrl: '',
    danceDurationMs: 6000,
    phaseStartedAt: 0,
    hostVoteOnGuest: null,
    guestVoteOnHost: null,
    activeDareText: '',
    lastVerdictSummary: '',
    winner: null,
    stateSeq: 0,
  };
}

export interface FreezeVerdictOutcome {
  nextState: FreezeDanceState;
  matchFinished: boolean;
}

/**
 * Resolves a round's verdicts:
 * - In Duo: hostVoteOnGuest judges Guest; guestVoteOnHost judges Host.
 * - In Solo: hostVoteOnGuest acts as player's self-verdict on themselves.
 */
export function resolveFreezeRoundVerdicts(
  state: FreezeDanceState,
  hostVote: FreezeDanceVerdict | null,
  guestVote: FreezeDanceVerdict | null,
  isSolo: boolean,
  dareIndex = 0,
): FreezeVerdictOutcome {
  let hostLives = state.hostLives;
  let guestLives = state.guestLives;
  let hostPoints = state.hostPoints;
  let guestPoints = state.guestPoints;
  let activeDareText = '';
  const summaryParts: string[] = [];

  if (isSolo) {
    const verdict = hostVote ?? 'statue';
    if (verdict === 'moved') {
      if (state.format === 'lives-3') {
        hostLives = Math.max(0, hostLives - 1);
      } else {
        guestPoints += 1;
      }
      activeDareText = FREEZE_FUNNY_DARES[Math.abs(dareIndex) % FREEZE_FUNNY_DARES.length];
      summaryParts.push('Tu as bougé ! Petit gage bonus 😂');
    } else {
      hostPoints += 1;
      summaryParts.push('Statue parfaite ! +1 pt de style 🗿');
    }
  } else {
    // Host judges Guest
    const onGuest = hostVote ?? 'statue';
    if (onGuest === 'moved') {
      if (state.format === 'lives-3') {
        guestLives = Math.max(0, guestLives - 1);
      } else {
        hostPoints += 1;
      }
      activeDareText = FREEZE_FUNNY_DARES[Math.abs(dareIndex) % FREEZE_FUNNY_DARES.length];
      summaryParts.push('Partenaire attrapé(e) en mouvement ! 😂');
    } else {
      guestPoints += 1;
    }

    // Guest judges Host
    const onHost = guestVote ?? 'statue';
    if (onHost === 'moved') {
      if (state.format === 'lives-3') {
        hostLives = Math.max(0, hostLives - 1);
      } else {
        guestPoints += 1;
      }
      if (!activeDareText) {
        activeDareText = FREEZE_FUNNY_DARES[Math.abs(dareIndex + 1) % FREEZE_FUNNY_DARES.length];
      }
      summaryParts.push('Hôte grillé(e) en plein mouvement ! 😂');
    } else {
      hostPoints += 1;
    }

    if (onGuest === 'statue' && onHost === 'statue') {
      summaryParts.push('Deux statues parfaites ! +1 pt de style chacun 🗿');
    }
  }

  let winner: FreezeDanceState['winner'] = null;
  let matchFinished = false;

  if (state.format === 'lives-3') {
    if (isSolo) {
      if (hostLives <= 0) {
        matchFinished = true;
        winner = 'guest';
      } else if (state.round >= FREEZE_ROUNDS_TARGET) {
        matchFinished = true;
        winner = 'host';
      }
    } else if (hostLives <= 0 || guestLives <= 0) {
      matchFinished = true;
      if (hostLives <= 0 && guestLives <= 0) {
        winner = hostPoints > guestPoints ? 'host' : guestPoints > hostPoints ? 'guest' : 'draw';
      } else {
        winner = hostLives > 0 ? 'host' : 'guest';
      }
    }
  } else if (state.round >= state.maxRounds) {
    matchFinished = true;
    if (isSolo) {
      winner = hostPoints >= guestPoints ? 'host' : 'guest';
    } else {
      winner = hostPoints > guestPoints ? 'host' : guestPoints > hostPoints ? 'guest' : 'draw';
    }
  }

  return {
    matchFinished,
    nextState: {
      ...state,
      hostLives,
      guestLives,
      hostPoints,
      guestPoints,
      hostVoteOnGuest: hostVote,
      guestVoteOnHost: guestVote,
      activeDareText,
      lastVerdictSummary: summaryParts.join(' · '),
      winner,
      phase: matchFinished ? 'GAME_OVER' : state.phase,
      stateSeq: state.stateSeq + 1,
    },
  };
}
