import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Flame, Heart, LayoutGrid, Pause, Play, RotateCcw, Sparkles, Swords } from 'lucide-react';
import type {
  ConnectionMode,
  FaceMetrics,
  HandMetrics,
  NinjaFruitItem,
  NinjaFruitKind,
  NinjaFruitsState,
  PeerMessage,
  TrackerStatus,
} from '../types/duoplay';
import {
  createInitialNinjaFruitsState,
  createNinjaAiMemory,
  NINJA_ARENA_H,
  NINJA_ARENA_W,
  stepAiNinjaPartner,
  stepNinjaFruitsPhysics,
  type BladeSegment,
} from '../game/ninjaFruitsPhysics';
import { soundFx } from '../utils/soundFx';
import { CameraFeedTile } from './CameraFeedTile';

interface NinjaFruitsGameViewProps {
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
  bestScore: number;
  onUpdateBestScore: (score: number) => void;
  onVideoRef: (el: HTMLVideoElement | null) => void;
  onRequestCamera: () => void;
  onSendPeerMessage: (msg: PeerMessage) => void;
  onSendPeerRealtime: (msg: PeerMessage) => void;
  registerPeerHandler: (handler: ((msg: PeerMessage) => void) | null) => void;
  onLocalPointerHandChange: (normX: number, normY: number, active: boolean) => void;
  onReturnToHub: () => void;
}

interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

interface PooledParticle {
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

interface PooledPopup {
  active: boolean;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

const MAX_PARTICLES = 110;
const MAX_POPUPS = 16;
const TRAIL_MAX_AGE_MS = 230;
const MAX_TRAIL_POINTS = 14;

function createParticlePool(): PooledParticle[] {
  return Array.from({ length: MAX_PARTICLES }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 0.6,
    size: 4,
    color: '#E86A58',
  }));
}

function createPopupPool(): PooledPopup[] {
  return Array.from({ length: MAX_POPUPS }, () => ({
    active: false,
    x: 0,
    y: 0,
    text: '',
    color: '#F6F2E9',
    life: 0,
    maxLife: 0.85,
  }));
}

const FRUIT_COLORS: Record<
  NinjaFruitKind,
  { rind: string; flesh: string; juice: string; accent: string }
> = {
  watermelon: { rind: '#2D8A65', flesh: '#F05468', juice: '#F87182', accent: '#1B1F2E' },
  mango: { rind: '#F59E0B', flesh: '#FDE047', juice: '#FBBF24', accent: '#EA580C' },
  pomegranate: { rind: '#BE185D', flesh: '#FB7185', juice: '#F43F5E', accent: '#FCE7F3' },
  kiwi: { rind: '#85583B', flesh: '#65C466', juice: '#86EFAC', accent: '#ECFCCB' },
  orange: { rind: '#EA580C', flesh: '#FB923C', juice: '#FDBA74', accent: '#FFF7ED' },
  giant: { rind: '#E8B861', flesh: '#FFF2C6', juice: '#FDE68A', accent: '#E86A58' },
  bomb: { rind: '#262A3B', flesh: '#E86A58', juice: '#FF7868', accent: '#FBBF24' },
};

