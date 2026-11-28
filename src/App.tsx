import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import type {
  ConnectionMode,
  FaceMetrics,
  FunambulesState,
  GameId,
  HandMetrics,
  HubCategory,
  LaughSensitivity,
  PeerMessage,
  ScreenView,
  TrackerStatus,
} from './types/duoplay';
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
import { CATEGORY_THEMES } from './theme/categoryThemes';
import { LobbyView } from './components/LobbyView';
import { SessionToolbar } from './components/SessionToolbar';
import { HubView, type HubFloatingReaction } from './components/HubView';
import { LaughGameView } from './components/LaughGameView';
import { FunambulesGameView } from './components/FunambulesGameView';
import { NinjaFruitsGameView } from './components/NinjaFruitsGameView';
import { AirHockeyGameView } from './components/AirHockeyGameView';
import { StareDuelGameView } from './components/StareDuelGameView';
import { MiamManiaGameView } from './components/MiamManiaGameView';
import { WhisperSecretsGameView } from './components/WhisperSecretsGameView';
import { SlingshotDuoGameView } from './components/SlingshotDuoGameView';
import { XoNeonGameView } from './components/XoNeonGameView';
import { ParchisiDuoGameView } from './components/ParchisiDuoGameView';
import { MusicQuizGameView } from './components/MusicQuizGameView';
import { FreezeDanceGameView } from './components/FreezeDanceGameView';
import { ToastStack, type AppToast } from './components/ToastStack';
import { MediaPipeLoadingOverlay } from './components/MediaPipeLoadingOverlay';
import { LanguageProvider, useI18n } from './i18n/LanguageContext';
import { MirrorProvider } from './context/MirrorContext';
import { RoomProvider, useRoom } from './context/RoomContext';

export default function App() {
  return (
    <LanguageProvider>
      <MirrorProvider>
        <RoomProvider>
          <CoupleCamApp />
        </RoomProvider>
      </MirrorProvider>
    </LanguageProvider>
  );
}

