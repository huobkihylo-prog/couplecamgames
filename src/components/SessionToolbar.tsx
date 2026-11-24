import { useState } from 'react';
import {
  Check,
  Copy,
  LayoutGrid,
  LogOut,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { ConnectionMode, ScreenView } from '../types/duoplay';
import { copyTextToClipboard } from '../utils/clipboard';
import { useI18n } from '../i18n/LanguageContext';
import { DuoLogo } from './DuoLogo';
import { LanguageSwitcher } from './LanguageSwitcher';

interface SessionToolbarProps {
  screen: ScreenView;
  connectionMode: ConnectionMode;
  roomCode: string;
  micMuted: boolean;
  cameraEnabled: boolean;
  hasPhysicalCamera: boolean;
  sfxMuted: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleSfx: () => void;
  onReturnToHub: () => void;
  onLeaveRoom: () => void;
}

export function SessionToolbar({
  screen,
  connectionMode,
  roomCode,
  micMuted,
  cameraEnabled,
  hasPhysicalCamera,
  sfxMuted,
  onToggleMic,
  onToggleCamera,
  onToggleSfx,
  onReturnToHub,
  onLeaveRoom,
}: SessionToolbarProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    if (!roomCode) return;
    const ok = await copyTextToClipboard(roomCode);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <header className="w-full border-b border-white/10 bg-[#121521]/95 px-3 sm:px-6 py-2.5 sm:py-3 shadow-sm shadow-black/20">
      <div className="max-w-6xl mx-auto flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 gap-y-2 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <DuoLogo size="sm" />
          <span className="hidden lg:inline text-white/20" aria-hidden="true">
            /
          </span>
          {connectionMode === 'solo' ? (
            <span className="hidden lg:inline text-xs sm:text-sm text-[#CBC4B6] truncate">
              {t.soloModeBanner}
            </span>
          ) : (
            <div className="hidden md:flex items-center gap-2 text-xs sm:text-sm text-[#CBC4B6] whitespace-nowrap">
              <span>{t.roomLabel}</span>
              <span
                dir="ltr"
                className="font-mono font-semibold text-[#E8B861] tabular-nums tracking-wider"
              >
                {roomCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[#F6F2E9] bg-white/8 hover:bg-white/14 transition-colors whitespace-nowrap shrink-0"
                aria-label={t.copyCodeBtn}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#5CC29F]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? t.copiedShort : t.copyShort}</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <LanguageSwitcher />

          {screen !== 'hub' && (
            <button
              type="button"
              onClick={onReturnToHub}
              aria-label={t.changeGame}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium bg-[#E8B861]/15 text-[#F2CB80] border border-[#E8B861]/30 hover:bg-[#E8B861]/25 transition-colors whitespace-nowrap shrink-0"
            >
              <LayoutGrid className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{t.changeGame}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleMic}
            aria-label={micMuted ? t.micMuted : t.micActive}
            aria-pressed={micMuted}
            className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium border transition-colors whitespace-nowrap shrink-0 ${
              micMuted
                ? 'bg-[#E86A58]/20 text-[#F08272] border-[#E86A58]/40 hover:bg-[#E86A58]/30'
                : 'bg-white/6 text-[#F6F2E9] border-white/10 hover:bg-white/12'
            }`}
          >
            {micMuted ? <MicOff className="w-4 h-4 shrink-0" /> : <Mic className="w-4 h-4 shrink-0" />}
            <span className="hidden xl:inline">{micMuted ? t.micMuted : t.micActive}</span>
          </button>

          {hasPhysicalCamera && (
            <button
              type="button"
              onClick={onToggleCamera}
              aria-label={t.enableCamera}
              aria-pressed={!cameraEnabled}
              className={`inline-flex items-center justify-center p-2 rounded-lg border transition-colors shrink-0 ${
                !cameraEnabled
                  ? 'bg-[#E86A58]/20 text-[#F08272] border-[#E86A58]/40'
                  : 'bg-white/6 text-[#F6F2E9] border-white/10 hover:bg-white/12'
              }`}
            >
              {cameraEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>
          )}

          <button
            type="button"
            onClick={onToggleSfx}
            aria-label="Audio SFX"
            aria-pressed={sfxMuted}
            className="inline-flex items-center justify-center p-2 rounded-lg bg-white/6 text-[#F6F2E9] border border-white/10 hover:bg-white/12 transition-colors shrink-0"
          >
            {sfxMuted ? <VolumeX className="w-4 h-4 text-[#8E887E]" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onLeaveRoom}
            aria-label={t.leave}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium bg-white/6 text-[#CBC4B6] border border-white/10 hover:bg-white/12 hover:text-[#F6F2E9] transition-colors whitespace-nowrap shrink-0"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="hidden lg:inline">{t.leave}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
