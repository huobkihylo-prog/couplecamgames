import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { RefreshCw, Play, RotateCcw, Smile, Trophy, LayoutGrid } from 'lucide-react';
import { motion } from 'motion/react';
import type {
  ConnectionMode,
  FaceMetrics,
  LaughGameState,
  LaughSensitivity,
  PeerMessage,
  TrackerStatus,
} from '../types/duoplay';
import {
  classifySmileState,
  createInitialLaughState,
  findPromptById,
  getNextPrompt,
  getSmileStateLabel,
  getSmileThreshold,
  SENSITIVITY_CONFIG,
  startLaughRound,
  stepLaughGame,
} from '../game/laughRules';
import { soundFx } from '../utils/soundFx';
import { CameraFeedTile } from './CameraFeedTile';

interface LaughGameViewProps {
  localName: string;
  partnerName: string;
  connectionMode: ConnectionMode;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  cameraEnabled: boolean;
  micMuted: boolean;
  trackerStatus: TrackerStatus;
  localMetricsRef: MutableRefObject<FaceMetrics>;
  partnerMetricsRef: MutableRefObject<FaceMetrics>;
  onVideoRef: (el: HTMLVideoElement | null) => void;
  onRequestCamera: () => void;
  onSendPeerMessage: (msg: PeerMessage) => void;
  registerPeerHandler: (handler: ((msg: PeerMessage) => void) | null) => void;
  onAiContextChange: (ctx: { isPlaying: boolean; sensitivity: LaughSensitivity; promptImpulse: number }) => void;
  onAiResetRound: () => void;
  onMatchProgress: () => void;
  onReturnToHub: () => void;
  onManualSmileChange: (active: boolean) => void;
}

