import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import {
  ArrowLeft,
  Camera,
  Crown,
  Heart,
  Loader2,
  Music,
  RotateCcw,
  Snowflake,
  Sparkles,
  Volume2,
} from 'lucide-react';
import type {
  ConnectionMode,
  FaceMetrics,
  FreezeDanceFormat,
  FreezeDanceState,
  FreezeDanceVerdict,
  FreezeDanceVibe,
  PeerMessage,
} from '../types/duoplay';
import {
  cancelPendingItunesJsonp,
  loadCategoryTracksJsonp,
  SharedMusicAudioPlayer,
  type ItunesTrack,
} from '../services/itunesAudioEngine';
import {
  createInitialFreezeState,
  FREEZE_DANCE_VIBES,
  FREEZE_HOLD_MS,
  FREEZE_VERDICT_MAX_MS,
  getFreezeVibeSpec,
  pickRandomDanceDurationMs,
  resolveFreezeRoundVerdicts,
} from '../game/freezeDanceLogic';
import { useI18n } from '../i18n/LanguageContext';
import { soundFx } from '../utils/soundFx';
import { AvatarCanvas } from './AvatarCanvas';

interface FreezeDanceGameViewProps {
  localName: string;
  partnerName: string;
  connectionMode: ConnectionMode;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  cameraEnabled: boolean;
  sfxMuted: boolean;
  localMetricsRef: MutableRefObject<FaceMetrics>;
  partnerMetricsRef: MutableRefObject<FaceMetrics>;
  onRecordVictory: () => void;
  onRequestCamera: () => void;
  onSendPeerMessage: (msg: PeerMessage) => void;
  registerPeerHandler: (handler: ((msg: PeerMessage) => void) | null) => void;
  onReturnToHub: () => void;
}

const CONFETTI_PIECES = Array.from({ length: 24 }, (_, idx) => ({
  id: idx,
  left: `${(idx * 4.3 + 2) % 96}%`,
  color: ['#38BDF8', '#EC4899', '#FACC15', '#8B5CF6', '#34D399'][idx % 5],
  delay: `${(idx % 6) * 0.14}s`,
  duration: `${1.8 + (idx % 4) * 0.35}s`,
}));

