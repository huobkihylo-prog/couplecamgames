import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { ArrowRight, Sparkles, Star } from 'lucide-react';
import type {
  ConnectionMode,
  ConstellationState,
  FaceMetrics,
  HandMetrics,
  PeerMessage,
  TrackerStatus,
} from '../types/duoplay';
import {
  activateConstellationStar,
  advanceToNextConstellation,
  CONSTELLATION_H,
  CONSTELLATION_W,
  createInitialConstellationState,
  getActiveConstellation,
  getNextTargetStar,
  stepAiConstellationPartner,
  stepConstellationGame,
} from '../game/constellationsLogic';
import { useI18n } from '../i18n/LanguageContext';
import { soundFx } from '../utils/soundFx';
import { CameraFeedTile } from './CameraFeedTile';

interface ConstellationsGameViewProps {
  localName: string;
  partnerName: string;
  connectionMode: ConnectionMode;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  cameraEnabled: boolean;
  micMuted: boolean;
  handTrackerStatus: TrackerStatus;
  localFaceMetricsRef: MutableRefObject<FaceMetrics>;
  partnerFaceMetricsRef: MutableRefObject<FaceMetrics>;
  localHandMetricsRef: MutableRefObject<HandMetrics>;
  partnerHandMetricsRef: MutableRefObject<HandMetrics>;
  completedConstellations: number;
  onConstellationCompleted: (count: number) => void;
  onVideoRef: (el: HTMLVideoElement | null) => void;
  onRequestCamera: () => void;
  onSendPeerMessage: (msg: PeerMessage) => void;
  registerPeerHandler: (handler: ((msg: PeerMessage) => void) | null) => void;
  onLocalPointerHandChange: (normX: number, normY: number, active: boolean) => void;
}

interface StarParticle {
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

const MAX_STAR_PARTICLES = 84;

function createParticlePool(): StarParticle[] {
  return Array.from({ length: MAX_STAR_PARTICLES }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 1,
    size: 2.5,
    color: '#F2CB80',
  }));
}

function drawFourPointStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fill: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.34;
    const angle = (i * Math.PI) / 4;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

