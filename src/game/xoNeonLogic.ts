import type { XoMark, XoNeonState, XoSymbolTheme, XoVariant } from '../types/duoplay';

export const XO_TURN_DURATION_SEC = 12;
export const XO_HOVER_LOCK_SEC = 1.2;
export const XO_DEFAULT_TARGET_WINS = 3;
export const XO_INFINITE_MAX_PIECES = 3;

export const XO_WIN_LINES: readonly [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function createEmptyBoard(): XoMark[] {
  return Array<XoMark>(9).fill(null);
}

export function createInitialXoState(
  variant: XoVariant = 'infinite',
  symbolTheme: XoSymbolTheme = 'xo',
  targetWins = XO_DEFAULT_TARGET_WINS,
): XoNeonState {
  return {
    phase: 'ready',
    variant,
    symbolTheme,
    board: createEmptyBoard(),
    hostQueue: [],
    guestQueue: [],
    turn: 'host',
    turnDurationSec: XO_TURN_DURATION_SEC,
    turnTimeLeftSec: XO_TURN_DURATION_SEC,
    round: 1,
    targetWins,
    hostWins: 0,
    guestWins: 0,
    winLine: null,
    roundWinner: null,
    matchWinner: null,
    dareIndex: 0,
    lastPlacedCell: null,
    moveSeq: 0,
  };
}

export function startXoMatch(
  variant: XoVariant,
  symbolTheme: XoSymbolTheme,
  targetWins = XO_DEFAULT_TARGET_WINS,
): XoNeonState {
  return {
    ...createInitialXoState(variant, symbolTheme, targetWins),
    phase: 'playing',
  };
}

export function startNextXoRound(prev: XoNeonState): XoNeonState {
  const nextRound = prev.round + 1;
  const startingTurn: 'host' | 'guest' = nextRound % 2 === 1 ? 'host' : 'guest';
  return {
    ...prev,
    phase: 'playing',
    board: createEmptyBoard(),
    hostQueue: [],
    guestQueue: [],
    turn: startingTurn,
    turnTimeLeftSec: prev.turnDurationSec,
    round: nextRound,
    winLine: null,
    roundWinner: null,
    lastPlacedCell: null,
  };
}

export function checkXoWinner(board: readonly XoMark[]): {
  winner: 'host' | 'guest' | null;
  winLine: number[] | null;
} {
  for (const line of XO_WIN_LINES) {
    const [a, b, c] = line;
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) {
      return { winner: mark, winLine: [a, b, c] };
    }
  }
  return { winner: null, winLine: null };
}

/**
 * In Infinite Mode (max 3 pieces per player), returns the cell index of the active player's
 * oldest piece that will vanish as soon as they place their 4th piece.
 */
export function getFadingCellIndex(state: XoNeonState): number | null {
  if (state.phase !== 'playing' || state.variant !== 'infinite') return null;
  const queue = state.turn === 'host' ? state.hostQueue : state.guestQueue;
  if (queue.length >= XO_INFINITE_MAX_PIECES) {
    return queue[0];
  }
  return null;
}

export function applyXoMove(
  prev: XoNeonState,
  player: 'host' | 'guest',
  cellIndex: number,
  dareCount = 10,
  rng: () => number = Math.random,
): { state: XoNeonState; accepted: boolean; evictedCell: number | null } {
  if (prev.phase !== 'playing') return { state: prev, accepted: false, evictedCell: null };
  if (prev.turn !== player) return { state: prev, accepted: false, evictedCell: null };
  if (cellIndex < 0 || cellIndex > 8 || !Number.isInteger(cellIndex)) {
    return { state: prev, accepted: false, evictedCell: null };
  }
  if (prev.board[cellIndex] !== null) {
    return { state: prev, accepted: false, evictedCell: null };
  }

  const nextBoard = [...prev.board];
  const nextHostQueue = [...prev.hostQueue];
  const nextGuestQueue = [...prev.guestQueue];
  const activeQueue = player === 'host' ? nextHostQueue : nextGuestQueue;

  let evictedCell: number | null = null;
  if (prev.variant === 'infinite' && activeQueue.length >= XO_INFINITE_MAX_PIECES) {
    const oldest = activeQueue.shift();
    if (oldest !== undefined) {
      nextBoard[oldest] = null;
      evictedCell = oldest;
    }
  }

  nextBoard[cellIndex] = player;
  activeQueue.push(cellIndex);

  const { winner, winLine } = checkXoWinner(nextBoard);
  const moveSeq = prev.moveSeq + 1;

  if (winner) {
    const hostWins = winner === 'host' ? prev.hostWins + 1 : prev.hostWins;
    const guestWins = winner === 'guest' ? prev.guestWins + 1 : prev.guestWins;
    const reachedMatchWin =
      prev.targetWins > 0 && (hostWins >= prev.targetWins || guestWins >= prev.targetWins);
    const dareIndex = Math.floor(rng() * Math.max(1, dareCount));
    return {
      accepted: true,
      evictedCell,
      state: {
        ...prev,
        phase: reachedMatchWin ? 'match_over' : 'round_over',
        board: nextBoard,
        hostQueue: nextHostQueue,
        guestQueue: nextGuestQueue,
        hostWins,
        guestWins,
        winLine,
        roundWinner: winner,
        matchWinner: reachedMatchWin ? winner : null,
        dareIndex: reachedMatchWin ? dareIndex : prev.dareIndex,
        lastPlacedCell: cellIndex,
        moveSeq,
      },
    };
  }

  // Classic mode draw detection (Infinite mode never draws!)
  const isBoardFull = prev.variant === 'classic' && nextBoard.every((cell) => cell !== null);
  if (isBoardFull) {
    return {
      accepted: true,
      evictedCell,
      state: {
        ...prev,
        phase: 'round_over',
        board: nextBoard,
        hostQueue: nextHostQueue,
        guestQueue: nextGuestQueue,
        winLine: null,
        roundWinner: 'draw',
        lastPlacedCell: cellIndex,
        moveSeq,
      },
    };
  }

  const nextTurn: 'host' | 'guest' = player === 'host' ? 'guest' : 'host';
  return {
    accepted: true,
    evictedCell,
    state: {
      ...prev,
      board: nextBoard,
      hostQueue: nextHostQueue,
      guestQueue: nextGuestQueue,
      turn: nextTurn,
      turnTimeLeftSec: prev.turnDurationSec,
      lastPlacedCell: cellIndex,
      moveSeq,
    },
  };
}

