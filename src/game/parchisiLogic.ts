import type {
  ParchisiBonusAmount,
  ParchisiColor,
  ParchisiDiceCount,
  ParchisiMode,
  ParchisiMoveOption,
  ParchisiPlayerStats,
  ParchisiState,
  ParchisiToken,
} from '../types/duoplay';
import {
  COLOR_PALETTE,
  COLOR_START_SQUARE,
  isSafeSquare,
  PARCHISI_HOME_PROGRESS,
  PARCHISI_TOTAL_SQUARES,
  progressToOuterSquare,
} from './parchisiBoard';

export const ALL_PARCHISI_COLORS: readonly ParchisiColor[] = ['red', 'green', 'yellow', 'blue'];
export const PARCHISI_TURN_SECONDS = 30;
export const PARCHISI_STEP_ANIM_MS = 105;

export function getActiveColorsForMode(mode: ParchisiMode): ParchisiColor[] {
  return mode === '4p' ? ['red', 'green', 'yellow', 'blue'] : ['red', 'yellow'];
}

export function getNextActiveColor(activeColors: ParchisiColor[], current: ParchisiColor): ParchisiColor {
  const idx = activeColors.indexOf(current);
  if (idx === -1) return activeColors[0] ?? 'red';
  return activeColors[(idx + 1) % activeColors.length];
}

function createEmptyStats(): Record<ParchisiColor, ParchisiPlayerStats> {
  return {
    red: { captures: 0, doublesRolled: 0, homeEntries: 0 },
    green: { captures: 0, doublesRolled: 0, homeEntries: 0 },
    yellow: { captures: 0, doublesRolled: 0, homeEntries: 0 },
    blue: { captures: 0, doublesRolled: 0, homeEntries: 0 },
  };
}

function createEmptyLastMoved(): Record<ParchisiColor, number | null> {
  return { red: null, green: null, yellow: null, blue: null };
}

function buildInitialTokens(mode: ParchisiMode): Record<ParchisiColor, ParchisiToken[]> {
  const active = new Set(getActiveColorsForMode(mode));
  const make = (color: ParchisiColor): ParchisiToken[] =>
    active.has(color)
      ? [0, 1, 2, 3].map((id) => ({ id, color, progress: -1 }))
      : [];

  return {
    red: make('red'),
    green: make('green'),
    yellow: make('yellow'),
    blue: make('blue'),
  };
}

function freshUsedDice(diceCount: ParchisiDiceCount): boolean[] {
  return diceCount === 1 ? [false] : [false, false];
}

function allSpentDice(diceCount: ParchisiDiceCount): boolean[] {
  return diceCount === 1 ? [true] : [true, true];
}

export function createInitialParchisiState(
  mode: ParchisiMode = '1v1',
  nowMs = Date.now(),
  diceCount: ParchisiDiceCount = 2,
): ParchisiState {
  return {
    phase: 'READY',
    mode,
    diceCount,
    activeColors: getActiveColorsForMode(mode),
    turn: 'red',
    dice: null,
    usedDice: freshUsedDice(diceCount),
    pendingBonuses: [],
    rollSeq: 0,
    consecutiveDoubles: 0,
    extraRollPending: false,
    mustBreakBlockade: false,
    lastMovedTokenId: createEmptyLastMoved(),
    tokens: buildInitialTokens(mode),
    lastMoveAnim: null,
    lastEventText: '',
    lastEventTone: 'neutral',
    winner: null,
    stats: createEmptyStats(),
    turnStartedAt: nowMs,
    stateSeq: 0,
  };
}

export function startParchisiMatch(
  mode: ParchisiMode,
  nowMs = Date.now(),
  diceCount: ParchisiDiceCount = 2,
): ParchisiState {
  const base = createInitialParchisiState(mode, nowMs, diceCount);
  return {
    ...base,
    phase: 'WAIT_ROLL',
    lastEventText: diceCount === 1 ? 'Red starts! Roll the die.' : 'Red starts! Roll both dice.',
    stateSeq: 1,
  };
}

/** Collect all tokens sitting on a specific outer board square (1..68). */
export function getTokensAtOuterSquare(
  tokens: Record<ParchisiColor, ParchisiToken[]>,
  square: number,
  exclude?: { color: ParchisiColor; tokenId: number },
): ParchisiToken[] {
  const list: ParchisiToken[] = [];
  for (const color of ALL_PARCHISI_COLORS) {
    for (const token of tokens[color]) {
      if (exclude && token.color === exclude.color && token.id === exclude.tokenId) continue;
      if (token.progress >= 0 && token.progress <= 63) {
        if (progressToOuterSquare(color, token.progress) === square) {
          list.push(token);
        }
      }
    }
  }
  return list;
}

/** Collect tokens of a given color sitting on a specific home-column progress (64..70). */
function getCorridorTokensAtProgress(
  tokens: Record<ParchisiColor, ParchisiToken[]>,
  color: ParchisiColor,
  progress: number,
  excludeTokenId?: number,
): ParchisiToken[] {
  return tokens[color].filter(
    (t) => t.id !== excludeTokenId && t.progress === progress,
  );
}

/**
 * Returns the blockade owner color on an outer square (1..68) if 2 tokens of the SAME color occupy it.
 */
