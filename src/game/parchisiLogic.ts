import type {
  ParchisiKarmaEffect,
  ParchisiMode,
  ParchisiMoveOption,
  ParchisiPawn,
  ParchisiPlayer,
  ParchisiState,
} from '../types/duoplay';
import {
  isKarmaSquare,
  isSafeSquare,
  outerSquareToProgress,
  PARCHISI_SAFE_SQUARES,
  PARCHISI_THRONE_PROGRESS,
  PARCHISI_TOTAL_SQUARES,
  progressToOuterSquare,
} from './parchisiBoard';

export interface ParchisiKarmaCardDef {
  id: number;
  effect: ParchisiKarmaEffect;
  emoji: string;
}

/** 16 varied Karma Couple cards: 6 tactical bonuses + 10 complicity/romance prompts */
export const PARCHISI_KARMA_DECK: readonly ParchisiKarmaCardDef[] = [
  { id: 0, effect: 'shield', emoji: '🛡️' },
  { id: 1, effect: 'turbo3', emoji: '⚡' },
  { id: 2, effect: 'free_roll', emoji: '🎲' },
  { id: 3, effect: 'complicity', emoji: '💌' },
  { id: 4, effect: 'complicity', emoji: '😊' },
  { id: 5, effect: 'complicity', emoji: '✨' },
  { id: 6, effect: 'shield', emoji: '🛡️' },
  { id: 7, effect: 'turbo3', emoji: '⚡' },
  { id: 8, effect: 'free_roll', emoji: '🎲' },
  { id: 9, effect: 'complicity', emoji: '💋' },
  { id: 10, effect: 'complicity', emoji: '👀' },
  { id: 11, effect: 'complicity', emoji: '🎵' },
  { id: 12, effect: 'complicity', emoji: '🌙' },
  { id: 13, effect: 'complicity', emoji: '🔥' },
  { id: 14, effect: 'complicity', emoji: '🥂' },
  { id: 15, effect: 'complicity', emoji: '👑' },
];

export const PARCHISI_MERCY_COUNTDOWN_SEC = 8;
export const PARCHISI_MERCY_DARE_COUNT = 12;
export const PARCHISI_FINAL_DARE_COUNT = 10;

export function otherPlayer(p: ParchisiPlayer): ParchisiPlayer {
  return p === 'host' ? 'guest' : 'host';
}

function clonePawns(pawns: Record<ParchisiPlayer, ParchisiPawn[]>): Record<ParchisiPlayer, ParchisiPawn[]> {
  return {
    host: pawns.host.map((p) => ({ ...p })),
    guest: pawns.guest.map((p) => ({ ...p })),
  };
}

function makeInitialPawns(mode: ParchisiMode): Record<ParchisiPlayer, ParchisiPawn[]> {
  const build = (owner: ParchisiPlayer): ParchisiPawn[] =>
    [0, 1, 2, 3].map((id) => ({
      id,
      owner,
      progress: mode === 'express' && id === 0 ? 0 : -1,
      shieldTurns: 0,
    }));
  return { host: build('host'), guest: build('guest') };
}

export function createInitialParchisiState(mode: ParchisiMode = 'express'): ParchisiState {
  return {
    phase: 'READY',
    mode,
    turn: 'host',
    dieValue: null,
    effectiveSteps: 0,
    rollSeq: 0,
    consecutiveSixes: 0,
    extraTurnPending: false,
    lastMovedPawnId: { host: null, guest: null },
    pawns: makeInitialPawns(mode),
    pendingMercy: null,
    activeKarma: null,
    usedKarmaIds: [],
    lastMoveAnim: null,
    lastEventText: '',
    history: [],
    winner: null,
    finalDareIndex: 0,
    stats: {
      host: { captures: 0, daresCompleted: 0, sixesRolled: 0, tenderHearts: 0, karmaCards: 0 },
      guest: { captures: 0, daresCompleted: 0, sixesRolled: 0, tenderHearts: 0, karmaCards: 0 },
    },
    stateSeq: 0,
  };
}

export function startParchisiMatch(mode: ParchisiMode): ParchisiState {
  const base = createInitialParchisiState(mode);
  return {
    ...base,
    phase: 'WAIT_ROLL',
    turn: 'host',
    stateSeq: 1,
  };
}

