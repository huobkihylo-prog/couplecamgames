import type { FunambulesState, LaughSensitivity } from '../types/duoplay';
import { getSmileThreshold } from './laughRules';

export interface AiPartnerMemory {
  /** Accumulated amusement tension 0..100 in Tu ris, tu perds */
  amusement: number;
  /** Time since round started */
  laughPhaseSec: number;
  /** Target crack time for current round (randomized gently) */
  crackWindowSec: number;
  /** Smoothed head tilt output in radians for Les Funambules */
  smoothedTiltRad: number;
  /** Internal oscillation clock */
  clockSec: number;
}

export function createAiPartnerMemory(): AiPartnerMemory {
  return {
    amusement: 12,
    laughPhaseSec: 0,
    crackWindowSec: 9.5,
    smoothedTiltRad: 0,
    clockSec: 0,
  };
}

export function resetAiForLaughRound(memory: AiPartnerMemory, seed = Math.random()): AiPartnerMemory {
  return {
    ...memory,
    amusement: 8 + seed * 10,
    laughPhaseSec: 0,
    crackWindowSec: 7.5 + seed * 8.5,
  };
}

/**
 * Steps the simulated AI partner ("Camille IA") for Tu ris, tu perds.
 * Produces a realistic fluctuating smile score that reacts to prompt switches and time.
 */
export function stepAiLaughPartner(
  memory: AiPartnerMemory,
  isPlaying: boolean,
  sensitivity: LaughSensitivity,
  promptImpulse: number,
  dt: number,
): { nextMemory: AiPartnerMemory; smileScore: number } {
  const safeDt = Math.max(0, Math.min(dt, 0.05));
  const clockSec = memory.clockSec + safeDt;
  const threshold = getSmileThreshold(sensitivity);

  if (!isPlaying) {
    const idleSmile = Math.round(14 + Math.sin(clockSec * 1.4) * 6);
    return {
      nextMemory: {
        ...memory,
        clockSec,
        amusement: idleSmile,
      },
      smileScore: Math.max(0, Math.min(100, idleSmile)),
    };
  }

  const laughPhaseSec = memory.laughPhaseSec + safeDt;
  // Gradual giggle pressure + bursts when player changes prompt or nears crackWindowSec
  const wave = Math.sin(clockSec * 2.1) * 9 + Math.cos(clockSec * 3.7) * 5;
  const pressure =
    laughPhaseSec >= memory.crackWindowSec
      ? 26 * safeDt
      : 2.8 * safeDt;

  const nextAmusement = Math.max(
    4,
    Math.min(96, memory.amusement + pressure + promptImpulse - (laughPhaseSec < memory.crackWindowSec ? 1.1 * safeDt : 0)),
  );

  // Keep just below threshold until crackWindowSec unless prompted heavily
  const rawSmile = nextAmusement + wave;
  const capped =
    laughPhaseSec < memory.crackWindowSec - 0.5 && promptImpulse === 0
      ? Math.min(threshold - 4, rawSmile)
      : rawSmile;

  const smileScore = Math.max(0, Math.min(100, Math.round(capped)));

  return {
    nextMemory: {
      ...memory,
      clockSec,
      laughPhaseSec,
      amusement: nextAmusement,
    },
    smileScore,
  };
}

/**
 * Steps the simulated AI partner ("Camille IA") for Les Funambules.
 * Counterbalances wind & angle with realistic human reaction lag and gentle sway.
 */
export function stepAiFunambulesPartner(
  memory: AiPartnerMemory,
  gameState: FunambulesState,
  dt: number,
): { nextMemory: AiPartnerMemory; headTiltRad: number } {
  const safeDt = Math.max(0, Math.min(dt, 0.05));
  const clockSec = memory.clockSec + safeDt;

  if (gameState.phase !== 'playing') {
    const idleTilt = Math.sin(clockSec * 1.1) * 0.06;
    return {
      nextMemory: { ...memory, clockSec, smoothedTiltRad: idleTilt },
      headTiltRad: idleTilt,
    };
  }

  // Desired corrective tilt: opposes current lean + anticipates wind
  const angleTerm = -gameState.angleDeg * 0.011;
  const velTerm = -gameState.angularVelDeg * 0.0028;
  const windTerm = -gameState.windForce * 0.17;
  const humanImperfection = Math.sin(clockSec * 2.3) * 0.045;

  const targetTiltRad = Math.max(-0.34, Math.min(0.34, angleTerm + velTerm + windTerm + humanImperfection));
  // Smooth low-pass filter (~220ms reaction feel)
  const blend = 1 - Math.exp(-safeDt * 4.5);
  const smoothedTiltRad = memory.smoothedTiltRad + (targetTiltRad - memory.smoothedTiltRad) * blend;

  return {
    nextMemory: {
      ...memory,
      clockSec,
      smoothedTiltRad,
    },
    headTiltRad: smoothedTiltRad,
  };
}
