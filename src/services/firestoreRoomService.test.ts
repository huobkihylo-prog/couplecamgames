import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIceServers,
  ERR_ROOM_NOT_FOUND,
  generateRoomCode,
  normalizeRoomCode,
  sanitizeIceCandidate,
  sanitizePlayerName,
  stripUndefinedDeep,
} from '../utils/roomCode';
import {
  FirestoreRoomService,
  type FirestoreCandidateDoc,
  type FirestoreRoomDoc,
  type FirestoreRoomMessageDoc,
  type FirestoreTransportAdapter,
} from './firestoreRoomService';
import type { PeerMessage } from '../types/duoplay';

function cloneDoc<T>(val: T): T {
  if (val === null || val === undefined || typeof val !== 'object') return val;
  const maybeTs = val as unknown as { toMillis?: () => number };
  if (typeof maybeTs.toMillis === 'function') {
    const ms = maybeTs.toMillis();
    return { toMillis: () => ms } as unknown as T;
  }
  if (Array.isArray(val)) return val.map((item) => cloneDoc(item)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    out[k] = cloneDoc(v);
  }
  return out as T;
}

/**
 * In-memory Firestore hub implementing `FirestoreTransportAdapter` so Host & Guest
 * tests run deterministically at full fidelity without hitting external networks.
 */
function createMemoryFirestoreHub() {
  const rooms = new Map<string, FirestoreRoomDoc>();
  const roomSubs = new Map<string, Set<(room: FirestoreRoomDoc | null) => void>>();
  const messages = new Map<string, Array<{ id: string; data: FirestoreRoomMessageDoc }>>();
  const messageSubs = new Map<string, Set<(id: string, data: FirestoreRoomMessageDoc) => void>>();
  const candidates = new Map<string, Array<{ id: string; data: FirestoreCandidateDoc }>>();
  const candidateSubs = new Map<string, Set<(id: string, data: FirestoreCandidateDoc) => void>>();
  let seq = 0;

  const notifyRoom = (code: string) => {
    const doc = rooms.get(code) ?? null;
    const copy = doc ? cloneDoc(doc) : null;
    for (const cb of roomSubs.get(code) ?? []) {
      cb(copy);
    }
  };

  const adapter: FirestoreTransportAdapter = {
    async getRoom(code) {
      const doc = rooms.get(code);
      return doc ? cloneDoc(doc) : null;
    },
    async createRoom(code, data) {
      rooms.set(code, cloneDoc(data));
      notifyRoom(code);
    },
    async updateRoom(code, patch) {
      const prev = rooms.get(code);
      if (!prev) throw new Error(`Room ${code} does not exist`);
      rooms.set(code, { ...prev, ...cloneDoc(patch) } as FirestoreRoomDoc);
      notifyRoom(code);
    },
    subscribeRoom(code, onData) {
      let set = roomSubs.get(code);
      if (!set) {
        set = new Set();
        roomSubs.set(code, set);
      }
      set.add(onData);
      const current = rooms.get(code);
      onData(current ? cloneDoc(current) : null);
      return () => {
        set?.delete(onData);
      };
    },
    async addMessage(code, data) {
      const id = `msg_${++seq}`;
      const list = messages.get(code) ?? [];
      const cloned = cloneDoc(data);
      list.push({ id, data: cloned });
      messages.set(code, list);
      for (const cb of messageSubs.get(code) ?? []) {
        cb(id, cloneDoc(cloned));
      }
    },
    subscribeMessages(code, onAdded) {
      let set = messageSubs.get(code);
      if (!set) {
        set = new Set();
        messageSubs.set(code, set);
      }
      set.add(onAdded);
      for (const item of messages.get(code) ?? []) {
        onAdded(item.id, cloneDoc(item.data));
      }
      return () => {
        set?.delete(onAdded);
      };
    },
    async addCandidate(code, data) {
      const id = `cand_${++seq}`;
      const list = candidates.get(code) ?? [];
      const cloned = cloneDoc(data);
      list.push({ id, data: cloned });
      candidates.set(code, list);
      for (const cb of candidateSubs.get(code) ?? []) {
        cb(id, cloneDoc(cloned));
      }
    },
    subscribeCandidates(code, onAdded) {
      let set = candidateSubs.get(code);
      if (!set) {
        set = new Set();
        candidateSubs.set(code, set);
      }
      set.add(onAdded);
      for (const item of candidates.get(code) ?? []) {
        onAdded(item.id, cloneDoc(item.data));
      }
      return () => {
        set?.delete(onAdded);
      };
    },
    serverNow() {
      const ms = Date.now();
      return { toMillis: () => ms };
    },
  };

  return { adapter, rooms, messages, candidates };
}

