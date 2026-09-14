/**
 * Border and coastline extraction.
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
 * Coastline is the same idea inverted. Sea zones have no shape in the asset at
 * all, so a coast cannot be found as a border *with* anything — it is the
 * stretch of perimeter that touches no land neighbour.
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

/** Answers "is there a vertex of this shape near that point?". */
export type NearTest = (point: Point) => boolean;

/**
 * Build the near-test for a shape's vertices.
 *
 * Exported so a caller extracting many coastlines can build each shape's test
 * once and reuse it. Every location is a neighbour of several others, so
 * rebuilding per pair does the same work six times over.
 */
export const vertexIndex = (points: readonly Point[], epsilon: number = BORDER_EPSILON): NearTest => {
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
 * Rotate a closed vertex loop so it starts on an unmarked vertex.
 *
 * Without this, a run that straddles the start of the list comes out as two
 * fragments with a gap at the seam. Rotation is only safe when the list really
 * is one closed loop, which is what the first-meets-last check establishes; a
 * multi-subpath path is left alone rather than being joined across a subpath
 * boundary.
 */
const rotateToUnmarked = (
  points: readonly Point[],
  marked: readonly boolean[],
  epsilon: number,
): { points: readonly Point[]; marked: readonly boolean[]; cyclic: boolean } => {
  const n = points.length;
  if (n < 2) {
    return { points, marked, cyclic: false };
  } else {
    /* enough points to have a seam */
  }

  const first = points[0];
  const last = points[n - 1];
  const closed = Math.hypot(last[0] - first[0], last[1] - first[1]) <= epsilon;
  if (!closed || !marked[0] || !marked[n - 1]) {
    return { points, marked, cyclic: false };
  } else {
    /* a run straddles the seam — rotate past it */
  }

  const pivot = marked.indexOf(false);
  if (pivot === -1) {
    // Every vertex is marked: the whole perimeter is one run, so there is no
    // seam to hide. Leave the loop as it stands.
    return { points, marked, cyclic: false };
  } else {
    /* rotate so scanning starts outside any run */
  }

  // Rotating a closed loop leaves a valid cyclic walk: the old last vertex
  // and the old first are the same point, and the new last is the old
  // pivot-1, one step around the perimeter from the new first. So the step
  // from the end of the rotated list back to its start is a real edge.
  return {
    points: [...points.slice(pivot), ...points.slice(0, pivot)],
    marked: [...marked.slice(pivot), ...marked.slice(0, pivot)],
    cyclic: true,
  };
};

/**
 * Collect the marked vertices of a perimeter into connected polylines.
 *
 * Shared by both callers because the awkward parts — a run straddling the
 * start of the list, and a run stepping across a subpath boundary — are the
 * same whether the mark means "on a border with that neighbour" or "on no
 * border at all".
 *
 * `reachPastEnds` carries a run one vertex beyond each end. A vertex is either
 * shared with a neighbour or it is not, so the perimeter edge that crosses
 * between the two belongs to no run at all: the border stops at the last
 * vertex it shares with the neighbour, and the coast starts at the next one.
 * Only coastline reaches past its ends, because that crossing edge runs along
 * the water rather than along the border it is leaving. Borders do not need
 * it: where two borders of the same shape meet, they meet at a vertex all
 * three shapes share, so both runs already reach it.
 */
const runsOf = (
  points: readonly Point[],
  mark: (p: Point) => boolean,
  epsilon: number,
  reachPastEnds: boolean = false,
): Polyline[] => {
  const rotated = rotateToUnmarked(points, points.map(mark), epsilon);
  const pts = rotated.points;

  /** False where the step from i to j has crossed into another subpath. */
  const contiguous = (i: number, j: number): boolean =>
    Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]) <= MAX_STEP;

  const result: Polyline[] = [];
  let start = -1;

  // A single marked vertex describes no stretch on its own, so a border drops
  // it: one shared corner is a meeting point, not an edge. A run that reaches
  // past its ends is different — a lone seaward vertex between two borders is
  // a notch in the coast, and the two edges leading to and from it face the
  // water whichever way you walk them.
  const shortest = reachPastEnds ? 1 : 2;

  const flush = (end: number) => {
    if (start >= 0 && end - start >= shortest) {
      const from =
        reachPastEnds && start > 0 && contiguous(start - 1, start)
          ? start - 1
          : start;
      const to =
        reachPastEnds && end < pts.length && contiguous(end - 1, end)
          ? end + 1
          : end;
      const body = pts.slice(from, to);
      // A run ending at the list's end has its next vertex at the front,
      // since rotation left the loop cyclic. Without this the seam keeps the
      // very gap the reach exists to close.
      const reachesSeam =
        reachPastEnds &&
        to === pts.length &&
        rotated.cyclic &&
        contiguous(pts.length - 1, 0);
      result.push(reachesSeam ? [...body, pts[0]] : body);
    } else {
      /* no run, or too short to describe a stretch of edge */
    }
    start = -1;
  };

  pts.forEach((_, i) => {
    if (!rotated.marked[i]) {
      flush(i);
    } else if (start === -1) {
      start = i;
    } else if (!contiguous(i - 1, i)) {
      // Crossed into another subpath; close the run rather than drawing a
      // line across whatever lies between.
      flush(i);
      start = i;
    } else {
      /* contiguous and marked — the run continues */
    }
  });
  flush(pts.length);

  return result;
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

  return runsOf(a, vertexIndex(b, epsilon), epsilon);
};

/**
 * The polylines along a shape's coastline.
 *
 * Sea zones and lakes have no shape in the asset at all — the ocean is the
 * container's background — so there is nothing to share a border *with*.
 * Coastline is therefore the complement: the stretches of a shape's perimeter
 * that touch none of its land neighbours.
 *
 * That also keeps an edge facing unclaimed land out of the result, since
 * wilderness is an ordinary land path and shows up among the neighbours.
 *
 * Each run reaches one vertex past both of its ends, so the stretch closes up
 * to the borders on either side of it. The vertex where a land border meets
 * the water is shared with that neighbour, so it counts as border rather than
 * coast, and without the reach the edge from it out to open water would be
 * drawn by neither — a gap at every point where a realm's border hits the sea.
 */
export const coastline = (
  a: readonly Point[],
  neighbors: readonly NearTest[],
  epsilon: number = BORDER_EPSILON,
): Polyline[] => {
  if (a.length === 0) {
    return [];
  } else {
    /* the shape has geometry — find the edges facing nothing */
  }

  return runsOf(a, (p) => !neighbors.some((near) => near(p)), epsilon, true);
};

/** Render a polyline as SVG path data. */
export const polylineToPathData = (line: Polyline): string =>
  line.length === 0
    ? ""
    : line
        .map((p, i) => `${i === 0 ? "M" : "L"}${p[0]} ${p[1]}`)
        .join("");