export function getOuterSquareBlockadeOwner(
  tokens: Record<ParchisiColor, ParchisiToken[]>,
  square: number,
): ParchisiColor | null {
  const occ = getTokensAtOuterSquare(tokens, square);
  if (occ.length < 2) return null;
  for (const color of ALL_PARCHISI_COLORS) {
    const count = occ.filter((t) => t.color === color).length;
    if (count >= 2) return color;
  }
  return null;
}

/**
 * Checks whether a specific token is currently part of a same-color blockade (2 own tokens on same tile 0..70).
 */
export function isTokenInOwnBlockade(
  tokens: Record<ParchisiColor, ParchisiToken[]>,
  token: ParchisiToken,
): boolean {
  if (token.progress < 0 || token.progress >= PARCHISI_HOME_PROGRESS) return false;
  const count = tokens[token.color].filter((t) => t.progress === token.progress).length;
  return count >= 2;
}

/** Returns true if a player currently holds at least one blockade on tiles 0..70. */
export function playerHasAnyBlockade(
  tokens: Record<ParchisiColor, ParchisiToken[]>,
  color: ParchisiColor,
): boolean {
  const counts = new Map<number, number>();
  for (const t of tokens[color]) {
    if (t.progress >= 0 && t.progress < PARCHISI_HOME_PROGRESS) {
      const next = (counts.get(t.progress) ?? 0) + 1;
      if (next >= 2) return true;
      counts.set(t.progress, next);
    }
  }
  return false;
}

/** Returns all outer square IDs (1..68) currently holding a same-color blockade for visual rendering. */
export function getAllOuterBlockadeSquares(
  tokens: Record<ParchisiColor, ParchisiToken[]>,
): Map<number, ParchisiColor> {
  const map = new Map<number, ParchisiColor>();
  for (const color of ALL_PARCHISI_COLORS) {
    const bySq = new Map<number, number>();
    for (const t of tokens[color]) {
      const sq = progressToOuterSquare(color, t.progress);
      if (sq !== null) {
        const next = (bySq.get(sq) ?? 0) + 1;
        bySq.set(sq, next);
        if (next >= 2) {
          map.set(sq, color);
        }
      }
    }
  }
  return map;
}

function cloneTokens(
  tokens: Record<ParchisiColor, ParchisiToken[]>,
): Record<ParchisiColor, ParchisiToken[]> {
  return {
    red: tokens.red.map((t) => ({ ...t })),
    green: tokens.green.map((t) => ({ ...t })),
    yellow: tokens.yellow.map((t) => ({ ...t })),
    blue: tokens.blue.map((t) => ({ ...t })),
  };
}

interface StepEval {
  toProgress: number;
  path: number[];
  capture: { color: ParchisiColor; tokenId: number; square: number } | null;
  reachesHome: boolean;
  landsOnSafe: boolean;
}

/**
 * Evaluates a single contiguous advance of `steps` for a token already on the board (`0 <= progress < 71`).
 * Strictly enforces:
 *  - Exact count to enter Center Triangle Goal (71)
 *  - No passing through or landing on ANY same-color blockade (own or opponent)
 *  - Max 2 tokens per tile on track & home column
 *  - Capturing single opponent token on non-safe outer tile
 */
function evaluateBoardAdvance(
  tokens: Record<ParchisiColor, ParchisiToken[]>,
  token: ParchisiToken,
  steps: number,
): StepEval | null {
  if (token.progress < 0 || token.progress >= PARCHISI_HOME_PROGRESS || steps <= 0) {
    return null;
  }

  const targetProgress = token.progress + steps;
  // Exact count required to enter the Center Triangle Goal (71)
  if (targetProgress > PARCHISI_HOME_PROGRESS) {
    return null;
  }

  const path: number[] = [];

  for (let s = 1; s <= steps; s++) {
    const p = token.progress + s;
    path.push(p);

    if (p <= 63) {
      const sq = progressToOuterSquare(token.color, p)!;
      // No token (own or opponent) can pass through or land on a same-color blockade
      if (getOuterSquareBlockadeOwner(tokens, sq) !== null) {
        return null;
      }
    } else if (p < PARCHISI_HOME_PROGRESS) {
      // Own home column (64..70): cannot pass through or land on an own blockade (2 own tokens)
      const corrOcc = getCorridorTokensAtProgress(tokens, token.color, p, token.id);
      if (corrOcc.length >= 2) {
        return null;
      }
    }
  }

  // Landing tile checks
  if (targetProgress === PARCHISI_HOME_PROGRESS) {
    return {
      toProgress: PARCHISI_HOME_PROGRESS,
      path,
      capture: null,
      reachesHome: true,
      landsOnSafe: true,
    };
  }

  if (targetProgress >= 64) {
    // Home column landing already verified < 2 own tokens above
    return {
      toProgress: targetProgress,
      path,
      capture: null,
      reachesHome: false,
      landsOnSafe: true,
    };
  }

  const landingSq = progressToOuterSquare(token.color, targetProgress)!;
  const occ = getTokensAtOuterSquare(tokens, landingSq, {
    color: token.color,
    tokenId: token.id,
  });

  // Every outer tile holds at most 2 tokens
  if (occ.length >= 2) {
    return null;
  }

  const safe = isSafeSquare(landingSq);
  let capture: StepEval['capture'] = null;

  if (occ.length === 1) {
    const other = occ[0];
    if (other.color !== token.color && !safe) {
      capture = {
        color: other.color,
        tokenId: other.id,
        square: landingSq,
      };
    }
  }

  return {
    toProgress: targetProgress,
    path,
    capture,
    reachesHome: false,
    landsOnSafe: safe,
  };
}