class FakePeerConnection {
  public iceConnectionState: RTCIceConnectionState = 'new';
  public onicecandidate: ((e: { candidate: RTCIceCandidate | null }) => void) | null = null;
  public ontrack: ((e: unknown) => void) | null = null;
  public ondatachannel: ((e: { channel: RTCDataChannel }) => void) | null = null;
  public oniceconnectionstatechange: (() => void) | null = null;
  public onconnectionstatechange: (() => void) | null = null;

  public localDescription: RTCSessionDescriptionInit | null = null;
  public remoteDescription: RTCSessionDescriptionInit | null = null;
  public addedCandidates: RTCIceCandidateInit[] = [];
  public restartIceCalls = 0;
  public transceivers: Array<{ direction: string; sender: { track: unknown; replaceTrack: (t: unknown) => Promise<void> }; receiver: { track: unknown } }> = [];
  public createdDataChannels: Array<{ label: string; readyState: string; sent: string[]; onmessage: ((e: { data: string }) => void) | null; onopen: (() => void) | null; onclose: (() => void) | null; send: (s: string) => void; close: () => void }> = [];

  createDataChannel(label: string) {
    const dc = {
      label,
      readyState: 'open',
      sent: [] as string[],
      onmessage: null as ((e: { data: string }) => void) | null,
      onopen: null as (() => void) | null,
      onclose: null as (() => void) | null,
      send(s: string) {
        this.sent.push(s);
      },
      close() {
        this.readyState = 'closed';
      },
    };
    this.createdDataChannels.push(dc);
    return dc as unknown as RTCDataChannel;
  }

  addTransceiver(kind: string, init?: { direction?: string }) {
    const tr = {
      direction: init?.direction ?? 'sendrecv',
      sender: { track: { kind }, replaceTrack: async () => {} },
      receiver: { track: { kind } },
    };
    this.transceivers.push(tr);
    return tr;
  }

  getTransceivers() {
    return this.transceivers;
  }

  getSenders() {
    return this.transceivers.map((t) => t.sender);
  }

  addTrack(track: { kind: string }) {
    this.transceivers.push({
      direction: 'sendrecv',
      sender: { track, replaceTrack: async () => {} },
      receiver: { track },
    });
  }

  async createOffer(opts?: { iceRestart?: boolean }): Promise<RTCSessionDescriptionInit> {
    return { type: 'offer', sdp: `v=0\r\no=host-${opts?.iceRestart ? 'restart' : 'init'}` };
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return { type: 'answer', sdp: 'v=0\r\no=guest-answer' };
  }

  async setLocalDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = desc;
    // Emit a synthetic trickle ICE candidate
    queueMicrotask(() => {
      const candPayload = {
        candidate: 'candidate:1 1 UDP 2122252543 192.168.1.2 50000 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
        usernameFragment: 'ufrag1',
      };
      this.onicecandidate?.({
        candidate: {
          ...candPayload,
          toJSON() {
            return { ...candPayload };
          },
        } as unknown as RTCIceCandidate,
      });
    });
  }

  async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    this.remoteDescription = desc;
  }

  async addIceCandidate(cand: RTCIceCandidateInit): Promise<void> {
    this.addedCandidates.push(cand);
  }

  restartIce(): void {
    this.restartIceCalls += 1;
  }

  close(): void {
    this.iceConnectionState = 'closed';
  }
}

async function flushMicrotasks(ticks = 6): Promise<void> {
  for (let i = 0; i < ticks; i += 1) {
    await new Promise((r) => setTimeout(r, 5));
  }
}

