import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyXoMove,
  chooseAiXoMove,
  cursorToCellIndex,
  getFadingCellIndex,
  handleXoTurnTimeout,
  startNextXoRound,
  startXoMatch,
} from './xoNeonLogic';

test('Infinite Mode caps each player at 3 pieces, highlights oldest fading piece, and evicts FIFO on 4th move', () => {
  let state = startXoMatch('infinite', 'xo', 3);

  // Host plays 0, Guest plays 4
  state = applyXoMove(state, 'host', 0).state;
  state = applyXoMove(state, 'guest', 4).state;
  // Host plays 1, Guest plays 2
  state = applyXoMove(state, 'host', 1).state;
  state = applyXoMove(state, 'guest', 2).state;
  // Host plays 6 (now host has [0,1,6]), Guest plays 8 (guest has [4,2,8])
  state = applyXoMove(state, 'host', 6).state;
  state = applyXoMove(state, 'guest', 8).state;

  // Now it is Host's turn with 3 pieces: oldest piece (cell 0) must be flagged as fading!
  assert.equal(getFadingCellIndex(state), 0);

  // Host places 4th piece at cell 3 -> cell 0 is evicted!
  const fourth = applyXoMove(state, 'host', 3);
  assert.equal(fourth.accepted, true);
  assert.equal(fourth.evictedCell, 0);
  assert.equal(fourth.state.board[0], null);
  assert.equal(fourth.state.board[3], 'host');
  assert.deepEqual(fourth.state.hostQueue, [1, 6, 3]);
});

test('Classic Mode detects draw when all 9 cells are filled with no 3-in-a-row', () => {
  let state = startXoMatch('classic', 'xo', 3);
  // Sequence yielding a draw:
  // H:0, G:1, H:2, G:4, H:3, G:5, H:7, G:6, H:8
  const seq: Array<['host' | 'guest', number]> = [
    ['host', 0],
    ['guest', 1],
    ['host', 2],
    ['guest', 4],
    ['host', 3],
    ['guest', 5],
    ['host', 7],
    ['guest', 6],
    ['host', 8],
  ];
  for (const [player, cell] of seq) {
    state = applyXoMove(state, player, cell).state;
  }
  assert.equal(state.phase, 'round_over');
  assert.equal(state.roundWinner, 'draw');
  assert.equal(state.winLine, null);
});

test('First to 3 wins transitions cleanly to match_over with a couple dare index', () => {
  let state = startXoMatch('infinite', 'hearts', 3);

  for (let r = 0; r < 3; r++) {
    if (state.turn === 'guest') {
      state = applyXoMove(state, 'guest', 8).state;
    }
    state = applyXoMove(state, 'host', 0).state;
    state = applyXoMove(state, 'guest', 3).state;
    state = applyXoMove(state, 'host', 1).state;
    state = applyXoMove(state, 'guest', 4).state;
    state = applyXoMove(state, 'host', 2, 12, () => 0.25).state;

    if (r < 2) {
      assert.equal(state.phase, 'round_over');
      state = startNextXoRound(state);
    }
  }

  assert.equal(state.phase, 'match_over');
  assert.equal(state.matchWinner, 'host');
  assert.equal(state.hostWins, 3);
  assert.equal(state.dareIndex, 3);
});

test('Turn timeout auto-plays a legal cell and advances turn', () => {
  const state = startXoMatch('infinite', 'xo', 3);
  const res = handleXoTurnTimeout(state, 10, () => 0.5);
  assert.ok(res.playedCell !== null);
  assert.equal(res.state.board[res.playedCell], 'host');
  assert.equal(res.state.turn, 'guest');
});

test('Solo AI blocks immediate opponent win and takes immediate win in Infinite Mode', () => {
  let state = startXoMatch('infinite', 'xo', 3);
  state = applyXoMove(state, 'host', 0).state;
  state = applyXoMove(state, 'guest', 4).state;
  state = applyXoMove(state, 'host', 1).state;
  // Host threatens cell 2 -> AI MUST block cell 2!
  const blockMove = chooseAiXoMove(state, 'guest', () => 0.5);
  assert.equal(blockMove, 2);

  // Setup immediate AI win on cell 6 (diagonal 2-4-6)
  state = applyXoMove(state, 'guest', 2).state;
  state = applyXoMove(state, 'host', 5).state;
  const winMove = chooseAiXoMove(state, 'guest', () => 0.5);
  assert.equal(winMove, 6);
});

test('cursorToCellIndex maps normalized 0..1 grid positions accurately', () => {
  assert.equal(cursorToCellIndex(0.1, 0.1), 0);
  assert.equal(cursorToCellIndex(0.5, 0.5), 4);
  assert.equal(cursorToCellIndex(0.95, 0.95), 8);
  assert.equal(cursorToCellIndex(-0.1, 0.5), null);
});
