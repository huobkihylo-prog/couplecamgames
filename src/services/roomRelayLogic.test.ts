import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOST_DISCONNECT_GRACE_MS,
  normalizeRelayRoomCode,
  RoomRelayRegistry,
  type RelayClient,
} from './roomRelayLogic';

function makeClient(id: string, role: 'host' | 'guest', name: string) {
  const received: Record<string, unknown>[] = [];
  const client: RelayClient = {
    id,
    role,
    name,
    send: (payload) => received.push(payload),
  };
  return { client, received };
}

test('normalizeRelayRoomCode cleans spaces, casing, punctuation, and pasted invite URLs', () => {
  assert.equal(normalizeRelayRoomCode(' 48 29 '), '4829');
  assert.equal(normalizeRelayRoomCode('aB-3c'), 'AB3C');
  assert.equal(
    normalizeRelayRoomCode('https://couplecam.example/?room=%204829%20'),
    '4829',
  );
  assert.equal(normalizeRelayRoomCode('?room=ab12&foo=1'), 'AB12');
});

test('Host opens room and Partner joins with spaces/lowercase -> Host notified immediately and messages relay both ways', () => {
  const registry = new RoomRelayRegistry();
  const host = makeClient('h1', 'host', 'Alex');
  const guest = makeClient('g1', 'guest', 'Léa');

  const reg = registry.registerHost(' aB 12 ', host.client);
  assert.deepEqual(reg, { ok: true, code: 'AB12', resumed: false });
  assert.equal(host.received[0]?.type, 'RELAY_HOST_READY');

  const join = registry.joinGuest(' ab12 ', guest.client, true);
  assert.deepEqual(join, { ok: true, code: 'AB12' });
  assert.equal(host.received[1]?.type, 'RELAY_PARTNER_CONNECTED');
  assert.equal(host.received[1]?.name, 'Léa');
  assert.equal(guest.received[0]?.type, 'RELAY_JOINED_ROOM');
  assert.equal(guest.received[0]?.hostName, 'Alex');

  assert.equal(
    registry.forwardMessage('ab12', 'h1', { type: 'JOIN_WELCOME', code: 'AB12', hostName: 'Alex', hasStream: true }),
    true,
  );
  assert.equal(guest.received[1]?.type, 'RELAY_DATA');
  assert.deepEqual((guest.received[1]?.data as { type: string }).type, 'JOIN_WELCOME');

  assert.equal(
    registry.forwardMessage('AB12', 'g1', { type: 'JOIN_HELLO', code: 'AB12', name: 'Léa', hasStream: true }),
    true,
  );
  assert.equal(host.received[2]?.type, 'RELAY_DATA');
});

test('Host switching to WhatsApp keeps room alive during grace period so Partner enters immediately and Host resumes seamlessly', () => {
  const registry = new RoomRelayRegistry();
  const host1 = makeClient('h1', 'host', 'Alex');
  const host2 = makeClient('h2', 'host', 'Alex');
  const guest = makeClient('g1', 'guest', 'Léa');

  const t0 = 1_000_000;
  registry.registerHost('A7K4', host1.client, t0);
  // Simulate mobile OS pausing tab & closing socket while Host pastes code in WhatsApp
  registry.detachClient('A7K4', 'h1', t0 + 1000);
  assert.equal(registry.getRoomCount(), 1, 'Room must remain alive during grace window');

  // Partner joins while Host is still on WhatsApp
  const join = registry.joinGuest('A7K4', guest.client, false);
  assert.deepEqual(join, { ok: true, code: 'A7K4' });
  assert.equal(guest.received[0]?.type, 'RELAY_JOINED_ROOM');
  assert.equal(guest.received[0]?.hostName, 'Alex');

  // Host returns from WhatsApp 8 seconds later and reconnects with exact same code
  const resumed = registry.registerHost('A7K4', host2.client, t0 + 9000);
  assert.deepEqual(resumed, { ok: true, code: 'A7K4', resumed: true });
  assert.ok(
    host2.received.some((m) => m.type === 'RELAY_PARTNER_CONNECTED' && m.name === 'Léa'),
    'Reconnected Host must immediately receive queued Partner arrival',
  );
  assert.ok(
    guest.received.some((m) => m.type === 'RELAY_HOST_RECONNECTED'),
    'Partner must be notified that Host reconnected',
  );
});

test('pruneExpired cleans up abandoned detached rooms after HOST_DISCONNECT_GRACE_MS', () => {
  const registry = new RoomRelayRegistry();
  const host = makeClient('h1', 'host', 'Alex');
  const t0 = 2_000_000;

  registry.registerHost('B4M8', host.client, t0);
  registry.detachClient('B4M8', 'h1', t0 + 1000);
  assert.equal(registry.pruneExpired(t0 + 10_000), 0);
  assert.equal(registry.getRoomCount(), 1);

  assert.equal(registry.pruneExpired(t0 + 1000 + HOST_DISCONNECT_GRACE_MS), 1);
  assert.equal(registry.getRoomCount(), 0);
});

test('Partner joining nonexistent room receives RELAY_ROOM_NOT_FOUND immediately', () => {
  const registry = new RoomRelayRegistry();
  const guest = makeClient('g1', 'guest', 'Léa');

  const join = registry.joinGuest('9999', guest.client, false);
  assert.deepEqual(join, { ok: false, reason: 'room-not-found' });
  assert.equal(guest.received[0]?.type, 'RELAY_ROOM_NOT_FOUND');
});

test('Explicit Host leave cleans up room and notifies Partner; Guest leave keeps Host room open', () => {
  const registry = new RoomRelayRegistry();
  const host = makeClient('h1', 'host', 'Alex');
  const guest = makeClient('g1', 'guest', 'Léa');

  registry.registerHost('4829', host.client);
  registry.joinGuest('4829', guest.client, false);

  registry.removeClient('4829', 'g1');
  assert.equal(registry.getRoomCount(), 1, 'Room stays alive for Host when Guest disconnects');
  assert.equal(host.received[host.received.length - 1]?.type, 'RELAY_PEER_LEFT');

  registry.removeClient('4829', 'h1');
  assert.equal(registry.getRoomCount(), 0, 'Room is deleted when Host leaves');
});

