import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GUEST_EXIT_SQUARE,
  HOST_EXIT_SQUARE,
  OUTER_CELLS,
  PARCHISI_KARMA_SQUARES,
  PARCHISI_SAFE_SQUARES,
  PARCHISI_THRONE_PROGRESS,
  progressToOuterSquare,
  getPawnBoardPoint,
} from './parchisiBoard';
import {
  applyParchisiMove,
  chooseAiParchisiMove,
  createHandShakeState,
  dismissParchisiKarmaCard,
  getLegalParchisiMoves,
  PARCHISI_KARMA_DECK,
  passParchisiTurnNoMoves,
  resolveParchisiMercy,
  rollParchisiDie,
  startParchisiMatch,
  stepHandShakeDetector,
} from './parchisiLogic';

test('Board geometry has exactly 68 unique outer squares, 12 safe zones, and 4 non-safe Karma squares', () => {
  assert.equal(OUTER_CELLS.length, 68);
  const uniqueIds = new Set(OUTER_CELLS.map((c) => c.id));
  assert.equal(uniqueIds.size, 68);
  assert.equal(PARCHISI_SAFE_SQUARES.length, 12);
  assert.equal(PARCHISI_KARMA_SQUARES.length, 4);

  const safeSet = new Set(PARCHISI_SAFE_SQUARES);
  for (const k of PARCHISI_KARMA_SQUARES) {
    assert.equal(safeSet.has(k), false, `Karma square ${k} must not overlap a Safe Zone`);
  }

  // Host exits at 56 and enters corridor at 51 (progress 63)
  assert.equal(progressToOuterSquare('host', 0), HOST_EXIT_SQUARE);
  assert.equal(progressToOuterSquare('host', 63), 51);
  // Guest exits at 22 and enters corridor at 17 (progress 63)
  assert.equal(progressToOuterSquare('guest', 0), GUEST_EXIT_SQUARE);
  assert.equal(progressToOuterSquare('guest', 63), 17);

  // Stacked pawns offset cleanly side-by-side without overlapping
  const p0 = getPawnBoardPoint('host', 0, 0, 0, 2);
  const p1 = getPawnBoardPoint('host', 1, 0, 1, 2);
  assert.ok(Math.hypot(p1.x - p0.x, p1.y - p0.y) >= 16);
});

test('Express mode pre-deploys 1 pawn and allows exit on 5 or 6; Classic requires 5 only', () => {
  const express = startParchisiMatch('express');
  assert.equal(express.pawns.host[0].progress, 0);
  assert.equal(express.pawns.host[1].progress, -1);
  assert.equal(express.pawns.guest[0].progress, 0);

  // Rolling 6 in Express allows exiting pawn 1 OR moving pawn 0
  const expRoll6 = rollParchisiDie(express, 6);
  assert.ok(expRoll6.legalMoves.some((m) => m.isExit && m.pawnId === 1));
  assert.ok(expRoll6.legalMoves.some((m) => !m.isExit && m.pawnId === 0 && m.toProgress === 6));

  const classic = startParchisiMatch('classic');
  assert.ok(classic.pawns.host.every((p) => p.progress === -1));
  // Rolling 6 in Classic yields NO legal moves
  const clsRoll6 = rollParchisiDie(classic, 6);
  assert.equal(clsRoll6.noMovesAvailable, true);
  assert.equal(clsRoll6.legalMoves.length, 0);
  // Rolling 5 in Classic allows exiting
  const clsRoll5 = rollParchisiDie(classic, 5);
  assert.equal(clsRoll5.legalMoves.length, 4);
  assert.ok(clsRoll5.legalMoves.every((m) => m.isExit));
});

test('Rule of 6: grants extra turn, counts as 7 when all 4 pawns are out, and Triple-6 curse returns outer pawn (sparing corridor)', () => {
  let st = startParchisiMatch('express');
  // Put all 4 host pawns on board
  st.pawns.host[0].progress = 10;
  st.pawns.host[1].progress = 20;
  st.pawns.host[2].progress = 30;
  st.pawns.host[3].progress = 40;

  // 1st six -> counts as 7 spaces!
  const r1 = rollParchisiDie(st, 6);
  assert.equal(r1.state.effectiveSteps, 7);
  const m1 = applyParchisiMove(r1.state, 0);
  assert.equal(m1.accepted, true);
  assert.equal(m1.state.pawns.host[0].progress, 17);
  assert.equal(m1.state.turn, 'host'); // Extra turn!
  assert.equal(m1.state.phase, 'WAIT_ROLL');

  // 2nd six -> counts as 7 spaces!
  const r2 = rollParchisiDie(m1.state, 6);
  const m2 = applyParchisiMove(r2.state, 0);
  assert.equal(m2.state.pawns.host[0].progress, 24);
  assert.equal(m2.state.turn, 'host');

  // 3rd six -> Triple-6 Curse sends pawn 0 back to base (-1) and ends turn!
  const r3 = rollParchisiDie(m2.state, 6);
  assert.equal(r3.tripleSixCurse, true);
  assert.equal(r3.cursedPawnId, 0);
  assert.equal(r3.state.pawns.host[0].progress, -1);
  assert.equal(r3.state.turn, 'guest');

  // Verify corridor pawn is SPARED from Triple-6 curse!
  let corridorSt = startParchisiMatch('express');
  corridorSt.pawns.host[0].progress = 66; // inside final corridor
  corridorSt.lastMovedPawnId.host = 0;
  corridorSt.consecutiveSixes = 2;
  const rSpared = rollParchisiDie(corridorSt, 6);
  assert.equal(rSpared.tripleSixCurse, true);
  assert.equal(rSpared.cursedPawnId, null);
  assert.equal(rSpared.state.pawns.host[0].progress, 66);
});

