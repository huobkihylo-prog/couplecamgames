import type { AirHockeyState } from '../types/duoplay';

export const HOCKEY_W = 1000;
export const HOCKEY_H = 600;
export const PUCK_R = 20;
export const MALLET_R = 36;
export const GOAL_HALF_H = 108;
export const TARGET_GOALS = 7;
export const MAX_PUCK_SPEED = 1360;
export const MIN_STRIKE_SPEED = 360;

export interface PaddleTarget {
  /** Normalized 0..1 inside the player's own half (0 = own backline, 1 = center line) or full-half X */
  x: number;
  /** Normalized 0..1 vertical coordinate */
  y: number;
}

export interface AirHockeyStepResult {
  nextState: AirHockeyState;
  event: 'none' | 'puck_hit' | 'wall_bounce' | 'goal_p1' | 'goal_p2' | 'gameover';
  impactStrength: number;
}

export function createInitialAirHockeyState(): AirHockeyState {
  return {
    phase: 'ready',
    puckX: HOCKEY_W * 0.5,
    puckY: HOCKEY_H * 0.5,
    puckVx: 0,
    puckVy: 0,
    p1X: 165,
    p1Y: HOCKEY_H * 0.5,
    p1Vx: 0,
    p1Vy: 0,
    p2X: HOCKEY_W - 165,
    p2Y: HOCKEY_H * 0.5,
    p2Vx: 0,
    p2Vy: 0,
    p1Score: 0,
    p2Score: 0,
    targetGoals: TARGET_GOALS,
    lastScorer: null,
    winner: null,
    goalPauseSec: 0,
    elapsedSec: 0,
    rallyHits: 0,
    maxPuckSpeed: 0,
    hitstopSec: 0,
    trauma: 0,
    lastImpactX: HOCKEY_W * 0.5,
    lastImpactY: HOCKEY_H * 0.5,
    lastImpactStrength: 0,
  };
}

/**
 * Starts a fresh match with a crisp opening puck serve.
 */
export function startAirHockeyMatch(serveDir: -1 | 1 = -1): AirHockeyState {
  const base = createInitialAirHockeyState();
  return {
    ...base,
    phase: 'playing',
    puckX: HOCKEY_W * 0.5,
    puckY: HOCKEY_H * 0.5,
    puckVx: serveDir * 310,
    puckVy: (serveDir > 0 ? 1 : -1) * 95,
  };
}

/**
 * Maps a player's normalized hand coordinates (0..1, 0..1) cleanly into their half of the neon rink.
 */
export function mapHandToHalfCoords(
  side: 'left' | 'right',
  normX: number,
  normY: number,
): { x: number; y: number } {
  const cx = Math.max(0, Math.min(1, normX));
  const cy = Math.max(0, Math.min(1, normY));
  const minY = MALLET_R + 10;
  const maxY = HOCKEY_H - MALLET_R - 10;

  if (side === 'left') {
    const minX = MALLET_R + 12;
    const maxX = HOCKEY_W * 0.5 - MALLET_R - 4;
    return {
      x: minX + cx * (maxX - minX),
      y: minY + cy * (maxY - minY),
    };
  }

  const minX = HOCKEY_W * 0.5 + MALLET_R + 4;
  const maxX = HOCKEY_W - MALLET_R - 12;
  return {
    x: minX + cx * (maxX - minX),
    y: minY + cy * (maxY - minY),
  };
}

