import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialFreezeState,
  FREEZE_DANCE_MAX_MS,
  FREEZE_DANCE_MIN_MS,
  FREEZE_DANCE_VIBES,
  pickRandomDanceDurationMs,
  resolveFreezeRoundVerdicts,
} from './freezeDanceLogic';

test('pickRandomDanceDurationMs always stays within 4s to 10s', () => {
  assert.equal(pickRandomDanceDurationMs(() => 0), FREEZE_DANCE_MIN_MS);
  assert.equal(pickRandomDanceDurationMs(() => 0.999999), FREEZE_DANCE_MAX_MS);
  for (let i = 0; i < 40; i += 1) {
    const ms = pickRandomDanceDurationMs();
    assert.ok(ms >= 4000 && ms <= 10000);
  }
});

test('lives-3 mode eliminates player reaching 0 lives and assigns funny dare', () => {
  let state = {
    ...createInitialFreezeState('chaabi-rai', 'lives-3'),
    phase: 'VERDICT' as const,
    round: 1,
    guestLives: 1,
  };
  const outcome = resolveFreezeRoundVerdicts(state, 'moved', 'statue', false, 0);
  assert.equal(outcome.matchFinished, true);
  assert.equal(outcome.nextState.guestLives, 0);
  assert.equal(outcome.nextState.hostLives, 3);
  assert.equal(outcome.nextState.hostPoints, 1);
  assert.equal(outcome.nextState.winner, 'host');
  assert.ok(outcome.nextState.activeDareText.length > 0);
});

test('rounds-5 mode awards +1 pt to opposing player on moved and finishes after round 5', () => {
  const state = {
    ...createInitialFreezeState('party-pop', 'rounds-5'),
    phase: 'VERDICT' as const,
    round: 5,
    hostPoints: 2,
    guestPoints: 1,
  };
  const outcome = resolveFreezeRoundVerdicts(state, 'moved', 'statue', false, 2);
  assert.equal(outcome.matchFinished, true);
  // Guest moved -> Host gets +1; Host was statue -> Host gets +1 style pt => Host 4 vs Guest 1
  assert.equal(outcome.nextState.hostPoints, 4);
  assert.equal(outcome.nextState.guestPoints, 1);
  assert.equal(outcome.nextState.winner, 'host');
  assert.equal(outcome.nextState.phase, 'GAME_OVER');
});

test('solo mode self-verdict statue grants +1 style point and lives-3 keeps lives intact', () => {
  const state = {
    ...createInitialFreezeState('disco-funk', 'lives-3'),
    phase: 'VERDICT' as const,
    round: 2,
  };
  const outcome = resolveFreezeRoundVerdicts(state, 'statue', null, true, 0);
  assert.equal(outcome.matchFinished, false);
  assert.equal(outcome.nextState.hostPoints, 1);
  assert.equal(outcome.nextState.hostLives, 3);
});

test('all 4 requested musical vibes are configured', () => {
  const ids = FREEZE_DANCE_VIBES.map((v) => v.id);
  assert.deepEqual(ids, ['party-pop', 'chaabi-rai', 'reggaeton-latino', 'disco-funk']);
});
