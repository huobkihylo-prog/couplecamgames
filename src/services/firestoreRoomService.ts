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
import type { ParchisiDiceCount, PeerMessage, ScreenView } from '../types/duoplay';
import {
  db,
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

export type RoomRole = 'host' | 'guest';

export interface SdpPayload {
  type: 'offer' | 'answer';
  sdp: string;
}

export interface FirestoreRoomDoc {
  hostName: string;
  guestName: string;
  status: 'waiting' | 'connected' | 'closed';
  currentGame: string;
  scores: Record<string, number>;
  diceCount: ParchisiDiceCount;
  offer?: SdpPayload | null;
  answer?: SdpPayload | null;
  webrtcGen: number;
  hostHasStream: boolean;
  guestHasStream: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
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

export interface HostRoomStateSnapshot {
  currentGame?: ScreenView;
  scores?: Record<string, number>;
  diceCount?: ParchisiDiceCount;
}

export interface FirestoreRoomCallbacks {
  onStatusChange: (
    status: 'creating' | 'waiting' | 'connecting' | 'connected' | 'disconnected' | 'error',
    message?: string,
  ) => void;
  onRoomCodeChange?: (code: string) => void;
  onRemoteStream: (stream: MediaStream | null) => void;
  onMessage: (msg: PeerMessage) => void;
  getHostRoomState?: () => HostRoomStateSnapshot;
}

/**
 * Pluggable transport adapter so pure unit tests can exercise the full Host/Guest
 * room lifecycle, messaging, and WebRTC signaling deterministically without live network calls.
 */
export interface FirestoreTransportAdapter {
  getRoom: (code: string) => Promise<FirestoreRoomDoc | null>;
  createRoom: (code: string, data: FirestoreRoomDoc) => Promise<void>;
  updateRoom: (code: string, patch: Record<string, unknown>) => Promise<void>;
  subscribeRoom: (
    code: string,
    onData: (room: FirestoreRoomDoc | null) => void,
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

const DEFAULT_FIRESTORE_ADAPTER: FirestoreTransportAdapter = {
  async getRoom(code) {
    const path = `rooms/${code}`;
    try {
      const snap = await getDoc(doc(db, 'rooms', code));
      return snap.exists() ? (snap.data() as FirestoreRoomDoc) : null;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }
  },
  async createRoom(code, data) {
    const path = `rooms/${code}`;
    try {
      await setDoc(doc(db, 'rooms', code), data);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  },
  async updateRoom(code, patch) {
    const path = `rooms/${code}`;
    try {
      await updateDoc(doc(db, 'rooms', code), patch);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },
  subscribeRoom(code, onData, onError) {
    const path = `rooms/${code}`;
    return onSnapshot(
      doc(db, 'rooms', code),
      (snap) => {
        onData(snap.exists() ? (snap.data() as FirestoreRoomDoc) : null);
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

const REALTIME_DATACHANNEL_INTERVAL_MS = 32; // ~30fps over direct WebRTC DataChannel
const REALTIME_FIRESTORE_FALLBACK_INTERVAL_MS = 320; // Quota-safe ~3Hz fallback over Firestore
const ICE_DISCONNECT_RESTART_MS = 3500;

/**
 * Cloud Firestore + Native WebRTC (`RTCPeerConnection`) Room Manager.
 *
 * - Zero PeerJS dependency.
 * - Instant room entry (< 1s) independent of camera/mic permissions via `rooms/{code}`.
 * - Lossless real-time game events via `rooms/{code}/messages` (`addDoc` + `onSnapshot`).
 * - Background native `RTCPeerConnection` with Firestore SDP (`offer`/`answer`) and
 *   trickle ICE (`rooms/{code}/candidates`), hot-camera `replaceTrack` / renegotiation,
 *   and automatic `restartIce()` on video drops.
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
  private hasEnteredRoom = false;

  // Firestore listeners
  private unsubRoom: Unsubscribe | null = null;
  private unsubMessages: Unsubscribe | null = null;
  private unsubCandidates: Unsubscribe | null = null;
  private seenMessageIds = new Set<string>();
  private seenCandidateIds = new Set<string>();
  private initialMessagesHydrated = false;

  // Native WebRTC state
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private webrtcGen = 0;
  private appliedOfferGen = -1;
  private appliedAnswerGen = -1;
  private hasRemoteDescription = false;
  private pendingRemoteCandidates: RTCIceCandidateInit[] = [];
  private iceRestartTimer: ReturnType<typeof setTimeout> | null = null;
  private lastRealtimeSendByType = new Map<string, number>();
  private lastKnownGuestHasStream = false;

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
    if (this.dataChannel) {
      try {
        this.dataChannel.onmessage = null;
        this.dataChannel.onopen = null;
        this.dataChannel.onclose = null;
        this.dataChannel.close();
      } catch {
        // Ignore close errors
      }
      this.dataChannel = null;
    }
    if (this.pc) {
      try {
        this.pc.onicecandidate = null;
        this.pc.ontrack = null;
        this.pc.ondatachannel = null;
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
    if (this.unsubRoom) {
      try {
        this.unsubRoom();
      } catch {
        // Ignore
      }
      this.unsubRoom = null;
    }
    if (this.unsubMessages) {
      try {
        this.unsubMessages();
      } catch {
        // Ignore
      }
      this.unsubMessages = null;
    }
    if (this.unsubCandidates) {
      try {
        this.unsubCandidates();
      } catch {
        // Ignore
      }
      this.unsubCandidates = null;
    }
  }

  /**
   * Host creates `rooms/{code}` via `setDoc()` and listens in real time via `onSnapshot()`.
   */
  public async createHostRoom(
    code: string,
    hostName: string,
    stream: MediaStream | null,
    attempt = 0,
  ): Promise<void> {
    this.destroy({ closeRemoteDoc: false });
    const gen = this.sessionGen;
    const cleanCode = normalizeRoomCode(code) || generateRoomCode();
    const cleanHostName = sanitizePlayerName(hostName, 'Hôte');

    this.role = 'host';
    this.activeRoomCode = cleanCode;
    this.localName = cleanHostName;
    this.localStream = stream;
    this.hasEnteredRoom = false;
    this.webrtcGen = 0;
    this.appliedOfferGen = -1;
    this.appliedAnswerGen = -1;
    this.lastKnownGuestHasStream = false;

    this.callbacks.onStatusChange('creating', `Ouverture du salon ${cleanCode}...`);

    try {
      // Avoid colliding with an already-existing room doc (regenerate fresh 4-char code)
      const existing = await this.adapter.getRoom(cleanCode);
      if (gen !== this.sessionGen) return;

      if (existing && attempt < 3) {
        const freshCode = generateRoomCode();
        this.callbacks.onRoomCodeChange?.(freshCode);
        await this.createHostRoom(freshCode, cleanHostName, stream, attempt + 1);
        return;
      }

      const snapshot = this.callbacks.getHostRoomState?.() ?? {};
      const roomDoc: FirestoreRoomDoc = {
        hostName: cleanHostName,
        guestName: '',
        status: 'waiting',
        currentGame: snapshot.currentGame && snapshot.currentGame !== 'lobby' ? snapshot.currentGame : 'hub',
        scores: stripUndefinedDeep(snapshot.scores ?? {}),
        diceCount: snapshot.diceCount === 1 ? 1 : 2,
        offer: null,
        answer: null,
        webrtcGen: 0,
        hostHasStream: Boolean(stream),
        guestHasStream: false,
        createdAt: this.adapter.serverNow(),
        updatedAt: this.adapter.serverNow(),
      };

      await this.adapter.createRoom(cleanCode, roomDoc);
      if (gen !== this.sessionGen) return;

      this.callbacks.onStatusChange(
        'waiting',
        `Salon ${cleanCode} ouvert — en attente de ton/ta partenaire.`,
      );

      this.attachRoomListener(cleanCode, gen);
    } catch (err) {
      if (gen !== this.sessionGen) return;
      this.destroy({ closeRemoteDoc: false });
      this.callbacks.onStatusChange('error', formatUserFriendlyFirestoreError(err));
    }
  }

  /**
   * Guest verifies `rooms/{code}` with `getDoc()` and updates `guestName` + `status: 'connected'`
   * via `updateDoc()` so entry into the Hub takes < 1 second, independent of camera/mic.
   */
  public async joinGuestRoom(
    code: string,
    guestName: string,
    stream: MediaStream | null,
  ): Promise<void> {
    this.destroy({ closeRemoteDoc: false });
    const gen = this.sessionGen;
    const cleanCode = normalizeRoomCode(code);
    const cleanGuestName = sanitizePlayerName(guestName, 'Invité');

    if (cleanCode.length !== 4) {
      this.callbacks.onStatusChange('error', ERR_ROOM_NOT_FOUND);
      return;
    }

    this.role = 'guest';
    this.activeRoomCode = cleanCode;
    this.localName = cleanGuestName;
    this.localStream = stream;
    this.hasEnteredRoom = false;
    this.webrtcGen = 0;
    this.appliedOfferGen = -1;
    this.appliedAnswerGen = -1;

    this.callbacks.onStatusChange('connecting', `Connexion au salon ${cleanCode}...`);

    try {
      const room = await this.adapter.getRoom(cleanCode);
      if (gen !== this.sessionGen) return;

      if (!room || room.status === 'closed') {
        this.destroy({ closeRemoteDoc: false });
        this.callbacks.onStatusChange('error', ERR_ROOM_NOT_FOUND);
        return;
      }

      // Immediately update guestName + status='connected' -> Guest enters Hub in < 1s!
      await this.adapter.updateRoom(cleanCode, {
        guestName: cleanGuestName,
        status: 'connected',
        guestHasStream: Boolean(stream),
        updatedAt: this.adapter.serverNow(),
      });
      if (gen !== this.sessionGen) return;

      // Notify app of Host name and active game immediately
      this.callbacks.onMessage({
        type: 'JOIN_ACCEPTED',
        code: cleanCode,
        hostName: room.hostName || 'Hôte',
        currentGame: (room.currentGame as ScreenView) || 'hub',
        scores: room.scores ?? {},
        hasStream: Boolean(room.hostHasStream),
      });
      this.callbacks.onMessage({
        type: 'HELLO',
        name: room.hostName || 'Hôte',
        role: 'host',
        hasStream: Boolean(room.hostHasStream),
      });

      this.enterRoomSession(cleanCode, gen);
      this.attachRoomListener(cleanCode, gen);

      // If Host already published an offer, answer it right away in the background
      if (room.offer && room.webrtcGen > 0) {
        void this.handleGuestIncomingOffer(cleanCode, room.offer, room.webrtcGen, gen);
      }
    } catch (err) {
      if (gen !== this.sessionGen) return;
      this.destroy({ closeRemoteDoc: false });
      this.callbacks.onStatusChange('error', formatUserFriendlyFirestoreError(err));
    }
  }

  private enterRoomSession(code: string, gen: number): void {
    if (gen !== this.sessionGen || this.hasEnteredRoom) return;
    this.hasEnteredRoom = true;
    this.seenMessageIds.clear();
    this.seenCandidateIds.clear();
    this.initialMessagesHydrated = false;

    // Subscribe to real-time game messages & ICE candidates
    this.attachMessagesListener(code, gen);
    this.attachCandidatesListener(code, gen);

    this.callbacks.onStatusChange('connected');
  }

  private attachRoomListener(code: string, gen: number): void {
    this.unsubRoom = this.adapter.subscribeRoom(
      code,
      (room) => {
        if (gen !== this.sessionGen) return;
        if (!room || room.status === 'closed') {
          if (this.hasEnteredRoom) {
            this.hasEnteredRoom = false;
            this.closePeerConnection();
            this.remoteStream = null;
            this.callbacks.onRemoteStream(null);
            this.callbacks.onStatusChange('disconnected', 'Ton/ta partenaire a quitté le salon.');
          }
          return;
        }

        if (this.role === 'host') {
          // Guest just joined!
          if (room.status === 'connected' && room.guestName && !this.hasEnteredRoom) {
            this.lastKnownGuestHasStream = Boolean(room.guestHasStream);
            this.callbacks.onMessage({
              type: 'HELLO',
              name: room.guestName,
              role: 'guest',
              hasStream: Boolean(room.guestHasStream),
            });
            this.enterRoomSession(code, gen);
            // Start non-blocking background WebRTC video/audio + DataChannel offer
            void this.startHostWebRtcOffer(code, gen, false);
            return;
          }

          if (this.hasEnteredRoom) {
            // Apply Guest WebRTC answer once per webrtcGen
            if (
              room.answer &&
              room.webrtcGen === this.webrtcGen &&
              this.appliedAnswerGen !== room.webrtcGen
            ) {
              this.appliedAnswerGen = room.webrtcGen;
              void this.handleHostIncomingAnswer(room.answer, gen);
            }

            // If Guest enabled camera mid-game after joining without one, renegotiate cleanly
            const guestNowHasStream = Boolean(room.guestHasStream);
            if (guestNowHasStream && !this.lastKnownGuestHasStream) {
              this.lastKnownGuestHasStream = true;
              void this.startHostWebRtcOffer(code, gen, false);
            } else {
              this.lastKnownGuestHasStream = guestNowHasStream;
            }
          }
        } else if (this.role === 'guest') {
          // Apply Host WebRTC offer whenever Host publishes a new webrtcGen (initial, hot-cam, or ICE restart)
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
        this.callbacks.onStatusChange('error', formatUserFriendlyFirestoreError(err));
      },
    );
  }

  private attachMessagesListener(code: string, gen: number): void {
    const joinedAtMs = Date.now() - 1500;
    this.unsubMessages = this.adapter.subscribeMessages(
      code,
      (id, msgDoc) => {
        if (gen !== this.sessionGen) return;
        if (this.seenMessageIds.has(id)) return;
        this.seenMessageIds.add(id);

        // Ignore our own echoes
        if (msgDoc.sender === this.role) return;

        // Ignore stale messages from long before we joined (if createdAt is a Firestore Timestamp)
        if (!this.initialMessagesHydrated) {
          const ts = msgDoc.createdAt as { toMillis?: () => number } | undefined;
          if (ts && typeof ts.toMillis === 'function' && ts.toMillis() < joinedAtMs) {
            return;
          }
        }

        const payload = msgDoc.payload;
        if (payload && typeof payload === 'object' && 'type' in payload) {
          this.callbacks.onMessage(payload);
        }
      },
      (err) => {
        if (gen !== this.sessionGen) return;
        console.warn('[CoupleCam Firestore] Messages listener error:', err);
      },
    );
    // Mark initial hydration window finished shortly after subscription attaches
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
          void this.pc.addIceCandidate(init).catch(() => {
            // Ignore late/incompatible candidates during ICE restart
          });
        } else {
          this.pendingRemoteCandidates.push(init);
        }
      },
      (err) => {
        if (gen !== this.sessionGen) return;
        console.warn('[CoupleCam Firestore] Candidates listener error:', err);
      },
    );
  }

  private createConfiguredPeerConnection(code: string, gen: number, negotiationGen: number): RTCPeerConnection | null {
    if (typeof RTCPeerConnection === 'undefined') {
      return null;
    }

    const pc = this.peerConnectionFactory({
      iceServers: buildIceServers(),
      iceCandidatePoolSize: 8,
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
        .catch(() => {
          // Non-fatal: trickle candidate failed to write
        });
    };

    pc.ontrack = (event) => {
      if (gen !== this.sessionGen || this.pc !== pc) return;
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

    pc.ondatachannel = (event) => {
      if (gen !== this.sessionGen || this.pc !== pc) return;
      this.attachDataChannel(event.channel, gen);
    };

    return pc;
  }

  private attachDataChannel(channel: RTCDataChannel, gen: number): void {
    this.dataChannel = channel;
    channel.onmessage = (event) => {
      if (gen !== this.sessionGen) return;
      try {
        const parsed = JSON.parse(String(event.data)) as PeerMessage;
        if (parsed && typeof parsed === 'object' && 'type' in parsed) {
          this.callbacks.onMessage(parsed);
        }
      } catch {
        // Ignore malformed packets
      }
    };
  }

  private syncTracksOntoPeerConnection(pc: RTCPeerConnection, isOfferer: boolean): void {
    const stream = this.localStream;
    const videoTrack = stream?.getVideoTracks()[0] ?? null;
    const audioTrack = stream?.getAudioTracks()[0] ?? null;

    if (typeof pc.getTransceivers === 'function' && pc.getTransceivers().length > 0) {
      const transceivers = pc.getTransceivers();
      const videoTr = transceivers.find(
        (t) => t.receiver?.track?.kind === 'video' || t.sender?.track?.kind === 'video',
      );
      const audioTr = transceivers.find(
        (t) => t.receiver?.track?.kind === 'audio' || t.sender?.track?.kind === 'audio',
      );
      if (videoTr) {
        if (videoTrack) {
          videoTr.direction = 'sendrecv';
          void videoTr.sender.replaceTrack(videoTrack).catch(() => {});
        } else {
          videoTr.direction = 'recvonly';
        }
      } else if (videoTrack && stream) {
        pc.addTrack(videoTrack, stream);
      } else if (isOfferer && typeof pc.addTransceiver === 'function') {
        pc.addTransceiver('video', { direction: 'recvonly' });
      }

      if (audioTr) {
        if (audioTrack) {
          audioTr.direction = 'sendrecv';
          void audioTr.sender.replaceTrack(audioTrack).catch(() => {});
        } else {
          audioTr.direction = 'recvonly';
        }
      } else if (audioTrack && stream) {
        pc.addTrack(audioTrack, stream);
      } else if (isOfferer && typeof pc.addTransceiver === 'function') {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }
      return;
    }

    if (stream) {
      if (videoTrack) pc.addTrack(videoTrack, stream);
      if (audioTrack) pc.addTrack(audioTrack, stream);
    }
    if (isOfferer && typeof pc.addTransceiver === 'function') {
      if (!videoTrack) pc.addTransceiver('video', { direction: 'recvonly' });
      if (!audioTrack) pc.addTransceiver('audio', { direction: 'recvonly' });
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
      if (typeof pc.createDataChannel === 'function') {
        const dc = pc.createDataChannel('couplecam-realtime', { ordered: false, maxRetransmits: 0 });
        this.attachDataChannel(dc, gen);
      }
      this.syncTracksOntoPeerConnection(pc, true);
    } else {
      this.syncTracksOntoPeerConnection(this.pc, true);
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
        hostHasStream: Boolean(this.localStream),
        updatedAt: this.adapter.serverNow(),
      });
    } catch (err) {
      console.warn('[CoupleCam WebRTC][Host] Offer negotiation failed (non-blocking):', err);
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
      console.warn('[CoupleCam WebRTC][Host] Failed to apply answer:', err);
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

      this.syncTracksOntoPeerConnection(pc, false);

      const answer = await pc.createAnswer();
      if (gen !== this.sessionGen || this.pc !== pc) return;
      await pc.setLocalDescription(answer);
      if (gen !== this.sessionGen || this.pc !== pc || !answer.sdp) return;

      await this.adapter.updateRoom(code, {
        answer: { type: 'answer', sdp: answer.sdp.slice(0, 20000) },
        guestHasStream: Boolean(this.localStream),
        updatedAt: this.adapter.serverNow(),
      });

      await this.flushPendingCandidates(pc, gen);
    } catch (err) {
      console.warn('[CoupleCam WebRTC][Guest] Answer negotiation failed (non-blocking):', err);
    }
  }

  /**
   * Automatically calls `restartIce()` on video disconnect/failure without closing the Firestore room.
   */
  public triggerIceRestart(code = this.activeRoomCode, gen = this.sessionGen): void {
    if (gen !== this.sessionGen || !this.hasEnteredRoom || !this.pc) return;
    if (typeof this.pc.restartIce === 'function') {
      try {
        this.pc.restartIce();
      } catch {
        // Ignore restartIce errors
      }
    }
    if (this.role === 'host') {
      void this.startHostWebRtcOffer(code, gen, true);
    }
  }

  /**
   * Hot-activates or swaps local webcam/mic tracks mid-session without dropping the room or active game.
   */
  public setLocalStream(stream: MediaStream | null): void {
    this.localStream = stream;
    if (!this.hasEnteredRoom || !this.activeRoomCode) return;

    const code = this.activeRoomCode;
    const gen = this.sessionGen;
    const hasStream = Boolean(stream);

    // Update Firestore stream flag (also notifies Host to renegotiate if Guest turned camera ON mid-game)
    void this.adapter
      .updateRoom(code, {
        ...(this.role === 'host' ? { hostHasStream: hasStream } : { guestHasStream: hasStream }),
        updatedAt: this.adapter.serverNow(),
      })
      .catch(() => {
        // Non-fatal
      });

    if (!stream || !this.pc) {
      if (stream && this.role === 'host') {
        void this.startHostWebRtcOffer(code, gen, false);
      }
      return;
    }

    const newVideo = stream.getVideoTracks()[0] ?? null;
    const newAudio = stream.getAudioTracks()[0] ?? null;
    const senders = typeof this.pc.getSenders === 'function' ? this.pc.getSenders() : [];
    const videoSender = senders.find((s) => s.track?.kind === 'video');
    const audioSender = senders.find((s) => s.track?.kind === 'audio');

    if (videoSender && newVideo) {
      void videoSender.replaceTrack(newVideo).catch(() => {});
      if (audioSender && newAudio) {
        void audioSender.replaceTrack(newAudio).catch(() => {});
      }
      return;
    }

    // Player joined without camera and just enabled it -> renegotiate tracks cleanly
    if (this.role === 'host') {
      void this.startHostWebRtcOffer(code, gen, false);
    }
    // For Guest, updating `guestHasStream: true` above automatically triggers Host's renegotiation offer!
  }

  /**
   * Syncs room-level metadata (`currentGame`, `scores`, `diceCount`) onto `rooms/{code}`.
   */
  public syncRoomMetadata(patch: {
    currentGame?: ScreenView;
    scores?: Record<string, number>;
    diceCount?: ParchisiDiceCount;
  }): void {
    if (!this.hasEnteredRoom || !this.activeRoomCode) return;
    const updatePatch: Record<string, unknown> = {
      updatedAt: this.adapter.serverNow(),
    };
    if (patch.currentGame && patch.currentGame !== 'lobby') {
      updatePatch.currentGame = patch.currentGame;
    }
    if (patch.scores) {
      updatePatch.scores = stripUndefinedDeep(patch.scores);
    }
    if (patch.diceCount === 1 || patch.diceCount === 2) {
      updatePatch.diceCount = patch.diceCount;
    }
    void this.adapter.updateRoom(this.activeRoomCode, updatePatch).catch(() => {
      // Non-fatal metadata sync failure
    });
  }

  /**
   * Sends an authoritative game event via Firestore `rooms/{code}/messages` (`addDoc`)
   * so moves, dice rolls, scores, and emoji reactions are never lost.
   */
  public sendEvent(msg: PeerMessage): void {
    if (!this.hasEnteredRoom || !this.activeRoomCode) return;
    const cleanPayload = stripUndefinedDeep(msg);

    // Keep room-level document in sync for game switches and Parcheesi diceCount
    if (cleanPayload.type === 'SELECT_GAME') {
      this.syncRoomMetadata({ currentGame: cleanPayload.game });
    } else if (cleanPayload.type === 'RETURN_HUB') {
      this.syncRoomMetadata({ currentGame: 'hub' });
    } else if (cleanPayload.type === 'PARCHISI_CONFIG' || cleanPayload.type === 'PARCHISI_START') {
      if (cleanPayload.diceCount === 1 || cleanPayload.diceCount === 2) {
        this.syncRoomMetadata({ diceCount: cleanPayload.diceCount });
      }
    }

    void this.adapter
      .addMessage(this.activeRoomCode, {
        sender: this.role,
        payload: cleanPayload,
        createdAt: this.adapter.serverNow(),
      })
      .catch((err) => {
        console.warn('[CoupleCam Firestore] Failed to send event:', err);
      });
  }

  /**
   * Alias preserving the requested `sendData` API surface.
   */
  public sendData(msg: PeerMessage): void {
    this.sendEvent(msg);
  }

  /**
   * Sends high-frequency ephemeral frames (FACE_FRAME, HAND_FRAME, cursor, physics sync)
   * over native WebRTC DataChannel at ~30fps when open, falling back to throttled Firestore messages.
   */
  public sendRealtime(msg: PeerMessage): void {
    if (!this.hasEnteredRoom || !this.activeRoomCode) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const lastAt = this.lastRealtimeSendByType.get(msg.type) ?? 0;

    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      if (now - lastAt < REALTIME_DATACHANNEL_INTERVAL_MS) return;
      this.lastRealtimeSendByType.set(msg.type, now);
      try {
        this.dataChannel.send(JSON.stringify(msg));
        return;
      } catch {
        // Fall through to throttled Firestore fallback
      }
    }

    // Fallback when WebRTC DataChannel is not open: throttled Firestore message
    if (now - lastAt < REALTIME_FIRESTORE_FALLBACK_INTERVAL_MS) return;
    this.lastRealtimeSendByType.set(msg.type, now);
    this.sendEvent(msg);
  }

  /**
   * Cleanly destroys listeners, closes RTCPeerConnection, and optionally marks the room as closed.
   */
  public destroy(options?: { closeRemoteDoc?: boolean }): void {
    const prevCode = this.activeRoomCode;
    const shouldCloseRemote = Boolean(options?.closeRemoteDoc && prevCode);

    this.sessionGen += 1;
    this.hasEnteredRoom = false;
    this.activeRoomCode = '';
    this.lastRealtimeSendByType.clear();
    this.seenMessageIds.clear();
    this.seenCandidateIds.clear();
    this.unsubscribeAll();
    this.closePeerConnection();
    this.remoteStream = null;

    if (shouldCloseRemote) {
      void this.adapter
        .updateRoom(prevCode, {
          status: 'closed',
          updatedAt: this.adapter.serverNow(),
        })
        .catch(() => {
          // Ignore close errors if room was never created or already closed
        });
    }
  }
}
