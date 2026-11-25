import test from 'node:test';
import assert from 'node:assert/strict';
import { computeUniformCanvasFit, mapClientPointToLogical } from './canvasViewport';

test('computeUniformCanvasFit preserves 1:1 aspect ratio on desktop 16:9 canvas', () => {
  const fit = computeUniformCanvasFit(1000, 560, 1000, 560, 0.62, 2);
  assert.equal(fit.scale, 1);
  assert.equal(fit.offsetX, 0);
  assert.equal(fit.offsetY, 0);
  assert.equal(fit.pixelW, 2000);
  assert.equal(fit.pixelH, 1120);
});

test('computeUniformCanvasFit fits landscape arena uniformly inside square mobile canvas', () => {
  const fit = computeUniformCanvasFit(360, 360, 1000, 560, 0.62, 2);
  assert.ok(Math.abs(fit.scale - 0.36) < 1e-6);
  assert.ok(Math.abs(fit.offsetX) < 1e-6);
  // Active height is 560 * 0.36 = 201.6, leftover is 158.4 -> offsetY = 158.4 * 0.62 = 98.208
  assert.ok(Math.abs(fit.offsetY - 98.208) < 1e-3);
});

test('mapClientPointToLogical round-trips logical corners accurately on mobile canvas', () => {
  const rect = { left: 10, top: 70, width: 360, height: 360 };
  const fit = computeUniformCanvasFit(rect.width, rect.height, 1000, 560, 0.62, 1);

  const topLeft = mapClientPointToLogical(
    rect.left + fit.offsetX,
    rect.top + fit.offsetY,
    rect,
    1000,
    560,
    0.62,
  );
  assert.ok(Math.abs(topLeft.x) < 1e-6);
  assert.ok(Math.abs(topLeft.y) < 1e-6);

  const center = mapClientPointToLogical(
    rect.left + fit.offsetX + 500 * fit.scale,
    rect.top + fit.offsetY + 280 * fit.scale,
    rect,
    1000,
    560,
    0.62,
  );
  assert.ok(Math.abs(center.x - 500) < 1e-6);
  assert.ok(Math.abs(center.y - 280) < 1e-6);
});