test('Blockade (2 same-color pawns) blocks ALL pawns (including allies) and MUST be broken on rolling a 6', () => {
  const st = startParchisiMatch('express');
  // Host forms a blockade on progress 10 (pawns 0 & 1), pawn 2 sits behind at progress 8, pawn 3 at progress 20
  st.pawns.host[0].progress = 10;
  st.pawns.host[1].progress = 10;
  st.pawns.host[2].progress = 8;
  st.pawns.host[3].progress = 20;

  // Roll a 4: pawn 2 (8 -> 12) CANNOT jump over own blockade at 10!
  const r4 = rollParchisiDie(st, 4);
  assert.equal(r4.legalMoves.some((m) => m.pawnId === 2), false);
  assert.equal(r4.legalMoves.some((m) => m.pawnId === 0), true);
  assert.equal(r4.legalMoves.some((m) => m.pawnId === 3), true);

  // Roll a 6: MUST break the blockade (only pawns 0 and 1 are legal, NOT pawn 3!)
  const r6 = rollParchisiDie(st, 6);
  assert.equal(r6.legalMoves.length, 2);
  assert.ok(r6.legalMoves.every((m) => m.pawnId === 0 || m.pawnId === 1));
  assert.equal(r6.legalMoves.some((m) => m.pawnId === 3), false);
});

test('Capture triggers Mercy Rule Couple: No Mercy grants +20 bonus; Dare Save spares pawn to Safe Zone & grants +10 + Tender Heart', () => {
  const st = startParchisiMatch('express');
  // Host progress 4 -> outer square 60 (non-safe). Guest at outer square 60 is progress (60 - 22 = 38).
  st.pawns.host[0].progress = 1; // sq 57
  st.pawns.host[1].progress = 12;
  st.pawns.guest[0].progress = 38; // sq 60

  const r3 = rollParchisiDie(st, 3);
  const move = applyParchisiMove(r3.state, 0, () => 0.1);
  assert.equal(move.accepted, true);
  assert.equal(move.state.phase, 'MERCY_OFFER');
  assert.equal(move.state.pendingMercy?.square, 60);

  // Branch A: No Mercy -> Guest pawn 0 returns to -1, Host enters BONUS_20
  const noMercy = resolveParchisiMercy(move.state, 'no_mercy');
  assert.equal(noMercy.pawns.guest[0].progress, -1);
  assert.equal(noMercy.stats.host.captures, 1);
  assert.equal(noMercy.phase, 'BONUS_20');
  const b20 = applyParchisiMove(noMercy, 0);
  assert.equal(b20.accepted, true);
  assert.equal(b20.state.pawns.host[0].progress, 24);

  // Branch B: Offer Dare -> Partner Accepts -> Capturer Validates -> Victim spared on nearest Safe Zone (sq 56 -> guest prog 34) + Host gets BONUS_10 + Tender Heart!
  const offered = resolveParchisiMercy(move.state, 'offer_dare');
  assert.equal(offered.pendingMercy?.stage, 'waiting_partner');
  const accepted = resolveParchisiMercy(offered, 'accept_dare');
  assert.equal(accepted.pendingMercy?.stage, 'partner_performing');
  const validated = resolveParchisiMercy(accepted, 'validate_dare');
  assert.equal(validated.stats.host.tenderHearts, 1);
  assert.equal(validated.stats.guest.daresCompleted, 1);
  assert.equal(validated.phase, 'BONUS_10');
  // Guest pawn was spared on nearest safe square behind 60 (sq 56) and protected by shield!
  assert.equal(progressToOuterSquare('guest', validated.pawns.guest[0].progress), 56);
  assert.equal(validated.pawns.guest[0].shieldTurns, 1);
});

