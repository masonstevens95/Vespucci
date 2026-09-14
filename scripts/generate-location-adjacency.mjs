/**
 * generate-location-adjacency.mjs
 *
 * Derives a location adjacency graph from the committed locations SVG and
 * writes it to src/lib/location-adjacency.json.
 *
 * Why this exists: EU5 saves carry no adjacency data. The `adjacency` and
 * `fill_in_impassable` tokens in eu5-tokens.json are game map-mode settings,
 * and every apparent hit in a melted save is a LOOKUP_U16 decode artifact.
 * Map topology lives in the game's map definition files, not in the save, so
 * the shipped SVG's own geometry is the only source.
 *
 * How it works: touching shapes in this asset share border vertices
 * near-exactly at its 2-decimal precision, so matching path endpoints within
 * a small epsilon reproduces true topology. Verified against known neighbour
 * sets:
 *
 *   Uppsala      -> Tierp, Heby, Enkoping, Stockholm, Norrtalje
 *   Alaska_Range -> Denali, Cantwell, Kahiltna, Paxson, ... (13 total)
 *
 * Detached shapes (island wastelands such as Amrum_Island_Wasteland) share no
 * border and correctly yield no neighbours.
 *
 * Requires Node >= 23.6 (or --experimental-strip-types), because it imports
 * the shared TypeScript vertex parser rather than duplicating it.
 *
 * Re-run this whenever public/eu-v-locations.svg is refreshed, alongside
 * scripts/generate-location-ids.mjs — the two assets must stay in step.
 *
 * Expected shape for the current asset (measured 2026-09-14):
 *   paths                22711
 *   vertices            747208
 *   ids with neighbours   22271
 *   isolated ids            440  (islands and detached shapes)
 *   edges                 62621
 *
 *   node scripts/generate-location-adjacency.mjs [epsilon]
 */
import { readFileSync, writeFileSync } from "fs";
import { pathVertices } from "../src/lib/svg-path.ts";

const SVG_PATH = "public/eu-v-locations.svg";
const OUT_PATH = "src/lib/location-adjacency.json";
const IDS_PATH = "src/lib/location-ids.json";
const ROOT_ID = "svg109";

/**
 * Vertex match distance in viewBox units (the asset is 1200x680).
 *
 * Shared borders resolve identically anywhere from 0.10 to 0.50 because
 * touching shapes reuse vertices; 0.15 sits inside that plateau while staying
 * far below the width of the narrowest genuine sea gap.
 */
const DEFAULT_EPSILON = 0.15;

/** Extract id + path data for every shape, excluding the root <svg> element. */
const extractPaths = (svg) =>
  [...svg.matchAll(/<path\s[^>]*id="([^"]+)"[^>]*\sd="([^"]+)"/g)]
    .map((m) => ({ id: m[1], d: m[2] }))
    .filter((p) => p.id !== ROOT_ID);

/**
 * Build a symmetric adjacency map from per-shape vertex lists.
 *
 * Vertices are bucketed into a grid sized to epsilon so each vertex is only
 * compared against the nine surrounding cells rather than all ~747k. Cell
 * membership is a filter, not a verdict — every candidate pair is confirmed
 * by actual distance.
 */
export const buildAdjacency = (shapes, epsilon) => {
  const grid = new Map();
  const cellKey = (cx, cy) => `${cx},${cy}`;

  shapes.forEach((shape, index) => {
    for (const [x, y] of shape.vertices) {
      const key = cellKey(Math.floor(x / epsilon), Math.floor(y / epsilon));
      const bucket = grid.get(key);
      if (bucket === undefined) {
        grid.set(key, [index]);
      } else {
        bucket.push(index);
      }
    }
  });

  const pairs = new Set();
  shapes.forEach((shape, index) => {
    for (const [x, y] of shape.vertices) {
      const cx = Math.floor(x / epsilon);
      const cy = Math.floor(y / epsilon);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const bucket = grid.get(cellKey(cx + dx, cy + dy));
          if (bucket === undefined) {
            continue;
          } else {
            /* cell holds vertices — test each owner below */
          }
          for (const other of bucket) {
            if (other <= index) {
              continue;
            } else {
              /* only test each unordered pair once */
            }
            const key = index * shapes.length + other;
            if (pairs.has(key)) {
              continue;
            } else {
              /* pair not yet confirmed — measure it */
            }
            for (const [px, py] of shapes[other].vertices) {
              if (Math.hypot(px - x, py - y) <= epsilon) {
                pairs.add(key);
                break;
              } else {
                /* too far — keep looking */
              }
            }
          }
        }
      }
    }
  });

  const adjacency = {};
  for (const key of pairs) {
    const a = shapes[Math.floor(key / shapes.length)].id;
    const b = shapes[key % shapes.length].id;
    (adjacency[a] ??= []).push(b);
    (adjacency[b] ??= []).push(a);
  }

  // Sorted so a regenerated asset diffs cleanly against the committed one.
  for (const id of Object.keys(adjacency)) {
    adjacency[id].sort();
  }
  return Object.fromEntries(
    Object.keys(adjacency)
      .sort()
      .map((id) => [id, adjacency[id]]),
  );
};

