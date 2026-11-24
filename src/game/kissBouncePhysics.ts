import type { KissBounceState, KissHeart } from '../types/duoplay';

export const KISS_ARENA_W = 1000;
export const KISS_ARENA_H = 560;
export const KISS_GRAVITY = 135;
export const KISS_PUCKER_THRESHOLD = 0.45;
export const KISS_HAND_CATCH_RADIUS = 84;
export const KISS_LAUNCH_COOLDOWN_SEC = 0.55;

export interface KissBounceStepInput {
  /** Normalized 0..1 local hand/pointer coordinates */
  localHandX: number;
  localHandY: number;
  localHandActive: boolean;
  /** True on a kiss impulse (mouthPucker >= threshold or manual button/Space) */
  localKissTriggered: boolean;
  /** True when running in Solo Test Mode (AI partner returns kisses) */
  isSolo: boolean;
  /** Optional deterministic RNG for tests */
  rng?: () => number;
}

export interface KissBounceStepEvents {
  launchedByLocal: KissHeart | null;
  bouncedByLocal: { heart: KissHeart; kind: 'hand' | 'kiss' } | null;
  bouncedByAi: { heart: KissHeart; kind: 'hand' | 'kiss' } | null;
  missed: boolean;
}

export interface KissAiHandState {
  x: number;
  y: number;
}

export function detectKissPucker(mouthPucker: number, manualKiss = false): boolean {
  return manualKiss || mouthPucker >= KISS_PUCKER_THRESHOLD;
}

export function createInitialKissBounceState(bestRally = 0): KissBounceState {
  return {
    phase: 'ready',
    rally: 0,
    bestRally,
    totalKisses: 0,
    auroraLevel: 0.14,
    pianoStep: 0,
    elapsedSec: 0,
    localKissCooldownSec: 0,
    hearts: [],
    nextHeartId: 1,
    lastCatchKind: 'none',
    lastCatchTimerSec: 0,
  };
}

export function createKissAiHandState(): KissAiHandState {
  return { x: 820, y: 280 };
}

export function createOutboundHeart(
  id: number,
  from: 'local' | 'partner',
  startX: number,
  startY: number,
  rally: number,
  rng: () => number = Math.random,
): KissHeart {
  const dir = from === 'local' ? 1 : -1;
  const speedBoost = Math.min(130, rally * 9);
  const vx = dir * (380 + speedBoost + (rng() - 0.5) * 35);
  const vy = -(115 + rng() * 55);
  return {
    id,
    x: startX,
    y: Math.max(120, Math.min(KISS_ARENA_H - 110, startY)),
    vx,
    vy,
    target: from === 'local' ? 'partner' : 'local',
    radius: 28,
    pulse: 0,
    from,
  };
}

export function receiveRemoteKissHeart(
  state: KissBounceState,
  payload: {
    heartId: number;
    startY: number;
    vx: number;
    vy: number;
    rally: number;
    catchKind: 'hand' | 'kiss';
  },
): KissBounceState {
  // Mirror trajectory onto local screen so partner's kiss enters smoothly from the right
  const heart: KissHeart = {
    id: state.nextHeartId,
    x: KISS_ARENA_W - 140,
    y: Math.max(110, Math.min(KISS_ARENA_H - 110, payload.startY)),
    vx: -Math.abs(payload.vx || 350),
    vy: payload.vy || -130,
    target: 'local',
    radius: 28,
    pulse: 0,
    from: 'partner',
  };
  const nextRally = Math.max(state.rally, payload.rally);
  return {
    ...state,
    rally: nextRally,
    bestRally: Math.max(state.bestRally, nextRally),
    auroraLevel: Math.min(1, state.auroraLevel + 0.14),
    pianoStep: state.pianoStep + 1,
    hearts: [...state.hearts.slice(-4), heart],
    nextHeartId: state.nextHeartId + 1,
  };
}

export function stepKissAiHand(
  ai: KissAiHandState,
  hearts: KissHeart[],
  dt: number,
): KissAiHandState {
  const incoming = hearts.find((h) => h.target === 'partner');
  const targetX = incoming ? Math.max(660, Math.min(890, incoming.x + 25)) : 820;
  const targetY = incoming ? Math.max(100, Math.min(KISS_ARENA_H - 100, incoming.y)) : 280;
  const blend = Math.min(1, dt * 6.5);
  return {
    x: ai.x + (targetX - ai.x) * blend,
    y: ai.y + (targetY - ai.y) * blend,
  };
}

