import { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
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
  onNotify?: (message: string, tone?: 'success' | 'info' | 'accent') => void;
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
  onNotify,
}: SessionToolbarProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    if (!roomCode) return;
    const ok = await copyTextToClipboard(roomCode);
    if (ok) {
      setCopied(true);
      onNotify?.(t.toastCodeCopied, 'success');
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  const isInGame = screen !== 'hub';

  return (
    <header className="sticky top-0 z-30 shrink-0 w-full border-b border-white/15 bg-[#120E24]/82 backdrop-blur-xl px-3 sm:px-6 py-2 sm:py-2.5 shadow-lg shadow-black/20">
      <div className="max-w-6xl mx-auto flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
        {/* Row 1: Always shown on Hub & Desktop; hidden on mobile during active gameplay to maximize vertical game vision */}
        <div
          className={`${
            isInGame ? 'hidden md:flex' : 'flex'
          } items-center justify-between gap-2 min-w-0`}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <DuoLogo size="sm" />

            {connectionMode === 'solo' ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-white/90 truncate">
                <span className="w-2 h-2 rounded-full bg-[#38BDF8]" />
                {t.soloModeBanner}
              </span>
            ) : (
              roomCode && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-xs text-white whitespace-nowrap shrink-0">
                  <span className="hidden sm:inline text-white/75">{t.roomLabel}</span>
                  <span
                    dir="ltr"
                    data-testid="toolbar-room-code"
                    className="font-mono font-bold text-[#FACC15] tabular-nums tracking-wider"
                  >
                    {roomCode}
                  </span>
                  <button
                    type="button"
                    data-testid="toolbar-copy-code"
                    onClick={handleCopyCode}
                    title={t.copyCodeBtn}
                    aria-label={t.copyCodeBtn}
                    className="min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-white bg-white/15 hover:bg-white/25 transition-colors whitespace-nowrap shrink-0"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-[#34D399]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copied ? t.copiedShort : t.copyShort}</span>
                  </button>
                </div>
              )
            )}
          </div>

          <div className="md:hidden shrink-0">
            <LanguageSwitcher />
          </div>
        </div>

        {/* Action Row: Single compact ergonomic bar in-game on mobile, with >= 44px touch targets */}
        <div className="flex items-center justify-between md:justify-end gap-2">
          {/* Neutral "← Changer de jeu" button — ALWAYS large & tappable on both mobile & PC */}
          {isInGame ? (
            <button
              type="button"
              data-testid="toolbar-change-game"
              onClick={onReturnToHub}
              title={t.changeGame}
              aria-label={t.changeGame}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full text-xs sm:text-sm font-bold bg-white/14 text-white border border-white/25 hover:bg-white/22 transition-all whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4 shrink-0 rtl:rotate-180" />
              <span>{t.changeGame}</span>
            </button>
          ) : connectionMode === 'solo' ? (
            <span className="sm:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-white/90 truncate max-w-[165px]">
              <span className="w-2 h-2 rounded-full bg-[#38BDF8] shrink-0" />
              <span className="truncate">{t.soloModeBanner}</span>
            </span>
          ) : null}

          <div className="flex items-center gap-1.5 sm:gap-2 ms-auto md:ms-0">
            {/* Compact Duo room code pill on mobile in-game (only when in Duo room) */}
            {isInGame && connectionMode !== 'solo' && roomCode && (
              <button
                type="button"
                onClick={handleCopyCode}
                title={t.copyCodeBtn}
                aria-label={`${t.roomLabel} ${roomCode} — ${t.copyCodeBtn}`}
                className="md:hidden min-h-[44px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-mono font-bold text-[#FACC15] tabular-nums whitespace-nowrap shrink-0"
              >
                <span dir="ltr">{roomCode}</span>
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-[#34D399]" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-white/75" />
                )}
              </button>
            )}

            <div className="hidden md:block shrink-0">
              <LanguageSwitcher />
            </div>

            <button
              type="button"
              onClick={onToggleMic}
              title={micMuted ? t.micMuted : t.micActive}
              aria-label={micMuted ? t.micMuted : t.micActive}
              aria-pressed={micMuted}
              className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-full text-xs font-semibold border transition-all whitespace-nowrap shrink-0 ${
                micMuted
                  ? 'bg-[#EF4444]/25 text-[#FECACA] border-[#EF4444]/50 hover:bg-[#EF4444]/35'
                  : 'bg-white/10 text-white border-white/20 hover:bg-white/18'
              }`}
            >
              {micMuted ? <MicOff className="w-4 h-4 shrink-0" /> : <Mic className="w-4 h-4 shrink-0" />}
              <span className="hidden xl:inline">{micMuted ? t.micMuted : t.micActive}</span>
            </button>

            {hasPhysicalCamera && (
              <button
                type="button"
                onClick={onToggleCamera}
                title={t.enableCamera}
                aria-label={t.enableCamera}
                aria-pressed={!cameraEnabled}
                className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2.5 rounded-full border transition-all shrink-0 ${
                  !cameraEnabled
                    ? 'bg-[#EF4444]/25 text-[#FECACA] border-[#EF4444]/50'
                    : 'bg-white/10 text-white border-white/20 hover:bg-white/18'
                }`}
              >
                {cameraEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </button>
            )}

            <button
              type="button"
              onClick={onToggleSfx}
              title="Audio SFX"
              aria-label="Audio SFX"
              aria-pressed={sfxMuted}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2.5 rounded-full bg-white/10 text-white border border-white/20 hover:bg-white/18 transition-all shrink-0"
            >
              {sfxMuted ? <VolumeX className="w-4 h-4 text-white/55" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              data-testid="toolbar-leave-btn"
              onClick={onLeaveRoom}
              title={t.leave}
              aria-label={t.leave}
              className={`min-h-[44px] ${
                isInGame ? 'min-w-[44px] px-2.5 sm:px-3.5' : 'px-3.5'
              } inline-flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-semibold bg-white/10 text-white/90 border border-white/20 hover:bg-[#EF4444]/25 hover:text-white hover:border-[#EF4444]/45 transition-all whitespace-nowrap shrink-0`}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className={isInGame ? 'hidden sm:inline' : 'inline'}>{t.leave}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
