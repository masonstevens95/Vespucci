# CLAUDE.md — Vespucci (EU5 Save Viewer)

## Approach

- **Functional programming discipline**: pure arrow functions, immutable variables (`const`), no null, every `if` has an `else`, no exceptions thrown
- All lib modules follow this strictly — components use React hooks (inherently stateful) but delegate logic to pure helpers
- Prefer extracting testable pure helpers over inline logic in components
- Binary parser uses two-pass approach: skipBlock to find field offsets, then read values at discovered positions
- Province mapping uses majority voting: when multiple countries own locations in the same MapChart province, the one with most locations wins

## Architecture

```
File Upload (.eu5 or .txt)
  → isBinarySave() check
  → parseBinarySave() or parseMeltedSave()
  → ParsedSave { countryLocations, tagToPlayers, countryColors, overlordSubjects, countryNames }
  → exportMapChartConfig() with province majority voting
  → MapChartConfig { groups: hex→{label, paths[]} }
  → MapRenderer (SVG coloring + pan/zoom) + MapLegend (interactive)
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
- **Province mapping**: `src/lib/province-mapping.ts` (majority voting algorithm)
- **Export pipeline**: `src/lib/export.ts` (playersOnly filtering, vassal overlays)
- **MapChart config**: `src/lib/mapchart-config.ts` (color collision avoidance, group building)
- **Style presets**: `src/lib/map-styles.ts` (parchment/modern/dark/satellite/pastel + overrides)
- **Legend sorting**: `src/lib/legend-sort.ts` (alpha, province count, total with subjects)
- **Country names**: `src/lib/country-names.ts` (rank prefix + known names lookup)
- **Country modal**: `src/lib/country-info.ts` + `src/components/CountryModal.tsx`
- **Hand-drawn export**: `src/lib/hand-drawn.ts` (SVG filters + barrel distortion)
- **Province mapping JSON**: `src/lib/mapchart_province_mapping.json` (30K+ mappings)
- **SVG map**: `public/eu-v-provinces.svg` (3,837 province paths from MapChart)
- **Token definitions**: `src/lib/eu5-tokens.json` (13K+ binary token IDs)
- **Stats plan**: `docs/country-stats-plan.md`

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
- `playersOnly` filtering happens AFTER province majority voting, not before — prevents player minorities from claiming non-player majority provinces
- Vassal subject locations are moved to overlay keys (`TAG_vassals`) in the voting pool
- Stale dependency entries (non-canonical country IDs) are filtered out

## Gotchas

- SVG province path IDs must exactly match MapChart province names (underscore-separated, Title_Case)
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
