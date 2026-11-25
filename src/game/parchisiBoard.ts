import type { ParchisiPlayer } from '../types/duoplay';

export const PARCHISI_VIEWBOX = 760;
export const PARCHISI_TOTAL_SQUARES = 68;
export const PARCHISI_CORRIDOR_LEN = 7;
export const PARCHISI_THRONE_PROGRESS = 71; // -1 base, 0..63 loop, 64..70 corridor, 71 throne

export const HOST_EXIT_SQUARE = 56; // Bottom-Left Ruby Rose
export const GUEST_EXIT_SQUARE = 22; // Top-Right Royal Cyan

/** 12 Authentic Spanish Parchis Safe Zones (4 exits + 4 corridor entries + 4 mid-arm refuges) */
export const PARCHISI_SAFE_SQUARES: readonly number[] = [
  5, 12, 17, 22, 29, 34, 39, 46, 51, 56, 63, 68,
];

/** 4 Symmetrical "Karma Couple" heart squares (never overlapping safe zones) */
export const PARCHISI_KARMA_SQUARES: readonly number[] = [8, 25, 42, 59];

export interface BoardCellRect {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  orientation: 'horizontal' | 'vertical';
  isSafe: boolean;
  isKarma: boolean;
  exitFor?: 'host' | 'guest' | 'gold' | 'emerald';
  entryFor?: 'host' | 'guest' | 'gold' | 'emerald';
}

export interface Point2D {
  x: number;
  y: number;
}

const SAFE_SET = new Set<number>(PARCHISI_SAFE_SQUARES);
const KARMA_SET = new Set<number>(PARCHISI_KARMA_SQUARES);

export function isSafeSquare(square: number): boolean {
  return SAFE_SET.has(square);
}

export function isKarmaSquare(square: number): boolean {
  return KARMA_SET.has(square);
}

/**
 * Convert a player's loop progress (0..63) to board square number (1..68).
 * Returns null if pawn is in home base (-1), final corridor (64..70), or Throne (71).
 */
export function progressToOuterSquare(owner: ParchisiPlayer, progress: number): number | null {
  if (progress < 0 || progress > 63) return null;
  const start = owner === 'host' ? HOST_EXIT_SQUARE : GUEST_EXIT_SQUARE;
  return ((start - 1 + progress) % PARCHISI_TOTAL_SQUARES) + 1;
}

/**
 * Convert an outer board square (1..68) to a player's loop progress (0..63).
 */
export function outerSquareToProgress(owner: ParchisiPlayer, square: number): number {
  const start = owner === 'host' ? HOST_EXIT_SQUARE : GUEST_EXIT_SQUARE;
  const delta = (square - start + PARCHISI_TOTAL_SQUARES) % PARCHISI_TOTAL_SQUARES;
  return delta;
}

/**
 * Build exact pixel-aligned rectangles for all 68 outer squares (1..68)
 * inside the 760x760 royal board viewBox.
 * Outer board spans 20..740 (720x720):
 *  - Corner yards: 240x240
 *  - Arms: 3 lanes of 80px x 8 steps of 30px
 */
