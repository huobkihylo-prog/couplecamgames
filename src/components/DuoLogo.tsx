export function DuoLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const iconDim = size === 'lg' ? 40 : size === 'sm' ? 28 : 34;
  const textClass =
    size === 'lg'
      ? 'text-2xl sm:text-3xl'
      : size === 'sm'
        ? 'text-base sm:text-lg'
        : 'text-xl sm:text-2xl';

  return (
    <div className="inline-flex items-center gap-2 select-none whitespace-nowrap shrink-0">
      <svg
        width={iconDim}
        height={iconDim}
        viewBox="0 0 44 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0 drop-shadow-[0_4px_12px_rgba(255,77,141,0.45)]"
      >
        <defs>
          <linearGradient id="cc-lens-left" x1="4" y1="8" x2="28" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#FF4D8D" />
          </linearGradient>
          <linearGradient id="cc-lens-right" x1="16" y1="8" x2="40" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF4D8D" />
            <stop offset="100%" stopColor="#38BDF8" />
          </linearGradient>
        </defs>
        <circle cx="16.5" cy="20" r="12" stroke="url(#cc-lens-left)" strokeWidth="3" fill="#7C3AED" fillOpacity="0.22" />
        <circle cx="16.5" cy="20" r="5.8" stroke="#FF4D8D" strokeWidth="1.5" strokeOpacity="0.8" />
        <circle cx="27.5" cy="20" r="12" stroke="url(#cc-lens-right)" strokeWidth="3" fill="#38BDF8" fillOpacity="0.18" />
        <circle cx="27.5" cy="20" r="5.8" stroke="#38BDF8" strokeWidth="1.5" strokeOpacity="0.8" />
        <path
          d="M22 11.4C24.5 13.8 25.8 16.8 25.8 20C25.8 23.2 24.5 26.2 22 28.6C19.5 26.2 18.2 23.2 18.2 20C18.2 16.8 19.5 13.8 22 11.4Z"
          fill="#FFFFFF"
          fillOpacity="0.95"
        />
        <circle cx="13.8" cy="16.5" r="1.5" fill="#FFFFFF" />
        <circle cx="30.2" cy="16.5" r="1.5" fill="#FFFFFF" />
      </svg>
      <span
        className={`font-extrabold tracking-tight text-white ${textClass}`}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        CoupleCam{' '}
        <span className="bg-gradient-to-r from-[#FF4D8D] via-[#FBBF24] to-[#38BDF8] bg-clip-text text-transparent">
          Play
        </span>
      </span>
    </div>
  );
}
