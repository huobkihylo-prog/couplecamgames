# Security Specification — Parcheesi Voice Room & Live Chat

## Collections & Access Matrix
- `/rooms/{code}`:
  - `get`: capability-gated on exact 4-char uppercase alphanumeric `code` (`^[A-Z0-9]{4}$`).
  - `list`: strictly `false` (anti-enumeration / anti-scraping).
  - `create`: strict Room schema (`status == 'waiting'`, `activeGame == null`, `guestName == ''`, `webrtcGen == 0`, server timestamps).
  - `update`: action-based partial updates only, terminal `status == 'closed'` lock, immutable `createdAt` & `hostName`, strict server `updatedAt == request.time`:
    - Action 1 (Guest Join): sets `guestName` (1..32), `status: 'connected'`, `guestHasAudio`, `guestMicMuted`, `updatedAt` (never changes `activeGame`!).
    - Action 2 (Host Game Control & Config): updates `activeGame` (`null` or `'parcheesi'`), `status` (`'connected'` when `activeGame == null`, `'playing'` when `activeGame == 'parcheesi'`, or unchanged while `'waiting'`), `diceCount` (`1 | 2`), `scores`, `updatedAt`.
    - Action 3 (Host Audio WebRTC Offer): updates `offer`, `answer`, `webrtcGen >= existing`, `hostHasAudio`, `hostMicMuted`, `updatedAt` while active (`status in ['connected', 'playing']`).
    - Action 4 (Guest Audio WebRTC Answer): updates `answer`, `guestHasAudio`, `guestMicMuted`, `updatedAt` while active (`status in ['connected', 'playing']`).
    - Action 5 (Audio/Mic Status Indicator): updates `hostHasAudio`, `guestHasAudio`, `hostMicMuted`, `guestMicMuted`, `updatedAt` without altering `status` or `activeGame`.
    - Action 6 (Explicit Leave / Close Room): sets `status: 'closed'`, `activeGame: null`, `updatedAt`.
  - `delete`: strictly `false`.
- `/rooms/{code}/chat/{chatId}`:
  - `get`, `list`: capability-gated on valid `code` (and `isValidId(chatId)` on `get`).
  - `create`: strict `RoomChatMessage` schema (`sender in ['host','guest']`, `senderName` 1..32, `text` 1..280, `kind in ['text','reaction']`, `createdAt == request.time`, Master Gate `roomExistsAndActive(code)`).
  - `update`, `delete`: strictly `false` (append-only).
- `/rooms/{code}/messages/{messageId}`:
  - Append-only Parcheesi game events with Master Gate `roomExistsAndActive(code)`.
- `/rooms/{code}/candidates/{candidateId}`:
  - Append-only audio WebRTC ICE candidates with Master Gate `roomExistsAndActive(code)`.

## Dirty Dozen Adversarial Payloads (Verified in `firestore.rules.test.ts`)
1. Room Code ID Poisoning (`code` length != 4 or invalid chars) -> DENIED.
2. Room Enumeration (`list` on `/rooms`) -> DENIED.
3. Shadow Field Injection on Room Create (`isAdmin: true`) -> DENIED.
4. Initial Status / Auto-Start Bypass (`status: 'playing'` or `activeGame: 'parcheesi'` on create) -> DENIED.
5. Spoofed Client Timestamp (`createdAt != request.time`) -> DENIED.
6. Immutable `hostName` / `createdAt` Tampering -> DENIED.
7. Post-Close Terminal Mutation (`existing.status == 'closed'`) -> DENIED.
8. Value Poisoning on `diceCount` (`diceCount: 99`) or `activeGame` (`activeGame: 'music-quiz'`) -> DENIED.
9. Oversized SDP / DoW Attack (> 20KB) -> DENIED.
10. Orphaned Subcollection Creation (missing or closed parent room for `chat` / `messages` / `candidates`) -> DENIED.
11. Chat Message Oversized Payload (> 280 chars) or Update/Delete -> DENIED.
12. Malformed ICE Candidate (invalid sender or shadow key) -> DENIED.
