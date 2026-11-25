import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  Flame,
  Heart,
  LayoutGrid,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Users,
  Utensils,
} from 'lucide-react';
import type {
  ConnectionMode,
  FaceMetrics,
  MiamFoodItem,
  MiamManiaState,
  MiamMode,
  PeerMessage,
  TrackerStatus,
} from '../types/duoplay';
import {
  createInitialMiamManiaState,
  createMiamAiPartnerState,
  MIAM_ARENA_H,
  MIAM_ARENA_W,
  MOUTH_CATCH_RADIUS,
  stepAiMiamPartner,
  stepMiamManiaPhysics,
} from '../game/miamManiaPhysics';
import { useI18n } from '../i18n/LanguageContext';
import { soundFx } from '../utils/soundFx';
import { CameraFeedTile } from './CameraFeedTile';

interface MiamManiaGameViewProps {
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
  bestScore: number;
  onUpdateBestScore: (score: number) => void;
  onVideoRef: (el: HTMLVideoElement | null) => void;
  onRequestCamera: () => void;
  onSendPeerMessage: (msg: PeerMessage) => void;
  onSendPeerRealtime: (msg: PeerMessage) => void;
  registerPeerHandler: (handler: ((msg: PeerMessage) => void) | null) => void;
  onReturnToHub: () => void;
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

const MAX_PARTICLES = 90;
const MAX_POPUPS = 14;

function createParticlePool(): PooledParticle[] {
  return Array.from({ length: MAX_PARTICLES }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 0.55,
    size: 4,
    color: '#E8B861',
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

export function MiamManiaGameView({
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
  bestScore,
  onUpdateBestScore,
  onVideoRef,
  onRequestCamera,
  onSendPeerMessage,
  onSendPeerRealtime,
  registerPeerHandler,
  onReturnToHub,
}: MiamManiaGameViewProps) {
  const { t } = useI18n();
  const isSolo = connectionMode === 'solo';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const simRef = useRef<MiamManiaState>(createInitialMiamManiaState('duel', bestScore));
  const aiPartnerRef = useRef(createMiamAiPartnerState());
  const partnerStatusRef = useRef({ score: 0, lives: 3, mouthOpen: false });

  const particlesRef = useRef<PooledParticle[]>(createParticlePool());
  const particleCursorRef = useRef(0);
  const popupsRef = useRef<PooledPopup[]>(createPopupPool());
  const popupCursorRef = useRef(0);

  // Pointer & keyboard fallback when no physical camera is tracking jawOpen/mouthX
  const pointerMouthRef = useRef({ normX: 0.5, normY: 0.68, pointerDown: false, spaceDown: false });

  const [hud, setHud] = useState(() => ({
    phase: simRef.current.phase,
    mode: simRef.current.mode,
    score: 0,
    bestScore,
    lives: 3,
    maxLives: 3,
    caughtCount: 0,
    streak: 0,
    mouthOpen: false,
    partnerScore: 0,
    partnerLives: 3,
    partnerMouthOpen: false,
  }));

  // Attach localStream to subtle mirrored live camera canvas backdrop when available
  useEffect(() => {
    const v = bgVideoRef.current;
    if (!v) return;
    if (localStream && cameraEnabled) {
      if (v.srcObject !== localStream) v.srcObject = localStream;
      v.play().catch(() => {});
    } else {
      v.srcObject = null;
    }
  }, [localStream, cameraEnabled]);

  const spawnBurst = useCallback((x: number, y: number, color: string, count: number) => {
    const pool = particlesRef.current;
    for (let i = 0; i < count; i++) {
      const idx = particleCursorRef.current;
      particleCursorRef.current = (idx + 1) % MAX_PARTICLES;
      const p = pool[idx];
      const a = Math.random() * Math.PI * 2;
      const spd = 90 + Math.random() * 220;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * spd;
      p.vy = Math.sin(a) * spd - 45;
      p.life = 0;
      p.maxLife = 0.35 + Math.random() * 0.25;
      p.size = 3 + Math.random() * 4.5;
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

  const syncHud = useCallback((st: MiamManiaState, mouthOpen: boolean) => {
    const partner = partnerStatusRef.current;
    setHud({
      phase: st.phase,
      mode: st.mode,
      score: st.score,
      bestScore: st.bestScore,
      lives: st.lives,
      maxLives: st.maxLives,
      caughtCount: st.caughtCount,
      streak: st.streak,
      mouthOpen,
      partnerScore: partner.score,
      partnerLives: partner.lives,
      partnerMouthOpen: partner.mouthOpen,
    });
  }, []);

  const selectMode = useCallback(
    (mode: MiamMode, broadcast = true) => {
      soundFx.click();
      simRef.current = { ...simRef.current, mode };
      syncHud(simRef.current, false);
      if (broadcast && !isSolo) {
        onSendPeerMessage({ type: 'MIAM_SET_MODE', mode });
      }
    },
    [isSolo, onSendPeerMessage, syncHud],
  );

  const startOrRestart = useCallback(
    (forcedMode?: MiamMode, broadcast = true) => {
      soundFx.click();
      const mode = forcedMode ?? simRef.current.mode;
      const fresh = createInitialMiamManiaState(mode, Math.max(bestScore, simRef.current.bestScore));
      fresh.phase = 'playing';
      simRef.current = fresh;
      aiPartnerRef.current = createMiamAiPartnerState();
      partnerStatusRef.current = { score: 0, lives: 3, mouthOpen: false };
      syncHud(fresh, false);

      if (broadcast && !isSolo) {
        onSendPeerMessage({ type: 'MIAM_START', mode });
      }
    },
    [bestScore, isSolo, onSendPeerMessage, syncHud],
  );

  const togglePause = useCallback(() => {
    const cur = simRef.current;
    if (cur.phase !== 'playing' && cur.phase !== 'paused') return;
    soundFx.click();
    simRef.current = { ...cur, phase: cur.phase === 'playing' ? 'paused' : 'playing' };
    syncHud(simRef.current, false);
  }, [syncHud]);

  // Register PeerJS handler (strictly syncs score, lives, and mouthOpen!)
  useEffect(() => {
    registerPeerHandler((msg) => {
      if (msg.type === 'MIAM_SET_MODE') {
        selectMode(msg.mode, false);
      } else if (msg.type === 'MIAM_START') {
        startOrRestart(msg.mode, false);
      } else if (msg.type === 'MIAM_SYNC') {
        partnerStatusRef.current = {
          score: msg.score,
          lives: msg.lives,
          mouthOpen: msg.mouthOpen,
        };
      }
    });
    return () => registerPeerHandler(null);
  }, [registerPeerHandler, selectMode, startOrRestart]);

  // Sync body dataset state
  useEffect(() => {
    const map: Record<MiamManiaState['phase'], string> = {
      ready: 'title',
      playing: 'playing',
      paused: 'paused',
      gameover: 'gameover',
    };
    document.body.dataset.state = map[hud.phase];
  }, [hud.phase]);

  // Keyboard shortcuts (Space holds mouth open during play, Enter starts, P/Esc pauses, R restarts)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (simRef.current.phase === 'playing') {
          pointerMouthRef.current.spaceDown = true;
        } else if (simRef.current.phase === 'ready' || simRef.current.phase === 'gameover') {
          startOrRestart();
        }
      } else if (e.key === 'Enter') {
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
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        pointerMouthRef.current.spaceDown = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [startOrRestart, togglePause]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    pointerMouthRef.current.normX = Math.max(0.08, Math.min(0.92, (e.clientX - rect.left) / rect.width));
    pointerMouthRef.current.normY = Math.max(0.25, Math.min(0.88, (e.clientY - rect.top) / rect.height));
  }, []);

  // Main 2D Canvas Simulation & Renderer
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
    let lastHudUpdate = 0;
    let lastPeerSync = 0;

    const drawFoodItem = (item: MiamFoodItem, nowSec: number) => {
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(item.rotation);

      // Soft aura differentiating tasty bonuses (gold/sage) vs traps (coral danger pulse)
      const pulse = 0.5 + 0.5 * Math.sin(nowSec * 9 + item.id);
      ctx.beginPath();
      ctx.arc(0, 0, item.radius + (item.isTrap ? 8 + pulse * 4 : 6), 0, Math.PI * 2);
      ctx.fillStyle = item.isTrap
        ? `rgba(232, 106, 88, ${0.22 + pulse * 0.16})`
        : 'rgba(232, 184, 97, 0.22)';
      ctx.fill();

      if (item.isTrap) {
        ctx.strokeStyle = 'rgba(232, 106, 88, 0.75)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Crisp rich emoji + clean stylized backdrop disc for maximum legibility at speed
      ctx.beginPath();
      ctx.arc(0, 0, item.radius * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = item.isTrap ? '#2A1622' : '#1B2236';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = item.isTrap ? '#E86A58' : '#E8B861';
      ctx.stroke();

      const emoji =
        item.kind === 'strawberry'
          ? '🍓'
          : item.kind === 'pizza'
            ? '🍕'
            : item.kind === 'heart'
              ? '❤️'
              : item.kind === 'chili'
                ? '🌶️'
                : '🧦';
      ctx.font = '32px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 0, 2);

      ctx.restore();
    };

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      if (now - lastTime < 28) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) * 0.001));
      lastTime = now;
      const nowSec = now * 0.001;

      const face = localMetricsRef.current;
      const ptr = pointerMouthRef.current;
      const useCamFace = face.faceDetected;

      const mouthNormX = useCamFace ? face.mouthX : ptr.normX;
      const mouthNormY = useCamFace ? face.mouthY : ptr.normY;
      const mouthOpen =
        (useCamFace && face.mouthOpen) || ptr.pointerDown || ptr.spaceDown;

      const mouthArenaX = mouthNormX * MIAM_ARENA_W;
      const mouthArenaY = mouthNormY * MIAM_ARENA_H;

      // Step local physics
      const step = stepMiamManiaPhysics(
        simRef.current,
        mouthArenaX,
        mouthArenaY,
        mouthOpen,
        dt,
      );
      simRef.current = step.nextState;

      for (const fb of step.feedbacks) {
        if (fb.isTrap) {
          spawnBurst(fb.x, fb.y, '#E86A58', 22);
          spawnPopup(fb.x, fb.y - 12, '−1 ❤️', '#FF7B6B');
        } else {
          spawnBurst(fb.x, fb.y, '#E8B861', 16);
          spawnPopup(fb.x, fb.y - 12, '+10', '#5CC29F');
        }
      }

      for (const ev of step.events) {
        if (ev === 'bonus_caught') soundFx.chompBonus(step.nextState.streak);
        else if (ev === 'trap_eaten') soundFx.trapYuck();
        else if (ev === 'gameover') soundFx.fallSting();
      }

      // Update Solo AI partner
      if (isSolo) {
        aiPartnerRef.current = stepAiMiamPartner(
          aiPartnerRef.current,
          simRef.current.phase === 'playing',
          dt,
        );
        partnerStatusRef.current = {
          score: aiPartnerRef.current.score,
          lives: aiPartnerRef.current.lives,
          mouthOpen: aiPartnerRef.current.mouthOpen,
        };
      } else if (now - lastPeerSync > 70) {
        // Send lightweight PeerJS sync: score, lives, and mouthOpen!
        lastPeerSync = now;
        onSendPeerRealtime({
          type: 'MIAM_SYNC',
          score: simRef.current.score,
          lives: simRef.current.lives,
          mouthOpen,
          phase: simRef.current.phase,
        });
      }

      const effectiveBest =
        simRef.current.mode === 'coop'
          ? simRef.current.score + partnerStatusRef.current.score
          : simRef.current.score;
      if (effectiveBest > bestScore) {
        onUpdateBestScore(effectiveBest);
      }

      // Step particles & popups
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
        p.vy += 460 * dt;
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
        pop.y -= 50 * dt;
      }

      if (now - lastHudUpdate > 85) {
        lastHudUpdate = now;
        syncHud(simRef.current, mouthOpen);
      }

      // Render Canvas
      const st = simRef.current;
      ctx.save();
      ctx.scale(dpr, dpr);

      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#0D1020');
      bgGrad.addColorStop(0.65, '#161A2E');
      bgGrad.addColorStop(1, '#20182A');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Draw soft mirrored webcam feed underneath so the player literally catches foods with their real face!
      const vid = bgVideoRef.current;
      if (vid && vid.readyState >= 2 && vid.videoWidth > 0 && cameraEnabled) {
        ctx.save();
        ctx.globalAlpha = 0.42;
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        const scale = Math.max(width / vid.videoWidth, height / vid.videoHeight);
        const dw = vid.videoWidth * scale;
        const dh = vid.videoHeight * scale;
        ctx.drawImage(vid, (width - dw) * 0.5, (height - dh) * 0.5, dw, dh);
        ctx.restore();
      }

      const sx = width / MIAM_ARENA_W;
      const sy = height / MIAM_ARENA_H;
      const shakeAmp = st.trauma * st.trauma * 13;
      const shakeX = shakeAmp > 0.2 ? (Math.random() - 0.5) * 2 * shakeAmp : 0;
      const shakeY = shakeAmp > 0.2 ? (Math.random() - 0.5) * 2 * shakeAmp : 0;

      ctx.save();
      ctx.translate(shakeX, shakeY);
      ctx.scale(sx, sy);

      // Draw mouth catcher reticle at player's real mouth (or pointer fallback)
      ctx.save();
      ctx.translate(mouthArenaX, mouthArenaY);

      if (mouthOpen) {
        // Wide open hungry mouth zone (vibrant coral-gold halo)
        const glow = ctx.createRadialGradient(0, 0, 12, 0, 0, MOUTH_CATCH_RADIUS + 20);
        glow.addColorStop(0, 'rgba(92, 194, 159, 0.36)');
        glow.addColorStop(1, 'rgba(92, 194, 159, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, MOUTH_CATCH_RADIUS + 20, 0, Math.PI * 2);
        ctx.fill();

        // Stylized open cartoon mouth target
        ctx.beginPath();
        ctx.ellipse(0, 0, MOUTH_CATCH_RADIUS * 0.84, MOUTH_CATCH_RADIUS * 0.68, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(20, 12, 24, 0.72)';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#5CC29F';
        ctx.stroke();

        // Cute tongue arc inside open mouth
        ctx.beginPath();
        ctx.ellipse(0, MOUTH_CATCH_RADIUS * 0.28, MOUTH_CATCH_RADIUS * 0.42, MOUTH_CATCH_RADIUS * 0.2, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#E86A58';
        ctx.fill();
      } else {
        // Mouth closed (safe shield against chili & socks!)
        ctx.beginPath();
        ctx.arc(0, 0, MOUTH_CATCH_RADIUS * 0.72, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(232, 184, 97, 0.55)';
        ctx.lineWidth = 3;
        ctx.setLineDash([7, 6]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Closed smile line
        ctx.beginPath();
        ctx.moveTo(-22, 0);
        ctx.quadraticCurveTo(0, 8, 22, 0);
        ctx.strokeStyle = '#F6F2E9';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      ctx.restore();

      // Render falling foods & traps
      for (let i = 0; i < st.items.length; i++) {
        drawFoodItem(st.items[i], nowSec);
      }

      // Particles
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = particles[i];
        if (!p.active) continue;
        const alpha = 1 - p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Popups
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

      // Subtle screen flash
      if (st.flashTimerSec > 0 && st.flashKind !== 'none') {
        const a = Math.min(0.24, st.flashTimerSec * 0.9);
        ctx.fillStyle =
          st.flashKind === 'trap' ? `rgba(232, 106, 88, ${a})` : `rgba(92, 194, 159, ${a})`;
        ctx.fillRect(0, 0, MIAM_ARENA_W, MIAM_ARENA_H);
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
    cameraEnabled,
    isSolo,
    localMetricsRef,
    onSendPeerRealtime,
    onUpdateBestScore,
    spawnBurst,
    spawnPopup,
    syncHud,
  ]);

  const combinedScore = hud.score + hud.partnerScore;
  const sensorHint =
    localStream && trackerStatus === 'ready' ? t.miamSensorReady : t.miamSensorFallback;

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-1.5 sm:px-6 py-2 sm:py-4 space-y-2.5 sm:space-y-4">
      <video
        ref={bgVideoRef}
        muted
        playsInline
        autoPlay
        aria-hidden="true"
        className="hidden"
      />

      {/* Full-Bleed Falling-Food Catch Stage */}
      <div className="relative rounded-2xl overflow-hidden border border-white/12 bg-[#0D1020] shadow-2xl shadow-black/50 h-[58dvh] min-h-[390px] max-h-[530px] sm:h-[580px] sm:max-h-none select-none touch-none">
        <canvas
          ref={canvasRef}
          data-testid="miam-canvas"
          onPointerMove={handlePointerMove}
          onPointerDown={(e) => {
            handlePointerMove(e);
            pointerMouthRef.current.pointerDown = true;
          }}
          onPointerUp={() => {
            pointerMouthRef.current.pointerDown = false;
          }}
          onPointerLeave={() => {
            pointerMouthRef.current.pointerDown = false;
          }}
          className="w-full h-full block cursor-crosshair"
        />

        {/* Perimeter Top HUD — hidden during ready so mobile start card never clashes */}
        {hud.phase !== 'ready' && (
          <div className="pointer-events-none absolute top-3 left-3 right-3 z-10 flex items-start justify-between gap-2 sm:gap-3">
            {/* Left: Score (Duel vs Shared Couple Score) */}
            <div className="rounded-xl bg-[#111524]/92 border border-white/12 px-2.5 sm:px-3.5 py-1.5 sm:py-2 shadow-lg">
              <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#A9A295]">
                {hud.mode === 'coop' ? t.miamCoupleScore : t.scoreLabel}
              </p>
              <div className="flex items-baseline gap-2">
                <span
                  data-testid="miam-score"
                  className="text-xl sm:text-2xl font-bold text-[#F6F2E9] tabular-nums leading-none"
                >
                  {hud.mode === 'coop' ? combinedScore : hud.score}
                </span>
                {hud.mode === 'duel' && (
                  <span className="hidden sm:inline text-xs text-[#E8B861] tabular-nums">
                    {partnerName}: {hud.partnerScore}
                  </span>
                )}
              </div>
            </div>

            {/* Center: Mouth State + Lives */}
            <div className="flex items-center gap-2 sm:gap-3 rounded-xl bg-[#111524]/92 border border-white/12 px-2.5 sm:px-4 py-1.5 sm:py-2 shadow-lg">
              <span
                className={`text-[11px] sm:text-xs font-bold tracking-wide ${
                  hud.mouthOpen ? 'text-[#5CC29F]' : 'text-[#E8B861]'
                }`}
              >
                {hud.mouthOpen ? t.miamMouthOpen : t.miamMouthClosed}
              </span>

              <span className="w-px h-4 bg-white/15" aria-hidden="true" />

              <div className="flex items-center gap-1" aria-label={`${hud.lives} ${t.miamLivesLeft}`}>
                {Array.from({ length: hud.maxLives }).map((_, idx) => (
                  <Heart
                    key={idx}
                    className={`w-4 h-4 ${
                      idx < hud.lives
                        ? 'text-[#E86A58] fill-[#E86A58]'
                        : 'text-white/20 fill-transparent'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Right: Pause & Restart */}
            <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
              {(hud.phase === 'playing' || hud.phase === 'paused') && (
                <>
                  <button
                    type="button"
                    onClick={togglePause}
                    aria-label={hud.phase === 'paused' ? t.resume : t.pause}
                    className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-[#111524]/92 border border-white/14 text-[#F6F2E9] hover:bg-[#1D233B] transition-colors"
                  >
                    {hud.phase === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => startOrRestart()}
                    aria-label={t.restart}
                    className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-[#111524]/92 border border-white/14 text-[#F6F2E9] hover:bg-[#1D233B] transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Title Overlay with Duel / Coop Mode Selector */}
        {hud.phase === 'ready' && (
          <div className="absolute inset-0 z-20 flex justify-center bg-[#0D1020]/82 p-3 sm:p-4 overflow-y-auto">
            <div className="my-auto w-full max-w-md rounded-2xl bg-[#141724] border border-white/15 p-4 sm:p-6 text-center space-y-3 sm:space-y-5 shadow-2xl">
              <div className="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#E8B861]/18 border border-[#E8B861]/35 text-[#E8B861] mx-auto">
                <Utensils className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>

              <div className="space-y-1.5">
                <h1 className="text-xl sm:text-3xl font-bold text-[#F6F2E9] tracking-tight">
                  {t.miamTitle}
                </h1>
                <p className="text-xs sm:text-sm text-[#CBC4B6] leading-relaxed">{t.miamDesc}</p>
              </div>

              {/* Duel vs Co-op Mode Picker — 48px touch targets */}
              <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[#0D0F17] border border-white/10">
                <button
                  type="button"
                  data-miam-mode="duel"
                  onClick={() => selectMode('duel')}
                  className={`min-h-[48px] py-2.5 px-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${
                    hud.mode === 'duel'
                      ? 'bg-[#E86A58] text-[#11131E]'
                      : 'text-[#CBC4B6] hover:text-[#F6F2E9]'
                  }`}
                >
                  <Flame className="w-4 h-4 shrink-0" />
                  <span>{t.miamModeDuel}</span>
                </button>
                <button
                  type="button"
                  data-miam-mode="coop"
                  onClick={() => selectMode('coop')}
                  className={`min-h-[48px] py-2.5 px-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${
                    hud.mode === 'coop'
                      ? 'bg-[#E8B861] text-[#11131E]'
                      : 'text-[#CBC4B6] hover:text-[#F6F2E9]'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span>{t.miamModeCoop}</span>
                </button>
              </div>

              <p className="hidden sm:block text-xs text-[#A9A295]">{sensorHint}</p>

              <button
                type="button"
                data-start="true"
                onClick={() => startOrRestart()}
                className="w-full min-h-[54px] inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-bold text-base bg-[#E8B861] hover:bg-[#F2C775] text-[#11131E] transition-colors shadow-lg shadow-[#E8B861]/25"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{t.miamStartBtn}</span>
              </button>
            </div>
          </div>
        )}

        {/* Pause Overlay */}
        {hud.phase === 'paused' && (
          <div className="absolute inset-0 z-20 flex justify-center bg-[#0D1020]/78 p-3.5 sm:p-4 overflow-y-auto">
            <div className="my-auto w-full max-w-sm rounded-2xl bg-[#141724] border border-white/15 p-4 sm:p-6 text-center space-y-4 shadow-2xl">
              <h2 className="text-2xl font-bold text-[#F6F2E9]">{t.pausedTitle}</h2>
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={togglePause}
                  className="w-full min-h-[50px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm bg-[#E8B861] text-[#11131E]"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{t.resume}</span>
                </button>
                <button
                  type="button"
                  onClick={() => startOrRestart()}
                  className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-white/10 text-[#F6F2E9]"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{t.restart}</span>
                </button>
                <button
                  type="button"
                  onClick={onReturnToHub}
                  className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm border border-white/12 text-[#CBC4B6]"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>{t.changeGame}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Game Over Overlay */}
        {hud.phase === 'gameover' && (
          <div className="absolute inset-0 z-20 flex justify-center bg-[#0D1020]/84 p-3.5 sm:p-4 overflow-y-auto">
            <div className="my-auto w-full max-w-md rounded-2xl bg-[#141724] border border-white/15 p-4 sm:p-6 text-center space-y-3.5 sm:space-y-5 shadow-2xl">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#E86A58]/18 border border-[#E86A58]/35 text-[#F08272] mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-[#F6F2E9]">{t.gameOverTitle}</h2>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <p className="text-[11px] text-[#A9A295] truncate">
                    {hud.mode === 'coop' ? t.miamCoupleScore : localName}
                  </p>
                  <p className="text-xl font-bold text-[#F6F2E9] tabular-nums">
                    {hud.mode === 'coop' ? combinedScore : hud.score}
                  </p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <p className="text-[11px] text-[#A9A295] truncate">{partnerName}</p>
                  <p className="text-xl font-bold text-[#E8B861] tabular-nums">{hud.partnerScore}</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <p className="text-[11px] text-[#A9A295] truncate">{t.miamCaughtLabel}</p>
                  <p className="text-xl font-bold text-[#5CC29F] tabular-nums">{hud.caughtCount}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  data-start="true"
                  onClick={() => startOrRestart()}
                  className="flex-1 min-h-[52px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm bg-[#E8B861] hover:bg-[#F2C775] text-[#11131E]"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{t.playAgain}</span>
                </button>
                <button
                  type="button"
                  onClick={onReturnToHub}
                  className="flex-1 min-h-[50px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm bg-white/10 hover:bg-white/16 text-[#F6F2E9]"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>{t.backToHub}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live Duo Cameras + Partner Live Score / Mouth Sync Strip */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 max-w-3xl mx-auto">
        <CameraFeedTile
          name={localName}
          subtitle={sensorHint}
          stream={localStream}
          isLocal
          cameraEnabled={cameraEnabled}
          micMuted={micMuted}
          trackerStatus={trackerStatus}
          metricsRef={localMetricsRef}
          onVideoRef={onVideoRef}
          onRequestCamera={onRequestCamera}
          compact
        />
        <CameraFeedTile
          name={partnerName}
          subtitle={`${t.scoreLabel}: ${hud.partnerScore} · ❤️ ${hud.partnerLives} · ${
            hud.partnerMouthOpen ? t.miamMouthOpen : t.miamMouthClosed
          }`}
          stream={remoteStream}
          isAi={isSolo}
          metricsRef={partnerMetricsRef}
          compact
        />
      </div>
    </main>
  );
}
