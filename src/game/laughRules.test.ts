import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSmileIntensity,
  createInitialLaughState,
  startLaughRound,
  stepLaughGame,
  getSmileThreshold,
  classifySmileState,
} from './laughRules';

test('computeSmileIntensity returns 0 for neutral or empty blendshapes', () => {
  assert.equal(computeSmileIntensity([]).smileScore, 0);
  assert.equal(
    computeSmileIntensity([
      { categoryName: 'mouthSmileLeft', score: 0.01 },
      { categoryName: 'mouthSmileRight', score: 0.01 },
    ]).smileScore,
    1,
  );
});

test('computeSmileIntensity scores a full laugh above implacable and normal thresholds', () => {
  const result = computeSmileIntensity([
    { categoryName: 'mouthSmileLeft', score: 0.72 },
    { categoryName: 'mouthSmileRight', score: 0.76 },
    { categoryName: 'cheekSquintLeft', score: 0.55 },
    { categoryName: 'cheekSquintRight', score: 0.52 },
    { categoryName: 'jawOpen', score: 0.45 },
  ]);
  assert.ok(result.smileScore >= 75, `expected high smileScore, got ${result.smileScore}`);
  assert.ok(result.laughBurst > 30, `expected laughBurst > 30, got ${result.laughBurst}`);
});

test('computeSmileIntensity detects expressive grimaces without false smile trigger', () => {
  const result = computeSmileIntensity([
    { categoryName: 'cheekPuff', score: 0.65 },
    { categoryName: 'mouthPucker', score: 0.58 },
    { categoryName: 'browInnerUp', score: 0.52 },
  ]);
  assert.ok(result.grimaceScore >= 60, `expected high grimaceScore, got ${result.grimaceScore}`);
  assert.ok(result.smileScore < 20, `expected low smileScore during neutral grimace, got ${result.smileScore}`);
});

test('stepLaughGame transitions from countdown to playing after 3 seconds', () => {
  let state = startLaughRound(createInitialLaughState('normal'));
  assert.equal(state.phase, 'countdown');

  for (let i = 0; i < 65; i++) {
    state = stepLaughGame(state, 5, 5, 0.05, 'Alex', 'Camille').nextState;
  }
  assert.equal(state.phase, 'playing');
});

test('stepLaughGame detects sustained smile over threshold and awards point to opponent', () => {
  let state = startLaughRound(createInitialLaughState('normal'));
  state = { ...state, phase: 'playing', elapsedSec: 1.0 };

  const threshold = getSmileThreshold('normal');
  assert.equal(classifySmileState(threshold + 5, 'normal'), 'cracking');

  // Hold local smile above threshold for 0.4s -> local cracks, partner wins
  let lastEvent = 'none';
  for (let i = 0; i < 10; i++) {
    const res = stepLaughGame(state, threshold + 12, 10, 0.05, 'Alex', 'Camille');
    state = res.nextState;
    lastEvent = res.event;
    if (lastEvent === 'round_end') break;
  }

  assert.equal(lastEvent, 'round_end');
  assert.equal(state.phase, 'round_over');
  assert.equal(state.lastWinner, 'partner');
  assert.equal(state.partnerScore, 1);
  assert.equal(state.localScore, 0);
  assert.equal(state.history.length, 1);
});

test('stepLaughGame transitions to match_over when targetWins is reached', () => {
  let state = createInitialLaughState('implacable');
  state = {
    ...state,
    phase: 'playing',
    elapsedSec: 1.5,
    localScore: 2,
    targetWins: 3,
  };

  for (let i = 0; i < 10; i++) {
    const res = stepLaughGame(state, 5, 80, 0.05, 'Alex', 'Camille');
    state = res.nextState;
    if (res.event === 'round_end') break;
  }

  assert.equal(state.phase, 'match_over');
  assert.equal(state.localScore, 3);
  assert.equal(state.lastWinner, 'local');
});