function buildOuterCells(): BoardCellRect[] {
  const cells: BoardCellRect[] = [];
  const pushCell = (
    id: number,
    x: number,
    y: number,
    w: number,
    h: number,
    orientation: 'horizontal' | 'vertical',
  ) => {
    let exitFor: BoardCellRect['exitFor'];
    let entryFor: BoardCellRect['entryFor'];
    if (id === 56) exitFor = 'host';
    else if (id === 22) exitFor = 'guest';
    else if (id === 5) exitFor = 'gold';
    else if (id === 39) exitFor = 'emerald';

    if (id === 51) entryFor = 'host';
    else if (id === 17) entryFor = 'guest';
    else if (id === 68) entryFor = 'gold';
    else if (id === 34) entryFor = 'emerald';

    cells.push({
      id,
      x,
      y,
      w,
      h,
      cx: x + w / 2,
      cy: y + h / 2,
      orientation,
      isSafe: SAFE_SET.has(id),
      isKarma: KARMA_SET.has(id),
      exitFor,
      entryFor,
    });
  };

  // 1..8: Bottom arm right column going UP toward center
  for (let k = 0; k < 8; k++) {
    pushCell(1 + k, 420, 710 - k * 30, 80, 30, 'horizontal');
  }
  // 9..16: Right arm bottom row going RIGHT
  for (let k = 0; k < 8; k++) {
    pushCell(9 + k, 500 + k * 30, 420, 30, 80, 'vertical');
  }
  // 17: Right arm middle cap (Guest Cyan corridor entry)
  pushCell(17, 710, 340, 30, 80, 'vertical');
  // 18..25: Right arm top row going LEFT (22 = Guest Cyan exit)
  for (let k = 0; k < 8; k++) {
    pushCell(18 + k, 710 - k * 30, 260, 30, 80, 'vertical');
  }
  // 26..33: Top arm right column going UP
  for (let k = 0; k < 8; k++) {
    pushCell(26 + k, 420, 230 - k * 30, 80, 30, 'horizontal');
  }
  // 34: Top arm middle cap (Emerald decorative entry)
  pushCell(34, 340, 20, 80, 30, 'horizontal');
  // 35..42: Top arm left column going DOWN
  for (let k = 0; k < 8; k++) {
    pushCell(35 + k, 260, 20 + k * 30, 80, 30, 'horizontal');
  }
  // 43..50: Left arm top row going LEFT
  for (let k = 0; k < 8; k++) {
    pushCell(43 + k, 230 - k * 30, 260, 30, 80, 'vertical');
  }
  // 51: Left arm middle cap (Host Ruby corridor entry)
  pushCell(51, 20, 340, 30, 80, 'vertical');
  // 52..59: Left arm bottom row going RIGHT (56 = Host Ruby exit)
  for (let k = 0; k < 8; k++) {
    pushCell(52 + k, 20 + k * 30, 420, 30, 80, 'vertical');
  }
  // 60..67: Bottom arm left column going DOWN
  for (let k = 0; k < 8; k++) {
    pushCell(60 + k, 260, 500 + k * 30, 80, 30, 'horizontal');
  }
  // 68: Bottom arm middle cap (Gold decorative entry)
  pushCell(68, 340, 710, 80, 30, 'horizontal');

  return cells;
}

export const OUTER_CELLS: readonly BoardCellRect[] = buildOuterCells();

const OUTER_CELL_MAP = new Map<number, BoardCellRect>(OUTER_CELLS.map((c) => [c.id, c]));

export function getOuterCell(square: number): BoardCellRect {
  const cell = OUTER_CELL_MAP.get(square);
  if (!cell) {
    throw new Error(`Invalid Parchisi square: ${square}`);
  }
  return cell;
}

export interface CorridorCellRect {
  index: number; // 0..6
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  orientation: 'horizontal' | 'vertical';
}

/** 7 colored final corridor squares for Host Ruby (Left arm middle row going RIGHT) */
export const HOST_CORRIDOR_CELLS: readonly CorridorCellRect[] = Array.from(
  { length: PARCHISI_CORRIDOR_LEN },
  (_, idx) => ({
    index: idx,
    x: 50 + idx * 30,
    y: 340,
    w: 30,
    h: 80,
    cx: 50 + idx * 30 + 15,
    cy: 380,
    orientation: 'vertical',
  }),
);

/** 7 colored final corridor squares for Guest Cyan (Right arm middle row going LEFT) */
export const GUEST_CORRIDOR_CELLS: readonly CorridorCellRect[] = Array.from(
  { length: PARCHISI_CORRIDOR_LEN },
  (_, idx) => ({
    index: idx,
    x: 680 - idx * 30,
    y: 340,
    w: 30,
    h: 80,
    cx: 680 - idx * 30 + 15,
    cy: 380,
    orientation: 'vertical',
  }),
);

