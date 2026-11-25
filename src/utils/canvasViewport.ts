/**
 * Uniform DPR-aware viewport fit for logical-coordinate 2D arcade canvases.
 *
 * Ensures circles, hearts, stars, and slingshot targets stay 100% geometrically
 * proportional on both desktop (16:9) and tall mobile screens without oval
 * stretching, while letting the background fill the entire canvas edge-to-edge.
 */

export interface CanvasViewportFit {
  dpr: number;
  pixelW: number;
  pixelH: number;
  cssW: number;
  cssH: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function computeUniformCanvasFit(
  cssW: number,
  cssH: number,
  logicalW: number,
  logicalH: number,
  verticalBias = 0.5,
  dpr = 1,
): CanvasViewportFit {
  const safeW = Math.max(1, cssW);
  const safeH = Math.max(1, cssH);
  const safeDpr = Math.min(2, Math.max(1, Number.isFinite(dpr) ? dpr : 1));
  const scale = Math.min(safeW / logicalW, safeH / logicalH);
  const offsetX = (safeW - logicalW * scale) * 0.5;
  const offsetY = (safeH - logicalH * scale) * verticalBias;
  return {
    dpr: safeDpr,
    pixelW: Math.max(1, Math.round(safeW * safeDpr)),
    pixelH: Math.max(1, Math.round(safeH * safeDpr)),
    cssW: safeW,
    cssH: safeH,
    scale,
    offsetX,
    offsetY,
  };
}

export function mapClientPointToLogical(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  logicalW: number,
  logicalH: number,
  verticalBias = 0.5,
): { x: number; y: number } {
  const fit = computeUniformCanvasFit(rect.width, rect.height, logicalW, logicalH, verticalBias, 1);
  return {
    x: (clientX - rect.left - fit.offsetX) / fit.scale,
    y: (clientY - rect.top - fit.offsetY) / fit.scale,
  };
}