/**
 * When the 12-second turn bar hits 0, automatically plays a random legal cell
 * so the game stays lively and never deadlocks.
 */
export function handleXoTurnTimeout(
  state: XoNeonState,
  dareCount = 10,
  rng: () => number = Math.random,
): { state: XoNeonState; playedCell: number | null } {
  if (state.phase !== 'playing') return { state, playedCell: null };
  const freeCells: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (state.board[i] === null) freeCells.push(i);
  }
  if (freeCells.length === 0) return { state, playedCell: null };
  const picked = freeCells[Math.floor(rng() * freeCells.length)];
  const res = applyXoMove(state, state.turn, picked, dareCount, rng);
  return { state: res.state, playedCell: res.accepted ? picked : null };
}

/**
 * Maps normalized 0..1 coordinates within the 3x3 board container to cell index 0..8.
 */
export function cursorToCellIndex(normX: number, normY: number): number | null {
  if (normX < 0 || normX > 1 || normY < 0 || normY > 1) return null;
  const col = Math.min(2, Math.max(0, Math.floor(normX * 3)));
  const row = Math.min(2, Math.max(0, Math.floor(normY * 3)));
  return row * 3 + col;
}

export function cellIndexToCenterNorm(cellIndex: number): { x: number; y: number } {
  const col = cellIndex % 3;
  const row = Math.floor(cellIndex / 3);
  return {
    x: (col + 0.5) / 3,
    y: (row + 0.5) / 3,
  };
}

function simulateBoardAfterMove(
  board: readonly XoMark[],
  queue: readonly number[],
  variant: XoVariant,
  player: 'host' | 'guest',
  cellIndex: number,
): XoMark[] {
  const next = [...board];
  if (variant === 'infinite' && queue.length >= XO_INFINITE_MAX_PIECES) {
    next[queue[0]] = null;
  }
  next[cellIndex] = player;
  return next;
}

/**
 * Smart tactical AI compatible with both Classic and Infinite FIFO rules:
 * 1. Take immediate winning cell (accounting for FIFO eviction!)
 * 2. Block opponent's immediate winning cell (accounting for opponent's FIFO eviction!)
 * 3. Prefer center (4), then corners (0,2,6,8), then edges (1,3,5,7) with light variety.
 */
export function chooseAiXoMove(
  state: XoNeonState,
  aiPlayer: 'host' | 'guest' = 'guest',
  rng: () => number = Math.random,
): number | null {
  if (state.phase !== 'playing') return null;
  const opponent: 'host' | 'guest' = aiPlayer === 'host' ? 'guest' : 'host';
  const aiQueue = aiPlayer === 'host' ? state.hostQueue : state.guestQueue;
  const oppQueue = opponent === 'host' ? state.hostQueue : state.guestQueue;

  const freeCells: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (state.board[i] === null) freeCells.push(i);
  }
  if (freeCells.length === 0) return null;

  // 1. Immediate win
  for (const idx of freeCells) {
    const sim = simulateBoardAfterMove(state.board, aiQueue, state.variant, aiPlayer, idx);
    if (checkXoWinner(sim).winner === aiPlayer) {
      return idx;
    }
  }

  // 2. Immediate block of opponent's winning move on next turn
  for (const idx of freeCells) {
    const oppSim = simulateBoardAfterMove(state.board, oppQueue, state.variant, opponent, idx);
    if (checkXoWinner(oppSim).winner === opponent) {
      return idx;
    }
  }

  // 3. Strategic preference: center, then corners, then edges
  if (freeCells.includes(4) && rng() < 0.85) {
    return 4;
  }
  const corners = [0, 2, 6, 8].filter((c) => freeCells.includes(c));
  if (corners.length > 0 && rng() < 0.8) {
    return corners[Math.floor(rng() * corners.length)];
  }
  return freeCells[Math.floor(rng() * freeCells.length)];
}