export function ConstellationsGameView({
  localName,
  partnerName,
  connectionMode,
  localStream,
  remoteStream,
  cameraEnabled,
  micMuted,
  handTrackerStatus,
  localFaceMetricsRef,
  partnerFaceMetricsRef,
  localHandMetricsRef,
  partnerHandMetricsRef,
  completedConstellations,
  onConstellationCompleted,
  onVideoRef,
  onRequestCamera,
  onSendPeerMessage,
  registerPeerHandler,
  onLocalPointerHandChange,
}: ConstellationsGameViewProps) {
  const { t } = useI18n();
  const isSolo = connectionMode === 'solo';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<ConstellationState>({
    ...createInitialConstellationState(),
    completedCount: completedConstellations,
  });
  const aiCursorRef = useRef({ x: 0.72, y: 0.5 });
  const pointerRef = useRef({ normX: 0.32, normY: 0.5, active: false });
  const particlesRef = useRef<StarParticle[]>(createParticlePool());
  const particleCursorRef = useRef(0);
  const promptCountRef = useRef(t.constellationPrompts.length);
  promptCountRef.current = t.constellationPrompts.length;

  const [hud, setHud] = useState({
    phase: 'ready' as ConstellationState['phase'],
    constellationId: getActiveConstellation(stateRef.current).id,
    activatedCount: 0,
    totalStars: getActiveConstellation(stateRef.current).stars.length,
    nextStarId: 1 as number | null,
    completedCount: completedConstellations,
    promptIndex: 0,
  });

  const spawnBurst = useCallback((x: number, y: number, color: string, count: number) => {
    const pool = particlesRef.current;
    for (let i = 0; i < count; i++) {
      const p = pool[particleCursorRef.current];
      particleCursorRef.current = (particleCursorRef.current + 1) % MAX_STAR_PARTICLES;
      const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
      const spd = 45 + Math.random() * 120;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * spd;
      p.vy = Math.sin(a) * spd;
      p.life = 0;
      p.maxLife = 0.65 + Math.random() * 0.45;
      p.size = 2 + Math.random() * 3;
      p.color = color;
    }
  }, []);

  const syncHudFromRef = useCallback(() => {
    const st = stateRef.current;
    const pat = getActiveConstellation(st);
    const nextStar = getNextTargetStar(st);
    setHud((prev) => {
      if (
        prev.phase === st.phase &&
        prev.constellationId === pat.id &&
        prev.activatedCount === st.activatedStarIds.length &&
        prev.totalStars === pat.stars.length &&
        prev.nextStarId === (nextStar?.id ?? null) &&
        prev.completedCount === st.completedCount &&
        prev.promptIndex === st.activePromptIndex
      ) {
        return prev;
      }
      return {
        phase: st.phase,
        constellationId: pat.id,
        activatedCount: st.activatedStarIds.length,
        totalStars: pat.stars.length,
        nextStarId: nextStar?.id ?? null,
        completedCount: st.completedCount,
        promptIndex: st.activePromptIndex,
      };
    });
  }, []);

  const startSky = useCallback(
    (notifyPeer = true) => {
      soundFx.starChime(0);
      stateRef.current = {
        ...stateRef.current,
        phase: 'playing',
      };
      document.body.dataset.state = 'playing';
      if (notifyPeer && !isSolo) {
        onSendPeerMessage({ type: 'CONSTELLATION_START' });
      }
      syncHudFromRef();
    },
    [isSolo, onSendPeerMessage, syncHudFromRef],
  );

  const handleNextConstellation = useCallback(
    (notifyPeer = true, forcedIdx?: number, forcedPromptIdx?: number) => {
      soundFx.click();
      const next = advanceToNextConstellation(
        stateRef.current,
        promptCountRef.current,
        forcedIdx,
      );
      if (forcedPromptIdx !== undefined) {
        next.activePromptIndex = forcedPromptIdx % Math.max(1, promptCountRef.current);
      }
      stateRef.current = next;
      document.body.dataset.state = 'playing';
      if (notifyPeer && !isSolo) {
        onSendPeerMessage({
          type: 'CONSTELLATION_NEXT',
          constellationIndex: next.constellationIndex,
          promptIndex: next.activePromptIndex,
        });
      }
      syncHudFromRef();
    },
    [isSolo, onSendPeerMessage, syncHudFromRef],
  );

  // PeerJS sync handler
  useEffect(() => {
    registerPeerHandler((msg) => {
      if (msg.type === 'CONSTELLATION_START') {
        startSky(false);
      } else if (msg.type === 'CONSTELLATION_STAR') {
        if (stateRef.current.phase === 'ready') {
          stateRef.current = { ...stateRef.current, phase: 'playing' };
          document.body.dataset.state = 'playing';
        }
        if (stateRef.current.constellationIndex === msg.constellationIndex) {
          const res = activateConstellationStar(
            stateRef.current,
            msg.starId,
            promptCountRef.current,
          );
          if (res.nextState !== stateRef.current) {
            stateRef.current = res.nextState;
            spawnBurst(msg.x * CONSTELLATION_W, msg.y * CONSTELLATION_H, '#F2CB80', 18);
            if (res.completed) {
              soundFx.constellationBloom();
              onConstellationCompleted(res.nextState.completedCount);
            } else {
              soundFx.starChime(res.nextState.activatedStarIds.length);
            }
            syncHudFromRef();
          }
        }
      } else if (msg.type === 'CONSTELLATION_NEXT') {
        handleNextConstellation(false, msg.constellationIndex, msg.promptIndex);
      }
    });
    return () => registerPeerHandler(null);
  }, [
    registerPeerHandler,
    startSky,
    handleNextConstellation,
    spawnBurst,
    onConstellationCompleted,
    syncHudFromRef,
  ]);

  // Keyboard Enter/Space on title
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.code === 'Enter') && stateRef.current.phase === 'ready') {
        e.preventDefault();
        startSky(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [startSky]);

  // Main 60fps Starry Sky simulation & renderer
  useEffect(() => {
    document.body.dataset.state = stateRef.current.phase === 'ready' ? 'title' : stateRef.current.phase;
    let rafId = 0;
    let lastMs = performance.now();
    let hudTimer = 0;

    const bgStars = Array.from({ length: 80 }, (_, i) => ({
      x: ((i * 193 + 37) % 984) + 8,
      y: ((i * 113 + 19) % 540) + 10,
      r: i % 5 === 0 ? 2.4 : 1.4,
      phase: i * 0.53,
    }));

    let cachedBgNight: CanvasGradient | null = null;
    let cachedBgReveal: CanvasGradient | null = null;
    let cachedNebNight: CanvasGradient | null = null;
    let cachedNebReveal: CanvasGradient | null = null;

    const frame = (now: number) => {
      rafId = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0.001, (now - lastMs) * 0.001));
      lastMs = now;

      const st = stateRef.current;
      const localHand = localHandMetricsRef.current;
      const ptr = pointerRef.current;
      const useCam = localHand.handDetected;
      const localX = useCam ? localHand.indexX : ptr.normX;
      const localY = useCam ? localHand.indexY : ptr.normY;
      const localActive = useCam || ptr.active;

      if (isSolo) {
        aiCursorRef.current = stepAiConstellationPartner(aiCursorRef.current, st, dt);
      }

      const partnerHand = partnerHandMetricsRef.current;
      const partnerX = isSolo ? aiCursorRef.current.x : partnerHand.indexX;
      const partnerY = isSolo ? aiCursorRef.current.y : partnerHand.indexY;
      const partnerActive = isSolo ? true : partnerHand.handDetected;

      if (st.phase === 'playing') {
        const { nextState, events } = stepConstellationGame(
          st,
          {
            localX,
            localY,
            localActive,
            partnerX,
            partnerY,
            partnerActive,
            promptCount: promptCountRef.current,
          },
          dt,
        );
        stateRef.current = nextState;

        if (events.activatedStar) {
          const sx = events.activatedStar.x * CONSTELLATION_W;
          const sy = events.activatedStar.y * CONSTELLATION_H;
          spawnBurst(sx, sy, '#F2CB80', events.completedConstellation ? 30 : 16);
          if (events.completedConstellation) {
            document.body.dataset.state = 'revealed';
            soundFx.constellationBloom();
            onConstellationCompleted(nextState.completedCount);
          } else {
            soundFx.starChime(nextState.activatedStarIds.length);
          }
          if (!isSolo) {
            onSendPeerMessage({
              type: 'CONSTELLATION_STAR',
              constellationIndex: st.constellationIndex,
              starId: events.activatedStar.id,
              x: events.activatedStar.x,
              y: events.activatedStar.y,
            });
          }
          syncHudFromRef();
        }
      }

      // Step particles
      const pool = particlesRef.current;
      for (let i = 0; i < MAX_STAR_PARTICLES; i++) {
        const p = pool[i];
        if (!p.active) continue;
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
      }

      // Render night sky
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const cur = stateRef.current;
        const pattern = getActiveConstellation(cur);
        const nextStar = getNextTargetStar(cur);
        const tSec = now * 0.001;

        // 1. Cached deep midnight celestial gradient
        if (!cachedBgNight) {
          cachedBgNight = ctx.createRadialGradient(500, 260, 40, 500, 280, 620);
          cachedBgNight.addColorStop(0, '#12162A');
          cachedBgNight.addColorStop(1, '#080A14');
          cachedBgReveal = ctx.createRadialGradient(500, 260, 40, 500, 280, 620);
          cachedBgReveal.addColorStop(0, '#1B1C38');
          cachedBgReveal.addColorStop(1, '#080A14');

          cachedNebNight = ctx.createRadialGradient(500, 270, 20, 500, 270, 320);
          cachedNebNight.addColorStop(0, 'rgba(130, 108, 210, 0.11)');
          cachedNebNight.addColorStop(0.6, 'rgba(232, 106, 88, 0.05)');
          cachedNebNight.addColorStop(1, 'rgba(0,0,0,0)');

          cachedNebReveal = ctx.createRadialGradient(500, 270, 20, 500, 270, 320);
          cachedNebReveal.addColorStop(0, 'rgba(232, 184, 97, 0.18)');
          cachedNebReveal.addColorStop(0.6, 'rgba(232, 106, 88, 0.06)');
          cachedNebReveal.addColorStop(1, 'rgba(0,0,0,0)');
        }

        ctx.fillStyle = cur.phase === 'revealed' && cachedBgReveal ? cachedBgReveal : cachedBgNight;
        ctx.fillRect(0, 0, CONSTELLATION_W, CONSTELLATION_H);

        // Soft warm nebula cloud behind the constellation
        ctx.fillStyle =
          cur.phase === 'revealed' && cachedNebReveal ? cachedNebReveal : (cachedNebNight as CanvasGradient);
        ctx.fillRect(0, 0, CONSTELLATION_W, CONSTELLATION_H);

        // 2. Background twinkling stars (fast fillRect)
        ctx.fillStyle = '#F6F2E9';
        for (const s of bgStars) {
          const tw = 0.25 + 0.75 * Math.abs(Math.sin(tSec * 1.1 + s.phase));
          ctx.globalAlpha = tw * 0.65;
          ctx.fillRect(s.x, s.y, s.r, s.r);
        }
        ctx.globalAlpha = 1;

        // 3. Faint guide lines & illuminated golden constellation edges (2-pass glow, zero shadowBlur)
        const starMap = new Map(pattern.stars.map((s) => [s.id, s]));
        for (const [aId, bId] of pattern.edges) {
          const sa = starMap.get(aId);
          const sb = starMap.get(bId);
          if (!sa || !sb) continue;
          const ax = sa.x * CONSTELLATION_W;
          const ay = sa.y * CONSTELLATION_H;
          const bx = sb.x * CONSTELLATION_W;
          const by = sb.y * CONSTELLATION_H;
          const bothLit = cur.activatedStarIds.includes(aId) && cur.activatedStarIds.includes(bId);

          if (bothLit) {
            ctx.strokeStyle = 'rgba(232, 184, 97, 0.24)';
            ctx.lineWidth = 9;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(242, 203, 128, 0.95)';
            ctx.lineWidth = 2.6;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          } else {
            ctx.save();
            ctx.setLineDash([4, 8]);
            ctx.strokeStyle = 'rgba(203, 196, 182, 0.16)';
            ctx.lineWidth = 1.25;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
            ctx.restore();
          }
        }

        // 4. Numbered constellation stars
        for (const star of pattern.stars) {
          const sx = star.x * CONSTELLATION_W;
          const sy = star.y * CONSTELLATION_H;
          const isLit = cur.activatedStarIds.includes(star.id);
          const isTarget = cur.phase === 'playing' && nextStar?.id === star.id;

          if (isLit) {
            ctx.fillStyle = 'rgba(242, 203, 128, 0.16)';
            ctx.beginPath();
            ctx.arc(sx, sy, 28, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(242, 203, 128, 0.34)';
            ctx.beginPath();
            ctx.arc(sx, sy, 16, 0, Math.PI * 2);
            ctx.fill();
            drawFourPointStar(ctx, sx, sy, 14, '#FFF6DF');
          } else if (isTarget) {
            const pulse = 1 + Math.sin(tSec * 4.5) * 0.14;
            ctx.strokeStyle = 'rgba(232, 184, 97, 0.85)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(sx, sy, 24 * pulse, 0, Math.PI * 2);
            ctx.stroke();

            // Progress charge arc when fingertips touch
            if (cur.starHoldProgress > 0.02) {
              ctx.strokeStyle = '#E86A58';
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.arc(
                sx,
                sy,
                30,
                -Math.PI / 2,
                -Math.PI / 2 + Math.PI * 2 * cur.starHoldProgress,
              );
              ctx.stroke();
            }

            drawFourPointStar(ctx, sx, sy, 12 * pulse, '#F2CB80');
          } else {
            ctx.fillStyle = 'rgba(203, 196, 182, 0.45)';
            ctx.beginPath();
            ctx.arc(sx, sy, 6, 0, Math.PI * 2);
            ctx.fill();
          }

          // Number label
          ctx.font = '600 13px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = isLit ? '#F2CB80' : isTarget ? '#FFF8EB' : 'rgba(203, 196, 182, 0.65)';
          ctx.fillText(String(star.id), sx, sy - 26);
        }

        // 5. Luminous celestial thread connecting both players' fingertips
        const lx = localX * CONSTELLATION_W;
        const ly = localY * CONSTELLATION_H;
        const px = partnerX * CONSTELLATION_W;
        const py = partnerY * CONSTELLATION_H;

        if (localActive && partnerActive) {
          const dist = Math.hypot(lx - px, ly - py);
          const closeness = Math.max(0, 1 - dist / 420);
          ctx.strokeStyle = `rgba(255, 224, 180, ${0.28 + closeness * 0.58})`;
          ctx.lineWidth = 1.6 + closeness * 2.4;
          ctx.beginPath();
          const mx = (lx + px) * 0.5;
          const my = (ly + py) * 0.5 - 22 * (1 - closeness);
          ctx.moveTo(lx, ly);
          ctx.quadraticCurveTo(mx, my, px, py);
          ctx.stroke();
        }

        // 6. Local coral fingertip cursor & Partner gold fingertip cursor
        const drawCursor = (cx: number, cy: number, color: string, haloColor: string, active: boolean) => {
          ctx.fillStyle = haloColor;
          ctx.globalAlpha = 0.22;
          ctx.beginPath();
          ctx.arc(cx, cy, 30, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.arc(cx, cy, 16, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          drawFourPointStar(ctx, cx, cy, active ? 11 : 7, color);
        };

        drawCursor(lx, ly, '#F08272', '#E86A58', localActive);
        drawCursor(px, py, '#F2CB80', '#E8B861', partnerActive);

        // 7. Stardust burst particles
        for (let i = 0; i < MAX_STAR_PARTICLES; i++) {
          const p = pool[i];
          if (!p.active) continue;
          const a = 1 - p.life / p.maxLife;
          ctx.globalAlpha = Math.max(0, a);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      hudTimer += dt;
      if (hudTimer >= 0.1) {
        hudTimer = 0;
        syncHudFromRef();
      }
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [
    isSolo,
    localHandMetricsRef,
    partnerHandMetricsRef,
    onConstellationCompleted,
    onSendPeerMessage,
    spawnBurst,
    syncHudFromRef,
  ]);

  const handlePointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const normX = Math.max(0.03, Math.min(0.97, (e.clientX - rect.left) / rect.width));
    const normY = Math.max(0.05, Math.min(0.95, (e.clientY - rect.top) / rect.height));
    pointerRef.current = { normX, normY, active: true };
    onLocalPointerHandChange(normX, normY, true);
  };

  const hasHandSensor = Boolean(localStream) && handTrackerStatus === 'ready';
  const activeName = t.constellationNames[hud.constellationId];
  const unlockedPrompt =
    t.constellationPrompts[hud.promptIndex % t.constellationPrompts.length] ?? '';

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 space-y-4">
      <section className="relative rounded-2xl overflow-hidden bg-[#080A14] border border-white/12 shadow-2xl">
        <canvas
          ref={canvasRef}
          data-testid="constellations-canvas"
          width={CONSTELLATION_W}
          height={CONSTELLATION_H}
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={() => {
            pointerRef.current.active = false;
            onLocalPointerHandChange(pointerRef.current.normX, pointerRef.current.normY, false);
          }}
          className="block w-full aspect-[1000/560] touch-none cursor-none"
        />

        {/* Top perimeter HUD */}
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-[#0D0F17]/88 border border-white/12">
            <p className="text-[11px] text-[#E8B861] font-medium">{activeName}</p>
            <p
              data-testid="constellation-progress"
              className="font-mono text-lg font-semibold text-[#F6F2E9] tabular-nums"
            >
              {hud.activatedCount} / {hud.totalStars} ★
            </p>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-[#0D0F17]/88 border border-white/12 text-end">
            <p className="text-[11px] text-[#A9A295]">{t.constellationCompletedLabel}</p>
            <p className="font-mono text-lg font-semibold text-[#F2CB80] tabular-nums">
              {hud.completedCount}
            </p>
          </div>
        </div>

        {/* Bottom guidance strip while tracing */}
        {hud.phase === 'playing' && (
          <div className="pointer-events-none absolute inset-x-4 bottom-3 flex items-center justify-between gap-2 text-xs text-[#CBC4B6]">
            <span className="px-2.5 py-1 rounded-lg bg-[#0D0F17]/85 border border-white/10">
              {hasHandSensor ? t.constellationSensorReady : t.constellationSensorFallback}
            </span>
            {hud.nextStarId !== null && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#E8B861]/18 border border-[#E8B861]/35 text-[#F2CB80] font-semibold tabular-nums">
                <Star className="w-3.5 h-3.5" />
                <span>
                  {t.constellationTouchHint} #{hud.nextStarId}
                </span>
              </span>
            )}
          </div>
        )}

        {/* Title overlay */}
        {hud.phase === 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#080A14]/78 p-6">
            <div className="max-w-md w-full rounded-2xl bg-[#141724] border border-white/15 p-6 text-center space-y-4 shadow-2xl">
              <div className="mx-auto w-12 h-12 rounded-xl bg-[#E8B861]/18 border border-[#E8B861]/35 flex items-center justify-center text-[#F2CB80]">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h1 className="text-2xl font-semibold text-[#F6F2E9]">{t.constellationTitle}</h1>
                <p className="text-sm text-[#CBC4B6] leading-relaxed">{t.constellationDesc}</p>
              </div>
              <button
                type="button"
                data-start="true"
                onClick={() => startSky(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm sm:text-base font-semibold bg-[#E8B861] text-[#0D0F17] hover:bg-[#F2CB80] transition-colors whitespace-nowrap"
              >
                <Star className="w-4 h-4 shrink-0" />
                <span>{t.constellationStartBtn}</span>
              </button>
              <p className="text-xs text-[#A9A295]">
                {hasHandSensor ? t.constellationSensorReady : t.constellationSensorFallback}
              </p>
            </div>
          </div>
        )}

        {/* Desktop floating Unlocked Intimate Question Card (hidden on mobile where it renders below canvas) */}
        {hud.phase === 'revealed' && (
          <div className="hidden sm:flex absolute inset-x-4 bottom-4 justify-center">
            <div
              data-testid="constellation-prompt-card"
              className="max-w-2xl w-full rounded-2xl bg-[#141724]/96 border border-[#E8B861]/45 p-5 shadow-2xl flex items-center justify-between gap-4"
            >
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-medium text-[#E8B861]">
                  {activeName} · {t.constellationUnlockedLabel}
                </p>
                <p className="text-base sm:text-lg font-semibold text-[#F6F2E9] leading-snug">
                  « {unlockedPrompt} »
                </p>
              </div>
              <button
                type="button"
                data-testid="constellation-next-btn"
                onClick={() => handleNextConstellation(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#E8B861] text-[#0D0F17] hover:bg-[#F2CB80] transition-colors whitespace-nowrap shrink-0"
              >
                <span>{t.constellationNextBtn}</span>
                <ArrowRight className="w-4 h-4 shrink-0 rtl:rotate-180" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Mobile Unlocked Intimate Question Card (below canvas so constellation & HUD stay 100% visible) */}
      {hud.phase === 'revealed' && (
        <section className="sm:hidden">
          <div
            data-testid="constellation-prompt-card-mobile"
            className="w-full rounded-2xl bg-[#141724] border border-[#E8B861]/45 p-4 shadow-xl flex flex-col gap-3"
          >
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-medium text-[#E8B861]">
                {activeName} · {t.constellationUnlockedLabel}
              </p>
              <p className="text-base font-semibold text-[#F6F2E9] leading-snug">
                « {unlockedPrompt} »
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleNextConstellation(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#E8B861] text-[#0D0F17] hover:bg-[#F2CB80] transition-colors whitespace-nowrap"
            >
              <span>{t.constellationNextBtn}</span>
              <ArrowRight className="w-4 h-4 shrink-0 rtl:rotate-180" />
            </button>
          </div>
        </section>
      )}

      {/* Compact live couple cameras underneath for sharing answers aloud */}
      <section className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CameraFeedTile
          name={localName}
          subtitle={hasHandSensor ? t.constellationSensorReady : t.constellationSensorFallback}
          stream={localStream}
          isLocal
          cameraEnabled={cameraEnabled}
          micMuted={micMuted}
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
