# CoupleCam Firestore Security Specification (Phase 0)

## 1. Data Invariants

1. **No Room Scraping / Enumeration**: Listing `/rooms` is strictly forbidden (`allow list: if false`). Players can only `get` a specific room when they possess its normalized 4-character alphanumeric code (`^[A-Z0-9]{4}$`).
2. **No PII Storage**: Rooms store only casual display names (1..32 chars), game states, scores, and ephemeral WebRTC SDP/ICE metadata. Zero emails, phone numbers, or addresses exist in Firestore.
3. **Strict Schema & Size Enforcement**: Every string, map, and SDP field is bounded in size (`hostName`/`guestName` <= 32, `currentGame` <= 32, `offer.sdp`/`answer.sdp` <= 20000, `candidate.candidate` <= 2048). Unknown/shadow keys are rejected on both create and update.
4. **Master Gate on Subcollections**: Every write to `/rooms/{code}/messages/{messageId}` and `/rooms/{code}/candidates/{candidateId}` requires the parent `/rooms/{code}` document to exist and NOT be in terminal `'closed'` state.
5. **Action-Based Updates & Terminal State Locking**: Updates to `/rooms/{code}` are split into explicit actions (`join`, `gameSync`, `webrtcOffer`, `webrtcAnswer`, `mediaStatus`, `closeRoom`) with `affectedKeys().hasOnly(...)` and full `isValidRoom(incoming())` validation. Once `status == 'closed'`, no further updates are permitted.
6. **Temporal Integrity & Immutability**: `createdAt` must equal `request.time` on creation and can never change on update. `updatedAt` must equal `request.time` on creation and every update. Messages and ICE candidates are append-only (updates and deletes denied).

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Room Code ID Poisoning**: Creating `/rooms/invalid-1.5kb-id...` -> DENIED (`isValidRoomCode` rejects non-4-char IDs).
2. **Room Enumeration / Scraping**: `list` query on `/rooms` -> DENIED (`allow list: if false`).
3. **Shadow Field Injection on Create**: Creating `/rooms/A7K4` with extra field `isAdmin: true` -> DENIED (`keys().hasOnly(...)`).
4. **Initial Status Bypass**: Creating `/rooms/A7K4` with `status: 'connected'` instead of `'waiting'` -> DENIED.
5. **Spoofed Client Timestamp**: Creating `/rooms/A7K4` with `createdAt` != `request.time` -> DENIED.
6. **Immutable `createdAt` Tampering**: Updating `/rooms/A7K4` to alter `createdAt` or `hostName` -> DENIED.
7. **Post-Close Terminal Mutation**: Updating `/rooms/A7K4` after `status == 'closed'` -> DENIED.
8. **Value Poisoning on `diceCount`**: Updating `diceCount` to `99` or `"hack"` -> DENIED (`diceCount in [1, 2]`).
9. **Oversized SDP / DoW Attack**: Writing a 100KB string into `offer.sdp` -> DENIED (`sdp.size() <= 20000`).
10. **Orphaned Message Creation**: Writing to `/rooms/ZZZZ/messages/m1` when `/rooms/ZZZZ` does not exist -> DENIED (`exists(...)` Master Gate).
11. **Message Tampering / Deletion**: Updating or deleting an existing `/rooms/A7K4/messages/m1` -> DENIED (`allow update, delete: if false`).
12. **Malformed ICE Candidate**: Writing `/rooms/A7K4/candidates/c1` with invalid `sender: 'hacker'` or shadow keys -> DENIED.
