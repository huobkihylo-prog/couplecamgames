/**
 * Pure in-memory room registry & message routing state machine for the
 * WebSocket room relay (`/ws/room`). Decoupled from `ws` sockets so it can be
 * exhaustively unit-tested with `node:test`.
 */

export interface RelayClient {
  id: string;
  role: 'host' | 'guest';
  name: string;
  send: (payload: Record<string, unknown>) => void;
}

export interface RelayRoom {
  code: string;
  host: RelayClient;
  guest: RelayClient | null;
  createdAt: number;
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

  public registerHost(rawCode: string, host: RelayClient): { ok: true; code: string } | { ok: false; reason: 'invalid-code' | 'code-taken' } {
    const code = normalizeRelayRoomCode(rawCode);
    if (code.length !== 4) {
      return { ok: false, reason: 'invalid-code' };
    }
    const existing = this.rooms.get(code);
    if (existing && existing.host.id !== host.id) {
      return { ok: false, reason: 'code-taken' };
    }
    this.rooms.set(code, {
      code,
      host,
      guest: existing?.guest ?? null,
      createdAt: Date.now(),
    });
    host.send({ type: 'RELAY_HOST_READY', code });
    return { ok: true, code };
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
      guest.send({ type: 'RELAY_ROOM_NOT_FOUND', code });
      return { ok: false, reason: 'room-not-found' };
    }
    if (room.guest && room.guest.id !== guest.id) {
      // Allow re-joining partner to replace a stale guest slot cleanly
      try {
        room.guest.send({ type: 'RELAY_PEER_LEFT', code, reason: 'replaced' });
      } catch {
        // Ignore stale socket error
      }
    }
    room.guest = guest;

    // Notify Host immediately so Host confirms entry right away
    room.host.send({
      type: 'RELAY_PARTNER_CONNECTED',
      code,
      guestId: guest.id,
      name: guest.name,
      hasStream,
    });
    guest.send({
      type: 'RELAY_JOINED_ROOM',
      code,
      hostName: room.host.name,
    });
    return { ok: true, code };
  }

  public forwardMessage(rawCode: string, senderId: string, message: Record<string, unknown>): boolean {
    const room = this.getRoom(rawCode);
    if (!room) return false;
    if (room.host.id === senderId && room.guest) {
      room.guest.send({ type: 'RELAY_DATA', code: room.code, data: message });
      return true;
    }
    if (room.guest?.id === senderId) {
      room.host.send({ type: 'RELAY_DATA', code: room.code, data: message });
      return true;
    }
    return false;
  }

  public removeClient(rawCode: string, clientId: string): void {
    const code = normalizeRelayRoomCode(rawCode);
    const room = this.rooms.get(code);
    if (!room) return;

    if (room.host.id === clientId) {
      if (room.guest) {
        try {
          room.guest.send({ type: 'RELAY_PEER_LEFT', code, reason: 'host-left' });
        } catch {
          // Ignore send failure on closing socket
        }
      }
      this.rooms.delete(code);
      return;
    }

    if (room.guest?.id === clientId) {
      room.guest = null;
      try {
        room.host.send({ type: 'RELAY_PEER_LEFT', code, reason: 'guest-left' });
      } catch {
        // Ignore send failure on closing socket
      }
    }
  }
}
