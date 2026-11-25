import { useEffect, useRef, useState, type FormEvent, type MutableRefObject } from 'react';
import {
  ArrowRight,
  Camera,
  Check,
  Copy,
  Link2,
  Loader2,
  Mic,
  MicOff,
  Sparkles,
  Users,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { ConnectionStatus, FaceMetrics } from '../types/duoplay';
import { normalizeRoomCode } from '../services/peerService';
import { buildRoomShareUrl, copyTextToClipboard } from '../utils/clipboard';
import { CATEGORY_THEMES } from '../theme/categoryThemes';
import { useI18n } from '../i18n/LanguageContext';
import { DuoLogo } from './DuoLogo';
import { LanguageSwitcher } from './LanguageSwitcher';
import { AvatarCanvas } from './AvatarCanvas';

interface LobbyViewProps {
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  roomCode: string;
  initialJoinCode?: string;
  connectionStatus: ConnectionStatus;
  statusMessage: string;
  cameraHint: string | null;
  localStream: MediaStream | null;
  cameraEnabled: boolean;
  micMuted: boolean;
  sfxMuted: boolean;
  localMetricsRef: MutableRefObject<FaceMetrics>;
  onRequestCamera: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleSfx: () => void;
  onCreateRoom: () => void;
  onCancelRoom: () => void;
  onJoinRoom: (code: string) => void;
  onStartSoloMode: () => void;
  onNotify: (message: string, tone?: 'success' | 'info' | 'accent') => void;
}

export function LobbyView({
  playerName,
  onPlayerNameChange,
  roomCode,
  initialJoinCode = '',
  connectionStatus,
  statusMessage,
  cameraHint,
  localStream,
  cameraEnabled,
  micMuted,
  sfxMuted,
  localMetricsRef,
  onRequestCamera,
  onToggleMic,
  onToggleCamera,
  onToggleSfx,
  onCreateRoom,
  onCancelRoom,
  onJoinRoom,
  onStartSoloMode,
  onNotify,
}: LobbyViewProps) {
  const { t } = useI18n();
  const [joinCodeInput, setJoinCodeInput] = useState(() => normalizeRoomCode(initialJoinCode));
  const [copiedMode, setCopiedMode] = useState<'none' | 'code' | 'link'>('none');
  const [formError, setFormError] = useState<string | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  const theme = CATEGORY_THEMES.all;
  const isWaitingHost = connectionStatus === 'creating' || connectionStatus === 'waiting';
  const isJoining = connectionStatus === 'connecting';
  const showLiveVideo = Boolean(localStream) && cameraEnabled;

  useEffect(() => {
    const clean = normalizeRoomCode(initialJoinCode);
    if (clean.length === 4) {
      setJoinCodeInput(clean);
    }
  }, [initialJoinCode]);

  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video) return;
    if (showLiveVideo && localStream) {
      if (video.srcObject !== localStream) {
        video.srcObject = localStream;
      }
      video.play().catch(() => {});
    } else {
      video.srcObject = null;
    }
  }, [localStream, showLiveVideo]);

  const handleCopyCode = async () => {
    if (!roomCode) return;
    const ok = await copyTextToClipboard(roomCode);
    if (ok) {
      setCopiedMode('code');
      onNotify(t.toastCodeCopied, 'success');
      window.setTimeout(() => setCopiedMode((prev) => (prev === 'code' ? 'none' : prev)), 2200);
    }
  };

  const handleCopyShareLink = async () => {
    if (!roomCode) return;
    const shareUrl = buildRoomShareUrl(roomCode);
    const ok = await copyTextToClipboard(shareUrl);
    if (ok) {
      setCopiedMode('link');
      onNotify(t.toastLinkCopied, 'success');
      window.setTimeout(() => setCopiedMode((prev) => (prev === 'link' ? 'none' : prev)), 2200);
    }
  };

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

  const statusBadgeLabel =
    connectionStatus === 'connected'
      ? t.statusConnected
      : isWaitingHost || isJoining
        ? t.statusWaiting
        : t.statusReady;

  const statusDotColor =
    connectionStatus === 'connected'
      ? 'bg-[#34D399]'
      : isWaitingHost || isJoining
        ? 'bg-[#FACC15] animate-pulse'
        : 'bg-[#38BDF8]';

  return (
    <main
      className="relative min-h-[100dvh] w-full overflow-x-hidden flex flex-col transition-all duration-500"
      style={{ background: theme.pageBg }}
    >
      {/* Decorative soft pop-arcade ambient halos (radial gradients — zero GPU blur stall) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{
          backgroundImage:
            'radial-gradient(520px 520px at 8% 4%, rgba(124, 58, 237, 0.34), transparent 68%), radial-gradient(460px 460px at 94% 28%, rgba(255, 77, 141, 0.28), transparent 68%), radial-gradient(540px 380px at 48% 98%, rgba(56, 189, 248, 0.22), transparent 68%)',
        }}
      />

      {/* 1. Clean Top Navigation Bar — All controls visible on PC & Phone */}
      <header className="relative z-20 w-full border-b border-white/15 bg-[#120E24]/55 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-3.5 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <DuoLogo size="sm" />
            <span
              data-testid="lobby-status-badge"
              className={`${
                isWaitingHost || isJoining || connectionStatus === 'connected'
                  ? 'inline-flex'
                  : 'hidden sm:inline-flex'
              } items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-white whitespace-nowrap`}
            >
              <span className={`w-2 h-2 rounded-full ${statusDotColor}`} />
              <span>{statusBadgeLabel}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <LanguageSwitcher />

            {/* Quick audio/camera/sound controls — generous 44px mobile touch targets */}
            <button
              type="button"
              onClick={onToggleMic}
              title={micMuted ? t.micMuted : t.micActive}
              aria-label={micMuted ? t.micMuted : t.micActive}
              aria-pressed={micMuted}
              className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-3 rounded-full text-xs font-semibold border transition-all ${
                micMuted
                  ? 'bg-[#EF4444]/25 text-[#FECACA] border-[#EF4444]/50'
                  : 'bg-white/10 text-white border-white/20 hover:bg-white/18'
              }`}
            >
              {micMuted ? <MicOff className="w-4 h-4 shrink-0" /> : <Mic className="w-4 h-4 shrink-0" />}
              <span className="hidden md:inline">{micMuted ? t.micMuted : t.micActive}</span>
            </button>

            <button
              type="button"
              onClick={localStream ? onToggleCamera : onRequestCamera}
              title={t.enableCamera}
              aria-label={t.enableCamera}
              aria-pressed={showLiveVideo}
              className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-3 rounded-full text-xs font-semibold border transition-all ${
                showLiveVideo
                  ? 'bg-[#34D399]/20 text-[#D1FAE5] border-[#34D399]/45'
                  : 'bg-white/10 text-white border-white/20 hover:bg-white/18'
              }`}
            >
              {showLiveVideo ? <Video className="w-4 h-4 shrink-0" /> : <VideoOff className="w-4 h-4 shrink-0" />}
            </button>

            <button
              type="button"
              onClick={onToggleSfx}
              title="Audio SFX"
              aria-label="Audio SFX"
              aria-pressed={sfxMuted}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2.5 rounded-full bg-white/10 text-white border border-white/20 hover:bg-white/18 transition-all"
            >
              {sfxMuted ? <VolumeX className="w-4 h-4 text-white/55" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* 2. Balanced Two-Column Hero (Stacked cleanly on mobile) */}
      <div className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-3.5 sm:px-6 py-5 sm:py-8 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
          {/* LEFT COLUMN: Modern Mirror Camera Preview + Prominent Name Input */}
          <section className="lg:col-span-6 order-2 lg:order-1">
            <div className="glass-panel rounded-3xl p-4 sm:p-5 space-y-4">
              {/* Glowing Colorful Mirror Camera Frame */}
              <div
                className="relative rounded-[22px] p-[2.5px] shadow-xl"
                style={{
                  background: theme.primaryGradient,
                  boxShadow: theme.glowShadow,
                }}
              >
                <div className="relative w-full aspect-[4/3] sm:aspect-[16/11] rounded-[20px] overflow-hidden bg-[#181232]">
                  {showLiveVideo ? (
                    <video
                      ref={previewVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover mirror-video"
                    />
                  ) : (
                    <AvatarCanvas
                      name={playerName || 'Alex'}
                      metricsRef={localMetricsRef}
                      accentColor="#FF4D8D"
                      bgTop="#2E1B5E"
                      bgBottom="#131029"
                      isAi={false}
                    />
                  )}

                  {/* Top status pill inside mirror frame */}
                  <div className="absolute top-3 start-3 end-3 flex items-center justify-between gap-2">
                    <span
                      data-testid="lobby-camera-badge"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#120E24]/75 backdrop-blur-md border border-white/20 text-xs font-semibold text-white"
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          showLiveVideo ? 'bg-[#34D399]' : 'bg-[#38BDF8]'
                        }`}
                      />
                      <span>{showLiveVideo ? t.cameraActiveBadge : t.cameraOffBadge}</span>
                    </span>

                    {!showLiveVideo && (
                      <button
                        type="button"
                        onClick={onRequestCamera}
                        className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs sm:text-sm font-bold bg-white text-[#161130] hover:bg-white/90 shadow-md transition-all whitespace-nowrap"
                      >
                        <Camera className="w-4 h-4 shrink-0" />
                        <span>{t.enableCamera}</span>
                      </button>
                    )}
                  </div>

                  {/* Subtle bottom name label */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0E0A20]/85 to-transparent flex items-end px-4 pb-3">
                    <p className="text-sm font-bold text-white truncate">
                      {playerName.trim() || 'Alex'}{' '}
                      <span className="text-xs font-medium text-white/75">{t.youTag}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Prominent Name Input — 54px touch-friendly field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="couplecam-player-name"
                  className="block text-sm font-bold text-white"
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
                  className="w-full min-h-[54px] px-4 py-3.5 rounded-2xl bg-[#120E24]/75 border border-white/22 text-white placeholder-white/45 text-base font-medium focus:border-[#38BDF8] focus:ring-2 focus:ring-[#38BDF8]/30 focus:outline-none transition-all"
                />
              </div>

              {cameraHint && (
                <p className="text-xs text-white/75 leading-relaxed">{cameraHint}</p>
              )}
            </div>
          </section>

          {/* RIGHT COLUMN: Ultra-Clear Action Panel (< 3 seconds comprehension) */}
          <section className="lg:col-span-6 order-1 lg:order-2 space-y-5">
            {/* 1. Short warm headline + 1 concise subtitle */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-5xl font-extrabold leading-[1.08] tracking-tight text-white">
                {t.lobbyHeadline}
              </h1>
              <p className="text-sm sm:text-base text-white/85 leading-relaxed">
                {t.lobbySubtitlePrefix}
                <strong className="text-white font-bold">{t.lobbySubtitleStrong}</strong>
                {t.lobbySubtitleSuffix}
              </p>
            </div>

            {/* Action Glass Panel */}
            <div className="glass-panel rounded-3xl p-4 sm:p-6 space-y-4">
              {/* 2. Giant Primary CTA: "Créer un salon" */}
              {!isWaitingHost ? (
                <button
                  type="button"
                  data-testid="lobby-create-btn"
                  onClick={handleCreateSubmit}
                  className="btn-shine w-full min-h-[58px] inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl text-base sm:text-lg font-extrabold text-white transition-all hover:-translate-y-0.5 whitespace-nowrap"
                  style={{
                    background: theme.primaryGradient,
                    boxShadow: theme.glowShadow,
                  }}
                >
                  <Users className="w-5 h-5 shrink-0" />
                  <span>{t.createBtn}</span>
                  <ArrowRight className="w-5 h-5 shrink-0 rtl:rotate-180" />
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-2xl bg-[#120E24]/80 border border-[#FF4D8D]/45 p-4 space-y-3.5 shadow-lg shadow-[#7C3AED]/25"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
                        {t.shareCodeLabel}
                      </p>
                      <p
                        dir="ltr"
                        data-testid="host-room-code"
                        className="font-mono text-4xl sm:text-5xl font-extrabold tracking-[0.22em] bg-gradient-to-r from-[#FACC15] via-[#FF4D8D] to-[#38BDF8] bg-clip-text text-transparent tabular-nums mt-0.5"
                      >
                        {roomCode}
                      </p>
                    </div>
                    <button
                      type="button"
                      data-testid="copy-room-code"
                      onClick={handleCopyCode}
                      className="min-h-[48px] inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-white text-[#161130] hover:bg-white/90 shadow-md transition-all whitespace-nowrap shrink-0"
                    >
                      {copiedMode === 'code' ? (
                        <Check className="w-4 h-4 text-[#10B981]" />
                      ) : (
                        <Copy className="w-4 h-4 text-[#7C3AED]" />
                      )}
                      <span>{copiedMode === 'code' ? t.codeCopiedBtn : t.copyCodeBtn}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    data-testid="copy-share-link"
                    onClick={handleCopyShareLink}
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white/10 hover:bg-white/18 text-white border border-white/18 transition-all whitespace-nowrap"
                  >
                    {copiedMode === 'link' ? (
                      <Check className="w-4 h-4 text-[#34D399]" />
                    ) : (
                      <Link2 className="w-4 h-4 text-[#38BDF8]" />
                    )}
                    <span>
                      {copiedMode === 'link' ? t.linkCopiedBtn : `${t.copyLinkBtn} (?room=${roomCode})`}
                    </span>
                  </button>

                  <div className="flex items-center justify-between gap-3 pt-1 text-xs sm:text-sm text-white/85">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#38BDF8] shrink-0" />
                      <span>{statusMessage || t.waitingPartner}</span>
                    </span>
                    <button
                      type="button"
                      onClick={onCancelRoom}
                      className="min-h-[44px] px-3 text-xs font-bold text-white/80 hover:text-white underline underline-offset-4 whitespace-nowrap shrink-0"
                    >
                      {t.cancelBtn}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* 3. Clear "OU" Divider */}
              <div className="flex items-center gap-3" aria-hidden="true">
                <div className="h-px flex-1 bg-white/15" />
                <span className="text-xs font-extrabold uppercase tracking-widest text-white/70">
                  {t.orDivider}
                </span>
                <div className="h-px flex-1 bg-white/15" />
              </div>

              {/* Dedicated "Rejoindre un salon" Card (Extra-large 56px mobile code input & button) */}
              <form
                onSubmit={handleJoinSubmit}
                className="rounded-2xl bg-[#120E24]/60 border border-white/15 p-3.5 sm:p-4 space-y-2.5"
              >
                <label
                  htmlFor="couplecam-join-code"
                  className="block text-xs sm:text-sm font-bold text-white"
                >
                  {t.tabJoin} <span className="hidden sm:inline font-medium text-white/75">— {t.joinCodeLabel}</span>
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
                    disabled={isJoining}
                    value={joinCodeInput}
                    onChange={(e) => {
                      setJoinCodeInput(normalizeRoomCode(e.target.value));
                      if (formError) setFormError(null);
                    }}
                    placeholder="A7K4"
                    className="flex-1 min-w-0 min-h-[56px] px-3.5 py-3 rounded-2xl bg-white/10 border border-white/22 font-mono text-2xl font-bold tracking-[0.24em] text-center text-white placeholder-white/35 uppercase tabular-nums focus:border-[#38BDF8] focus:ring-2 focus:ring-[#38BDF8]/30 focus:outline-none disabled:opacity-60 transition-all"
                  />
                  <button
                    type="submit"
                    data-testid="lobby-join-btn"
                    disabled={isJoining}
                    className="min-h-[56px] px-5 sm:px-6 rounded-2xl text-sm sm:text-base font-extrabold bg-white text-[#161130] hover:bg-[#F8FAFC] disabled:opacity-60 inline-flex items-center justify-center gap-1.5 shadow-md transition-all whitespace-nowrap shrink-0"
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
                  <div className="flex items-center justify-between gap-2 pt-1 text-xs text-white/80">
                    <span className="truncate">
                      {statusMessage || `${t.joiningBtn} (${roomCode || joinCodeInput})`}
                    </span>
                    <button
                      type="button"
                      onClick={onCancelRoom}
                      className="text-xs font-bold text-white/80 hover:text-white underline underline-offset-4 whitespace-nowrap shrink-0"
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
                <p
                  role="alert"
                  className="rounded-xl bg-[#EF4444]/20 border border-[#EF4444]/45 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#FECACA]"
                >
                  {formError || statusMessage}
                </p>
              )}

              {/* 4. Distinct Secondary Solo Button at the bottom */}
              <div className="pt-1">
                <button
                  type="button"
                  data-start="true"
                  data-testid="lobby-solo-btn"
                  onClick={() => {
                    setFormError(null);
                    onStartSoloMode();
                  }}
                  className="w-full min-h-[54px] inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm sm:text-base font-bold bg-white/10 hover:bg-white/16 text-white border border-white/22 transition-all whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4 text-[#FACC15] shrink-0" />
                  <span>{t.soloCta}</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
