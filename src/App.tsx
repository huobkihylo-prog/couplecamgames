import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import type {
  ConnectionMode,
  ConnectionStatus,
  FaceMetrics,
  FunambulesState,
  GameId,
  HandMetrics,
  LaughSensitivity,
  PeerMessage,
  ScreenView,
  TrackerStatus,
} from './types/duoplay';
import { DuoPeerService, generateRoomCode, normalizeRoomCode } from './services/peerService';
import { DuoFaceTracker, EMPTY_FACE_METRICS } from './services/faceTracker';
import { DuoHandTracker, EMPTY_HAND_METRICS } from './services/handTracker';
import {
  createAiPartnerMemory,
  resetAiForLaughRound,
  stepAiFunambulesPartner,
  stepAiLaughPartner,
} from './game/aiPartner';
import { createInitialFunambulesState } from './game/funambulesPhysics';
import { soundFx } from './utils/soundFx';
import { extractRoomCodeFromSearch } from './utils/clipboard';
import { LobbyView } from './components/LobbyView';
import { SessionToolbar } from './components/SessionToolbar';
import { HubView } from './components/HubView';
import { LaughGameView } from './components/LaughGameView';
import { FunambulesGameView } from './components/FunambulesGameView';
import { NinjaFruitsGameView } from './components/NinjaFruitsGameView';
import { AirHockeyGameView } from './components/AirHockeyGameView';
import { StareDuelGameView } from './components/StareDuelGameView';
import { MiamManiaGameView } from './components/MiamManiaGameView';
import { KissBounceGameView } from './components/KissBounceGameView';
import { ConstellationsGameView } from './components/ConstellationsGameView';
import { LanguageProvider } from './i18n/LanguageContext';

export default function App() {
  return (
    <LanguageProvider>
      <CoupleCamApp />
    </LanguageProvider>
  );
}

