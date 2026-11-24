import type { LaughGameState, LaughPrompt, LaughSensitivity } from '../types/duoplay';

export interface BlendshapeCategory {
  categoryName: string;
  score: number;
}

export const LAUGH_PROMPTS: LaughPrompt[] = [
  {
    id: 'p1',
    category: 'Grimace',
    text: 'Fais ton meilleur regard de séduction dramatique de telenovela pendant 5 secondes.',
  },
  {
    id: 'p2',
    category: 'Impro',
    text: 'Annonce la météo de demain comme si un nuage de fromage fondu approchait.',
  },
  {
    id: 'p3',
    category: 'Absurde',
    text: 'Décris ton dernier repas avec la voix grave d’une bande-annonce de film d’action.',
  },
  {
    id: 'p4',
    category: 'Grimace',
    text: 'Gonfle les joues façon poisson-lune et cligne lentement d’un seul œil.',
  },
  {
    id: 'p5',
    category: 'Complicité',
    text: 'Fais un compliment ultra solennel sur le sourcil gauche de ton/ta partenaire.',
  },
  {
    id: 'p6',
    category: 'Impro',
    text: 'Vends l’objet le plus proche de toi comme s’il valait 2 millions d’euros aux enchères.',
  },
  {
    id: 'p7',
    category: 'Absurde',
    text: 'Imite un chat qui découvre un concombre sans jamais montrer les dents.',
  },
  {
    id: 'p8',
    category: 'Complicité',
    text: 'Fixe la caméra et chuchote le mot « tartiflette » sur trois tons différents.',
  },
  {
    id: 'p9',
    category: 'Grimace',
    text: 'Fais la tête de quelqu’un qui a oublié s’il a fermé le gaz, en accéléré.',
  },
  {
    id: 'p10',
    category: 'Impro',
    text: 'Invente une excuse complètement ridicule pour expliquer pourquoi tu es en retard sur Mars.',
  },
  {
    id: 'p11',
    category: 'Absurde',
    text: 'Chante « Joyeux Anniversaire » en voix d’opéra ultra sérieuse sans sourire.',
  },
  {
    id: 'p12',
    category: 'Complicité',
    text: 'Imite la réaction typique de ton/ta partenaire quand son téléphone n’a plus que 2 % de batterie.',
  },
  {
    id: 'p13',
    category: 'Grimace',
    text: 'Essaie de toucher ton nez avec ta lèvre supérieure tout en gardant un air noble.',
  },
  {
    id: 'p14',
    category: 'Impro',
    text: 'Donne un discours de remise de César pour remercier ta chaise de bureau.',
  },
  {
    id: 'p15',
    category: 'Absurde',
    text: 'Parle au ralenti pendant 6 secondes comme si la connexion venait de geler.',
  },
  {
    id: 'p16',
    category: 'Complicité',
    text: 'Révèle un super-pouvoir complètement inutile que tu donnerais à ton/ta partenaire.',
  },
];

export const SENSITIVITY_CONFIG: Record<
  LaughSensitivity,
  { threshold: number; holdSec: number; label: string; description: string }
> = {
  facile: {
    threshold: 58,
    holdSec: 0.45,
    label: 'Détendu',
    description: 'Seul un vrai sourire franc fait perdre.',
  },
  normal: {
    threshold: 44,
    holdSec: 0.32,
    label: 'Classique',
    description: 'Équilibre idéal pour les fous rires en couple.',
  },
  implacable: {
    threshold: 30,
    holdSec: 0.22,
    label: 'Implacable',
    description: 'Le moindre coin de lèvre qui frémit est sanctionné.',
  },
};

export function getSmileThreshold(sensitivity: LaughSensitivity): number {
  return SENSITIVITY_CONFIG[sensitivity].threshold;
}

export function getCrackHoldDuration(sensitivity: LaughSensitivity): number {
  return SENSITIVITY_CONFIG[sensitivity].holdSec;
}

