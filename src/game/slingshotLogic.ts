import type {
  SlingshotDuoState,
  SlingshotMode,
  SlingshotProjectile,
  SlingshotTarget,
  SlingshotTargetKind,
} from '../types/duoplay';

export const SLING_W = 1000;
export const SLING_H = 560;

export const HOST_ANCHOR = { x: 165, y: 455 } as const;
export const GUEST_ANCHOR = { x: 835, y: 455 } as const;

export const GRAB_RADIUS_PX = 95;
export const MAX_PULL_PX = 140;
export const MIN_FIRE_PULL_PX = 20;
export const RELOAD_SEC = 0.4;
export const BOMB_STUN_SEC = 1.5;
export const MATCH_DURATION_SEC = 90;

export const SLING_GRAVITY = 720;
export const LAUNCH_SPEED_SCALE = 7.6;
export const MAX_BOUNCES = 2;
export const TRICK_SHOT_BONUS = 50;
export const EXPLOSIVE_BLAST_RADIUS = 155;
export const PROJECTILE_RADIUS = 14;

export interface SlingshotSimEvent {
  kind:
    | 'ricochet'
    | 'pop'
    | 'trickshot'
    | 'fusion-mark'
    | 'fusion-boom'
    | 'explosive'
    | 'heart'
    | 'bomb'
    | 'gameover';
  x: number;
  y: number;
  color: string;
  owner?: 'host' | 'guest';
  points?: number;
  label?: string;
}

export interface SlingshotStepResult {
  state: SlingshotDuoState;
  events: SlingshotSimEvent[];
}

export function getSlingshotAnchor(owner: 'host' | 'guest'): { x: number; y: number } {
  return owner === 'host' ? HOST_ANCHOR : GUEST_ANCHOR;
}

export function canGrabSlingshot(cursorX: number, cursorY: number, owner: 'host' | 'guest'): boolean {
  const anchor = getSlingshotAnchor(owner);
  return Math.hypot(cursorX - anchor.x, cursorY - anchor.y) <= GRAB_RADIUS_PX;
}

export function clampPullVector(dx: number, dy: number): { pullX: number; pullY: number; dist: number } {
  const dist = Math.hypot(dx, dy);
  if (dist <= 0.0001) return { pullX: 0, pullY: 0, dist: 0 };
  if (dist <= MAX_PULL_PX) return { pullX: dx, pullY: dy, dist };
  const ratio = MAX_PULL_PX / dist;
  return { pullX: dx * ratio, pullY: dy * ratio, dist: MAX_PULL_PX };
}

export function computeLaunchVelocity(
  pullX: number,
  pullY: number,
): { vx: number; vy: number; powerRatio: number } | null {
  const clamped = clampPullVector(pullX, pullY);
  if (clamped.dist < MIN_FIRE_PULL_PX) return null;
  return {
    vx: -clamped.pullX * LAUNCH_SPEED_SCALE,
    vy: -clamped.pullY * LAUNCH_SPEED_SCALE,
    powerRatio: clamped.dist / MAX_PULL_PX,
  };
}

/**
 * Predicts parabolic flight points (including up to 2 wall ricochets)
 * for the dotted neon aiming arc.
 */
export function predictTrajectory(
  anchorX: number,
  anchorY: number,
  pullX: number,
  pullY: number,
  steps = 26,
  dtStep = 0.052,
): { x: number; y: number }[] {
  const launch = computeLaunchVelocity(pullX, pullY);
  if (!launch) return [];

  let x = anchorX + pullX;
  let y = anchorY + pullY;
  let vx = launch.vx;
  let vy = launch.vy;
  let bounces = 0;

  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < steps; i++) {
    x += vx * dtStep;
    y += vy * dtStep;
    vy += SLING_GRAVITY * dtStep;

    if (x < PROJECTILE_RADIUS) {
      if (bounces < MAX_BOUNCES) {
        x = PROJECTILE_RADIUS;
        vx = Math.abs(vx) * 0.92;
        bounces++;
      } else {
        break;
      }
    } else if (x > SLING_W - PROJECTILE_RADIUS) {
      if (bounces < MAX_BOUNCES) {
        x = SLING_W - PROJECTILE_RADIUS;
        vx = -Math.abs(vx) * 0.92;
        bounces++;
      } else {
        break;
      }
    }

    if (y < PROJECTILE_RADIUS) {
      if (bounces < MAX_BOUNCES) {
        y = PROJECTILE_RADIUS;
        vy = Math.abs(vy) * 0.9;
        bounces++;
      } else {
        break;
      }
    }

    if (y > SLING_H + 30) break;
    points.push({ x, y });
  }
  return points;
}