/**
 * Re-key a name-keyed adjacency map onto location-ids.json's own ordering.
 *
 * The stored asset is an array parallel to that id list, holding neighbour
 * *indices* rather than names. It roughly halves the file, since every name
 * would otherwise be repeated once per edge, and makes "every neighbour is a
 * canonical id" structural rather than something a test has to assert. Entry
 * i holds the neighbours of canonicalIds[i]; an isolated shape holds an empty
 * array.
 */
export const toIndexForm = (adjacency, canonicalIds) => {
  const position = new Map(canonicalIds.map((id, i) => [id, i]));
  return canonicalIds.map((id) =>
    (adjacency[id] ?? [])
      .map((n) => position.get(n))
      .filter((i) => i !== undefined)
      .sort((a, b) => a - b),
  );
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

// Guarded so the tests can import the helpers without running the build.
if (process.argv[1]?.endsWith("generate-location-adjacency.mjs")) {
  const epsilon = parseFloat(process.argv[2] ?? String(DEFAULT_EPSILON));

  const svg = readFileSync(SVG_PATH, "utf8");
  const raw = extractPaths(svg);

  const shapes = [];
  const unparsed = [];
  for (const { id, d } of raw) {
    const vertices = pathVertices(d);
    if (vertices.length > 0) {
      shapes.push({ id, vertices });
    } else {
      unparsed.push(id);
    }
  }

  const adjacency = buildAdjacency(shapes, epsilon);

  // The asset is keyed by position in location-ids.json, so that list is the
  // authority on ordering. Drift between the two would silently mis-map every
  // neighbour, so refuse to write rather than emit a corrupt graph.
  const canonicalIds = JSON.parse(readFileSync(IDS_PATH, "utf8"));
  const shapeIds = new Set(shapes.map((s) => s.id));
  const missing = canonicalIds.filter((id) => !shapeIds.has(id));
  if (missing.length > 0) {
    console.error(
      `[generate-location-adjacency] ${missing.length} id(s) in ${IDS_PATH} have no path ` +
        `in ${SVG_PATH}: ${missing.slice(0, 10).join(", ")}. ` +
        `Re-run scripts/generate-location-ids.mjs first — aborting.`,
    );
    process.exit(1);
  } else {
    /* every canonical id has a shape — index form is safe to build */
  }

  writeFileSync(
    OUT_PATH,
    `${JSON.stringify(toIndexForm(adjacency, canonicalIds), null, 0)}\n`,
  );

  const vertexCount = shapes.reduce((sum, s) => sum + s.vertices.length, 0);
  const counts = shapes.map((s) => (adjacency[s.id] ?? []).length);
  const isolated = shapes.filter((s) => adjacency[s.id] === undefined);
  const histogram = {};
  for (const n of counts) {
    const bucket =
      n === 0 ? "0" : n <= 4 ? "1-4" : n <= 8 ? "5-8" : n <= 14 ? "9-14" : "15+";
    histogram[bucket] = (histogram[bucket] ?? 0) + 1;
  }

  console.log(`[generate-location-adjacency] ${SVG_PATH} -> ${OUT_PATH}`);
  console.log(`  epsilon:             ${epsilon}`);
  console.log(`  paths:               ${raw.length}`);
  console.log(`  vertices:            ${vertexCount}`);
  console.log(`  ids with neighbours: ${Object.keys(adjacency).length}`);
  console.log(`  isolated ids:        ${isolated.length}`);
  console.log(`  neighbour counts:    ${JSON.stringify(histogram)}`);

  // An outlier sweep: a shape with an implausible neighbour count is the
  // signal that epsilon has started bridging shapes that do not touch. Large
  // deserts and jungles legitimately border many locations; a small province
  // doing so does not.
  const outliers = shapes
    .map((s) => ({ id: s.id, n: (adjacency[s.id] ?? []).length }))
    .filter((s) => s.n > 20)
    .sort((a, b) => b.n - a.n)
    .slice(0, 10);
  if (outliers.length > 0) {
    console.log(
      `  high-degree ids:     ${outliers.map((o) => `${o.id}(${o.n})`).join(", ")}`,
    );
  } else {
    /* no shape exceeded the plausible-degree threshold */
  }

  if (unparsed.length > 0) {
    console.warn(
      `[generate-location-adjacency] ${unparsed.length} path(s) yielded no vertices ` +
        `and were skipped: ${unparsed.slice(0, 10).join(", ")}`,
    );
  } else {
    /* every path parsed */
  }
}
