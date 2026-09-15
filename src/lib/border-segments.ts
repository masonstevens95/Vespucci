/**
 * Border and coastline extraction.
 *
 * A border between two countries is a line between two shapes, belonging to
 * neither. It cannot be drawn by stroking either one — that traces the whole
 * province, internal edges included — so the segment where two specific
 * locations touch has to be pulled out of their geometry.
 *
 * This works because touching shapes in the map asset share their boundary:
 * the vertices of P that lie within epsilon of Q's outline are exactly the
 * ones along the P–Q border, and because a path's vertices are ordered around
 * its perimeter they arrive in contiguous runs.
 *
 * The test is against Q's *outline*, not against Q's vertices. Neighbouring
 * shapes are free to tessellate their shared boundary differently — one puts a
 * vertex where the other draws a single long edge — and a vertex-to-vertex
 * test reads those as touching nothing at all. That silently turned ordinary
 * inland province corners into coastline: 42% of all coastline runs on a large
 * save were 4 vertices or shorter, drawn as specks in the middle of
 * contiguous territory.
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
 * A shape as its closed rings — a mainland and any islands.
 *
 * Grouping matters because the rings are not connected to one another, so a
 * line must never run from the end of one to the start of the next.
 */
export type Shape = readonly (readonly Point[])[];

/**
 * Match distance in viewBox units, matching the adjacency generator.
 *
 * The two must agree: adjacency decides which pairs are worth extracting, and
 * extraction decides which vertices are on the border. A wider epsilon here
 * would claim vertices for a border the graph never recorded.
 */
export const BORDER_EPSILON = 0.15;

/** Answers "is that point on this shape's outline?". */
export type NearTest = (point: Point) => boolean;

/**
 * Squared distance from a point to a line segment, clamped to its ends.
 *
 * Squared because this runs tens of millions of times on a large save and the
 * caller only ever compares against a fixed radius; taking the root would be
 * pure waste.
 */
const squaredDistanceToSegment = (p: Point, a: Point, b: Point): number => {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const length2 = vx * vx + vy * vy;
  // A zero-length segment is a lone vertex; the projection collapses onto it.
  const t = length2 === 0
    ? 0
    : Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / length2));
  const dx = a[0] + t * vx - p[0];
  const dy = a[1] + t * vy - p[1];
  return dx * dx + dy * dy;
};

/**
 * Pack a cell coordinate pair into one number.
 *
 * A string key allocates on every lookup, and the query does nine of them per
 * vertex per neighbour. The map is 1200x680 units, so at any sane epsilon the
 * grid stays far inside the range this packing addresses.
 */
const CELL_STRIDE = 1 << 22;
const cellKey = (cx: number, cy: number): number => (cx + CELL_STRIDE) * (CELL_STRIDE * 2) + (cy + CELL_STRIDE);

/**
 * Build the near-test for a shape's outline.
 *
 * Exported so a caller extracting many borders and coastlines can build each
 * shape's test once and reuse it. Every location is a neighbour of several
 * others, and both the border pass and the coast pass ask the same question of
 * it, so rebuilding per pairing does the same work many times over.
 *
 * Edges, not vertices, which is why this takes rings rather than a flat point
 * list: an edge only exists between consecutive points of the same ring, and
 * one running from the end of a mainland to the start of an island would cut
 * straight across the water.
 *
 * Segments are indexed in a grid of epsilon-sized cells. Each is walked in
 * pieces no longer than one cell and stamped into the cells its piece covers,
 * rather than into its whole bounding box — a long diagonal would otherwise
 * claim thousands of cells it never passes through. Because the nearest point
 * of a matching segment is always within epsilon of the query, and therefore
 * at most one cell away in each axis, the 3x3 neighbourhood is enough to find
 * it.
 */
