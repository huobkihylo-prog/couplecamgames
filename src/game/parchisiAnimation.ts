import { PARCHISI_VIEWBOX, type Point2D } from './parchisiBoard';

/**
 * Width/height percentage of each HTML GPU token wrapper relative to the square board.
 * Because `width: 10%` of the board, moving 100% of the element's width equals 10% of the board.
 */
export const PARCHISI_TOKEN_BOX_PCT = 10;

/**
 * Exact 3D CSS Cube target Euler angles (rotateX, rotateY in degrees) so each face (1..6)
 * faces squarely forward toward the viewer with upright pips.
 * Opposite faces sum to 7: (1↔6, 2↔5, 3↔4).
 */
export const DIE_FACE_ANGLES: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
  5: { x: 0, y: 90 },
  6: { x: 0, y: 180 },
};

export interface DieRotation3D {
  x: number;
  y: number;
}

/**
 * Normalize an angle in degrees into [0, 360).
 */
export function normalizeDeg(deg: number): number {
  const m = deg % 360;
  const normalized = m < 0 ? m + 360 : m;
  return normalized === 0 ? 0 : normalized;
}

/**
 * Return the exact base Euler angle for die face 1..6.
 */
export function getDieFaceAngle(value: number): DieRotation3D {
  const clamped = Math.max(1, Math.min(6, Math.round(value)));
  return DIE_FACE_ANGLES[clamped] ?? DIE_FACE_ANGLES[1];
}

/**
 * Compute the next cumulative 3D cube rotation from `current` to `targetValue` (1..6)
 * so the die always executes a smooth, full multi-axis tumble (>= 720deg on primary axis,
 * >= 360deg on secondary axis) and stops dead-on the exact target face without ever snapping.
 */
export function computeNextDieRotation(
  current: DieRotation3D,
  targetValue: number,
  variant: 'a' | 'b',
  rollSeq: number,
): DieRotation3D {
  const base = getDieFaceAngle(targetValue);
  const altDir = rollSeq % 2 === 0 ? 1 : -1;

  // Primary spin axis: Die A tumbles forward on X, Die B tumbles opposite on X
  const xDir = variant === 'a' ? 1 : -1;
  const yDir = variant === 'a' ? altDir : -altDir;

  const minSpinX = 720; // 2 full rotations
  const minSpinY = 360; // 1 full rotation

  const nextX =
    xDir > 0
      ? base.x + Math.ceil((current.x + minSpinX - base.x) / 360) * 360
      : base.x + Math.floor((current.x - minSpinX - base.x) / 360) * 360;

  const nextY =
    yDir > 0
      ? base.y + Math.ceil((current.y + minSpinY - base.y) / 360) * 360
      : base.y + Math.floor((current.y - minSpinY - base.y) / 360) * 360;

  return { x: nextX, y: nextY };
}

/**
 * Compute an initial pre-roll rotation offset (2 turns behind target) for a freshly mounted
 * die that immediately needs to animate into `targetValue`.
 */
export function computePreRollDieRotation(
  targetValue: number,
  variant: 'a' | 'b',
): DieRotation3D {
  const base = getDieFaceAngle(targetValue);
  return variant === 'a'
    ? { x: base.x - 720, y: base.y - 360 }
    : { x: base.x + 720, y: base.y + 360 };
}

/**
 * Convert an SVG viewBox point (0..780) into exact GPU `translate3d(txPct%, tyPct%, 0)`
 * percentages for an HTML token container sized at `PARCHISI_TOKEN_BOX_PCT`% of the square board.
 */
export function boardPointToGpuTranslatePct(
  x: number,
  y: number,
): { txPct: number; tyPct: number } {
  const scaleFactor = 100 / PARCHISI_TOKEN_BOX_PCT; // 10
  return {
    txPct: (x / PARCHISI_VIEWBOX) * 100 * scaleFactor - 50,
    tyPct: (y / PARCHISI_VIEWBOX) * 100 * scaleFactor - 50,
  };
}

/** Smooth cubic-bezier(0.22, 1, 0.36, 1)-like deceleration curve */
export function easeOutQuinticSmooth(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - clamped, 3.2);
}

