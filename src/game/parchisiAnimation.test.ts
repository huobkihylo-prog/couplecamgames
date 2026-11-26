import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boardPointToGpuTranslatePct,
  computeNextDieRotation,
  computePreRollDieRotation,
  getDieFaceAngle,
  normalizeDeg,
  sampleKnockbackFrame,
  samplePawnPathFrame,
} from './parchisiAnimation';
import { PARCHISI_VIEWBOX } from './parchisiBoard';

test('computeNextDieRotation always lands squarely on exact face angle 1..6 with >= 2 full spins', () => {
  let rotA = getDieFaceAngle(5);
  let rotB = getDieFaceAngle(6);

  for (let seq = 1; seq <= 12; seq++) {
    const faceA = ((seq * 2) % 6) + 1;
    const faceB = ((seq * 5 + 1) % 6) + 1;

    const nextA = computeNextDieRotation(rotA, faceA, 'a', seq);
    const nextB = computeNextDieRotation(rotB, faceB, 'b', seq);

    const expectedA = getDieFaceAngle(faceA);
    const expectedB = getDieFaceAngle(faceB);

    // Exact modular landing angle matches target face
    assert.equal(normalizeDeg(nextA.x), normalizeDeg(expectedA.x));
    assert.equal(normalizeDeg(nextA.y), normalizeDeg(expectedA.y));
    assert.equal(normalizeDeg(nextB.x), normalizeDeg(expectedB.x));
    assert.equal(normalizeDeg(nextB.y), normalizeDeg(expectedB.y));

    // Guarantees smooth visible spin travel (never 0-degree jump)
    assert.ok(Math.abs(nextA.x - rotA.x) >= 720);
    assert.ok(Math.abs(nextA.y - rotA.y) >= 360);
    assert.ok(Math.abs(nextB.x - rotB.x) >= 720);
    assert.ok(Math.abs(nextB.y - rotB.y) >= 360);

    rotA = nextA;
    rotB = nextB;
  }
});

test('computePreRollDieRotation aligns modulo 360 with target face', () => {
  for (let face = 1; face <= 6; face++) {
    const target = getDieFaceAngle(face);
    const preA = computePreRollDieRotation(face, 'a');
    const preB = computePreRollDieRotation(face, 'b');
    assert.equal(normalizeDeg(preA.x), normalizeDeg(target.x));
    assert.equal(normalizeDeg(preA.y), normalizeDeg(target.y));
    assert.equal(normalizeDeg(preB.x), normalizeDeg(target.x));
    assert.equal(normalizeDeg(preB.y), normalizeDeg(target.y));
  }
});

test('boardPointToGpuTranslatePct maps center of 780x780 board to exact 450% translate', () => {
  const center = boardPointToGpuTranslatePct(PARCHISI_VIEWBOX / 2, PARCHISI_VIEWBOX / 2);
  assert.equal(center.txPct, 450);
  assert.equal(center.tyPct, 450);

  const origin = boardPointToGpuTranslatePct(0, 0);
  assert.equal(origin.txPct, -50);
  assert.equal(origin.tyPct, -50);
});

test('samplePawnPathFrame moves smoothly step-by-step with visible bounce arc and zero teleport', () => {
  const waypoints = [
    { x: 100, y: 400 },
    { x: 130, y: 400 },
    { x: 160, y: 400 },
    { x: 190, y: 400 },
  ];

  // Frame 0 starts strictly at waypoint 0
  const f0 = samplePawnPathFrame(waypoints, 0, 120, false);
  assert.equal(f0.x, 100);
  assert.equal(f0.y, 400);
  assert.equal(f0.stepIndex, 0);
  assert.equal(f0.finished, false);

  // Midpoint of step 0 has visible upward hop lift and intermediate x
  const mid0 = samplePawnPathFrame(waypoints, 60, 120, false);
  assert.ok(mid0.x > 105 && mid0.x < 128);
  assert.ok(mid0.hopLiftSvg < -10);
  assert.ok(mid0.y < 390);
  assert.equal(mid0.stepIndex, 0);

  // Midpoint of step 2 is strictly between waypoint 2 and waypoint 3
  const mid2 = samplePawnPathFrame(waypoints, 300, 120, false);
  assert.ok(mid2.x > 165 && mid2.x < 188);
  assert.equal(mid2.stepIndex, 2);
  assert.equal(mid2.finished, false);

  // End frame lands squarely on final waypoint with zero lift
  const end = samplePawnPathFrame(waypoints, 360, 120, false);
  assert.equal(end.x, 190);
  assert.equal(end.y, 400);
  assert.equal(end.hopLiftSvg, 0);
  assert.equal(end.finished, true);
});

test('sampleKnockbackFrame arcs smoothly from capture tile back to corner base slot', () => {
  const from = { x: 450, y: 400 };
  const base = { x: 644, y: 76 };

  const start = sampleKnockbackFrame(from, base, 0, 520);
  assert.equal(start.x, 450);
  assert.equal(start.y, 400);
  assert.equal(start.finished, false);

  const mid = sampleKnockbackFrame(from, base, 260, 520);
  assert.ok(mid.x > from.x && mid.x < base.x);
  assert.ok(mid.scale > 1.15);
  assert.ok(mid.rotationDeg < -180);
  assert.equal(mid.finished, false);

  const end = sampleKnockbackFrame(from, base, 520, 520);
  assert.equal(end.x, base.x);
  assert.equal(end.y, base.y);
  assert.equal(end.scale, 1);
  assert.equal(end.finished, true);
});
