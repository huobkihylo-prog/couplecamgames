import { useEffect, useRef, useState, type FormEvent, type MutableRefObject } from 'react';
import {
  ArrowRight,
  Camera,
  Check,
  Copy,
  FlipHorizontal2,
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
import { normalizeRoomCode } from '../utils/roomCode';
import { buildRoomShareUrl, copyTextToClipboard } from '../utils/clipboard';
import { useI18n } from '../i18n/LanguageContext';
import { useMirror } from '../context/MirrorContext';
import { CoupleCamLogo } from './CoupleCamLogo';
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
  const { isMirrored, toggleMirrored } = useMirror();
  const [joinCodeInput, setJoinCodeInput] = useState(() => normalizeRoomCode(initialJoinCode));
  const [copiedMode, setCopiedMode] = useState<'none' | 'code' | 'link'>('none');
  const [formError, setFormError] = useState<string | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

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
      ? 'bg-[#16A34A]'
      : isWaitingHost || isJoining
        ? 'bg-[#F59E0B] animate-pulse'
        : 'bg-[#FF6B57]';

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

      {/* 1. Clean Warm Header */}
      <header className="relative z-20 w-full border-b border-[#EAE4DC] bg-[#FAF7F2]/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-3.5 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <CoupleCamLogo size="sm" />
            <span
              data-testid="lobby-status-badge"
              className={`${
                isWaitingHost || isJoining || connectionStatus === 'connected'
                  ? 'inline-flex'
                  : 'hidden sm:inline-flex'
              } items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-[#EAE4DC] text-xs font-semibold text-[#1F242D] shadow-xs whitespace-nowrap`}
            >
              <span className={`w-2 h-2 rounded-full ${statusDotColor}`} />
              <span>{statusBadgeLabel}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <LanguageSwitcher />

            <button
              type="button"
              onClick={toggleMirrored}
              title={isMirrored ? 'Miroir activé' : 'Miroir désactivé'}
              aria-label={isMirrored ? 'Miroir activé' : 'Miroir désactivé'}
              aria-pressed={isMirrored}
              className={`w-10 h-10 inline-flex items-center justify-center rounded-full border transition-all shadow-xs ${
                isMirrored
                  ? 'bg-white text-[#7C5CFC] border-[#7C5CFC]/35'
                  : 'bg-white text-[#6B7280] border-[#EAE4DC]'
              }`}
            >
              <FlipHorizontal2 className="w-4 h-4 shrink-0" />
            </button>

            <button
              type="button"
              onClick={onToggleMic}
              title={micMuted ? t.micMuted : t.micActive}
              aria-label={micMuted ? t.micMuted : t.micActive}
              aria-pressed={micMuted}
              className={`w-10 h-10 inline-flex items-center justify-center rounded-full border transition-all shadow-xs ${
                micMuted
                  ? 'bg-[#FEE2E2] text-[#DC2626] border-[#FCA5A5]'
                  : 'bg-white text-[#1F242D] border-[#EAE4DC] hover:bg-[#FFFDF9]'
              }`}
            >
              {micMuted ? <MicOff className="w-4 h-4 shrink-0" /> : <Mic className="w-4 h-4 shrink-0" />}
            </button>

            <button
              type="button"
              onClick={localStream ? onToggleCamera : onRequestCamera}
              title={t.enableCamera}
              aria-label={t.enableCamera}
              aria-pressed={showLiveVideo}
              className={`w-10 h-10 inline-flex items-center justify-center rounded-full border transition-all shadow-xs ${
                showLiveVideo
                  ? 'bg-[#E6F6EF] text-[#15803D] border-[#BBF7D0]'
                  : 'bg-white text-[#1F242D] border-[#EAE4DC] hover:bg-[#FFFDF9]'
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
              className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-white text-[#1F242D] border border-[#EAE4DC] hover:bg-[#FFFDF9] transition-all shadow-xs"
            >
              {sfxMuted ? <VolumeX className="w-4 h-4 text-[#6B7280]" /> : <Volume2 className="w-4 h-4 text-[#FF6B57]" />}
            </button>
          </div>
        </div>
      </header>

      {/* 2. Balanced Two-Column Hero (Stacked cleanly on mobile) */}
      <div className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-3.5 sm:px-6 py-5 sm:py-8 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
          {/* LEFT COLUMN: Polaroid Camera Preview + Name Field */}
          <section className="lg:col-span-6 order-2 lg:order-1">
            <div className="bg-white border border-[#EAE4DC] shadow-[0_4px_20px_rgba(31,36,45,0.06)] rounded-3xl p-4 sm:p-5 space-y-4">
              {/* Soft Polaroid-inspired camera frame */}
              <div className="relative rounded-[22px] p-1.5 bg-[#FFFDF9] border border-[#EAE4DC] shadow-sm">
                <div className="relative w-full aspect-[4/3] sm:aspect-[16/11] rounded-[16px] overflow-hidden bg-[#FFE8E2]">
                  {showLiveVideo ? (
                    <video
                      ref={previewVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${isMirrored ? 'mirror-video' : ''}`}
                    />
                  ) : (
                    <AvatarCanvas
                      name={playerName || 'Alex'}
                      metricsRef={localMetricsRef}
                      accentColor="#FF6B57"
                      bgTop="#FFE8E2"
                      bgBottom="#EFE9FB"
                      isAi={false}
                    />
                  )}

                  {/* Top status pill inside mirror frame */}
                  <div className="absolute top-3 start-3 end-3 flex items-center justify-between gap-2">
                    <span
                      data-testid="lobby-camera-badge"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/88 backdrop-blur-md border border-[#EAE4DC] text-xs font-bold text-[#1F242D] shadow-xs"
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          showLiveVideo ? 'bg-[#16A34A]' : 'bg-[#FF6B57]'
                        }`}
                      />
                      <span>{showLiveVideo ? t.cameraActiveBadge : t.cameraOffBadge}</span>
                    </span>

                    {!showLiveVideo && (
                      <button
                        type="button"
                        onClick={onRequestCamera}
                        className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs sm:text-sm font-bold bg-[#FF6B57] text-white hover:bg-[#F25743] shadow-md shadow-[#FF6B57]/25 transition-all whitespace-nowrap"
                      >
                        <Camera className="w-4 h-4 shrink-0" />
                        <span>{t.enableCamera}</span>
                      </button>
                    )}
                  </div>

                  {/* Frosted white name tag */}
                  <div className="absolute start-3 bottom-3">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/88 backdrop-blur-md border border-[#EAE4DC] shadow-xs">
                      <p className="text-xs sm:text-sm font-bold text-[#1F242D] truncate max-w-[180px]">
                        {playerName.trim() || 'Alex'}{' '}
                        <span className="text-xs font-semibold text-[#6B7280]">{t.youTag}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Prominent Name Input */}
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

              {cameraHint && (
                <p className="text-xs text-[#6B7280] leading-relaxed">{cameraHint}</p>
              )}
            </div>
          </section>

          {/* RIGHT COLUMN: Clean Warm Action Panel */}
          <section className="lg:col-span-6 order-1 lg:order-2 space-y-5">
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
              {/* 1. Primary CTA: "Créer un salon" */}
              {!isWaitingHost ? (
                <button
                  type="button"
                  data-testid="lobby-create-btn"
                  onClick={handleCreateSubmit}
                  className="btn-shine w-full min-h-[56px] inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl text-base sm:text-lg font-extrabold bg-[#FF6B57] hover:bg-[#F25743] text-white shadow-[0_8px_22px_-4px_rgba(255,107,87,0.4)] transition-all hover:-translate-y-0.5 whitespace-nowrap"
                >
                  <Users className="w-5 h-5 shrink-0" />
                  <span>{t.createBtn}</span>
                  <ArrowRight className="w-5 h-5 shrink-0 rtl:rotate-180" />
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-2xl bg-[#FFFDF9] border border-[#FF6B57]/35 p-4 space-y-3.5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                        {t.shareCodeLabel}
                      </p>
                      <p
                        dir="ltr"
                        data-testid="host-room-code"
                        className="font-mono text-4xl sm:text-5xl font-extrabold tracking-[0.22em] text-[#FF6B57] tabular-nums mt-0.5"
                      >
                        {roomCode}
                      </p>
                    </div>
                    <button
                      type="button"
                      data-testid="copy-room-code"
                      onClick={handleCopyCode}
                      className="min-h-[46px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#FF6B57] text-white hover:bg-[#F25743] shadow-sm transition-all whitespace-nowrap shrink-0"
                    >
                      {copiedMode === 'code' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      <span>{copiedMode === 'code' ? t.codeCopiedBtn : t.copyCodeBtn}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    data-testid="copy-share-link"
                    onClick={handleCopyShareLink}
                    className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#EFE9FB] hover:bg-[#E5DCFA] text-[#1F242D] border border-[#DDD4F7] transition-all whitespace-nowrap"
                  >
                    {copiedMode === 'link' ? (
                      <Check className="w-4 h-4 text-[#16A34A]" />
                    ) : (
                      <Link2 className="w-4 h-4 text-[#7C5CFC]" />
                    )}
                    <span>
                      {copiedMode === 'link' ? t.linkCopiedBtn : `${t.copyLinkBtn} (?room=${roomCode})`}
                    </span>
                  </button>

                  <div className="flex items-center justify-between gap-3 pt-1 text-xs sm:text-sm text-[#6B7280]">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <Loader2 className="w-4 h-4 animate-spin text-[#FF6B57] shrink-0" />
                      <span>{statusMessage || t.waitingPartner}</span>
                    </span>
                    <button
                      type="button"
                      onClick={onCancelRoom}
                      className="min-h-[40px] px-3 text-xs font-bold text-[#6B7280] hover:text-[#1F242D] underline underline-offset-4 whitespace-nowrap shrink-0"
                    >
                      {t.cancelBtn}
                    </button>
                  </div>
                </motion.div>
              )}

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
                    disabled={isJoining}
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
                    disabled={isJoining}
                    className="min-h-[54px] px-5 sm:px-6 rounded-2xl text-sm sm:text-base font-extrabold bg-[#1F242D] text-white hover:bg-[#313846] disabled:opacity-60 inline-flex items-center justify-center gap-1.5 shadow-sm transition-all whitespace-nowrap shrink-0"
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
                      <span data-testid="lobby-join-step" className="truncate font-semibold text-[#1F242D]">
                        {statusMessage || '1/3 Connexion au serveur...'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={onCancelRoom}
                      className="text-xs font-bold text-[#6B7280] hover:text-[#1F242D] underline underline-offset-4 whitespace-nowrap shrink-0"
                    >
                      {t.cancelBtn}
                    </button>
                  </div>
                )}
              </form>

              {/* Validation or Connection Error with explicit Retry & Back actions */}
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
                        className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-extrabold bg-[#FF6B57] text-white hover:bg-[#F25743] transition-all whitespace-nowrap"
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
                        className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-[#1F242D] border border-[#EAE4DC] hover:bg-[#FAF7F2] transition-all whitespace-nowrap"
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
                  onClick={() => {
                    setFormError(null);
                    onStartSoloMode();
                  }}
                  className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm sm:text-base font-bold bg-[#EFE9FB] hover:bg-[#E5DCFA] text-[#1F242D] border border-[#DDD4F7] transition-all whitespace-nowrap"
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
