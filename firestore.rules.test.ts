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
  'activeGame',
  'scores',
  'diceCount',
  'offer',
  'answer',
  'webrtcGen',
  'hostHasAudio',
  'guestHasAudio',
  'hostMicMuted',
  'guestMicMuted',
  'createdAt',
  'updatedAt',
]);

const REQUIRED_ROOM_KEYS = [
  'hostName',
  'guestName',
  'status',
  'activeGame',
  'scores',
  'diceCount',
  'webrtcGen',
  'hostHasAudio',
  'guestHasAudio',
  'hostMicMuted',
  'guestMicMuted',
  'createdAt',
  'updatedAt',
];

function isValidRoomCode(code: unknown): boolean {
  return typeof code === 'string' && code.length === 4 && /^[A-Z0-9]{4}$/.test(code);
}

function isValidActiveGame(val: unknown): boolean {
  return val === null || val === 'parcheesi';
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
  if (
    data.status !== 'waiting' &&
    data.status !== 'connected' &&
    data.status !== 'playing' &&
    data.status !== 'closed'
  ) {
    return false;
  }
  if (!isValidActiveGame(data.activeGame)) return false;
  if (!data.scores || typeof data.scores !== 'object' || Array.isArray(data.scores) || Object.keys(data.scores).length > 16) {
    return false;
  }
  if (data.diceCount !== 1 && data.diceCount !== 2) return false;
  if (typeof data.webrtcGen !== 'number' || !Number.isInteger(data.webrtcGen) || data.webrtcGen < 0 || data.webrtcGen > 1000) {
    return false;
  }
  if (
    typeof data.hostHasAudio !== 'boolean' ||
    typeof data.guestHasAudio !== 'boolean' ||
    typeof data.hostMicMuted !== 'boolean' ||
    typeof data.guestMicMuted !== 'boolean'
  ) {
    return false;
  }
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
    incoming.activeGame === null &&
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

  const expectedJoinStatus = existing.activeGame === 'parcheesi' ? 'playing' : 'connected';
  const action1 =
    incoming.status === expectedJoinStatus &&
    incoming.activeGame === existing.activeGame &&
    typeof incoming.guestName === 'string' &&
    incoming.guestName.length >= 1 &&
    onlyIn(['guestName', 'status', 'guestHasAudio', 'guestMicMuted', 'updatedAt']);

  const action2 =
    incoming.guestName === existing.guestName &&
    ((incoming.activeGame === null && (incoming.status === 'waiting' || incoming.status === 'connected')) ||
      (incoming.activeGame === 'parcheesi' && incoming.status === 'playing')) &&
    onlyIn(['activeGame', 'status', 'scores', 'diceCount', 'updatedAt']);

  const action3 =
    (incoming.status === 'connected' || incoming.status === 'playing') &&
    incoming.guestName === existing.guestName &&
    incoming.activeGame === existing.activeGame &&
    (incoming.webrtcGen as number) >= (existing.webrtcGen as number) &&
    onlyIn(['offer', 'answer', 'webrtcGen', 'hostHasAudio', 'hostMicMuted', 'updatedAt']);

  const action4 =
    (incoming.status === 'connected' || incoming.status === 'playing') &&
    incoming.guestName === existing.guestName &&
    incoming.activeGame === existing.activeGame &&
    incoming.webrtcGen === existing.webrtcGen &&
    onlyIn(['answer', 'guestHasAudio', 'guestMicMuted', 'updatedAt']);

  const action5 =
    incoming.status === existing.status &&
    incoming.guestName === existing.guestName &&
    incoming.activeGame === existing.activeGame &&
    onlyIn(['hostHasAudio', 'guestHasAudio', 'hostMicMuted', 'guestMicMuted', 'updatedAt']);

  const action6 =
    incoming.status === 'closed' &&
    incoming.activeGame === null &&
    onlyIn(['status', 'activeGame', 'updatedAt']);

  return action1 || action2 || action3 || action4 || action5 || action6;
}

function canCreateChatMessage(
  code: string,
  parentRoom: Record<string, unknown> | null,
  incoming: Record<string, unknown>,
  requestTime: number,
): boolean {
  if (!isValidRoomCode(code) || !parentRoom || parentRoom.status === 'closed') return false;
  const keys = Object.keys(incoming);
  const allowed = ['sender', 'senderName', 'text', 'kind', 'createdAt'];
  if (!allowed.every((k) => keys.includes(k)) || !keys.every((k) => allowed.includes(k))) return false;
  if (incoming.sender !== 'host' && incoming.sender !== 'guest') return false;
  if (typeof incoming.senderName !== 'string' || incoming.senderName.length < 1 || incoming.senderName.length > 32) return false;
  if (typeof incoming.text !== 'string' || incoming.text.length < 1 || incoming.text.length > 280) return false;
  if (incoming.kind !== 'text' && incoming.kind !== 'reaction') return false;
  return incoming.createdAt === requestTime;
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
  assert.match(RULES_SRC, /match \/chat\/\{chatId\}[\s\S]*?roomExistsAndActive\(code\)[\s\S]*?allow update, delete: if false;/);
  assert.match(RULES_SRC, /match \/messages\/\{messageId\}[\s\S]*?roomExistsAndActive\(code\)[\s\S]*?allow update, delete: if false;/);
  assert.match(RULES_SRC, /match \/candidates\/\{candidateId\}[\s\S]*?roomExistsAndActive\(code\)[\s\S]*?allow update, delete: if false;/);
});

