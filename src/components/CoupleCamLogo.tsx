import { useId } from 'react';

interface CoupleCamLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
}

/**
 * CoupleCam brand mark: "Le Double Cadre Polaroid"
 * Two slightly tilted minimalist Polaroid frames overlapping at center
 * (left -8deg coral #FF6B57, right +8deg soft violet #7C5CFC, cream-white #FFFDF9 interior),
 * forming a crisp split heart (coral / violet) at the overlap + live red dot #EF4444.
 */
export function CoupleCamLogo({ size = 'md', showWordmark = true }: CoupleCamLogoProps) {
  const uid = useId().replace(/:/g, '');
  const iconDim = size === 'lg' ? 44 : size === 'sm' ? 32 : 38;
  const textClass =
    size === 'lg'
      ? 'text-2xl sm:text-3xl'
      : size === 'sm'
        ? 'text-base sm:text-lg'
        : 'text-xl sm:text-2xl';

  return (
    <div
      data-testid="couplecam-logo"
      className="inline-flex items-center gap-2 select-none whitespace-nowrap shrink-0"
    >
      <svg
        width={iconDim}
        height={iconDim}
        viewBox="0 0 48 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <clipPath id={`heart-left-${uid}`}>
            <rect x="0" y="0" width="24" height="44" />
          </clipPath>
          <clipPath id={`heart-right-${uid}`}>
            <rect x="24" y="0" width="24" height="44" />
          </clipPath>
          <filter id={`polaroid-shadow-${uid}`} x="-12%" y="-12%" width="124%" height="128%">
            <feDropShadow dx="0" dy="2" stdDeviation="1.6" floodColor="#1F242D" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Left Polaroid Frame (-8 deg, Coral #FF6B57) */}
        <g transform="rotate(-8 17 23)" filter={`url(#polaroid-shadow-${uid})`}>
          <rect
            x="5.5"
            y="7.5"
            width="22"
            height="27"
            rx="4.2"
            fill="#FFFDF9"
            stroke="#FF6B57"
            strokeWidth="2.4"
          />
          <rect x="8.5" y="10.5" width="16" height="15.5" rx="2" fill="#FFF2EE" />
        </g>

        {/* Right Polaroid Frame (+8 deg, Soft Violet #7C5CFC) */}
        <g transform="rotate(8 31 23)" filter={`url(#polaroid-shadow-${uid})`}>
          <rect
            x="20.5"
            y="7.5"
            width="22"
            height="27"
            rx="4.2"
            fill="#FFFDF9"
            stroke="#7C5CFC"
            strokeWidth="2.4"
          />
          <rect x="23.5" y="10.5" width="16" height="15.5" rx="2" fill="#F2EEFF" />
          {/* Live red indicator dot at top-right of violet frame */}
          <circle cx="38.2" cy="11.2" r="2.6" fill="#EF4444" stroke="#FFFDF9" strokeWidth="1.2" />
        </g>

        {/* Centered Split Heart (left half Coral #FF6B57, right half Soft Violet #7C5CFC) */}
        <g>
          {/* Subtle cream halo so the heart pops cleanly over both frames */}
          <path
            d="M24 27.6C24 27.6 16.4 22.8 16.4 17.8C16.4 15.1 18.5 13.2 20.9 13.2C22.4 13.2 23.4 14 24 15C24.6 14 25.6 13.2 27.1 13.2C29.5 13.2 31.6 15.1 31.6 17.8C31.6 22.8 24 27.6 24 27.6Z"
            fill="#FFFDF9"
            stroke="#FFFDF9"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <path
            d="M24 27.2C24 27.2 16.8 22.6 16.8 17.9C16.8 15.4 18.8 13.6 21 13.6C22.4 13.6 23.4 14.3 24 15.3C24.6 14.3 25.6 13.6 27 13.6C29.2 13.6 31.2 15.4 31.2 17.9C31.2 22.6 24 27.2 24 27.2Z"
            fill="#FF6B57"
            clipPath={`url(#heart-left-${uid})`}
          />
          <path
            d="M24 27.2C24 27.2 16.8 22.6 16.8 17.9C16.8 15.4 18.8 13.6 21 13.6C22.4 13.6 23.4 14.3 24 15.3C24.6 14.3 25.6 13.6 27 13.6C29.2 13.6 31.2 15.4 31.2 17.9C31.2 22.6 24 27.2 24 27.2Z"
            fill="#7C5CFC"
            clipPath={`url(#heart-right-${uid})`}
          />
        </g>
      </svg>

      {showWordmark && (
        <span
          className={`font-extrabold tracking-tight text-[#1F242D] ${textClass}`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Couple<span className="text-[#FF6B57]">Cam</span>
        </span>
      )}
    </div>
  );
}
