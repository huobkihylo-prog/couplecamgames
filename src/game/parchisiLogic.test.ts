import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLOR_ENTRY_SQUARE,
  COLOR_START_SQUARE,
  CORRIDOR_CELLS,
  OUTER_CELLS,
  PARCHISI_HOME_PROGRESS,
  PARCHISI_SAFE_SQUARES,
  PARCHISI_STAR_SQUARES,
  progressToOuterSquare,
} from './parchisiBoard';
import {
  applyParchisiMove,
  chooseAiParchisiMove,
  createInitialParchisiState,
  getLegalParchisiMoves,
  passParchisiTurnOrBonus,
  rollParchisiDice,
  startParchisiMatch,
} from './parchisiLogic';

test('Board geometry has 68 unique outer tiles, exact Start tiles (1/18/35/52), 8 Star tiles, and exact Home Column entries', () => {
  assert.equal(OUTER_CELLS.length, 68);
  const ids = new Set(OUTER_CELLS.map((c) => c.id));
  assert.equal(ids.size, 68);

  assert.equal(COLOR_START_SQUARE.red, 1);
  assert.equal(COLOR_START_SQUARE.green, 18);
  assert.equal(COLOR_START_SQUARE.yellow, 35);
  assert.equal(COLOR_START_SQUARE.blue, 52);

  assert.deepEqual([...PARCHISI_STAR_SQUARES], [8, 13, 25, 30, 42, 47, 59, 64]);
  assert.deepEqual([...PARCHISI_SAFE_SQUARES], [1, 8, 13, 18, 25, 30, 35, 42, 47, 52, 59, 64]);

  // After 63 steps from Start, every color reaches its exact Home Column entry tile
  assert.equal(progressToOuterSquare('red', 63), COLOR_ENTRY_SQUARE.red);
  assert.equal(progressToOuterSquare('green', 63), COLOR_ENTRY_SQUARE.green);
  assert.equal(progressToOuterSquare('yellow', 63), COLOR_ENTRY_SQUARE.yellow);
  assert.equal(progressToOuterSquare('blue', 63), COLOR_ENTRY_SQUARE.blue);

  assert.equal(CORRIDOR_CELLS.red.length, 7);
  assert.equal(CORRIDOR_CELLS.green.length, 7);
  assert.equal(CORRIDOR_CELLS.yellow.length, 7);
  assert.equal(CORRIDOR_CELLS.blue.length, 7);
});

test('Rule of 5 allows base exit on die1=5, die2=5, sum=5 (1+4 or 2+3), and Double 5 exits 2 tokens', () => {
  // 1) die1 === 5 -> spends die 0, leaves die 1 (3) available
  let st = startParchisiMatch('1v1');
  st = rollParchisiDice(st, [5, 3]);
  let moves = getLegalParchisiMoves(st);
  assert.equal(moves.length, 4); // 4 base tokens can exit
  assert.equal(moves[0].isExit, true);
  assert.deepEqual(moves[0].diceUsed, [0]);

  st = applyParchisiMove(st, moves[0].id);
  assert.equal(st.tokens.red[0].progress, 0); // On Tile 1
  assert.deepEqual(st.usedDice, [true, false]);
  // Remaining die 3 can move token 0 from 0 -> 3
  moves = getLegalParchisiMoves(st);
  assert.equal(moves.length, 1);
  assert.equal(moves[0].toProgress, 3);

  // 2) Sum of 5 (2 + 3) -> spends BOTH dice to bring 1 token out
  let stSum = startParchisiMatch('1v1');
  stSum = rollParchisiDice(stSum, [2, 3]);
  const sumMoves = getLegalParchisiMoves(stSum);
  assert.equal(sumMoves.length, 4);
  assert.deepEqual(sumMoves[0].diceUsed, [0, 1]);
  stSum = applyParchisiMove(stSum, sumMoves[0].id);
  assert.equal(stSum.tokens.red[0].progress, 0);
  // Both dice consumed, not doubles -> advances turn to Yellow
  assert.equal(stSum.turn, 'yellow');
  assert.equal(stSum.phase, 'WAIT_ROLL');

  // 3) Double 5 (5 + 5) -> exits 2 tokens onto Start tile (forming blockade) and grants extra roll!
  let stD5 = startParchisiMatch('1v1');
  stD5 = rollParchisiDice(stD5, [5, 5]);
  const firstExit = getLegalParchisiMoves(stD5).find((m) => m.tokenId === 0)!;
  stD5 = applyParchisiMove(stD5, firstExit.id);
  assert.equal(stD5.tokens.red[0].progress, 0);
  const secondExit = getLegalParchisiMoves(stD5).find((m) => m.tokenId === 1 && m.isExit)!;
  stD5 = applyParchisiMove(stD5, secondExit.id);
  assert.equal(stD5.tokens.red[1].progress, 0);
  // Both 5s used on doubles -> extra roll for Red!
  assert.equal(stD5.turn, 'red');
  assert.equal(stD5.phase, 'WAIT_ROLL');
});

