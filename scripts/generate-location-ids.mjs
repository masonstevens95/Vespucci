/**
 * generate-location-ids.mjs
 *
 * Extracts the canonical MapChart location path IDs from the committed
 * locations SVG and writes them to src/lib/location-ids.json.
 *
 * Why this exists: EU5 saves emit location names in lowercase snake_case
 * ("stockholm") while MapChart path IDs are Title_Case ("Stockholm"), and
 * 128 IDs carry lowercase particles ("Bar_le_Duc", "Halle_an_der_Saale")
 * that per-segment title-casing cannot reproduce. The render and export
 * paths both need the canonical spelling, so it is stored rather than derived.
 *
 * Re-run this whenever public/eu-v-locations.svg is refreshed, then re-run
 * scripts/check-location-coverage.mjs against a save.
 *
 *   node scripts/generate-location-ids.mjs
 */
import { readFileSync, writeFileSync } from "fs";

const SVG_PATH = "public/eu-v-locations.svg";
const OUT_PATH = "src/lib/location-ids.json";
const ROOT_ID = "svg109";

/** Extract every path id from the SVG, excluding the root <svg> element id. */
const extractIds = (svg) =>
  [...svg.matchAll(/<path\s[^>]*id="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((id) => id !== ROOT_ID);

const svg = readFileSync(SVG_PATH, "utf8");
const ids = extractIds(svg);

const lowered = new Set(ids.map((id) => id.toLowerCase()));
if (lowered.size !== ids.length) {
  console.error(
    `[generate-location-ids] lowercased ids collide: ${ids.length} ids, ${lowered.size} unique. ` +
      `Case-insensitive resolution would be ambiguous — aborting.`,
  );
  process.exit(1);
} else {
  /* ids are unique when lowercased — safe for case-insensitive resolution */
}

writeFileSync(OUT_PATH, `${JSON.stringify(ids, null, 0)}\n`);

console.log(`[generate-location-ids] ${SVG_PATH} -> ${OUT_PATH}`);
console.log(`  path ids:            ${ids.length}`);
console.log(`  unique (lowercased): ${lowered.size}`);
