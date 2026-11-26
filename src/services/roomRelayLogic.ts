/**
 * Pure in-memory room registry & message routing state machine for the
 * WebSocket (`/ws/room`) and HTTP/SSE (`/api/room/*`) room relays.
 * Decoupled from `ws` / `express` so it can be exhaustively unit-tested with `node:test`.
 */

export const HOST_DISCONNECT_GRACE_MS = 90_000;
export const GUEST_DISCONNECT_GRACE_MS = 15_000;
export const MAX_QUEUED_MESSAGES = 32;

export interface RelayClient {
  id: string;
  role: 'host' | 'guest';
  name: string;
  hasStream?: boolean;
  send: (payload: Record<string, unknown>) => void;
}

export interface RelayRoom {
  code: string;
  host: RelayClient;
  guest: RelayClient | null;
  createdAt: number;
  hostDisconnectedAt: number | null;
  guestDisconnectedAt: number | null;
  queuedForHost: Record<string, unknown>[];
  queuedForGuest: Record<string, unknown>[];
}

/**
 * Mirrors client-side room code normalization so Host and Partner ALWAYS map
 * to the exact same room key regardless of whitespace, punctuation, or casing.
 */
export function normalizeRelayRoomCode(raw: string): string {
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

export class RoomRelayRegistry {
  private rooms = new Map<string, RelayRoom>();

  public getRoom(rawCode: string): RelayRoom | undefined {
    const code = normalizeRelayRoomCode(rawCode);
    if (!code) return undefined;
    return this.rooms.get(code);
  }

  public getRoomCount(): number {
    return this.rooms.size;
  }

  private safeDeliver(client: RelayClient, payload: Record<string, unknown>): boolean {
    try {
      client.send(payload);
      return true;
    } catch {
      return false;
    }
  }

  private enqueue(queue: Record<string, unknown>[], payload: Record<string, unknown>) {
    queue.push(payload);
    if (queue.length > MAX_QUEUED_MESSAGES) {
      queue.shift();
    }
  }

  public registerHost(
    rawCode: string,
    host: RelayClient,
    now: number = Date.now(),
  ): { ok: true; code: string; resumed: boolean } | { ok: false; reason: 'invalid-code' | 'code-taken' } {
    const code = normalizeRelayRoomCode(rawCode);
    if (code.length !== 4) {
      return { ok: false, reason: 'invalid-code' };
    }

    const existing = this.rooms.get(code);
    if (existing) {
      const sameHost = existing.host.id === host.id;
      const hostWasTemporarilyAway = existing.hostDisconnectedAt !== null;

      if (!sameHost && !hostWasTemporarilyAway) {
        return { ok: false, reason: 'code-taken' };
      }

      // Seamlessly resume the existing room (e.g. Host returned from WhatsApp / reconnected transport)
      existing.host = host;
      existing.hostDisconnectedAt = null;
      this.safeDeliver(host, { type: 'RELAY_HOST_READY', code, resumed: true });

      // If Partner already joined while Host was temporarily backgrounded, pair them right away!
      if (existing.guest) {
        this.safeDeliver(host, {
          type: 'RELAY_PARTNER_CONNECTED',
          code,
          guestId: existing.guest.id,
          name: existing.guest.name,
          hasStream: Boolean(existing.guest.hasStream),
        });
        if (existing.guestDisconnectedAt === null) {
          this.safeDeliver(existing.guest, {
            type: 'RELAY_HOST_RECONNECTED',
            code,
            hostName: host.name,
          });
        }
      }

      if (existing.queuedForHost.length > 0) {
        const pending = existing.queuedForHost.splice(0);
        for (const msg of pending) {
          this.safeDeliver(host, msg);
        }
      }

      return { ok: true, code, resumed: true };
    }

    this.rooms.set(code, {
      code,
      host,
      guest: null,
      createdAt: now,
      hostDisconnectedAt: null,
      guestDisconnectedAt: null,
      queuedForHost: [],
      queuedForGuest: [],
    });
    this.safeDeliver(host, { type: 'RELAY_HOST_READY', code, resumed: false });
    return { ok: true, code, resumed: false };
  }

  public joinGuest(
    rawCode: string,
    guest: RelayClient,
    hasStream = false,
  ): { ok: true; code: string } | { ok: false; reason: 'invalid-code' | 'room-not-found' | 'room-full' } {
    const code = normalizeRelayRoomCode(rawCode);
    if (code.length !== 4) {
      return { ok: false, reason: 'invalid-code' };
    }
    const room = this.rooms.get(code);
    if (!room) {
      this.safeDeliver(guest, { type: 'RELAY_ROOM_NOT_FOUND', code });
      return { ok: false, reason: 'room-not-found' };
    }

    const isSameGuestReconnecting = room.guest?.id === guest.id;
    if (room.guest && !isSameGuestReconnecting) {
      // Allow re-joining partner (e.g. after transport upgrade/fallback) to replace a stale guest slot cleanly
      this.safeDeliver(room.guest, { type: 'RELAY_PEER_LEFT', code, reason: 'replaced' });
    }

    const storedGuest: RelayClient = { ...guest, hasStream };
    room.guest = storedGuest;
    room.guestDisconnectedAt = null;

    const partnerConnectedPayload = {
      type: 'RELAY_PARTNER_CONNECTED',
      code,
      guestId: storedGuest.id,
      name: storedGuest.name,
      hasStream,
    };

    if (room.hostDisconnectedAt === null) {
      // Host is online right now -> notify immediately
      this.safeDeliver(room.host, partnerConnectedPayload);
    } else {
      // Host is temporarily backgrounded (e.g. pasting code in WhatsApp) -> deliver as soon as Host wakes up
      this.enqueue(room.queuedForHost, partnerConnectedPayload);
    }

    // Confirm room entry to Guest right away so Guest never hangs on "Connexion..."
    this.safeDeliver(storedGuest, {
      type: 'RELAY_JOINED_ROOM',
      code,
      hostName: room.host.name,
      hostOnline: room.hostDisconnectedAt === null,
    });

    if (room.queuedForGuest.length > 0) {
      const pending = room.queuedForGuest.splice(0);
      for (const msg of pending) {
        this.safeDeliver(storedGuest, msg);
      }
    }

    return { ok: true, code };
  }

  public forwardMessage(rawCode: string, senderId: string, message: Record<string, unknown>): boolean {
    const room = this.getRoom(rawCode);
    if (!room) return false;

    if (room.host.id === senderId) {
      if (!room.guest) return false;
      const envelope = { type: 'RELAY_DATA', code: room.code, data: message };
      if (room.guestDisconnectedAt === null) {
        return this.safeDeliver(room.guest, envelope);
      }
      this.enqueue(room.queuedForGuest, envelope);
      return true;
    }

    if (room.guest?.id === senderId) {
      const envelope = { type: 'RELAY_DATA', code: room.code, data: message };
      if (room.hostDisconnectedAt === null) {
        return this.safeDeliver(room.host, envelope);
      }
      this.enqueue(room.queuedForHost, envelope);
      return true;
    }

    return false;
  }

  /**
   * Called on unintentional transport drop (e.g. mobile OS pausing a tab when switching to WhatsApp
   * to share the code). Keeps the room alive during the grace window so reconnects are seamless.
   */
  public detachClient(rawCode: string, clientId: string, now: number = Date.now()): void {
    const code = normalizeRelayRoomCode(rawCode);
    const room = this.rooms.get(code);
    if (!room) return;

    if (room.host.id === clientId) {
      room.hostDisconnectedAt = now;
      return;
    }

    if (room.guest?.id === clientId) {
      room.guestDisconnectedAt = now;
    }
  }

  /**
   * Called on explicit `LEAVE_ROOM` (user clicked Cancel / Quit). Cleans up immediately.
   */
  public removeClient(rawCode: string, clientId: string): void {
    const code = normalizeRelayRoomCode(rawCode);
    const room = this.rooms.get(code);
    if (!room) return;

    if (room.host.id === clientId) {
      if (room.guest && room.guestDisconnectedAt === null) {
        this.safeDeliver(room.guest, { type: 'RELAY_PEER_LEFT', code, reason: 'host-left' });
      }
      this.rooms.delete(code);
      return;
    }

    if (room.guest?.id === clientId) {
      room.guest = null;
      room.guestDisconnectedAt = null;
      room.queuedForGuest = [];
      if (room.hostDisconnectedAt === null) {
        this.safeDeliver(room.host, { type: 'RELAY_PEER_LEFT', code, reason: 'guest-left' });
      }
    }
  }

  /**
   * Expires detached hosts/guests after their grace windows elapse.
   */
  public pruneExpired(now: number = Date.now()): number {
    let pruned = 0;
    for (const [code, room] of this.rooms.entries()) {
      if (
        room.hostDisconnectedAt !== null &&
        now - room.hostDisconnectedAt >= HOST_DISCONNECT_GRACE_MS
      ) {
        if (room.guest && room.guestDisconnectedAt === null) {
          this.safeDeliver(room.guest, { type: 'RELAY_PEER_LEFT', code, reason: 'host-timeout' });
        }
        this.rooms.delete(code);
        pruned += 1;
        continue;
      }

      if (
        room.guest &&
        room.guestDisconnectedAt !== null &&
        now - room.guestDisconnectedAt >= GUEST_DISCONNECT_GRACE_MS
      ) {
        room.guest = null;
        room.guestDisconnectedAt = null;
        room.queuedForGuest = [];
        if (room.hostDisconnectedAt === null) {
          this.safeDeliver(room.host, { type: 'RELAY_PEER_LEFT', code, reason: 'guest-timeout' });
        }
        pruned += 1;
      }
    }
    return pruned;
  }
}
