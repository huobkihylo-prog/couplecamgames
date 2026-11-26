import { useEffect, useRef, useState } from 'react';
import type { ParchisiBonusAmount } from '../types/duoplay';
import {
  computeNextDieRotation,
  computePreRollDieRotation,
  getDieFaceAngle,
  type DieRotation3D,
} from '../game/parchisiAnimation';

export const PARCHISI_DICE_ROLL_MS = 540;

interface ParchisiDiceTrayProps {
  dice: [number, number] | null;
  usedDice: [boolean, boolean];
  pendingBonus: ParchisiBonusAmount | null;
  rollSeq: number;
  rolling: boolean;
  shakeIntensity: number; // 0..1 from optional MediaPipe hand shake
  canRoll: boolean;
  isActiveTray: boolean;
  compact?: boolean;
  accentColor: string;
  onRoll: () => void;
  ariaLabel: string;
}

const PIP_LAYOUTS: Record<number, readonly [number, number][]> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 24],
    [72, 24],
    [28, 50],
    [72, 50],
    [28, 76],
    [72, 76],
  ],
};

/** Exact 3D CSS transforms positioning each face (1..6) onto the 6 sides of the cube. */
const FACE_TRANSFORMS: readonly { face: number; transform: string }[] = [
  { face: 1, transform: 'rotateY(0deg) translateZ(var(--die-half))' },
  { face: 6, transform: 'rotateY(180deg) translateZ(var(--die-half))' },
  { face: 2, transform: 'rotateY(90deg) translateZ(var(--die-half))' },
  { face: 5, transform: 'rotateY(-90deg) translateZ(var(--die-half))' },
  { face: 3, transform: 'rotateX(90deg) translateZ(var(--die-half))' },
  { face: 4, transform: 'rotateX(-90deg) translateZ(var(--die-half))' },
];

function DieFaceSvg({ face }: { face: number }) {
  const pips = PIP_LAYOUTS[face] ?? PIP_LAYOUTS[1];
  const pipFill = face === 5 || face === 6 ? '#C62828' : '#241A13';

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full pointer-events-none" aria-hidden="true">
      {pips.map(([cx, cy], idx) => (
        <g key={idx}>
          <circle cx={cx} cy={cy + 2} r="9.2" fill="rgba(255,255,255,0.85)" />
          <circle cx={cx} cy={cy} r="9.2" fill={pipFill} />
        </g>
      ))}
    </svg>
  );
}

/**
 * True 6-face 3D CSS Cube die:
 * - Never unmounts or flickers on landing
 * - Never collapses edge-on into 0px thickness
 * - Smoothly rotates at 60fps across multiple axes and stops dead-on the authoritative face (1..6)
 */
