import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_TRAP_INTERVAL_SEC,
  createInitialStareDuelState,
  createStareAiMemory,
  detectEyeBlink,
  startStareRound,
  stepAiStarePartner,
  stepStareDuel,
} from './stareDuelLogic';

test('detectEyeBlink triggers on eyeBlinkLeft, eyeBlinkRight, average, or manual blink', () => {
  assert.equal(detectEyeBlink(0.1, 0.1, false), false);
  assert.equal(detectEyeBlink(0.6, 0.1, false), true);
  assert.equal(detectEyeBlink(0.1, 0.58, false), true);
  assert.equal(detectEyeBlink(0.5, 0.49, false), true);
  assert.equal(detectEyeBlink(0.0, 0.0, true), true);
});

test('stepStareDuel triggers an automatic visual trap every 5 seconds', () => {
  let st = startStareRound(createInitialStareDuelState());
  st = { ...st, phase: 'playing', countdownSec: 0 };

  let trapTriggered = false;
  let trapKind = null;
  for (let i = 0; i < Math.ceil((AUTO_TRAP_INTERVAL_SEC + 0.1) / 0.05); i++) {
    const res = stepStareDuel(st, false, false, 0.05);
    st = res.nextState;
    if (res.event === 'auto_trap') {
      trapTriggered = true;
      trapKind = res.triggeredTrap;
      break;
    }
  }
  assert.equal(trapTriggered, true);
  assert.ok(trapKind === 'fly' || trapKind === 'flash');
});

test('stepStareDuel awards round to partner when local player blinks after grace period', () => {
  let st = startStareRound(createInitialStareDuelState());
  st = { ...st, phase: 'playing', countdownSec: 0, elapsedSec: 2.0 };

  const res = stepStareDuel(st, true, false, 0.03);
  assert.equal(res.event, 'local_blinked');
  assert.equal(res.nextState.phase, 'round_over');
  assert.equal(res.nextState.partnerScore, 1);
  assert.equal(res.nextState.lastWinner, 'partner');
});

test('stepAiStarePartner eventually blinks faster when hit by distractions', () => {
  let mem = createStareAiMemory(() => 0.1); // ~11.1s endurance
  let res = stepAiStarePartner(mem, true, 0, 0.05);
  assert.equal(res.hasBlinked, false);

  // Send strong distraction impulses
  res = stepAiStarePartner(res.nextMemory, true, 12, 0.05);
  assert.equal(res.hasBlinked, true);
});
