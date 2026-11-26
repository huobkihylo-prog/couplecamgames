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

/**
 * Builds the WebRTC ICE server list combining the 4 fast public STUN servers
 * with an optional TURN server configured via Vite env vars (`VITE_TURN_URL`,
 * `VITE_TURN_USER`, `VITE_TURN_PASS`) for restrictive 4G/corporate NATs.
 */
export function buildIceServers(
  envOverride?: Partial<Record<'VITE_TURN_URL' | 'VITE_TURN_USER' | 'VITE_TURN_PASS', string>>,
): RTCIceServer[] {
  const servers: RTCIceServer[] = [...ICE_SERVERS];
  const env =
    envOverride ??
    ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {});
  const turnUrl = env.VITE_TURN_URL?.trim();
  if (turnUrl) {
    const turnEntry: RTCIceServer = { urls: turnUrl };
    if (env.VITE_TURN_USER?.trim()) {
      turnEntry.username = env.VITE_TURN_USER.trim();
    }
    if (env.VITE_TURN_PASS?.trim()) {
      turnEntry.credential = env.VITE_TURN_PASS.trim();
    }
    servers.push(turnEntry);
  }
  return servers;
}

export const ROOM_PREFIX = 'couplecam-room-';
export const CONNECT_TIMEOUT_MS = 15000;
export const MAX_GUEST_RETRIES = 3;
export const GUEST_RETRY_DELAY_MS = 3000;
export const GUEST_ATTEMPT_STALL_MS = 5000;
export const HEARTBEAT_INTERVAL_MS = 20000;

export const ERR_ROOM_NOT_FOUND =
  "Salon introuvable. Demande à ton partenaire de revenir sur la page du salon (sans fermer l'onglet).";
export const ERR_NETWORK_BLOCKED =
  'Connexion directe bloquée par le réseau (4G/Wi-Fi). Essayez de cliquer sur Réessayer ou passez en Wi-Fi.';

const JOIN_RETRY_PING_MS = 1000;
const ICE_DISCONNECT_GRACE_MS = 6000;

const ROOM_CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const ROOM_CODE_DIGITS = '23456789';
const ROOM_CODE_ALPHABET = `${ROOM_CODE_LETTERS}${ROOM_CODE_DIGITS}`;

/**
 * Generates a human-friendly 4-character alphanumeric room code (uppercase letters + digits),
 * excluding ambiguous characters (0/O, 1/I/L) and guaranteeing at least 1 letter and 1 digit.
 */