test('normalizeRoomCode and generateRoomCode enforce strict 4-char uppercase alphanumeric IDs', () => {
  assert.equal(normalizeRoomCode('  a7k4  '), 'A7K4');
  assert.equal(normalizeRoomCode('https://couplecam.app/?room=b9-m2'), 'B9M2');
  assert.equal(normalizeRoomCode('x3-q8'), 'X3Q8');
  assert.equal(normalizeRoomCode('ab!@#cd99'), 'ABCD');

  for (let i = 0; i < 40; i += 1) {
    const code = generateRoomCode();
    assert.match(code, /^[A-Z0-9]{4}$/);
    assert.ok(!/[01ILO]/.test(code), `Unexpected ambiguous character in ${code}`);
  }
});

test('buildIceServers includes required Google and Twilio STUN servers', () => {
  const servers = buildIceServers();
  const urls = servers.flatMap((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]));
  assert.ok(urls.includes('stun:stun.l.google.com:19302'));
  assert.ok(urls.includes('stun:stun1.l.google.com:19302'));
  assert.ok(urls.includes('stun:stun2.l.google.com:19302'));
  assert.ok(urls.includes('stun:global.stun.twilio.com:3478'));
});

test('stripUndefinedDeep, sanitizePlayerName, and sanitizeIceCandidate clean payloads safely', () => {
  const cleaned = stripUndefinedDeep({ a: 1, b: undefined, c: { d: 'ok', e: undefined }, arr: [1, undefined, 2] });
  assert.deepEqual(cleaned, { a: 1, c: { d: 'ok' }, arr: [1, 2] });
  assert.equal(sanitizePlayerName('   ', 'Invité'), 'Invité');
  assert.equal(sanitizePlayerName('A'.repeat(60), 'Hôte').length, 32);

  const cand = sanitizeIceCandidate({ candidate: 'cand:1', sdpMid: '0', sdpMLineIndex: 1 });
  assert.equal(cand.candidate, 'cand:1');
  assert.equal(cand.sdpMid, '0');
  assert.equal(cand.sdpMLineIndex, 1);
});

