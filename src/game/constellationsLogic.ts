import type { ConstellationPattern, ConstellationState } from '../types/duoplay';

export const CONSTELLATION_W = 1000;
export const CONSTELLATION_H = 560;
export const STAR_TOUCH_RADIUS = 0.088;
export const STAR_HOLD_DURATION_SEC = 0.2;

export const CONSTELLATION_PATTERNS: ConstellationPattern[] = [
  {
    id: 'heart',
    stars: [
      { id: 1, x: 0.5, y: 0.36 },
      { id: 2, x: 0.34, y: 0.24 },
      { id: 3, x: 0.24, y: 0.44 },
      { id: 4, x: 0.5, y: 0.78 },
      { id: 5, x: 0.76, y: 0.44 },
      { id: 6, x: 0.66, y: 0.24 },
    ],
    edges: [
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 1],
    ],
  },
  {
    id: 'moon',
    stars: [
      { id: 1, x: 0.58, y: 0.18 },
      { id: 2, x: 0.38, y: 0.28 },
      { id: 3, x: 0.3, y: 0.5 },
      { id: 4, x: 0.4, y: 0.74 },
      { id: 5, x: 0.62, y: 0.8 },
      { id: 6, x: 0.48, y: 0.52 },
    ],
    edges: [
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 1],
    ],
  },
  {
    id: 'infinity',
    stars: [
      { id: 1, x: 0.5, y: 0.5 },
      { id: 2, x: 0.34, y: 0.28 },
      { id: 3, x: 0.2, y: 0.5 },
      { id: 4, x: 0.34, y: 0.72 },
      { id: 5, x: 0.66, y: 0.28 },
      { id: 6, x: 0.8, y: 0.5 },
      { id: 7, x: 0.66, y: 0.72 },
    ],
    edges: [
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 1],
      [1, 5],
      [5, 6],
      [6, 7],
      [7, 1],
    ],
  },
  {
    id: 'twins',
    stars: [
      { id: 1, x: 0.34, y: 0.24 },
      { id: 2, x: 0.22, y: 0.54 },
      { id: 3, x: 0.44, y: 0.72 },
      { id: 4, x: 0.56, y: 0.46 },
      { id: 5, x: 0.76, y: 0.28 },
      { id: 6, x: 0.74, y: 0.68 },
    ],
    edges: [
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 1],
      [4, 5],
      [5, 6],
      [6, 4],
    ],
  },
];

export interface ConstellationStepInput {
  localX: number;
  localY: number;
  localActive: boolean;
  partnerX: number;
  partnerY: number;
  partnerActive: boolean;
  promptCount: number;
}

export interface ConstellationStepEvents {
  activatedStar: { id: number; x: number; y: number } | null;
  completedConstellation: boolean;
}

export function createInitialConstellationState(): ConstellationState {
  return {
    phase: 'ready',
    constellationIndex: 0,
    activatedStarIds: [],
    completedCount: 0,
    activePromptIndex: 0,
    starHoldProgress: 0,
    elapsedSec: 0,
  };
}

export function getActiveConstellation(state: ConstellationState): ConstellationPattern {
  return CONSTELLATION_PATTERNS[state.constellationIndex % CONSTELLATION_PATTERNS.length];
}

export function getNextTargetStar(state: ConstellationState) {
  const pattern = getActiveConstellation(state);
  return pattern.stars[state.activatedStarIds.length] ?? null;
}

export function activateConstellationStar(
  state: ConstellationState,
  starId: number,
  promptCount: number,
): { nextState: ConstellationState; completed: boolean } {
  const pattern = getActiveConstellation(state);
  const nextStar = pattern.stars[state.activatedStarIds.length];
  if (!nextStar || nextStar.id !== starId || state.activatedStarIds.includes(starId)) {
    return { nextState: state, completed: false };
  }

  const nextIds = [...state.activatedStarIds, starId];
  const completed = nextIds.length >= pattern.stars.length;

  return {
    completed,
    nextState: {
      ...state,
      activatedStarIds: nextIds,
      starHoldProgress: 0,
      phase: completed ? 'revealed' : state.phase,
      completedCount: completed ? state.completedCount + 1 : state.completedCount,
      activePromptIndex: completed
        ? (state.completedCount) % Math.max(1, promptCount)
        : state.activePromptIndex,
    },
  };
}

export function advanceToNextConstellation(
  state: ConstellationState,
  promptCount: number,
  forcedIndex?: number,
): ConstellationState {
  const nextIdx =
    forcedIndex !== undefined
      ? forcedIndex % CONSTELLATION_PATTERNS.length
      : (state.constellationIndex + 1) % CONSTELLATION_PATTERNS.length;
  return {
    ...state,
    phase: 'playing',
    constellationIndex: nextIdx,
    activatedStarIds: [],
    starHoldProgress: 0,
    activePromptIndex: (state.activePromptIndex + 1) % Math.max(1, promptCount),
  };
}

export function stepAiConstellationPartner(
  current: { x: number; y: number },
  state: ConstellationState,
  dt: number,
): { x: number; y: number } {
  const target = getNextTargetStar(state);
  const tx = target ? target.x : 0.5 + Math.cos(state.elapsedSec * 0.7) * 0.14;
  const ty = target ? target.y : 0.5 + Math.sin(state.elapsedSec * 0.9) * 0.12;
  const blend = Math.min(1, dt * 4.2);
  return {
    x: current.x + (tx - current.x) * blend,
    y: current.y + (ty - current.y) * blend,
  };
}

export function stepConstellationGame(
  state: ConstellationState,
  input: ConstellationStepInput,
  rawDt: number,
): { nextState: ConstellationState; events: ConstellationStepEvents } {
  const events: ConstellationStepEvents = {
    activatedStar: null,
    completedConstellation: false,
  };

  if (state.phase !== 'playing') {
    return { nextState: state, events };
  }

  const dt = Math.min(0.05, Math.max(0.001, rawDt));
  const nextStar = getNextTargetStar(state);
  if (!nextStar) {
    return { nextState: { ...state, elapsedSec: state.elapsedSec + dt }, events };
  }

  const distLocal = Math.hypot(input.localX - nextStar.x, input.localY - nextStar.y);
  const distPartner = Math.hypot(input.partnerX - nextStar.x, input.partnerY - nextStar.y);
  const localOnStar = input.localActive && distLocal <= STAR_TOUCH_RADIUS;
  const partnerOnStar = input.partnerActive && distPartner <= STAR_TOUCH_RADIUS * 1.15;

  // Both virtual fingertips touching the star together ignites it!
  let progress = state.starHoldProgress;
  if (localOnStar && partnerOnStar) {
    progress = Math.min(1, progress + dt / STAR_HOLD_DURATION_SEC);
  } else if (localOnStar || partnerOnStar) {
    // Soft shimmer while waiting for partner's fingertip to join on the star
    progress = Math.max(0, Math.min(0.35, progress + dt * 0.45));
  } else {
    progress = Math.max(0, progress - dt * 1.8);
  }

  if (progress >= 1) {
    const res = activateConstellationStar(state, nextStar.id, input.promptCount);
    events.activatedStar = { id: nextStar.id, x: nextStar.x, y: nextStar.y };
    events.completedConstellation = res.completed;
    return {
      nextState: { ...res.nextState, elapsedSec: state.elapsedSec + dt },
      events,
    };
  }

  return {
    nextState: {
      ...state,
      starHoldProgress: progress,
      elapsedSec: state.elapsedSec + dt,
    },
    events,
  };
}
