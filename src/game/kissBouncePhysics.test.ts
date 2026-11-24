import test from 'node:test';
import assert from 'node:assert/strict';
import type { KissBounceState } from '../types/duoplay';
import {
  createInitialKissBounceState,
  createKissAiHandState,
  detectKissPucker,
  KISS_ARENA_W,
  receiveRemoteKissHeart,
  stepKissAiHand,
  stepKissBouncePhysics,
} from './kissBouncePhysics';

test('detectKissPucker triggers on mouthPucker threshold or manual kiss', () => {
  assert.equal(detectKissPucker(0.2, false), false);
  assert.equal(detectKissPucker(0.52, false), true);
  assert.equal(detectKissPucker(0.05, true), true);
});

test('blowing a kiss launches a glowing heart toward partner with cooldown', () => {
  const initial: KissBounceState = { ...createInitialKissBounceState(0), phase: 'playing' };
  const { nextState, events } = stepKissBouncePhysics(
    initial,
    {
      localHandX: 0.2,
      localHandY: 0.5,
      localHandActive: false,
      localKissTriggered: true,
      isSolo: false,
      rng: () => 0.5,
    },
    0.016,
  );

  assert.ok(events.launchedByLocal, 'kiss should launch a heart');
  assert.equal(nextState.hearts.length, 1);
  assert.equal(nextState.hearts[0].target, 'partner');
  assert.ok(nextState.localKissCooldownSec > 0.4);
});

test('catching an incoming heart with hand or kiss increments rally, auroraLevel, and pianoStep', () => {
  let state: KissBounceState = { ...createInitialKissBounceState(0), phase: 'playing' };
  state = receiveRemoteKissHeart(state, {
    heartId: 1,
    startY: 280,
    vx: 360,
    vy: -40,
    rally: 1,
    catchKind: 'kiss',
  });
  // Place heart inside local catch zone
  state = {
    ...state,
    hearts: [{ ...state.hearts[0], x: 240, y: 280, target: 'local' }],
  };

  const beforeAurora = state.auroraLevel;
  const beforePiano = state.pianoStep;
  const { nextState, events } = stepKissBouncePhysics(
    state,
    {
      localHandX: 240 / KISS_ARENA_W,
      localHandY: 0.5,
      localHandActive: true,
      localKissTriggered: false,
      isSolo: false,
      rng: () => 0.5,
    },
    0.016,
  );

  assert.ok(events.bouncedByLocal, 'hand should catch and return incoming heart');
  assert.equal(events.bouncedByLocal?.kind, 'hand');
  assert.equal(nextState.rally, 2);
  assert.ok(nextState.auroraLevel > beforeAurora);
  assert.equal(nextState.pianoStep, beforePiano + 1);
  assert.equal(nextState.hearts[0].target, 'partner');
});

test('Solo AI partner tracks and bounces local kiss hearts back across the aurora sky', () => {
  let state: KissBounceState = { ...createInitialKissBounceState(0), phase: 'playing' };
  let aiHand = createKissAiHandState();

  const launch = stepKissBouncePhysics(
    state,
    {
      localHandX: 0.2,
      localHandY: 0.5,
      localHandActive: false,
      localKissTriggered: true,
      isSolo: true,
      rng: () => 0.5,
    },
    0.016,
    aiHand,
  );
  state = launch.nextState;

  let aiBounced = false;
  for (let i = 0; i < 160; i++) {
    aiHand = stepKissAiHand(aiHand, state.hearts, 0.025);
    const step = stepKissBouncePhysics(
      state,
      {
        localHandX: 0.2,
        localHandY: 0.5,
        localHandActive: false,
        localKissTriggered: false,
        isSolo: true,
        rng: () => 0.5,
      },
      0.025,
      aiHand,
    );
    state = step.nextState;
    if (step.events.bouncedByAi) {
      aiBounced = true;
      break;
    }
  }

  assert.equal(aiBounced, true, 'AI partner should catch and bounce back the heart');
  assert.ok(state.rally >= 1);
  assert.equal(state.hearts[0].target, 'local');
});
