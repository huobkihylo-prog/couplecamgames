import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRelayRoomCode, RoomRelayRegistry, type RelayClient } from './roomRelayLogic';

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
  assert.deepEqual(reg, { ok: true, code: 'AB12' });
  assert.equal(host.received[0]?.type, 'RELAY_HOST_READY');

  const join = registry.joinGuest(' ab12 ', guest.client, true);
  assert.deepEqual(join, { ok: true, code: 'AB12' });
  assert.equal(host.received[1]?.type, 'RELAY_PARTNER_CONNECTED');
  assert.equal(host.received[1]?.name, 'Léa');
  assert.equal(guest.received[0]?.type, 'RELAY_JOINED_ROOM');
  assert.equal(guest.received[0]?.hostName, 'Alex');

  // Bidirectional game message forwarding (JOIN_CONFIRMED & SELECT_GAME)
  assert.equal(
    registry.forwardMessage('ab12', 'h1', { type: 'JOIN_CONFIRMED', code: 'AB12', hostName: 'Alex', hasStream: true }),
    true,
  );
  assert.equal(guest.received[1]?.type, 'RELAY_DATA');
  assert.deepEqual((guest.received[1]?.data as { type: string }).type, 'JOIN_CONFIRMED');

  assert.equal(
    registry.forwardMessage('AB12', 'g1', { type: 'HELLO', name: 'Léa', role: 'guest', hasStream: true }),
    true,
  );
  assert.equal(host.received[2]?.type, 'RELAY_DATA');
});

test('Partner joining nonexistent room receives RELAY_ROOM_NOT_FOUND immediately', () => {
  const registry = new RoomRelayRegistry();
  const guest = makeClient('g1', 'guest', 'Léa');

  const join = registry.joinGuest('9999', guest.client, false);
  assert.deepEqual(join, { ok: false, reason: 'room-not-found' });
  assert.equal(guest.received[0]?.type, 'RELAY_ROOM_NOT_FOUND');
});

test('Host disconnecting cleans up room and notifies Partner; Guest disconnecting keeps Host room open', () => {
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
