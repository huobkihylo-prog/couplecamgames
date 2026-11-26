import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIceServers,
  CONNECT_TIMEOUT_MS,
  DuoPeerService,
  generateRoomCode,
  getPeerRoomId,
  GUEST_ATTEMPT_STALL_MS,
  GUEST_RETRY_DELAY_MS,
  HEARTBEAT_INTERVAL_MS,
  ICE_SERVERS,
  isSignalingOnlyError,
  MAX_GUEST_RETRIES,
  normalizeRoomCode,
  ROOM_PREFIX,
} from './peerService';
import { buildRoomShareUrl, extractRoomCodeFromSearch } from '../utils/clipboard';

test('normalizeRoomCode strips spaces/punctuation, extracts ?room= URLs, and unifies casing consistently', () => {
  assert.equal(normalizeRoomCode(' 48 29 '), '4829');
  assert.equal(normalizeRoomCode('48-29'), '4829');
  assert.equal(normalizeRoomCode(' aB 3c '), 'AB3C');
  assert.equal(normalizeRoomCode('ab12xyz'), 'AB12');
  assert.equal(normalizeRoomCode('https://couplecam.example/?room=4829'), '4829');
});

test('getPeerRoomId produces identical PeerJS room IDs regardless of spaces or letter case', () => {
  assert.equal(getPeerRoomId(' 48 29 '), `${ROOM_PREFIX}4829`);
  assert.equal(getPeerRoomId('aB3c'), getPeerRoomId(' AB 3C '));
  assert.equal(getPeerRoomId('Ab12'), `${ROOM_PREFIX}ab12`);
});

test('generateRoomCode always produces a 4-character alphanumeric code with both letters and digits', () => {
  for (let i = 0; i < 40; i++) {
    const code = generateRoomCode();
    assert.match(code, /^[A-Z0-9]{4}$/);
    assert.match(code, /[A-Z]/, `expected at least one letter in ${code}`);
    assert.match(code, /[0-9]/, `expected at least one digit in ${code}`);
    assert.doesNotMatch(code, /[0O1IL]/, `expected no ambiguous characters in ${code}`);
  }
});

test('ICE_SERVERS and buildIceServers configure the 4 STUN servers plus optional Vite TURN env vars', () => {
  const urls = ICE_SERVERS.flatMap((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]));
  assert.ok(urls.includes('stun:stun.l.google.com:19302'));
  assert.ok(urls.includes('stun:stun1.l.google.com:19302'));
  assert.ok(urls.includes('stun:stun2.l.google.com:19302'));
  assert.ok(urls.includes('stun:stun.cloudflare.com:3478'));
  assert.ok(
    urls.every((u) => !u.includes('openrelay.metered.ca') && !u.includes('global.stun.twilio.com')),
    'should not include unresolvable/unreachable STUN endpoints',
  );

  const withoutTurn = buildIceServers({});
  assert.equal(withoutTurn.length, 4);

  const withTurn = buildIceServers({
    VITE_TURN_URL: 'turn:relay.example.com:3478',
    VITE_TURN_USER: 'demo-user',
    VITE_TURN_PASS: 'demo-pass',
  });
  assert.equal(withTurn.length, 5);
  assert.deepEqual(withTurn[4], {
    urls: 'turn:relay.example.com:3478',
    username: 'demo-user',
    credential: 'demo-pass',
  });
});

test('Timeout, retry, and heartbeat constants match reliability guarantees', () => {
  assert.equal(CONNECT_TIMEOUT_MS, 15000);
  assert.equal(HEARTBEAT_INTERVAL_MS, 20000);
  assert.equal(MAX_GUEST_RETRIES, 3);
  assert.equal(GUEST_RETRY_DELAY_MS, 3000);
  assert.equal(GUEST_ATTEMPT_STALL_MS, 5000);
});

test('isSignalingOnlyError distinguishes transient signaling issues from peer-unavailable', () => {
  assert.equal(isSignalingOnlyError('network'), true);
  assert.equal(isSignalingOnlyError('disconnected'), true);
  assert.equal(isSignalingOnlyError('socket-closed'), true);
  assert.equal(isSignalingOnlyError('peer-unavailable'), false);
  assert.equal(isSignalingOnlyError('unavailable-id'), false);
});

test('buildRoomShareUrl and extractRoomCodeFromSearch round-trip room codes cleanly', () => {
  const url = buildRoomShareUrl(' 48 29 ', 'https://couplecam.example', '/');
  assert.equal(url, 'https://couplecam.example/?room=4829');
  assert.equal(extractRoomCodeFromSearch('?room=4829'), '4829');
  assert.equal(extractRoomCodeFromSearch('?room=%20ab%2012%20'), 'AB12');
  assert.equal(extractRoomCodeFromSearch('?room=12'), '');
});