function makeTarget(
  id: number,
  kind: SlingshotTargetKind,
  x: number,
  y: number,
  vx: number,
  rng: () => number,
): SlingshotTarget {
  const bobPhase = rng() * Math.PI * 2;
  if (kind === 'fusion') {
    return {
      id,
      kind,
      x,
      y,
      vx: vx * 0.35,
      vy: 0,
      baseY: y,
      bobPhase,
      radius: 34,
      points: 150,
      hitByHost: false,
      hitByGuest: false,
      fusionGlowSec: 0,
      alive: true,
    };
  }
  if (kind === 'explosive') {
    return {
      id,
      kind,
      x,
      y,
      vx,
      vy: 0,
      baseY: y,
      bobPhase,
      radius: 26,
      points: 40,
      hitByHost: false,
      hitByGuest: false,
      fusionGlowSec: 0,
      alive: true,
    };
  }
  if (kind === 'heart') {
    return {
      id,
      kind,
      x,
      y,
      vx: vx * 1.1,
      vy: 0,
      baseY: y,
      bobPhase,
      radius: 25,
      points: 80,
      hitByHost: false,
      hitByGuest: false,
      fusionGlowSec: 0,
      alive: true,
    };
  }
  if (kind === 'bomb') {
    return {
      id,
      kind,
      x,
      y,
      vx: vx * 0.85,
      vy: 0,
      baseY: y,
      bobPhase,
      radius: 25,
      points: -30,
      hitByHost: false,
      hitByGuest: false,
      fusionGlowSec: 0,
      alive: true,
    };
  }
  // Classic neon orbs (+10, +20, +30 depending on size)
  const tier = kind === 'classic-violet' ? 30 : kind === 'classic-cyan' ? 20 : 10;
  const radius = tier === 30 ? 20 : tier === 20 ? 24 : 28;
  return {
    id,
    kind,
    x,
    y,
    vx,
    vy: 0,
    baseY: y,
    bobPhase,
    radius,
    points: tier,
    hitByHost: false,
    hitByGuest: false,
    fusionGlowSec: 0,
    alive: true,
  };
}

function createInitialTargets(rng: () => number): { targets: SlingshotTarget[]; nextId: number } {
  let nextId = 1;
  const targets: SlingshotTarget[] = [
    // Centerpiece Golden Fusion Target
    makeTarget(nextId++, 'fusion', SLING_W * 0.5, 165, 22, rng),
    // Classic neon orbs arranged around the upper arena
    makeTarget(nextId++, 'classic-pink', 270, 145, 38, rng),
    makeTarget(nextId++, 'classic-cyan', 730, 150, -38, rng),
    makeTarget(nextId++, 'classic-violet', 370, 235, 48, rng),
    makeTarget(nextId++, 'classic-violet', 630, 235, -48, rng),
    makeTarget(nextId++, 'classic-pink', 500, 92, 34, rng),
    // Explosive orange orb & Heart bonus
    makeTarget(nextId++, 'explosive', 415, 125, 30, rng),
    makeTarget(nextId++, 'heart', 595, 118, -32, rng),
    // One spiked red bomb patrolling lower-middle lane
    makeTarget(nextId++, 'bomb', 500, 295, 52, rng),
  ];
  return { targets, nextId };
}

