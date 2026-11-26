import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  FlipHorizontal2,
  LogOut,
  Mic,
  MicOff,
  Settings,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { ConnectionMode, ScreenView } from '../types/duoplay';
import { copyTextToClipboard } from '../utils/clipboard';
import { useI18n } from '../i18n/LanguageContext';
import { useMirror } from '../context/MirrorContext';
import { CoupleCamLogo } from './CoupleCamLogo';
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
  const { isMirrored, toggleMirrored } = useMirror();
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [settingsOpen]);

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
    <header className="sticky top-0 z-30 shrink-0 w-full border-b border-[#EAE4DC] bg-[#FAF7F2]/92 backdrop-blur-xl px-2.5 sm:px-6 py-2 shadow-[0_2px_14px_rgba(31,36,45,0.04)]">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2">
        {/* Left: Brand Logo or In-Game Back Button + Status Pill */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          {isInGame ? (
            <button
              type="button"
              data-testid="toolbar-change-game"
              onClick={onReturnToHub}
              title={t.changeGame}
              aria-label={t.changeGame}
              className="min-h-[38px] sm:min-h-[40px] inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold bg-white text-[#1F242D] border border-[#EAE4DC] hover:bg-[#FFFDF9] hover:border-[#FF6B57]/40 shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-[#FF6B57] shrink-0 rtl:rotate-180" />
              <span>{t.changeGame}</span>
            </button>
          ) : (
            <CoupleCamLogo size="sm" />
          )}

          {/* Status Pill: "● En direct • #XXXX" or "🤖 Mode IA" */}
          {connectionMode === 'solo' ? (
            <span
              data-testid="toolbar-status-pill"
              className={`${
                isInGame ? 'hidden sm:inline-flex' : 'inline-flex'
              } items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-white border border-[#EAE4DC] text-[11px] sm:text-xs font-bold text-[#1F242D] shadow-xs whitespace-nowrap shrink-0`}
            >
              <span aria-hidden="true">🤖</span>
              <span className="sm:hidden">IA</span>
              <span className="hidden sm:inline">Mode IA</span>
            </span>
          ) : (
            roomCode && (
              <button
                type="button"
                data-testid="toolbar-copy-code"
                onClick={handleCopyCode}
                title={t.copyCodeBtn}
                aria-label={`${t.roomLabel} #${roomCode} — ${t.copyCodeBtn}`}
                className="min-h-[34px] sm:min-h-[36px] inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded-full bg-white border border-[#EAE4DC] hover:border-[#FF6B57]/45 text-[11px] sm:text-xs font-bold text-[#1F242D] shadow-xs transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-[#16A34A] shrink-0" />
                <span className="hidden sm:inline text-[#6B7280] font-semibold">En direct •</span>
                <span
                  dir="ltr"
                  data-testid="toolbar-room-code"
                  className="font-mono font-extrabold text-[#1F242D] tabular-nums tracking-wider"
                >
                  #{roomCode}
                </span>
                {copied ? (
                  <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#16A34A] shrink-0" />
                ) : (
                  <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#6B7280] shrink-0" />
                )}
              </button>
            )
          )}
        </div>

        {/* Right: Round white buttons (Miroir, Micro, Caméra, Paramètres) */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Mirror Toggle */}
          <button
            type="button"
            data-testid="toolbar-mirror-btn"
            onClick={toggleMirrored}
            title={isMirrored ? 'Miroir activé' : 'Miroir désactivé'}
            aria-label={isMirrored ? 'Miroir activé' : 'Miroir désactivé'}
            aria-pressed={isMirrored}
            className={`w-9 h-9 sm:w-10 sm:h-10 inline-flex items-center justify-center rounded-full border transition-all shrink-0 shadow-xs cursor-pointer ${
              isMirrored
                ? 'bg-white text-[#7C5CFC] border-[#7C5CFC]/35 hover:bg-[#EFE9FB]/40'
                : 'bg-white text-[#6B7280] border-[#EAE4DC] hover:text-[#1F242D]'
            }`}
          >
            <FlipHorizontal2 className="w-4 h-4 shrink-0" />
          </button>

          {/* Mic Toggle */}
          <button
            type="button"
            data-testid="toolbar-mic-btn"
            onClick={onToggleMic}
            title={micMuted ? t.micMuted : t.micActive}
            aria-label={micMuted ? t.micMuted : t.micActive}
            aria-pressed={micMuted}
            className={`w-9 h-9 sm:w-10 sm:h-10 inline-flex items-center justify-center rounded-full border transition-all shrink-0 shadow-xs cursor-pointer ${
              micMuted
                ? 'bg-[#FEE2E2] text-[#DC2626] border-[#FCA5A5]'
                : 'bg-white text-[#1F242D] border-[#EAE4DC] hover:bg-[#FFFDF9]'
            }`}
          >
            {micMuted ? <MicOff className="w-4 h-4 shrink-0" /> : <Mic className="w-4 h-4 shrink-0" />}
          </button>

          {/* Camera Toggle */}
          <button
            type="button"
            data-testid="toolbar-camera-btn"
            onClick={onToggleCamera}
            disabled={!hasPhysicalCamera}
            title={t.enableCamera}
            aria-label={t.enableCamera}
            aria-pressed={!cameraEnabled}
            className={`w-9 h-9 sm:w-10 sm:h-10 inline-flex items-center justify-center rounded-full border transition-all shrink-0 shadow-xs disabled:opacity-45 cursor-pointer ${
              !cameraEnabled
                ? 'bg-[#FEE2E2] text-[#DC2626] border-[#FCA5A5]'
                : 'bg-white text-[#1F242D] border-[#EAE4DC] hover:bg-[#FFFDF9]'
            }`}
          >
            {cameraEnabled ? <Video className="w-4 h-4 shrink-0" /> : <VideoOff className="w-4 h-4 shrink-0" />}
          </button>

          {/* Settings Popover (Language + Sound SFX + Leave) */}
          <div ref={settingsRef} className="relative">
            <button
              type="button"
              data-testid="toolbar-settings-btn"
              onClick={() => setSettingsOpen((prev) => !prev)}
              title="Paramètres"
              aria-label="Paramètres"
              aria-expanded={settingsOpen}
              className={`w-9 h-9 sm:w-10 sm:h-10 inline-flex items-center justify-center rounded-full border transition-all shrink-0 shadow-xs cursor-pointer ${
                settingsOpen
                  ? 'bg-[#FF6B57] text-white border-[#FF6B57]'
                  : 'bg-white text-[#1F242D] border-[#EAE4DC] hover:bg-[#FFFDF9]'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
            </button>

            {settingsOpen && (
              <div
                data-testid="toolbar-settings-menu"
                className="absolute end-0 mt-2 w-64 rounded-2xl bg-white border border-[#EAE4DC] shadow-[0_12px_36px_rgba(31,36,45,0.14)] p-3 space-y-3 z-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#6B7280]">Langue</span>
                  <LanguageSwitcher />
                </div>

                <button
                  type="button"
                  onClick={onToggleSfx}
                  className="w-full min-h-[42px] flex items-center justify-between px-3 py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#F3EEE6] border border-[#EAE4DC] text-xs font-bold text-[#1F242D] transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    {sfxMuted ? (
                      <VolumeX className="w-4 h-4 text-[#6B7280]" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-[#FF6B57]" />
                    )}
                    <span>Effets sonores</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      sfxMuted ? 'bg-[#EAE4DC] text-[#6B7280]' : 'bg-[#E6F6EF] text-[#15803D]'
                    }`}
                  >
                    {sfxMuted ? 'OFF' : 'ON'}
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="toolbar-leave-btn"
                  onClick={() => {
                    setSettingsOpen(false);
                    onLeaveRoom();
                  }}
                  className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] hover:bg-[#FEE2E2] transition-colors"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>{t.leave}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
