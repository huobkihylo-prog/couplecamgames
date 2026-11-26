import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import {
  ArrowLeft,
  Check,
  Crown,
  Disc3,
  Loader2,
  Music2,
  RotateCcw,
  Sparkles,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import type {
  ConnectionMode,
  FaceMetrics,
  MusicQuizCategory,
  MusicQuizDuration,
  MusicQuizPhase,
  MusicQuizPlayer,
  MusicQuizRoundPayload,
  PeerMessage,
} from '../types/duoplay';
import {
  cancelPendingItunesJsonp,
  loadCategoryTracksJsonp,
  SharedMusicAudioPlayer,
} from '../services/itunesAudioEngine';
import {
  buildQuizRoundsFromTracks,
  EMERGENCY_QUIZ_FALLBACK_TRACKS,
  getQuizCategorySpec,
  MUSIC_QUIZ_CATEGORIES,
  MUSIC_QUIZ_DURATIONS,
  MUSIC_QUIZ_REVEAL_MS,
  MUSIC_QUIZ_ROUND_SECONDS,
  planSoloAiQuizAnswer,
  resolveQuizRoundScores,
  type QuizPlayerAnswer,
} from '../game/musicQuizLogic';
import { useI18n } from '../i18n/LanguageContext';
import { soundFx } from '../utils/soundFx';
import { AvatarCanvas } from './AvatarCanvas';

interface MusicQuizGameViewProps {
  localName: string;
  partnerName: string;
  connectionMode: ConnectionMode;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  cameraEnabled: boolean;
  sfxMuted: boolean;
  localMetricsRef: MutableRefObject<FaceMetrics>;
  partnerMetricsRef: MutableRefObject<FaceMetrics>;
  onRecordScore: (score: number) => void;
  onSendPeerMessage: (msg: PeerMessage) => void;
  registerPeerHandler: (handler: ((msg: PeerMessage) => void) | null) => void;
  onReturnToHub: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;
const EQ_DELAYS = ['0ms', '140ms', '280ms', '90ms', '220ms', '340ms', '170ms', '60ms'];
const CONFETTI_PIECES = Array.from({ length: 24 }, (_, idx) => ({
  id: idx,
  left: `${(idx * 4.2 + 2) % 96}%`,
  color: ['#8B5CF6', '#EC4899', '#06B6D4', '#FACC15', '#34D399'][idx % 5],
  delay: `${(idx % 6) * 0.14}s`,
  duration: `${1.8 + (idx % 4) * 0.35}s`,
}));

function MiniCamAvatar({
  stream,
  name,
  isLocal,
  isAi,
  cameraEnabled,
  metricsRef,
  accentColor,
}: {
  stream: MediaStream | null;
  name: string;
  isLocal?: boolean;
  isAi?: boolean;
  cameraEnabled?: boolean;
  metricsRef: MutableRefObject<FaceMetrics>;
  accentColor: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const showLive = Boolean(stream) && (isLocal ? cameraEnabled !== false : true) && !isAi;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (showLive && stream) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [stream, showLive]);

  return (
    <div
      className="w-9 h-9 sm:w-11 sm:h-11 rounded-full overflow-hidden shrink-0 border-2 bg-white shadow-xs"
      style={{ borderColor: accentColor }}
    >
      {showLive ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <AvatarCanvas
          name={name}
          metricsRef={metricsRef}
          accentColor={accentColor}
          bgTop={isLocal ? '#FFE8E2' : '#EFE9FB'}
          bgBottom={isLocal ? '#FCEAF0' : '#E6F3FC'}
          isAi={isAi}
        />
      )}
    </div>
  );
}

export function MusicQuizGameView({
  localName,
  partnerName,
  connectionMode,
  localStream,
  remoteStream,
  cameraEnabled,
  sfxMuted,
  localMetricsRef,
  partnerMetricsRef,
  onRecordScore,
  onSendPeerMessage,
  registerPeerHandler,
  onReturnToHub,
}: MusicQuizGameViewProps) {
  const { lang } = useI18n();
  const isSolo = connectionMode === 'solo';
  const isHost = connectionMode === 'p2p-host' || isSolo;
  const localRole: MusicQuizPlayer = isHost ? 'host' : 'guest';

  const [phase, setPhase] = useState<MusicQuizPhase>('LOBBY');
  const [category, setCategory] = useState<MusicQuizCategory>('all-hits');
  const [totalRounds, setTotalRounds] = useState<MusicQuizDuration>(10);
  const [guestAudioReady, setGuestAudioReady] = useState(false);

  const [currentRound, setCurrentRound] = useState<MusicQuizRoundPayload | null>(null);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(MUSIC_QUIZ_ROUND_SECONDS);
  const [hostScore, setHostScore] = useState(0);
  const [guestScore, setGuestScore] = useState(0);
  const [localSelectedIdx, setLocalSelectedIdx] = useState<number | null>(null);
  const [partnerAnswered, setPartnerAnswered] = useState(false);
  const [wrongShakeIdx, setWrongShakeIdx] = useState<number | null>(null);

  const [revealInfo, setRevealInfo] = useState<{
    hostDelta: number;
    guestDelta: number;
    hostAnswerIndex: number | null;
    guestAnswerIndex: number | null;
    fastestPlayer: MusicQuizPlayer | null;
  } | null>(null);

  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Refs for timers, host authoritative rounds, and audio player
  const audioPlayerRef = useRef<SharedMusicAudioPlayer | null>(null);
  const roundsQueueRef = useRef<MusicQuizRoundPayload[]>([]);
  const roundIndexRef = useRef(0);
  const roundStartedPerfRef = useRef(0);
  const hostAnswerRef = useRef<QuizPlayerAnswer | null>(null);
  const guestAnswerRef = useRef<QuizPlayerAnswer | null>(null);
  const hostScoreRef = useRef(0);
  const guestScoreRef = useRef(0);
  const phaseRef = useRef<MusicQuizPhase>('LOBBY');
  phaseRef.current = phase;
  const currentRoundRef = useRef<MusicQuizRoundPayload | null>(null);
  currentRoundRef.current = currentRound;

  const countdownIntervalRef = useRef<number | null>(null);
  const revealTimeoutRef = useRef<number | null>(null);
  const aiAnswerTimeoutRef = useRef<number | null>(null);
  const roundHardTimeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const clearAllTimers = useCallback(() => {
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (revealTimeoutRef.current !== null) {
      window.clearTimeout(revealTimeoutRef.current);
      revealTimeoutRef.current = null;
    }
    if (aiAnswerTimeoutRef.current !== null) {
      window.clearTimeout(aiAnswerTimeoutRef.current);
      aiAnswerTimeoutRef.current = null;
    }
    if (roundHardTimeoutRef.current !== null) {
      window.clearTimeout(roundHardTimeoutRef.current);
      roundHardTimeoutRef.current = null;
    }
  }, []);

  // Initialize dedicated native HTML5 <audio> controller once
  if (!audioPlayerRef.current) {
    audioPlayerRef.current = new SharedMusicAudioPlayer({
      onPlayingChange: (playing) => {
        if (mountedRef.current) setIsAudioPlaying(playing);
      },
      onAutoplayBlocked: (blocked) => {
        if (mountedRef.current) setAutoplayBlocked(blocked);
      },
    });
  }

  useEffect(() => {
    audioPlayerRef.current?.setMuted(sfxMuted);
  }, [sfxMuted]);

  // Mirror state to document.body.dataset.state for testability
  useEffect(() => {
    const mapped =
      phase === 'LOBBY' || phase === 'LOADING'
        ? 'title'
        : phase === 'PODIUM'
          ? 'gameover'
          : 'playing';
    document.body.dataset.state = mapped;
  }, [phase]);

  // Strict cleanup on unmount / switching game (NEVER stops PeerJS media tracks)
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearAllTimers();
      cancelPendingItunesJsonp();
      audioPlayerRef.current?.stopAndCleanup();
    };
  }, [clearAllTimers]);

  const getCategoryLabel = useCallback(
    (spec: (typeof MUSIC_QUIZ_CATEGORIES)[number]) => {
      if (lang === 'en') return spec.labelEn;
      if (lang === 'ar') return spec.labelAr;
      return spec.labelFr;
    },
    [lang],
  );

  // Forward declarations for Host orchestration
  const launchRoundRef = useRef<(roundIdx: number) => void>(() => {});
  const finalizeRoundAsHostRef = useRef<() => void>(() => {});

  const startRoundUiAndAudio = useCallback(
    (payload: MusicQuizRoundPayload) => {
      clearAllTimers();
      hostAnswerRef.current = null;
      guestAnswerRef.current = null;
      roundStartedPerfRef.current = performance.now();

      setCurrentRound(payload);
      setLocalSelectedIdx(null);
      setPartnerAnswered(false);
      setWrongShakeIdx(null);
      setRevealInfo(null);
      setTimeLeftSec(MUSIC_QUIZ_ROUND_SECONDS);
      setPhase('PLAYING');

      if (payload.previewUrl) {
        void audioPlayerRef.current?.playTrack(payload.previewUrl, { volume: 0.9, loop: false });
      } else {
        setIsAudioPlaying(false);
        setAutoplayBlocked(false);
      }

      // Smooth 15s countdown bar tick (every 100ms)
      countdownIntervalRef.current = window.setInterval(() => {
        const elapsed = (performance.now() - roundStartedPerfRef.current) / 1000;
        const remaining = Math.max(0, MUSIC_QUIZ_ROUND_SECONDS - elapsed);
        setTimeLeftSec(remaining);
        if (remaining <= 0 && countdownIntervalRef.current !== null) {
          window.clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }, 100);
    },
    [clearAllTimers],
  );

  const finalizeRoundAsHost = useCallback(() => {
    if (!isHost || phaseRef.current !== 'PLAYING') return;
    const roundPayload = currentRoundRef.current;
    if (!roundPayload) return;

    clearAllTimers();
    const res = resolveQuizRoundScores(hostAnswerRef.current, guestAnswerRef.current);
    hostScoreRef.current += res.hostTotalPoints;
    guestScoreRef.current += res.guestTotalPoints;

    const nextHostScore = hostScoreRef.current;
    const nextGuestScore = guestScoreRef.current;

    setHostScore(nextHostScore);
    setGuestScore(nextGuestScore);
    setRevealInfo({
      hostDelta: res.hostTotalPoints,
      guestDelta: res.guestTotalPoints,
      hostAnswerIndex: hostAnswerRef.current?.optionIndex ?? null,
      guestAnswerIndex: guestAnswerRef.current?.optionIndex ?? null,
      fastestPlayer: res.fastestPlayer,
    });
    setPhase('REVEAL');

    if (!isSolo) {
      onSendPeerMessage({
        type: 'MUSIC_QUIZ_REVEAL',
        round: roundPayload.round,
        hostScore: nextHostScore,
        guestScore: nextGuestScore,
        hostDelta: res.hostTotalPoints,
        guestDelta: res.guestTotalPoints,
        hostAnswerIndex: hostAnswerRef.current?.optionIndex ?? null,
        guestAnswerIndex: guestAnswerRef.current?.optionIndex ?? null,
        fastestPlayer: res.fastestPlayer,
      });
    }

    revealTimeoutRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;
      const nextIdx = roundIndexRef.current + 1;
      if (nextIdx >= roundsQueueRef.current.length) {
        audioPlayerRef.current?.stopAndCleanup();
        setPhase('PODIUM');
        soundFx.victoryFanfare();
        onRecordScore(nextHostScore);
        if (!isSolo) {
          onSendPeerMessage({
            type: 'MUSIC_QUIZ_FINISH',
            hostScore: nextHostScore,
            guestScore: nextGuestScore,
          });
        }
      } else {
        launchRoundRef.current(nextIdx);
      }
    }, MUSIC_QUIZ_REVEAL_MS);
  }, [clearAllTimers, isHost, isSolo, onRecordScore, onSendPeerMessage]);

  finalizeRoundAsHostRef.current = finalizeRoundAsHost;

  const launchRoundAsHost = useCallback(
    (idx: number) => {
      const baseRound = roundsQueueRef.current[idx];
      if (!baseRound) return;
      roundIndexRef.current = idx;

      const payload: MusicQuizRoundPayload = {
        ...baseRound,
        startTime: Date.now(),
      };

      if (!isSolo) {
        onSendPeerMessage({
          type: 'MUSIC_QUIZ_ROUND',
          ...payload,
        });
      }

      startRoundUiAndAudio(payload);

      // Host authoritative 15s hard timer
      roundHardTimeoutRef.current = window.setTimeout(() => {
        finalizeRoundAsHostRef.current();
      }, MUSIC_QUIZ_ROUND_SECONDS * 1000 + 80);

      // Solo Mode AI Opponent realistic response (3s..11s)
      if (isSolo) {
        const aiPlan = planSoloAiQuizAnswer(payload.correctIndex);
        aiAnswerTimeoutRef.current = window.setTimeout(() => {
          if (!mountedRef.current || phaseRef.current !== 'PLAYING') return;
          guestAnswerRef.current = {
            optionIndex: aiPlan.optionIndex,
            elapsedSec: aiPlan.delaySec,
            isCorrect: aiPlan.isCorrect,
          };
          setPartnerAnswered(true);
          if (hostAnswerRef.current) {
            finalizeRoundAsHostRef.current();
          }
        }, aiPlan.delaySec * 1000);
      }
    },
    [isSolo, onSendPeerMessage, startRoundUiAndAudio],
  );

  launchRoundRef.current = launchRoundAsHost;

  // Register PeerJS handler
  useEffect(() => {
    registerPeerHandler((msg) => {
      if (msg.type === 'MUSIC_QUIZ_CONFIG') {
        setCategory(msg.category);
        setTotalRounds(msg.totalRounds);
      } else if (msg.type === 'MUSIC_QUIZ_ROUND') {
        if (!isHost) {
          startRoundUiAndAudio({
            round: msg.round,
            totalRounds: msg.totalRounds,
            previewUrl: msg.previewUrl,
            artworkUrl: msg.artworkUrl,
            options: msg.options,
            correctIndex: msg.correctIndex,
            startTime: msg.startTime,
          });
        }
      } else if (msg.type === 'MUSIC_QUIZ_ANSWER') {
        if (isHost && phaseRef.current === 'PLAYING' && currentRoundRef.current?.round === msg.round) {
          if (!guestAnswerRef.current) {
            guestAnswerRef.current = {
              optionIndex: msg.optionIndex,
              elapsedSec: msg.elapsedSec,
              isCorrect: msg.optionIndex === currentRoundRef.current.correctIndex,
            };
            setPartnerAnswered(true);
            if (hostAnswerRef.current) {
              finalizeRoundAsHostRef.current();
            }
          }
        }
      } else if (msg.type === 'MUSIC_QUIZ_REVEAL') {
        if (!isHost) {
          clearAllTimers();
          setHostScore(msg.hostScore);
          setGuestScore(msg.guestScore);
          setRevealInfo({
            hostDelta: msg.hostDelta,
            guestDelta: msg.guestDelta,
            hostAnswerIndex: msg.hostAnswerIndex,
            guestAnswerIndex: msg.guestAnswerIndex,
            fastestPlayer: msg.fastestPlayer,
          });
          setPhase('REVEAL');
        }
      } else if (msg.type === 'MUSIC_QUIZ_FINISH') {
        if (!isHost) {
          clearAllTimers();
          audioPlayerRef.current?.stopAndCleanup();
          setHostScore(msg.hostScore);
          setGuestScore(msg.guestScore);
          setPhase('PODIUM');
          soundFx.victoryFanfare();
          onRecordScore(msg.guestScore);
        }
      } else if (msg.type === 'MUSIC_QUIZ_RESET') {
        clearAllTimers();
        audioPlayerRef.current?.stopAndCleanup();
        hostScoreRef.current = 0;
        guestScoreRef.current = 0;
        setHostScore(0);
        setGuestScore(0);
        setCurrentRound(null);
        setRevealInfo(null);
        setLoadError(null);
        setPhase('LOBBY');
      }
    });
    return () => registerPeerHandler(null);
  }, [clearAllTimers, isHost, onRecordScore, registerPeerHandler, startRoundUiAndAudio]);

  const handleSelectCategory = (nextCat: MusicQuizCategory) => {
    if (!isHost) return;
    soundFx.click();
    setCategory(nextCat);
    if (!isSolo) {
      onSendPeerMessage({ type: 'MUSIC_QUIZ_CONFIG', category: nextCat, totalRounds });
    }
  };

  const handleSelectDuration = (nextDur: MusicQuizDuration) => {
    if (!isHost) return;
    soundFx.click();
    setTotalRounds(nextDur);
    if (!isSolo) {
      onSendPeerMessage({ type: 'MUSIC_QUIZ_CONFIG', category, totalRounds: nextDur });
    }
  };

  const handleStartMatch = useCallback(
    async (useOfflineFallback = false) => {
      if (!isHost) return;
      // 1. Unlock mobile audio synchronously inside the click handler!
      audioPlayerRef.current?.unlock();
      soundFx.click();
      setLoadError(null);
      setPhase('LOADING');
      const spec = getQuizCategorySpec(category);
      setLoadingMessage(`Chargement des extraits ${spec.emoji} ${spec.labelFr}...`);

      try {
        let tracks = useOfflineFallback ? [...EMERGENCY_QUIZ_FALLBACK_TRACKS] : [];
        if (!useOfflineFallback) {
          tracks = await loadCategoryTracksJsonp(spec.primaryTerms, spec.fallbackTerms, Math.max(12, totalRounds + 4));
        }

        if (!mountedRef.current) return;

        if (tracks.length < 4) {
          setLoadError('Impossible de charger assez de chansons depuis iTunes pour le moment.');
          setPhase('LOBBY');
          return;
        }

        const rounds = useOfflineFallback
          ? buildOfflineRounds(totalRounds)
          : buildQuizRoundsFromTracks(tracks, totalRounds);

        if (rounds.length === 0) {
          setLoadError('Aucun extrait musical disponible pour cette catégorie.');
          setPhase('LOBBY');
          return;
        }

        roundsQueueRef.current = rounds;
        roundIndexRef.current = 0;
        hostScoreRef.current = 0;
        guestScoreRef.current = 0;
        setHostScore(0);
        setGuestScore(0);

        launchRoundAsHost(0);
      } catch (err) {
        if (!mountedRef.current) return;
        if (err instanceof Error && err.message === 'ITUNES_ABORTED') return;
        setLoadError('Connexion iTunes lente ou indisponible. Réessaie dans un instant.');
        setPhase('LOBBY');
      }
    },
    [category, isHost, launchRoundAsHost, totalRounds],
  );

  // Allow Enter/Space start handshake on LOBBY screen
  useEffect(() => {
    if (phase !== 'LOBBY' || !isHost) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'BUTTON' || tag === 'INPUT') return;
        e.preventDefault();
        void handleStartMatch(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleStartMatch, isHost, phase]);

  const handlePickOption = (optionIndex: number) => {
    if (phase !== 'PLAYING' || localSelectedIdx !== null || !currentRound) return;

    const elapsedSec = Math.max(0.1, (performance.now() - roundStartedPerfRef.current) / 1000);
    const isCorrect = optionIndex === currentRound.correctIndex;
    setLocalSelectedIdx(optionIndex);

    if (isCorrect) {
      soundFx.quizCorrect();
    } else {
      setWrongShakeIdx(optionIndex);
      soundFx.quizWrongBuzzer();
    }

    if (isHost) {
      hostAnswerRef.current = { optionIndex, elapsedSec, isCorrect };
      if (guestAnswerRef.current) {
        finalizeRoundAsHost();
      }
    } else {
      onSendPeerMessage({
        type: 'MUSIC_QUIZ_ANSWER',
        round: currentRound.round,
        optionIndex,
        elapsedSec,
      });
    }
  };

  const handleReplay = () => {
    soundFx.click();
    clearAllTimers();
    audioPlayerRef.current?.stopAndCleanup();
    hostScoreRef.current = 0;
    guestScoreRef.current = 0;
    setHostScore(0);
    setGuestScore(0);
    setCurrentRound(null);
    setRevealInfo(null);
    setLoadError(null);
    setPhase('LOBBY');
    if (!isSolo) {
      onSendPeerMessage({ type: 'MUSIC_QUIZ_RESET' });
    }
  };

  const handleExitToHub = () => {
    clearAllTimers();
    cancelPendingItunesJsonp();
    audioPlayerRef.current?.stopAndCleanup();
    onReturnToHub();
  };

  const localScore = localRole === 'host' ? hostScore : guestScore;
  const partnerScore = localRole === 'host' ? guestScore : hostScore;
  const localDelta = revealInfo ? (localRole === 'host' ? revealInfo.hostDelta : revealInfo.guestDelta) : 0;
  const partnerDelta = revealInfo ? (localRole === 'host' ? revealInfo.guestDelta : revealInfo.hostDelta) : 0;
  const timerPercent = Math.max(0, Math.min(100, (timeLeftSec / MUSIC_QUIZ_ROUND_SECONDS) * 100));
  const timerBarColor =
    timeLeftSec > 10
      ? 'from-[#34D399] to-[#06B6D4]'
      : timeLeftSec > 5
        ? 'from-[#FACC15] to-[#FB923C]'
        : 'from-[#F43F5E] to-[#EF4444]';

  const fastestName = useMemo(() => {
    if (!revealInfo?.fastestPlayer) return null;
    if (revealInfo.fastestPlayer === localRole) return localName;
    return partnerName;
  }, [localName, localRole, partnerName, revealInfo]);

  const winnerInfo = useMemo(() => {
    if (localScore > partnerScore) return { title: `🏆 ${localName} remporte le Quiz !`, isTie: false };
    if (partnerScore > localScore) return { title: `🏆 ${partnerName} remporte le Quiz !`, isTie: false };
    return { title: '🤝 Égalité parfaite !', isTie: true };
  }, [localName, localScore, partnerName, partnerScore]);

  return (
    <div
      data-testid="music-quiz-root"
      className="relative flex-1 min-h-0 flex flex-col overflow-hidden select-none touch-manipulation bg-[#FAF7F2] text-[#1F242D]"
      style={{
        backgroundImage:
          'radial-gradient(760px 440px at 14% 6%, rgba(239, 233, 251, 0.8), transparent 62%), radial-gradient(720px 440px at 86% 12%, rgba(255, 232, 226, 0.72), transparent 62%), radial-gradient(640px 400px at 50% 96%, rgba(230, 243, 252, 0.65), transparent 64%)',
      }}
    >
      {/* LOBBY SCREEN */}
      {phase === 'LOBBY' && (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-3.5 py-3 overflow-y-auto">
          <div className="w-full max-w-xl rounded-3xl bg-white border border-[#EAE4DC] p-4 sm:p-6 shadow-[0_8px_30px_rgba(31,36,45,0.07)] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#EFE9FB] border border-[#DDD4F7] flex items-center justify-center shadow-xs shrink-0">
                <Zap className="w-6 h-6 text-[#7C5CFC]" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#1F242D] leading-tight">
                  ⚡ Quiz Éclair 4 Choix
                </h1>
                <p className="text-xs sm:text-sm text-[#6B7280]">
                  Devine le vrai hit en 15s · +3 / +2 / +1 pts + ⚡+1 pt vitesse
                </p>
              </div>
            </div>

            {/* Category Selector */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                Catégorie musicale
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MUSIC_QUIZ_CATEGORIES.map((spec) => {
                  const active = category === spec.id;
                  return (
                    <button
                      key={spec.id}
                      type="button"
                      disabled={!isHost}
                      onClick={() => handleSelectCategory(spec.id)}
                      className={`min-h-[46px] px-3.5 py-2 rounded-2xl text-start text-sm font-bold border transition-all flex items-center gap-2.5 ${
                        active
                          ? 'bg-[#FFE8E2] border-[#FF6B57] text-[#1F242D] shadow-xs'
                          : 'bg-[#FAF7F2] border-[#EAE4DC] text-[#1F242D] hover:bg-white'
                      } ${!isHost ? 'opacity-80 cursor-default' : ''}`}
                    >
                      <span className="text-lg shrink-0" aria-hidden="true">
                        {spec.emoji}
                      </span>
                      <span className="truncate">{getCategoryLabel(spec)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Duration Selector */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                Nombre de manches
              </p>
              <div className="grid grid-cols-3 gap-2">
                {MUSIC_QUIZ_DURATIONS.map((dur) => {
                  const active = totalRounds === dur;
                  return (
                    <button
                      key={dur}
                      type="button"
                      disabled={!isHost}
                      onClick={() => handleSelectDuration(dur)}
                      className={`min-h-[44px] rounded-2xl text-sm font-extrabold border transition-all tabular-nums ${
                        active
                          ? 'bg-[#FF6B57] border-[#FF6B57] text-white shadow-sm'
                          : 'bg-[#FAF7F2] border-[#EAE4DC] text-[#1F242D] hover:bg-white'
                      } ${!isHost ? 'opacity-80 cursor-default' : ''}`}
                    >
                      {dur} manches
                    </button>
                  );
                })}
              </div>
            </div>

            {loadError && (
              <div className="rounded-2xl bg-[#FEF2F2] border border-[#FECACA] px-3.5 py-2.5 text-xs sm:text-sm text-[#B91C1C] space-y-2">
                <p>{loadError}</p>
                {isHost && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleStartMatch(false)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-[#EAE4DC] hover:bg-[#FAF7F2] text-[#1F242D] font-bold text-xs"
                    >
                      🔄 Réessayer iTunes
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleStartMatch(true)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#EFE9FB] hover:bg-[#E5DCFA] text-[#1F242D] font-bold text-xs"
                    >
                      🎮 Jouer en mode démo hors-ligne
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Primary Action */}
            {isHost ? (
              <button
                type="button"
                data-start="true"
                onClick={() => void handleStartMatch(false)}
                className="btn-shine min-h-[54px] w-full rounded-2xl bg-[#FF6B57] hover:bg-[#F25743] text-white font-extrabold text-base sm:text-lg shadow-[0_8px_22px_-4px_rgba(255,107,87,0.4)] flex items-center justify-center gap-2"
              >
                <Zap className="w-5 h-5" />
                <span>Commencer la partie</span>
              </button>
            ) : (
              <div className="space-y-2.5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    audioPlayerRef.current?.unlock();
                    soundFx.click();
                    setGuestAudioReady(true);
                  }}
                  className={`min-h-[48px] w-full rounded-2xl font-extrabold text-sm sm:text-base border transition-all flex items-center justify-center gap-2 ${
                    guestAudioReady
                      ? 'bg-[#E6F6EF] border-[#86EFAC] text-[#15803D]'
                      : 'bg-[#FF6B57] border-[#FF6B57] text-white shadow-md'
                  }`}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>{guestAudioReady ? 'Son activé · Prêt !' : 'Prêt · Activer le son'}</span>
                </button>
                <p className="text-xs text-[#6B7280]">
                  En attente que {partnerName} lance le Quiz Éclair...
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LOADING SCREEN */}
      {phase === 'LOADING' && (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-white border border-[#EAE4DC] shadow-md flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#FF6B57] animate-spin" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-extrabold text-[#1F242D]">{loadingMessage}</h2>
            <p className="text-xs sm:text-sm text-[#6B7280]">
              Préparation des extraits audio officiels...
            </p>
          </div>
        </div>
      )}

      {/* ACTIVE GAME & REVEAL SCREEN (STRICT ZERO-SCROLL MOBILE LAYOUT) */}
      {(phase === 'PLAYING' || phase === 'REVEAL') && currentRound && (
        <div className="flex-1 min-h-0 w-full max-w-3xl mx-auto px-3 sm:px-5 py-2 sm:py-3 flex flex-col justify-between gap-2 sm:gap-3 overflow-hidden">
          {/* TOP HUD: Scores + Round + 15s Timer Bar */}
          <div className="shrink-0 space-y-2">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              {/* Local Player Score */}
              <div className="flex items-center gap-2 rounded-2xl bg-white border border-[#EAE4DC] shadow-xs px-2.5 py-1.5 min-w-0">
                <MiniCamAvatar
                  stream={localStream}
                  name={localName}
                  isLocal
                  cameraEnabled={cameraEnabled}
                  metricsRef={localMetricsRef}
                  accentColor="#FF6B57"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] sm:text-xs font-semibold text-[#6B7280] truncate">
                    {localName}
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg sm:text-xl font-extrabold text-[#1F242D] tabular-nums">
                      {localScore}
                    </span>
                    {phase === 'REVEAL' && localDelta > 0 && (
                      <span className="text-xs font-extrabold text-[#16A34A] tabular-nums">
                        +{localDelta}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Center Round & Timer Readout */}
              <div className="text-center px-2.5 py-1 rounded-2xl bg-white border border-[#EAE4DC] shadow-xs">
                <p className="text-[11px] sm:text-xs font-bold text-[#6B7280] tabular-nums whitespace-nowrap">
                  Manche {currentRound.round}/{currentRound.totalRounds}
                </p>
                <p
                  className={`text-xl sm:text-2xl font-black tabular-nums leading-none mt-0.5 ${
                    timeLeftSec <= 5 && phase === 'PLAYING' ? 'text-[#EF4444]' : 'text-[#FF6B57]'
                  }`}
                >
                  {phase === 'REVEAL' ? '✓' : `${Math.ceil(timeLeftSec)}s`}
                </p>
              </div>

              {/* Partner Score */}
              <div className="flex items-center justify-end gap-2 rounded-2xl bg-white border border-[#EAE4DC] shadow-xs px-2.5 py-1.5 min-w-0">
                <div className="min-w-0 flex-1 text-end">
                  <p className="text-[11px] sm:text-xs font-semibold text-[#6B7280] truncate">
                    {partnerName}
                  </p>
                  <div className="flex items-baseline justify-end gap-1.5">
                    {phase === 'REVEAL' && partnerDelta > 0 && (
                      <span className="text-xs font-extrabold text-[#16A34A] tabular-nums">
                        +{partnerDelta}
                      </span>
                    )}
                    {phase === 'PLAYING' && partnerAnswered && (
                      <span className="text-[10px] font-bold text-[#7C5CFC]">✓</span>
                    )}
                    <span className="text-lg sm:text-xl font-extrabold text-[#1F242D] tabular-nums">
                      {partnerScore}
                    </span>
                  </div>
                </div>
                <MiniCamAvatar
                  stream={remoteStream}
                  name={partnerName}
                  isAi={isSolo}
                  metricsRef={partnerMetricsRef}
                  accentColor="#7C5CFC"
                />
              </div>
            </div>

            {/* 15s Progress Bar */}
            <div className="h-2.5 w-full rounded-full bg-[#EAE4DC] overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${timerBarColor} transition-transform duration-100 origin-left`}
                style={{ transform: `scaleX(${phase === 'REVEAL' ? 0 : timerPercent / 100})` }}
              />
            </div>

            {/* Mobile Autoplay Fallback Button */}
            {autoplayBlocked && phase === 'PLAYING' && (
              <button
                type="button"
                onClick={() => void audioPlayerRef.current?.resumeAfterGesture()}
                className="min-h-[44px] w-full rounded-2xl bg-[#FF6B57] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md animate-pulse"
              >
                <Volume2 className="w-4 h-4" />
                <span>🔊 Activer le son</span>
              </button>
            )}
          </div>

          {/* CENTER STAGE: Spinning Vinyl + Blurred/Unblurred Artwork + CSS Equalizer */}
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2.5 sm:gap-3">
            <div className="flex items-center justify-center gap-4 sm:gap-7">
              {/* Left Equalizer Bars */}
              <div className="flex items-end gap-1 h-14 sm:h-20" aria-hidden="true">
                {EQ_DELAYS.slice(0, 4).map((delay, i) => (
                  <span
                    key={i}
                    className={`w-1.5 sm:w-2 rounded-full bg-gradient-to-t from-[#FF6B57] to-[#7C5CFC] ${
                      isAudioPlaying ? 'animate-music-eq h-full' : 'h-3 opacity-35'
                    }`}
                    style={isAudioPlaying ? { animationDelay: delay } : undefined}
                  />
                ))}
              </div>

              {/* Spinning Vinyl Disc with Blurred Artwork */}
              <div className="relative w-32 h-32 sm:w-44 sm:h-44 shrink-0 flex items-center justify-center">
                <div
                  className={`relative w-full h-full rounded-full bg-[#242834] border-4 border-white shadow-[0_12px_30px_rgba(31,36,45,0.16)] flex items-center justify-center overflow-hidden ${
                    isAudioPlaying && phase === 'PLAYING' ? 'animate-vinyl-spin' : ''
                  }`}
                  style={{
                    backgroundImage:
                      'repeating-radial-gradient(circle at center, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 2px, transparent 3px, transparent 8px)',
                  }}
                >
                  {/* Center Album Cover */}
                  <div className="w-[62%] h-[62%] rounded-full overflow-hidden border-2 border-white/80 bg-[#FFE8E2] flex items-center justify-center">
                    {currentRound.artworkUrl ? (
                      <img
                        src={currentRound.artworkUrl}
                        alt={
                          phase === 'REVEAL'
                            ? currentRound.options[currentRound.correctIndex]?.title || 'Album'
                            : 'Pochette mystère'
                        }
                        referrerPolicy="no-referrer"
                        className={`w-full h-full object-cover transition-all duration-500 ${
                          phase === 'REVEAL' ? 'blur-0 scale-105' : 'blur-xl scale-125'
                        }`}
                      />
                    ) : (
                      <Disc3 className="w-10 h-10 text-[#FF6B57]" />
                    )}
                  </div>
                  {/* Vinyl Spindle Hole */}
                  <span className="absolute w-3.5 h-3.5 rounded-full bg-[#FAF7F2] border border-[#EAE4DC]" />
                </div>
              </div>

              {/* Right Equalizer Bars */}
              <div className="flex items-end gap-1 h-14 sm:h-20" aria-hidden="true">
                {EQ_DELAYS.slice(4, 8).map((delay, i) => (
                  <span
                    key={i}
                    className={`w-1.5 sm:w-2 rounded-full bg-gradient-to-t from-[#7C5CFC] to-[#FF6B57] ${
                      isAudioPlaying ? 'animate-music-eq h-full' : 'h-3 opacity-35'
                    }`}
                    style={isAudioPlaying ? { animationDelay: delay } : undefined}
                  />
                ))}
              </div>
            </div>

            {/* Status / Reveal Callout */}
            <div className="text-center px-2 min-h-[42px] flex flex-col items-center justify-center">
              {phase === 'REVEAL' ? (
                <>
                  <p className="text-sm sm:text-base font-extrabold text-[#15803D] truncate max-w-full">
                    🎵 {currentRound.options[currentRound.correctIndex]?.title} —{' '}
                    {currentRound.options[currentRound.correctIndex]?.artist}
                  </p>
                  <p className="text-xs font-bold text-[#D97706]">
                    {fastestName
                      ? `⚡ Plus rapide (+1 pt vitesse) : ${fastestName}`
                      : 'Personne n’a trouvé cette manche !'}
                  </p>
                </>
              ) : localSelectedIdx !== null ? (
                <p className="text-xs sm:text-sm font-bold text-[#1F242D]">
                  {localSelectedIdx === currentRound.correctIndex
                    ? '✅ Bien joué ! En attente du verdict...'
                    : '❌ Raté pour cette manche ! Attente du résultat...'}
                </p>
              ) : (
                <p className="text-xs sm:text-sm font-bold text-[#6B7280] flex items-center gap-1.5">
                  <Music2 className="w-4 h-4 text-[#FF6B57]" />
                  <span>Touche le bon titre le plus vite possible !</span>
                </p>
              )}
            </div>
          </div>

          {/* BOTTOM: 4 LARGE TAPPABLE CHOICE BUTTONS (Title + Artist) */}
          <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 pb-1">
            {currentRound.options.map((opt, idx) => {
              const isPickedByLocal = localSelectedIdx === idx;
              const isCorrect = idx === currentRound.correctIndex;
              const showAsCorrect =
                (phase === 'REVEAL' && isCorrect) || (isPickedByLocal && isCorrect);
              const showAsWrong = isPickedByLocal && !isCorrect;
              const isLocked = localSelectedIdx !== null || phase === 'REVEAL';

              let cardClasses =
                'bg-white border-[#EAE4DC] text-[#1F242D] hover:border-[#FF6B57] hover:bg-[#FFFDF9] shadow-xs';
              if (showAsCorrect) {
                cardClasses =
                  'bg-[#E6F6EF] border-[#16A34A] text-[#14532D] shadow-sm';
              } else if (showAsWrong) {
                cardClasses =
                  'bg-[#FEF2F2] border-[#EF4444] text-[#991B1B] shadow-sm';
              } else if (isLocked) {
                cardClasses = 'bg-[#FAF7F2] border-[#EAE4DC] text-[#6B7280] opacity-70';
              }

              return (
                <button
                  key={idx}
                  type="button"
                  data-testid={`quiz-option-${idx}`}
                  disabled={isLocked}
                  onClick={() => handlePickOption(idx)}
                  className={`min-h-[54px] sm:min-h-[68px] w-full rounded-2xl border px-3 sm:px-4 py-2 text-start transition-all flex items-center gap-3 ${cardClasses} ${
                    wrongShakeIdx === idx ? 'animate-quiz-shake' : ''
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs sm:text-sm font-black ${
                      showAsCorrect
                        ? 'bg-[#16A34A] text-white'
                        : showAsWrong
                          ? 'bg-[#EF4444] text-white'
                          : 'bg-[#FFE8E2] text-[#FF6B57]'
                    }`}
                  >
                    {showAsCorrect ? (
                      <Check className="w-4 h-4" />
                    ) : showAsWrong ? (
                      <X className="w-4 h-4" />
                    ) : (
                      OPTION_LETTERS[idx]
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm sm:text-base font-extrabold leading-tight truncate">
                      {opt.title}
                    </p>
                    <p
                      className={`text-xs truncate ${
                        showAsCorrect
                          ? 'text-[#15803D]'
                          : showAsWrong
                            ? 'text-[#B91C1C]'
                            : 'text-[#6B7280]'
                      }`}
                    >
                      {opt.artist}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* FINAL PODIUM SCREEN */}
      {phase === 'PODIUM' && (
        <div className="relative flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-4 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {CONFETTI_PIECES.map((c) => (
              <span
                key={c.id}
                className="absolute -top-3 w-2.5 h-2.5 rounded-sm opacity-90 animate-bounce"
                style={{
                  left: c.left,
                  backgroundColor: c.color,
                  animationDelay: c.delay,
                  animationDuration: c.duration,
                }}
              />
            ))}
          </div>

          <div className="relative z-10 w-full max-w-md rounded-3xl bg-white border border-[#EAE4DC] p-5 sm:p-7 text-center shadow-[0_12px_40px_rgba(31,36,45,0.1)] space-y-5">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#FEF6DC] border border-[#F3E3BE] flex items-center justify-center shadow-sm">
              {winnerInfo.isTie ? (
                <Sparkles className="w-8 h-8 text-[#FF6B57]" />
              ) : (
                <Crown className="w-8 h-8 text-[#D97706]" />
              )}
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F242D]">{winnerInfo.title}</h2>
              <p className="text-xs sm:text-sm text-[#6B7280]">
                Scores finaux sur {totalRounds} manches
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#FFE8E2]/60 border border-[#FFD6CC] p-3.5">
                <p className="text-xs font-bold text-[#6B7280] truncate">{localName}</p>
                <p className="text-3xl font-black text-[#FF6B57] tabular-nums mt-1">{localScore}</p>
                <p className="text-[11px] text-[#6B7280]">points</p>
              </div>
              <div className="rounded-2xl bg-[#EFE9FB]/80 border border-[#DDD4F7] p-3.5">
                <p className="text-xs font-bold text-[#6B7280] truncate">{partnerName}</p>
                <p className="text-3xl font-black text-[#7C5CFC] tabular-nums mt-1">
                  {partnerScore}
                </p>
                <p className="text-[11px] text-[#6B7280]">points</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={handleReplay}
                className="btn-shine min-h-[48px] flex-1 rounded-2xl bg-[#FF6B57] hover:bg-[#F25743] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm"
              >
                <RotateCcw className="w-4 h-4" />
                <span>🔄 Rejouer</span>
              </button>
              <button
                type="button"
                onClick={handleExitToHub}
                className="min-h-[48px] flex-1 rounded-2xl bg-[#FAF7F2] hover:bg-[#F1ECE3] border border-[#EAE4DC] text-[#1F242D] font-bold text-sm flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>← Changer de jeu</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildOfflineRounds(totalRounds: MusicQuizDuration): MusicQuizRoundPayload[] {
  const pool = [...EMERGENCY_QUIZ_FALLBACK_TRACKS];
  const rounds: MusicQuizRoundPayload[] = [];
  for (let i = 0; i < totalRounds; i += 1) {
    const correct = pool[i % pool.length];
    const others = pool.filter((t) => t.trackId !== correct.trackId).slice(0, 3);
    const combined = [correct, ...others];
    const correctIndex = i % 4;
    // Rotate so correct index varies
    const rotated = combined.map((_, idx) => combined[(idx - correctIndex + 4) % 4]);
    rounds.push({
      round: i + 1,
      totalRounds,
      previewUrl: '',
      artworkUrl: '',
      options: rotated.map((t) => ({ title: t.trackName, artist: t.artistName })),
      correctIndex,
      startTime: Date.now(),
    });
  }
  return rounds;
}
