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
  ActiveGame,
  ConnectionMode,
  ConnectionStatus,
  FloatingQuickReaction,
  MicAccessStatus,
  ParchisiDiceCount,
  PeerMessage,
  QuickReactionEmoji,
  RoomChatMessage,
  RoomRole,
} from '../types/duoplay';
import { FirestoreRoomService } from '../services/firestoreRoomService';
import { generateRoomCode, normalizeRoomCode, sanitizePlayerName } from '../utils/roomCode';
import {
  clearPersistedRoomSession,
  loadPersistedRoomSession,
  savePersistedRoomSession,
} from '../utils/roomSessionStorage';

export interface RoomContextValue {
  // Core room state
  roomCode: string;
  role: RoomRole;
  connectionMode: ConnectionMode;
  connectionStatus: ConnectionStatus;
  statusMessage: string;
  inRoom: boolean;
  isConnected: boolean;
  isHost: boolean;
  isGuest: boolean;
  isAIMode: boolean;
  isRestoringSession: boolean;

  // Players & Host-controlled game state
  playerName: string;
  setPlayerName: (name: string) => void;
  hostName: string;
  guestName: string;
  guestConnected: boolean;
  partnerName: string;
  activeGame: ActiveGame;
  diceCount: ParchisiDiceCount;
  parcheesiWins: number;
  recordParchisiVictory: () => void;

  // Audio-only voice state (ZERO video)
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micMuted: boolean;
  micStatus: MicAccessStatus;
  micHint: string | null;
  hostHasAudio: boolean;
  guestHasAudio: boolean;
  hostMicMuted: boolean;
  guestMicMuted: boolean;
  localSpeaking: boolean;
  remoteSpeaking: boolean;

  // Live Chat & Quick Reactions (persistent across Room Menu <-> Parcheesi)
  chatMessages: RoomChatMessage[];
  unreadChatCount: number;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  floatingReactions: FloatingQuickReaction[];
  sendChatMessage: (text: string) => Promise<void>;
  sendQuickReaction: (emoji: QuickReactionEmoji) => Promise<void>;

  // Room & Game actions
  createRoom: (name?: string) => Promise<string | null>;
  joinRoom: (code: string, name?: string) => Promise<boolean>;
  cancelRoom: () => void;
  leaveRoom: () => void;
  startSoloMode: (name?: string) => void;
  startParcheesi: () => Promise<void>;
  returnToRoomMenu: () => Promise<void>;
  setDiceCount: (count: ParchisiDiceCount) => void;
  requestLocalAudio: () => Promise<MediaStream | null>;
  toggleMic: () => void;

  // Parcheesi event channel
  sendData: (msg: PeerMessage) => void;
  onData: (handler: (msg: PeerMessage) => void) => () => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

const SOLO_AI_REPLIES = [
  'Prête pour une super partie de Parcheesi ! 🎲',
  'Joli coup ! Je surveille mes pions 😄',
  'Bonne chance, que le meilleur gagne ✨',
  'Oh bien joué ! 🔥',
] as const;

function useAudioSpeakingLevel(stream: MediaStream | null, muted: boolean): boolean {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!stream || muted || stream.getAudioTracks().length === 0) {
      setSpeaking(false);
      return;
    }
    const AudioCtx =
      typeof window !== 'undefined'
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!AudioCtx) return;

    let ctx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let timerId: number | null = null;

    try {
      ctx = new AudioCtx();
      source = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      timerId = window.setInterval(() => {
        if (!analyser) return;
        analyser.getByteTimeDomainData(data);
        let sumSq = 0;
        for (let i = 0; i < data.length; i += 1) {
          const norm = (data[i] - 128) / 128;
          sumSq += norm * norm;
        }
        const rms = Math.sqrt(sumSq / data.length);
        setSpeaking(rms > 0.045);
      }, 110);
    } catch {
      setSpeaking(false);
    }

    return () => {
      if (timerId !== null) window.clearInterval(timerId);
      try {
        source?.disconnect();
        analyser?.disconnect();
        void ctx?.close();
      } catch {
        // Ignore AudioContext cleanup errors
      }
      setSpeaking(false);
    };
  }, [stream, muted]);

  return speaking;
}

