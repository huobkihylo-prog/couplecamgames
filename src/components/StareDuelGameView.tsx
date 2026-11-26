import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  Bug,
  Eye,
  EyeOff,
  LayoutGrid,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import type {
  ConnectionMode,
  FaceMetrics,
  PeerMessage,
  StareDuelState,
  StareTrapKind,
  TrackerStatus,
} from '../types/duoplay';
import {
  createInitialStareDuelState,
  createStareAiMemory,
  detectEyeBlink,
  DISTRACTION_COOLDOWN_SEC,
  startStareRound,
  stepAiStarePartner,
  stepStareDuel,
  triggerVisualTrap,
} from '../game/stareDuelLogic';
import { useI18n } from '../i18n/LanguageContext';
import { soundFx } from '../utils/soundFx';
import { CameraFeedTile } from './CameraFeedTile';

interface StareDuelGameViewProps {
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
  bestStareSec: number;
  onUpdateBestStare: (sec: number) => void;
  onVideoRef: (el: HTMLVideoElement | null) => void;
  onRequestCamera: () => void;
  onSendPeerMessage: (msg: PeerMessage) => void;
  registerPeerHandler: (handler: ((msg: PeerMessage) => void) | null) => void;
  onReturnToHub: () => void;
}

export function StareDuelGameView({
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
  bestStareSec,
  onUpdateBestStare,
  onVideoRef,
  onRequestCamera,
  onSendPeerMessage,
  registerPeerHandler,
  onReturnToHub,
}: StareDuelGameViewProps) {
  const { t } = useI18n();
  const isSolo = connectionMode === 'solo';

  const simRef = useRef<StareDuelState>(createInitialStareDuelState(bestStareSec));
  const aiMemRef = useRef(createStareAiMemory());
  const pendingAiDistractionRef = useRef(0);
  const manualBlinkRef = useRef(false);
  const partnerBlinkedRef = useRef(false);
  const lastSentBlinkRef = useRef<boolean>(false);

  const [hud, setHud] = useState(() => ({
    phase: simRef.current.phase,
    round: 1,
    targetWins: simRef.current.targetWins,
    localScore: 0,
    partnerScore: 0,
    countdownInt: 3,
    elapsedSec: 0,
    bestStareSec,
    nextAutoTrapInt: 5,
    activeTrap: null as StareTrapKind | null,
    activeTrapProgress: 0,
    distractionCooldownSec: 0,
    lastWinner: null as StareDuelState['lastWinner'],
    lastRoundDurationSec: 0,
    localEyeRatio: 0,
    partnerEyeRatio: 0,
  }));

  const [flyPos, setFlyPos] = useState({ x: 50, y: 50, rot: 0 });
  const [partnerDistractedFlash, setPartnerDistractedFlash] = useState(false);

  const syncHud = useCallback((st: StareDuelState, localEyeRatio: number, partnerEyeRatio: number) => {
    setHud({
      phase: st.phase,
      round: st.round,
      targetWins: st.targetWins,
      localScore: st.localScore,
      partnerScore: st.partnerScore,
      countdownInt: Math.max(1, Math.ceil(st.countdownSec)),
      elapsedSec: st.elapsedSec,
      bestStareSec: st.bestStareSec,
      nextAutoTrapInt: Math.max(1, Math.ceil(st.nextAutoTrapSec)),
      activeTrap: st.activeTrap,
      activeTrapProgress: st.activeTrap
        ? st.activeTrapTimerSec / (st.activeTrap === 'fly' ? 3.2 : 0.9)
        : 0,
      distractionCooldownSec: st.distractionCooldownSec,
      lastWinner: st.lastWinner,
      lastRoundDurationSec: st.lastRoundDurationSec,
      localEyeRatio,
      partnerEyeRatio,
    });
  }, []);

  const launchRound = useCallback(
    (broadcast = true) => {
      soundFx.countdownTick();
      manualBlinkRef.current = false;
      partnerBlinkedRef.current = false;
      lastSentBlinkRef.current = false;
      aiMemRef.current = createStareAiMemory();
      pendingAiDistractionRef.current = 0;

      const next = startStareRound(simRef.current);
      simRef.current = next;
      syncHud(next, 0, 0);

      if (broadcast && !isSolo) {
        onSendPeerMessage({ type: 'STARE_START' });
        onSendPeerMessage({ type: 'STARE_BLINK', hasBlinked: false });
      }
    },
    [isSolo, onSendPeerMessage, syncHud],
  );

  const sendDistraction = useCallback(() => {
    const cur = simRef.current;
    if (cur.phase !== 'playing' || cur.distractionCooldownSec > 0) return;

    const kind: StareTrapKind = Math.random() < 0.55 ? 'fly' : 'flash';
    simRef.current = { ...cur, distractionCooldownSec: DISTRACTION_COOLDOWN_SEC };
    soundFx.click();
    setPartnerDistractedFlash(true);
    window.setTimeout(() => setPartnerDistractedFlash(false), 650);

    if (isSolo) {
      // Sending a distraction rattles Camille IA significantly!
      pendingAiDistractionRef.current += 3.2;
    } else {
      onSendPeerMessage({ type: 'STARE_DISTRACTION', kind });
    }
  }, [isSolo, onSendPeerMessage]);

  // Register PeerJS handler for Stare Duel (strictly handles hasBlinked: boolean + distractions)
  useEffect(() => {
    registerPeerHandler((msg) => {
      if (msg.type === 'STARE_START') {
        launchRound(false);
      } else if (msg.type === 'STARE_RESET') {
        const fresh = createInitialStareDuelState(simRef.current.bestStareSec);
        simRef.current = fresh;
        syncHud(fresh, 0, 0);
      } else if (msg.type === 'STARE_BLINK') {
        partnerBlinkedRef.current = Boolean(msg.hasBlinked);
      } else if (msg.type === 'STARE_DISTRACTION') {
        if (simRef.current.phase === 'playing') {
          simRef.current = triggerVisualTrap(simRef.current, msg.kind);
          if (msg.kind === 'fly') soundFx.flyBuzz();
          else soundFx.distractionFlash();
        }
      }
    });
    return () => registerPeerHandler(null);
  }, [launchRound, registerPeerHandler, syncHud]);

  // Sync body state attribute
  useEffect(() => {
    if (hud.phase === 'playing' || hud.phase === 'countdown') {
      document.body.dataset.state = 'playing';
    } else if (hud.phase === 'match_over') {
      document.body.dataset.state = 'gameover';
    } else {
      document.body.dataset.state = 'title';
    }
  }, [hud.phase]);

  // Keyboard shortcuts (Space to test blink during play, Enter to start)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        if (simRef.current.phase === 'playing') {
          e.preventDefault();
          manualBlinkRef.current = true;
        } else if (simRef.current.phase === 'ready' || simRef.current.phase === 'round_over' || simRef.current.phase === 'match_over') {
          e.preventDefault();
          launchRound(true);
        }
      } else if (e.key === 'Enter') {
        if (simRef.current.phase === 'ready' || simRef.current.phase === 'round_over' || simRef.current.phase === 'match_over') {
          e.preventDefault();
          launchRound(true);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        manualBlinkRef.current = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [launchRound]);

  // Main requestAnimationFrame loop (cleanly cancelled on unmount)
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let lastHudUpdate = 0;

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      if (now - lastTime < 28) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) * 0.001));
      lastTime = now;

      const cur = simRef.current;
      const localFace = localMetricsRef.current;
      const localHasBlinked = detectEyeBlink(
        localFace.eyeBlinkLeft,
        localFace.eyeBlinkRight,
        manualBlinkRef.current,
      );
      const localEyeRatio = manualBlinkRef.current
        ? 1
        : Math.max(localFace.eyeBlinkLeft, localFace.eyeBlinkRight);

      let partnerHasBlinked = partnerBlinkedRef.current;
      let partnerEyeRatio = partnerHasBlinked ? 1 : 0.06;

      if (isSolo) {
        const impulse = pendingAiDistractionRef.current;
        pendingAiDistractionRef.current = 0;
        const aiRes = stepAiStarePartner(
          aiMemRef.current,
          cur.phase === 'playing',
          impulse,
          dt,
        );
        aiMemRef.current = aiRes.nextMemory;
        partnerHasBlinked = aiRes.hasBlinked;
        partnerEyeRatio = aiRes.blinkRatio;
      }

      // Strictly send only lightweight boolean hasBlinked: true/false over PeerJS on transitions
      if (!isSolo && cur.phase === 'playing' && localHasBlinked !== lastSentBlinkRef.current) {
        lastSentBlinkRef.current = localHasBlinked;
        onSendPeerMessage({
          type: 'STARE_BLINK',
          hasBlinked: localHasBlinked,
          elapsedSec: cur.elapsedSec,
        });
      }

      const step = stepStareDuel(cur, localHasBlinked, partnerHasBlinked, dt);
      simRef.current = step.nextState;

      if (step.event === 'countdown_tick') {
        soundFx.countdownTick();
      } else if (step.event === 'go') {
        soundFx.countdownGo();
      } else if (step.event === 'auto_trap') {
        if (step.triggeredTrap === 'fly') soundFx.flyBuzz();
        else if (step.triggeredTrap === 'flash') soundFx.distractionFlash();
      } else if (step.event === 'local_blinked') {
        soundFx.crackBuzzer();
        if (!isSolo) {
          onSendPeerMessage({
            type: 'STARE_BLINK',
            hasBlinked: true,
            elapsedSec: step.nextState.elapsedSec,
          });
        }
      } else if (step.event === 'partner_blinked') {
        soundFx.roundWin();
      }

      if (step.nextState.bestStareSec > bestStareSec) {
        onUpdateBestStare(step.nextState.bestStareSec);
      }

      // Animate virtual fly buzzing erratically across the nose/eyes when active
      if (step.nextState.activeTrap === 'fly') {
        const s = now * 0.0055;
        const fx = 50 + Math.sin(s * 1.45) * 26 + Math.cos(s * 3.1) * 9;
        const fy = 46 + Math.cos(s * 1.9) * 18 + Math.sin(s * 2.7) * 8;
        const rot = Math.cos(s * 2.2) * 35;
        setFlyPos({ x: fx, y: fy, rot });
      }

      if (now - lastHudUpdate > 75 || step.event !== 'none') {
        lastHudUpdate = now;
        syncHud(step.nextState, localEyeRatio, partnerEyeRatio);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    bestStareSec,
    isSolo,
    localMetricsRef,
    onSendPeerMessage,
    onUpdateBestStare,
    syncHud,
  ]);

  const sensorHint =
    localStream && trackerStatus === 'ready' ? t.stareSensorReady : t.stareSensorFallback;

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-2.5 sm:px-6 py-2.5 sm:py-4 space-y-3 sm:space-y-5">
      {/* Top Scoreboard & Central Precision Stopwatch */}
      <section className="rounded-3xl bg-white border border-[#EAE4DC] p-3 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4 shadow-[0_6px_24px_rgba(31,36,45,0.06)]">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#FFE8E2] border border-[#FF6B57]/30 flex items-center justify-center text-[#FF6B57] shrink-0">
            <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-xl font-extrabold text-[#1F242D] leading-tight">
              {t.stareTitle}
            </h1>
            <p className="hidden sm:block text-xs text-[#6B7280] font-medium">{sensorHint}</p>
          </div>
        </div>

        {/* Live Stopwatch + Score */}
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="text-center">
            <p className="text-[10.5px] sm:text-[11px] uppercase tracking-wider font-bold text-[#6B7280]">
              {t.roundLabel} {hud.round}
            </p>
            <p
              data-testid="stare-timer"
              className="font-mono text-2xl sm:text-4xl font-extrabold text-[#FF6B57] tabular-nums leading-none mt-0.5"
            >
              {hud.elapsedSec.toFixed(1)}s
            </p>
          </div>

          <span className="w-px h-8 sm:h-10 bg-[#EAE4DC]" aria-hidden="true" />

          <div
            data-testid="stare-score"
            className="flex items-center gap-2.5 sm:gap-3 text-center"
          >
            <div>
              <p className="text-[10.5px] sm:text-[11px] text-[#FF6B57] font-bold truncate max-w-[74px] sm:max-w-[82px]">
                {localName}
              </p>
              <p className="text-xl sm:text-2xl font-extrabold text-[#1F242D] tabular-nums leading-none mt-0.5">{hud.localScore}</p>
            </div>
            <span className="text-[#D1C9BE] font-bold">—</span>
            <div>
              <p className="text-[10.5px] sm:text-[11px] text-[#7C5CFC] font-bold truncate max-w-[74px] sm:max-w-[82px]">
                {partnerName}
              </p>
              <p className="text-xl sm:text-2xl font-extrabold text-[#1F242D] tabular-nums leading-none mt-0.5">{hud.partnerScore}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Large Close-Up Side-by-Side Face Feeds + Visual Traps (side-by-side on mobile too so buttons sit above the fold) */}
      <section className="relative grid grid-cols-2 gap-2.5 sm:gap-5">
        {/* Local Face Close-Up */}
        <div className="relative rounded-3xl overflow-hidden border border-[#EAE4DC] bg-white shadow-[0_6px_24px_rgba(31,36,45,0.06)]">
          <CameraFeedTile
            name={localName}
            subtitle={hud.localEyeRatio >= 0.56 ? t.stareEyeBlinked : t.stareEyeOpen}
            stream={localStream}
            isLocal
            cameraEnabled={cameraEnabled}
            micMuted={micMuted}
            trackerStatus={trackerStatus}
            metricsRef={localMetricsRef}
            onVideoRef={onVideoRef}
            onRequestCamera={onRequestCamera}
          />

          {/* Live Blink Gauge Strip */}
          <div className="px-2.5 sm:px-4 py-2 sm:py-2.5 bg-white border-t border-[#EAE4DC] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3">
            <span className="text-[11px] sm:text-xs font-semibold text-[#1F242D] flex items-center gap-1.5 truncate">
              {hud.localEyeRatio >= 0.56 ? (
                <EyeOff className="w-3.5 h-3.5 text-[#FF6B57] shrink-0" />
              ) : (
                <Eye className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
              )}
              <span className="truncate">{hud.localEyeRatio >= 0.56 ? t.stareEyeBlinked : t.stareEyeOpen}</span>
            </span>
            <div className="w-full sm:flex-1 sm:max-w-[160px] h-2 rounded-full bg-[#F3EFE8] overflow-hidden">
              <div
                className={`h-full transition-all duration-75 ${
                  hud.localEyeRatio >= 0.48 ? 'bg-[#FF6B57]' : 'bg-[#10B981]'
                }`}
                style={{ width: `${Math.min(100, Math.round(hud.localEyeRatio * 100))}%` }}
              />
            </div>
          </div>

          {/* Visual Trap 1: Virtual Buzzing Fly across the Nose */}
          {hud.activeTrap === 'fly' && hud.phase === 'playing' && (
            <div
              data-testid="stare-trap-fly"
              className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
            >
              <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-xl bg-[#FEF6DC] border border-[#F59E0B]/50 text-[#92400E] px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-extrabold shadow-md flex items-center gap-1.5 whitespace-nowrap">
                <Bug className="w-3.5 h-3.5 shrink-0" />
                <span>{t.stareFlyAlert}</span>
              </div>
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
                style={{
                  left: `${flyPos.x}%`,
                  top: `${flyPos.y}%`,
                  transform: `translate(-50%, -50%) rotate(${flyPos.rot}deg)`,
                }}
              >
                <div className="relative flex items-center justify-center w-14 h-14">
                  <span className="absolute inset-0 rounded-full bg-[#F59E0B]/25 animate-ping" />
                  <span className="text-4xl drop-shadow-[0_4px_12px_rgba(31,36,45,0.45)]">🪰</span>
                </div>
              </div>
            </div>
          )}

          {/* Visual Trap 2: Surprise Camera Flash */}
          {hud.activeTrap === 'flash' && hud.phase === 'playing' && (
            <div
              data-testid="stare-trap-flash"
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-2"
              style={{
                backgroundColor: `rgba(255, 248, 220, ${Math.min(0.88, hud.activeTrapProgress * 0.95)})`,
              }}
            >
              <div className="rounded-2xl bg-white border-2 border-[#F59E0B] px-3 sm:px-4 py-2 text-xs sm:text-sm font-extrabold text-[#B45309] shadow-xl flex items-center gap-1.5 sm:gap-2">
                <Zap className="w-4 h-4 shrink-0" />
                <span>{t.stareFlashAlert}</span>
              </div>
            </div>
          )}
        </div>

        {/* Partner Face Close-Up */}
        <div className="relative rounded-3xl overflow-hidden border border-[#EAE4DC] bg-white shadow-[0_6px_24px_rgba(31,36,45,0.06)]">
          <CameraFeedTile
            name={partnerName}
            subtitle={isSolo ? t.partnerAiSub : t.partnerLiveSub}
            stream={remoteStream}
            isAi={isSolo}
            metricsRef={partnerMetricsRef}
          />

          <div className="px-2.5 sm:px-4 py-2 sm:py-2.5 bg-white border-t border-[#EAE4DC] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3">
            <span className="text-[11px] sm:text-xs font-semibold text-[#1F242D] flex items-center gap-1.5 truncate">
              <Eye className="w-3.5 h-3.5 text-[#7C5CFC] shrink-0" />
              <span className="truncate">
                {hud.phase === 'playing'
                  ? `${t.stareNextTrap} ${hud.nextAutoTrapInt}s`
                  : `${t.recordLabel}: ${hud.bestStareSec.toFixed(1)}s`}
              </span>
            </span>
            <div className="w-full sm:flex-1 sm:max-w-[160px] h-2 rounded-full bg-[#F3EFE8] overflow-hidden">
              <div
                className="h-full bg-[#7C5CFC] transition-all duration-75"
                style={{ width: `${Math.min(100, Math.round(hud.partnerEyeRatio * 100))}%` }}
              />
            </div>
          </div>

          {partnerDistractedFlash && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#FEF6DC]/65 p-2">
              <div className="rounded-2xl bg-white border border-[#F59E0B] px-3 py-1.5 text-xs font-extrabold text-[#B45309] flex items-center gap-1.5 shadow-lg">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>{t.stareDistractionBtn} !</span>
              </div>
            </div>
          )}
        </div>

        {/* Center Countdown Badge during 3-2-1 */}
        {hud.phase === 'countdown' && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <div className="rounded-3xl bg-white/95 border-2 border-[#FF6B57]/40 px-8 py-5 text-center shadow-[0_14px_40px_rgba(31,36,45,0.14)]">
              <p className="text-xs font-extrabold uppercase tracking-widest text-[#FF6B57]">
                {t.stareDontBlink}
              </p>
              <p className="font-mono text-6xl font-extrabold text-[#1F242D] tabular-nums mt-1">
                {hud.countdownInt}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Action Controls Bar — Enlarged >= 52px mobile thumb targets below the cameras */}
      <section className="rounded-3xl bg-white border border-[#EAE4DC] shadow-[0_6px_24px_rgba(31,36,45,0.06)] p-3.5 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3.5">
        {hud.phase === 'ready' && (
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3.5">
            <p className="hidden sm:block text-sm text-[#6B7280] max-w-xl leading-relaxed font-medium">{t.stareDesc}</p>
            <button
              type="button"
              data-start="true"
              onClick={() => launchRound(true)}
              className="w-full sm:w-auto min-h-[54px] inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-extrabold text-base sm:text-sm bg-[#FF6B57] hover:bg-[#F25743] text-white transition-colors shadow-md shadow-[#FF6B57]/20 whitespace-nowrap shrink-0"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{t.stareStartBtn}</span>
            </button>
          </div>
        )}

        {(hud.phase === 'countdown' || hud.phase === 'playing') && (
          <div className="w-full grid grid-cols-1 sm:flex sm:flex-wrap items-center justify-between gap-2.5 sm:gap-3">
            <button
              type="button"
              data-testid="send-distraction-btn"
              disabled={hud.phase !== 'playing' || hud.distractionCooldownSec > 0}
              onClick={sendDistraction}
              className="w-full sm:w-auto min-h-[54px] inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-extrabold text-sm sm:text-base bg-[#FEF6DC] hover:bg-[#FDECB8] border border-[#F5D782] disabled:opacity-50 text-[#92400E] transition-colors whitespace-nowrap"
            >
              <Zap className="w-4 h-4 shrink-0" />
              <span>
                {hud.distractionCooldownSec > 0
                  ? `${t.stareDistractionCooldown} (${Math.ceil(hud.distractionCooldownSec)}s)`
                  : t.stareDistractionBtn}
              </span>
            </button>

            <button
              type="button"
              onPointerDown={() => {
                manualBlinkRef.current = true;
              }}
              onPointerUp={() => {
                manualBlinkRef.current = false;
              }}
              onPointerLeave={() => {
                manualBlinkRef.current = false;
              }}
              className="w-full sm:w-auto min-h-[50px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold bg-[#FAF7F2] hover:bg-[#F1ECE3] text-[#1F242D] border border-[#EAE4DC] transition-colors whitespace-nowrap"
            >
              <EyeOff className="w-4 h-4 text-[#FF6B57] shrink-0" />
              <span>{t.stareTestBlinkBtn}</span>
            </button>
          </div>
        )}

        {(hud.phase === 'round_over' || hud.phase === 'match_over') && (
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-10 h-10 rounded-2xl bg-[#FEF6DC] border border-[#F5D782] flex items-center justify-center text-[#D97706] shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <p className="text-base font-extrabold text-[#1F242D]">
                  {hud.phase === 'match_over'
                    ? hud.lastWinner === 'local'
                      ? t.stareMatchWon
                      : `${partnerName} ${t.stareMatchLost}`
                    : hud.lastWinner === 'local'
                      ? `${partnerName} ${t.stareYouWonRound}`
                      : t.starePartnerWonRound}
                </p>
                <p className="text-xs text-[#6B7280] font-medium tabular-nums">
                  {hud.lastRoundDurationSec.toFixed(1)}s · {t.recordLabel}: {hud.bestStareSec.toFixed(1)}s
                </p>
              </div>
            </div>

            <div className="w-full sm:w-auto flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                data-start="true"
                onClick={() => launchRound(true)}
                className="flex-1 sm:flex-none min-h-[52px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-extrabold text-sm bg-[#FF6B57] hover:bg-[#F25743] text-white shadow-md shadow-[#FF6B57]/20 transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{hud.phase === 'match_over' ? t.playAgain : t.stareNextRoundBtn}</span>
              </button>
              <button
                type="button"
                onClick={onReturnToHub}
                className="flex-1 sm:flex-none min-h-[52px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm bg-[#FAF7F2] hover:bg-[#F1ECE3] text-[#1F242D] border border-[#EAE4DC] transition-colors whitespace-nowrap"
              >
                <LayoutGrid className="w-4 h-4" />
                <span>{t.backToHub}</span>
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
