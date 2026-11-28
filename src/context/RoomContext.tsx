import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  ConnectionMode,
  ConnectionStatus,
  ParchisiDiceCount,
  PeerMessage,
  ScreenView,
} from '../types/duoplay';
import {
  FirestoreRoomService,
  type HostRoomStateSnapshot,
} from '../services/firestoreRoomService';
import { generateRoomCode, normalizeRoomCode } from '../utils/roomCode';

export interface RoomContextValue {
  // Core compatible interface
  sendData: (msg: PeerMessage) => void;
  sendRealtime: (msg: PeerMessage) => void;
  onData: (handler: (msg: PeerMessage) => void) => () => void;
  isConnected: boolean;
  isHost: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;

  // Session state & media controls
  connectionMode: ConnectionMode;
  connectionStatus: ConnectionStatus;
  statusMessage: string;
  roomCode: string;
  partnerName: string;
  cameraEnabled: boolean;
  micMuted: boolean;
  cameraHint: string | null;

  // Lifecycle & media actions
  createRoom: (hostName: string) => string;
  joinRoom: (code: string, guestName: string) => void;
  cancelRoom: () => void;
  leaveRoom: () => void;
  startSoloMode: () => void;
  requestLocalMedia: () => Promise<MediaStream | null>;
  toggleMic: () => void;
  toggleCamera: () => void;
  syncRoomMetadata: (patch: {
    currentGame?: ScreenView;
    scores?: Record<string, number>;
    diceCount?: ParchisiDiceCount;
  }) => void;
  setPartnerName: (name: string) => void;
  setHostStateProvider: (provider: (() => HostRoomStateSnapshot) | null) => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ children }: { children: ReactNode }) {
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('idle');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [partnerName, setPartnerName] = useState<string>('Camille IA');

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micMuted, setMicMuted] = useState<boolean>(false);
  const [cameraEnabled, setCameraEnabled] = useState<boolean>(true);
  const [cameraHint, setCameraHint] = useState<string | null>(null);

  const serviceRef = useRef<FirestoreRoomService | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaRequestPromiseRef = useRef<Promise<MediaStream | null> | null>(null);
  const connectionModeRef = useRef<ConnectionMode>(connectionMode);
  connectionModeRef.current = connectionMode;

  const dataSubscribersRef = useRef<Set<(msg: PeerMessage) => void>>(new Set());
  const hostStateProviderRef = useRef<(() => HostRoomStateSnapshot) | null>(null);

  const ensureService = useCallback((): FirestoreRoomService => {
    if (!serviceRef.current) {
      serviceRef.current = new FirestoreRoomService({
        getHostRoomState: () => hostStateProviderRef.current?.() ?? { currentGame: 'hub', scores: {} },
        onStatusChange: (status, message) => {
          setConnectionStatus(status);
          if (message !== undefined) {
            setStatusMessage(message);
          } else if (status === 'connected') {
            setStatusMessage('');
          }
          if (
            (status === 'disconnected' || status === 'error') &&
            connectionModeRef.current !== 'solo'
          ) {
            setConnectionMode('idle');
            setRemoteStream(null);
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
          } else if (
            msg.type === 'JOIN_ACCEPTED' ||
            msg.type === 'JOIN_CONFIRMED' ||
            msg.type === 'JOIN_WELCOME'
          ) {
            setPartnerName(msg.hostName || 'Hôte');
          }
          for (const listener of dataSubscribersRef.current) {
            try {
              listener(msg);
            } catch (err) {
              console.warn('[CoupleCam RoomContext] Subscriber error:', err);
            }
          }
        },
      });
    }
    return serviceRef.current;
  }, []);

  const requestLocalMedia = useCallback(async (): Promise<MediaStream | null> => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = true;
      });
      setCameraEnabled(true);
      serviceRef.current?.setLocalStream(localStreamRef.current);
      return localStreamRef.current;
    }
    if (mediaRequestPromiseRef.current) return mediaRequestPromiseRef.current;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraHint('Aucune webcam détectée — le mode clavier / boutons reste 100 % jouable.');
      return null;
    }

    const req = (async (): Promise<MediaStream | null> => {
      try {
        // 1. Full webcam + mic with echo cancellation
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
        setCameraEnabled(true);
        setCameraHint(null);
        serviceRef.current?.setLocalStream(stream);
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
          setCameraEnabled(true);
          setCameraHint('Micro indisponible — webcam activée sans son.');
          serviceRef.current?.setLocalStream(videoOnlyStream);
          return videoOnlyStream;
        } catch {
          // 3. Relaxed video constraint fallback
          try {
            const basicVideo = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
            localStreamRef.current = basicVideo;
            setLocalStream(basicVideo);
            setCameraEnabled(true);
            setCameraHint('Micro indisponible — webcam activée sans son.');
            serviceRef.current?.setLocalStream(basicVideo);
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

  const createRoom = useCallback(
    (hostName: string): string => {
      const cleanCode = normalizeRoomCode(generateRoomCode());
      setRoomCode(cleanCode);
      setConnectionMode('p2p-host');
      setPartnerName('Partenaire');
      setStatusMessage('');

      // Create Firestore room immediately — never block entry on webcam/mic permission
      const svc = ensureService();
      void svc.createHostRoom(cleanCode, hostName, localStreamRef.current);
      void requestLocalMedia();
      return cleanCode;
    },
    [ensureService, requestLocalMedia],
  );

  const joinRoom = useCallback(
    (code: string, guestName: string): void => {
      const cleanCode = normalizeRoomCode(code);
      setRoomCode(cleanCode);
      setConnectionMode('p2p-guest');
      setPartnerName('Hôte');
      setStatusMessage('');

      // Enter Firestore room in < 1s without waiting for camera
      const svc = ensureService();
      void svc.joinGuestRoom(cleanCode, guestName, localStreamRef.current);
      void requestLocalMedia();
    },
    [ensureService, requestLocalMedia],
  );

  const cancelRoom = useCallback((): void => {
    const shouldClose = connectionModeRef.current === 'p2p-host';
    serviceRef.current?.destroy({ closeRemoteDoc: shouldClose });
    setRemoteStream(null);
    setConnectionMode('idle');
    setConnectionStatus('disconnected');
    setStatusMessage('');
    setRoomCode('');
  }, []);

  const leaveRoom = useCallback((): void => {
    const shouldClose =
      connectionModeRef.current === 'p2p-host' || connectionModeRef.current === 'p2p-guest';
    serviceRef.current?.destroy({ closeRemoteDoc: shouldClose });
    setRemoteStream(null);
    setConnectionMode('idle');
    setConnectionStatus('disconnected');
    setStatusMessage('');
    setRoomCode('');
  }, []);

  const startSoloMode = useCallback((): void => {
    const shouldClose =
      connectionModeRef.current === 'p2p-host' || connectionModeRef.current === 'p2p-guest';
    serviceRef.current?.destroy({ closeRemoteDoc: shouldClose });
    setRemoteStream(null);
    setPartnerName('Camille IA');
    setConnectionMode('solo');
    setConnectionStatus('connected');
    setStatusMessage('');
    setRoomCode('SOLO');
    // Request camera non-blockingly so Solo AI opens instantaneously
    void requestLocalMedia();
  }, [requestLocalMedia]);

  const toggleMic = useCallback((): void => {
    setMicMuted((prev) => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
      return next;
    });
  }, []);

  const toggleCamera = useCallback((): void => {
    setCameraEnabled((prev) => {
      const next = !prev;
      localStreamRef.current?.getVideoTracks().forEach((track) => {
        track.enabled = next;
      });
      return next;
    });
  }, []);

  const sendData = useCallback((msg: PeerMessage): void => {
    serviceRef.current?.sendData(msg);
  }, []);

  const sendRealtime = useCallback((msg: PeerMessage): void => {
    serviceRef.current?.sendRealtime(msg);
  }, []);

  const onData = useCallback((handler: (msg: PeerMessage) => void): (() => void) => {
    dataSubscribersRef.current.add(handler);
    return () => {
      dataSubscribersRef.current.delete(handler);
    };
  }, []);

  const syncRoomMetadata = useCallback(
    (patch: {
      currentGame?: ScreenView;
      scores?: Record<string, number>;
      diceCount?: ParchisiDiceCount;
    }) => {
      serviceRef.current?.syncRoomMetadata(patch);
    },
    [],
  );

  const setHostStateProvider = useCallback(
    (provider: (() => HostRoomStateSnapshot) | null) => {
      hostStateProviderRef.current = provider;
    },
    [],
  );

  // Stop local media tracks only when stream swaps or app unmounts
  useEffect(() => {
    return () => {
      localStream?.getTracks().forEach((t) => t.stop());
    };
  }, [localStream]);

  // Cleanly close Firestore listeners & RTCPeerConnection on full app unmount
  useEffect(() => {
    return () => {
      serviceRef.current?.destroy({ closeRemoteDoc: false });
    };
  }, []);

  const isConnected = connectionStatus === 'connected';
  const isHost = connectionMode === 'p2p-host';

  const value = useMemo<RoomContextValue>(
    () => ({
      sendData,
      sendRealtime,
      onData,
      isConnected,
      isHost,
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
      toggleMic,
      toggleCamera,
      syncRoomMetadata,
      setPartnerName,
      setHostStateProvider,
    }),
    [
      sendData,
      sendRealtime,
      onData,
      isConnected,
      isHost,
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
      toggleMic,
      toggleCamera,
      syncRoomMetadata,
      setHostStateProvider,
    ],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return ctx;
}
