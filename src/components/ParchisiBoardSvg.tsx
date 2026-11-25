import { useMemo } from 'react';
import type {
  ParchisiEmoteKind,
  ParchisiMoveOption,
  ParchisiPawn,
  ParchisiPlayer,
  ParchisiState,
} from '../types/duoplay';
import {
  EMERALD_CORRIDOR_CELLS,
  getOuterCell,
  getPawnBoardPoint,
  GOLD_CORRIDOR_CELLS,
  GUEST_BASE_SLOTS,
  GUEST_CORRIDOR_CELLS,
  HOST_BASE_SLOTS,
  HOST_CORRIDOR_CELLS,
  OUTER_CELLS,
  PARCHISI_THRONE_PROGRESS,
  PARCHISI_VIEWBOX,
  progressToOuterSquare,
} from '../game/parchisiBoard';
import { getCorridorBlockades, getOuterBlockades } from '../game/parchisiLogic';

export interface FloatingEmoteItem {
  id: number;
  kind: ParchisiEmoteKind;
  emoji: string;
  label: string;
  from: ParchisiPlayer;
  xPct: number;
}

interface ParchisiBoardSvgProps {
  state: ParchisiState;
  localRole: ParchisiPlayer;
  hostName: string;
  guestName: string;
  legalMoves: ParchisiMoveOption[];
  hoveredPawnId: number | null;
  onHoverPawn: (pawnId: number | null) => void;
  onSelectPawn: (pawnId: number) => void;
  /** Temporary animated progress override during 120ms/square hop animation */
  animOverride: { owner: ParchisiPlayer; pawnId: number; progress: number; hopping: boolean } | null;
  floatingEmotes: FloatingEmoteItem[];
}

