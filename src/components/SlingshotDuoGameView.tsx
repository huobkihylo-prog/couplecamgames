import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  Crosshair,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import type {
  ConnectionMode,
  FaceMetrics,
  HandMetrics,
  PeerMessage,
  SlingshotDuoState,
  SlingshotMode,
  TrackerStatus,
} from '../types/duoplay';
import {
  canGrabSlingshot,
  clampPullVector,
  computeLaunchVelocity,
  createAiSlingshotMemory,
  createInitialSlingshotState,
  fireSlingshot,
  getSlingshotAnchor,
  GRAB_RADIUS_PX,
  GUEST_ANCHOR,
  HOST_ANCHOR,
  MIN_FIRE_PULL_PX,
  predictTrajectory,
  SLING_H,
  SLING_W,
  startSlingshotMatch,
  stepAiSlingshotPartner,
  stepSlingshotGame,
  type SlingshotSimEvent,
} from '../game/slingshotLogic';
import { useI18n } from '../i18n/LanguageContext';
import { computeUniformCanvasFit, mapClientPointToLogical } from '../utils/canvasViewport';
import { soundFx } from '../utils/soundFx';
import { CameraFeedTile } from './CameraFeedTile';

interface SlingshotDuoGameViewProps {
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
  bestScore: number;
  onUpdateBestScore: (score: number) => void;
  onVideoRef: (el: HTMLVideoElement | null) => void;
  onRequestCamera: () => void;
  onSendPeerMessage: (msg: PeerMessage) => void;
  onSendPeerRealtime: (msg: PeerMessage) => void;
  registerPeerHandler: (handler: ((msg: PeerMessage) => void) | null) => void;
  onReturnToHub: () => void;
}

interface SlingParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  isHeart: boolean;
}

interface FloatingPopup {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
}

const MAX_PARTICLES = 140;
const MAX_POPUPS = 16;

function createParticlePool(): SlingParticle[] {
  return Array.from({ length: MAX_PARTICLES }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 0.6,
    size: 4,
    color: '#FF4D8D',
    isHeart: false,
  }));
}

function createPopupPool(): FloatingPopup[] {
  return Array.from({ length: MAX_POPUPS }, () => ({
    active: false,
    x: 0,
    y: 0,
    vy: -48,
    life: 0,
    maxLife: 1.0,
    text: '',
    color: '#FFFFFF',
  }));
}

function drawHeartPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.72);
  ctx.bezierCurveTo(cx - r * 1.15, cy + r * 0.08, cx - r * 1.08, cy - r * 0.88, cx, cy - r * 0.34);
  ctx.bezierCurveTo(cx + r * 1.08, cy - r * 0.88, cx + r * 1.15, cy + r * 0.08, cx, cy + r * 0.72);
  ctx.closePath();
}