export const boundaryIndex = (rings: Shape, epsilon: number = BORDER_EPSILON): NearTest => {
  const segments: (readonly [Point, Point])[] = [];
  const cells = new Map<number, number[]>();
  const radius2 = epsilon * epsilon;

  const stamp = (cx: number, cy: number, index: number): void => {
    const k = cellKey(cx, cy);
    const bucket = cells.get(k);
    if (bucket === undefined) {
      cells.set(k, [index]);
    } else if (bucket[bucket.length - 1] !== index) {
      bucket.push(index);
    } else {
      /* already the last entry for this cell — a piece re-entering it */
    }
  };

  for (const ring of rings) {
    if (ring.length === 1) {
      // A lone point still has to be matchable, so it becomes a segment of
      // zero length rather than disappearing.
      const only = ring[0];
      segments.push([only, only]);
      stamp(Math.floor(only[0] / epsilon), Math.floor(only[1] / epsilon), segments.length - 1);
    } else {
      /* a real ring — take it edge by edge */
    }

    for (let i = 0; i + 1 < ring.length; i++) {
      const a = ring[i];
      const b = ring[i + 1];
      const index = segments.length;
      segments.push([a, b]);

      const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / epsilon));
      for (let piece = 0; piece < steps; piece++) {
        const t0 = piece / steps;
        const t1 = (piece + 1) / steps;
        const x0 = a[0] + (b[0] - a[0]) * t0;
        const y0 = a[1] + (b[1] - a[1]) * t0;
        const x1 = a[0] + (b[0] - a[0]) * t1;
        const y1 = a[1] + (b[1] - a[1]) * t1;
        const cx0 = Math.floor(Math.min(x0, x1) / epsilon);
        const cx1 = Math.floor(Math.max(x0, x1) / epsilon);
        const cy0 = Math.floor(Math.min(y0, y1) / epsilon);
        const cy1 = Math.floor(Math.max(y0, y1) / epsilon);
        for (let cx = cx0; cx <= cx1; cx++) {
          for (let cy = cy0; cy <= cy1; cy++) {
            stamp(cx, cy, index);
          }
        }
      }
    }
  }

  return (point: Point): boolean => {
    const cx = Math.floor(point[0] / epsilon);
    const cy = Math.floor(point[1] / epsilon);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = cells.get(cellKey(cx + dx, cy + dy));
        if (bucket === undefined) {
          continue;
        } else {
          /* cell holds segments — measure each */
        }
        for (const index of bucket) {
          const segment = segments[index];
          if (squaredDistanceToSegment(point, segment[0], segment[1]) <= radius2) {
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
 * Collect the marked vertices of one ring into connected polylines.
 *
 * Shared by both callers because the awkward part — a run straddling the
 * start of the list — is the same whether the mark means "on a border with
 * that neighbour" or "on no border at all".
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
const runsOfRing = (
  ring: readonly Point[],
  marked: readonly boolean[],
  epsilon: number,
  reachPastEnds: boolean,
): Polyline[] => {
  const rotated = rotateToUnmarked(ring, marked, epsilon);
  const pts = rotated.points;

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
      const from = reachPastEnds && start > 0 ? start - 1 : start;
      const to = reachPastEnds && end < pts.length ? end + 1 : end;
      const body = pts.slice(from, to);
      // A run ending at the list's end has its next vertex at the front,
      // since rotation left the loop cyclic. Without this the seam keeps the
      // very gap the reach exists to close.
      const reachesSeam = reachPastEnds && to === pts.length && rotated.cyclic;
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
    } else {
      /* marked and within the ring — the run continues */
    }
  });
  flush(pts.length);

  return result;
};

/**
 * Collect the marked vertices of every ring of a shape.
 *
 * Rings are walked one at a time and never joined. Consecutive vertices
 * within a ring are connected by a real path segment; the step from the end
 * of one ring to the start of the next crosses whatever lies between them,
 * which for a mainland and its island is open water.
 */
const runsOf = (
  rings: Shape,
  mark: (p: Point) => boolean,
  epsilon: number,
  reachPastEnds: boolean = false,
): Polyline[] =>
  rings.flatMap((ring) => runsOfRing(ring, ring.map(mark), epsilon, reachPastEnds));

/**
 * The polylines along the border between two shapes.
 *
 * The neighbour arrives as its prebuilt outline test rather than as geometry,
 * because a location borders several others and the coast pass asks the same
 * question of it again: building the index once per shape rather than once per
 * pairing is the difference between one pass and six.
 *
 * Runs of fewer than two points are dropped: a single touching corner is a
 * meeting point, not a border worth drawing.
 */
