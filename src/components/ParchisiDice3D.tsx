import { useId, useMemo } from 'react';
import type { ParchisiBonusAmount } from '../types/duoplay';

interface ParchisiDiceTrayProps {
  dice: [number, number] | null;
  usedDice: [boolean, boolean];
  pendingBonus: ParchisiBonusAmount | null;
  rolling: boolean;
  shakeIntensity: number; // 0..1 from optional MediaPipe hand shake
  canRoll: boolean;
  isActiveTray: boolean;
  compact?: boolean;
  accentColor: string;
  onRoll: () => void;
  ariaLabel: string;
}

const PIP_LAYOUTS: Record<number, [number, number][]> = {
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

function SingleDie3D({
  value,
  used,
  rolling,
  compact,
  gradPrefix,
  tiltDeg,
}: {
  value: number;
  used: boolean;
  rolling: boolean;
  compact: boolean;
  gradPrefix: string;
  tiltDeg: number;
}) {
  const pips = useMemo(() => PIP_LAYOUTS[value] ?? PIP_LAYOUTS[5], [value]);

  return (
    <div
      style={{
        transform: rolling ? `rotate(${tiltDeg}deg) scale(1.06)` : 'rotate(0deg) scale(1)',
      }}
      className={`relative ${
        compact ? 'w-9 h-9 sm:w-11 sm:h-11' : 'w-10 h-10 sm:w-12 sm:h-12'
      } transition-all duration-150 shrink-0 ${
        used ? 'opacity-40 grayscale-[35%] scale-90' : 'opacity-100'
      }`}
    >
      <svg
        viewBox="0 0 100 100"
        className={`w-full h-full drop-shadow-[0_3px_5px_rgba(0,0,0,0.48)] ${
          rolling ? 'animate-spin' : ''
        }`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${gradPrefix}-body`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="55%" stopColor="#F6F0E6" />
            <stop offset="100%" stopColor="#D7C3A8" />
          </linearGradient>
          <linearGradient id={`${gradPrefix}-rim`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFDF8" />
            <stop offset="100%" stopColor="#B69870" />
          </linearGradient>
        </defs>
        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="20"
          fill={`url(#${gradPrefix}-body)`}
          stroke={`url(#${gradPrefix}-rim)`}
          strokeWidth="4"
        />
        <rect
          x="10"
          y="10"
          width="80"
          height="80"
          rx="14"
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="2"
        />
        {pips.map(([cx, cy], idx) => (
          <g key={idx}>
            <circle cx={cx} cy={cy + 1.5} r="8.5" fill="rgba(255,255,255,0.82)" />
            <circle
              cx={cx}
              cy={cy}
              r="8.5"
              fill={value === 5 || value === 6 ? '#C62828' : '#241A13'}
            />
          </g>
        ))}
      </svg>

      {/* Crisp checkmark badge when this die has already been spent */}
      {used && !rolling && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#1F2937] border border-white/70 text-[#4ADE80] flex items-center justify-center text-[10px] font-black shadow"
        >
          ✓
        </span>
      )}
    </div>
  );
}

/**
 * Authentic Official Parcheesi 2-Dice Golden-Brown Pill Tray.
 * Large, well-spaced dice with instant touch response (zero 300ms delay),
 * clear "🎲 Lancer" action cue, spent-die dimming, and glowing +20/+10 bonus badge.
 */
export function ParchisiDice3D({
  dice,
  usedDice,
  pendingBonus,
  rolling,
  shakeIntensity,
  canRoll,
  isActiveTray,
  compact = false,
  accentColor,
  onRoll,
  ariaLabel,
}: ParchisiDiceTrayProps) {
  const baseId = useId();
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
          ? 'gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5'
          : 'gap-2 sm:gap-2.5 px-3 sm:px-3.5 py-1.5'
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
        used={Boolean(dice && usedDice[0])}
        rolling={rolling}
        compact={compact}
        gradPrefix={`${baseId}-d1`}
        tiltDeg={-16}
      />
      <SingleDie3D
        value={d2}
        used={Boolean(dice && usedDice[1])}
        rolling={rolling}
        compact={compact}
        gradPrefix={`${baseId}-d2`}
        tiltDeg={18}
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
