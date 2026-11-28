import type { RoomRole } from '../types/duoplay';
import { normalizeRoomCode, sanitizePlayerName } from './roomCode';

export const ROOM_SESSION_STORAGE_KEY = 'couplecam_parcheesi_room_session_v1';

export interface PersistedRoomSession {
  roomCode: string;
  role: RoomRole;
  playerName: string;
  savedAt: number;
}

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function getDefaultStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch {
    // Ignore restricted storage environments
  }
  return null;
}

export function savePersistedRoomSession(
  session: { roomCode: string; role: RoomRole; playerName: string },
  storage: StorageLike | null = getDefaultStorage(),
): void {
  if (!storage) return;
  const cleanCode = normalizeRoomCode(session.roomCode);
  if (cleanCode.length !== 4) return;
  const payload: PersistedRoomSession = {
    roomCode: cleanCode,
    role: session.role === 'guest' ? 'guest' : 'host',
    playerName: sanitizePlayerName(session.playerName, session.role === 'host' ? 'Hôte' : 'Invité'),
    savedAt: Date.now(),
  };
  try {
    storage.setItem(ROOM_SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota errors
  }
}

export function loadPersistedRoomSession(
  storage: StorageLike | null = getDefaultStorage(),
): PersistedRoomSession | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(ROOM_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedRoomSession>;
    const cleanCode = normalizeRoomCode(String(parsed.roomCode ?? ''));
    if (cleanCode.length !== 4) return null;
    if (parsed.role !== 'host' && parsed.role !== 'guest') return null;
    const playerName = sanitizePlayerName(
      String(parsed.playerName ?? ''),
      parsed.role === 'host' ? 'Hôte' : 'Invité',
    );
    return {
      roomCode: cleanCode,
      role: parsed.role,
      playerName,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function clearPersistedRoomSession(
  storage: StorageLike | null = getDefaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(ROOM_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