function resolveMalletPuckCollision(
  puckX: number,
  puckY: number,
  puckVx: number,
  puckVy: number,
  mx: number,
  my: number,
  mvx: number,
  mvy: number,
): {
  hit: boolean;
  puckX: number;
  puckY: number;
  puckVx: number;
  puckVy: number;
  strength: number;
} {
  const dx = puckX - mx;
  const dy = puckY - my;
  const minDist = PUCK_R + MALLET_R;
  const distSq = dx * dx + dy * dy;

  if (distSq >= minDist * minDist) {
    return { hit: false, puckX, puckY, puckVx, puckVy, strength: 0 };
  }

  const dist = Math.sqrt(distSq) || 0.001;
  const nx = dx / dist;
  const ny = dy / dist;

  // Push puck outside mallet radius cleanly so it can never get pinned inside
  const resolvedX = mx + nx * (minDist + 1.5);
  const resolvedY = my + ny * (minDist + 1.5);

  // Relative velocity along collision normal
  const relVx = puckVx - mvx;
  const relVy = puckVy - mvy;
  const relDotN = relVx * nx + relVy * ny;

  // Compute reflected velocity + strong mallet speed transfer (faster hand = faster blast!)
  let outVx = puckVx;
  let outVy = puckVy;
  if (relDotN < 0) {
    const restitution = 0.88;
    outVx = puckVx - (1 + restitution) * relDotN * nx;
    outVy = puckVy - (1 + restitution) * relDotN * ny;
  }

  const malletSpeed = Math.hypot(mvx, mvy);
  outVx += mvx * 0.58 + nx * (110 + malletSpeed * 0.32);
  outVy += mvy * 0.58 + ny * (110 + malletSpeed * 0.32);

  let speed = Math.hypot(outVx, outVy);
  const targetMin = Math.min(MAX_PUCK_SPEED, MIN_STRIKE_SPEED + malletSpeed * 0.42);
  if (speed < targetMin && speed > 0.001) {
    outVx = (outVx / speed) * targetMin;
    outVy = (outVy / speed) * targetMin;
    speed = targetMin;
  } else if (speed > MAX_PUCK_SPEED) {
    outVx = (outVx / speed) * MAX_PUCK_SPEED;
    outVy = (outVy / speed) * MAX_PUCK_SPEED;
    speed = MAX_PUCK_SPEED;
  }

  const strength = Math.max(0.2, Math.min(1, speed / MAX_PUCK_SPEED));
  return {
    hit: true,
    puckX: resolvedX,
    puckY: resolvedY,
    puckVx: outVx,
    puckVy: outVy,
    strength,
  };
}

/**
 * Authoritative Host physics simulation step for "Air Hockey des Mains".
 * P1 controls left half, P2 controls right half. First to 7 goals wins.
 */
