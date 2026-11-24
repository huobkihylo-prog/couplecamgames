import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialMiamManiaState,
  MIAM_BONUS_POINTS,
  stepMiamManiaPhysics,
} from './miamManiaPhysics';

test('open mouth catches bonus food for +10 points while closed mouth lets it pass', () => {
  const base = {
    ...createInitialMiamManiaState('duel'),
    phase: 'playing' as const,
    spawnTimerSec: 5,
    items: [
      {
        id: 1,
        kind: 'strawberry' as const,
        isTrap: false,
        x: 480,
        y: 410,
        vx: 0,
        vy: 100,
        radius: 30,
        rotation: 0,
        vRot: 0,
      },
    ],
  };

  const closedRes = stepMiamManiaPhysics(base, 480, 420, false, 0.03);
  assert.equal(closedRes.nextState.score, 0);
  assert.equal(closedRes.nextState.items.length, 1);

  const openRes = stepMiamManiaPhysics(base, 480, 420, true, 0.03);
  assert.equal(openRes.nextState.score, MIAM_BONUS_POINTS);
  assert.equal(openRes.nextState.items.length, 0);
  assert.ok(openRes.events.includes('bonus_caught'));
});

test('keeping mouth closed safely avoids chili/sock traps while eating a trap costs 1 life', () => {
  const base = {
    ...createInitialMiamManiaState('coop'),
    phase: 'playing' as const,
    spawnTimerSec: 5,
    lives: 1,
    items: [
      {
        id: 2,
        kind: 'chili' as const,
        isTrap: true,
        x: 480,
        y: 415,
        vx: 0,
        vy: 100,
        radius: 28,
        rotation: 0,
        vRot: 0,
      },
    ],
  };

  // Closed mouth stays completely safe
  const safeRes = stepMiamManiaPhysics(base, 480, 420, false, 0.03);
  assert.equal(safeRes.nextState.lives, 1);
  assert.equal(safeRes.nextState.phase, 'playing');

  // Open mouth eats chili -> -1 life -> gameover
  const trapRes = stepMiamManiaPhysics(base, 480, 420, true, 0.03);
  assert.equal(trapRes.nextState.lives, 0);
  assert.equal(trapRes.nextState.phase, 'gameover');
  assert.ok(trapRes.events.includes('trap_eaten'));
  assert.ok(trapRes.events.includes('gameover'));
});
