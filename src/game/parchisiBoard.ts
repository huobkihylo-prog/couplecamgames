import type { ParchisiColor } from '../types/duoplay';

export const PARCHISI_VIEWBOX = 780;
export const PARCHISI_BOARD_ORIGIN = 30;
export const PARCHISI_BOARD_SIZE = 720; // spans 30..750 inside 780x780 beveled wood frame
export const PARCHISI_TOTAL_SQUARES = 68;
export const PARCHISI_CORRIDOR_LEN = 7;
export const PARCHISI_HOME_PROGRESS = 71; // -1 base, 0..63 outer track, 64..70 home column, 71 center goal

/** Exact Classic Official Parcheesi Start Tiles (counter-clockwise) */
export const COLOR_START_SQUARE: Record<ParchisiColor, number> = {
  red: 1,     // Bottom row of left arm, 4th tile from center
  green: 18,  // Right column of bottom arm, 4th tile from center
  yellow: 35, // Top row of right arm, 4th tile from center
  blue: 52,   // Left column of top arm, 4th tile from center
};

/** Exact Home-Column Entry Cap Squares (progress === 63 -> enters 7-tile colored column) */
export const COLOR_ENTRY_SQUARE: Record<ParchisiColor, number> = {
  red: 64,    // Left arm middle cap
  green: 13,  // Bottom arm middle cap
  yellow: 30, // Right arm middle cap
  blue: 47,   // Top arm middle cap
};

/** 8 Gray Star Safe Tiles */
export const PARCHISI_STAR_SQUARES: readonly number[] = [
  8, 13, 25, 30, 42, 47, 59, 64,
];

/** All 12 Safe Tiles (4 Colored Start tiles + 8 Gray Star tiles) */
export const PARCHISI_SAFE_SQUARES: readonly number[] = [
  1, 8, 13, 18, 25, 30, 35, 42, 47, 52, 59, 64,
];

export const COLOR_PALETTE: Record<
  ParchisiColor,
  {
    fill: string;
    dark: string;
    light: string;
    slot: string;
    ring: string;
    text: string;
    label: string;
  }
> = {
  red: {
    fill: '#E53935',
    dark: '#A31B1B',
    light: '#FF7961',
    slot: '#B71C1C',
    ring: '#FF5252',
    text: '#FFFFFF',
    label: 'Red',
  },
  green: {
    fill: '#2E9E5B',
    dark: '#1A6537',
    light: '#66D28F',
    slot: '#1F7A43',
    ring: '#4ADE80',
    text: '#FFFFFF',
    label: 'Green',
  },
  yellow: {
    fill: '#FBC02D',
    dark: '#B87E04',
    light: '#FFF176',
    slot: '#C9900A',
    ring: '#FDE047',
    text: '#2B1B05',
    label: 'Yellow',
  },
  blue: {
    fill: '#1E88E5',
    dark: '#0E5094',
    light: '#64B5F6',
    slot: '#1565C0',
    ring: '#38BDF8',
    text: '#FFFFFF',
    label: 'Blue',
  },
};

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
  isStar: boolean;
  startFor?: ParchisiColor;
  entryFor?: ParchisiColor;
}

export interface CorridorCellRect {
  index: number; // 0..6
  color: ParchisiColor;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  orientation: 'horizontal' | 'vertical';
}

export interface Point2D {
  x: number;
  y: number;
}

const SAFE_SET = new Set<number>(PARCHISI_SAFE_SQUARES);
const STAR_SET = new Set<number>(PARCHISI_STAR_SQUARES);

export function isSafeSquare(square: number): boolean {
  return SAFE_SET.has(square);
}

export function isStarSquare(square: number): boolean {
  return STAR_SET.has(square);
}

/**
 * Convert a token's loop progress (0..63) to board tile number (1..68) running counter-clockwise.
 * Returns null if token is in base (-1), colored home column (64..70), or center goal (71).
 */
export function progressToOuterSquare(color: ParchisiColor, progress: number): number | null {
  if (progress < 0 || progress > 63) return null;
  const start = COLOR_START_SQUARE[color];
  return ((start - 1 + progress) % PARCHISI_TOTAL_SQUARES) + 1;
}

/**
 * Convert an outer board square (1..68) to a color's loop progress (0..63).
 */
export function outerSquareToProgress(color: ParchisiColor, square: number): number {
  const start = COLOR_START_SQUARE[color];
  return (square - start + PARCHISI_TOTAL_SQUARES) % PARCHISI_TOTAL_SQUARES;
}