export function NinjaFruitsGameView({
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
  bestScore,
  onUpdateBestScore,
  onVideoRef,
  onRequestCamera,
  onSendPeerMessage,
  onSendPeerRealtime,
  registerPeerHandler,
  onLocalPointerHandChange,
  onReturnToHub,
}: NinjaFruitsGameViewProps) {
  const isGuestP2P = connectionMode === 'p2p-guest';
  const isSolo = connectionMode === 'solo';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<NinjaFruitsState>(createInitialNinjaFruitsState(bestScore));
  const aiMemRef = useRef(createNinjaAiMemory());
  const particlesRef = useRef<PooledParticle[]>(createParticlePool());
  const particleCursorRef = useRef(0);
  const popupsRef = useRef<PooledPopup[]>(createPopupPool());
  const popupCursorRef = useRef(0);

  // Blade tracking in arena coordinates (1000x620)
  const p1PosRef = useRef<{ x: number; y: number; prevX: number; prevY: number; active: boolean }>({
    x: 260,
    y: 310,
    prevX: 260,
    prevY: 310,
    active: false,
  });
  const p2PosRef = useRef<{ x: number; y: number; prevX: number; prevY: number; active: boolean }>({
    x: 740,
    y: 310,
    prevX: 740,
    prevY: 310,
    active: false,
  });
  const p1TrailRef = useRef<TrailPoint[]>([]);
  const p2TrailRef = useRef<TrailPoint[]>([]);
  const pointerStateRef = useRef<{ normX: number; normY: number; active: boolean; lastMoveMs: number }>({
    normX: 0.35,
    normY: 0.5,
    active: false,
    lastMoveMs: 0,
  });

  // Throttled HUD snapshot
  const [hud, setHud] = useState(() => ({
    phase: simRef.current.phase,
    score: 0,
    bestScore,
    lives: 3,
    maxLives: 3,
    combo: 0,
    maxCombo: 0,
    multiplier: 1,
    slicedCount: 0,
    giantSlicedCount: 0,
    callout: '',
  }));

  const spawnBurst = useCallback((x: number, y: number, color: string, count: number, speedScale = 1) => {
    const pool = particlesRef.current;
    for (let i = 0; i < count; i++) {
      const idx = particleCursorRef.current;
      particleCursorRef.current = (idx + 1) % MAX_PARTICLES;
      const p = pool[idx];
      const angle = Math.random() * Math.PI * 2;
      const speed = (110 + Math.random() * 290) * speedScale;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 65;
      p.life = 0;
      p.maxLife = 0.36 + Math.random() * 0.34;
      p.size = 3 + Math.random() * 5.5;
      p.color = color;
    }
  }, []);

  const spawnPopup = useCallback((x: number, y: number, text: string, color: string) => {
    const pool = popupsRef.current;
    const idx = popupCursorRef.current;
    popupCursorRef.current = (idx + 1) % MAX_POPUPS;
    const pop = pool[idx];
    pop.active = true;
    pop.x = x;
    pop.y = y;
    pop.text = text;
    pop.color = color;
    pop.life = 0;
    pop.maxLife = 0.85;
  }, []);

  const syncHudFromState = useCallback((st: NinjaFruitsState) => {
    setHud((prev) => {
      if (
        prev.phase === st.phase &&
        prev.score === st.score &&
        prev.bestScore === st.bestScore &&
        prev.lives === st.lives &&
        prev.combo === st.combo &&
        prev.maxCombo === st.maxCombo &&
        prev.multiplier === st.multiplier &&
        prev.slicedCount === st.slicedCount &&
        prev.giantSlicedCount === st.giantSlicedCount &&
        prev.callout === st.lastCallout
      ) {
        return prev;
      }
      return {
        phase: st.phase,
        score: st.score,
        bestScore: st.bestScore,
        lives: st.lives,
        maxLives: st.maxLives,
        combo: st.combo,
        maxCombo: st.maxCombo,
        multiplier: st.multiplier,
        slicedCount: st.slicedCount,
        giantSlicedCount: st.giantSlicedCount,
        callout: st.lastCallout,
      };
    });
  }, []);

  const startOrRestart = useCallback(
    (fromRemote = false) => {
      if (isGuestP2P && !fromRemote) {
        onSendPeerMessage({ type: 'NINJA_START' });
        return;
      }
      soundFx.click();
      const fresh = createInitialNinjaFruitsState(Math.max(bestScore, simRef.current.bestScore));
      fresh.phase = 'playing';
      simRef.current = fresh;
      aiMemRef.current = createNinjaAiMemory();
      p1TrailRef.current = [];
      p2TrailRef.current = [];
      syncHudFromState(fresh);
      if (connectionMode === 'p2p-host') {
        onSendPeerMessage({ type: 'NINJA_START' });
      }
    },
    [bestScore, connectionMode, isGuestP2P, onSendPeerMessage, syncHudFromState],
  );

  const togglePause = useCallback(
    (fromRemote = false, forcePaused?: boolean) => {
      const cur = simRef.current;
      if (cur.phase !== 'playing' && cur.phase !== 'paused') return;
      const nextPaused = forcePaused !== undefined ? forcePaused : cur.phase === 'playing';
      if (isGuestP2P && !fromRemote) {
        onSendPeerMessage({ type: 'NINJA_PAUSE', paused: nextPaused });
        return;
      }
      soundFx.click();
      simRef.current = { ...cur, phase: nextPaused ? 'paused' : 'playing' };
      syncHudFromState(simRef.current);
      if (connectionMode === 'p2p-host') {
        onSendPeerMessage({ type: 'NINJA_PAUSE', paused: nextPaused });
      }
    },
    [connectionMode, isGuestP2P, onSendPeerMessage, syncHudFromState],
  );

  // Register PeerJS handler for Ninja Fruits sync
  useEffect(() => {
    registerPeerHandler((msg) => {
      if (msg.type === 'NINJA_START') {
        if (!isGuestP2P) {
          startOrRestart(true);
        } else {
          const fresh = createInitialNinjaFruitsState(Math.max(bestScore, simRef.current.bestScore));
          fresh.phase = 'playing';
          simRef.current = fresh;
          syncHudFromState(fresh);
        }
      } else if (msg.type === 'NINJA_PAUSE') {
        if (!isGuestP2P) {
          togglePause(true, msg.paused);
        } else {
          simRef.current = {
            ...simRef.current,
            phase: msg.paused ? 'paused' : 'playing',
          };
          syncHudFromState(simRef.current);
        }
      } else if (msg.type === 'NINJA_SYNC' && isGuestP2P) {
        const prev = simRef.current;
        if (msg.lives < prev.lives) {
          soundFx.bombExplode();
        } else if (msg.giantSlicedCount > prev.giantSlicedCount) {
          soundFx.sliceGiant();
        } else if (msg.slicedCount > prev.slicedCount) {
          soundFx.sliceFruit(msg.combo);
        }
        const synced: NinjaFruitsState = {
          ...prev,
          phase: msg.phase,
          score: msg.score,
          bestScore: Math.max(prev.bestScore, msg.bestScore),
          lives: msg.lives,
          combo: msg.combo,
          maxCombo: msg.maxCombo,
          multiplier: msg.multiplier,
          slicedCount: msg.slicedCount,
          giantSlicedCount: msg.giantSlicedCount,
          elapsedSec: msg.elapsedSec,
          items: msg.items,
          flashColor: msg.flashColor,
          flashTimerSec: msg.flashColor !== 'none' ? 0.22 : 0,
          lastCallout: msg.lastCallout,
          calloutTimerSec: msg.lastCallout ? 1.1 : 0,
        };
        simRef.current = synced;
        if (msg.bestScore > bestScore) {
          onUpdateBestScore(msg.bestScore);
        }
        syncHudFromState(synced);
      }
    });
    return () => registerPeerHandler(null);
  }, [
    bestScore,
    isGuestP2P,
    onUpdateBestScore,
    registerPeerHandler,
    startOrRestart,
    syncHudFromState,
    togglePause,
  ]);

  // Sync document.body.dataset.state for crisp keyboard & test introspection
  useEffect(() => {
    const map: Record<NinjaFruitsState['phase'], string> = {
      ready: 'title',
      playing: 'playing',
      paused: 'paused',
      gameover: 'gameover',
    };
    document.body.dataset.state = map[hud.phase];
  }, [hud.phase]);

  // Keyboard shortcuts (Enter/Space to start, P/Esc to pause, R to restart)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Enter' || e.key === ' ') {
        if (simRef.current.phase === 'ready' || simRef.current.phase === 'gameover') {
          e.preventDefault();
          startOrRestart();
        }
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (simRef.current.phase === 'playing' || simRef.current.phase === 'paused') {
          e.preventDefault();
          togglePause();
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (simRef.current.phase !== 'ready') {
          e.preventDefault();
          startOrRestart();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [startOrRestart, togglePause]);

  // Pointer fallback handlers on canvas (always active when webcam hand isn't detected)
  const updatePointerFromEvent = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>, active: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      pointerStateRef.current = {
        normX,
        normY,
        active,
        lastMoveMs: performance.now(),
      };
      onLocalPointerHandChange(normX, normY, active);
    },
    [onLocalPointerHandChange],
  );

  const handlePointerLeave = useCallback(() => {
    pointerStateRef.current.active = false;
    onLocalPointerHandChange(pointerStateRef.current.normX, pointerStateRef.current.normY, false);
  }, [onLocalPointerHandChange]);

  // Main requestAnimationFrame simulation & high-craft 2D Canvas renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 960;
    let height = 560;
    let dpr = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return;
      width = rect.width;
      height = rect.height;
      dpr = rect.width > 900 ? 1 : Math.min(window.devicePixelRatio || 1, 1.25);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let rafId = 0;
    let lastTime = performance.now();
    let lastSyncSent = 0;
    let lastHudUpdate = 0;

    const pushTrail = (trail: TrailPoint[], x: number, y: number, now: number) => {
      const last = trail[trail.length - 1];
      if (!last || Math.hypot(x - last.x, y - last.y) > 4) {
        trail.push({ x, y, t: now });
        if (trail.length > MAX_TRAIL_POINTS) {
          trail.shift();
        }
      }
      while (trail.length > 0 && now - trail[0].t > TRAIL_MAX_AGE_MS) {
        trail.shift();
      }
    };

    const drawLaserTrail = (
      trail: TrailPoint[],
      now: number,
      outerColor: string,
      coreColor: string,
      tipX: number,
      tipY: number,
      active: boolean,
    ) => {
      if (trail.length >= 2) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 1; i < trail.length; i++) {
          const p0 = trail[i - 1];
          const p1 = trail[i];
          const age = 1 - Math.min(1, (now - p1.t) / TRAIL_MAX_AGE_MS);
          if (age <= 0) continue;

          // Outer glow ribbon
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.strokeStyle = outerColor;
          ctx.globalAlpha = age * 0.42;
          ctx.lineWidth = 4 + age * 16;
          ctx.stroke();

          // Bright laser core
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.strokeStyle = coreColor;
          ctx.globalAlpha = age * 0.95;
          ctx.lineWidth = 1.5 + age * 5;
          ctx.stroke();
        }
        ctx.restore();
      }

      if (active) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(tipX, tipY, 13, 0, Math.PI * 2);
        ctx.fillStyle = outerColor;
        ctx.globalAlpha = 0.3;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(tipX, tipY, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = coreColor;
        ctx.globalAlpha = 0.98;
        ctx.fill();
        ctx.restore();
      }
    };

    const drawFruit = (item: NinjaFruitItem, nowSec: number) => {
      const palette = FRUIT_COLORS[item.kind];
      ctx.save();
      ctx.translate(item.x, item.y);

      if (item.kind === 'bomb') {
        ctx.rotate(item.rotation);
        const pulse = 0.5 + 0.5 * Math.sin(nowSec * 11 + item.id);
        // Outer danger aura
        ctx.beginPath();
        ctx.arc(0, 0, item.radius + 9 + pulse * 6, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(232, 106, 88, ${0.42 + pulse * 0.4})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Matte iron bomb body
        const grad = ctx.createRadialGradient(-8, -8, 4, 0, 0, item.radius);
        grad.addColorStop(0, '#474D66');
        grad.addColorStop(0.65, '#1D2030');
        grad.addColorStop(1, '#10121C');
        ctx.beginPath();
        ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#E86A58';
        ctx.stroke();

        // Crisp danger cross emblem
        ctx.strokeStyle = '#FF7B6B';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-10, -10);
        ctx.lineTo(10, 10);
        ctx.moveTo(10, -10);
        ctx.lineTo(-10, 10);
        ctx.stroke();

        // Sparking fuse at top
        ctx.strokeStyle = '#D4B483';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -item.radius);
        ctx.quadraticCurveTo(9, -item.radius - 11, 14, -item.radius - 6);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(15, -item.radius - 6, 4 + pulse * 3, 0, Math.PI * 2);
        ctx.fillStyle = '#FDE047';
        ctx.fill();
        ctx.restore();
        return;
      }

      if (item.sliced) {
        const sep = 10 + item.slicedTimer * 135;
        const alpha = Math.max(0, 1 - item.slicedTimer / 0.72);
        ctx.globalAlpha = alpha;
        ctx.rotate(item.sliceAngle);

        for (const dir of [-1, 1]) {
          ctx.save();
          ctx.translate(0, dir * sep * 0.45);
          ctx.rotate(dir * item.slicedTimer * 1.4);
          ctx.beginPath();
          if (dir === -1) {
            ctx.arc(0, 0, item.radius, Math.PI, Math.PI * 2);
          } else {
            ctx.arc(0, 0, item.radius, 0, Math.PI);
          }
          ctx.closePath();
          ctx.fillStyle = palette.rind;
          ctx.fill();

          ctx.beginPath();
          if (dir === -1) {
            ctx.arc(0, 0, item.radius * 0.84, Math.PI, Math.PI * 2);
          } else {
            ctx.arc(0, 0, item.radius * 0.84, 0, Math.PI);
          }
          ctx.closePath();
          ctx.fillStyle = palette.flesh;
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
        return;
      }

      // Whole fruit rendering
      if (item.kind === 'giant') {
        const shimmer = 0.5 + 0.5 * Math.sin(nowSec * 7);
        // Cooperative Dual-Blade Target Halo
        ctx.beginPath();
        ctx.arc(0, 0, item.radius + 14 + shimmer * 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(232, 184, 97, 0.55)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Show P1 / P2 half-lock arcs when one player has already marked the Giant Fruit
        if (item.hitByP1At !== null) {
          ctx.beginPath();
          ctx.arc(0, 0, item.radius + 10, Math.PI * 0.5, Math.PI * 1.5);
          ctx.strokeStyle = '#E86A58';
          ctx.lineWidth = 6;
          ctx.stroke();
        }
        if (item.hitByP2At !== null) {
          ctx.beginPath();
          ctx.arc(0, 0, item.radius + 10, -Math.PI * 0.5, Math.PI * 0.5);
          ctx.strokeStyle = '#E8B861';
          ctx.lineWidth = 6;
          ctx.stroke();
        }

        ctx.rotate(item.rotation * 0.6);
        // Star-fruit faceted golden-coral silhouette
        ctx.beginPath();
        const spikes = 10;
        for (let i = 0; i < spikes * 2; i++) {
          const r = i % 2 === 0 ? item.radius : item.radius * 0.78;
          const a = (i * Math.PI) / spikes;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        const gGrad = ctx.createRadialGradient(-10, -10, 8, 0, 0, item.radius);
        gGrad.addColorStop(0, '#FFF8DC');
        gGrad.addColorStop(0.55, '#F2C15A');
        gGrad.addColorStop(1, '#E86A58');
        ctx.fillStyle = gGrad;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#FFF5D6';
        ctx.stroke();

        // Upright "×2 LAMES" callout inside giant fruit
        ctx.rotate(-item.rotation * 0.6);
        ctx.font = '700 13px "Plus Jakarta Sans", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#18131D';
        ctx.fillText('×2 LAMES', 0, 0);
        ctx.restore();
        return;
      }

      // Regular crisp fruit
      ctx.rotate(item.rotation);
      ctx.beginPath();
      ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
      ctx.fillStyle = palette.rind;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, item.radius * 0.82, 0, Math.PI * 2);
      ctx.fillStyle = palette.flesh;
      ctx.fill();

      // Glossy highlight & seeds/segments
      if (item.kind === 'watermelon' || item.kind === 'kiwi') {
        ctx.fillStyle = palette.accent;
        for (let s = 0; s < 6; s++) {
          const a = (s * Math.PI * 2) / 6;
          ctx.beginPath();
          ctx.ellipse(
            Math.cos(a) * item.radius * 0.45,
            Math.sin(a) * item.radius * 0.45,
            3.5,
            2,
            a,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      } else if (item.kind === 'orange') {
        ctx.strokeStyle = palette.accent;
        ctx.lineWidth = 2;
        for (let s = 0; s < 6; s++) {
          const a = (s * Math.PI) / 3;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * item.radius * 0.78, Math.sin(a) * item.radius * 0.78);
          ctx.stroke();
        }
      }

      // Specular crescent highlight
      ctx.beginPath();
      ctx.arc(-item.radius * 0.3, -item.radius * 0.3, item.radius * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fill();
      ctx.restore();
    };

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      if (now - lastTime < 28) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) * 0.001));
      lastTime = now;
      const nowSec = now * 0.001;

      // 1. Resolve Local Hand (MediaPipe Landmark 8 or Canvas Pointer Fallback)
      const localHand = localHandMetricsRef.current;
      const pointer = pointerStateRef.current;
      const useCameraHand = localHand.handDetected;
      const localNormX = useCameraHand ? localHand.indexX : pointer.normX;
      const localNormY = useCameraHand ? localHand.indexY : pointer.normY;
      const localActive = useCameraHand || (pointer.active && now - pointer.lastMoveMs < 1800);

      const localArenaX = localNormX * NINJA_ARENA_W;
      const localArenaY = localNormY * NINJA_ARENA_H;

      // 2. Update P1 & P2 Blade segments
      let p1Blade: BladeSegment;
      let p2Blade: BladeSegment;

      if (!isGuestP2P) {
        // Host or Solo controls P1
        const p1 = p1PosRef.current;
        p1.prevX = p1.x;
        p1.prevY = p1.y;
        p1.x = localArenaX;
        p1.y = localArenaY;
        p1.active = localActive;
        p1Blade = { prevX: p1.prevX, prevY: p1.prevY, x: p1.x, y: p1.y, active: p1.active };
        if (p1.active) pushTrail(p1TrailRef.current, p1.x, p1.y, now);

        if (isSolo) {
          const aiRes = stepAiNinjaPartner(aiMemRef.current, simRef.current, dt);
          aiMemRef.current = aiRes.nextMemory;
          p2Blade = aiRes.blade;
          p2PosRef.current = {
            prevX: aiRes.blade.prevX,
            prevY: aiRes.blade.prevY,
            x: aiRes.blade.x,
            y: aiRes.blade.y,
            active: aiRes.blade.active || simRef.current.phase === 'playing',
          };
          if (simRef.current.phase === 'playing') {
            pushTrail(p2TrailRef.current, p2Blade.x, p2Blade.y, now);
          }
        } else {
          const remote = partnerHandMetricsRef.current;
          const p2 = p2PosRef.current;
          p2.prevX = p2.x;
          p2.prevY = p2.y;
          p2.x = remote.indexX * NINJA_ARENA_W;
          p2.y = remote.indexY * NINJA_ARENA_H;
          p2.active = remote.handDetected;
          p2Blade = { prevX: p2.prevX, prevY: p2.prevY, x: p2.x, y: p2.y, active: p2.active };
          if (p2.active) pushTrail(p2TrailRef.current, p2.x, p2.y, now);
        }

        // Authoritative physics step on Host / Solo
        const step = stepNinjaFruitsPhysics(simRef.current, p1Blade, p2Blade, dt);
        simRef.current = step.nextState;

        for (const fb of step.feedbacks) {
          const pal = FRUIT_COLORS[fb.kind];
          if (fb.kind === 'bomb') {
            spawnBurst(fb.x, fb.y, '#E86A58', 30, 1.45);
            spawnBurst(fb.x, fb.y, '#FDE047', 16, 1.15);
            spawnPopup(fb.x, fb.y - 12, '−1 VIE !', '#FF7B6B');
          } else if (fb.kind === 'giant') {
            spawnBurst(fb.x, fb.y, '#FDE047', 28, 1.35);
            spawnBurst(fb.x, fb.y, '#E86A58', 22, 1.25);
            spawnPopup(fb.x, fb.y - 14, `+${fb.points} DUO !`, '#FDE68A');
          } else {
            spawnBurst(fb.x, fb.y, pal.juice, 14, 1);
            spawnPopup(fb.x, fb.y - 10, `+${fb.points}`, '#F6F2E9');
          }
        }

        for (const ev of step.events) {
          if (ev === 'bomb_hit') soundFx.bombExplode();
          else if (ev === 'giant_sliced') soundFx.sliceGiant();
          else if (ev === 'fruit_sliced') soundFx.sliceFruit(step.nextState.combo);
          else if (ev === 'gameover') soundFx.fallSting();
        }

        if (step.nextState.bestScore > bestScore) {
          onUpdateBestScore(step.nextState.bestScore);
        }

        // Broadcast authoritative state to Guest at ~25fps
        if (connectionMode === 'p2p-host' && now - lastSyncSent > 38) {
          lastSyncSent = now;
          const st = simRef.current;
          onSendPeerRealtime({
            type: 'NINJA_SYNC',
            phase: st.phase,
            score: st.score,
            bestScore: st.bestScore,
            lives: st.lives,
            combo: st.combo,
            maxCombo: st.maxCombo,
            multiplier: st.multiplier,
            slicedCount: st.slicedCount,
            giantSlicedCount: st.giantSlicedCount,
            elapsedSec: st.elapsedSec,
            items: st.items,
            flashColor: st.flashColor,
            lastCallout: st.lastCallout,
          });
        }
      } else {
        // Guest P2P: local player is P2 (gold blade), partner is P1 (coral blade)
        const p2 = p2PosRef.current;
        p2.prevX = p2.x;
        p2.prevY = p2.y;
        p2.x = localArenaX;
        p2.y = localArenaY;
        p2.active = localActive;
        if (p2.active) pushTrail(p2TrailRef.current, p2.x, p2.y, now);

        const remote = partnerHandMetricsRef.current;
        const p1 = p1PosRef.current;
        p1.prevX = p1.x;
        p1.prevY = p1.y;
        p1.x = remote.indexX * NINJA_ARENA_W;
        p1.y = remote.indexY * NINJA_ARENA_H;
        p1.active = remote.handDetected;
        if (p1.active) pushTrail(p1TrailRef.current, p1.x, p1.y, now);
      }

      // Prune stale trail points
      while (p1TrailRef.current.length > 0 && now - p1TrailRef.current[0].t > TRAIL_MAX_AGE_MS) {
        p1TrailRef.current.shift();
      }
      while (p2TrailRef.current.length > 0 && now - p2TrailRef.current[0].t > TRAIL_MAX_AGE_MS) {
        p2TrailRef.current.shift();
      }

      // Step pooled particles & popups
      const particles = particlesRef.current;
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = particles[i];
        if (!p.active) continue;
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 640 * dt;
      }

      const popups = popupsRef.current;
      for (let i = 0; i < MAX_POPUPS; i++) {
        const pop = popups[i];
        if (!pop.active) continue;
        pop.life += dt;
        if (pop.life >= pop.maxLife) {
          pop.active = false;
          continue;
        }
        pop.y -= 52 * dt;
      }

      // Sync React HUD at ~10Hz
      if (now - lastHudUpdate > 95) {
        lastHudUpdate = now;
        syncHudFromState(simRef.current);
      }

      // 3. Render Twilight Dojo Canvas
      const st = simRef.current;
      ctx.save();
      ctx.scale(dpr, dpr);

      // Deep Parisian midnight dojo gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#0B0E1A');
      bgGrad.addColorStop(0.58, '#14192B');
      bgGrad.addColorStop(1, '#1E1728');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Map 1000x620 arena cleanly into viewport
      const sx = width / NINJA_ARENA_W;
      const sy = height / NINJA_ARENA_H;
      const shakeAmp = st.trauma * st.trauma * 14;
      const shakeX = shakeAmp > 0.2 ? (Math.random() - 0.5) * 2 * shakeAmp : 0;
      const shakeY = shakeAmp > 0.2 ? (Math.random() - 0.5) * 2 * shakeAmp : 0;

      ctx.save();
      ctx.translate(shakeX, shakeY);
      ctx.scale(sx, sy);

      // Subtle crescent moon & atmospheric radial glow
      const moonGlow = ctx.createRadialGradient(500, 120, 18, 500, 120, 290);
      moonGlow.addColorStop(0, 'rgba(232, 184, 97, 0.14)');
      moonGlow.addColorStop(0.6, 'rgba(232, 106, 88, 0.05)');
      moonGlow.addColorStop(1, 'rgba(11, 14, 26, 0)');
      ctx.fillStyle = moonGlow;
      ctx.fillRect(0, 0, NINJA_ARENA_W, NINJA_ARENA_H);

      // Center cooperative divider & bomb danger seam hint
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.moveTo(NINJA_ARENA_W * 0.5, 68);
      ctx.lineTo(NINJA_ARENA_W * 0.5, NINJA_ARENA_H - 36);
      ctx.stroke();
      ctx.setLineDash([]);

      // Subtle zone labels at bottom corners of the arena
      ctx.font = '600 12px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(232, 106, 88, 0.55)';
      ctx.textAlign = 'left';
      ctx.fillText(`LAME CORAIL · ${isGuestP2P ? partnerName.toUpperCase() : localName.toUpperCase()}`, 26, NINJA_ARENA_H - 18);
      ctx.fillStyle = 'rgba(232, 184, 97, 0.55)';
      ctx.textAlign = 'right';
      ctx.fillText(
        `${isGuestP2P ? localName.toUpperCase() : partnerName.toUpperCase()} · LAME OR`,
        NINJA_ARENA_W - 26,
        NINJA_ARENA_H - 18,
      );
      ctx.restore();

      // Render active fruits, giant fruits & bombs
      for (let i = 0; i < st.items.length; i++) {
        drawFruit(st.items[i], nowSec);
      }

      // Render juice & spark particles
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = particles[i];
        if (!p.active) continue;
        const alpha = 1 - p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + alpha * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Render both laser trails
      drawLaserTrail(
        p1TrailRef.current,
        now,
        '#E86A58',
        '#FFF3EE',
        p1PosRef.current.x,
        p1PosRef.current.y,
        p1PosRef.current.active,
      );
      drawLaserTrail(
        p2TrailRef.current,
        now,
        '#E8B861',
        '#FFFBE8',
        p2PosRef.current.x,
        p2PosRef.current.y,
        p2PosRef.current.active,
      );

      // Render floating score popups
      ctx.font = '800 24px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < MAX_POPUPS; i++) {
        const pop = popups[i];
        if (!pop.active) continue;
        const alpha = 1 - pop.life / pop.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#0D0F17';
        ctx.fillText(pop.text, pop.x + 2, pop.y + 2);
        ctx.fillStyle = pop.color;
        ctx.fillText(pop.text, pop.x, pop.y);
      }
      ctx.globalAlpha = 1;

      // Subtle screen flash on bomb explosion or Giant Duo slice
      if (st.flashTimerSec > 0 && st.flashColor !== 'none') {
        const flashAlpha = Math.min(0.28, st.flashTimerSec * 0.9);
        ctx.fillStyle =
          st.flashColor === 'bomb'
            ? `rgba(232, 106, 88, ${flashAlpha})`
            : `rgba(232, 184, 97, ${flashAlpha})`;
        ctx.fillRect(0, 0, NINJA_ARENA_W, NINJA_ARENA_H);
      }

      ctx.restore();
      ctx.restore();
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [
    bestScore,
    connectionMode,
    isGuestP2P,
    isSolo,
    localHandMetricsRef,
    localName,
    onSendPeerRealtime,
    onUpdateBestScore,
    partnerHandMetricsRef,
    partnerName,
    spawnBurst,
    spawnPopup,
    syncHudFromState,
  ]);

  const sensorLabel =
    localStream && handTrackerStatus === 'ready'
      ? 'Index (Landmark 8) actif'
      : handTrackerStatus === 'loading'
        ? 'Chargement HandLandmarker...'
        : 'Glisse la souris ou le doigt sur l’arène';

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-1.5 sm:px-6 py-2 sm:py-4 space-y-2.5 sm:space-y-4">
      {/* Main Full-Bleed Canvas Stage */}
      <div className="relative rounded-3xl overflow-hidden border border-[#EAE4DC] bg-[#0B0E1A] shadow-[0_10px_32px_rgba(31,36,45,0.12)] h-[58dvh] min-h-[390px] max-h-[530px] sm:h-[580px] sm:max-h-none select-none touch-none">
        <canvas
          ref={canvasRef}
          data-testid="ninja-canvas"
          onPointerMove={(e) => updatePointerFromEvent(e, true)}
          onPointerDown={(e) => updatePointerFromEvent(e, true)}
          onPointerLeave={handlePointerLeave}
          className="w-full h-full block cursor-crosshair"
        />

        {/* Perimeter Top HUD — hidden during ready so mobile start card is completely clean */}
        {hud.phase !== 'ready' && (
          <div className="pointer-events-none absolute top-3 left-3 right-3 z-10 flex items-start justify-between gap-2 sm:gap-3">
            {/* Left: Score & Record */}
            <div className="rounded-2xl bg-white/94 backdrop-blur-md border border-[#EAE4DC] px-2.5 sm:px-3.5 py-1.5 sm:py-2 shadow-md">
              <p className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold text-[#6B7280]">Score</p>
              <div className="flex items-baseline gap-2">
                <span
                  data-testid="ninja-score"
                  className="text-xl sm:text-2xl font-extrabold text-[#1F242D] tabular-nums leading-none"
                >
                  {hud.score}
                </span>
                <span className="hidden sm:inline text-xs font-bold text-[#7C5CFC] tabular-nums">Record {hud.bestScore}</span>
              </div>
            </div>

            {/* Center: Combo Multiplier + 3 Lives */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-2 sm:gap-3 rounded-2xl bg-white/94 backdrop-blur-md border border-[#EAE4DC] px-2.5 sm:px-4 py-1.5 sm:py-2 shadow-md">
                <div className="flex items-center gap-1">
                  <Flame
                    className={`w-4 h-4 ${hud.multiplier >= 3 ? 'text-[#FF6B57]' : 'text-[#F59E0B]'}`}
                  />
                  <span className="text-sm font-extrabold text-[#1F242D] tabular-nums">
                    ×{hud.multiplier}
                  </span>
                  {hud.combo >= 2 && (
                    <span className="hidden sm:inline text-xs font-semibold text-[#6B7280] tabular-nums">({hud.combo})</span>
                  )}
                </div>

                <span className="w-px h-4 bg-[#EAE4DC]" aria-hidden="true" />

                <div className="flex items-center gap-1" aria-label={`${hud.lives} vies restantes`}>
                  {Array.from({ length: hud.maxLives }).map((_, idx) => (
                    <Heart
                      key={idx}
                      className={`w-4 h-4 transition-colors ${
                        idx < hud.lives
                          ? 'text-[#FF6B57] fill-[#FF6B57]'
                          : 'text-[#D1C9BE] fill-transparent'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {hud.callout && hud.phase === 'playing' && (
                <div className="rounded-xl bg-[#FEF6DC]/95 border border-[#F59E0B]/45 px-3 py-1 text-xs font-extrabold text-[#92400E] shadow-md">
                  {hud.callout}
                </div>
              )}
            </div>

            {/* Right: Pause & Restart controls */}
            <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
              {(hud.phase === 'playing' || hud.phase === 'paused') && (
                <>
                  <button
                    type="button"
                    onClick={() => togglePause()}
                    aria-label={hud.phase === 'paused' ? 'Reprendre' : 'Mettre en pause'}
                    className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-white/94 backdrop-blur-md border border-[#EAE4DC] text-[#1F242D] hover:bg-[#FAF7F2] shadow-md transition-colors"
                  >
                    {hud.phase === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => startOrRestart()}
                    aria-label="Recommencer la partie"
                    className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-white/94 backdrop-blur-md border border-[#EAE4DC] text-[#1F242D] hover:bg-[#FAF7F2] shadow-md transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Title Overlay */}
        {hud.phase === 'ready' && (
          <div className="absolute inset-0 z-20 flex justify-center bg-[#FAF7F2]/88 backdrop-blur-sm p-3.5 sm:p-4 overflow-y-auto">
            <div className="my-auto w-full max-w-md rounded-3xl bg-white border border-[#EAE4DC] p-4 sm:p-6 text-center space-y-3 sm:space-y-5 shadow-[0_14px_40px_rgba(31,36,45,0.12)]">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#FFE8E2] border border-[#FF6B57]/30 text-[#FF6B57] mx-auto">
                <Swords className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1F242D] tracking-tight">
                  Ninja Fruits en Duo
                </h1>
                <p className="text-sm text-[#6B7280] leading-relaxed font-medium">
                  Tranchez les fruits ensemble pour grimper jusqu’au combo ×5. Évitez les bombes au
                  centre et coupez les <span className="text-[#D97706] font-bold">Fruits Géants</span> à deux lames en même temps !
                </p>
              </div>
              <p className="hidden sm:block text-xs text-[#6B7280] font-medium">{sensorLabel}</p>
              <button
                type="button"
                data-start="true"
                onClick={() => startOrRestart()}
                className="w-full min-h-[54px] inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-extrabold text-base bg-[#FF6B57] hover:bg-[#F25743] text-white transition-colors shadow-md shadow-[#FF6B57]/25"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Lancer la partie</span>
              </button>
            </div>
          </div>
        )}

        {/* Pause Overlay */}
        {hud.phase === 'paused' && (
          <div className="absolute inset-0 z-20 flex justify-center bg-[#FAF7F2]/82 backdrop-blur-sm p-3.5 sm:p-4 overflow-y-auto">
            <div className="my-auto w-full max-w-sm rounded-3xl bg-white border border-[#EAE4DC] p-4 sm:p-6 text-center space-y-4 shadow-[0_14px_40px_rgba(31,36,45,0.12)]">
              <h2 className="text-2xl font-extrabold text-[#1F242D]">Partie en pause</h2>
              <p className="text-sm text-[#6B7280] font-medium">
                Score actuel : <span className="font-extrabold text-[#1F242D] tabular-nums">{hud.score}</span>
              </p>
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => togglePause()}
                  className="w-full min-h-[50px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-extrabold text-sm bg-[#FF6B57] hover:bg-[#F25743] text-white shadow-md shadow-[#FF6B57]/20 transition-colors"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Reprendre</span>
                </button>
                <button
                  type="button"
                  onClick={() => startOrRestart()}
                  className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm bg-[#FAF7F2] hover:bg-[#F1ECE3] border border-[#EAE4DC] text-[#1F242D] transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Recommencer</span>
                </button>
                <button
                  type="button"
                  onClick={onReturnToHub}
                  className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-sm border border-[#EAE4DC] hover:bg-[#FAF7F2] text-[#6B7280] hover:text-[#1F242D] transition-colors"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>Changer de jeu</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Game Over Overlay */}
        {hud.phase === 'gameover' && (
          <div className="absolute inset-0 z-20 flex justify-center bg-[#FAF7F2]/85 backdrop-blur-sm p-3.5 sm:p-4 overflow-y-auto">
            <div className="my-auto w-full max-w-md rounded-3xl bg-white border border-[#EAE4DC] p-4 sm:p-6 text-center space-y-3.5 sm:space-y-5 shadow-[0_14px_40px_rgba(31,36,45,0.14)]">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#FEF6DC] border border-[#F5D782] text-[#D97706] mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-extrabold text-[#1F242D]">Manche terminée</h2>
                <p className="text-sm text-[#6B7280] font-medium">
                  Toutes vos vies de couple ont sauté sur les bombes !
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="rounded-2xl bg-[#FAF7F2] border border-[#EAE4DC] p-3">
                  <p className="text-[11px] font-semibold text-[#6B7280]">Score</p>
                  <p className="text-xl font-extrabold text-[#1F242D] tabular-nums">{hud.score}</p>
                </div>
                <div className="rounded-2xl bg-[#FAF7F2] border border-[#EAE4DC] p-3">
                  <p className="text-[11px] font-semibold text-[#6B7280]">Max Combo</p>
                  <p className="text-xl font-extrabold text-[#7C5CFC] tabular-nums">{hud.maxCombo}</p>
                </div>
                <div className="rounded-2xl bg-[#FAF7F2] border border-[#EAE4DC] p-3">
                  <p className="text-[11px] font-semibold text-[#6B7280]">Géants Duo</p>
                  <p className="text-xl font-extrabold text-[#FF6B57] tabular-nums">{hud.giantSlicedCount}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  data-start="true"
                  onClick={() => startOrRestart()}
                  className="flex-1 min-h-[52px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-extrabold text-sm bg-[#FF6B57] hover:bg-[#F25743] text-white shadow-md shadow-[#FF6B57]/20 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Rejouer</span>
                </button>
                <button
                  type="button"
                  onClick={onReturnToHub}
                  className="flex-1 min-h-[50px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm bg-[#FAF7F2] hover:bg-[#F1ECE3] border border-[#EAE4DC] text-[#1F242D] transition-colors"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>Retour au Hub</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Persistent Live Duo Cameras & Sensor Strip below canvas */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 max-w-3xl mx-auto">
        <CameraFeedTile
          name={localName}
          subtitle={sensorLabel}
          stream={localStream}
          isLocal
          cameraEnabled={cameraEnabled}
          micMuted={micMuted}
          trackerStatus={handTrackerStatus}
          metricsRef={localFaceMetricsRef}
          onVideoRef={onVideoRef}
          onRequestCamera={onRequestCamera}
          compact
        />
        <CameraFeedTile
          name={partnerName}
          subtitle={isSolo ? 'Partenaire IA · Lame Or' : 'Partenaire synchronisé · Lame Or'}
          stream={remoteStream}
          isAi={isSolo}
          metricsRef={partnerFaceMetricsRef}
          compact
        />
      </div>
    </main>
  );
}
