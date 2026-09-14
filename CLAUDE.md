# CLAUDE.md — Vespucci (EU5 Save Viewer)

## Approach

- **Functional programming discipline**: pure arrow functions, immutable variables (`const`), no null, every `if` has an `else`, no exceptions thrown
- All lib modules follow this strictly — components use React hooks (inherently stateful) but delegate logic to pure helpers
- Prefer extracting testable pure helpers over inline logic in components
- Binary parser uses two-pass approach: skipBlock to find field offsets, then read values at discovered positions
- Map filling is location-level: each owned location is painted individually, with no province aggregation

## Architecture

```
File Upload (.eu5 or .txt)
  → isBinarySave() check
  → parseBinarySave() or parseMeltedSave()
  → ParsedSave { countryLocations, tagToPlayers, countryColors, overlordSubjects, countryNames }
  → exportMapChartConfig() → location-resolve: lowercase save name → canonical Title_Case id
  → MapChartConfig { groups: hex→{label, paths[]} }   (paths[] are location ids)
  → MapRenderer (SVG coloring + pan/zoom) + MapLegend (interactive)
  → map-bounds: player path geometry → framed region → opening view + PNG crop
  → border-rule + border-segments: ownership + adjacency → country border layer
  → wasteland-rule: ownership + adjacency → wastelands one country encloses
```

### Binary Parser Pipeline
```
.eu5 → find PK offset → fflate unzip → gamestate + string_lookup
  → TokenReader (stateful cursor over binary stream)
  → Section finders (byte-pattern scanning)
  → Section readers: metadata, countries, locations, diplomacy, dependencies, economy, players
  → Dependency filtering: canonical ID check removes stale relationships
```

## Key Paths

- **App entry**: `src/App.tsx` (state management, download handlers, toolbar)
- **Types**: `src/lib/types.ts` (ParsedSave, MapChartConfig, MapStyle, RGB)
- **Binary parser**: `src/lib/binary/parse-binary-save.ts` → `sections/*.ts`
- **Text parser**: `src/lib/save-parser.ts`
- **Location resolution**: `src/lib/location-resolve.ts` (lowercase → canonical id, drops unmapped)
- **Export pipeline**: `src/lib/export.ts` (playersOnly filtering, vassal overlays)
- **MapChart config**: `src/lib/mapchart-config.ts` (color collision avoidance, group building)
- **Style presets**: `src/lib/map-styles.ts` (parchment/modern/dark/satellite/pastel + overrides)
- **Legend sorting**: `src/lib/legend-sort.ts` (alpha, location count, total with subjects)
- **Country names**: `src/lib/country-names.ts` (rank prefix + known names lookup)
- **Country modal**: `src/lib/country-info.ts` + `src/components/CountryModal.tsx`
- **Map framing**: `src/lib/map-bounds.ts` (union player bboxes → padded region → fit transform)
- **Country borders**: `src/lib/border-rule.ts` (which pairs qualify, which locations are coastal) + `src/lib/border-segments.ts` (shared border and coastline polylines)
- **Wasteland fill**: `src/lib/wasteland-rule.ts` (which wastelands one country completely encloses); classification of what is uninhabitable lives in `src/lib/binary/sections/locations.ts`
- **SVG path parsing**: `src/lib/svg-path.ts` (shared by the browser and the adjacency generator)
- **Location adjacency**: `src/lib/location-adjacency.json` (735 KB, neighbour indices parallel to `location-ids.json`) + `src/lib/location-adjacency.ts` (code-split loader)
- **Hand-drawn export**: `src/lib/hand-drawn.ts` (SVG filters + barrel distortion)
- **Canonical location ids**: `src/lib/location-ids.json` (22,711 ids, generated from the SVG)
- **SVG map**: `public/eu-v-locations.svg` (22,711 location paths from MapChart, ~13 MB)
- **Token definitions**: `src/lib/eu5-tokens.json` (13K+ binary token IDs)
- **Stats plan**: `docs/country-stats-plan.md`
- **Coverage checker**: `scripts/check-location-coverage.mjs` (run first if a map renders empty)
- **Id generator**: `scripts/generate-location-ids.mjs` (re-run when the SVG asset is refreshed)
- **Adjacency generator**: `scripts/generate-location-adjacency.mjs` (re-run alongside the id generator whenever the SVG asset is refreshed)

## Dependencies

- **react** 19 + **react-dom** — UI
- **fflate** — ZIP decompression for binary saves
- **jomini** — Clausewitz format parsing
- **vite** 8 — Build tool
- **vitest** + **@testing-library/react** — Testing (jsdom environment)
- **Google Fonts** — Cinzel (titles), Crimson Pro (body) loaded in index.html

## Conventions

