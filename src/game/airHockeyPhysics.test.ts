import test from 'node:test';
import assert from 'node:assert/strict';
import type { AirHockeyState } from '../types/duoplay';
import {
  createAirHockeyAiMemory,
  createInitialAirHockeyState,
  HOCKEY_H,
  HOCKEY_W,
  mapHandToHalfCoords,
  startAirHockeyMatch,
  stepAiAirHockeyPartner,
  stepAirHockeyPhysics,
  TARGET_GOALS,
} from './airHockeyPhysics';

test('mapHandToHalfCoords confines left and right players to their own rink halves', () => {
  const leftEdge = mapHandToHalfCoords('left', 1, 0.5);
  const rightEdge = mapHandToHalfCoords('right', 0, 0.5);
  assert.ok(leftEdge.x < HOCKEY_W * 0.5, `left paddle must stay left of center, got ${leftEdge.x}`);
  assert.ok(rightEdge.x > HOCKEY_W * 0.5, `right paddle must stay right of center, got ${rightEdge.x}`);
});

test('faster hand movement at impact launches the puck noticeably faster toward partner', () => {
  const base: AirHockeyState = {
    ...startAirHockeyMatch(-1),
    p1X: 260,
    p1Y: 300,
    puckX: 318,
    puckY: 300,
    puckVx: -40,
    puckVy: 0,
  };

  // Slow tap
  const slowRes = stepAirHockeyPhysics(base, { x: 270, y: 300 }, { x: 850, y: 300 }, 0.03);
  const slowSpeed = Math.hypot(slowRes.nextState.puckVx, slowRes.nextState.puckVy);

  // Fast smash
  const fastRes = stepAirHockeyPhysics(base, { x: 340, y: 300 }, { x: 850, y: 300 }, 0.03);
  const fastSpeed = Math.hypot(fastRes.nextState.puckVx, fastRes.nextState.puckVy);

  assert.equal(fastRes.event, 'puck_hit');
  assert.ok(fastRes.nextState.puckVx > 0, 'puck should blast rightward toward partner');
  assert.ok(
    fastSpeed > slowSpeed + 120,
    `expected fast strike (${fastSpeed}) to exceed slow strike (${slowSpeed})`,
  );
});

test('puck bounces off top and bottom walls cleanly', () => {
  const state: AirHockeyState = {
    ...startAirHockeyMatch(1),
    puckX: 500,
    puckY: 22,
    puckVx: 220,
    puckVy: -420,
  };
  const res = stepAirHockeyPhysics(state, { x: 160, y: 300 }, { x: 840, y: 300 }, 0.03);
  assert.equal(res.event, 'wall_bounce');
  assert.ok(res.nextState.puckVy > 0, 'puck should reflect downward off top cushion');
});

test('scoring the 7th goal ends the match and crowns the winner', () => {
  const state: AirHockeyState = {
    ...startAirHockeyMatch(1),
    p1Score: TARGET_GOALS - 1,
    puckX: HOCKEY_W - 2,
    puckY: HOCKEY_H * 0.5,
    puckVx: 600,
    puckVy: 0,
  };

  const res = stepAirHockeyPhysics(state, { x: 160, y: 300 }, { x: 840, y: 120 }, 0.03);
  assert.equal(res.event, 'gameover');
  assert.equal(res.nextState.phase, 'gameover');
  assert.equal(res.nextState.p1Score, TARGET_GOALS);
  assert.equal(res.nextState.winner, 'p1');
});

test('AI partner tracks incoming high puck toward interception line', () => {
  const state: AirHockeyState = {
    ...createInitialAirHockeyState(),
    phase: 'playing',
    puckX: 620,
    puckY: 140,
    puckVx: 480,
    puckVy: 0,
  };

  let mem = createAirHockeyAiMemory();
  const initialY = mem.targetY;
  for (let i = 0; i < 10; i++) {
    mem = stepAiAirHockeyPartner(mem, state, 0.03).nextMemory;
  }
  assert.ok(mem.targetY < initialY - 60, `expected AI paddle to move up toward y=140, got ${mem.targetY}`);
});
