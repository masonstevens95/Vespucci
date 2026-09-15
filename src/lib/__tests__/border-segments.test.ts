import { describe, it, expect } from "vitest";
import {
  sharedBorders,
  coastline,
  boundaryIndex,
  polylineToPathData,
  BORDER_EPSILON,
} from "../border-segments";
import { pathVertices, pathSubpaths, type Point } from "../svg-path";
import adjacencyAsset from "../location-adjacency.json";
import locationIds from "../location-ids.json";
import { readFileSync } from "fs";

/**
 * A square walked vertex by vertex, so the border between two of them has
 * intermediate points rather than only corners — the shape real locations
 * have, and the only shape a run can actually be detected in.
 */
const square = (x: number, y: number, size: number, step = 1): Point[] => {
  const pts: Point[] = [];
  for (let i = 0; i < size; i += step) pts.push([x + i, y]);
  for (let i = 0; i < size; i += step) pts.push([x + size, y + i]);
  for (let i = size; i > 0; i -= step) pts.push([x + i, y + size]);
  for (let i = size; i > 0; i -= step) pts.push([x, y + i]);
  pts.push([x, y]); // close the loop
  return pts;
};

/**
 * The border of `a` against a neighbour given as one ring.
 *
 * sharedBorders takes the neighbour's prebuilt outline test, since the caller
 * reuses it across that location's several pairings. These tests only ever
 * have one pairing, so they build it inline.
 */
const bordersWith = (
  a: readonly (readonly Point[])[],
  neighbor: readonly Point[],
): ReturnType<typeof sharedBorders> => sharedBorders(a, boundaryIndex([neighbor]));

/** Count drawn segments lying along the vertical line x = at. */
const edgesAlongX = (lines: readonly (readonly Point[])[], at: number): number =>
  lines.reduce(
    (total, line) =>
      total +
      line.filter((p, i) => i > 0 && p[0] === at && line[i - 1][0] === at).length,
    0,
  );

