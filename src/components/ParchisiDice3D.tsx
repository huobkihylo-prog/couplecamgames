import { useId, useMemo } from 'react';

interface ParchisiDice3DProps {
  value: number | null;
  rolling: boolean;
  shakeIntensity: number; // 0..1 from HandLandmarker hand shake
  accentColor: string;
  disabled: boolean;
  canRoll: boolean;
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

export function ParchisiDice3D({
  value,
  rolling,
  shakeIntensity,
  accentColor,
  disabled,
  canRoll,
  onRoll,
  ariaLabel,
}: ParchisiDice3DProps) {
  const gradId = useId();
  const faceValue = value ?? 6;
  const pips = useMemo(() => PIP_LAYOUTS[faceValue] ?? PIP_LAYOUTS[6], [faceValue]);

  const jitterX = shakeIntensity > 0.08 ? Math.sin(shakeIntensity * 42) * shakeIntensity * 6 : 0;
  const jitterRot = shakeIntensity > 0.08 ? Math.cos(shakeIntensity * 34) * shakeIntensity * 16 : 0;

  return (
    <button
      type="button"
      data-testid="parchisi-dice-btn"
      disabled={disabled}
      onClick={onRoll}
      aria-label={ariaLabel}
      style={{
        transform: rolling
          ? 'scale(1.08) rotate(14deg)'
          : `translateX(${jitterX.toFixed(1)}px) rotate(${jitterRot.toFixed(1)}deg)`,
        boxShadow: canRoll
          ? `0 0 24px ${accentColor}66, inset 0 2px 6px rgba(255,255,255,0.45)`
          : '0 6px 18px rgba(0,0,0,0.45)',
      }}
      className={`relative w-11 h-11 sm:w-16 sm:h-16 rounded-2xl transition-transform duration-150 select-none shrink-0 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[#FACC15] ${
        canRoll
          ? 'cursor-pointer hover:scale-105 active:scale-95'
          : 'cursor-default opacity-80'
      }`}
    >
      {/* Animated golden halo ring when it is your turn to roll */}
      {canRoll && !rolling && (
        <span
          aria-hidden="true"
          style={{ borderColor: accentColor }}
          className="pointer-events-none absolute -inset-1.5 rounded-[20px] border-2 opacity-75 animate-ping"
        />
      )}

      {/* 3D Royal Beveled Dice Face SVG */}
      <svg
        viewBox="0 0 100 100"
        className={`w-full h-full drop-shadow-md ${rolling ? 'animate-spin' : ''}`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFDF7" />
            <stop offset="55%" stopColor="#F8EFE0" />
            <stop offset="100%" stopColor="#E6D2B2" />
          </linearGradient>
        </defs>
        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="22"
          fill={`url(#${gradId})`}
          stroke="#F59E0B"
          strokeWidth="4.5"
        />
        <rect
          x="10"
          y="10"
          width="80"
          height="80"
          rx="16"
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="2"
        />
        {pips.map(([cx, cy], idx) => (
          <g key={idx}>
            <circle cx={cx} cy={cy + 1.5} r="8.2" fill="rgba(255,255,255,0.75)" />
            <circle
              cx={cx}
              cy={cy}
              r="8.2"
              fill={faceValue === 6 ? '#E11D48' : '#1E1B4B'}
            />
          </g>
        ))}
      </svg>
    </button>
  );
}