- **Never commit or push without explicit user approval** — always wait for the user to say so
- All `function` declarations converted to `const arrow =` expressions
- Sentinel values instead of null: `-1` for missing numbers, `""` for missing strings
- `else` branches on every `if` (even if just `{ /* comment */ }`)
- Tests use `within(container)` for scoped queries (avoids React strict mode double-render issues)
- Binary section readers use `TokenReader` (stateful) but extract decisions into pure helpers
- MapRenderer strips inline `style` attributes from SVG paths before setting fills (some paths have `style="fill:..."` that overrides `fill` attribute)
- `playersOnly` filtering happens AFTER location resolution
- Vassal subject locations are moved to overlay keys (`TAG_vassals`) in the resolution pool
- Unresolvable names (lakes, sea zones, `loc_<id>` placeholders) are dropped at config-build time, so every count from `paths.length` equals shapes actually painted. Wastelands are dropped from the *groups* too — nobody owns them — but the ones a country encloses are painted separately by the view layer
- The map opens framed on player territory rather than the whole world, and `Reset View` returns to that frame. `MapExport.playerPaths` carries the ids; `config.groups` and the exported MapChart JSON are untouched
- The downloaded PNG crops to the **same** region via `framedRegion`, always — never the current on-screen transform, so one save exports one image however the user has panned
- `Outline Width` defaults to **0.3** (borders on), a few steps up from the slider's finest (`min=0 max=2 step=0.1`) and 3x the hairline the SVG asset uses for its own location paths. Because it is non-zero, the adjacency chunk is fetched as soon as a map is shown rather than on demand; the code split still keeps it off the initial page load
- `Outline Width` means **country borders and coastline**, not per-location outlines. A player's territory is lined where it meets a different country and where it meets the sea — never on internal edges, and never against unclaimed land
- Border ownership comes from `ParsedSave.countryLocations`, **not** `config.groups`: the config is filtered by `playersOnly`, so reading ownership from it would hide every player-versus-AI border in the default mode
- **A wasteland is filled only when one country owns every land neighbour of it.** A second owner anywhere on that border, or a single unowned neighbour, leaves it grey. Deliberately stricter than a plurality vote, which fills nearly everything but invents ownership the save never asserts. The fill is view-time only: wastelands never enter `config.groups`, so legend counts and the exported MapChart JSON are identical with it on or off
- A filled wasteland is folded into the ownership the outline layer gets, so the country border wraps the enclave. That can add no border — every neighbour shares its tag by the rule that filled it — only coastline
- Stale dependency entries (non-canonical country IDs) are filtered out

## Gotchas

