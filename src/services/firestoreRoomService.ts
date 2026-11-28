import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  ActiveGame,
  ParchisiDiceCount,
  PeerMessage,
  RoomChatMessage,
  RoomRole,
} from '../types/duoplay';
import {
  db,
  ensureAnonymousAuth,
  formatUserFriendlyFirestoreError,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  buildIceServers,
  ERR_ROOM_NOT_FOUND,
  generateRoomCode,
  normalizeRoomCode,
  sanitizeIceCandidate,
  sanitizePlayerName,
  stripUndefinedDeep,
} from '../utils/roomCode';

export type { RoomRole };

export interface SdpPayload {
  type: 'offer' | 'answer';
  sdp: string;
}

export interface FirestoreRoomDoc {
  hostName: string;
  guestName: string;
  status: 'waiting' | 'connected' | 'playing' | 'closed';
  activeGame: ActiveGame;
  scores: Record<string, number>;
  diceCount: ParchisiDiceCount;
  offer?: SdpPayload | null;
  answer?: SdpPayload | null;
  webrtcGen: number;
  hostHasAudio: boolean;
  guestHasAudio: boolean;
  hostMicMuted: boolean;
  guestMicMuted: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FirestoreChatDoc {
  sender: RoomRole;
  senderName: string;
  text: string;
  kind: 'text' | 'reaction';
  createdAt?: unknown;
}

export interface FirestoreRoomMessageDoc {
  sender: RoomRole;
  payload: PeerMessage;
  createdAt?: unknown;
}

export interface FirestoreCandidateDoc {
  sender: RoomRole;
  webrtcGen: number;
  candidate: {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
    usernameFragment?: string | null;
  };
  createdAt?: unknown;
}

export interface RoomStateSummary {
  code: string;
  hostName: string;
  guestName: string;
  status: FirestoreRoomDoc['status'];
  activeGame: ActiveGame;
  diceCount: ParchisiDiceCount;
  scores: Record<string, number>;
  hostHasAudio: boolean;
  guestHasAudio: boolean;
  hostMicMuted: boolean;
  guestMicMuted: boolean;
}

export interface FirestoreRoomCallbacks {
  onStatusChange: (
    status: 'creating' | 'waiting' | 'connecting' | 'connected' | 'disconnected' | 'error',
    message?: string,
  ) => void;
  onRoomCodeChange?: (code: string) => void;
  onRoomState?: (summary: RoomStateSummary) => void;
  onRemoteStream: (stream: MediaStream | null) => void;
  onMessage: (msg: PeerMessage) => void;
  onChatMessage?: (msg: RoomChatMessage, isFromRemote: boolean, isInitialHistory: boolean) => void;
}

export interface RoomSnapshotMeta {
  hasPendingWrites?: boolean;
  fromCache?: boolean;
}

export interface FirestoreTransportAdapter {
  getRoom: (code: string) => Promise<FirestoreRoomDoc | null>;
  createRoom: (code: string, data: FirestoreRoomDoc) => Promise<void>;
  updateRoom: (code: string, patch: Record<string, unknown>) => Promise<void>;
  subscribeRoom: (
    code: string,
    onData: (room: FirestoreRoomDoc | null, meta?: RoomSnapshotMeta) => void,
    onError: (err: unknown) => void,
  ) => Unsubscribe;
  addChat: (code: string, data: FirestoreChatDoc) => Promise<void>;
  subscribeChat: (
    code: string,
    onAdded: (id: string, msg: FirestoreChatDoc) => void,
    onError: (err: unknown) => void,
  ) => Unsubscribe;
  addMessage: (code: string, data: FirestoreRoomMessageDoc) => Promise<void>;
  subscribeMessages: (
    code: string,
    onAdded: (id: string, msg: FirestoreRoomMessageDoc) => void,
    onError: (err: unknown) => void,
  ) => Unsubscribe;
  addCandidate: (code: string, data: FirestoreCandidateDoc) => Promise<void>;
  subscribeCandidates: (
    code: string,
    onAdded: (id: string, cand: FirestoreCandidateDoc) => void,
    onError: (err: unknown) => void,
  ) => Unsubscribe;
  serverNow: () => unknown;
}

function timestampToMs(ts: unknown): number {
  if (typeof ts === 'number' && Number.isFinite(ts)) return ts;
  if (ts && typeof ts === 'object' && 'toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
    try {
      return (ts as { toMillis: () => number }).toMillis();
    } catch {
      return Date.now();
    }
  }
  return Date.now();
}

const DEFAULT_FIRESTORE_ADAPTER: FirestoreTransportAdapter = {
  async getRoom(code) {
    const path = `rooms/${code}`;
    await ensureAnonymousAuth();
    try {
      const snap = await getDoc(doc(db, 'rooms', code));
      return snap.exists() ? (snap.data() as FirestoreRoomDoc) : null;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }
  },
  async createRoom(code, data) {
    const path = `rooms/${code}`;
    await ensureAnonymousAuth();
    try {
      await setDoc(doc(db, 'rooms', code), data);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  },
  async updateRoom(code, patch) {
    const path = `rooms/${code}`;
    try {
      // Strictly use updateDoc (partial merge) so hostName, guestName, activeGame, offer & answer are never overwritten
      const cleanPatch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) {
          cleanPatch[k] = v;
        }
      }
      await updateDoc(doc(db, 'rooms', code), cleanPatch);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },
  subscribeRoom(code, onData, onError) {
    const path = `rooms/${code}`;
    return onSnapshot(
      doc(db, 'rooms', code),
      (snap) => {
        onData(snap.exists() ? (snap.data() as FirestoreRoomDoc) : null, {
          hasPendingWrites: snap.metadata.hasPendingWrites,
          fromCache: snap.metadata.fromCache,
        });
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.GET, path);
        } catch (wrapped) {
          onError(wrapped);
        }
      },
    );
  },
  async addChat(code, data) {
    const path = `rooms/${code}/chat`;
    try {
      await addDoc(collection(db, 'rooms', code, 'chat'), data);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  },
  subscribeChat(code, onAdded, onError) {
    const path = `rooms/${code}/chat`;
    const q = query(collection(db, 'rooms', code, 'chat'), orderBy('createdAt', 'asc'));
    return onSnapshot(
      q,
      (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === 'added') {
            onAdded(change.doc.id, change.doc.data() as FirestoreChatDoc);
          }
        }
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, path);
        } catch (wrapped) {
          onError(wrapped);
        }
      },
    );
  },
  async addMessage(code, data) {
    const path = `rooms/${code}/messages`;
    try {
      await addDoc(collection(db, 'rooms', code, 'messages'), data);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  },
  subscribeMessages(code, onAdded, onError) {
    const path = `rooms/${code}/messages`;
    const q = query(collection(db, 'rooms', code, 'messages'), orderBy('createdAt', 'asc'));
    return onSnapshot(
      q,
      (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === 'added') {
            onAdded(change.doc.id, change.doc.data() as FirestoreRoomMessageDoc);
          }
        }
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, path);
        } catch (wrapped) {
          onError(wrapped);
        }
      },
    );
  },
  async addCandidate(code, data) {
    const path = `rooms/${code}/candidates`;
    try {
      await addDoc(collection(db, 'rooms', code, 'candidates'), data);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  },
  subscribeCandidates(code, onAdded, onError) {
    const path = `rooms/${code}/candidates`;
    const q = query(collection(db, 'rooms', code, 'candidates'), orderBy('createdAt', 'asc'));
    return onSnapshot(
      q,
      (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === 'added') {
            onAdded(change.doc.id, change.doc.data() as FirestoreCandidateDoc);
          }
        }
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, path);
        } catch (wrapped) {
          onError(wrapped);
        }
      },
    );
  },
  serverNow() {
    return serverTimestamp();
  },
};