export function generateRoomCode(rng: () => number = Math.random): string {
  const pick = (pool: string) => pool[Math.floor(rng() * pool.length)];
  const chars = [
    pick(ROOM_CODE_LETTERS),
    pick(ROOM_CODE_DIGITS),
    pick(ROOM_CODE_ALPHABET),
    pick(ROOM_CODE_ALPHABET),
  ];
  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
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
  private relaySse: EventSource | null = null;
  private relaySseClientId: string | null = null;
  private relaySseReady = false;
  private relayHostReady = false;
  private relayGuestJoined = false;
  private relayRoomNotFound = false;
  private peerUnavailable = false;
  private hostWaitingNotified = false;
  private relayReconnectAttempts = 0;

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
  private guestRetryCount = 0;
  private connectTimeoutTimer: number | null = null;
  private joinRetryTimer: number | null = null;
  private guestPeerRetryTimer: number | null = null;
  private guestAttemptStallTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private iceGraceTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private relayReconnectTimer: number | null = null;
  private relayFallbackTimer: number | null = null;
  private visibilityListener: (() => void) | null = null;
  private onlineListener: (() => void) | null = null;

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
    if (this.guestPeerRetryTimer !== null) {
      window.clearTimeout(this.guestPeerRetryTimer);
      this.guestPeerRetryTimer = null;
    }
    if (this.guestAttemptStallTimer !== null) {
      window.clearTimeout(this.guestAttemptStallTimer);
      this.guestAttemptStallTimer = null;
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
    if (this.relayReconnectTimer !== null) {
      window.clearTimeout(this.relayReconnectTimer);
      this.relayReconnectTimer = null;
    }
    if (this.relayFallbackTimer !== null) {
      window.clearTimeout(this.relayFallbackTimer);
      this.relayFallbackTimer = null;
    }
  }

  private detachLifecycleListeners() {
    if (typeof document !== 'undefined' && this.visibilityListener) {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      this.visibilityListener = null;
    }
    if (typeof window !== 'undefined' && this.onlineListener) {
      window.removeEventListener('online', this.onlineListener);
      this.onlineListener = null;
    }
  }

  private attachLifecycleListeners(gen: number) {
    this.detachLifecycleListeners();
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const handleWakeup = () => {
      if (gen !== this.sessionGen || !this.activeRoomCode) return;
      if (document.visibilityState === 'hidden') return;
      // Re-attach relay transport immediately when returning from WhatsApp/background on mobile
      const wsOpen = Boolean(this.relayWs && this.relayWs.readyState === WebSocket.OPEN);
      const sseOpen = Boolean(this.relaySse && this.relaySseReady);
      if (!wsOpen && !sseOpen) {
        console.log('[CoupleCam P2P] App returned to foreground -> reconnecting relay transport...');
        this.relayReconnectAttempts = 0;
        this.openRelayTransport(gen);
      } else {
        // Re-assert room membership idempotently so server flushes any queued partner arrival
        this.sendRelayRegistration();
      }
      if (this.peer && !this.peer.destroyed && this.peer.disconnected) {
        this.scheduleSignalingReconnect(this.peer, gen);
      }
    };

    this.visibilityListener = handleWakeup;
    this.onlineListener = handleWakeup;
    document.addEventListener('visibilitychange', handleWakeup);
    window.addEventListener('online', handleWakeup);
  }

  private createPeerOptions() {
    return {
      debug: 1,
      pingInterval: 5000,
      config: {
        iceServers: buildIceServers(),
        iceCandidatePoolSize: 10,
      },
    };
  }

  private getRelayWsUrl(): string | null {
    if (typeof window === 'undefined' || !window.location?.host) return null;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/room`;
  }

  private getRelaySseBaseUrl(): string | null {
    if (typeof window === 'undefined' || !window.location?.origin) return null;
    return `${window.location.origin}/api/room`;
  }

  private sendRelayControl(payload: Record<string, unknown>): boolean {
    if (this.relayWs && this.relayWs.readyState === WebSocket.OPEN) {
      try {
        this.relayWs.send(JSON.stringify(payload));
        return true;
      } catch {
        // Fall through to SSE if WS send fails
      }
    }
    if (this.relaySseReady && this.relaySseClientId) {
      const base = this.getRelaySseBaseUrl();
      if (base) {
        void fetch(`${base}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, clientId: this.relaySseClientId }),
          keepalive: payload.type === 'LEAVE_ROOM',
        }).catch(() => {});
        return true;
      }
    }
    return false;
  }

  private sendRelayRegistration() {
    if (!this.activeRoomCode) return;
    if (this.role === 'host') {
      this.sendRelayControl({
        type: 'HOST_OPEN',
        code: this.activeRoomCode,
        name: this.localName,
      });
    } else {
      this.sendRelayControl({
        type: 'GUEST_JOIN',
        code: this.activeRoomCode,
        name: this.localName,
        hasStream: Boolean(this.localStream),
      });
    }
  }

  private isRelayTransportOpen(): boolean {
    const wsOpen = Boolean(this.relayWs && this.relayWs.readyState === WebSocket.OPEN);
    const sseOpen = Boolean(this.relaySse && this.relaySseReady);
    return Boolean((wsOpen || sseOpen) && (this.relayHostReady || this.relayGuestJoined));
  }

  private hasAnyRelayLink(): boolean {
    const wsActive = Boolean(
      this.relayWs &&
        (this.relayWs.readyState === WebSocket.OPEN ||
          this.relayWs.readyState === WebSocket.CONNECTING),
    );
    const sseActive = Boolean(
      this.relaySse &&
        (this.relaySse.readyState === EventSource.OPEN ||
          this.relaySse.readyState === EventSource.CONNECTING),
    );
    return wsActive || sseActive;
  }

  public setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
    if (!stream || !this.hasEnteredRoom) return;

    // 1. Hot-swap via RTCRtpSender.replaceTrack when an active MediaConnection already has a video sender
    const pc = this.mediaConn?.peerConnection;
    const newVideoTrack = stream.getVideoTracks()[0] ?? null;
    const newAudioTrack = stream.getAudioTracks()[0] ?? null;
    if (pc && typeof pc.getSenders === 'function') {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track?.kind === 'video');
      if (videoSender && newVideoTrack) {
        this.hasSentLocalMediaStream = true;
        console.log('[CoupleCam P2P] Hot-swapping local video track via RTCRtpSender.replaceTrack.');
        void videoSender.replaceTrack(newVideoTrack).catch((err) => {
          console.warn('[CoupleCam P2P] replaceTrack(video) failed, falling back to peer.call:', err);
          this.hasSentLocalMediaStream = false;
          if (this.remotePeerId && this.peer?.open) {
            this.initiateMediaCall(this.remotePeerId, this.sessionGen);
          }
        });
        const audioSender = senders.find((s) => s.track?.kind === 'audio');
        if (audioSender && newAudioTrack) {
          void audioSender.replaceTrack(newAudioTrack).catch(() => {});
        }
        return;
      }
    }

    // 2. Otherwise (joined without camera -> camera turned ON mid-game), attach via peer.call without touching DataConnection
    if (this.peer && !this.peer.destroyed && this.remotePeerId && !this.hasSentLocalMediaStream) {
      if (this.peer.open) {
        console.log('[CoupleCam P2P] Local stream became available mid-session, starting MediaConnection.');
        this.initiateMediaCall(this.remotePeerId, this.sessionGen);
      } else if (this.peer.disconnected) {
        this.scheduleSignalingReconnect(this.peer, this.sessionGen);
      }
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

    // 15-second max timeout for room opening across both Relay & PeerJS
    this.connectTimeoutTimer = window.setTimeout(() => {
      if (gen !== this.sessionGen) return;
      if (!this.hostWaitingNotified && !this.hasEnteredRoom) {
        console.log(
          `[CoupleCam P2P][Host] Timeout (${CONNECT_TIMEOUT_MS}ms): Room "${cleanCode}" failed to open on signaling server.`,
        );
        this.destroy();
        this.callbacks.onStatusChange(
          'error',
          'Délai dépassé (15 s) : impossible d’ouvrir le salon. Vérifie ta connexion et réessaie.',
        );
      }
    }, CONNECT_TIMEOUT_MS);

    // 1. Open instant WebSocket Room Relay (with automatic HTTP/SSE fallback & foreground reconnect)
    this.attachLifecycleListeners(gen);
    this.openRelayTransport(gen);

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
      if (this.hasEnteredRoom) {
        this.sendHandshakeMessage({
          type: 'HELLO',
          name: this.localName,
          role: 'host',
          hasStream: Boolean(this.localStream),
          peerId: assignedId,
        });
        if (this.localStream && !this.hasSentLocalMediaStream && this.remotePeerId) {
          this.initiateMediaCall(this.remotePeerId, gen);
        }
      }
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
        // Never silently change a room code already shown on screen via Relay!
        if (this.relayHostReady) {
          console.log(`[CoupleCam P2P][Host] PeerJS ID "${peerId}" taken, keeping active Relay room "${cleanCode}".`);
          return;
        }
        if (attempt < 3 && !this.hasEnteredRoom) {
          const freshCode = generateRoomCode();
          console.log(`[CoupleCam P2P][Host] Code "${cleanCode}" already taken, regenerating -> "${freshCode}"`);
          this.callbacks.onRoomCodeChange?.(freshCode);
          this.createHostRoom(freshCode, localName, stream, attempt + 1);
          return;
        }
        this.destroy();
        this.callbacks.onStatusChange('error', 'Ce code est déjà utilisé. Réessaie pour en générer un autre.');
      } else if (!this.relayHostReady && !this.hasAnyRelayLink()) {
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
    this.guestRetryCount = 0;

    console.log(
      `[CoupleCam P2P][Partner] Step 1: Joining room "${cleanCode}" (targetId="${targetId}", raw="${code}")`,
    );
    this.callbacks.onStatusChange('connecting', '1/3 Connexion au serveur...');

    // Clean 15-second timeout so Partner NEVER stays stuck on "en cours d'entrée"
    this.connectTimeoutTimer = window.setTimeout(() => {
      if (gen !== this.sessionGen || this.hasEnteredRoom) return;
      const iceState = this.dataConn?.peerConnection?.iceConnectionState ?? 'none';
      const dcOpen = Boolean(this.dataConn?.open);
      const wsState = this.relayWs?.readyState ?? -1;
      const wasRoomNotFound = this.peerUnavailable && (this.relayRoomNotFound || !this.hasAnyRelayLink());
      console.log(
        `[CoupleCam P2P][Partner] Timeout (${CONNECT_TIMEOUT_MS}ms) reached for room "${cleanCode}" (wsState=${wsState}, peerOpen=${Boolean(this.peer?.open)}, dcOpen=${dcOpen}, iceState="${iceState}", roomNotFound=${wasRoomNotFound}). Aborting.`,
      );
      this.destroy();
      this.callbacks.onStatusChange(
        'error',
        wasRoomNotFound ? ERR_ROOM_NOT_FOUND : ERR_NETWORK_BLOCKED,
      );
    }, CONNECT_TIMEOUT_MS);

    // 1. Connect immediately via WebSocket Room Relay (`/ws/room`) with automatic HTTP/SSE fallback
    this.attachLifecycleListeners(gen);
    this.openRelayTransport(gen);

    // 2. Simultaneously open local PeerJS endpoint; NEVER call peer.connect() before peer 'open'
    const peer = new Peer(this.createPeerOptions());
    this.peer = peer;

    peer.on('open', (myId) => {
      if (gen !== this.sessionGen || peer.destroyed) return;
      console.log(`[CoupleCam P2P][Partner] Step 2 (PeerJS): Local peer open (myId="${myId}").`);
      if (this.hasEnteredRoom) {
        // Share our PeerJS peerId over Relay/DataConn so Host can initiate or receive hot-camera calls
        this.sendHandshakeMessage({
          type: 'HELLO',
          name: this.localName,
          role: 'guest',
          hasStream: Boolean(this.localStream),
          peerId: myId,
        });
        // Relay already paired us into the Hub -> still launch video/audio call in parallel!
        if (this.localStream && !this.hasSentLocalMediaStream) {
          this.initiateMediaCall(targetId, gen);
        } else if (!this.dataConn) {
          // Silently open background DataConnection so Host learns our peerId if Host has video
          try {
            const bgConn = peer.connect(targetId, { serialization: 'json', reliable: true });
            this.attachDataConnection(bgConn, gen);
          } catch {
            // Relay remains active
          }
        }
        return;
      }
      this.attemptGuestPeerConnect(peer, targetId, cleanCode, gen);
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
        // Host may still be on WhatsApp — auto-retry up to 3 times every 3 seconds before failing!
        if (this.guestRetryCount < MAX_GUEST_RETRIES) {
          this.scheduleGuestPeerRetry(peer, targetId, cleanCode, gen, 'peer-unavailable');
        } else if (this.relayRoomNotFound || !this.hasAnyRelayLink()) {
          this.failRoomNotFound(gen, cleanCode);
        }
      } else if (!this.isRelayTransportOpen() && !this.hasAnyRelayLink()) {
        this.destroy();
        this.callbacks.onStatusChange(
          'error',
          isSignalingOnlyError(errType) ? ERR_NETWORK_BLOCKED : err.message || ERR_NETWORK_BLOCKED,
        );
      }
    });

    peer.on('disconnected', () => {
      if (gen !== this.sessionGen || peer.destroyed) return;
      console.log('[CoupleCam P2P][Partner] PeerJS signaling socket disconnected, scheduling reconnect...');
      this.scheduleSignalingReconnect(peer, gen);
    });
  }

  private attemptGuestPeerConnect(peer: Peer, targetId: string, cleanCode: string, gen: number) {
    if (gen !== this.sessionGen || peer.destroyed || this.hasEnteredRoom) return;
    if (!peer.open) return;

    this.guestRetryCount += 1;
    const attemptNum = this.guestRetryCount;
    const retrySuffix = attemptNum > 1 ? ` (tentative ${attemptNum}/${MAX_GUEST_RETRIES})` : '';

    if (!this.hasEnteredRoom) {
      this.callbacks.onStatusChange(
        'connecting',
        `2/3 Recherche du salon ${cleanCode}...${retrySuffix}`,
      );
    }

    // Close any previous stalled DataConnection before starting a fresh attempt
    if (this.dataConn && !this.dataConn.open) {
      const stale = this.dataConn;
      this.dataConn = null;
      try {
        stale.close();
      } catch {
        // Ignore stale close error
      }
    }

    if (this.guestAttemptStallTimer !== null) {
      window.clearTimeout(this.guestAttemptStallTimer);
      this.guestAttemptStallTimer = null;
    }

    console.log(
      `[CoupleCam P2P][Partner] Connecting PeerJS DataConnection to "${targetId}" (attempt ${attemptNum}/${MAX_GUEST_RETRIES})`,
    );
    const conn = peer.connect(targetId, {
      serialization: 'json',
      reliable: true,
    });
    this.attachDataConnection(conn, gen);

    if (!this.hasEnteredRoom) {
      this.callbacks.onStatusChange(
        'connecting',
        `3/3 Établissement de la liaison directe (P2P)...${retrySuffix}`,
      );
    }

    // If this DataConnection attempt stalls > 5 seconds without opening, close cleanly & auto-retry
    this.guestAttemptStallTimer = window.setTimeout(() => {
      this.guestAttemptStallTimer = null;
      if (gen !== this.sessionGen || this.hasEnteredRoom) return;
      if (this.dataConn === conn && !conn.open) {
        console.log(
          `[CoupleCam P2P][Partner] PeerJS attempt ${attemptNum} stalled > ${GUEST_ATTEMPT_STALL_MS}ms -> closing stale attempt.`,
        );
        this.dataConn = null;
        try {
          conn.close();
        } catch {
          // Ignore close error
        }
        if (this.guestRetryCount < MAX_GUEST_RETRIES) {
          this.scheduleGuestPeerRetry(peer, targetId, cleanCode, gen, 'stalled');
        }
      }
    }, GUEST_ATTEMPT_STALL_MS);
  }

  private scheduleGuestPeerRetry(
    peer: Peer,
    targetId: string,
    cleanCode: string,
    gen: number,
    reason: string,
  ) {
    if (gen !== this.sessionGen || this.hasEnteredRoom || peer.destroyed) return;
    if (this.guestPeerRetryTimer !== null) return;
    if (this.guestRetryCount >= MAX_GUEST_RETRIES) return;

    const nextAttempt = this.guestRetryCount + 1;
    console.log(
      `[CoupleCam P2P][Partner] Auto-retry ${nextAttempt}/${MAX_GUEST_RETRIES} scheduled in ${GUEST_RETRY_DELAY_MS}ms (reason=${reason})`,
    );
    this.callbacks.onStatusChange(
      'connecting',
      `2/3 Recherche du salon ${cleanCode}... (tentative ${nextAttempt}/${MAX_GUEST_RETRIES})`,
    );

    this.guestPeerRetryTimer = window.setTimeout(() => {
      this.guestPeerRetryTimer = null;
      if (gen !== this.sessionGen || this.hasEnteredRoom || peer.destroyed) return;
      // Also re-ping relay in case Host just returned from WhatsApp
      if (this.hasAnyRelayLink()) {
        this.sendRelayRegistration();
      }
      if (peer.open) {
        this.attemptGuestPeerConnect(peer, targetId, cleanCode, gen);
      } else if (peer.disconnected) {
        this.scheduleSignalingReconnect(peer, gen);
      }
    }, GUEST_RETRY_DELAY_MS);
  }

  private failRoomNotFound(gen: number, cleanCode: string) {
    if (gen !== this.sessionGen || this.hasEnteredRoom) return;
    console.log(`[CoupleCam P2P][Partner] Room "${cleanCode}" does not exist on Relay or PeerJS -> aborting.`);
    this.destroy();
    this.callbacks.onStatusChange('error', ERR_ROOM_NOT_FOUND);
  }

  private openRelayTransport(gen: number) {
    if (gen !== this.sessionGen) return;

    // Close any stale fallback timer before opening WS
    if (this.relayFallbackTimer !== null) {
      window.clearTimeout(this.relayFallbackTimer);
      this.relayFallbackTimer = null;
    }

    const wsUrl = this.getRelayWsUrl();
    if (!wsUrl || typeof WebSocket === 'undefined') {
      this.openRelaySseFallback(gen);
      return;
    }

    // If WebSocket doesn't open within 1.8s (e.g. restrictive mobile/corporate proxy), activate HTTP/SSE fallback
    this.relayFallbackTimer = window.setTimeout(() => {
      this.relayFallbackTimer = null;
      if (gen !== this.sessionGen) return;
      if (!this.relayWs || this.relayWs.readyState !== WebSocket.OPEN) {
        console.log('[CoupleCam P2P] /ws/room slow or blocked -> activating HTTP/SSE relay fallback.');
        this.openRelaySseFallback(gen);
      }
    }, 1800);

    try {
      const ws = new WebSocket(wsUrl);
      this.relayWs = ws;

      ws.addEventListener('open', () => {
        if (gen !== this.sessionGen || this.relayWs !== ws) {
          ws.close();
          return;
        }
        this.relayReconnectAttempts = 0;
        if (this.relayFallbackTimer !== null) {
          window.clearTimeout(this.relayFallbackTimer);
          this.relayFallbackTimer = null;
        }
        // Close SSE fallback if WS came up cleanly
        if (this.relaySse) {
          try {
            this.relaySse.close();
          } catch {
            // Ignore close error
          }
          this.relaySse = null;
          this.relaySseReady = false;
          this.relaySseClientId = null;
        }
        console.log(
          `[CoupleCam P2P][${this.role === 'host' ? 'Host' : 'Partner'}] Step 1b (Relay WS): Registering "${this.activeRoomCode}" on /ws/room`,
        );
        this.sendRelayRegistration();
      });

      ws.addEventListener('message', (ev) => {
        if (gen !== this.sessionGen || this.relayWs !== ws) return;
        let envelope: Record<string, unknown>;
        try {
          envelope = JSON.parse(String(ev.data)) as Record<string, unknown>;
        } catch {
          return;
        }
        this.handleRelayEnvelope(envelope, gen);
      });

      ws.addEventListener('error', () => {
        if (gen !== this.sessionGen || this.relayWs !== ws) return;
        console.log('[CoupleCam P2P] Relay WebSocket error -> falling back to HTTP/SSE relay.');
        this.openRelaySseFallback(gen);
      });

      ws.addEventListener('close', () => {
        if (gen !== this.sessionGen || this.relayWs !== ws) return;
        this.relayWs = null;
        if (!this.relaySseReady) {
          this.relayHostReady = false;
          this.relayGuestJoined = false;
        }
        if (this.role === 'guest' && !this.hasEnteredRoom && this.peerUnavailable && this.relayRoomNotFound) {
          this.failRoomNotFound(gen, this.activeRoomCode);
          return;
        }
        // Auto-reconnect relay transport (or switch to SSE) so mobile tab pauses never kill the room
        if (!this.relaySseReady) {
          this.openRelaySseFallback(gen);
          this.scheduleRelayWsReconnect(gen);
        }
      });
    } catch {
      // WebSocket constructor blocked or unavailable -> use HTTP/SSE relay immediately
      if (this.relayFallbackTimer !== null) {
        window.clearTimeout(this.relayFallbackTimer);
        this.relayFallbackTimer = null;
      }
      this.openRelaySseFallback(gen);
    }
  }

  private scheduleRelayWsReconnect(gen: number) {
    if (gen !== this.sessionGen || this.relayReconnectTimer !== null) return;
    if (this.relayReconnectAttempts >= 5) return;
    const delayMs = Math.min(4000, 450 * Math.pow(2, this.relayReconnectAttempts));
    this.relayReconnectAttempts += 1;
    this.relayReconnectTimer = window.setTimeout(() => {
      this.relayReconnectTimer = null;
      if (gen !== this.sessionGen) return;
      if (this.relayWs && this.relayWs.readyState === WebSocket.OPEN) return;
      if (this.relaySse && this.relaySseReady) return;
      this.openRelayTransport(gen);
    }, delayMs);
  }

  private openRelaySseFallback(gen: number) {
    if (gen !== this.sessionGen || typeof EventSource === 'undefined') return;
    if (this.relayWs && this.relayWs.readyState === WebSocket.OPEN) return;
    if (this.relaySse && this.relaySse.readyState !== EventSource.CLOSED) return;

    const base = this.getRelaySseBaseUrl();
    if (!base) return;

    const clientId =
      this.relaySseClientId ||
      `sse-${this.role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    this.relaySseClientId = clientId;

    try {
      const es = new EventSource(`${base}/stream?clientId=${encodeURIComponent(clientId)}`);
      this.relaySse = es;

      es.addEventListener('message', (ev) => {
        if (gen !== this.sessionGen || this.relaySse !== es) return;
        let envelope: Record<string, unknown>;
        try {
          envelope = JSON.parse(String(ev.data)) as Record<string, unknown>;
        } catch {
          return;
        }
        if (envelope.type === 'RELAY_SSE_CONNECTED') {
          this.relaySseReady = true;
          console.log(
            `[CoupleCam P2P][${this.role === 'host' ? 'Host' : 'Partner'}] Step 1b (Relay SSE): Connected to /api/room/stream -> registering "${this.activeRoomCode}"`,
          );
          this.sendRelayRegistration();
          return;
        }
        this.handleRelayEnvelope(envelope, gen);
      });

      es.addEventListener('error', () => {
        if (gen !== this.sessionGen || this.relaySse !== es) return;
        if (es.readyState === EventSource.CLOSED) {
          this.relaySseReady = false;
          this.relaySse = null;
        }
      });
    } catch {
      // SSE unavailable; PeerJS continues independently
    }
  }

  private handleRelayEnvelope(envelope: Record<string, unknown>, gen: number) {
    if (gen !== this.sessionGen) return;
    const type = typeof envelope.type === 'string' ? envelope.type : '';

    if (type === 'RELAY_HOST_READY' && this.role === 'host') {
      this.relayHostReady = true;
      console.log(
        `[CoupleCam P2P][Host] Step 2 (Relay): Room "${this.activeRoomCode}" open and listening (resumed=${Boolean(envelope.resumed)})`,
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
      const myPeerId = this.peer?.id || undefined;
      this.sendHandshakeMessage({
        type: 'JOIN_WELCOME',
        code: this.activeRoomCode,
        hostName: this.localName,
        hasStream: Boolean(this.localStream),
        peerId: myPeerId,
      });
      this.sendHandshakeMessage({
        type: 'JOIN_CONFIRMED',
        code: this.activeRoomCode,
        hostName: this.localName,
        hasStream: Boolean(this.localStream),
        peerId: myPeerId,
      });
      this.sendHandshakeMessage({
        type: 'HELLO',
        name: this.localName,
        role: 'host',
        hasStream: Boolean(this.localStream),
        peerId: myPeerId,
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
      this.relayRoomNotFound = false;
      const hostName = String(envelope.hostName ?? 'Hôte');
      console.log(
        `[CoupleCam P2P][Partner] Step 3 (Relay): Confirmed in room "${this.activeRoomCode}" (Host="${hostName}") -> entering Hub immediately!`,
      );
      this.callbacks.onMessage({
        type: 'HELLO',
        name: hostName,
        role: 'host',
        hasStream: false,
      });
      this.sendPartnerJoinHandshake(gen);
      // Enter immediately on authoritative server pairing so Partner NEVER gets stuck on "Connexion..."
      this.markRoomEntered(gen, 'relay-joined-room');
      return;
    }

    if (type === 'RELAY_HOST_RECONNECTED' && this.role === 'guest') {
      const hostName = String(envelope.hostName ?? 'Hôte');
      this.callbacks.onMessage({
        type: 'HELLO',
        name: hostName,
        role: 'host',
        hasStream: false,
      });
      this.sendPartnerJoinHandshake(gen);
      return;
    }

    if (type === 'RELAY_ROOM_NOT_FOUND' && this.role === 'guest') {
      this.relayRoomNotFound = true;
      console.log(`[CoupleCam P2P][Partner] Relay reported room "${this.activeRoomCode}" not found.`);
      if (this.peerUnavailable && this.guestRetryCount >= MAX_GUEST_RETRIES) {
        this.failRoomNotFound(gen, this.activeRoomCode);
      } else {
        // Retry GUEST_JOIN briefly in case Host is returning from WhatsApp/background
        this.startJoinRetryLoop(gen);
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
      const reason = String(envelope.reason ?? '');
      console.log(`[CoupleCam P2P] Relay reported partner left (reason="${reason}")`);
      if (reason === 'replaced') {
        return;
      }
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
  }

  private sendRelayData(msg: PeerMessage): boolean {
    if (!this.isRelayTransportOpen()) return false;
    return this.sendRelayControl({
      type: 'RELAY_DATA',
      code: this.activeRoomCode,
      data: msg,
    });
  }

  /**
   * Sends critical handshake packets on BOTH direct P2P and Relay when available,
   * so a half-open WebRTC DataConnection can never swallow JOIN_REQUEST or JOIN_CONFIRMED.
   */
  private sendHandshakeMessage(msg: PeerMessage) {
    if (this.dataConn && this.dataConn.open) {
      try {
        this.dataConn.send(msg);
      } catch {
        // Ignore P2P send error; relay copy below still delivers
      }
    }
    this.sendRelayData(msg);
  }

  private sendPartnerJoinHandshake(gen: number) {
    if (gen !== this.sessionGen || this.role !== 'guest') return;
    console.log(`[CoupleCam P2P][Partner] Step 4: Sending JOIN_HELLO + JOIN_REQUEST + HELLO for room "${this.activeRoomCode}"`);
    const myPeerId = this.peer?.id || undefined;
    const joinHello: PeerMessage = {
      type: 'JOIN_HELLO',
      code: this.activeRoomCode,
      name: this.localName,
      hasStream: Boolean(this.localStream),
      peerId: myPeerId,
    };
    const joinReq: PeerMessage = {
      type: 'JOIN_REQUEST',
      code: this.activeRoomCode,
      name: this.localName,
      hasStream: Boolean(this.localStream),
      peerId: myPeerId,
    };
    const hello: PeerMessage = {
      type: 'HELLO',
      name: this.localName,
      role: 'guest',
      hasStream: Boolean(this.localStream),
      peerId: myPeerId,
    };
    this.sendHandshakeMessage(joinHello);
    this.sendHandshakeMessage(joinReq);
    this.sendHandshakeMessage(hello);
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
        console.log('[CoupleCam P2P][Partner] Re-sending JOIN_HELLO awaiting Host welcome...');
        this.sendPartnerJoinHandshake(gen);
      } else if (this.relayRoomNotFound && this.hasAnyRelayLink()) {
        console.log(`[CoupleCam P2P][Partner] Retrying GUEST_JOIN for room "${this.activeRoomCode}"...`);
        this.sendRelayRegistration();
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
    if (this.guestPeerRetryTimer !== null) {
      window.clearTimeout(this.guestPeerRetryTimer);
      this.guestPeerRetryTimer = null;
    }
    if (this.guestAttemptStallTimer !== null) {
      window.clearTimeout(this.guestAttemptStallTimer);
      this.guestAttemptStallTimer = null;
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

    // Launch video/audio MediaConnection IN PARALLEL after room entry — never blocks Hub entry!
    if (this.role === 'guest' && this.localStream && !this.hasSentMediaCall && this.remotePeerId) {
      const targetPeer = this.remotePeerId;
      window.setTimeout(() => {
        if (gen !== this.sessionGen || !this.hasEnteredRoom || this.hasSentMediaCall) return;
        this.initiateMediaCall(targetPeer, gen);
      }, 150);
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

    if ((msg.type === 'JOIN_HELLO' || msg.type === 'JOIN_REQUEST') && this.role === 'host') {
      const resolvedPeerId = msg.peerId || connPeerId;
      const myPeerId = this.peer?.id || undefined;
      console.log(
        `[CoupleCam P2P][Host] Received ${msg.type} from "${msg.name}" (via ${via}) -> replying JOIN_WELCOME`,
      );
      this.sendHandshakeMessage({
        type: 'JOIN_WELCOME',
        code: this.activeRoomCode,
        hostName: this.localName,
        hasStream: Boolean(this.localStream),
        peerId: myPeerId,
      });
      this.sendHandshakeMessage({
        type: 'JOIN_CONFIRMED',
        code: this.activeRoomCode,
        hostName: this.localName,
        hasStream: Boolean(this.localStream),
        peerId: myPeerId,
      });
      this.callbacks.onMessage({
        type: 'HELLO',
        name: msg.name,
        role: 'guest',
        hasStream: msg.hasStream,
        peerId: resolvedPeerId,
      });
      this.markRoomEntered(gen, `join-hello-${via}`, resolvedPeerId);

      // If Partner joined without camera/mic while Host HAS a camera, Host initiates MediaConnection in parallel
      if (!msg.hasStream && this.localStream && !this.hasSentLocalMediaStream && resolvedPeerId) {
        window.setTimeout(() => {
          if (gen !== this.sessionGen || !this.hasEnteredRoom || this.hasSentLocalMediaStream) return;
          this.initiateMediaCall(resolvedPeerId, gen);
        }, 150);
      }
      return;
    }

    if ((msg.type === 'JOIN_WELCOME' || msg.type === 'JOIN_CONFIRMED') && this.role === 'guest') {
      const resolvedPeerId = msg.peerId || connPeerId;
      console.log(
        `[CoupleCam P2P][Partner] Received ${msg.type} from Host "${msg.hostName}" (via ${via}) -> entering Hub!`,
      );
      this.callbacks.onMessage({
        type: 'HELLO',
        name: msg.hostName,
        role: 'host',
        hasStream: msg.hasStream,
        peerId: resolvedPeerId,
      });
      this.markRoomEntered(gen, `join-welcome-${via}`, resolvedPeerId);
      return;
    }

    if (msg.type === 'HELLO') {
      const resolvedPeerId = msg.peerId || connPeerId;
      if (resolvedPeerId) {
        this.remotePeerId = resolvedPeerId;
      }
      if (this.role === 'guest' && !this.hasEnteredRoom) {
        console.log(
          `[CoupleCam P2P][Partner] Received HELLO from Host "${msg.name}" (via ${via}) -> confirming room entry!`,
        );
        this.markRoomEntered(gen, `hello-${via}`, resolvedPeerId);
      } else if (this.role === 'host') {
        this.markRoomEntered(gen, `hello-${via}`, resolvedPeerId);
        if (!msg.hasStream && this.localStream && !this.hasSentLocalMediaStream && resolvedPeerId) {
          window.setTimeout(() => {
            if (gen !== this.sessionGen || !this.hasEnteredRoom || this.hasSentLocalMediaStream) return;
            this.initiateMediaCall(resolvedPeerId, gen);
          }, 150);
        }
      } else if (
        this.hasEnteredRoom &&
        this.localStream &&
        !this.hasSentLocalMediaStream &&
        resolvedPeerId &&
        this.peer?.open
      ) {
        this.initiateMediaCall(resolvedPeerId, gen);
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
      if (this.guestAttemptStallTimer !== null) {
        window.clearTimeout(this.guestAttemptStallTimer);
        this.guestAttemptStallTimer = null;
      }
      console.log(`[CoupleCam P2P][${roleLabel}] Step 4 (PeerJS): DataConnection OPEN with "${conn.peer}"`);

      if (this.role === 'host') {
        console.log(`[CoupleCam P2P][Host] Sending immediate JOIN_WELCOME + HELLO to partner "${conn.peer}"`);
        this.sendHandshakeMessage({
          type: 'JOIN_WELCOME',
          code: this.activeRoomCode,
          hostName: this.localName,
          hasStream: Boolean(this.localStream),
        });
        this.sendHandshakeMessage({
          type: 'JOIN_CONFIRMED',
          code: this.activeRoomCode,
          hostName: this.localName,
          hasStream: Boolean(this.localStream),
        });
        this.sendHandshakeMessage({
          type: 'HELLO',
          name: this.localName,
          role: 'host',
          hasStream: Boolean(this.localStream),
        });
        this.markRoomEntered(gen, 'host-channel-open', conn.peer);
      } else {
        this.sendPartnerJoinHandshake(gen);
        this.startJoinRetryLoop(gen);
        // Launch parallel MediaConnection right after DataConnection opens (non-blocking)
        if (this.localStream && !this.hasSentMediaCall) {
          this.initiateMediaCall(conn.peer, gen);
        }
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
        if (this.role === 'guest' && !this.hasEnteredRoom && this.peer && !this.peer.destroyed && this.guestRetryCount < MAX_GUEST_RETRIES) {
          this.dataConn = null;
          try {
            conn.close();
          } catch {
            // Ignore close error
          }
          this.scheduleGuestPeerRetry(this.peer, this.remotePeerId || getPeerRoomId(this.activeRoomCode), this.activeRoomCode, gen, 'ice-failed');
          return;
        }
        this.destroy();
        this.callbacks.onRemoteStream(null);
        this.callbacks.onStatusChange('error', ERR_NETWORK_BLOCKED);
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
        if (this.peer && !this.peer.destroyed && this.guestRetryCount < MAX_GUEST_RETRIES) {
          this.scheduleGuestPeerRetry(
            this.peer,
            this.remotePeerId || getPeerRoomId(this.activeRoomCode),
            this.activeRoomCode,
            gen,
            'conn-closed',
          );
          return;
        }
        this.destroy();
        this.callbacks.onStatusChange('error', ERR_NETWORK_BLOCKED);
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
      if (this.role === 'guest' && !this.hasEnteredRoom && this.peer && !this.peer.destroyed && this.guestRetryCount < MAX_GUEST_RETRIES) {
        this.dataConn = null;
        try {
          conn.close();
        } catch {
          // Ignore close error
        }
        this.scheduleGuestPeerRetry(
          this.peer,
          this.remotePeerId || getPeerRoomId(this.activeRoomCode),
          this.activeRoomCode,
          gen,
          'conn-error',
        );
        return;
      }
      this.destroy();
      this.callbacks.onStatusChange('error', ERR_NETWORK_BLOCKED);
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
    this.detachLifecycleListeners();
    this.lastRealtimeSendByType.clear();
    this.remotePeerId = null;
    this.hasEnteredRoom = false;
    this.hasSentMediaCall = false;
    this.hasSentLocalMediaStream = false;
    this.hostWaitingNotified = false;
    this.relayRoomNotFound = false;
    this.peerUnavailable = false;
    this.relayReconnectAttempts = 0;

    const activeCodeSnapshot = this.activeRoomCode;
    const ws = this.relayWs;
    this.relayWs = null;
    const sse = this.relaySse;
    const sseClientId = this.relaySseClientId;
    const sseWasReady = this.relaySseReady;
    this.relaySse = null;
    this.relaySseClientId = null;
    this.relaySseReady = false;
    this.relayHostReady = false;
    this.relayGuestJoined = false;

    if (ws) {
      try {
        if (ws.readyState === WebSocket.OPEN && activeCodeSnapshot) {
          ws.send(JSON.stringify({ type: 'LEAVE_ROOM', code: activeCodeSnapshot }));
        }
        ws.close();
      } catch {
        // Ignore close error
      }
    }

    if (sse) {
      if (sseWasReady && sseClientId && activeCodeSnapshot) {
        const base = this.getRelaySseBaseUrl();
        if (base) {
          void fetch(`${base}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'LEAVE_ROOM',
              code: activeCodeSnapshot,
              clientId: sseClientId,
            }),
            keepalive: true,
          }).catch(() => {});
        }
      }
      try {
        sse.close();
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