export function stepKissBouncePhysics(
  state: KissBounceState,
  input: KissBounceStepInput,
  rawDt: number,
  aiHand?: KissAiHandState,
): { nextState: KissBounceState; events: KissBounceStepEvents } {
  const events: KissBounceStepEvents = {
    launchedByLocal: null,
    bouncedByLocal: null,
    bouncedByAi: null,
    missed: false,
  };

  if (state.phase !== 'playing') {
    return { nextState: state, events };
  }

  const dt = Math.min(0.05, Math.max(0.001, rawDt));
  const rng = input.rng ?? Math.random;

  let rally = state.rally;
  let bestRally = state.bestRally;
  let totalKisses = state.totalKisses;
  let auroraLevel = Math.max(0.12, state.auroraLevel - dt * 0.015);
  let pianoStep = state.pianoStep;
  let localKissCooldownSec = Math.max(0, state.localKissCooldownSec - dt);
  let nextHeartId = state.nextHeartId;
  let lastCatchKind = state.lastCatchKind;
  let lastCatchTimerSec = Math.max(0, state.lastCatchTimerSec - dt);
  if (lastCatchTimerSec <= 0) {
    lastCatchKind = 'none';
  }

  // Local catcher position in left half (40..480)
  const localCatchX = Math.max(55, Math.min(470, input.localHandX * KISS_ARENA_W));
  const localCatchY = Math.max(70, Math.min(KISS_ARENA_H - 70, input.localHandY * KISS_ARENA_H));

  const nextHearts: KissHeart[] = [];
  let consumedLocalKissForReturn = false;

  for (const h of state.hearts) {
    let x = h.x + h.vx * dt;
    let vy = h.vy + KISS_GRAVITY * dt;
    let y = h.y + vy * dt;
    let vx = h.vx;
    let target = h.target;
    let from = h.from;
    const pulse = h.pulse + dt * 5.2;

    // Gentle ceiling reflection so high arcs stay visible
    if (y < 64) {
      y = 64;
      vy = Math.abs(vy) * 0.55;
    }

    // 1. Check local catch / kiss-return for incoming partner hearts
    if (target === 'local' && x <= 480) {
      const distToHand = Math.hypot(x - localCatchX, y - localCatchY);
      const caughtByHand = input.localHandActive && distToHand <= KISS_HAND_CATCH_RADIUS + h.radius * 0.5;
      const caughtByKiss =
        !caughtByHand &&
        input.localKissTriggered &&
        localKissCooldownSec <= 0 &&
        x >= 35 &&
        x <= 465;

      if (caughtByHand || caughtByKiss) {
        const catchKind: 'hand' | 'kiss' = caughtByKiss ? 'kiss' : 'hand';
        rally += 1;
        bestRally = Math.max(bestRally, rally);
        totalKisses += 1;
        auroraLevel = Math.min(1, auroraLevel + (catchKind === 'kiss' ? 0.2 : 0.15));
        pianoStep += 1;
        lastCatchKind = catchKind;
        lastCatchTimerSec = 1.1;
        if (caughtByKiss) {
          consumedLocalKissForReturn = true;
          localKissCooldownSec = KISS_LAUNCH_COOLDOWN_SEC;
        }

        const returned = createOutboundHeart(h.id, 'local', Math.max(120, x), y, rally, rng);
        events.bouncedByLocal = { heart: returned, kind: catchKind };
        nextHearts.push(returned);
        continue;
      }
    }

    // 2. Solo AI Partner catches incoming hearts on the right side
    if (input.isSolo && target === 'partner' && x >= 680) {
      const aiX = aiHand?.x ?? 800;
      const aiY = aiHand?.y ?? y;
      const distAi = Math.hypot(x - aiX, y - aiY);
      if (distAi <= 115 || x >= 790) {
        rally += 1;
        bestRally = Math.max(bestRally, rally);
        auroraLevel = Math.min(1, auroraLevel + 0.14);
        pianoStep += 1;
        const kind: 'hand' | 'kiss' = rally % 3 === 0 ? 'kiss' : 'hand';
        const returned = createOutboundHeart(h.id, 'partner', Math.min(840, x), y, rally, rng);
        events.bouncedByAi = { heart: returned, kind };
        nextHearts.push(returned);
        continue;
      }
    }

    // 3. In P2P mode, outbound hearts that fly past the partner's side have already been sent via SEND_KISS
    if (!input.isSolo && target === 'partner' && x > KISS_ARENA_W + 45) {
      continue;
    }

    // 4. Missed heart drifted off screen
    if (x < -55 || x > KISS_ARENA_W + 65 || y > KISS_ARENA_H + 60) {
      if (target === 'local') {
        events.missed = true;
        rally = 0;
        auroraLevel = Math.max(0.14, auroraLevel * 0.72);
      }
      continue;
    }

    nextHearts.push({ ...h, x, y, vx, vy, target, from, pulse });
  }

  // Launch a fresh kiss heart if player blew a kiss and didn't just use it to return a heart
  if (
    input.localKissTriggered &&
    !consumedLocalKissForReturn &&
    localKissCooldownSec <= 0 &&
    nextHearts.length < 3
  ) {
    const startY = Math.max(140, Math.min(KISS_ARENA_H - 140, localCatchY));
    const heart = createOutboundHeart(nextHeartId, 'local', 175, startY, rally, rng);
    nextHeartId += 1;
    totalKisses += 1;
    localKissCooldownSec = KISS_LAUNCH_COOLDOWN_SEC;
    auroraLevel = Math.min(1, auroraLevel + 0.08);
    nextHearts.push(heart);
    events.launchedByLocal = heart;
  }

  return {
    nextState: {
      ...state,
      rally,
      bestRally,
      totalKisses,
      auroraLevel,
      pianoStep,
      elapsedSec: state.elapsedSec + dt,
      localKissCooldownSec,
      hearts: nextHearts,
      nextHeartId,
      lastCatchKind,
      lastCatchTimerSec,
    },
    events,
  };
}