const ICE_DISCONNECT_RESTART_MS = 3500;

/**
 * Unbreakable Cloud Firestore + Audio-Only Native WebRTC (`RTCPeerConnection`) Room Manager.
 *
 * - Zero video tracks, zero video transceivers, zero MediaPipe.
 * - Both Host (immediately after creating) and Guest (after joining) land directly in the
 *   Room Menu (`activeGame: null`). Parcheesi NEVER auto-starts when Guest joins.
 * - Host explicitly controls `activeGame` (`null` <-> `'parcheesi'`) and `diceCount` (`1 | 2`)
 *   via non-destructive `updateDoc()`.
 * - Live Chat & Quick Reactions persist in `rooms/{code}/chat` across Room Menu & Parcheesi.
 * - Supports `resumeSession()` for automatic reconnect after page refresh / mobile hiccups.
 */
export class FirestoreRoomService {
  private callbacks: FirestoreRoomCallbacks;
  private adapter: FirestoreTransportAdapter;
  private peerConnectionFactory: (config: RTCConfiguration) => RTCPeerConnection;

  private sessionGen = 0;
  private role: RoomRole = 'host';
  private activeRoomCode = '';
  private localName = 'Moi';
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private localMicMuted = false;
  private hasEnteredRoom = false;
  private guestJoinedNotified = false;
  private latestRoom: FirestoreRoomDoc | null = null;

  // Firestore listeners
  private unsubRoom: Unsubscribe | null = null;
  private unsubChat: Unsubscribe | null = null;
  private unsubMessages: Unsubscribe | null = null;
  private unsubCandidates: Unsubscribe | null = null;
  private seenChatIds = new Set<string>();
  private seenMessageIds = new Set<string>();
  private seenCandidateIds = new Set<string>();
  private initialChatHydrated = false;
  private initialMessagesHydrated = false;

  // Audio-only Native WebRTC state
  private pc: RTCPeerConnection | null = null;
  private webrtcGen = 0;
  private appliedOfferGen = -1;
  private appliedAnswerGen = -1;
  private hasRemoteDescription = false;
  private pendingRemoteCandidates: RTCIceCandidateInit[] = [];
  private iceRestartTimer: ReturnType<typeof setTimeout> | null = null;
  private lastKnownGuestHasAudio = false;

  constructor(
    callbacks: FirestoreRoomCallbacks,
    options?: {
      adapter?: FirestoreTransportAdapter;
      peerConnectionFactory?: (config: RTCConfiguration) => RTCPeerConnection;
    },
  ) {
    this.callbacks = callbacks;
    this.adapter = options?.adapter ?? DEFAULT_FIRESTORE_ADAPTER;
    this.peerConnectionFactory =
      options?.peerConnectionFactory ?? ((cfg) => new RTCPeerConnection(cfg));
  }

  public isConnected(): boolean {
    return this.hasEnteredRoom;
  }

  public getRole(): RoomRole {
    return this.role;
  }

  public getRoomCode(): string {
    return this.activeRoomCode;
  }

