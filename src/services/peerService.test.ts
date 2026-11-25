import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONNECT_TIMEOUT_MS,
  DuoPeerService,
  generateRoomCode,
  getPeerRoomId,
  ICE_SERVERS,
  isSignalingOnlyError,
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

test('ICE_SERVERS configures reliable public STUN servers including Google STUN without dead endpoints', () => {
  const urls = ICE_SERVERS.flatMap((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]));
  assert.ok(urls.includes('stun:stun.l.google.com:19302'));
  assert.ok(urls.some((u) => u.startsWith('stun:stun.cloudflare.com')));
  assert.ok(
    urls.every((u) => !u.includes('openrelay.metered.ca') && !u.includes('global.stun.twilio.com')),
    'should not include unresolvable/unreachable STUN endpoints',
  );
});

test('CONNECT_TIMEOUT_MS enforces the strict 10-second maximum timeout', () => {
  assert.equal(CONNECT_TIMEOUT_MS, 10000);
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
  // Inject a minimal open DataConnection double to verify throttling behavior cleanly
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
  // Second HAND_FRAME immediately after should be throttled, while HOCKEY_SYNC was delivered
  svc.sendRealtime({ type: 'HAND_FRAME', game: 'air-hockey', x: 0.6, y: 0.5, detected: true, ts: 2 });

  assert.deepEqual(sent, ['HAND_FRAME', 'HOCKEY_SYNC']);
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


