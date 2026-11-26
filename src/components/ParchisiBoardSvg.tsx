import { useMemo } from 'react';
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
  onTokenClick: (tokenId: number) => void;
  onTokenHover: (tokenId: number | null) => void;
  onSelectMoveOption: (move: ParchisiMoveOption) => void;
  onHoverMoveOption: (move: ParchisiMoveOption | null) => void;
  onDismissPicker: () => void;
}

const STAR_POINTS =
  '0,-9.5 2.7,-3.2 9.4,-2.8 4.2,1.6 5.8,8.3 0,4.6 -5.8,8.3 -4.2,1.6 -9.4,-2.8 -2.7,-3.2';

/** Classic 5-point crown emblem centered on glossy 3D game tokens */
const CROWN_PATH = 'M -7,5 L -8.5,-4 L -3.5,0.5 L 0,-6 L 3.5,0.5 L 8.5,-4 L 7,5 Z';

export function ParchisiBoardSvg({
  state,
  legalMoves,
  canInteract,
  selectedTokenId,
  hoveredMove,
  animOverride,
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

  // Compute target tile preview geometry for hovered move
  const targetPreview = useMemo(() => {
    if (!hoveredMove) return null;
    const pt = getTokenBoardPoint(
      hoveredMove.color,
      hoveredMove.tokenId,
      hoveredMove.toProgress,
      0,
      1,
    );
    return {
      x: pt.x,
      y: pt.y,
      isCapture: hoveredMove.captures.length > 0,
      isHome: hoveredMove.reachesHome,
      label: hoveredMove.label,
    };
  }, [hoveredMove]);

  // Selected token floating picker anchor (percentage coords over the square SVG container)
  const activePicker = useMemo(() => {
    if (!canInteract || selectedTokenId === null) return null;
    const options = movesByTokenId.get(selectedTokenId);
    if (!options || options.length < 2) return null;
    const found = renderTokens.find(
      (item) => item.token.color === state.turn && item.token.id === selectedTokenId,
    );
    if (!found) return null;
    const leftPct = Math.max(15, Math.min(85, (found.x / PARCHISI_VIEWBOX) * 100));
    const preferBelow = found.y < 140;
    const topPct = preferBelow
      ? Math.min(88, ((found.y + 38) / PARCHISI_VIEWBOX) * 100)
      : Math.max(10, ((found.y - 36) / PARCHISI_VIEWBOX) * 100);
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
      className="relative aspect-square w-full h-full max-w-full max-h-full select-none flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismissPicker();
      }}
    >
      <svg
        viewBox={`0 0 ${PARCHISI_VIEWBOX} ${PARCHISI_VIEWBOX}`}
        className="w-full h-full drop-shadow-[0_14px_30px_rgba(0,0,0,0.62)]"
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

          <filter id="token-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="2.2" floodColor="#1A0E07" floodOpacity="0.52" />
          </filter>
        </defs>

        {/* 1. Warm Beveled Wooden Outer Frame */}
        <rect
          x="2"
          y="2"
          width={PARCHISI_VIEWBOX - 4}
          height={PARCHISI_VIEWBOX - 4}
          rx="28"
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
        <rect
          x={O - 6}
          y={O - 6}
          width={B + 12}
          height={B + 12}
          rx="12"
          fill="#8C562B"
          stroke="url(#wood-frame-bevel)"
          strokeWidth="3"
        />

        {/* Crisp white inner board backing */}
        <rect
          x={O}
          y={O}
          width={B}
          height={B}
          rx="6"
          fill="#FFFFFF"
          stroke="#6E4422"
          strokeWidth="2"
        />

        {/* 2. Four Corner Home Bases (Blue TL, Yellow TR, Red BL, Green BR) */}
        {ALL_PARCHISI_COLORS.map((color) => {
          const base = CORNER_BASES[color];
          const pal = COLOR_PALETTE[color];
          const isTurn = state.turn === color && state.phase !== 'READY';
          const isActiveColor = state.activeColors.includes(color);

          return (
            <g key={`base-${color}`}>
              <rect
                x={base.x}
                y={base.y}
                width={base.size}
                height={base.size}
                fill={pal.fill}
                stroke="#6E4422"
                strokeWidth="1.5"
                opacity={isActiveColor ? 1 : 0.88}
              />
              {/* Soft inset white classic square border inside corner base */}
              <rect
                x={base.x + 14}
                y={base.y + 14}
                width={base.size - 28}
                height={base.size - 28}
                rx="18"
                fill="rgba(255,255,255,0.12)"
                stroke={isTurn ? '#FEF08A' : 'rgba(255,255,255,0.42)'}
                strokeWidth={isTurn ? '3.5' : '2'}
              />
              {/* 4 Recessed Darker Circular Token Slots */}
              {base.slots.map((slot, idx) => (
                <g key={`slot-${color}-${idx}`}>
                  <circle
                    cx={slot.x}
                    cy={slot.y}
                    r="27"
                    fill={pal.slot}
                    stroke="rgba(255,255,255,0.45)"
                    strokeWidth="2"
                  />
                  <circle cx={slot.x} cy={slot.y} r="25" fill="url(#slot-recess)" />
                </g>
              ))}
            </g>
          );
        })}

        {/* 3. Exact 68-Tile Numbered Outer Track (Counter-Clockwise 1..68) */}
        {OUTER_CELLS.map((cell) => {
          let fill = '#FFFFFF';
          let numColor = '#736E68';

          if (cell.startFor) {
            fill = COLOR_PALETTE[cell.startFor].fill;
            numColor = cell.startFor === 'yellow' ? '#4A3102' : 'rgba(255,255,255,0.92)';
          } else if (cell.isStar) {
            fill = '#D4D0C9';
            numColor = '#4F4B46';
          }

          const isHorizontal = cell.orientation === 'horizontal';
          const numX = cell.isStar
            ? isHorizontal
              ? cell.x + 13
              : cell.cx
            : cell.cx;
          const numY = cell.isStar
            ? isHorizontal
              ? cell.cy + 3.5
              : cell.y + 13
            : cell.cy + 3.5;

          return (
            <g key={`outer-${cell.id}`}>
              <rect
                x={cell.x}
                y={cell.y}
                width={cell.w}
                height={cell.h}
                fill={fill}
                stroke="#A8A29A"
                strokeWidth="1.25"
              />
              {/* Centered dark-gray 5-point Star on the 8 Star Safe Tiles */}
              {cell.isStar && (
                <polygon
                  points={STAR_POINTS}
                  transform={`translate(${cell.cx}, ${cell.cy}) scale(1.05)`}
                  fill="#6E6963"
                  opacity="0.72"
                />
              )}
              {/* Subtle centered safe circle ring on Colored Start Tiles */}
              {cell.startFor && (
                <circle
                  cx={cell.cx}
                  cy={cell.cy}
                  r="10"
                  fill="none"
                  stroke={cell.startFor === 'yellow' ? 'rgba(74,49,2,0.32)' : 'rgba(255,255,255,0.45)'}
                  strokeWidth="1.6"
                />
              )}
              {/* Crisp subtle tile number (1..68) */}
              <text
                x={numX}
                y={numY}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="700"
                fill={numColor}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {cell.id}
              </text>
            </g>
          );
        })}

        {/* 4. Four Colored 7-Tile Home Columns */}
        {ALL_PARCHISI_COLORS.map((color) =>
          CORRIDOR_CELLS[color].map((cell) => (
            <g key={`corr-${color}-${cell.index}`}>
              <rect
                x={cell.x}
                y={cell.y}
                width={cell.w}
                height={cell.h}
                fill={COLOR_PALETTE[color].fill}
                stroke={color === 'yellow' ? '#B8860B' : 'rgba(255,255,255,0.48)'}
                strokeWidth="1.25"
              />
              {/* Subtle chevron arrow pointing toward center triangle on first & last home-column tiles */}
              {(cell.index === 0 || cell.index === 6) && (
                <circle
                  cx={cell.cx}
                  cy={cell.cy}
                  r="3.2"
                  fill={color === 'yellow' ? 'rgba(74,49,2,0.28)' : 'rgba(255,255,255,0.4)'}
                />
              )}
            </g>
          )),
        )}

        {/* 5. Center 4-Triangle Goal (Red Left, Green Bottom, Yellow Right, Blue Top) */}
        <g>
          {/* Red Left Triangle */}
          <polygon
            points={`${O + 240},${O + 240} ${C},${C} ${O + 240},${O + 480}`}
            fill={COLOR_PALETTE.red.fill}
            stroke="#5D3A1A"
            strokeWidth="1.8"
          />
          {/* Green Bottom Triangle */}
          <polygon
            points={`${O + 240},${O + 480} ${C},${C} ${O + 480},${O + 480}`}
            fill={COLOR_PALETTE.green.fill}
            stroke="#5D3A1A"
            strokeWidth="1.8"
          />
          {/* Yellow Right Triangle */}
          <polygon
            points={`${O + 480},${O + 240} ${C},${C} ${O + 480},${O + 480}`}
            fill={COLOR_PALETTE.yellow.fill}
            stroke="#5D3A1A"
            strokeWidth="1.8"
          />
          {/* Blue Top Triangle */}
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

        {/* 6. Subtle Blockade Shield/Lock Badges on Outer Track Squares with 2 Same-Color Tokens */}
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
              <circle
                r="7.5"
                fill="#1F120A"
                stroke="#FACC15"
                strokeWidth="1.5"
              />
              <path
                d="M 0,-4.2 L 3.4,-2.4 L 3.4,0.8 C 3.4,2.8 1.8,4.1 0,4.8 C -1.8,4.1 -3.4,2.8 -3.4,0.8 L -3.4,-2.4 Z"
                fill={COLOR_PALETTE[owner].light}
              />
            </g>
          );
        })}

        {/* 7. Target Landing Tile Preview */}
        {targetPreview && (
          <g className="pointer-events-none">
            <circle
              cx={targetPreview.x}
              cy={targetPreview.y}
              r="22"
              fill={targetPreview.isCapture ? 'rgba(229,57,53,0.28)' : 'rgba(250,204,21,0.32)'}
              stroke={targetPreview.isCapture ? '#EF4444' : '#FACC15'}
              strokeWidth="3.5"
              strokeDasharray="6 4"
            >
              <animate
                attributeName="r"
                values="19;24;19"
                dur="0.85s"
                repeatCount="indefinite"
              />
            </circle>
            <circle
              cx={targetPreview.x}
              cy={targetPreview.y}
              r="5"
              fill={targetPreview.isCapture ? '#EF4444' : '#FACC15'}
            />
          </g>
        )}

        {/* 8. Glossy 3D Game Tokens */}
        {renderTokens.map(({ token, x, y, stackSize, isMovable, isSelected }) => {
          const pal = COLOR_PALETTE[token.color];
          const baseScale = stackSize >= 2 ? 0.78 : 1;
          const hopScale = token.hopBoost ? 1.2 : isSelected ? 1.12 : 1;
          const totalScale = baseScale * hopScale;

          return (
            <g
              key={`token-${token.color}-${token.id}`}
              data-testid={`parchisi-token-${token.color}-${token.id}`}
              data-movable={isMovable ? 'true' : 'false'}
              transform={`translate(${x}, ${y}) scale(${totalScale})`}
              style={{
                transition: 'transform 105ms cubic-bezier(0.22, 1, 0.36, 1)',
                cursor: isMovable ? 'pointer' : 'default',
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
              {/* Pulsing golden highlight ring whenever token has a valid move */}
              {isMovable && (
                <>
                  <circle
                    r="21"
                    fill="none"
                    stroke="#FACC15"
                    strokeWidth="3.2"
                    opacity="0.95"
                  >
                    <animate
                      attributeName="r"
                      values="17;24;17"
                      dur="1.15s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.95;0.25;0.95"
                      dur="1.15s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle
                    r="18"
                    fill="none"
                    stroke="#FEF08A"
                    strokeWidth="2.4"
                  />
                </>
              )}

              {/* Generous invisible hit area for mobile finger taps */}
              {isMovable && <circle r="24" fill="transparent" />}

              {/* Glossy 3D Disc */}
              <g filter="url(#token-shadow)">
                {/* Outer bevel ring */}
                <circle
                  r="15.5"
                  fill={pal.dark}
                  stroke={isSelected ? '#FEF08A' : '#FFFFFF'}
                  strokeWidth={isSelected ? '2.8' : '2'}
                />
                {/* Main colored glossy dome */}
                <circle r="13.2" fill={`url(#token-grad-${token.color})`} />
                {/* Top specular glass highlight crescent */}
                <ellipse
                  cx="-3"
                  cy="-6"
                  rx="6.5"
                  ry="3.4"
                  fill="rgba(255,255,255,0.42)"
                  transform="rotate(-18 -3 -6)"
                />
                {/* Centered Crown Emblem */}
                <path
                  d={CROWN_PATH}
                  transform="translate(0, 1) scale(0.76)"
                  fill={token.color === 'yellow' ? '#5A3703' : '#FFF9E6'}
                  opacity="0.95"
                />
              </g>
            </g>
          );
        })}
      </svg>

      {/* 9. Crisp Floating Move Picker Pills (+2, +5, +7) above clicked token */}
      {activePicker && (
        <div
          data-testid="parchisi-move-picker"
          style={{
            left: `${activePicker.leftPct}%`,
            top: `${activePicker.topPct}%`,
            transform: activePicker.preferBelow
              ? 'translate(-50%, 0%)'
              : 'translate(-50%, -100%)',
          }}
          className="absolute z-30 flex items-center gap-1.5 px-2 py-1.5 rounded-full bg-[#241222]/95 border-2 border-[#FACC15] shadow-[0_10px_24px_rgba(0,0,0,0.65)]"
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
              className={`min-h-[34px] px-3 py-1 rounded-full text-xs sm:text-sm font-extrabold tabular-nums whitespace-nowrap transition-transform active:scale-95 ${
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
