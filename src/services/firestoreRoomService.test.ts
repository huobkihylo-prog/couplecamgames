import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FirestoreRoomService,
  type FirestoreCandidateDoc,
  type FirestoreChatDoc,
  type FirestoreRoomDoc,
  type FirestoreRoomMessageDoc,
  type FirestoreTransportAdapter,
  type RoomSnapshotMeta,
  type RoomStateSummary,
} from './firestoreRoomService';
import {
  clearPersistedRoomSession,
  loadPersistedRoomSession,
  savePersistedRoomSession,
  type StorageLike,
} from '../utils/roomSessionStorage';
import type { PeerMessage, RoomChatMessage } from '../types/duoplay';

/**
 * Deterministic in-memory Firestore adapter for testing the complete Host/Guest lifecycle:
 * - Host creates room -> immediately enters Room Menu (`activeGame: null`)
 * - Guest joins -> immediately enters Room Menu (Parcheesi does NOT auto-start!)
 * - Host toggles 1-Dice / 2-Dice -> synced live to Guest
 * - Live Chat & Quick Reactions (`rooms/{code}/chat`) persist across screens
 * - Host clicks Start Parcheesi -> BOTH enter Parcheesi simultaneously
 * - Host clicks Back to Room Menu -> BOTH return smoothly without closing room
 * - Page refresh Auto-Reconnect (`sessionStorage` + `resumeSession`) restores active room & game
 * - Explicit Leave Room sets `status: 'closed'` and exits cleanly
 */
class InMemoryFirestoreHub {
  public rooms = new Map<string, FirestoreRoomDoc>();
  public chats = new Map<string, { id: string; doc: FirestoreChatDoc }[]>();
  public messages = new Map<string, { id: string; doc: FirestoreRoomMessageDoc }[]>();
  public candidates = new Map<string, { id: string; doc: FirestoreCandidateDoc }[]>();
  private roomSubs = new Map<string, Set<(room: FirestoreRoomDoc | null, meta?: RoomSnapshotMeta) => void>>();
  private chatSubs = new Map<string, Set<(id: string, doc: FirestoreChatDoc) => void>>();
  private msgSubs = new Map<string, Set<(id: string, doc: FirestoreRoomMessageDoc) => void>>();
  private candSubs = new Map<string, Set<(id: string, doc: FirestoreCandidateDoc) => void>>();
  private seq = 1;

  public createAdapter(): FirestoreTransportAdapter {
    return {
      getRoom: async (code) => {
        const found = this.rooms.get(code);
        return found ? structuredClone(found) : null;
      },
      createRoom: async (code, data) => {
        const cloned = structuredClone(data);
        this.rooms.set(code, cloned);
        this.emitRoom(code, cloned);
      },
      updateRoom: async (code, patch) => {
        const existing = this.rooms.get(code);
        if (!existing) throw new Error(`Room ${code} missing`);
        const next = { ...existing, ...structuredClone(patch) } as FirestoreRoomDoc;
        this.rooms.set(code, next);
        this.emitRoom(code, next);
      },
      subscribeRoom: (code, onData) => {
        const set = this.roomSubs.get(code) ?? new Set();
        set.add(onData);
        this.roomSubs.set(code, set);
        const cur = this.rooms.get(code);
        if (cur) queueMicrotask(() => onData(structuredClone(cur), { hasPendingWrites: false }));
        return () => {
          set.delete(onData);
        };
      },
      addChat: async (code, data) => {
        const id = `chat-${this.seq++}`;
        const list = this.chats.get(code) ?? [];
        const cloned = structuredClone(data);
        list.push({ id, doc: cloned });
        this.chats.set(code, list);
        for (const cb of this.chatSubs.get(code) ?? []) {
          cb(id, structuredClone(cloned));
        }
      },
      subscribeChat: (code, onAdded) => {
        const set = this.chatSubs.get(code) ?? new Set();
        set.add(onAdded);
        this.chatSubs.set(code, set);
        for (const item of this.chats.get(code) ?? []) {
          onAdded(item.id, structuredClone(item.doc));
        }
        return () => {
          set.delete(onAdded);
        };
      },
      addMessage: async (code, data) => {
        const id = `msg-${this.seq++}`;
        const list = this.messages.get(code) ?? [];
        const cloned = structuredClone(data);
        list.push({ id, doc: cloned });
        this.messages.set(code, list);
        for (const cb of this.msgSubs.get(code) ?? []) {
          cb(id, structuredClone(cloned));
        }
      },
      subscribeMessages: (code, onAdded) => {
        const set = this.msgSubs.get(code) ?? new Set();
        set.add(onAdded);
        this.msgSubs.set(code, set);
        for (const item of this.messages.get(code) ?? []) {
          onAdded(item.id, structuredClone(item.doc));
        }
        return () => {
          set.delete(onAdded);
        };
      },
      addCandidate: async (code, data) => {
        const id = `cand-${this.seq++}`;
        const list = this.candidates.get(code) ?? [];
        const cloned = structuredClone(data);
        list.push({ id, doc: cloned });
        this.candidates.set(code, list);
        for (const cb of this.candSubs.get(code) ?? []) {
          cb(id, structuredClone(cloned));
        }
      },
      subscribeCandidates: (code, onAdded) => {
        const set = this.candSubs.get(code) ?? new Set();
        set.add(onAdded);
        this.candSubs.set(code, set);
        for (const item of this.candidates.get(code) ?? []) {
          onAdded(item.id, structuredClone(item.doc));
        }
        return () => {
          set.delete(onAdded);
        };
      },
      serverNow: () => Date.now(),
    };
  }

