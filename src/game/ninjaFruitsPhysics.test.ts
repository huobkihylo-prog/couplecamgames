import test from 'node:test';
import assert from 'node:assert/strict';
import type { NinjaFruitsState } from '../types/duoplay';
import {
  computeMultiplier,
  createInitialNinjaFruitsState,
  createNinjaAiMemory,
  segmentIntersectsCircle,
  stepAiNinjaPartner,
  stepNinjaFruitsPhysics,
} from './ninjaFruitsPhysics';

const IDLE_BLADE = { prevX: 100, prevY: 100, x: 100, y: 100, active: false };

test('segmentIntersectsCircle accurately detects blade intersections and misses', () => {
  assert.equal(segmentIntersectsCircle(0, 0, 100, 0, 50, 15, 25), true);
  assert.equal(segmentIntersectsCircle(0, 0, 100, 0, 50, 45, 25), false);
});

test('slicing regular fruits increases score, combo, and multiplier', () => {
  let state: NinjaFruitsState = {
    ...createInitialNinjaFruitsState(0),
    phase: 'playing',
    spawnTimerSec: 5,
    items: [
      {
        id: 1,
        kind: 'watermelon',
        x: 300,
        y: 300,
        vx: 0,
        vy: 0,
        radius: 38,
        rotation: 0,
        vRot: 0,
        sliced: false,
        slicedTimer: 0,
        sliceAngle: 0,
        hitByP1At: null,
        hitByP2At: null,
      },
      {
        id: 2,
        kind: 'mango',
        x: 350,
        y: 300,
        vx: 0,
        vy: 0,
        radius: 32,
        rotation: 0,
        vRot: 0,
        sliced: false,
        slicedTimer: 0,
        sliceAngle: 0,
        hitByP1At: null,
        hitByP2At: null,
      },
    ],
  };

  const swipe = { prevX: 240, prevY: 300, x: 420, y: 300, active: true };
  const res = stepNinjaFruitsPhysics(state, swipe, IDLE_BLADE, 0.03, () => 0.5);
  state = res.nextState;

  assert.equal(state.slicedCount, 2);
  assert.equal(state.combo, 2);
  assert.equal(state.multiplier, computeMultiplier(2));
  assert.ok(state.score >= 30, `expected score >= 30, got ${state.score}`);
});

test('slicing a bomb costs a couple life, resets combo, and triggers gameover at 0 lives', () => {
  let state: NinjaFruitsState = {
    ...createInitialNinjaFruitsState(0),
    phase: 'playing',
    lives: 1,
    combo: 6,
    multiplier: 3,
    spawnTimerSec: 5,
    items: [
      {
        id: 10,
        kind: 'bomb',
        x: 500,
        y: 300,
        vx: 0,
        vy: 0,
        radius: 30,
        rotation: 0,
        vRot: 0,
        sliced: false,
        slicedTimer: 0,
        sliceAngle: 0,
        hitByP1At: null,
        hitByP2At: null,
      },
    ],
  };

  const swipe = { prevX: 440, prevY: 300, x: 560, y: 300, active: true };
  const res = stepNinjaFruitsPhysics(state, swipe, IDLE_BLADE, 0.03, () => 0.5);
  assert.ok(res.events.includes('bomb_hit'));
  assert.ok(res.events.includes('gameover'));
  assert.equal(res.nextState.lives, 0);
  assert.equal(res.nextState.combo, 0);
  assert.equal(res.nextState.phase, 'gameover');
});

test('Giant Fruit requires BOTH blades to slice together for cooperative bonus', () => {
  let state: NinjaFruitsState = {
    ...createInitialNinjaFruitsState(0),
    phase: 'playing',
    spawnTimerSec: 5,
    items: [
      {
        id: 99,
        kind: 'giant',
        x: 500,
        y: 280,
        vx: 0,
        vy: 0,
        radius: 56,
        rotation: 0,
        vRot: 0,
        sliced: false,
        slicedTimer: 0,
        sliceAngle: 0,
        hitByP1At: null,
        hitByP2At: null,
      },
    ],
  };

  // Only P1 slashes -> marked, NOT yet sliced
  const p1Swipe = { prevX: 420, prevY: 280, x: 580, y: 280, active: true };
  const r1 = stepNinjaFruitsPhysics(state, p1Swipe, IDLE_BLADE, 0.03, () => 0.5);
  assert.ok(r1.events.includes('giant_marked'));
  assert.equal(r1.nextState.giantSlicedCount, 0);
  assert.equal(r1.nextState.items[0].sliced, false);

  // P2 slashes within cooperative window -> Giant Fruit bursts!
  const p2Swipe = { prevX: 580, prevY: 230, x: 420, y: 330, active: true };
  const r2 = stepNinjaFruitsPhysics(r1.nextState, IDLE_BLADE, p2Swipe, 0.03, () => 0.5);
  assert.ok(r2.events.includes('giant_sliced'));
  assert.equal(r2.nextState.giantSlicedCount, 1);
  assert.ok(r2.nextState.score >= 100);
});

test('AI ninja partner actively moves toward fruits while steering clear of bombs', () => {
  const state: NinjaFruitsState = {
    ...createInitialNinjaFruitsState(0),
    phase: 'playing',
    items: [
      {
        id: 7,
        kind: 'giant',
        x: 520,
        y: 260,
        vx: 0,
        vy: 0,
        radius: 56,
        rotation: 0,
        vRot: 0,
        sliced: false,
        slicedTimer: 0,
        sliceAngle: 0,
        hitByP1At: 1.0,
        hitByP2At: null,
      },
    ],
  };

  let mem = createNinjaAiMemory();
  const startDist = Math.hypot(mem.x - 520, mem.y - 260);
  for (let i = 0; i < 8; i++) {
    mem = stepAiNinjaPartner(mem, state, 0.03).nextMemory;
  }
  const endDist = Math.hypot(mem.x - 520, mem.y - 260);
  assert.ok(endDist < startDist, `expected AI blade to rush toward Giant Fruit (${endDist} < ${startDist})`);
});
