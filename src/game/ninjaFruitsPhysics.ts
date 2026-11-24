import type { NinjaFruitItem, NinjaFruitKind, NinjaFruitsState } from '../types/duoplay';

export const NINJA_ARENA_W = 1000;
export const NINJA_ARENA_H = 620;
export const NINJA_GRAVITY = 720;
export const GIANT_COOP_WINDOW_SEC = 0.65;
export const COMBO_DECAY_SEC = 2.6;

const REGULAR_FRUITS: Exclude<NinjaFruitKind, 'giant' | 'bomb'>[] = [
  'watermelon',
  'mango',
  'pomegranate',
  'kiwi',
  'orange',
];

export interface BladeSegment {
  prevX: number;
  prevY: number;
  x: number;
  y: number;
  active: boolean;
}

export interface NinjaSliceFeedback {
  x: number;
  y: number;
  kind: NinjaFruitKind;
  points: number;
  byBoth: boolean;
}

export interface NinjaStepResult {
  nextState: NinjaFruitsState;
  events: ('fruit_sliced' | 'giant_sliced' | 'giant_marked' | 'bomb_hit' | 'gameover')[];
  feedbacks: NinjaSliceFeedback[];
}

export function createInitialNinjaFruitsState(bestScore = 0): NinjaFruitsState {
  return {
    phase: 'ready',
    score: 0,
    bestScore,
    lives: 3,
    maxLives: 3,
    combo: 0,
    maxCombo: 0,
    comboTimerSec: 0,
    multiplier: 1,
    slicedCount: 0,
    giantSlicedCount: 0,
    elapsedSec: 0,
    spawnTimerSec: 0.22,
    nextId: 1,
    items: [],
    hitstopSec: 0,
    trauma: 0,
    flashColor: 'none',
    flashTimerSec: 0,
    lastCallout: '',
    calloutTimerSec: 0,
  };
}

/**
 * Exact 2D line-segment to circle intersection so fast blade slashes never tunnel through fruits.
 */
export function segmentIntersectsCircle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  radius: number,
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.0001) {
    const px = cx - x1;
    const py = cy - y1;
    return px * px + py * py <= radius * radius;
  }
  const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / lenSq));
  const nearestX = x1 + t * dx;
  const nearestY = y1 + t * dy;
  const distX = cx - nearestX;
  const distY = cy - nearestY;
  return distX * distX + distY * distY <= radius * radius;
}

export function computeMultiplier(combo: number): number {
  if (combo >= 12) return 5;
  if (combo >= 8) return 4;
  if (combo >= 5) return 3;
  if (combo >= 2) return 2;
  return 1;
}

function spawnWave(state: NinjaFruitsState, rng: () => number): { items: NinjaFruitItem[]; nextId: number } {
  const difficulty = Math.min(1, state.elapsedSec / 60);
  const spawned: NinjaFruitItem[] = [];
  let nextId = state.nextId;

  // Periodic Giant Cooperative Fruit up the center axis
  const hasGiantAlready = state.items.some((i) => !i.sliced && i.kind === 'giant');
  const shouldSpawnGiant = !hasGiantAlready && state.elapsedSec > 4.5 && rng() < 0.19 + difficulty * 0.08;

  if (shouldSpawnGiant) {
    const startX = NINJA_ARENA_W * (0.45 + rng() * 0.1);
    spawned.push({
      id: nextId++,
      kind: 'giant',
      x: startX,
      y: NINJA_ARENA_H + 62,
      vx: (NINJA_ARENA_W * 0.5 - startX) * 0.45,
      vy: -(755 + rng() * 55),
      radius: 56,
      rotation: rng() * Math.PI * 2,
      vRot: (rng() - 0.5) * 1.4,
      sliced: false,
      slicedTimer: 0,
      sliceAngle: 0,
      hitByP1At: null,
      hitByP2At: null,
    });
  }

  // Spawn 2 to 4 regular fruits across left & right zones
  const fruitCount = 2 + Math.floor(rng() * (2 + difficulty * 1.4));
  for (let i = 0; i < fruitCount; i++) {
    const kind = REGULAR_FRUITS[Math.floor(rng() * REGULAR_FRUITS.length)];
    const side = i % 2 === 0 ? 0 : 1;
    const x =
      side === 0
        ? 110 + rng() * 340
        : 550 + rng() * 340;
    const targetX = side === 0 ? 260 + rng() * 260 : 480 + rng() * 260;
    const vx = (targetX - x) * (0.55 + rng() * 0.3);
    const vy = -(705 + rng() * 145);

    spawned.push({
      id: nextId++,
      kind,
      x,
      y: NINJA_ARENA_H + 45 + i * 18,
      vx,
      vy,
      radius: kind === 'watermelon' ? 38 : 31,
      rotation: rng() * Math.PI * 2,
      vRot: (rng() - 0.5) * 3.8,
      sliced: false,
      slicedTimer: 0,
      sliceAngle: 0,
      hitByP1At: null,
      hitByP2At: null,
    });
  }

  // Bombs appear between the two player zones (center seam) after brief safe opening
  const activeBombs = state.items.filter((i) => !i.sliced && i.kind === 'bomb').length;
  const bombChance = state.elapsedSec < 3.5 ? 0 : 0.3 + difficulty * 0.24;
  if (activeBombs < 2 && rng() < bombChance) {
    const bx = 370 + rng() * 260;
    spawned.push({
      id: nextId++,
      kind: 'bomb',
      x: bx,
      y: NINJA_ARENA_H + 48,
      vx: (NINJA_ARENA_W * 0.5 - bx) * 0.55 + (rng() - 0.5) * 85,
      vy: -(700 + rng() * 110),
      radius: 30,
      rotation: rng() * Math.PI * 2,
      vRot: (rng() - 0.5) * 2.5,
      sliced: false,
      slicedTimer: 0,
      sliceAngle: 0,
      hitByP1At: null,
      hitByP2At: null,
    });
  }

  return { items: spawned, nextId };
}