/**
 * Evaluate applying both dice sequentially (`firstSteps` then `secondSteps`) to the same token,
 * checking intermediate tile legality, blockades, and intermediate captures.
 */
function evaluateCombinedBoardAdvance(
  tokens: Record<ParchisiColor, ParchisiToken[]>,
  token: ParchisiToken,
  d1: number,
  d2: number,
): {
  toProgress: number;
  path: number[];
  captures: { color: ParchisiColor; tokenId: number; square: number }[];
  reachesHome: boolean;
  landsOnSafe: boolean;
} | null {
  const tryOrder = (first: number, second: number) => {
    const step1 = evaluateBoardAdvance(tokens, token, first);
    if (!step1 || step1.reachesHome) return null;

    // Build virtual board after step1 (including removing any captured opponent on intermediate tile)
    const nextTokens = cloneTokens(tokens);
    const movedToken = nextTokens[token.color].find((t) => t.id === token.id)!;
    movedToken.progress = step1.toProgress;
    if (step1.capture) {
      const cap = nextTokens[step1.capture.color].find((t) => t.id === step1.capture!.tokenId);
      if (cap) cap.progress = -1;
    }

    const step2 = evaluateBoardAdvance(nextTokens, movedToken, second);
    if (!step2) return null;

    const captures: { color: ParchisiColor; tokenId: number; square: number }[] = [];
    if (step1.capture) captures.push(step1.capture);
    if (step2.capture) captures.push(step2.capture);

    return {
      toProgress: step2.toProgress,
      path: [...step1.path, ...step2.path],
      captures,
      reachesHome: step2.reachesHome,
      landsOnSafe: step2.landsOnSafe,
    };
  };

  // Prefer the order that lands cleanly (or captures on final tile); fall back to swapped order if blocked
  const orderA = tryOrder(d1, d2);
  if (orderA) return orderA;
  if (d1 !== d2) {
    return tryOrder(d2, d1);
  }
  return null;
}

/**
 * Computes ALL legal move options for the active player in the current state.
 * Handles:
 *  - Pending +20 (capture) and +10 (center home) bonuses first
 *  - Rule of 5 base exits (die1=5, die2=5, die1+die2=5, and 5+5 double exit)
 *  - Single-die moves (d1, d2) and combined sequential moves (d1+d2)
 *  - Mandatory Blockade Break rule when rolling doubles
 */