/**
 * Computes calibrated 0..100 smile/laugh intensity AND 0..100 expressive grimace intensity
 * from MediaPipe FaceLandmarker blendshapes.
 */
export function computeSmileIntensity(categories: BlendshapeCategory[] | undefined | null): {
  smileScore: number;
  grimaceScore: number;
  laughBurst: number;
} {
  if (!categories || categories.length === 0) {
    return { smileScore: 0, grimaceScore: 0, laughBurst: 0 };
  }

  let smileLeft = 0;
  let smileRight = 0;
  let cheekLeft = 0;
  let cheekRight = 0;
  let dimpleLeft = 0;
  let dimpleRight = 0;
  let stretchLeft = 0;
  let stretchRight = 0;
  let jawOpen = 0;
  let upperLipLeft = 0;
  let upperLipRight = 0;

  // Grimace markers (funny faces: puffed cheeks, duck lips, wide eyes, raised brows, sneer, mouth skew)
  let cheekPuff = 0;
  let mouthPucker = 0;
  let mouthFunnel = 0;
  let browInnerUp = 0;
  let browOuterUpLeft = 0;
  let browOuterUpRight = 0;
  let eyeWideLeft = 0;
  let eyeWideRight = 0;
  let noseSneerLeft = 0;
  let noseSneerRight = 0;
  let mouthFrownLeft = 0;
  let mouthFrownRight = 0;
  let mouthLeft = 0;
  let mouthRight = 0;

  for (let i = 0; i < categories.length; i++) {
    const { categoryName, score } = categories[i];
    switch (categoryName) {
      case 'mouthSmileLeft':
        smileLeft = score;
        break;
      case 'mouthSmileRight':
        smileRight = score;
        break;
      case 'cheekSquintLeft':
        cheekLeft = score;
        break;
      case 'cheekSquintRight':
        cheekRight = score;
        break;
      case 'mouthDimpleLeft':
        dimpleLeft = score;
        break;
      case 'mouthDimpleRight':
        dimpleRight = score;
        break;
      case 'mouthStretchLeft':
        stretchLeft = score;
        break;
      case 'mouthStretchRight':
        stretchRight = score;
        break;
      case 'jawOpen':
        jawOpen = score;
        break;
      case 'mouthUpperUpLeft':
        upperLipLeft = score;
        break;
      case 'mouthUpperUpRight':
        upperLipRight = score;
        break;
      case 'cheekPuff':
        cheekPuff = score;
        break;
      case 'mouthPucker':
        mouthPucker = score;
        break;
      case 'mouthFunnel':
        mouthFunnel = score;
        break;
      case 'browInnerUp':
        browInnerUp = score;
        break;
      case 'browOuterUpLeft':
        browOuterUpLeft = score;
        break;
      case 'browOuterUpRight':
        browOuterUpRight = score;
        break;
      case 'eyeWideLeft':
        eyeWideLeft = score;
        break;
      case 'eyeWideRight':
        eyeWideRight = score;
        break;
      case 'noseSneerLeft':
        noseSneerLeft = score;
        break;
      case 'noseSneerRight':
        noseSneerRight = score;
        break;
      case 'mouthFrownLeft':
        mouthFrownLeft = score;
        break;
      case 'mouthFrownRight':
        mouthFrownRight = score;
        break;
      case 'mouthLeft':
        mouthLeft = score;
        break;
      case 'mouthRight':
        mouthRight = score;
        break;
    }
  }

  const avgSmile = (smileLeft + smileRight) * 0.5;
  const maxSmile = Math.max(smileLeft, smileRight);
  const avgCheek = (cheekLeft + cheekRight) * 0.5;
  const avgDimple = (dimpleLeft + dimpleRight) * 0.5;
  const avgStretch = (stretchLeft + stretchRight) * 0.5;
  const avgUpperLip = (upperLipLeft + upperLipRight) * 0.5;

  // Weight true smile + cheek squint (Duchenne markers) + asymmetric smirk + suppressed dimple/stretch
  const rawSmile =
    avgSmile * 0.62 +
    maxSmile * 0.16 +
    avgCheek * 0.14 +
    avgDimple * 0.12 +
    Math.min(avgStretch, avgSmile + 0.15) * 0.06 +
    Math.min(avgUpperLip, avgSmile) * 0.04;

  // Laugh burst occurs when smiling + opening jaw simultaneously
  const laughBurst = Math.min(100, Math.round(jawOpen * Math.max(avgSmile, avgCheek * 0.8) * 180));
  const boosted = rawSmile * 118 + laughBurst * 0.2;
  const smileScore = Math.max(0, Math.min(100, Math.round(boosted)));

  // Expressive grimace score (peaks on strong non-neutral facial contortions)
  const peakGrimace = Math.max(
    cheekPuff * 1.3,
    mouthPucker * 1.15,
    mouthFunnel * 1.1,
    jawOpen * 1.05,
    (browOuterUpLeft + browOuterUpRight) * 0.6 + browInnerUp * 0.45,
    Math.max(eyeWideLeft, eyeWideRight) * 1.15,
    Math.max(noseSneerLeft, noseSneerRight) * 1.25,
    Math.max(mouthFrownLeft, mouthFrownRight) * 1.2,
    Math.max(mouthLeft, mouthRight) * 1.25,
  );
  const grimaceScore = Math.max(0, Math.min(100, Math.round(peakGrimace * 100)));

  return { smileScore, grimaceScore, laughBurst };
}