export function LaughGameView({
  localName,
  partnerName,
  connectionMode,
  localStream,
  remoteStream,
  cameraEnabled,
  micMuted,
  trackerStatus,
  localMetricsRef,
  partnerMetricsRef,
  onVideoRef,
  onRequestCamera,
  onSendPeerMessage,
  registerPeerHandler,
  onAiContextChange,
  onAiResetRound,
  onMatchProgress,
  onReturnToHub,
  onManualSmileChange,
}: LaughGameViewProps) {
  const isSolo = connectionMode === 'solo';
  const [gameState, setGameState] = useState<LaughGameState>(() => createInitialLaughState('normal'));
  const gameStateRef = useRef<LaughGameState>(gameState);

  const commitGameState = (updater: LaughGameState | ((prev: LaughGameState) => LaughGameState)) => {
    const next =
      typeof updater === 'function' ? updater(gameStateRef.current) : updater;
    gameStateRef.current = next;
    setGameState(next);
  };

  // Lightweight display state for non-hue labels & integer percentages (throttled to ~12Hz)
  const [meterDisplay, setMeterDisplay] = useState({
    localSmile: 0,
    partnerSmile: 0,
    localStatus: 'calm' as 'calm' | 'twitch' | 'cracking',
    partnerStatus: 'calm' as 'calm' | 'twitch' | 'cracking',
    elapsedSec: 0,
    countdownInt: 3,
  });
  const [isHoldingSmileTest, setIsHoldingSmileTest] = useState(false);

  // Direct DOM refs for 60fps smooth progress bars
  const localBarRef = useRef<HTMLDivElement | null>(null);
  const partnerBarRef = useRef<HTMLDivElement | null>(null);

  const localNameRef = useRef(localName);
  localNameRef.current = localName;
  const partnerNameRef = useRef(partnerName);
  partnerNameRef.current = partnerName;

  // Sync body state attribute for observability
  useEffect(() => {
    if (gameState.phase === 'playing' || gameState.phase === 'countdown') {
      document.body.dataset.state = 'playing';
    } else if (gameState.phase === 'match_over') {
      document.body.dataset.state = 'gameover';
    } else {
      document.body.dataset.state = 'title';
    }
  }, [gameState.phase]);

  // Keep AI partner aware of active round & sensitivity
  useEffect(() => {
    onAiContextChange({
      isPlaying: gameState.phase === 'playing',
      sensitivity: gameState.sensitivity,
      promptImpulse: 0,
    });
  }, [gameState.phase, gameState.sensitivity, onAiContextChange]);

  // Register PeerJS handler for synchronized laugh events
  useEffect(() => {
    registerPeerHandler((msg) => {
      if (msg.type === 'LAUGH_START_ROUND') {
        const prompt = findPromptById(msg.promptId);
        soundFx.countdownTick();
        commitGameState((prev) => ({
          ...startLaughRound({ ...prev, sensitivity: msg.sensitivity }, prompt),
          round: msg.round,
        }));
      } else if (msg.type === 'LAUGH_CHANGE_PROMPT') {
        const prompt = findPromptById(msg.promptId);
        soundFx.click();
        commitGameState((prev) => ({ ...prev, currentPrompt: prompt }));
      } else if (msg.type === 'LAUGH_SET_SENSITIVITY') {
        commitGameState((prev) => ({ ...prev, sensitivity: msg.sensitivity }));
      } else if (msg.type === 'LAUGH_RESET_MATCH') {
        commitGameState(createInitialLaughState(gameStateRef.current.sensitivity));
      } else if (msg.type === 'LAUGH_CRACKED') {
        // Partner reports cracking on their authoritative local FaceLandmarker
        const curr = gameStateRef.current;
        if (curr.phase === 'playing' || curr.phase === 'countdown') {
          soundFx.roundWin();
          onMatchProgress();
          const localScore = curr.localScore + 1;
          const isMatchOver = localScore >= curr.targetWins;
          commitGameState({
            ...curr,
            phase: isMatchOver ? 'match_over' : 'round_over',
            localScore,
            lastWinner: 'local',
            lastCrackedReason: `${partnerNameRef.current} a craqué après ${msg.elapsedSec.toFixed(1)} s !`,
            history: [
              ...curr.history,
              {
                round: curr.round,
                winner: 'local',
                durationSec: Math.round(msg.elapsedSec * 10) / 10,
                crackedBy: partnerNameRef.current,
              },
            ],
          });
        }
      }
    });
    return () => registerPeerHandler(null);
  }, [registerPeerHandler, onMatchProgress]);

  // Keyboard shortcut: hold Space to test smile when playing (great without physical camera)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'BUTTON') {
        e.preventDefault();
        setIsHoldingSmileTest(true);
        onManualSmileChange(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsHoldingSmileTest(false);
        onManualSmileChange(false);
      }
    };
    const onBlur = () => {
      setIsHoldingSmileTest(false);
      onManualSmileChange(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      onManualSmileChange(false);
    };
  }, [onManualSmileChange]);

  // Main simulation & DOM meter loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let lastHudSync = 0;

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) * 0.001));
      lastTime = now;

      const localSmile = localMetricsRef.current.smileScore;
      const partnerSmile = partnerMetricsRef.current.smileScore;

      // Update 60fps scaleX bars via DOM refs
      if (localBarRef.current) {
        localBarRef.current.style.transform = `scaleX(${Math.max(0.01, localSmile / 100)})`;
      }
      if (partnerBarRef.current) {
        partnerBarRef.current.style.transform = `scaleX(${Math.max(0.01, partnerSmile / 100)})`;
      }

      const curr = gameStateRef.current;
      if (curr.phase === 'countdown' || curr.phase === 'playing') {
        // In P2P mode, each side authoritatively detects its own crack via local FaceLandmarker
        // and notifies partner; in Solo mode we evaluate both local & AI partner here.
        const effectivePartnerSmile = isSolo ? partnerSmile : 0;
        const { nextState, event } = stepLaughGame(
          curr,
          localSmile,
          effectivePartnerSmile,
          dt,
          localNameRef.current,
          partnerNameRef.current,
        );

        gameStateRef.current = nextState;

        if (event === 'countdown_tick') {
          soundFx.countdownTick();
          setGameState(nextState);
        } else if (event === 'go') {
          soundFx.countdownGo();
          setGameState(nextState);
        } else if (event === 'round_end') {
          onMatchProgress();
          if (nextState.lastWinner === 'local') {
            soundFx.roundWin();
          } else {
            soundFx.crackBuzzer();
            if (!isSolo) {
              onSendPeerMessage({ type: 'LAUGH_CRACKED', elapsedSec: nextState.elapsedSec });
            }
          }
          setGameState(nextState);
        }
      }

      if (now - lastHudSync >= 85) {
        lastHudSync = now;
        const s = gameStateRef.current;
        setMeterDisplay({
          localSmile,
          partnerSmile,
          localStatus: classifySmileState(localSmile, s.sensitivity),
          partnerStatus: classifySmileState(partnerSmile, s.sensitivity),
          elapsedSec: s.elapsedSec,
          countdownInt: Math.max(1, Math.ceil(s.countdownSec)),
        });
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isSolo, localMetricsRef, partnerMetricsRef, onSendPeerMessage, onMatchProgress]);

  const handleStartRound = () => {
    const curr = gameStateRef.current;
    const nextPrompt =
      curr.phase === 'ready' ? curr.currentPrompt : getNextPrompt(curr.currentPrompt.id);
    const next = startLaughRound(curr, nextPrompt);
    soundFx.countdownTick();
    if (isSolo) onAiResetRound();
    commitGameState(next);
    onSendPeerMessage({
      type: 'LAUGH_START_ROUND',
      promptId: next.currentPrompt.id,
      sensitivity: next.sensitivity,
      round: next.round,
    });
  };

  const handleNewPrompt = () => {
    const curr = gameStateRef.current;
    const nextPrompt = getNextPrompt(curr.currentPrompt.id);
    soundFx.click();
    commitGameState((prev) => ({ ...prev, currentPrompt: nextPrompt }));
    onSendPeerMessage({ type: 'LAUGH_CHANGE_PROMPT', promptId: nextPrompt.id });
    if (isSolo && curr.phase === 'playing') {
      // Sending a funny new challenge makes Camille IA struggle not to laugh!
      onAiContextChange({
        isPlaying: true,
        sensitivity: curr.sensitivity,
        promptImpulse: 18,
      });
    }
  };

  const handleSelectSensitivity = (sensitivity: LaughSensitivity) => {
    soundFx.click();
    commitGameState((prev) => ({ ...prev, sensitivity }));
    onSendPeerMessage({ type: 'LAUGH_SET_SENSITIVITY', sensitivity });
  };

  const handleResetMatch = () => {
    soundFx.click();
    const curr = gameStateRef.current;
    const fresh = createInitialLaughState(curr.sensitivity, getNextPrompt(curr.currentPrompt.id));
    commitGameState(fresh);
    if (isSolo) onAiResetRound();
    onSendPeerMessage({ type: 'LAUGH_RESET_MATCH' });
  };

  const threshold = getSmileThreshold(gameState.sensitivity);

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-2.5 sm:px-6 py-2.5 sm:py-6 flex flex-col gap-3 sm:gap-5">
      {/* Top Scoreboard & Sensitivity Strip */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-4 pb-2.5 sm:pb-4 border-b border-[#EAE4DC]">
        <div className="flex items-center justify-between gap-2 md:block">
          <div>
            <h1 className="text-lg sm:text-3xl font-extrabold text-[#1F242D] tracking-tight">
              Tu ris, tu perds
            </h1>
            <p className="text-[11px] sm:text-sm text-[#6B7280] mt-0.5 tabular-nums font-medium">
              Manche {gameState.round} · Premier à {gameState.targetWins} points
              {gameState.phase === 'playing' && ` · Chrono ${meterDisplay.elapsedSec.toFixed(1)} s`}
            </p>
          </div>
          {/* Compact Score on Mobile Row 1 */}
          <div
            className="flex md:hidden items-center gap-3 px-3 py-1.5 rounded-xl bg-white border border-[#EAE4DC] shadow-sm shrink-0"
            aria-label="Score du duel"
          >
            <div className="text-center">
              <p className="text-[10px] text-[#6B7280] font-semibold truncate max-w-[54px]">{localName}</p>
              <p className="font-mono text-lg font-extrabold text-[#FF6B57] tabular-nums leading-none">
                {gameState.localScore}
              </p>
            </div>
            <span className="text-sm font-mono text-[#D1C9BE]" aria-hidden="true">—</span>
            <div className="text-center">
              <p className="text-[10px] text-[#6B7280] font-semibold truncate max-w-[54px]">{partnerName}</p>
              <p className="font-mono text-lg font-extrabold text-[#7C5CFC] tabular-nums leading-none">
                {gameState.partnerScore}
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Score Readout */}
        <div
          className="hidden md:flex items-center gap-6 px-5 py-2.5 rounded-2xl bg-white border border-[#EAE4DC] shadow-[0_4px_16px_rgba(31,36,45,0.05)] self-start md:self-auto"
          aria-label="Score du duel"
        >
          <div className="text-center min-w-[68px]">
            <p className="text-xs text-[#6B7280] font-semibold truncate max-w-[96px]">{localName}</p>
            <p
              data-testid="laugh-local-score"
              className="font-mono text-2xl font-extrabold text-[#FF6B57] tabular-nums leading-tight"
            >
              {gameState.localScore}
            </p>
          </div>
          <span className="text-lg font-mono text-[#D1C9BE]" aria-hidden="true">
            —
          </span>
          <div className="text-center min-w-[68px]">
            <p className="text-xs text-[#6B7280] font-semibold truncate max-w-[96px]">{partnerName}</p>
            <p
              data-testid="laugh-partner-score"
              className="font-mono text-2xl font-extrabold text-[#7C5CFC] tabular-nums leading-tight"
            >
              {gameState.partnerScore}
            </p>
          </div>
        </div>

        {/* Interactive Sensitivity Segmented Control */}
        <div className="relative flex items-center gap-1 p-1 rounded-xl bg-white border border-[#EAE4DC] shadow-sm self-start md:self-auto">
          {(['facile', 'normal', 'implacable'] as LaughSensitivity[]).map((lvl) => {
            const active = gameState.sensitivity === lvl;
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => handleSelectSensitivity(lvl)}
                className={`relative z-10 min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  active ? 'text-white' : 'text-[#6B7280] hover:text-[#1F242D]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="couplecam-laugh-sensitivity"
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-0 -z-10 rounded-lg bg-[#FF6B57] shadow-sm"
                  />
                )}
                {SENSITIVITY_CONFIG[lvl].label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Face-Off Video Stage — side-by-side on mobile too so controls fit above the fold */}
      <section className="relative grid grid-cols-2 gap-2.5 sm:gap-5">
        {/* Local Player Card */}
        <div className="space-y-3">
          <CameraFeedTile
            name={localName}
            subtitle={
              localStream && trackerStatus === 'ready'
                ? 'FaceLandmarker actif'
                : localStream && trackerStatus === 'loading'
                  ? 'Chargement de MediaPipe...'
                  : 'Contrôle sourire manuel (Espace ou bouton)'
            }
            stream={localStream}
            isLocal
            cameraEnabled={cameraEnabled}
            micMuted={micMuted}
            trackerStatus={trackerStatus}
            showTrackingReadout
            metricsRef={localMetricsRef}
            onVideoRef={onVideoRef}
            onRequestCamera={onRequestCamera}
            highlightState={
              meterDisplay.localStatus === 'cracking'
                ? 'danger'
                : meterDisplay.localStatus === 'twitch'
                  ? 'warning'
                  : 'neutral'
            }
          />

          {/* Local Smile Gauge */}
          <div className="rounded-2xl bg-white border border-[#EAE4DC] shadow-[0_4px_16px_rgba(31,36,45,0.05)] p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="font-semibold text-[#1F242D]">
                Jauge sourire ·{' '}
                <span
                  className={
                    meterDisplay.localStatus === 'cracking'
                      ? 'text-[#E11D48] font-bold'
                      : meterDisplay.localStatus === 'twitch'
                        ? 'text-[#D97706] font-bold'
                        : 'text-[#059669] font-bold'
                  }
                >
                  {getSmileStateLabel(meterDisplay.localStatus)}
                </span>
              </span>
              <span className="font-mono font-bold text-[#1F242D] tabular-nums">
                {meterDisplay.localSmile} % / {threshold} %
              </span>
            </div>
            <div className="relative h-3 rounded-full bg-[#F3EFE8] border border-[#EAE4DC] overflow-hidden">
              <div
                ref={localBarRef}
                className="h-full w-full origin-left rounded-full transition-colors"
                style={{
                  transform: 'scaleX(0.02)',
                  backgroundColor:
                    meterDisplay.localStatus === 'cracking'
                      ? '#FF6B57'
                      : meterDisplay.localStatus === 'twitch'
                        ? '#F59E0B'
                        : '#10B981',
                }}
              />
              {/* Threshold marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-[#1F242D]/60"
                style={{ left: `${threshold}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        {/* Partner Card */}
        <div className="space-y-3">
          <CameraFeedTile
            name={partnerName}
            subtitle={isSolo ? 'Partenaire IA · Réagit aux défis' : 'Flux en direct'}
            stream={remoteStream}
            isAi={isSolo}
            metricsRef={partnerMetricsRef}
            highlightState={
              meterDisplay.partnerStatus === 'cracking'
                ? 'danger'
                : meterDisplay.partnerStatus === 'twitch'
                  ? 'warning'
                  : 'neutral'
            }
          />

          {/* Partner Smile Gauge */}
          <div className="rounded-2xl bg-white border border-[#EAE4DC] shadow-[0_4px_16px_rgba(31,36,45,0.05)] p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="font-semibold text-[#1F242D]">
                {partnerName} ·{' '}
                <span
                  className={
                    meterDisplay.partnerStatus === 'cracking'
                      ? 'text-[#E11D48] font-bold'
                      : meterDisplay.partnerStatus === 'twitch'
                        ? 'text-[#D97706] font-bold'
                        : 'text-[#059669] font-bold'
                  }
                >
                  {getSmileStateLabel(meterDisplay.partnerStatus)}
                </span>
              </span>
              <span className="font-mono font-bold text-[#1F242D] tabular-nums">
                {meterDisplay.partnerSmile} % / {threshold} %
              </span>
            </div>
            <div className="relative h-3 rounded-full bg-[#F3EFE8] border border-[#EAE4DC] overflow-hidden">
              <div
                ref={partnerBarRef}
                className="h-full w-full origin-left rounded-full transition-colors"
                style={{
                  transform: 'scaleX(0.02)',
                  backgroundColor:
                    meterDisplay.partnerStatus === 'cracking'
                      ? '#FF6B57'
                      : meterDisplay.partnerStatus === 'twitch'
                        ? '#F59E0B'
                        : '#10B981',
                }}
              />
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-[#1F242D]/60"
                style={{ left: `${threshold}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        {/* Countdown Overlay */}
        {gameState.phase === 'countdown' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#FAF7F2]/75 backdrop-blur-sm rounded-2xl">
            <div className="text-center space-y-2 px-8 py-6 rounded-3xl bg-white border-2 border-[#FF6B57]/35 shadow-[0_12px_36px_rgba(31,36,45,0.12)]">
              <p className="text-sm font-bold text-[#FF6B57]">Garde ton sérieux...</p>
              <p className="font-mono text-6xl font-extrabold text-[#1F242D] tabular-nums">
                {meterDisplay.countdownInt}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Bottom Interactive Prompt Deck & Primary Actions */}
      <section className="rounded-3xl bg-white border border-[#EAE4DC] shadow-[0_6px_24px_rgba(31,36,45,0.06)] p-3.5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-5">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-bold text-[#7C5CFC]">
            Défi complicité · {gameState.currentPrompt.category}
          </p>
          <p data-testid="laugh-prompt-text" className="text-sm sm:text-lg font-bold text-[#1F242D] leading-snug">
            « {gameState.currentPrompt.text} »
          </p>
        </div>

        <div className="w-full lg:w-auto flex flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={handleNewPrompt}
            className="min-h-[48px] sm:min-h-[52px] inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-bold bg-[#FAF7F2] text-[#1F242D] border border-[#EAE4DC] hover:bg-[#F1ECE3] transition-colors whitespace-nowrap"
          >
            <RefreshCw className="w-4 h-4 shrink-0 text-[#7C5CFC]" />
            <span>Nouveau défi</span>
          </button>

          {gameState.phase === 'ready' && (
            <button
              type="button"
              data-start="true"
              onClick={handleStartRound}
              className="flex-1 sm:flex-none min-h-[48px] sm:min-h-[54px] inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-2xl text-sm font-extrabold bg-[#FF6B57] text-white hover:bg-[#F25743] shadow-md shadow-[#FF6B57]/20 transition-colors whitespace-nowrap"
            >
              <Play className="w-4 h-4 shrink-0" />
              <span>Lancer la manche</span>
            </button>
          )}

          {gameState.phase === 'playing' && (
            <button
              type="button"
              onMouseDown={() => {
                setIsHoldingSmileTest(true);
                onManualSmileChange(true);
              }}
              onMouseUp={() => {
                setIsHoldingSmileTest(false);
                onManualSmileChange(false);
              }}
              onMouseLeave={() => {
                if (isHoldingSmileTest) {
                  setIsHoldingSmileTest(false);
                  onManualSmileChange(false);
                }
              }}
              onTouchStart={() => {
                setIsHoldingSmileTest(true);
                onManualSmileChange(true);
              }}
              onTouchEnd={() => {
                setIsHoldingSmileTest(false);
                onManualSmileChange(false);
              }}
              className={`min-h-[54px] inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-sm font-bold border transition-colors whitespace-nowrap ${
                isHoldingSmileTest
                  ? 'bg-[#FF6B57] text-white border-[#FF6B57]'
                  : 'bg-[#FFE8E2] text-[#C84331] border-[#FF6B57]/35 hover:bg-[#FFDAD0]'
              }`}
            >
              <Smile className="w-4 h-4 shrink-0" />
              <span>Simuler un rire (maintenir)</span>
            </button>
          )}
        </div>
      </section>

      {/* Round Over / Match Over Focused Modal */}
      {(gameState.phase === 'round_over' || gameState.phase === 'match_over') && (
        <div
          className="fixed inset-0 z-40 flex justify-center bg-[#1F242D]/45 backdrop-blur-sm p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="laugh-result-heading"
        >
          <div className="my-auto w-full max-w-md rounded-3xl bg-white border border-[#EAE4DC] p-5 sm:p-7 space-y-5 shadow-2xl">
            <div className="space-y-1.5 text-center">
              {gameState.phase === 'match_over' && (
                <div className="mx-auto w-12 h-12 rounded-2xl bg-[#FEF6DC] border border-[#F5D782] flex items-center justify-center text-[#D97706] mb-2">
                  <Trophy className="w-6 h-6" />
                </div>
              )}
              <p className="text-xs font-bold uppercase tracking-wider text-[#FF6B57]">
                {gameState.phase === 'match_over' ? 'Fin de la partie' : `Fin de la manche ${gameState.round}`}
              </p>
              <h2 id="laugh-result-heading" className="text-2xl font-extrabold text-[#1F242D]">
                {gameState.lastWinner === 'local'
                  ? `Point pour ${localName} !`
                  : gameState.lastWinner === 'partner'
                    ? `Point pour ${partnerName} !`
                    : 'Double fou rire !'}
              </h2>
              <p className="text-sm text-[#6B7280]">{gameState.lastCrackedReason}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-[#FAF7F2] border border-[#EAE4DC] p-4 text-center">
              <div>
                <p className="text-xs text-[#6B7280] font-semibold">{localName}</p>
                <p className="font-mono text-2xl font-extrabold text-[#FF6B57] tabular-nums">
                  {gameState.localScore}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] font-semibold">{partnerName}</p>
                <p className="font-mono text-2xl font-extrabold text-[#7C5CFC] tabular-nums">
                  {gameState.partnerScore}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                data-start="true"
                onClick={gameState.phase === 'match_over' ? handleResetMatch : handleStartRound}
                className="flex-1 min-h-[52px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-extrabold bg-[#FF6B57] text-white hover:bg-[#F25743] shadow-md shadow-[#FF6B57]/20 transition-colors whitespace-nowrap"
              >
                {gameState.phase === 'match_over' ? (
                  <>
                    <RotateCcw className="w-4 h-4 shrink-0" />
                    <span>Rejouer</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 shrink-0" />
                    <span>Manche suivante</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onReturnToHub}
                className="min-h-[50px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold bg-[#FAF7F2] text-[#1F242D] border border-[#EAE4DC] hover:bg-[#F1ECE3] transition-colors whitespace-nowrap"
              >
                <LayoutGrid className="w-4 h-4 shrink-0" />
                <span>Changer de jeu</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