describe("sharedBorders", () => {
  it("finds the shared edge of two touching squares", () => {
    const a = square(0, 0, 10);
    const b = square(10, 0, 10);
    const borders = bordersWith([a], b);
    expect(borders).toHaveLength(1);
    expect(borders[0].length).toBeGreaterThan(2);
  });

  it("puts the shared run along the touching edge", () => {
    const borders = bordersWith([square(0, 0, 10)], square(10, 0, 10));
    // Every point of the border sits on x = 10, the line where they meet.
    for (const [x] of borders[0]) {
      expect(x).toBeCloseTo(10, 6);
    }
  });

  it("reaches the corners of the shared edge", () => {
    const borders = bordersWith([square(0, 0, 10)], square(10, 0, 10));
    const ys = borders[0].map(([, y]) => y);
    expect(Math.min(...ys)).toBeCloseTo(0, 6);
    expect(Math.max(...ys)).toBeCloseTo(10, 6);
  });

  it("finds nothing for shapes that only meet at a corner", () => {
    // Diagonal neighbours share exactly one point — a meeting, not a border.
    expect(bordersWith([square(0, 0, 10)], square(10, 10, 10))).toEqual([]);
  });

  it("finds nothing for shapes that do not touch", () => {
    expect(bordersWith([square(0, 0, 10)], square(50, 50, 10))).toEqual([]);
  });

  it("finds nothing when one shape has no geometry", () => {
    expect(bordersWith([], square(0, 0, 10))).toEqual([]);
    expect(bordersWith([square(0, 0, 10)], [])).toEqual([]);
  });

  it("treats vertices coincident within epsilon as shared", () => {
    const borders = bordersWith([square(0, 0, 10)], square(10 + BORDER_EPSILON / 2, 0, 10));
    expect(borders.length).toBeGreaterThan(0);
  });

  it("does not treat vertices beyond epsilon as shared", () => {
    expect(bordersWith([square(0, 0, 10)], square(10 + BORDER_EPSILON * 3, 0, 10))).toEqual([]);
  });

  it("joins a border that straddles the start of the vertex list", () => {
    // The square's list starts at (0,0), so a neighbour to the left owns a run
    // that wraps the seam. Without rotation this comes out as two fragments.
    const a = square(0, 0, 10);
    const b = square(-10, 0, 10);
    const borders = bordersWith([a], b);
    expect(borders).toHaveLength(1);
  });

  it("returns several polylines when shapes touch along separate stretches", () => {
    // A neighbour on each side: two disjoint borders. Passed as two rings,
    // because an outline is made of edges and one list would put an edge
    // straight from the right square to the left one — through the middle of
    // the shape being measured.
    const a = square(0, 0, 10);
    const outline = boundaryIndex([square(10, 0, 10), square(-10, 0, 10)]);
    expect(sharedBorders([a], outline).length).toBeGreaterThanOrEqual(2);
  });

  it("does not join across a jump between subpaths", () => {
    // A mainland and an island are separate rings, so no line runs from the
    // end of one to the start of the other however close together they sit.
    const mainland: Point[] = [[0, 0], [0, 1], [0, 2]];
    const island: Point[] = [[500, 0], [500, 1], [500, 2]];
    const near: Point[] = [...mainland, ...island];
    const borders = bordersWith([mainland, island], near);
    expect(borders).toHaveLength(2);
    for (const line of borders) {
      const xs = line.map(([x]) => x);
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(5);
    }
  });

  it("keeps rings apart even when the gap between them is small", () => {
    // The old distance proxy joined anything closer than 5 units, drawing a
    // line across the water between an island and its mainland.
    const mainland: Point[] = [[0, 0], [0, 1], [0, 2]];
    const island: Point[] = [[2, 0], [2, 1], [2, 2]];
    const near: Point[] = [...mainland, ...island];
    expect(bordersWith([mainland, island], near)).toHaveLength(2);
  });

  it("keeps a long edge within one ring rather than breaking it", () => {
    // A real border edge can be longer than any proxy would allow; it is
    // still one stretch, not two.
    const ring: Point[] = [[0, 0], [0, 40], [0, 80]];
    expect(bordersWith([ring], ring)).toHaveLength(1);
  });

  it("handles a shape entirely enclosed by its neighbour", () => {
    const a = square(0, 0, 10);
    expect(() => bordersWith([a], a)).not.toThrow();
    expect(bordersWith([a], a).length).toBeGreaterThan(0);
  });

  it("describes the same border from either side", () => {
    const a = square(0, 0, 10);
    const b = square(10, 0, 10);
    const fromA = bordersWith([a], b).flat();
    const fromB = bordersWith([b], a).flat();
    // Both runs lie on x = 10 and span the same stretch of y.
    const spanOf = (pts: Point[]) => {
      const ys = pts.map(([, y]) => y);
      return [Math.min(...ys), Math.max(...ys)];
    };
    expect(spanOf(fromA)).toEqual(spanOf(fromB));
  });
});

