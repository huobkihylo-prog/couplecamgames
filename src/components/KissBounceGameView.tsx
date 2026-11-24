import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Heart, LayoutGrid, Music2, Pause, Play, RotateCcw, Sparkles } from 'lucide-react';
import type {
  ConnectionMode,
  FaceMetrics,
  HandMetrics,
  KissBounceState,
  PeerMessage,
  TrackerStatus,
} from '../types/duoplay';
import {
  createInitialKissBounceState,
  createKissAiHandState,
  detectKissPucker,
  KISS_ARENA_H,
  KISS_ARENA_W,
  KISS_HAND_CATCH_RADIUS,
  receiveRemoteKissHeart,
  stepKissAiHand,
  stepKissBouncePhysics,
} from '../game/kissBouncePhysics';
import { useI18n } from '../i18n/LanguageContext';
import { soundFx } from '../utils/soundFx';
import { CameraFeedTile } from './CameraFeedTile';

interface KissBounceGameViewProps {
  localName: string;
  partnerName: string;
  connectionMode: ConnectionMode;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  cameraEnabled: boolean;
  micMuted: boolean;
  faceTrackerStatus: TrackerStatus;
  handTrackerStatus: TrackerStatus;
  localFaceMetricsRef: MutableRefObject<FaceMetrics>;
  partnerFaceMetricsRef: MutableRefObject<FaceMetrics>;
  localHandMetricsRef: MutableRefObject<HandMetrics>;
  partnerHandMetricsRef: MutableRefObject<HandMetrics>;
  bestRally: number;
  onUpdateBestRally: (rally: number) => void;
  onVideoRef: (el: HTMLVideoElement | null) => void;
  onRequestCamera: () => void;
  onSendPeerMessage: (msg: PeerMessage) => void;
  registerPeerHandler: (handler: ((msg: PeerMessage) => void) | null) => void;
  onLocalPointerHandChange: (normX: number, normY: number, active: boolean) => void;
  onReturnToHub: () => void;
}

interface PooledSpark {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const MAX_SPARKS = 96;

function createSparkPool(): PooledSpark[] {
  return Array.from({ length: MAX_SPARKS }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 1,
    size: 3,
    color: '#F2CB80',
  }));
}

function drawGlowingHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  glowColor: string,
) {
  ctx.save();
  ctx.translate(x, y);

  // Soft layered glow halo (avoids per-frame radial gradient allocations)
  ctx.fillStyle = glowColor;
  ctx.globalAlpha = 0.24;
  ctx.beginPath();
  ctx.arc(0, 0, size * 1.85, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.42;
  ctx.beginPath();
  ctx.arc(0, 0, size * 1.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Heart silhouette
  ctx.beginPath();
  const s = size * 0.85;
  ctx.moveTo(0, s * 0.42);
  ctx.bezierCurveTo(-s * 0.1, -s * 0.25, -s * 1.15, -s * 0.2, -s * 0.95, s * 0.48);
  ctx.bezierCurveTo(-s * 0.78, s * 1.02, -s * 0.15, s * 1.25, 0, s * 1.48);
  ctx.bezierCurveTo(s * 0.15, s * 1.25, s * 0.78, s * 1.02, s * 0.95, s * 0.48);
  ctx.bezierCurveTo(s * 1.15, -s * 0.2, s * 0.1, -s * 0.25, 0, s * 0.42);
  ctx.translate(0, -s * 0.55);

  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 245, 225, 0.85)';
  ctx.stroke();

  // Specular highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.34, s * 0.22, s * 0.18, s * 0.11, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function KissBounceGameView({
  localName,
  partnerName,
  connectionMode,
  localStream,
  remoteStream,
  cameraEnabled,
  micMuted,
  faceTrackerStatus,
  handTrackerStatus,
  localFaceMetricsRef,
  partnerFaceMetricsRef,
  localHandMetricsRef,
  partnerHandMetricsRef,
  bestRally,
  onUpdateBestRally,
  onVideoRef,
  onRequestCamera,
  onSendPeerMessage,
  registerPeerHandler,
  onLocalPointerHandChange,
  onReturnToHub,
}: KissBounceGameViewProps) {
  const { t } = useI18n();
  const isSolo = connectionMode === 'solo';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<KissBounceState>(createInitialKissBounceState(bestRally));
  const aiHandRef = useRef(createKissAiHandState());
  const sparksRef = useRef<PooledSpark[]>(createSparkPool());
  const sparkCursorRef = useRef(0);
  const pointerRef = useRef({ normX: 0.22, normY: 0.52, active: false });
  const manualKissQueuedRef = useRef(false);
  const wasPuckerKissingRef = useRef(false);
  const bestRallyRef = useRef(bestRally);
  bestRallyRef.current = bestRally;

  const [hud, setHud] = useState({
    phase: 'ready' as KissBounceState['phase'],
    rally: 0,
    bestRally,
    auroraPct: 14,
    puckerPct: 0,
    lastCatchKind: 'none' as KissBounceState['lastCatchKind'],
  });

  const spawnSparks = useCallback((x: number, y: number, color: string, count: number) => {
    const pool = sparksRef.current;
    for (let i = 0; i < count; i++) {
      const p = pool[sparkCursorRef.current];
      sparkCursorRef.current = (sparkCursorRef.current + 1) % MAX_SPARKS;
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 55 + Math.random() * 140;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 25;
      p.life = 0;
      p.maxLife = 0.55 + Math.random() * 0.4;
      p.size = 2.5 + Math.random() * 3.5;
      p.color = color;
    }
  }, []);

  const syncHudFromRef = useCallback(() => {
    const s = stateRef.current;
    const puckerPct = Math.round(Math.min(100, (localFaceMetricsRef.current.mouthPucker || 0) * 100));
    setHud((prev) => {
      const auroraPct = Math.round(s.auroraLevel * 100);
      if (
        prev.phase === s.phase &&
        prev.rally === s.rally &&
        prev.bestRally === s.bestRally &&
        prev.auroraPct === auroraPct &&
        prev.puckerPct === puckerPct &&
        prev.lastCatchKind === s.lastCatchKind
      ) {
        return prev;
      }
      return {
        phase: s.phase,
        rally: s.rally,
        bestRally: s.bestRally,
        auroraPct,
        puckerPct,
        lastCatchKind: s.lastCatchKind,
      };
    });
  }, [localFaceMetricsRef]);

  const startSession = useCallback(
    (notifyPeer = true) => {
      soundFx.pianoNote(0);
      stateRef.current = {
        ...createInitialKissBounceState(bestRallyRef.current),
        phase: 'playing',
      };
      aiHandRef.current = createKissAiHandState();
      document.body.dataset.state = 'playing';
      if (notifyPeer && !isSolo) {
        onSendPeerMessage({ type: 'KISS_START' });
      }
      syncHudFromRef();
    },
    [isSolo, onSendPeerMessage, syncHudFromRef],
  );

  const togglePause = useCallback(() => {
    const s = stateRef.current;
    if (s.phase === 'playing') {
      stateRef.current = { ...s, phase: 'paused' };
      document.body.dataset.state = 'paused';
    } else if (s.phase === 'paused') {
      stateRef.current = { ...s, phase: 'playing' };
      document.body.dataset.state = 'playing';
    }
    syncHudFromRef();
  }, [syncHudFromRef]);

  const triggerManualKiss = useCallback(() => {
    if (stateRef.current.phase !== 'playing') return;
    manualKissQueuedRef.current = true;
  }, []);

  // PeerJS sync handler
  useEffect(() => {
    registerPeerHandler((msg) => {
      if (msg.type === 'KISS_START') {
        startSession(false);
      } else if (msg.type === 'KISS_RESET') {
        startSession(false);
      } else if (msg.type === 'SEND_KISS') {
        if (stateRef.current.phase === 'ready') {
          stateRef.current = { ...stateRef.current, phase: 'playing' };
          document.body.dataset.state = 'playing';
        }
        stateRef.current = receiveRemoteKissHeart(stateRef.current, msg);
        soundFx.pianoNote(stateRef.current.pianoStep);
        spawnSparks(KISS_ARENA_W - 140, msg.startY, '#F2CB80', 14);
        if (stateRef.current.bestRally > bestRallyRef.current) {
          onUpdateBestRally(stateRef.current.bestRally);
        }
        syncHudFromRef();
      }
    });
    return () => registerPeerHandler(null);
  }, [registerPeerHandler, startSession, spawnSparks, onUpdateBestRally, syncHudFromRef]);

  // Keyboard controls: Space/Enter to start or blow a kiss, Escape/P to pause
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (stateRef.current.phase === 'ready') {
          e.preventDefault();
          startSession(true);
        } else if (stateRef.current.phase === 'playing' && e.code === 'Space') {
          e.preventDefault();
          manualKissQueuedRef.current = true;
        }
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        if (stateRef.current.phase === 'playing' || stateRef.current.phase === 'paused') {
          e.preventDefault();
          togglePause();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [startSession, togglePause]);

  // Main 60fps simulation & Aurora Borealis Canvas renderer
  useEffect(() => {
    document.body.dataset.state = stateRef.current.phase === 'ready' ? 'title' : stateRef.current.phase;
    let rafId = 0;
    let lastMs = performance.now();
    let hudTimer = 0;

    // Static twinkling starfield coordinates
    const bgStars = Array.from({ length: 56 }, (_, i) => ({
      x: ((i * 173 + 41) % 980) + 10,
      y: ((i * 97 + 23) % 390) + 14,
      r: i % 3 === 0 ? 2.4 : 1.5,
      phase: i * 0.67,
    }));

    const skyline: [number, number][] = [
      [0, 522], [85, 522], [110, 496], [190, 496], [210, 518],
      [320, 518], [345, 488], [415, 488], [435, 520], [492, 520],
      [500, 456], [508, 520], [580, 520], [605, 494], [690, 494],
      [715, 516], [820, 516], [848, 492], [930, 492], [955, 518], [1000, 518],
    ];

    let cachedSkyCalm: CanvasGradient | null = null;
    let cachedSkyWarm: CanvasGradient | null = null;
    let cachedAuroraGrads: CanvasGradient[] | null = null;

    const frame = (now: number) => {
      rafId = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0.001, (now - lastMs) * 0.001));
      lastMs = now;

      const s = stateRef.current;

      // Read FaceLandmarker mouthPucker edge trigger + manual kiss trigger
      const faceM = localFaceMetricsRef.current;
      const puckerNow = detectKissPucker(faceM.mouthPucker, false);
      const puckerJustFired = puckerNow && !wasPuckerKissingRef.current;
      wasPuckerKissingRef.current = puckerNow;

      const kissTriggered = puckerJustFired || manualKissQueuedRef.current;
      manualKissQueuedRef.current = false;

      // Read HandLandmarker (palm or index) or mouse pointer fallback
      const handM = localHandMetricsRef.current;
      const ptr = pointerRef.current;
      const useCamHand = handM.handDetected;
      const localHandX = useCamHand ? handM.palmX * 0.5 : Math.min(0.47, ptr.normX);
      const localHandY = useCamHand ? handM.palmY : ptr.normY;
      const localHandActive = useCamHand || ptr.active;

      if (s.phase === 'playing') {
        if (isSolo) {
          aiHandRef.current = stepKissAiHand(aiHandRef.current, s.hearts, dt);
        }

        const { nextState, events } = stepKissBouncePhysics(
          s,
          {
            localHandX,
            localHandY,
            localHandActive,
            localKissTriggered: kissTriggered,
            isSolo,
          },
          dt,
          aiHandRef.current,
        );
        stateRef.current = nextState;

        if (events.launchedByLocal) {
          soundFx.kissLaunch();
          spawnSparks(events.launchedByLocal.x, events.launchedByLocal.y, '#F08272', 12);
          if (!isSolo) {
            onSendPeerMessage({
              type: 'SEND_KISS',
              heartId: events.launchedByLocal.id,
              startY: events.launchedByLocal.y,
              vx: events.launchedByLocal.vx,
              vy: events.launchedByLocal.vy,
              rally: nextState.rally,
              catchKind: 'kiss',
            });
          }
        }

        if (events.bouncedByLocal) {
          soundFx.pianoNote(nextState.pianoStep);
          spawnSparks(
            events.bouncedByLocal.heart.x,
            events.bouncedByLocal.heart.y,
            events.bouncedByLocal.kind === 'kiss' ? '#F2CB80' : '#7EE0B8',
            18,
          );
          if (nextState.bestRally > bestRallyRef.current) {
            onUpdateBestRally(nextState.bestRally);
          }
          if (!isSolo) {
            onSendPeerMessage({
              type: 'SEND_KISS',
              heartId: events.bouncedByLocal.heart.id,
              startY: events.bouncedByLocal.heart.y,
              vx: events.bouncedByLocal.heart.vx,
              vy: events.bouncedByLocal.heart.vy,
              rally: nextState.rally,
              catchKind: events.bouncedByLocal.kind,
            });
          }
        }

        if (events.bouncedByAi) {
          soundFx.pianoNote(nextState.pianoStep);
          spawnSparks(events.bouncedByAi.heart.x, events.bouncedByAi.heart.y, '#F2CB80', 16);
          if (nextState.bestRally > bestRallyRef.current) {
            onUpdateBestRally(nextState.bestRally);
          }
        }
      }

      // Update pooled particles
      const pool = sparksRef.current;
      for (let i = 0; i < MAX_SPARKS; i++) {
        const p = pool[i];
        if (!p.active) continue;
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 40 * dt;
      }

      // Render canvas
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const st = stateRef.current;
        const tSec = now * 0.001;
        const aurora = st.auroraLevel;

        // 1. Cached midnight sky gradient that warms gently with aurora intensity
        if (!cachedSkyCalm) {
          cachedSkyCalm = ctx.createLinearGradient(0, 0, 0, KISS_ARENA_H);
          cachedSkyCalm.addColorStop(0, '#090C18');
          cachedSkyCalm.addColorStop(0.58, '#101426');
          cachedSkyCalm.addColorStop(1, '#1A172A');
          cachedSkyWarm = ctx.createLinearGradient(0, 0, 0, KISS_ARENA_H);
          cachedSkyWarm.addColorStop(0, '#090D1C');
          cachedSkyWarm.addColorStop(0.58, '#13223A');
          cachedSkyWarm.addColorStop(1, '#1E1A32');
        }
        ctx.fillStyle = aurora > 0.45 && cachedSkyWarm ? cachedSkyWarm : cachedSkyCalm;
        ctx.fillRect(0, 0, KISS_ARENA_W, KISS_ARENA_H);

        // 2. Dynamic Aurora Borealis flowing curtains (cached vertical gradients + smooth curves)
        if (!cachedAuroraGrads) {
          const makeAurora = (yTop: number, yBot: number, rgb: string) => {
            const g = ctx.createLinearGradient(0, yTop, 0, yBot);
            g.addColorStop(0, `rgba(${rgb}, 0)`);
            g.addColorStop(0.35, `rgba(${rgb}, 0.52)`);
            g.addColorStop(0.65, `rgba(${rgb}, 0.34)`);
            g.addColorStop(1, `rgba(${rgb}, 0)`);
            return g;
          };
          cachedAuroraGrads = [
            makeAurora(45, 310, '92, 194, 159'),
            makeAurora(95, 365, '232, 106, 88'),
            makeAurora(30, 285, '155, 118, 224'),
          ];
        }
        const ribbons = [
          { yBase: 145, amp: 30, freq: 0.0055, speed: 0.7, grad: cachedAuroraGrads[0] },
          { yBase: 195, amp: 36, freq: 0.0042, speed: -0.55, grad: cachedAuroraGrads[1] },
          { yBase: 120, amp: 24, freq: 0.0068, speed: 0.45, grad: cachedAuroraGrads[2] },
        ];
        ctx.globalAlpha = 0.24 + aurora * 0.76;
        for (const r of ribbons) {
          ctx.beginPath();
          let prevX = 0;
          let prevY = r.yBase + Math.sin(tSec * r.speed) * r.amp;
          ctx.moveTo(prevX, prevY);
          for (let x = 100; x <= KISS_ARENA_W; x += 100) {
            const wy =
              r.yBase +
              Math.sin(x * r.freq + tSec * r.speed) * r.amp +
              Math.cos(x * r.freq * 1.6 - tSec * r.speed * 0.8) * (r.amp * 0.38);
            ctx.quadraticCurveTo((prevX + x) * 0.5, prevY, x, wy);
            prevX = x;
            prevY = wy;
          }
          ctx.lineTo(KISS_ARENA_W, r.yBase + 165);
          ctx.lineTo(0, r.yBase + 165);
          ctx.closePath();
          ctx.fillStyle = r.grad;
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        // 3. Twinkling starfield (fast fillRect)
        ctx.fillStyle = '#F6F2E9';
        for (const star of bgStars) {
          const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(tSec * 1.3 + star.phase));
          ctx.globalAlpha = twinkle * 0.72;
          ctx.fillRect(star.x, star.y, star.r, star.r);
        }
        ctx.globalAlpha = 1;

        // 4. Soft center horizon divider between both partners' skies
        ctx.save();
        ctx.setLineDash([6, 10]);
        ctx.strokeStyle = 'rgba(232, 184, 97, 0.22)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(KISS_ARENA_W * 0.5, 36);
        ctx.lineTo(KISS_ARENA_W * 0.5, KISS_ARENA_H - 64);
        ctx.stroke();
        ctx.restore();

        // 5. Subtle Parisian rooftop silhouette along the bottom
        ctx.fillStyle = '#0B0D16';
        ctx.beginPath();
        ctx.moveTo(0, KISS_ARENA_H);
        for (const [sx, sy] of skyline) {
          ctx.lineTo(sx, sy);
        }
        ctx.lineTo(KISS_ARENA_W, KISS_ARENA_H);
        ctx.closePath();
        ctx.fill();

        // 6. Local & Partner glowing hand catch rings
        const lx = Math.max(55, Math.min(470, localHandX * KISS_ARENA_W));
        const ly = Math.max(70, Math.min(KISS_ARENA_H - 70, localHandY * KISS_ARENA_H));

        ctx.fillStyle = 'rgba(232, 106, 88, 0.14)';
        ctx.beginPath();
        ctx.arc(lx, ly, KISS_HAND_CATCH_RADIUS * 0.68, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = localHandActive ? 'rgba(240, 130, 114, 0.92)' : 'rgba(240, 130, 114, 0.42)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(lx, ly, 34, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#F6F2E9';
        ctx.beginPath();
        ctx.arc(lx, ly, 5, 0, Math.PI * 2);
        ctx.fill();

        // Partner hand ring (Solo AI or synced PeerJS partner palm)
        const pHand = partnerHandMetricsRef.current;
        const rx = isSolo
          ? aiHandRef.current.x
          : 520 + Math.max(0, Math.min(1, pHand.palmX)) * 430;
        const ry = isSolo
          ? aiHandRef.current.y
          : Math.max(70, Math.min(KISS_ARENA_H - 70, pHand.palmY * KISS_ARENA_H));

        ctx.fillStyle = 'rgba(232, 184, 97, 0.14)';
        ctx.beginPath();
        ctx.arc(rx, ry, 54, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(242, 203, 128, 0.8)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(rx, ry, 32, 0, Math.PI * 2);
        ctx.stroke();

        // 7. Render glowing flying kiss hearts
        for (const h of st.hearts) {
          const beat = 1 + Math.sin(h.pulse) * 0.08;
          const color = h.from === 'local' ? '#F07567' : '#F2C06B';
          const glow = h.from === 'local' ? 'rgba(232, 106, 88, 0.55)' : 'rgba(232, 184, 97, 0.55)';
          drawGlowingHeart(ctx, h.x, h.y, h.radius * beat, color, glow);
        }

        // 8. Render pooled stardust sparks
        for (let i = 0; i < MAX_SPARKS; i++) {
          const p = pool[i];
          if (!p.active) continue;
          const alpha = 1 - p.life / p.maxLife;
          ctx.globalAlpha = Math.max(0, alpha);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      hudTimer += dt;
      if (hudTimer >= 0.08) {
        hudTimer = 0;
        syncHudFromRef();
      }
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [
    isSolo,
    localFaceMetricsRef,
    localHandMetricsRef,
    partnerHandMetricsRef,
    onSendPeerMessage,
    onUpdateBestRally,
    spawnSparks,
    syncHudFromRef,
  ]);

  const updatePointerFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const normX = Math.max(0.05, Math.min(0.47, (e.clientX - rect.left) / rect.width));
    const normY = Math.max(0.1, Math.min(0.88, (e.clientY - rect.top) / rect.height));
    pointerRef.current = { normX, normY, active: true };
    onLocalPointerHandChange(normX * 2, normY, true);
  };

  const hasCameraSensors = Boolean(localStream) && (faceTrackerStatus === 'ready' || handTrackerStatus === 'ready');

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 space-y-4">
      {/* Main Aurora Borealis Canvas Stage */}
      <section className="relative rounded-2xl overflow-hidden bg-[#090C18] border border-white/12 shadow-2xl">
        <canvas
          ref={canvasRef}
          data-testid="kiss-bounce-canvas"
          width={KISS_ARENA_W}
          height={KISS_ARENA_H}
          onPointerMove={updatePointerFromEvent}
          onPointerDown={(e) => {
            updatePointerFromEvent(e);
            if (stateRef.current.phase === 'playing') {
              manualKissQueuedRef.current = true;
            }
          }}
          onPointerLeave={() => {
            pointerRef.current.active = false;
            onLocalPointerHandChange(pointerRef.current.normX * 2, pointerRef.current.normY, false);
          }}
          className="block w-full aspect-[1000/560] touch-none cursor-crosshair"
        />

        {/* Minimal perimeter HUD (no backdrop-blur over live canvas) */}
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-4 px-3.5 py-2 rounded-xl bg-[#0D0F17]/88 border border-white/12">
            <div>
              <p className="text-[11px] text-[#A9A295]">{t.kissExchangeLabel}</p>
              <p
                data-testid="kiss-rally-count"
                className="font-mono text-2xl font-bold text-[#F2CB80] tabular-nums leading-tight"
              >
                {hud.rally}
              </p>
            </div>
            <div className="h-7 w-px bg-white/12" aria-hidden="true" />
            <div>
              <p className="text-[11px] text-[#A9A295]">{t.kissAuroraLabel}</p>
              <p className="font-mono text-lg font-semibold text-[#7EE0B8] tabular-nums leading-tight">
                {hud.auroraPct}%
              </p>
            </div>
            <div className="hidden sm:block h-7 w-px bg-white/12" aria-hidden="true" />
            <div className="hidden sm:block">
              <p className="text-[11px] text-[#A9A295]">{t.recordLabel}</p>
              <p className="font-mono text-lg font-semibold text-[#F6F2E9] tabular-nums leading-tight">
                {hud.bestRally}
              </p>
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5">
            {hud.phase === 'playing' && (
              <button
                type="button"
                data-testid="kiss-send-btn"
                onClick={triggerManualKiss}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#E86A58] text-[#0D0F17] hover:bg-[#F08272] transition-colors whitespace-nowrap"
              >
                <Heart className="w-4 h-4 shrink-0" />
                <span>{t.kissSendBtn}</span>
              </button>
            )}
            {(hud.phase === 'playing' || hud.phase === 'paused') && (
              <>
                <button
                  type="button"
                  onClick={togglePause}
                  aria-label={hud.phase === 'paused' ? t.resume : t.pause}
                  className="p-2 rounded-xl bg-[#0D0F17]/88 text-[#F6F2E9] border border-white/12 hover:bg-[#1B2033] transition-colors"
                >
                  {hud.phase === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => startSession(true)}
                  aria-label={t.restart}
                  className="p-2 rounded-xl bg-[#0D0F17]/88 text-[#F6F2E9] border border-white/12 hover:bg-[#1B2033] transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Catch feedback toast along bottom safe margin */}
        {hud.phase === 'playing' && (
          <div className="pointer-events-none absolute inset-x-4 bottom-3 flex items-center justify-between text-xs text-[#CBC4B6]">
            <span className="px-2.5 py-1 rounded-lg bg-[#0D0F17]/85 border border-white/10">
              {hasCameraSensors ? t.kissSensorReady : t.kissSensorFallback}
            </span>
            {hud.lastCatchKind !== 'none' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#E8B861]/20 border border-[#E8B861]/40 text-[#F2CB80] font-semibold">
                <Music2 className="w-3.5 h-3.5" />
                <span>{hud.lastCatchKind === 'kiss' ? t.kissCaughtKiss : t.kissCaughtHand}</span>
              </span>
            ) : (
              <span className="hidden sm:inline px-2.5 py-1 rounded-lg bg-[#0D0F17]/85 border border-white/10 text-[#A9A295]">
                {t.kissPuckerHint}
              </span>
            )}
          </div>
        )}

        {/* Title / Start Overlay */}
        {hud.phase === 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#090C18]/78 p-6">
            <div className="max-w-md w-full rounded-2xl bg-[#141724] border border-white/15 p-6 text-center space-y-4 shadow-2xl">
              <div className="mx-auto w-12 h-12 rounded-xl bg-[#E86A58]/18 border border-[#E86A58]/35 flex items-center justify-center text-[#F08272]">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h1 className="text-2xl font-semibold text-[#F6F2E9]">{t.kissTitle}</h1>
                <p className="text-sm text-[#CBC4B6] leading-relaxed">{t.kissDesc}</p>
              </div>
              <button
                type="button"
                data-start="true"
                onClick={() => startSession(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm sm:text-base font-semibold bg-[#E86A58] text-[#0D0F17] hover:bg-[#F08272] transition-colors whitespace-nowrap"
              >
                <Heart className="w-4 h-4 shrink-0" />
                <span>{t.kissStartBtn}</span>
              </button>
              <p className="text-xs text-[#A9A295]">
                {hasCameraSensors ? t.kissSensorReady : t.kissSensorFallback}
              </p>
            </div>
          </div>
        )}

        {/* Pause Modal */}
        {hud.phase === 'paused' && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#090C18]/78 p-6">
            <div className="max-w-sm w-full rounded-2xl bg-[#141724] border border-white/15 p-6 text-center space-y-4 shadow-2xl">
              <h2 className="text-xl font-semibold text-[#F6F2E9]">{t.pausedTitle}</h2>
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={togglePause}
                  className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-[#E8B861] text-[#0D0F17] hover:bg-[#F2CB80] transition-colors"
                >
                  {t.resume}
                </button>
                <button
                  type="button"
                  onClick={() => startSession(true)}
                  className="w-full py-2.5 px-4 rounded-xl text-sm font-medium bg-white/8 text-[#F6F2E9] hover:bg-white/14 transition-colors"
                >
                  {t.restart}
                </button>
                <button
                  type="button"
                  onClick={onReturnToHub}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-[#CBC4B6] hover:text-[#F6F2E9] transition-colors"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>{t.backToHub}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Compact live couple cameras underneath */}
      <section className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CameraFeedTile
          name={localName}
          subtitle={hud.puckerPct >= 30 ? `💋 ${hud.puckerPct}%` : t.kissPuckerHint}
          stream={localStream}
          isLocal
          cameraEnabled={cameraEnabled}
          micMuted={micMuted}
          trackerStatus={faceTrackerStatus}
          metricsRef={localFaceMetricsRef}
          onVideoRef={onVideoRef}
          onRequestCamera={onRequestCamera}
          compact
        />
        <CameraFeedTile
          name={partnerName}
          subtitle={isSolo ? t.partnerAiSub : t.partnerLiveSub}
          stream={remoteStream}
          isAi={isSolo}
          metricsRef={partnerFaceMetricsRef}
          compact
        />
      </section>
    </main>
  );
}