test('Central Throne requires exact roll, grants +10 bonus, and declares GAME_OVER on 4th pawn', () => {
  const st = startParchisiMatch('express');
  st.pawns.host[0].progress = 68; // needs exact 3 to reach 71
  st.pawns.host[1].progress = 10;
  st.pawns.host[2].progress = 71;
  st.pawns.host[3].progress = 71;

  // Roll 4 overshoots 71 -> pawn 0 cannot move!
  const r4 = rollParchisiDie(st, 4);
  assert.equal(r4.legalMoves.some((m) => m.pawnId === 0), false);

  // Roll 3 enters Throne -> BONUS_10 for pawn 1
  const r3 = rollParchisiDie(st, 3);
  const enter = applyParchisiMove(r3.state, 0);
  assert.equal(enter.state.pawns.host[0].progress, PARCHISI_THRONE_PROGRESS);
  assert.equal(enter.state.phase, 'BONUS_10');

  // Now put pawn 1 at 61 so BONUS_10 sends pawn 1 straight into Throne -> GAME_OVER!
  enter.state.pawns.host[1].progress = 61;
  const win = applyParchisiMove(enter.state, 1);
  assert.equal(win.state.phase, 'GAME_OVER');
  assert.equal(win.state.winner, 'host');
});

test('Karma Couple deck has >= 16 cards and applies Love Shield / Turbo +3 / Free Roll cleanly', () => {
  assert.ok(PARCHISI_KARMA_DECK.length >= 16);

  const st = startParchisiMatch('express');
  // Host progress 0 is sq 56; progress 3 is sq 59 (Karma square!)
  const r3 = rollParchisiDie(st, 3);
  // rng = 0 picks card id 0 (shield)
  const landed = applyParchisiMove(r3.state, 0, () => 0);
  assert.equal(landed.state.phase, 'KARMA_CARD');
  assert.equal(landed.state.activeKarma?.effect, 'shield');
  assert.equal(landed.state.pawns.host[0].shieldTurns, 1);

  const afterDismiss = dismissParchisiKarmaCard(landed.state);
  assert.equal(afterDismiss.phase, 'WAIT_ROLL');
  assert.equal(afterDismiss.turn, 'guest');

  // Test Free Roll card (card id 2 -> index 2 / 16 = 0.13)
  const rFree = rollParchisiDie(st, 3);
  const landedFree = applyParchisiMove(rFree.state, 0, () => 0.13);
  assert.equal(landedFree.state.activeKarma?.effect, 'free_roll');
  const afterFree = dismissParchisiKarmaCard(landedFree.state);
  assert.equal(afterFree.phase, 'WAIT_ROLL');
  assert.equal(afterFree.turn, 'host'); // stays Host's turn!

  // Test passParchisiTurnNoMoves cleanly advances turn
  const cls = startParchisiMatch('classic');
  const noMoveRoll = rollParchisiDie(cls, 2);
  assert.equal(noMoveRoll.noMovesAvailable, true);
  const passed = passParchisiTurnNoMoves(noMoveRoll.state);
  assert.equal(passed.turn, 'guest');
  assert.equal(passed.phase, 'WAIT_ROLL');
});

test('Smart Solo AI prioritizes: 1) Throne, 2) Capture, 3) Exit on 5, 4) Safe Zone, 5) Furthest pawn', () => {
  const st = startParchisiMatch('express');
  st.turn = 'guest';
  // Pawn 0 can reach Throne on roll 3 (68 -> 71); Pawn 1 can capture Host at sq 26 (guest prog 4) from prog 1
  st.pawns.guest[0].progress = 68;
  st.pawns.guest[1].progress = 1;
  st.pawns.host[0].progress = 38; // sq (56+38-1)%68+1 = 26 -> guest prog 4!
  const r3 = rollParchisiDie(st, 3);
  assert.equal(chooseAiParchisiMove(r3.state), 0, 'AI must prioritize entering Throne over capture');

  // Remove Throne option -> AI must choose Capture (pawn 1)!
  st.pawns.guest[0].progress = 10;
  const r3b = rollParchisiDie(st, 3);
  assert.equal(chooseAiParchisiMove(r3b.state), 1, 'AI must prioritize capturing opponent pawn');
});

test('Hand-shake detector triggers dice roll after left-right hand oscillation', () => {
  let hs = createHandShakeState();
  let triggered = false;
  const samples = [0.35, 0.55, 0.34, 0.56, 0.32, 0.58, 0.30];
  for (const x of samples) {
    const res = stepHandShakeDetector(hs, true, x, 0.05);
    hs = res.next;
    if (res.triggered) triggered = true;
  }
  assert.equal(triggered, true);
});