  private emitRoomSummary(code: string, room: FirestoreRoomDoc): void {
    this.latestRoom = room;
    this.callbacks.onRoomState?.({
      code,
      hostName: room.hostName || 'Hôte',
      guestName: room.guestName || '',
      status: room.status,
      activeGame: room.activeGame === 'parcheesi' ? 'parcheesi' : null,
      diceCount: room.diceCount === 1 ? 1 : 2,
      scores: room.scores ?? {},
      hostHasAudio: Boolean(room.hostHasAudio),
      guestHasAudio: Boolean(room.guestHasAudio),
      hostMicMuted: Boolean(room.hostMicMuted),
      guestMicMuted: Boolean(room.guestMicMuted),
    });
  }

  private clearIceRestartTimer(): void {
    if (this.iceRestartTimer !== null) {
      clearTimeout(this.iceRestartTimer);
      this.iceRestartTimer = null;
    }
  }

  private closePeerConnection(): void {
    this.clearIceRestartTimer();
    this.hasRemoteDescription = false;
    this.pendingRemoteCandidates = [];
    if (this.pc) {
      try {
        this.pc.onicecandidate = null;
        this.pc.ontrack = null;
        this.pc.oniceconnectionstatechange = null;
        this.pc.onconnectionstatechange = null;
        this.pc.close();
      } catch {
        // Ignore close errors
      }
      this.pc = null;
    }
  }

  private unsubscribeAll(): void {
    for (const unsub of [this.unsubRoom, this.unsubChat, this.unsubMessages, this.unsubCandidates]) {
      if (unsub) {
        try {
          unsub();
        } catch {
          // Ignore
        }
      }
    }
    this.unsubRoom = null;
    this.unsubChat = null;
    this.unsubMessages = null;
    this.unsubCandidates = null;
  }

  /**
   * Host creates `rooms/{code}` in Room Menu (`activeGame: null`, `status: 'waiting'`)
   * and enters the Room Menu IMMEDIATELY so they see the code, mic, chat, dice selector, and Parcheesi card.
   */
  public async createHostRoom(
    code: string,
    hostName: string,
    audioStream: MediaStream | null,
    micMuted = false,
    diceCount: ParchisiDiceCount = 2,
    attempt = 0,
  ): Promise<string | null> {
    this.destroy({ closeRemoteDoc: false });
    const gen = this.sessionGen;
    const cleanCode = normalizeRoomCode(code) || generateRoomCode();
    const cleanHostName = sanitizePlayerName(hostName, 'Hôte');

    this.role = 'host';
    this.activeRoomCode = cleanCode;
    this.localName = cleanHostName;
    this.localStream = audioStream;
    this.localMicMuted = micMuted;
    this.hasEnteredRoom = false;
    this.guestJoinedNotified = false;
    this.webrtcGen = 0;
    this.appliedOfferGen = -1;
    this.appliedAnswerGen = -1;
    this.lastKnownGuestHasAudio = false;

    this.callbacks.onStatusChange('creating', `Ouverture du salon ${cleanCode}...`);

    try {
      const existing = await this.adapter.getRoom(cleanCode);
      if (gen !== this.sessionGen) return null;

      if (existing && attempt < 3) {
        const freshCode = generateRoomCode();
        this.callbacks.onRoomCodeChange?.(freshCode);
        return this.createHostRoom(freshCode, cleanHostName, audioStream, micMuted, diceCount, attempt + 1);
      }

      const roomDoc: FirestoreRoomDoc = {
        hostName: cleanHostName,
        guestName: '',
        status: 'waiting',
        activeGame: null,
        scores: {},
        diceCount: diceCount === 1 ? 1 : 2,
        offer: null,
        answer: null,
        webrtcGen: 0,
        hostHasAudio: Boolean(audioStream && audioStream.getAudioTracks().length > 0),
        guestHasAudio: false,
        hostMicMuted: micMuted,
        guestMicMuted: false,
        createdAt: this.adapter.serverNow(),
        updatedAt: this.adapter.serverNow(),
      };

      await this.adapter.createRoom(cleanCode, roomDoc);
      if (gen !== this.sessionGen) return null;

      this.callbacks.onRoomCodeChange?.(cleanCode);
      this.emitRoomSummary(cleanCode, roomDoc);
      this.enterRoomSession(cleanCode, gen, 'waiting');
      this.attachRoomListener(cleanCode, gen);
      return cleanCode;
    } catch (err) {
      if (gen !== this.sessionGen) return null;
      this.destroy({ closeRemoteDoc: false });
      this.callbacks.onStatusChange('error', formatUserFriendlyFirestoreError(err));
      return null;
    }
  }