export function classifySmileState(
  smileScore: number,
  sensitivity: LaughSensitivity,
): 'calm' | 'twitch' | 'cracking' {
  const threshold = getSmileThreshold(sensitivity);
  if (smileScore >= threshold) return 'cracking';
  if (smileScore >= threshold * 0.62) return 'twitch';
  return 'calm';
}

export function getSmileStateLabel(state: 'calm' | 'twitch' | 'cracking'): string {
  switch (state) {
    case 'cracking':
      return 'Craquage !';
    case 'twitch':
      return 'Frémissement';
    default:
      return 'Impassible';
  }
}

export function getNextPrompt(currentId?: string): LaughPrompt {
  const candidates = LAUGH_PROMPTS.filter((p) => p.id !== currentId);
  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index] ?? LAUGH_PROMPTS[0];
}

export function findPromptById(id: string): LaughPrompt {
  return LAUGH_PROMPTS.find((p) => p.id === id) ?? LAUGH_PROMPTS[0];
}

export function createInitialLaughState(
  sensitivity: LaughSensitivity = 'normal',
  prompt: LaughPrompt = LAUGH_PROMPTS[0],
): LaughGameState {
  return {
    phase: 'ready',
    round: 1,
    targetWins: 3,
    localScore: 0,
    partnerScore: 0,
    countdownSec: 3,
    elapsedSec: 0,
    localCrackHoldSec: 0,
    partnerCrackHoldSec: 0,
    sensitivity,
    currentPrompt: prompt,
    lastWinner: null,
    lastCrackedReason: '',
    history: [],
  };
}

export function startLaughRound(
  state: LaughGameState,
  nextPrompt?: LaughPrompt,
): LaughGameState {
  const isFreshMatch = state.phase === 'match_over';
  return {
    ...state,
    phase: 'countdown',
    round: isFreshMatch ? 1 : state.phase === 'round_over' ? state.round + 1 : state.round,
    localScore: isFreshMatch ? 0 : state.localScore,
    partnerScore: isFreshMatch ? 0 : state.partnerScore,
    history: isFreshMatch ? [] : state.history,
    countdownSec: 3,
    elapsedSec: 0,
    localCrackHoldSec: 0,
    partnerCrackHoldSec: 0,
    currentPrompt: nextPrompt ?? state.currentPrompt,
    lastWinner: null,
    lastCrackedReason: '',
  };
}

