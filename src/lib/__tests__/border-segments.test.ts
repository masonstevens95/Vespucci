import { describe, it, expect } from "vitest";
import {
  sharedBorders,
  coastline,
  vertexIndex,
  polylineToPathData,
  BORDER_EPSILON,
} from "../border-segments";
import { pathVertices, type Point } from "../svg-path";
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
    const borders = sharedBorders(a, b);
    expect(borders).toHaveLength(1);
    expect(borders[0].length).toBeGreaterThan(2);
  });

  it("puts the shared run along the touching edge", () => {
    const borders = sharedBorders(square(0, 0, 10), square(10, 0, 10));
    // Every point of the border sits on x = 10, the line where they meet.
    for (const [x] of borders[0]) {
      expect(x).toBeCloseTo(10, 6);
    }
  });

  it("reaches the corners of the shared edge", () => {
    const borders = sharedBorders(square(0, 0, 10), square(10, 0, 10));
    const ys = borders[0].map(([, y]) => y);
    expect(Math.min(...ys)).toBeCloseTo(0, 6);
    expect(Math.max(...ys)).toBeCloseTo(10, 6);
  });

  it("finds nothing for shapes that only meet at a corner", () => {
    // Diagonal neighbours share exactly one point — a meeting, not a border.
    expect(sharedBorders(square(0, 0, 10), square(10, 10, 10))).toEqual([]);
  });

  it("finds nothing for shapes that do not touch", () => {
    expect(sharedBorders(square(0, 0, 10), square(50, 50, 10))).toEqual([]);
  });

  it("finds nothing when one shape has no geometry", () => {
    expect(sharedBorders([], square(0, 0, 10))).toEqual([]);
    expect(sharedBorders(square(0, 0, 10), [])).toEqual([]);
  });

  it("treats vertices coincident within epsilon as shared", () => {
    const borders = sharedBorders(square(0, 0, 10), square(10 + BORDER_EPSILON / 2, 0, 10));
    expect(borders.length).toBeGreaterThan(0);
  });

  it("does not treat vertices beyond epsilon as shared", () => {
    expect(sharedBorders(square(0, 0, 10), square(10 + BORDER_EPSILON * 3, 0, 10))).toEqual([]);
  });

  it("joins a border that straddles the start of the vertex list", () => {
    // The square's list starts at (0,0), so a neighbour to the left owns a run
    // that wraps the seam. Without rotation this comes out as two fragments.
    const a = square(0, 0, 10);
    const b = square(-10, 0, 10);
    const borders = sharedBorders(a, b);
    expect(borders).toHaveLength(1);
  });

  it("returns several polylines when shapes touch along separate stretches", () => {
    // A neighbour on each side: two disjoint borders.
    const a = square(0, 0, 10);
    const b = [...square(10, 0, 10), ...square(-10, 0, 10)];
    expect(sharedBorders(a, b).length).toBeGreaterThanOrEqual(2);
  });

  it("does not join across a jump between subpaths", () => {
    // Two far-apart stretches of "shared" vertices in one list must not be
    // connected by a line across the gap between them.
    const a: Point[] = [
      [0, 0],
      [0, 1],
      [0, 2],
      [500, 0],
      [500, 1],
      [500, 2],
    ];
    const b: Point[] = [...a];
    const borders = sharedBorders(a, b);
    expect(borders).toHaveLength(2);
    for (const line of borders) {
      const xs = line.map(([x]) => x);
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(5);
    }
  });

  it("handles a shape entirely enclosed by its neighbour", () => {
    const a = square(0, 0, 10);
    expect(() => sharedBorders(a, a)).not.toThrow();
    expect(sharedBorders(a, a).length).toBeGreaterThan(0);
  });

  it("describes the same border from either side", () => {
    const a = square(0, 0, 10);
    const b = square(10, 0, 10);
    const fromA = sharedBorders(a, b).flat();
    const fromB = sharedBorders(b, a).flat();
    // Both runs lie on x = 10 and span the same stretch of y.
    const spanOf = (pts: Point[]) => {
      const ys = pts.map(([, y]) => y);
      return [Math.min(...ys), Math.max(...ys)];
    };
    expect(spanOf(fromA)).toEqual(spanOf(fromB));
  });
});