/**
 * Authoritative Host simulation step for "Ninja Fruits en Duo".
 */
export function stepNinjaFruitsPhysics(
  state: NinjaFruitsState,
  p1Blade: BladeSegment,
  p2Blade: BladeSegment,
  dtRaw: number,
  rng: () => number = Math.random,
): NinjaStepResult {
  const dt = Math.max(0, Math.min(dtRaw, 0.05));
  const events: NinjaStepResult['events'] = [];
  const feedbacks: NinjaSliceFeedback[] = [];

  if (state.phase !== 'playing') {
    return { nextState: state, events, feedbacks };
  }

  const trauma = Math.max(0, state.trauma - dt * 1.9);
  const flashTimerSec = Math.max(0, state.flashTimerSec - dt);
  const flashColor = flashTimerSec > 0 ? state.flashColor : 'none';
  const calloutTimerSec = Math.max(0, state.calloutTimerSec - dt);
  const lastCallout = calloutTimerSec > 0 ? state.lastCallout : '';

  if (state.hitstopSec > 0) {
    return {
      nextState: {
        ...state,
        hitstopSec: Math.max(0, state.hitstopSec - dt),
        trauma,
        flashTimerSec,
        flashColor,
        calloutTimerSec,
        lastCallout,
      },
      events,
      feedbacks,
    };
  }

  const elapsedSec = state.elapsedSec + dt;
  let score = state.score;
  let bestScore = state.bestScore;
  let lives = state.lives;
  let combo = state.combo;
  let maxCombo = state.maxCombo;
  let comboTimerSec = Math.max(0, state.comboTimerSec - dt);
  if (comboTimerSec <= 0 && combo > 0) {
    combo = 0;
  }
  let multiplier = computeMultiplier(combo);
  let slicedCount = state.slicedCount;
  let giantSlicedCount = state.giantSlicedCount;
  let hitstopSec = 0;
  let nextTrauma = trauma;
  let nextFlashColor = flashColor;
  let nextFlashTimer = flashTimerSec;
  let nextCallout = lastCallout;
  let nextCalloutTimer = calloutTimerSec;

  // Spawn new waves scaled by elapsed difficulty
  let spawnTimerSec = state.spawnTimerSec - dt;
  let nextId = state.nextId;
  const workingItems: NinjaFruitItem[] = state.items.map((item) => ({ ...item }));

  if (spawnTimerSec <= 0) {
    const wave = spawnWave({ ...state, elapsedSec, nextId, items: workingItems }, rng);
    workingItems.push(...wave.items);
    nextId = wave.nextId;
    const difficulty = Math.min(1, elapsedSec / 65);
    spawnTimerSec = Math.max(0.92, 1.55 - difficulty * 0.62);
  }

  const p1Speed = Math.hypot(p1Blade.x - p1Blade.prevX, p1Blade.y - p1Blade.prevY);
  const p2Speed = Math.hypot(p2Blade.x - p2Blade.prevX, p2Blade.y - p2Blade.prevY);
  const p1Swiping = p1Blade.active && p1Speed >= 4;
  const p2Swiping = p2Blade.active && p2Speed >= 4;

  // Step physics & check collisions
  const surviving: NinjaFruitItem[] = [];
  for (let i = 0; i < workingItems.length; i++) {
    const item = workingItems[i];
    item.x += item.vx * dt;
    item.y += item.vy * dt;
    item.vy += NINJA_GRAVITY * dt;
    item.rotation += item.vRot * dt;

    if (item.sliced) {
      item.slicedTimer += dt;
      if (item.slicedTimer < 0.72 && item.y < NINJA_ARENA_H + 140) {
        surviving.push(item);
      }
      continue;
    }

    // Expire single-blade Giant Fruit marks after cooperative window
    if (item.kind === 'giant') {
      if (item.hitByP1At !== null && elapsedSec - item.hitByP1At > GIANT_COOP_WINDOW_SEC) {
        item.hitByP1At = null;
      }
      if (item.hitByP2At !== null && elapsedSec - item.hitByP2At > GIANT_COOP_WINDOW_SEC) {
        item.hitByP2At = null;
      }
    }

    const hitP1 =
      p1Swiping &&
      segmentIntersectsCircle(
        p1Blade.prevX,
        p1Blade.prevY,
        p1Blade.x,
        p1Blade.y,
        item.x,
        item.y,
        item.radius + 8,
      );
    const hitP2 =
      p2Swiping &&
      segmentIntersectsCircle(
        p2Blade.prevX,
        p2Blade.prevY,
        p2Blade.x,
        p2Blade.y,
        item.x,
        item.y,
        item.radius + 8,
      );

    if (hitP1 || hitP2) {
      if (item.kind === 'bomb') {
        item.sliced = true;
        item.slicedTimer = 0;
        lives = Math.max(0, lives - 1);
        combo = 0;
        comboTimerSec = 0;
        multiplier = 1;
        hitstopSec = 0.075;
        nextTrauma = 0.92;
        nextFlashColor = 'bomb';
        nextFlashTimer = 0.32;
        nextCallout = lives > 0 ? 'BOMBE ! −1 vie pour le duo' : 'BOUM ! Plus aucune vie';
        nextCalloutTimer = 1.6;
        events.push('bomb_hit');
        feedbacks.push({ x: item.x, y: item.y, kind: 'bomb', points: 0, byBoth: false });
      } else if (item.kind === 'giant') {
        const hadP1 = item.hitByP1At !== null;
        const hadP2 = item.hitByP2At !== null;
        if (hitP1) item.hitByP1At = elapsedSec;
        if (hitP2) item.hitByP2At = elapsedSec;

        if (item.hitByP1At !== null && item.hitByP2At !== null) {
          item.sliced = true;
          item.slicedTimer = 0;
          item.sliceAngle = Math.atan2(p1Blade.y - p1Blade.prevY, p1Blade.x - p1Blade.prevX);
          combo += 2;
          maxCombo = Math.max(maxCombo, combo);
          comboTimerSec = COMBO_DECAY_SEC + 0.5;
          multiplier = computeMultiplier(combo);
          const pts = 50 * multiplier;
          score += pts;
          bestScore = Math.max(bestScore, score);
          slicedCount += 1;
          giantSlicedCount += 1;
          hitstopSec = 0.055;
          nextTrauma = 0.55;
          nextFlashColor = 'giant';
          nextFlashTimer = 0.28;
          nextCallout = `FRUIT GÉANT COUPÉ EN DUO ! +${pts}`;
          nextCalloutTimer = 1.8;
          events.push('giant_sliced');
          feedbacks.push({ x: item.x, y: item.y, kind: 'giant', points: pts, byBoth: true });
        } else if ((!hadP1 && hitP1) || (!hadP2 && hitP2)) {
          nextCallout = 'FRUIT GÉANT : 2e lame requise ensemble !';
          nextCalloutTimer = 0.85;
          events.push('giant_marked');
        }
      } else {
        item.sliced = true;
        item.slicedTimer = 0;
        const activeBlade = hitP1 ? p1Blade : p2Blade;
        item.sliceAngle = Math.atan2(activeBlade.y - activeBlade.prevY, activeBlade.x - activeBlade.prevX);
        combo += 1;
        maxCombo = Math.max(maxCombo, combo);
        comboTimerSec = COMBO_DECAY_SEC;
        multiplier = computeMultiplier(combo);
        const pts = 10 * multiplier;
        score += pts;
        bestScore = Math.max(bestScore, score);
        slicedCount += 1;
        if (combo > 0 && combo % 5 === 0) {
          nextCallout = `COMBO ×${multiplier} (${combo} fruits) !`;
          nextCalloutTimer = 1.25;
        }
        events.push('fruit_sliced');
        feedbacks.push({ x: item.x, y: item.y, kind: item.kind, points: pts, byBoth: hitP1 && hitP2 });
      }
    }

    if (item.y < NINJA_ARENA_H + 130 && item.x > -120 && item.x < NINJA_ARENA_W + 120) {
      surviving.push(item);
    }
  }

  let phase: NinjaFruitsState['phase'] = state.phase;
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
      combo,
      maxCombo,
      comboTimerSec,
      multiplier,
      slicedCount,
      giantSlicedCount,
      elapsedSec,
      spawnTimerSec,
      nextId,
      items: surviving,
      hitstopSec,
      trauma: nextTrauma,
      flashColor: nextFlashColor,
      flashTimerSec: nextFlashTimer,
      lastCallout: nextCallout,
      calloutTimerSec: nextCalloutTimer,
    },
    events,
    feedbacks,
  };
}