/** Return all outer squares (1..68) that currently have a 2-pawn same-color blockade. */
export function getOuterBlockades(
  pawns: Record<ParchisiPlayer, ParchisiPawn[]>,
): Map<number, ParchisiPlayer> {
  const counts = new Map<string, number>();
  const result = new Map<number, ParchisiPlayer>();
  for (const owner of ['host', 'guest'] as const) {
    for (const p of pawns[owner]) {
      const sq = progressToOuterSquare(owner, p.progress);
      if (sq === null) continue;
      const key = `${owner}:${sq}`;
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      if (next >= 2) {
        result.set(sq, owner);
      }
    }
  }
  return result;
}

/** Return corridor progress cells (64..70) where an owner has a 2-pawn blockade. */
export function getCorridorBlockades(
  pawns: Record<ParchisiPlayer, ParchisiPawn[]>,
  owner: ParchisiPlayer,
): Set<number> {
  const counts = new Map<number, number>();
  const blocked = new Set<number>();
  for (const p of pawns[owner]) {
    if (p.progress >= 64 && p.progress <= 70) {
      const next = (counts.get(p.progress) ?? 0) + 1;
      counts.set(p.progress, next);
      if (next >= 2) blocked.add(p.progress);
    }
  }
  return blocked;
}

/** Count total pawns (both players combined) on a specific outer square 1..68 */
export function getPawnsAtOuterSquare(
  pawns: Record<ParchisiPlayer, ParchisiPawn[]>,
  square: number,
): ParchisiPawn[] {
  const res: ParchisiPawn[] = [];
  for (const owner of ['host', 'guest'] as const) {
    for (const p of pawns[owner]) {
      if (progressToOuterSquare(owner, p.progress) === square) {
        res.push(p);
      }
    }
  }
  return res;
}

/** True if all 4 of a player's pawns are out of base (progress >= 0) -> 6 counts as 7! */
export function areAllPawnsOut(pawns: Record<ParchisiPlayer, ParchisiPawn[]>, owner: ParchisiPlayer): boolean {
  return pawns[owner].every((p) => p.progress >= 0);
}

/** Check if a given pawn currently sits inside a blockade of its own color. */
export function isPawnInOwnBlockade(
  pawns: Record<ParchisiPlayer, ParchisiPawn[]>,
  pawn: ParchisiPawn,
): boolean {
  if (pawn.progress < 0 || pawn.progress >= PARCHISI_THRONE_PROGRESS) return false;
  if (pawn.progress <= 63) {
    const sq = progressToOuterSquare(pawn.owner, pawn.progress)!;
    return getOuterBlockades(pawns).get(sq) === pawn.owner;
  }
  return getCorridorBlockades(pawns, pawn.owner).has(pawn.progress);
}

/**
 * Evaluate whether moving a specific pawn by `steps` (or exiting base if `isExit`) is legal,
 * enforcing ALL authentic Parchisi rules (barrage walls, 2-pawn square capacity, exact Throne entry, safe zones, shield).
 */
