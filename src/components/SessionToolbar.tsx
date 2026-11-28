import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  LogOut,
  MessageCircle,
  Mic,
  MicOff,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { ConnectionMode, ScreenView } from '../types/duoplay';
import { copyTextToClipboard } from '../utils/clipboard';
import { useI18n } from '../i18n/LanguageContext';
import { CoupleCamLogo } from './CoupleCamLogo';
import { LanguageSwitcher } from './LanguageSwitcher';

interface SessionToolbarProps {
  screen: ScreenView;
  connectionMode: ConnectionMode;
  roomCode: string;
  isHostOrAi: boolean;
  micMuted: boolean;
  sfxMuted: boolean;
  chatOpen: boolean;
  unreadChatCount: number;
  onToggleMic: () => void;
  onToggleSfx: () => void;
  onToggleChat: () => void;
  onReturnToRoomMenu: () => void;
  onRequestLeaveRoom: () => void;
  onNotify?: (message: string, tone?: 'success' | 'info' | 'accent') => void;
}

export function SessionToolbar({
  screen,
  connectionMode,
  roomCode,
  isHostOrAi,
  micMuted,
  sfxMuted,
  chatOpen,
  unreadChatCount,
  onToggleMic,
  onToggleSfx,
  onToggleChat,
  onReturnToRoomMenu,
  onRequestLeaveRoom,
  onNotify,
}: SessionToolbarProps) {
  const { t } = useI18n();
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

  const isInParcheesi = screen === 'parcheesi';

  return (
    <header className="sticky top-0 z-30 shrink-0 w-full border-b border-[#EAE4DC] bg-[#FAF7F2]/92 backdrop-blur-xl px-2.5 sm:px-6 py-2 shadow-[0_2px_14px_rgba(31,36,45,0.04)]">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2">
        {/* Left: Brand Logo (or Host Back-to-Room-Menu button inside Parcheesi) + Room Code Pill */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          {isInParcheesi && isHostOrAi ? (
            <button
              type="button"
              data-testid="toolbar-back-room-menu"
              onClick={onReturnToRoomMenu}
              title={t.backToRoomMenu}
              aria-label={t.backToRoomMenu}
              className="min-h-[38px] sm:min-h-[40px] inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold bg-white text-[#1F242D] border border-[#EAE4DC] hover:bg-[#FFFDF9] hover:border-[#FF6B57]/40 shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-[#FF6B57] shrink-0 rtl:rotate-180" />
              <span>{t.backToRoomMenu}</span>
            </button>
          ) : (
            <CoupleCamLogo size="sm" />
          )}

          {/* Status Pill: "● Salon • #XXXX" or "🤖 Mode IA" */}
          {connectionMode === 'solo' ? (
            <span
              data-testid="toolbar-status-pill"
              className={`${
                isInParcheesi ? 'hidden sm:inline-flex' : 'inline-flex'
              } items-center gap-1 sm:gap-1.5 px-2.5 py-1 rounded-full bg-white border border-[#EAE4DC] text-[11px] sm:text-xs font-bold text-[#1F242D] shadow-sm whitespace-nowrap shrink-0`}
            >
              <span aria-hidden="true">🤖</span>
              <span className="sm:hidden">{t.toolbarAiShort}</span>
              <span className="hidden sm:inline">{t.toolbarAiMode}</span>
            </span>
          ) : (
            roomCode && (
              <button
                type="button"
                data-testid="toolbar-copy-code"
                onClick={handleCopyCode}
                title={t.copyCodeBtn}
                aria-label={`${t.roomLabel} #${roomCode} — ${t.copyCodeBtn}`}
                className="min-h-[34px] inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-white border border-[#EAE4DC] hover:border-[#FF6B57]/45 text-[11px] sm:text-xs font-bold text-[#1F242D] shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-[#16A34A] shrink-0" />
                <span className="hidden sm:inline text-[#6B7280] font-semibold">
                  {t.toolbarLivePrefix}
                </span>
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

        {/* Right: Mic Toggle + Live Chat Drawer Toggle (in Parcheesi) + Settings Popover (ZERO Camera / Mirror) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Mic Toggle */}
          <button
            type="button"
            data-testid="toolbar-mic-btn"
            onClick={onToggleMic}
            title={micMuted ? t.micMuted : t.micActive}
            aria-label={micMuted ? t.micMuted : t.micActive}
            aria-pressed={micMuted}
            className={`w-9 h-9 inline-flex items-center justify-center rounded-full border transition-all shrink-0 shadow-sm cursor-pointer ${
              micMuted
                ? 'bg-[#FEE2E2] text-[#DC2626] border-[#FCA5A5]'
                : 'bg-white text-[#1F242D] border-[#EAE4DC] hover:bg-[#FFFDF9]'
            }`}
          >
            {micMuted ? <MicOff className="w-4 h-4 shrink-0" /> : <Mic className="w-4 h-4 shrink-0" />}
          </button>

          {/* Slide-over Live Chat Toggle during Parcheesi */}
          {isInParcheesi && (
            <button
              type="button"
              data-testid="toolbar-chat-btn"
              onClick={onToggleChat}
              title={t.chatTitle}
              aria-label={t.chatTitle}
              aria-pressed={chatOpen}
              className={`relative w-9 h-9 inline-flex items-center justify-center rounded-full border transition-all shrink-0 shadow-sm cursor-pointer ${
                chatOpen
                  ? 'bg-[#FF6B57] text-white border-[#FF6B57]'
                  : 'bg-white text-[#1F242D] border-[#EAE4DC] hover:bg-[#FFFDF9]'
              }`}
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              {unreadChatCount > 0 && !chatOpen && (
                <span
                  data-testid="toolbar-chat-unread"
                  className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF6B57] text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-[#FAF7F2] tabular-nums"
                >
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </span>
              )}
            </button>
          )}

          {/* Settings Popover (Language + Sound SFX + Leave Room with confirmation modal) */}
          <div ref={settingsRef} className="relative">
            <button
              type="button"
              data-testid="toolbar-settings-btn"
              onClick={() => setSettingsOpen((prev) => !prev)}
              title={t.toolbarSettingsLabel}
              aria-label={t.toolbarSettingsLabel}
              aria-expanded={settingsOpen}
              className={`w-9 h-9 inline-flex items-center justify-center rounded-full border transition-all shrink-0 shadow-sm cursor-pointer ${
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
                  <span className="text-xs font-bold text-[#6B7280]">{t.toolbarLanguageLabel}</span>
                  <LanguageSwitcher />
                </div>

                <button
                  type="button"
                  onClick={onToggleSfx}
                  className="w-full min-h-[42px] flex items-center justify-between px-3 py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#F3EEE6] border border-[#EAE4DC] text-xs font-bold text-[#1F242D] transition-colors cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    {sfxMuted ? (
                      <VolumeX className="w-4 h-4 text-[#6B7280]" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-[#FF6B57]" />
                    )}
                    <span>{t.toolbarSfxLabel}</span>
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
                    onRequestLeaveRoom();
                  }}
                  className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] hover:bg-[#FEE2E2] transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>{t.leaveRoom}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