export function getLegalParchisiMoves(state: ParchisiState): ParchisiMoveOption[] {
  if (state.phase !== 'WAIT_MOVE') return [];
  const color = state.turn;
  const myTokens = state.tokens[color];
  const rawMoves: ParchisiMoveOption[] = [];

  // 1. Pending +20 or +10 bonus must be played immediately before remaining dice
  if (state.pendingBonuses.length > 0) {
    const bonus = state.pendingBonuses[0];
    for (const token of myTokens) {
      if (token.progress < 0 || token.progress >= PARCHISI_HOME_PROGRESS) continue;
      const evalRes = evaluateBoardAdvance(state.tokens, token, bonus);
      if (!evalRes) continue;
      rawMoves.push({
        id: `t${token.id}:bonus-${bonus}`,
        tokenId: token.id,
        color,
        fromProgress: token.progress,
        toProgress: evalRes.toProgress,
        steps: bonus,
        diceUsed: [],
        bonusUsed: bonus,
        label: `+${bonus}`,
        path: evalRes.path,
        isExit: false,
        captures: evalRes.capture ? [evalRes.capture] : [],
        reachesHome: evalRes.reachesHome,
        landsOnSafe: evalRes.landsOnSafe,
        breaksBlockade: isTokenInOwnBlockade(state.tokens, token),
      });
    }
    return rawMoves;
  }

  // 2. Single-die mode (diceCount === 1)
  if (!state.dice || state.dice.length === 0) return [];

  const startSq = COLOR_START_SQUARE[color];
  const startOccupancy = getTokensAtOuterSquare(state.tokens, startSq).length;
  const canExitStart = startOccupancy < 2;

  if (state.diceCount === 1 || state.dice.length === 1) {
    const d1 = state.dice[0];
    const u1 = Boolean(state.usedDice[0]);
    if (u1) return [];

    for (const token of myTokens) {
      if (token.progress >= PARCHISI_HOME_PROGRESS) continue;

      // Rolling 5 allows exiting a pawn from base onto Start square
      if (token.progress === -1) {
        if (d1 === 5 && canExitStart) {
          rawMoves.push({
            id: `t${token.id}:exit-d0`,
            tokenId: token.id,
            color,
            fromProgress: -1,
            toProgress: 0,
            steps: 5,
            diceUsed: [0],
            bonusUsed: null,
            label: 'Exit (5)',
            path: [0],
            isExit: true,
            captures: [],
            reachesHome: false,
            landsOnSafe: true,
            breaksBlockade: false,
          });
        }
        continue;
      }

      // Advance an active token on the board by d1 (including advancing by 5!)
      const m1 = evaluateBoardAdvance(state.tokens, token, d1);
      if (m1) {
        rawMoves.push({
          id: `t${token.id}:d0`,
          tokenId: token.id,
          color,
          fromProgress: token.progress,
          toProgress: m1.toProgress,
          steps: d1,
          diceUsed: [0],
          bonusUsed: null,
          label: `+${d1}`,
          path: m1.path,
          isExit: false,
          captures: m1.capture ? [m1.capture] : [],
          reachesHome: m1.reachesHome,
          landsOnSafe: m1.landsOnSafe,
          breaksBlockade: isTokenInOwnBlockade(state.tokens, token),
        });
      }
    }

    return rawMoves;
  }

  // 3. Regular 2-dice phase (100% preserved)
  const [d1, d2] = state.dice;
  const [u1, u2] = state.usedDice;
  if (u1 && u2) return [];

  for (const token of myTokens) {
    if (token.progress >= PARCHISI_HOME_PROGRESS) continue;

    // Rule of 5: Exiting corner home base
    if (token.progress === -1) {
      if (!canExitStart) continue;

      if (!u1 && d1 === 5) {
        rawMoves.push({
          id: `t${token.id}:exit-d0`,
          tokenId: token.id,
          color,
          fromProgress: -1,
          toProgress: 0,
          steps: 5,
          diceUsed: [0],
          bonusUsed: null,
          label: 'Exit (5)',
          path: [0],
          isExit: true,
          captures: [],
          reachesHome: false,
          landsOnSafe: true,
          breaksBlockade: false,
        });
      } else if (!u2 && d2 === 5) {
        rawMoves.push({
          id: `t${token.id}:exit-d1`,
          tokenId: token.id,
          color,
          fromProgress: -1,
          toProgress: 0,
          steps: 5,
          diceUsed: [1],
          bonusUsed: null,
          label: 'Exit (5)',
          path: [0],
          isExit: true,
          captures: [],
          reachesHome: false,
          landsOnSafe: true,
          breaksBlockade: false,
        });
      } else if (!u1 && !u2 && d1 + d2 === 5) {
        rawMoves.push({
          id: `t${token.id}:exit-sum`,
          tokenId: token.id,
          color,
          fromProgress: -1,
          toProgress: 0,
          steps: 5,
          diceUsed: [0, 1],
          bonusUsed: null,
          label: 'Exit (5)',
          path: [0],
          isExit: true,
          captures: [],
          reachesHome: false,
          landsOnSafe: true,
          breaksBlockade: false,
        });
      }
      continue;
    }

    // Token already on the board (0..70)
    const breaksBlockade = isTokenInOwnBlockade(state.tokens, token);

    if (!u1) {
      const m1 = evaluateBoardAdvance(state.tokens, token, d1);
      if (m1) {
        rawMoves.push({
          id: `t${token.id}:d0`,
          tokenId: token.id,
          color,
          fromProgress: token.progress,
          toProgress: m1.toProgress,
          steps: d1,
          diceUsed: [0],
          bonusUsed: null,
          label: `+${d1}`,
          path: m1.path,
          isExit: false,
          captures: m1.capture ? [m1.capture] : [],
          reachesHome: m1.reachesHome,
          landsOnSafe: m1.landsOnSafe,
          breaksBlockade,
        });
      }
    }

    // Avoid duplicate identical pill when both dice are unused and equal (doubles)
    if (!u2 && (u1 || d2 !== d1)) {
      const m2 = evaluateBoardAdvance(state.tokens, token, d2);
      if (m2) {
        rawMoves.push({
          id: `t${token.id}:d1`,
          tokenId: token.id,
          color,
          fromProgress: token.progress,
          toProgress: m2.toProgress,
          steps: d2,
          diceUsed: [1],
          bonusUsed: null,
          label: `+${d2}`,
          path: m2.path,
          isExit: false,
          captures: m2.capture ? [m2.capture] : [],
          reachesHome: m2.reachesHome,
          landsOnSafe: m2.landsOnSafe,
          breaksBlockade,
        });
      }
    }

    // Combined move (d1 + d2) sequentially on the same token when both dice are unused
    if (!u1 && !u2) {
      const mSum = evaluateCombinedBoardAdvance(state.tokens, token, d1, d2);
      if (mSum) {
        rawMoves.push({
          id: `t${token.id}:sum`,
          tokenId: token.id,
          color,
          fromProgress: token.progress,
          toProgress: mSum.toProgress,
          steps: d1 + d2,
          diceUsed: [0, 1],
          bonusUsed: null,
          label: `+${d1 + d2}`,
          path: mSum.path,
          isExit: false,
          captures: mSum.captures,
          reachesHome: mSum.reachesHome,
          landsOnSafe: mSum.landsOnSafe,
          breaksBlockade,
        });
      }
    }
  }

  // Official Blockade Break Rule on Doubles:
  // If rolling doubles while holding an own blockade, player must break a blockade if a legal move exists.
  if (state.mustBreakBlockade) {
    const breakingMoves = rawMoves.filter((m) => m.breaksBlockade);
    if (breakingMoves.length > 0) {
      return breakingMoves;
    }
  }

  return rawMoves;
}

