import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ParchisiColor,
  ParchisiMoveAnimation,
  ParchisiMoveOption,
  ParchisiState,
  ParchisiToken,
} from '../types/duoplay';
import {
  COLOR_PALETTE,
  CORNER_BASES,
  CORRIDOR_CELLS,
  getOuterCell,
  getTokenBoardPoint,
  OUTER_CELLS,
  PARCHISI_BOARD_ORIGIN,
  PARCHISI_BOARD_SIZE,
  PARCHISI_HOME_PROGRESS,
  PARCHISI_VIEWBOX,
  progressToOuterSquare,
  type Point2D,
} from '../game/parchisiBoard';
import { ALL_PARCHISI_COLORS, getAllOuterBlockadeSquares } from '../game/parchisiLogic';
import {
  boardPointToGpuTranslatePct,
  PARCHISI_TOKEN_BOX_PCT,
  sampleKnockbackFrame,
  samplePawnPathFrame,
} from '../game/parchisiAnimation';
import { soundFx } from '../utils/soundFx';

export interface FloatingReactionItem {
  id: number;
  color: ParchisiColor;
  text: string;
  kind: 'emoji' | 'chat';
}

interface CaptureImpactBurst {
  id: string;
  x: number;
  y: number;
}

interface ParchisiBoardSvgProps {
  state: ParchisiState;
  legalMoves: ParchisiMoveOption[];
  canInteract: boolean;
  selectedTokenId: number | null;
  hoveredMove: ParchisiMoveOption | null;
  /** Synchronously non-null from Render #1 until the tile-by-tile hop + capture slide finishes */
  pendingMoveAnim: ParchisiMoveAnimation | null;
  onMoveAnimComplete: (seq: number) => void;
  onTriggerCelebration: () => void;
  floatingReactions: FloatingReactionItem[];
  onTokenClick: (tokenId: number) => void;
  onTokenHover: (tokenId: number | null) => void;
  onSelectMoveOption: (move: ParchisiMoveOption) => void;
  onHoverMoveOption: (move: ParchisiMoveOption | null) => void;
  onDismissPicker: () => void;
}

const STAR_POINTS =
  '0,-9.8 2.8,-3.3 9.6,-2.9 4.3,1.7 6.0,8.5 0,4.7 -6.0,8.5 -4.3,1.7 -9.6,-2.9 -2.8,-3.3';

/** Classic 5-point crown emblem centered on glossy 3D game tokens */
const CROWN_PATH = 'M -7,5 L -8.5,-4 L -3.5,0.5 L 0,-6 L 3.5,0.5 L 8.5,-4 L 7,5 Z';

function tokenKey(color: ParchisiColor, id: number): string {
  return `${color}-${id}`;
}

function getCellGroupKey(color: ParchisiColor, id: number, progress: number): string {
  if (progress < 0) return `base-${color}-${id}`;
  if (progress >= PARCHISI_HOME_PROGRESS) return `home-${color}-${id}`;
  if (progress <= 63) return `outer-${progressToOuterSquare(color, progress)}`;
  return `corr-${color}-${progress}`;
}

interface PositionedTokenLayout {
  token: ParchisiToken;
  effectiveProgress: number;
  x: number;
  y: number;
  stackSize: number;
  isMovable: boolean;
  isSelected: boolean;
}

/**
 * Compute positioned token coordinates while preserving a FIXED deterministic DOM order
 * (color order -> tokenId 0..3) so React never reorders sibling token DOM nodes.
 */
function computeTokenLayoutMap(
  tokensByColor: Record<ParchisiColor, ParchisiToken[]>,
  progressOverrides: Map<string, number>,
): Map<string, { x: number; y: number; stackSize: number; effectiveProgress: number }> {
  const flat: { token: ParchisiToken; effectiveProgress: number }[] = [];
  for (const color of ALL_PARCHISI_COLORS) {
    for (const token of tokensByColor[color]) {
      const k = tokenKey(color, token.id);
      const effectiveProgress = progressOverrides.has(k)
        ? progressOverrides.get(k)!
        : token.progress;
      flat.push({ token, effectiveProgress });
    }
  }

  const groups = new Map<string, { token: ParchisiToken; effectiveProgress: number }[]>();
  for (const item of flat) {
    const gk = getCellGroupKey(item.token.color, item.token.id, item.effectiveProgress);
    const list = groups.get(gk) ?? [];
    list.push(item);
    groups.set(gk, list);
  }

  const map = new Map<string, { x: number; y: number; stackSize: number; effectiveProgress: number }>();
  for (const bucket of groups.values()) {
    const stackSize = bucket.length;
    bucket.forEach((item, idx) => {
      const pt = getTokenBoardPoint(
        item.token.color,
        item.token.id,
        item.effectiveProgress,
        idx,
        stackSize,
      );
      map.set(tokenKey(item.token.color, item.token.id), {
        x: pt.x,
        y: pt.y,
        stackSize,
        effectiveProgress: item.effectiveProgress,
      });
    });
  }
  return map;
}

/**
 * Helper to generate an evenodd SVG path for a rounded outer rectangle with an inner rectangular hole,
 * so the wooden frame NEVER blocks the z-0 HTML base camera videos behind the Red/Yellow bases.
 */