function CoupleCamApp() {
  const { t } = useI18n();
  const {
    sendData,
    sendRealtime,
    onData,
    localStream,
    remoteStream,
    connectionMode,
    connectionStatus,
    statusMessage,
    roomCode,
    partnerName,
    cameraEnabled,
    micMuted,
    cameraHint,
    createRoom,
    joinRoom,
    cancelRoom,
    leaveRoom,
    startSoloMode,
    requestLocalMedia,
    toggleMic: handleToggleMic,
    toggleCamera: handleToggleCamera,
    setHostStateProvider,
  } = useRoom();

  const [screen, setScreen] = useState<ScreenView>('lobby');
  const [activeHubCategory, setActiveHubCategory] = useState<HubCategory>('all');
  const [toasts, setToasts] = useState<AppToast[]>([]);
  const [hubReactions, setHubReactions] = useState<HubFloatingReaction[]>([]);
  const [playerName, setPlayerName] = useState<string>('Alex');
  const [initialJoinCode] = useState<string>(() =>
    typeof window !== 'undefined' ? extractRoomCodeFromSearch(window.location.search) : '',
  );

  // Audio SFX & MediaPipe tracking status
  const [sfxMuted, setSfxMuted] = useState(false);
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus>('idle');
  const [handTrackerStatus, setHandTrackerStatus] = useState<TrackerStatus>('idle');

  const pushToast = useCallback((message: string, tone: AppToast['tone'] = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 2800);
  }, []);
  const spawnHubReaction = useCallback((emoji: '❤️' | '😂' | '🔥') => {
    const id = Date.now() + Math.floor(Math.random() * 10000);
    const offsetX = Math.round((Math.random() - 0.5) * 140);
    setHubReactions((prev) => [...prev.slice(-8), { id, emoji, offsetX }]);
    window.setTimeout(() => {
      setHubReactions((prev) => prev.filter((item) => item.id !== id));
    }, 1250);
  }, []);
  const toastConnectedTextRef = useRef(t.toastPartnerConnected);
  toastConnectedTextRef.current = t.toastPartnerConnected;

  // Session counters
  const [laughMatchCount, setLaughMatchCount] = useState(0);
  const [stareBestSec, setStareBestSec] = useState(0);
  const [miamBestScore, setMiamBestScore] = useState(0);
  const [funambulesBestM, setFunambulesBestM] = useState(0);
  const [ninjaBestScore, setNinjaBestScore] = useState(0);
  const [airHockeyWins, setAirHockeyWins] = useState(0);
  const [whisperBestHeat, setWhisperBestHeat] = useState(16);
  const [slingshotBestScore, setSlingshotBestScore] = useState(0);
  const [xoNeonWins, setXoNeonWins] = useState(0);
  const [parchisiWins, setParchisiWins] = useState(0);
  const [musicQuizBestScore, setMusicQuizBestScore] = useState(0);
  const [freezeDanceWins, setFreezeDanceWins] = useState(0);
  const [parchisiHandDiceEnabled, setParchisiHandDiceEnabled] = useState(false);
  const parchisiHandDiceEnabledRef = useRef(false);
  parchisiHandDiceEnabledRef.current = parchisiHandDiceEnabled;

  const hostScoresRef = useRef<Record<string, number>>({});
  hostScoresRef.current = {
    laugh: laughMatchCount,
    stareBestSec,
    miamBestScore,
    funambulesBestM,
    ninjaBestScore,
    airHockeyWins,
    whisperBestHeat,
    slingshotBestScore,
    xoNeonWins,
    parchisiWins,
    musicQuizBestScore,
    freezeDanceWins,
  };

  // Refs shared across 60fps loops without triggering React re-renders
  const trackerVideoElRef = useRef<HTMLVideoElement | null>(null);
  const localVideoElRef = useRef<HTMLVideoElement | null>(null);
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
  const faceTrackerRef = useRef<DuoFaceTracker | null>(null);
  const handTrackerRef = useRef<DuoHandTracker | null>(null);
  const activeGamePeerHandlerRef = useRef<((msg: PeerMessage) => void) | null>(null);
  const pendingGameMessagesRef = useRef<PeerMessage[]>([]);
  const sendRealtimeRef = useRef(sendRealtime);
  sendRealtimeRef.current = sendRealtime;

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

  // Lazy-load MediaPipe FaceLandmarker when on Hub or face-tracked games
  useEffect(() => {
    if (
      screen === 'lobby' ||
      screen === 'ninja-fruits' ||
      screen === 'air-hockey' ||
      screen === 'slingshot-duo' ||
      screen === 'xo-neon' ||
      screen === 'parchisi-duo' ||
      screen === 'music-quiz'
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

  // Strict lazy-load of MediaPipe HandLandmarker ONLY when a hand-tracked game is opened,
  // and cleanly release the tracker whenever leaving hand-tracked games (e.g. "← Changer de jeu").
  useEffect(() => {
    const isHandGame =
      screen === 'ninja-fruits' ||
      screen === 'air-hockey' ||
      screen === 'slingshot-duo' ||
      screen === 'xo-neon' ||
      (screen === 'parchisi-duo' && parchisiHandDiceEnabled);

    if (!isHandGame) {
      if (handTrackerRef.current) {
        handTrackerRef.current.dispose();
        handTrackerRef.current = null;
      }
      localHandMetricsRef.current = { ...EMPTY_HAND_METRICS };
      setHandTrackerStatus('idle');
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
  }, [screen, localStream, parchisiHandDiceEnabled]);

  // Cleanup MediaPipe trackers on unmount
  useEffect(() => {
    return () => {
      faceTrackerRef.current?.dispose();
      handTrackerRef.current?.dispose();
    };
  }, []);

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
        activeScreen === 'slingshot-duo' ||
        activeScreen === 'xo-neon' ||
        (activeScreen === 'parchisi-duo' && parchisiHandDiceEnabledRef.current);
      const needsFace =
        activeScreen !== 'ninja-fruits' &&
        activeScreen !== 'air-hockey' &&
        activeScreen !== 'slingshot-duo' &&
        activeScreen !== 'xo-neon' &&
        activeScreen !== 'parchisi-duo' &&
        activeScreen !== 'music-quiz';

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
              isPinching: false,
              pinchRatio: 1,
              handDetected: false,
              timestamp: now,
            };
          }
        } else if (handDetection.kind === 'not-ready') {
          localHandMetricsRef.current = {
            ...localHandMetricsRef.current,
            isPinching: false,
            pinchRatio: 1,
            handDetected: false,
            timestamp: now,
          };
        }

        // Broadcast lightweight hand coordinates (≤30fps) for games using HAND_FRAME
        if (
          (connectionModeRef.current === 'p2p-host' || connectionModeRef.current === 'p2p-guest') &&
          activeScreen !== 'slingshot-duo' &&
          activeScreen !== 'xo-neon' &&
          activeScreen !== 'parchisi-duo'
        ) {
          const hm = localHandMetricsRef.current;
          const ptr = localPointerHandRef.current;
          const activeGame = activeScreen as 'ninja-fruits' | 'air-hockey';
          const useCam = hm.handDetected;
          const useIndex = activeGame === 'ninja-fruits';
          const tx = useCam ? (useIndex ? hm.indexX : hm.palmX) : ptr.normX;
          const ty = useCam ? (useIndex ? hm.indexY : hm.palmY) : ptr.normY;
          sendRealtimeRef.current({
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

        // 2. Broadcast face metrics at 30fps when in P2P mode
        if (connectionModeRef.current === 'p2p-host' || connectionModeRef.current === 'p2p-guest') {
          const m = localMetricsRef.current;
          sendRealtimeRef.current({
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

  // Supply current room snapshot (active game & scores) to RoomContext when Host creates a room
  useEffect(() => {
    setHostStateProvider(() => ({
      currentGame: screenRef.current === 'lobby' ? 'hub' : screenRef.current,
      scores: { ...hostScoresRef.current },
    }));
    return () => setHostStateProvider(null);
  }, [setHostStateProvider]);

  // React to Duo Firestore room connection & disconnect transitions
  const prevConnectionStatusRef = useRef(connectionStatus);
  useEffect(() => {
    const prev = prevConnectionStatusRef.current;
    prevConnectionStatusRef.current = connectionStatus;

    if (connectionMode === 'solo') return;

    if (connectionStatus === 'connected' && prev !== 'connected') {
      if (screenRef.current === 'lobby') {
        setScreen('hub');
      }
      soundFx.roundWin();
      pushToast(toastConnectedTextRef.current, 'success');
    } else if (
      (connectionStatus === 'disconnected' || connectionStatus === 'error') &&
      prev !== connectionStatus &&
      screenRef.current !== 'lobby'
    ) {
      setScreen('lobby');
    }
  }, [connectionStatus, connectionMode, pushToast]);

  // Subscribe to all incoming Cloud Firestore / WebRTC messages across Hub & all 12 games
  useEffect(() => {
    return onData((msg) => {
      if (msg.type === 'HELLO') {
        // Partner name already synced in RoomContext
      } else if (
        msg.type === 'JOIN_ACCEPTED' ||
        msg.type === 'JOIN_CONFIRMED' ||
        msg.type === 'JOIN_WELCOME'
      ) {
        if (
          msg.type === 'JOIN_ACCEPTED' &&
          msg.currentGame &&
          msg.currentGame !== 'lobby' &&
          msg.currentGame !== 'hub'
        ) {
          pendingGameMessagesRef.current = [];
          setScreen(msg.currentGame);
        }
      } else if (msg.type === 'SELECT_GAME') {
        soundFx.click();
        pendingGameMessagesRef.current = [];
        setScreen(msg.game);
      } else if (msg.type === 'RETURN_HUB') {
        soundFx.click();
        pendingGameMessagesRef.current = [];
        setScreen('hub');
      } else if (msg.type === 'HUB_REACTION') {
        spawnHubReaction(msg.emoji);
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
        const isIndexGame = msg.game === 'ninja-fruits';
        const isPalmGame = msg.game === 'air-hockey';
        partnerHandMetricsRef.current = {
          ...prev,
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
    });
  }, [onData, spawnHubReaction]);

  const handleCreateRoom = useCallback(() => {
    const cleanName = playerName.trim() || 'Hôte';
    setPlayerName(cleanName);
    createRoom(cleanName);
  }, [playerName, createRoom]);

  const handleCancelRoom = useCallback(() => {
    cancelRoom();
  }, [cancelRoom]);

  const handleJoinRoom = useCallback(
    (code: string) => {
      const cleanName = playerName.trim() || 'Invité';
      setPlayerName(cleanName);
      joinRoom(code, cleanName);
    },
    [playerName, joinRoom],
  );

  const handleStartSoloMode = useCallback(
    (targetScreen: ScreenView = 'hub') => {
      const cleanName = playerName.trim() || 'Alex';
      setPlayerName(cleanName);
      startSoloMode();
      setScreen(targetScreen);
      soundFx.click();
      if (targetScreen === 'hub') {
        pushToast(t.toastSoloStarted, 'accent');
      }
    },
    [playerName, pushToast, startSoloMode, t.toastSoloStarted],
  );

  // Support ?autostart=1|hub|laugh|stare-duel|miam-mania|funambules|ninja-fruits|air-hockey|whisper-secrets|slingshot-duo|xo-neon|parchisi-duo|music-quiz|freeze-dance
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
      auto === 'whisper-secrets' ||
      auto === 'slingshot-duo' ||
      auto === 'xo-neon' ||
      auto === 'parchisi-duo' ||
      auto === 'music-quiz' ||
      auto === 'freeze-dance'
    ) {
      handleStartSoloMode(auto);
    } else if (initialJoinCode.length === 4) {
      // Direct invite link (?room=XXXX): pre-fill code and launch room connection automatically
      handleJoinRoom(initialJoinCode);
    }
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectGame = useCallback(
    (game: GameId) => {
      soundFx.click();
      setScreen(game);
      sendData({ type: 'SELECT_GAME', game });
    },
    [sendData],
  );

  const handleReturnToHub = useCallback(() => {
    soundFx.click();
    setParchisiHandDiceEnabled(false);
    setScreen('hub');
    sendData({ type: 'RETURN_HUB' });
  }, [sendData]);

  const handleSendHubReaction = useCallback(
    (emoji: '❤️' | '😂' | '🔥') => {
      soundFx.click();
      spawnHubReaction(emoji);
      sendData({ type: 'HUB_REACTION', emoji });
    },
    [spawnHubReaction, sendData],
  );

  const handleLeaveRoom = useCallback(() => {
    soundFx.click();
    leaveRoom();
    setScreen('lobby');
  }, [leaveRoom]);

  const handleToggleSfx = useCallback(() => {
    setSfxMuted((prev) => {
      const next = !prev;
      soundFx.muted = next;
      return next;
    });
  }, []);

  const handleSendPeerMessage = useCallback(
    (msg: PeerMessage) => {
      sendData(msg);
    },
    [sendData],
  );

  const handleSendPeerRealtime = useCallback(
    (msg: PeerMessage) => {
      sendRealtime(msg);
    },
    [sendRealtime],
  );

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

  const handleUpdateWhisperBestHeat = useCallback((heat: number) => {
    setWhisperBestHeat((prev) => Math.max(prev, heat));
  }, []);

  const handleUpdateSlingshotBestScore = useCallback((score: number) => {
    setSlingshotBestScore((prev) => Math.max(prev, score));
  }, []);

  const handleRecordXoVictory = useCallback(() => {
    setXoNeonWins((w) => w + 1);
  }, []);

  const handleRecordParchisiVictory = useCallback(() => {
    setParchisiWins((w) => w + 1);
  }, []);

  const handleRecordMusicQuizScore = useCallback((score: number) => {
    setMusicQuizBestScore((prev) => Math.max(prev, score));
  }, []);

  const handleRecordFreezeDanceVictory = useCallback(() => {
    setFreezeDanceWins((w) => w + 1);
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

  const isGameScreen = screen !== 'lobby' && screen !== 'hub';
  const isMediaPipeWarming =
    isGameScreen &&
    Boolean(localStream) &&
    (trackerStatus === 'loading' || handTrackerStatus === 'loading');

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
            localStream={localStream}
            cameraEnabled={cameraEnabled}
            micMuted={micMuted}
            sfxMuted={sfxMuted}
            localMetricsRef={localMetricsRef}
            onRequestCamera={requestLocalMedia}
            onToggleMic={handleToggleMic}
            onToggleCamera={handleToggleCamera}
            onToggleSfx={handleToggleSfx}
            onCreateRoom={handleCreateRoom}
            onCancelRoom={handleCancelRoom}
            onJoinRoom={handleJoinRoom}
            onStartSoloMode={() => handleStartSoloMode('hub')}
            onNotify={pushToast}
          />
        </motion.div>
        <ToastStack toasts={toasts} />
      </MotionConfig>
    );
  }

  const activeTheme = CATEGORY_THEMES[activeHubCategory];

  return (
    <MotionConfig reducedMotion="user">
      {persistentTrackerVideo}
      <div
        className={
          screen === 'hub' ||
          screen === 'parchisi-duo' ||
          screen === 'music-quiz' ||
          screen === 'freeze-dance'
            ? 'h-[100dvh] overflow-hidden flex flex-col bg-[#FAF7F2] text-[#1F242D] transition-all duration-300'
            : 'min-h-[100dvh] flex flex-col bg-[#FAF7F2] text-[#1F242D] overflow-x-hidden transition-all duration-300'
        }
        style={{ backgroundColor: activeTheme.pageBg }}
      >
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
          onNotify={pushToast}
        />

        <AnimatePresence mode="wait" initial={false}>
          {screen === 'hub' && (
            <motion.div
              key="hub-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 min-h-0 flex flex-col overflow-hidden"
            >
              <HubView
                activeCategory={activeHubCategory}
                onCategoryChange={setActiveHubCategory}
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
                whisperBestHeat={whisperBestHeat}
                slingshotBestScore={slingshotBestScore}
                xoNeonWins={xoNeonWins}
                parchisiWins={parchisiWins}
                musicQuizBestScore={musicQuizBestScore}
                freezeDanceWins={freezeDanceWins}
                floatingReactions={hubReactions}
                onSendReaction={handleSendHubReaction}
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


          {screen === 'whisper-secrets' && (
            <motion.div
              key="whisper-secrets-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col"
            >
              <WhisperSecretsGameView
                localName={playerName}
                partnerName={partnerName}
                connectionMode={connectionMode}
                localStream={localStream}
                remoteStream={remoteStream}
                cameraEnabled={cameraEnabled}
                micMuted={micMuted}
                sfxMuted={sfxMuted}
                trackerStatus={trackerStatus}
                localMetricsRef={localMetricsRef}
                partnerMetricsRef={partnerMetricsRef}
                onVideoRef={handleVideoRef}
                onRequestCamera={requestLocalMedia}
                onSendPeerMessage={handleSendPeerMessage}
                onSendPeerRealtime={handleSendPeerRealtime}
                registerPeerHandler={registerPeerHandler}
                onUpdateBestHeat={handleUpdateWhisperBestHeat}
              />
            </motion.div>
          )}

          {screen === 'slingshot-duo' && (
            <motion.div
              key="slingshot-duo-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col"
            >
              <SlingshotDuoGameView
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
                bestScore={slingshotBestScore}
                onUpdateBestScore={handleUpdateSlingshotBestScore}
                onVideoRef={handleVideoRef}
                onRequestCamera={requestLocalMedia}
                onSendPeerMessage={handleSendPeerMessage}
                onSendPeerRealtime={handleSendPeerRealtime}
                registerPeerHandler={registerPeerHandler}
                onReturnToHub={handleReturnToHub}
              />
            </motion.div>
          )}

          {screen === 'xo-neon' && (
            <motion.div
              key="xo-neon-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col"
            >
              <XoNeonGameView
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
                onRecordVictory={handleRecordXoVictory}
                onVideoRef={handleVideoRef}
                onRequestCamera={requestLocalMedia}
                onSendPeerMessage={handleSendPeerMessage}
                onSendPeerRealtime={handleSendPeerRealtime}
                registerPeerHandler={registerPeerHandler}
                onReturnToHub={handleReturnToHub}
              />
            </motion.div>
          )}

          {screen === 'parchisi-duo' && (
            <motion.div
              key="parchisi-duo-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 min-h-0 flex flex-col overflow-hidden"
            >
              <ParchisiDuoGameView
                localName={playerName}
                partnerName={partnerName}
                connectionMode={connectionMode}
                localStream={localStream}
                remoteStream={remoteStream}
                cameraEnabled={cameraEnabled}
                micMuted={micMuted}
                handTrackerStatus={handTrackerStatus}
                handDiceEnabled={parchisiHandDiceEnabled}
                onToggleHandDice={setParchisiHandDiceEnabled}
                localFaceMetricsRef={localMetricsRef}
                partnerFaceMetricsRef={partnerMetricsRef}
                localHandMetricsRef={localHandMetricsRef}
                onRecordVictory={handleRecordParchisiVictory}
                onVideoRef={handleVideoRef}
                onRequestCamera={requestLocalMedia}
                onSendPeerMessage={handleSendPeerMessage}
                registerPeerHandler={registerPeerHandler}
                onReturnToHub={handleReturnToHub}
              />
            </motion.div>
          )}

          {screen === 'music-quiz' && (
            <motion.div
              key="music-quiz-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 min-h-0 flex flex-col overflow-hidden"
            >
              <MusicQuizGameView
                localName={playerName}
                partnerName={partnerName}
                connectionMode={connectionMode}
                localStream={localStream}
                remoteStream={remoteStream}
                cameraEnabled={cameraEnabled}
                sfxMuted={sfxMuted}
                localMetricsRef={localMetricsRef}
                partnerMetricsRef={partnerMetricsRef}
                onRecordScore={handleRecordMusicQuizScore}
                onSendPeerMessage={handleSendPeerMessage}
                registerPeerHandler={registerPeerHandler}
                onReturnToHub={handleReturnToHub}
              />
            </motion.div>
          )}

          {screen === 'freeze-dance' && (
            <motion.div
              key="freeze-dance-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 min-h-0 flex flex-col overflow-hidden"
            >
              <FreezeDanceGameView
                localName={playerName}
                partnerName={partnerName}
                connectionMode={connectionMode}
                localStream={localStream}
                remoteStream={remoteStream}
                cameraEnabled={cameraEnabled}
                sfxMuted={sfxMuted}
                localMetricsRef={localMetricsRef}
                partnerMetricsRef={partnerMetricsRef}
                onRecordVictory={handleRecordFreezeDanceVictory}
                onRequestCamera={requestLocalMedia}
                onSendPeerMessage={handleSendPeerMessage}
                registerPeerHandler={registerPeerHandler}
                onReturnToHub={handleReturnToHub}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <MediaPipeLoadingOverlay visible={isMediaPipeWarming} />
        <ToastStack toasts={toasts} />
      </div>
    </MotionConfig>
  );
}
