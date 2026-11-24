import type { MiamFoodItem, MiamItemKind, MiamManiaState, MiamMode } from '../types/duoplay';

export const MIAM_ARENA_W = 960;
export const MIAM_ARENA_H = 580;
export const MOUTH_CATCH_RADIUS = 56;
export const MIAM_BONUS_POINTS = 10;

const BONUS_KINDS: MiamItemKind[] = ['strawberry', 'pizza', 'heart'];
const TRAP_KINDS: MiamItemKind[] = ['chili', 'sock'];

export interface MiamFeedback {
  x: number;
  y: number;
  kind: MiamItemKind;
  isTrap: boolean;
  pointsDelta: number;
}

export interface MiamStepResult {
  nextState: MiamManiaState;
  events: ('bonus_caught' | 'trap_eaten' | 'trap_dodged' | 'gameover')[];
  feedbacks: MiamFeedback[];
}

export function createInitialMiamManiaState(
  mode: MiamMode = 'duel',
  bestScore = 0,
): MiamManiaState {
  return {
    phase: 'ready',
    mode,
    score: 0,
    bestScore,
    lives: 3,
    maxLives: 3,
    caughtCount: 0,
    streak: 0,
    elapsedSec: 0,
    spawnTimerSec: 0.3,
    nextId: 1,
    items: [],
    trauma: 0,
    flashKind: 'none',
    flashTimerSec: 0,
  };
}

function spawnFoodItem(state: MiamManiaState, rng: () => number): MiamFoodItem {
  const difficulty = Math.min(1, state.elapsedSec / 60);
  const trapChance = state.elapsedSec < 2.5 ? 0.12 : 0.28 + difficulty * 0.16;
  const isTrap = rng() < trapChance;
  const pool = isTrap ? TRAP_KINDS : BONUS_KINDS;
  const kind = pool[Math.floor(rng() * pool.length)];

  return {
    id: state.nextId,
    kind,
    isTrap,
    x: 85 + rng() * (MIAM_ARENA_W - 170),
    y: -36,
    vx: (rng() - 0.5) * 58,
    vy: 195 + rng() * 115 + difficulty * 135,
    radius: isTrap ? 28 : 30,
    rotation: (rng() - 0.5) * 0.6,
    vRot: (rng() - 0.5) * 2.2,
  };
}

/**
 * Pure simulation step for Miam Mania (Attrape-Bouche):
 * - Bonus items (strawberry, pizza, heart) caught ONLY when intersecting mouth AND mouthOpen === true -> +10 pts.
 * - Trap items (chili, sock) damage player (-1 life) ONLY when intersecting mouth AND mouthOpen === true!
 * - Keeping mouth CLOSED safely avoids traps!
 */