/**
 * Rolls two 6-sided dice for the active player, enforcing:
 *  - Doubles grant an extra roll
 *  - 3 consecutive doubles forfeit the 3rd roll and return last moved token (if outside home column) to base
 *  - Blockade Break requirement on doubles if owning a blockade
 */
export function rollParchisiDice(
  state: ParchisiState,
  forcedDice?: number[],
  rng: () => number = Math.random,
  nowMs = Date.now(),
): ParchisiState {
  if (state.phase !== 'WAIT_ROLL') return state;

  const color = state.turn;
  const colorLabel = COLOR_PALETTE[color].label;
  const nextStats: Record<ParchisiColor, ParchisiPlayerStats> = {
    red: { ...state.stats.red },
    green: { ...state.stats.green },
    yellow: { ...state.stats.yellow },
    blue: { ...state.stats.blue },
  };

  // --- 1-Die Mode ---
  if (state.diceCount === 1) {
    const d1 =
      forcedDice && forcedDice.length > 0
        ? Math.max(1, Math.min(6, Math.round(forcedDice[0])))
        : Math.floor(rng() * 6) + 1;
    const isSix = d1 === 6;
    const nextConsecutiveSixes = isSix ? state.consecutiveDoubles + 1 : 0;

    if (isSix) {
      nextStats[color].doublesRolled += 1;
    }

    // 3 consecutive sixes forfeit the 3rd roll and pass the turn
    if (nextConsecutiveSixes >= 3) {
      return {
        ...state,
        phase: 'WAIT_MOVE',
        dice: [d1],
        usedDice: [true],
        pendingBonuses: [],
        rollSeq: state.rollSeq + 1,
        consecutiveDoubles: 0,
        extraRollPending: false,
        mustBreakBlockade: false,
        stats: nextStats,
        lastMoveAnim: null,
        lastEventText: `3 sixes in a row! ${colorLabel}'s turn forfeited.`,
        lastEventTone: 'warning',
        turnStartedAt: nowMs,
        stateSeq: state.stateSeq + 1,
      };
    }

    return {
      ...state,
      phase: 'WAIT_MOVE',
      dice: [d1],
      usedDice: [false],
      pendingBonuses: [],
      rollSeq: state.rollSeq + 1,
      consecutiveDoubles: nextConsecutiveSixes,
      extraRollPending: isSix,
      mustBreakBlockade: false,
      stats: nextStats,
      lastMoveAnim: null,
      lastEventText: isSix
        ? `${colorLabel} rolled 6! Bonus roll earned.`
        : `${colorLabel} rolled ${d1}.`,
      lastEventTone: isSix ? 'bonus' : 'neutral',
      turnStartedAt: nowMs,
      stateSeq: state.stateSeq + 1,
    };
  }

  // --- Classic 2-Dice Mode (100% preserved) ---
  const d1 =
    forcedDice && forcedDice.length > 0
      ? Math.max(1, Math.min(6, Math.round(forcedDice[0])))
      : Math.floor(rng() * 6) + 1;
  const d2 =
    forcedDice && forcedDice.length > 1
      ? Math.max(1, Math.min(6, Math.round(forcedDice[1])))
      : Math.floor(rng() * 6) + 1;

  const isDoubles = d1 === d2;
  const nextConsecutiveDoubles = isDoubles ? state.consecutiveDoubles + 1 : 0;
  if (isDoubles) {
    nextStats[color].doublesRolled += 1;
  }

  // Three-Doubles Penalty
  if (nextConsecutiveDoubles >= 3) {
    const nextTokens = cloneTokens(state.tokens);
    const lastId = state.lastMovedTokenId[color];
    const targetToken =
      lastId !== null ? nextTokens[color].find((t) => t.id === lastId) : undefined;

    let penaltyText = `3 consecutive doubles (${d1}-${d2})! Roll forfeited.`;
    if (targetToken && targetToken.progress >= 0 && targetToken.progress <= 63) {
      targetToken.progress = -1;
      penaltyText = `3 consecutive doubles! ${colorLabel}'s last token returns to base!`;
    } else if (targetToken && targetToken.progress >= 64 && targetToken.progress < PARCHISI_HOME_PROGRESS) {
      penaltyText = `3 consecutive doubles! ${colorLabel}'s token is safe inside home column.`;
    }

    return {
      ...state,
      phase: 'WAIT_MOVE',
      dice: [d1, d2],
      usedDice: [true, true],
      pendingBonuses: [],
      rollSeq: state.rollSeq + 1,
      consecutiveDoubles: 0,
      extraRollPending: false,
      mustBreakBlockade: false,
      tokens: nextTokens,
      stats: nextStats,
      lastMoveAnim: null,
      lastEventText: penaltyText,
      lastEventTone: 'warning',
      turnStartedAt: nowMs,
      stateSeq: state.stateSeq + 1,
    };
  }

  const mustBreak = isDoubles && playerHasAnyBlockade(state.tokens, color);
  const rolledText = isDoubles
    ? `${colorLabel} rolled Double ${d1}! Extra roll earned.${mustBreak ? ' Break a blockade!' : ''}`
    : `${colorLabel} rolled ${d1} & ${d2}.`;

  return {
    ...state,
    phase: 'WAIT_MOVE',
    dice: [d1, d2],
    usedDice: [false, false],
    pendingBonuses: [],
    rollSeq: state.rollSeq + 1,
    consecutiveDoubles: nextConsecutiveDoubles,
    extraRollPending: isDoubles,
    mustBreakBlockade: mustBreak,
    stats: nextStats,
    lastMoveAnim: null,
    lastEventText: rolledText,
    lastEventTone: isDoubles ? 'bonus' : 'neutral',
    turnStartedAt: nowMs,
    stateSeq: state.stateSeq + 1,
  };
}