function evaluateSinglePawnMove(
  state: ParchisiState,
  owner: ParchisiPlayer,
  pawn: ParchisiPawn,
  steps: number,
  allowExit: boolean,
): ParchisiMoveOption | null {
  const outerBlockades = getOuterBlockades(state.pawns);
  const myCorrBlockades = getCorridorBlockades(state.pawns, owner);

  // Case 1: Exiting from Home Yard
  if (pawn.progress === -1) {
    if (!allowExit) return null;
    const exitSq = progressToOuterSquare(owner, 0)!;
    const occupants = getPawnsAtOuterSquare(state.pawns, exitSq);
    const ownOnExit = occupants.filter((o) => o.owner === owner).length;
    // Cannot exit if exit square is blocked by 2 own pawns OR 2 opponent pawns (blockade) OR already at 2-pawn max capacity
    if (ownOnExit >= 2 || occupants.length >= 2) return null;
    return {
      pawnId: pawn.id,
      fromProgress: -1,
      toProgress: 0,
      steps: 1,
      path: [0],
      isExit: true,
      captures: null,
      reachesThrone: false,
      landsOnSafe: true,
      landsOnKarma: false,
      breaksBlockade: false,
    };
  }

  // Already in Central Throne
  if (pawn.progress >= PARCHISI_THRONE_PROGRESS) return null;

  const targetProgress = pawn.progress + steps;
  // Exact entry required for Central Throne
  if (targetProgress > PARCHISI_THRONE_PROGRESS) return null;

  const path: number[] = [];
  for (let stepProg = pawn.progress + 1; stepProg <= targetProgress; stepProg++) {
    path.push(stepProg);
    if (stepProg <= 63) {
      const sq = progressToOuterSquare(owner, stepProg)!;
      // Nobody (not even allies!) can pass through OR land on a blockade
      if (outerBlockades.has(sq)) return null;
    } else if (stepProg <= 70) {
      // Corridor blockade check
      if (myCorrBlockades.has(stepProg)) return null;
    }
  }

  // Destination checks
  if (targetProgress === PARCHISI_THRONE_PROGRESS) {
    return {
      pawnId: pawn.id,
      fromProgress: pawn.progress,
      toProgress: targetProgress,
      steps,
      path,
      isExit: false,
      captures: null,
      reachesThrone: true,
      landsOnSafe: true,
      landsOnKarma: false,
      breaksBlockade: isPawnInOwnBlockade(state.pawns, pawn),
    };
  }

  if (targetProgress >= 64) {
    // Inside own corridor: max 2 own pawns allowed per corridor square
    const ownInTarget = state.pawns[owner].filter((p) => p.progress === targetProgress).length;
    if (ownInTarget >= 2) return null;
    return {
      pawnId: pawn.id,
      fromProgress: pawn.progress,
      toProgress: targetProgress,
      steps,
      path,
      isExit: false,
      captures: null,
      reachesThrone: false,
      landsOnSafe: true,
      landsOnKarma: false,
      breaksBlockade: isPawnInOwnBlockade(state.pawns, pawn),
    };
  }

  // Landing on outer ring (0..63)
  const destSq = progressToOuterSquare(owner, targetProgress)!;
  const occupants = getPawnsAtOuterSquare(state.pawns, destSq);
  const safe = isSafeSquare(destSq);
  const karma = isKarmaSquare(destSq);
  const enemy = otherPlayer(owner);
  const enemiesHere = occupants.filter((o) => o.owner === enemy);
  const alliesHere = occupants.filter((o) => o.owner === owner);

  // Max 2 pawns per square on safe zones (or 2 allies forming a blockade)
  if (alliesHere.length >= 2) return null;

  let captureInfo: ParchisiMoveOption['captures'] = null;
  if (enemiesHere.length > 0) {
    if (safe) {
      // On safe zone: can share if total < 2
      if (occupants.length >= 2) return null;
    } else {
      // Non-safe square with 1 enemy pawn
      const targetEnemy = enemiesHere[0];
      if (targetEnemy.shieldTurns > 0) {
        // Love Shield protects this enemy pawn! Can coexist if < 2 total, no capture
        if (occupants.length >= 2) return null;
      } else {
        // Capture! (Even if 1 ally + 1 enemy? In Parchis non-safe can't have mixed unless shielded)
        captureInfo = { owner: enemy, pawnId: targetEnemy.id, square: destSq };
      }
    }
  } else if (occupants.length >= 2) {
    return null;
  }

  return {
    pawnId: pawn.id,
    fromProgress: pawn.progress,
    toProgress: targetProgress,
    steps,
    path,
    isExit: false,
    captures: captureInfo,
    reachesThrone: false,
    landsOnSafe: safe,
    landsOnKarma: karma,
    breaksBlockade: isPawnInOwnBlockade(state.pawns, pawn),
  };
}

/**
 * Compute all legal move options for the active player in WAIT_MOVE, BONUS_20, or BONUS_10.
 * Strictly enforces:
 *  - Express exit on 5 or 6 / Classic exit on 5 only
 *  - All 4 pawns out -> 6 moves 7 spaces
 *  - Mandatory blockade breaking when rolling a 6
 */
