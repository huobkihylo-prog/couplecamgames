export function DuoLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const iconDim = size === 'lg' ? 42 : size === 'sm' ? 26 : 32;
  const textClass =
    size === 'lg'
      ? 'text-3xl sm:text-4xl'
      : size === 'sm'
        ? 'text-lg'
        : 'text-2xl';

  return (
    <div className="inline-flex items-center gap-2.5 select-none whitespace-nowrap shrink-0">
      <svg
        width={iconDim}
        height={iconDim}
        viewBox="0 0 44 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* Left camera lens ring (Coral) */}
        <circle cx="16.5" cy="20" r="12" stroke="#E86A58" strokeWidth="2.6" fill="#E86A58" fillOpacity="0.14" />
        <circle cx="16.5" cy="20" r="6.2" stroke="#E86A58" strokeWidth="1.4" strokeOpacity="0.65" />
        {/* Right camera lens ring (Warm Gold) */}
        <circle cx="27.5" cy="20" r="12" stroke="#E8B861" strokeWidth="2.6" fill="#E8B861" fillOpacity="0.12" />
        <circle cx="27.5" cy="20" r="6.2" stroke="#E8B861" strokeWidth="1.4" strokeOpacity="0.65" />
        {/* Overlapping focal prism */}
        <path
          d="M22 11.4C24.5 13.8 25.8 16.8 25.8 20C25.8 23.2 24.5 26.2 22 28.6C19.5 26.2 18.2 23.2 18.2 20C18.2 16.8 19.5 13.8 22 11.4Z"
          fill="#F6F2E9"
          fillOpacity="0.92"
        />
        {/* Subtle aperture glint */}
        <circle cx="13.8" cy="16.8" r="1.4" fill="#F6F2E9" fillOpacity="0.8" />
        <circle cx="30.2" cy="16.8" r="1.4" fill="#F6F2E9" fillOpacity="0.8" />
      </svg>
      <span
        className={`font-semibold tracking-tight text-[#F6F2E9] ${textClass}`}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        CoupleCam{' '}
        <span className="italic font-semibold text-[#E8B861]">Play</span>
      </span>
    </div>
  );
}