function SingleDie3D({
  value,
  hasRealDice,
  rollSeq,
  used,
  rolling,
  compact,
  variant,
}: {
  value: number;
  hasRealDice: boolean;
  rollSeq: number;
  used: boolean;
  rolling: boolean;
  compact: boolean;
  variant: 'a' | 'b';
}) {
  const initialFace = Math.max(1, Math.min(6, Math.round(value)));
  const mountedRollingRef = useRef(rolling && hasRealDice && rollSeq > 0);
  const initialRot = mountedRollingRef.current
    ? computePreRollDieRotation(initialFace, variant)
    : getDieFaceAngle(initialFace);

  const [rotation, setRotation] = useState<DieRotation3D>(initialRot);
  const [transitionMs, setTransitionMs] = useState<number>(0);
  const [arcSeq, setArcSeq] = useState<number>(mountedRollingRef.current ? rollSeq : 0);

  const rotRef = useRef<DieRotation3D>(initialRot);
  const lastHandledSeqRef = useRef<number>(mountedRollingRef.current ? -1 : rollSeq);
  const lastFaceRef = useRef<number>(initialFace);

  useEffect(() => {
    if (rollSeq <= 0) {
      lastHandledSeqRef.current = 0;
      return;
    }
    if (!hasRealDice) {
      return;
    }

    if (rollSeq === lastHandledSeqRef.current) {
      // Same rollSeq, ensure face matches if authoritative value ever changed
      if (initialFace !== lastFaceRef.current) {
        const snapped = getDieFaceAngle(initialFace);
        rotRef.current = snapped;
        lastFaceRef.current = initialFace;
        setTransitionMs(0);
        setRotation(snapped);
      }
      return;
    }

    const isFreshMountedRoll = lastHandledSeqRef.current === -1;
    lastHandledSeqRef.current = rollSeq;
    lastFaceRef.current = initialFace;

    if (isFreshMountedRoll) {
      // Start one rAF after pre-roll paint so the browser smoothly transitions into exact face
      const target = getDieFaceAngle(initialFace);
      const rafId = window.requestAnimationFrame(() => {
        rotRef.current = target;
        setTransitionMs(PARCHISI_DICE_ROLL_MS);
        setRotation(target);
        setArcSeq(rollSeq);
      });
      return () => window.cancelAnimationFrame(rafId);
    }

    const nextRot = computeNextDieRotation(rotRef.current, initialFace, variant, rollSeq);
    rotRef.current = nextRot;
    setTransitionMs(PARCHISI_DICE_ROLL_MS);
    setRotation(nextRot);
    setArcSeq(rollSeq);
  }, [hasRealDice, initialFace, rollSeq, variant]);

  const arcClass =
    rolling && arcSeq > 0
      ? variant === 'a'
        ? 'parchisi-die-arc-a'
        : 'parchisi-die-arc-b'
      : '';

  return (
    <div
      data-testid={`parchisi-die-${variant}`}
      data-die-value={initialFace}
      data-rolling={rolling ? 'true' : 'false'}
      style={{
        transform: used && !rolling ? 'scale(0.88)' : 'scale(1)',
        transition: 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease',
        willChange: 'transform, opacity',
      }}
      className={`relative shrink-0 ${
        used && !rolling ? 'opacity-40 grayscale-[35%]' : 'opacity-100'
      }`}
    >
      <div
        className={`parchisi-die-scene ${compact ? 'parchisi-die-scene--compact' : ''}`}
        style={{ filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.42))' }}
      >
        <div className={`parchisi-die-lift ${arcClass}`}>
          <div
            className="parchisi-die-cube"
            style={{
              transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
              transition:
                transitionMs > 0
                  ? `transform ${transitionMs}ms cubic-bezier(0.18, 0.9, 0.24, 1)`
                  : 'none',
            }}
          >
            {/* Solid inner ivory cross-planes eliminate any micro-gap around rounded edges mid-spin */}
            <div className="parchisi-die-core" style={{ transform: 'rotateY(0deg)' }} />
            <div className="parchisi-die-core" style={{ transform: 'rotateY(90deg)' }} />
            <div className="parchisi-die-core" style={{ transform: 'rotateX(90deg)' }} />

            {/* All 6 real opaque ivory faces */}
            {FACE_TRANSFORMS.map(({ face, transform }) => (
              <div
                key={face}
                className="parchisi-die-face"
                style={{ transform }}
              >
                <DieFaceSvg face={face} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Crisp checkmark badge when this die has already been spent */}
      {used && !rolling && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 z-10 w-4 h-4 rounded-full bg-[#1F2937] border border-white/70 text-[#4ADE80] flex items-center justify-center text-[10px] font-black shadow"
        >
          ✓
        </span>
      )}
    </div>
  );
}

/**
 * Authentic Official Parcheesi 2-Dice Golden-Brown Pill Tray.
 * Uses true 6-face 3D CSS cubes that smoothly rotate at 60fps and stop squarely
 * on the synchronized face (1..6) for both Duo (PeerJS) and AI play.
 */
export function ParchisiDice3D({
  dice,
  usedDice,
  pendingBonus,
  rollSeq,
  rolling,
  shakeIntensity,
  canRoll,
  isActiveTray,
  compact = false,
  accentColor,
  onRoll,
  ariaLabel,
}: ParchisiDiceTrayProps) {
  const hasRealDice = dice !== null;
  const d1 = dice ? dice[0] : 5;
  const d2 = dice ? dice[1] : 6;

  const jitterX = shakeIntensity > 0.08 ? Math.sin(shakeIntensity * 42) * shakeIntensity * 5 : 0;
  const jitterRot = shakeIntensity > 0.08 ? Math.cos(shakeIntensity * 34) * shakeIntensity * 9 : 0;

  return (
    <button
      type="button"
      data-testid="parchisi-dice-btn"
      disabled={!canRoll}
      onClick={onRoll}
      aria-label={ariaLabel}
      style={{
        transform: `translateX(${jitterX.toFixed(1)}px) rotate(${jitterRot.toFixed(1)}deg)`,
        background: 'linear-gradient(180deg, #7E5027 0%, #5A3516 55%, #41240D 100%)',
        boxShadow: canRoll
          ? `0 0 0 2.5px #FACC15, 0 0 20px ${accentColor}88, inset 0 2px 4px rgba(255,232,186,0.38), 0 4px 12px rgba(0,0,0,0.48)`
          : isActiveTray
            ? '0 0 0 1.5px rgba(224,164,88,0.8), inset 0 2px 4px rgba(255,232,186,0.22), 0 4px 10px rgba(0,0,0,0.4)'
            : '0 0 0 1px rgba(197,139,88,0.35), inset 0 2px 3px rgba(0,0,0,0.35)',
        WebkitTapHighlightColor: 'transparent',
      }}
      className={`relative min-h-[46px] inline-flex items-center touch-manipulation select-none shrink-0 ${
        compact
          ? 'gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-1.5'
          : 'gap-2.5 sm:gap-3 px-3 sm:px-3.5 py-1.5'
      } rounded-full transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FACC15] ${
        canRoll
          ? 'cursor-pointer hover:brightness-110 active:scale-95'
          : isActiveTray
            ? 'cursor-default'
            : 'cursor-default opacity-65'
      }`}
    >
      {/* Prominent golden pulse ring when it's your turn to roll */}
      {canRoll && !rolling && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1 rounded-full border-2 border-[#FACC15]/80 animate-pulse"
        />
      )}

      <SingleDie3D
        value={d1}
        hasRealDice={hasRealDice}
        rollSeq={rollSeq}
        used={Boolean(dice && usedDice[0])}
        rolling={rolling}
        compact={compact}
        variant="a"
      />
      <SingleDie3D
        value={d2}
        hasRealDice={hasRealDice}
        rollSeq={rollSeq}
        used={Boolean(dice && usedDice[1])}
        rolling={rolling}
        compact={compact}
        variant="b"
      />

      {/* Glowing golden +20 / +10 bonus badge */}
      {pendingBonus !== null && (
        <span
          data-testid="parchisi-bonus-badge"
          className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs sm:text-sm font-black tabular-nums text-[#2B1503] bg-gradient-to-b from-[#FEF08A] via-[#FACC15] to-[#D97706] shadow-[0_0_14px_rgba(250,204,21,0.85)] border border-white/65 animate-bounce whitespace-nowrap"
        >
          +{pendingBonus}
        </span>
      )}

      {/* Clear "🎲 Lancer" action badge inside tray whenever awaiting local roll */}
      {canRoll && !rolling && (
        <span
          className={`${
            compact ? 'hidden sm:inline-flex' : 'inline-flex'
          } items-center gap-1 px-2.5 py-1 rounded-full text-xs sm:text-sm font-black tracking-wide text-[#2B1503] bg-gradient-to-b from-[#FEF08A] to-[#F59E0B] shadow-sm whitespace-nowrap`}
        >
          <span aria-hidden="true">🎲</span>
          <span>Lancer</span>
        </span>
      )}
    </button>
  );
}