function CoupleCamApp() {
  const [screen, setScreen] = useState<ScreenView>('lobby');
  const [playerName, setPlayerName] = useState<string>('Alex');
  const [partnerName, setPartnerName] = useState<string>('Camille IA');
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('idle');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [initialJoinCode] = useState<string>(() =>
    typeof window !== 'undefined' ? extractRoomCodeFromSearch(window.location.search) : '',
  );

  // Persistent webcam & audio state across Hub and both games
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [sfxMuted, setSfxMuted] = useState(false);
  const [cameraHint, setCameraHint] = useState<string | null>(null);
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus>('idle');
  const [handTrackerStatus, setHandTrackerStatus] = useState<TrackerStatus>('idle');

  // Session counters
  const [laughMatchCount, setLaughMatchCount] = useState(0);
  const [stareBestSec, setStareBestSec] = useState(0);
  const [miamBestScore, setMiamBestScore] = useState(0);
  const [funambulesBestM, setFunambulesBestM] = useState(0);
  const [ninjaBestScore, setNinjaBestScore] = useState(0);
  const [airHockeyWins, setAirHockeyWins] = useState(0);
  const [kissBestRally, setKissBestRally] = useState(0);
  const [constellationsCompleted, setConstellationsCompleted] = useState(0);

  // Refs shared across 60fps loops without triggering React re-renders
  const trackerVideoElRef = useRef<HTMLVideoElement | null>(null);
  const localVideoElRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaRequestPromiseRef = useRef<Promise<MediaStream | null> | null>(null);
  const pendingRoomAttemptRef = useRef(0);
  const lastFaceSeenMsRef = useRef(0);
  const lastHandSeenMsRef = useRef(0);
  const localMetricsRef = useRef<FaceMetrics>({ ...EMPTY_FACE_METRICS });
  const partnerMetricsRef = useRef<FaceMetrics>({ ...EMPTY_FACE_METRICS });
  const localHandMetricsRef = useRef<HandMetrics>({ ...EMPTY_HAND_METRICS });
  const partnerHandMetricsRef = useRef<HandMetrics>({ ...EMPTY_HAND_METRICS });
  const manualSmileActiveRef = useRef(false);
  const manualTiltRadRef = useRef(0);
  const localPointerHandRef = useRef<{ normX: number; normY: number; active: boolean }>({
    normX: 0.5,
    normY: 0.5,
    active: false,
  });

  // Services
  const peerServiceRef = useRef<DuoPeerService | null>(null);
  const faceTrackerRef = useRef<DuoFaceTracker | null>(null);
  const handTrackerRef = useRef<DuoHandTracker | null>(null);
  const activeGamePeerHandlerRef = useRef<((msg: PeerMessage) => void) | null>(null);
  const pendingGameMessagesRef = useRef<PeerMessage[]>([]);

  // Solo AI Partner memory & active context
  const aiMemoryRef = useRef(createAiPartnerMemory());
  const aiLaughCtxRef = useRef<{ isPlaying: boolean; sensitivity: LaughSensitivity; pendingImpulse: number }>({
    isPlaying: false,
    sensitivity: 'normal',
    pendingImpulse: 0,
  });
  const aiFunambulesStateRef = useRef<FunambulesState>(createInitialFunambulesState(0));
  const screenRef = useRef<ScreenView>(screen);
  screenRef.current = screen;
  const connectionModeRef = useRef<ConnectionMode>(connectionMode);
  connectionModeRef.current = connectionMode;

  const requestLocalMedia = useCallback(async (): Promise<MediaStream | null> => {
    if (localStreamRef.current) return localStreamRef.current;
    if (mediaRequestPromiseRef.current) return mediaRequestPromiseRef.current;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraHint('Aucune webcam détectée — le mode clavier / boutons reste 100 % jouable.');
      return null;
    }

    const req = (async (): Promise<MediaStream | null> => {
      try {
        // 1. Try full webcam + mic with echo cancellation
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
        setCameraHint(null);
        peerServiceRef.current?.setLocalStream(stream);
        return stream;
      } catch {
        // 2. Fallback to video-only if microphone is unavailable or denied
        try {
          const videoOnlyStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
            audio: false,
          });
          localStreamRef.current = videoOnlyStream;
          setLocalStream(videoOnlyStream);
          setCameraHint('Micro indisponible — webcam activée sans son.');
          peerServiceRef.current?.setLocalStream(videoOnlyStream);
          return videoOnlyStream;
        } catch {
          // 3. Last-resort relaxed video constraint
          try {
            const basicVideo = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
            localStreamRef.current = basicVideo;
            setLocalStream(basicVideo);
            setCameraHint('Micro indisponible — webcam activée sans son.');
            peerServiceRef.current?.setLocalStream(basicVideo);
            return basicVideo;
          } catch {
            setCameraHint(
              'Webcam ou micro indisponible — tu peux jouer avec l’avatar animé et les contrôles clavier.',
            );
            return null;
          }
        }
      } finally {
        mediaRequestPromiseRef.current = null;
      }
    })();

    mediaRequestPromiseRef.current = req;
    return req;
  }, []);

  // Bind localStream to the single dedicated persistent tracker <video> element
  useEffect(() => {
    const video = trackerVideoElRef.current;
    if (!video) return;
    if (localStream) {
      if (video.srcObject !== localStream) {
        video.srcObject = localStream;
      }
      video.play().catch(() => {});
    } else {
      video.srcObject = null;
    }
  }, [localStream]);

  // Lazy-load MediaPipe FaceLandmarker when on Hub or face-tracked games (including Kiss Bounce)
  useEffect(() => {
    if (
      screen === 'lobby' ||
      screen === 'ninja-fruits' ||
      screen === 'air-hockey' ||
      screen === 'constellations'
    ) {
      return;
    }
    if (!localStream) {
      setTrackerStatus('fallback');
      return;
    }
    if (!faceTrackerRef.current) {
      faceTrackerRef.current = new DuoFaceTracker();
    }
    const tracker = faceTrackerRef.current;
    const currentStatus = tracker.getStatus();
    if (currentStatus === 'ready') {
      setTrackerStatus('ready');
      return;
    }
    let cancelled = false;
    setTrackerStatus('loading');
    tracker.ensureInitialized(true).then((status) => {
      if (!cancelled) {
        setTrackerStatus(status);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [screen, localStream]);

  // Strict lazy-load of MediaPipe HandLandmarker ONLY when a hand-tracked game is opened
  useEffect(() => {
    if (
      screen !== 'ninja-fruits' &&
      screen !== 'air-hockey' &&
      screen !== 'kiss-bounce' &&
      screen !== 'constellations'
    ) {
      return;
    }
    if (!localStream) {
      setHandTrackerStatus('fallback');
      return;
    }
    if (!handTrackerRef.current) {
      handTrackerRef.current = new DuoHandTracker();
    }
    const tracker = handTrackerRef.current;
    const currentStatus = tracker.getStatus();
    if (currentStatus === 'ready') {
      setHandTrackerStatus('ready');
      return;
    }
    let cancelled = false;
    setHandTrackerStatus('loading');
    tracker.ensureInitialized(true).then((status) => {
      if (!cancelled) {
        setHandTrackerStatus(status);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [screen, localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      peerServiceRef.current?.destroy();
      faceTrackerRef.current?.dispose();
      handTrackerRef.current?.dispose();
    };
  }, []);

  // Stop local media tracks when stream changes or unmounts
  useEffect(() => {
    return () => {
      localStream?.getTracks().forEach((t) => t.stop());
    };
  }, [localStream]);

  // Dedicated 30fps FaceLandmarker + Solo AI Partner + PeerJS frame sync loop
  useEffect(() => {
    if (screen === 'lobby') {
      document.body.dataset.state = 'lobby';
      return;
    }
    if (screen === 'hub') {
      document.body.dataset.state = 'hub';
    }

    let rafId = 0;
    let lastTickMs = performance.now();

    const loop = (now: number) => {
      rafId = requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTickMs) * 0.001));
      if (now - lastTickMs < 30) return;
      lastTickMs = now;

      // 1. Run ONLY the active MediaPipe sensor for the current screen (FaceLandmarker OR HandLandmarker)
      const sourceVideo =
        trackerVideoElRef.current &&
        trackerVideoElRef.current.readyState >= 2 &&
        trackerVideoElRef.current.videoWidth > 0
          ? trackerVideoElRef.current
          : localVideoElRef.current;

      const activeScreen = screenRef.current;
      const needsHand =
        activeScreen === 'ninja-fruits' ||
        activeScreen === 'air-hockey' ||
        activeScreen === 'kiss-bounce' ||
        activeScreen === 'constellations';
      const needsFace =
        activeScreen !== 'ninja-fruits' &&
        activeScreen !== 'air-hockey' &&
        activeScreen !== 'constellations';

      if (needsHand) {
        const handTracker = handTrackerRef.current;
        const handDetection = handTracker?.detectFrame(sourceVideo, now) ?? {
          kind: 'not-ready' as const,
        };

        if (handDetection.kind === 'frame') {
          if (handDetection.metrics.handDetected) {
            lastHandSeenMsRef.current = now;
            localHandMetricsRef.current = handDetection.metrics;
          } else if (now - lastHandSeenMsRef.current > 240) {
            localHandMetricsRef.current = {
              ...localHandMetricsRef.current,
              handDetected: false,
              timestamp: now,
            };
          }
        } else if (handDetection.kind === 'not-ready') {
          localHandMetricsRef.current = {
            ...localHandMetricsRef.current,
            handDetected: false,
            timestamp: now,
          };
        }

        // Broadcast lightweight hand coordinates (≤30fps) over PeerJS
        if (connectionModeRef.current === 'p2p-host' || connectionModeRef.current === 'p2p-guest') {
          const hm = localHandMetricsRef.current;
          const ptr = localPointerHandRef.current;
          const activeGame = activeScreen as
            | 'ninja-fruits'
            | 'air-hockey'
            | 'kiss-bounce'
            | 'constellations';
          const useCam = hm.handDetected;
          const useIndex = activeGame === 'ninja-fruits' || activeGame === 'constellations';
          const tx = useCam ? (useIndex ? hm.indexX : hm.palmX) : ptr.normX;
          const ty = useCam ? (useIndex ? hm.indexY : hm.palmY) : ptr.normY;
          peerServiceRef.current?.sendRealtime({
            type: 'HAND_FRAME',
            game: activeGame,
            x: tx,
            y: ty,
            detected: useCam || ptr.active,
            ts: now,
          });
        }
      }

      if (needsFace) {
        const tracker = faceTrackerRef.current;
        const detection = tracker?.detectFrame(sourceVideo, now) ?? { kind: 'not-ready' as const };

        if (detection.kind === 'frame') {
          const detected = detection.metrics;
          if (detected.faceDetected) {
            lastFaceSeenMsRef.current = now;
            const manualBoost = manualSmileActiveRef.current ? 84 : 0;
            const effectiveTilt =
              manualTiltRadRef.current !== 0 ? manualTiltRadRef.current : detected.headTiltRad;
            localMetricsRef.current = {
              ...detected,
              smileScore: Math.max(detected.smileScore, manualBoost),
              headTiltRad: effectiveTilt,
            };
          } else if (now - lastFaceSeenMsRef.current > 350) {
            const prev = localMetricsRef.current;
            const targetSmile = manualSmileActiveRef.current ? 86 : detected.smileScore;
            const targetTilt = manualTiltRadRef.current !== 0 ? manualTiltRadRef.current : detected.headTiltRad;
            localMetricsRef.current = {
              ...EMPTY_FACE_METRICS,
              smileScore: Math.round(prev.smileScore + (targetSmile - prev.smileScore) * 0.35),
              grimaceScore: Math.round(prev.grimaceScore * 0.75),
              laughBurst: manualSmileActiveRef.current ? 60 : 0,
              headTiltRad: prev.headTiltRad + (targetTilt - prev.headTiltRad) * 0.35,
              noseOffsetX: 0,
              faceDetected: false,
              timestamp: now,
            };
          }
        } else if (detection.kind === 'same-frame') {
          const prev = localMetricsRef.current;
          if (manualSmileActiveRef.current || manualTiltRadRef.current !== 0) {
            localMetricsRef.current = {
              ...prev,
              smileScore: manualSmileActiveRef.current ? Math.max(prev.smileScore, 86) : prev.smileScore,
              laughBurst: manualSmileActiveRef.current ? 60 : prev.laughBurst,
              headTiltRad: manualTiltRadRef.current !== 0 ? manualTiltRadRef.current : prev.headTiltRad,
              timestamp: now,
            };
          }
        } else {
          const prev = localMetricsRef.current;
          const targetSmile = manualSmileActiveRef.current ? 86 : 6;
          const targetTilt = manualTiltRadRef.current;
          localMetricsRef.current = {
            ...EMPTY_FACE_METRICS,
            smileScore: Math.round(prev.smileScore + (targetSmile - prev.smileScore) * 0.35),
            grimaceScore: manualSmileActiveRef.current ? 55 : 0,
            laughBurst: manualSmileActiveRef.current ? 60 : 0,
            headTiltRad: prev.headTiltRad + (targetTilt - prev.headTiltRad) * 0.35,
            noseOffsetX: 0,
            faceDetected: false,
            timestamp: now,
          };
        }

        // 2. Broadcast face metrics over PeerJS at 30fps when in P2P mode
        if (connectionModeRef.current === 'p2p-host' || connectionModeRef.current === 'p2p-guest') {
          const m = localMetricsRef.current;
          peerServiceRef.current?.sendRealtime({
            type: 'FACE_FRAME',
            smileScore: m.smileScore,
            grimaceScore: m.grimaceScore,
            headTiltRad: m.headTiltRad,
            mouthPucker: m.mouthPucker,
            faceDetected: m.faceDetected,
            ts: now,
          });
        }
      }

      // 3. Step Solo AI Partner ("Camille IA") when in Solo Test Mode
      if (connectionModeRef.current === 'solo') {
        const currentScreen = screenRef.current;
        if (currentScreen === 'funambules') {
          const res = stepAiFunambulesPartner(aiMemoryRef.current, aiFunambulesStateRef.current, dt);
          aiMemoryRef.current = res.nextMemory;
          partnerMetricsRef.current = {
            ...EMPTY_FACE_METRICS,
            smileScore: 18,
            grimaceScore: 12,
            laughBurst: 0,
            headTiltRad: res.headTiltRad,
            noseOffsetX: 0,
            faceDetected: true,
            timestamp: now,
          };
        } else {
          const ctx = aiLaughCtxRef.current;
          const impulse = ctx.pendingImpulse;
          ctx.pendingImpulse = 0;
          const res = stepAiLaughPartner(
            aiMemoryRef.current,
            currentScreen === 'laugh' && ctx.isPlaying,
            ctx.sensitivity,
            impulse,
            dt,
          );
          aiMemoryRef.current = res.nextMemory;
          partnerMetricsRef.current = {
            ...EMPTY_FACE_METRICS,
            smileScore: res.smileScore,
            grimaceScore: Math.round(res.smileScore * 0.7),
            laughBurst: res.smileScore > 55 ? 45 : 0,
            headTiltRad: Math.sin(now * 0.0012) * 0.05,
            noseOffsetX: 0,
            faceDetected: true,
            timestamp: now,
          };
        }
      }
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [screen]);

  const ensurePeerService = useCallback(() => {
    if (!peerServiceRef.current) {
      peerServiceRef.current = new DuoPeerService({
        onStatusChange: (status, msg) => {
          setConnectionStatus(status);
          if (msg !== undefined) setStatusMessage(msg);
          if (status === 'connected') {
            setStatusMessage('');
            setScreen('hub');
            soundFx.roundWin();
          } else if (
            (status === 'disconnected' || status === 'error') &&
            connectionModeRef.current !== 'solo'
          ) {
            if (screenRef.current !== 'lobby') {
              setScreen('lobby');
            }
            setConnectionMode('idle');
          }
        },
        onRoomCodeChange: (newCode) => {
          setRoomCode(normalizeRoomCode(newCode));
        },
        onRemoteStream: (stream) => {
          setRemoteStream(stream);
        },
        onMessage: (msg) => {
          if (msg.type === 'HELLO') {
            setPartnerName(msg.name || 'Partenaire');
          } else if (msg.type === 'JOIN_CONFIRMED') {
            setPartnerName(msg.hostName || 'Hôte');
          } else if (msg.type === 'SELECT_GAME') {
            soundFx.click();
            pendingGameMessagesRef.current = [];
            setScreen(msg.game);
          } else if (msg.type === 'RETURN_HUB') {
            soundFx.click();
            pendingGameMessagesRef.current = [];
            setScreen('hub');
          } else if (msg.type === 'FACE_FRAME') {
            partnerMetricsRef.current = {
              ...EMPTY_FACE_METRICS,
              smileScore: msg.smileScore,
              grimaceScore: msg.grimaceScore ?? 0,
              laughBurst: 0,
              headTiltRad: msg.headTiltRad,
              noseOffsetX: 0,
              faceDetected: msg.faceDetected,
              timestamp: msg.ts,
            };
          } else if (msg.type === 'HAND_FRAME') {
            const prev = partnerHandMetricsRef.current;
            const isIndexGame = msg.game === 'ninja-fruits' || msg.game === 'constellations';
            const isPalmGame = msg.game === 'air-hockey' || msg.game === 'kiss-bounce';
            partnerHandMetricsRef.current = {
              indexX: isIndexGame ? msg.x : prev.indexX,
              indexY: isIndexGame ? msg.y : prev.indexY,
              palmX: isPalmGame ? msg.x : prev.palmX,
              palmY: isPalmGame ? msg.y : prev.palmY,
              handDetected: msg.detected,
              timestamp: msg.ts,
            };
          } else {
            if (activeGamePeerHandlerRef.current) {
              activeGamePeerHandlerRef.current(msg);
            } else {
              // Buffer game messages arriving during the 200ms AnimatePresence screen switch
              pendingGameMessagesRef.current.push(msg);
              if (pendingGameMessagesRef.current.length > 24) {
                pendingGameMessagesRef.current.shift();
              }
            }
          }
        },
      });
    }
    return peerServiceRef.current;
  }, []);

  const handleCreateRoom = useCallback(() => {
    pendingRoomAttemptRef.current += 1;
    const cleanName = playerName.trim() || 'Hôte';
    setPlayerName(cleanName);
    const code = normalizeRoomCode(generateRoomCode());
    setRoomCode(code);
    setConnectionMode('p2p-host');
    setPartnerName('Partenaire');

    // Start PeerJS room immediately (never block signaling on camera/mic prompt)
    const svc = ensurePeerService();
    svc.createHostRoom(code, cleanName, localStreamRef.current);
    void requestLocalMedia();
  }, [playerName, requestLocalMedia, ensurePeerService]);

  const handleCancelRoom = useCallback(() => {
    pendingRoomAttemptRef.current += 1;
    peerServiceRef.current?.destroy();
    setConnectionMode('idle');
    setConnectionStatus('disconnected');
    setStatusMessage('');
    setRoomCode('');
  }, []);

  const handleJoinRoom = useCallback(
    (code: string) => {
      pendingRoomAttemptRef.current += 1;
      const cleanName = playerName.trim() || 'Invité';
      const cleanCode = normalizeRoomCode(code);
      setPlayerName(cleanName);
      setRoomCode(cleanCode);
      setConnectionMode('p2p-guest');
      setPartnerName('Hôte');

      // Start PeerJS connection immediately so the 10s timeout & handshake begin right away
      const svc = ensurePeerService();
      svc.joinGuestRoom(cleanCode, cleanName, localStreamRef.current);
      void requestLocalMedia();
    },
    [playerName, requestLocalMedia, ensurePeerService],
  );

  const handleStartSoloMode = useCallback(
    async (targetScreen: ScreenView = 'hub') => {
      pendingRoomAttemptRef.current += 1;
      peerServiceRef.current?.destroy();
      const cleanName = playerName.trim() || 'Alex';
      setPlayerName(cleanName);
      setPartnerName('Camille IA');
      setConnectionMode('solo');
      setConnectionStatus('connected');
      setRoomCode('SOLO');
      setScreen(targetScreen);
      soundFx.click();
      // Request camera non-blockingly so Solo Mode opens instantaneously
      void requestLocalMedia();
    },
    [playerName, requestLocalMedia],
  );

  // Support ?autostart=1|hub|laugh|stare-duel|miam-mania|funambules|ninja-fruits|air-hockey|kiss-bounce|constellations
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auto = params.get('autostart');
    if (auto === '1' || auto === 'hub') {
      handleStartSoloMode('hub');
    } else if (
      auto === 'laugh' ||
      auto === 'stare-duel' ||
      auto === 'miam-mania' ||
      auto === 'funambules' ||
      auto === 'ninja-fruits' ||
      auto === 'air-hockey' ||
      auto === 'kiss-bounce' ||
      auto === 'constellations'
    ) {
      handleStartSoloMode(auto);
    }
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectGame = useCallback((game: GameId) => {
    soundFx.click();
    setScreen(game);
    peerServiceRef.current?.sendEvent({ type: 'SELECT_GAME', game });
  }, []);

  const handleReturnToHub = useCallback(() => {
    soundFx.click();
    setScreen('hub');
    peerServiceRef.current?.sendEvent({ type: 'RETURN_HUB' });
  }, []);

  const handleLeaveRoom = useCallback(() => {
    pendingRoomAttemptRef.current += 1;
    soundFx.click();
    peerServiceRef.current?.destroy();
    setRemoteStream(null);
    setConnectionMode('idle');
    setConnectionStatus('disconnected');
    setStatusMessage('');
    setRoomCode('');
    setScreen('lobby');
  }, []);

  const handleToggleMic = useCallback(() => {
    setMicMuted((prev) => {
      const next = !prev;
      localStream?.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
      return next;
    });
  }, [localStream]);

  const handleToggleCamera = useCallback(() => {
    setCameraEnabled((prev) => {
      const next = !prev;
      localStream?.getVideoTracks().forEach((track) => {
        track.enabled = next;
      });
      return next;
    });
  }, [localStream]);

  const handleToggleSfx = useCallback(() => {
    setSfxMuted((prev) => {
      const next = !prev;
      soundFx.muted = next;
      return next;
    });
  }, []);

  const handleSendPeerMessage = useCallback((msg: PeerMessage) => {
    peerServiceRef.current?.sendEvent(msg);
  }, []);

  const handleSendPeerRealtime = useCallback((msg: PeerMessage) => {
    peerServiceRef.current?.sendRealtime(msg);
  }, []);

  const registerPeerHandler = useCallback((handler: ((msg: PeerMessage) => void) | null) => {
    activeGamePeerHandlerRef.current = handler;
    if (handler && pendingGameMessagesRef.current.length > 0) {
      const queued = pendingGameMessagesRef.current;
      pendingGameMessagesRef.current = [];
      for (const queuedMsg of queued) {
        handler(queuedMsg);
      }
    }
  }, []);

  const handleAiLaughContextChange = useCallback(
    (ctx: { isPlaying: boolean; sensitivity: LaughSensitivity; promptImpulse: number }) => {
      aiLaughCtxRef.current.isPlaying = ctx.isPlaying;
      aiLaughCtxRef.current.sensitivity = ctx.sensitivity;
      if (ctx.promptImpulse > 0) {
        aiLaughCtxRef.current.pendingImpulse += ctx.promptImpulse;
      }
    },
    [],
  );

  const handleAiResetRound = useCallback(() => {
    aiMemoryRef.current = resetAiForLaughRound(aiMemoryRef.current);
  }, []);

  const handleStateForAiChange = useCallback((st: FunambulesState) => {
    aiFunambulesStateRef.current = st;
  }, []);

  const handleVideoRef = useCallback((el: HTMLVideoElement | null) => {
    localVideoElRef.current = el;
  }, []);

  const handleManualSmileChange = useCallback((active: boolean) => {
    manualSmileActiveRef.current = active;
  }, []);

  const handleManualTiltChange = useCallback((tiltRad: number) => {
    manualTiltRadRef.current = tiltRad;
  }, []);

  const handleMatchProgress = useCallback(() => {
    setLaughMatchCount((c) => c + 1);
  }, []);

  const handleUpdateBestStare = useCallback((sec: number) => {
    setStareBestSec((prev) => Math.max(prev, sec));
  }, []);

  const handleUpdateMiamBestScore = useCallback((score: number) => {
    setMiamBestScore((prev) => Math.max(prev, score));
  }, []);

  const handleUpdateBestDistance = useCallback((m: number) => {
    setFunambulesBestM((prev) => Math.max(prev, Math.round(m)));
  }, []);

  const handleUpdateNinjaBestScore = useCallback((score: number) => {
    setNinjaBestScore((prev) => Math.max(prev, score));
  }, []);

  const handleRecordAirHockeyVictory = useCallback(() => {
    setAirHockeyWins((w) => w + 1);
  }, []);

  const handleUpdateKissBestRally = useCallback((rally: number) => {
    setKissBestRally((prev) => Math.max(prev, rally));
  }, []);

  const handleConstellationCompleted = useCallback((count: number) => {
    setConstellationsCompleted((prev) => Math.max(prev, count));
  }, []);

  const handleLocalPointerHandChange = useCallback((normX: number, normY: number, active: boolean) => {
    localPointerHandRef.current = { normX, normY, active };
  }, []);

  const persistentTrackerVideo = (
    <video
      ref={trackerVideoElRef}
      data-testid="mediapipe-tracker-video"
      muted
      playsInline
      autoPlay
      aria-hidden="true"
      className="fixed top-0 left-0 w-32 h-24 opacity-[0.001] pointer-events-none -z-50"
    />
  );

  if (screen === 'lobby') {
    return (
      <MotionConfig reducedMotion="user">
        {persistentTrackerVideo}
        <motion.div
          key="lobby-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <LobbyView
            playerName={playerName}
            onPlayerNameChange={setPlayerName}
            roomCode={roomCode}
            initialJoinCode={initialJoinCode}
            connectionStatus={connectionStatus}
            statusMessage={statusMessage}
            cameraHint={cameraHint}
            onCreateRoom={handleCreateRoom}
            onCancelRoom={handleCancelRoom}
            onJoinRoom={handleJoinRoom}
            onStartSoloMode={() => handleStartSoloMode('hub')}
          />
        </motion.div>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      {persistentTrackerVideo}
      <div className="min-h-screen flex flex-col bg-[#0D0F17] text-[#F6F2E9]">
        <SessionToolbar
          screen={screen}
          connectionMode={connectionMode}
          roomCode={roomCode}
          micMuted={micMuted}
          cameraEnabled={cameraEnabled}
          hasPhysicalCamera={Boolean(localStream)}
          sfxMuted={sfxMuted}
          onToggleMic={handleToggleMic}
          onToggleCamera={handleToggleCamera}
          onToggleSfx={handleToggleSfx}
          onReturnToHub={handleReturnToHub}
          onLeaveRoom={handleLeaveRoom}
        />

        <AnimatePresence mode="wait" initial={false}>
          {screen === 'hub' && (
            <motion.div
              key="hub-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col"
            >
              <HubView
                localName={playerName}
                partnerName={partnerName}
                connectionMode={connectionMode}
                localStream={localStream}
                remoteStream={remoteStream}
                cameraEnabled={cameraEnabled}
                micMuted={micMuted}
                trackerStatus={trackerStatus}
                localMetricsRef={localMetricsRef}
                partnerMetricsRef={partnerMetricsRef}
                laughMatchCount={laughMatchCount}
                stareBestSec={stareBestSec}
                miamBestScore={miamBestScore}
                funambulesBestM={funambulesBestM}
                ninjaBestScore={ninjaBestScore}
                airHockeyWins={airHockeyWins}
                kissBestRally={kissBestRally}
                constellationsCompleted={constellationsCompleted}
                onVideoRef={handleVideoRef}
                onRequestCamera={requestLocalMedia}
                onSelectGame={handleSelectGame}
              />
            </motion.div>
          )}

          {screen === 'laugh' && (
            <motion.div
              key="laugh-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col"
            >
              <LaughGameView
                localName={playerName}
                partnerName={partnerName}
                connectionMode={connectionMode}
                localStream={localStream}
                remoteStream={remoteStream}
                cameraEnabled={cameraEnabled}
                micMuted={micMuted}
                trackerStatus={trackerStatus}
                localMetricsRef={localMetricsRef}
                partnerMetricsRef={partnerMetricsRef}
                onVideoRef={handleVideoRef}
                onRequestCamera={requestLocalMedia}
                onSendPeerMessage={handleSendPeerMessage}
                registerPeerHandler={registerPeerHandler}
                onAiContextChange={handleAiLaughContextChange}
                onAiResetRound={handleAiResetRound}
                onMatchProgress={handleMatchProgress}
                onReturnToHub={handleReturnToHub}
                onManualSmileChange={handleManualSmileChange}
              />
            </motion.div>
          )}

          {screen === 'funambules' && (
            <motion.div
              key="funambules-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col"
            >
              <FunambulesGameView
                localName={playerName}
                partnerName={partnerName}
                connectionMode={connectionMode}
                localStream={localStream}
                remoteStream={remoteStream}
                cameraEnabled={cameraEnabled}
                micMuted={micMuted}
                trackerStatus={trackerStatus}
                localMetricsRef={localMetricsRef}
                partnerMetricsRef={partnerMetricsRef}
                funambulesBestM={funambulesBestM}
                onUpdateBestDistance={handleUpdateBestDistance}
                onVideoRef={handleVideoRef}
                onRequestCamera={requestLocalMedia}
                onSendPeerMessage={handleSendPeerMessage}
                onSendPeerRealtime={handleSendPeerRealtime}
                registerPeerHandler={registerPeerHandler}
                onStateForAiChange={handleStateForAiChange}
                onReturnToHub={handleReturnToHub}
                onManualTiltChange={handleManualTiltChange}
              />
            </motion.div>
          )}

          {screen === 'ninja-fruits' && (
            <motion.div
              key="ninja-fruits-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col"
            >
              <NinjaFruitsGameView
                localName={playerName}
                partnerName={partnerName}
                connectionMode={connectionMode}
                localStream={localStream}
                remoteStream={remoteStream}
                cameraEnabled={cameraEnabled}
                micMuted={micMuted}
                handTrackerStatus={handTrackerStatus}
                localFaceMetricsRef={localMetricsRef}
                partnerFaceMetricsRef={partnerMetricsRef}
                localHandMetricsRef={localHandMetricsRef}
                partnerHandMetricsRef={partnerHandMetricsRef}
                bestScore={ninjaBestScore}
                onUpdateBestScore={handleUpdateNinjaBestScore}
                onVideoRef={handleVideoRef}
                onRequestCamera={requestLocalMedia}
                onSendPeerMessage={handleSendPeerMessage}
                onSendPeerRealtime={handleSendPeerRealtime}
                registerPeerHandler={registerPeerHandler}
                onLocalPointerHandChange={handleLocalPointerHandChange}
                onReturnToHub={handleReturnToHub}
              />
            </motion.div>
          )}

          {screen === 'air-hockey' && (
            <motion.div
              key="air-hockey-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col"
            >
              <AirHockeyGameView
                localName={playerName}
                partnerName={partnerName}
                connectionMode={connectionMode}
                localStream={localStream}
                remoteStream={remoteStream}
                cameraEnabled={cameraEnabled}
                micMuted={micMuted}
                handTrackerStatus={handTrackerStatus}
                localFaceMetricsRef={localMetricsRef}
                partnerFaceMetricsRef={partnerMetricsRef}
                localHandMetricsRef={localHandMetricsRef}
                partnerHandMetricsRef={partnerHandMetricsRef}
                onRecordVictory={handleRecordAirHockeyVictory}
                onVideoRef={handleVideoRef}
                onRequestCamera={requestLocalMedia}
                onSendPeerMessage={handleSendPeerMessage}
                onSendPeerRealtime={handleSendPeerRealtime}
                registerPeerHandler={registerPeerHandler}
                onLocalPointerHandChange={handleLocalPointerHandChange}
                onReturnToHub={handleReturnToHub}
              />
            </motion.div>
          )}

          {screen === 'stare-duel' && (
            <motion.div
              key="stare-duel-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col"
            >
              <StareDuelGameView
                localName={playerName}
                partnerName={partnerName}
                connectionMode={connectionMode}
                localStream={localStream}
                remoteStream={remoteStream}
                cameraEnabled={cameraEnabled}
                micMuted={micMuted}
                trackerStatus={trackerStatus}
                localMetricsRef={localMetricsRef}
                partnerMetricsRef={partnerMetricsRef}
                bestStareSec={stareBestSec}
                onUpdateBestStare={handleUpdateBestStare}
                onVideoRef={handleVideoRef}
                onRequestCamera={requestLocalMedia}
                onSendPeerMessage={handleSendPeerMessage}
                registerPeerHandler={registerPeerHandler}
                onReturnToHub={handleReturnToHub}
              />
            </motion.div>
          )}

          {screen === 'miam-mania' && (
            <motion.div
              key="miam-mania-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col"
            >
              <MiamManiaGameView
                localName={playerName}
                partnerName={partnerName}
                connectionMode={connectionMode}
                localStream={localStream}
                remoteStream={remoteStream}
                cameraEnabled={cameraEnabled}
                micMuted={micMuted}
                trackerStatus={trackerStatus}
                localMetricsRef={localMetricsRef}
                partnerMetricsRef={partnerMetricsRef}
                bestScore={miamBestScore}
                onUpdateBestScore={handleUpdateMiamBestScore}
                onVideoRef={handleVideoRef}
                onRequestCamera={requestLocalMedia}
                onSendPeerMessage={handleSendPeerMessage}
                onSendPeerRealtime={handleSendPeerRealtime}
                registerPeerHandler={registerPeerHandler}
                onReturnToHub={handleReturnToHub}
              />
            </motion.div>
          )}

          {screen === 'kiss-bounce' && (
            <motion.div
              key="kiss-bounce-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col"
            >
              <KissBounceGameView
                localName={playerName}
                partnerName={partnerName}
                connectionMode={connectionMode}
                localStream={localStream}
                remoteStream={remoteStream}
                cameraEnabled={cameraEnabled}
                micMuted={micMuted}
                faceTrackerStatus={trackerStatus}
                handTrackerStatus={handTrackerStatus}
                localFaceMetricsRef={localMetricsRef}
                partnerFaceMetricsRef={partnerMetricsRef}
                localHandMetricsRef={localHandMetricsRef}
                partnerHandMetricsRef={partnerHandMetricsRef}
                bestRally={kissBestRally}
                onUpdateBestRally={handleUpdateKissBestRally}
                onVideoRef={handleVideoRef}
                onRequestCamera={requestLocalMedia}
                onSendPeerMessage={handleSendPeerMessage}
                registerPeerHandler={registerPeerHandler}
                onLocalPointerHandChange={handleLocalPointerHandChange}
                onReturnToHub={handleReturnToHub}
              />
            </motion.div>
          )}

          {screen === 'constellations' && (
            <motion.div
              key="constellations-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col"
            >
              <ConstellationsGameView
                localName={playerName}
                partnerName={partnerName}
                connectionMode={connectionMode}
                localStream={localStream}
                remoteStream={remoteStream}
                cameraEnabled={cameraEnabled}
                micMuted={micMuted}
                handTrackerStatus={handTrackerStatus}
                localFaceMetricsRef={localMetricsRef}
                partnerFaceMetricsRef={partnerMetricsRef}
                localHandMetricsRef={localHandMetricsRef}
                partnerHandMetricsRef={partnerHandMetricsRef}
                completedConstellations={constellationsCompleted}
                onConstellationCompleted={handleConstellationCompleted}
                onVideoRef={handleVideoRef}
                onRequestCamera={requestLocalMedia}
                onSendPeerMessage={handleSendPeerMessage}
                registerPeerHandler={registerPeerHandler}
                onLocalPointerHandChange={handleLocalPointerHandChange}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