function buildFrameWithCutoutPath(
  ox: number,
  oy: number,
  ow: number,
  oh: number,
  r: number,
  ix: number,
  iy: number,
  iw: number,
  ih: number,
): string {
  const outer = [
    `M ${ox + r} ${oy}`,
    `H ${ox + ow - r}`,
    `Q ${ox + ow} ${oy} ${ox + ow} ${oy + r}`,
    `V ${oy + oh - r}`,
    `Q ${ox + ow} ${oy + oh} ${ox + ow - r} ${oy + oh}`,
    `H ${ox + r}`,
    `Q ${ox} ${oy + oh} ${ox} ${oy + oh - r}`,
    `V ${oy + r}`,
    `Q ${ox} ${oy} ${ox + r} ${oy}`,
    'Z',
  ].join(' ');
  const hole = `M ${ix} ${iy} H ${ix + iw} V ${iy + ih} H ${ix} Z`;
  return `${outer} ${hole}`;
}

export function ParchisiBoardSvg({
  state,
  legalMoves,
  canInteract,
  selectedTokenId,
  hoveredMove,
  pendingMoveAnim,
  onMoveAnimComplete,
  onTriggerCelebration,
  floatingReactions,
  onTokenClick,
  onTokenHover,
  onSelectMoveOption,
  onHoverMoveOption,
  onDismissPicker,
}: ParchisiBoardSvgProps) {
  const O = PARCHISI_BOARD_ORIGIN; // 30
  const B = PARCHISI_BOARD_SIZE; // 720
  const C = O + B / 2; // 390

  // Direct DOM refs for 60fps GPU-composited rAF token animation (ZERO 60Hz setState, ZERO DOM reorder)
  const tokenElRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [impactBursts, setImpactBursts] = useState<CaptureImpactBurst[]>([]);

  const onMoveAnimCompleteRef = useRef(onMoveAnimComplete);
  onMoveAnimCompleteRef.current = onMoveAnimComplete;
  const onTriggerCelebrationRef = useRef(onTriggerCelebration);
  onTriggerCelebrationRef.current = onTriggerCelebration;

  // Classic beveled wooden frame paths
  const outerWoodFramePath = useMemo(
    () => buildFrameWithCutoutPath(2, 2, PARCHISI_VIEWBOX - 4, PARCHISI_VIEWBOX - 4, 28, O, O, B, B),
    [O, B],
  );
  const innerWoodChannelPath = useMemo(
    () => buildFrameWithCutoutPath(O - 6, O - 6, B + 12, B + 12, 12, O, O, B, B),
    [O, B],
  );

  // Group legal moves by tokenId for the active player
  const movesByTokenId = useMemo(() => {
    const map = new Map<number, ParchisiMoveOption[]>();
    if (!canInteract) return map;
    for (const m of legalMoves) {
      const list = map.get(m.tokenId) ?? [];
      list.push(m);
      map.set(m.tokenId, list);
    }
    return map;
  }, [legalMoves, canInteract]);

  // All outer blockade squares (2 same-color tokens)
  const outerBlockades = useMemo(
    () => getAllOuterBlockadeSquares(state.tokens),
    [state.tokens],
  );

  // Final post-move layout map (used as exact landing point for the rAF animation)
  const postMoveLayoutMap = useMemo(
    () => computeTokenLayoutMap(state.tokens, new Map()),
    [state.tokens],
  );

  // Synchronous pre-move layout map: whenever `pendingMoveAnim` is active, hold the moving pawn
  // at `fromProgress` and captured victims at `cap.fromProgress` on Render #1 so ZERO teleport ever happens!
  const displayedLayoutMap = useMemo(() => {
    if (!pendingMoveAnim) return postMoveLayoutMap;
    const overrides = new Map<string, number>();
    overrides.set(
      tokenKey(pendingMoveAnim.color, pendingMoveAnim.tokenId),
      pendingMoveAnim.fromProgress,
    );
    for (const cap of pendingMoveAnim.captured) {
      overrides.set(tokenKey(cap.color, cap.tokenId), cap.fromProgress);
    }
    return computeTokenLayoutMap(state.tokens, overrides);
  }, [state.tokens, pendingMoveAnim, postMoveLayoutMap]);

  // Fixed deterministic token array (NEVER reordered -> zero cancelled transitions, pure CSS z-index layering)
  const renderTokens = useMemo<PositionedTokenLayout[]>(() => {
    const list: PositionedTokenLayout[] = [];
    for (const color of ALL_PARCHISI_COLORS) {
      for (const token of state.tokens[color]) {
        const layout = displayedLayoutMap.get(tokenKey(color, token.id));
        if (!layout) continue;
        const isMovable =
          canInteract && color === state.turn && movesByTokenId.has(token.id);
        const isSelected =
          canInteract && color === state.turn && selectedTokenId === token.id;
        list.push({
          token,
          effectiveProgress: layout.effectiveProgress,
          x: layout.x,
          y: layout.y,
          stackSize: layout.stackSize,
          isMovable,
          isSelected,
        });
      }
    }
    return list;
  }, [state.tokens, state.turn, displayedLayoutMap, canInteract, movesByTokenId, selectedTokenId]);

  const layoutSnapshotsRef = useRef({
    pre: displayedLayoutMap,
    post: postMoveLayoutMap,
  });
  layoutSnapshotsRef.current = {
    pre: displayedLayoutMap,
    post: postMoveLayoutMap,
  };

  // True 60fps requestAnimationFrame tile-by-tile pawn hop + visible capture arc-slide back to base
  useEffect(() => {
    if (!pendingMoveAnim) return;
    const anim = pendingMoveAnim;

    if (anim.path.length === 0) {
      onMoveAnimCompleteRef.current(anim.seq);
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const moverKey = tokenKey(anim.color, anim.tokenId);
    const { pre, post } = layoutSnapshotsRef.current;

    const startLayout = pre.get(moverKey);
    const endLayout = post.get(moverKey);

    const startPt: Point2D = startLayout
      ? { x: startLayout.x, y: startLayout.y }
      : getTokenBoardPoint(anim.color, anim.tokenId, anim.fromProgress, 0, 1);

    const endPt: Point2D = endLayout
      ? { x: endLayout.x, y: endLayout.y }
      : getTokenBoardPoint(anim.color, anim.tokenId, anim.path[anim.path.length - 1], 0, 1);

    const startScale = startLayout && startLayout.stackSize >= 2 ? 0.8 : 1;
    const endScale = endLayout && endLayout.stackSize >= 2 ? 0.8 : 1;

    // Build exact tile-by-tile waypoints: [startPt, ...intermediateTileCenters, exactFinalLandingPt]
    const waypoints: Point2D[] = [startPt];
    for (let i = 0; i < anim.path.length; i++) {
      if (i === anim.path.length - 1) {
        waypoints.push(endPt);
      } else {
        waypoints.push(getTokenBoardPoint(anim.color, anim.tokenId, anim.path[i], 0, 1));
      }
    }

    const isBaseExit = anim.fromProgress < 0;
    const stepDurationMs = prefersReducedMotion
      ? 16
      : isBaseExit
        ? 250
        : anim.path.length > 10
          ? 84
          : 128;

    const knockbackDurationMs = prefersReducedMotion ? 16 : 520;

    // Prepare captured victim arc-slides triggered at the exact step the attacker reaches their tile
    interface ActiveCaptureAnim {
      key: string;
      color: ParchisiColor;
      tokenId: number;
      fromPt: Point2D;
      toBasePt: Point2D;
      triggerAtMs: number;
      startedAtMs: number | null;
      finished: boolean;
    }

    const captureAnims: ActiveCaptureAnim[] = anim.captured.map((cap) => {
      const capKey = tokenKey(cap.color, cap.tokenId);
      const capPre = pre.get(capKey);
      const fromPt: Point2D = capPre
        ? { x: capPre.x, y: capPre.y }
        : getTokenBoardPoint(cap.color, cap.tokenId, cap.fromProgress, 0, 1);
      const toBasePt = getTokenBoardPoint(cap.color, cap.tokenId, -1, 0, 1);

      const capOuterSq = progressToOuterSquare(cap.color, cap.fromProgress);
      let triggerStepIdx = anim.path.length - 1;
      if (capOuterSq !== null) {
        for (let i = 0; i < anim.path.length; i++) {
          if (progressToOuterSquare(anim.color, anim.path[i]) === capOuterSq) {
            triggerStepIdx = i;
            break;
          }
        }
      }

      return {
        key: capKey,
        color: cap.color,
        tokenId: cap.tokenId,
        fromPt,
        toBasePt,
        triggerAtMs: (triggerStepIdx + 1) * stepDurationMs,
        startedAtMs: null,
        finished: false,
      };
    });

    let cancelled = false;
    let rafId = 0;
    let startedAt = 0;
    let lastHopSoundStep = -1;
    let moverFinished = false;
    let bonusChimeTimer: number | null = null;
    let burstCleanupTimer: number | null = null;

    const totalMoverMs = (waypoints.length - 1) * stepDurationMs;

    const tick = (now: number) => {
      if (cancelled) return;
      if (startedAt === 0) {
        startedAt = now;
      }
      const elapsed = now - startedAt;

      // 1. Animate moving pawn tile-by-tile strictly on top (zIndex = 50)
      const moverEl = tokenElRefs.current.get(moverKey);
      const sample = samplePawnPathFrame(waypoints, elapsed, stepDurationMs, isBaseExit);

      if (sample.stepIndex > lastHopSoundStep) {
        lastHopSoundStep = sample.stepIndex;
        soundFx.parchisiPawnHop(sample.stepIndex);
      }

      if (moverEl) {
        const overallT = totalMoverMs > 0 ? Math.min(1, elapsed / totalMoverMs) : 1;
        const baseScale = startScale + (endScale - startScale) * overallT;
        const { txPct, tyPct } = boardPointToGpuTranslatePct(sample.x, sample.y);
        moverEl.style.transition = 'none';
        moverEl.style.zIndex = '50';
        moverEl.style.transform = sample.finished
          ? `translate3d(${txPct.toFixed(3)}%, ${tyPct.toFixed(3)}%, 0) scale(${endScale})`
          : `translate3d(${txPct.toFixed(3)}%, ${tyPct.toFixed(3)}%, 0) scale(${(
              baseScale * sample.scaleX
            ).toFixed(4)}, ${(baseScale * sample.scaleY).toFixed(4)})`;
      }

      if (sample.finished && !moverFinished) {
        moverFinished = true;
        if (anim.reachedHome) {
          soundFx.parchisiThroneArrival();
          onTriggerCelebrationRef.current();
          bonusChimeTimer = window.setTimeout(() => soundFx.parchisiBonusPowerChime(10), 210);
        } else if (anim.captured.length === 0 && anim.landedSafe) {
          soundFx.parchisiSafeStarChime();
        }
      }

      // 2. Trigger & animate captured victims sliding visibly back to their corner base (zIndex = 60)
      let allCapturesDone = true;
      for (const cap of captureAnims) {
        if (cap.startedAtMs === null && elapsed >= cap.triggerAtMs) {
          cap.startedAtMs = now;
          soundFx.parchisiCaptureDrama();
          const burstId = `burst-${anim.seq}-${cap.key}`;
          setImpactBursts((prev) => [
            ...prev.slice(-3),
            { id: burstId, x: cap.fromPt.x, y: cap.fromPt.y },
          ]);
          burstCleanupTimer = window.setTimeout(() => {
            if (!cancelled) {
              setImpactBursts((prev) => prev.filter((b) => b.id !== burstId));
            }
          }, 520);
          bonusChimeTimer = window.setTimeout(() => soundFx.parchisiBonusPowerChime(20), 220);
        }

        if (cap.startedAtMs !== null) {
          const capEl = tokenElRefs.current.get(cap.key);
          const kb = sampleKnockbackFrame(
            cap.fromPt,
            cap.toBasePt,
            now - cap.startedAtMs,
            knockbackDurationMs,
          );
          if (capEl) {
            const { txPct, tyPct } = boardPointToGpuTranslatePct(kb.x, kb.y);
            capEl.style.transition = 'none';
            capEl.style.zIndex = '60';
            capEl.style.transform = kb.finished
              ? `translate3d(${txPct.toFixed(3)}%, ${tyPct.toFixed(3)}%, 0) scale(1)`
              : `translate3d(${txPct.toFixed(3)}%, ${tyPct.toFixed(3)}%, 0) scale(${kb.scale.toFixed(4)}) rotate(${kb.rotationDeg.toFixed(1)}deg)`;
          }
          if (kb.finished) {
            cap.finished = true;
          } else {
            allCapturesDone = false;
          }
        } else {
          allCapturesDone = false;
        }
      }

      if (moverFinished && allCapturesDone) {
        onMoveAnimCompleteRef.current(anim.seq);
        return;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (bonusChimeTimer !== null) window.clearTimeout(bonusChimeTimer);
      if (burstCleanupTimer !== null) window.clearTimeout(burstCleanupTimer);
    };
  }, [pendingMoveAnim]);

  /**
   * Direct-tap highlighted destination tiles (Double Validation: tap token OR tap destination tile!):
   */
  const clickableDestinations = useMemo(() => {
    if (!canInteract) return [];

    let sourceMoves: ParchisiMoveOption[] = [];
    if (selectedTokenId !== null) {
      sourceMoves = movesByTokenId.get(selectedTokenId) ?? [];
    } else if (hoveredMove) {
      sourceMoves = [hoveredMove];
    } else if (movesByTokenId.size === 1) {
      const onlyMoves = Array.from(movesByTokenId.values())[0] ?? [];
      sourceMoves = onlyMoves;
    }

    const seen = new Set<number>();
    const results: {
      move: ParchisiMoveOption;
      x: number;
      y: number;
      isCapture: boolean;
      isHome: boolean;
      isHovered: boolean;
    }[] = [];

    for (const m of sourceMoves) {
      if (seen.has(m.toProgress)) continue;
      seen.add(m.toProgress);
      const pt = getTokenBoardPoint(m.color, m.tokenId, m.toProgress, 0, 1);
      results.push({
        move: m,
        x: pt.x,
        y: pt.y,
        isCapture: m.captures.length > 0,
        isHome: m.reachesHome,
        isHovered: hoveredMove?.id === m.id,
      });
    }
    return results;
  }, [canInteract, selectedTokenId, movesByTokenId, hoveredMove]);

  // Selected token floating picker anchor (percentage coords over the square SVG container)
  const activePicker = useMemo(() => {
    if (!canInteract || selectedTokenId === null) return null;
    const options = movesByTokenId.get(selectedTokenId);
    if (!options || options.length < 2) return null;
    const found = renderTokens.find(
      (item) => item.token.color === state.turn && item.token.id === selectedTokenId,
    );
    if (!found) return null;
    const leftPct = Math.max(20, Math.min(80, (found.x / PARCHISI_VIEWBOX) * 100));
    const preferBelow = found.y < 155;
    const topPct = preferBelow
      ? Math.min(86, ((found.y + 42) / PARCHISI_VIEWBOX) * 100)
      : Math.max(12, ((found.y - 40) / PARCHISI_VIEWBOX) * 100);
    return {
      options,
      leftPct,
      topPct,
      preferBelow,
    };
  }, [canInteract, selectedTokenId, movesByTokenId, renderTokens, state.turn]);

  // Anchor coordinates for floating emoji / quick chat bubbles per color corner
  const reactionAnchor = (color: ParchisiColor) => {
    switch (color) {
      case 'blue':
        return { left: '16%', top: '16%' };
      case 'yellow':
        return { left: '84%', top: '16%' };
      case 'red':
        return { left: '16%', top: '84%' };
      case 'green':
        return { left: '84%', top: '84%' };
    }
  };

  const activeMoverKey = pendingMoveAnim
    ? tokenKey(pendingMoveAnim.color, pendingMoveAnim.tokenId)
    : null;
  const activeCapturedKeys = useMemo(() => {
    const set = new Set<string>();
    if (pendingMoveAnim) {
      for (const c of pendingMoveAnim.captured) {
        set.add(tokenKey(c.color, c.tokenId));
      }
    }
    return set;
  }, [pendingMoveAnim]);

  return (
    <div
      data-testid="parchisi-board-wrapper"
      style={{ WebkitTapHighlightColor: 'transparent' }}
      className="relative aspect-square w-full h-full max-w-full max-h-full overflow-hidden rounded-[3.6%] select-none touch-manipulation flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismissPicker();
      }}
    >
      {/* LAYER z-10: Crisp Official 68-Tile Wooden Parcheesi SVG Board */}
      <svg
        viewBox={`0 0 ${PARCHISI_VIEWBOX} ${PARCHISI_VIEWBOX}`}
        style={{ WebkitTapHighlightColor: 'transparent' }}
        className="relative z-10 w-full h-full touch-manipulation select-none drop-shadow-[0_14px_30px_rgba(0,0,0,0.62)]"
        role="img"
        aria-label="Official Parcheesi 68-tile board"
        onClick={(e) => {
          if (e.target === e.currentTarget) onDismissPicker();
        }}
      >
        <defs>
          {/* Warm beveled wooden frame gradients */}
          <linearGradient id="wood-frame-outer" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D7A16D" />
            <stop offset="35%" stopColor="#C58B58" />
            <stop offset="72%" stopColor="#A06636" />
            <stop offset="100%" stopColor="#7C4A22" />
          </linearGradient>
          <linearGradient id="wood-frame-bevel" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6D3F1C" />
            <stop offset="50%" stopColor="#8C562B" />
            <stop offset="100%" stopColor="#D49B68" />
          </linearGradient>

          {/* Recessed base slot shadow gradient */}
          <radialGradient id="slot-recess" cx="50%" cy="60%" r="55%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.28)" />
            <stop offset="78%" stopColor="rgba(0,0,0,0.08)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.22)" />
          </radialGradient>
        </defs>

        {/* 1. Warm Beveled Wooden Outer Frame (evenodd cutout leaves interior open for z-0 base videos) */}
        <path
          d={outerWoodFramePath}
          fillRule="evenodd"
          fill="url(#wood-frame-outer)"
          stroke="#5A3315"
          strokeWidth="3"
        />
        {/* Top-left wood sheen highlight */}
        <rect
          x="8"
          y="8"
          width={PARCHISI_VIEWBOX - 16}
          height={PARCHISI_VIEWBOX - 16}
          rx="23"
          fill="none"
          stroke="rgba(255,235,205,0.42)"
          strokeWidth="2.5"
        />
        {/* Recessed inner wooden channel border */}
        <path
          d={innerWoodChannelPath}
          fillRule="evenodd"
          fill="#8C562B"
          stroke="url(#wood-frame-bevel)"
          strokeWidth="3"
        />

        {/* 2. Four Classic Solid Corner Home Bases (Blue TL, Yellow TR, Red BL, Green BR) */}
        {ALL_PARCHISI_COLORS.map((color) => {
          const base = CORNER_BASES[color];
          const pal = COLOR_PALETTE[color];
          const isTurn = state.turn === color && state.phase !== 'READY';
          const isActiveColor = state.activeColors.includes(color);

          return (
            <g key={`base-${color}`} data-testid={`parchisi-base-${color}`}>
              <rect
                x={base.x}
                y={base.y}
                width={base.size}
                height={base.size}
                fill={pal.fill}
                stroke="#6E4422"
                strokeWidth="1.5"
                opacity={isActiveColor ? 1 : 0.92}
              />
              <rect
                x={base.x + 12}
                y={base.y + 12}
                width={base.size - 24}
                height={base.size - 24}
                rx="18"
                fill="rgba(255,255,255,0.12)"
                stroke={isTurn ? '#FEF08A' : 'rgba(255,255,255,0.45)'}
                strokeWidth={isTurn ? '4' : '2'}
              />
              {base.slots.map((slot, idx) => (
                <g key={`slot-${color}-${idx}`}>
                  <circle
                    cx={slot.x}
                    cy={slot.y}
                    r="27"
                    fill={pal.slot}
                    stroke="rgba(255,255,255,0.52)"
                    strokeWidth="2"
                  />
                  <circle cx={slot.x} cy={slot.y} r="25" fill="url(#slot-recess)" />
                </g>
              ))}
            </g>
          );
        })}

        {/* 3. Exact 68-Tile Numbered Outer Track (100% Opaque, Ultra-Clear 1.5px Borders & Crisp Numbers 1..68) */}
        {OUTER_CELLS.map((cell) => {
          let fill = '#FFFFFF';
          let numColor = '#46413C';

          if (cell.startFor) {
            fill = COLOR_PALETTE[cell.startFor].fill;
            numColor = cell.startFor === 'yellow' ? '#3B2500' : '#FFFFFF';
          } else if (cell.isStar) {
            fill = '#CFCAC2';
            numColor = '#2E2A26';
          }

          const isHorizontal = cell.orientation === 'horizontal';
          const numX = cell.isStar
            ? isHorizontal
              ? cell.x + 14
              : cell.cx
            : cell.cx;
          const numY = cell.isStar
            ? isHorizontal
              ? cell.cy + 3.8
              : cell.y + 14
            : cell.cy + 3.8;

          return (
            <g key={`outer-${cell.id}`}>
              <rect
                x={cell.x}
                y={cell.y}
                width={cell.w}
                height={cell.h}
                fill={fill}
                stroke="#8D867E"
                strokeWidth="1.5"
              />
              {cell.isStar && (
                <polygon
                  points={STAR_POINTS}
                  transform={`translate(${cell.cx}, ${cell.cy}) scale(1.08)`}
                  fill="#4B4640"
                  opacity="0.86"
                />
              )}
              {cell.startFor && (
                <circle
                  cx={cell.cx}
                  cy={cell.cy}
                  r="10.5"
                  fill="none"
                  stroke={cell.startFor === 'yellow' ? 'rgba(59,37,0,0.38)' : 'rgba(255,255,255,0.58)'}
                  strokeWidth="1.8"
                />
              )}
              <text
                x={numX}
                y={numY}
                textAnchor="middle"
                fontSize="10.5"
                fontWeight="800"
                fill={numColor}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {cell.id}
              </text>
            </g>
          );
        })}

        {/* 4. Four Colored 7-Tile Home Columns (100% Opaque) */}
        {ALL_PARCHISI_COLORS.map((color) =>
          CORRIDOR_CELLS[color].map((cell) => (
            <g key={`corr-${color}-${cell.index}`}>
              <rect
                x={cell.x}
                y={cell.y}
                width={cell.w}
                height={cell.h}
                fill={COLOR_PALETTE[color].fill}
                stroke={color === 'yellow' ? '#A87906' : 'rgba(255,255,255,0.58)'}
                strokeWidth="1.5"
              />
              {(cell.index === 0 || cell.index === 6) && (
                <circle
                  cx={cell.cx}
                  cy={cell.cy}
                  r="3.5"
                  fill={color === 'yellow' ? 'rgba(59,37,0,0.34)' : 'rgba(255,255,255,0.48)'}
                />
              )}
            </g>
          )),
        )}

        {/* 5. Center 4-Triangle Goal (100% Opaque — Red Left, Green Bottom, Yellow Right, Blue Top) */}
        <g>
          <polygon
            points={`${O + 240},${O + 240} ${C},${C} ${O + 240},${O + 480}`}
            fill={COLOR_PALETTE.red.fill}
            stroke="#5D3A1A"
            strokeWidth="1.8"
          />
          <polygon
            points={`${O + 240},${O + 480} ${C},${C} ${O + 480},${O + 480}`}
            fill={COLOR_PALETTE.green.fill}
            stroke="#5D3A1A"
            strokeWidth="1.8"
          />
          <polygon
            points={`${O + 480},${O + 240} ${C},${C} ${O + 480},${O + 480}`}
            fill={COLOR_PALETTE.yellow.fill}
            stroke="#5D3A1A"
            strokeWidth="1.8"
          />
          <polygon
            points={`${O + 240},${O + 240} ${C},${C} ${O + 480},${O + 240}`}
            fill={COLOR_PALETTE.blue.fill}
            stroke="#5D3A1A"
            strokeWidth="1.8"
          />
          <circle
            cx={C}
            cy={C}
            r="22"
            fill="#FFF7DF"
            stroke="#8C562B"
            strokeWidth="3"
          />
          <path
            d={CROWN_PATH}
            transform={`translate(${C}, ${C + 1}) scale(1.15)`}
            fill="#D97706"
            stroke="#78350F"
            strokeWidth="0.9"
          />
        </g>

        {/* Crisp outer border of the 720x720 inner playing field */}
        <rect
          x={O}
          y={O}
          width={B}
          height={B}
          fill="none"
          stroke="#6E4422"
          strokeWidth="2"
          className="pointer-events-none"
        />

        {/* 6. Subtle Blockade Shield Badges on Outer Track Squares with 2 Same-Color Tokens */}
        {Array.from(outerBlockades.entries()).map(([square, owner]) => {
          const cell = getOuterCell(square);
          const bx = cell.orientation === 'horizontal' ? cell.x + cell.w - 9 : cell.cx;
          const by = cell.orientation === 'horizontal' ? cell.cy : cell.y + 9;
          return (
            <g
              key={`blockade-${square}`}
              transform={`translate(${bx}, ${by})`}
              className="pointer-events-none"
            >
              <circle r="7.8" fill="#1F120A" stroke="#FACC15" strokeWidth="1.6" />
              <path
                d="M 0,-4.2 L 3.4,-2.4 L 3.4,0.8 C 3.4,2.8 1.8,4.1 0,4.8 C -1.8,4.1 -3.4,2.8 -3.4,0.8 L -3.4,-2.4 Z"
                fill={COLOR_PALETTE[owner].light}
              />
            </g>
          );
        })}

        {/* 7. Illuminated & Directly Tappable Destination Landing Tiles (Double Validation!) */}
        {clickableDestinations.map((dest) => {
          const ringColor = dest.isCapture
            ? '#EF4444'
            : dest.isHome
              ? '#22C55E'
              : '#FACC15';
          const fillTint = dest.isCapture
            ? 'rgba(239,68,68,0.34)'
            : dest.isHome
              ? 'rgba(34,197,94,0.34)'
              : 'rgba(250,204,21,0.36)';

          return (
            <g
              key={`dest-${dest.move.id}`}
              data-testid={`parchisi-dest-${dest.move.id}`}
              role="button"
              tabIndex={0}
              aria-label={`Move to target (${dest.move.label})`}
              style={{ cursor: 'pointer', touchAction: 'manipulation' }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectMoveOption(dest.move);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectMoveOption(dest.move);
                }
              }}
              onMouseEnter={() => onHoverMoveOption(dest.move)}
              onMouseLeave={() => onHoverMoveOption(null)}
            >
              <circle cx={dest.x} cy={dest.y} r="40" fill="transparent" />
              <g transform={`translate(${dest.x}, ${dest.y})`}>
                <circle
                  r={dest.isHovered ? '24' : '21'}
                  fill={fillTint}
                  stroke={ringColor}
                  strokeWidth="3.8"
                  strokeDasharray="6 4"
                  className="parchisi-dest-pulse"
                />
                <circle r="6" fill={ringColor} stroke="#FFFFFF" strokeWidth="1.5" />
              </g>
            </g>
          );
        })}

        {/* 7b. Capture Impact Ring Bursts (GPU transform + opacity only) */}
        {impactBursts.map((burst) => (
          <g
            key={burst.id}
            transform={`translate(${burst.x}, ${burst.y})`}
            className="pointer-events-none"
          >
            <circle
              r="18"
              fill="rgba(239,68,68,0.22)"
              stroke="#FACC15"
              strokeWidth="4"
              className="parchisi-capture-ring"
            />
          </g>
        ))}
      </svg>

      {/* LAYER z-20: Fixed-DOM-Order HTML GPU Token Overlay
          - Guarantees real CSS z-index (moving pawn=50, captured knock-back=60) ABOVE all tiles, stars & other pawns
          - Zero DOM reordering, zero SVG viewBox/px Safari glitches, 100% GPU translate3d at 60fps */}
      <div
        data-testid="parchisi-tokens-layer"
        className="pointer-events-none absolute inset-0 z-20"
      >
        {renderTokens.map(({ token, x, y, stackSize, isMovable, isSelected }) => {
          const key = tokenKey(token.color, token.id);
          const pal = COLOR_PALETTE[token.color];
          const isMoving = activeMoverKey === key;
          const isCaptured = activeCapturedKeys.has(key);
          const baseScale = stackSize >= 2 ? 0.8 : 1;
          const totalScale = baseScale * (isSelected ? 1.18 : 1);
          const { txPct, tyPct } = boardPointToGpuTranslatePct(x, y);

          // Strict z-index hierarchy without ever changing DOM order!
          const zIndex = isCaptured
            ? 60
            : isMoving
              ? 50
              : isSelected
                ? 35
                : isMovable
                  ? 25
                  : 10;

          const gradId = `html-token-grad-${token.color}-${token.id}`;

          return (
            <div
              key={`token-${key}`}
              ref={(el) => {
                if (el) tokenElRefs.current.set(key, el);
                else tokenElRefs.current.delete(key);
              }}
              data-animating={isMoving || isCaptured ? 'true' : 'false'}
              style={{
                width: `${PARCHISI_TOKEN_BOX_PCT}%`,
                height: `${PARCHISI_TOKEN_BOX_PCT}%`,
                left: 0,
                top: 0,
                zIndex,
                transform: `translate3d(${txPct.toFixed(3)}%, ${tyPct.toFixed(3)}%, 0) scale(${totalScale})`,
                transition:
                  isMoving || isCaptured
                    ? 'none'
                    : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                willChange: 'transform',
              }}
              className="pointer-events-none absolute flex items-center justify-center"
            >
              {/* Permanently mounted 1:1 scale 3D crown token SVG (zero remount flicker when isMovable toggles) */}
              <svg
                viewBox="-39 -39 78 78"
                className="w-full h-full overflow-visible pointer-events-none"
                style={{ filter: 'drop-shadow(0 2.5px 3px rgba(26,14,7,0.52))' }}
                aria-hidden="true"
              >
                <defs>
                  <radialGradient id={gradId} cx="35%" cy="28%" r="70%">
                    <stop offset="0%" stopColor={pal.light} />
                    <stop offset="52%" stopColor={pal.fill} />
                    <stop offset="100%" stopColor={pal.dark} />
                  </radialGradient>
                </defs>
                {isMovable && (
                  <>
                    <circle
                      r="21"
                      fill="rgba(250,204,21,0.18)"
                      stroke="#FACC15"
                      strokeWidth="3.6"
                      className="parchisi-halo-pulse"
                    />
                    <circle r="18.5" fill="none" stroke="#FEF08A" strokeWidth="2.6" />
                  </>
                )}
                <g className={isMovable && !isSelected ? 'parchisi-playable-float' : ''}>
                  <circle
                    r="16"
                    fill={pal.dark}
                    stroke={
                      isCaptured
                        ? '#EF4444'
                        : isSelected || isMoving
                          ? '#FEF08A'
                          : '#FFFFFF'
                    }
                    strokeWidth={isCaptured || isSelected || isMoving ? '3' : '2.2'}
                  />
                  <circle r="13.6" fill={`url(#${gradId})`} />
                  <ellipse
                    cx="-3"
                    cy="-6"
                    rx="6.6"
                    ry="3.5"
                    fill="rgba(255,255,255,0.46)"
                    transform="rotate(-18 -3 -6)"
                  />
                  <path
                    d={CROWN_PATH}
                    transform="translate(0, 1) scale(0.78)"
                    fill={token.color === 'yellow' ? '#5A3703' : '#FFF9E6'}
                    opacity="0.96"
                  />
                </g>
              </svg>

              {/* Interactive hitbox overlay (only movable tokens capture pointer events) */}
              {isMovable ? (
                <button
                  type="button"
                  data-testid={`parchisi-token-${token.color}-${token.id}`}
                  data-movable="true"
                  aria-label={`Move ${pal.label} token ${token.id + 1}`}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                  className={`pointer-events-auto absolute inset-0 m-auto rounded-full bg-transparent border-0 p-0 focus-visible:outline-none ${
                    stackSize >= 2 ? 'w-[70%] h-[70%]' : 'w-full h-full min-w-[42px] min-h-[42px]'
                  } cursor-pointer touch-manipulation`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTokenClick(token.id);
                  }}
                  onMouseEnter={() => onTokenHover(token.id)}
                  onMouseLeave={() => onTokenHover(null)}
                />
              ) : (
                <span
                  data-testid={`parchisi-token-${token.color}-${token.id}`}
                  data-movable="false"
                  aria-label={`${pal.label} token ${token.id + 1}`}
                  className="pointer-events-none absolute inset-0"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 9. Large, Comfortably Spaced Floating Move Picker Pills (+3, +5, +8) above clicked token */}
      {activePicker && (
        <div
          data-testid="parchisi-move-picker"
          style={{
            left: `${activePicker.leftPct}%`,
            top: `${activePicker.topPct}%`,
            transform: activePicker.preferBelow
              ? 'translate(-50%, 0%)'
              : 'translate(-50%, -100%)',
            WebkitTapHighlightColor: 'transparent',
          }}
          className="absolute z-30 flex items-center gap-2.5 px-3 py-2 rounded-full bg-[#241222]/96 border-2 border-[#FACC15] shadow-[0_12px_28px_rgba(0,0,0,0.72)] touch-manipulation select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {activePicker.options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              data-testid={`parchisi-move-opt-${opt.id}`}
              onClick={() => onSelectMoveOption(opt)}
              onMouseEnter={() => onHoverMoveOption(opt)}
              onMouseLeave={() => onHoverMoveOption(null)}
              className={`min-h-[44px] min-w-[54px] px-4 py-1.5 rounded-full text-sm sm:text-base font-black tabular-nums whitespace-nowrap touch-manipulation select-none transition-transform active:scale-95 shadow ${
                opt.captures.length > 0
                  ? 'bg-[#E53935] text-white hover:bg-[#EF5350]'
                  : opt.reachesHome
                    ? 'bg-[#2E9E5B] text-white hover:bg-[#38B86B]'
                    : 'bg-gradient-to-b from-[#FEF08A] to-[#EAB308] text-[#2B1503] hover:brightness-105'
              }`}
            >
              {opt.label}
              {opt.captures.length > 0 ? ' ⚔' : opt.reachesHome ? ' 👑' : ''}
            </button>
          ))}
        </div>
      )}

      {/* 10. Floating Emoji & Quick Chat Reaction Bubbles */}
      {floatingReactions.map((item) => {
        const pos = reactionAnchor(item.color);
        return (
          <div
            key={item.id}
            style={{ left: pos.left, top: pos.top }}
            className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 animate-bounce"
          >
            <div
              className={
                item.kind === 'emoji'
                  ? 'px-3 py-1.5 rounded-full bg-[#241222]/90 border border-[#FACC15]/70 text-2xl sm:text-3xl shadow-xl'
                  : 'px-3 py-1.5 rounded-2xl bg-[#241222]/95 border border-[#E0A458]/80 text-xs sm:text-sm font-bold text-[#FEF3C7] shadow-xl whitespace-nowrap'
              }
            >
              {item.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}
