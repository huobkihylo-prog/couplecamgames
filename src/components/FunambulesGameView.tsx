import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Wind,
} from 'lucide-react';
import type {
  ConnectionMode,
  FaceMetrics,
  FunambulesState,
  PeerMessage,
  TrackerStatus,
} from '../types/duoplay';
import {
  computeHeadTiltInput,
  createInitialFunambulesState,
  FALL_ANGLE_DEG,
  stepFunambulesPhysics,
} from '../game/funambulesPhysics';
import { soundFx } from '../utils/soundFx';
import { CameraFeedTile } from './CameraFeedTile';

interface FunambulesGameViewProps {
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
  funambulesBestM: number;
  onUpdateBestDistance: (m: number) => void;
  onVideoRef: (el: HTMLVideoElement | null) => void;
  onRequestCamera: () => void;
  onSendPeerMessage: (msg: PeerMessage) => void;
  onSendPeerRealtime: (msg: PeerMessage) => void;
  registerPeerHandler: (handler: ((msg: PeerMessage) => void) | null) => void;
  onStateForAiChange: (state: FunambulesState) => void;
  onReturnToHub: () => void;
  onManualTiltChange: (tiltRad: number) => void;
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

const MAX_PARTICLES = 96;

function createParticlePool(): PooledParticle[] {
  const pool: PooledParticle[] = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    pool.push({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 2,
      color: '#E8B861',
    });
  }
  return pool;
}