/**
 * Executes a validated move option for the active player, awarding +20 on capture,
 * +10 on center triangle home entry, checking Victory (all 4 tokens at 71), and managing dice/turn flow.
 */
export function applyParchisiMove(
  state: ParchisiState,
  moveOptionId: string,
  nowMs = Date.now(),
): ParchisiState {
  if (state.phase !== 'WAIT_MOVE') return state;
  const legal = getLegalParchisiMoves(state);
  const move = legal.find((m) => m.id === moveOptionId);
  if (!move) return state;

  const color = state.turn;
  const colorLabel = COLOR_PALETTE[color].label;
  const nextTokens = cloneTokens(state.tokens);
  const movedToken = nextTokens[color].find((t) => t.id === move.tokenId);
  if (!movedToken) return state;

  movedToken.progress = move.toProgress;

  const nextStats: Record<ParchisiColor, ParchisiPlayerStats> = {
    red: { ...state.stats.red },
    green: { ...state.stats.green },
    yellow: { ...state.stats.yellow },
    blue: { ...state.stats.blue },
  };

  // Start from remaining pending bonuses (shift current if this was a bonus move)
  const nextBonuses: ParchisiBonusAmount[] =
    move.bonusUsed !== null ? state.pendingBonuses.slice(1) : [...state.pendingBonuses];

  // Apply captures -> send opponents to base & award +20 bonus per capture
  const capturedList: { color: ParchisiColor; tokenId: number; fromProgress: number }[] = [];
  for (const cap of move.captures) {
    const victim = nextTokens[cap.color].find((t) => t.id === cap.tokenId);
    if (victim) {
      const victimFromProgress = victim.progress;
      victim.progress = -1;
      capturedList.push({
        color: cap.color,
        tokenId: cap.tokenId,
        fromProgress: victimFromProgress,
      });
      nextStats[color].captures += 1;
      nextBonuses.unshift(20);
    }
  }

  // Apply home entry -> award +10 bonus
  if (move.reachesHome) {
    nextStats[color].homeEntries += 1;
    nextBonuses.unshift(10);
  }

  const nextUsedDice: boolean[] = [...state.usedDice];
  for (const idx of move.diceUsed) {
    if (idx >= 0 && idx < nextUsedDice.length) {
      nextUsedDice[idx] = true;
    }
  }

  const nextLastMoved: Record<ParchisiColor, number | null> = {
    ...state.lastMovedTokenId,
    [color]: move.tokenId,
  };

  const animSeq = (state.lastMoveAnim?.seq ?? 0) + 1;
  const lastMoveAnim = {
    seq: animSeq,
    color,
    tokenId: move.tokenId,
    fromProgress: move.fromProgress,
    path: move.path,
    captured: capturedList,
    reachedHome: move.reachesHome,
    landedSafe: move.landsOnSafe,
  };

  // Victory check: all 4 tokens in Center Triangle Goal (71)
  const allHome = nextTokens[color].every((t) => t.progress >= PARCHISI_HOME_PROGRESS);
  if (allHome) {
    return {
      ...state,
      phase: 'GAME_OVER',
      tokens: nextTokens,
      usedDice: allSpentDice(state.diceCount),
      pendingBonuses: [],
      mustBreakBlockade: false,
      lastMovedTokenId: nextLastMoved,
      lastMoveAnim,
      lastEventText: `${colorLabel} wins Official Parcheesi!`,
      lastEventTone: 'win',
      winner: color,
      stats: nextStats,
      turnStartedAt: nowMs,
      stateSeq: state.stateSeq + 1,
    };
  }

  // Determine event banner text & tone
  let eventText = `${colorLabel} moved ${move.label}.`;
  let eventTone: ParchisiState['lastEventTone'] = 'neutral';
  if (capturedList.length > 0) {
    eventText = `Captured! ${colorLabel} earns +20 bonus!`;
    eventTone = 'capture';
  } else if (move.reachesHome) {
    eventText = `Home! ${colorLabel} earns +10 bonus!`;
    eventTone = 'bonus';
  } else if (move.isExit) {
    eventText = `${colorLabel} entered the board!`;
    eventTone = 'safe';
  } else if (move.landsOnSafe && move.toProgress <= 63) {
    eventText = `${colorLabel} reached a Safe Star tile.`;
    eventTone = 'safe';
  }

  const nextMustBreakBlockade = move.breaksBlockade ? false : state.mustBreakBlockade;

  // 1. If bonuses remain, stay in WAIT_MOVE to play the bonus immediately
  if (nextBonuses.length > 0) {
    return {
      ...state,
      phase: 'WAIT_MOVE',
      tokens: nextTokens,
      usedDice: nextUsedDice,
      pendingBonuses: nextBonuses,
      mustBreakBlockade: nextMustBreakBlockade,
      lastMovedTokenId: nextLastMoved,
      lastMoveAnim,
      lastEventText: eventText,
      lastEventTone: eventTone,
      stats: nextStats,
      turnStartedAt: nowMs,
      stateSeq: state.stateSeq + 1,
    };
  }

  // 2. If a die is still unused, stay in WAIT_MOVE
  if (nextUsedDice.some((used) => !used)) {
    return {
      ...state,
      phase: 'WAIT_MOVE',
      tokens: nextTokens,
      usedDice: nextUsedDice,
      pendingBonuses: [],
      mustBreakBlockade: nextMustBreakBlockade,
      lastMovedTokenId: nextLastMoved,
      lastMoveAnim,
      lastEventText: eventText,
      lastEventTone: eventTone,
      stats: nextStats,
      turnStartedAt: nowMs,
      stateSeq: state.stateSeq + 1,
    };
  }

  // 3. All dice spent and no bonuses remain -> Extra roll (on 6 in 1-die mode, or doubles in 2-dice mode), or advance turn
  if (state.extraRollPending) {
    return {
      ...state,
      phase: 'WAIT_ROLL',
      dice: null,
      usedDice: freshUsedDice(state.diceCount),
      pendingBonuses: [],
      extraRollPending: false,
      mustBreakBlockade: false,
      tokens: nextTokens,
      lastMovedTokenId: nextLastMoved,
      lastMoveAnim,
      lastEventText:
        state.diceCount === 1
          ? `${colorLabel} gets a bonus roll for 6!`
          : `${colorLabel} gets an extra roll for doubles!`,
      lastEventTone: 'bonus',
      stats: nextStats,
      turnStartedAt: nowMs,
      stateSeq: state.stateSeq + 1,
    };
  }

  const nextTurn = getNextActiveColor(state.activeColors, color);
  return {
    ...state,
    phase: 'WAIT_ROLL',
    turn: nextTurn,
    dice: null,
    usedDice: freshUsedDice(state.diceCount),
    pendingBonuses: [],
    consecutiveDoubles: 0,
    extraRollPending: false,
    mustBreakBlockade: false,
    tokens: nextTokens,
    lastMovedTokenId: nextLastMoved,
    lastMoveAnim,
    lastEventText: `${COLOR_PALETTE[nextTurn].label}'s turn.`,
    lastEventTone: eventTone,
    stats: nextStats,
    turnStartedAt: nowMs,
    stateSeq: state.stateSeq + 1,
  };
}