export function createInitialSlingshotState(
  mode: SlingshotMode = 'coop',
  bestScore = 0,
  rng: () => number = Math.random,
): SlingshotDuoState {
  const { targets, nextId } = createInitialTargets(rng);
  return {
    phase: 'ready',
    mode,
    durationSec: MATCH_DURATION_SEC,
    timeLeftSec: MATCH_DURATION_SEC,
    elapsedSec: 0,
    hostScore: 0,
    guestScore: 0,
    coopScore: 0,
    bestScore,
    hostReloadSec: 0,
    guestReloadSec: 0,
    hostStunSec: 0,
    guestStunSec: 0,
    hostPull: { isPulling: false, pullX: 0, pullY: 0 },
    guestPull: { isPulling: false, pullX: 0, pullY: 0 },
    projectiles: [],
    targets,
    nextId,
    spawnTimerSec: 1.6,
    fusionRespawnSec: 0,
    trickShots: 0,
    fusionCount: 0,
    hitstopSec: 0,
    trauma: 0,
    flashKind: 'none',
    flashTimerSec: 0,
    lastCallout: '',
    calloutTimerSec: 0,
  };
}

export function startSlingshotMatch(
  mode: SlingshotMode,
  bestScore: number,
  rng: () => number = Math.random,
): SlingshotDuoState {
  const fresh = createInitialSlingshotState(mode, bestScore, rng);
  return { ...fresh, phase: 'playing' };
}

export function fireSlingshot(
  state: SlingshotDuoState,
  owner: 'host' | 'guest',
  vx: number,
  vy: number,
  startX?: number,
  startY?: number,
): SlingshotDuoState {
  if (state.phase !== 'playing') return state;
  const reload = owner === 'host' ? state.hostReloadSec : state.guestReloadSec;
  const stun = owner === 'host' ? state.hostStunSec : state.guestStunSec;
  if (reload > 0 || stun > 0) return state;

  const anchor = getSlingshotAnchor(owner);
  const speed = Math.hypot(vx, vy);
  if (speed < MIN_FIRE_PULL_PX * LAUNCH_SPEED_SCALE * 0.8) return state;

  // Cap velocity to prevent impossible speeds from malformed peer packets
  const maxSpeed = MAX_PULL_PX * LAUNCH_SPEED_SCALE * 1.15;
  const scale = speed > maxSpeed ? maxSpeed / speed : 1;

  const proj: SlingshotProjectile = {
    id: state.nextId,
    owner,
    x: startX ?? anchor.x,
    y: startY ?? anchor.y,
    vx: vx * scale,
    vy: vy * scale,
    radius: PROJECTILE_RADIUS,
    bounces: 0,
    maxBounces: MAX_BOUNCES,
    alive: true,
    trail: [{ x: startX ?? anchor.x, y: startY ?? anchor.y }],
  };

  return {
    ...state,
    nextId: state.nextId + 1,
    hostReloadSec: owner === 'host' ? RELOAD_SEC : state.hostReloadSec,
    guestReloadSec: owner === 'guest' ? RELOAD_SEC : state.guestReloadSec,
    hostPull: owner === 'host' ? { isPulling: false, pullX: 0, pullY: 0 } : state.hostPull,
    guestPull: owner === 'guest' ? { isPulling: false, pullX: 0, pullY: 0 } : state.guestPull,
    projectiles: [...state.projectiles, proj],
  };
}

function awardPoints(
  state: SlingshotDuoState,
  owner: 'host' | 'guest',
  delta: number,
): { hostScore: number; guestScore: number; coopScore: number; bestScore: number } {
  const hostScore = owner === 'host' ? Math.max(0, state.hostScore + delta) : state.hostScore;
  const guestScore = owner === 'guest' ? Math.max(0, state.guestScore + delta) : state.guestScore;
  const coopScore = Math.max(0, state.coopScore + delta);
  const activeBest = state.mode === 'coop' ? coopScore : Math.max(hostScore, guestScore);
  const bestScore = Math.max(state.bestScore, activeBest);
  return { hostScore, guestScore, coopScore, bestScore };
}

