import type { ActiveHazard, FunambulesState, HazardKind } from '../types/duoplay';

export const FALL_ANGLE_DEG = 52;
export const TARGET_DISTANCE_M = 100;
export const SAFE_OPENING_SEC = 3.5;

export function createInitialFunambulesState(bestDistanceM = 0): FunambulesState {
  return {
    phase: 'ready',
    angleDeg: 0,
    angularVelDeg: 0,
    distanceM: 0,
    targetDistanceM: TARGET_DISTANCE_M,
    elapsedSec: 0,
    syncStreakSec: 0,
    bestSyncStreakSec: 0,
    harmonyScore: 0,
    bestDistanceM,
    windForce: 0,
    nextHazardIn: SAFE_OPENING_SEC,
    hazard: null,
    isSynced: false,
    hitstopSec: 0,
    trauma: 0,
    fallTimerSec: 0,
    fallDirection: 1,
    p1Input: 0,
    p2Input: 0,
  };
}

/**
 * Converts head roll angle (radians) + optional keyboard direction (-1, 0, +1)
 * into a smooth -1..+1 steering torque.
 */
export function computeHeadTiltInput(headTiltRad: number, keyboardDir: number): number {
  if (keyboardDir !== 0) {
    return Math.max(-1, Math.min(1, keyboardDir));
  }
  const deadzone = 0.035;
  const maxTilt = 0.30;
  if (Math.abs(headTiltRad) <= deadzone) {
    return 0;
  }
  const sign = headTiltRad >= 0 ? 1 : -1;
  const normalized = (Math.abs(headTiltRad) - deadzone) / (maxTilt - deadzone);
  return sign * Math.max(0, Math.min(1, normalized));
}

/**
 * Selects one of 3 distinct aerial hazard archetypes scaled by progress.
 */
export function createHazard(
  kind: Exclude<HazardKind, 'none'>,
  direction: -1 | 1,
  progressRatio: number,
): ActiveHazard {
  const difficulty = 1 + Math.min(0.65, progressRatio * 0.65);

  if (kind === 'pigeon') {
    return {
      kind: 'pigeon',
      direction,
      phase: 'telegraph',
      timer: 0,
      telegraphDuration: 0.95,
      activeDuration: 2.6,
      strength: 24 * difficulty,
      label: direction > 0 ? 'Pigeon sur la perche droite !' : 'Pigeon sur la perche gauche !',
    };
  }

  if (kind === 'whirlwind') {
    return {
      kind: 'whirlwind',
      direction,
      phase: 'telegraph',
      timer: 0,
      telegraphDuration: 0.9,
      activeDuration: 3.1,
      strength: 29 * difficulty,
      label: 'Tourbillon sur les toits !',
    };
  }

  return {
    kind: 'gust',
    direction,
    phase: 'telegraph',
    timer: 0,
    telegraphDuration: 0.85,
    activeDuration: 2.4,
    strength: 27 * difficulty,
    label: direction > 0 ? 'Rafale venant de gauche →' : '← Rafale venant de droite',
  };
}

function pickNextHazard(progressRatio: number, rng: () => number): ActiveHazard {
  const roll = rng();
  const direction: -1 | 1 = rng() < 0.5 ? -1 : 1;
  if (progressRatio > 0.25 && roll > 0.68) {
    return createHazard('whirlwind', direction, progressRatio);
  }
  if (progressRatio > 0.12 && roll > 0.36) {
    return createHazard('pigeon', direction, progressRatio);
  }
  return createHazard('gust', direction, progressRatio);
}

export interface FunambulesStepResult {
  nextState: FunambulesState;
  event: 'none' | 'hazard_telegraph' | 'hazard_hit' | 'sync_milestone' | 'fall' | 'victory';
}

/**
 * Pure physics simulation step for "Les Funambules".
 * Both players cooperatively tilt to counterbalance natural drift & aerial hazards.
 */