/**
 * Called automatically when `getLegalParchisiMoves(state).length === 0` during `WAIT_MOVE`.
 * Drops an unplayable +20/+10 bonus smoothly, or advances turn / grants doubles extra roll.
 */
export function passParchisiTurnOrBonus(
  state: ParchisiState,
  nowMs = Date.now(),
): ParchisiState {
  if (state.phase !== 'WAIT_MOVE') return state;

  // If a +20/+10 bonus had no legal moves, drop it and continue remaining bonuses or remaining dice
  if (state.pendingBonuses.length > 0) {
    const dropped = state.pendingBonuses[0];
    const remainingBonuses = state.pendingBonuses.slice(1);
    const hasRemainingDice = state.usedDice.some((used) => !used);

    if (remainingBonuses.length > 0 || hasRemainingDice) {
      return {
        ...state,
        phase: 'WAIT_MOVE',
        pendingBonuses: remainingBonuses,
        lastEventText: `No legal move for +${dropped} bonus — continuing turn.`,
        lastEventTone: 'neutral',
        turnStartedAt: nowMs,
        stateSeq: state.stateSeq + 1,
      };
    }

    // No bonuses or dice left after dropping bonus
    if (state.extraRollPending) {
      return {
        ...state,
        phase: 'WAIT_ROLL',
        dice: null,
        usedDice: freshUsedDice(state.diceCount),
        pendingBonuses: [],
        extraRollPending: false,
        mustBreakBlockade: false,
        lastEventText:
          state.diceCount === 1
            ? `No legal move for +${dropped} bonus — bonus roll for 6!`
            : `No legal move for +${dropped} bonus — roll doubles bonus!`,
        lastEventTone: 'bonus',
        turnStartedAt: nowMs,
        stateSeq: state.stateSeq + 1,
      };
    }

    const nextTurn = getNextActiveColor(state.activeColors, state.turn);
    return {
      ...state,
      phase: 'WAIT_ROLL',
      turn: nextTurn,
      dice: null,
      usedDice: freshUsedDice(state.diceCount),
      pendingBonuses: [],
      consecutiveDoubles: 0,
      extraRollPending: false,
      mustBreakBlockade: false,
      lastEventText: `No legal move for +${dropped} bonus — ${COLOR_PALETTE[nextTurn].label}'s turn.`,
      lastEventTone: 'neutral',
      turnStartedAt: nowMs,
      stateSeq: state.stateSeq + 1,
    };
  }

  // In 1-Die mode, if no pawn can play the rolled die value (or 3 consecutive sixes forfeited), advance to next player
  if (state.diceCount === 2 && state.extraRollPending) {
    return {
      ...state,
      phase: 'WAIT_ROLL',
      dice: null,
      usedDice: freshUsedDice(state.diceCount),
      pendingBonuses: [],
      extraRollPending: false,
      mustBreakBlockade: false,
      lastEventText: `No legal moves — extra roll for doubles!`,
      lastEventTone: 'bonus',
      turnStartedAt: nowMs,
      stateSeq: state.stateSeq + 1,
    };
  }

  const nextTurn = getNextActiveColor(state.activeColors, state.turn);
  return {
    ...state,
    phase: 'WAIT_ROLL',
    turn: nextTurn,
    dice: null,
    usedDice: freshUsedDice(state.diceCount),
    pendingBonuses: [],
    consecutiveDoubles: 0,
    extraRollPending: false,
    mustBreakBlockade: false,
    lastEventText: `${COLOR_PALETTE[nextTurn].label}'s turn.`,
    lastEventTone: 'neutral',
    turnStartedAt: nowMs,
    stateSeq: state.stateSeq + 1,
  };
}

