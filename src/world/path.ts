/** Polyline path math — pure, no rendering deps. Enemy routes, street layout. */

export interface PathPoint {
  x: number;
  y: number;
}

export interface PathSample extends PathPoint {
  /** Radians, direction of travel at this point. */
  angle: number;
}

export interface ClosestPoint extends PathPoint {
  distance: number;
}

export class Path {
  readonly points: readonly PathPoint[];
  readonly totalLength: number;
  #cumulative: readonly number[];

  constructor(points: readonly PathPoint[]) {
    if (points.length < 2) throw new RangeError('Path needs at least 2 points');
    this.points = points;
    const cumulative: number[] = [0];
    for (let i = 1; i < points.length; i++) {
      cumulative.push(cumulative[i - 1] + Path.segmentLength(points[i - 1], points[i]));
    }
    this.#cumulative = cumulative;
    this.totalLength = cumulative[cumulative.length - 1];
  }

  static segmentLength(a: PathPoint, b: PathPoint): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  /** Point at `distance` along the path; wraps when `loop` is set, clamps otherwise. */
  pointAt(distance: number, loop = false): PathSample {
    let d = distance;
    if (loop) {
      d = ((d % this.totalLength) + this.totalLength) % this.totalLength;
    } else {
      d = Math.min(Math.max(d, 0), this.totalLength);
    }
    const cum = this.#cumulative;
    let seg = 1;
    while (seg < cum.length - 1 && cum[seg] < d) seg++;
    const a = this.points[seg - 1];
    const b = this.points[seg];
    const segLen = cum[seg] - cum[seg - 1];
    const t = segLen === 0 ? 0 : (d - cum[seg - 1]) / segLen;
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }

  /** Closest point on the path to `p`, with its distance. */
  closestPoint(p: PathPoint): ClosestPoint {
    let best: ClosestPoint = { x: this.points[0].x, y: this.points[0].y, distance: Infinity };
    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i];
      const b = this.points[i + 1];
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const lenSq = abx * abx + aby * aby;
      const t =
        lenSq === 0 ? 0 : Math.min(Math.max(((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq, 0), 1);
      const x = a.x + abx * t;
      const y = a.y + aby * t;
      const distance = Math.hypot(p.x - x, p.y - y);
      if (distance < best.distance) best = { x, y, distance };
    }
    return best;
  }
}