  /**
   * Guest verifies `rooms/{code}` and joins into the Room Menu (`activeGame` is NEVER mutated by Guest).
   * Parcheesi NEVER auto-starts on Guest join.
   */
  public async joinGuestRoom(
    code: string,
    guestName: string,
    audioStream: MediaStream | null,
    micMuted = false,
  ): Promise<boolean> {
    this.destroy({ closeRemoteDoc: false });
    const gen = this.sessionGen;
    const cleanCode = normalizeRoomCode(code);
    const cleanGuestName = sanitizePlayerName(guestName, 'Invité');

    if (cleanCode.length !== 4) {
      this.callbacks.onStatusChange('error', ERR_ROOM_NOT_FOUND);
      return false;
    }

    this.role = 'guest';
    this.activeRoomCode = cleanCode;
    this.localName = cleanGuestName;
    this.localStream = audioStream;
    this.localMicMuted = micMuted;
    this.hasEnteredRoom = false;
    this.webrtcGen = 0;
    this.appliedOfferGen = -1;
    this.appliedAnswerGen = -1;

    this.callbacks.onStatusChange('connecting', `Connexion au salon ${cleanCode}...`);

    try {
      const room = await this.adapter.getRoom(cleanCode);
      if (gen !== this.sessionGen) return false;

      if (!room || room.status === 'closed') {
        this.destroy({ closeRemoteDoc: false });
        this.callbacks.onStatusChange('error', ERR_ROOM_NOT_FOUND);
        return false;
      }

      const nextStatus: FirestoreRoomDoc['status'] =
        room.activeGame === 'parcheesi' ? 'playing' : 'connected';
      const hasAudio = Boolean(audioStream && audioStream.getAudioTracks().length > 0);

      await this.adapter.updateRoom(cleanCode, {
        guestName: cleanGuestName,
        status: nextStatus,
        guestHasAudio: hasAudio,
        guestMicMuted: micMuted,
        updatedAt: this.adapter.serverNow(),
      });
      if (gen !== this.sessionGen) return false;

      const updatedRoom: FirestoreRoomDoc = {
        ...room,
        guestName: cleanGuestName,
        status: nextStatus,
        guestHasAudio: hasAudio,
        guestMicMuted: micMuted,
      };

      this.callbacks.onRoomCodeChange?.(cleanCode);
      this.emitRoomSummary(cleanCode, updatedRoom);
      this.enterRoomSession(cleanCode, gen, 'connected');
      this.attachRoomListener(cleanCode, gen);

      // If Host already published an audio WebRTC offer, answer in background
      if (room.offer && room.webrtcGen > 0) {
        void this.handleGuestIncomingOffer(cleanCode, room.offer, room.webrtcGen, gen);
      }
      return true;
    } catch (err) {
      if (gen !== this.sessionGen) return false;
      this.destroy({ closeRemoteDoc: false });
      this.callbacks.onStatusChange('error', formatUserFriendlyFirestoreError(err));
      return false;
    }
  }

  /**
   * Auto-reconnect helper used after page refresh or brief mobile hiccup (`sessionStorage`).
   * Restores the exact room screen (Room Menu or active Parcheesi match) without destroying room data.
   */
  public async resumeSession(
    code: string,
    role: RoomRole,
    playerName: string,
    audioStream: MediaStream | null,
    micMuted = false,
  ): Promise<boolean> {
    this.destroy({ closeRemoteDoc: false });
    const gen = this.sessionGen;
    const cleanCode = normalizeRoomCode(code);
    if (cleanCode.length !== 4) return false;

    const cleanName = sanitizePlayerName(playerName, role === 'host' ? 'Hôte' : 'Invité');
    this.role = role;
    this.activeRoomCode = cleanCode;
    this.localName = cleanName;
    this.localStream = audioStream;
    this.localMicMuted = micMuted;
    this.hasEnteredRoom = false;
    this.webrtcGen = 0;
    this.appliedOfferGen = -1;
    this.appliedAnswerGen = -1;

    try {
      const room = await this.adapter.getRoom(cleanCode);
      if (gen !== this.sessionGen) return false;
      if (!room || room.status === 'closed') {
        this.destroy({ closeRemoteDoc: false });
        return false;
      }

      const hasAudio = Boolean(audioStream && audioStream.getAudioTracks().length > 0);
      this.webrtcGen = typeof room.webrtcGen === 'number' ? room.webrtcGen : 0;
      this.guestJoinedNotified = Boolean(room.guestName);
      this.lastKnownGuestHasAudio = Boolean(room.guestHasAudio);

      const audioPatch =
        role === 'host'
          ? { hostHasAudio: hasAudio, hostMicMuted: micMuted, updatedAt: this.adapter.serverNow() }
          : {
              guestName: cleanName,
              status: room.activeGame === 'parcheesi' ? 'playing' : 'connected',
              guestHasAudio: hasAudio,
              guestMicMuted: micMuted,
              updatedAt: this.adapter.serverNow(),
            };

      await this.adapter.updateRoom(cleanCode, audioPatch).catch(() => {});
      if (gen !== this.sessionGen) return false;

      const restoredRoom: FirestoreRoomDoc = {
        ...room,
        ...(role === 'host'
          ? { hostHasAudio: hasAudio, hostMicMuted: micMuted }
          : {
              guestName: cleanName,
              status: room.activeGame === 'parcheesi' ? 'playing' : 'connected',
              guestHasAudio: hasAudio,
              guestMicMuted: micMuted,
            }),
      };

      this.callbacks.onRoomCodeChange?.(cleanCode);
      this.emitRoomSummary(cleanCode, restoredRoom);
      this.enterRoomSession(
        cleanCode,
        gen,
        role === 'host' && !restoredRoom.guestName ? 'waiting' : 'connected',
      );
      this.attachRoomListener(cleanCode, gen);

      // Re-establish audio-only WebRTC cleanly after refresh
      if (role === 'host' && restoredRoom.guestName) {
        void this.startHostWebRtcOffer(cleanCode, gen, false);
      } else if (role === 'guest' && restoredRoom.offer && restoredRoom.webrtcGen > 0) {
        void this.handleGuestIncomingOffer(cleanCode, restoredRoom.offer, restoredRoom.webrtcGen, gen);
      }
      return true;
    } catch {
      if (gen !== this.sessionGen) return false;
      this.destroy({ closeRemoteDoc: false });
      return false;
    }
  }