/**
 * Checks how many opponent tokens are within 1..12 tiles behind `square` on the outer track.
 */
function countThreateningOpponentsBehind(
  state: ParchisiState,
  myColor: ParchisiColor,
  square: number,
): number {
  let threats = 0;
  for (const otherColor of state.activeColors) {
    if (otherColor === myColor) continue;
    for (const token of state.tokens[otherColor]) {
      const oppSq = progressToOuterSquare(otherColor, token.progress);
      if (oppSq === null) continue;
      const dist = (square - oppSq + PARCHISI_TOTAL_SQUARES) % PARCHISI_TOTAL_SQUARES;
      if (dist >= 1 && dist <= 12) {
        threats += 1;
      }
    }
  }
  return threats;
}

/**
 * Smart AI evaluator for Solo Mode (Yellow AI) & 4-Player Mode (Green & Blue AI bots).
 * Prioritizes: Home entry (+10) -> Captures (+20) -> Base exits on 5 -> Home column entry
 * -> Safe stars -> Escaping threats -> Forming strategic blockades -> Advancing leaders.
 */
export function chooseAiParchisiMove(state: ParchisiState): ParchisiMoveOption | null {
  const moves = getLegalParchisiMoves(state);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  const color = state.turn;
  let best = moves[0];
  let bestScore = -Infinity;

  for (const m of moves) {
    let score = 0;

    if (m.reachesHome) score += 270;
    if (m.captures.length > 0) {
      score += 235 * m.captures.length;
    }
    if (m.isExit) score += 145;
    if (m.fromProgress <= 63 && m.toProgress >= 64) score += 120;
    if (m.landsOnSafe && m.toProgress <= 63) score += 62;

    // Escape danger if currently exposed on a non-safe tile
    const fromSq = progressToOuterSquare(color, m.fromProgress);
    if (fromSq !== null && !isSafeSquare(fromSq)) {
      const currentThreats = countThreateningOpponentsBehind(state, color, fromSq);
      if (currentThreats > 0) {
        score += 48 * Math.min(2, currentThreats);
      }
    }

    // Evaluate landing safety & blockade formation
    const toSq = progressToOuterSquare(color, m.toProgress);
    if (toSq !== null) {
      const ownThere = state.tokens[color].filter(
        (t) => t.id !== m.tokenId && progressToOuterSquare(color, t.progress) === toSq,
      ).length;
      if (ownThere === 1) {
        // Forming a protective blockade!
        score += 36;
      } else if (!isSafeSquare(toSq)) {
        const landingThreats = countThreateningOpponentsBehind(state, color, toSq);
        score -= 42 * Math.min(2, landingThreats);
      }
    }

    // Slightly prefer splitting when both single moves are useful, or combining to escape/capture
    score += m.toProgress * 0.55;
    score += m.steps * 1.4;

    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }

  return best;
}

// --- Hand-Shake Dice Roll Detector (for optional MediaPipe HandLandmarker toggle) ---

export interface HandShakeDetectorState {
  lastX: number;
  lastY: number;
  initialized: boolean;
  energy: number;
  lastTriggerMs: number;
}

export function createHandShakeState(): HandShakeDetectorState {
  return {
    lastX: 0.5,
    lastY: 0.5,
    initialized: false,
    energy: 0,
    lastTriggerMs: 0,
  };
}

export function stepHandShakeDetector(
  detector: HandShakeDetectorState,
  handDetected: boolean,
  x: number,
  y: number,
  nowMs: number,
): { triggered: boolean; intensity: number } {
  if (!handDetected) {
    detector.initialized = false;
    detector.energy *= 0.8;
    return { triggered: false, intensity: Math.min(1, detector.energy) };
  }

  if (!detector.initialized) {
    detector.initialized = true;
    detector.lastX = x;
    detector.lastY = y;
    return { triggered: false, intensity: Math.min(1, detector.energy) };
  }

  const speed = Math.hypot(x - detector.lastX, y - detector.lastY);
  detector.lastX = x;
  detector.lastY = y;

  detector.energy = Math.min(1.4, detector.energy * 0.82 + speed * 4.5);

  const canTrigger = nowMs - detector.lastTriggerMs > 1600;
  if (canTrigger && detector.energy >= 0.92) {
    detector.lastTriggerMs = nowMs;
    detector.energy = 0;
    return { triggered: true, intensity: 1 };
  }

  return { triggered: false, intensity: Math.min(1, detector.energy / 0.92) };
}
