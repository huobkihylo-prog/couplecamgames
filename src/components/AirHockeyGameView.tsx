import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { LayoutGrid, Pause, Play, RotateCcw, Trophy, Zap } from 'lucide-react';
import type {
  AirHockeyState,
  ConnectionMode,
  FaceMetrics,
  HandMetrics,
  PeerMessage,
  TrackerStatus,
} from '../types/duoplay';
import {
  createAirHockeyAiMemory,
  createInitialAirHockeyState,
  GOAL_HALF_H,
  HOCKEY_H,
  HOCKEY_W,
  MALLET_R,
  mapHandToHalfCoords,
  PUCK_R,
  startAirHockeyMatch,
  stepAiAirHockeyPartner,
  stepAirHockeyPhysics,
  TARGET_GOALS,
} from '../game/airHockeyPhysics';
import { soundFx } from '../utils/soundFx';
import { CameraFeedTile } from './CameraFeedTile';

interface AirHockeyGameViewProps {
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
  onRecordVictory: () => void;
  onVideoRef: (el: HTMLVideoElement | null) => void;
  onRequestCamera: () => void;
  onSendPeerMessage: (msg: PeerMessage) => void;
  onSendPeerRealtime: (msg: PeerMessage) => void;
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

interface ShockwaveRing {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
}

const MAX_SPARKS = 96;
const MAX_RINGS = 10;
const PUCK_TRAIL_LEN = 12;

function createSparkPool(): PooledSpark[] {
  return Array.from({ length: MAX_SPARKS }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 0.45,
    size: 3,
    color: '#F6F2E9',
  }));
}

function createRingPool(): ShockwaveRing[] {
  return Array.from({ length: MAX_RINGS }, () => ({
    active: false,
    x: 0,
    y: 0,
    radius: 16,
    maxRadius: 95,
    life: 0,
    maxLife: 0.35,
    color: '#E8B861',
  }));
}