/**
 * Build exact pixel-aligned rectangles for all 68 numbered outer track tiles (1..68)
 * running counter-clockwise inside the 720x720 board (x: 30..750, y: 30..750).
 *  - 4 corner yards: 240x240 each
 *  - 4 arms: 3 lanes of 80px × 8 steps of 30px
 *  - Center goal box: 240x240 (x: 270..510, y: 270..510)
 */
function buildOuterCells(): BoardCellRect[] {
  const cells: BoardCellRect[] = [];
  const O = PARCHISI_BOARD_ORIGIN; // 30

  const pushCell = (
    id: number,
    x: number,
    y: number,
    w: number,
    h: number,
    orientation: 'horizontal' | 'vertical',
  ) => {
    let startFor: ParchisiColor | undefined;
    let entryFor: ParchisiColor | undefined;
    if (id === 1) startFor = 'red';
    else if (id === 18) startFor = 'green';
    else if (id === 35) startFor = 'yellow';
    else if (id === 52) startFor = 'blue';

    if (id === 64) entryFor = 'red';
    else if (id === 13) entryFor = 'green';
    else if (id === 30) entryFor = 'yellow';
    else if (id === 47) entryFor = 'blue';

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
      isStar: STAR_SET.has(id),
      startFor,
      entryFor,
    });
  };

  // Left arm bottom row inner half (tiles 1..4 going RIGHT toward center)
  // Full row has 8 tiles at x = O + k*30 (k=0..7). k=4 is 4th tile from center -> Tile 1 (Red Start)!
  for (let i = 0; i < 4; i++) {
    const k = 4 + i;
    pushCell(1 + i, O + k * 30, O + 400, 30, 80, 'vertical');
  }

  // Bottom arm left column (tiles 5..12 going DOWN away from center)
  for (let k = 0; k < 8; k++) {
    pushCell(5 + k, O + 240, O + 480 + k * 30, 80, 30, 'horizontal');
  }

  // Bottom arm middle cap (tile 13 — Gray Star & Green Home Column entry)
  pushCell(13, O + 320, O + 690, 80, 30, 'horizontal');

  // Bottom arm right column (tiles 14..21 going UP toward center; k=4 -> Tile 18 = Green Start)
  for (let k = 0; k < 8; k++) {
    pushCell(14 + k, O + 400, O + 690 - k * 30, 80, 30, 'horizontal');
  }

  // Right arm bottom row (tiles 22..29 going RIGHT away from center; k=3 -> Tile 25 = Gray Star)
  for (let k = 0; k < 8; k++) {
    pushCell(22 + k, O + 480 + k * 30, O + 400, 30, 80, 'vertical');
  }

  // Right arm middle cap (tile 30 — Gray Star & Yellow Home Column entry)
  pushCell(30, O + 690, O + 320, 30, 80, 'vertical');

  // Right arm top row (tiles 31..38 going LEFT toward center; k=4 -> Tile 35 = Yellow Start)
  for (let k = 0; k < 8; k++) {
    pushCell(31 + k, O + 690 - k * 30, O + 240, 30, 80, 'vertical');
  }

  // Top arm right column (tiles 39..46 going UP away from center; k=3 -> Tile 42 = Gray Star)
  for (let k = 0; k < 8; k++) {
    pushCell(39 + k, O + 400, O + 210 - k * 30, 80, 30, 'horizontal');
  }

  // Top arm middle cap (tile 47 — Gray Star & Blue Home Column entry)
  pushCell(47, O + 320, O, 80, 30, 'horizontal');

  // Top arm left column (tiles 48..55 going DOWN toward center; k=4 -> Tile 52 = Blue Start)
  for (let k = 0; k < 8; k++) {
    pushCell(48 + k, O + 240, O + k * 30, 80, 30, 'horizontal');
  }

  // Left arm top row (tiles 56..63 going LEFT away from center; k=3 -> Tile 59 = Gray Star)
  for (let k = 0; k < 8; k++) {
    pushCell(56 + k, O + 210 - k * 30, O + 240, 30, 80, 'vertical');
  }

  // Left arm middle cap (tile 64 — Gray Star & Red Home Column entry)
  pushCell(64, O, O + 320, 30, 80, 'vertical');

  // Left arm bottom row outer half (tiles 65..68 going RIGHT toward Tile 1)
  for (let k = 0; k < 4; k++) {
    pushCell(65 + k, O + k * 30, O + 400, 30, 80, 'vertical');
  }

  return cells;
}