describe("coastline", () => {
  it("returns the whole perimeter when a shape has no neighbours", () => {
    // An island: every edge faces the sea.
    const a = square(0, 0, 10);
    const lines = coastline(a, []);
    expect(lines).toHaveLength(1);
    expect(lines[0].length).toBeGreaterThan(a.length - 3);
  });

  it("excludes the stretch shared with a neighbour", () => {
    // A coastal province with land to its east: no line runs along x = 10.
    // The run still reaches the corner vertex there, so that the coast meets
    // the border rather than stopping an edge short of it.
    const lines = coastline(square(0, 0, 10), [vertexIndex(square(10, 0, 10))]);
    expect(lines.length).toBeGreaterThan(0);
    expect(edgesAlongX(lines, 10)).toBe(0);
  });

  it("returns nothing when neighbours cover the whole perimeter", () => {
    // Landlocked: every edge abuts something.
    const a = square(0, 0, 10);
    expect(coastline(a, [vertexIndex(a)])).toEqual([]);
  });

  it("excludes an edge facing unclaimed land", () => {
    // Wilderness is an ordinary path, so it turns up among the neighbours and
    // its edge is not coast — it just goes unlined.
    const lines = coastline(square(0, 0, 10), [vertexIndex(square(10, 0, 10)), vertexIndex(square(-10, 0, 10))]);
    expect(edgesAlongX(lines, 10)).toBe(0);
    expect(edgesAlongX(lines, 0)).toBe(0);
  });

  it("splits coast into separate runs around an intervening neighbour", () => {
    // Land east and west leaves the north and south edges as two coasts.
    const lines = coastline(square(0, 0, 10), [vertexIndex(square(10, 0, 10)), vertexIndex(square(-10, 0, 10))]);
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it("ignores a neighbour with no geometry", () => {
    const a = square(0, 0, 10);
    expect(coastline(a, [vertexIndex([])]).length).toBe(1);
  });

  it("returns nothing for a shape with no geometry", () => {
    expect(coastline([], [vertexIndex(square(0, 0, 10))])).toEqual([]);
  });

  it("treats a neighbour within epsilon as touching", () => {
    const lines = coastline(square(0, 0, 10), [vertexIndex(square(10 + BORDER_EPSILON / 2, 0, 10))]);
    expect(edgesAlongX(lines, 10)).toBe(0);
  });

  it("draws the notch at a lone seaward vertex between two borders", () => {
    // One vertex pokes into the water between two land borders. It is a run
    // of one, which describes no stretch by itself, but the edges leading to
    // and from it both face the water and belong to the coast.
    const a: Point[] = [[0, 0], [1, 0], [2, 1], [3, 0], [4, 0], [4, 4], [0, 4], [0, 0]];
    const neighbour = a.filter(([x, y]) => !(x === 2 && y === 1));
    const lines = coastline(a, [vertexIndex(neighbour)]);
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
    for (const line of [...sharedBorders(a, b), ...coastline(a, [vertexIndex(b)])]) {
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
    const border = sharedBorders(a, b).flat().length;
    const coast = coastline(a, [vertexIndex(b)]).flat().length;
    // Every vertex is either on the border or on the coast; the two runs each
    // keep their end vertices, so the total lands within a couple of the
    // perimeter's own count.
    expect(border + coast).toBeGreaterThanOrEqual(a.length - 2);
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

  it("extracts a border between two genuinely adjacent locations", () => {
    const borders = sharedBorders(vertsOf("Uppsala"), vertsOf("Stockholm"));
    expect(borders.length).toBeGreaterThan(0);
    expect(borders.flat().length).toBeGreaterThan(1);
  });

  it("extracts nothing between two locations that are not adjacent", () => {
    // Uppsala and Paris are on opposite ends of the map.
    expect(sharedBorders(vertsOf("Uppsala"), vertsOf("Paris"))).toEqual([]);
  });

  it("finds a border for most of one location's recorded neighbours", () => {
    // Adjacency records a shared vertex; extraction needs a run of two, so a
    // pair touching at a single point legitimately yields nothing.
    const i = ids.indexOf("Uppsala");
    const neighbors = adj[i].map((n) => ids[n]);
    const withBorder = neighbors.filter(
      (n) => sharedBorders(vertsOf("Uppsala"), vertsOf(n)).length > 0,
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
    for (const p of sharedBorders(a, b).flat()) {
      expect(near(a, p)).toBe(true);
      expect(near(b, p)).toBe(true);
    }
  });
});