export function stepAirHockeyPhysics(
  state: AirHockeyState,
  p1TargetArena: { x: number; y: number },
  p2TargetArena: { x: number; y: number },
  dtRaw: number,
): AirHockeyStepResult {
  const dt = Math.max(0.001, Math.min(dtRaw, 0.05));
  const trauma = Math.max(0, state.trauma - dt * 2.1);

  if (state.phase === 'goal_pause') {
    const remaining = state.goalPauseSec - dt;
    if (remaining <= 0) {
      // Serve toward the player who just conceded
      const serveDir = state.lastScorer === 'p1' ? 1 : -1;
      return {
        nextState: {
          ...state,
          phase: 'playing',
          goalPauseSec: 0,
          puckX: HOCKEY_W * 0.5,
          puckY: HOCKEY_H * 0.5,
          puckVx: serveDir * 330,
          puckVy: (state.p1Score + state.p2Score) % 2 === 0 ? 115 : -115,
          trauma,
        },
        event: 'none',
        impactStrength: 0,
      };
    }
    return {
      nextState: {
        ...state,
        goalPauseSec: remaining,
        trauma,
      },
      event: 'none',
      impactStrength: 0,
    };
  }

  if (state.phase !== 'playing') {
    return { nextState: { ...state, trauma }, event: 'none', impactStrength: 0 };
  }

  if (state.hitstopSec > 0) {
    return {
      nextState: {
        ...state,
        hitstopSec: Math.max(0, state.hitstopSec - dt),
        trauma,
      },
      event: 'none',
      impactStrength: 0,
    };
  }

  const elapsedSec = state.elapsedSec + dt;

  // Clamp paddles cleanly inside their respective halves & compute velocities
  const clampedP1X = Math.max(MALLET_R + 12, Math.min(HOCKEY_W * 0.5 - MALLET_R - 4, p1TargetArena.x));
  const clampedP1Y = Math.max(MALLET_R + 10, Math.min(HOCKEY_H - MALLET_R - 10, p1TargetArena.y));
  const clampedP2X = Math.max(HOCKEY_W * 0.5 + MALLET_R + 4, Math.min(HOCKEY_W - MALLET_R - 12, p2TargetArena.x));
  const clampedP2Y = Math.max(MALLET_R + 10, Math.min(HOCKEY_H - MALLET_R - 10, p2TargetArena.y));

  // Smooth rapid follow so mallet velocity reflects true hand motion without teleports
  const maxMalletMove = 1750 * dt;
  const moveTowards = (currX: number, currY: number, tx: number, ty: number) => {
    const dx = tx - currX;
    const dy = ty - currY;
    const d = Math.hypot(dx, dy);
    const scale = d > maxMalletMove && d > 0.001 ? maxMalletMove / d : 1;
    const nx = currX + dx * scale;
    const ny = currY + dy * scale;
    return { x: nx, y: ny, vx: (nx - currX) / dt, vy: (ny - currY) / dt };
  };

  const p1 = moveTowards(state.p1X, state.p1Y, clampedP1X, clampedP1Y);
  const p2 = moveTowards(state.p2X, state.p2Y, clampedP2X, clampedP2Y);

  // Sub-step puck motion (2 substeps) to prevent high-speed tunneling
  let puckX = state.puckX;
  let puckY = state.puckY;
  let puckVx = state.puckVx;
  let puckVy = state.puckVy;
  let event: AirHockeyStepResult['event'] = 'none';
  let impactStrength = 0;
  let rallyHits = state.rallyHits;
  let maxPuckSpeed = state.maxPuckSpeed;
  let hitstopSec = 0;
  let nextTrauma = trauma;
  let lastImpactX = state.lastImpactX;
  let lastImpactY = state.lastImpactY;
  let lastImpactStrength = Math.max(0, state.lastImpactStrength - dt * 2.5);

  const subSteps = 2;
  const subDt = dt / subSteps;
  const glideFriction = Math.pow(0.994, subDt * 60);

  for (let s = 0; s < subSteps; s++) {
    puckX += puckVx * subDt;
    puckY += puckVy * subDt;
    puckVx *= glideFriction;
    puckVy *= glideFriction;

    // Resolve P1 mallet collision
    const hit1 = resolveMalletPuckCollision(puckX, puckY, puckVx, puckVy, p1.x, p1.y, p1.vx, p1.vy);
    if (hit1.hit) {
      puckX = hit1.puckX;
      puckY = hit1.puckY;
      puckVx = hit1.puckVx;
      puckVy = hit1.puckVy;
      event = 'puck_hit';
      impactStrength = Math.max(impactStrength, hit1.strength);
      rallyHits += 1;
      lastImpactX = (p1.x + puckX) * 0.5;
      lastImpactY = (p1.y + puckY) * 0.5;
      lastImpactStrength = hit1.strength;
      if (hit1.strength > 0.72) {
        hitstopSec = 0.03;
        nextTrauma = Math.max(nextTrauma, 0.35);
      }
    }

    // Resolve P2 mallet collision
    const hit2 = resolveMalletPuckCollision(puckX, puckY, puckVx, puckVy, p2.x, p2.y, p2.vx, p2.vy);
    if (hit2.hit) {
      puckX = hit2.puckX;
      puckY = hit2.puckY;
      puckVx = hit2.puckVx;
      puckVy = hit2.puckVy;
      event = 'puck_hit';
      impactStrength = Math.max(impactStrength, hit2.strength);
      rallyHits += 1;
      lastImpactX = (p2.x + puckX) * 0.5;
      lastImpactY = (p2.y + puckY) * 0.5;
      lastImpactStrength = hit2.strength;
      if (hit2.strength > 0.72) {
        hitstopSec = 0.03;
        nextTrauma = Math.max(nextTrauma, 0.35);
      }
    }

    // Top & bottom cushion bounces
    if (puckY < PUCK_R + 6) {
      puckY = PUCK_R + 6;
      puckVy = Math.abs(puckVy) * 0.96;
      if (event === 'none') event = 'wall_bounce';
    } else if (puckY > HOCKEY_H - PUCK_R - 6) {
      puckY = HOCKEY_H - PUCK_R - 6;
      puckVy = -Math.abs(puckVy) * 0.96;
      if (event === 'none') event = 'wall_bounce';
    }

    const inGoalMouth = Math.abs(puckY - HOCKEY_H * 0.5) <= GOAL_HALF_H - PUCK_R * 0.3;

    // Left wall or Left Goal (P2 scores!)
    if (puckX < PUCK_R + 6) {
      if (inGoalMouth) {
        if (puckX < -PUCK_R * 0.25) {
          const p2Score = state.p2Score + 1;
          const isMatchOver = p2Score >= state.targetGoals;
          return {
            nextState: {
              ...state,
              phase: isMatchOver ? 'gameover' : 'goal_pause',
              puckX: -30,
              puckY,
              puckVx: 0,
              puckVy: 0,
              p1X: p1.x,
              p1Y: p1.y,
              p1Vx: 0,
              p1Vy: 0,
              p2X: p2.x,
              p2Y: p2.y,
              p2Vx: 0,
              p2Vy: 0,
              p2Score,
              lastScorer: 'p2',
              winner: isMatchOver ? 'p2' : null,
              goalPauseSec: isMatchOver ? 0 : 1.05,
              elapsedSec,
              rallyHits,
              maxPuckSpeed: Math.max(maxPuckSpeed, Math.round(Math.hypot(puckVx, puckVy))),
              hitstopSec: 0.06,
              trauma: 0.75,
              lastImpactX: 16,
              lastImpactY: puckY,
              lastImpactStrength: 1,
            },
            event: isMatchOver ? 'gameover' : 'goal_p2',
            impactStrength: 1,
          };
        }
      } else {
        puckX = PUCK_R + 6;
        puckVx = Math.abs(puckVx) * 0.95;
        if (event === 'none') event = 'wall_bounce';
      }
    }

    // Right wall or Right Goal (P1 scores!)
    if (puckX > HOCKEY_W - PUCK_R - 6) {
      if (inGoalMouth) {
        if (puckX > HOCKEY_W + PUCK_R * 0.25) {
          const p1Score = state.p1Score + 1;
          const isMatchOver = p1Score >= state.targetGoals;
          return {
            nextState: {
              ...state,
              phase: isMatchOver ? 'gameover' : 'goal_pause',
              puckX: HOCKEY_W + 30,
              puckY,
              puckVx: 0,
              puckVy: 0,
              p1X: p1.x,
              p1Y: p1.y,
              p1Vx: 0,
              p1Vy: 0,
              p2X: p2.x,
              p2Y: p2.y,
              p2Vx: 0,
              p2Vy: 0,
              p1Score,
              lastScorer: 'p1',
              winner: isMatchOver ? 'p1' : null,
              goalPauseSec: isMatchOver ? 0 : 1.05,
              elapsedSec,
              rallyHits,
              maxPuckSpeed: Math.max(maxPuckSpeed, Math.round(Math.hypot(puckVx, puckVy))),
              hitstopSec: 0.06,
              trauma: 0.75,
              lastImpactX: HOCKEY_W - 16,
              lastImpactY: puckY,
              lastImpactStrength: 1,
            },
            event: isMatchOver ? 'gameover' : 'goal_p1',
            impactStrength: 1,
          };
        }
      } else {
        puckX = HOCKEY_W - PUCK_R - 6;
        puckVx = -Math.abs(puckVx) * 0.95;
        if (event === 'none') event = 'wall_bounce';
      }
    }
  }

  const speedNow = Math.hypot(puckVx, puckVy);
  maxPuckSpeed = Math.max(maxPuckSpeed, Math.round(speedNow));

  // Gentle anti-stall nudge if puck slows to a dead stop near walls
  if (speedNow < 35) {
    const toCenterX = HOCKEY_W * 0.5 - puckX;
    const toCenterY = HOCKEY_H * 0.5 - puckY;
    const d = Math.hypot(toCenterX, toCenterY) || 1;
    puckVx += (toCenterX / d) * 140 * dt;
    puckVy += (toCenterY / d) * 140 * dt;
  }

  return {
    nextState: {
      ...state,
      puckX,
      puckY,
      puckVx,
      puckVy,
      p1X: p1.x,
      p1Y: p1.y,
      p1Vx: p1.vx,
      p1Vy: p1.vy,
      p2X: p2.x,
      p2Y: p2.y,
      p2Vx: p2.vx,
      p2Vy: p2.vy,
      elapsedSec,
      rallyHits,
      maxPuckSpeed,
      hitstopSec,
      trauma: nextTrauma,
      lastImpactX,
      lastImpactY,
      lastImpactStrength,
    },
    event,
    impactStrength,
  };
}