export function stepMiamManiaPhysics(
  state: MiamManiaState,
  mouthArenaX: number,
  mouthArenaY: number,
  mouthOpen: boolean,
  dtRaw: number,
  rng: () => number = Math.random,
): MiamStepResult {
  const dt = Math.max(0.001, Math.min(dtRaw, 0.05));
  const events: MiamStepResult['events'] = [];
  const feedbacks: MiamFeedback[] = [];

  if (state.phase !== 'playing') {
    return { nextState: state, events, feedbacks };
  }

  const elapsedSec = state.elapsedSec + dt;
  const trauma = Math.max(0, state.trauma - dt * 2.2);
  const flashTimerSec = Math.max(0, state.flashTimerSec - dt);
  const flashKind = flashTimerSec > 0 ? state.flashKind : 'none';

  let score = state.score;
  let bestScore = state.bestScore;
  let lives = state.lives;
  let caughtCount = state.caughtCount;
  let streak = state.streak;
  let nextTrauma = trauma;
  let nextFlashKind = flashKind;
  let nextFlashTimer = flashTimerSec;

  let spawnTimerSec = state.spawnTimerSec - dt;
  let nextId = state.nextId;
  const workingItems: MiamFoodItem[] = state.items.map((it) => ({ ...it }));

  if (spawnTimerSec <= 0) {
    const newItem = spawnFoodItem({ ...state, elapsedSec, nextId }, rng);
    workingItems.push(newItem);
    nextId += 1;
    const difficulty = Math.min(1, elapsedSec / 65);
    spawnTimerSec = Math.max(0.46, 0.96 - difficulty * 0.44);
  }

  const surviving: MiamFoodItem[] = [];
  for (let i = 0; i < workingItems.length; i++) {
    const item = workingItems[i];
    item.x += item.vx * dt;
    item.y += item.vy * dt;
    item.rotation += item.vRot * dt;

    // Gentle bounce off side walls
    if (item.x < 44) {
      item.x = 44;
      item.vx = Math.abs(item.vx);
    } else if (item.x > MIAM_ARENA_W - 44) {
      item.x = MIAM_ARENA_W - 44;
      item.vx = -Math.abs(item.vx);
    }

    const dist = Math.hypot(item.x - mouthArenaX, item.y - mouthArenaY);
    const inMouthZone = dist <= item.radius + MOUTH_CATCH_RADIUS;

    if (inMouthZone && mouthOpen) {
      if (item.isTrap) {
        lives = Math.max(0, lives - 1);
        streak = 0;
        nextTrauma = 0.85;
        nextFlashKind = 'trap';
        nextFlashTimer = 0.28;
        events.push('trap_eaten');
        feedbacks.push({
          x: item.x,
          y: item.y,
          kind: item.kind,
          isTrap: true,
          pointsDelta: 0,
        });
      } else {
        score += MIAM_BONUS_POINTS;
        bestScore = Math.max(bestScore, score);
        caughtCount += 1;
        streak += 1;
        nextFlashKind = 'bonus';
        nextFlashTimer = 0.16;
        events.push('bonus_caught');
        feedbacks.push({
          x: item.x,
          y: item.y,
          kind: item.kind,
          isTrap: false,
          pointsDelta: MIAM_BONUS_POINTS,
        });
      }
      continue;
    }

    if (item.y <= MIAM_ARENA_H + 55) {
      surviving.push(item);
    }
  }

  let phase: MiamManiaState['phase'] = state.phase;
  if (lives <= 0) {
    phase = 'gameover';
    events.push('gameover');
  }

  return {
    nextState: {
      ...state,
      phase,
      score,
      bestScore,
      lives,
      caughtCount,
      streak,
      elapsedSec,
      spawnTimerSec,
      nextId,
      items: surviving,
      trauma: nextTrauma,
      flashKind: nextFlashKind,
      flashTimerSec: nextFlashTimer,
    },
    events,
    feedbacks,
  };
}

export interface MiamAiPartnerState {
  score: number;
  lives: number;
  mouthOpen: boolean;
  tickAccumSec: number;
}

export function createMiamAiPartnerState(): MiamAiPartnerState {
  return { score: 0, lives: 3, mouthOpen: false, tickAccumSec: 0 };
}

/**
 * Solo Mode AI Partner ("Camille IA") for Miam Mania:
 * realistically chomps falling bonus treats, occasionally gets fooled by a chili/sock.
 */
export function stepAiMiamPartner(
  ai: MiamAiPartnerState,
  isPlaying: boolean,
  dtRaw: number,
  rng: () => number = Math.random,
): MiamAiPartnerState {
  if (!isPlaying || ai.lives <= 0) {
    return { ...ai, mouthOpen: false };
  }
  const dt = Math.max(0.001, Math.min(dtRaw, 0.05));
  let tickAccumSec = ai.tickAccumSec + dt;
  let score = ai.score;
  let lives = ai.lives;
  let mouthOpen = ai.mouthOpen;

  if (tickAccumSec >= 1.15) {
    tickAccumSec = 0;
    const roll = rng();
    if (roll < 0.72) {
      score += MIAM_BONUS_POINTS;
      mouthOpen = true;
    } else if (roll < 0.9) {
      mouthOpen = false; // Smartly closed mouth for trap!
    } else {
      lives = Math.max(1, lives - 1);
      mouthOpen = true;
    }
  } else if (tickAccumSec > 0.45) {
    mouthOpen = false;
  }

  return { score, lives, mouthOpen, tickAccumSec };
}
