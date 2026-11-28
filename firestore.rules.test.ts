import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Security Rules Structural & Dirty Dozen Verification Suite.
 *
 * Mirrors every predicate in `/firestore.rules` and verifies both the raw rules file
 * invariants and all 12 adversarial payloads specified in `/security_spec.md`.
 */

const RULES_PATH = path.resolve(process.cwd(), 'firestore.rules');
const RULES_SRC = fs.readFileSync(RULES_PATH, 'utf8');

const VALID_ROOM_KEYS = new Set([
  'hostName',
  'guestName',
  'status',
  'currentGame',
  'scores',
  'diceCount',
  'offer',
  'answer',
  'webrtcGen',
  'hostHasStream',
  'guestHasStream',
  'createdAt',
  'updatedAt',
]);

const REQUIRED_ROOM_KEYS = [
  'hostName',
  'guestName',
  'status',
  'currentGame',
  'scores',
  'diceCount',
  'webrtcGen',
  'hostHasStream',
  'guestHasStream',
  'createdAt',
  'updatedAt',
];

function isValidRoomCode(code: unknown): boolean {
  return typeof code === 'string' && code.length === 4 && /^[A-Z0-9]{4}$/.test(code);
}

function isValidSdp(sdpObj: unknown, expectedType: 'offer' | 'answer'): boolean {
  if (sdpObj === null) return true;
  if (!sdpObj || typeof sdpObj !== 'object' || Array.isArray(sdpObj)) return false;
  const rec = sdpObj as Record<string, unknown>;
  const keys = Object.keys(rec);
  if (keys.length !== 2 || !keys.includes('type') || !keys.includes('sdp')) return false;
  return (
    rec.type === expectedType &&
    typeof rec.sdp === 'string' &&
    rec.sdp.length >= 1 &&
    rec.sdp.length <= 20000
  );
}

function isValidRoom(data: Record<string, unknown>): boolean {
  const keys = Object.keys(data);
  if (!REQUIRED_ROOM_KEYS.every((k) => keys.includes(k))) return false;
  if (!keys.every((k) => VALID_ROOM_KEYS.has(k))) return false;
  if (typeof data.hostName !== 'string' || data.hostName.length < 1 || data.hostName.length > 32) return false;
  if (typeof data.guestName !== 'string' || data.guestName.length > 32) return false;
  if (data.status !== 'waiting' && data.status !== 'connected' && data.status !== 'closed') return false;
  if (
    typeof data.currentGame !== 'string' ||
    data.currentGame.length < 1 ||
    data.currentGame.length > 32 ||
    !/^[a-z0-9-]+$/.test(data.currentGame)
  ) {
    return false;
  }
  if (!data.scores || typeof data.scores !== 'object' || Array.isArray(data.scores) || Object.keys(data.scores).length > 24) {
    return false;
  }
  if (data.diceCount !== 1 && data.diceCount !== 2) return false;
  if (typeof data.webrtcGen !== 'number' || !Number.isInteger(data.webrtcGen) || data.webrtcGen < 0 || data.webrtcGen > 1000) {
    return false;
  }
  if (typeof data.hostHasStream !== 'boolean' || typeof data.guestHasStream !== 'boolean') return false;
  if (typeof data.createdAt !== 'number' || typeof data.updatedAt !== 'number') return false;
  if ('offer' in data && !isValidSdp(data.offer, 'offer')) return false;
  if ('answer' in data && !isValidSdp(data.answer, 'answer')) return false;
  return true;
}

function canCreateRoom(code: string, incoming: Record<string, unknown>, requestTime: number): boolean {
  return (
    isValidRoomCode(code) &&
    isValidRoom(incoming) &&
    incoming.status === 'waiting' &&
    incoming.guestName === '' &&
    incoming.webrtcGen === 0 &&
    incoming.createdAt === requestTime &&
    incoming.updatedAt === requestTime &&
    (!('offer' in incoming) || incoming.offer === null) &&
    (!('answer' in incoming) || incoming.answer === null)
  );
}

function affectedKeys(incoming: Record<string, unknown>, existing: Record<string, unknown>): string[] {
  const all = new Set([...Object.keys(incoming), ...Object.keys(existing)]);
  return [...all].filter((k) => JSON.stringify(incoming[k]) !== JSON.stringify(existing[k]));
}