- **The SVG holds land paths only** — all 22,711 of them. Sea zones and lakes have no shape; the ocean is the container's background. That is why a coastline cannot be told apart from a land border by paint order, and why borders are extracted from geometry rather than stroked
- A border belongs to neither adjacent shape, so it cannot be drawn by stroking either one — that traces the whole province, internal edges included. `border-segments.ts` pulls out the vertices the two shapes share
- Coastline is the **complement**, not a border with the sea: since sea zones have no shape, a coast is the stretch of perimeter touching no land neighbour. That also keeps wilderness edges out of it, since unclaimed land is an ordinary path
- **A shape is its rings, not a flat vertex list.** `pathSubpaths` groups a path's endpoints per subpath and `pathVertices` is that flattened; extraction walks rings one at a time, so a line can never run from the end of one to the start of the next. This replaced a `MAX_STEP = 5` distance proxy that guessed where a subpath began, and guessed wrong both ways: it joined 2,726 island-to-mainland gaps narrower than 5 units (drawing lines across water) and broke 51 genuine coastal edges longer than 5 (dropping them), mostly on Baffin Island and the Arctic Archipelago. **Both** sides need rings now: the neighbour arrives as a `boundaryIndex` built from its rings, because an outline is made of edges and an edge only exists between consecutive points of the same ring. A flat list would put an edge from the end of a mainland to the start of its island, straight across the water
- A vertex is either shared with a neighbour or it is not, so the perimeter edge **crossing between border and coast belongs to neither run**. Coastline runs therefore reach one vertex past both ends (`runsOf`'s `reachPastEnds`), and a lone seaward vertex still counts, since the two edges around it both face water. Without the reach there is a nick at every point where a realm's border meets the sea: 2,353 of them on MP_SCO_1453, which a thick stroke's round linecaps hid and a thin one exposes. Borders do not reach, because two borders of the same shape meet at a vertex all three shapes share
- **A vertex is on a border when it lies on the neighbour's *outline*, not when it is near one of the neighbour's *vertices*.** Neighbouring shapes tessellate their shared boundary differently — one puts a vertex where the other draws a single long edge — so a vertex-to-vertex test reads those points as touching nothing and turns them into coastline. That drew specks of "coast" in the middle of contiguous territory: 42% of all coastline runs on MP_BOH_1644 were 4 vertices or shorter, and in Western Europe alone 66 runs sat on a neighbour's edge while being 0.15–0.30 from its nearest vertex. `boundaryIndex` measures distance to the segments and reports 0 of them
- Border and coastline extraction costs roughly 0.9 s on a large multiplayer save, so it is cached on ownership and adjacency — restyling redraws without re-extracting. The segment test is *faster* than the vertex test it replaced, despite doing more per query, because it stopped allocating a string key per cell lookup and compares squared distances
- All ~9,400 borders are subpaths of **one** `<path>` element. Thousands of separate elements render far worse
- Anything layered into `.map-svg` must sit inside a `<g>`: the asset's stylesheet scopes `.map-svg > path { stroke-width }`, and author CSS beats a presentation attribute, so a direct-child path is forced to the location stroke width
- `src/lib/location-adjacency.json` is 735 KB, over half the app bundle. It is code-split behind `location-adjacency.ts` and fetched only when borders are switched on; **never import it statically**
- `scripts/generate-location-adjacency.mjs` imports a `.ts` module and relies on Node's native type stripping (>= 23.6). It is the one script that will not run on older Node
- **The sea is not a neighbour of a wasteland.** The asset holds land paths only, so a coastal wasteland simply has fewer entries in the adjacency graph and open water never disqualifies it. There is no way to tell "borders the sea" from "borders nothing" in the graph alone
- **Wastelands resolve as connected components, not one at a time.** A chain member's neighbours are mostly other wastelands, so per-location resolution leaves every chain interior unfilled (nothing owned borders it) and lets two touching wastelands take different colours. On both sample saves the 1,895 wasteland shapes form 1,351 components, 150 of which border nothing at all and can never fill
- **`MapTab`'s `wastelandFills` and `outlineOwnership` must stay memoised.** `MapRenderer` compares the ownership object by *identity* to decide whether to re-extract border geometry, which costs over a second on a large save — a fresh-but-equal object each render pays that on every colour tweak. No DOM assertion can see the difference, which is why `MapTab.ownership.test.tsx` stubs the renderer and asserts on the props
- Uninhabitable classification is derived from the *shape* of a location's database entry — unowned with no depth-1 `population` field — because saves carry no wasteland flag and names are no help (`Alaska_Range`, `Kyzylkum_Desert` carry no marker substring). It yields the same 1,895 shaped locations on saves 191 years apart, as static map topology should. Sea zones and lakes classify as uninhabitable too; nearly all of them are dropped for having no shape (5,785 of 7,680 names on the sample saves), but a handful of lakes do have one — `Siljan` and `Wellington_Lake` are painted as land when a country rings them. Two shapes out of 645 fills, and there is no lake signal in the save to filter on
- **jsdom implements neither `getBBox` nor layout**, so geometry-measuring code needs a fallback in production and a prototype stub in tests. `map-bounds.ts` reads `getBBox` inside a try/catch and degrades to the whole-map view; a component test that forgets the stub silently exercises that fallback instead of the feature, so assert both paths deliberately
- jsdom's `canvas.getContext("2d")` returns **null**, and `handleDownloadMap` bails on it before reaching the clone — a download test has to stub the context or it observes nothing
- `.map-svg` is `width: 100%` inside the transformed `.map-transform` wrapper, so viewBox→pixel conversion derives from the **container's** width. Measuring the SVG's own bounding rect folds the live transform back in and makes the fit depend on its own output
- Effects keyed on an array prop must compare **contents**, not identity: a parent that rebuilds the array each render would re-run them forever. `MapRenderer`'s fit effect guards on contents for exactly this reason
- The root `tsconfig.json` has `"files": []` and only project references, so a bare `npx tsc --noEmit` type-checks **nothing** and passes vacuously. Use `npx tsc -b` (what `npm run build` runs)
- **`locationNames` is keyed by location id, not array position.** The save's name list is a positional array of N entries, but the gamestate's location database is keyed 1..N, so array position i names location id i+1. Both parsers index from 1 (`binary/sections/metadata.ts`, `save-parser.ts`) so every `locationNames[locId]` lookup is correct by construction — never reintroduce a `- 1` at a call site. Reading the array 0-based labels each owned location with its predecessor's name: frontier provinces flip to the neighbouring country and inland ones inherit the lake that precedes them, which then drops at resolution. On MP_BOH_1644 that was 392 of 19,239 owned locations lost, on MP_SCO_1453 267 of 13,812
- **Saves emit lowercase location names (`stockholm`); MapChart path IDs are Title_Case (`Stockholm`). Exact-case matching finds ZERO of 22,711 — resolution must go through `location-resolve.ts`.** 128 ids carry lowercase particles (`Bar_le_Duc`, `Halle_an_der_Saale`) that per-segment title-casing cannot reproduce, which is why the id list is stored rather than derived
- `MapRenderer` parses the 13 MB document once on mount and recolors live nodes; the recolor pass must stay idempotent over fill, the inline `style` attribute and the `.outline-layer`, or repeated runs accumulate DOM
- `stroke-width` lives in a `<style>` inside the SVG scoped `.map-svg > path`; a descendant selector would override the outline clones' own stroke-width (author CSS beats SVG presentation attributes)
- Vitest runs with `globals: false`, so RTL auto-cleanup does NOT register — call `cleanup()` explicitly or `#id` selectors resolve to stale trees. A suite that forgets it also breaks `waitFor`: with every previous tree still mounted, a poll for a painted path never settles and the test times out looking like a product bug
- Some SVG paths have inline `style="fill:..."` — must `removeAttribute("style")` before coloring
- `countryNames` field on `ParsedSave` stores full display names (e.g., "Kingdom of Bohemia"), not raw tags
- Dynamic countries (AAA/ABA/ACA/ADA/AEA prefixes) are game-created nations with `country_name` like "usolye_province"
- FIXED5 tokens: unsigned 0x0D48-0x0D4E payload=`tok-0x0D48+1`, signed 0x0D4F-0x0D55 payload=`tok-0x0D4F+1` (both 1-7 bytes); values / 1000
- 64-bit value tokens: `F64=0x0167`, `U64=0x029c`, `I64=0x0317` (8-byte payloads); diagnostic scripts often use wrong constants causing depth explosion
- `raw_material_size` (token 0x2e54) does NOT appear in location entries — RGO "levels" are always 1 per location (no per-location level count in saves)
- `currency_data` block has bare FIXED5 values (no braces around individual fields like `gold = FIXED5`)
- Dependency entries can have multiple IDs for the same tag — only canonical ID (from `countries > tags`) is valid
- `paper.js` requires real canvas — doesn't work in jsdom/tests
- `feDisplacementMap` for fisheye doesn't work (pushes uniformly) — use canvas barrel distortion instead
- `handleDownloadMap` reads from the rendered DOM SVG, so color overrides are automatically included

## Scripts

- `npm run dev` — Vite dev server (port 5173)
- `npm run build` — TypeScript check + Vite production build
- `npm run test` — Vitest watch mode
- `npm run test:coverage` — Coverage report
- `node scripts/check-location-coverage.mjs <save.eu5>` — verify save names still line up with the map asset
- `node scripts/generate-location-ids.mjs` — regenerate `src/lib/location-ids.json` from the asset
- `node scripts/generate-location-adjacency.mjs [epsilon]` — regenerate `src/lib/location-adjacency.json` from the asset (run after the id generator; the two must stay in step). Needs Node >= 23.6, since it imports the TypeScript vertex parser directly

## Diagnostics

Standalone Node.js scripts for binary parser debugging live in `diagnostics/` (gitignored).
They load a save file directly from the project root (e.g. `MP_BOH_1644.eu5`) without needing the browser.
Run with: `node diagnostics/<script>.mjs`

Each script unzips the save, reads `gamestate` + `string_lookup`, and probes specific structures.
When debugging binary parsing issues, place new diagnostic scripts here rather than in the project root.

Past scripts (RGO / raw_material investigation):
- `diag-rgo.mjs` — Path-trace from countries section to raw_material; found depth explosion from 0x0D4A misclassification
- `diag-rgo2.mjs` — Scanned context around first raw_material occurrences near locations section
- `diag-rgo3.mjs` — Targeted walk to 40017059 treating 0x0D4A as FIXED5(3-byte); confirmed it's a value type
- `diag-rgo4.mjs` — Multi-part: locations section scan, block at 40M with correct FIXED5 treatment, revealed LOOKUP_U16 pattern
- `diag-rgo5.mjs` — Found 497 raw_material hits in 170M-175M; revealed `raw_material = LOOKUP_U16(idx)` and 0x0D3E pattern
- `diag-rgo6.mjs` — Full location entry structure dump; scanned for employment/counters tokens; confirmed LOOKUP structure
- `diag-verify.mjs` — Final verification: reads dynStrings, confirms 769/1000 locations return real goods names; confirmed `raw_material_size` absent from all entries

## Branches

- **main** — Stable, deployed
- **country-stats** — Economy parsing, country modal, legend sorting, hand-drawn export
- **globe-view** — Experimental globe projection (paused)
- **map-filters** — Hand-drawn SVG filter export
- **styling-improvements** — Merged: 5 style presets, color overrides, outline system