export function stepFunambulesPhysics(
  state: FunambulesState,
  p1InputRaw: number,
  p2InputRaw: number,
  dtRaw: number,
  rng: () => number = Math.random,
): FunambulesStepResult {
  const dt = Math.max(0, Math.min(dtRaw, 0.05));
  const p1Input = Math.max(-1, Math.min(1, p1InputRaw));
  const p2Input = Math.max(-1, Math.min(1, p2InputRaw));

  if (state.phase === 'falling') {
    const fallTimerSec = state.fallTimerSec + dt;
    const angleDeg = state.angleDeg + state.fallDirection * 115 * dt;
    const trauma = Math.max(0, state.trauma - dt * 1.4);
    if (fallTimerSec >= 0.55) {
      return {
        nextState: {
          ...state,
          phase: 'gameover',
          fallTimerSec,
          angleDeg,
          trauma: 0,
          bestDistanceM: Math.max(state.bestDistanceM, Math.round(state.distanceM * 10) / 10),
        },
        event: 'none',
      };
    }
    return {
      nextState: {
        ...state,
        fallTimerSec,
        angleDeg,
        trauma,
      },
      event: 'none',
    };
  }

  if (state.phase !== 'playing') {
    return { nextState: state, event: 'none' };
  }

  // Hitstop freezes simulation physics while trauma still decays
  if (state.hitstopSec > 0) {
    return {
      nextState: {
        ...state,
        hitstopSec: Math.max(0, state.hitstopSec - dt),
        trauma: Math.max(0, state.trauma - dt * 1.5),
      },
      event: 'none',
    };
  }

  const elapsedSec = state.elapsedSec + dt;
  const progressRatio = Math.min(1, state.distanceM / state.targetDistanceM);
  let event: FunambulesStepResult['event'] = 'none';
  let trauma = Math.max(0, state.trauma - dt * 1.6);
  let hitstopSec = 0;

  // Update active hazard lifecycle
  let hazard = state.hazard ? { ...state.hazard } : null;
  let nextHazardIn = state.nextHazardIn;
  let hazardTorqueDeg = 0;

  if (hazard) {
    hazard.timer += dt;
    if (hazard.phase === 'telegraph') {
      // Gentle foreshadowing breeze during telegraph
      hazardTorqueDeg = hazard.direction * hazard.strength * 0.14;
      if (hazard.timer >= hazard.telegraphDuration) {
        hazard.phase = 'active';
        hazard.timer = 0;
        trauma = Math.min(1, trauma + 0.25);
        event = 'hazard_hit';
      }
    } else {
      const tNorm = Math.min(1, hazard.timer / hazard.activeDuration);
      if (hazard.kind === 'whirlwind') {
        // Oscillating cross-wind pushing back and forth
        hazardTorqueDeg =
          hazard.direction * hazard.strength * Math.sin(tNorm * Math.PI * 2.5) * 1.05;
      } else if (hazard.kind === 'pigeon') {
        // Sudden perch weight followed by steady lean until takeoff
        const envelope = tNorm < 0.15 ? tNorm / 0.15 : tNorm > 0.85 ? (1 - tNorm) / 0.15 : 1;
        hazardTorqueDeg = hazard.direction * hazard.strength * envelope;
      } else {
        // Smooth gust bell curve
        const envelope = Math.sin(tNorm * Math.PI);
        hazardTorqueDeg = hazard.direction * hazard.strength * (0.35 + 0.65 * envelope);
      }

      if (hazard.timer >= hazard.activeDuration) {
        hazard = null;
        // Shorter breather as distance progresses
        nextHazardIn = Math.max(1.8, 3.6 - progressRatio * 1.4);
      }
    }
  } else {
    nextHazardIn -= dt;
    if (nextHazardIn <= 0) {
      hazard = pickNextHazard(progressRatio, rng);
      event = 'hazard_telegraph';
    }
  }

  // Gentle ambient rooftop sway after opening grace period (so first ~3.5s are calm & survivable with no input)
  const ambientRamp = Math.min(1, Math.max(0, (elapsedSec - 1.2) / 3.0));
  const ambientBreeze =
    ambientRamp *
    (Math.sin(elapsedSec * 0.85) * 5.2 + Math.cos(elapsedSec * 1.45) * 3.0);

  // Combined cooperative steering torque: each partner contributes up to 44 deg/s^2
  // When both lean together against the current angle/wind, they gain crisp control
  const combinedControl = p1Input * 44 + p2Input * 44;

  // Inverted pendulum gravity pull (grows stronger the further tilted you get)
  const angleRad = (state.angleDeg * Math.PI) / 180;
  const gravityTorque = Math.sin(angleRad) * (32 + progressRatio * 10);

  // Natural pole rotational inertia damping
  const damping = -state.angularVelDeg * 2.55;

  const totalAccel = gravityTorque + ambientBreeze + hazardTorqueDeg + combinedControl + damping;
  const angularVelDeg = Math.max(-130, Math.min(130, state.angularVelDeg + totalAccel * dt));
  const angleDeg = state.angleDeg + angularVelDeg * dt;

  // Determine cooperative synchronization:
  // Either both lean in the same helpful counter-direction during a tilt, or stay gently centered
  const needsCorrection = Math.abs(angleDeg) > 6 || Math.abs(hazardTorqueDeg) > 6;
  const desiredSign = angleDeg >= 0 ? -1 : 1;
  const bothHelping =
    needsCorrection &&
    p1Input * desiredSign > 0.15 &&
    p2Input * desiredSign > 0.15;
  const calmlyCentered = Math.abs(angleDeg) <= 12 && Math.abs(angularVelDeg) < 15;
  const isSynced = bothHelping || calmlyCentered;

  const prevStreakFloor = Math.floor(state.syncStreakSec / 5);
  const syncStreakSec = isSynced ? state.syncStreakSec + dt : Math.max(0, state.syncStreakSec - dt * 2);
  const bestSyncStreakSec = Math.max(state.bestSyncStreakSec, syncStreakSec);
  if (Math.floor(syncStreakSec / 5) > prevStreakFloor && event === 'none') {
    event = 'sync_milestone';
  }

  // Forward walking speed slows down if wildly off-balance, speeds up when steady
  const stabilityRatio = Math.max(0.25, 1 - Math.abs(angleDeg) / FALL_ANGLE_DEG);
  const speedMps = (2.15 + progressRatio * 0.65) * (0.55 + 0.45 * stabilityRatio);
  const distanceM = Math.min(state.targetDistanceM, state.distanceM + speedMps * dt);

  const harmonyRate = bothHelping ? 35 : calmlyCentered ? 18 : 4;
  const harmonyScore = state.harmonyScore + harmonyRate * dt;
  const windForce = Math.max(-1, Math.min(1, (ambientBreeze + hazardTorqueDeg) / 36));

  // Check Victory first
  if (distanceM >= state.targetDistanceM) {
    return {
      nextState: {
        ...state,
        phase: 'victory',
        angleDeg: angleDeg * 0.3,
        angularVelDeg: 0,
        distanceM: state.targetDistanceM,
        elapsedSec,
        syncStreakSec,
        bestSyncStreakSec,
        harmonyScore: Math.round(harmonyScore + 250),
        bestDistanceM: state.targetDistanceM,
        windForce: 0,
        hazard: null,
        isSynced: true,
        trauma: 0,
        hitstopSec: 0,
        p1Input,
        p2Input,
      },
      event: 'victory',
    };
  }

  // Check Fall condition
  if (Math.abs(angleDeg) >= FALL_ANGLE_DEG) {
    const fallDirection: -1 | 1 = angleDeg >= 0 ? 1 : -1;
    hitstopSec = 0.05;
    return {
      nextState: {
        ...state,
        phase: 'falling',
        angleDeg: fallDirection * FALL_ANGLE_DEG,
        angularVelDeg,
        distanceM,
        elapsedSec,
        syncStreakSec: 0,
        bestSyncStreakSec,
        harmonyScore: Math.round(harmonyScore),
        bestDistanceM: Math.max(state.bestDistanceM, Math.round(distanceM * 10) / 10),
        windForce,
        hazard,
        isSynced: false,
        hitstopSec,
        trauma: 0.9,
        fallTimerSec: 0,
        fallDirection,
        p1Input,
        p2Input,
      },
      event: 'fall',
    };
  }

  return {
    nextState: {
      ...state,
      angleDeg,
      angularVelDeg,
      distanceM,
      elapsedSec,
      syncStreakSec,
      bestSyncStreakSec,
      harmonyScore,
      bestDistanceM: Math.max(state.bestDistanceM, Math.round(distanceM * 10) / 10),
      windForce,
      nextHazardIn,
      hazard,
      isSynced,
      hitstopSec,
      trauma,
      p1Input,
      p2Input,
    },
    event,
  };
}