export function ParchisiBoardSvg({
  state,
  localRole,
  hostName,
  guestName,
  legalMoves,
  hoveredPawnId,
  onHoverPawn,
  onSelectPawn,
  animOverride,
  floatingEmotes,
}: ParchisiBoardSvgProps) {
  const isMyMovePhase =
    state.turn === localRole &&
    (state.phase === 'WAIT_MOVE' || state.phase === 'BONUS_20' || state.phase === 'BONUS_10');

  const legalByPawnId = useMemo(() => {
    const map = new Map<number, ParchisiMoveOption>();
    if (isMyMovePhase) {
      for (const m of legalMoves) map.set(m.pawnId, m);
    }
    return map;
  }, [isMyMovePhase, legalMoves]);

  // Effective pawns array (applying temporary hop-animation override for smooth step-by-step motion)
  const displayPawns = useMemo(() => {
    const all: ParchisiPawn[] = [];
    for (const owner of ['host', 'guest'] as const) {
      for (const p of state.pawns[owner]) {
        if (animOverride && animOverride.owner === owner && animOverride.pawnId === p.id) {
          all.push({ ...p, progress: animOverride.progress });
        } else {
          all.push(p);
        }
      }
    }
    return all;
  }, [state.pawns, animOverride]);

  // Group pawns by location key to compute clean side-by-side multi-pawn offsets
  const pawnRenderList = useMemo(() => {
    const groups = new Map<string, ParchisiPawn[]>();
    for (const p of displayPawns) {
      let key: string;
      if (p.progress < 0) key = `base:${p.owner}:${p.id}`;
      else if (p.progress >= PARCHISI_THRONE_PROGRESS) key = `throne:${p.owner}:${p.id}`;
      else if (p.progress <= 63) key = `outer:${progressToOuterSquare(p.owner, p.progress)}`;
      else key = `corr:${p.owner}:${p.progress}`;
      const list = groups.get(key) ?? [];
      list.push(p);
      groups.set(key, list);
    }

    const rendered: {
      pawn: ParchisiPawn;
      x: number;
      y: number;
      scale: number;
      isPlayable: boolean;
      isHopping: boolean;
    }[] = [];

    for (const group of groups.values()) {
      group.forEach((pawn, idx) => {
        const pt = getPawnBoardPoint(pawn.owner, pawn.id, pawn.progress, idx, group.length);
        const isPlayable = pawn.owner === localRole && legalByPawnId.has(pawn.id);
        const isHopping = Boolean(
          animOverride && animOverride.owner === pawn.owner && animOverride.pawnId === pawn.id && animOverride.hopping,
        );
        rendered.push({
          pawn,
          x: pt.x,
          y: pt.y,
          scale: group.length >= 2 ? 0.84 : 1,
          isPlayable,
          isHopping,
        });
      });
    }

    // Sort so playable pawns render on top for effortless tapping
    rendered.sort((a, b) => Number(a.isPlayable) - Number(b.isPlayable));
    return rendered;
  }, [displayPawns, localRole, legalByPawnId, animOverride]);

  // Blockades (2 same-color pawns on same cell) for neon lock/shield indicator
  const blockadeCenters = useMemo(() => {
    const centers: { x: number; y: number; owner: ParchisiPlayer; key: string }[] = [];
    const outer = getOuterBlockades(state.pawns);
    for (const [sq, owner] of outer.entries()) {
      const cell = getOuterCell(sq);
      centers.push({ x: cell.cx, y: cell.cy, owner, key: `outer-${sq}` });
    }
    for (const owner of ['host', 'guest'] as const) {
      const corrSet = getCorridorBlockades(state.pawns, owner);
      for (const prog of corrSet) {
        const cell = (owner === 'host' ? HOST_CORRIDOR_CELLS : GUEST_CORRIDOR_CELLS)[prog - 64];
        if (cell) centers.push({ x: cell.cx, y: cell.cy, owner, key: `corr-${owner}-${prog}` });
      }
    }
    return centers;
  }, [state.pawns]);

  // Destination preview marker when hovering a playable pawn (or auto-preview when 1 legal move)
  const previewMove = useMemo(() => {
    if (!isMyMovePhase) return null;
    if (hoveredPawnId !== null && legalByPawnId.has(hoveredPawnId)) {
      return legalByPawnId.get(hoveredPawnId) ?? null;
    }
    if (legalMoves.length === 1) return legalMoves[0];
    return null;
  }, [isMyMovePhase, hoveredPawnId, legalByPawnId, legalMoves]);

  const previewPoint = useMemo(() => {
    if (!previewMove) return null;
    return getPawnBoardPoint(localRole, previewMove.pawnId, previewMove.toProgress, 0, 1);
  }, [previewMove, localRole]);

  const hostFinished = state.pawns.host.filter((p) => p.progress >= PARCHISI_THRONE_PROGRESS).length;
  const guestFinished = state.pawns.guest.filter((p) => p.progress >= PARCHISI_THRONE_PROGRESS).length;

  return (
    <div className="relative aspect-square w-full h-full max-w-full max-h-[85dvh] mx-auto select-none">
      <svg
        viewBox={`0 0 ${PARCHISI_VIEWBOX} ${PARCHISI_VIEWBOX}`}
        data-testid="parchisi-board-svg"
        className="aspect-square w-full h-full max-w-full max-h-[85dvh] rounded-[26px] shadow-2xl shadow-black/60 block"
        role="img"
        aria-label="Plateau Parchisi Royal Love Edition à 68 cases"
      >
        <defs>
          <linearGradient id="royalBoardBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1B1340" />
            <stop offset="50%" stopColor="#120C2B" />
            <stop offset="100%" stopColor="#1C1038" />
          </linearGradient>
          <linearGradient id="goldTrim" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <radialGradient id="rubyYardGrad" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#9F1239" />
            <stop offset="100%" stopColor="#4C0519" />
          </radialGradient>
          <radialGradient id="cyanYardGrad" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#0E7490" />
            <stop offset="100%" stopColor="#083344" />
          </radialGradient>
          <radialGradient id="goldYardGrad" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#78350F" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#291707" stopOpacity="0.85" />
          </radialGradient>
          <radialGradient id="emeraldYardGrad" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#065F46" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#022C22" stopOpacity="0.85" />
          </radialGradient>
          <radialGradient id="rubyPawnGrad" cx="35%" cy="30%" r="68%">
            <stop offset="0%" stopColor="#FDA4AF" />
            <stop offset="45%" stopColor="#F43F5E" />
            <stop offset="100%" stopColor="#9F1239" />
          </radialGradient>
          <radialGradient id="cyanPawnGrad" cx="35%" cy="30%" r="68%">
            <stop offset="0%" stopColor="#A5F3FC" />
            <stop offset="45%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#155E75" />
          </radialGradient>
          <filter id="pawnShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.55" />
          </filter>
        </defs>

        {/* Outer Royal Frame */}
        <rect x="0" y="0" width="760" height="760" rx="28" fill="url(#royalBoardBg)" />
        <rect
          x="10"
          y="10"
          width="740"
          height="740"
          rx="22"
          fill="none"
          stroke="url(#goldTrim)"
          strokeWidth="4"
        />

        {/* ==================== 4 CORNER HOME YARDS ==================== */}

        {/* Top-Left: Decorative Emerald Royal Yard */}
        <g>
          <rect
            x="20"
            y="20"
            width="240"
            height="240"
            rx="12"
            fill="url(#emeraldYardGrad)"
            stroke="#10B981"
            strokeOpacity="0.45"
            strokeWidth="2"
          />
          <circle cx="140" cy="140" r="64" fill="none" stroke="#34D399" strokeOpacity="0.24" strokeWidth="2" strokeDasharray="6 6" />
          <text x="140" y="148" textAnchor="middle" fontSize="34" opacity="0.35">
            💎
          </text>
        </g>

        {/* Top-Right: GUEST ROYAL CYAN YARD (#06B6D4) */}
        <g>
          <rect
            x="500"
            y="20"
            width="240"
            height="240"
            rx="12"
            fill="url(#cyanYardGrad)"
            stroke={state.turn === 'guest' ? '#67E8F9' : '#06B6D4'}
            strokeWidth={state.turn === 'guest' ? '4.5' : '2.5'}
          />
          <rect
            x="514"
            y="34"
            width="212"
            height="212"
            rx="10"
            fill="rgba(6,182,212,0.12)"
            stroke="rgba(165,243,252,0.28)"
            strokeWidth="1.5"
          />
          {GUEST_BASE_SLOTS.map((pt, idx) => (
            <circle
              key={`guest-slot-${idx}`}
              cx={pt.x}
              cy={pt.y}
              r="24"
              fill="rgba(8,51,68,0.75)"
              stroke="#67E8F9"
              strokeOpacity="0.5"
              strokeWidth="2"
            />
          ))}
          <text
            x="620"
            y="53"
            textAnchor="middle"
            fill="#CFFAFE"
            fontSize="13"
            fontWeight="800"
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            ⭐ {guestName.slice(0, 14)} · {guestFinished}/4
          </text>
        </g>

        {/* Bottom-Left: HOST RUBY ROSE YARD (#F43F5E) */}
        <g>
          <rect
            x="20"
            y="500"
            width="240"
            height="240"
            rx="12"
            fill="url(#rubyYardGrad)"
            stroke={state.turn === 'host' ? '#FDA4AF' : '#F43F5E'}
            strokeWidth={state.turn === 'host' ? '4.5' : '2.5'}
          />
          <rect
            x="34"
            y="514"
            width="212"
            height="212"
            rx="10"
            fill="rgba(244,63,94,0.14)"
            stroke="rgba(253,164,175,0.32)"
            strokeWidth="1.5"
          />
          {HOST_BASE_SLOTS.map((pt, idx) => (
            <circle
              key={`host-slot-${idx}`}
              cx={pt.x}
              cy={pt.y}
              r="24"
              fill="rgba(76,5,25,0.75)"
              stroke="#FDA4AF"
              strokeOpacity="0.55"
              strokeWidth="2"
            />
          ))}
          <text
            x="140"
            y="724"
            textAnchor="middle"
            fill="#FFE4E6"
            fontSize="13"
            fontWeight="800"
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            ❤️ {hostName.slice(0, 14)} · {hostFinished}/4
          </text>
        </g>

        {/* Bottom-Right: Decorative Gold Royal Yard */}
        <g>
          <rect
            x="500"
            y="500"
            width="240"
            height="240"
            rx="12"
            fill="url(#goldYardGrad)"
            stroke="#F59E0B"
            strokeOpacity="0.45"
            strokeWidth="2"
          />
          <circle cx="620" cy="620" r="64" fill="none" stroke="#FCD34D" strokeOpacity="0.24" strokeWidth="2" strokeDasharray="6 6" />
          <text x="620" y="628" textAnchor="middle" fontSize="34" opacity="0.35">
            👑
          </text>
        </g>

        {/* ==================== 68 OUTER LOOP SQUARES ==================== */}
        {OUTER_CELLS.map((cell) => {
          let fill = '#221949';
          let stroke = 'rgba(245, 158, 11, 0.35)';

          if (cell.exitFor === 'host') {
            fill = '#9F1239';
            stroke = '#FDA4AF';
          } else if (cell.exitFor === 'guest') {
            fill = '#0E7490';
            stroke = '#67E8F9';
          } else if (cell.isKarma) {
            fill = '#5B1242';
            stroke = '#F472B6';
          } else if (cell.isSafe) {
            fill = '#3B285A';
            stroke = '#FBBF24';
          }

          return (
            <g key={`sq-${cell.id}`} data-square={cell.id}>
              <rect
                x={cell.x + 1}
                y={cell.y + 1}
                width={cell.w - 2}
                height={cell.h - 2}
                rx="4"
                fill={fill}
                stroke={stroke}
                strokeWidth={cell.isSafe || cell.isKarma ? '1.8' : '1'}
              />

              {/* Square Number */}
              <text
                x={cell.orientation === 'horizontal' ? cell.x + 11 : cell.cx}
                y={cell.orientation === 'horizontal' ? cell.cy + 3.5 : cell.y + 12}
                textAnchor="middle"
                fill={cell.isSafe ? '#FDE68A' : cell.isKarma ? '#FBCFE8' : 'rgba(255,255,255,0.42)'}
                fontSize="9"
                fontWeight="700"
                fontFamily="JetBrains Mono, monospace"
              >
                {cell.id}
              </text>

              {/* Safe Zone Golden Star/Shield Marker */}
              {cell.isSafe && (
                <text
                  x={cell.orientation === 'horizontal' ? cell.x + cell.w - 14 : cell.cx}
                  y={cell.orientation === 'horizontal' ? cell.cy + 4.5 : cell.y + cell.h - 9}
                  textAnchor="middle"
                  fill="#FACC15"
                  fontSize="12"
                >
                  ★
                </text>
              )}

              {/* Karma Couple Heart Marker */}
              {cell.isKarma && (
                <text
                  x={cell.cx}
                  y={cell.cy + 5}
                  textAnchor="middle"
                  fill="#FB7185"
                  fontSize="14"
                >
                  ♥
                </text>
              )}
            </g>
          );
        })}

        {/* ==================== 4 COLORED 7-SQUARE FINAL CORRIDORS ==================== */}
        {HOST_CORRIDOR_CELLS.map((c) => (
          <g key={`hc-${c.index}`}>
            <rect
              x={c.x + 1}
              y={c.y + 1}
              width={c.w - 2}
              height={c.h - 2}
              rx="4"
              fill="#881337"
              stroke="#FB7185"
              strokeWidth="1.4"
            />
            <text x={c.cx} y={c.cy + 4} textAnchor="middle" fill="#FDA4AF" fontSize="9.5" fontWeight="700" opacity="0.65">
              {c.index + 1}
            </text>
          </g>
        ))}

        {GUEST_CORRIDOR_CELLS.map((c) => (
          <g key={`gc-${c.index}`}>
            <rect
              x={c.x + 1}
              y={c.y + 1}
              width={c.w - 2}
              height={c.h - 2}
              rx="4"
              fill="#155E75"
              stroke="#22D3EE"
              strokeWidth="1.4"
            />
            <text x={c.cx} y={c.cy + 4} textAnchor="middle" fill="#A5F3FC" fontSize="9.5" fontWeight="700" opacity="0.65">
              {c.index + 1}
            </text>
          </g>
        ))}

        {GOLD_CORRIDOR_CELLS.map((c) => (
          <rect
            key={`goldc-${c.index}`}
            x={c.x + 1}
            y={c.y + 1}
            width={c.w - 2}
            height={c.h - 2}
            rx="4"
            fill="#451A03"
            fillOpacity="0.7"
            stroke="#F59E0B"
            strokeOpacity="0.35"
            strokeWidth="1"
          />
        ))}

        {EMERALD_CORRIDOR_CELLS.map((c) => (
          <rect
            key={`emec-${c.index}`}
            x={c.x + 1}
            y={c.y + 1}
            width={c.w - 2}
            height={c.h - 2}
            rx="4"
            fill="#064E3B"
            fillOpacity="0.7"
            stroke="#10B981"
            strokeOpacity="0.35"
            strokeWidth="1"
          />
        ))}

        {/* ==================== CENTRAL ROYAL THRONE (MAISON FINALE) ==================== */}
        <g>
          {/* 4 directional royal wings meeting at the center */}
          <polygon points="260,260 500,260 380,380" fill="#065F46" fillOpacity="0.62" stroke="#F59E0B" strokeWidth="1.5" />
          <polygon points="500,260 500,500 380,380" fill="#0E7490" fillOpacity="0.88" stroke="#F59E0B" strokeWidth="1.5" />
          <polygon points="260,500 500,500 380,380" fill="#78350F" fillOpacity="0.62" stroke="#F59E0B" strokeWidth="1.5" />
          <polygon points="260,260 260,500 380,380" fill="#9F1239" fillOpacity="0.88" stroke="#F59E0B" strokeWidth="1.5" />

          {/* Golden Center Throne Medallion */}
          <circle cx="380" cy="380" r="36" fill="#1E133D" stroke="url(#goldTrim)" strokeWidth="4" />
          <circle cx="380" cy="380" r="28" fill="rgba(250,204,21,0.16)" stroke="#FDE68A" strokeWidth="1" strokeDasharray="3 3" />
          <text x="380" y="388" textAnchor="middle" fontSize="24">
            👑
          </text>
        </g>

        {/* ==================== BLOCKADE / BARRAGE WALL BADGES ==================== */}
        {blockadeCenters.map((b) => (
          <g key={b.key} pointerEvents="none">
            <rect
              x={b.x - 11}
              y={b.y - 11}
              width="22"
              height="22"
              rx="6"
              fill="#0F0A24"
              stroke={b.owner === 'host' ? '#FDA4AF' : '#67E8F9'}
              strokeWidth="1.8"
            />
            <text x={b.x} y={b.y + 4} textAnchor="middle" fontSize="11">
              🔒
            </text>
          </g>
        ))}

        {/* ==================== DESTINATION PREVIEW MARKER ==================== */}
        {previewPoint && previewMove && (
          <g
            pointerEvents="none"
            data-testid="parchisi-move-preview"
            transform={`translate(${previewPoint.x}, ${previewPoint.y})`}
          >
            <circle
              r="21"
              fill={previewMove.captures ? 'rgba(239, 68, 68, 0.25)' : 'rgba(250, 204, 21, 0.22)'}
              stroke={previewMove.captures ? '#FB7185' : '#FACC15'}
              strokeWidth="3"
              strokeDasharray="5 4"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0"
                to="360"
                dur="3s"
                repeatCount="indefinite"
              />
            </circle>
            <text y="5" textAnchor="middle" fontSize="14">
              {previewMove.captures ? '⚔️' : previewMove.reachesThrone ? '👑' : '✦'}
            </text>
          </g>
        )}

        {/* ==================== ALL 8 PAWNS (HOST RUBY + GUEST CYAN) ==================== */}
        {pawnRenderList.map(({ pawn, x, y, scale, isPlayable, isHopping }) => {
          const isHostPawn = pawn.owner === 'host';
          const grad = isHostPawn ? 'url(#rubyPawnGrad)' : 'url(#cyanPawnGrad)';
          const rim = isHostPawn ? '#FFE4E6' : '#CFFAFE';
          const hopBoost = isHopping ? 1.18 : 1;
          const totalScale = scale * hopBoost;

          return (
            <g
              key={`pawn-${pawn.owner}-${pawn.id}`}
              data-testid={`parchisi-pawn-${pawn.owner}-${pawn.id}`}
              data-playable={isPlayable ? 'true' : 'false'}
              data-progress={pawn.progress}
              role={isPlayable ? 'button' : undefined}
              tabIndex={isPlayable ? 0 : undefined}
              aria-label={`Pion ${pawn.id + 1} ${isHostPawn ? hostName : guestName}`}
              onMouseEnter={() => isPlayable && onHoverPawn(pawn.id)}
              onMouseLeave={() => isPlayable && onHoverPawn(null)}
              onClick={() => isPlayable && onSelectPawn(pawn.id)}
              onKeyDown={(e) => {
                if (isPlayable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onSelectPawn(pawn.id);
                }
              }}
              style={{
                transform: `translate(${x}px, ${y}px) scale(${totalScale})`,
                transition: 'transform 115ms cubic-bezier(0.22, 1, 0.36, 1)',
                cursor: isPlayable ? 'pointer' : 'default',
              }}
              filter="url(#pawnShadow)"
            >
              {/* Generous invisible hit area for effortless mobile tapping */}
              {isPlayable && <circle r="24" fill="transparent" />}

              {/* Pulsing golden playable halo */}
              {isPlayable && (
                <circle r="19" fill="none" stroke="#FACC15" strokeWidth="3.5" opacity="0.92">
                  <animate attributeName="r" values="16;22;16" dur="1.1s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.95;0.35;0.95" dur="1.1s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Love Shield 1-turn immunity aura */}
              {pawn.shieldTurns > 0 && (
                <circle
                  r="18"
                  fill="rgba(244, 114, 182, 0.22)"
                  stroke="#F472B6"
                  strokeWidth="2.4"
                  strokeDasharray="4 3"
                />
              )}

              {/* Jewel Pawn Body */}
              <circle r="13.5" fill={grad} stroke={isPlayable ? '#FEF08A' : rim} strokeWidth={isPlayable ? '3' : '2.2'} />

              {/* Specular highlight */}
              <ellipse cx="-3.5" cy="-4.5" rx="4.5" ry="2.8" fill="rgba(255,255,255,0.45)" transform="rotate(-25 -3.5 -4.5)" />

              {/* Center Heart (Host) or Star (Guest) Icon */}
              <text
                y="4.5"
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="11.5"
                fontWeight="800"
                pointerEvents="none"
              >
                {isHostPawn ? '♥' : '★'}
              </text>
            </g>
          );
        })}
      </svg>

      {/* ==================== FLOATING TEASING EMOTES OVER BOARD ==================== */}
      {floatingEmotes.length > 0 && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden z-20">
          {floatingEmotes.map((em) => (
            <div
              key={em.id}
              style={{ left: `${em.xPct}%` }}
              className="absolute bottom-10 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#130D2B]/92 border border-white/25 shadow-xl animate-bounce"
            >
              <span className="text-xl">{em.emoji}</span>
              <span className="text-xs font-extrabold text-white whitespace-nowrap">{em.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
