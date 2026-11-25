import test from 'node:test';
import assert from 'node:assert/strict';
import { computePinchHysteresis } from '../services/handTracker';
import {
  BOMB_STUN_SEC,
  clampPullVector,
  computeLaunchVelocity,
  createAiSlingshotMemory,
  createInitialSlingshotState,
  fireSlingshot,
  GUEST_ANCHOR,
  HOST_ANCHOR,
  MAX_PULL_PX,
  predictTrajectory,
  RELOAD_SEC,
  SLING_W,
  startSlingshotMatch,
  stepAiSlingshotPartner,
  stepSlingshotGame,
  TRICK_SHOT_BONUS,
} from './slingshotLogic';

test('pinch hysteresis engages below 0.38 and releases only above 0.55', () => {
  assert.equal(computePinchHysteresis(false, 0.42), false);
  assert.equal(computePinchHysteresis(false, 0.37), true);
  // Stays pinched in deadband [0.38..0.55]
  assert.equal(computePinchHysteresis(true, 0.48), true);
  assert.equal(computePinchHysteresis(true, 0.55), true);
  // Releases above 0.55
  assert.equal(computePinchHysteresis(true, 0.56), false);
});

test('pull clamping caps at 140px and cancels release under 20px', () => {
  const clamped = clampPullVector(-300, 400);
  assert.ok(Math.abs(Math.hypot(clamped.pullX, clamped.pullY) - MAX_PULL_PX) < 0.01);

  assert.equal(computeLaunchVelocity(10, 10), null); // ~14.1px < 20px
  const valid = computeLaunchVelocity(-60, 80);
  assert.ok(valid !== null);
  assert.ok(valid.vx > 0 && valid.vy < 0);
});

test('predictTrajectory returns parabolic points and supports wall ricochet preview', () => {
  const pts = predictTrajectory(HOST_ANCHOR.x, HOST_ANCHOR.y, -90, 90, 20, 0.05);
  assert.ok(pts.length > 5);
  // Initial upward motion
  assert.ok(pts[0].y < HOST_ANCHOR.y + 90);
});

test('firing respects 0.4s reload cooldown', () => {
  let state = startSlingshotMatch('coop', 0, () => 0.5);
  state = fireSlingshot(state, 'host', 420, -600);
  assert.equal(state.projectiles.length, 1);
  assert.equal(state.hostReloadSec, RELOAD_SEC);

  // Immediate second shot ignored
  const blocked = fireSlingshot(state, 'host', 420, -600);
  assert.equal(blocked.projectiles.length, 1);
});

test('wall ricochet triggers TRICK SHOT +50 bonus on target hit', () => {
  let state = startSlingshotMatch('duel', 0, () => 0.5);
  state = {
    ...state,
    targets: [
      {
        id: 99,
        kind: 'classic-cyan',
        x: 70,
        y: 220,
        vx: 0,
        vy: 0,
        baseY: 220,
        bobPhase: 0,
        radius: 26,
        points: 20,
        hitByHost: false,
        hitByGuest: false,
        fusionGlowSec: 0,
        alive: true,
      },
    ],
    projectiles: [
      {
        id: 1,
        owner: 'host',
        x: 22,
        y: 220,
        vx: -480,
        vy: 0,
        radius: 14,
        bounces: 0,
        maxBounces: 2,
        alive: true,
        trail: [],
      },
    ],
  };

  let hitTrick = false;
  for (let i = 0; i < 20; i++) {
    const res = stepSlingshotGame(state, 0.025, () => 0.5);
    state = res.state;
    if (res.events.some((e) => e.kind === 'trickshot')) {
      hitTrick = true;
      break;
    }
  }
  assert.equal(hitTrick, true);
  assert.equal(state.hostScore, 20 + TRICK_SHOT_BONUS);
  assert.equal(state.trickShots, 1);
});