  public emitRoom(code: string, room: FirestoreRoomDoc | null, meta: RoomSnapshotMeta = { hasPendingWrites: false }): void {
    for (const cb of this.roomSubs.get(code) ?? []) {
      cb(room ? structuredClone(room) : null, meta);
    }
  }
}

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

test('Host and Guest land in Room Menu (activeGame: null); Parcheesi ONLY starts when Host clicks Play, and Return to Room Menu preserves room + chat', async () => {
  const hub = new InMemoryFirestoreHub();
  const hostStatuses: string[] = [];
  const guestStatuses: string[] = [];
  let hostSummary: RoomStateSummary | null = null;
  let guestSummary: RoomStateSummary | null = null;
  const hostChats: RoomChatMessage[] = [];
  const guestChats: RoomChatMessage[] = [];
  const guestMessages: PeerMessage[] = [];

  const host = new FirestoreRoomService(
    {
      onStatusChange: (s) => hostStatuses.push(s),
      onRoomState: (sum) => {
        hostSummary = sum;
      },
      onRemoteStream: () => {},
      onMessage: () => {},
      onChatMessage: (msg) => hostChats.push(msg),
    },
    { adapter: hub.createAdapter() },
  );

  const guest = new FirestoreRoomService(
    {
      onStatusChange: (s) => guestStatuses.push(s),
      onRoomState: (sum) => {
        guestSummary = sum;
      },
      onRemoteStream: () => {},
      onMessage: (m) => guestMessages.push(m),
      onChatMessage: (msg) => guestChats.push(msg),
    },
    { adapter: hub.createAdapter() },
  );

  // 1. Host creates room -> immediately enters Room Menu (`activeGame: null`, `status: 'waiting'`)
  const createdCode = await host.createHostRoom('A7K4', 'Alex', null, false, 2);
  assert.equal(createdCode, 'A7K4');
  assert.equal(host.isConnected(), true);
  assert.equal(hostStatuses.includes('waiting'), true);
  assert.equal(hostSummary!.activeGame, null);
  assert.equal(hostSummary!.diceCount, 2);

  // 2. Guest joins room -> lands directly in Room Menu (activeGame stays null; Parcheesi does NOT auto-start!)
  const joined = await guest.joinGuestRoom('a7k4', 'Nadia', null, false);
  assert.equal(joined, true);
  assert.equal(guest.isConnected(), true);
  assert.equal(guestSummary!.activeGame, null);
  assert.equal(guestSummary!.hostName, 'Alex');
  assert.equal(guestSummary!.guestName, 'Nadia');
  assert.equal(hostSummary!.guestName, 'Nadia');
  assert.equal(hostSummary!.activeGame, null);

  // 3. Host toggles 1-Dice in Room Menu -> synced live to Guest
  host.syncDiceCount(1);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(guestSummary!.diceCount, 1);

  // 4. Live Chat & Quick Reactions work in Room Menu
  await host.sendChatMessage('Coucou Nadia !', 'text');
  await guest.sendChatMessage('❤️', 'reaction');
  assert.equal(hostChats.length, 2);
  assert.equal(guestChats.length, 2);
  assert.equal(guestChats[0].text, 'Coucou Nadia !');
  assert.equal(hostChats[1].kind, 'reaction');

  // 5. Host explicitly starts Parcheesi -> BOTH enter Parcheesi simultaneously
  await host.startParcheesi(1);
  assert.equal(hostSummary!.activeGame, 'parcheesi');
  assert.equal(hostSummary!.status, 'playing');
  assert.equal(guestSummary!.activeGame, 'parcheesi');
  assert.equal(guestSummary!.status, 'playing');

  // Parcheesi event relay works cleanly
  host.sendEvent({ type: 'PARCHISI_START', mode: '1v1', diceCount: 1 });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(guestMessages.some((m) => m.type === 'PARCHISI_START'), true);

  // 6. Transient local pending write or null doc NEVER kicks players out
  hub.emitRoom('A7K4', null, { hasPendingWrites: false });
  hub.emitRoom('A7K4', { ...hub.rooms.get('A7K4')!, status: 'closed' }, { hasPendingWrites: true });
  assert.equal(host.isConnected(), true);
  assert.equal(guest.isConnected(), true);

  // 7. Host returns to Room Menu -> BOTH return smoothly without closing room or losing chat
  await host.returnToRoomMenu();
  assert.equal(hostSummary!.activeGame, null);
  assert.equal(hostSummary!.status, 'connected');
  assert.equal(guestSummary!.activeGame, null);
  assert.equal(guestSummary!.status, 'connected');
  assert.equal(host.isConnected(), true);
  assert.equal(guest.isConnected(), true);

  // 8. Explicit Leave Room closes room cleanly for both
  host.destroy({ closeRemoteDoc: true });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(hub.rooms.get('A7K4')?.status, 'closed');
  assert.equal(guestStatuses.includes('disconnected'), true);
});