  private enterRoomSession(
    code: string,
    gen: number,
    initialStatus: 'waiting' | 'connected',
  ): void {
    if (gen !== this.sessionGen || this.hasEnteredRoom) return;
    this.hasEnteredRoom = true;
    this.seenChatIds.clear();
    this.seenMessageIds.clear();
    this.seenCandidateIds.clear();
    this.initialChatHydrated = false;
    this.initialMessagesHydrated = false;

    this.attachChatListener(code, gen);
    this.attachMessagesListener(code, gen);
    this.attachCandidatesListener(code, gen);

    this.callbacks.onStatusChange(initialStatus);
  }

  private attachRoomListener(code: string, gen: number): void {
    this.unsubRoom = this.adapter.subscribeRoom(
      code,
      (room, meta) => {
        if (gen !== this.sessionGen) return;
        // Ignore latency-compensated local writes and transient null snapshots -> zero accidental disconnects
        if (meta?.hasPendingWrites) return;
        if (!room) return;

        // ONLY exit room when `status === 'closed'` is explicitly confirmed by Firestore
        if (room.status === 'closed') {
          if (this.hasEnteredRoom) {
            this.hasEnteredRoom = false;
            this.closePeerConnection();
            this.remoteStream = null;
            this.callbacks.onRemoteStream(null);
            this.callbacks.onStatusChange('disconnected', 'Ton/ta partenaire a quitté le salon.');
          }
          return;
        }

        this.emitRoomSummary(code, room);

        if (this.role === 'host') {
          const hasGuest = Boolean(room.guestName) && (room.status === 'connected' || room.status === 'playing');
          if (hasGuest && !this.guestJoinedNotified) {
            this.guestJoinedNotified = true;
            this.lastKnownGuestHasAudio = Boolean(room.guestHasAudio);
            this.callbacks.onStatusChange('connected');
            // Start non-blocking background audio-only WebRTC offer
            void this.startHostWebRtcOffer(code, gen, false);
            return;
          }

          if (this.guestJoinedNotified) {
            // Apply Guest audio WebRTC answer once per webrtcGen
            if (
              room.answer &&
              room.webrtcGen === this.webrtcGen &&
              this.appliedAnswerGen !== room.webrtcGen
            ) {
              this.appliedAnswerGen = room.webrtcGen;
              void this.handleHostIncomingAnswer(room.answer, gen);
            }

            // If Guest enabled mic after joining without one, renegotiate audio cleanly
            const guestNowHasAudio = Boolean(room.guestHasAudio);
            if (guestNowHasAudio && !this.lastKnownGuestHasAudio) {
              this.lastKnownGuestHasAudio = true;
              void this.startHostWebRtcOffer(code, gen, false);
            } else {
              this.lastKnownGuestHasAudio = guestNowHasAudio;
            }
          }
        } else if (this.role === 'guest') {
          if (
            this.hasEnteredRoom &&
            room.offer &&
            room.webrtcGen > 0 &&
            room.webrtcGen !== this.appliedOfferGen
          ) {
            void this.handleGuestIncomingOffer(code, room.offer, room.webrtcGen, gen);
          }
        }
      },
      (err) => {
        if (gen !== this.sessionGen) return;
        // Once inside an active room, NEVER eject players back to Home on transient listener errors
        if (this.hasEnteredRoom) {
          console.warn('[Parcheesi Firestore] Transient room listener error (session kept alive):', err);
          return;
        }
        this.callbacks.onStatusChange('error', formatUserFriendlyFirestoreError(err));
      },
    );
  }

  private attachChatListener(code: string, gen: number): void {
    this.unsubChat = this.adapter.subscribeChat(
      code,
      (id, chatDoc) => {
        if (gen !== this.sessionGen) return;
        if (this.seenChatIds.has(id)) return;
        this.seenChatIds.add(id);

        const msg: RoomChatMessage = {
          id,
          sender: chatDoc.sender === 'guest' ? 'guest' : 'host',
          senderName: chatDoc.senderName || (chatDoc.sender === 'guest' ? 'Invité' : 'Hôte'),
          text: String(chatDoc.text ?? ''),
          kind: chatDoc.kind === 'reaction' ? 'reaction' : 'text',
          createdAtMs: timestampToMs(chatDoc.createdAt),
        };
        const isFromRemote = msg.sender !== this.role;
        this.callbacks.onChatMessage?.(msg, isFromRemote, !this.initialChatHydrated);
      },
      (err) => {
        if (gen !== this.sessionGen) return;
        console.warn('[Parcheesi Firestore] Chat listener error:', err);
      },
    );
    setTimeout(() => {
      if (gen === this.sessionGen) {
        this.initialChatHydrated = true;
      }
    }, 650);
  }

  private attachMessagesListener(code: string, gen: number): void {
    const joinedAtMs = Date.now() - 15_000;
    this.unsubMessages = this.adapter.subscribeMessages(
      code,
      (id, msgDoc) => {
        if (gen !== this.sessionGen) return;
        if (this.seenMessageIds.has(id)) return;
        this.seenMessageIds.add(id);

        if (msgDoc.sender === this.role) return;

        if (!this.initialMessagesHydrated) {
          const ms = timestampToMs(msgDoc.createdAt);
          if (ms < joinedAtMs) {
            // Still allow latest PARCHISI_STATE replay on reconnect if within last 15 min
            if (msgDoc.payload?.type !== 'PARCHISI_STATE') {
              return;
            }
          }
        }

        const payload = msgDoc.payload;
        if (payload && typeof payload === 'object' && 'type' in payload) {
          this.callbacks.onMessage(payload);
        }
      },
      (err) => {
        if (gen !== this.sessionGen) return;
        console.warn('[Parcheesi Firestore] Messages listener error:', err);
      },
    );
    setTimeout(() => {
      if (gen === this.sessionGen) {
        this.initialMessagesHydrated = true;
      }
    }, 800);
  }