test('Splitting dice across tokens AND combining dice (d1+d2) sequentially on 1 token', () => {
  let st = startParchisiMatch('1v1');
  st.tokens.red[0].progress = 2; // Tile 3
  st.tokens.red[1].progress = 10; // Tile 11
  st = rollParchisiDice(st, [2, 4]);

  const moves = getLegalParchisiMoves(st);
  const t0Moves = moves.filter((m) => m.tokenId === 0);
  // Token 0 should have +2, +4, and combined +6
  assert.deepEqual(
    t0Moves.map((m) => m.label).sort(),
    ['+2', '+4', '+6'],
  );

  // Execute combined +6 on token 0 -> moves straight to progress 8 and passes turn to Yellow
  const combined = t0Moves.find((m) => m.label === '+6')!;
  const afterCombined = applyParchisiMove(st, combined.id);
  assert.equal(afterCombined.tokens.red[0].progress, 8);
  assert.equal(afterCombined.turn, 'yellow');

  // Alternatively, split: +2 on token 0, then +4 on token 1
  const split1 = t0Moves.find((m) => m.label === '+2')!;
  let splitState = applyParchisiMove(st, split1.id);
  assert.equal(splitState.tokens.red[0].progress, 4);
  assert.equal(splitState.phase, 'WAIT_MOVE');
  const split2 = getLegalParchisiMoves(splitState).find((m) => m.tokenId === 1 && m.label === '+4')!;
  splitState = applyParchisiMove(splitState, split2.id);
  assert.equal(splitState.tokens.red[1].progress, 14);
  assert.equal(splitState.turn, 'yellow');
});

test('Blockades prevent passing AND landing for both own and opponent tokens', () => {
  let st = startParchisiMatch('1v1');
  // Red token 0 at progress 2 (Tile 3)
  st.tokens.red[0].progress = 2;
  // Yellow forms a blockade at Tile 6 (Yellow start=35 -> progress 39 => (34+39)%68+1 = 6)
  assert.equal(progressToOuterSquare('yellow', 39), 6);
  st.tokens.yellow[0].progress = 39;
  st.tokens.yellow[1].progress = 39;

  st = rollParchisiDice(st, [3, 6]); // +3 lands on Tile 6 (blocked!), +6 passes Tile 6 (blocked!)
  const moves = getLegalParchisiMoves(st);
  assert.equal(moves.length, 0);
});