export const sharedBorders = (
  a: Shape,
  onNeighbor: NearTest,
  epsilon: number = BORDER_EPSILON,
): Polyline[] => {
  if (a.length === 0) {
    return [];
  } else {
    /* the shape has geometry — walk it against the neighbour */
  }

  return runsOf(a, onNeighbor, epsilon);
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
 * A ring that is a hole inside the shape and touches no neighbour is a lake,
 * and is skipped: an inland water body is not part of the realm's outline.
 *
 * Each run reaches one vertex past both of its ends, so the stretch closes up
 * to the borders on either side of it. The vertex where a land border meets
 * the water is shared with that neighbour, so it counts as border rather than
 * coast, and without the reach the edge from it out to open water would be
 * drawn by neither — a gap at every point where a realm's border hits the sea.
 */
export const coastline = (
  a: Shape,
  neighbors: readonly NearTest[],
  epsilon: number = BORDER_EPSILON,
): Polyline[] => {
  if (a.length === 0) {
    return [];
  } else {
    /* the shape has geometry — find the edges facing nothing */
  }

  const facingNothing = (p: Point) => !neighbors.some((near) => near(p));
  const boxes = a.length > 1 ? a.map(boxOf) : [];

  return a.flatMap((ring, i) => {
    const marked = ring.map(facingNothing);
    // Cheapest test first, and it is already paid for: a hole with a
    // neighbour anywhere on it is an enclave, not a lake, and only a ring
    // facing nothing along its whole length can be one.
    const couldBeLake = a.length > 1 && marked.length > 0 && marked.every((m) => m);
    if (couldBeLake && isHole(a, boxes, i)) {
      return [];
    } else {
      /* outer perimeter, island, or enclave edge — all real outline */
    }
    return runsOfRing(ring, marked, epsilon, true);
  });
};

/**
 * Is the point inside this ring? Ray casting, counting crossings.
 *
 * Bounding boxes are not enough to tell a hole from an island: a crescent's
 * box contains the bay it wraps around, so an island sitting in that bay would
 * be mistaken for a hole and lose its coastline.
 */
const isInsideRing = (p: Point, ring: readonly Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const straddles = (yi > p[1]) !== (yj > p[1]);
    if (straddles && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    } else {
      /* the ray misses this edge */
    }
  }
  return inside;
};

interface Box { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }

const boxOf = (ring: readonly Point[]): Box => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of ring) {
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[1] > y1) y1 = p[1];
  }
  return { x0, y0, x1, y1 };
};

const boxWithin = (inner: Box, outer: Box): boolean =>
  inner.x0 >= outer.x0 && inner.x1 <= outer.x1 && inner.y0 >= outer.y0 && inner.y1 <= outer.y1;

/**
 * Is this ring a lake rather than a piece of the realm's outline?
 *
 * A location containing a lake draws it as a hole in its own polygon. The hole
 * touches no neighbour — there is no land on the far side of it — so the
 * complement that defines coastline claims the whole ring and strokes a closed
 * outline around the lake, in the middle of somebody's territory. 1,896 rings
 * in the asset are shaped that way.
 *
 * The other kind of hole is an enclave: one country sitting wholly inside
 * another. That one *does* touch its neighbour, and its edges are already
 * drawn as the border they are, so the touch test keeps the two apart.
 *
 * Only holes wholly inside a single location are caught here. A lake lying
 * between several locations is a gap between them rather than a ring of any
 * one of them, and nothing local distinguishes it from open sea.
 */
const isHole = (rings: Shape, boxes: readonly Box[], index: number): boolean => {
  const ring = rings[index];
  if (ring.length === 0) {
    return false;
  } else {
    /* a real ring — is some other ring of this shape wrapped around it? */
  }

  const probe = ring[0];
  return rings.some((other, j) => {
    if (j === index || other.length <= 2) {
      return false;
    } else {
      /* a candidate container — box first, which rejects almost all of them */
    }
    return boxWithin(boxes[index], boxes[j]) && isInsideRing(probe, other);
  });
};

/** Render a polyline as SVG path data. */
export const polylineToPathData = (line: Polyline): string =>
  line.length === 0
    ? ""
    : line
        .map((p, i) => `${i === 0 ? "M" : "L"}${p[0]} ${p[1]}`)
        .join("");
