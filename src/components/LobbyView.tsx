import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Crown,
  Loader2,
  MessageCircle,
  Mic,
  MicOff,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { ConnectionStatus, MicAccessStatus } from '../types/duoplay';
import { normalizeRoomCode } from '../utils/roomCode';
import { useI18n } from '../i18n/LanguageContext';
import { CoupleCamLogo } from './CoupleCamLogo';
import { LanguageSwitcher } from './LanguageSwitcher';

interface LobbyViewProps {
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  initialJoinCode?: string;
  connectionStatus: ConnectionStatus;
  statusMessage: string;
  micMuted: boolean;
  micStatus: MicAccessStatus;
  micHint: string | null;
  sfxMuted: boolean;
  onToggleMic: () => void;
  onToggleSfx: () => void;
  onCreateRoom: () => void;
  onCancelRoom: () => void;
  onJoinRoom: (code: string) => void;
  onStartSoloMode: () => void;
}

export function LobbyView({
  playerName,
  onPlayerNameChange,
  initialJoinCode = '',
  connectionStatus,
  statusMessage,
  micMuted,
  micStatus,
  micHint,
  sfxMuted,
  onToggleMic,
  onToggleSfx,
  onCreateRoom,
  onCancelRoom,
  onJoinRoom,
  onStartSoloMode,
}: LobbyViewProps) {
  const { t } = useI18n();
  const [joinCodeInput, setJoinCodeInput] = useState(() => normalizeRoomCode(initialJoinCode));
  const [formError, setFormError] = useState<string | null>(null);

  const isCreating = connectionStatus === 'creating';
  const isJoining = connectionStatus === 'connecting';
  const isBusy = isCreating || isJoining;

  useEffect(() => {
    const clean = normalizeRoomCode(initialJoinCode);
    if (clean.length === 4) {
      setJoinCodeInput(clean);
    }
  }, [initialJoinCode]);

  const handleCreateSubmit = () => {
    const trimmed = playerName.trim();
    if (!trimmed) {
      setFormError(t.errEnterNameCreate);
      return;
    }
    setFormError(null);
    onCreateRoom();
  };

  const handleJoinSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = playerName.trim();
    if (!trimmed) {
      setFormError(t.errEnterNameJoin);
      return;
    }
    const cleanCode = normalizeRoomCode(joinCodeInput);
    if (cleanCode.length !== 4) {
      setFormError(t.errInvalidCode);
      return;
    }
    setFormError(null);
    onJoinRoom(cleanCode);
  };

  const initials = (playerName.trim().slice(0, 2) || 'AL').toUpperCase();

  return (
    <main className="relative min-h-[100dvh] w-full overflow-x-hidden flex flex-col bg-[#FAF7F2] text-[#1F242D]">
      {/* Subtle warm cream pastel ambiance */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{
          backgroundImage:
            'radial-gradient(640px 420px at 8% 0%, rgba(255, 232, 226, 0.72), transparent 68%), radial-gradient(560px 400px at 94% 12%, rgba(239, 233, 251, 0.78), transparent 68%), radial-gradient(620px 380px at 50% 100%, rgba(230, 246, 239, 0.55), transparent 68%)',
        }}
      />

      {/* 1. Clean Warm Header (Zero camera / mirror buttons) */}
      <header className="relative z-20 w-full border-b border-[#EAE4DC] bg-[#FAF7F2]/90 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-3.5 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5">
          <CoupleCamLogo size="sm" />

          <div className="flex items-center gap-1.5 sm:gap-2">
            <LanguageSwitcher />

            <button
              type="button"
              data-testid="lobby-mic-btn"
              onClick={onToggleMic}
              title={micMuted ? t.micMuted : t.micActive}
              aria-label={micMuted ? t.micMuted : t.micActive}
              aria-pressed={micMuted}
              className={`w-10 h-10 inline-flex items-center justify-center rounded-full border transition-all shadow-xs cursor-pointer ${
                micMuted
                  ? 'bg-[#FEE2E2] text-[#DC2626] border-[#FCA5A5]'
                  : 'bg-white text-[#1F242D] border-[#EAE4DC] hover:bg-[#FFFDF9]'
              }`}
            >
              {micMuted ? <MicOff className="w-4 h-4 shrink-0" /> : <Mic className="w-4 h-4 shrink-0" />}
            </button>

            <button
              type="button"
              data-testid="lobby-sfx-btn"
              onClick={onToggleSfx}
              title={t.toolbarSfxLabel}
              aria-label={t.toolbarSfxLabel}
              aria-pressed={sfxMuted}
              className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-white text-[#1F242D] border border-[#EAE4DC] hover:bg-[#FFFDF9] transition-all shadow-xs cursor-pointer"
            >
              {sfxMuted ? <VolumeX className="w-4 h-4 text-[#6B7280]" /> : <Volume2 className="w-4 h-4 text-[#FF6B57]" />}
            </button>
          </div>
        </div>
      </header>

      {/* 2. Balanced Two-Column Home Hero */}
      <div className="relative z-10 flex-1 w-full max-w-5xl mx-auto px-3.5 sm:px-6 py-6 sm:py-10 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
          {/* LEFT COLUMN: Pastel Parcheesi & Voice Profile Card */}
          <section className="lg:col-span-5 order-2 lg:order-1">
            <div className="bg-white border border-[#EAE4DC] shadow-[0_4px_20px_rgba(31,36,45,0.06)] rounded-3xl p-5 sm:p-6 space-y-5">
              {/* Warm Pastel Parcheesi Showcase Banner */}
              <div className="rounded-2xl bg-gradient-to-br from-[#FFE8E2] via-[#FFF8EC] to-[#EFE9FB] border border-[#EAE4DC] p-5 flex flex-col items-center text-center gap-3">
                {/* Four Classic Parcheesi Color Tokens + Voice Avatar */}
                <div className="relative flex items-center justify-center">
                  <div className="w-18 h-18 rounded-full bg-white border-2 border-[#FF6B57]/50 shadow-[0_8px_24px_rgba(255,107,87,0.18)] flex items-center justify-center text-2xl font-extrabold text-[#FF6B57]">
                    {initials}
                  </div>
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -end-1 w-7 h-7 rounded-full bg-[#FEF6DC] border-2 border-white text-[#D97706] flex items-center justify-center shadow-xs"
                  >
                    <Crown className="w-3.5 h-3.5" />
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-base font-extrabold text-[#1F242D]">
                    {playerName.trim() || 'Alex'}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-[#6B7280]">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 border border-[#EAE4DC] text-[#1F242D]">
                      <Mic className="w-3.5 h-3.5 text-[#FF6B57]" />
                      <span>{micMuted ? t.micMuted : micStatus === 'denied' ? t.voiceNoMic : t.micActive}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 border border-[#EAE4DC] text-[#1F242D]">
                      <MessageCircle className="w-3.5 h-3.5 text-[#7C5CFC]" />
                      <span>{t.chatTitle}</span>
                    </span>
                  </div>
                </div>

                {/* Mini 4-color classic Parcheesi pawn accent row */}
                <div className="flex items-center gap-2 pt-1" aria-hidden="true">
                  <span className="w-4 h-4 rounded-full bg-[#E53935] border-2 border-white shadow-xs" />
                  <span className="w-4 h-4 rounded-full bg-[#FBC02D] border-2 border-white shadow-xs" />
                  <span className="w-4 h-4 rounded-full bg-[#2E9E5B] border-2 border-white shadow-xs" />
                  <span className="w-4 h-4 rounded-full bg-[#1E88E5] border-2 border-white shadow-xs" />
                </div>
              </div>

              {/* Prominent Nickname Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="couplecam-player-name"
                  className="block text-sm font-bold text-[#1F242D]"
                >
                  {t.yourNameLabel}
                </label>
                <input
                  id="couplecam-player-name"
                  type="text"
                  maxLength={24}
                  value={playerName}
                  onChange={(e) => {
                    onPlayerNameChange(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder={t.yourNamePlaceholder}
                  className="w-full min-h-[52px] px-4 py-3 rounded-2xl bg-[#FAF7F2] border border-[#EAE4DC] text-[#1F242D] placeholder-[#6B7280] text-base font-semibold focus:bg-white focus:border-[#FF6B57] focus:ring-2 focus:ring-[#FF6B57]/20 focus:outline-none transition-all"
                />
              </div>

              {micHint && (
                <p className="text-xs text-[#6B7280] leading-relaxed">{micHint}</p>
              )}
            </div>
          </section>

          {/* RIGHT COLUMN: Clean Warm Action Panel */}
          <section className="lg:col-span-7 order-1 lg:order-2 space-y-5">
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-5xl font-extrabold leading-[1.08] tracking-tight text-[#1F242D]">
                {t.lobbyHeadline}
              </h1>
              <p className="text-sm sm:text-base text-[#6B7280] leading-relaxed">
                {t.lobbySubtitlePrefix}
                <strong className="text-[#1F242D] font-bold">{t.lobbySubtitleStrong}</strong>
                {t.lobbySubtitleSuffix}
              </p>
            </div>

            <div className="bg-white border border-[#EAE4DC] shadow-[0_4px_20px_rgba(31,36,45,0.06)] rounded-3xl p-4 sm:p-6 space-y-4">
              {/* 1. Primary CTA: "Créer un salon" -> Enters Room Menu directly */}
              <button
                type="button"
                data-testid="lobby-create-btn"
                disabled={isBusy}
                onClick={handleCreateSubmit}
                className="btn-shine w-full min-h-[56px] inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl text-base sm:text-lg font-extrabold bg-[#FF6B57] hover:bg-[#F25743] disabled:opacity-65 text-white shadow-[0_8px_22px_-4px_rgba(255,107,87,0.4)] transition-all hover:-translate-y-0.5 whitespace-nowrap cursor-pointer"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                    <span>{t.creatingBtn}</span>
                  </>
                ) : (
                  <>
                    <Users className="w-5 h-5 shrink-0" />
                    <span>{t.createBtn}</span>
                    <ArrowRight className="w-5 h-5 shrink-0 rtl:rotate-180" />
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3" aria-hidden="true">
                <div className="h-px flex-1 bg-[#EAE4DC]" />
                <span className="text-xs font-extrabold uppercase tracking-widest text-[#6B7280]">
                  {t.orDivider}
                </span>
                <div className="h-px flex-1 bg-[#EAE4DC]" />
              </div>

              {/* 2. "Rejoindre un salon" */}
              <form
                onSubmit={handleJoinSubmit}
                className="rounded-2xl bg-[#FAF7F2] border border-[#EAE4DC] p-3.5 sm:p-4 space-y-2.5"
              >
                <label
                  htmlFor="couplecam-join-code"
                  className="block text-xs sm:text-sm font-bold text-[#1F242D]"
                >
                  {t.tabJoin}{' '}
                  <span className="hidden sm:inline font-medium text-[#6B7280]">— {t.joinCodeLabel}</span>
                </label>
                <div className="flex items-stretch gap-2.5">
                  <input
                    id="couplecam-join-code"
                    type="text"
                    dir="ltr"
                    inputMode="text"
                    autoCapitalize="characters"
                    spellCheck={false}
                    autoComplete="off"
                    maxLength={120}
                    disabled={isBusy}
                    value={joinCodeInput}
                    onChange={(e) => {
                      setJoinCodeInput(normalizeRoomCode(e.target.value));
                      if (formError) setFormError(null);
                    }}
                    placeholder="A7K4"
                    className="flex-1 min-w-0 min-h-[54px] px-3.5 py-3 rounded-2xl bg-white border border-[#EAE4DC] font-mono text-2xl font-bold tracking-[0.24em] text-center text-[#1F242D] placeholder-[#9CA3AF] uppercase tabular-nums focus:border-[#FF6B57] focus:ring-2 focus:ring-[#FF6B57]/20 focus:outline-none disabled:opacity-60 transition-all"
                  />
                  <button
                    type="submit"
                    data-testid="lobby-join-btn"
                    disabled={isBusy}
                    className="min-h-[54px] px-5 sm:px-6 rounded-2xl text-sm sm:text-base font-extrabold bg-[#1F242D] text-white hover:bg-[#313846] disabled:opacity-60 inline-flex items-center justify-center gap-1.5 shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isJoining ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        <span>{t.joiningBtn}</span>
                      </>
                    ) : (
                      <>
                        <span>{t.joinBtn}</span>
                        <ArrowRight className="w-4 h-4 shrink-0 rtl:rotate-180" />
                      </>
                    )}
                  </button>
                </div>

                {isJoining && (
                  <div className="flex items-center justify-between gap-2 pt-1 text-xs text-[#6B7280]">
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF6B57] shrink-0" />
                      <span className="truncate font-semibold text-[#1F242D]">
                        {statusMessage || t.joiningBtn}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={onCancelRoom}
                      className="text-xs font-bold text-[#6B7280] hover:text-[#1F242D] underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {t.cancelBtn}
                    </button>
                  </div>
                )}
              </form>

              {/* Validation or Connection Error */}
              {(formError ||
                connectionStatus === 'error' ||
                (connectionStatus === 'disconnected' && Boolean(statusMessage))) && (
                <div
                  role="alert"
                  className="rounded-xl bg-[#FEF2F2] border border-[#FECACA] px-3.5 py-3 text-xs sm:text-sm font-medium text-[#B91C1C] space-y-2.5"
                >
                  <p>{formError || statusMessage}</p>
                  {!formError && connectionStatus === 'error' && (
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        data-testid="lobby-retry-btn"
                        onClick={() => {
                          const targetCode = normalizeRoomCode(joinCodeInput);
                          if (targetCode.length === 4) {
                            onJoinRoom(targetCode);
                          } else {
                            onCreateRoom();
                          }
                        }}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-extrabold bg-[#FF6B57] text-white hover:bg-[#F25743] transition-all whitespace-nowrap cursor-pointer"
                      >
                        🔄 Réessayer
                      </button>
                      <button
                        type="button"
                        data-testid="lobby-back-btn"
                        onClick={() => {
                          setFormError(null);
                          onCancelRoom();
                        }}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-[#1F242D] border border-[#EAE4DC] hover:bg-[#FAF7F2] transition-all whitespace-nowrap cursor-pointer"
                      >
                        ← Retour
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Mode "🤖 Jouer avec IA" preserved 100% */}
              <div className="pt-1">
                <button
                  type="button"
                  data-start="true"
                  data-testid="lobby-solo-btn"
                  disabled={isBusy}
                  onClick={() => {
                    setFormError(null);
                    onStartSoloMode();
                  }}
                  className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm sm:text-base font-bold bg-[#EFE9FB] hover:bg-[#E5DCFA] text-[#1F242D] border border-[#DDD4F7] transition-all whitespace-nowrap cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#7C5CFC] shrink-0" />
                  <span>🤖 {t.soloCta}</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