function canUpdateRoom(
  code: string,
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  requestTime: number,
): boolean {
  if (!isValidRoomCode(code) || !isValidRoom(incoming)) return false;
  if (existing.status === 'closed') return false;
  if (incoming.createdAt !== existing.createdAt) return false;
  if (incoming.hostName !== existing.hostName) return false;
  if (incoming.updatedAt !== requestTime) return false;

  const changed = affectedKeys(incoming, existing);
  const onlyIn = (allowed: string[]) => changed.every((k) => allowed.includes(k));

  const action1 =
    incoming.status === 'connected' &&
    typeof incoming.guestName === 'string' &&
    incoming.guestName.length >= 1 &&
    onlyIn(['guestName', 'status', 'guestHasStream', 'updatedAt']);

  const action2 =
    incoming.status === existing.status &&
    incoming.guestName === existing.guestName &&
    onlyIn(['currentGame', 'scores', 'diceCount', 'updatedAt']);

  const action3 =
    incoming.status === 'connected' &&
    incoming.guestName === existing.guestName &&
    (incoming.webrtcGen as number) >= (existing.webrtcGen as number) &&
    onlyIn(['offer', 'answer', 'webrtcGen', 'hostHasStream', 'updatedAt']);

  const action4 =
    incoming.status === 'connected' &&
    incoming.guestName === existing.guestName &&
    incoming.webrtcGen === existing.webrtcGen &&
    onlyIn(['answer', 'guestHasStream', 'updatedAt']);

  const action5 =
    incoming.status === existing.status &&
    incoming.guestName === existing.guestName &&
    onlyIn(['hostHasStream', 'guestHasStream', 'updatedAt']);

  const action6 = incoming.status === 'closed' && onlyIn(['status', 'updatedAt']);

  return action1 || action2 || action3 || action4 || action5 || action6;
}

function canCreateCandidate(
  code: string,
  parentRoom: Record<string, unknown> | null,
  incoming: Record<string, unknown>,
  requestTime: number,
): boolean {
  if (!isValidRoomCode(code) || !parentRoom || parentRoom.status === 'closed') return false;
  const keys = Object.keys(incoming);
  const allowed = ['sender', 'webrtcGen', 'candidate', 'createdAt'];
  if (!allowed.every((k) => keys.includes(k)) || !keys.every((k) => allowed.includes(k))) return false;
  if (incoming.sender !== 'host' && incoming.sender !== 'guest') return false;
  if (typeof incoming.webrtcGen !== 'number' || incoming.webrtcGen < 0 || incoming.webrtcGen > 1000) return false;
  if (incoming.createdAt !== requestTime) return false;
  const cand = incoming.candidate as Record<string, unknown>;
  if (!cand || typeof cand !== 'object' || typeof cand.candidate !== 'string' || cand.candidate.length > 2048) {
    return false;
  }
  const candAllowed = ['candidate', 'sdpMid', 'sdpMLineIndex', 'usernameFragment'];
  return Object.keys(cand).every((k) => candAllowed.includes(k));
}

test('firestore.rules enforces default-deny, anti-enumeration, Master Gate, and append-only subcollections', () => {
  assert.match(RULES_SRC, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);
  assert.match(RULES_SRC, /match \/rooms\/\{code\}[\s\S]*?allow list: if false;/);
  assert.match(RULES_SRC, /allow delete: if false;/);
  assert.match(RULES_SRC, /function roomExistsAndActive\(code\)/);
  assert.match(RULES_SRC, /match \/messages\/\{messageId\}[\s\S]*?roomExistsAndActive\(code\)[\s\S]*?allow update, delete: if false;/);
  assert.match(RULES_SRC, /match \/candidates\/\{candidateId\}[\s\S]*?roomExistsAndActive\(code\)[\s\S]*?allow update, delete: if false;/);
});