describe("boundaryIndex — a neighbour tessellated differently", () => {
  /**
   * The bug this replaced a vertex-to-vertex test for.
   *
   * Two touching provinces need not put vertices in the same places along the
   * boundary they share. Here the left square walks its right edge vertex by
   * vertex while the right square draws the same edge as one straight line
   * between corners. Every intermediate vertex of the left square lies exactly
   * on the right square's edge, but is a whole unit from its nearest vertex —
   * so a vertex test called them unshared and the coast pass drew them as sea,
   * putting specks of coastline in the middle of contiguous land.
   */
  const fine = square(0, 0, 10);
  const coarse: Point[] = [[10, 0], [20, 0], [20, 10], [10, 10], [10, 0]];

  it("matches a point lying on a long edge with no vertex near it", () => {
    const onEdge: Point = [10, 5];
    expect(boundaryIndex([coarse])(onEdge)).toBe(true);
    // The nearest vertex of the coarse square is five units away, so nothing
    // about this is within epsilon of a vertex.
    const nearestVertex = Math.min(
      ...coarse.map((v) => Math.hypot(v[0] - onEdge[0], v[1] - onEdge[1])),
    );
    expect(nearestVertex).toBeGreaterThan(BORDER_EPSILON * 10);
  });

  it("does not match a point inside the shape, away from its outline", () => {
    expect(boundaryIndex([coarse])([15, 5])).toBe(false);
  });

  it("does not match a point beyond epsilon of the outline", () => {
    expect(boundaryIndex([coarse])([10 - BORDER_EPSILON * 3, 5])).toBe(false);
  });

  it("finds the border against a coarsely drawn neighbour", () => {
    const borders = sharedBorders([fine], boundaryIndex([coarse]));
    expect(borders).toHaveLength(1);
    expect(borders[0].length).toBeGreaterThan(2);
  });

  it("does not report that shared edge as coastline", () => {
    // The regression in one line. The two corners at (10,0) and (10,10) are
    // allowed: a coast run reaches one vertex past each end so it closes up to
    // the border it meets. What must never appear is the edge's interior —
    // those are the points a vertex test used to strand in the sea.
    const lines = coastline([fine], [boundaryIndex([coarse])]);
    const strandedInterior = lines
      .flat()
      .filter((p) => p[0] === 10 && p[1] > 0 && p[1] < 10);
    expect(strandedInterior).toEqual([]);
  });

  it("still reports the edges that face nothing", () => {
    const lines = coastline([fine], [boundaryIndex([coarse])]);
    expect(lines.flat().length).toBeGreaterThan(0);
  });
});