export interface NinjaAiMemory {
  x: number;
  y: number;
  slashPhase: number;
}

export function createNinjaAiMemory(): NinjaAiMemory {
  return { x: 740, y: 310, slashPhase: 0 };
}

/**
 * Solo Mode AI Partner ("Camille IA") for Ninja Fruits en Duo:
 * slices fruits on the right/center zone, rushes to co-slice Giant Fruits, and avoids bombs!
 */
export function stepAiNinjaPartner(
  memory: NinjaAiMemory,
  state: NinjaFruitsState,
  dtRaw: number,
): { nextMemory: NinjaAiMemory; blade: BladeSegment } {
  const dt = Math.max(0.001, Math.min(dtRaw, 0.05));
  const prevX = memory.x;
  const prevY = memory.y;
  let slashPhase = memory.slashPhase + dt * 6;

  if (state.phase !== 'playing') {
    const idleX = 740 + Math.cos(slashPhase * 0.35) * 45;
    const idleY = 320 + Math.sin(slashPhase * 0.5) * 35;
    return {
      nextMemory: { x: idleX, y: idleY, slashPhase },
      blade: { prevX, prevY, x: idleX, y: idleY, active: false },
    };
  }

  // Pick best target: prioritize Giant Fruit (especially when P1 already marked it!), else safe fruits on right/center
  const bombs = state.items.filter((i) => !i.sliced && i.kind === 'bomb');
  const candidates = state.items.filter((i) => {
    if (i.sliced || i.kind === 'bomb') return false;
    if (i.y > NINJA_ARENA_H - 25 || i.y < 30) return false;
    // Avoid fruits currently overlapping a bomb
    const tooCloseToBomb = bombs.some((b) => Math.hypot(b.x - i.x, b.y - i.y) < 92);
    if (tooCloseToBomb) return false;
    return i.kind === 'giant' || i.x >= 380;
  });

  let targetX = 735 + Math.cos(slashPhase * 0.45) * 65;
  let targetY = 300 + Math.sin(slashPhase * 0.65) * 55;
  let hasTarget = false;

  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      const aPri = a.kind === 'giant' ? (a.hitByP1At !== null ? -1000 : -500) : Math.hypot(a.x - prevX, a.y - prevY);
      const bPri = b.kind === 'giant' ? (b.hitByP1At !== null ? -1000 : -500) : Math.hypot(b.x - prevX, b.y - prevY);
      return aPri - bPri;
    });
    const best = candidates[0];
    hasTarget = true;
    // Slight sinusoidal sweep across the fruit center for crisp slashing motion
    targetX = best.x + Math.cos(slashPhase) * 26;
    targetY = best.y + Math.sin(slashPhase) * 22;
  }

  // Repel away from nearby bombs so AI never accidentally cuts a bomb
  for (const b of bombs) {
    const dx = targetX - b.x;
    const dy = targetY - b.y;
    const d = Math.hypot(dx, dy);
    if (d < 105 && d > 0.1) {
      targetX = b.x + (dx / d) * 115;
      targetY = b.y + (dy / d) * 115;
    }
  }

  const maxStep = (hasTarget ? 920 : 380) * dt;
  const dx = targetX - prevX;
  const dy = targetY - prevY;
  const dist = Math.hypot(dx, dy);
  const scale = dist > maxStep && dist > 0.001 ? maxStep / dist : 1;
  const x = Math.max(40, Math.min(NINJA_ARENA_W - 40, prevX + dx * scale));
  const y = Math.max(40, Math.min(NINJA_ARENA_H - 40, prevY + dy * scale));

  // Verify the planned step segment doesn't cross a bomb; if it would, deactivate blade for this frame
  const crossesBomb = bombs.some((b) =>
    segmentIntersectsCircle(prevX, prevY, x, y, b.x, b.y, b.radius + 14),
  );

  return {
    nextMemory: { x, y, slashPhase },
    blade: { prevX, prevY, x, y, active: hasTarget && !crossesBomb },
  };
}