function FreezeCameraCard({
  name,
  stream,
  isLocal,
  isAi,
  cameraEnabled,
  metricsRef,
  phase,
  format,
  lives,
  points,
  onRequestCamera,
}: {
  name: string;
  stream: MediaStream | null;
  isLocal?: boolean;
  isAi?: boolean;
  cameraEnabled?: boolean;
  metricsRef: MutableRefObject<FaceMetrics>;
  phase: FreezeDanceState['phase'];
  format: FreezeDanceFormat;
  lives: number;
  points: number;
  onRequestCamera?: () => void;
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

  const frameRing =
    phase === 'FREEZE'
      ? 'border-[#0EA5E9] ring-2 ring-[#38BDF8]/55 shadow-[0_8px_24px_rgba(14,165,233,0.18)]'
      : phase === 'DANCING'
        ? isLocal
          ? 'border-[#FF6B57] ring-2 ring-[#FF6B57]/35 shadow-[0_8px_24px_rgba(255,107,87,0.16)]'
          : 'border-[#7C5CFC] ring-2 ring-[#7C5CFC]/35 shadow-[0_8px_24px_rgba(124,92,252,0.16)]'
        : 'border-[#EAE4DC]';

  return (
    <div
      className={`relative w-full h-full min-h-0 rounded-3xl overflow-hidden bg-white border-2 shadow-[0_6px_22px_rgba(31,36,45,0.08)] transition-all duration-300 ${frameRing}`}
    >
      {showLive ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''} ${
            phase === 'FREEZE' ? 'contrast-105 saturate-90' : ''
          }`}
        />
      ) : (
        <div
          className={`w-full h-full transition-transform duration-300 ${
            phase === 'DANCING' ? 'animate-bounce' : ''
          }`}
          style={phase === 'DANCING' ? { animationDuration: '0.85s' } : undefined}
        >
          <AvatarCanvas
            name={name}
            metricsRef={metricsRef}
            accentColor={isLocal ? '#FF6B57' : '#7C5CFC'}
            bgTop={phase === 'FREEZE' ? '#E6F3FC' : isLocal ? '#FFE8E2' : '#EFE9FB'}
            bgBottom={phase === 'FREEZE' ? '#D6ECFA' : isLocal ? '#FCEAF0' : '#E6F3FC'}
            isAi={isAi}
          />
        </div>
      )}

      {/* Icy frost frame overlay during FREEZE */}
      {phase === 'FREEZE' && (
        <div
          className="pointer-events-none absolute inset-0 border-[5px] border-[#38BDF8]/65 rounded-3xl"
          style={{
            boxShadow: 'inset 0 0 28px rgba(56, 189, 248, 0.35)',
          }}
          aria-hidden="true"
        />
      )}

      {/* Top overlay: Lives or Points */}
      <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-2">
        <span className="px-2.5 py-1 rounded-full bg-white/88 backdrop-blur-md border border-[#EAE4DC] text-xs font-extrabold text-[#1F242D] truncate max-w-[60%] shadow-xs">
          {name}
          {isLocal ? ' (Toi)' : ''}
        </span>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/88 backdrop-blur-md border border-[#EAE4DC] text-xs font-extrabold text-[#1F242D] tabular-nums shrink-0 shadow-xs">
          {format === 'lives-3' ? (
            <span className="inline-flex items-center gap-0.5" aria-label={`${lives} vies`}>
              {[0, 1, 2].map((i) => (
                <Heart
                  key={i}
                  className={`w-3.5 h-3.5 ${
                    i < lives ? 'fill-[#FF6B57] text-[#FF6B57]' : 'text-[#D1D5DB]'
                  }`}
                />
              ))}
            </span>
          ) : (
            <span className="text-[#D97706]">⭐ {points} pts</span>
          )}
          {format === 'lives-3' && points > 0 && (
            <span className="text-[11px] text-[#7C5CFC] ms-1">🗿{points}</span>
          )}
        </div>
      </div>

      {/* Local Camera Enable Fallback Button */}
      {!showLive && isLocal && onRequestCamera && (
        <button
          type="button"
          onClick={onRequestCamera}
          className="absolute bottom-2.5 end-2.5 min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/92 hover:bg-white border border-[#EAE4DC] text-xs font-bold text-[#1F242D] shadow-sm backdrop-blur-md"
        >
          <Camera className="w-3.5 h-3.5 text-[#FF6B57]" />
          <span>Activer la caméra</span>
        </button>
      )}
    </div>
  );
}

export function FreezeDanceGameView({
  localName,
  partnerName,
  connectionMode,
  localStream,
  remoteStream,
  cameraEnabled,
  sfxMuted,
  localMetricsRef,
  partnerMetricsRef,
  onRecordVictory,
  onRequestCamera,
  onSendPeerMessage,
  registerPeerHandler,
  onReturnToHub,
}: FreezeDanceGameViewProps) {
  const { lang } = useI18n();
  const isSolo = connectionMode === 'solo';
  const isHost = connectionMode === 'p2p-host' || isSolo;

  const [state, setState] = useState<FreezeDanceState>(() =>
    createInitialFreezeState('party-pop', 'lives-3'),
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  const [guestAudioReady, setGuestAudioReady] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [freezeFlashKey, setFreezeFlashKey] = useState(0);
  const [freezeCountdownSec, setFreezeCountdownSec] = useState(4);
  const [verdictCountdownSec, setVerdictCountdownSec] = useState(6);
  const [localVoted, setLocalVoted] = useState<FreezeDanceVerdict | null>(null);

  const audioPlayerRef = useRef<SharedMusicAudioPlayer | null>(null);
  const tracksPoolRef = useRef<ItunesTrack[]>([]);
  const trackCursorRef = useRef(0);
  const hostVoteRef = useRef<FreezeDanceVerdict | null>(null);
  const guestVoteRef = useRef<FreezeDanceVerdict | null>(null);
  const verdictResolvedRef = useRef(false);
  const mountedRef = useRef(true);

  const danceTimeoutRef = useRef<number | null>(null);
  const freezeTimeoutRef = useRef<number | null>(null);
  const verdictTimeoutRef = useRef<number | null>(null);
  const nextRoundTimeoutRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<number | null>(null);

  const clearAllTimers = useCallback(() => {
    if (danceTimeoutRef.current !== null) {
      window.clearTimeout(danceTimeoutRef.current);
      danceTimeoutRef.current = null;
    }
    if (freezeTimeoutRef.current !== null) {
      window.clearTimeout(freezeTimeoutRef.current);
      freezeTimeoutRef.current = null;
    }
    if (verdictTimeoutRef.current !== null) {
      window.clearTimeout(verdictTimeoutRef.current);
      verdictTimeoutRef.current = null;
    }
    if (nextRoundTimeoutRef.current !== null) {
      window.clearTimeout(nextRoundTimeoutRef.current);
      nextRoundTimeoutRef.current = null;
    }
    if (tickIntervalRef.current !== null) {
      window.clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  }, []);

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

  useEffect(() => {
    const mapped =
      state.phase === 'LOBBY' || state.phase === 'LOADING'
        ? 'title'
        : state.phase === 'GAME_OVER'
          ? 'gameover'
          : 'playing';
    document.body.dataset.state = mapped;
  }, [state.phase]);

  // Strict cleanup on unmount / switching game (NEVER stops PeerJS MediaStream tracks)
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearAllTimers();
      cancelPendingItunesJsonp();
      audioPlayerRef.current?.stopAndCleanup();
    };
  }, [clearAllTimers]);

  const broadcastState = useCallback(
    (next: FreezeDanceState) => {
      stateRef.current = next;
      setState(next);
      if (!isSolo) {
        onSendPeerMessage({ type: 'FREEZE_STATE', state: next });
      }
    },
    [isSolo, onSendPeerMessage],
  );

  const getVibeLabel = useCallback(
    (spec: (typeof FREEZE_DANCE_VIBES)[number]) => {
      if (lang === 'en') return spec.labelEn;
      if (lang === 'ar') return spec.labelAr;
      return spec.labelFr;
    },
    [lang],
  );

  const startRoundAsHostRef = useRef<(roundNum: number, baseState?: FreezeDanceState) => void>(() => {});
  const resolveVerdictAsHostRef = useRef<() => void>(() => {});

  const triggerFreezeEffects = useCallback((durationMs: number) => {
    audioPlayerRef.current?.pause();
    soundFx.freezeRecordScratch();
    soundFx.freezeFlashPop();
    setFreezeFlashKey((k) => k + 1);

    const started = performance.now();
    setFreezeCountdownSec(Math.ceil(durationMs / 1000));
    if (tickIntervalRef.current !== null) {
      window.clearInterval(tickIntervalRef.current);
    }
    tickIntervalRef.current = window.setInterval(() => {
      const rem = Math.max(0, durationMs - (performance.now() - started));
      setFreezeCountdownSec(Math.ceil(rem / 1000));
      if (rem <= 0 && tickIntervalRef.current !== null) {
        window.clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    }, 100);
  }, []);

  const enterVerdictPhase = useCallback(() => {
    setLocalVoted(null);
    const started = performance.now();
    setVerdictCountdownSec(Math.ceil(FREEZE_VERDICT_MAX_MS / 1000));
    if (tickIntervalRef.current !== null) {
      window.clearInterval(tickIntervalRef.current);
    }
    tickIntervalRef.current = window.setInterval(() => {
      const rem = Math.max(0, FREEZE_VERDICT_MAX_MS - (performance.now() - started));
      setVerdictCountdownSec(Math.ceil(rem / 1000));
      if (rem <= 0 && tickIntervalRef.current !== null) {
        window.clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    }, 120);
  }, []);

  const resolveVerdictAsHost = useCallback(() => {
    if (!isHost || verdictResolvedRef.current) return;
    verdictResolvedRef.current = true;
    clearAllTimers();

    const cur = stateRef.current;
    const outcome = resolveFreezeRoundVerdicts(
      cur,
      hostVoteRef.current,
      guestVoteRef.current,
      isSolo,
      cur.round - 1,
    );

    if (outcome.matchFinished) {
      audioPlayerRef.current?.stopAndCleanup();
      broadcastState(outcome.nextState);
      soundFx.victoryFanfare();
      if (outcome.nextState.winner === 'host') {
        onRecordVictory();
      }
      return;
    }

    // Show verdict & dare summary briefly before launching the next dancing round
    broadcastState(outcome.nextState);
    if (outcome.nextState.activeDareText) {
      soundFx.quizWrongBuzzer();
    } else {
      soundFx.quizCorrect();
    }

    nextRoundTimeoutRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;
      startRoundAsHostRef.current(outcome.nextState.round + 1, outcome.nextState);
    }, 2400);
  }, [broadcastState, clearAllTimers, isHost, isSolo, onRecordVictory]);

  resolveVerdictAsHostRef.current = resolveVerdictAsHost;

  const startRoundAsHost = useCallback(
    (roundNum: number, baseState?: FreezeDanceState) => {
      if (!isHost) return;
      clearAllTimers();
      hostVoteRef.current = null;
      guestVoteRef.current = null;
      verdictResolvedRef.current = false;
      setLocalVoted(null);

      const pool = tracksPoolRef.current;
      const track = pool.length > 0 ? pool[trackCursorRef.current % pool.length] : null;
      trackCursorRef.current += 1;

      const danceDurationMs = pickRandomDanceDurationMs();
      const prev = baseState ?? stateRef.current;

      const nextState: FreezeDanceState = {
        ...prev,
        phase: 'DANCING',
        round: roundNum,
        currentTrackTitle: track?.trackName ?? 'Groove Freestyle',
        currentTrackArtist: track?.artistName ?? 'DJ CoupleCam',
        currentPreviewUrl: track?.previewUrl ?? '',
        currentArtworkUrl: track?.artworkUrlHiRes ?? '',
        danceDurationMs,
        phaseStartedAt: Date.now(),
        hostVoteOnGuest: null,
        guestVoteOnHost: null,
        activeDareText: '',
        lastVerdictSummary: '',
        stateSeq: prev.stateSeq + 1,
      };

      broadcastState(nextState);

      if (!isSolo) {
        onSendPeerMessage({
          type: 'FREEZE_PLAY',
          round: roundNum,
          previewUrl: nextState.currentPreviewUrl,
          artworkUrl: nextState.currentArtworkUrl,
          title: nextState.currentTrackTitle,
          artist: nextState.currentTrackArtist,
          startTime: nextState.phaseStartedAt,
        });
      }

      if (nextState.currentPreviewUrl) {
        void audioPlayerRef.current?.playTrack(nextState.currentPreviewUrl, {
          volume: 0.92,
          loop: true,
        });
      }

      // Schedule sudden unpredictable FREEZE cut (4s..10s)
      danceTimeoutRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;

        const freezeState: FreezeDanceState = {
          ...stateRef.current,
          phase: 'FREEZE',
          phaseStartedAt: Date.now(),
          stateSeq: stateRef.current.stateSeq + 1,
        };
        broadcastState(freezeState);
        if (!isSolo) {
          onSendPeerMessage({
            type: 'FREEZE_STOP',
            round: roundNum,
            freezeDurationMs: FREEZE_HOLD_MS,
          });
        }
        triggerFreezeEffects(FREEZE_HOLD_MS);

        // After 4s of FREEZE, transition to Verdict & Laughs
        freezeTimeoutRef.current = window.setTimeout(() => {
          if (!mountedRef.current) return;
          const verdictState: FreezeDanceState = {
            ...stateRef.current,
            phase: 'VERDICT',
            phaseStartedAt: Date.now(),
            stateSeq: stateRef.current.stateSeq + 1,
          };
          broadcastState(verdictState);
          enterVerdictPhase();

          // Auto-advance verdict after 6s max
          verdictTimeoutRef.current = window.setTimeout(() => {
            resolveVerdictAsHostRef.current();
          }, FREEZE_VERDICT_MAX_MS);
        }, FREEZE_HOLD_MS);
      }, danceDurationMs);
    },
    [
      broadcastState,
      clearAllTimers,
      enterVerdictPhase,
      isHost,
      isSolo,
      onSendPeerMessage,
      triggerFreezeEffects,
    ],
  );

  startRoundAsHostRef.current = startRoundAsHost;

  // PeerJS incoming message handling
  useEffect(() => {
    registerPeerHandler((msg) => {
      if (msg.type === 'FREEZE_STATE') {
        if (!isHost) {
          const prevPhase = stateRef.current.phase;
          stateRef.current = msg.state;
          setState(msg.state);
          if (msg.state.phase === 'VERDICT' && prevPhase !== 'VERDICT') {
            enterVerdictPhase();
          } else if (msg.state.phase === 'GAME_OVER') {
            clearAllTimers();
            audioPlayerRef.current?.stopAndCleanup();
            soundFx.victoryFanfare();
            if (msg.state.winner === 'guest') {
              onRecordVictory();
            }
          } else if (msg.state.phase === 'LOBBY') {
            clearAllTimers();
            audioPlayerRef.current?.stopAndCleanup();
          }
        }
      } else if (msg.type === 'FREEZE_PLAY') {
        if (!isHost && msg.previewUrl) {
          void audioPlayerRef.current?.playTrack(msg.previewUrl, { volume: 0.92, loop: true });
        }
      } else if (msg.type === 'FREEZE_STOP') {
        if (!isHost) {
          triggerFreezeEffects(msg.freezeDurationMs || FREEZE_HOLD_MS);
        }
      } else if (msg.type === 'FREEZE_VERDICT') {
        if (isHost && stateRef.current.phase === 'VERDICT' && stateRef.current.round === msg.round) {
          guestVoteRef.current = msg.verdict;
          if (hostVoteRef.current && guestVoteRef.current) {
            resolveVerdictAsHostRef.current();
          }
        }
      }
    });
    return () => registerPeerHandler(null);
  }, [clearAllTimers, enterVerdictPhase, isHost, onRecordVictory, registerPeerHandler, triggerFreezeEffects]);

  const handleSelectVibe = (nextVibe: FreezeDanceVibe) => {
    if (!isHost) return;
    soundFx.click();
    const next = createInitialFreezeState(nextVibe, state.format);
    broadcastState(next);
  };

  const handleSelectFormat = (nextFormat: FreezeDanceFormat) => {
    if (!isHost) return;
    soundFx.click();
    const next = createInitialFreezeState(state.vibe, nextFormat);
    broadcastState(next);
  };

  const handleStartMatch = useCallback(
    async (allowSilentFallback = false) => {
      if (!isHost) return;
      audioPlayerRef.current?.unlock();
      soundFx.click();
      setLoadError(null);

      const loadingState: FreezeDanceState = {
        ...createInitialFreezeState(stateRef.current.vibe, stateRef.current.format),
        phase: 'LOADING',
        stateSeq: stateRef.current.stateSeq + 1,
      };
      broadcastState(loadingState);

      try {
        const spec = getFreezeVibeSpec(loadingState.vibe);
        const tracks = allowSilentFallback
          ? []
          : await loadCategoryTracksJsonp(spec.primaryTerms, spec.fallbackTerms, 10);

        if (!mountedRef.current) return;

        if (!allowSilentFallback && tracks.length === 0) {
          setLoadError('Impossible de charger les musiques festives depuis iTunes.');
          broadcastState(createInitialFreezeState(loadingState.vibe, loadingState.format));
          return;
        }

        tracksPoolRef.current = tracks;
        trackCursorRef.current = 0;
        startRoundAsHost(1, loadingState);
      } catch (err) {
        if (!mountedRef.current) return;
        if (err instanceof Error && err.message === 'ITUNES_ABORTED') return;
        setLoadError('Erreur de chargement iTunes. Réessaie dans un instant.');
        broadcastState(createInitialFreezeState(loadingState.vibe, loadingState.format));
      }
    },
    [broadcastState, isHost, startRoundAsHost],
  );

  // Enter/Space start handshake on LOBBY
  useEffect(() => {
    if (state.phase !== 'LOBBY' || !isHost) return;
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
  }, [handleStartMatch, isHost, state.phase]);

  const handleVoteVerdict = (verdict: FreezeDanceVerdict) => {
    if (state.phase !== 'VERDICT' || localVoted !== null || state.lastVerdictSummary) return;
    soundFx.click();
    setLocalVoted(verdict);

    if (isHost) {
      hostVoteRef.current = verdict;
      if (isSolo || guestVoteRef.current) {
        resolveVerdictAsHost();
      }
    } else {
      onSendPeerMessage({
        type: 'FREEZE_VERDICT',
        round: state.round,
        verdict,
      });
    }
  };

  const handleReplay = () => {
    soundFx.click();
    clearAllTimers();
    audioPlayerRef.current?.stopAndCleanup();
    setLoadError(null);
    setLocalVoted(null);
    const reset = createInitialFreezeState(state.vibe, state.format);
    broadcastState(reset);
  };

  const handleExitToHub = () => {
    clearAllTimers();
    cancelPendingItunesJsonp();
    audioPlayerRef.current?.stopAndCleanup();
    onReturnToHub();
  };

  const localLives = isHost ? state.hostLives : state.guestLives;
  const partnerLives = isHost ? state.guestLives : state.hostLives;
  const localPoints = isHost ? state.hostPoints : state.guestPoints;
  const partnerPoints = isHost ? state.guestPoints : state.hostPoints;

  const winnerBanner = useMemo(() => {
    if (state.winner === 'draw') return '🤝 Égalité de Statues !';
    const localWon = (isHost && state.winner === 'host') || (!isHost && state.winner === 'guest');
    if (isSolo) {
      return localWon ? `🏆 Bravo ${localName}, Statue d’Or !` : '😂 Tu as trop bougé ! Revanche ?';
    }
    return localWon ? `🏆 ${localName} remporte la partie !` : `🏆 ${partnerName} remporte la partie !`;
  }, [isHost, isSolo, localName, partnerName, state.winner]);

  const bgGradient =
    state.phase === 'FREEZE'
      ? 'radial-gradient(860px 460px at 50% 12%, rgba(230, 243, 252, 0.95), transparent 64%), linear-gradient(160deg, #F0F8FF 0%, #E6F3FC 52%, #FAF7F2 100%)'
      : state.phase === 'DANCING'
        ? 'radial-gradient(860px 460px at 16% 10%, rgba(252, 234, 240, 0.85), transparent 60%), radial-gradient(820px 460px at 86% 12%, rgba(254, 246, 220, 0.85), transparent 60%), linear-gradient(155deg, #FAF7F2 0%, #FFF7F4 52%, #FAF7F2 100%)'
        : 'radial-gradient(860px 460px at 18% 8%, rgba(239, 233, 251, 0.72), transparent 60%), radial-gradient(780px 460px at 84% 12%, rgba(230, 243, 252, 0.72), transparent 60%), #FAF7F2';

  return (
    <div
      data-testid="freeze-dance-root"
      className="relative flex-1 min-h-0 flex flex-col overflow-hidden select-none touch-manipulation transition-all duration-300 text-[#1F242D]"
      style={{ background: bgGradient }}
    >
      {/* Crisp White Camera Flash on FREEZE cut */}
      {freezeFlashKey > 0 && state.phase === 'FREEZE' && (
        <div
          key={freezeFlashKey}
          className="pointer-events-none fixed inset-0 z-50 bg-white animate-freeze-flash"
          aria-hidden="true"
        />
      )}

      {/* LOBBY SCREEN */}
      {state.phase === 'LOBBY' && (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-3.5 py-3 overflow-y-auto">
          <div className="w-full max-w-xl rounded-3xl bg-white border border-[#EAE4DC] p-4 sm:p-6 shadow-[0_8px_30px_rgba(31,36,45,0.07)] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#E6F3FC] border border-[#CCE5F7] flex items-center justify-center shadow-xs shrink-0">
                <Snowflake className="w-6 h-6 text-[#0EA5E9]" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#1F242D] leading-tight">
                  🥶 1, 2, 3… Statue Musicale
                </h1>
                <p className="text-xs sm:text-sm text-[#6B7280]">
                  Dansez devant la caméra et figez-vous dès que la musique coupe !
                </p>
              </div>
            </div>

            {/* Vibe Selector */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                Ambiance musicale
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FREEZE_DANCE_VIBES.map((spec) => {
                  const active = state.vibe === spec.id;
                  return (
                    <button
                      key={spec.id}
                      type="button"
                      disabled={!isHost}
                      onClick={() => handleSelectVibe(spec.id)}
                      className={`min-h-[48px] px-3.5 py-2 rounded-2xl text-start text-sm font-bold border transition-all flex items-center gap-2.5 ${
                        active
                          ? 'bg-[#FFE8E2] border-[#FF6B57] text-[#1F242D] shadow-xs'
                          : 'bg-[#FAF7F2] border-[#EAE4DC] text-[#1F242D] hover:bg-white'
                      } ${!isHost ? 'opacity-80 cursor-default' : ''}`}
                    >
                      <span className="text-lg shrink-0" aria-hidden="true">
                        {spec.emoji}
                      </span>
                      <span className="truncate">{getVibeLabel(spec)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Format Selector */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">Format</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!isHost}
                  onClick={() => handleSelectFormat('lives-3')}
                  className={`min-h-[48px] px-3 py-2 rounded-2xl text-xs sm:text-sm font-extrabold border transition-all ${
                    state.format === 'lives-3'
                      ? 'bg-[#FF6B57] border-[#FF6B57] text-white shadow-sm'
                      : 'bg-[#FAF7F2] border-[#EAE4DC] text-[#1F242D] hover:bg-white'
                  }`}
                >
                  ❤️ 3 Vies (Élimination)
                </button>
                <button
                  type="button"
                  disabled={!isHost}
                  onClick={() => handleSelectFormat('rounds-5')}
                  className={`min-h-[48px] px-3 py-2 rounded-2xl text-xs sm:text-sm font-extrabold border transition-all ${
                    state.format === 'rounds-5'
                      ? 'bg-[#FF6B57] border-[#FF6B57] text-white shadow-sm'
                      : 'bg-[#FAF7F2] border-[#EAE4DC] text-[#1F242D] hover:bg-white'
                  }`}
                >
                  ⭐ 5 Manches (Points)
                </button>
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
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#E6F3FC] hover:bg-[#D5ECFA] text-[#1F242D] font-bold text-xs"
                    >
                      🎮 Lancer sans piste iTunes
                    </button>
                  </div>
                )}
              </div>
            )}

            {isHost ? (
              <button
                type="button"
                data-start="true"
                onClick={() => void handleStartMatch(false)}
                className="btn-shine min-h-[54px] w-full rounded-2xl bg-[#FF6B57] hover:bg-[#F25743] text-white font-extrabold text-base sm:text-lg shadow-[0_8px_22px_-4px_rgba(255,107,87,0.4)] flex items-center justify-center gap-2"
              >
                <Music className="w-5 h-5" />
                <span>💃 Commencer la danse !</span>
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
                  En attente que {partnerName} lance la musique...
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LOADING SCREEN */}
      {state.phase === 'LOADING' && (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-white border border-[#EAE4DC] shadow-md flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#FF6B57] animate-spin" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-extrabold text-[#1F242D]">
              Préparation de la playlist festive...
            </h2>
            <p className="text-xs sm:text-sm text-[#6B7280]">
              Prépare-toi à danser devant la caméra !
            </p>
          </div>
        </div>
      )}

      {/* ACTIVE STAGE: DANCING -> FREEZE -> VERDICT */}
      {(state.phase === 'DANCING' || state.phase === 'FREEZE' || state.phase === 'VERDICT') && (
        <div className="flex-1 min-h-0 w-full max-w-5xl mx-auto px-3 sm:px-5 py-2 sm:py-3 flex flex-col gap-2 sm:gap-3 overflow-hidden">
          {/* TOP PHASE BANNER */}
          <div className="shrink-0 space-y-1.5">
            {state.phase === 'DANCING' && (
              <div className="rounded-2xl bg-[#FF6B57] text-white px-3.5 py-2 flex items-center justify-between gap-2 shadow-md shadow-[#FF6B57]/25">
                <div className="min-w-0">
                  <p className="text-sm sm:text-lg font-black leading-tight truncate">
                    💃 BOUGEZ ! DANSEZ DEVANT LA CAMÉRA !
                  </p>
                  <p className="text-[11px] sm:text-xs font-semibold text-white/90 truncate">
                    Manche {state.round}
                    {state.format === 'rounds-5' ? `/${state.maxRounds}` : ''} · ♪{' '}
                    {state.currentTrackTitle} — {state.currentTrackArtist}
                  </p>
                </div>
                <div className="flex items-end gap-1 h-7 shrink-0" aria-hidden="true">
                  {['0ms', '150ms', '80ms', '220ms'].map((d, idx) => (
                    <span
                      key={idx}
                      className={`w-1.5 rounded-full bg-white ${
                        isAudioPlaying ? 'animate-music-eq h-full' : 'h-2.5 opacity-60'
                      }`}
                      style={isAudioPlaying ? { animationDelay: d } : undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            {state.phase === 'FREEZE' && (
              <div className="rounded-2xl bg-[#0284C7] border-2 border-[#7DD3FC] px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-lg shadow-[#0284C7]/25">
                <div className="min-w-0">
                  <p className="text-base sm:text-2xl font-black text-white tracking-tight truncate">
                    🥶 FREEZE ! NE BOUGE PLUS !
                  </p>
                  <p className="text-xs font-bold text-white/90">
                    {isSolo
                      ? 'Ne bouge plus d’un seul millimètre !'
                      : `Observe bien la caméra de ${partnerName}...`}
                  </p>
                </div>
                <span className="w-10 h-10 rounded-full bg-white text-[#0284C7] font-black text-xl flex items-center justify-center tabular-nums shrink-0 shadow-sm">
                  {freezeCountdownSec}
                </span>
              </div>
            )}

            {state.phase === 'VERDICT' && (
              <div className="rounded-2xl bg-white border border-[#EAE4DC] px-3.5 py-2 flex items-center justify-between gap-2 shadow-xs">
                <div className="min-w-0">
                  <p className="text-sm sm:text-lg font-black text-[#1F242D] truncate">
                    ⚖️ Verdict & Fous Rires
                  </p>
                  <p className="text-xs text-[#6B7280] font-medium truncate">
                    {state.lastVerdictSummary
                      ? state.lastVerdictSummary
                      : isSolo
                        ? 'Sois honnête : tu as bougé ou statue parfaite ?'
                        : `Juge ${partnerName} en 1 clic !`}
                  </p>
                </div>
                {!state.lastVerdictSummary && (
                  <span className="px-2.5 py-1 rounded-full bg-[#FFE8E2] text-xs font-extrabold text-[#FF6B57] tabular-nums shrink-0">
                    {verdictCountdownSec}s
                  </span>
                )}
              </div>
            )}

            {/* Mobile Autoplay Fallback Button */}
            {autoplayBlocked && state.phase === 'DANCING' && (
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

          {/* DUAL CAMERAS STAGE — Large, stacked on mobile, side-by-side on desktop */}
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 grid-rows-2 md:grid-rows-1 gap-2.5 sm:gap-3.5">
            <FreezeCameraCard
              name={localName}
              stream={localStream}
              isLocal
              cameraEnabled={cameraEnabled}
              metricsRef={localMetricsRef}
              phase={state.phase}
              format={state.format}
              lives={localLives}
              points={localPoints}
              onRequestCamera={onRequestCamera}
            />
            <FreezeCameraCard
              name={partnerName}
              stream={remoteStream}
              isAi={isSolo}
              metricsRef={partnerMetricsRef}
              phase={state.phase}
              format={state.format}
              lives={partnerLives}
              points={partnerPoints}
            />
          </div>

          {/* BOTTOM ACTION STRIP: Verdict Buttons or Dare Callout */}
          <div className="shrink-0 pb-0.5">
            {state.phase === 'VERDICT' && !state.lastVerdictSummary && (
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  data-testid="freeze-vote-moved"
                  disabled={localVoted !== null}
                  onClick={() => handleVoteVerdict('moved')}
                  className={`min-h-[54px] rounded-2xl px-3 py-2 font-extrabold text-xs sm:text-base border transition-all flex items-center justify-center gap-1.5 ${
                    localVoted === 'moved'
                      ? 'bg-[#EF4444] border-[#EF4444] text-white shadow-md'
                      : localVoted !== null
                        ? 'bg-[#FAF7F2] border-[#EAE4DC] text-[#9CA3AF]'
                        : 'bg-[#FF6B57] hover:bg-[#F25743] border-[#FF6B57] text-white shadow-md'
                  }`}
                >
                  <span>{isSolo ? '😂 J’ai bougé !' : '😂 Il/Elle a bougé !'}</span>
                </button>
                <button
                  type="button"
                  data-testid="freeze-vote-statue"
                  disabled={localVoted !== null}
                  onClick={() => handleVoteVerdict('statue')}
                  className={`min-h-[54px] rounded-2xl px-3 py-2 font-extrabold text-xs sm:text-base border transition-all flex items-center justify-center gap-1.5 ${
                    localVoted === 'statue'
                      ? 'bg-[#16A34A] border-[#16A34A] text-white shadow-md'
                      : localVoted !== null
                        ? 'bg-[#FAF7F2] border-[#EAE4DC] text-[#9CA3AF]'
                        : 'bg-[#16A34A] hover:bg-[#15803D] border-[#16A34A] text-white shadow-md'
                  }`}
                >
                  <span>🗿 Statue parfaite !</span>
                </button>
              </div>
            )}

            {state.phase === 'VERDICT' && state.lastVerdictSummary && (
              <div className="rounded-2xl bg-white border border-[#EAE4DC] px-4 py-2.5 text-center space-y-1 shadow-xs">
                <p className="text-xs sm:text-sm font-extrabold text-[#1F242D]">
                  {state.lastVerdictSummary}
                </p>
                {state.activeDareText && (
                  <p className="text-xs sm:text-sm font-bold text-[#FF6B57]">
                    🎭 Gage rigolo : {state.activeDareText}
                  </p>
                )}
              </div>
            )}

            {state.phase === 'DANCING' && (
              <div className="rounded-2xl bg-white border border-[#EAE4DC] px-3.5 py-2 text-center text-xs sm:text-sm font-semibold text-[#6B7280] shadow-xs">
                🎵 La musique peut couper à tout moment… reste prêt(e) à te figer !
              </div>
            )}

            {state.phase === 'FREEZE' && (
              <div className="rounded-2xl bg-white border border-[#7DD3FC] px-3.5 py-2 text-center text-xs sm:text-sm font-extrabold text-[#0284C7] shadow-xs">
                ❄️ Interdiction de cligner ou de bouger pendant {freezeCountdownSec}s !
              </div>
            )}
          </div>
        </div>
      )}

      {/* VICTORY / GAME OVER SCREEN */}
      {state.phase === 'GAME_OVER' && (
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
            <div className="w-16 h-16 mx-auto rounded-full bg-[#E6F3FC] border border-[#CCE5F7] flex items-center justify-center shadow-sm">
              {state.winner === 'draw' ? (
                <Sparkles className="w-8 h-8 text-[#FF6B57]" />
              ) : (
                <Crown className="w-8 h-8 text-[#D97706]" />
              )}
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F242D]">{winnerBanner}</h2>
              {state.activeDareText && (
                <p className="text-xs sm:text-sm font-bold text-[#FF6B57]">
                  🎭 Dernier gage : {state.activeDareText}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#FFE8E2]/60 border border-[#FFD6CC] p-3.5">
                <p className="text-xs font-bold text-[#6B7280] truncate">{localName}</p>
                <p className="text-2xl font-black text-[#FF6B57] tabular-nums mt-1">
                  {state.format === 'lives-3' ? `❤️ ${localLives}` : `⭐ ${localPoints}`}
                </p>
                <p className="text-[11px] text-[#6B7280]">
                  {state.format === 'lives-3' ? `Style : 🗿 ${localPoints}` : 'points'}
                </p>
              </div>
              <div className="rounded-2xl bg-[#EFE9FB]/80 border border-[#DDD4F7] p-3.5">
                <p className="text-xs font-bold text-[#6B7280] truncate">{partnerName}</p>
                <p className="text-2xl font-black text-[#7C5CFC] tabular-nums mt-1">
                  {state.format === 'lives-3' ? `❤️ ${partnerLives}` : `⭐ ${partnerPoints}`}
                </p>
                <p className="text-[11px] text-[#6B7280]">
                  {state.format === 'lives-3' ? `Style : 🗿 ${partnerPoints}` : 'points'}
                </p>
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
