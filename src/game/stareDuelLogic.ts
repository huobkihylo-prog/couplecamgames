import type { StareDuelState, StareTrapKind } from '../types/duoplay';

export const BLINK_SINGLE_THRESHOLD = 0.56;
export const BLINK_AVG_THRESHOLD = 0.48;
export const AUTO_TRAP_INTERVAL_SEC = 5;
export const DISTRACTION_COOLDOWN_SEC = 4;
export const TARGET_STARE_WINS = 3;

export function createInitialStareDuelState(bestStareSec = 0): StareDuelState {
  return {
    phase: 'ready',
    round: 1,
    targetWins: TARGET_STARE_WINS,
    localScore: 0,
    partnerScore: 0,
    countdownSec: 3,
    elapsedSec: 0,
    bestStareSec,
    nextAutoTrapSec: AUTO_TRAP_INTERVAL_SEC,
    activeTrap: null,
    activeTrapTimerSec: 0,
    distractionCooldownSec: 0,
    lastWinner: null,
    lastRoundDurationSec: 0,
  };
}

export function startStareRound(prev: StareDuelState): StareDuelState {
  const isFreshMatch = prev.phase === 'match_over' || prev.phase === 'ready';
  return {
    ...prev,
    phase: 'countdown',
    round: isFreshMatch ? 1 : prev.round + 1,
    localScore: isFreshMatch ? 0 : prev.localScore,
    partnerScore: isFreshMatch ? 0 : prev.partnerScore,
    countdownSec: 3,
    elapsedSec: 0,
    nextAutoTrapSec: AUTO_TRAP_INTERVAL_SEC,
    activeTrap: null,
    activeTrapTimerSec: 0,
    distractionCooldownSec: 0,
    lastWinner: null,
  };
}

/**
 * Determines whether the player blinked based on MediaPipe FaceLandmarker eyeBlinkLeft/Right
 * or manual keyboard fallback.
 */
export function detectEyeBlink(
  eyeBlinkLeft: number,
  eyeBlinkRight: number,
  manualBlink = false,
): boolean {
  if (manualBlink) return true;
  if (eyeBlinkLeft >= BLINK_SINGLE_THRESHOLD || eyeBlinkRight >= BLINK_SINGLE_THRESHOLD) {
    return true;
  }
  return (eyeBlinkLeft + eyeBlinkRight) * 0.5 >= BLINK_AVG_THRESHOLD;
}

export interface StareStepResult {
  nextState: StareDuelState;
  event: 'none' | 'countdown_tick' | 'go' | 'auto_trap' | 'local_blinked' | 'partner_blinked';
  triggeredTrap: StareTrapKind | null;
}

export function triggerVisualTrap(
  state: StareDuelState,
  kind: StareTrapKind,
): StareDuelState {
  return {
    ...state,
    activeTrap: kind,
    activeTrapTimerSec: kind === 'fly' ? 3.2 : 0.9,
  };
}