test('Dirty Dozen adversarial payloads are all denied while valid lifecycle actions succeed', () => {
  const t0 = 1_700_000_000_000;
  const t1 = t0 + 1000;
  const validInitialRoom: Record<string, unknown> = {
    hostName: 'Alex',
    guestName: '',
    status: 'waiting',
    currentGame: 'hub',
    scores: {},
    diceCount: 2,
    offer: null,
    answer: null,
    webrtcGen: 0,
    hostHasStream: false,
    guestHasStream: false,
    createdAt: t0,
    updatedAt: t0,
  };

  // Happy path create
  assert.equal(canCreateRoom('A7K4', validInitialRoom, t0), true);

  // Attack 1: Room Code ID Poisoning
  assert.equal(canCreateRoom('invalid-1.5kb-' + 'x'.repeat(200), validInitialRoom, t0), false);

  // Attack 2: Room Enumeration / Scraping (verified via static allow list: if false)
  assert.match(RULES_SRC, /allow get: if isValidRoomCode\(code\);\s*allow list: if false;/);

  // Attack 3: Shadow Field Injection on Create
  assert.equal(canCreateRoom('A7K4', { ...validInitialRoom, isAdmin: true }, t0), false);

  // Attack 4: Initial Status Bypass
  assert.equal(canCreateRoom('A7K4', { ...validInitialRoom, status: 'connected' }, t0), false);

  // Attack 5: Spoofed Client Timestamp
  assert.equal(canCreateRoom('A7K4', { ...validInitialRoom, createdAt: t0 - 5000 }, t0), false);

  // Happy path Guest join
  const joinedRoom = {
    ...validInitialRoom,
    guestName: 'Nadia',
    status: 'connected',
    guestHasStream: false,
    updatedAt: t1,
  };
  assert.equal(canUpdateRoom('A7K4', validInitialRoom, joinedRoom, t1), true);

  // Attack 6: Immutable createdAt / hostName Tampering
  assert.equal(
    canUpdateRoom('A7K4', joinedRoom, { ...joinedRoom, hostName: 'Mallory', updatedAt: t1 + 100 }, t1 + 100),
    false,
  );
  assert.equal(
    canUpdateRoom('A7K4', joinedRoom, { ...joinedRoom, createdAt: t0 + 1, updatedAt: t1 + 100 }, t1 + 100),
    false,
  );

  // Attack 7: Post-Close Terminal Mutation
  const closedRoom = { ...joinedRoom, status: 'closed', updatedAt: t1 + 200 };
  assert.equal(canUpdateRoom('A7K4', joinedRoom, closedRoom, t1 + 200), true);
  assert.equal(
    canUpdateRoom('A7K4', closedRoom, { ...closedRoom, status: 'connected', updatedAt: t1 + 300 }, t1 + 300),
    false,
  );

  // Attack 8: Value Poisoning on diceCount
  assert.equal(
    canUpdateRoom('A7K4', joinedRoom, { ...joinedRoom, diceCount: 99, updatedAt: t1 + 100 }, t1 + 100),
    false,
  );

  // Attack 9: Oversized SDP / DoW Attack (> 20KB)
  assert.equal(
    canUpdateRoom(
      'A7K4',
      joinedRoom,
      {
        ...joinedRoom,
        offer: { type: 'offer', sdp: 'v=0\r\n' + 'A'.repeat(25000) },
        answer: null,
        webrtcGen: 1,
        updatedAt: t1 + 100,
      },
      t1 + 100,
    ),
    false,
  );

  // Attack 10: Orphaned Subcollection Creation (missing parent room)
  assert.equal(
    canCreateCandidate(
      'ZZZZ',
      null,
      {
        sender: 'host',
        webrtcGen: 1,
        candidate: { candidate: 'cand:1', sdpMid: '0', sdpMLineIndex: 0 },
        createdAt: t1,
      },
      t1,
    ),
    false,
  );

  // Attack 11: Message Update/Delete denied
  assert.match(RULES_SRC, /match \/messages\/\{messageId\}[\s\S]*?allow update, delete: if false;/);

  // Attack 12: Malformed ICE Candidate (invalid sender + shadow key)
  assert.equal(
    canCreateCandidate(
      'A7K4',
      joinedRoom,
      {
        sender: 'hacker',
        webrtcGen: 1,
        candidate: { candidate: 'cand:1', evil: true },
        createdAt: t1,
      },
      t1,
    ),
    false,
  );
});