test('Capturing single opponent on non-safe tile awards +20 bonus; Safe Star tiles protect from capture', () => {
  let st = startParchisiMatch('1v1');
  // Red token 0 at progress 1 (Tile 2). Yellow token 0 at Tile 6 (non-safe: yellow progress 39)
  st.tokens.red[0].progress = 1;
  st.tokens.yellow[0].progress = 39;

  st = rollParchisiDice(st, [4, 2]); // +4 lands on Tile 6 -> captures Yellow!
  const captureMove = getLegalParchisiMoves(st).find((m) => m.tokenId === 0 && m.label === '+4')!;
  assert.equal(captureMove.captures.length, 1);

  st = applyParchisiMove(st, captureMove.id);
  assert.equal(st.tokens.yellow[0].progress, -1); // Sent back to base!
  assert.deepEqual(st.pendingBonuses, [20]); // Immediate +20 bonus queued!
  assert.equal(st.phase, 'WAIT_MOVE');

  // Must play +20 bonus before remaining die (+2)
  const bonusMoves = getLegalParchisiMoves(st);
  assert.equal(bonusMoves.length, 1);
  assert.equal(bonusMoves[0].label, '+20');
  st = applyParchisiMove(st, bonusMoves[0].id);
  assert.equal(st.tokens.red[0].progress, 25); // 5 + 20
  assert.deepEqual(st.pendingBonuses, []);
  // Now remaining die (+2) is playable!
  const remMoves = getLegalParchisiMoves(st);
  assert.equal(remMoves.length, 1);
  assert.equal(remMoves[0].label, '+2');

  // Safe Star Tile protection check: Tile 8 is a Gray Star Safe tile (Yellow progress 41 -> Tile 8)
  let safeSt = startParchisiMatch('1v1');
  safeSt.tokens.red[0].progress = 4; // Tile 5
  safeSt.tokens.yellow[0].progress = 41; // Tile 8 (Star Safe!)
  assert.equal(progressToOuterSquare('yellow', 41), 8);
  safeSt = rollParchisiDice(safeSt, [3, 1]);
  const safeMove = getLegalParchisiMoves(safeSt).find((m) => m.label === '+3')!;
  assert.equal(safeMove.captures.length, 0);
  assert.equal(safeMove.landsOnSafe, true);
  safeSt = applyParchisiMove(safeSt, safeMove.id);
  assert.equal(safeSt.tokens.yellow[0].progress, 41); // Yellow NOT captured!
  assert.deepEqual(safeSt.pendingBonuses, []);
});

test('Three consecutive doubles forfeits 3rd roll and returns last moved token unless inside Home Column', () => {
  let st = startParchisiMatch('1v1');
  st.tokens.red[0].progress = 10; // On outer track
  st.consecutiveDoubles = 2;
  st.lastMovedTokenId.red = 0;

  st = rollParchisiDice(st, [4, 4]);
  assert.equal(st.tokens.red[0].progress, -1); // Returned to base!
  assert.equal(getLegalParchisiMoves(st).length, 0);
  assert.equal(st.extraRollPending, false);
  st = passParchisiTurnOrBonus(st);
  assert.equal(st.turn, 'yellow');

  // Token already inside colored Home Column (progress >= 64) is SPARED
  let stSafe = startParchisiMatch('1v1');
  stSafe.tokens.red[0].progress = 66;
  stSafe.consecutiveDoubles = 2;
  stSafe.lastMovedTokenId.red = 0;
  stSafe = rollParchisiDice(stSafe, [2, 2]);
  assert.equal(stSafe.tokens.red[0].progress, 66); // Spared!
});

test('Blockade Break rule on doubles forces breaking own blockade if a legal move exists', () => {
  let st = startParchisiMatch('1v1');
  // Red owns a blockade on progress 10 (tokens 0 & 1), plus free token 2 at progress 20
  st.tokens.red[0].progress = 10;
  st.tokens.red[1].progress = 10;
  st.tokens.red[2].progress = 20;

  st = rollParchisiDice(st, [3, 3]);
  assert.equal(st.mustBreakBlockade, true);
  const moves = getLegalParchisiMoves(st);
  // Every offered move must come from token 0 or token 1 (the blockade!)
  assert.ok(moves.length > 0);
  assert.ok(moves.every((m) => m.tokenId === 0 || m.tokenId === 1));

  // Once token 0 moves out of blockade, mustBreakBlockade clears and token 2 can use remaining die 3!
  const breakMove = moves.find((m) => m.tokenId === 0 && m.label === '+3')!;
  st = applyParchisiMove(st, breakMove.id);
  assert.equal(st.mustBreakBlockade, false);
  const nextMoves = getLegalParchisiMoves(st);
  assert.ok(nextMoves.some((m) => m.tokenId === 2));
});

