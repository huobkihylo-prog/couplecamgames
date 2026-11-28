import { useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  Crown,
  Link2,
  LogOut,
  Mic,
  MicOff,
  Trophy,
} from 'lucide-react';
import type {
  FloatingQuickReaction,
  MicAccessStatus,
  ParchisiDiceCount,
  QuickReactionEmoji,
  RoomChatMessage,
  RoomRole,
} from '../types/duoplay';
import { buildRoomShareUrl, copyTextToClipboard } from '../utils/clipboard';
import { useI18n } from '../i18n/LanguageContext';
import { VoiceAvatarCard } from './VoiceAvatarCard';
import { LiveChatPanel } from './LiveChatPanel';

interface RoomMenuViewProps {
  roomCode: string;
  isHost: boolean;
  isGuest: boolean;
  isAIMode: boolean;
  localRole: RoomRole;
  hostName: string;
  guestName: string;
  guestConnected: boolean;
  diceCount: ParchisiDiceCount;
  parcheesiWins: number;
  micMuted: boolean;
  micStatus: MicAccessStatus;
  micHint: string | null;
  hostHasAudio: boolean;
  guestHasAudio: boolean;
  hostMicMuted: boolean;
  guestMicMuted: boolean;
  localSpeaking: boolean;
  remoteSpeaking: boolean;
  chatMessages: RoomChatMessage[];
  floatingReactions: FloatingQuickReaction[];
  onSetDiceCount: (count: ParchisiDiceCount) => void;
  onStartParcheesi: () => void;
  onToggleMic: () => void;
  onRequestLeaveRoom: () => void;
  onSendChatMessage: (text: string) => Promise<void>;
  onSendQuickReaction: (emoji: QuickReactionEmoji) => Promise<void>;
  onNotify?: (message: string, tone?: 'success' | 'info' | 'accent') => void;
}