test('Golden Fusion target explodes for +150 pts only when BOTH host and guest hit it', () => {
  let state = startSlingshotMatch('coop', 0, () => 0.5);
  state = {
    ...state,
    targets: [
      {
        id: 10,
        kind: 'fusion',
        x: 500,
        y: 200,
        vx: 0,
        vy: 0,
        baseY: 200,
        bobPhase: 0,
        radius: 34,
        points: 150,
        hitByHost: false,
        hitByGuest: false,
        fusionGlowSec: 0,
        alive: true,
      },
    ],
    projectiles: [
      {
        id: 1,
        owner: 'host',
        x: 475,
        y: 200,
        vx: 500,
        vy: 0,
        radius: 14,
        bounces: 0,
        maxBounces: 2,
        alive: true,
        trail: [],
      },
    ],
  };

  const r1 = stepSlingshotGame(state, 0.03, () => 0.5);
  state = r1.state;
  assert.equal(r1.events.some((e) => e.kind === 'fusion-mark'), true);
  const fusionTarget = state.targets.find((t) => t.id === 10);
  assert.ok(fusionTarget?.alive && fusionTarget.hitByHost && !fusionTarget.hitByGuest);

  // Now guest strikes it!
  state = {
    ...state,
    projectiles: [
      {
        id: 2,
        owner: 'guest',
        x: 525,
        y: 200,
        vx: -500,
        vy: 0,
        radius: 14,
        bounces: 0,
        maxBounces: 2,
        alive: true,
        trail: [],
      },
    ],
  };
  const r2 = stepSlingshotGame(state, 0.03, () => 0.5);
  state = r2.state;
  assert.equal(r2.events.some((e) => e.kind === 'fusion-boom'), true);
  assert.equal(state.fusionCount, 1);
  assert.equal(state.coopScore, 15 + 150);
});

test('Explosive orange orb chain-destroys neighbors and Red Bomb stuns player for 1.5s (-30 pts)', () => {
  let state = startSlingshotMatch('duel', 0, () => 0.5);
  state = {
    ...state,
    hostScore: 50,
    targets: [
      {
        id: 20,
        kind: 'explosive',
        x: 400,
        y: 200,
        vx: 0,
        vy: 0,
        baseY: 200,
        bobPhase: 0,
        radius: 26,
        points: 40,
        hitByHost: false,
        hitByGuest: false,
        fusionGlowSec: 0,
        alive: true,
      },
      {
        id: 21,
        kind: 'classic-violet',
        x: 460,
        y: 200,
        vx: 0,
        vy: 0,
        baseY: 200,
        bobPhase: 0,
        radius: 20,
        points: 30,
        hitByHost: false,
        hitByGuest: false,
        fusionGlowSec: 0,
        alive: true,
      },
      {
        id: 22,
        kind: 'bomb',
        x: 700,
        y: 240,
        vx: 0,
        vy: 0,
        baseY: 240,
        bobPhase: 0,
        radius: 25,
        points: -30,
        hitByHost: false,
        hitByGuest: false,
        fusionGlowSec: 0,
        alive: true,
      },
    ],
    projectiles: [
      {
        id: 1,
        owner: 'host',
        x: 380,
        y: 200,
        vx: 500,
        vy: 0,
        radius: 14,
        bounces: 0,
        maxBounces: 2,
        alive: true,
        trail: [],
      },
    ],
  };

  const res = stepSlingshotGame(state, 0.03, () => 0.5);
  assert.equal(res.events.some((e) => e.kind === 'explosive'), true);
  // Explosive (+40) + neighbor (+30) added to starting 50
  assert.equal(res.state.hostScore, 120);
  assert.equal(res.state.targets.some((t) => t.id === 21), false);

  // Now hit red bomb
  const bombState: typeof state = {
    ...res.state,
    hitstopSec: 0,
    projectiles: [
      {
        id: 2,
        owner: 'host',
        x: 685,
        y: 240,
        vx: 500,
        vy: 0,
        radius: 14,
        bounces: 0,
        maxBounces: 2,
        alive: true,
        trail: [],
      },
    ],
  };
  const bombRes = stepSlingshotGame(bombState, 0.03, () => 0.5);
  assert.equal(bombRes.events.some((e) => e.kind === 'bomb'), true);
  assert.equal(bombRes.state.hostScore, 90);
  assert.equal(bombRes.state.hostStunSec, BOMB_STUN_SEC);
});

test('Solo AI partner smoothly aims and fires from right slingshot', () => {
  const state = startSlingshotMatch('coop', 0, () => 0.4);
  let mem = createAiSlingshotMemory();
  let fired = false;
  let sawPull = false;

  for (let i = 0; i < 80; i++) {
    const step = stepAiSlingshotPartner(mem, state, 0.05, () => 0.4);
    mem = step.memory;
    if (step.pull.isPulling && Math.hypot(step.pull.pullX, step.pull.pullY) > 5) {
      sawPull = true;
    }
    if (step.fire) {
      fired = true;
      assert.ok(step.fire.vx < 0, 'AI fires leftward into the arena');
      assert.ok(step.fire.vy < 0, 'AI fires upward toward targets');
      break;
    }
  }
  assert.equal(sawPull, true);
  assert.equal(fired, true);
  assert.ok(GUEST_ANCHOR.x > SLING_W * 0.5);
  assert.equal(createInitialSlingshotState('coop').phase, 'ready');
});
