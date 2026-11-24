import Peer, { type DataConnection, type MediaConnection } from 'peerjs';
import type { PeerMessage } from '../types/duoplay';

/**
 * Verified, fast public STUN servers for WebRTC NAT traversal across distinct devices & networks.
 * Keeps the pool concise (4 servers) and excludes dead/unresolvable endpoints (e.g. twilio/openrelay).
 */
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export const ROOM_PREFIX = 'couplecam-room-';
export const CONNECT_TIMEOUT_MS = 10000;

const JOIN_RETRY_PING_MS = 1000;
const HEARTBEAT_INTERVAL_MS = 4000;
const ICE_DISCONNECT_GRACE_MS = 6000;

export function generateRoomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * Cleans and normalizes room codes identically on both Host and Partner:
 * extracts `?room=...` if a full share URL was pasted, strips whitespace & punctuation,
 * unifies to uppercase, max 4 characters.
 */
export function normalizeRoomCode(raw: string): string {
  const trimmed = raw.trim();
  const roomQueryMatch = trimmed.match(/[?&]room=([^&#]+)/i);
  const candidate = roomQueryMatch ? decodeURIComponent(roomQueryMatch[1]) : trimmed;
  return candidate
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4);
}

/**
 * Builds the deterministic lowercase PeerJS peer ID from any raw room code.
 */
export function getPeerRoomId(code: string): string {
  return `${ROOM_PREFIX}${normalizeRoomCode(code).toLowerCase()}`;
}

export function isSignalingOnlyError(errType: string | undefined): boolean {
  return (
    errType === 'network' ||
    errType === 'disconnected' ||
    errType === 'socket-error' ||
    errType === 'socket-closed' ||
    errType === 'server-error'
  );
}

export interface PeerServiceCallbacks {
  onStatusChange: (
    status: 'creating' | 'waiting' | 'connecting' | 'connected' | 'disconnected' | 'error',
    message?: string,
  ) => void;
  onRoomCodeChange?: (code: string) => void;
  onRemoteStream: (stream: MediaStream | null) => void;
  onMessage: (msg: PeerMessage) => void;
}

/**
 * Hybrid PeerJS (WebRTC video/audio/direct P2P) + WebSocket Room Relay (`/ws/room`) manager.
 * - Normalizes room codes identically on Host and Partner.
 * - Host immediately listens for incoming connections on BOTH PeerJS & WebSocket relay
 *   and replies `JOIN_CONFIRMED` as soon as Partner connects.
 * - Partner automatically leaves "en cours..." and enters the Hub as soon as Host confirms.
 * - Strict 10-second maximum timeout (`CONNECT_TIMEOUT_MS`) with step-by-step console.log diagnostics.
 * - Direct WebRTC MediaConnection streams webcam + mic whenever NAT allows, while game sync
 *   remains 100% immune to Symmetric NAT / 4G / strict firewall blocks.
 */
export class DuoPeerService {
  private peer: Peer | null = null;
  private dataConn: DataConnection | null = null;
  private mediaConn: MediaConnection | null = null;
  private relayWs: WebSocket | null = null;
  private relayHostReady = false;
  private relayGuestJoined = false;
  private relayRoomNotFound = false;
  private peerUnavailable = false;
  private hostWaitingNotified = false;

  private localStream: MediaStream | null = null;
  private callbacks: PeerServiceCallbacks;
  private lastRealtimeSendByType = new Map<string, number>();
  private localName = 'Moi';
  private role: 'host' | 'guest' = 'host';
  private activeRoomCode = '';
  private remotePeerId: string | null = null;
  private hasEnteredRoom = false;
  private hasSentMediaCall = false;
  private hasSentLocalMediaStream = false;

  // Monotonic generation counter prevents stale async close/error events from corrupting a new session
  private sessionGen = 0;
  private connectTimeoutTimer: number | null = null;
  private joinRetryTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private iceGraceTimer: number | null = null;
  private reconnectTimer: number | null = null;

  constructor(callbacks: PeerServiceCallbacks) {
    this.callbacks = callbacks;
  }

  private clearTimers() {
    if (this.connectTimeoutTimer !== null) {
      window.clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }
    if (this.joinRetryTimer !== null) {
      window.clearInterval(this.joinRetryTimer);
      this.joinRetryTimer = null;
    }
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.iceGraceTimer !== null) {
      window.clearTimeout(this.iceGraceTimer);
      this.iceGraceTimer = null;
    }
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private createPeerOptions() {
    return {
      pingInterval: 5000,
      config: {
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 4,
      },
    };
  }

  private getRelayWsUrl(): string | null {
    if (typeof window === 'undefined' || !window.location?.host) return null;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/room`;
  }

  private sendRelayControl(payload: Record<string, unknown>): boolean {
    if (this.relayWs && this.relayWs.readyState === WebSocket.OPEN) {
      try {
        this.relayWs.send(JSON.stringify(payload));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  private isRelayTransportOpen(): boolean {
    return Boolean(
      this.relayWs &&
        this.relayWs.readyState === WebSocket.OPEN &&
        (this.relayHostReady || this.relayGuestJoined),
    );
  }

  public setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
    if (
      stream &&
      this.peer &&
      !this.peer.destroyed &&
      this.hasEnteredRoom &&
      this.remotePeerId &&
      !this.hasSentLocalMediaStream
    ) {
      console.log('[CoupleCam P2P] Local stream became available mid-session, starting MediaConnection.');
      this.initiateMediaCall(this.remotePeerId, this.sessionGen);
    }
  }

  public createHostRoom(code: string, localName: string, stream: MediaStream | null, attempt = 0) {
    this.destroy();
    const gen = this.sessionGen;
    const cleanCode = normalizeRoomCode(code);
    const peerId = getPeerRoomId(cleanCode);

    this.localStream = stream;
    this.localName = localName;
    this.role = 'host';
    this.activeRoomCode = cleanCode;
    this.hasEnteredRoom = false;
    this.hostWaitingNotified = false;

    console.log(
      `[CoupleCam P2P][Host] Step 1: Creating room "${cleanCode}" (peerId="${peerId}", attempt=${attempt + 1})`,
    );
    this.callbacks.onStatusChange('creating', `Ouverture du salon ${cleanCode}...`);

    // 10-second max timeout for room opening across both Relay & PeerJS
    this.connectTimeoutTimer = window.setTimeout(() => {
      if (gen !== this.sessionGen) return;
      if (!this.hostWaitingNotified && !this.hasEnteredRoom) {
        console.log(
          `[CoupleCam P2P][Host] Timeout (${CONNECT_TIMEOUT_MS}ms): Room "${cleanCode}" failed to open on signaling server.`,
        );
        this.destroy();
        this.callbacks.onStatusChange(
          'error',
          'Délai dépassé (10 s) : impossible d’ouvrir le salon. Vérifie ta connexion et réessaie.',
        );
      }
    }, CONNECT_TIMEOUT_MS);

    // 1. Open instant WebSocket Room Relay so Partner can ALWAYS join regardless of Symmetric NAT
    this.openRelaySocket(gen, () => {
      if (gen !== this.sessionGen) return;
      console.log(`[CoupleCam P2P][Host] Step 1b (Relay): Registering host room "${cleanCode}" on /ws/room`);
      this.sendRelayControl({
        type: 'HOST_OPEN',
        code: cleanCode,
        name: localName,
      });
    });

    // 2. Open PeerJS P2P endpoint for direct WebRTC video/audio & direct DataConnection
    const peer = new Peer(peerId, this.createPeerOptions());
    this.peer = peer;

    // Listen for incoming Partner connections IMMEDIATELY before/upon room open
    peer.on('connection', (conn) => {
      if (gen !== this.sessionGen) {
        conn.close();
        return;
      }
      console.log(`[CoupleCam P2P][Host] Step 3 (PeerJS): Incoming DataConnection from partner peerId="${conn.peer}"`);
      this.attachDataConnection(conn, gen);
    });

    peer.on('call', (call) => {
      if (gen !== this.sessionGen) {
        call.close();
        return;
      }
      console.log(`[CoupleCam P2P][Host] Incoming MediaConnection from partner peerId="${call.peer}"`);
      this.answerMediaCall(call, gen);
    });

    peer.on('open', (assignedId) => {
      if (gen !== this.sessionGen) return;
      console.log(`[CoupleCam P2P][Host] Step 2 (PeerJS): Room "${cleanCode}" open and listening (assignedId="${assignedId}")`);
      this.notifyHostWaiting(gen);
    });

    peer.on('error', (err) => {
      if (gen !== this.sessionGen) return;
      const errType = (err as { type?: string })?.type;
      console.log(`[CoupleCam P2P][Host] PeerJS error: type="${errType ?? 'unknown'}" message="${err.message}"`);

      // Never disrupt an active session or open Relay room on PeerJS signaling hiccups
      if ((this.dataConn?.open || this.relayHostReady) && isSignalingOnlyError(errType)) {
        return;
      }

      if (errType === 'unavailable-id') {
        if (attempt < 3 && !this.hasEnteredRoom) {
          const freshCode = generateRoomCode();
          console.log(`[CoupleCam P2P][Host] Code "${cleanCode}" already taken, regenerating -> "${freshCode}"`);
          this.callbacks.onRoomCodeChange?.(freshCode);
          this.createHostRoom(freshCode, localName, stream, attempt + 1);
          return;
        }
        if (!this.relayHostReady) {
          this.destroy();
          this.callbacks.onStatusChange('error', 'Ce code est déjà utilisé. Réessaie pour en générer un autre.');
        }
      } else if (!this.relayHostReady) {
        this.destroy();
        this.callbacks.onStatusChange(
          'error',
          isSignalingOnlyError(errType)
            ? 'Impossible de joindre le serveur PeerJS public. Vérifie ta connexion et réessaie.'
            : err.message || 'Erreur de connexion PeerJS.',
        );
      }
    });

    peer.on('disconnected', () => {
      if (gen !== this.sessionGen || peer.destroyed) return;
      console.log('[CoupleCam P2P][Host] PeerJS signaling socket disconnected, scheduling reconnect...');
      this.scheduleSignalingReconnect(peer, gen);
    });
  }

  private notifyHostWaiting(gen: number) {
    if (gen !== this.sessionGen || this.hasEnteredRoom || this.hostWaitingNotified) return;
    this.hostWaitingNotified = true;
    if (this.connectTimeoutTimer !== null) {
      window.clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }
    this.callbacks.onStatusChange(
      'waiting',
      `Salon ${this.activeRoomCode} ouvert — en attente de ton/ta partenaire.`,
    );
  }

  public joinGuestRoom(code: string, localName: string, stream: MediaStream | null) {
    this.destroy();
    const gen = this.sessionGen;
    const cleanCode = normalizeRoomCode(code);
    const targetId = getPeerRoomId(cleanCode);

    this.localStream = stream;
    this.localName = localName;
    this.role = 'guest';
    this.activeRoomCode = cleanCode;
    this.remotePeerId = targetId;
    this.hasEnteredRoom = false;
    this.relayRoomNotFound = false;
    this.peerUnavailable = false;

    console.log(
      `[CoupleCam P2P][Partner] Step 1: Joining room "${cleanCode}" (targetId="${targetId}", raw="${code}")`,
    );
    this.callbacks.onStatusChange('connecting', `Connexion au salon ${cleanCode}...`);

    // Strict 10-second maximum timeout so Partner NEVER stays stuck on "en cours..."
    this.connectTimeoutTimer = window.setTimeout(() => {
      if (gen !== this.sessionGen || this.hasEnteredRoom) return;
      const iceState = this.dataConn?.peerConnection?.iceConnectionState ?? 'none';
      const dcOpen = Boolean(this.dataConn?.open);
      const wsState = this.relayWs?.readyState ?? -1;
      console.log(
        `[CoupleCam P2P][Partner] Timeout (${CONNECT_TIMEOUT_MS}ms) reached for room "${cleanCode}" (wsState=${wsState}, peerOpen=${Boolean(this.peer?.open)}, dcOpen=${dcOpen}, iceState="${iceState}"). Aborting.`,
      );
      this.destroy();
      this.callbacks.onStatusChange(
        'error',
        `Délai dépassé (10 s) : impossible d’entrer dans le salon ${cleanCode}. Vérifie le code, que l’hôte est toujours en attente, puis réessaie.`,
      );
    }, CONNECT_TIMEOUT_MS);

    // 1. Connect immediately via WebSocket Room Relay (`/ws/room`)
    this.openRelaySocket(gen, () => {
      if (gen !== this.sessionGen || this.hasEnteredRoom) return;
      console.log(`[CoupleCam P2P][Partner] Step 2 (Relay): Requesting entry into room "${cleanCode}" on /ws/room`);
      this.sendRelayControl({
        type: 'GUEST_JOIN',
        code: cleanCode,
        name: localName,
        hasStream: Boolean(this.localStream),
      });
    });

    // 2. Simultaneously connect via PeerJS for direct WebRTC video/audio & P2P DataConnection
    const peer = new Peer(this.createPeerOptions());
    this.peer = peer;

    peer.on('open', (myId) => {
      if (gen !== this.sessionGen || peer.destroyed) return;
      console.log(`[CoupleCam P2P][Partner] Step 2 (PeerJS): Local peer open (myId="${myId}"). Connecting to "${targetId}"...`);
      const conn = peer.connect(targetId, {
        serialization: 'json',
        reliable: true,
      });
      this.attachDataConnection(conn, gen);
    });

    peer.on('call', (call) => {
      if (gen !== this.sessionGen) {
        call.close();
        return;
      }
      console.log(`[CoupleCam P2P][Partner] Incoming MediaConnection from host peerId="${call.peer}"`);
      this.answerMediaCall(call, gen);
    });

    peer.on('error', (err) => {
      if (gen !== this.sessionGen) return;
      const errType = (err as { type?: string })?.type;
      console.log(`[CoupleCam P2P][Partner] PeerJS error: type="${errType ?? 'unknown'}" message="${err.message}"`);

      // Never disrupt an active session or active Relay room on PeerJS errors
      if (this.hasEnteredRoom && (this.dataConn?.open || this.isRelayTransportOpen())) {
        return;
      }

      if (errType === 'peer-unavailable') {
        this.peerUnavailable = true;
        // Abort immediately if Relay ALSO confirmed room doesn't exist (or relay is unavailable)
        const wsUnavailable = !this.relayWs || this.relayWs.readyState === WebSocket.CLOSED;
        if (this.relayRoomNotFound || wsUnavailable) {
          this.failRoomNotFound(gen, cleanCode);
        }
      } else if (!this.isRelayTransportOpen() && (!this.relayWs || this.relayWs.readyState === WebSocket.CLOSED)) {
        this.destroy();
        this.callbacks.onStatusChange(
          'error',
          isSignalingOnlyError(errType)
            ? 'Connexion au serveur interrompue. Vérifie ton réseau et réessaie.'
            : err.message || 'Connexion au salon échouée.',
        );
      }
    });

    peer.on('disconnected', () => {
      if (gen !== this.sessionGen || peer.destroyed) return;
      console.log('[CoupleCam P2P][Partner] PeerJS signaling socket disconnected, scheduling reconnect...');
      this.scheduleSignalingReconnect(peer, gen);
    });
  }

  private failRoomNotFound(gen: number, cleanCode: string) {
    if (gen !== this.sessionGen || this.hasEnteredRoom) return;
    console.log(`[CoupleCam P2P][Partner] Room "${cleanCode}" does not exist on Relay or PeerJS -> aborting.`);
    this.destroy();
    this.callbacks.onStatusChange(
      'error',
      `Aucun salon actif trouvé pour le code ${cleanCode}. Demande à l’hôte de vérifier le code.`,
    );
  }

  private openRelaySocket(gen: number, onOpen: () => void) {
    const url = this.getRelayWsUrl();
    if (!url || typeof WebSocket === 'undefined') return;

    try {
      const ws = new WebSocket(url);
      this.relayWs = ws;

      ws.addEventListener('open', () => {
        if (gen !== this.sessionGen || this.relayWs !== ws) {
          ws.close();
          return;
        }
        onOpen();
      });

      ws.addEventListener('message', (ev) => {
        if (gen !== this.sessionGen || this.relayWs !== ws) return;
        let envelope: Record<string, unknown>;
        try {
          envelope = JSON.parse(String(ev.data)) as Record<string, unknown>;
        } catch {
          return;
        }

        const type = typeof envelope.type === 'string' ? envelope.type : '';

        if (type === 'RELAY_HOST_READY' && this.role === 'host') {
          this.relayHostReady = true;
          console.log(
            `[CoupleCam P2P][Host] Step 2 (Relay): Room "${this.activeRoomCode}" open and listening on /ws/room`,
          );
          this.notifyHostWaiting(gen);
          return;
        }

        if (type === 'RELAY_PARTNER_CONNECTED' && this.role === 'host') {
          const guestName = String(envelope.name ?? 'Partenaire');
          const guestHasStream = Boolean(envelope.hasStream);
          console.log(
            `[CoupleCam P2P][Host] Step 3 (Relay): Partner "${guestName}" arrived -> sending immediate JOIN_CONFIRMED`,
          );
          this.sendRelayData({
            type: 'JOIN_CONFIRMED',
            code: this.activeRoomCode,
            hostName: this.localName,
            hasStream: Boolean(this.localStream),
          });
          this.sendRelayData({
            type: 'HELLO',
            name: this.localName,
            role: 'host',
            hasStream: Boolean(this.localStream),
          });
          this.callbacks.onMessage({
            type: 'HELLO',
            name: guestName,
            role: 'guest',
            hasStream: guestHasStream,
          });
          this.markRoomEntered(gen, 'relay-partner-connected');
          return;
        }

        if (type === 'RELAY_JOINED_ROOM' && this.role === 'guest') {
          this.relayGuestJoined = true;
          const hostName = String(envelope.hostName ?? 'Hôte');
          console.log(
            `[CoupleCam P2P][Partner] Step 3 (Relay): Connected to room "${this.activeRoomCode}" (Host="${hostName}") -> sending JOIN_REQUEST`,
          );
          this.sendPartnerJoinHandshake(gen);
          this.startJoinRetryLoop(gen);
          return;
        }

        if (type === 'RELAY_ROOM_NOT_FOUND' && this.role === 'guest') {
          this.relayRoomNotFound = true;
          console.log(`[CoupleCam P2P][Partner] Relay reported room "${this.activeRoomCode}" not found.`);
          if (this.peerUnavailable) {
            this.failRoomNotFound(gen, this.activeRoomCode);
          }
          return;
        }

        if (type === 'RELAY_DATA') {
          const payload = envelope.data;
          if (payload && typeof payload === 'object' && 'type' in payload) {
            this.handleIncomingPeerMessage(payload as PeerMessage, gen, 'relay');
          }
          return;
        }

        if (type === 'RELAY_PEER_LEFT') {
          console.log(`[CoupleCam P2P] Relay reported partner left (reason="${String(envelope.reason ?? '')}")`);
          if (this.dataConn?.open) {
            // Direct P2P DataConnection is still alive, stay connected!
            return;
          }
          this.callbacks.onRemoteStream(null);
          if (this.hasEnteredRoom) {
            this.hasEnteredRoom = false;
            this.callbacks.onStatusChange('disconnected', 'Ton/ta partenaire a quitté le salon.');
          }
        }
      });

      ws.addEventListener('error', () => {
        if (gen !== this.sessionGen || this.relayWs !== ws) return;
        console.log('[CoupleCam P2P] Relay WebSocket warning (PeerJS remains active).');
      });

      ws.addEventListener('close', () => {
        if (gen !== this.sessionGen || this.relayWs !== ws) return;
        this.relayHostReady = false;
        this.relayGuestJoined = false;
        if (this.role === 'guest' && !this.hasEnteredRoom && this.peerUnavailable) {
          this.failRoomNotFound(gen, this.activeRoomCode);
        }
      });
    } catch {
      // Relay unavailable in non-server environments; PeerJS continues independently
    }
  }

  private sendRelayData(msg: PeerMessage): boolean {
    if (!this.isRelayTransportOpen()) return false;
    return this.sendRelayControl({
      type: 'RELAY_DATA',
      code: this.activeRoomCode,
      data: msg,
    });
  }

  private sendPartnerJoinHandshake(gen: number) {
    if (gen !== this.sessionGen || this.role !== 'guest') return;
    console.log(`[CoupleCam P2P][Partner] Step 4: Sending JOIN_REQUEST + HELLO for room "${this.activeRoomCode}"`);
    const joinReq: PeerMessage = {
      type: 'JOIN_REQUEST',
      code: this.activeRoomCode,
      name: this.localName,
      hasStream: Boolean(this.localStream),
    };
    const hello: PeerMessage = {
      type: 'HELLO',
      name: this.localName,
      role: 'guest',
      hasStream: Boolean(this.localStream),
    };
    this.sendEvent(joinReq);
    this.sendEvent(hello);
  }

  private startJoinRetryLoop(gen: number) {
    if (this.joinRetryTimer !== null) {
      window.clearInterval(this.joinRetryTimer);
    }
    this.joinRetryTimer = window.setInterval(() => {
      if (gen !== this.sessionGen || this.hasEnteredRoom) {
        if (this.joinRetryTimer !== null) {
          window.clearInterval(this.joinRetryTimer);
          this.joinRetryTimer = null;
        }
        return;
      }
      if (this.dataConn?.open || this.isRelayTransportOpen()) {
        console.log('[CoupleCam P2P][Partner] Re-sending JOIN_REQUEST awaiting Host confirmation...');
        this.sendPartnerJoinHandshake(gen);
      }
    }, JOIN_RETRY_PING_MS);
  }

  private scheduleSignalingReconnect(peer: Peer, gen: number) {
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (gen !== this.sessionGen || peer.destroyed) return;
      try {
        peer.reconnect();
      } catch {
        // Ignore reconnect race if already reconnecting
      }
    }, 1500);
  }

  private markRoomEntered(gen: number, reason: string, peerId?: string) {
    if (gen !== this.sessionGen) return;
    if (peerId) {
      this.remotePeerId = peerId;
    }
    if (this.hasEnteredRoom) return;
    this.hasEnteredRoom = true;

    if (this.connectTimeoutTimer !== null) {
      window.clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }
    if (this.joinRetryTimer !== null) {
      window.clearInterval(this.joinRetryTimer);
      this.joinRetryTimer = null;
    }
    if (this.iceGraceTimer !== null) {
      window.clearTimeout(this.iceGraceTimer);
      this.iceGraceTimer = null;
    }

    console.log(
      `[CoupleCam P2P][${this.role === 'host' ? 'Host' : 'Partner'}] Step 5: Room "${this.activeRoomCode}" validated (${reason}) -> switching to Hub!`,
    );
    this.callbacks.onStatusChange('connected', '');
    this.startHeartbeat(gen);

    // Sequence MediaConnection slightly after room confirmation to prevent SDP glare
    if (this.role === 'guest' && this.localStream && !this.hasSentMediaCall && this.remotePeerId) {
      const targetPeer = this.remotePeerId;
      window.setTimeout(() => {
        if (gen !== this.sessionGen || !this.hasEnteredRoom || this.hasSentMediaCall) return;
        this.initiateMediaCall(targetPeer, gen);
      }, 200);
    }
  }

  private handleIncomingPeerMessage(msg: PeerMessage, gen: number, via: 'peerjs' | 'relay', connPeerId?: string) {
    if (gen !== this.sessionGen) return;

    if (msg.type === 'PING') {
      this.sendEvent({ type: 'PONG', ts: msg.ts });
      return;
    }
    if (msg.type === 'PONG') {
      return;
    }

    if (msg.type === 'JOIN_REQUEST' && this.role === 'host') {
      console.log(
        `[CoupleCam P2P][Host] Received JOIN_REQUEST from "${msg.name}" (via ${via}) -> replying JOIN_CONFIRMED`,
      );
      this.sendEvent({
        type: 'JOIN_CONFIRMED',
        code: this.activeRoomCode,
        hostName: this.localName,
        hasStream: Boolean(this.localStream),
      });
      this.callbacks.onMessage({
        type: 'HELLO',
        name: msg.name,
        role: 'guest',
        hasStream: msg.hasStream,
      });
      this.markRoomEntered(gen, `join-request-${via}`, connPeerId);

      // If Partner joined without camera/mic while Host HAS a camera, Host initiates MediaConnection
      if (!msg.hasStream && this.localStream && !this.hasSentMediaCall && connPeerId) {
        window.setTimeout(() => {
          if (gen !== this.sessionGen || !this.hasEnteredRoom || this.hasSentMediaCall) return;
          this.initiateMediaCall(connPeerId, gen);
        }, 200);
      }
      return;
    }

    if (msg.type === 'JOIN_CONFIRMED' && this.role === 'guest') {
      console.log(
        `[CoupleCam P2P][Partner] Received JOIN_CONFIRMED from Host "${msg.hostName}" (via ${via})!`,
      );
      this.callbacks.onMessage({
        type: 'HELLO',
        name: msg.hostName,
        role: 'host',
        hasStream: msg.hasStream,
      });
      this.markRoomEntered(gen, `join-confirmed-${via}`, connPeerId);
      return;
    }

    if (msg.type === 'HELLO') {
      if (this.role === 'guest' && !this.hasEnteredRoom) {
        console.log(
          `[CoupleCam P2P][Partner] Received HELLO from Host "${msg.name}" (via ${via}) -> confirming room entry!`,
        );
        this.markRoomEntered(gen, `hello-${via}`, connPeerId);
      } else if (this.role === 'host') {
        this.markRoomEntered(gen, `hello-${via}`, connPeerId);
        if (!msg.hasStream && this.localStream && !this.hasSentMediaCall && connPeerId) {
          window.setTimeout(() => {
            if (gen !== this.sessionGen || !this.hasEnteredRoom || this.hasSentMediaCall) return;
            this.initiateMediaCall(connPeerId, gen);
          }, 200);
        }
      }
    }

    this.callbacks.onMessage(msg);
  }

  private attachDataConnection(conn: DataConnection, gen: number) {
    const previous = this.dataConn;
    this.dataConn = conn;
    if (previous && previous !== conn) {
      try {
        previous.close();
      } catch {
        // Ignore stale close error
      }
    }

    const roleLabel = this.role === 'host' ? 'Host' : 'Partner';

    const handleOpen = () => {
      if (gen !== this.sessionGen || this.dataConn !== conn) return;
      console.log(`[CoupleCam P2P][${roleLabel}] Step 4 (PeerJS): DataConnection OPEN with "${conn.peer}"`);

      if (this.role === 'host') {
        console.log(`[CoupleCam P2P][Host] Sending immediate JOIN_CONFIRMED + HELLO to partner "${conn.peer}"`);
        this.sendEvent({
          type: 'JOIN_CONFIRMED',
          code: this.activeRoomCode,
          hostName: this.localName,
          hasStream: Boolean(this.localStream),
        });
        this.sendEvent({
          type: 'HELLO',
          name: this.localName,
          role: 'host',
          hasStream: Boolean(this.localStream),
        });
        this.markRoomEntered(gen, 'host-channel-open', conn.peer);
      } else {
        this.sendPartnerJoinHandshake(gen);
        this.startJoinRetryLoop(gen);
      }
    };

    if (conn.open) {
      handleOpen();
    } else {
      conn.on('open', handleOpen);
    }

    conn.on('data', (payload) => {
      if (gen !== this.sessionGen || this.dataConn !== conn) return;
      if (!payload || typeof payload !== 'object' || !('type' in payload)) return;
      this.handleIncomingPeerMessage(payload as PeerMessage, gen, 'peerjs', conn.peer);
    });

    conn.on('iceStateChanged', (iceState) => {
      if (gen !== this.sessionGen || this.dataConn !== conn) return;
      console.log(`[CoupleCam P2P][${roleLabel}] ICE state changed -> "${iceState}"`);

      if (iceState === 'connected' || iceState === 'completed') {
        if (this.iceGraceTimer !== null) {
          window.clearTimeout(this.iceGraceTimer);
          this.iceGraceTimer = null;
        }
      } else if (iceState === 'disconnected') {
        if (this.iceGraceTimer === null && this.hasEnteredRoom && !this.isRelayTransportOpen()) {
          this.iceGraceTimer = window.setTimeout(() => {
            this.iceGraceTimer = null;
            if (gen !== this.sessionGen || this.dataConn !== conn || this.isRelayTransportOpen()) return;
            const pcState = conn.peerConnection?.iceConnectionState;
            if (pcState === 'disconnected' || pcState === 'failed' || pcState === 'closed') {
              console.log(
                `[CoupleCam P2P][${roleLabel}] ICE remained "${pcState}" after grace period -> disconnecting.`,
              );
              this.callbacks.onRemoteStream(null);
              this.callbacks.onStatusChange(
                'disconnected',
                'Connexion interrompue avec ton/ta partenaire. Tu peux recréer ou rejoindre un salon.',
              );
            }
          }, ICE_DISCONNECT_GRACE_MS);
        }
      } else if (iceState === 'failed') {
        console.log(`[CoupleCam P2P][${roleLabel}] ICE negotiation failed.`);
        // If our WebSocket room relay is active & connected, keep the game room alive smoothly!
        if (this.isRelayTransportOpen()) {
          console.log(`[CoupleCam P2P][${roleLabel}] Direct WebRTC ICE blocked by NAT; continuing seamlessly via /ws/room relay.`);
          this.dataConn = null;
          try {
            conn.close();
          } catch {
            // Ignore close error
          }
          return;
        }
        if (this.role === 'host' && !this.hasEnteredRoom) {
          this.dataConn = null;
          try {
            conn.close();
          } catch {
            // Ignore close error
          }
          this.callbacks.onRemoteStream(null);
          this.callbacks.onStatusChange(
            'waiting',
            `Salon ${this.activeRoomCode} toujours ouvert — la tentative précédente a échoué, ton/ta partenaire peut réessayer.`,
          );
          return;
        }
        this.destroy();
        this.callbacks.onRemoteStream(null);
        this.callbacks.onStatusChange(
          'error',
          'Connexion réseau WebRTC impossible entre les deux appareils (pare-feu ou réseau restrictif). Réessaie sur un autre réseau.',
        );
      }
    });

    conn.on('close', () => {
      if (gen !== this.sessionGen || this.dataConn !== conn) return;
      console.log(`[CoupleCam P2P][${roleLabel}] PeerJS DataConnection closed.`);
      this.dataConn = null;
      if (this.isRelayTransportOpen()) {
        // Relay is still connected; do not kick players out of the room
        return;
      }
      if (this.heartbeatTimer !== null) {
        window.clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
      this.callbacks.onRemoteStream(null);
      if (this.hasEnteredRoom) {
        this.callbacks.onStatusChange('disconnected', 'Ton/ta partenaire a quitté le salon.');
      } else if (this.role === 'host') {
        this.callbacks.onStatusChange(
          'waiting',
          `Salon ${this.activeRoomCode} ouvert — en attente de ton/ta partenaire.`,
        );
      } else if (this.role === 'guest') {
        this.destroy();
        this.callbacks.onStatusChange(
          'error',
          `La connexion au salon ${this.activeRoomCode} a été fermée avant confirmation. Réessaie.`,
        );
      }
    });

    conn.on('error', (err) => {
      if (gen !== this.sessionGen || this.dataConn !== conn) return;
      console.log(`[CoupleCam P2P][${roleLabel}] PeerJS DataConnection error:`, err);
      if (this.isRelayTransportOpen()) {
        this.dataConn = null;
        return;
      }
      if (this.role === 'host' && !this.hasEnteredRoom) {
        this.dataConn = null;
        try {
          conn.close();
        } catch {
          // Ignore close error
        }
        this.callbacks.onStatusChange(
          'waiting',
          `Salon ${this.activeRoomCode} toujours ouvert — ton/ta partenaire peut réessayer.`,
        );
        return;
      }
      this.destroy();
      this.callbacks.onStatusChange(
        'error',
        'Connexion de données interrompue. Réessaie de te reconnecter au salon.',
      );
    });
  }

  private initiateMediaCall(targetPeerId: string, gen: number) {
    if (!this.peer || this.peer.destroyed || !this.peer.open || !this.localStream) return;
    try {
      this.hasSentMediaCall = true;
      this.hasSentLocalMediaStream = true;
      console.log(`[CoupleCam P2P] Initiating MediaConnection to "${targetPeerId}"`);
      const call = this.peer.call(targetPeerId, this.localStream);
      if (call) {
        this.attachMediaConnection(call, gen);
      }
    } catch (err) {
      this.hasSentMediaCall = false;
      this.hasSentLocalMediaStream = false;
      console.warn('[CoupleCam P2P] Media call setup failed (data connection remains active):', err);
    }
  }

  private answerMediaCall(call: MediaConnection, gen: number) {
    try {
      this.hasSentMediaCall = true;
      if (this.localStream) {
        this.hasSentLocalMediaStream = true;
      }
      call.answer(this.localStream ?? undefined);
      this.attachMediaConnection(call, gen);
    } catch (err) {
      console.warn('[CoupleCam P2P] Media call answer failed:', err);
    }
  }

  private attachMediaConnection(call: MediaConnection, gen: number) {
    const previous = this.mediaConn;
    this.mediaConn = call;
    if (previous && previous !== call) {
      try {
        previous.close();
      } catch {
        // Ignore stale media close
      }
    }

    call.on('stream', (remoteStream) => {
      if (gen !== this.sessionGen || this.mediaConn !== call) return;
      console.log('[CoupleCam P2P] Remote media stream received.');
      this.callbacks.onRemoteStream(remoteStream);
    });

    call.on('close', () => {
      if (gen !== this.sessionGen || this.mediaConn !== call) return;
      this.hasSentMediaCall = false;
      this.hasSentLocalMediaStream = false;
      this.callbacks.onRemoteStream(null);
    });

    call.on('error', (err) => {
      if (gen !== this.sessionGen || this.mediaConn !== call) return;
      this.hasSentMediaCall = false;
      this.hasSentLocalMediaStream = false;
      console.warn('[CoupleCam P2P] MediaConnection warning:', err);
    });
  }

  private startHeartbeat(gen: number) {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
    }
    this.heartbeatTimer = window.setInterval(() => {
      if (gen !== this.sessionGen) return;
      if (this.dataConn?.open || this.isRelayTransportOpen()) {
        this.sendEvent({ type: 'PING', ts: Date.now() });
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  public sendEvent(msg: PeerMessage) {
    // Prefer direct P2P DataConnection when open; seamlessly fall back to /ws/room relay otherwise
    if (this.dataConn && this.dataConn.open) {
      try {
        this.dataConn.send(msg);
        return;
      } catch {
        // Fall through to relay if P2P send throws
      }
    }
    this.sendRelayData(msg);
  }

  /**
   * Sends high-frequency game/sensor packets capped independently per message type to ~30 fps (33ms).
   * Using per-type throttling ensures FACE_FRAME / HAND_FRAME never starve HOCKEY_SYNC / NINJA_SYNC / FUNAMBULES_SYNC.
   */
  public sendRealtime(msg: PeerMessage) {
    const now = performance.now();
    const lastSent = this.lastRealtimeSendByType.get(msg.type) ?? -Infinity;
    if (now - lastSent < 33) {
      return;
    }
    this.lastRealtimeSendByType.set(msg.type, now);
    this.sendEvent(msg);
  }

  public destroy() {
    this.sessionGen += 1;
    this.clearTimers();
    this.lastRealtimeSendByType.clear();
    this.remotePeerId = null;
    this.hasEnteredRoom = false;
    this.hasSentMediaCall = false;
    this.hasSentLocalMediaStream = false;
    this.hostWaitingNotified = false;
    this.relayRoomNotFound = false;
    this.peerUnavailable = false;

    const ws = this.relayWs;
    this.relayWs = null;
    this.relayHostReady = false;
    this.relayGuestJoined = false;
    if (ws) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'LEAVE_ROOM', code: this.activeRoomCode }));
        }
        ws.close();
      } catch {
        // Ignore close error
      }
    }

    const dc = this.dataConn;
    this.dataConn = null;
    try {
      dc?.close();
    } catch {
      // Ignore close error
    }

    const mc = this.mediaConn;
    this.mediaConn = null;
    try {
      mc?.close();
    } catch {
      // Ignore close error
    }

    const p = this.peer;
    this.peer = null;
    try {
      if (p && !p.destroyed) {
        p.destroy();
      }
    } catch {
      // Ignore destroy error
    }
  }
}