export interface AirHockeyAiMemory {
  targetX: number;
  targetY: number;
  phase: number;
}

export function createAirHockeyAiMemory(): AirHockeyAiMemory {
  return { targetX: 850, targetY: HOCKEY_H * 0.5, phase: 0 };
}

/**
 * Solo Mode AI Partner ("Camille IA") defending the right half of the neon Air Hockey rink.
 * Tracks incoming pucks, strikes decisively when puck enters her zone, yet remains fun & beatable.
 */
export function stepAiAirHockeyPartner(
  memory: AirHockeyAiMemory,
  state: AirHockeyState,
  dtRaw: number,
): { nextMemory: AirHockeyAiMemory; target: { x: number; y: number } } {
  const dt = Math.max(0.001, Math.min(dtRaw, 0.05));
  const phase = memory.phase + dt * 2.4;

  let desiredX = 855;
  let desiredY = HOCKEY_H * 0.5 + Math.sin(phase) * 38;

  if (state.phase === 'playing') {
    const puckOnAiSide = state.puckX > HOCKEY_W * 0.48;
    const puckApproaching = state.puckVx > 40;

    if (puckOnAiSide) {
      // Attack the puck from slightly behind it so shots head toward left goal
      const behindOffset = state.puckX > state.p2X ? 48 : 22;
      desiredX = Math.max(555, Math.min(930, state.puckX + behindOffset));
      desiredY = Math.max(60, Math.min(HOCKEY_H - 60, state.puckY + state.puckVy * 0.08));
      // If puck is close and in front of AI mallet, lunge forward to strike!
      if (Math.hypot(state.puckX - state.p2X, state.puckY - state.p2Y) < 115 && state.puckX < state.p2X + 12) {
        desiredX = Math.max(545, state.puckX - 28);
        desiredY = state.puckY;
      }
    } else if (puckApproaching) {
      // Predict Y intercept smoothly at defensive line x=835
      const timeToReach = Math.min(0.65, Math.max(0.05, (835 - state.puckX) / Math.max(120, state.puckVx)));
      const predictedY = state.puckY + state.puckVy * timeToReach;
      desiredX = 835;
      desiredY = Math.max(115, Math.min(HOCKEY_H - 115, predictedY));
    }
  }

  // Human-like paddle acceleration cap so fast angled shots can beat the AI!
  const aiMaxSpeed = 620 * dt;
  const dx = desiredX - memory.targetX;
  const dy = desiredY - memory.targetY;
  const dist = Math.hypot(dx, dy);
  const scale = dist > aiMaxSpeed && dist > 0.001 ? aiMaxSpeed / dist : 1;
  const targetX = Math.max(545, Math.min(945, memory.targetX + dx * scale));
  const targetY = Math.max(50, Math.min(HOCKEY_H - 50, memory.targetY + dy * scale));

  return {
    nextMemory: { targetX, targetY, phase },
    target: { x: targetX, y: targetY },
  };
}
