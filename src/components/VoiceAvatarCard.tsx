import { Bot, Mic, MicOff, Sparkles, UserRound, Volume2 } from 'lucide-react';
import { useI18n } from '../i18n/LanguageContext';

interface VoiceAvatarCardProps {
  name: string;
  roleLabel: string;
  isLocal?: boolean;
  isAi?: boolean;
  isWaiting?: boolean;
  hasAudio?: boolean;
  isMuted?: boolean;
  isSpeaking?: boolean;
  accent?: 'coral' | 'gold' | 'lavender';
  testId?: string;
}

const ACCENT_STYLES = {
  coral: {
    avatarBg: 'bg-[#FFE8E2] text-[#D94A38] border-[#FF6B57]/45',
    glowRing: 'ring-4 ring-[#FF6B57]/35 shadow-[0_0_24px_rgba(255,107,87,0.34)]',
    badgeBg: 'bg-[#FFE8E2] text-[#C8412F]',
    dot: 'bg-[#FF6B57]',
  },
  gold: {
    avatarBg: 'bg-[#FEF6DC] text-[#B45309] border-[#F59E0B]/45',
    glowRing: 'ring-4 ring-[#F59E0B]/35 shadow-[0_0_24px_rgba(245,158,11,0.30)]',
    badgeBg: 'bg-[#FEF6DC] text-[#92400E]',
    dot: 'bg-[#F59E0B]',
  },
  lavender: {
    avatarBg: 'bg-[#EFE9FB] text-[#6D28D9] border-[#7C5CFC]/45',
    glowRing: 'ring-4 ring-[#7C5CFC]/30 shadow-[0_0_24px_rgba(124,92,252,0.28)]',
    badgeBg: 'bg-[#EFE9FB] text-[#5B21B6]',
    dot: 'bg-[#7C5CFC]',
  },
} as const;

export function VoiceAvatarCard({
  name,
  roleLabel,
  isLocal = false,
  isAi = false,
  isWaiting = false,
  hasAudio = false,
  isMuted = false,
  isSpeaking = false,
  accent = 'coral',
  testId,
}: VoiceAvatarCardProps) {
  const { t } = useI18n();
  const palette = ACCENT_STYLES[accent];
  const initials = (name.trim().slice(0, 2) || '?').toUpperCase();
  const activeSpeaking = isSpeaking && !isMuted && !isWaiting && !isAi;

  const voiceStatusLabel = isWaiting
    ? t.voiceWaitingSlot
    : isAi
      ? t.toolbarAiMode
      : activeSpeaking
        ? t.voiceSpeaking
        : isMuted
          ? t.voiceMuted
          : hasAudio
            ? t.voiceListening
            : t.voiceNoMic;

  return (
    <div
      data-testid={testId}
      className={`relative rounded-2xl bg-white border transition-all p-3.5 sm:p-4 flex items-center gap-3.5 shadow-[0_3px_14px_rgba(31,36,45,0.05)] ${
        activeSpeaking
          ? 'border-[#FF6B57]/60 bg-[#FFFDF9]'
          : isWaiting
            ? 'border-dashed border-[#D8D0C5] bg-[#FAF7F2]/80'
            : 'border-[#EAE4DC]'
      }`}
    >
      {/* Pastel Circular Avatar + Animated Speaking Glow */}
      <div className="relative shrink-0">
        <div
          className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full border-2 flex items-center justify-center font-extrabold text-base sm:text-lg transition-all duration-200 ${
            isWaiting
              ? 'bg-[#F3EEE6] text-[#9CA3AF] border-[#EAE4DC]'
              : palette.avatarBg
          } ${activeSpeaking ? `${palette.glowRing} scale-[1.04]` : ''}`}
        >
          {isWaiting ? (
            <UserRound className="w-6 h-6" />
          ) : isAi ? (
            <Bot className="w-6 h-6" />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        {/* Tiny corner mic indicator badge */}
        {!isWaiting && !isAi && (
          <span
            aria-hidden="true"
            className={`absolute -bottom-0.5 -end-0.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow-xs ${
              isMuted
                ? 'bg-[#EF4444] text-white'
                : activeSpeaking
                  ? 'bg-[#16A34A] text-white'
                  : hasAudio
                    ? 'bg-[#22C55E] text-white'
                    : 'bg-[#E5E7EB] text-[#6B7280]'
            }`}
          >
            {isMuted ? (
              <MicOff className="w-2.5 h-2.5" />
            ) : activeSpeaking ? (
              <Volume2 className="w-2.5 h-2.5" />
            ) : (
              <Mic className="w-2.5 h-2.5" />
            )}
          </span>
        )}
      </div>

      {/* Name, Role, & Live Voice State */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-sm sm:text-base font-extrabold text-[#1F242D] truncate">
            {isWaiting ? t.roomMenuWaitingGuest : name}
          </p>
          {isLocal && !isWaiting && (
            <span className="text-[11px] font-semibold text-[#6B7280] shrink-0">
              {t.youTag}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
              isWaiting ? 'bg-[#EAE4DC] text-[#6B7280]' : palette.badgeBg
            }`}
          >
            {isAi && <Sparkles className="w-3 h-3 shrink-0" />}
            <span>{roleLabel}</span>
          </span>

          <span
            className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
              activeSpeaking
                ? 'text-[#15803D]'
                : isMuted
                  ? 'text-[#DC2626]'
                  : 'text-[#6B7280]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isWaiting
                  ? 'bg-[#F59E0B] animate-pulse'
                  : activeSpeaking
                    ? 'bg-[#16A34A] animate-pulse'
                    : isMuted
                      ? 'bg-[#EF4444]'
                      : hasAudio || isAi
                        ? 'bg-[#22C55E]'
                        : 'bg-[#9CA3AF]'
              }`}
            />
            <span className="truncate">{voiceStatusLabel}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