export const OUTER_CELLS: readonly BoardCellRect[] = buildOuterCells();
const OUTER_CELL_MAP = new Map<number, BoardCellRect>(OUTER_CELLS.map((c) => [c.id, c]));

export function getOuterCell(square: number): BoardCellRect {
  const cell = OUTER_CELL_MAP.get(square);
  if (!cell) {
    throw new Error(`Invalid Parcheesi outer square: ${square}`);
  }
  return cell;
}

/** 7-tile colored home columns for all 4 colors leading directly into the center triangle goal */
export const CORRIDOR_CELLS: Record<ParchisiColor, readonly CorridorCellRect[]> = {
  // Red: Left arm middle row going RIGHT from x=60 to x=270
  red: Array.from({ length: PARCHISI_CORRIDOR_LEN }, (_, idx) => ({
    index: idx,
    color: 'red' as const,
    x: PARCHISI_BOARD_ORIGIN + 30 + idx * 30,
    y: PARCHISI_BOARD_ORIGIN + 320,
    w: 30,
    h: 80,
    cx: PARCHISI_BOARD_ORIGIN + 30 + idx * 30 + 15,
    cy: PARCHISI_BOARD_ORIGIN + 360,
    orientation: 'vertical' as const,
  })),
  // Green: Bottom arm middle column going UP from y=690 to y=480
  green: Array.from({ length: PARCHISI_CORRIDOR_LEN }, (_, idx) => ({
    index: idx,
    color: 'green' as const,
    x: PARCHISI_BOARD_ORIGIN + 320,
    y: PARCHISI_BOARD_ORIGIN + 660 - idx * 30,
    w: 80,
    h: 30,
    cx: PARCHISI_BOARD_ORIGIN + 360,
    cy: PARCHISI_BOARD_ORIGIN + 660 - idx * 30 + 15,
    orientation: 'horizontal' as const,
  })),
  // Yellow: Right arm middle row going LEFT from x=690 to x=480
  yellow: Array.from({ length: PARCHISI_CORRIDOR_LEN }, (_, idx) => ({
    index: idx,
    color: 'yellow' as const,
    x: PARCHISI_BOARD_ORIGIN + 660 - idx * 30,
    y: PARCHISI_BOARD_ORIGIN + 320,
    w: 30,
    h: 80,
    cx: PARCHISI_BOARD_ORIGIN + 660 - idx * 30 + 15,
    cy: PARCHISI_BOARD_ORIGIN + 360,
    orientation: 'vertical' as const,
  })),
  // Blue: Top arm middle column going DOWN from y=60 to y=270
  blue: Array.from({ length: PARCHISI_CORRIDOR_LEN }, (_, idx) => ({
    index: idx,
    color: 'blue' as const,
    x: PARCHISI_BOARD_ORIGIN + 320,
    y: PARCHISI_BOARD_ORIGIN + 30 + idx * 30,
    w: 80,
    h: 30,
    cx: PARCHISI_BOARD_ORIGIN + 360,
    cy: PARCHISI_BOARD_ORIGIN + 30 + idx * 30 + 15,
    orientation: 'horizontal' as const,
  })),
};

/** 4 corner home base rectangles & 4 recessed circular token slots per color */
export const CORNER_BASES: Record<
  ParchisiColor,
  { x: number; y: number; size: number; slots: readonly Point2D[] }