export function getLegalParchisiMoves(state: ParchisiState): ParchisiMoveOption[] {
  if (state.phase !== 'WAIT_MOVE' && state.phase !== 'BONUS_20' && state.phase !== 'BONUS_10') {
    return [];
  }
  const owner = state.turn;
  const isBonus = state.phase === 'BONUS_20' || state.phase === 'BONUS_10';
  const steps =
    state.phase === 'BONUS_20'
      ? 20
      : state.phase === 'BONUS_10'
        ? 10
        : state.effectiveSteps;

  const allowExit =
    !isBonus &&
    (state.dieValue === 5 || (state.mode === 'express' && state.dieValue === 6));

  const rawOptions: ParchisiMoveOption[] = [];
  for (const pawn of state.pawns[owner]) {
    const opt = evaluateSinglePawnMove(state, owner, pawn, steps, allowExit);
    if (opt) rawOptions.push(opt);
  }

  // Authentic Parchis rule: on rolling a 6 (regular move, not bonus), if the player has a blockade
  // and at least one blockade pawn can legally move, they MUST break a blockade!
  if (!isBonus && state.dieValue === 6) {
    const blockadeBreakers = rawOptions.filter((o) => o.breaksBlockade);
    if (blockadeBreakers.length > 0) {
      return blockadeBreakers;
    }
  }

  return rawOptions;
}

/** Tick down Love Shield immunity on a player's pawns when their next turn starts */
function decayShieldsFor(
  pawns: Record<ParchisiPlayer, ParchisiPawn[]>,
  owner: ParchisiPlayer,
): Record<ParchisiPlayer, ParchisiPawn[]> {
  const next = clonePawns(pawns);
  for (const p of next[owner]) {
    if (p.shieldTurns > 0) {
      p.shieldTurns = Math.max(0, p.shieldTurns - 1);
    }
  }
  return next;
}

function advanceTurnOrExtra(state: ParchisiState, eventText: string): ParchisiState {
  const nextHistory = eventText ? [eventText, ...state.history].slice(0, 8) : state.history;
  if (state.extraTurnPending) {
    return {
      ...state,
      phase: 'WAIT_ROLL',
      dieValue: null,
      effectiveSteps: 0,
      extraTurnPending: false,
      lastEventText: eventText,
      history: nextHistory,
      stateSeq: state.stateSeq + 1,
    };
  }
  const nextPlayer = otherPlayer(state.turn);
  return {
    ...state,
    phase: 'WAIT_ROLL',
    turn: nextPlayer,
    dieValue: null,
    effectiveSteps: 0,
    consecutiveSixes: 0,
    extraTurnPending: false,
    pawns: decayShieldsFor(state.pawns, nextPlayer),
    lastEventText: eventText,
    history: nextHistory,
    stateSeq: state.stateSeq + 1,
  };
}

export interface RollOutcome {
  state: ParchisiState;
  dieValue: number;
  tripleSixCurse: boolean;
  cursedPawnId: number | null;
  noMovesAvailable: boolean;
  legalMoves: ParchisiMoveOption[];
}

/**
 * Roll the die for the active player (deterministic optional `forcedDie` for unit tests!).
 */