  private attachCandidatesListener(code: string, gen: number): void {
    this.unsubCandidates = this.adapter.subscribeCandidates(
      code,
      (id, candDoc) => {
        if (gen !== this.sessionGen) return;
        if (this.seenCandidateIds.has(id)) return;
        this.seenCandidateIds.add(id);
        if (candDoc.sender === this.role) return;
        if (candDoc.webrtcGen !== this.webrtcGen) return;

        const init: RTCIceCandidateInit = {
          candidate: candDoc.candidate.candidate,
          sdpMid: candDoc.candidate.sdpMid ?? undefined,
          sdpMLineIndex: candDoc.candidate.sdpMLineIndex ?? undefined,
          usernameFragment: candDoc.candidate.usernameFragment ?? undefined,
        };

        if (this.pc && this.hasRemoteDescription) {
          void this.pc.addIceCandidate(init).catch(() => {});
        } else {
          this.pendingRemoteCandidates.push(init);
        }
      },
      (err) => {
        if (gen !== this.sessionGen) return;
        console.warn('[Parcheesi Firestore] Candidates listener error:', err);
      },
    );
  }

  private createConfiguredPeerConnection(
    code: string,
    gen: number,
    negotiationGen: number,
  ): RTCPeerConnection | null {
    if (typeof RTCPeerConnection === 'undefined') {
      return null;
    }

    const pc = this.peerConnectionFactory({
      iceServers: buildIceServers(),
      iceCandidatePoolSize: 6,
    });

    pc.onicecandidate = (event) => {
      if (gen !== this.sessionGen || this.pc !== pc || !event.candidate) return;
      const serialized = sanitizeIceCandidate(
        typeof event.candidate.toJSON === 'function' ? event.candidate.toJSON() : event.candidate,
      );
      void this.adapter
        .addCandidate(code, {
          sender: this.role,
          webrtcGen: negotiationGen,
          candidate: serialized,
          createdAt: this.adapter.serverNow(),
        })
        .catch(() => {});
    };

    pc.ontrack = (event) => {
      if (gen !== this.sessionGen || this.pc !== pc) return;
      // Strictly audio-only: ignore any non-audio track
      if (event.track && event.track.kind !== 'audio') return;
      const incomingStream = event.streams?.[0] ?? null;
      if (incomingStream) {
        this.remoteStream = incomingStream;
        this.callbacks.onRemoteStream(incomingStream);
      } else if (event.track) {
        if (!this.remoteStream && typeof MediaStream !== 'undefined') {
          this.remoteStream = new MediaStream();
        }
        if (this.remoteStream) {
          this.remoteStream.addTrack(event.track);
          this.callbacks.onRemoteStream(this.remoteStream);
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (gen !== this.sessionGen || this.pc !== pc) return;
      const state = pc.iceConnectionState;
      if (state === 'connected' || state === 'completed') {
        this.clearIceRestartTimer();
        return;
      }
      if (state === 'failed') {
        this.clearIceRestartTimer();
        this.triggerIceRestart(code, gen);
      } else if (state === 'disconnected') {
        if (this.iceRestartTimer === null) {
          this.iceRestartTimer = setTimeout(() => {
            this.iceRestartTimer = null;
            if (gen !== this.sessionGen || this.pc !== pc) return;
            if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
              this.triggerIceRestart(code, gen);
            }
          }, ICE_DISCONNECT_RESTART_MS);
        }
      }
    };

    return pc;
  }

  /**
   * Audio-only track synchronization. Never attaches video tracks or video transceivers.
   */
  private syncAudioTrackOntoPeerConnection(pc: RTCPeerConnection, isOfferer: boolean): void {
    const stream = this.localStream;
    const audioTrack = stream?.getAudioTracks()[0] ?? null;

    if (typeof pc.getTransceivers === 'function' && pc.getTransceivers().length > 0) {
      const audioTr = pc
        .getTransceivers()
        .find((t) => t.receiver?.track?.kind === 'audio' || t.sender?.track?.kind === 'audio');
      if (audioTr) {
        if (audioTrack) {
          audioTr.direction = 'sendrecv';
          void audioTr.sender.replaceTrack(audioTrack).catch(() => {});
        } else {
          audioTr.direction = 'recvonly';
        }
        return;
      }
    }

    if (audioTrack && stream) {
      pc.addTrack(audioTrack, stream);
    } else if (isOfferer && typeof pc.addTransceiver === 'function') {
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }
  }

  private async flushPendingCandidates(pc: RTCPeerConnection, gen: number): Promise<void> {
    const queued = this.pendingRemoteCandidates;
    this.pendingRemoteCandidates = [];
    for (const cand of queued) {
      if (gen !== this.sessionGen || this.pc !== pc) return;
      try {
        await pc.addIceCandidate(cand);
      } catch {
        // Ignore stale candidate
      }
    }
  }

  private async startHostWebRtcOffer(
    code: string,
    gen: number,
    iceRestart: boolean,
  ): Promise<void> {
    if (gen !== this.sessionGen || this.role !== 'host' || !this.hasEnteredRoom) return;
    if (typeof RTCPeerConnection === 'undefined') return;

    const nextGen = this.webrtcGen + 1;
    this.webrtcGen = nextGen;
    this.hasRemoteDescription = false;
    this.pendingRemoteCandidates = [];

    if (!this.pc || !iceRestart) {
      this.closePeerConnection();
      const pc = this.createConfiguredPeerConnection(code, gen, nextGen);
      if (!pc) return;
      this.pc = pc;
      this.syncAudioTrackOntoPeerConnection(pc, true);
    } else {
      this.syncAudioTrackOntoPeerConnection(this.pc, true);
    }

    const pc = this.pc;
    if (!pc) return;

    try {
      if (iceRestart && typeof pc.restartIce === 'function') {
        pc.restartIce();
      }
      const offer = await pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
      if (gen !== this.sessionGen || this.pc !== pc) return;
      await pc.setLocalDescription(offer);
      if (gen !== this.sessionGen || this.pc !== pc || !offer.sdp) return;

      await this.adapter.updateRoom(code, {
        offer: { type: 'offer', sdp: offer.sdp.slice(0, 20000) },
        answer: null,
        webrtcGen: nextGen,
        hostHasAudio: Boolean(this.localStream && this.localStream.getAudioTracks().length > 0),
        hostMicMuted: this.localMicMuted,
        updatedAt: this.adapter.serverNow(),
      });
    } catch (err) {
      console.warn('[Parcheesi WebRTC][Host] Audio offer failed (non-blocking):', err);
    }
  }

  private async handleHostIncomingAnswer(answer: SdpPayload, gen: number): Promise<void> {
    if (gen !== this.sessionGen || !this.pc) return;
    const pc = this.pc;
    try {
      await pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp });
      if (gen !== this.sessionGen || this.pc !== pc) return;
      this.hasRemoteDescription = true;
      await this.flushPendingCandidates(pc, gen);
    } catch (err) {
      console.warn('[Parcheesi WebRTC][Host] Failed to apply audio answer:', err);
    }
  }

  private async handleGuestIncomingOffer(
    code: string,
    offer: SdpPayload,
    offerGen: number,
    gen: number,
  ): Promise<void> {
    if (gen !== this.sessionGen || this.role !== 'guest' || !this.hasEnteredRoom) return;
    if (typeof RTCPeerConnection === 'undefined') return;

    this.appliedOfferGen = offerGen;
    this.webrtcGen = offerGen;
    this.hasRemoteDescription = false;
    this.pendingRemoteCandidates = [];

    this.closePeerConnection();
    const pc = this.createConfiguredPeerConnection(code, gen, offerGen);
    if (!pc) return;
    this.pc = pc;

    try {
      await pc.setRemoteDescription({ type: 'offer', sdp: offer.sdp });
      if (gen !== this.sessionGen || this.pc !== pc) return;
      this.hasRemoteDescription = true;

      this.syncAudioTrackOntoPeerConnection(pc, false);

      const answer = await pc.createAnswer();
      if (gen !== this.sessionGen || this.pc !== pc) return;
      await pc.setLocalDescription(answer);
      if (gen !== this.sessionGen || this.pc !== pc || !answer.sdp) return;

      await this.adapter.updateRoom(code, {
        answer: { type: 'answer', sdp: answer.sdp.slice(0, 20000) },
        guestHasAudio: Boolean(this.localStream && this.localStream.getAudioTracks().length > 0),
        guestMicMuted: this.localMicMuted,
        updatedAt: this.adapter.serverNow(),
      });

      await this.flushPendingCandidates(pc, gen);
    } catch (err) {
      console.warn('[Parcheesi WebRTC][Guest] Audio answer failed (non-blocking):', err);
    }
  }

  public triggerIceRestart(code = this.activeRoomCode, gen = this.sessionGen): void {
    if (gen !== this.sessionGen || !this.hasEnteredRoom || !this.pc) return;
    if (typeof this.pc.restartIce === 'function') {
      try {
        this.pc.restartIce();
      } catch {
        // Ignore
      }
    }
    if (this.role === 'host') {
      void this.startHostWebRtcOffer(code, gen, true);
    }
  }

  /**
   * Hot-activates or swaps local audio-only microphone track mid-session without dropping the room.
   */
  public setLocalAudioStream(stream: MediaStream | null, micMuted = this.localMicMuted): void {
    this.localStream = stream;
    this.localMicMuted = micMuted;
    if (!this.hasEnteredRoom || !this.activeRoomCode) return;

    const code = this.activeRoomCode;
    const gen = this.sessionGen;
    const hasAudio = Boolean(stream && stream.getAudioTracks().length > 0);

    void this.adapter
      .updateRoom(code, {
        ...(this.role === 'host'
          ? { hostHasAudio: hasAudio, hostMicMuted: micMuted }
          : { guestHasAudio: hasAudio, guestMicMuted: micMuted }),
        updatedAt: this.adapter.serverNow(),
      })
      .catch(() => {});

    if (!hasAudio || !stream) return;

    if (!this.pc) {
      if (this.role === 'host' && this.guestJoinedNotified) {
        void this.startHostWebRtcOffer(code, gen, false);
      }
      return;
    }

    const newAudio = stream.getAudioTracks()[0] ?? null;
    const senders = typeof this.pc.getSenders === 'function' ? this.pc.getSenders() : [];
    const audioSender = senders.find((s) => s.track?.kind === 'audio');

    if (audioSender && newAudio) {
      void audioSender.replaceTrack(newAudio).catch(() => {});
      return;
    }

    if (this.role === 'host' && this.guestJoinedNotified) {
      void this.startHostWebRtcOffer(code, gen, false);
    }
  }

  /**
   * Syncs local mute indicator to Firestore so the partner's Pastel Voice Avatar reflects mute state live.
   */
  public syncMicMuted(muted: boolean): void {
    this.localMicMuted = muted;
    if (!this.hasEnteredRoom || !this.activeRoomCode) return;
    void this.adapter
      .updateRoom(this.activeRoomCode, {
        ...(this.role === 'host' ? { hostMicMuted: muted } : { guestMicMuted: muted }),
        updatedAt: this.adapter.serverNow(),
      })
      .catch(() => {});
  }

  /**
   * Host-only: launches Parcheesi simultaneously on both Host & Guest via non-destructive `updateDoc`.
   */
  public async startParcheesi(diceCount: ParchisiDiceCount): Promise<void> {
    if (!this.hasEnteredRoom || !this.activeRoomCode || this.role !== 'host') return;
    const safeDice: ParchisiDiceCount = diceCount === 1 ? 1 : 2;
    await this.adapter.updateRoom(this.activeRoomCode, {
      activeGame: 'parcheesi',
      status: 'playing',
      diceCount: safeDice,
      updatedAt: this.adapter.serverNow(),
    });
  }

  /**
   * Host-only: returns both Host & Guest smoothly to the Room Menu WITHOUT closing the room or voice call.
   */
  public async returnToRoomMenu(): Promise<void> {
    if (!this.hasEnteredRoom || !this.activeRoomCode || this.role !== 'host') return;
    const hasGuest = Boolean(this.latestRoom?.guestName) || this.guestJoinedNotified;
    await this.adapter.updateRoom(this.activeRoomCode, {
      activeGame: null,
      status: hasGuest ? 'connected' : 'waiting',
      updatedAt: this.adapter.serverNow(),
    });
  }

  /**
   * Host-only: updates Parcheesi 1-Dice / 2-Dice preference live in Firestore Room Menu & game.
   */
  public syncDiceCount(diceCount: ParchisiDiceCount): void {
    if (!this.hasEnteredRoom || !this.activeRoomCode || this.role !== 'host') return;
    const safeDice: ParchisiDiceCount = diceCount === 1 ? 1 : 2;
    void this.adapter
      .updateRoom(this.activeRoomCode, {
        diceCount: safeDice,
        updatedAt: this.adapter.serverNow(),
      })
      .catch(() => {});
  }

  /**
   * Appends a Live Chat message or Quick Reaction into `rooms/{code}/chat`.
   */
  public async sendChatMessage(
    text: string,
    kind: 'text' | 'reaction' = 'text',
  ): Promise<void> {
    if (!this.hasEnteredRoom || !this.activeRoomCode) return;
    const trimmed = text.trim().slice(0, 280);
    if (!trimmed) return;
    await this.adapter.addChat(this.activeRoomCode, {
      sender: this.role,
      senderName: sanitizePlayerName(this.localName, this.role === 'host' ? 'Hôte' : 'Invité'),
      text: trimmed,
      kind,
      createdAt: this.adapter.serverNow(),
    });
  }

  /**
   * Sends an authoritative Parcheesi game event via `rooms/{code}/messages`.
   */
  public sendEvent(msg: PeerMessage): void {
    if (!this.hasEnteredRoom || !this.activeRoomCode) return;
    const cleanPayload = stripUndefinedDeep(msg);

    if (
      this.role === 'host' &&
      (cleanPayload.type === 'PARCHISI_CONFIG' || cleanPayload.type === 'PARCHISI_START') &&
      (cleanPayload.diceCount === 1 || cleanPayload.diceCount === 2)
    ) {
      this.syncDiceCount(cleanPayload.diceCount);
    }

    void this.adapter
      .addMessage(this.activeRoomCode, {
        sender: this.role,
        payload: cleanPayload,
        createdAt: this.adapter.serverNow(),
      })
      .catch((err) => {
        console.warn('[Parcheesi Firestore] Failed to send Parcheesi event:', err);
      });
  }

  public sendData(msg: PeerMessage): void {
    this.sendEvent(msg);
  }

  /**
   * Cleanly destroys listeners, closes audio RTCPeerConnection, and ONLY closes remote doc
   * when `closeRemoteDoc: true` (explicit confirmed Leave Room).
   */
  public destroy(options?: { closeRemoteDoc?: boolean }): void {
    const prevCode = this.activeRoomCode;
    const shouldCloseRemote = Boolean(options?.closeRemoteDoc && prevCode);

    this.sessionGen += 1;
    this.hasEnteredRoom = false;
    this.guestJoinedNotified = false;
    this.activeRoomCode = '';
    this.latestRoom = null;
    this.seenChatIds.clear();
    this.seenMessageIds.clear();
    this.seenCandidateIds.clear();
    this.unsubscribeAll();
    this.closePeerConnection();
    this.remoteStream = null;

    if (shouldCloseRemote) {
      void this.adapter
        .updateRoom(prevCode, {
          status: 'closed',
          activeGame: null,
          updatedAt: this.adapter.serverNow(),
        })
        .catch(() => {});
    }
  }
}
