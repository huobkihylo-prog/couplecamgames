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
      className="inline-flex items-center gap-0.5 rounded-lg bg-white/6 border border-white/12 p-0.5 shrink-0"
    >
      <Globe className="w-3.5 h-3.5 text-[#A9A295] mx-1.5 hidden sm:block shrink-0" aria-hidden="true" />
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
            className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              active
                ? 'bg-[#E8B861] text-[#11131E]'
                : 'text-[#CBC4B6] hover:text-[#F6F2E9] hover:bg-white/8'
            }`}
          >
            {opt.shortLabel}
          </button>
        );
      })}
    </div>
  );
}
