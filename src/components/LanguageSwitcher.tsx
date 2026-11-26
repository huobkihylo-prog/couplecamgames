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
      className="inline-flex items-center gap-0.5 rounded-full bg-white border border-[#EAE4DC] p-1 shrink-0 shadow-[0_2px_10px_rgba(31,36,45,0.04)]"
    >
      <Globe className="w-3.5 h-3.5 text-[#6B7280] mx-1.5 hidden sm:block shrink-0" aria-hidden="true" />
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
            className={`min-h-[36px] sm:min-h-[32px] px-2.5 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              active
                ? 'bg-[#FF6B57] text-white shadow-sm shadow-[#FF6B57]/30'
                : 'text-[#6B7280] hover:text-[#1F242D] hover:bg-[#FAF7F2]'
            }`}
          >
            {opt.shortLabel}
          </button>
        );
      })}
    </div>
  );
}