export function rollParchisiDie(
  state: ParchisiState,
  forcedDie?: number,
  rng: () => number = Math.random,
): RollOutcome {
  if (state.phase !== 'WAIT_ROLL') {
    return {
      state,
      dieValue: state.dieValue ?? 1,
      tripleSixCurse: false,
      cursedPawnId: null,
      noMovesAvailable: false,
      legalMoves: [],
    };
  }

  const die = forcedDie !== undefined ? Math.max(1, Math.min(6, Math.round(forcedDie))) : Math.floor(rng() * 6) + 1;
  const owner = state.turn;
  const isSix = die === 6;
  const nextConsecutiveSixes = isSix ? state.consecutiveSixes + 1 : 0;
  const nextStats = {
    host: { ...state.stats.host },
    guest: { ...state.stats.guest },
  };
  if (isSix) nextStats[owner].sixesRolled += 1;

  // Rule: Triple-6 Curse! Cancels 3rd roll & sends last moved pawn back to base (unless safe in final corridor!)
  if (nextConsecutiveSixes >= 3) {
    const nextPawns = clonePawns(state.pawns);
    const lastId = state.lastMovedPawnId[owner];
    let cursedPawnId: number | null = null;
    if (lastId !== null) {
      const target = nextPawns[owner].find((p) => p.id === lastId);
      if (target && target.progress >= 0 && target.progress <= 63) {
        target.progress = -1;
        target.shieldTurns = 0;
        cursedPawnId = target.id;
      }
    }
    const nextPlayer = otherPlayer(owner);
    const finalPawns = decayShieldsFor(nextPawns, nextPlayer);
    const eventText = cursedPawnId !== null ? 'TRIPLE_SIX_CURSED' : 'TRIPLE_SIX_SPARED';
    const nextState: ParchisiState = {
      ...state,
      phase: 'WAIT_ROLL',
      turn: nextPlayer,
      dieValue: 6,
      effectiveSteps: 0,
      rollSeq: state.rollSeq + 1,
      consecutiveSixes: 0,
      extraTurnPending: false,
      pawns: finalPawns,
      stats: nextStats,
      lastEventText: eventText,
      history: [eventText, ...state.history].slice(0, 8),
      stateSeq: state.stateSeq + 1,
    };
    return {
      state: nextState,
      dieValue: 6,
      tripleSixCurse: true,
      cursedPawnId,
      noMovesAvailable: false,
      legalMoves: [],
    };
  }

  // Rule: if all 4 pawns are already out of base, a 6 counts as 7 spaces!
  const effectiveSteps = isSix && areAllPawnsOut(state.pawns, owner) ? 7 : die;

  const candidateState: ParchisiState = {
    ...state,
    phase: 'WAIT_MOVE',
    dieValue: die,
    effectiveSteps,
    rollSeq: state.rollSeq + 1,
    consecutiveSixes: nextConsecutiveSixes,
    extraTurnPending: isSix,
    stats: nextStats,
    lastEventText: '',
    stateSeq: state.stateSeq + 1,
  };

  const legalMoves = getLegalParchisiMoves(candidateState);
  return {
    state: candidateState,
    dieValue: die,
    tripleSixCurse: false,
    cursedPawnId: null,
    noMovesAvailable: legalMoves.length === 0,
    legalMoves,
  };
}

/** Called after 1s toast when no legal moves exist after a roll (or bonus). */
export function passParchisiTurnNoMoves(state: ParchisiState): ParchisiState {
  if (state.phase !== 'WAIT_MOVE' && state.phase !== 'BONUS_20' && state.phase !== 'BONUS_10') {
    return state;
  }
  return advanceTurnOrExtra(state, 'NO_MOVES');
}

/** Find nearest Safe Zone square at or behind `square` for a spared victim pawn. */
export function findNearestSafeSquareBehind(
  victimOwner: ParchisiPlayer,
  fromSquare: number,
  pawns: Record<ParchisiPlayer, ParchisiPawn[]>,
): number {
  const fromProg = outerSquareToProgress(victimOwner, fromSquare);
  // Walk backward along victim's track from fromProg down to 0 to find nearest safe square with room (< 2 pawns)
  for (let p = fromProg; p >= 0; p--) {
    const sq = progressToOuterSquare(victimOwner, p)!;
    if (isSafeSquare(sq)) {
      const occ = getPawnsAtOuterSquare(pawns, sq);
      if (occ.length < 2) return sq;
    }
  }
  // Fallback: check any safe zone with space
  for (const sq of PARCHISI_SAFE_SQUARES) {
    if (getPawnsAtOuterSquare(pawns, sq).length < 2) return sq;
  }
  return progressToOuterSquare(victimOwner, 0)!;
}

function drawNextKarmaCard(usedIds: number[], rng: () => number): ParchisiKarmaCardDef {
  const available = PARCHISI_KARMA_DECK.filter((c) => !usedIds.includes(c.id));
  const pool = available.length > 0 ? available : PARCHISI_KARMA_DECK;
  return pool[Math.floor(rng() * pool.length)];
}

/** Helper: transition into BONUS_20 or BONUS_10 if at least 1 valid pawn can take the bonus, else end/extra turn. */
function enterBonusOrFinishTurn(
  state: ParchisiState,
  bonusPhase: 'BONUS_20' | 'BONUS_10',
  eventText: string,
): ParchisiState {
  const candidate: ParchisiState = {
    ...state,
    phase: bonusPhase,
    effectiveSteps: bonusPhase === 'BONUS_20' ? 20 : 10,
    lastEventText: eventText,
    history: [eventText, ...state.history].slice(0, 8),
    stateSeq: state.stateSeq + 1,
  };
  const legal = getLegalParchisiMoves(candidate);
  if (legal.length === 0) {
    return advanceTurnOrExtra(candidate, `${eventText}_SKIPPED`);
  }
  return candidate;
}