export function FunambulesGameView({
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
  funambulesBestM,
  onUpdateBestDistance,
  onVideoRef,
  onRequestCamera,
  onSendPeerMessage,
  onSendPeerRealtime,
  registerPeerHandler,
  onStateForAiChange,
  onReturnToHub,
  onManualTiltChange,
}: FunambulesGameViewProps) {
  const isGuestP2P = connectionMode === 'p2p-guest';
  const isSolo = connectionMode === 'solo';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<FunambulesState>(createInitialFunambulesState(funambulesBestM));
  const particlesRef = useRef<PooledParticle[]>(createParticlePool());
  const particleCursorRef = useRef(0);
  const keysRef = useRef<Set<string>>(new Set());
  const buttonDirRef = useRef<number>(0);

  // Throttled HUD snapshot (only updates on phase/integer changes, never 60Hz)
  const [hud, setHud] = useState(() => ({
    phase: simRef.current.phase,
    distanceInt: 0,
    targetDistanceM: simRef.current.targetDistanceM,
    harmonyInt: 0,
    bestDistanceM: funambulesBestM,
    syncStreakInt: 0,
    isSynced: false,
    hazardLabel: '',
    hazardPhase: 'none' as 'none' | 'telegraph' | 'active',
    angleInt: 0,
    elapsedSec: 0,
  }));

  const spawnParticle = useCallback(
    (x: number, y: number, vx: number, vy: number, maxLife: number, size: number, color: string) => {
      const pool = particlesRef.current;
      const idx = particleCursorRef.current % MAX_PARTICLES;
      particleCursorRef.current += 1;
      const p = pool[idx];
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.life = 0;
      p.maxLife = maxLife;
      p.size = size;
      p.color = color;
    },
    [],
  );

  // Sync body state attribute
  useEffect(() => {
    if (hud.phase === 'playing' || hud.phase === 'falling') {
      document.body.dataset.state = 'playing';
    } else if (hud.phase === 'paused') {
      document.body.dataset.state = 'paused';
    } else if (hud.phase === 'gameover' || hud.phase === 'victory') {
      document.body.dataset.state = 'gameover';
    } else {
      document.body.dataset.state = 'title';
    }
  }, [hud.phase]);

  const startTraversal = useCallback(
    (broadcast = true) => {
      const fresh = {
        ...createInitialFunambulesState(Math.max(funambulesBestM, simRef.current.bestDistanceM)),
        phase: 'playing' as const,
      };
      simRef.current = fresh;
      keysRef.current.clear();
      buttonDirRef.current = 0;
      onStateForAiChange(fresh);
      soundFx.countdownGo();
      setHud({
        phase: 'playing',
        distanceInt: 0,
        targetDistanceM: fresh.targetDistanceM,
        harmonyInt: 0,
        bestDistanceM: fresh.bestDistanceM,
        syncStreakInt: 0,
        isSynced: false,
        hazardLabel: '',
        hazardPhase: 'none',
        angleInt: 0,
        elapsedSec: 0,
      });
      if (broadcast) {
        onSendPeerMessage({ type: 'FUNAMBULES_START' });
      }
    },
    [funambulesBestM, onSendPeerMessage, onStateForAiChange],
  );

  const togglePause = useCallback(
    (broadcast = true) => {
      const curr = simRef.current;
      if (curr.phase !== 'playing' && curr.phase !== 'paused') return;
      const nextPaused = curr.phase === 'playing';
      const nextPhase: FunambulesState['phase'] = nextPaused ? 'paused' : 'playing';
      simRef.current = { ...curr, phase: nextPhase };
      keysRef.current.clear();
      buttonDirRef.current = 0;
      setHud((prev) => ({ ...prev, phase: nextPhase }));
      if (broadcast) {
        onSendPeerMessage({ type: 'FUNAMBULES_PAUSE', paused: nextPaused });
      }
    },
    [onSendPeerMessage],
  );

  // Register PeerJS handler for synchronized tightrope state
  useEffect(() => {
    registerPeerHandler((msg) => {
      if (msg.type === 'FUNAMBULES_START') {
        startTraversal(false);
      } else if (msg.type === 'FUNAMBULES_PAUSE') {
        const curr = simRef.current;
        if (curr.phase === 'playing' || curr.phase === 'paused') {
          const nextPhase: FunambulesState['phase'] = msg.paused ? 'paused' : 'playing';
          simRef.current = { ...curr, phase: nextPhase };
          setHud((prev) => ({ ...prev, phase: nextPhase }));
        }
      } else if (msg.type === 'FUNAMBULES_SYNC' && isGuestP2P) {
        simRef.current = {
          ...simRef.current,
          angleDeg: msg.angleDeg,
          angularVelDeg: msg.angularVelDeg,
          distanceM: msg.distanceM,
          elapsedSec: msg.elapsedSec,
          harmonyScore: msg.harmonyScore,
          windForce: msg.windForce,
          phase: msg.phase,
          hazard: msg.hazard,
          isSynced: msg.isSynced,
          bestDistanceM: Math.max(simRef.current.bestDistanceM, Math.round(msg.distanceM * 10) / 10),
        };
      }
    });
    return () => registerPeerHandler(null);
  }, [registerPeerHandler, startTraversal, isGuestP2P]);

  // Keyboard controls (ArrowLeft/Right, A/Q/D, P/Escape pause, R restart, Enter/Space start)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (simRef.current.phase === 'playing' || simRef.current.phase === 'paused') {
          e.preventDefault();
          togglePause(true);
        }
        return;
      }
      if (e.code === 'KeyR' && !e.repeat) {
        if (simRef.current.phase !== 'ready') {
          e.preventDefault();
          startTraversal(true);
        }
        return;
      }
      if ((e.code === 'Enter' || e.code === 'Space') && simRef.current.phase === 'ready') {
        e.preventDefault();
        startTraversal(true);
        return;
      }
      if (
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' ||
        e.code === 'KeyA' ||
        e.code === 'KeyQ' ||
        e.code === 'KeyD'
      ) {
        e.preventDefault();
        keysRef.current.add(e.code);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };

    const clearInputs = () => {
      keysRef.current.clear();
      buttonDirRef.current = 0;
      onManualTiltChange(0);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    document.addEventListener('visibilitychange', clearInputs);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      document.removeEventListener('visibilitychange', clearInputs);
      onManualTiltChange(0);
    };
  }, [togglePause, startTraversal, onManualTiltChange]);

  // Decoupled 60fps Canvas & Physics loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ResizeObserver keeps internal canvas crisp without saturating CPU/battery
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = rect.width > 900 ? 1 : Math.min(window.devicePixelRatio || 1, 1.25);
      const w = Math.max(320, Math.round(rect.width * dpr));
      const h = Math.max(260, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let rafId = 0;
    let lastTime = performance.now();
    let lastHudSync = 0;
    let lastKeyDir = 0;
    let prevPhase = simRef.current.phase;

    const frame = (now: number) => {
      rafId = requestAnimationFrame(frame);
      if (now - lastTime < 32) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) * 0.001));
      lastTime = now;

      // Compute keyboard/button steering direction (-1, 0, +1)
      const keys = keysRef.current;
      let keyDir = buttonDirRef.current;
      if (keys.has('ArrowLeft') || keys.has('KeyA') || keys.has('KeyQ')) keyDir = -1;
      else if (keys.has('ArrowRight') || keys.has('KeyD')) keyDir = 1;

      if (keyDir !== lastKeyDir) {
        lastKeyDir = keyDir;
        onManualTiltChange(keyDir * 0.32);
      }

      const localTilt = computeHeadTiltInput(localMetricsRef.current.headTiltRad, keyDir);
      const partnerTilt = computeHeadTiltInput(partnerMetricsRef.current.headTiltRad, 0);

      // Step physics (Authoritative on Host / Solo; Guest follows Host's 30fps sync)
      if (!isGuestP2P) {
        const res = stepFunambulesPhysics(simRef.current, localTilt, partnerTilt, dt);
        simRef.current = res.nextState;
        onStateForAiChange(res.nextState);

        if (res.event === 'hazard_telegraph') {
          soundFx.windTelegraph();
        } else if (res.event === 'hazard_hit') {
          soundFx.hazardHit();
        } else if (res.event === 'sync_milestone') {
          soundFx.syncChime();
        } else if (res.event === 'fall') {
          soundFx.fallSting();
          onUpdateBestDistance(res.nextState.bestDistanceM);
        } else if (res.event === 'victory') {
          soundFx.victoryFanfare();
          onUpdateBestDistance(res.nextState.targetDistanceM);
        }

        if (!isSolo && (res.nextState.phase === 'playing' || res.nextState.phase === 'falling' || res.event !== 'none')) {
          onSendPeerRealtime({
            type: 'FUNAMBULES_SYNC',
            angleDeg: res.nextState.angleDeg,
            angularVelDeg: res.nextState.angularVelDeg,
            distanceM: res.nextState.distanceM,
            elapsedSec: res.nextState.elapsedSec,
            harmonyScore: res.nextState.harmonyScore,
            windForce: res.nextState.windForce,
            phase: res.nextState.phase,
            hazard: res.nextState.hazard,
            isSynced: res.nextState.isSynced,
          });
        }
      }

      const s = simRef.current;

      // Render Twilight Parisian Rooftops & Acrobats on 2D Canvas
      const W = canvas.width;
      const H = canvas.height;
      const dpr = canvas.clientWidth > 0 ? W / canvas.clientWidth : 1;
      ctx.save();

      // Trauma-based camera shake
      if (s.trauma > 0.01) {
        const mag = s.trauma * s.trauma * 10 * dpr;
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
      }

      // 1. Deep twilight sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad.addColorStop(0, '#0B0E1A');
      skyGrad.addColorStop(0.58, '#161C33');
      skyGrad.addColorStop(1, '#26233A');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      // 2. Twinkling stars & crescent moon
      const tSec = now * 0.001;
      for (let i = 0; i < 36; i++) {
        const sx = ((i * 197.3) % 1) * W;
        const sy = ((i * 83.7) % 0.45) * H;
        const alpha = 0.25 + 0.55 * Math.abs(Math.sin(tSec * (0.6 + (i % 4) * 0.25) + i));
        ctx.fillStyle = `rgba(246, 242, 233, ${alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, (1 + (i % 2) * 0.8) * dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Crescent Moon
      const moonX = W * 0.18;
      const moonY = H * 0.2;
      const moonR = 22 * dpr;
      ctx.fillStyle = '#F2CB80';
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111629';
      ctx.beginPath();
      ctx.arc(moonX + 8 * dpr, moonY - 4 * dpr, moonR * 0.9, 0, Math.PI * 2);
      ctx.fill();

      // 3. Distant Parisian Skyline parallax (Eiffel Tower + Haussmann silhouettes)
      const scroll = s.distanceM * 18 * dpr;
      const horizonY = H * 0.72;
      ctx.fillStyle = '#111424';
      ctx.beginPath();
      ctx.moveTo(0, H);
      const buildingW = 54 * dpr;
      const count = Math.ceil(W / buildingW) + 3;
      const offset = scroll % buildingW;
      for (let i = -1; i < count; i++) {
        const idx = Math.floor(scroll / buildingW) + i;
        const bx = i * buildingW - offset;
        const bh = (42 + Math.abs(Math.sin(idx * 1.7)) * 55) * dpr;
        ctx.lineTo(bx, horizonY - bh);
        ctx.lineTo(bx + buildingW * 0.86, horizonY - bh);
        ctx.lineTo(bx + buildingW, horizonY - bh * 0.78);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();

      // Distant Eiffel Tower silhouette on right third
      const eiffelX = W * 0.78 - ((s.distanceM * 0.7) % 90) * dpr;
      ctx.fillStyle = '#14192E';
      ctx.beginPath();
      ctx.moveTo(eiffelX, horizonY - 125 * dpr);
      ctx.lineTo(eiffelX + 5 * dpr, horizonY - 52 * dpr);
      ctx.lineTo(eiffelX + 26 * dpr, horizonY);
      ctx.lineTo(eiffelX + 12 * dpr, horizonY);
      ctx.quadraticCurveTo(eiffelX, horizonY - 26 * dpr, eiffelX - 12 * dpr, horizonY);
      ctx.lineTo(eiffelX - 26 * dpr, horizonY);
      ctx.lineTo(eiffelX - 5 * dpr, horizonY - 52 * dpr);
      ctx.closePath();
      ctx.fill();

      // Warm lit attic windows on skyline
      ctx.fillStyle = 'rgba(232, 184, 97, 0.55)';
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(scroll / buildingW) + i;
        const bx = i * buildingW - offset + 12 * dpr;
        if (idx % 2 === 0) {
          ctx.fillRect(bx, horizonY - 28 * dpr, 6 * dpr, 9 * dpr);
          ctx.fillRect(bx + 14 * dpr, horizonY - 28 * dpr, 6 * dpr, 9 * dpr);
        }
      }

      // 4. Perspective Glowing High Wire stretching forward into the night
      const wireAnchorY = H * 0.68;
      const vanishX = W * 0.5 + Math.sin(s.distanceM * 0.08) * 12 * dpr;
      const vanishY = H * 0.49;

      // Wire glow
      ctx.strokeStyle = 'rgba(232, 184, 97, 0.25)';
      ctx.lineWidth = 8 * dpr;
      ctx.beginPath();
      ctx.moveTo(W * 0.5, H + 10);
      ctx.lineTo(vanishX, vanishY);
      ctx.stroke();

      // Crisp wire core
      ctx.strokeStyle = '#F2CB80';
      ctx.lineWidth = 2.4 * dpr;
      ctx.beginPath();
      ctx.moveTo(W * 0.5, H + 10);
      ctx.lineTo(vanishX, vanishY);
      ctx.stroke();

      // Distance milestone lanterns along the wire
      for (let m = 1; m <= 4; m++) {
        const frac = ((m * 0.25 - (s.distanceM % 10) / 40) + 1) % 1;
        const lx = vanishX + (W * 0.5 - vanishX) * frac;
        const ly = vanishY + (H - vanishY) * frac;
        const r = (2 + frac * 3.5) * dpr;
        ctx.fillStyle = 'rgba(232, 184, 97, 0.6)';
        ctx.beginPath();
        ctx.arc(lx, ly + 8 * frac * dpr, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5. Wind streaks & active hazard telegraph visuals
      if (Math.abs(s.windForce) > 0.14 || s.hazard) {
        const dir = s.hazard ? s.hazard.direction : s.windForce >= 0 ? 1 : -1;
        const intensity = s.hazard
          ? s.hazard.phase === 'telegraph'
            ? 0.45
            : 1
          : Math.abs(s.windForce);

        if (Math.random() < 0.45 * intensity) {
          spawnParticle(
            dir > 0 ? -20 : W + 20,
            H * (0.2 + Math.random() * 0.55),
            dir * (260 + Math.random() * 180) * dpr,
            (Math.random() - 0.5) * 28 * dpr,
            0.9,
            (1.6 + Math.random() * 1.4) * dpr,
            s.hazard?.kind === 'whirlwind' ? '#5CC29F' : '#F2CB80',
          );
        }
      }

      // 6. Tandem Funambules & Balance Pole
      const pivotX = W * 0.5;
      const pivotY = wireAnchorY;
      const angleRad = (s.angleDeg * Math.PI) / 180;
      const walkBob = s.phase === 'playing' ? Math.sin(s.distanceM * 4.5) * 3.5 * dpr : 0;
      const fallDrop = s.phase === 'falling' || s.phase === 'gameover' ? s.fallTimerSec * s.fallTimerSec * 420 * dpr : 0;

      // Danger arc gauge behind acrobats (subtle diegetic horizon arc)
      const arcR = 96 * dpr;
      ctx.save();
      ctx.translate(pivotX, pivotY - 28 * dpr);
      ctx.strokeStyle = 'rgba(246, 242, 233, 0.12)';
      ctx.lineWidth = 4 * dpr;
      ctx.beginPath();
      ctx.arc(0, 0, arcR, -Math.PI * 0.5 - (FALL_ANGLE_DEG * Math.PI) / 180, -Math.PI * 0.5 + (FALL_ANGLE_DEG * Math.PI) / 180);
      ctx.stroke();

      // Safe green center arc
      ctx.strokeStyle = s.isSynced ? 'rgba(92, 194, 159, 0.65)' : 'rgba(92, 194, 159, 0.28)';
      ctx.beginPath();
      ctx.arc(0, 0, arcR, -Math.PI * 0.5 - 0.22, -Math.PI * 0.5 + 0.22);
      ctx.stroke();

      // Tilt needle marker on arc
      const needleAngle = -Math.PI * 0.5 + Math.max(-0.95, Math.min(0.95, angleRad));
      const nx = Math.cos(needleAngle) * arcR;
      const ny = Math.sin(needleAngle) * arcR;
      ctx.fillStyle =
        Math.abs(s.angleDeg) > 36 ? '#E86A58' : s.isSynced ? '#5CC29F' : '#E8B861';
      ctx.beginPath();
      ctx.arc(nx, ny, 5.5 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Acrobats + Pole Transform
      ctx.save();
      ctx.translate(pivotX, pivotY + fallDrop);
      ctx.rotate(angleRad);

      // Feet on wire
      ctx.strokeStyle = '#F6F2E9';
      ctx.lineWidth = 3.2 * dpr;
      ctx.lineCap = 'round';
      // Back partner (Partner / Gold scarf)
      ctx.save();
      ctx.translate(-12 * dpr, -4 * dpr - walkBob * 0.5);
      // Legs
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-4 * dpr, -28 * dpr);
      ctx.moveTo(4 * dpr, -2 * dpr);
      ctx.lineTo(2 * dpr, -28 * dpr);
      ctx.stroke();
      // Torso coat
      ctx.fillStyle = '#C99642';
      ctx.beginPath();
      ctx.roundRect(-11 * dpr, -60 * dpr, 22 * dpr, 34 * dpr, 8 * dpr);
      ctx.fill();
      // Head
      ctx.fillStyle = '#F2CEB0';
      ctx.beginPath();
      ctx.arc(0, -72 * dpr, 11 * dpr, 0, Math.PI * 2);
      ctx.fill();
      // Beret
      ctx.fillStyle = '#7D2E3B';
      ctx.beginPath();
      ctx.ellipse(-2 * dpr, -81 * dpr, 12 * dpr, 4.5 * dpr, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Front partner (Local / Coral sweater)
      ctx.save();
      ctx.translate(12 * dpr, walkBob);
      ctx.strokeStyle = '#F6F2E9';
      ctx.lineWidth = 3.5 * dpr;
      ctx.beginPath();
      ctx.moveTo(-2 * dpr, 0);
      ctx.lineTo(-4 * dpr, -30 * dpr);
      ctx.moveTo(6 * dpr, -3 * dpr);
      ctx.lineTo(4 * dpr, -30 * dpr);
      ctx.stroke();
      // Torso
      ctx.fillStyle = '#E86A58';
      ctx.beginPath();
      ctx.roundRect(-12 * dpr, -64 * dpr, 24 * dpr, 36 * dpr, 9 * dpr);
      ctx.fill();
      // Head
      ctx.fillStyle = '#F2CEB0';
      ctx.beginPath();
      ctx.arc(0, -77 * dpr, 12 * dpr, 0, Math.PI * 2);
      ctx.fill();
      // Hair
      ctx.fillStyle = '#241E2B';
      ctx.beginPath();
      ctx.arc(0, -80 * dpr, 11.5 * dpr, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Shared Wooden Balance Pole (Balancier)
      const poleHalfW = Math.min(W * 0.34, 175 * dpr);
      const poleY = -44 * dpr + walkBob * 0.4;
      const poleGrad = ctx.createLinearGradient(-poleHalfW, poleY, poleHalfW, poleY);
      poleGrad.addColorStop(0, '#E8B861');
      poleGrad.addColorStop(0.5, '#F6F2E9');
      poleGrad.addColorStop(1, '#E86A58');

      ctx.strokeStyle = poleGrad;
      ctx.lineWidth = 5.2 * dpr;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-poleHalfW, poleY + 6 * dpr);
      ctx.quadraticCurveTo(0, poleY - 4 * dpr, poleHalfW, poleY + 6 * dpr);
      ctx.stroke();

      // Glowing tips on pole
      ctx.fillStyle = s.isSynced ? '#5CC29F' : '#F2CB80';
      ctx.beginPath();
      ctx.arc(-poleHalfW, poleY + 6 * dpr, 5 * dpr, 0, Math.PI * 2);
      ctx.arc(poleHalfW, poleY + 6 * dpr, 5 * dpr, 0, Math.PI * 2);
      ctx.fill();

      // Curious Pigeon hazard perched on pole tip!
      if (s.hazard?.kind === 'pigeon') {
        const px = s.hazard.direction * (poleHalfW * 0.82);
        const py =
          s.hazard.phase === 'telegraph'
            ? poleY - (1 - s.hazard.timer / s.hazard.telegraphDuration) * 85 * dpr
            : poleY - 8 * dpr;
        ctx.fillStyle = '#D5DBE8';
        ctx.beginPath();
        ctx.ellipse(px, py, 11 * dpr, 7.5 * dpr, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px - s.hazard.direction * 7 * dpr, py - 8 * dpr, 5 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#E8B861';
        ctx.beginPath();
        ctx.moveTo(px - s.hazard.direction * 11 * dpr, py - 8 * dpr);
        ctx.lineTo(px - s.hazard.direction * 16 * dpr, py - 6 * dpr);
        ctx.lineTo(px - s.hazard.direction * 11 * dpr, py - 4 * dpr);
        ctx.fill();
      }

      // Harmony sparkles when synchronized
      if (s.phase === 'playing' && s.isSynced && Math.random() < 0.25) {
        spawnParticle(
          pivotX + (Math.random() - 0.5) * 90 * dpr,
          pivotY - 50 * dpr,
          (Math.random() - 0.5) * 28 * dpr,
          -(25 + Math.random() * 40) * dpr,
          0.7,
          2.4 * dpr,
          '#5CC29F',
        );
      }

      ctx.restore();

      // 7. Update & draw pooled particles (zero-GC)
      const pool = particlesRef.current;
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = pool[i];
        if (!p.active) continue;
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const alpha = 1 - p.life / p.maxLife;
        ctx.globalAlpha = alpha * 0.85;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // Throttled HUD update (only when phase changes or every 110ms)
      if (s.phase !== prevPhase || now - lastHudSync >= 110) {
        prevPhase = s.phase;
        lastHudSync = now;
        setHud({
          phase: s.phase,
          distanceInt: Math.round(s.distanceM),
          targetDistanceM: s.targetDistanceM,
          harmonyInt: Math.round(s.harmonyScore),
          bestDistanceM: Math.round(s.bestDistanceM),
          syncStreakInt: Math.floor(s.syncStreakSec),
          isSynced: s.isSynced,
          hazardLabel: s.hazard ? s.hazard.label : '',
          hazardPhase: s.hazard ? s.hazard.phase : 'none',
          angleInt: Math.round(s.angleDeg),
          elapsedSec: s.elapsedSec,
        });
      }
    };

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [
    isGuestP2P,
    isSolo,
    localMetricsRef,
    partnerMetricsRef,
    onManualTiltChange,
    onSendPeerRealtime,
    onStateForAiChange,
    onUpdateBestDistance,
    spawnParticle,
  ]);

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-1.5 sm:px-6 py-2 sm:py-5 flex flex-col gap-2.5 sm:gap-4">
      {/* Main Full-Bleed Canvas Stage with World-Matched Perimeter HUD */}
      <div className="relative w-full h-[52dvh] min-h-[360px] max-h-[480px] sm:h-[580px] sm:max-h-none rounded-2xl overflow-hidden border border-white/12 bg-[#0B0E1A]">
        <canvas
          ref={canvasRef}
          data-testid="funambules-canvas"
          className="w-full h-full block"
          aria-label="Scène du jeu Les Funambules au-dessus des toits de Paris"
        />

        {/* Pointer-pass-through HUD Overlay (hidden during ready so mobile title card stays clean) */}
        {hud.phase !== 'ready' && (
          <div className="pointer-events-none absolute inset-0 p-3 sm:p-5 flex flex-col justify-between">
          {/* Top Perimeter Strip */}
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            {/* Distance & Harmony Cluster */}
            <div className="rounded-xl bg-[#0D0F17]/88 border border-white/12 px-4 py-2.5 flex items-center gap-5">
              <div>
                <p className="text-[11px] font-medium text-[#A9A295]">TRAVERSÉE</p>
                <p
                  data-testid="funambules-distance"
                  className="font-mono text-xl sm:text-2xl font-bold text-[#F6F2E9] tabular-nums leading-tight"
                >
                  {hud.distanceInt}
                  <span className="text-sm font-normal text-[#A9A295]"> / {hud.targetDistanceM} m</span>
                </p>
              </div>
              <div className="h-8 w-px bg-white/10" aria-hidden="true" />
              <div>
                <p className="text-[11px] font-medium text-[#A9A295]">HARMONIE</p>
                <p className="font-mono text-xl sm:text-2xl font-bold text-[#E8B861] tabular-nums leading-tight">
                  {hud.harmonyInt}
                </p>
              </div>
            </div>

            {/* Active Hazard Telegraph / Sync Readout */}
            {hud.phase === 'playing' && (hud.hazardLabel || hud.isSynced) && (
              <div
                className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl border text-xs sm:text-sm font-medium ${
                  hud.hazardPhase === 'active'
                    ? 'bg-[#2B171B]/92 border-[#E86A58]/60 text-[#F6F2E9]'
                    : hud.hazardPhase === 'telegraph'
                      ? 'bg-[#261E14]/92 border-[#E8B861]/60 text-[#F2CB80]'
                      : 'bg-[#102420]/90 border-[#5CC29F]/45 text-[#8AE0C0]'
                }`}
              >
                <Wind className="w-4 h-4 shrink-0" />
                <span>
                  {hud.hazardLabel
                    ? hud.hazardPhase === 'telegraph'
                      ? `Attention : ${hud.hazardLabel}`
                      : hud.hazardLabel
                    : `Duo synchronisé · ${hud.syncStreakInt} s`}
                </span>
              </div>
            )}

            {/* Top-Right Compact Utility Controls */}
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  togglePause(true);
                }}
                disabled={hud.phase !== 'playing' && hud.phase !== 'paused'}
                aria-label={hud.phase === 'paused' ? 'Reprendre la partie' : 'Mettre en pause'}
                className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-[#0D0F17]/90 border border-white/15 text-[#F6F2E9] hover:bg-[#1B2034] disabled:opacity-40 transition-colors"
              >
                {hud.phase === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  startTraversal(true);
                }}
                aria-label="Recommencer la traversée"
                className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-[#0D0F17]/90 border border-white/15 text-[#F6F2E9] hover:bg-[#1B2034] transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bottom Controls & Floating Mini Duo Cameras */}
          <div className="flex items-end justify-between gap-3">
            {/* Local Mini Camera */}
            <div className="pointer-events-auto hidden md:block w-48">
              <CameraFeedTile
                name={localName}
                stream={localStream}
                isLocal
                cameraEnabled={cameraEnabled}
                micMuted={micMuted}
                trackerStatus={trackerStatus}
                showTrackingReadout
                metricsRef={localMetricsRef}
                onVideoRef={onVideoRef}
                onRequestCamera={onRequestCamera}
                compact
              />
            </div>

            {/* Tactile Lean Buttons + Hint (overlay on desktop; mobile renders big thumb pad below canvas) */}
            <div className="pointer-events-auto hidden sm:flex mx-auto flex-col items-center gap-2">
              {hud.phase === 'playing' && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={() => (buttonDirRef.current = -1)}
                    onMouseUp={() => (buttonDirRef.current = 0)}
                    onMouseLeave={() => (buttonDirRef.current = 0)}
                    onTouchStart={() => (buttonDirRef.current = -1)}
                    onTouchEnd={() => (buttonDirRef.current = 0)}
                    className="min-h-[48px] inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0D0F17]/90 border border-white/15 text-sm font-medium text-[#F6F2E9] hover:bg-[#1F253B] active:bg-[#E86A58] active:text-[#0D0F17] transition-colors whitespace-nowrap"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Pencher à gauche</span>
                  </button>
                  <span className="font-mono text-xs text-[#CBC4B6] tabular-nums bg-[#0D0F17]/88 px-2.5 py-1.5 rounded-lg border border-white/10">
                    {hud.angleInt > 0 ? `+${hud.angleInt}°` : `${hud.angleInt}°`}
                  </span>
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={() => (buttonDirRef.current = 1)}
                    onMouseUp={() => (buttonDirRef.current = 0)}
                    onMouseLeave={() => (buttonDirRef.current = 0)}
                    onTouchStart={() => (buttonDirRef.current = 1)}
                    onTouchEnd={() => (buttonDirRef.current = 0)}
                    className="min-h-[48px] inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0D0F17]/90 border border-white/15 text-sm font-medium text-[#F6F2E9] hover:bg-[#1F253B] active:bg-[#E8B861] active:text-[#0D0F17] transition-colors whitespace-nowrap"
                  >
                    <span>Pencher à droite</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
              <p className="text-xs text-[#CBC4B6] bg-[#0D0F17]/80 px-3 py-1 rounded-lg">
                {trackerStatus === 'ready'
                  ? 'Incline la tête à gauche / droite (ou ← / →) · P Pause · R Recommencer'
                  : 'Utilise ← / → (ou A / D) ou les boutons · P Pause · R Recommencer'}
              </p>
            </div>

            {/* Partner Mini Camera */}
            <div className="pointer-events-auto hidden md:block w-44">
              <CameraFeedTile
                name={partnerName}
                stream={remoteStream}
                isAi={isSolo}
                metricsRef={partnerMetricsRef}
                compact
              />
            </div>
          </div>
        </div>
        )}

        {/* Ready / Title Overlay */}
        {hud.phase === 'ready' && (
          <div className="absolute inset-0 z-20 flex justify-center bg-[#0B0E1A]/78 p-3.5 sm:p-4 overflow-y-auto">
            <div className="my-auto w-full max-w-md rounded-2xl bg-[#141724] border border-[#E8B861]/35 p-4 sm:p-7 text-center space-y-3 sm:space-y-5 shadow-2xl">
              <div className="space-y-1.5 sm:space-y-2">
                <p className="text-xs font-medium text-[#E8B861]">Coopération sur fil · 100 mètres</p>
                <h1 className="text-2xl sm:text-3xl font-semibold text-[#F6F2E9]">Les Funambules</h1>
                <p className="text-xs sm:text-sm text-[#CBC4B6] leading-relaxed">
                  Penchez la tête ensemble pour garder votre balancier droit face aux rafales, aux
                  pigeons curieux et aux tourbillons au-dessus des toits de Paris.
                </p>
              </div>
              <button
                type="button"
                data-start="true"
                onClick={(e) => {
                  e.currentTarget.blur();
                  startTraversal(true);
                }}
                className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-base font-bold bg-[#E8B861] text-[#0D0F17] hover:bg-[#F2CB80] transition-colors whitespace-nowrap shadow-lg shadow-[#E8B861]/25"
              >
                <Play className="w-4 h-4 shrink-0" />
                <span>Commencer la traversée</span>
              </button>
            </div>
          </div>
        )}

        {/* Pause Modal */}
        {hud.phase === 'paused' && (
          <div
            className="absolute inset-0 z-30 flex justify-center bg-[#0B0E1A]/78 p-3.5 sm:p-4 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="funambules-pause-title"
          >
            <div className="my-auto w-full max-w-sm rounded-2xl bg-[#141724] border border-white/15 p-4 sm:p-6 text-center space-y-4 sm:space-y-5 shadow-2xl">
              <div>
                <h2 id="funambules-pause-title" className="text-2xl font-semibold text-[#F6F2E9]">
                  Partie en pause
                </h2>
                <p className="text-sm text-[#CBC4B6] mt-1 tabular-nums">
                  Distance actuelle : {hud.distanceInt} / {hud.targetDistanceM} m
                </p>
              </div>
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => togglePause(true)}
                  className="w-full min-h-[50px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-[#E8B861] text-[#0D0F17] hover:bg-[#F2CB80] transition-colors"
                >
                  <Play className="w-4 h-4" />
                  <span>Reprendre</span>
                </button>
                <button
                  type="button"
                  onClick={() => startTraversal(true)}
                  className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/10 text-[#F6F2E9] hover:bg-white/16 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Recommencer</span>
                </button>
                <button
                  type="button"
                  onClick={onReturnToHub}
                  className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-white/12 text-[#CBC4B6] hover:text-[#F6F2E9] transition-colors"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>Changer de jeu</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Victory / Game Over Modal */}
        {(hud.phase === 'gameover' || hud.phase === 'victory') && (
          <div
            className="absolute inset-0 z-30 flex justify-center bg-[#0B0E1A]/82 p-3.5 sm:p-4 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="funambules-end-title"
          >
            <div className="my-auto w-full max-w-md rounded-2xl bg-[#141724] border border-white/15 p-4 sm:p-7 space-y-3.5 sm:space-y-5 shadow-2xl text-center">
              <div className="space-y-1.5">
                {hud.phase === 'victory' && (
                  <div className="mx-auto w-12 h-12 rounded-full bg-[#5CC29F]/15 text-[#5CC29F] flex items-center justify-center mb-2">
                    <Trophy className="w-6 h-6" />
                  </div>
                )}
                <p className="text-xs font-medium text-[#E8B861]">
                  {hud.phase === 'victory' ? 'Traversée réussie !' : 'Chute dans le filet !'}
                </p>
                <h2 id="funambules-end-title" className="text-2xl sm:text-3xl font-semibold text-[#F6F2E9]">
                  {hud.phase === 'victory'
                    ? `${localName} & ${partnerName} au sommet !`
                    : 'Le balancier a basculé'}
                </h2>
              </div>

              <div className="grid grid-cols-3 gap-3 rounded-xl bg-[#0D0F17] border border-white/10 p-4">
                <div>
                  <p className="text-[11px] text-[#A9A295]">Distance</p>
                  <p className="font-mono text-lg font-bold text-[#F6F2E9] tabular-nums">
                    {hud.distanceInt} m
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[#A9A295]">Record</p>
                  <p className="font-mono text-lg font-bold text-[#E8B861] tabular-nums">
                    {hud.bestDistanceM} m
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[#A9A295]">Harmonie</p>
                  <p className="font-mono text-lg font-bold text-[#5CC29F] tabular-nums">
                    {hud.harmonyInt}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  data-start="true"
                  onClick={() => startTraversal(true)}
                  className="flex-1 min-h-[52px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-[#E8B861] text-[#0D0F17] hover:bg-[#F2CB80] transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  <span>{hud.phase === 'victory' ? 'Rejouer' : 'Réessayer'}</span>
                </button>
                <button
                  type="button"
                  onClick={onReturnToHub}
                  className="min-h-[50px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-white/10 text-[#F6F2E9] border border-white/12 hover:bg-white/16 transition-colors whitespace-nowrap"
                >
                  <LayoutGrid className="w-4 h-4 shrink-0" />
                  <span>Changer de jeu</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Ergonomic Thumb Pad Below Canvas (keeps tightrope vision 100% unobstructed) */}
      {hud.phase === 'playing' && (
        <div className="sm:hidden grid grid-cols-2 gap-3" data-testid="funambules-mobile-controls">
          <button
            type="button"
            tabIndex={-1}
            onPointerDown={() => (buttonDirRef.current = -1)}
            onPointerUp={() => (buttonDirRef.current = 0)}
            onPointerCancel={() => (buttonDirRef.current = 0)}
            onPointerLeave={() => (buttonDirRef.current = 0)}
            className="min-h-[56px] inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-[#141724] border border-white/18 text-sm font-bold text-[#F6F2E9] active:bg-[#E86A58] active:text-[#0D0F17] shadow-lg transition-colors select-none touch-none"
          >
            <ChevronLeft className="w-5 h-5 shrink-0" />
            <span>Gauche</span>
          </button>
          <button
            type="button"
            tabIndex={-1}
            onPointerDown={() => (buttonDirRef.current = 1)}
            onPointerUp={() => (buttonDirRef.current = 0)}
            onPointerCancel={() => (buttonDirRef.current = 0)}
            onPointerLeave={() => (buttonDirRef.current = 0)}
            className="min-h-[56px] inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-[#141724] border border-white/18 text-sm font-bold text-[#F6F2E9] active:bg-[#E8B861] active:text-[#0D0F17] shadow-lg transition-colors select-none touch-none"
          >
            <span>Droite</span>
            <ChevronRight className="w-5 h-5 shrink-0" />
          </button>
        </div>
      )}

      {/* Mobile Compact Duo Cameras Below Canvas */}
      <section className="grid grid-cols-2 gap-3 md:hidden" aria-label="Aperçu des caméras">
        <CameraFeedTile
          name={localName}
          stream={localStream}
          isLocal
          cameraEnabled={cameraEnabled}
          micMuted={micMuted}
          trackerStatus={trackerStatus}
          showTrackingReadout
          metricsRef={localMetricsRef}
          onRequestCamera={onRequestCamera}
          compact
        />
        <CameraFeedTile
          name={partnerName}
          stream={remoteStream}
          isAi={isSolo}
          metricsRef={partnerMetricsRef}
          compact
        />
      </section>
    </main>
  );
}