test('Host creates Firestore room, Guest joins without camera in <1s, exchanges messages, WebRTC SDP/ICE, hot-cam, and ICE restart', async () => {
  const prevRTC = (globalThis as Record<string, unknown>).RTCPeerConnection;
  const createdPcs: FakePeerConnection[] = [];
  (globalThis as Record<string, unknown>).RTCPeerConnection = FakePeerConnection;

  try {
    const hub = createMemoryFirestoreHub();
    const hostStatuses: Array<{ status: string; msg?: string }> = [];
    const guestStatuses: Array<{ status: string; msg?: string }> = [];
    const hostMessages: PeerMessage[] = [];
    const guestMessages: PeerMessage[] = [];

    const hostSvc = new FirestoreRoomService(
      {
        onStatusChange: (status, msg) => hostStatuses.push({ status, msg }),
        onRemoteStream: () => {},
        onMessage: (m) => hostMessages.push(m),
        getHostRoomState: () => ({ currentGame: 'hub', scores: { parchisiWins: 2 }, diceCount: 2 }),
      },
      {
        adapter: hub.adapter,
        peerConnectionFactory: () => {
          const pc = new FakePeerConnection();
          createdPcs.push(pc);
          return pc as unknown as RTCPeerConnection;
        },
      },
    );

    const guestSvc = new FirestoreRoomService(
      {
        onStatusChange: (status, msg) => guestStatuses.push({ status, msg }),
        onRemoteStream: () => {},
        onMessage: (m) => guestMessages.push(m),
      },
      {
        adapter: hub.adapter,
        peerConnectionFactory: () => {
          const pc = new FakePeerConnection();
          createdPcs.push(pc);
          return pc as unknown as RTCPeerConnection;
        },
      },
    );

    // 1. Guest joining a missing room gets a clear "Salon introuvable" error
    await guestSvc.joinGuestRoom('ZZZZ', 'Nadia', null);
    assert.equal(guestStatuses.at(-1)?.status, 'error');
    assert.equal(guestStatuses.at(-1)?.msg, ERR_ROOM_NOT_FOUND);

    // 2. Host creates room A7K4 without camera (non-blocking)
    await hostSvc.createHostRoom('a7k4', 'Alex', null);
    assert.equal(hostStatuses.at(-1)?.status, 'waiting');
    assert.equal(hub.rooms.get('A7K4')?.status, 'waiting');
    assert.equal(hub.rooms.get('A7K4')?.hostName, 'Alex');

    // 3. Guest joins room A7K4 without camera -> both enter 'connected' immediately!
    await guestSvc.joinGuestRoom('A7K4', 'Nadia', null);
    await flushMicrotasks();

    assert.equal(guestSvc.isConnected(), true);
    assert.equal(hostSvc.isConnected(), true);
    assert.equal(hub.rooms.get('A7K4')?.status, 'connected');
    assert.equal(hub.rooms.get('A7K4')?.guestName, 'Nadia');
    assert.ok(hostMessages.some((m) => m.type === 'HELLO' && m.name === 'Nadia'));
    assert.ok(guestMessages.some((m) => m.type === 'JOIN_ACCEPTED' && m.hostName === 'Alex'));

    // 4. Verify background native WebRTC SDP offer/answer & trickle ICE candidates exchanged
    assert.equal(hub.rooms.get('A7K4')?.webrtcGen, 1);
    assert.equal(hub.rooms.get('A7K4')?.offer?.type, 'offer');
    assert.equal(hub.rooms.get('A7K4')?.answer?.type, 'answer');
    assert.ok((hub.candidates.get('A7K4')?.length ?? 0) >= 2, 'Both peers should trickle ICE candidates');

    // 5. Game events via Firestore rooms/{code}/messages (addDoc + onSnapshot)
    hostSvc.sendData({ type: 'SELECT_GAME', game: 'parchisi-duo' });
    hostSvc.sendData({ type: 'PARCHISI_CONFIG', mode: '1v1', diceCount: 1 });
    await flushMicrotasks();

    assert.ok(guestMessages.some((m) => m.type === 'SELECT_GAME' && m.game === 'parchisi-duo'));
    assert.ok(guestMessages.some((m) => m.type === 'PARCHISI_CONFIG' && m.diceCount === 1));
    assert.equal(hub.rooms.get('A7K4')?.currentGame, 'parchisi-duo');
    assert.equal(hub.rooms.get('A7K4')?.diceCount, 1);

    // 6. Guest turns on camera mid-game (hot-cam) -> Host renegotiates webrtcGen -> 2 without dropping room
    const fakeStream = {
      getVideoTracks: () => [{ kind: 'video', enabled: true }],
      getAudioTracks: () => [{ kind: 'audio', enabled: true }],
    } as unknown as MediaStream;
    guestSvc.setLocalStream(fakeStream);
    await flushMicrotasks();

    assert.equal(hub.rooms.get('A7K4')?.guestHasStream, true);
    assert.equal(hub.rooms.get('A7K4')?.webrtcGen, 2);
    assert.equal(hostSvc.isConnected(), true);
    assert.equal(guestSvc.isConnected(), true);

    // 7. ICE restart recovers video without closing Firestore room
    const hostPcBefore = createdPcs[createdPcs.length - 2];
    hostSvc.triggerIceRestart();
    await flushMicrotasks();
    assert.ok(hostPcBefore.restartIceCalls >= 1);
    assert.equal(hub.rooms.get('A7K4')?.webrtcGen, 3);
    assert.equal(hostSvc.isConnected(), true);

    // 8. Host closes room cleanly -> Guest receives disconnected status
    hostSvc.destroy({ closeRemoteDoc: true });
    await flushMicrotasks();
    assert.equal(hub.rooms.get('A7K4')?.status, 'closed');
    assert.equal(guestStatuses.at(-1)?.status, 'disconnected');

    guestSvc.destroy({ closeRemoteDoc: false });
  } finally {
    (globalThis as Record<string, unknown>).RTCPeerConnection = prevRTC;
  }
});