export interface MoveExecutionResult {
  accepted: boolean;
  state: ParchisiState;
  option: ParchisiMoveOption | null;
}

/**
 * Execute a legal pawn move for the active player (during WAIT_MOVE, BONUS_20, or BONUS_10).
 */
export function applyParchisiMove(
  state: ParchisiState,
  pawnId: number,
  rng: () => number = Math.random,
): MoveExecutionResult {
  const legal = getLegalParchisiMoves(state);
  const option = legal.find((o) => o.pawnId === pawnId) ?? null;
  if (!option) {
    return { accepted: false, state, option: null };
  }

  const owner = state.turn;
  const nextPawns = clonePawns(state.pawns);
  const movingPawn = nextPawns[owner].find((p) => p.id === pawnId)!;
  movingPawn.progress = option.toProgress;

  const animSeq = (state.lastMoveAnim?.seq ?? 0) + 1;
  const nextLastMoved = { ...state.lastMovedPawnId, [owner]: pawnId };

  const baseUpdated: ParchisiState = {
    ...state,
    pawns: nextPawns,
    lastMovedPawnId: nextLastMoved,
    lastMoveAnim: {
      seq: animSeq,
      owner,
      pawnId,
      path: option.path,
    },
  };

  // 1. Check Central Throne arrival -> Victory OR +10 Bonus!
  if (option.reachesThrone) {
    const allFinished = nextPawns[owner].every((p) => p.progress >= PARCHISI_THRONE_PROGRESS);
    if (allFinished) {
      return {
        accepted: true,
        option,
        state: {
          ...baseUpdated,
          phase: 'GAME_OVER',
          winner: owner,
          finalDareIndex: Math.floor(rng() * PARCHISI_FINAL_DARE_COUNT),
          lastEventText: 'VICTORY',
          history: ['VICTORY', ...state.history].slice(0, 8),
          stateSeq: state.stateSeq + 1,
        },
      };
    }
    return {
      accepted: true,
      option,
      state: enterBonusOrFinishTurn(baseUpdated, 'BONUS_10', 'THRONE_BONUS_10'),
    };
  }

  // 2. Check Capture -> Trigger Mercy Rule Couple (MERCY_OFFER) with 8s countdown!
  if (option.captures) {
    const dareIndex = Math.floor(rng() * PARCHISI_MERCY_DARE_COUNT);
    return {
      accepted: true,
      option,
      state: {
        ...baseUpdated,
        phase: 'MERCY_OFFER',
        pendingMercy: {
          capturer: owner,
          capturerPawnId: pawnId,
          victim: option.captures.owner,
          victimPawnId: option.captures.pawnId,
          square: option.captures.square,
          dareIndex,
          stage: 'choose',
          countdownSec: PARCHISI_MERCY_COUNTDOWN_SEC,
        },
        lastEventText: 'CAPTURE_OFFER',
        history: ['CAPTURE_OFFER', ...state.history].slice(0, 8),
        stateSeq: state.stateSeq + 1,
      },
    };
  }

  // 3. Check Karma Couple Square -> Draw surprise card!
  if (option.landsOnKarma) {
    const card = drawNextKarmaCard(state.usedKarmaIds, rng);
    const nextUsed =
      state.usedKarmaIds.length + 1 >= PARCHISI_KARMA_DECK.length
        ? [card.id]
        : [...state.usedKarmaIds, card.id];
    const nextStats = {
      host: { ...state.stats.host },
      guest: { ...state.stats.guest },
    };
    nextStats[owner].karmaCards += 1;

    // Apply Love Shield immediately on card draw so visual aura lights up right away
    if (card.effect === 'shield') {
      movingPawn.shieldTurns = 1;
    }

    return {
      accepted: true,
      option,
      state: {
        ...baseUpdated,
        phase: 'KARMA_CARD',
        stats: nextStats,
        usedKarmaIds: nextUsed,
        activeKarma: {
          cardId: card.id,
          effect: card.effect,
          triggeredBy: owner,
          pawnId,
          square: progressToOuterSquare(owner, option.toProgress)!,
        },
        lastEventText: `KARMA_${card.effect.toUpperCase()}`,
        history: [`KARMA_${card.effect.toUpperCase()}`, ...state.history].slice(0, 8),
        stateSeq: state.stateSeq + 1,
      },
    };
  }

  // 4. Normal landing -> Extra turn if rolled 6, else pass turn
  return {
    accepted: true,
    option,
    state: advanceTurnOrExtra(baseUpdated, option.isExit ? 'PAWN_EXIT' : 'PAWN_MOVED'),
  };
}