test('Center Triangle Home requires exact count, awards +10 bonus, and 4th token triggers Victory', () => {
  let st = startParchisiMatch('1v1');
  st.tokens.red[0].progress = 68; // Needs exact 3 to reach 71
  st.tokens.red[1].progress = 15;
  st = rollParchisiDice(st, [4, 3]); // +4 overshoots 71 (invalid), +3 hits 71 exact!

  const t0Moves = getLegalParchisiMoves(st).filter((m) => m.tokenId === 0);
  assert.equal(t0Moves.length, 1);
  assert.equal(t0Moves[0].label, '+3');
  assert.equal(t0Moves[0].reachesHome, true);

  st = applyParchisiMove(st, t0Moves[0].id);
  assert.equal(st.tokens.red[0].progress, PARCHISI_HOME_PROGRESS);
  assert.deepEqual(st.pendingBonuses, [10]); // +10 bonus!

  // Play +10 bonus on token 1
  const b10 = getLegalParchisiMoves(st).find((m) => m.tokenId === 1 && m.label === '+10')!;
  st = applyParchisiMove(st, b10.id);
  assert.equal(st.tokens.red[1].progress, 25);

  // Victory test: 3 tokens already home, 4th enters exact -> GAME_OVER & winner = red
  let winSt = startParchisiMatch('1v1');
  winSt.tokens.red[0].progress = 71;
  winSt.tokens.red[1].progress = 71;
  winSt.tokens.red[2].progress = 71;
  winSt.tokens.red[3].progress = 69; // Needs exact 2
  winSt = rollParchisiDice(winSt, [2, 6]);
  const winMove = getLegalParchisiMoves(winSt).find((m) => m.tokenId === 3 && m.label === '+2')!;
  winSt = applyParchisiMove(winSt, winMove.id);
  assert.equal(winSt.phase, 'GAME_OVER');
  assert.equal(winSt.winner, 'red');
});

test('4-Player Classic mode cycles counter-clockwise (red -> green -> yellow -> blue) and AI picks valid moves', () => {
  let st = startParchisiMatch('4p');
  assert.deepEqual(st.activeColors, ['red', 'green', 'yellow', 'blue']);
  assert.equal(st.tokens.green.length, 4);
  assert.equal(st.tokens.blue.length, 4);

  // Red rolls 1 & 2 (no 5 -> 0 moves -> passes to Green)
  st = rollParchisiDice(st, [1, 2]);
  assert.equal(getLegalParchisiMoves(st).length, 0);
  st = passParchisiTurnOrBonus(st);
  assert.equal(st.turn, 'green');

  // Green AI rolls 5 & 4 -> AI chooses exit move cleanly
  st = rollParchisiDice(st, [5, 4]);
  const aiMove1 = chooseAiParchisiMove(st);
  assert.ok(aiMove1 !== null);
  assert.equal(aiMove1!.isExit, true);
  st = applyParchisiMove(st, aiMove1!.id);

  // Green AI uses remaining die 4 -> advances turn to Yellow
  const aiMove2 = chooseAiParchisiMove(st);
  assert.ok(aiMove2 !== null);
  st = applyParchisiMove(st, aiMove2!.id);
  assert.equal(st.turn, 'yellow');

  // Initial state in 1v1 keeps green/blue empty
  const init1v1 = createInitialParchisiState('1v1');
  assert.equal(init1v1.tokens.green.length, 0);
  assert.equal(init1v1.tokens.blue.length, 0);
  assert.equal(init1v1.diceCount, 2);
});