test('sendRealtime throttles per message type so HAND_FRAME never drops HOCKEY_SYNC or NINJA_SYNC', () => {
  const sent: string[] = [];
  const svc = new DuoPeerService({
    onStatusChange: () => {},
    onRemoteStream: () => {},
    onMessage: () => {},
  });
  (svc as unknown as { dataConn: { open: boolean; send: (m: { type: string }) => void } }).dataConn = {
    open: true,
    send: (m) => sent.push(m.type),
  };

  svc.sendRealtime({ type: 'HAND_FRAME', game: 'air-hockey', x: 0.5, y: 0.5, detected: true, ts: 1 });
  svc.sendRealtime({
    type: 'HOCKEY_SYNC',
    phase: 'playing',
    puckX: 500,
    puckY: 300,
    puckVx: 100,
    puckVy: 0,
    p1X: 165,
    p1Y: 300,
    p2X: 835,
    p2Y: 300,
    p1Score: 0,
    p2Score: 0,
    lastScorer: null,
    winner: null,
    goalPauseSec: 0,
    elapsedSec: 1,
    rallyHits: 0,
    maxPuckSpeed: 100,
  });
  svc.sendRealtime({ type: 'HAND_FRAME', game: 'air-hockey', x: 0.6, y: 0.5, detected: true, ts: 2 });

  assert.deepEqual(sent, ['HAND_FRAME', 'HOCKEY_SYNC']);
});

test('Guest enters Hub immediately on JOIN_WELCOME without waiting for video MediaConnection', () => {
  const statuses: string[] = [];
  const messages: string[] = [];
  const svc = new DuoPeerService({
    onStatusChange: (s) => statuses.push(s),
    onRemoteStream: () => {},
    onMessage: (m) => messages.push(m.type),
  });

  const internal = svc as unknown as {
    role: 'host' | 'guest';
    activeRoomCode: string;
    sessionGen: number;
    hasEnteredRoom: boolean;
    handleIncomingPeerMessage: (msg: unknown, gen: number, via: 'peerjs' | 'relay', peerId?: string) => void;
    startHeartbeat: () => void;
  };
  internal.role = 'guest';
  internal.activeRoomCode = 'A7K4';
  internal.hasEnteredRoom = false;
  internal.startHeartbeat = () => {};

  internal.handleIncomingPeerMessage(
    { type: 'JOIN_WELCOME', code: 'A7K4', hostName: 'Alex', hasStream: false },
    internal.sessionGen,
    'peerjs',
    'couplecam-room-a7k4',
  );

  assert.equal(internal.hasEnteredRoom, true);
  assert.ok(statuses.includes('connected'));
  assert.ok(messages.includes('HELLO'));
});

test('Host replies JOIN_WELCOME immediately on JOIN_HELLO and enters Hub without waiting for video', () => {
  const statuses: string[] = [];
  const sentTypes: string[] = [];
  const svc = new DuoPeerService({
    onStatusChange: (s) => statuses.push(s),
    onRemoteStream: () => {},
    onMessage: () => {},
  });

  const internal = svc as unknown as {
    role: 'host' | 'guest';
    localName: string;
    activeRoomCode: string;
    sessionGen: number;
    hasEnteredRoom: boolean;
    dataConn: { open: boolean; send: (m: { type: string }) => void };
    handleIncomingPeerMessage: (msg: unknown, gen: number, via: 'peerjs' | 'relay', peerId?: string) => void;
    startHeartbeat: () => void;
  };
  internal.role = 'host';
  internal.localName = 'Alex';
  internal.activeRoomCode = 'A7K4';
  internal.hasEnteredRoom = false;
  internal.startHeartbeat = () => {};
  internal.dataConn = {
    open: true,
    send: (m) => sentTypes.push(m.type),
  };

  internal.handleIncomingPeerMessage(
    { type: 'JOIN_HELLO', code: 'A7K4', name: 'Léa', hasStream: false },
    internal.sessionGen,
    'peerjs',
    'guest-peer-1',
  );

  assert.equal(internal.hasEnteredRoom, true);
  assert.ok(sentTypes.includes('JOIN_WELCOME'));
  assert.ok(statuses.includes('connected'));
});

test('Host keeps room open in waiting state if incoming Guest attempt fails ICE before entering', () => {
  const statuses: string[] = [];
  const svc = new DuoPeerService({
    onStatusChange: (s) => statuses.push(s),
    onRemoteStream: () => {},
    onMessage: () => {},
  });

  const handlers = new Map<string, (...args: unknown[]) => void>();
  let connClosed = false;
  const fakeConn = {
    peer: 'guest-attempt-1',
    open: false,
    on: (ev: string, fn: (...args: unknown[]) => void) => handlers.set(ev, fn),
    close: () => {
      connClosed = true;
    },
    send: () => {},
  };

  const internal = svc as unknown as {
    role: 'host' | 'guest';
    activeRoomCode: string;
    sessionGen: number;
    hasEnteredRoom: boolean;
    peer: { destroyed: boolean; destroy: () => void };
    attachDataConnection: (c: unknown, gen: number) => void;
  };

  let peerDestroyed = false;
  internal.role = 'host';
  internal.activeRoomCode = '4829';
  internal.hasEnteredRoom = false;
  internal.peer = {
    destroyed: false,
    destroy: () => {
      peerDestroyed = true;
    },
  };

  internal.attachDataConnection(fakeConn, internal.sessionGen);
  handlers.get('iceStateChanged')?.('failed');

  assert.equal(connClosed, true);
  assert.equal(peerDestroyed, false, 'Host Peer must stay alive so Partner can retry with same code');
  assert.equal(statuses[statuses.length - 1], 'waiting');
});