export function RoomProvider({ children }: { children: ReactNode }) {
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('idle');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [role, setRole] = useState<RoomRole>('host');
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(false);

  const [playerName, setPlayerNameState] = useState<string>('Alex');
  const [hostName, setHostName] = useState<string>('Alex');
  const [guestName, setGuestName] = useState<string>('');
  const [activeGame, setActiveGame] = useState<ActiveGame>(null);
  const [diceCount, setDiceCountState] = useState<ParchisiDiceCount>(2);
  const [parcheesiWins, setParcheesiWins] = useState<number>(0);

  // Audio-only voice state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micMuted, setMicMuted] = useState<boolean>(false);
  const [micStatus, setMicStatus] = useState<MicAccessStatus>('idle');
  const [micHint, setMicHint] = useState<string | null>(null);
  const [hostHasAudio, setHostHasAudio] = useState<boolean>(false);
  const [guestHasAudio, setGuestHasAudio] = useState<boolean>(false);
  const [hostMicMuted, setHostMicMuted] = useState<boolean>(false);
  const [guestMicMuted, setGuestMicMuted] = useState<boolean>(false);

  // Persistent Live Chat & Quick Reactions
  const [chatMessages, setChatMessages] = useState<RoomChatMessage[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [chatOpen, setChatOpenState] = useState<boolean>(false);
  const [floatingReactions, setFloatingReactions] = useState<FloatingQuickReaction[]>([]);

  const serviceRef = useRef<FirestoreRoomService | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioRequestPromiseRef = useRef<Promise<MediaStream | null> | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const connectionModeRef = useRef<ConnectionMode>(connectionMode);
  connectionModeRef.current = connectionMode;
  const playerNameRef = useRef<string>(playerName);
  playerNameRef.current = playerName;
  const micMutedRef = useRef<boolean>(micMuted);
  micMutedRef.current = micMuted;
  const diceCountRef = useRef<ParchisiDiceCount>(diceCount);
  diceCountRef.current = diceCount;
  const chatOpenRef = useRef<boolean>(chatOpen);
  chatOpenRef.current = chatOpen;
  const activeGameRef = useRef<ActiveGame>(activeGame);
  activeGameRef.current = activeGame;
  const inDuoRoomRef = useRef<boolean>(false);

  const dataSubscribersRef = useRef<Set<(msg: PeerMessage) => void>>(new Set());
  const reactionSeqRef = useRef<number>(1);

  const localSpeaking = useAudioSpeakingLevel(localStream, micMuted);
  const remoteSpeaking = useAudioSpeakingLevel(remoteStream, false);

  const setPlayerName = useCallback((name: string) => {
    setPlayerNameState(name);
  }, []);

  const setChatOpen = useCallback((open: boolean) => {
    setChatOpenState(open);
    if (open) {
      setUnreadChatCount(0);
    }
  }, []);

  const spawnFloatingReaction = useCallback(
    (emoji: QuickReactionEmoji, senderName: string) => {
      const id = reactionSeqRef.current++;
      const offsetX = Math.round((Math.random() - 0.5) * 160);
      setFloatingReactions((prev) => [...prev.slice(-8), { id, emoji, senderName, offsetX }]);
      window.setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((item) => item.id !== id));
      }, 1400);
    },
    [],
  );

  // Keep the single persistent root <audio> element attached to remoteStream across ALL screens
  useEffect(() => {
    const audioEl = remoteAudioRef.current;
    if (!audioEl) return;
    if (remoteStream) {
      if (audioEl.srcObject !== remoteStream) {
        audioEl.srcObject = remoteStream;
      }
      audioEl.play().catch(() => {
        // Mobile autoplay resumes automatically on next tap
      });
    } else {
      audioEl.srcObject = null;
    }
  }, [remoteStream]);

  // Resume remote audio playback on any user gesture (iOS Safari / mobile browsers)
  useEffect(() => {
    if (!remoteStream) return;
    const unlock = () => {
      const el = remoteAudioRef.current;
      if (el && el.srcObject && el.paused) {
        el.play().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, [remoteStream]);

  const ensureService = useCallback((): FirestoreRoomService => {
    if (!serviceRef.current) {
      serviceRef.current = new FirestoreRoomService({
        onStatusChange: (status, message) => {
          // Once inside a room, NEVER eject on transient errors — only explicit status === 'closed' ('disconnected') exits
          if (status === 'error' && inDuoRoomRef.current) {
            console.warn('[Parcheesi RoomContext] Ignored transient error while inside room:', message);
            return;
          }

          if (status === 'waiting' || status === 'connected') {
            inDuoRoomRef.current = true;
          } else if (status === 'disconnected' || status === 'error') {
            inDuoRoomRef.current = false;
          }

          setConnectionStatus(status);
          if (message !== undefined) {
            setStatusMessage(message);
          } else if (status === 'connected' || status === 'waiting') {
            setStatusMessage('');
          }

          if (
            (status === 'disconnected' || status === 'error') &&
            connectionModeRef.current !== 'solo'
          ) {
            if (status === 'disconnected') {
              clearPersistedRoomSession();
            }
            setConnectionMode('idle');
            setActiveGame(null);
            setRemoteStream(null);
            setGuestName('');
            setChatMessages([]);
            setUnreadChatCount(0);
          }
        },
        onRoomCodeChange: (newCode) => {
          const clean = normalizeRoomCode(newCode);
          setRoomCode(clean);
        },
        onRoomState: (summary) => {
          setHostName(summary.hostName);
          setGuestName(summary.guestName);
          setActiveGame(summary.activeGame);
          setDiceCountState(summary.diceCount);
          setHostHasAudio(summary.hostHasAudio);
          setGuestHasAudio(summary.guestHasAudio);
          setHostMicMuted(summary.hostMicMuted);
          setGuestMicMuted(summary.guestMicMuted);
        },
        onRemoteStream: (stream) => {
          setRemoteStream(stream);
        },
        onMessage: (msg) => {
          for (const listener of dataSubscribersRef.current) {
            try {
              listener(msg);
            } catch (err) {
              console.warn('[Parcheesi RoomContext] Subscriber error:', err);
            }
          }
        },
        onChatMessage: (msg, isFromRemote, isInitialHistory) => {
          setChatMessages((prev) => {
            if (prev.some((item) => item.id === msg.id)) return prev;
            return [...prev.slice(-119), msg];
          });

          if (!isInitialHistory && msg.kind === 'reaction') {
            const em = msg.text as QuickReactionEmoji;
            if (em === '❤️' || em === '😂' || em === '🔥') {
              spawnFloatingReaction(em, msg.senderName);
            }
          }

          if (
            isFromRemote &&
            !isInitialHistory &&
            activeGameRef.current === 'parcheesi' &&
            !chatOpenRef.current
          ) {
            setUnreadChatCount((c) => c + 1);
          }
        },
      });
    }
    return serviceRef.current;
  }, [spawnFloatingReaction]);

  /**
   * Audio-ONLY microphone capture (`video: false`).
   * 100% non-blocking: denying permission or having no mic still allows full room entry, Parcheesi, and chat!
   */
  const requestLocalAudio = useCallback(async (): Promise<MediaStream | null> => {
    if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !micMutedRef.current;
      });
      setMicStatus('granted');
      setMicHint(null);
      serviceRef.current?.setLocalAudioStream(localStreamRef.current, micMutedRef.current);
      return localStreamRef.current;
    }

    if (audioRequestPromiseRef.current) return audioRequestPromiseRef.current;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMicStatus('unavailable');
      setMicHint('Micro indisponible — le jeu Parcheesi et le chat en direct restent 100 % actifs.');
      return null;
    }

    const req = (async (): Promise<MediaStream | null> => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        stream.getAudioTracks().forEach((track) => {
          track.enabled = !micMutedRef.current;
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
        setMicStatus('granted');
        setMicHint(null);
        serviceRef.current?.setLocalAudioStream(stream, micMutedRef.current);
        return stream;
      } catch {
        setMicStatus('denied');
        setMicHint('Micro non autorisé — tu peux toujours jouer à Parcheesi et discuter dans le chat.');
        return null;
      } finally {
        audioRequestPromiseRef.current = null;
      }
    })();

    audioRequestPromiseRef.current = req;
    return req;
  }, []);

  const createRoom = useCallback(
    async (nameOverride?: string): Promise<string | null> => {
      const cleanName = sanitizePlayerName(nameOverride ?? playerNameRef.current, 'Hôte');
      const initialCode = normalizeRoomCode(generateRoomCode());

      setPlayerNameState(cleanName);
      setRole('host');
      setHostName(cleanName);
      setGuestName('');
      setActiveGame(null);
      setChatMessages([]);
      setUnreadChatCount(0);
      setRoomCode(initialCode);
      setConnectionMode('p2p-host');
      setStatusMessage('');

      // Enter Firestore room immediately (audio permission runs non-blockingly in parallel)
      const svc = ensureService();
      void requestLocalAudio();
      const createdCode = await svc.createHostRoom(
        initialCode,
        cleanName,
        localStreamRef.current,
        micMutedRef.current,
        diceCountRef.current,
      );
      if (createdCode) {
        savePersistedRoomSession({
          roomCode: createdCode,
          role: 'host',
          playerName: cleanName,
        });
      }
      return createdCode;
    },
    [ensureService, requestLocalAudio],
  );

  const joinRoom = useCallback(
    async (code: string, nameOverride?: string): Promise<boolean> => {
      const cleanCode = normalizeRoomCode(code);
      const cleanName = sanitizePlayerName(nameOverride ?? playerNameRef.current, 'Invité');

      setPlayerNameState(cleanName);
      setRole('guest');
      setGuestName(cleanName);
      setActiveGame(null);
      setChatMessages([]);
      setUnreadChatCount(0);
      setRoomCode(cleanCode);
      setConnectionMode('p2p-guest');
      setStatusMessage('');

      const svc = ensureService();
      void requestLocalAudio();
      const joined = await svc.joinGuestRoom(
        cleanCode,
        cleanName,
        localStreamRef.current,
        micMutedRef.current,
      );
      if (joined) {
        savePersistedRoomSession({
          roomCode: cleanCode,
          role: 'guest',
          playerName: cleanName,
        });
      }
      return joined;
    },
    [ensureService, requestLocalAudio],
  );

  const cancelRoom = useCallback((): void => {
    const shouldClose = connectionModeRef.current === 'p2p-host';
    inDuoRoomRef.current = false;
    clearPersistedRoomSession();
    serviceRef.current?.destroy({ closeRemoteDoc: shouldClose });
    setRemoteStream(null);
    setConnectionMode('idle');
    setConnectionStatus('disconnected');
    setStatusMessage('');
    setRoomCode('');
    setGuestName('');
    setActiveGame(null);
    setChatMessages([]);
    setUnreadChatCount(0);
  }, []);

  /**
   * ONLY called after explicit user confirmation on "Leave Room".
   */
  const leaveRoom = useCallback((): void => {
    const shouldClose =
      connectionModeRef.current === 'p2p-host' || connectionModeRef.current === 'p2p-guest';
    inDuoRoomRef.current = false;
    clearPersistedRoomSession();
    serviceRef.current?.destroy({ closeRemoteDoc: shouldClose });
    setRemoteStream(null);
    setConnectionMode('idle');
    setConnectionStatus('disconnected');
    setStatusMessage('');
    setRoomCode('');
    setGuestName('');
    setActiveGame(null);
    setChatMessages([]);
    setUnreadChatCount(0);
    setChatOpenState(false);
  }, []);

  const startSoloMode = useCallback((nameOverride?: string): void => {
    const shouldClose =
      connectionModeRef.current === 'p2p-host' || connectionModeRef.current === 'p2p-guest';
    inDuoRoomRef.current = false;
    clearPersistedRoomSession();
    serviceRef.current?.destroy({ closeRemoteDoc: shouldClose });

    const cleanName = sanitizePlayerName(nameOverride ?? playerNameRef.current, 'Alex');
    setPlayerNameState(cleanName);
    setRole('host');
    setHostName(cleanName);
    setGuestName('Camille IA');
    setRemoteStream(null);
    setConnectionMode('solo');
    setConnectionStatus('connected');
    setStatusMessage('');
    setRoomCode('SOLO');
    setActiveGame(null);
    setChatMessages([
      {
        id: 'solo-welcome',
        sender: 'guest',
        senderName: 'Camille IA',
        text: 'Bienvenue dans le salon Parcheesi ! Choisis 1 Dé ou 2 Dés et lance la partie quand tu veux 🎲',
        kind: 'text',
        createdAtMs: Date.now(),
      },
    ]);
    setUnreadChatCount(0);
  }, []);

  /**
   * Host-only launch of Parcheesi from the Room Menu.
   */
  const startParcheesi = useCallback(async (): Promise<void> => {
    if (connectionModeRef.current === 'solo') {
      setActiveGame('parcheesi');
      return;
    }
    if (connectionModeRef.current !== 'p2p-host') return;
    setActiveGame('parcheesi');
    try {
      await serviceRef.current?.startParcheesi(diceCountRef.current);
    } catch (err) {
      console.warn('[Parcheesi RoomContext] startParcheesi failed:', err);
    }
  }, []);

  /**
   * Host-only return from Parcheesi to Room Menu without disconnecting room or audio.
   */
  const returnToRoomMenu = useCallback(async (): Promise<void> => {
    if (connectionModeRef.current === 'solo') {
      setActiveGame(null);
      return;
    }
    if (connectionModeRef.current !== 'p2p-host') return;
    setActiveGame(null);
    try {
      await serviceRef.current?.returnToRoomMenu();
    } catch (err) {
      console.warn('[Parcheesi RoomContext] returnToRoomMenu failed:', err);
    }
  }, []);

  const setDiceCount = useCallback((count: ParchisiDiceCount): void => {
    const safe: ParchisiDiceCount = count === 1 ? 1 : 2;
    setDiceCountState(safe);
    if (connectionModeRef.current === 'p2p-host') {
      serviceRef.current?.syncDiceCount(safe);
    }
  }, []);

  const toggleMic = useCallback((): void => {
    if (!localStreamRef.current) {
      // Clicking Mic when permission hasn't been granted yet attempts non-blocking audio request
      void requestLocalAudio();
      setMicMuted(false);
      serviceRef.current?.syncMicMuted(false);
      return;
    }
    setMicMuted((prev) => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
      serviceRef.current?.syncMicMuted(next);
      return next;
    });
  }, [requestLocalAudio]);

  const sendChatMessage = useCallback(async (text: string): Promise<void> => {
    const trimmed = text.trim().slice(0, 280);
    if (!trimmed) return;

    if (connectionModeRef.current === 'solo') {
      const now = Date.now();
      const myMsg: RoomChatMessage = {
        id: `solo-u-${now}-${Math.random().toString(36).slice(2, 6)}`,
        sender: 'host',
        senderName: sanitizePlayerName(playerNameRef.current, 'Alex'),
        text: trimmed,
        kind: 'text',
        createdAtMs: now,
      };
      setChatMessages((prev) => [...prev.slice(-119), myMsg]);
      window.setTimeout(() => {
        if (connectionModeRef.current !== 'solo') return;
        const replyText = SOLO_AI_REPLIES[Math.floor(Math.random() * SOLO_AI_REPLIES.length)];
        setChatMessages((prev) => [
          ...prev.slice(-119),
          {
            id: `solo-ai-${Date.now()}`,
            sender: 'guest',
            senderName: 'Camille IA',
            text: replyText,
            kind: 'text',
            createdAtMs: Date.now(),
          },
        ]);
      }, 650);
      return;
    }

    try {
      await serviceRef.current?.sendChatMessage(trimmed, 'text');
    } catch (err) {
      console.warn('[Parcheesi RoomContext] sendChatMessage failed:', err);
    }
  }, []);

  const sendQuickReaction = useCallback(
    async (emoji: QuickReactionEmoji): Promise<void> => {
      const myName = sanitizePlayerName(playerNameRef.current, 'Moi');
      if (connectionModeRef.current === 'solo') {
        spawnFloatingReaction(emoji, myName);
        setChatMessages((prev) => [
          ...prev.slice(-119),
          {
            id: `solo-r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sender: 'host',
            senderName: myName,
            text: emoji,
            kind: 'reaction',
            createdAtMs: Date.now(),
          },
        ]);
        return;
      }

      try {
        await serviceRef.current?.sendChatMessage(emoji, 'reaction');
      } catch (err) {
        console.warn('[Parcheesi RoomContext] sendQuickReaction failed:', err);
      }
    },
    [spawnFloatingReaction],
  );

  const sendData = useCallback((msg: PeerMessage): void => {
    if (!msg) return;
    try {
      serviceRef.current?.sendData(msg);
    } catch (err) {
      console.warn('[Parcheesi RoomContext] Safe sendData guard caught error:', err);
    }
  }, []);

  const onData = useCallback((handler: (msg: PeerMessage) => void): (() => void) => {
    if (typeof handler !== 'function') return () => {};
    dataSubscribersRef.current.add(handler);
    return () => {
      dataSubscribersRef.current.delete(handler);
    };
  }, []);

  const recordParchisiVictory = useCallback(() => {
    setParcheesiWins((w) => w + 1);
  }, []);

  // Auto-Reconnect from `sessionStorage` on mount (restores exact Room Menu or active Parcheesi game!)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart')) return;

    const saved = loadPersistedRoomSession();
    if (!saved) return;

    const urlRoom = params.get('room') ? normalizeRoomCode(params.get('room')!) : '';
    if (urlRoom && urlRoom !== saved.roomCode) return;

    let cancelled = false;
    setIsRestoringSession(true);
    setPlayerNameState(saved.playerName);
    setRole(saved.role);
    setRoomCode(saved.roomCode);
    setConnectionMode(saved.role === 'host' ? 'p2p-host' : 'p2p-guest');

    const svc = ensureService();
    void requestLocalAudio();
    svc
      .resumeSession(
        saved.roomCode,
        saved.role,
        saved.playerName,
        localStreamRef.current,
        micMutedRef.current,
      )
      .then((restored) => {
        if (cancelled) return;
        if (!restored) {
          clearPersistedRoomSession();
          setConnectionMode('idle');
          setConnectionStatus('disconnected');
          setRoomCode('');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsRestoringSession(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // Run once on root mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop local audio tracks ONLY on full provider unmount
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      // NEVER close the remote Firestore doc on page refresh/unmount so auto-reconnect works!
      serviceRef.current?.destroy({ closeRemoteDoc: false });
    };
  }, []);

  const isHost = connectionMode === 'p2p-host';
  const isGuest = connectionMode === 'p2p-guest';
  const isAIMode = connectionMode === 'solo';
  const inRoom =
    isAIMode ||
    ((isHost || isGuest) &&
      (connectionStatus === 'waiting' || connectionStatus === 'connected'));
  const guestConnected = isAIMode || Boolean(guestName.trim());
  const isConnected = connectionStatus === 'connected';
  const partnerName = isAIMode
    ? 'Camille IA'
    : isHost
      ? guestName || ''
      : hostName || 'Hôte';

  const value = useMemo<RoomContextValue>(
    () => ({
      roomCode,
      role,
      connectionMode,
      connectionStatus,
      statusMessage,
      inRoom,
      isConnected,
      isHost,
      isGuest,
      isAIMode,
      isRestoringSession,
      playerName,
      setPlayerName,
      hostName,
      guestName,
      guestConnected,
      partnerName,
      activeGame,
      diceCount,
      parcheesiWins,
      recordParchisiVictory,
      localStream,
      remoteStream,
      micMuted,
      micStatus,
      micHint,
      hostHasAudio,
      guestHasAudio,
      hostMicMuted,
      guestMicMuted,
      localSpeaking,
      remoteSpeaking,
      chatMessages,
      unreadChatCount,
      chatOpen,
      setChatOpen,
      floatingReactions,
      sendChatMessage,
      sendQuickReaction,
      createRoom,
      joinRoom,
      cancelRoom,
      leaveRoom,
      startSoloMode,
      startParcheesi,
      returnToRoomMenu,
      setDiceCount,
      requestLocalAudio,
      toggleMic,
      sendData,
      onData,
    }),
    [
      roomCode,
      role,
      connectionMode,
      connectionStatus,
      statusMessage,
      inRoom,
      isConnected,
      isHost,
      isGuest,
      isAIMode,
      isRestoringSession,
      playerName,
      setPlayerName,
      hostName,
      guestName,
      guestConnected,
      partnerName,
      activeGame,
      diceCount,
      parcheesiWins,
      recordParchisiVictory,
      localStream,
      remoteStream,
      micMuted,
      micStatus,
      micHint,
      hostHasAudio,
      guestHasAudio,
      hostMicMuted,
      guestMicMuted,
      localSpeaking,
      remoteSpeaking,
      chatMessages,
      unreadChatCount,
      chatOpen,
      setChatOpen,
      floatingReactions,
      sendChatMessage,
      sendQuickReaction,
      createRoom,
      joinRoom,
      cancelRoom,
      leaveRoom,
      startSoloMode,
      startParcheesi,
      returnToRoomMenu,
      setDiceCount,
      requestLocalAudio,
      toggleMic,
      sendData,
      onData,
    ],
  );

  return (
    <RoomContext.Provider value={value}>
      {/* Single persistent audio-only element at root: NEVER unmounts between Room Menu & Parcheesi */}
      <audio ref={remoteAudioRef} data-testid="remote-voice-audio" autoPlay playsInline className="hidden" />
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return ctx;
}