> = {
  // Top-Left: Blue
  blue: {
    x: PARCHISI_BOARD_ORIGIN,
    y: PARCHISI_BOARD_ORIGIN,
    size: 240,
    slots: [
      { x: PARCHISI_BOARD_ORIGIN + 76, y: PARCHISI_BOARD_ORIGIN + 76 },
      { x: PARCHISI_BOARD_ORIGIN + 164, y: PARCHISI_BOARD_ORIGIN + 76 },
      { x: PARCHISI_BOARD_ORIGIN + 76, y: PARCHISI_BOARD_ORIGIN + 164 },
      { x: PARCHISI_BOARD_ORIGIN + 164, y: PARCHISI_BOARD_ORIGIN + 164 },
    ],
  },
  // Top-Right: Yellow
  yellow: {
    x: PARCHISI_BOARD_ORIGIN + 480,
    y: PARCHISI_BOARD_ORIGIN,
    size: 240,
    slots: [
      { x: PARCHISI_BOARD_ORIGIN + 556, y: PARCHISI_BOARD_ORIGIN + 76 },
      { x: PARCHISI_BOARD_ORIGIN + 644, y: PARCHISI_BOARD_ORIGIN + 76 },
      { x: PARCHISI_BOARD_ORIGIN + 556, y: PARCHISI_BOARD_ORIGIN + 164 },
      { x: PARCHISI_BOARD_ORIGIN + 644, y: PARCHISI_BOARD_ORIGIN + 164 },
    ],
  },
  // Bottom-Left: Red
  red: {
    x: PARCHISI_BOARD_ORIGIN,
    y: PARCHISI_BOARD_ORIGIN + 480,
    size: 240,
    slots: [
      { x: PARCHISI_BOARD_ORIGIN + 76, y: PARCHISI_BOARD_ORIGIN + 556 },
      { x: PARCHISI_BOARD_ORIGIN + 164, y: PARCHISI_BOARD_ORIGIN + 556 },
      { x: PARCHISI_BOARD_ORIGIN + 76, y: PARCHISI_BOARD_ORIGIN + 644 },
      { x: PARCHISI_BOARD_ORIGIN + 164, y: PARCHISI_BOARD_ORIGIN + 644 },
    ],
  },
  // Bottom-Right: Green
  green: {
    x: PARCHISI_BOARD_ORIGIN + 480,
    y: PARCHISI_BOARD_ORIGIN + 480,
    size: 240,
    slots: [
      { x: PARCHISI_BOARD_ORIGIN + 556, y: PARCHISI_BOARD_ORIGIN + 556 },
      { x: PARCHISI_BOARD_ORIGIN + 644, y: PARCHISI_BOARD_ORIGIN + 556 },
      { x: PARCHISI_BOARD_ORIGIN + 556, y: PARCHISI_BOARD_ORIGIN + 644 },
      { x: PARCHISI_BOARD_ORIGIN + 644, y: PARCHISI_BOARD_ORIGIN + 644 },
    ],
  },
};

/** Center 4-Triangle Goal resting slots for finished tokens (progress === 71) */
export const CENTER_HOME_SLOTS: Record<ParchisiColor, readonly Point2D[]> = {
  // Left Red triangle (vertices: 270,270 -> 390,390 -> 270,510)
  red: [
    { x: 298, y: 356 },
    { x: 298, y: 424 },
    { x: 334, y: 374 },
    { x: 334, y: 406 },
  ],
  // Bottom Green triangle (vertices: 270,510 -> 390,390 -> 510,510)
  green: [
    { x: 356, y: 482 },
    { x: 424, y: 482 },
    { x: 374, y: 446 },
    { x: 406, y: 446 },
  ],
  // Right Yellow triangle (vertices: 510,270 -> 390,390 -> 510,510)
  yellow: [
    { x: 482, y: 356 },
    { x: 482, y: 424 },
    { x: 446, y: 374 },
    { x: 446, y: 406 },
  ],
  // Top Blue triangle (vertices: 270,270 -> 390,390 -> 510,270)
  blue: [
    { x: 356, y: 298 },
    { x: 424, y: 298 },
    { x: 374, y: 334 },
    { x: 406, y: 334 },
  ],
};

/**
 * Compute crisp SVG coordinates for a token at any progress (-1..71),
 * automatically placing 2 tokens cleanly side-by-side along the 80px cell axis.
 */
export function getTokenBoardPoint(
  color: ParchisiColor,
  tokenId: number,
  progress: number,
  stackIndex = 0,
  stackSize = 1,
): Point2D {
  if (progress < 0) {
    return CORNER_BASES[color].slots[tokenId % 4];
  }
  if (progress >= PARCHISI_HOME_PROGRESS) {
    return CENTER_HOME_SLOTS[color][tokenId % 4];
  }

  let cx = 390;
  let cy = 390;
  let orientation: 'horizontal' | 'vertical' = 'horizontal';

  if (progress <= 63) {
    const sq = progressToOuterSquare(color, progress)!;
    const cell = getOuterCell(sq);
    cx = cell.cx;
    cy = cell.cy;
    orientation = cell.orientation;
  } else {
    const corrIdx = progress - 64;
    const cell = CORRIDOR_CELLS[color][corrIdx];
    cx = cell.cx;
    cy = cell.cy;
    orientation = cell.orientation;
  }

  if (stackSize <= 1) {
    return { x: cx, y: cy };
  }

  // Spread 2 tokens cleanly side-by-side along the 80px cell axis
  const spacing = stackSize === 2 ? 20 : 14;
  const offset = (stackIndex - (stackSize - 1) / 2) * spacing * 2;
  return orientation === 'horizontal'
    ? { x: cx + offset * 0.5, y: cy }
    : { x: cx, y: cy + offset * 0.5 };
}
