import { AABB, Point, ViewportTransform } from '../types/canvas';

/**
 * Convert screen pointer coordinates to canvas world coordinates
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  transform: ViewportTransform
): Point {
  return {
    x: (screenX - transform.panX) / transform.zoom,
    y: (screenY - transform.panY) / transform.zoom,
  };
}

/**
 * Convert canvas world coordinates to screen coordinates
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  transform: ViewportTransform
): Point {
  return {
    x: worldX * transform.zoom + transform.panX,
    y: worldY * transform.zoom + transform.panY,
  };
}

/**
 * Calculate Axis-Aligned Bounding Box (AABB) for a stroke
 */
export function calculateStrokeAABB(points: Point[], strokeWidth: number): AABB {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  // Add stroke radius margin
  const margin = strokeWidth / 2 + 4;
  return {
    minX: minX - margin,
    minY: minY - margin,
    maxX: maxX + margin,
    maxY: maxY + margin,
  };
}

/**
 * Minimum distance from point to line segment
 */
export function distanceToSegment(p: Point, v: Point, w: Point): number {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);

  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));

  const projX = v.x + t * (w.x - v.x);
  const projY = v.y + t * (w.y - v.y);

  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Draw a clean 5-pointed star
 */
export function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes = 5,
  outerRadius: number,
  innerRadius: number
) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);

  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }

  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
}

/**
 * Draw an arrow with a crisp vector arrowhead
 */
export function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  headLength = 18
) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);

  // Arrowhead
  ctx.lineTo(
    toX - headLength * Math.cos(angle - Math.PI / 6),
    toY - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle + Math.PI / 6),
    toY - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

/**
 * Exact analytical clipping of a polyline against an eraser circle.
 * Trims stroke segments precisely at the circle perimeter with zero extra erasure.
 */
export function clipStrokeWithCircle(
  points: Point[],
  center: Point,
  radius: number
): { modified: boolean; runs: Point[][] } {
  if (points.length === 0) {
    return { modified: false, runs: [] };
  }

  // Single-dot stroke
  if (points.length === 1) {
    const d = Math.hypot(points[0].x - center.x, points[0].y - center.y);
    if (d <= radius) {
      return { modified: true, runs: [] };
    }
    return { modified: false, runs: [[points[0]]] };
  }

  const survivingRuns: Point[][] = [];
  let currentRun: Point[] = [];
  let wasModified = false;

  for (let i = 0; i < points.length - 1; i++) {
    const A = points[i];
    const B = points[i + 1];

    const Vx = B.x - A.x;
    const Vy = B.y - A.y;
    const Dx = A.x - center.x;
    const Dy = A.y - center.y;

    const a = Vx * Vx + Vy * Vy;
    const b = 2 * (Dx * Vx + Dy * Vy);
    const c = Dx * Dx + Dy * Dy - radius * radius;

    // Collinear / degenerate point segment
    if (a < 1e-6) {
      if (Dx * Dx + Dy * Dy <= radius * radius) {
        wasModified = true;
        if (currentRun.length > 0) {
          survivingRuns.push(currentRun);
          currentRun = [];
        }
      } else {
        if (currentRun.length === 0) currentRun.push(A);
      }
      continue;
    }

    const delta = b * b - 4 * a * c;

    if (delta <= 0) {
      // Ray does not intersect disk interior
      // Check if A is inside
      if (c <= 0) {
        // Entire segment is inside disk
        wasModified = true;
        if (currentRun.length > 0) {
          survivingRuns.push(currentRun);
          currentRun = [];
        }
      } else {
        // Entire segment is outside disk
        if (currentRun.length === 0) currentRun.push(A);
        currentRun.push(B);
      }
    } else {
      // Line intersects circle at t1 and t2
      const sqrtDelta = Math.sqrt(delta);
      const t1 = (-b - sqrtDelta) / (2 * a);
      const t2 = (-b + sqrtDelta) / (2 * a);

      const tIn = Math.max(0, t1);
      const tOut = Math.min(1, t2);

      if (tIn >= tOut) {
        // Intersection is outside the [0, 1] segment interval
        if (currentRun.length === 0) currentRun.push(A);
        currentRun.push(B);
      } else {
        // Segment intersects the eraser circle!
        wasModified = true;

        // Piece before entry into eraser circle
        if (tIn > 0.001) {
          if (currentRun.length === 0) currentRun.push(A);
          const pIn: Point = {
            x: A.x + tIn * Vx,
            y: A.y + tIn * Vy,
            pressure: A.pressure,
          };
          currentRun.push(pIn);
          survivingRuns.push(currentRun);
          currentRun = [];
        } else {
          // A was already inside the circle
          if (currentRun.length > 0) {
            survivingRuns.push(currentRun);
            currentRun = [];
          }
        }

        // Piece after exit from eraser circle
        if (tOut < 0.999) {
          const pOut: Point = {
            x: A.x + tOut * Vx,
            y: A.y + tOut * Vy,
            pressure: B.pressure,
          };
          currentRun = [pOut, B];
        } else {
          // B is inside circle
          currentRun = [];
        }
      }
    }
  }

  if (currentRun.length > 0) {
    survivingRuns.push(currentRun);
  }

  // Ensure any single-point fragment remains a valid micro-segment for smooth rendering
  const normalizedRuns = survivingRuns
    .map((run) => {
      if (run.length === 1) {
        return [run[0], { x: run[0].x + 0.1, y: run[0].y + 0.1, pressure: run[0].pressure }];
      }
      return run;
    })
    .filter((run) => run.length >= 2);

  return {
    modified: wasModified,
    runs: normalizedRuns,
  };
}
