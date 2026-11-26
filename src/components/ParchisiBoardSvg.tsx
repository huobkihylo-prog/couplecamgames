import { useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  ParchisiColor,
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
} from '../game/parchisiBoard';
import { ALL_PARCHISI_COLORS, getAllOuterBlockadeSquares } from '../game/parchisiLogic';

export interface FloatingReactionItem {
  id: number;
  color: ParchisiColor;
  text: string;
  kind: 'emoji' | 'chat';
}

interface ParchisiBoardSvgProps {
  state: ParchisiState;
  legalMoves: ParchisiMoveOption[];
  canInteract: boolean;
  selectedTokenId: number | null;
  hoveredMove: ParchisiMoveOption | null;
  animOverride: { color: ParchisiColor; tokenId: number; progress: number; hopBoost: boolean } | null;
  floatingReactions: FloatingReactionItem[];
  /** Base Camera Mode props (zero <foreignObject>, pure HTML z-0 layer behind SVG z-10) */
  baseCamsEnabled: boolean;
  redBaseStream: MediaStream | null;
  yellowBaseStream: MediaStream | null;
  mirrorRedBase: boolean;
  mirrorYellowBase: boolean;
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

/** Pure percentage CSS bounds aligned identically to the 780x780 SVG viewBox corner bases */
const BASE_VIDEO_BOUNDS = {
  red: {
    left: `${(CORNER_BASES.red.x / PARCHISI_VIEWBOX) * 100}%`,
    top: `${(CORNER_BASES.red.y / PARCHISI_VIEWBOX) * 100}%`,
    width: `${(CORNER_BASES.red.size / PARCHISI_VIEWBOX) * 100}%`,
    height: `${(CORNER_BASES.red.size / PARCHISI_VIEWBOX) * 100}%`,
  },
  yellow: {
    left: `${(CORNER_BASES.yellow.x / PARCHISI_VIEWBOX) * 100}%`,
    top: `${(CORNER_BASES.yellow.y / PARCHISI_VIEWBOX) * 100}%`,
    width: `${(CORNER_BASES.yellow.size / PARCHISI_VIEWBOX) * 100}%`,
    height: `${(CORNER_BASES.yellow.size / PARCHISI_VIEWBOX) * 100}%`,
  },
} as const;

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
  animOverride,
  floatingReactions,
  baseCamsEnabled,
  redBaseStream,
  yellowBaseStream,
  mirrorRedBase,
  mirrorYellowBase,
  onTokenClick,
  onTokenHover,
  onSelectMoveOption,
  onHoverMoveOption,
  onDismissPicker,
}: ParchisiBoardSvgProps) {
  const O = PARCHISI_BOARD_ORIGIN; // 30
  const B = PARCHISI_BOARD_SIZE; // 720
  const C = O + B / 2; // 390

  const redVideoRef = useRef<HTMLVideoElement | null>(null);
  const yellowVideoRef = useRef<HTMLVideoElement | null>(null);

  const showRedBaseVideo = baseCamsEnabled && Boolean(redBaseStream);
  const showYellowBaseVideo = baseCamsEnabled && Boolean(yellowBaseStream);

  // Universal cross-browser video playback helper (Safari iOS, Android Chrome/Samsung/Firefox/Brave, Desktop)
  const ensureBaseVideosPlaying = useCallback(() => {
    const pairs: [HTMLVideoElement | null, boolean][] = [
      [redVideoRef.current, showRedBaseVideo],
      [yellowVideoRef.current, showYellowBaseVideo],
    ];
    for (const [el, active] of pairs) {
      if (el && active && el.srcObject) {
        el.muted = true;
        el.playsInline = true;
        el.play().catch(() => {});
      }
    }
  }, [showRedBaseVideo, showYellowBaseVideo]);

  // Attach/detach Red base <video> srcObject cleanly (NEVER stops MediaStreamTracks!)
  useEffect(() => {
    const el = redVideoRef.current;
    if (!el) return;
    el.setAttribute('webkit-playsinline', 'true');
    el.setAttribute('playsinline', 'true');
    el.muted = true;
    if (showRedBaseVideo && redBaseStream) {
      if (el.srcObject !== redBaseStream) {
        el.srcObject = redBaseStream;
      }
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [showRedBaseVideo, redBaseStream]);

  // Attach/detach Yellow base <video> srcObject cleanly (NEVER stops MediaStreamTracks!)
  useEffect(() => {
    const el = yellowVideoRef.current;
    if (!el) return;
    el.setAttribute('webkit-playsinline', 'true');
    el.setAttribute('playsinline', 'true');
    el.muted = true;
    if (showYellowBaseVideo && yellowBaseStream) {
      if (el.srcObject !== yellowBaseStream) {
        el.srcObject = yellowBaseStream;
      }
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [showYellowBaseVideo, yellowBaseStream]);

  // Automatically resume base videos when returning from background tab / WhatsApp on mobile
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        ensureBaseVideosPlaying();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [ensureBaseVideosPlaying]);

  // Precompute frame paths with crisp 720x720 interior cutout so base videos shine through cleanly
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

  // Build effective token positions (applying active step-hop animation override)
  const renderTokens = useMemo(() => {
    const effectiveList: (ParchisiToken & { hopBoost: boolean })[] = [];
    for (const color of ALL_PARCHISI_COLORS) {
      for (const token of state.tokens[color]) {
        const isAnim =
          animOverride && animOverride.color === color && animOverride.tokenId === token.id;
        effectiveList.push({
          ...token,
          progress: isAnim ? animOverride.progress : token.progress,
          hopBoost: Boolean(isAnim && animOverride.hopBoost),
        });
      }
    }

    // Group tokens sharing the exact same cell for clean side-by-side placement
    const groups = new Map<string, (ParchisiToken & { hopBoost: boolean })[]>();
    for (const t of effectiveList) {
      let key: string;
      if (t.progress < 0) {
        key = `base-${t.color}-${t.id}`;
      } else if (t.progress >= PARCHISI_HOME_PROGRESS) {
        key = `home-${t.color}-${t.id}`;
      } else if (t.progress <= 63) {
        key = `outer-${progressToOuterSquare(t.color, t.progress)}`;
      } else {
        key = `corr-${t.color}-${t.progress}`;
      }
      const bucket = groups.get(key) ?? [];
      bucket.push(t);
      groups.set(key, bucket);
    }

    const positioned: {
      token: ParchisiToken & { hopBoost: boolean };
      x: number;
      y: number;
      stackSize: number;
      isMovable: boolean;
      isSelected: boolean;
    }[] = [];

    for (const bucket of groups.values()) {
      const stackSize = bucket.length;
      bucket.forEach((token, idx) => {
        const pt = getTokenBoardPoint(token.color, token.id, token.progress, idx, stackSize);
        const isMovable =
          canInteract && token.color === state.turn && movesByTokenId.has(token.id);
        const isSelected =
          canInteract && token.color === state.turn && selectedTokenId === token.id;
        positioned.push({
          token,
          x: pt.x,
          y: pt.y,
          stackSize,
          isMovable,
          isSelected,
        });
      });
    }

    // Draw non-movable tokens first, then movable tokens, then selected/animating tokens on top
    positioned.sort((a, b) => {
      const score = (item: (typeof positioned)[number]) =>
        (item.token.hopBoost ? 8 : 0) +
        (item.isSelected ? 6 : 0) +
        (item.isMovable ? 4 : 0);
      return score(a) - score(b);
    });

    return positioned;
  }, [state.tokens, state.turn, animOverride, canInteract, movesByTokenId, selectedTokenId]);

  /**
   * Direct-tap highlighted destination tiles (Double Validation: tap token OR tap destination tile!):
   * - If a token is selected: highlight ALL of its legal landing tiles as directly clickable targets.
   * - Else if a move is hovered: highlight that hovered move's exact landing tile.
   * - Else if exactly 1 movable token exists on the board: pre-highlight its landing tile(s) immediately
   *   so the player can tap EITHER the token OR the illuminated destination tile in one tap!
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

    // Deduplicate identical landing progress (keeping preferred option first)
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

  return (
    <div
      data-testid="parchisi-board-wrapper"
      style={{ WebkitTapHighlightColor: 'transparent' }}
      className="relative aspect-square w-full h-full max-w-full max-h-full overflow-hidden rounded-[3.6%] select-none touch-manipulation flex items-center justify-center"
      onPointerDown={ensureBaseVideosPlaying}
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismissPicker();
      }}
    >
      {/* LAYER z-0: Pure HTML Base Camera <video> Elements (ZERO <foreignObject>, 100% Safari iOS/Android/Desktop safe) */}
      <div
        data-testid="parchisi-base-video-red"
        data-cam-active={showRedBaseVideo ? 'true' : 'false'}
        style={BASE_VIDEO_BOUNDS.red}
        className={`pointer-events-none absolute z-0 overflow-hidden transition-opacity duration-200 ${
          showRedBaseVideo ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <video
          ref={redVideoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={ensureBaseVideosPlaying}
          className={`w-full h-full object-cover ${mirrorRedBase ? 'scale-x-[-1]' : ''}`}
        />
      </div>

      <div
        data-testid="parchisi-base-video-yellow"
        data-cam-active={showYellowBaseVideo ? 'true' : 'false'}
        style={BASE_VIDEO_BOUNDS.yellow}
        className={`pointer-events-none absolute z-0 overflow-hidden transition-opacity duration-200 ${
          showYellowBaseVideo ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <video
          ref={yellowVideoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={ensureBaseVideosPlaying}
          className={`w-full h-full object-cover ${mirrorYellowBase ? 'scale-x-[-1]' : ''}`}
        />
      </div>

      {/* LAYER z-10: Crisp Official 68-Tile Wooden Parcheesi SVG Board + 100% Opaque 3D Crown Tokens */}
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

          {/* Glossy 3D token radial gradients for all 4 classic colors */}
          {ALL_PARCHISI_COLORS.map((c) => (
            <radialGradient key={c} id={`token-grad-${c}`} cx="35%" cy="28%" r="70%">
              <stop offset="0%" stopColor={COLOR_PALETTE[c].light} />
              <stop offset="52%" stopColor={COLOR_PALETTE[c].fill} />
              <stop offset="100%" stopColor={COLOR_PALETTE[c].dark} />
            </radialGradient>
          ))}

          {/* Recessed base slot shadow gradient */}
          <radialGradient id="slot-recess" cx="50%" cy="60%" r="55%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.28)" />
            <stop offset="78%" stopColor="rgba(0,0,0,0.08)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.22)" />
          </radialGradient>

          <filter id="token-shadow" x="-35%" y="-35%" width="170%" height="170%">
            <feDropShadow dx="0" dy="2.8" stdDeviation="2.4" floodColor="#1A0E07" floodOpacity="0.58" />
          </filter>
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

        {/* 2. Four Corner Home Bases (Blue TL, Yellow TR, Red BL, Green BR) */}
        {ALL_PARCHISI_COLORS.map((color) => {
          const base = CORNER_BASES[color];
          const pal = COLOR_PALETTE[color];
          const isTurn = state.turn === color && state.phase !== 'READY';
          const isActiveColor = state.activeColors.includes(color);
          const isLiveCamBase =
            (color === 'red' && showRedBaseVideo) || (color === 'yellow' && showYellowBaseVideo);

          // Translucent colored tint over live video vs 100% opaque official solid classic color
          let baseFill = pal.fill;
          if (isLiveCamBase) {
            if (color === 'red') {
              baseFill = isTurn ? 'rgba(229, 57, 53, 0.28)' : 'rgba(229, 57, 53, 0.42)';
            } else {
              baseFill = isTurn ? 'rgba(251, 192, 45, 0.26)' : 'rgba(251, 192, 45, 0.40)';
            }
          }

          return (
            <g
              key={`base-${color}`}
              data-testid={`parchisi-base-${color}`}
              data-transparent={isLiveCamBase ? 'true' : 'false'}
            >
              <rect
                x={base.x}
                y={base.y}
                width={base.size}
                height={base.size}
                fill={baseFill}
                stroke="#6E4422"
                strokeWidth="1.5"
                opacity={isLiveCamBase ? 1 : isActiveColor ? 1 : 0.92}
              />
              {/* Soft inset frame inside corner base (glows gold on active player's turn) */}
              <rect
                x={base.x + 12}
                y={base.y + 12}
                width={base.size - 24}
                height={base.size - 24}
                rx="18"
                fill={isLiveCamBase ? 'none' : 'rgba(255,255,255,0.12)'}
                stroke={isTurn ? '#FEF08A' : isLiveCamBase ? 'rgba(255,255,255,0.68)' : 'rgba(255,255,255,0.45)'}
                strokeWidth={isTurn ? '4' : '2'}
              />
              {/* 4 Circular Token Slots: subtle thin rings over live camera, classic recessed circles when solid */}
              {base.slots.map((slot, idx) => (
                <g key={`slot-${color}-${idx}`}>
                  {isLiveCamBase ? (
                    <circle
                      cx={slot.x}
                      cy={slot.y}
                      r="25"
                      fill="rgba(0,0,0,0.14)"
                      stroke="rgba(255,255,255,0.72)"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                    />
                  ) : (
                    <>
                      <circle
                        cx={slot.x}
                        cy={slot.y}
                        r="27"
                        fill={pal.slot}
                        stroke="rgba(255,255,255,0.52)"
                        strokeWidth="2"
                      />
                      <circle cx={slot.x} cy={slot.y} r="25" fill="url(#slot-recess)" />
                    </>
                  )}
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
              {/* High-contrast dark-gray 5-point Star on the 8 Star Safe Tiles */}
              {cell.isStar && (
                <polygon
                  points={STAR_POINTS}
                  transform={`translate(${cell.cx}, ${cell.cy}) scale(1.08)`}
                  fill="#4B4640"
                  opacity="0.86"
                />
              )}
              {/* Crisp centered safe circle ring on Colored Start Tiles */}
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
              {/* Ultra-clear tile number (1..68) */}
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
          {/* Center brass medallion crest */}
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
              {/* Generous >= 44px transparent touch hitbox over highlighted destination tile */}
              <circle cx={dest.x} cy={dest.y} r="40" fill="transparent" />
              <circle
                cx={dest.x}
                cy={dest.y}
                r={dest.isHovered ? '24' : '21'}
                fill={fillTint}
                stroke={ringColor}
                strokeWidth="3.8"
                strokeDasharray="6 4"
              >
                <animate
                  attributeName="r"
                  values="19;25;19"
                  dur="0.85s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle cx={dest.x} cy={dest.y} r="6" fill={ringColor} stroke="#FFFFFF" strokeWidth="1.5" />
            </g>
          );
        })}

        {/* 8. Glossy 100% Opaque 3D Game Tokens with Enlarged Touch Hitboxes (>= 44x44px effective) */}
        {renderTokens.map(({ token, x, y, stackSize, isMovable, isSelected }) => {
          const pal = COLOR_PALETTE[token.color];
          const baseScale = stackSize >= 2 ? 0.8 : 1;
          const hopScale = token.hopBoost ? 1.2 : isSelected ? 1.16 : isMovable ? 1.07 : 1;
          const totalScale = baseScale * hopScale;
          const liftY = token.hopBoost ? -5 : isSelected ? -3.5 : isMovable ? -2 : 0;
          // Enlarged touch radius: r=46 when solo (>= 44x44px effective on 374px mobile board),
          // r=24 when stacked side-by-side so adjacent tokens never overlap each other's hit area.
          const hitRadius = stackSize >= 2 ? 24 : 46;

          return (
            <g
              key={`token-${token.color}-${token.id}`}
              data-testid={`parchisi-token-${token.color}-${token.id}`}
              data-movable={isMovable ? 'true' : 'false'}
              transform={`translate(${x}, ${y + liftY}) scale(${totalScale})`}
              style={{
                transition: 'transform 105ms cubic-bezier(0.22, 1, 0.36, 1)',
                cursor: isMovable ? 'pointer' : 'default',
                touchAction: 'manipulation',
              }}
              role={isMovable ? 'button' : undefined}
              tabIndex={isMovable ? 0 : undefined}
              aria-label={
                isMovable
                  ? `Move ${pal.label} token ${token.id + 1}`
                  : `${pal.label} token ${token.id + 1}`
              }
              onClick={(e) => {
                e.stopPropagation();
                if (isMovable) onTokenClick(token.id);
              }}
              onKeyDown={(e) => {
                if (isMovable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onTokenClick(token.id);
                }
              }}
              onMouseEnter={() => {
                if (isMovable) onTokenHover(token.id);
              }}
              onMouseLeave={() => {
                if (isMovable) onTokenHover(null);
              }}
            >
              {/* High-visibility pulsing golden halo ring whenever token has a valid move */}
              {isMovable && (
                <>
                  <circle
                    r="23"
                    fill="rgba(250,204,21,0.18)"
                    stroke="#FACC15"
                    strokeWidth="3.8"
                    opacity="0.98"
                  >
                    <animate
                      attributeName="r"
                      values="18;26;18"
                      dur="1.05s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.98;0.28;0.98"
                      dur="1.05s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle
                    r="18.5"
                    fill="none"
                    stroke="#FEF08A"
                    strokeWidth="2.8"
                  />
                </>
              )}

              {/* Generous transparent thumb-friendly touch hitbox (>= 44x44px effective) */}
              {isMovable && <circle r={hitRadius} fill="transparent" />}

              {/* Glossy 100% Opaque 3D Disc */}
              <g filter="url(#token-shadow)">
                <circle
                  r="16"
                  fill={pal.dark}
                  stroke={isSelected ? '#FEF08A' : '#FFFFFF'}
                  strokeWidth={isSelected ? '3' : '2.2'}
                />
                <circle r="13.6" fill={`url(#token-grad-${token.color})`} />
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
            </g>
          );
        })}
      </svg>

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