function spawnTargetByWeights(
  nextId: number,
  elapsedSec: number,
  hasFusion: boolean,
  bombCount: number,
  rng: () => number,
): SlingshotTarget {
  const roll = rng();
  let kind: SlingshotTargetKind;
  if (!hasFusion && roll < 0.14) {
    kind = 'fusion';
  } else if (bombCount < 2 && roll < (elapsedSec > 20 ? 0.28 : 0.2)) {
    kind = 'bomb';
  } else if (roll < 0.4) {
    kind = 'explosive';
  } else if (roll < 0.54) {
    kind = 'heart';
  } else if (roll < 0.7) {
    kind = 'classic-violet';
  } else if (roll < 0.85) {
    kind = 'classic-cyan';
  } else {
    kind = 'classic-pink';
  }

  const x = kind === 'fusion' ? 420 + rng() * 160 : 190 + rng() * 620;
  const y = kind === 'bomb' ? 235 + rng() * 85 : 85 + rng() * 195;
  const speedBase = 30 + Math.min(45, elapsedSec * 0.45) + rng() * 28;
  const dir = rng() < 0.5 ? -1 : 1;
  return makeTarget(nextId, kind, x, y, speedBase * dir, rng);
}

export function stepSlingshotGame(
  prev: SlingshotDuoState,
  rawDt: number,
  rng: () => number = Math.random,
): SlingshotStepResult {
  const dt = Math.min(0.05, Math.max(0.001, rawDt));
  const events: SlingshotSimEvent[] = [];

  if (prev.phase !== 'playing') {
    // Gentle idle bob on title/ready screen
    if (prev.phase === 'ready') {
      const elapsedSec = prev.elapsedSec + dt;
      const targets = prev.targets.map((t) => ({
        ...t,
        y: t.baseY + Math.sin(elapsedSec * 1.9 + t.bobPhase) * 10,
      }));
      return { state: { ...prev, elapsedSec, targets }, events };
    }
    return { state: prev, events };
  }

  const trauma = Math.max(0, prev.trauma - dt * 2.1);
  const flashTimerSec = Math.max(0, prev.flashTimerSec - dt);
  const flashKind = flashTimerSec > 0 ? prev.flashKind : 'none';
  const calloutTimerSec = Math.max(0, prev.calloutTimerSec - dt);
  const lastCallout = calloutTimerSec > 0 ? prev.lastCallout : '';

  if (prev.hitstopSec > 0) {
    return {
      state: {
        ...prev,
        hitstopSec: Math.max(0, prev.hitstopSec - dt),
        trauma,
        flashTimerSec,
        flashKind,
        calloutTimerSec,
        lastCallout,
      },
      events,
    };
  }

  const elapsedSec = prev.elapsedSec + dt;
  const timeLeftSec = Math.max(0, prev.timeLeftSec - dt);
  let hostReloadSec = Math.max(0, prev.hostReloadSec - dt);
  let guestReloadSec = Math.max(0, prev.guestReloadSec - dt);
  let hostStunSec = Math.max(0, prev.hostStunSec - dt);
  let guestStunSec = Math.max(0, prev.guestStunSec - dt);

  let hostScore = prev.hostScore;
  let guestScore = prev.guestScore;
  let coopScore = prev.coopScore;
  let bestScore = prev.bestScore;
  let trickShots = prev.trickShots;
  let fusionCount = prev.fusionCount;
  let hitstopSec = 0;
  let nextTrauma = trauma;
  let nextFlashKind = flashKind;
  let nextFlashTimer = flashTimerSec;
  let nextCallout = lastCallout;
  let nextCalloutTimer = calloutTimerSec;

  // 1. Move targets horizontally with gentle sinusoidal vertical float
  const targets: SlingshotTarget[] = prev.targets.map((t) => {
    let nx = t.x + t.vx * dt;
    let nvx = t.vx;
    const minX = t.kind === 'fusion' ? 320 : 120;
    const maxX = t.kind === 'fusion' ? SLING_W - 320 : SLING_W - 120;
    if (nx < minX) {
      nx = minX;
      nvx = Math.abs(nvx);
    } else if (nx > maxX) {
      nx = maxX;
      nvx = -Math.abs(nvx);
    }
    const bobAmp = t.kind === 'fusion' ? 14 : t.kind === 'heart' ? 18 : 11;
    const ny = t.baseY + Math.sin(elapsedSec * 2.1 + t.bobPhase) * bobAmp;
    return {
      ...t,
      x: nx,
      y: ny,
      vx: nvx,
      fusionGlowSec: Math.max(0, t.fusionGlowSec - dt),
    };
  });

  // 2. Step projectiles, handle wall ricochets (up to 2) & target collisions
  const nextProjectiles: SlingshotProjectile[] = [];

  for (const p of prev.projectiles) {
    if (!p.alive) continue;
    let x = p.x + p.vx * dt;
    let y = p.y + p.vy * dt;
    let vx = p.vx;
    let vy = p.vy + SLING_GRAVITY * dt;
    let bounces = p.bounces;
    let alive = true;
    const ownerColor = p.owner === 'host' ? '#FF4D8D' : '#22D3EE';

    // Left / Right / Top ricochets
    if (x < p.radius) {
      if (bounces < p.maxBounces) {
        x = p.radius;
        vx = Math.abs(vx) * 0.92;
        bounces += 1;
        events.push({ kind: 'ricochet', x, y, color: ownerColor, owner: p.owner });
      } else {
        alive = false;
      }
    } else if (x > SLING_W - p.radius) {
      if (bounces < p.maxBounces) {
        x = SLING_W - p.radius;
        vx = -Math.abs(vx) * 0.92;
        bounces += 1;
        events.push({ kind: 'ricochet', x, y, color: ownerColor, owner: p.owner });
      } else {
        alive = false;
      }
    }

    if (alive && y < p.radius) {
      if (bounces < p.maxBounces) {
        y = p.radius;
        vy = Math.abs(vy) * 0.9;
        bounces += 1;
        events.push({ kind: 'ricochet', x, y, color: ownerColor, owner: p.owner });
      } else {
        alive = false;
      }
    }

    if (y > SLING_H + 55 || x < -60 || x > SLING_W + 60) {
      alive = false;
    }

    // Check collisions with alive targets
    if (alive) {
      for (const target of targets) {
        if (!target.alive) continue;
        const dist = Math.hypot(x - target.x, y - target.y);
        if (dist <= p.radius + target.radius) {
          const isTrickShot = bounces > 0;
          const trickBonus = isTrickShot && target.kind !== 'bomb' ? TRICK_SHOT_BONUS : 0;

          if (target.kind === 'bomb') {
            target.alive = false;
            alive = false;
            const updated = awardPoints(
              { ...prev, hostScore, guestScore, coopScore, bestScore },
              p.owner,
              -30,
            );
            hostScore = updated.hostScore;
            guestScore = updated.guestScore;
            coopScore = updated.coopScore;
            bestScore = updated.bestScore;
            if (p.owner === 'host') {
              hostStunSec = BOMB_STUN_SEC;
            } else {
              guestStunSec = BOMB_STUN_SEC;
            }
            nextTrauma = Math.min(1, nextTrauma + 0.85);
            hitstopSec = Math.max(hitstopSec, 0.06);
            nextFlashKind = 'bomb';
            nextFlashTimer = 0.35;
            nextCallout = '💣 BOMBE ! -30 · Étourdi 1.5s';
            nextCalloutTimer = 1.6;
            events.push({
              kind: 'bomb',
              x: target.x,
              y: target.y,
              color: '#EF4444',
              owner: p.owner,
              points: -30,
              label: '-30 💣',
            });
            break;
          }

          if (target.kind === 'fusion') {
            alive = false;
            if (p.owner === 'host') target.hitByHost = true;
            else target.hitByGuest = true;
            target.fusionGlowSec = 1.2;

            if (target.hitByHost && target.hitByGuest) {
              target.alive = false;
              const pts = target.points + trickBonus;
              const updated = awardPoints(
                { ...prev, hostScore, guestScore, coopScore, bestScore },
                p.owner,
                pts,
              );
              hostScore = updated.hostScore;
              guestScore = updated.guestScore;
              coopScore = updated.coopScore;
              bestScore = updated.bestScore;
              fusionCount += 1;
              if (isTrickShot) trickShots += 1;
              nextTrauma = Math.min(1, nextTrauma + 0.72);
              hitstopSec = Math.max(hitstopSec, 0.065);
              nextFlashKind = 'fusion';
              nextFlashTimer = 0.42;
              nextCallout = isTrickShot
                ? `✨ FUSION + TRICK SHOT ! +${pts}`
                : `✨ FUSION DORÉE ! +${pts}`;
              nextCalloutTimer = 2.0;
              events.push({
                kind: 'fusion-boom',
                x: target.x,
                y: target.y,
                color: '#FACC15',
                owner: p.owner,
                points: pts,
                label: `✨ +${pts}`,
              });
            } else {
              // First player tagged it — award +15 assist pulse and invite partner!
              const tagPts = 15 + trickBonus;
              const updated = awardPoints(
                { ...prev, hostScore, guestScore, coopScore, bestScore },
                p.owner,
                tagPts,
              );
              hostScore = updated.hostScore;
              guestScore = updated.guestScore;
              coopScore = updated.coopScore;
              bestScore = updated.bestScore;
              if (isTrickShot) trickShots += 1;
              nextCallout = isTrickShot
                ? `TRICK SHOT ! +${tagPts} · Fusion 1/2 ✨`
                : '✨ Fusion 1/2 ! À ton partenaire !';
              nextCalloutTimer = 1.6;
              events.push({
                kind: 'fusion-mark',
                x: target.x,
                y: target.y,
                color: '#FDE047',
                owner: p.owner,
                points: tagPts,
                label: '1/2 ✨',
              });
            }
            break;
          }

          if (target.kind === 'explosive') {
            target.alive = false;
            alive = false;
            let chainPts = target.points + trickBonus;
            let chainHits = 0;
            for (const neighbor of targets) {
              if (!neighbor.alive || neighbor.id === target.id) continue;
              const nd = Math.hypot(neighbor.x - target.x, neighbor.y - target.y);
              if (nd <= EXPLOSIVE_BLAST_RADIUS) {
                neighbor.alive = false;
                if (neighbor.kind !== 'bomb') {
                  chainPts += Math.max(10, neighbor.points);
                  chainHits += 1;
                }
              }
            }
            const updated = awardPoints(
              { ...prev, hostScore, guestScore, coopScore, bestScore },
              p.owner,
              chainPts,
            );
            hostScore = updated.hostScore;
            guestScore = updated.guestScore;
            coopScore = updated.coopScore;
            bestScore = updated.bestScore;
            if (isTrickShot) trickShots += 1;
            nextTrauma = Math.min(1, nextTrauma + 0.65);
            hitstopSec = Math.max(hitstopSec, 0.05);
            nextFlashKind = 'explosive';
            nextFlashTimer = 0.28;
            nextCallout = isTrickShot
              ? `💥 TRICK BOOM ! +${chainPts}`
              : chainHits > 0
                ? `💥 EXPLOSION ×${chainHits + 1} ! +${chainPts}`
                : `💥 BOOM ! +${chainPts}`;
            nextCalloutTimer = 1.7;
            events.push({
              kind: 'explosive',
              x: target.x,
              y: target.y,
              color: '#FB923C',
              owner: p.owner,
              points: chainPts,
              label: `💥 +${chainPts}`,
            });
            break;
          }

          if (target.kind === 'heart') {
            target.alive = false;
            alive = false;
            const pts = target.points + trickBonus;
            const updated = awardPoints(
              { ...prev, hostScore, guestScore, coopScore, bestScore },
              p.owner,
              pts,
            );
            hostScore = updated.hostScore;
            guestScore = updated.guestScore;
            coopScore = updated.coopScore;
            bestScore = updated.bestScore;
            if (isTrickShot) trickShots += 1;
            nextFlashKind = 'heart';
            nextFlashTimer = 0.25;
            nextCallout = isTrickShot ? `💖 TRICK SHOT CŒUR ! +${pts}` : `💖 BONUS CŒUR ! +${pts}`;
            nextCalloutTimer = 1.6;
            events.push({
              kind: 'heart',
              x: target.x,
              y: target.y,
              color: '#FB7185',
              owner: p.owner,
              points: pts,
              label: `💖 +${pts}`,
            });
            break;
          }

          // Classic Neon Orb
          target.alive = false;
          alive = false;
          const pts = target.points + trickBonus;
          const updated = awardPoints(
            { ...prev, hostScore, guestScore, coopScore, bestScore },
            p.owner,
            pts,
          );
          hostScore = updated.hostScore;
          guestScore = updated.guestScore;
          coopScore = updated.coopScore;
          bestScore = updated.bestScore;
          if (isTrickShot) {
            trickShots += 1;
            nextCallout = `TRICK SHOT ! +${pts}`;
            nextCalloutTimer = 1.5;
            events.push({
              kind: 'trickshot',
              x: target.x,
              y: target.y,
              color: '#38BDF8',
              owner: p.owner,
              points: pts,
              label: `TRICK +${pts}`,
            });
          } else {
            events.push({
              kind: 'pop',
              x: target.x,
              y: target.y,
              color:
                target.kind === 'classic-pink'
                  ? '#FF4D8D'
                  : target.kind === 'classic-cyan'
                    ? '#22D3EE'
                    : '#A855F7',
              owner: p.owner,
              points: pts,
              label: `+${pts}`,
            });
          }
          break;
        }
      }
    }

    if (alive) {
      const nextTrail = [...p.trail.slice(-11), { x, y }];
      nextProjectiles.push({
        ...p,
        x,
        y,
        vx,
        vy,
        bounces,
        alive,
        trail: nextTrail,
      });
    }
  }

  // 3. Filter dead targets & respawn to keep arena lively (target count 7..10)
  const aliveTargets = targets.filter((t) => t.alive);
  let nextId = prev.nextId;
  let spawnTimerSec = prev.spawnTimerSec - dt;
  const hasFusion = aliveTargets.some((t) => t.kind === 'fusion');
  let fusionRespawnSec = hasFusion ? 0 : prev.fusionRespawnSec + dt;
  const bombCount = aliveTargets.filter((t) => t.kind === 'bomb').length;

  if (!hasFusion && fusionRespawnSec >= 7.5) {
    aliveTargets.push(makeTarget(nextId++, 'fusion', SLING_W * 0.5, 160, (rng() < 0.5 ? -1 : 1) * 24, rng));
    fusionRespawnSec = 0;
  }

  if (aliveTargets.length < 7 || (spawnTimerSec <= 0 && aliveTargets.length < 10)) {
    aliveTargets.push(spawnTargetByWeights(nextId++, elapsedSec, hasFusion, bombCount, rng));
    spawnTimerSec = Math.max(1.15, 2.2 - elapsedSec * 0.008);
  }

  // 4. Match end at 90s
  const phase = timeLeftSec <= 0 ? 'gameover' : 'playing';
  if (phase === 'gameover') {
    events.push({
      kind: 'gameover',
      x: SLING_W * 0.5,
      y: SLING_H * 0.5,
      color: '#FACC15',
    });
  }

  return {
    state: {
      ...prev,
      phase,
      timeLeftSec,
      elapsedSec,
      hostScore,
      guestScore,
      coopScore,
      bestScore,
      hostReloadSec,
      guestReloadSec,
      hostStunSec,
      guestStunSec,
      hostPull: hostStunSec > 0 ? { isPulling: false, pullX: 0, pullY: 0 } : prev.hostPull,
      guestPull: guestStunSec > 0 ? { isPulling: false, pullX: 0, pullY: 0 } : prev.guestPull,
      projectiles: nextProjectiles,
      targets: aliveTargets,
      nextId,
      spawnTimerSec,
      fusionRespawnSec,
      trickShots,
      fusionCount,
      hitstopSec,
      trauma: nextTrauma,
      flashKind: nextFlashKind,
      flashTimerSec: nextFlashTimer,
      lastCallout: nextCallout,
      calloutTimerSec: nextCalloutTimer,
    },
    events,
  };
}

