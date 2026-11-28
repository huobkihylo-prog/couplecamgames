/**
 * Pure decoupled room-code, WebRTC STUN configuration, and Firestore payload sanitization helpers.
 */

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

/**
 * Builds the WebRTC ICE server list combining Google & Twilio public STUN servers
 * with an optional TURN server configured via Vite env vars (`VITE_TURN_URL`,
 * `VITE_TURN_USER`, `VITE_TURN_PASS`).
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

export const ERR_ROOM_NOT_FOUND =
  "Salon introuvable. Vérifie le code ou demande à ton/ta partenaire de rester sur le salon.";
export const ERR_NETWORK_BLOCKED =
  'Connexion lente ou bloquée par le réseau (Wi-Fi / 4G). Clique sur Réessayer.';

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
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * Cleans and normalizes room codes identically on both Host and Guest:
 * extracts `?room=...` if a full share URL was pasted, strips whitespace & non-alphanumeric chars,
 * unifies to uppercase (`code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')`), max 4 chars.
 */
export function normalizeRoomCode(raw: string): string {
  const trimmed = raw.trim();
  const roomQueryMatch = trimmed.match(/[?&]room=([^&#]+)/i);
  const candidate = roomQueryMatch ? decodeURIComponent(roomQueryMatch[1]) : trimmed;
  return candidate
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
}

/**
 * Clamps a display name to the firebase-blueprint.json boundary (1..32 chars).
 */
export function sanitizePlayerName(raw: string, fallback: string): string {
  const clean = raw.trim().slice(0, 32);
  return clean.length > 0 ? clean : fallback;
}

/**
 * Recursively removes `undefined` properties and replaces NaN/Infinity with 0
 * so every game payload complies strictly with Cloud Firestore map serialization rules.
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'number') {
    return (Number.isFinite(value) ? value : 0) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val !== undefined) {
        out[key] = stripUndefinedDeep(val);
      }
    }
    return out as T;
  }
  return value;
}

/**
 * Sanitizes an RTCIceCandidateInit object so it matches the strict Firestore candidate schema.
 */
export function sanitizeIceCandidate(init: RTCIceCandidateInit): {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment: string | null;
} {
  const candidateStr = typeof init.candidate === 'string' ? init.candidate.slice(0, 2048) : '';
  const sdpMid = typeof init.sdpMid === 'string' ? init.sdpMid.slice(0, 64) : null;
  const sdpMLineIndex =
    typeof init.sdpMLineIndex === 'number' &&
    Number.isInteger(init.sdpMLineIndex) &&
    init.sdpMLineIndex >= 0 &&
    init.sdpMLineIndex <= 32
      ? init.sdpMLineIndex
      : null;
  const usernameFragment =
    typeof init.usernameFragment === 'string' ? init.usernameFragment.slice(0, 128) : null;
  return {
    candidate: candidateStr,
    sdpMid,
    sdpMLineIndex,
    usernameFragment,
  };
}