describe("coastline", () => {
  it("returns the whole perimeter when a shape has no neighbours", () => {
    // An island: every edge faces the sea.
    const a = square(0, 0, 10);
    const lines = coastline([a], []);
    expect(lines).toHaveLength(1);
    expect(lines[0].length).toBeGreaterThan(a.length - 3);
  });

  it("excludes the stretch shared with a neighbour", () => {
    // A coastal province with land to its east: no line runs along x = 10.
    // The run still reaches the corner vertex there, so that the coast meets
    // the border rather than stopping an edge short of it.
    const lines = coastline([square(0, 0, 10)], [boundaryIndex([square(10, 0, 10)])]);
    expect(lines.length).toBeGreaterThan(0);
    expect(edgesAlongX(lines, 10)).toBe(0);
  });

  it("returns nothing when neighbours cover the whole perimeter", () => {
    // Landlocked: every edge abuts something.
    const a = square(0, 0, 10);
    expect(coastline([a], [boundaryIndex([a])])).toEqual([]);
  });

  it("excludes an edge facing unclaimed land", () => {
    // Wilderness is an ordinary path, so it turns up among the neighbours and
    // its edge is not coast — it just goes unlined.
    const lines = coastline([square(0, 0, 10)], [boundaryIndex([square(10, 0, 10)]), boundaryIndex([square(-10, 0, 10)])]);
    expect(edgesAlongX(lines, 10)).toBe(0);
    expect(edgesAlongX(lines, 0)).toBe(0);
  });

  it("splits coast into separate runs around an intervening neighbour", () => {
    // Land east and west leaves the north and south edges as two coasts.
    const lines = coastline([square(0, 0, 10)], [boundaryIndex([square(10, 0, 10)]), boundaryIndex([square(-10, 0, 10)])]);
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it("ignores a neighbour with no geometry", () => {
    const a = square(0, 0, 10);
    expect(coastline([a], [boundaryIndex([[]])]).length).toBe(1);
  });

  it("returns nothing for a shape with no geometry", () => {
    expect(coastline([], [boundaryIndex([square(0, 0, 10)])])).toEqual([]);
  });

  it("treats a neighbour within epsilon as touching", () => {
    const lines = coastline([square(0, 0, 10)], [boundaryIndex([square(10 + BORDER_EPSILON / 2, 0, 10)])]);
    expect(edgesAlongX(lines, 10)).toBe(0);
  });

  it("draws the notch at a lone seaward vertex between two borders", () => {
    // One vertex pokes into the water between two land borders. It is a run
    // of one, which describes no stretch by itself, but the edges leading to
    // and from it both face the water and belong to the coast.
    const a: Point[] = [[0, 0], [1, 0], [2, 1], [3, 0], [4, 0], [4, 4], [0, 4], [0, 0]];
    const neighbour = a.filter(([x, y]) => !(x === 2 && y === 1));
    const lines = coastline([a], [boundaryIndex([neighbour])]);
    expect(lines).toEqual([[[1, 0], [2, 1], [3, 0]]]);
  });

  it("leaves no undrawn edge where the coast meets a border", () => {
    // The junction vertex is shared with the neighbour, so it counts as
    // border rather than coast. Without the coast reaching out to it, the
    // edge from it to open water belongs to neither run and goes undrawn —
    // a nick in the outline at every point where a border hits the sea.
    const a = square(0, 0, 10);
    const b = square(10, 0, 10);
    const key = (p: Point, q: Point) =>
      [`${p[0]},${p[1]}`, `${q[0]},${q[1]}`].sort().join("|");

    const drawn = new Set<string>();
    for (const line of [...bordersWith([a], b), ...coastline([a], [boundaryIndex([b])])]) {
      line.forEach((p, i) => {
        if (i > 0) {
          drawn.add(key(line[i - 1], p));
        } else {
          /* first point of a run starts no edge */
        }
      });
    }

    const undrawn = a.filter(
      (p, i) => i > 0 && !(p[0] === 10 && a[i - 1][0] === 10) && !drawn.has(key(a[i - 1], p)),
    );
    expect(undrawn).toEqual([]);
  });

  it("complements sharedBorders — together they cover the perimeter", () => {
    const a = square(0, 0, 10);
    const b = square(10, 0, 10);
    const border = bordersWith([a], b).flat().length;
    const coast = coastline([a], [boundaryIndex([b])]).flat().length;
    // Every vertex is either on the border or on the coast; the two runs each
    // keep their end vertices, so the total lands within a couple of the
    // perimeter's own count.
    expect(border + coast).toBeGreaterThanOrEqual(a.length - 2);
  });
});

describe("coastline — lakes inside a location", () => {
  const outer = square(0, 0, 20);
  /** A hole in the middle of it: the shape of a lake in the asset. */
  const lake = square(8, 8, 4);
  const onOuterEdge = (p: Point) => p[0] === 0 || p[0] === 20 || p[1] === 0 || p[1] === 20;

  it("does not stroke a hole that touches no neighbour", () => {
    const lines = coastline([outer, lake], []);
    expect(lines.length).toBeGreaterThan(0);
    // Every point drawn belongs to the outer perimeter; none to the lake.
    expect(lines.flat().every(onOuterEdge)).toBe(true);
  });

  it("still strokes the outer perimeter in full", () => {
    const withLake = coastline([outer, lake], []).flat().length;
    const withoutLake = coastline([outer], []).flat().length;
    expect(withLake).toBe(withoutLake);
  });

  it("strokes a separate island, which is not a hole", () => {
    // Its bounding box lies outside the mainland's, so nothing about it is
    // enclosed — this is land with a real shore.
    const island = square(30, 30, 4);
    const lines = coastline([outer, island], []);
    const islandPoints = lines.flat().filter((p) => p[0] >= 30 && p[1] >= 30);
    expect(islandPoints.length).toBeGreaterThan(0);
  });

  it("strokes an island sitting inside a bay, which a bounding box would call a hole", () => {
    // A crescent wrapping around open water. The island in the bay is inside
    // the crescent's box but outside the crescent itself, so ray casting keeps
    // its coastline where a box test would have dropped it.
    const crescent: Point[] = [
      [0, 0], [20, 0], [20, 20], [15, 20], [15, 5], [5, 5], [5, 20], [0, 20], [0, 0],
    ];
    const inBay = square(8, 10, 4);
    const lines = coastline([crescent, inBay], []);
    const bayPoints = lines.flat().filter((p) => p[0] >= 8 && p[0] <= 12 && p[1] >= 10);
    expect(bayPoints.length).toBeGreaterThan(0);
  });

  it("keeps stroking a hole that a neighbour only partly fills", () => {
    // An enclave against one edge of the hole. The ring is not a lake, so the
    // stretches facing nothing are still coast.
    const alongLeftEdge = boundaryIndex([[[8, 8], [8, 12]]]);
    const lines = coastline([outer, lake], [alongLeftEdge]);
    const onLakeRing = lines.flat().filter((p) => !onOuterEdge(p));
    expect(onLakeRing.length).toBeGreaterThan(0);
    expect(onLakeRing.some((p) => p[0] === 12)).toBe(true);
  });
});

describe("polylineToPathData", () => {
  it("starts with a move and continues with linetos", () => {
    expect(polylineToPathData([[1, 2], [3, 4], [5, 6]])).toBe("M1 2L3 4L5 6");
  });

  it("renders a single point as a bare move", () => {
    expect(polylineToPathData([[1, 2]])).toBe("M1 2");
  });

  it("renders an empty polyline as empty data", () => {
    expect(polylineToPathData([])).toBe("");
  });
});

describe("against the real asset", () => {
  const svg = readFileSync("public/eu-v-locations.svg", "utf8");
  const byId = new Map<string, string>();
  for (const m of svg.matchAll(/<path\s[^>]*id="([^"]+)"[^>]*\sd="([^"]+)"/g)) {
    byId.set(m[1], m[2]);
  }
  const ids = locationIds as readonly string[];
  const adj = adjacencyAsset as readonly number[][];

  const vertsOf = (id: string) => pathVertices(byId.get(id) ?? "");
  const ringsOf = (id: string) => pathSubpaths(byId.get(id) ?? "");
  const outlineOf = (id: string) => boundaryIndex(ringsOf(id));

  it("extracts a border between two genuinely adjacent locations", () => {
    const borders = sharedBorders(ringsOf("Uppsala"), outlineOf("Stockholm"));
    expect(borders.length).toBeGreaterThan(0);
    expect(borders.flat().length).toBeGreaterThan(1);
  });

  it("extracts nothing between two locations that are not adjacent", () => {
    // Uppsala and Paris are on opposite ends of the map.
    expect(sharedBorders(ringsOf("Uppsala"), outlineOf("Paris"))).toEqual([]);
  });

  it("finds a border for most of one location's recorded neighbours", () => {
    // Adjacency records a shared vertex; extraction needs a run of two, so a
    // pair touching at a single point legitimately yields nothing.
    const i = ids.indexOf("Uppsala");
    const neighbors = adj[i].map((n) => ids[n]);
    const withBorder = neighbors.filter(
      (n) => sharedBorders(ringsOf("Uppsala"), outlineOf(n)).length > 0,
    );
    expect(withBorder.length).toBeGreaterThanOrEqual(neighbors.length - 1);
  });

  it("keeps every extracted point on both shapes' boundaries", () => {
    // A point on the border must be near a vertex of each side; a point that
    // strayed into either interior would draw a line through a province.
    const a = vertsOf("Uppsala");
    const b = vertsOf("Stockholm");
    const near = (pts: Point[], p: Point) =>
      pts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) <= BORDER_EPSILON);
    for (const p of bordersWith([a], b).flat()) {
      expect(near(a, p)).toBe(true);
      expect(near(b, p)).toBe(true);
    }
  });
});