test('1-Die mode: rolling 5 exits from base OR advances an active pawn, and 1-element dice array is used', () => {
  let st = startParchisiMatch('1v1', 1000, 1);
  assert.equal(st.diceCount, 1);
  assert.deepEqual(st.usedDice, [false]);

  // Rolling 4 with all pawns in base -> 0 legal moves -> passes turn to Yellow
  st = rollParchisiDice(st, [4]);
  assert.deepEqual(st.dice, [4]);
  assert.equal(getLegalParchisiMoves(st).length, 0);
  st = passParchisiTurnOrBonus(st);
  assert.equal(st.turn, 'yellow');
  assert.equal(st.phase, 'WAIT_ROLL');

  // Yellow AI rolls 5 -> exits base cleanly
  st = rollParchisiDice(st, [5]);
  assert.deepEqual(st.dice, [5]);
  const aiExit = chooseAiParchisiMove(st);
  assert.ok(aiExit !== null);
  assert.equal(aiExit!.isExit, true);
  st = applyParchisiMove(st, aiExit!.id);
  assert.equal(st.tokens.yellow[0].progress, 0);
  assert.equal(st.turn, 'red');

  // Red has 1 pawn already on board (progress 2) and 3 in base -> rolling 5 allows EITHER exiting OR advancing +5!
  st.tokens.red[0].progress = 2;
  st = rollParchisiDice(st, [5]);
  const moves = getLegalParchisiMoves(st);
  assert.ok(moves.some((m) => m.tokenId === 0 && !m.isExit && m.toProgress === 7 && m.label === '+5'));
  assert.ok(moves.some((m) => m.tokenId === 1 && m.isExit && m.toProgress === 0));
});

test('1-Die mode: rolling 6 grants bonus roll; 3 consecutive sixes pass the turn; +20 capture & +10 home bonuses work', () => {
  let st = startParchisiMatch('1v1', 1000, 1);
  st.tokens.red[0].progress = 1; // Tile 2

  // 1st six -> advances +6 and keeps Red's turn for a bonus roll!
  st = rollParchisiDice(st, [6]);
  assert.equal(st.consecutiveDoubles, 1);
  assert.equal(st.extraRollPending, true);
  const move1 = getLegalParchisiMoves(st)[0];
  st = applyParchisiMove(st, move1.id);
  assert.equal(st.tokens.red[0].progress, 7);
  assert.equal(st.turn, 'red');
  assert.equal(st.phase, 'WAIT_ROLL');

  // 2nd six -> advances +6 and keeps Red's turn!
  st = rollParchisiDice(st, [6]);
  assert.equal(st.consecutiveDoubles, 2);
  const move2 = getLegalParchisiMoves(st)[0];
  st = applyParchisiMove(st, move2.id);
  assert.equal(st.tokens.red[0].progress, 13);
  assert.equal(st.turn, 'red');
  assert.equal(st.phase, 'WAIT_ROLL');

  // 3rd consecutive six -> forfeits turn, 0 legal moves, passes to Yellow!
  st = rollParchisiDice(st, [6]);
  assert.equal(st.consecutiveDoubles, 0);
  assert.equal(st.extraRollPending, false);
  assert.equal(getLegalParchisiMoves(st).length, 0);
  st = passParchisiTurnOrBonus(st);
  assert.equal(st.turn, 'yellow');

  // Capture (+20) and Center Home (+10) bonuses preserved in 1-Die mode
  let capSt = startParchisiMatch('1v1', 1000, 1);
  capSt.tokens.red[0].progress = 1; // Tile 2
  capSt.tokens.yellow[0].progress = 39; // Tile 6 (non-safe)
  capSt = rollParchisiDice(capSt, [4]);
  const capMove = getLegalParchisiMoves(capSt)[0];
  assert.equal(capMove.captures.length, 1);
  capSt = applyParchisiMove(capSt, capMove.id);
  assert.equal(capSt.tokens.yellow[0].progress, -1);
  assert.deepEqual(capSt.pendingBonuses, [20]);
  const b20 = getLegalParchisiMoves(capSt)[0];
  assert.equal(b20.label, '+20');
  capSt = applyParchisiMove(capSt, b20.id);
  assert.equal(capSt.tokens.red[0].progress, 25);
  assert.equal(capSt.turn, 'yellow');

  // Home entry (+10) bonus in 1-Die mode
  let homeSt = startParchisiMatch('1v1', 1000, 1);
  homeSt.tokens.red[0].progress = 68; // Needs exact 3
  homeSt.tokens.red[1].progress = 10;
  homeSt = rollParchisiDice(homeSt, [3]);
  const hMove = getLegalParchisiMoves(homeSt).find((m) => m.tokenId === 0)!;
  homeSt = applyParchisiMove(homeSt, hMove.id);
  assert.equal(homeSt.tokens.red[0].progress, PARCHISI_HOME_PROGRESS);
  assert.deepEqual(homeSt.pendingBonuses, [10]);
});

