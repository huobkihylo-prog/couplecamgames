import test from 'node:test';
import assert from 'node:assert/strict';
import type { ConstellationState } from '../types/duoplay';
import {
  advanceToNextConstellation,
  CONSTELLATION_PATTERNS,
  createInitialConstellationState,
  getNextTargetStar,
  stepAiConstellationPartner,
  stepConstellationGame,
} from './constellationsLogic';

test('both virtual fingertips touching the active numbered star ignites it in sequence', () => {
  let state: ConstellationState = { ...createInitialConstellationState(), phase: 'playing' };
  const star1 = getNextTargetStar(state);
  assert.ok(star1);
  assert.equal(star1.id, 1);

  // Only one finger on star 1 should not ignite it yet
  for (let i = 0; i < 20; i++) {
    const res = stepConstellationGame(
      state,
      {
        localX: star1.x,
        localY: star1.y,
        localActive: true,
        partnerX: 0.95,
        partnerY: 0.95,
        partnerActive: true,
        promptCount: 6,
      },
      0.04,
    );
    state = res.nextState;
    assert.equal(res.events.activatedStar, null);
  }

  // Now both fingers touch star 1 together
  let ignited = false;
  for (let i = 0; i < 12; i++) {
    const res = stepConstellationGame(
      state,
      {
        localX: star1.x,
        localY: star1.y,
        localActive: true,
        partnerX: star1.x + 0.01,
        partnerY: star1.y - 0.01,
        partnerActive: true,
        promptCount: 6,
      },
      0.03,
    );
    state = res.nextState;
    if (res.events.activatedStar?.id === 1) {
      ignited = true;
      break;
    }
  }

  assert.equal(ignited, true);
  assert.deepEqual(state.activatedStarIds, [1]);
  assert.equal(getNextTargetStar(state)?.id, 2);
});

test('completing every star in a constellation unlocks the revealed intimate prompt state', () => {
  let state: ConstellationState = { ...createInitialConstellationState(), phase: 'playing' };
  const pattern = CONSTELLATION_PATTERNS[0];

  for (const star of pattern.stars) {
    for (let i = 0; i < 15; i++) {
      const res = stepConstellationGame(
        state,
        {
          localX: star.x,
          localY: star.y,
          localActive: true,
          partnerX: star.x,
          partnerY: star.y,
          partnerActive: true,
          promptCount: 6,
        },
        0.03,
      );
      state = res.nextState;
      if (res.events.activatedStar) break;
    }
  }

  assert.equal(state.phase, 'revealed');
  assert.equal(state.completedCount, 1);

  const next = advanceToNextConstellation(state, 6);
  assert.equal(next.phase, 'playing');
  assert.equal(next.constellationIndex, 1);
  assert.equal(next.activatedStarIds.length, 0);
});

test('Solo AI partner cursor smoothly converges onto the active numbered star', () => {
  const state = { ...createInitialConstellationState(), phase: 'playing' as const };
  const target = getNextTargetStar(state)!;
  let ai = { x: 0.9, y: 0.9 };

  for (let i = 0; i < 50; i++) {
    ai = stepAiConstellationPartner(ai, state, 0.04);
  }

  const dist = Math.hypot(ai.x - target.x, ai.y - target.y);
  assert.ok(dist < 0.04, `Expected AI cursor near target star, got dist=${dist}`);
});