/**
 * Pure simulation tick for "Tu ris, tu perds".
 * Handles 3-2-1 countdown and sustained smile-over-threshold crack detection.
 */
export function stepLaughGame(
  state: LaughGameState,
  localSmile: number,
  partnerSmile: number,
  dt: number,
  localName: string,
  partnerName: string,
): { nextState: LaughGameState; event: 'none' | 'countdown_tick' | 'go' | 'round_end' } {
  const safeDt = Math.max(0, Math.min(dt, 0.05));

  if (state.phase === 'countdown') {
    const prevCeil = Math.ceil(state.countdownSec);
    const nextCountdown = state.countdownSec - safeDt;
    if (nextCountdown <= 0) {
      return {
        nextState: {
          ...state,
          phase: 'playing',
          countdownSec: 0,
          elapsedSec: 0,
          localCrackHoldSec: 0,
          partnerCrackHoldSec: 0,
        },
        event: 'go',
      };
    }
    const nextCeil = Math.ceil(nextCountdown);
    return {
      nextState: {
        ...state,
        countdownSec: nextCountdown,
      },
      event: nextCeil !== prevCeil ? 'countdown_tick' : 'none',
    };
  }

  if (state.phase !== 'playing') {
    return { nextState: state, event: 'none' };
  }

  const threshold = getSmileThreshold(state.sensitivity);
  const holdRequired = getCrackHoldDuration(state.sensitivity);
  const elapsedSec = state.elapsedSec + safeDt;

  // Brief 0.6s grace right after "GO!" so players settle their poker face
  if (elapsedSec < 0.6) {
    return {
      nextState: {
        ...state,
        elapsedSec,
      },
      event: 'none',
    };
  }

  const localCrackHoldSec =
    localSmile >= threshold
      ? state.localCrackHoldSec + safeDt
      : Math.max(0, state.localCrackHoldSec - safeDt * 1.8);

  const partnerCrackHoldSec =
    partnerSmile >= threshold
      ? state.partnerCrackHoldSec + safeDt
      : Math.max(0, state.partnerCrackHoldSec - safeDt * 1.8);

  const localCracked = localCrackHoldSec >= holdRequired;
  const partnerCracked = partnerCrackHoldSec >= holdRequired;

  if (!localCracked && !partnerCracked) {
    return {
      nextState: {
        ...state,
        elapsedSec,
        localCrackHoldSec,
        partnerCrackHoldSec,
      },
      event: 'none',
    };
  }

  let winner: 'local' | 'partner' | 'draw' = 'draw';
  let localScore = state.localScore;
  let partnerScore = state.partnerScore;
  let crackedBy = 'Égalité';
  let reason = 'Vous avez craqué exactement en même temps !';

  if (localCracked && !partnerCracked) {
    winner = 'partner';
    partnerScore += 1;
    crackedBy = localName;
    reason = `${localName} a esquissé un sourire après ${elapsedSec.toFixed(1)} s.`;
  } else if (partnerCracked && !localCracked) {
    winner = 'local';
    localScore += 1;
    crackedBy = partnerName;
    reason = `${partnerName} n’a pas tenu face à toi (${elapsedSec.toFixed(1)} s).`;
  }

  const isMatchOver = localScore >= state.targetWins || partnerScore >= state.targetWins;

  return {
    nextState: {
      ...state,
      phase: isMatchOver ? 'match_over' : 'round_over',
      elapsedSec,
      localCrackHoldSec,
      partnerCrackHoldSec,
      localScore,
      partnerScore,
      lastWinner: winner,
      lastCrackedReason: reason,
      history: [
        ...state.history,
        {
          round: state.round,
          winner,
          durationSec: Math.round(elapsedSec * 10) / 10,
          crackedBy,
        },
      ],
    },
    event: 'round_end',
  };
}