/**
 * Resolve Mercy Rule ("Rachat par Gage") decision steps:
 *  - 'no_mercy': Send victim pawn to base, grant +20 bonus!
 *  - 'offer_dare': Capturer proposes the drawn webcam dare to victim
 *  - 'accept_dare': Victim accepts and performs live on webcam
 *  - 'decline_dare': Victim declines -> falls back to 'no_mercy' (+20 bonus!)
 *  - 'validate_dare': Capturer validates dare -> victim saved to nearest Safe Zone + capturer gets +10 bonus + "Cœur Tendre" badge!
 */
export function resolveParchisiMercy(
  state: ParchisiState,
  choice: 'no_mercy' | 'offer_dare' | 'accept_dare' | 'decline_dare' | 'validate_dare',
): ParchisiState {
  if (state.phase !== 'MERCY_OFFER' || !state.pendingMercy) return state;
  const mercy = state.pendingMercy;
  const nextStats = {
    host: { ...state.stats.host },
    guest: { ...state.stats.guest },
  };

  if (choice === 'offer_dare' && mercy.stage === 'choose') {
    return {
      ...state,
      pendingMercy: { ...mercy, stage: 'waiting_partner', countdownSec: 0 },
      stateSeq: state.stateSeq + 1,
    };
  }

  if (choice === 'accept_dare' && mercy.stage === 'waiting_partner') {
    return {
      ...state,
      pendingMercy: { ...mercy, stage: 'partner_performing', countdownSec: 0 },
      stateSeq: state.stateSeq + 1,
    };
  }

  if (choice === 'validate_dare' && (mercy.stage === 'partner_performing' || mercy.stage === 'waiting_partner')) {
    const nextPawns = clonePawns(state.pawns);
    const victimPawn = nextPawns[mercy.victim].find((p) => p.id === mercy.victimPawnId);
    if (victimPawn) {
      // Relocate spared pawn to nearest safe zone behind capture square
      const safeSq = findNearestSafeSquareBehind(mercy.victim, mercy.square, nextPawns);
      victimPawn.progress = outerSquareToProgress(mercy.victim, safeSq);
      victimPawn.shieldTurns = 1;
    }
    nextStats[mercy.capturer].tenderHearts += 1;
    nextStats[mercy.victim].daresCompleted += 1;

    const cleared: ParchisiState = {
      ...state,
      pawns: nextPawns,
      pendingMercy: null,
      stats: nextStats,
    };
    return enterBonusOrFinishTurn(cleared, 'BONUS_10', 'MERCY_SAVED_BONUS_10');
  }

  // 'no_mercy' or 'decline_dare' -> Full capture +20 bonus!
  const nextPawns = clonePawns(state.pawns);
  const victimPawn = nextPawns[mercy.victim].find((p) => p.id === mercy.victimPawnId);
  if (victimPawn) {
    victimPawn.progress = -1;
    victimPawn.shieldTurns = 0;
  }
  nextStats[mercy.capturer].captures += 1;

  const cleared: ParchisiState = {
    ...state,
    pawns: nextPawns,
    pendingMercy: null,
    stats: nextStats,
  };
  return enterBonusOrFinishTurn(cleared, 'BONUS_20', 'CAPTURE_BONUS_20');
}

/**
 * Dismiss active Karma Couple card and apply its effect (Turbo +3, Free Roll, Shield, or Complicity).
 */
