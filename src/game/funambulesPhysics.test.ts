import test from 'node:test';
import assert from 'node:assert/strict';
import type { FunambulesState } from '../types/duoplay';
import {
  computeHeadTiltInput,
  createInitialFunambulesState,
  FALL_ANGLE_DEG,
  stepFunambulesPhysics,
  TARGET_DISTANCE_M,
} from './funambulesPhysics';
import { createAiPartnerMemory, stepAiFunambulesPartner } from './aiPartner';

test('computeHeadTiltInput respects deadzone and prioritizes keyboard fallback', () => {
  assert.equal(computeHeadTiltInput(0.02, 0), 0);
  assert.equal(computeHeadTiltInput(-0.02, 0), 0);
  assert.ok(computeHeadTiltInput(0.25, 0) > 0.4);
  assert.ok(computeHeadTiltInput(-0.25, 0) < -0.4);
  assert.equal(computeHeadTiltInput(0.3, -1), -1);
});

test('Les Funambules survives the opening 3.5 seconds with zero input', () => {
  let state: FunambulesState = { ...createInitialFunambulesState(0), phase: 'playing' };
  for (let i = 0; i < 70; i++) {
    state = stepFunambulesPhysics(state, 0, 0, 0.05, () => 0.2).nextState;
  }
  assert.equal(state.phase, 'playing');
  assert.ok(Math.abs(state.angleDeg) < FALL_ANGLE_DEG);
  assert.ok(state.distanceM > 5, `expected player to advance, got ${state.distanceM}`);
});

test('cooperative counter-tilt stabilizes a leaning pole', () => {
  let state: FunambulesState = {
    ...createInitialFunambulesState(0),
    phase: 'playing',
    angleDeg: 22,
    angularVelDeg: 8,
  };

  for (let i = 0; i < 20; i++) {
    state = stepFunambulesPhysics(state, -0.8, -0.8, 0.05, () => 0.5).nextState;
  }

  assert.ok(state.angleDeg < 15, `expected angle to reduce from 22 deg, got ${state.angleDeg}`);
});

test('exceeding FALL_ANGLE_DEG triggers falling then gameover with frozen best distance', () => {
  let state: FunambulesState = {
    ...createInitialFunambulesState(0),
    phase: 'playing',
    angleDeg: 48,
    angularVelDeg: 45,
    distanceM: 34.5,
  };

  let fell = false;
  for (let i = 0; i < 20; i++) {
    const res = stepFunambulesPhysics(state, 1, 1, 0.05, () => 0.5);
    state = res.nextState;
    if (res.event === 'fall') {
      fell = true;
      break;
    }
  }
  assert.equal(fell, true);
  assert.equal(state.phase, 'falling');

  // Advance fall animation until gameover
  for (let i = 0; i < 20; i++) {
    state = stepFunambulesPhysics(state, 0, 0, 0.05, () => 0.5).nextState;
  }
  assert.equal(state.phase, 'gameover');
  assert.ok(state.bestDistanceM >= 34.5);
});

test('reaching TARGET_DISTANCE_M triggers cooperative victory', () => {
  let state: FunambulesState = {
    ...createInitialFunambulesState(0),
    phase: 'playing',
    distanceM: TARGET_DISTANCE_M - 0.5,
  };
  let won = false;
  for (let i = 0; i < 15; i++) {
    const res = stepFunambulesPhysics(state, 0, 0, 0.05, () => 0.5);
    state = res.nextState;
    if (res.event === 'victory') {
      won = true;
      break;
    }
  }
  assert.equal(won, true);
  assert.equal(state.phase, 'victory');
  assert.equal(state.distanceM, TARGET_DISTANCE_M);
});

test('AI partner tilts opposite to positive pole lean', () => {
  const mem = createAiPartnerMemory();
  const state: FunambulesState = {
    ...createInitialFunambulesState(0),
    phase: 'playing',
    angleDeg: 28,
    angularVelDeg: 10,
    windForce: 0.4,
  };
  let curr = mem;
  let tilt = 0;
  for (let i = 0; i < 15; i++) {
    const res = stepAiFunambulesPartner(curr, state, 0.05);
    curr = res.nextMemory;
    tilt = res.headTiltRad;
  }
  assert.ok(tilt < -0.1, `expected AI partner to lean left (< -0.1), got ${tilt}`);
});