export function RoomMenuView({
  roomCode,
  isHost,
  isGuest,
  isAIMode,
  localRole,
  hostName,
  guestName,
  guestConnected,
  diceCount,
  parcheesiWins,
  micMuted,
  micStatus,
  micHint,
  hostHasAudio,
  guestHasAudio,
  hostMicMuted,
  guestMicMuted,
  localSpeaking,
  remoteSpeaking,
  chatMessages,
  floatingReactions,
  onSetDiceCount,
  onStartParcheesi,
  onToggleMic,
  onRequestLeaveRoom,
  onSendChatMessage,
  onSendQuickReaction,
  onNotify,
}: RoomMenuViewProps) {
  const { t } = useI18n();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const canControlGame = isHost || isAIMode;
  const canLaunchParcheesi = canControlGame && guestConnected;

  const hostIsLocal = isHost || isAIMode;
  const guestIsLocal = isGuest;

  const effectiveHostHasAudio = hostIsLocal ? micStatus === 'granted' : hostHasAudio;
  const effectiveGuestHasAudio = guestIsLocal ? micStatus === 'granted' : guestHasAudio;
  const effectiveHostMuted = hostIsLocal ? micMuted : hostMicMuted;
  const effectiveGuestMuted = guestIsLocal ? micMuted : guestMicMuted;
  const effectiveHostSpeaking = hostIsLocal ? localSpeaking : remoteSpeaking;
  const effectiveGuestSpeaking = guestIsLocal ? localSpeaking : remoteSpeaking;

  const handleCopyCode = async () => {
    if (!roomCode || isAIMode) return;
    const ok = await copyTextToClipboard(roomCode);
    if (ok) {
      setCopiedCode(true);
      onNotify?.(t.toastCodeCopied, 'success');
      window.setTimeout(() => setCopiedCode(false), 1800);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!roomCode || isAIMode) return;
    const ok = await copyTextToClipboard(buildRoomShareUrl(roomCode));
    if (ok) {
      setCopiedLink(true);
      onNotify?.(t.toastLinkCopied, 'success');
      window.setTimeout(() => setCopiedLink(false), 1800);
    }
  };

  return (
    <main
      data-testid="room-menu-view"
      className="relative flex-1 min-h-0 w-full overflow-y-auto bg-[#FAF7F2] text-[#1F242D]"
    >
      {/* Subtle pastel radial background matching Home */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden -z-0"
        style={{
          backgroundImage:
            'radial-gradient(640px 420px at 8% 0%, rgba(255, 232, 226, 0.58), transparent 68%), radial-gradient(560px 400px at 94% 16%, rgba(239, 233, 251, 0.65), transparent 68%)',
        }}
      />

      {/* Floating Quick Reactions Layer */}
      {floatingReactions.length > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center overflow-hidden"
        >
          <div className="relative w-72 h-40">
            {floatingReactions.map((r) => (
              <div
                key={r.id}
                style={{ left: `calc(50% + ${r.offsetX}px)` }}
                className="absolute bottom-0 -translate-x-1/2 flex flex-col items-center animate-bounce"
              >
                <span className="text-3xl sm:text-4xl drop-shadow-sm">{r.emoji}</span>
                <span className="mt-0.5 px-2 py-0.5 rounded-full bg-white/95 border border-[#EAE4DC] text-[10px] font-bold text-[#1F242D] shadow-xs whitespace-nowrap">
                  {r.senderName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative z-10 max-w-6xl mx-auto px-3.5 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          {/* LEFT 7 COLUMNS: Room Code + Voice Avatars + Parcheesi Launch Card */}
          <div className="lg:col-span-7 space-y-4 sm:space-y-5">
            {/* 1. Room Header & Invite Controls */}
            <section className="bg-white border border-[#EAE4DC] rounded-3xl p-4 sm:p-5 shadow-[0_4px_20px_rgba(31,36,45,0.05)] space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#1F242D]">
                      {t.roomMenuTitle}
                    </h1>
                    <span
                      data-testid="room-menu-connection-badge"
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                        guestConnected
                          ? 'bg-[#E6F6EF] text-[#15803D]'
                          : 'bg-[#FEF6DC] text-[#B45309]'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          guestConnected ? 'bg-[#16A34A]' : 'bg-[#F59E0B] animate-pulse'
                        }`}
                      />
                      <span>
                        {guestConnected ? t.roomMenuPartnerReady : t.roomMenuWaitingGuest}
                      </span>
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#6B7280] leading-relaxed">
                    {t.roomMenuSubtitle}
                  </p>
                </div>

                {/* Quick Voice & Leave controls */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    data-testid="room-menu-mic-toggle"
                    onClick={onToggleMic}
                    className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                      micMuted
                        ? 'bg-[#FEE2E2] text-[#DC2626] border-[#FCA5A5]'
                        : 'bg-[#FAF7F2] text-[#1F242D] border-[#EAE4DC] hover:bg-white'
                    }`}
                  >
                    {micMuted ? (
                      <MicOff className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Mic className="w-3.5 h-3.5 text-[#FF6B57] shrink-0" />
                    )}
                    <span>{micMuted ? t.micMuted : t.micActive}</span>
                  </button>

                  <button
                    type="button"
                    data-testid="room-menu-leave-btn"
                    onClick={onRequestLeaveRoom}
                    className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] hover:bg-[#FEE2E2] transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">{t.leaveRoom}</span>
                  </button>
                </div>
              </div>

              {/* Room Code & Share Invite Link (Duo Mode) */}
              {!isAIMode && roomCode && (
                <div className="rounded-2xl bg-[#FAF7F2] border border-[#EAE4DC] p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                      {t.shareCodeLabel}
                    </span>
                    <span
                      dir="ltr"
                      data-testid="room-menu-code"
                      className="font-mono text-xl sm:text-2xl font-extrabold tracking-[0.2em] text-[#1F242D] tabular-nums"
                    >
                      #{roomCode}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      data-testid="room-menu-copy-code"
                      onClick={handleCopyCode}
                      className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#FFFDF9] border border-[#EAE4DC] text-xs font-bold text-[#1F242D] shadow-2xs transition-colors cursor-pointer"
                    >
                      {copiedCode ? (
                        <Check className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-[#FF6B57] shrink-0" />
                      )}
                      <span>{copiedCode ? t.codeCopiedBtn : t.copyCodeBtn}</span>
                    </button>

                    <button
                      type="button"
                      data-testid="room-menu-copy-link"
                      onClick={handleCopyInviteLink}
                      className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFE8E2] hover:bg-[#FFDAD0] border border-[#FFD1C7] text-xs font-extrabold text-[#C8412F] shadow-2xs transition-colors cursor-pointer"
                    >
                      {copiedLink ? (
                        <Check className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                      ) : (
                        <Link2 className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>{copiedLink ? t.linkCopiedBtn : t.copyLinkBtn}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Voice Avatar Cards (Host + Guest/AI) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <VoiceAvatarCard
                  testId="voice-card-host"
                  name={hostName || 'Hôte'}
                  roleLabel={t.hostTag}
                  isLocal={hostIsLocal}
                  hasAudio={effectiveHostHasAudio}
                  isMuted={effectiveHostMuted}
                  isSpeaking={effectiveHostSpeaking}
                  accent="coral"
                />

                <VoiceAvatarCard
                  testId="voice-card-guest"
                  name={guestName || t.guestTag}
                  roleLabel={isAIMode ? t.aiTag : t.guestTag}
                  isLocal={guestIsLocal}
                  isAi={isAIMode}
                  isWaiting={!guestConnected}
                  hasAudio={effectiveGuestHasAudio}
                  isMuted={effectiveGuestMuted}
                  isSpeaking={effectiveGuestSpeaking}
                  accent={isAIMode ? 'lavender' : 'gold'}
                />
              </div>

              {micHint && (
                <p className="text-xs font-medium text-[#6B7280] bg-[#FAF7F2] border border-[#EAE4DC] rounded-xl px-3 py-2">
                  {micHint}
                </p>
              )}
            </section>

            {/* 2. Featured Single Game Card: Parcheesi (Host-Controlled Start) */}
            <section
              data-testid="room-menu-parcheesi-card"
              className="bg-white border border-[#EAE4DC] rounded-3xl p-5 sm:p-6 shadow-[0_6px_26px_rgba(31,36,45,0.06)] space-y-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0">
                  {/* Classic 4-Color Parcheesi Emblem */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#FEF6DC] via-[#FFFDF9] to-[#FFE8E2] border border-[#F3E3BE] p-2 grid grid-cols-2 gap-1.5 shrink-0 shadow-xs">
                    <span className="rounded-md bg-[#1E88E5]" />
                    <span className="rounded-md bg-[#FBC02D]" />
                    <span className="rounded-md bg-[#E53935]" />
                    <span className="rounded-md bg-[#2E9E5B]" />
                  </div>

                  <div className="min-w-0 space-y-1">
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-[#D97706]">
                      <Crown className="w-3.5 h-3.5 shrink-0" />
                      <span>{t.roomMenuParcheesiBadge}</span>
                    </span>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-[#1F242D] leading-tight">
                      {t.roomMenuParcheesiTitle}
                    </h2>
                    <p className="text-xs sm:text-sm text-[#6B7280] leading-relaxed">
                      {t.roomMenuParcheesiDesc}
                    </p>
                  </div>
                </div>

                {parcheesiWins > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FEF6DC] border border-[#F3E3BE] text-xs font-extrabold text-[#B45309] shrink-0 tabular-nums">
                    <Trophy className="w-3.5 h-3.5 shrink-0" />
                    <span>{parcheesiWins}</span>
                  </span>
                )}
              </div>

              {/* 🎲 1 Dé / 🎲🎲 2 Dés Pill Selector (Host-controlled, synced live to Guest) */}
              <div className="rounded-2xl bg-[#FAF7F2] border border-[#EAE4DC] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#6B7280]">
                    {t.roomMenuDiceLabel}
                  </span>
                  {!canControlGame && (
                    <span className="text-[11px] font-bold text-[#7C5CFC]">
                      {t.roomMenuDiceHostHint}
                    </span>
                  )}
                </div>

                <div
                  role="group"
                  aria-label={t.roomMenuDiceLabel}
                  className="grid grid-cols-2 gap-2 p-1 rounded-full bg-white border border-[#EAE4DC]"
                >
                  <button
                    type="button"
                    data-testid="room-menu-dice-1"
                    aria-pressed={diceCount === 1}
                    disabled={!canControlGame}
                    onClick={() => onSetDiceCount(1)}
                    className={`min-h-[44px] px-3 py-2 rounded-full text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap ${
                      diceCount === 1
                        ? 'bg-[#FF6B57] text-white shadow-[0_4px_12px_rgba(255,107,87,0.32)]'
                        : 'text-[#6B7280] hover:text-[#1F242D]'
                    } ${canControlGame ? 'cursor-pointer' : 'cursor-default opacity-90'}`}
                  >
                    {t.roomMenuDice1}
                  </button>
                  <button
                    type="button"
                    data-testid="room-menu-dice-2"
                    aria-pressed={diceCount === 2}
                    disabled={!canControlGame}
                    onClick={() => onSetDiceCount(2)}
                    className={`min-h-[44px] px-3 py-2 rounded-full text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap ${
                      diceCount === 2
                        ? 'bg-[#FF6B57] text-white shadow-[0_4px_12px_rgba(255,107,87,0.32)]'
                        : 'text-[#6B7280] hover:text-[#1F242D]'
                    } ${canControlGame ? 'cursor-pointer' : 'cursor-default opacity-90'}`}
                  >
                    {t.roomMenuDice2}
                  </button>
                </div>
              </div>

              {/* Host Play CTA vs Guest Non-Clickable Waiting Banner */}
              {canControlGame ? (
                <button
                  type="button"
                  data-start="true"
                  data-testid="room-menu-play-parcheesi"
                  disabled={!canLaunchParcheesi}
                  onClick={onStartParcheesi}
                  className={`w-full min-h-[54px] inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl text-base font-extrabold transition-all whitespace-nowrap ${
                    canLaunchParcheesi
                      ? 'btn-shine bg-[#FF6B57] hover:bg-[#F25743] text-white shadow-[0_8px_24px_-4px_rgba(255,107,87,0.42)] hover:-translate-y-0.5 cursor-pointer'
                      : 'bg-[#EAE4DC] text-[#6B7280] cursor-not-allowed'
                  }`}
                >
                  {canLaunchParcheesi ? (
                    <span>{t.roomMenuPlayBtn}</span>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>{t.roomMenuPlayWaitingBtn}</span>
                    </>
                  )}
                </button>
              ) : (
                <div
                  role="status"
                  data-testid="room-menu-guest-waiting"
                  className="w-full min-h-[54px] px-4 py-3.5 rounded-2xl bg-[#EFE9FB] border border-[#DDD4F7] text-[#5B21B6] flex items-center justify-center gap-2 text-center text-sm font-extrabold"
                >
                  <span>{t.roomMenuGuestWaitingBadge}</span>
                </div>
              )}
            </section>
          </div>

          {/* RIGHT 5 COLUMNS: Persistent Live Chat + Quick Reactions (❤️ 😂 🔥) */}
          <div className="lg:col-span-5">
            <LiveChatPanel
              messages={chatMessages}
              localRole={localRole}
              onSendMessage={onSendChatMessage}
              onSendReaction={onSendQuickReaction}
              variant="inline"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