test('Dirty Dozen adversarial payloads are all denied while valid Room Menu -> Parcheesi lifecycle succeeds', () => {
  const t0 = 1_700_000_000_000;
  const t1 = t0 + 1000;
  const validInitialRoom: Record<string, unknown> = {
    hostName: 'Alex',
    guestName: '',
    status: 'waiting',
    activeGame: null,
    scores: {},
    diceCount: 2,
    offer: null,
    answer: null,
    webrtcGen: 0,
    hostHasAudio: false,
    guestHasAudio: false,
    hostMicMuted: false,
    guestMicMuted: false,
    createdAt: t0,
    updatedAt: t0,
  };

  // Happy path create (lands in Room Menu with activeGame: null)
  assert.equal(canCreateRoom('A7K4', validInitialRoom, t0), true);

  // Attack 1: Room Code ID Poisoning
  assert.equal(canCreateRoom('invalid-1.5kb-' + 'x'.repeat(200), validInitialRoom, t0), false);

  // Attack 2: Room Enumeration / Scraping
  assert.match(RULES_SRC, /allow get: if isValidRoomCode\(code\);\s*allow list: if false;/);

  // Attack 3: Shadow Field Injection on Create
  assert.equal(canCreateRoom('A7K4', { ...validInitialRoom, isAdmin: true }, t0), false);

  // Attack 4: Initial Status / Auto-Start Bypass
  assert.equal(canCreateRoom('A7K4', { ...validInitialRoom, status: 'playing', activeGame: 'parcheesi' }, t0), false);
  assert.equal(canCreateRoom('A7K4', { ...validInitialRoom, activeGame: 'parcheesi' }, t0), false);

  // Attack 5: Spoofed Client Timestamp
  assert.equal(canCreateRoom('A7K4', { ...validInitialRoom, createdAt: t0 - 5000 }, t0), false);

  // Happy path Guest joins into Room Menu (activeGame stays null!)
  const joinedRoom = {
    ...validInitialRoom,
    guestName: 'Nadia',
    status: 'connected',
    guestHasAudio: false,
    guestMicMuted: false,
    updatedAt: t1,
  };
  assert.equal(canUpdateRoom('A7K4', validInitialRoom, joinedRoom, t1), true);

  // Guest cannot auto-start Parcheesi while joining
  assert.equal(
    canUpdateRoom(
      'A7K4',
      validInitialRoom,
      { ...joinedRoom, status: 'playing', activeGame: 'parcheesi', updatedAt: t1 },
      t1,
    ),
    false,
  );

  // Happy path Host launches Parcheesi from Room Menu
  const playingRoom = {
    ...joinedRoom,
    activeGame: 'parcheesi',
    status: 'playing',
    diceCount: 1,
    updatedAt: t1 + 50,
  };
  assert.equal(canUpdateRoom('A7K4', joinedRoom, playingRoom, t1 + 50), true);

  // Happy path Host returns to Room Menu without leaving room
  const returnedToMenu = {
    ...playingRoom,
    activeGame: null,
    status: 'connected',
    updatedAt: t1 + 80,
  };
  assert.equal(canUpdateRoom('A7K4', playingRoom, returnedToMenu, t1 + 80), true);

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
  const closedRoom = { ...joinedRoom, status: 'closed', activeGame: null, updatedAt: t1 + 200 };
  assert.equal(canUpdateRoom('A7K4', joinedRoom, closedRoom, t1 + 200), true);
  assert.equal(
    canUpdateRoom('A7K4', closedRoom, { ...closedRoom, status: 'connected', updatedAt: t1 + 300 }, t1 + 300),
    false,
  );

  // Attack 8: Value Poisoning on diceCount & activeGame
  assert.equal(
    canUpdateRoom('A7K4', joinedRoom, { ...joinedRoom, diceCount: 99, updatedAt: t1 + 100 }, t1 + 100),
    false,
  );
  assert.equal(
    canUpdateRoom('A7K4', joinedRoom, { ...joinedRoom, activeGame: 'music-quiz', status: 'playing', updatedAt: t1 + 100 }, t1 + 100),
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

  // Attack 10: Orphaned Subcollection Creation (missing or closed parent room)
  assert.equal(
    canCreateChatMessage(
      'ZZZZ',
      null,
      { sender: 'host', senderName: 'Alex', text: 'Salut !', kind: 'text', createdAt: t1 },
      t1,
    ),
    false,
  );
  assert.equal(
    canCreateChatMessage(
      'A7K4',
      closedRoom,
      { sender: 'host', senderName: 'Alex', text: 'Salut !', kind: 'text', createdAt: t1 },
      t1,
    ),
    false,
  );

  // Happy path Chat Message & Attack 11: Oversized Chat Payload (> 280 chars)
  assert.equal(
    canCreateChatMessage(
      'A7K4',
      joinedRoom,
      { sender: 'guest', senderName: 'Nadia', text: 'Prête pour Parcheesi !', kind: 'text', createdAt: t1 },
      t1,
    ),
    true,
  );
  assert.equal(
    canCreateChatMessage(
      'A7K4',
      joinedRoom,
      { sender: 'guest', senderName: 'Nadia', text: 'A'.repeat(281), kind: 'text', createdAt: t1 },
      t1,
    ),
    false,
  );

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