/** Decorative 7-square corridors for Gold (Bottom) and Emerald (Top) */
export const GOLD_CORRIDOR_CELLS: readonly CorridorCellRect[] = Array.from(
  { length: PARCHISI_CORRIDOR_LEN },
  (_, idx) => ({
    index: idx,
    x: 340,
    y: 680 - idx * 30,
    w: 80,
    h: 30,
    cx: 380,
    cy: 680 - idx * 30 + 15,
    orientation: 'horizontal',
  }),
);

export const EMERALD_CORRIDOR_CELLS: readonly CorridorCellRect[] = Array.from(
  { length: PARCHISI_CORRIDOR_LEN },
  (_, idx) => ({
    index: idx,
    x: 340,
    y: 50 + idx * 30,
    w: 80,
    h: 30,
    cx: 380,
    cy: 50 + idx * 30 + 15,
    orientation: 'horizontal',
  }),
);

/** Home yard pawn resting coordinates (4 neatly spaced pedestals per corner yard) */
export const HOST_BASE_SLOTS: readonly Point2D[] = [
  { x: 96, y: 576 },
  { x: 184, y: 576 },
  { x: 96, y: 664 },
  { x: 184, y: 664 },
];

export const GUEST_BASE_SLOTS: readonly Point2D[] = [
  { x: 576, y: 96 },
  { x: 664, y: 96 },
  { x: 576, y: 184 },
  { x: 664, y: 184 },
];

/** Central Throne resting slots for finished pawns (progress === 71) */
export const HOST_THRONE_SLOTS: readonly Point2D[] = [
  { x: 300, y: 356 },
  { x: 300, y: 404 },
  { x: 332, y: 368 },
  { x: 332, y: 392 },
];

export const GUEST_THRONE_SLOTS: readonly Point2D[] = [
  { x: 460, y: 356 },
  { x: 460, y: 404 },
  { x: 428, y: 368 },
  { x: 428, y: 392 },
];

/**
 * Compute crisp SVG coordinates for a pawn at any progress (-1..71),
 * automatically spacing stacked pawns cleanly side-by-side along the 80px cell axis.
 */
export function getPawnBoardPoint(
  owner: ParchisiPlayer,
  pawnId: number,
  progress: number,
  stackIndex = 0,
  stackSize = 1,
): Point2D {
  if (progress < 0) {
    const slots = owner === 'host' ? HOST_BASE_SLOTS : GUEST_BASE_SLOTS;
    return slots[pawnId % 4];
  }
  if (progress >= PARCHISI_THRONE_PROGRESS) {
    const slots = owner === 'host' ? HOST_THRONE_SLOTS : GUEST_THRONE_SLOTS;
    return slots[pawnId % 4];
  }

  let cx = 380;
  let cy = 380;
  let orientation: 'horizontal' | 'vertical' = 'horizontal';

  if (progress <= 63) {
    const sq = progressToOuterSquare(owner, progress)!;
    const cell = getOuterCell(sq);
    cx = cell.cx;
    cy = cell.cy;
    orientation = cell.orientation;
  } else {
    const corrIdx = progress - 64;
    const cell = (owner === 'host' ? HOST_CORRIDOR_CELLS : GUEST_CORRIDOR_CELLS)[corrIdx];
    cx = cell.cx;
    cy = cell.cy;
    orientation = cell.orientation;
  }

  if (stackSize <= 1) {
    return { x: cx, y: cy };
  }

  // Spread 2+ pawns cleanly side-by-side along the 80px axis (no unreadable overlap!)
  const spread = stackSize === 2 ? 19 : 14;
  const offset = (stackIndex - (stackSize - 1) / 2) * spread * 2;
  return orientation === 'horizontal'
    ? { x: cx + offset * 0.5, y: cy }
    : { x: cx, y: cy + offset * 0.5 };
}