// =========================================================================
// SOLO MODE AI PARTNER (Controls right-side cyan slingshot smoothly)
// =========================================================================
export interface AiSlingshotMemory {
  phase: 'cooldown' | 'aiming';
  timerSec: number;
  aimDurationSec: number;
  targetPullX: number;
  targetPullY: number;
  currentPullX: number;
  currentPullY: number;
}

export function createAiSlingshotMemory(): AiSlingshotMemory {
  return {
    phase: 'cooldown',
    timerSec: 1.1,
    aimDurationSec: 0.9,
    targetPullX: 0,
    targetPullY: 0,
    currentPullX: 0,
    currentPullY: 0,
  };
}

export function stepAiSlingshotPartner(
  mem: AiSlingshotMemory,
  state: SlingshotDuoState,
  dt: number,
  rng: () => number = Math.random,
): {
  memory: AiSlingshotMemory;
  pull: { isPulling: boolean; pullX: number; pullY: number };
  fire: { vx: number; vy: number } | null;
} {
  if (state.phase !== 'playing' || state.guestStunSec > 0) {
    return {
      memory: { ...mem, phase: 'cooldown', timerSec: 0.6, currentPullX: 0, currentPullY: 0 },
      pull: { isPulling: false, pullX: 0, pullY: 0 },
      fire: null,
    };
  }

  if (mem.phase === 'cooldown') {
    const nextTimer = mem.timerSec - dt;
    if (nextTimer > 0 || state.guestReloadSec > 0) {
      return {
        memory: { ...mem, timerSec: Math.max(0, nextTimer), currentPullX: 0, currentPullY: 0 },
        pull: { isPulling: false, pullX: 0, pullY: 0 },
        fire: null,
      };
    }

    // Pick best non-bomb target (strongly prioritize Fusion if Host tagged it!)
    const candidates = state.targets.filter((t) => t.alive && t.kind !== 'bomb');
    const chosen =
      candidates.find((t) => t.kind === 'fusion' && t.hitByHost && !t.hitByGuest) ??
      candidates.find((t) => t.kind === 'heart' || t.kind === 'explosive') ??
      candidates.find((t) => t.kind === 'fusion') ??
      candidates[Math.floor(rng() * Math.max(1, candidates.length))];

    if (!chosen) {
      return {
        memory: { ...mem, timerSec: 0.5 },
        pull: { isPulling: false, pullX: 0, pullY: 0 },
        fire: null,
      };
    }

    // Solve approximate ballistic velocity from GUEST_ANCHOR to predicted target position
    const flightT = 0.62 + rng() * 0.24;
    const predX = Math.max(110, Math.min(SLING_W - 110, chosen.x + chosen.vx * flightT * 0.65));
    const predY = chosen.y + (rng() - 0.5) * 20;

    const reqVx = (predX - GUEST_ANCHOR.x) / flightT;
    const reqVy = (predY - GUEST_ANCHOR.y - 0.5 * SLING_GRAVITY * flightT * flightT) / flightT;

    const clamped = clampPullVector(-reqVx / LAUNCH_SPEED_SCALE, -reqVy / LAUNCH_SPEED_SCALE);
    const aimDur = 0.72 + rng() * 0.35;

    return {
      memory: {
        phase: 'aiming',
        timerSec: 0,
        aimDurationSec: aimDur,
        targetPullX: clamped.pullX,
        targetPullY: clamped.pullY,
        currentPullX: 0,
        currentPullY: 0,
      },
      pull: { isPulling: true, pullX: 0, pullY: 0 },
      fire: null,
    };
  }

  // Smoothly pull back elastic during aiming window
  const nextTimer = mem.timerSec + dt;
  const progress = Math.min(1, nextTimer / Math.max(0.2, mem.aimDurationSec));
  const ease = 1 - Math.pow(1 - progress, 2);
  const curX = mem.targetPullX * ease;
  const curY = mem.targetPullY * ease;

  if (progress >= 1) {
    const launch = computeLaunchVelocity(curX, curY);
    return {
      memory: {
        phase: 'cooldown',
        timerSec: 1.05 + rng() * 0.85,
        aimDurationSec: 0.85,
        targetPullX: 0,
        targetPullY: 0,
        currentPullX: 0,
        currentPullY: 0,
      },
      pull: { isPulling: false, pullX: 0, pullY: 0 },
      fire: launch ? { vx: launch.vx, vy: launch.vy } : null,
    };
  }

  return {
    memory: {
      ...mem,
      timerSec: nextTimer,
      currentPullX: curX,
      currentPullY: curY,
    },
    pull: { isPulling: true, pullX: curX, pullY: curY },
    fire: null,
  };
}