/** Smooth ease-in-out curve for crisp tile-to-tile hopping */
export function easeHopSlide(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  // Blend ease-out with smoothstep so each hop accelerates off the tile and settles cleanly
  const smooth = clamped * clamped * (3 - 2 * clamped);
  const out = 1 - Math.pow(1 - clamped, 2.4);
  return smooth * 0.45 + out * 0.55;
}

export interface PawnPathSample {
  /** Current board SVG coordinates (0..780) including hop lift */
  x: number;
  y: number;
  /** Pure vertical lift (<= 0) for subtle shadow scaling */
  hopLiftSvg: number;
  /** Gentle squash/stretch scale during each tile bounce */
  scaleX: number;
  scaleY: number;
  /** Zero-based index of the segment currently being traversed (0..waypoints.length - 2) */
  stepIndex: number;
  /** True once elapsedMs >= totalDurationMs */
  finished: boolean;
}

/**
 * Sample a pawn's exact 60fps position along tile-by-tile `waypoints` (`[start, step0, ..., end]`).
 * Guarantees continuous visibility with a crisp bounce arc on every single tile.
 */
export function samplePawnPathFrame(
  waypoints: readonly Point2D[],
  elapsedMs: number,
  stepDurationMs: number,
  isBaseExit: boolean,
): PawnPathSample {
  if (waypoints.length === 0) {
    return { x: 390, y: 390, hopLiftSvg: 0, scaleX: 1, scaleY: 1, stepIndex: 0, finished: true };
  }
  if (waypoints.length === 1) {
    return {
      x: waypoints[0].x,
      y: waypoints[0].y,
      hopLiftSvg: 0,
      scaleX: 1,
      scaleY: 1,
      stepIndex: 0,
      finished: true,
    };
  }

  const totalSteps = waypoints.length - 1;
  const safeStepMs = Math.max(16, stepDurationMs);
  const totalDurationMs = totalSteps * safeStepMs;

  if (elapsedMs >= totalDurationMs) {
    const last = waypoints[waypoints.length - 1];
    return {
      x: last.x,
      y: last.y,
      hopLiftSvg: 0,
      scaleX: 1,
      scaleY: 1,
      stepIndex: totalSteps - 1,
      finished: true,
    };
  }

  const clampedElapsed = Math.max(0, elapsedMs);
  const rawStep = clampedElapsed / safeStepMs;
  const stepIndex = Math.min(totalSteps - 1, Math.floor(rawStep));
  const localT = rawStep - stepIndex; // 0..1 within current tile step

  const from = waypoints[stepIndex];
  const to = waypoints[stepIndex + 1];
  const slideT = easeHopSlide(localT);

  const arc = Math.sin(Math.PI * localT);
  const hopHeight = isBaseExit && stepIndex === 0 ? 28 : 15;
  const hopLiftSvg = -arc * hopHeight;

  // Subtle lively squash/stretch on takeoff & apex
  const scaleX = 1 + arc * 0.1;
  const scaleY = 1 + arc * 0.14;

  return {
    x: from.x + (to.x - from.x) * slideT,
    y: from.y + (to.y - from.y) * slideT + hopLiftSvg,
    hopLiftSvg,
    scaleX,
    scaleY,
    stepIndex,
    finished: false,
  };
}

export interface KnockbackSample {
  x: number;
  y: number;
  scale: number;
  rotationDeg: number;
  finished: boolean;
}

/**
 * Sample a captured pawn's visible arc-slide back to its corner base slot.
 */
export function sampleKnockbackFrame(
  fromPt: Point2D,
  toBasePt: Point2D,
  elapsedMs: number,
  durationMs = 520,
): KnockbackSample {
  const safeDur = Math.max(16, durationMs);
  if (elapsedMs >= safeDur) {
    return {
      x: toBasePt.x,
      y: toBasePt.y,
      scale: 1,
      rotationDeg: 0,
      finished: true,
    };
  }

  const t = Math.max(0, elapsedMs / safeDur);
  const eased = easeOutQuinticSmooth(t);
  const arc = Math.sin(Math.PI * t);

  return {
    x: fromPt.x + (toBasePt.x - fromPt.x) * eased,
    y: fromPt.y + (toBasePt.y - fromPt.y) * eased - arc * 44,
    scale: 1 + arc * 0.28,
    rotationDeg: -360 * eased,
    finished: false,
  };
}