export function dismissParchisiKarmaCard(
  state: ParchisiState,
  rng: () => number = Math.random,
): ParchisiState {
  if (state.phase !== 'KARMA_CARD' || !state.activeKarma) return state;
  const karma = state.activeKarma;
  const cleared: ParchisiState = { ...state, activeKarma: null };

  if (karma.effect === 'free_roll') {
    // Immediate free reroll without penalizing consecutive sixes
    return {
      ...cleared,
      phase: 'WAIT_ROLL',
      dieValue: null,
      effectiveSteps: 0,
      extraTurnPending: false,
      lastEventText: 'KARMA_FREE_ROLL',
      stateSeq: state.stateSeq + 1,
    };
  }

  if (karma.effect === 'turbo3') {
    // Advance the pawn by +3 immediately if legal (not blocked by a wall)
    const turboState: ParchisiState = {
      ...cleared,
      phase: 'WAIT_MOVE',
      effectiveSteps: 3,
      dieValue: 3,
    };
    const legal = getLegalParchisiMoves(turboState);
    const preferred = legal.find((m) => m.pawnId === karma.pawnId) ?? legal[0];
    if (preferred) {
      const moved = applyParchisiMove(turboState, preferred.pawnId, rng);
      return moved.state;
    }
    return advanceTurnOrExtra(cleared, 'KARMA_TURBO_BLOCKED');
  }

  // 'shield' (already applied) or 'complicity'
  return advanceTurnOrExtra(cleared, 'KARMA_DONE');
}

/**
 * Smart Solo AI Move Evaluator (strictly follows requested priority order):
 *  1) Enter Central Throne
 *  2) Capture opponent pawn
 *  3) Exit a pawn from home yard (on 5 or 6 in Express)
 *  4) Land on a Safe Zone (star/shield)
 *  5) Advance the pawn closest to victory (highest progress)
 */
export function chooseAiParchisiMove(state: ParchisiState): number | null {
  const legal = getLegalParchisiMoves(state);
  if (legal.length === 0) return null;
  if (legal.length === 1) return legal[0].pawnId;

  const scoreOption = (opt: ParchisiMoveOption): number => {
    let score = 0;
    if (opt.reachesThrone) score += 10000;
    if (opt.captures) score += 5000;
    if (opt.isExit) score += 2500;
    if (opt.landsOnSafe) score += 1200;
    if (opt.landsOnKarma) score += 450;
    // Prefer moving the pawn closest to victory
    score += opt.toProgress * 10;
    return score;
  };

  let best = legal[0];
  let bestScore = scoreOption(best);
  for (let i = 1; i < legal.length; i++) {
    const s = scoreOption(legal[i]);
    if (s > bestScore) {
      bestScore = s;
      best = legal[i];
    }
  }
  return best.pawnId;
}

/**
 * Hand-shake detector for optional MediaPipe HandLandmarker "Dé à la main" roll trigger.
 * Tracks left-right direction reversals of mirrored palmX.
 */
export interface HandShakeDetectorState {
  lastX: number | null;
  lastDir: -1 | 0 | 1;
  shakeEnergy: number; // 0..1
  cooldownSec: number;
}

export function createHandShakeState(): HandShakeDetectorState {
  return { lastX: null, lastDir: 0, shakeEnergy: 0, cooldownSec: 0 };
}

export function stepHandShakeDetector(
  prev: HandShakeDetectorState,
  handDetected: boolean,
  palmX: number,
  dt: number,
): { next: HandShakeDetectorState; triggered: boolean; intensity: number } {
  const cooldownSec = Math.max(0, prev.cooldownSec - dt);
  if (!handDetected) {
    const decayed = Math.max(0, prev.shakeEnergy - dt * 2.2);
    return {
      next: { lastX: null, lastDir: 0, shakeEnergy: decayed, cooldownSec },
      triggered: false,
      intensity: decayed,
    };
  }

  let energy = Math.max(0, prev.shakeEnergy - dt * 1.15);
  let lastDir = prev.lastDir;

  if (prev.lastX !== null) {
    const dx = palmX - prev.lastX;
    if (Math.abs(dx) > 0.032) {
      const dir: -1 | 1 = dx > 0 ? 1 : -1;
      if (lastDir !== 0 && dir !== lastDir) {
        // Direction reversal while shaking hand left-right!
        energy = Math.min(1, energy + Math.min(0.45, Math.abs(dx) * 3.8));
      } else {
        energy = Math.min(1, energy + Math.abs(dx) * 0.65);
      }
      lastDir = dir;
    }
  }

  const triggered = cooldownSec <= 0 && energy >= 0.88;
  return {
    next: {
      lastX: palmX,
      lastDir,
      shakeEnergy: triggered ? 0 : energy,
      cooldownSec: triggered ? 1.4 : cooldownSec,
    },
    triggered,
    intensity: energy,
  };
}

export const PARCHISI_LOOP_SIZE = PARCHISI_TOTAL_SQUARES;