test('Auto-Reconnect restores exact active Parcheesi game & chat history from sessionStorage after refresh', async () => {
  const hub = new InMemoryFirestoreHub();
  const storage = createMemoryStorage();

  const host = new FirestoreRoomService(
    { onStatusChange: () => {}, onRemoteStream: () => {}, onMessage: () => {} },
    { adapter: hub.createAdapter() },
  );
  await host.createHostRoom('B9Q2', 'Alex', null, false, 2);
  await host.sendChatMessage('On joue !', 'text');

  const guest1 = new FirestoreRoomService(
    { onStatusChange: () => {}, onRemoteStream: () => {}, onMessage: () => {} },
    { adapter: hub.createAdapter() },
  );
  await guest1.joinGuestRoom('B9Q2', 'Nadia', null, false);
  savePersistedRoomSession({ roomCode: 'B9Q2', role: 'guest', playerName: 'Nadia' }, storage);

  await host.startParcheesi(2);

  // Simulate Guest browser refresh: destroy local listeners WITHOUT closing remote doc
  guest1.destroy({ closeRemoteDoc: false });
  const saved = loadPersistedRoomSession(storage);
  assert.ok(saved);
  assert.equal(saved.roomCode, 'B9Q2');
  assert.equal(saved.role, 'guest');

  let restoredSummary: RoomStateSummary | null = null;
  const restoredChats: RoomChatMessage[] = [];
  const guest2 = new FirestoreRoomService(
    {
      onStatusChange: () => {},
      onRoomState: (s) => {
        restoredSummary = s;
      },
      onRemoteStream: () => {},
      onMessage: () => {},
      onChatMessage: (m) => restoredChats.push(m),
    },
    { adapter: hub.createAdapter() },
  );

  const ok = await guest2.resumeSession(saved.roomCode, saved.role, saved.playerName, null, false);
  assert.equal(ok, true);
  assert.equal(restoredSummary!.activeGame, 'parcheesi');
  assert.equal(restoredSummary!.hostName, 'Alex');
  assert.equal(restoredChats.some((c) => c.text === 'On joue !'), true);

  // Explicit Leave clears storage
  clearPersistedRoomSession(storage);
  assert.equal(loadPersistedRoomSession(storage), null);
});
