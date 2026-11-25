import { Globe } from 'lucide-react';
import type { Language } from '../types/duoplay';
import { useI18n } from '../i18n/LanguageContext';

const OPTIONS: { code: Language; shortLabel: string; ariaLabel: string }[] = [
  { code: 'fr', shortLabel: 'FR', ariaLabel: 'Français' },
  { code: 'en', shortLabel: 'EN', ariaLabel: 'English' },
  { code: 'ar', shortLabel: 'عربي', ariaLabel: 'العربية' },
];

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();

  return (
    <div
      role="group"
      aria-label="Language selector"
      data-testid="language-switcher"
      className="inline-flex items-center gap-0.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 p-1 shrink-0"
    >
      <Globe className="w-3.5 h-3.5 text-white/75 mx-1.5 hidden sm:block shrink-0" aria-hidden="true" />
      {OPTIONS.map((opt) => {
        const active = lang === opt.code;
        return (
          <button
            key={opt.code}
            type="button"
            data-lang={opt.code}
            aria-label={opt.ariaLabel}
            aria-pressed={active}
            onClick={() => setLang(opt.code)}
            className={`min-h-[40px] sm:min-h-[34px] px-3 sm:px-2.5 py-1.5 sm:py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              active
                ? 'bg-gradient-to-r from-[#7C3AED] via-[#FF4D8D] to-[#38BDF8] text-white shadow-sm shadow-[#FF4D8D]/40'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            {opt.shortLabel}
          </button>
        );
      })}
    </div>
  );
}