export function SlingshotDuoGameView({
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
  bestScore,
  onUpdateBestScore,
  onVideoRef,
  onRequestCamera,
  onSendPeerMessage,
  onSendPeerRealtime,
  registerPeerHandler,
  onReturnToHub,
}: SlingshotDuoGameViewProps) {
  const { t } = useI18n();
  const isSolo = connectionMode === 'solo';
  const isHost = connectionMode !== 'p2p-guest';
  const localOwner: 'host' | 'guest' = isHost ? 'host' : 'guest';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<SlingshotDuoState>(createInitialSlingshotState('coop', bestScore));
  const aiMemRef = useRef(createAiSlingshotMemory());
  const particlesRef = useRef<SlingParticle[]>(createParticlePool());
  const particleCursorRef = useRef(0);
  const popupsRef = useRef<FloatingPopup[]>(createPopupPool());
  const popupCursorRef = useRef(0);

  // Local 1-hand pinch & mouse/touch drag controller refs
  const localGrabbedByHandRef = useRef(false);
  const pointerDragRef = useRef<{ active: boolean; pullX: number; pullY: number }>({
    active: false,
    pullX: 0,
    pullY: 0,
  });
  const localCursorRef = useRef<{ x: number; y: number; visible: boolean; pinching: boolean }>({
    x: getSlingshotAnchor(localOwner).x,
    y: getSlingshotAnchor(localOwner).y,
    visible: false,
    pinching: false,
  });

  // Hidden offscreen video refs for optional subtle webcam backdrop inside arena
  const localBgVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteBgVideoRef = useRef<HTMLVideoElement | null>(null);

  const [selectedMode, setSelectedMode] = useState<SlingshotMode>('coop');
  const [hud, setHud] = useState(() => ({
    phase: stateRef.current.phase,
    mode: stateRef.current.mode,
    timeLeftSec: stateRef.current.timeLeftSec,
    hostScore: 0,
    guestScore: 0,
    coopScore: 0,
    bestScore,
    trickShots: 0,
    fusionCount: 0,
    hostStunSec: 0,
    guestStunSec: 0,
    lastCallout: '',
  }));

  const syncHudFromRef = useCallback(() => {
    const s = stateRef.current;
    setHud({
      phase: s.phase,
      mode: s.mode,
      timeLeftSec: s.timeLeftSec,
      hostScore: s.hostScore,
      guestScore: s.guestScore,
      coopScore: s.coopScore,
      bestScore: s.bestScore,
      trickShots: s.trickShots,
      fusionCount: s.fusionCount,
      hostStunSec: s.hostStunSec,
      guestStunSec: s.guestStunSec,
      lastCallout: s.lastCallout,
    });
  }, []);

  const spawnBurst = useCallback(
    (x: number, y: number, color: string, count: number, isHeart = false, speed = 220) => {
      const pool = particlesRef.current;
      for (let i = 0; i < count; i++) {
        const idx = particleCursorRef.current % MAX_PARTICLES;
        particleCursorRef.current += 1;
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.55;
        const mag = speed * (0.4 + Math.random() * 0.85);
        const p = pool[idx];
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * mag;
        p.vy = Math.sin(angle) * mag - (isHeart ? 90 : 30);
        p.life = 0;
        p.maxLife = isHeart ? 0.95 + Math.random() * 0.45 : 0.45 + Math.random() * 0.35;
        p.size = isHeart ? 7 + Math.random() * 5 : 3 + Math.random() * 4.5;
        p.color = color;
        p.isHeart = isHeart;
      }
    },
    [],
  );

  const spawnPopup = useCallback((x: number, y: number, text: string, color: string) => {
    const pool = popupsRef.current;
    const idx = popupCursorRef.current % MAX_POPUPS;
    popupCursorRef.current += 1;
    const p = pool[idx];
    p.active = true;
    p.x = x;
    p.y = y;
    p.vy = -56;
    p.life = 0;
    p.maxLife = 1.05;
    p.text = text;
    p.color = color;
  }, []);

  const handleSimEvents = useCallback(
    (events: SlingshotSimEvent[]) => {
      for (const ev of events) {
        if (ev.kind === 'ricochet') {
          soundFx.slingRicochet();
          spawnBurst(ev.x, ev.y, ev.color, 7, false, 150);
        } else if (ev.kind === 'pop') {
          soundFx.slingTargetPop(ev.points ?? 20);
          spawnBurst(ev.x, ev.y, ev.color, 14, false, 230);
          if (ev.label) spawnPopup(ev.x, ev.y - 12, ev.label, ev.color);
        } else if (ev.kind === 'trickshot') {
          soundFx.slingRicochet();
          soundFx.slingTargetPop(30);
          spawnBurst(ev.x, ev.y, '#38BDF8', 20, false, 270);
          if (ev.label) spawnPopup(ev.x, ev.y - 14, ev.label, '#38BDF8');
        } else if (ev.kind === 'fusion-mark') {
          soundFx.syncChime();
          spawnBurst(ev.x, ev.y, '#FDE047', 12, false, 200);
          if (ev.label) spawnPopup(ev.x, ev.y - 16, ev.label, '#FDE047');
        } else if (ev.kind === 'fusion-boom') {
          soundFx.slingFusionFireworks();
          spawnBurst(ev.x, ev.y, '#FACC15', 26, false, 340);
          spawnBurst(ev.x, ev.y, '#FF4D8D', 14, false, 260);
          spawnBurst(ev.x, ev.y, '#22D3EE', 14, false, 260);
          if (ev.label) spawnPopup(ev.x, ev.y - 18, ev.label, '#FACC15');
        } else if (ev.kind === 'explosive') {
          soundFx.slingOrangeExplosion();
          spawnBurst(ev.x, ev.y, '#FB923C', 28, false, 340);
          spawnBurst(ev.x, ev.y, '#FDE047', 12, false, 210);
          if (ev.label) spawnPopup(ev.x, ev.y - 16, ev.label, '#FB923C');
        } else if (ev.kind === 'heart') {
          soundFx.slingHeartBonus();
          spawnBurst(ev.x, ev.y, '#FB7185', 22, true, 240);
          if (ev.label) spawnPopup(ev.x, ev.y - 16, ev.label, '#FB7185');
        } else if (ev.kind === 'bomb') {
          soundFx.slingBombStun();
          spawnBurst(ev.x, ev.y, '#EF4444', 26, false, 310);
          if (ev.label) spawnPopup(ev.x, ev.y - 16, ev.label, '#EF4444');
        } else if (ev.kind === 'gameover') {
          soundFx.victoryFanfare();
        }
      }
    },
    [spawnBurst, spawnPopup],
  );

  const startMatch = useCallback(
    (mode: SlingshotMode, broadcast: boolean) => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setSelectedMode(mode);
      aiMemRef.current = createAiSlingshotMemory();
      localGrabbedByHandRef.current = false;
      pointerDragRef.current = { active: false, pullX: 0, pullY: 0 };
      stateRef.current = startSlingshotMatch(mode, Math.max(bestScore, stateRef.current.bestScore));
      document.body.dataset.state = 'playing';
      soundFx.countdownGo();
      syncHudFromRef();
      if (broadcast && isHost) {
        onSendPeerMessage({ type: 'SLING_START', mode });
      }
    },
    [bestScore, isHost, onSendPeerMessage, syncHudFromRef],
  );

  const togglePause = useCallback(
    (broadcast: boolean) => {
      const cur = stateRef.current;
      if (cur.phase !== 'playing' && cur.phase !== 'paused') return;
      const nextPaused = cur.phase === 'playing';
      stateRef.current = { ...cur, phase: nextPaused ? 'paused' : 'playing' };
      document.body.dataset.state = nextPaused ? 'paused' : 'playing';
      soundFx.click();
      syncHudFromRef();
      if (broadcast) {
        onSendPeerMessage({ type: 'SLING_PAUSE', paused: nextPaused });
      }
    },
    [onSendPeerMessage, syncHudFromRef],
  );

  // Attach subtle dimmed camera feeds to hidden video elements for arena ambiance
  useEffect(() => {
    const v = localBgVideoRef.current;
    if (v) {
      v.srcObject = cameraEnabled ? localStream : null;
      if (localStream && cameraEnabled) v.play().catch(() => {});
    }
  }, [localStream, cameraEnabled]);

  useEffect(() => {
    const v = remoteBgVideoRef.current;
    if (v) {
      v.srcObject = remoteStream;
      if (remoteStream) v.play().catch(() => {});
    }
  }, [remoteStream]);

  // PeerJS incoming message handler
  useEffect(() => {
    registerPeerHandler((msg) => {
      if (msg.type === 'SLING_START') {
        startMatch(msg.mode, false);
      } else if (msg.type === 'SLING_PAUSE') {
        const cur = stateRef.current;
        if (cur.phase === 'playing' || cur.phase === 'paused') {
          stateRef.current = { ...cur, phase: msg.paused ? 'paused' : 'playing' };
          document.body.dataset.state = msg.paused ? 'paused' : 'playing';
          syncHudFromRef();
        }
      } else if (msg.type === 'SLING_PULL' && isHost) {
        const clamped = clampPullVector(msg.pullX, msg.pullY);
        stateRef.current = {
          ...stateRef.current,
          guestPull: {
            isPulling: msg.isPulling && stateRef.current.guestStunSec <= 0,
            pullX: clamped.pullX,
            pullY: clamped.pullY,
          },
        };
      } else if (msg.type === 'SLING_FIRE' && isHost) {
        const anchor = GUEST_ANCHOR;
        const beforeCount = stateRef.current.projectiles.length;
        stateRef.current = fireSlingshot(
          stateRef.current,
          'guest',
          msg.vx,
          msg.vy,
          anchor.x + stateRef.current.guestPull.pullX,
          anchor.y + stateRef.current.guestPull.pullY,
        );
        if (stateRef.current.projectiles.length > beforeCount) {
          soundFx.slingFire(0.75);
        }
      } else if (msg.type === 'SLING_STATE' && !isHost) {
        const cur = stateRef.current;
        const prevBombFlash = cur.flashKind === 'bomb';
        const nextBest = Math.max(
          cur.bestScore,
          msg.mode === 'coop' ? msg.coopScore : Math.max(msg.hostScore, msg.guestScore),
        );
        stateRef.current = {
          ...cur,
          phase: msg.phase,
          mode: msg.mode,
          timeLeftSec: msg.timeLeftSec,
          hostScore: msg.hostScore,
          guestScore: msg.guestScore,
          coopScore: msg.coopScore,
          bestScore: nextBest,
          hostReloadSec: msg.hostReloadSec,
          guestReloadSec: msg.guestReloadSec,
          hostStunSec: msg.hostStunSec,
          guestStunSec: msg.guestStunSec,
          hostPull: msg.hostPull,
          guestPull:
            localGrabbedByHandRef.current || pointerDragRef.current.active
              ? cur.guestPull
              : msg.guestPull,
          projectiles: msg.projectiles,
          targets: msg.targets,
          lastCallout: msg.lastCallout,
          calloutTimerSec: msg.lastCallout ? 1.0 : 0,
          flashKind: msg.flashKind,
          flashTimerSec: msg.flashKind !== 'none' ? 0.22 : 0,
        };
        if (msg.flashKind === 'bomb' && !prevBombFlash) {
          soundFx.slingBombStun();
        }
        document.body.dataset.state =
          msg.phase === 'ready' ? 'title' : msg.phase === 'gameover' ? 'gameover' : msg.phase;
        syncHudFromRef();
      }
    });

    return () => registerPeerHandler(null);
  }, [isHost, registerPeerHandler, startMatch, syncHudFromRef]);

  // Keyboard shortcuts: Enter/Space to start on title, Escape/P to pause
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (stateRef.current.phase === 'playing' || stateRef.current.phase === 'paused') {
          e.preventDefault();
          togglePause(true);
        }
      } else if ((e.code === 'Enter' || e.code === 'Space') && stateRef.current.phase === 'ready') {
        if (isHost) {
          e.preventDefault();
          startMatch(selectedMode, true);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isHost, selectedMode, startMatch, togglePause]);

  // Report best score upward
  useEffect(() => {
    if (hud.bestScore > bestScore) {
      onUpdateBestScore(hud.bestScore);
    }
  }, [hud.bestScore, bestScore, onUpdateBestScore]);

  // Main 60 FPS Simulation + HandLandmarker Pinch + Canvas2D Render Loop
  useEffect(() => {
    document.body.dataset.state = 'title';
    let rafId = 0;
    let lastMs = performance.now();
    let hudTimer = 0;
    let peerSyncTimer = 0;
    let guestPullTimer = 0;

    const triggerLocalFire = (pullX: number, pullY: number) => {
      const launch = computeLaunchVelocity(pullX, pullY);
      if (!launch) return; // < 20px cancels shot with zero penalty
      const anchor = getSlingshotAnchor(localOwner);
      if (isHost) {
        const beforeCount = stateRef.current.projectiles.length;
        stateRef.current = fireSlingshot(
          stateRef.current,
          'host',
          launch.vx,
          launch.vy,
          anchor.x + pullX,
          anchor.y + pullY,
        );
        if (stateRef.current.projectiles.length > beforeCount) {
          soundFx.slingFire(launch.powerRatio);
          spawnBurst(anchor.x + pullX, anchor.y + pullY, '#FF4D8D', 8, false, 160);
        }
      } else {
        soundFx.slingFire(launch.powerRatio);
        spawnBurst(anchor.x + pullX, anchor.y + pullY, '#22D3EE', 8, false, 160);
        onSendPeerMessage({ type: 'SLING_FIRE', vx: launch.vx, vy: launch.vy });
      }
    };

    const frame = (now: number) => {
      rafId = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0.001, (now - lastMs) * 0.001));
      lastMs = now;

      const cur = stateRef.current;
      const localAnchor = getSlingshotAnchor(localOwner);
      const localStunned = localOwner === 'host' ? cur.hostStunSec > 0 : cur.guestStunSec > 0;
      const localReloading = localOwner === 'host' ? cur.hostReloadSec > 0 : cur.guestReloadSec > 0;

      // 1. Read MediaPipe HandLandmarker pinch gesture (unless mouse/touch drag is active)
      const hm = localHandMetricsRef.current;
      if (!pointerDragRef.current.active && hm.handDetected) {
        const cx = hm.pinchX * SLING_W;
        const cy = hm.pinchY * SLING_H;
        localCursorRef.current = { x: cx, y: cy, visible: true, pinching: hm.isPinching };

        if (cur.phase === 'playing' && !localStunned) {
          if (!localGrabbedByHandRef.current) {
            if (hm.isPinching && !localReloading && canGrabSlingshot(cx, cy, localOwner)) {
              localGrabbedByHandRef.current = true;
              soundFx.slingGrab();
            }
          }

          if (localGrabbedByHandRef.current) {
            if (hm.isPinching) {
              const clamped = clampPullVector(cx - localAnchor.x, cy - localAnchor.y);
              if (localOwner === 'host') {
                stateRef.current = {
                  ...stateRef.current,
                  hostPull: { isPulling: true, pullX: clamped.pullX, pullY: clamped.pullY },
                };
              } else {
                stateRef.current = {
                  ...stateRef.current,
                  guestPull: { isPulling: true, pullX: clamped.pullX, pullY: clamped.pullY },
                };
              }
            } else {
              // Fingers opened (ratio > 0.55) -> Release and fire!
              localGrabbedByHandRef.current = false;
              const pull = localOwner === 'host' ? stateRef.current.hostPull : stateRef.current.guestPull;
              if (localOwner === 'host') {
                stateRef.current = {
                  ...stateRef.current,
                  hostPull: { isPulling: false, pullX: 0, pullY: 0 },
                };
              } else {
                stateRef.current = {
                  ...stateRef.current,
                  guestPull: { isPulling: false, pullX: 0, pullY: 0 },
                };
              }
              triggerLocalFire(pull.pullX, pull.pullY);
            }
          }
        } else if (localGrabbedByHandRef.current) {
          localGrabbedByHandRef.current = false;
        }
      } else if (!pointerDragRef.current.active) {
        localCursorRef.current.visible = false;
        if (localGrabbedByHandRef.current) {
          localGrabbedByHandRef.current = false;
          if (localOwner === 'host') {
            stateRef.current = { ...stateRef.current, hostPull: { isPulling: false, pullX: 0, pullY: 0 } };
          } else {
            stateRef.current = { ...stateRef.current, guestPull: { isPulling: false, pullX: 0, pullY: 0 } };
          }
        }
      }

      // 2. Guest streams pull state to Host at ~28fps
      if (!isHost && stateRef.current.phase === 'playing') {
        guestPullTimer += dt;
        if (guestPullTimer >= 0.036) {
          guestPullTimer = 0;
          const gp = stateRef.current.guestPull;
          onSendPeerRealtime({
            type: 'SLING_PULL',
            isPulling: gp.isPulling,
            pullX: gp.pullX,
            pullY: gp.pullY,
          });
        }
      }

      // 3. Authoritative Host (or Solo) physics + Solo AI partner
      if (isHost) {
        if (isSolo && stateRef.current.phase === 'playing') {
          const aiStep = stepAiSlingshotPartner(aiMemRef.current, stateRef.current, dt);
          aiMemRef.current = aiStep.memory;
          stateRef.current = {
            ...stateRef.current,
            guestPull: aiStep.pull,
          };
          if (aiStep.fire) {
            const beforeCount = stateRef.current.projectiles.length;
            stateRef.current = fireSlingshot(
              stateRef.current,
              'guest',
              aiStep.fire.vx,
              aiStep.fire.vy,
              GUEST_ANCHOR.x + aiStep.pull.pullX,
              GUEST_ANCHOR.y + aiStep.pull.pullY,
            );
            if (stateRef.current.projectiles.length > beforeCount) {
              soundFx.slingFire(0.65);
            }
          }
        }

        const stepRes = stepSlingshotGame(stateRef.current, dt);
        stateRef.current = stepRes.state;
        if (stepRes.events.length > 0) {
          handleSimEvents(stepRes.events);
        }
        if (stepRes.state.phase === 'gameover') {
          document.body.dataset.state = 'gameover';
        }

        // Broadcast authoritative state to Guest at ~25fps
        if (!isSolo) {
          peerSyncTimer += dt;
          if (peerSyncTimer >= 0.04) {
            peerSyncTimer = 0;
            const s = stateRef.current;
            onSendPeerRealtime({
              type: 'SLING_STATE',
              phase: s.phase,
              mode: s.mode,
              timeLeftSec: s.timeLeftSec,
              hostScore: s.hostScore,
              guestScore: s.guestScore,
              coopScore: s.coopScore,
              hostReloadSec: s.hostReloadSec,
              guestReloadSec: s.guestReloadSec,
              hostStunSec: s.hostStunSec,
              guestStunSec: s.guestStunSec,
              hostPull: s.hostPull,
              guestPull: s.guestPull,
              projectiles: s.projectiles,
              targets: s.targets,
              lastCallout: s.lastCallout,
              flashKind: s.flashKind,
            });
          }
        }
      }

      // 4. Advance pooled particles & floating popups
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
        p.vy += (p.isHeart ? 120 : 320) * dt;
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
        pop.y += pop.vy * dt;
      }

      // 5. Render Neon Arena Canvas2D
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const s = stateRef.current;
        const cssW = canvas.clientWidth || SLING_W;
        const cssH = canvas.clientHeight || SLING_H;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const fit = computeUniformCanvasFit(cssW, cssH, SLING_W, SLING_H, 0.62, dpr);
        if (canvas.width !== fit.pixelW || canvas.height !== fit.pixelH) {
          canvas.width = fit.pixelW;
          canvas.height = fit.pixelH;
        }

        ctx.setTransform(fit.dpr, 0, 0, fit.dpr, 0, 0);

        // Full-bleed midnight neon arcade backdrop (eliminates letterboxing on mobile)
        const fullBg = ctx.createLinearGradient(0, 0, 0, fit.cssH);
        fullBg.addColorStop(0, '#09071A');
        fullBg.addColorStop(0.55, '#120C2C');
        fullBg.addColorStop(1, '#1A0F35');
        ctx.fillStyle = fullBg;
        ctx.fillRect(0, 0, fit.cssW, fit.cssH);

        ctx.save();
        ctx.translate(fit.offsetX, fit.offsetY);
        ctx.scale(fit.scale, fit.scale);

        // Screen shake from trauma^2
        if (s.trauma > 0.01) {
          const shake = s.trauma * s.trauma * 14;
          ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
        }

        // Logical arena backdrop tint
        const bgGrad = ctx.createLinearGradient(0, 0, 0, SLING_H);
        bgGrad.addColorStop(0, '#09071A');
        bgGrad.addColorStop(0.55, '#120C2C');
        bgGrad.addColorStop(1, '#1A0F35');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, SLING_W, SLING_H);

        // Subtle dimmed split couple webcam backdrop if live streams exist
        const drawDimmedCam = (video: HTMLVideoElement | null, dx: number, w: number, mirror: boolean) => {
          if (!video || video.readyState < 2 || video.videoWidth === 0) return;
          ctx.save();
          ctx.globalAlpha = 0.14;
          ctx.beginPath();
          ctx.rect(dx, 0, w, SLING_H);
          ctx.clip();
          if (mirror) {
            ctx.translate(dx + w, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0, w, SLING_H);
          } else {
            ctx.drawImage(video, dx, 0, w, SLING_H);
          }
          ctx.restore();
        };
        drawDimmedCam(localBgVideoRef.current, 0, SLING_W * 0.5, true);
        drawDimmedCam(remoteBgVideoRef.current, SLING_W * 0.5, SLING_W * 0.5, false);

        // Subtle perspective grid lines on neon arena floor & side ricochet bumpers
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.14)';
        ctx.lineWidth = 1;
        for (let gx = 100; gx < SLING_W; gx += 100) {
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx, SLING_H);
          ctx.stroke();
        }
        for (let gy = 80; gy < SLING_H; gy += 80) {
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.lineTo(SLING_W, gy);
          ctx.stroke();
        }

        // Glowing ricochet walls (left, top, right)
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(4, SLING_H);
        ctx.lineTo(4, 4);
        ctx.lineTo(SLING_W - 4, 4);
        ctx.lineTo(SLING_W - 4, SLING_H);
        ctx.stroke();

        // Ambient glow behind left (Host #FF4D8D) and right (Guest #22D3EE) launch pads
        const leftGlow = ctx.createRadialGradient(HOST_ANCHOR.x, HOST_ANCHOR.y + 30, 10, HOST_ANCHOR.x, HOST_ANCHOR.y + 30, 145);
        leftGlow.addColorStop(0, 'rgba(255, 77, 141, 0.24)');
        leftGlow.addColorStop(1, 'rgba(255, 77, 141, 0)');
        ctx.fillStyle = leftGlow;
        ctx.fillRect(HOST_ANCHOR.x - 150, HOST_ANCHOR.y - 120, 300, 240);

        const rightGlow = ctx.createRadialGradient(GUEST_ANCHOR.x, GUEST_ANCHOR.y + 30, 10, GUEST_ANCHOR.x, GUEST_ANCHOR.y + 30, 145);
        rightGlow.addColorStop(0, 'rgba(34, 211, 238, 0.24)');
        rightGlow.addColorStop(1, 'rgba(34, 211, 238, 0)');
        ctx.fillStyle = rightGlow;
        ctx.fillRect(GUEST_ANCHOR.x - 150, GUEST_ANCHOR.y - 120, 300, 240);

        // Draw Targets (5 distinct neon silhouettes!)
        for (const target of s.targets) {
          if (!target.alive) continue;
          const pulse = 1 + Math.sin(s.elapsedSec * 5 + target.bobPhase) * 0.06;

          if (target.kind === 'fusion') {
            // Golden Fusion Center Target
            const r = target.radius * pulse;
            ctx.fillStyle = 'rgba(250, 204, 21, 0.18)';
            ctx.beginPath();
            ctx.arc(target.x, target.y, r + 14, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = target.hitByHost || target.hitByGuest ? '#FEF08A' : '#FACC15';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(target.x, target.y, r, 0, Math.PI * 2);
            ctx.stroke();

            const fGrad = ctx.createRadialGradient(target.x - 6, target.y - 6, 4, target.x, target.y, r);
            fGrad.addColorStop(0, '#FFFBEB');
            fGrad.addColorStop(0.5, '#FACC15');
            fGrad.addColorStop(1, '#D97706');
            ctx.fillStyle = fGrad;
            ctx.beginPath();
            ctx.arc(target.x, target.y, r - 3, 0, Math.PI * 2);
            ctx.fill();

            // Half-ring lock indicators (Host pink left half, Guest cyan right half)
            if (target.hitByHost) {
              ctx.strokeStyle = '#FF4D8D';
              ctx.lineWidth = 5;
              ctx.beginPath();
              ctx.arc(target.x, target.y, r + 7, Math.PI * 0.5, Math.PI * 1.5);
              ctx.stroke();
            }
            if (target.hitByGuest) {
              ctx.strokeStyle = '#22D3EE';
              ctx.lineWidth = 5;
              ctx.beginPath();
              ctx.arc(target.x, target.y, r + 7, -Math.PI * 0.5, Math.PI * 0.5);
              ctx.stroke();
            }

            ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
            ctx.fillStyle = '#1E1102';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('✨150', target.x, target.y);
          } else if (target.kind === 'explosive') {
            // Orange Explosive Orb
            const r = target.radius * pulse;
            ctx.fillStyle = 'rgba(251, 146, 60, 0.22)';
            ctx.beginPath();
            ctx.arc(target.x, target.y, r + 10, 0, Math.PI * 2);
            ctx.fill();

            const eGrad = ctx.createRadialGradient(target.x - 5, target.y - 5, 3, target.x, target.y, r);
            eGrad.addColorStop(0, '#FEF08A');
            eGrad.addColorStop(0.55, '#FB923C');
            eGrad.addColorStop(1, '#EA580C');
            ctx.fillStyle = eGrad;
            ctx.beginPath();
            ctx.arc(target.x, target.y, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#FFEDD5';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.font = '800 15px sans-serif';
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('💥', target.x, target.y + 1);
          } else if (target.kind === 'heart') {
            // Crimson/Rose Bonus Heart Balloon (+80)
            const r = target.radius * pulse;
            ctx.fillStyle = 'rgba(251, 113, 133, 0.24)';
            ctx.beginPath();
            ctx.arc(target.x, target.y, r + 9, 0, Math.PI * 2);
            ctx.fill();

            drawHeartPath(ctx, target.x, target.y, r * 1.05);
            ctx.fillStyle = '#FB7185';
            ctx.fill();
            ctx.strokeStyle = '#FFE4E6';
            ctx.lineWidth = 2.2;
            ctx.stroke();

            ctx.font = '800 11px "JetBrains Mono", monospace';
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('+80', target.x, target.y + 2);
          } else if (target.kind === 'bomb') {
            // Spiked Red Bomb (-30 & 1.5s stun)
            const r = target.radius;
            const spikes = 10;
            ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
            ctx.beginPath();
            ctx.arc(target.x, target.y, r + 11, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            for (let i = 0; i < spikes * 2; i++) {
              const rad = i % 2 === 0 ? r + 7 : r - 3;
              const ang = (i * Math.PI) / spikes + s.elapsedSec * 1.4;
              const px = target.x + Math.cos(ang) * rad;
              const py = target.y + Math.sin(ang) * rad;
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = '#DC2626';
            ctx.fill();
            ctx.strokeStyle = '#FCA5A5';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#1E0808';
            ctx.beginPath();
            ctx.arc(target.x, target.y, r * 0.62, 0, Math.PI * 2);
            ctx.fill();

            ctx.font = '800 11px "JetBrains Mono", monospace';
            ctx.fillStyle = '#FCA5A5';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('-30', target.x, target.y + 1);
          } else {
            // Classic Neon Orbs (Pink +10, Cyan +20, Violet +30)
            const color =
              target.kind === 'classic-pink'
                ? '#FF4D8D'
                : target.kind === 'classic-cyan'
                  ? '#22D3EE'
                  : '#A855F7';
            const r = target.radius * pulse;
            ctx.fillStyle = `${color}30`;
            ctx.beginPath();
            ctx.arc(target.x, target.y, r + 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(target.x, target.y, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.font = '800 12px "JetBrains Mono", monospace';
            ctx.fillStyle = '#09071A';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`+${target.points}`, target.x, target.y + 1);
          }
        }

        // Draw Both Slingshots (Host bottom-left #FF4D8D, Guest bottom-right #22D3EE)
        const drawSlingshot = (
          owner: 'host' | 'guest',
          anchor: { x: number; y: number },
          pull: { isPulling: boolean; pullX: number; pullY: number },
          reloadSec: number,
          stunSec: number,
          color: string,
          label: string,
        ) => {
          const leftForkX = anchor.x - 24;
          const rightForkX = anchor.x + 24;
          const forkTopY = anchor.y - 6;
          const baseY = anchor.y + 72;

          // Subtle grab halo on local player's slingshot when ready
          if (owner === localOwner && s.phase === 'playing' && stunSec <= 0 && !pull.isPulling) {
            ctx.strokeStyle = `${color}40`;
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.arc(anchor.x, anchor.y, 48 + Math.sin(s.elapsedSec * 4) * 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // Dotted Parabolic Aiming Trajectory when pulling >= MIN_FIRE_PULL_PX
          if (pull.isPulling && stunSec <= 0) {
            const traj = predictTrajectory(anchor.x, anchor.y, pull.pullX, pull.pullY, 24, 0.05);
            for (let i = 0; i < traj.length; i++) {
              const pt = traj[i];
              const alpha = Math.max(0.14, 1 - i / traj.length);
              ctx.fillStyle = color;
              ctx.globalAlpha = alpha;
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, Math.max(2.2, 5.2 - i * 0.14), 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.globalAlpha = 1;
          }

          const ballX = anchor.x + (pull.isPulling ? pull.pullX : 0);
          const ballY = anchor.y + (pull.isPulling ? pull.pullY : 0);

          // Back elastic band
          if (reloadSec <= 0 && stunSec <= 0) {
            ctx.strokeStyle = color;
            ctx.lineWidth = pull.isPulling ? 5 : 3.5;
            ctx.beginPath();
            ctx.moveTo(leftForkX, forkTopY);
            ctx.lineTo(ballX, ballY);
            ctx.stroke();
          }

          // Neon Y-fork frame
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = `${color}45`;
          ctx.lineWidth = 14;
          ctx.beginPath();
          ctx.moveTo(anchor.x, baseY);
          ctx.lineTo(anchor.x, anchor.y + 34);
          ctx.lineTo(leftForkX, forkTopY);
          ctx.moveTo(anchor.x, anchor.y + 34);
          ctx.lineTo(rightForkX, forkTopY);
          ctx.stroke();

          ctx.strokeStyle = stunSec > 0 ? '#EF4444' : color;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(anchor.x, baseY);
          ctx.lineTo(anchor.x, anchor.y + 34);
          ctx.lineTo(leftForkX, forkTopY);
          ctx.moveTo(anchor.x, anchor.y + 34);
          ctx.lineTo(rightForkX, forkTopY);
          ctx.stroke();

          // Loaded glowing projectile ball
          if (reloadSec <= 0 && stunSec <= 0) {
            ctx.fillStyle = `${color}44`;
            ctx.beginPath();
            ctx.arc(ballX, ballY, 22, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(ballX, ballY, 13, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = color;
            ctx.lineWidth = 4;
            ctx.stroke();

            // Front elastic band
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = pull.isPulling ? 3.5 : 2.5;
            ctx.beginPath();
            ctx.moveTo(rightForkX, forkTopY);
            ctx.lineTo(ballX, ballY);
            ctx.stroke();
          }

          // Stun ring if player hit a red bomb
          if (stunSec > 0) {
            ctx.strokeStyle = '#EF4444';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(anchor.x, anchor.y, 44, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (stunSec / 1.5));
            ctx.stroke();
            ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
            ctx.fillStyle = '#FCA5A5';
            ctx.textAlign = 'center';
            ctx.fillText(`⚡ ${t.slingStunnedBadge} ${stunSec.toFixed(1)}s`, anchor.x, anchor.y - 44);
          }

          // Owner name plate under base
          ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = '#F8FAFC';
          ctx.textAlign = 'center';
          ctx.fillText(label, anchor.x, baseY + 20);
        };

        drawSlingshot(
          'host',
          HOST_ANCHOR,
          s.hostPull,
          s.hostReloadSec,
          s.hostStunSec,
          '#FF4D8D',
          isHost ? localName : partnerName,
        );
        drawSlingshot(
          'guest',
          GUEST_ANCHOR,
          s.guestPull,
          s.guestReloadSec,
          s.guestStunSec,
          '#22D3EE',
          isHost ? partnerName : localName,
        );

        // Draw Flying Projectiles & Glowing Trails
        for (const p of s.projectiles) {
          const color = p.owner === 'host' ? '#FF4D8D' : '#22D3EE';
          for (let i = 0; i < p.trail.length; i++) {
            const pt = p.trail[i];
            const ratio = (i + 1) / p.trail.length;
            ctx.globalAlpha = ratio * 0.55;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, p.radius * ratio * 0.85, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;

          ctx.fillStyle = `${color}55`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + 7, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = color;
          ctx.lineWidth = 3.5;
          ctx.stroke();
        }

        // Draw Pooled Burst Particles (Circles & Hearts)
        for (let i = 0; i < MAX_PARTICLES; i++) {
          const p = pool[i];
          if (!p.active) continue;
          const a = Math.max(0, 1 - p.life / p.maxLife);
          ctx.globalAlpha = a;
          ctx.fillStyle = p.color;
          if (p.isHeart) {
            drawHeartPath(ctx, p.x, p.y, p.size * (0.7 + a * 0.4));
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;

        // Draw Floating Score Popups
        ctx.font = '800 18px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        for (let i = 0; i < MAX_POPUPS; i++) {
          const pop = popups[i];
          if (!pop.active) continue;
          const a = Math.max(0, 1 - pop.life / pop.maxLife);
          ctx.globalAlpha = a;
          ctx.fillStyle = pop.color;
          ctx.fillText(pop.text, pop.x, pop.y);
        }
        ctx.globalAlpha = 1;

        // Draw Local Hand Pinch Reticle when webcam hand tracking is active
        const cursor = localCursorRef.current;
        if (cursor.visible && s.phase === 'playing') {
          const cColor = localOwner === 'host' ? '#FF4D8D' : '#22D3EE';
          ctx.strokeStyle = cursor.pinching ? '#FACC15' : cColor;
          ctx.lineWidth = cursor.pinching ? 4 : 2.5;
          ctx.beginPath();
          ctx.arc(cursor.x, cursor.y, cursor.pinching ? 15 : 22, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = cursor.pinching ? '#FACC15' : '#FFFFFF';
          ctx.beginPath();
          ctx.arc(cursor.x, cursor.y, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Full-frame impact flash (red on bomb, gold on fusion, rose on heart)
        if (s.flashTimerSec > 0 && s.flashKind !== 'none') {
          const alpha = Math.min(0.32, s.flashTimerSec * 0.9);
          ctx.fillStyle =
            s.flashKind === 'bomb'
              ? `rgba(239, 68, 68, ${alpha})`
              : s.flashKind === 'fusion'
                ? `rgba(250, 204, 21, ${alpha})`
                : s.flashKind === 'heart'
                  ? `rgba(251, 113, 133, ${alpha})`
                  : `rgba(251, 146, 60, ${alpha})`;
          ctx.fillRect(0, 0, SLING_W, SLING_H);
        }

        ctx.restore();
      }

      hudTimer += dt;
      if (hudTimer >= 0.1) {
        hudTimer = 0;
        syncHudFromRef();
      }
    };

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [
    handleSimEvents,
    isHost,
    isSolo,
    localHandMetricsRef,
    localName,
    localOwner,
    onSendPeerMessage,
    onSendPeerRealtime,
    partnerName,
    spawnBurst,
    syncHudFromRef,
  ]);

  // Pointer (Mouse & Touch) Drag-to-Shoot Fallback
  const screenToArena = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: SLING_W * 0.5, y: SLING_H * 0.5 };
    return mapClientPointToLogical(e.clientX, e.clientY, rect, SLING_W, SLING_H, 0.62);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (s.phase !== 'playing') return;
    const localStunned = localOwner === 'host' ? s.hostStunSec > 0 : s.guestStunSec > 0;
    const localReloading = localOwner === 'host' ? s.hostReloadSec > 0 : s.guestReloadSec > 0;
    if (localStunned || localReloading) return;

    const pt = screenToArena(e);
    const anchor = getSlingshotAnchor(localOwner);
    // Generous grab on touch/mouse: within GRAB_RADIUS_PX or anywhere in your lower-half launch zone
    const inOwnHalf = localOwner === 'host' ? pt.x <= SLING_W * 0.55 : pt.x >= SLING_W * 0.45;
    if (Math.hypot(pt.x - anchor.x, pt.y - anchor.y) <= GRAB_RADIUS_PX * 1.65 || (inOwnHalf && pt.y >= 260)) {
      e.currentTarget.setPointerCapture(e.pointerId);
      const clamped = clampPullVector(pt.x - anchor.x, pt.y - anchor.y);
      pointerDragRef.current = { active: true, pullX: clamped.pullX, pullY: clamped.pullY };
      soundFx.slingGrab();
      if (localOwner === 'host') {
        stateRef.current = {
          ...stateRef.current,
          hostPull: { isPulling: true, pullX: clamped.pullX, pullY: clamped.pullY },
        };
      } else {
        stateRef.current = {
          ...stateRef.current,
          guestPull: { isPulling: true, pullX: clamped.pullX, pullY: clamped.pullY },
        };
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointerDragRef.current.active) return;
    const pt = screenToArena(e);
    const anchor = getSlingshotAnchor(localOwner);
    const clamped = clampPullVector(pt.x - anchor.x, pt.y - anchor.y);
    pointerDragRef.current.pullX = clamped.pullX;
    pointerDragRef.current.pullY = clamped.pullY;
    if (localOwner === 'host') {
      stateRef.current = {
        ...stateRef.current,
        hostPull: { isPulling: true, pullX: clamped.pullX, pullY: clamped.pullY },
      };
    } else {
      stateRef.current = {
        ...stateRef.current,
        guestPull: { isPulling: true, pullX: clamped.pullX, pullY: clamped.pullY },
      };
    }
  };

  const handlePointerUp = () => {
    if (!pointerDragRef.current.active) return;
    const { pullX, pullY } = pointerDragRef.current;
    pointerDragRef.current = { active: false, pullX: 0, pullY: 0 };
    if (localOwner === 'host') {
      stateRef.current = {
        ...stateRef.current,
        hostPull: { isPulling: false, pullX: 0, pullY: 0 },
      };
    } else {
      stateRef.current = {
        ...stateRef.current,
        guestPull: { isPulling: false, pullX: 0, pullY: 0 },
      };
    }

    const launch = computeLaunchVelocity(pullX, pullY);
    if (!launch || Math.hypot(pullX, pullY) < MIN_FIRE_PULL_PX) return;
    const anchor = getSlingshotAnchor(localOwner);
    if (isHost) {
      const before = stateRef.current.projectiles.length;
      stateRef.current = fireSlingshot(
        stateRef.current,
        'host',
        launch.vx,
        launch.vy,
        anchor.x + pullX,
        anchor.y + pullY,
      );
      if (stateRef.current.projectiles.length > before) {
        soundFx.slingFire(launch.powerRatio);
        spawnBurst(anchor.x + pullX, anchor.y + pullY, '#FF4D8D', 8, false, 160);
      }
    } else {
      soundFx.slingFire(launch.powerRatio);
      spawnBurst(anchor.x + pullX, anchor.y + pullY, '#22D3EE', 8, false, 160);
      onSendPeerMessage({ type: 'SLING_FIRE', vx: launch.vx, vy: launch.vy });
    }
  };

  const hasHandSensor = Boolean(localStream) && handTrackerStatus === 'ready';
  const showOverlay = hud.phase !== 'playing';
  const hostDisplayName = isHost ? localName : partnerName;
  const guestDisplayName = isHost ? partnerName : localName;

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-1.5 sm:px-6 py-2 sm:py-4 space-y-2.5 sm:space-y-4">
      {/* Hidden offscreen videos used for subtle arena background ambiance */}
      <video ref={localBgVideoRef} muted playsInline autoPlay aria-hidden="true" className="hidden" />
      <video ref={remoteBgVideoRef} muted playsInline autoPlay aria-hidden="true" className="hidden" />

      <section
        data-testid="slingshot-stage"
        className="relative rounded-3xl overflow-hidden bg-[#09071A] border border-[#EAE4DC] shadow-[0_12px_36px_rgba(31,36,45,0.10)]"
      >
        <canvas
          ref={canvasRef}
          data-testid="slingshot-canvas"
          width={SLING_W}
          height={SLING_H}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`block w-full touch-none select-none cursor-crosshair ${
            showOverlay
              ? 'absolute inset-0 h-full object-cover sm:static sm:h-auto sm:aspect-[1000/560]'
              : 'min-h-[350px] h-[52dvh] max-h-[450px] sm:h-auto sm:max-h-none sm:aspect-[1000/560]'
          }`}
        />

        {/* Compact Perimeter Top HUD (visible during playing) */}
        {hud.phase === 'playing' && (
          <div className="pointer-events-none absolute inset-x-3 top-2.5 sm:top-3 z-10 flex items-start justify-between gap-2">
            {/* Score cluster */}
            <div className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl bg-white/95 backdrop-blur-md border border-[#EAE4DC] shadow-[0_6px_20px_rgba(31,36,45,0.10)] flex items-center gap-3">
              {hud.mode === 'coop' ? (
                <div>
                  <p className="text-[10px] sm:text-[11px] font-bold text-[#D97706] uppercase tracking-wider">
                    {t.slingTeamScoreLabel}
                  </p>
                  <p
                    data-testid="slingshot-score"
                    className="font-mono text-lg sm:text-2xl font-extrabold text-[#1F242D] tabular-nums leading-none mt-0.5"
                  >
                    {hud.coopScore}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-[10px] font-bold text-[#FF6B57] truncate max-w-[74px]">
                      {hostDisplayName}
                    </p>
                    <p
                      data-testid="slingshot-host-score"
                      className="font-mono text-lg sm:text-xl font-extrabold text-[#1F242D] tabular-nums leading-none"
                    >
                      {hud.hostScore}
                    </p>
                  </div>
                  <span className="text-[#C9C1B6] font-bold text-xs">vs</span>
                  <div>
                    <p className="text-[10px] font-bold text-[#7C5CFC] truncate max-w-[74px]">
                      {guestDisplayName}
                    </p>
                    <p
                      data-testid="slingshot-guest-score"
                      className="font-mono text-lg sm:text-xl font-extrabold text-[#1F242D] tabular-nums leading-none"
                    >
                      {hud.guestScore}
                    </p>
                  </div>
                </div>
              )}

              <div className="h-7 w-px bg-[#EAE4DC]" />

              <div>
                <p className="text-[10px] sm:text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
                  {t.slingTimeLabel}
                </p>
                <p
                  data-testid="slingshot-timer"
                  className={`font-mono text-lg sm:text-2xl font-extrabold tabular-nums leading-none mt-0.5 ${
                    hud.timeLeftSec <= 10 ? 'text-[#E11D48]' : 'text-[#7C5CFC]'
                  }`}
                >
                  {Math.ceil(hud.timeLeftSec)}s
                </p>
              </div>
            </div>

            {/* Center live callout */}
            {hud.lastCallout && (
              <div className="hidden md:flex items-center px-3.5 py-1.5 rounded-full bg-[#FEF6DC] border border-[#F5D782] text-xs font-extrabold text-[#92400E] shadow-md">
                {hud.lastCallout}
              </div>
            )}

            {/* Top-right utility buttons (44px touch targets) */}
            <div className="pointer-events-auto flex items-center gap-1.5">
              <button
                type="button"
                tabIndex={-1}
                aria-label={t.pause}
                onClick={(e) => {
                  e.currentTarget.blur();
                  togglePause(true);
                }}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-white/95 backdrop-blur-md border border-[#EAE4DC] text-[#1F242D] hover:bg-[#FAF7F2] shadow-sm flex items-center justify-center transition-colors cursor-pointer"
              >
                <Pause className="w-4 h-4" />
              </button>
              {isHost && (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={t.restart}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    startMatch(hud.mode, true);
                  }}
                  className="min-w-[44px] min-h-[44px] rounded-xl bg-white/95 backdrop-blur-md border border-[#EAE4DC] text-[#1F242D] hover:bg-[#FAF7F2] shadow-sm flex items-center justify-center transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* READY / TITLE OVERLAY — Normal flow on mobile so zero clipping ever occurs */}
        {hud.phase === 'ready' && (
          <div className="relative z-20 sm:absolute sm:inset-0 flex justify-center bg-[#FAF7F2]/85 backdrop-blur-sm p-3.5 sm:p-5 sm:overflow-y-auto">
            <div className="my-auto max-w-md w-full rounded-3xl bg-white border border-[#EAE4DC] p-5 sm:p-6 text-center space-y-3.5 sm:space-y-4 shadow-[0_18px_48px_rgba(31,36,45,0.12)]">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-[#FFE8E2] border border-[#F5C5B8] flex items-center justify-center text-[#FF6B57]">
                <Crosshair className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#1F242D] tracking-tight">
                  {t.slingTitle}
                </h1>
                <p className="text-xs sm:text-sm text-[#6B7280] leading-relaxed">{t.slingDesc}</p>
              </div>

              {/* Mode Picker (Coop vs Duel) */}
              {isHost ? (
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2 p-1.5 rounded-2xl bg-[#FAF7F2] border border-[#EAE4DC]">
                  <button
                    type="button"
                    onClick={() => setSelectedMode('coop')}
                    className={`min-h-[44px] px-1.5 sm:px-3 py-2 rounded-xl text-[11px] sm:text-sm font-bold inline-flex items-center justify-center whitespace-nowrap transition-all cursor-pointer ${
                      selectedMode === 'coop'
                        ? 'bg-[#FF6B57] text-white shadow-sm shadow-[#FF6B57]/25'
                        : 'text-[#6B7280] hover:text-[#1F242D]'
                    }`}
                  >
                    <span>{t.slingModeCoop}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMode('duel')}
                    className={`min-h-[44px] px-1.5 sm:px-3 py-2 rounded-xl text-[11px] sm:text-sm font-bold inline-flex items-center justify-center whitespace-nowrap transition-all cursor-pointer ${
                      selectedMode === 'duel'
                        ? 'bg-[#7C5CFC] text-white shadow-sm shadow-[#7C5CFC]/25'
                        : 'text-[#6B7280] hover:text-[#1F242D]'
                    }`}
                  >
                    <span>{t.slingModeDuel}</span>
                  </button>
                </div>
              ) : (
                <p className="text-xs font-semibold text-[#7C5CFC] bg-[#EFE9FB] border border-[#D9CCF8] rounded-xl px-3 py-2">
                  {t.slingWaitingHost}
                </p>
              )}

              {isHost && (
                <button
                  type="button"
                  data-start="true"
                  onClick={() => startMatch(selectedMode, true)}
                  className="w-full min-h-[54px] inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-base font-extrabold bg-[#FF6B57] hover:bg-[#F25743] text-white transition-all shadow-md shadow-[#FF6B57]/25 whitespace-nowrap cursor-pointer"
                >
                  <Play className="w-5 h-5 shrink-0 fill-current" />
                  <span>{t.slingStartBtn}</span>
                </button>
              )}

              <p className="text-xs text-[#6B7280]">
                {hasHandSensor ? t.slingSensorReady : t.slingSensorFallback}
              </p>
            </div>
          </div>
        )}

        {/* PAUSED OVERLAY */}
        {hud.phase === 'paused' && (
          <div className="relative z-20 sm:absolute sm:inset-0 flex justify-center bg-[#FAF7F2]/84 backdrop-blur-sm p-3.5 sm:p-6 sm:overflow-y-auto">
            <div className="my-auto max-w-sm w-full rounded-3xl bg-white border border-[#EAE4DC] p-5 sm:p-6 text-center space-y-4 shadow-[0_18px_48px_rgba(31,36,45,0.12)]">
              <h2 className="text-2xl font-extrabold text-[#1F242D]">{t.pausedTitle}</h2>
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => togglePause(true)}
                  className="w-full min-h-[50px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-base font-extrabold bg-[#FF6B57] hover:bg-[#F25743] text-white shadow-md shadow-[#FF6B57]/20 transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{t.resume}</span>
                </button>
                {isHost && (
                  <button
                    type="button"
                    onClick={() => startMatch(hud.mode, true)}
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold bg-[#FAF7F2] text-[#1F242D] border border-[#EAE4DC] hover:bg-[#F1ECE3] transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>{t.restart}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onReturnToHub}
                  className="w-full min-h-[48px] px-5 py-3 rounded-2xl text-sm font-bold text-[#6B7280] hover:text-[#1F242D] bg-white border border-[#EAE4DC] hover:bg-[#FAF7F2] transition-all cursor-pointer"
                >
                  {t.backToHub}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GAME OVER / RESULTS OVERLAY */}
        {hud.phase === 'gameover' && (
          <div className="relative z-20 sm:absolute sm:inset-0 flex justify-center bg-[#FAF7F2]/88 backdrop-blur-sm p-3.5 sm:p-6 sm:overflow-y-auto">
            <div className="my-auto max-w-md w-full rounded-3xl bg-white border border-[#EAE4DC] p-5 sm:p-6 text-center space-y-4 shadow-[0_18px_48px_rgba(31,36,45,0.12)]">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-[#FEF6DC] border border-[#F5D782] flex items-center justify-center text-[#D97706]">
                <Trophy className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl font-extrabold text-[#1F242D]">
                  {hud.mode === 'coop'
                    ? `${t.slingTeamScoreLabel} : ${hud.coopScore}`
                    : hud.hostScore === hud.guestScore
                      ? t.xoRoundDraw
                      : hud.hostScore > hud.guestScore
                        ? `${hostDisplayName} 🏆`
                        : `${guestDisplayName} 🏆`}
                </h2>
                {hud.mode === 'duel' && (
                  <p className="font-mono text-sm font-semibold text-[#6B7280] tabular-nums">
                    {hostDisplayName} {hud.hostScore} — {hud.guestScore} {guestDisplayName}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-2xl bg-[#FEF6DC] border border-[#F5D782]">
                  <p className="text-[11px] font-semibold text-[#92400E]">{t.recordLabel}</p>
                  <p className="font-mono text-lg font-extrabold text-[#D97706] tabular-nums">
                    {hud.bestScore}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-[#EFE9FB] border border-[#D9CCF8]">
                  <p className="text-[11px] font-semibold text-[#5B21B6]">{t.slingTrickShotsLabel}</p>
                  <p className="font-mono text-lg font-extrabold text-[#7C5CFC] tabular-nums">
                    {hud.trickShots}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-[#FFE8E2] border border-[#F5C5B8]">
                  <p className="text-[11px] font-semibold text-[#C2410C]">{t.slingFusionsLabel}</p>
                  <p className="font-mono text-lg font-extrabold text-[#FF6B57] tabular-nums">
                    {hud.fusionCount}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                {isHost && (
                  <button
                    type="button"
                    data-start="true"
                    onClick={() => startMatch(hud.mode, true)}
                    className="flex-1 min-h-[52px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-base font-extrabold bg-[#FF6B57] hover:bg-[#F25743] text-white shadow-md shadow-[#FF6B57]/20 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{t.playAgain}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onReturnToHub}
                  className="flex-1 min-h-[52px] px-5 py-3 rounded-2xl text-sm font-bold bg-[#FAF7F2] text-[#1F242D] border border-[#EAE4DC] hover:bg-[#F1ECE3] transition-all cursor-pointer"
                >
                  {t.backToHub}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Mobile callout / subtle gesture hint */}
      {hud.phase === 'playing' && (
        <div className="flex items-center justify-center gap-2 text-xs text-[#6B7280]">
          <span className="truncate font-semibold">
            {hud.lastCallout || (hasHandSensor ? t.slingPinchHint : t.slingSensorFallback)}
          </span>
        </div>
      )}

      {/* Side-by-side Live Couple Webcams */}
      <section className="max-w-3xl mx-auto grid grid-cols-2 gap-2.5 sm:gap-4">
        <CameraFeedTile
          name={localName}
          subtitle={hasHandSensor ? t.slingSensorReady : t.slingSensorFallback}
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