export function AirHockeyGameView({
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
  onRecordVictory,
  onVideoRef,
  onRequestCamera,
  onSendPeerMessage,
  onSendPeerRealtime,
  registerPeerHandler,
  onLocalPointerHandChange,
  onReturnToHub,
}: AirHockeyGameViewProps) {
  const isGuestP2P = connectionMode === 'p2p-guest';
  const isSolo = connectionMode === 'solo';

  const leftPlayerName = isGuestP2P ? partnerName : localName;
  const rightPlayerName = isGuestP2P ? localName : partnerName;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<AirHockeyState>(createInitialAirHockeyState());
  const aiMemRef = useRef(createAirHockeyAiMemory());
  const sparksRef = useRef<PooledSpark[]>(createSparkPool());
  const sparkCursorRef = useRef(0);
  const ringsRef = useRef<ShockwaveRing[]>(createRingPool());
  const ringCursorRef = useRef(0);
  const puckTrailRef = useRef<{ x: number; y: number }[]>([]);
  const pointerStateRef = useRef<{ normX: number; normY: number; active: boolean }>({
    normX: 0.35,
    normY: 0.5,
    active: false,
  });

  const [hud, setHud] = useState(() => ({
    phase: simRef.current.phase,
    p1Score: 0,
    p2Score: 0,
    targetGoals: TARGET_GOALS,
    lastScorer: null as AirHockeyState['lastScorer'],
    winner: null as AirHockeyState['winner'],
    rallyHits: 0,
    maxPuckSpeed: 0,
  }));

  const spawnSparks = useCallback((x: number, y: number, color: string, count: number, boost = 1) => {
    const pool = sparksRef.current;
    for (let i = 0; i < count; i++) {
      const idx = sparkCursorRef.current;
      sparkCursorRef.current = (idx + 1) % MAX_SPARKS;
      const p = pool[idx];
      const angle = Math.random() * Math.PI * 2;
      const speed = (120 + Math.random() * 340) * boost;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0;
      p.maxLife = 0.25 + Math.random() * 0.25;
      p.size = 2.5 + Math.random() * 3.5;
      p.color = color;
    }
  }, []);

  const spawnRing = useCallback((x: number, y: number, color: string, maxRadius = 92) => {
    const pool = ringsRef.current;
    const idx = ringCursorRef.current;
    ringCursorRef.current = (idx + 1) % MAX_RINGS;
    const r = pool[idx];
    r.active = true;
    r.x = x;
    r.y = y;
    r.radius = 20;
    r.maxRadius = maxRadius;
    r.life = 0;
    r.maxLife = 0.34;
    r.color = color;
  }, []);

  const syncHudFromState = useCallback((st: AirHockeyState) => {
    setHud((prev) => {
      if (
        prev.phase === st.phase &&
        prev.p1Score === st.p1Score &&
        prev.p2Score === st.p2Score &&
        prev.lastScorer === st.lastScorer &&
        prev.winner === st.winner &&
        prev.rallyHits === st.rallyHits &&
        prev.maxPuckSpeed === st.maxPuckSpeed
      ) {
        return prev;
      }
      return {
        phase: st.phase,
        p1Score: st.p1Score,
        p2Score: st.p2Score,
        targetGoals: st.targetGoals,
        lastScorer: st.lastScorer,
        winner: st.winner,
        rallyHits: st.rallyHits,
        maxPuckSpeed: st.maxPuckSpeed,
      };
    });
  }, []);

  const startOrRestart = useCallback(
    (fromRemote = false) => {
      if (isGuestP2P && !fromRemote) {
        onSendPeerMessage({ type: 'HOCKEY_START' });
        return;
      }
      soundFx.click();
      const serveDir: -1 | 1 = Math.random() < 0.5 ? -1 : 1;
      const fresh = startAirHockeyMatch(serveDir);
      simRef.current = fresh;
      aiMemRef.current = createAirHockeyAiMemory();
      puckTrailRef.current = [];
      syncHudFromState(fresh);
      if (connectionMode === 'p2p-host') {
        onSendPeerMessage({ type: 'HOCKEY_START' });
      }
    },
    [connectionMode, isGuestP2P, onSendPeerMessage, syncHudFromState],
  );

  const togglePause = useCallback(
    (fromRemote = false, forcePaused?: boolean) => {
      const cur = simRef.current;
      if (cur.phase !== 'playing' && cur.phase !== 'paused') return;
      const nextPaused = forcePaused !== undefined ? forcePaused : cur.phase === 'playing';
      if (isGuestP2P && !fromRemote) {
        onSendPeerMessage({ type: 'HOCKEY_PAUSE', paused: nextPaused });
        return;
      }
      soundFx.click();
      simRef.current = { ...cur, phase: nextPaused ? 'paused' : 'playing' };
      syncHudFromState(simRef.current);
      if (connectionMode === 'p2p-host') {
        onSendPeerMessage({ type: 'HOCKEY_PAUSE', paused: nextPaused });
      }
    },
    [connectionMode, isGuestP2P, onSendPeerMessage, syncHudFromState],
  );

  // Register PeerJS handler for Air Hockey sync
  useEffect(() => {
    registerPeerHandler((msg) => {
      if (msg.type === 'HOCKEY_START') {
        if (!isGuestP2P) {
          startOrRestart(true);
        } else {
          const fresh = startAirHockeyMatch(-1);
          simRef.current = fresh;
          puckTrailRef.current = [];
          syncHudFromState(fresh);
        }
      } else if (msg.type === 'HOCKEY_PAUSE') {
        if (!isGuestP2P) {
          togglePause(true, msg.paused);
        } else {
          simRef.current = { ...simRef.current, phase: msg.paused ? 'paused' : 'playing' };
          syncHudFromState(simRef.current);
        }
      } else if (msg.type === 'HOCKEY_SYNC' && isGuestP2P) {
        const prev = simRef.current;
        if (msg.p2Score > prev.p2Score) {
          soundFx.goalHorn(true);
          spawnRing(16, HOCKEY_H * 0.5, '#E8B861', 150);
          spawnSparks(32, HOCKEY_H * 0.5, '#E8B861', 26, 1.3);
        } else if (msg.p1Score > prev.p1Score) {
          soundFx.goalHorn(false);
          spawnRing(HOCKEY_W - 16, HOCKEY_H * 0.5, '#E86A58', 150);
          spawnSparks(HOCKEY_W - 32, HOCKEY_H * 0.5, '#E86A58', 26, 1.3);
        } else if (msg.rallyHits > prev.rallyHits) {
          soundFx.puckHit(0.65);
          spawnSparks(msg.puckX, msg.puckY, '#F6F2E9', 12, 0.9);
        }

        if (msg.phase === 'gameover' && prev.phase !== 'gameover' && msg.winner === 'p2') {
          onRecordVictory();
        }

        const synced: AirHockeyState = {
          ...prev,
          phase: msg.phase,
          puckX: msg.puckX,
          puckY: msg.puckY,
          puckVx: msg.puckVx,
          puckVy: msg.puckVy,
          p1X: msg.p1X,
          p1Y: msg.p1Y,
          p2X: msg.p2X,
          p2Y: msg.p2Y,
          p1Score: msg.p1Score,
          p2Score: msg.p2Score,
          lastScorer: msg.lastScorer,
          winner: msg.winner,
          goalPauseSec: msg.goalPauseSec,
          elapsedSec: msg.elapsedSec,
          rallyHits: msg.rallyHits,
          maxPuckSpeed: msg.maxPuckSpeed,
        };
        simRef.current = synced;
        syncHudFromState(synced);
      }
    });
    return () => registerPeerHandler(null);
  }, [
    isGuestP2P,
    onRecordVictory,
    registerPeerHandler,
    spawnRing,
    spawnSparks,
    startOrRestart,
    syncHudFromState,
    togglePause,
  ]);

  // Sync document.body.dataset.state
  useEffect(() => {
    const map: Record<AirHockeyState['phase'], string> = {
      ready: 'title',
      playing: 'playing',
      goal_pause: 'playing',
      paused: 'paused',
      gameover: 'gameover',
    };
    document.body.dataset.state = map[hud.phase];
  }, [hud.phase]);

  // Keyboard shortcuts
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

  // Pointer fallback mapped cleanly into the local player's half (0..1, 0..1)
  const updatePointerFromEvent = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const fullX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const fullY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      // Map local half to 0..1 cleanly so pointer feels direct inside the player's half
      const halfNormX = isGuestP2P
        ? Math.max(0, Math.min(1, (fullX - 0.5) * 2))
        : Math.max(0, Math.min(1, fullX * 2));
      pointerStateRef.current = { normX: halfNormX, normY: fullY, active: true };
      onLocalPointerHandChange(halfNormX, fullY, true);
    },
    [isGuestP2P, onLocalPointerHandChange],
  );

  // Main requestAnimationFrame loop & Neon Air Hockey Rink renderer
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

    const drawMallet = (x: number, y: number, primary: string, glow: string) => {
      ctx.save();
      // Soft ambient neon halo
      const halo = ctx.createRadialGradient(x, y, MALLET_R * 0.4, x, y, MALLET_R * 1.65);
      halo.addColorStop(0, glow);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, MALLET_R * 1.65, 0, Math.PI * 2);
      ctx.fill();

      // Main mallet base
      ctx.beginPath();
      ctx.arc(x, y, MALLET_R, 0, Math.PI * 2);
      ctx.fillStyle = '#141828';
      ctx.fill();
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = primary;
      ctx.stroke();

      // Inner luminous ring
      ctx.beginPath();
      ctx.arc(x, y, MALLET_R * 0.62, 0, Math.PI * 2);
      ctx.strokeStyle = '#FFF7ED';
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Center grip knob
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(x, y, MALLET_R * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = primary;
      ctx.fill();
      ctx.restore();
    };

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      if (now - lastTime < 28) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) * 0.001));
      lastTime = now;

      // 1. Authoritative Physics on Host / Solo
      if (!isGuestP2P) {
        const localHand = localHandMetricsRef.current;
        const p1NormX = localHand.handDetected ? localHand.palmX : pointerStateRef.current.normX;
        const p1NormY = localHand.handDetected ? localHand.palmY : pointerStateRef.current.normY;
        const p1Target = mapHandToHalfCoords('left', p1NormX, p1NormY);

        let p2Target: { x: number; y: number };
        if (isSolo) {
          const aiRes = stepAiAirHockeyPartner(aiMemRef.current, simRef.current, dt);
          aiMemRef.current = aiRes.nextMemory;
          p2Target = aiRes.target;
        } else {
          const remote = partnerHandMetricsRef.current;
          p2Target = remote.handDetected
            ? mapHandToHalfCoords('right', remote.palmX, remote.palmY)
            : { x: simRef.current.p2X, y: simRef.current.p2Y };
        }

        const step = stepAirHockeyPhysics(simRef.current, p1Target, p2Target, dt);
        simRef.current = step.nextState;

        if (step.event === 'puck_hit') {
          soundFx.puckHit(step.impactStrength);
          const color = step.nextState.lastImpactX < HOCKEY_W * 0.5 ? '#E86A58' : '#E8B861';
          spawnSparks(step.nextState.lastImpactX, step.nextState.lastImpactY, color, 10 + Math.round(step.impactStrength * 10), 0.7 + step.impactStrength * 0.7);
          if (step.impactStrength > 0.55) {
            spawnRing(step.nextState.lastImpactX, step.nextState.lastImpactY, color, 65 + step.impactStrength * 45);
          }
        } else if (step.event === 'wall_bounce') {
          soundFx.wallBounce();
          spawnSparks(step.nextState.puckX, step.nextState.puckY, '#94A3B8', 7, 0.55);
        } else if (step.event === 'goal_p1') {
          soundFx.goalHorn(true);
          spawnRing(HOCKEY_W - 14, step.nextState.puckY, '#E86A58', 155);
          spawnSparks(HOCKEY_W - 24, step.nextState.puckY, '#E86A58', 28, 1.35);
          puckTrailRef.current = [];
        } else if (step.event === 'goal_p2') {
          soundFx.goalHorn(false);
          spawnRing(14, step.nextState.puckY, '#E8B861', 155);
          spawnSparks(24, step.nextState.puckY, '#E8B861', 28, 1.35);
          puckTrailRef.current = [];
        } else if (step.event === 'gameover') {
          const localWon = step.nextState.winner === 'p1';
          soundFx.goalHorn(localWon);
          if (localWon) onRecordVictory();
        }

        // Broadcast authoritative state to Guest at ~30fps
        if (connectionMode === 'p2p-host' && now - lastSyncSent > 32) {
          lastSyncSent = now;
          const st = simRef.current;
          onSendPeerRealtime({
            type: 'HOCKEY_SYNC',
            phase: st.phase,
            puckX: st.puckX,
            puckY: st.puckY,
            puckVx: st.puckVx,
            puckVy: st.puckVy,
            p1X: st.p1X,
            p1Y: st.p1Y,
            p2X: st.p2X,
            p2Y: st.p2Y,
            p1Score: st.p1Score,
            p2Score: st.p2Score,
            lastScorer: st.lastScorer,
            winner: st.winner,
            goalPauseSec: st.goalPauseSec,
            elapsedSec: st.elapsedSec,
            rallyHits: st.rallyHits,
            maxPuckSpeed: st.maxPuckSpeed,
          });
        }
      } else {
        // Guest P2P: responsive local right-paddle prediction while waiting for Host sync
        const localHand = localHandMetricsRef.current;
        const p2NormX = localHand.handDetected ? localHand.palmX : pointerStateRef.current.normX;
        const p2NormY = localHand.handDetected ? localHand.palmY : pointerStateRef.current.normY;
        const localRight = mapHandToHalfCoords('right', p2NormX, p2NormY);
        simRef.current.p2X += (localRight.x - simRef.current.p2X) * 0.55;
        simRef.current.p2Y += (localRight.y - simRef.current.p2Y) * 0.55;
      }

      // Update puck light trail
      const st = simRef.current;
      if (st.phase === 'playing') {
        puckTrailRef.current.push({ x: st.puckX, y: st.puckY });
        if (puckTrailRef.current.length > PUCK_TRAIL_LEN) {
          puckTrailRef.current.shift();
        }
      }

      // Step pooled sparks & shockwaves
      const sparks = sparksRef.current;
      for (let i = 0; i < MAX_SPARKS; i++) {
        const p = sparks[i];
        if (!p.active) continue;
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.94;
        p.vy *= 0.94;
      }

      const rings = ringsRef.current;
      for (let i = 0; i < MAX_RINGS; i++) {
        const r = rings[i];
        if (!r.active) continue;
        r.life += dt;
        if (r.life >= r.maxLife) {
          r.active = false;
          continue;
        }
        const t = r.life / r.maxLife;
        r.radius = 20 + (r.maxRadius - 20) * (1 - Math.pow(1 - t, 3));
      }

      if (now - lastHudUpdate > 90) {
        lastHudUpdate = now;
        syncHudFromState(st);
      }

      // 2. Render Neon Air Hockey Table
      ctx.save();
      ctx.scale(dpr, dpr);

      // Brushed dark ice-slate rink backdrop
      const bgGrad = ctx.createLinearGradient(0, 0, width, 0);
      bgGrad.addColorStop(0, '#141222');
      bgGrad.addColorStop(0.5, '#0C1120');
      bgGrad.addColorStop(1, '#161622');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const sx = width / HOCKEY_W;
      const sy = height / HOCKEY_H;
      const shakeAmp = st.trauma * st.trauma * 12;
      const shakeX = shakeAmp > 0.2 ? (Math.random() - 0.5) * 2 * shakeAmp : 0;
      const shakeY = shakeAmp > 0.2 ? (Math.random() - 0.5) * 2 * shakeAmp : 0;

      ctx.save();
      ctx.translate(shakeX, shakeY);
      ctx.scale(sx, sy);

      // Subtle ice surface grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1;
      for (let gx = 100; gx < HOCKEY_W; gx += 100) {
        ctx.beginPath();
        ctx.moveTo(gx, 8);
        ctx.lineTo(gx, HOCKEY_H - 8);
        ctx.stroke();
      }
      for (let gy = 100; gy < HOCKEY_H; gy += 100) {
        ctx.beginPath();
        ctx.moveTo(8, gy);
        ctx.lineTo(HOCKEY_W - 8, gy);
        ctx.stroke();
      }

      // Center line & face-off circle
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(HOCKEY_W * 0.5, 8);
      ctx.lineTo(HOCKEY_W * 0.5, HOCKEY_H - 8);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(HOCKEY_W * 0.5, HOCKEY_H * 0.5, 82, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(232, 184, 97, 0.28)';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(HOCKEY_W * 0.5, HOCKEY_H * 0.5, 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(246, 242, 233, 0.35)';
      ctx.fill();

      // Left Goal Crease (Coral)
      const goalTop = HOCKEY_H * 0.5 - GOAL_HALF_H;
      const goalBottom = HOCKEY_H * 0.5 + GOAL_HALF_H;
      ctx.beginPath();
      ctx.arc(6, HOCKEY_H * 0.5, GOAL_HALF_H, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.strokeStyle = 'rgba(232, 106, 88, 0.45)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Right Goal Crease (Gold)
      ctx.beginPath();
      ctx.arc(HOCKEY_W - 6, HOCKEY_H * 0.5, GOAL_HALF_H, Math.PI * 0.5, Math.PI * 1.5);
      ctx.strokeStyle = 'rgba(232, 184, 97, 0.45)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Glowing outer rails (with open goal mouths on left & right)
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      // Top & bottom rails
      ctx.strokeStyle = 'rgba(246, 242, 233, 0.32)';
      ctx.beginPath();
      ctx.moveTo(6, 6);
      ctx.lineTo(HOCKEY_W - 6, 6);
      ctx.moveTo(6, HOCKEY_H - 6);
      ctx.lineTo(HOCKEY_W - 6, HOCKEY_H - 6);
      ctx.stroke();

      // Left rail posts (Coral)
      ctx.strokeStyle = '#E86A58';
      ctx.beginPath();
      ctx.moveTo(6, 6);
      ctx.lineTo(6, goalTop);
      ctx.moveTo(6, goalBottom);
      ctx.lineTo(6, HOCKEY_H - 6);
      ctx.stroke();

      // Right rail posts (Gold)
      ctx.strokeStyle = '#E8B861';
      ctx.beginPath();
      ctx.moveTo(HOCKEY_W - 6, 6);
      ctx.lineTo(HOCKEY_W - 6, goalTop);
      ctx.moveTo(HOCKEY_W - 6, goalBottom);
      ctx.lineTo(HOCKEY_W - 6, HOCKEY_H - 6);
      ctx.stroke();

      // Goal mouth neon laser slots
      ctx.fillStyle = 'rgba(232, 106, 88, 0.16)';
      ctx.fillRect(0, goalTop, 10, GOAL_HALF_H * 2);
      ctx.fillStyle = 'rgba(232, 184, 97, 0.16)';
      ctx.fillRect(HOCKEY_W - 10, goalTop, 10, GOAL_HALF_H * 2);

      // Subtle side owner captions on the ice
      ctx.font = '600 12px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(232, 106, 88, 0.5)';
      ctx.textAlign = 'left';
      ctx.fillText(leftPlayerName.toUpperCase(), 26, HOCKEY_H - 18);
      ctx.fillStyle = 'rgba(232, 184, 97, 0.5)';
      ctx.textAlign = 'right';
      ctx.fillText(rightPlayerName.toUpperCase(), HOCKEY_W - 26, HOCKEY_H - 18);

      // Shockwave rings
      for (let i = 0; i < MAX_RINGS; i++) {
        const r = rings[i];
        if (!r.active) continue;
        const alpha = 1 - r.life / r.maxLife;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = r.color;
        ctx.globalAlpha = alpha * 0.7;
        ctx.lineWidth = 3 * alpha + 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Velocity-scaled puck trail
      const puckSpeed = Math.hypot(st.puckVx, st.puckVy);
      const hotRatio = Math.min(1, puckSpeed / 1050);
      const puckTrailColor = hotRatio > 0.65 ? '#E86A58' : hotRatio > 0.35 ? '#E8B861' : '#7DD3FC';

      const trail = puckTrailRef.current;
      for (let i = 0; i < trail.length; i++) {
        const pt = trail[i];
        const frac = (i + 1) / trail.length;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, PUCK_R * (0.35 + frac * 0.55), 0, Math.PI * 2);
        ctx.fillStyle = puckTrailColor;
        ctx.globalAlpha = frac * 0.24;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Render both luminous mallets
      drawMallet(st.p1X, st.p1Y, '#E86A58', 'rgba(232, 106, 88, 0.34)');
      drawMallet(st.p2X, st.p2Y, '#E8B861', 'rgba(232, 184, 97, 0.34)');

      // Render Puck (when inside rink)
      if (st.puckX > -20 && st.puckX < HOCKEY_W + 20) {
        const pGlow = ctx.createRadialGradient(st.puckX, st.puckY, 4, st.puckX, st.puckY, PUCK_R * 2.1);
        pGlow.addColorStop(0, puckTrailColor);
        pGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = pGlow;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.arc(st.puckX, st.puckY, PUCK_R * 2.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.arc(st.puckX, st.puckY, PUCK_R, 0, Math.PI * 2);
        ctx.fillStyle = '#F6F2E9';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = puckTrailColor;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(st.puckX, st.puckY, PUCK_R * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = '#141828';
        ctx.fill();
      }

      // Render sparks
      for (let i = 0; i < MAX_SPARKS; i++) {
        const p = sparks[i];
        if (!p.active) continue;
        const alpha = 1 - p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.restore();
      ctx.restore();
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [
    connectionMode,
    isGuestP2P,
    isSolo,
    leftPlayerName,
    localHandMetricsRef,
    onRecordVictory,
    onSendPeerRealtime,
    partnerHandMetricsRef,
    rightPlayerName,
    spawnRing,
    spawnSparks,
    syncHudFromState,
  ]);

  const sensorLabel =
    localStream && handTrackerStatus === 'ready'
      ? 'Paume (Landmark 9) active'
      : handTrackerStatus === 'loading'
        ? 'Chargement HandLandmarker...'
        : 'Déplace la souris ou le doigt dans ton camp';

  const localIsWinner =
    hud.winner !== null && ((hud.winner === 'p1' && !isGuestP2P) || (hud.winner === 'p2' && isGuestP2P));

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-1.5 sm:px-6 py-2 sm:py-4 space-y-2.5 sm:space-y-4">
      {/* Main Full-Bleed Rink Stage framed in Crème & Pastel Doux */}
      <div className="relative rounded-3xl overflow-hidden border border-[#EAE4DC] bg-[#0C1120] shadow-[0_12px_36px_rgba(31,36,45,0.10)] h-[58dvh] min-h-[390px] max-h-[530px] sm:h-[580px] sm:max-h-none select-none touch-none">
        <canvas
          ref={canvasRef}
          data-testid="hockey-canvas"
          onPointerMove={updatePointerFromEvent}
          onPointerDown={updatePointerFromEvent}
          className="w-full h-full block cursor-none"
        />

        {/* Perimeter Top HUD — hidden during ready so mobile start card has full room */}
        {hud.phase !== 'ready' && (
          <div className="pointer-events-none absolute top-3 left-3 right-3 z-10 flex items-start justify-between gap-2 sm:gap-3">
            {/* Left: Goal target / Rally */}
            <div className="hidden sm:block rounded-2xl bg-white/94 backdrop-blur-md border border-[#EAE4DC] px-3.5 py-2 shadow-[0_6px_20px_rgba(31,36,45,0.10)]">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-[#6B7280]">Objectif</p>
              <p className="text-sm font-bold text-[#1F242D] tabular-nums">
                Premier à {hud.targetGoals} buts
              </p>
            </div>

            {/* Center Scoreboard */}
            <div
              data-testid="hockey-score"
              className="flex items-center gap-3 sm:gap-4 rounded-2xl bg-white/95 backdrop-blur-md border border-[#EAE4DC] px-3.5 sm:px-5 py-1.5 sm:py-2 shadow-[0_6px_20px_rgba(31,36,45,0.10)]"
            >
              <div className="text-right">
                <p className="text-[11px] text-[#FF6B57] font-bold truncate max-w-[76px] sm:max-w-[96px]">
                  {leftPlayerName}
                </p>
                <p className="text-xl sm:text-2xl font-extrabold text-[#1F242D] tabular-nums leading-none">
                  {hud.p1Score}
                </p>
              </div>
              <span className="text-sm font-bold text-[#C9C1B6]">—</span>
              <div className="text-left">
                <p className="text-[11px] text-[#7C5CFC] font-bold truncate max-w-[76px] sm:max-w-[96px]">
                  {rightPlayerName}
                </p>
                <p className="text-xl sm:text-2xl font-extrabold text-[#1F242D] tabular-nums leading-none">
                  {hud.p2Score}
                </p>
              </div>
            </div>

            {/* Right: Pause & Restart */}
            <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
              {(hud.phase === 'playing' || hud.phase === 'paused' || hud.phase === 'goal_pause') && (
                <>
                  <button
                    type="button"
                    onClick={() => togglePause()}
                    aria-label={hud.phase === 'paused' ? 'Reprendre' : 'Mettre en pause'}
                    className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-white/94 backdrop-blur-md border border-[#EAE4DC] text-[#1F242D] hover:bg-[#FAF7F2] shadow-sm transition-colors cursor-pointer"
                  >
                    {hud.phase === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => startOrRestart()}
                    aria-label="Recommencer le match"
                    className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-white/94 backdrop-blur-md border border-[#EAE4DC] text-[#1F242D] hover:bg-[#FAF7F2] shadow-sm transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Crisp Goal Flash Banner during goal_pause */}
        {hud.phase === 'goal_pause' && hud.lastScorer && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
            <div
              className={`rounded-2xl px-6 py-3.5 border-2 shadow-[0_14px_36px_rgba(31,36,45,0.18)] bg-white/96 backdrop-blur-md ${
                hud.lastScorer === 'p1'
                  ? 'border-[#FF6B57] text-[#FF6B57]'
                  : 'border-[#7C5CFC] text-[#7C5CFC]'
              }`}
            >
              <p className="text-xl sm:text-3xl font-extrabold tracking-tight text-center">
                BUT POUR {hud.lastScorer === 'p1' ? leftPlayerName.toUpperCase() : rightPlayerName.toUpperCase()} !
              </p>
            </div>
          </div>
        )}

        {/* Title Overlay */}
        {hud.phase === 'ready' && (
          <div className="absolute inset-0 z-20 flex justify-center bg-[#FAF7F2]/85 backdrop-blur-sm p-3.5 sm:p-4 overflow-y-auto">
            <div className="my-auto w-full max-w-md rounded-3xl bg-white border border-[#EAE4DC] p-5 sm:p-6 text-center space-y-3.5 sm:space-y-5 shadow-[0_18px_48px_rgba(31,36,45,0.12)]">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#FFE8E2] border border-[#F5C5B8] text-[#FF6B57] mx-auto">
                <Zap className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1F242D] tracking-tight">
                  Air Hockey des Mains
                </h1>
                <p className="text-sm text-[#6B7280] leading-relaxed">
                  Un terrain partagé entre vos deux écrans. Plus ta paume frappe vite à
                  l’impact, plus le palet file vers le camp adverse. Premier à{' '}
                  <span className="text-[#FF6B57] font-bold">7 buts</span> gagne !
                </p>
              </div>
              <p className="hidden sm:block text-xs text-[#6B7280] bg-[#FAF7F2] border border-[#EAE4DC] rounded-xl px-3 py-2">
                {sensorLabel}
              </p>
              <button
                type="button"
                data-start="true"
                onClick={() => startOrRestart()}
                className="w-full min-h-[54px] inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-bold text-base bg-[#FF6B57] hover:bg-[#F25743] text-white transition-colors shadow-md shadow-[#FF6B57]/25 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Engager le palet</span>
              </button>
            </div>
          </div>
        )}

        {/* Pause Overlay */}
        {hud.phase === 'paused' && (
          <div className="absolute inset-0 z-20 flex justify-center bg-[#FAF7F2]/82 backdrop-blur-sm p-3.5 sm:p-4 overflow-y-auto">
            <div className="my-auto w-full max-w-sm rounded-3xl bg-white border border-[#EAE4DC] p-5 sm:p-6 text-center space-y-4 shadow-[0_18px_48px_rgba(31,36,45,0.12)]">
              <h2 className="text-2xl font-extrabold text-[#1F242D]">Match en pause</h2>
              <p className="text-sm font-semibold text-[#6B7280] tabular-nums">
                {leftPlayerName} {hud.p1Score} — {hud.p2Score} {rightPlayerName}
              </p>
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => togglePause()}
                  className="w-full min-h-[50px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm bg-[#FF6B57] hover:bg-[#F25743] text-white transition-colors shadow-md shadow-[#FF6B57]/20 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Reprendre</span>
                </button>
                <button
                  type="button"
                  onClick={() => startOrRestart()}
                  className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-sm bg-[#FAF7F2] hover:bg-[#F1ECE3] border border-[#EAE4DC] text-[#1F242D] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Recommencer</span>
                </button>
                <button
                  type="button"
                  onClick={onReturnToHub}
                  className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl font-medium text-sm bg-white border border-[#EAE4DC] hover:bg-[#FAF7F2] text-[#6B7280] transition-colors cursor-pointer"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>Changer de jeu</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Match Over Overlay */}
        {hud.phase === 'gameover' && (
          <div className="absolute inset-0 z-20 flex justify-center bg-[#FAF7F2]/86 backdrop-blur-sm p-3.5 sm:p-4 overflow-y-auto">
            <div className="my-auto w-full max-w-md rounded-3xl bg-white border border-[#EAE4DC] p-5 sm:p-6 text-center space-y-4 sm:space-y-5 shadow-[0_18px_48px_rgba(31,36,45,0.12)]">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#FEF6DC] border border-[#F5D782] text-[#D97706] mx-auto">
                <Trophy className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#1F242D]">
                  {localIsWinner ? 'Victoire !' : `${hud.winner === 'p1' ? leftPlayerName : rightPlayerName} remporte le match`}
                </h2>
                <p className="text-sm font-medium text-[#6B7280] tabular-nums">
                  Score final : {leftPlayerName} {hud.p1Score} — {hud.p2Score} {rightPlayerName}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[#FAF7F2] border border-[#EAE4DC] p-3">
                  <p className="text-[11px] font-semibold text-[#6B7280]">Frappes échangées</p>
                  <p className="text-xl font-extrabold text-[#1F242D] tabular-nums">{hud.rallyHits}</p>
                </div>
                <div className="rounded-2xl bg-[#FEF6DC] border border-[#F5D782] p-3">
                  <p className="text-[11px] font-semibold text-[#92400E]">Vitesse max palet</p>
                  <p className="text-xl font-extrabold text-[#D97706] tabular-nums">
                    {Math.round(hud.maxPuckSpeed * 0.12)} km/h
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  data-start="true"
                  onClick={() => startOrRestart()}
                  className="flex-1 min-h-[52px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm bg-[#FF6B57] hover:bg-[#F25743] text-white transition-colors shadow-md shadow-[#FF6B57]/20 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Revanche</span>
                </button>
                <button
                  type="button"
                  onClick={onReturnToHub}
                  className="flex-1 min-h-[50px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-semibold text-sm bg-[#FAF7F2] hover:bg-[#F1ECE3] border border-[#EAE4DC] text-[#1F242D] transition-colors cursor-pointer"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>Retour au Hub</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Persistent Live Duo Cameras below table */}
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
          subtitle={isSolo ? 'Partenaire IA · Camp droit' : 'Partenaire synchronisé'}
          stream={remoteStream}
          isAi={isSolo}
          metricsRef={partnerFaceMetricsRef}
          compact
        />
      </div>
    </main>
  );
}
