/**
 * Shared border extraction.
 *
 * A border between two countries is a line between two shapes, belonging to
 * neither. It cannot be drawn by stroking either one — that traces the whole
 * province, internal edges included — so the segment where two specific
 * locations touch has to be pulled out of their geometry.
 *
 * This works because touching shapes in the map asset share their border
 * vertices near-exactly: the vertices of P that lie within epsilon of some
 * vertex of Q are exactly the ones along the P–Q border, and because a path's
 * vertices are ordered around its perimeter they arrive in contiguous runs.
 *
 * All functions are pure, use immutable variables, and never throw.
 */

import type { Point } from "./svg-path";

/** A connected run of points along a shared border. */
export type Polyline = readonly Point[];

/**
 * Vertex match distance in viewBox units, matching the adjacency generator.
 *
 * The two must agree: adjacency decides which pairs are worth extracting, and
 * extraction decides which vertices are on the border. A wider epsilon here
 * would claim vertices for a border the graph never recorded.
 */
export const BORDER_EPSILON = 0.15;

/**
 * Longest plausible step between consecutive vertices along one border.
 *
 * A path may hold several subpaths — a mainland and its islands — and the
 * vertex list runs them together with no marker. A run that steps further
 * than any real border segment has jumped between subpaths, and joining it
 * would draw a line straight across the map.
 */
const MAX_STEP = 5;

/** A lookup that answers "is there a vertex near this point?". */
const buildIndex = (points: readonly Point[], epsilon: number) => {
  const cells = new Map<string, Point[]>();
  const key = (cx: number, cy: number) => `${cx},${cy}`;
  for (const p of points) {
    const k = key(Math.floor(p[0] / epsilon), Math.floor(p[1] / epsilon));
    const bucket = cells.get(k);
    if (bucket === undefined) {
      cells.set(k, [p]);
    } else {
      bucket.push(p);
    }
  }

  return (point: Point): boolean => {
    const cx = Math.floor(point[0] / epsilon);
    const cy = Math.floor(point[1] / epsilon);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = cells.get(key(cx + dx, cy + dy));
        if (bucket === undefined) {
          continue;
        } else {
          /* cell holds vertices — measure each */
        }
        for (const q of bucket) {
          if (Math.hypot(q[0] - point[0], q[1] - point[1]) <= epsilon) {
            return true;
          } else {
            /* too far — keep looking */
          }
        }
      }
    }
    return false;
  };
};

/**
 * Rotate a closed vertex loop so it starts on an unshared vertex.
 *
 * Without this, a border that straddles the start of the list comes out as
 * two fragments with a gap at the seam. Rotation is only safe when the list
 * really is one closed loop, which is what the first-meets-last check
 * establishes; a multi-subpath path is left alone rather than being joined
 * across a subpath boundary.
 */
const rotateToUnshared = (
  points: readonly Point[],
  shared: readonly boolean[],
  epsilon: number,
): { points: readonly Point[]; shared: readonly boolean[] } => {
  const n = points.length;
  if (n < 2) {
    return { points, shared };
  } else {
    /* enough points to have a seam */
  }

  const first = points[0];
  const last = points[n - 1];
  const closed = Math.hypot(last[0] - first[0], last[1] - first[1]) <= epsilon;
  if (!closed || !shared[0] || !shared[n - 1]) {
    return { points, shared };
  } else {
    /* a run straddles the seam — rotate past it */
  }

  const pivot = shared.indexOf(false);
  if (pivot === -1) {
    // Every vertex is on the border: one shape fully encloses the other's
    // edge. There is no seam to hide, so leave the loop as it stands.
    return { points, shared };
  } else {
    /* rotate so scanning starts outside any run */
  }

  return {
    points: [...points.slice(pivot), ...points.slice(0, pivot)],
    shared: [...shared.slice(pivot), ...shared.slice(0, pivot)],
  };
};

/**
 * The polylines along the border between two shapes.
 *
 * Runs of fewer than two points are dropped: a single touching corner is a
 * meeting point, not a border worth drawing.
 */
export const sharedBorders = (
  a: readonly Point[],
  b: readonly Point[],
  epsilon: number = BORDER_EPSILON,
): Polyline[] => {
  if (a.length === 0 || b.length === 0) {
    return [];
  } else {
    /* both shapes have geometry — compare them */
  }

  const nearB = buildIndex(b, epsilon);
  const rotated = rotateToUnshared(
    a,
    a.map((p) => nearB(p)),
    epsilon,
  );

  const result: Polyline[] = [];
  let run: Point[] = [];

  const flush = () => {
    if (run.length >= 2) {
      result.push(run);
    } else {
      /* a lone point is a corner, not a border */
    }
    run = [];
  };

  rotated.points.forEach((point, i) => {
    if (!rotated.shared[i]) {
      flush();
      return;
    } else {
      /* on the border — extend or start a run */
    }

    const previous = run[run.length - 1];
    const jumped =
      previous !== undefined &&
      Math.hypot(point[0] - previous[0], point[1] - previous[1]) > MAX_STEP;
    if (jumped) {
      // Crossed into another subpath; close the run rather than drawing a
      // line across whatever lies between.
      flush();
    } else {
      /* contiguous — keep going */
    }

    run.push(point);
  });
  flush();

  return result;
};

/** Render a polyline as SVG path data. */
export const polylineToPathData = (line: Polyline): string =>
  line.length === 0
    ? ""
    : line
        .map((p, i) => `${i === 0 ? "M" : "L"}${p[0]} ${p[1]}`)
        .join("");