export function stepStareDuel(
  state: StareDuelState,
  localHasBlinked: boolean,
  partnerHasBlinked: boolean,
  dtRaw: number,
): StareStepResult {
  const dt = Math.max(0.001, Math.min(dtRaw, 0.05));

  if (state.phase === 'countdown') {
    const prevCeil = Math.ceil(state.countdownSec);
    const nextCountdown = Math.max(0, state.countdownSec - dt);
    const nextCeil = Math.ceil(nextCountdown);

    if (nextCountdown <= 0) {
      return {
        nextState: {
          ...state,
          phase: 'playing',
          countdownSec: 0,
          elapsedSec: 0,
          nextAutoTrapSec: AUTO_TRAP_INTERVAL_SEC,
        },
        event: 'go',
        triggeredTrap: null,
      };
    }

    return {
      nextState: { ...state, countdownSec: nextCountdown },
      event: nextCeil < prevCeil ? 'countdown_tick' : 'none',
      triggeredTrap: null,
    };
  }

  if (state.phase !== 'playing') {
    return { nextState: state, event: 'none', triggeredTrap: null };
  }

  const elapsedSec = state.elapsedSec + dt;
  const bestStareSec = Math.max(state.bestStareSec, Math.round(elapsedSec * 10) / 10);
  const distractionCooldownSec = Math.max(0, state.distractionCooldownSec - dt);

  let activeTrap = state.activeTrap;
  let activeTrapTimerSec = Math.max(0, state.activeTrapTimerSec - dt);
  if (activeTrapTimerSec <= 0) {
    activeTrap = null;
  }

  // Every 5 seconds, automatically trigger a visual trap (alternating virtual fly & surprise flash)
  let nextAutoTrapSec = state.nextAutoTrapSec - dt;
  let triggeredTrap: StareTrapKind | null = null;
  let event: StareStepResult['event'] = 'none';

  if (nextAutoTrapSec <= 0) {
    nextAutoTrapSec = AUTO_TRAP_INTERVAL_SEC;
    const trapIndex = Math.floor(elapsedSec / AUTO_TRAP_INTERVAL_SEC);
    triggeredTrap = trapIndex % 2 === 1 ? 'fly' : 'flash';
    activeTrap = triggeredTrap;
    activeTrapTimerSec = triggeredTrap === 'fly' ? 3.2 : 0.9;
    event = 'auto_trap';
  }

  // Check blink outcomes after 0.45s opening grace period so players don't lose on the exact "GO" blink
  if (elapsedSec >= 0.45) {
    if (localHasBlinked) {
      const partnerScore = state.partnerScore + 1;
      const isMatchOver = partnerScore >= state.targetWins;
      return {
        nextState: {
          ...state,
          phase: isMatchOver ? 'match_over' : 'round_over',
          partnerScore,
          elapsedSec,
          bestStareSec,
          lastWinner: 'partner',
          lastRoundDurationSec: Math.round(elapsedSec * 10) / 10,
          activeTrap: null,
          activeTrapTimerSec: 0,
          distractionCooldownSec,
        },
        event: 'local_blinked',
        triggeredTrap: null,
      };
    }

    if (partnerHasBlinked) {
      const localScore = state.localScore + 1;
      const isMatchOver = localScore >= state.targetWins;
      return {
        nextState: {
          ...state,
          phase: isMatchOver ? 'match_over' : 'round_over',
          localScore,
          elapsedSec,
          bestStareSec,
          lastWinner: 'local',
          lastRoundDurationSec: Math.round(elapsedSec * 10) / 10,
          activeTrap: null,
          activeTrapTimerSec: 0,
          distractionCooldownSec,
        },
        event: 'partner_blinked',
        triggeredTrap: null,
      };
    }
  }

  return {
    nextState: {
      ...state,
      elapsedSec,
      bestStareSec,
      nextAutoTrapSec,
      activeTrap,
      activeTrapTimerSec,
      distractionCooldownSec,
    },
    event,
    triggeredTrap,
  };
}

export interface StareAiMemory {
  enduranceSec: number;
  fatigueSec: number;
}

export function createStareAiMemory(rng: () => number = Math.random): StareAiMemory {
  return {
    enduranceSec: 10 + rng() * 11,
    fatigueSec: 0,
  };
}

/**
 * Solo Mode AI Partner ("Camille IA") for Duel de Regard.
 * Resists blinking, feels extra pressure when you send a distraction, and eventually blinks!
 */
export function stepAiStarePartner(
  memory: StareAiMemory,
  isPlaying: boolean,
  distractionImpulseSec: number,
  dtRaw: number,
): { nextMemory: StareAiMemory; hasBlinked: boolean; blinkRatio: number } {
  if (!isPlaying) {
    return { nextMemory: memory, hasBlinked: false, blinkRatio: 0.05 };
  }
  const dt = Math.max(0.001, Math.min(dtRaw, 0.05));
  const fatigueSec = memory.fatigueSec + dt + distractionImpulseSec;
  const ratio = Math.min(1, fatigueSec / Math.max(2, memory.enduranceSec));
  const hasBlinked = fatigueSec >= memory.enduranceSec;
  // Subtle eye-twitch buildup as fatigue nears limit
  const blinkRatio = hasBlinked ? 0.92 : Math.min(0.42, ratio * ratio * 0.38);
  return {
    nextMemory: { ...memory, fatigueSec },
    hasBlinked,
    blinkRatio,
  };
}
