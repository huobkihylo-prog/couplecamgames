import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeFreezeLandmarkDelta,
  createInitialFreezeState,
  evaluateFreezeMotion,
  FREEZE_DANCE_MAX_MS,
  FREEZE_DANCE_MIN_MS,
  FREEZE_DANCE_VIBES,
  FREEZE_GRACE_MS,
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

test('MediaPipe Freeze motion detector enforces 600ms grace, ignores webcam micro-jitter, and catches clear movement', () => {
  assert.equal(FREEZE_GRACE_MS, 600);

  const baseline = {
    noseX: 0.5,
    noseY: 0.5,
    leftEyeX: 0.43,
    leftEyeY: 0.44,
    rightEyeX: 0.57,
    rightEyeY: 0.44,
    chinX: 0.5,
    chinY: 0.64,
    headTiltRad: 0.02,
  };

  // Tiny camera jitter (~0.004) must yield 100% stability and NEVER trigger caught
  const jitterFrame = {
    ...baseline,
    noseX: 0.504,
    noseY: 0.497,
    leftEyeX: 0.433,
    rightEyeX: 0.573,
    headTiltRad: 0.03,
  };
  const jitterEval = evaluateFreezeMotion(baseline, jitterFrame, 0);
  assert.equal(jitterEval.stability, 100);
  assert.equal(jitterEval.caught, false);
  assert.equal(jitterEval.violationFrames, 0);

  // Clear lean / dance movement (~0.09 normalized shift) triggers caught after 2 sustained frames
  const movedFrame = {
    ...baseline,
    noseX: 0.59,
    noseY: 0.54,
    leftEyeX: 0.52,
    leftEyeY: 0.48,
    rightEyeX: 0.66,
    rightEyeY: 0.48,
    chinX: 0.59,
    chinY: 0.68,
    headTiltRad: 0.16,
  };
  assert.ok(computeFreezeLandmarkDelta(baseline, movedFrame) > 0.08);
  const frame1 = evaluateFreezeMotion(baseline, movedFrame, 0);
  assert.equal(frame1.caught, false);
  assert.equal(frame1.violationFrames, 1);
  assert.equal(frame1.stability, 0);

  const frame2 = evaluateFreezeMotion(baseline, movedFrame, frame1.violationFrames);
  assert.equal(frame2.caught, true);
  assert.equal(frame2.violationFrames, 2);
});
