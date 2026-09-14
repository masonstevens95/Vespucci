---
title: "feat: Fill the map by location instead of province"
type: feat
status: active
date: 2026-09-12
deepened: 2026-09-12
---

# feat: Fill the map by location instead of province

## Summary

Replace province-granularity map filling with location-granularity: swap in MapChart's EU5 Locations map (22,711 paths), color each owned location directly from the save, and delete the majority-voting layer that currently collapses locations into provinces. The asset swap is trivial; the substantive work is the renderer, which re-parses and re-serializes the whole SVG on every style or color change.

---

## Problem Frame

The save already carries per-location ownership, but the render pipeline throws most of it away. `src/lib/province-mapping.ts` folds 22,709 locations into 3,839 MapChart provinces and resolves each province to a single majority owner, so a country holding a minority of locations in a province disappears from the map entirely. Borders are drawn in the wrong place, enclaves vanish, and the province count shown in the UI disagrees with the province count parsed from the save.

This was a pragmatic constraint, not a design choice: `public/eu-v-provinces.svg` is the only geometry the project had. MapChart published a matching Locations map on 2026-01-01, which removes the constraint.

---

## Requirements

- R1. Each owned location is colored with its own owner's color — no majority voting, no collapsing into provinces.
- R2. Location ownership resolves from the save's location names to MapChart's canonical path IDs. Resolution is **case-insensitive**: the save emits lowercase snake_case (`stockholm`), the asset uses Title_Case (`Stockholm`), and exact-case matching finds nothing.
- R3. Locations the save reports but the land map omits (lakes, sea zones, wastelands) are dropped during config building, not surfaced as user-visible errors — but the drop count is observable so name drift cannot pass silently.
- R4. Pan, zoom, style presets, color overrides, the interactive legend, and both downloads keep working at location granularity.
- R5. Changing a style preset or a single country color does not re-parse the whole SVG document.
- R6. User-facing province terminology becomes location terminology wherever the number shown is now a location count.
- R7. `MP_SCO_1453_05_02_cc5bd8de-1d79-424a-a350-3106f06b7050.eu5` renders correctly end to end.
- R8. Every count shown to the user equals the number of shapes actually painted on the map.
- R9. The downloaded MapChart config carries canonical Title_Case path IDs, so it loads on mapchart.net.

---

## Scope Boundaries

- Deriving geometry from EU5 game files or a location-ID bitmap — unnecessary now that the vector asset aligns by name.
- A province/location granularity toggle — location replaces province outright.
- New map modes that location granularity makes possible (terrain, culture, religion, RGO).
- Parse performance of this save's 266 MB gamestate — pre-existing and unchanged by this work.
- `stats.numProvinces` in the country modal — a genuine province count from the save's country database, correctly left as "Provinces".

**Accepted one-way door:** deleting `mapchart_province_mapping.json` removes the project's only location-to-province relation. Any future province-level feature — province stats, a coarse low-zoom aggregation, or compatibility with MapChart's still-published provinces map — must re-source that relation from MapChart or the game files. This is accepted deliberately, not overlooked.

### Deferred to Follow-Up Work

- Shrinking the canonical-ID asset: 22,583 of 22,711 IDs are reproducible by per-segment title-casing, so a ~128-entry exception list plus an algorithm would replace the full list at roughly 1/100th the size. Deferred because a dumb regenerable list cannot drift from the asset, and the byte cost is a wash against the 451 KB mapping JSON being removed.
- SVG path-precision reduction or geometry simplification, if the U3 load-time threshold is met without it.
- Replacing the clone-based outline layer with stroke-based borders.
- Hand-drawn SVG filter export — lives on the `map-filters` branch, not on `country-stats`.

---

## Context & Research

### Verified facts

Measured during planning. The measurement method is stated for each row because an earlier draft of this plan conflated case-insensitive coverage with exact-ID coverage and reached a wrong conclusion.

| Fact | Value | How verified |
|---|---|---|
| Locations SVG source | `https://www.mapchart.net/svg/eu-v-locations.svg` | HTTP 200, `image/svg+xml` |
| Size | 13.07 MB raw, 4.38 MB gzipped | downloaded and measured |
| Paths | 22,711, flat (no `<g>` wrappers) | id-attribute extraction from the asset |
| viewBox / default fill | `0 0 1200 680`, `#d1dbdd` — identical to the provinces SVG | head of file |
| Save location-name casing | 28,562 of 28,573 fully lowercase | raw names from `metadata > compatibility > locations` |
| Asset path-ID casing | 22,711 of 22,711 contain uppercase | id extraction from the asset |
| **Exact-case** asset IDs found in the save | **0 of 22,711** | asset IDs vs raw save names |
| **Case-insensitive** asset IDs found in the save | **22,710 of 22,711** | asset IDs vs lowercased save names |
| The one orphan | `Kingman_Reef`, an uninhabited atoll | same |
| Save names absent from the land map | 5,863, all lakes / sea zones / wastelands | same |
| Asset IDs NOT recoverable by per-segment title-casing | 128 (`Bar_le_Duc`, `Zell_am_See`, `Halle_an_der_Saale`) | title-case round-trip over all asset IDs |
| Location-name uniqueness | all unique, including lowercased | mapping-JSON values; re-confirm against the asset in U1 |

The identical viewBox is what makes pan/zoom, the style system, and the canvas download path survive the swap unchanged.

### Relevant code and patterns

- `src/lib/binary/parse-binary-save.ts` — `buildCountryLocations()` already produces `Record<tag, locationName[]>`. The data side needs no change; province collapsing happens strictly downstream.
- `src/lib/province-mapping.ts` — `normalizeLocation = loc => loc.toLowerCase()` is the reason the current pipeline works at all: it lowercases both sides of the lookup. Deleting this module without preserving a case-normalizing seam is what produces a blank map.
- `src/lib/mapchart-config.ts` — `generateMapChartConfig()` calls `mapToProvinces()` at line 149. This is the single seam where location granularity is lost.
- `src/lib/export.ts` — `exportMapChartConfig()` builds `locToProvince` and threads it through. The `playersOnly` filtering and vassal-overlay logic operate on location lists and carry over intact.
- `src/components/MapRenderer.tsx` — the performance problem: one `useEffect` keyed on `[config, mapStyle, styleOverrides, colorOverrides]` does `fetch` → `DOMParser` → mutate → `XMLSerializer` → `dangerouslySetInnerHTML`. Survivable at 3,837 paths; not at 22,711. Note `if (loading) return <div className="map-loading">` at line 192 — the ref'd container is absent from the DOM during load.
- `src/components/MapTab.tsx` — `outlineWidth` is a live `<input type="range" min="0" max="2" step="0.1">`, so one drag fires many recolors. `handleDownloadMap` serializes the live SVG, so anything that lives in an external stylesheet is absent from the download.
- `src/lib/legend-sort.ts` — sorts on `group.paths.length`, which becomes a location count with no logic change. Only the `"provinces"` mode name and button tooltips need renaming.
- `src/lib/logger.ts` — `createLogger` is the established channel for diagnostics; the drift warning in U3 uses it rather than introducing a new mechanism.

### Project conventions that constrain the work

From `CLAUDE.md`:
- Pure arrow functions, `const`, no `null`, every `if` has an `else`, no thrown exceptions in lib modules.
- Sentinel values instead of `null`: `-1` for missing numbers, `""` for missing strings.
- Strip inline `style` attributes from SVG paths before setting fills — some paths carry `style="fill:..."` that overrides the `fill` attribute.
- SVG path IDs must exactly match MapChart names (underscore-separated, Title_Case).
- Tests use `within(container)` for scoped queries.

---

## Key Technical Decisions

- **Resolve save names to canonical IDs through a generated ID list, not by direct name matching.** An earlier draft asserted names could match the asset directly with no intermediate table; that is false — exact-case matching finds 0 of 22,711. A committed `src/lib/location-ids.json`, extracted from the asset itself, gives `mapchart-config.ts` a lowercase-keyed index to canonical IDs. This single addition resolves three problems at once: the renderer gets IDs that match the DOM exactly, the config export gets the Title_Case spelling mapchart.net requires, and unmatched names are dropped before they reach `config.groups` so every displayed count matches what is painted. Unlike the hand-maintained mapping JSON it replaces, it is regenerable from the committed asset in one command, so it cannot drift from it.

- **Reject per-segment title-casing as the casing mechanism.** It would avoid the ID list entirely but fails on 128 IDs with lowercase particles (`Bar_le_Duc`, `Halle_an_der_Saale`), producing configs that silently fail to load for those locations.

- **Commit the locations SVG as a repo asset rather than fetching from mapchart.net at runtime.** Costs ~13 MB of repo weight (partly offset by deleting the 6.1 MB provinces SVG and 451 KB mapping JSON); avoids a third-party runtime dependency, a CORS surface, and breakage when MapChart revises the file.

- **Split the renderer's single effect into a mount-time parse and a cheap recolor pass, coordinated by an explicit readiness flag.** Parse and inject once; on config or override change, mutate `fill` on live nodes. The readiness flag is load-bearing, not incidental: the load is async, so without it the recolor effect runs once on mount against an empty path map and never re-runs, and the map sits uncolored until the user happens to touch a control.

- **Make the recolor pass idempotent over the whole document, not just fills.** It must clear the existing `.outline-layer` and `removeAttribute("style")` on every path before re-deriving. The current code gets away with a non-idempotent pass only because it rebuilds the document from `fetch` every time; once parse moves to mount, a pass that only sets `fill` accumulates outline clones and leaves stale `transform: scale(0.995)` hairline gaps behind.

- **Scope the `stroke-width` rule with a child combinator inside the SVG, not as an external `.map-svg path` rule.** Moving it off 22,711 per-node attributes is the right instinct, but author CSS beats SVG presentation attributes, so a descendant rule would override the `stroke-width` the outline clones set on themselves — a thin outline on screen and a correct thick one in the download, since `handleDownloadMap` serializes away from the external stylesheet. A `<style>` element injected into the SVG using `.map-svg > path` keeps outline clones (nested in `<g class="outline-layer">`) on their own value and survives serialization.

- **Look paths up through a `Map<string, SVGPathElement>` built once from `querySelectorAll("path")`** — for lookup cost, one pass instead of repeated document queries. Path IDs must stay on the injected nodes regardless, because `handleMapClick` reads `target.getAttribute("id")` to resolve the owning tag.

- **Keep R3's silent-skip behavior but make the drop count observable.** The plan's most likely failure — a game patch or asset revision drifting names — is visually indistinguishable from success, because ~5,864 misses are expected. Comparing the miss count against that measured baseline separates expected misses from new ones at no cost.

- **The country modal will show a location count next to the save's parsed province count.** Today both rows say "Provinces" and disagree because majority voting discards minority holdings. Relabeling the first to "Locations", with microcopy naming the difference, makes the two numbers legitimately different quantities rather than a visible inconsistency.

- **Sequence the irreversible deletions last.** Removing the provinces SVG and the mapping layer is one-way, and the plan's own risk table flags render performance, rasterization, and visual legibility as unverified. U7 holds the deletions until U3, U4, and U6 have passed, so the fallback path stays open exactly where uncertainty is highest.

---

## Open Questions

### Resolved During Planning

- Does location-level geometry exist in an obtainable form? Yes — MapChart's EU5 Locations map, directly fetchable, structurally identical to the provinces map already in use.
- Do save location names match the asset's path IDs? Case-insensitively yes (22,710 of 22,711); by exact case, no (0 of 22,711). This is why R2 specifies case-insensitive resolution.
- Can canonical casing be derived algorithmically instead of stored? No — 128 IDs are not reproducible by title-casing.
- Do location names need disambiguation? No — names are unique even lowercased. U1 re-confirms this against the asset rather than the mapping JSON.
- Is the asset size prohibitive? No — 4.38 MB over the wire with gzip, versus 2.1 MB for the provinces map it replaces.
- Does the outline clone layer need redesigning? Not for this work, but the recolor pass must clean it up (see Key Technical Decisions).

### Deferred to Implementation

- **Click hit targets.** Shapes go from ~14.6 to ~6 viewBox units across, so clicking a country in a dense region such as the Holy Roman Empire gets materially harder and mis-clicks open the wrong country's modal. The legend's clickable labels remain an unaffected path to the same modal. Decide during U3/U4 whether that fallback is sufficient or whether the map needs a hover preview or zoom-gated hit area; do not design this blind.
- **Zoom repaint cost.** Panning should be safe — `.map-transform` already carries `will-change: transform` — but a scale change forces re-rasterization of the layer's vector content, and some presets apply a CSS `filter` over every path. This is unmeasured, no unit owns it, and the risk table's rasterized-fallback mitigation is unscoped work. Measure during U3 before assuming node count is free.
- **Location-index alignment.** `buildCountryLocations` joins `locationOwners` (IDs) to names indexed from zero, and `parse-binary-save.ts:489` hedges elsewhere with `locationNames[m.centerLocation - 1]` and the comment `capital=N, center=N+1`. Majority voting would absorb a one-slot index shift; per-location coloring will paint neighbours' colors instead, and R7's visual check cannot tell a correct map from a uniformly shifted one. Spot-check one country's location set against known 1453 ground truth during U3.
- Whether location granularity needs a different default `strokeWidth` than the current `0.15` — U4, decided by looking at the rendered map.
- Whether `Download Map` canvas rasterization holds up at 22,711 paths — U6, decided by observation.
- Whether mapchart.net matches imported path IDs case-sensitively. Emitting canonical IDs makes this moot either way, so it does not gate the work.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

Pipeline before and after:

```
BEFORE
  save → countryLocations: Record<tag, lowercaseName[]>
       → buildLocationToProvince(mapping JSON)   ← 451 KB hand-maintained table
       → buildProvinceVotes → majorityOwner      ← minority owners discarded
       → groups: Record<hex, {label, paths[]}>   ← province ids
       → color eu-v-provinces.svg (3,837 paths)

AFTER
  save → countryLocations: Record<tag, lowercaseName[]>
       → resolve via location-ids index (lowercase → canonical)
         ├─ hit  → canonical Title_Case id
         └─ miss → dropped, counted (R3)
       → groups: Record<hex, {label, paths[]}>   ← canonical location ids
       → color eu-v-locations.svg (22,711 paths)
```

Renderer effect split — the core of U3:

```
effect A  deps: []                     runs once
  fetch → parse → strip inline styles
  → build Map<pathId, element>
  → inject into container  (container must already be in the DOM)
  → inject <style> element for stroke-width
  → set ready = true

effect B  deps: [ready, config, colorOverrides, style]
  if (!ready) return
  RESET:  remove .outline-layer; removeAttribute("style") on all paths;
          fill = default
  APPLY:  per group → look up path → set fill; stroke = own fill
  OUTLINE (only when outlineWidth > 0): rebuild clones + shrink transform
  REPORT: miss count vs ~5,864 baseline → one warning if exceeded
```

Two properties carry the design: effect B is gated on `ready` so the first paint is colored, and its reset covers the outline layer and inline styles so repeated runs converge to the same DOM rather than accumulating.

---

## Implementation Units

- U1. **Add the locations asset and its generated ID list**

**Goal:** The asset, a canonical-ID list derived from it, and a committed coverage checker all exist.

**Requirements:** R2, R9

**Dependencies:** None

**Files:**
- Create: `public/eu-v-locations.svg` (from `https://www.mapchart.net/svg/eu-v-locations.svg`)
- Create: `src/lib/location-ids.json` (flat array of canonical path IDs, generated)
- Create: `scripts/generate-location-ids.mjs`
- Create: `scripts/check-location-coverage.mjs`
- Test: `src/lib/__tests__/location-ids.test.ts`

**Approach:**
- Download the asset as MapChart serves it — no minification in this unit.
- `generate-location-ids.mjs` extracts `id` attributes from the committed SVG and writes the array; run it once and commit the output. Regeneration is a single command when the asset is refreshed.
- `check-location-coverage.mjs` compares the asset's IDs against a save's location names **using the same normalization the renderer uses**, and reports hit count, miss count, and any asset ID absent from the save. It must live in `scripts/` and not `diagnostics/` — `diagnostics/` is gitignored at `.gitignore:32`, so a checker placed there exists in no clone, no CI run, and no future session.
- Run the checker against the SCO save and confirm the planning figures reproduce: 22,710 hits, 1 orphan, ~5,863 water/wasteland misses.
- Re-confirm ID uniqueness against the asset (both exact and lowercased). The planning measurement used the mapping JSON's 22,709 values, which is a demonstrably different set from the asset's 22,711 paths — and the two extra paths are unidentified.
- Delete nothing in this unit. Deletions are U7.

**Patterns to follow:**
- Existing `diagnostics/*.mjs` scripts show the established standalone-Node shape; this one is promoted into `scripts/` for durability.

**Test scenarios:**
- Happy path: the generated list has 22,711 entries and every entry appears as a path ID in the asset.
- Happy path: lowercasing every entry yields no collisions.
- Edge case: `Bar_le_Duc` and `Halle_an_der_Saale` appear with their exact particle casing, proving the list preserves what title-casing would destroy.
- Edge case: the coverage checker run against a save with no matching names reports zero hits rather than throwing.

**Verification:**
- The asset is ~13 MB with 22,711 paths and `viewBox="0 0 1200 680"`.
- `node scripts/check-location-coverage.mjs <save>` reproduces the coverage figures in the Verified facts table.
- `public/eu-v-provinces.svg` is still present and still referenced by `MapRenderer` — U1 through U3 form a single atomic changeset, and the app is not expected to work between them.

---

- U2. **Resolve locations to canonical IDs in the config pipeline**

**Goal:** Config groups carry canonical location IDs, and the majority-voting call is gone from the pipeline.

**Requirements:** R1, R2, R3, R8, R9

**Dependencies:** U1

**Files:**
- Create: `src/lib/location-resolve.ts` (lowercase-keyed index + resolution, replacing `normalizeLocation`'s role)
- Modify: `src/lib/mapchart-config.ts` (resolve names to canonical IDs; drop the `mapToProvinces` call and `locToProvince` parameter)
- Modify: `src/lib/export.ts` (drop `buildLocationToProvince` and the `provinceMapping` argument)
- Modify: `src/lib/types.ts` (drop `provinceMapping` from `ExportOptions`)
- Modify: `src/lib/index.ts` (swap the `province-mapping` re-exports for `location-resolve`)
- Modify: `src/App.tsx` (drop the mapping import, the `locToProvince` state field, and both props)
- Modify: `src/components/DebugPanel.tsx` (replace the Province Mapping accordion with a resolution-coverage panel: resolved count, dropped count)
- Test: `src/lib/__tests__/location-resolve.test.ts`
- Test: `src/lib/__tests__/export.test.ts`
- Test: `src/lib/__tests__/mapchart-config.test.ts`
- Test: `src/components/__tests__/DebugPanel.test.tsx`
- Test: `src/components/__tests__/App.test.tsx`

**Approach:**
- `location-resolve.ts` builds a `Record<lowercaseName, canonicalId>` once from `location-ids.json` and exposes a pure resolver. This is the case-normalizing seam that `province-mapping.ts` currently provides; it must exist before that module is deleted.
- Resolution happens at config-build time, so unmatched names never enter `config.groups`. That is what makes R8 hold for free — every count derived from `paths.length` counts only paintable shapes.
- Surface the dropped-name count on the returned config or through the logger so U3's drift check and the DebugPanel have a number to show.
- Preserve the surrounding logic in `export.ts` unchanged — `playersOnly` filtering, vassal overlay keys (`TAG_vassals`), label building, and color-collision avoidance all operate on location lists and need no adaptation.
- One hazard genuinely disappears: `CLAUDE.md` notes that `playersOnly` filtering must follow majority voting so player minorities cannot claim non-player-majority provinces. With voting gone that ordering constraint is moot. Keep the current ordering and drop the voting rationale from the comment.

**Patterns to follow:**
- `src/lib/province-mapping.ts` `buildLocationToProvince` shows the established shape for building a lowercase-keyed index; mirror it in `location-resolve.ts`.
- Pure arrow functions, `const`, explicit `else` branches, no exceptions.

**Test scenarios:**
- Happy path: `stockholm` resolves to `Stockholm`; the group's `paths` entry is the canonical spelling, not the save's.
- Happy path: `bar_le_duc` resolves to `Bar_le_Duc` — the case title-casing would get wrong.
- Happy path: two countries owning locations in what was formerly one province produce two groups, each with its own locations — the case majority voting used to collapse.
- Happy path: `playersOnly: true` keeps player tags and drops non-player tags, each retained group keeping its full location list.
- Happy path: a player overlord with subjects produces a `TAG_vassals` group holding the subjects' locations with the lightened overlord color.
- Edge case: an unresolvable name (`malaren`, a lake) is absent from `paths` and counted as dropped — not emitted as an unresolved entry.
- Edge case: a `loc_<id>` synthetic name, which `buildCountryLocations` substitutes when a location ID has no name, resolves to nothing and is counted as dropped.
- Edge case: empty `countryLocations` produces empty `groups` and does not throw.
- Edge case: two countries whose colors collide still resolve to distinct hex keys via the existing nudge logic.
- Integration: `exportMapChartConfig` called with a parsed save and no `provinceMapping` argument compiles and returns groups keyed by hex with canonical location IDs.
- Regression: no module under `src/` imports `province-mapping`.

**Verification:**
- `npm run build` passes.
- Group path arrays contain canonical IDs such as `Stockholm`, and contain no lake or sea-zone names.
- Total paths across groups equals resolved count, and resolved + dropped equals the owned-location count.

---

- U3. **Rework the renderer for 22,711 paths**

**Goal:** The map loads once, paints on first render, and recolors cheaply and idempotently.

**Requirements:** R1, R3, R4, R5

**Dependencies:** U1, U2

**Files:**
- Modify: `src/components/MapRenderer.tsx`
- Test: `src/components/__tests__/MapRenderer.test.tsx`

**Approach:**
- Point the fetch at `/eu-v-locations.svg`.
- Render the container and `.map-transform` wrapper unconditionally, with the spinner as an overlay, replacing the `if (loading) return` early exit at line 192. A mount-time effect has no injection target otherwise — `containerRef.current` is null while the early return holds.
- Effect A: fetch, parse, strip inline `style`, build the path map, inject by node adoption (never serialize the 13 MB document back to a string), inject the `<style>` element, then set `ready`.
- Effect B keyed on `[ready, config, colorOverrides, mapStyle, styleOverrides]`, no-op while `ready` is false.
- Effect B resets before applying: remove any `.outline-layer`, `removeAttribute("style")` on every path, then set default fill. Only then apply group colors and the stroke-matches-fill rule. Without the outline and style removal, dragging the outline slider appends a fresh clone layer per recolor and leaves stale `scale(0.995)` transforms behind as permanent hairline gaps.
- `stroke-width` goes in the injected `<style>` using the child combinator `.map-svg > path`, so outline clones keep their own attribute and the rule survives `handleDownloadMap`'s serialization.
- Count resolution misses during apply and emit a single `createLogger` warning when the count exceeds the measured water/wasteland baseline by a margin. No thrown exception, no UI error — R3 preserved, drift observable.
- Define the fetch-failure state: a message with a retry affordance rather than an indefinite spinner. The current code has no catch path, and the payload doubles.
- Rename `provinceToTagRef` to `locationToTagRef`; the click-to-tag lookup shape is unchanged, and path IDs must remain on the nodes for it to work.
- Spot-check one country's location set against known 1453 ground truth to rule out the index-shift risk in Open Questions.

**Execution note:** Add a characterization test for current coloring behavior against a small fixture SVG before restructuring the effects — this component has no pure-helper seam and the restructure is easy to get subtly wrong.

**Technical design:** *(directional guidance only — see the effect split under High-Level Technical Design.)*

**Patterns to follow:**
- `MapRenderer.tsx` already strips inline `style` before setting fills — preserve this, it is a documented gotcha.
- `src/lib/map-styles.ts` `applyColorOverrides` stays the source of truth for override resolution.
- `src/lib/logger.ts` `createLogger` for the drift warning.
- Existing pan/zoom handlers and `Transform` state are untouched.

**Test scenarios:**
- Happy path: with a fixture SVG and a config coloring two known IDs, those paths get the group hex and unlisted paths get the default fill — asserted after initial load with **no prop changes**, which is the readiness-race case.
- Happy path: a color override applies the override color rather than the original.
- Happy path: each path's `stroke` matches its own `fill`.
- Happy path: the injected stylesheet sets `stroke-width` and an outline clone's own `stroke-width` attribute still wins.
- Edge case: a fixture path carrying inline `style="fill:#ff0000"` renders with the group color, proving the strip happened.
- Edge case: an empty `groups` object leaves every path at the default fill.
- Edge case: a config ID absent from the SVG is skipped without throwing and without affecting other paths.
- Error path: a failed fetch renders the error state with a retry control, not a permanent spinner.
- Integration: recoloring twice with `outlineWidth > 0` leaves exactly one `.outline-layer`.
- Integration: setting `outlineWidth` above zero and back to `"0"` leaves zero `.outline-layer` nodes and no residual inline `style` on any path.
- Integration: changing only `colorOverrides` updates fills with the fetch mock called exactly once.
- Integration: a location reassigned between groups across renders shows the new color and not the old — the reset-then-apply case.
- Integration: clicking a colored path fires the click callback with the owning tag; clicking an uncolored path fires nothing.
- Integration: a miss count above the baseline emits one warning; a miss count at the baseline emits none.

**Verification:**
- Loading the SCO save paints a filled map on first render with no interaction.
- Style-preset and color changes update the map with no visible stall and no second fetch.
- Time from upload to first painted map stays under ~5s on a throttled Fast 3G profile on a mid-tier laptop. Breaching this is what triggers the deferred precision-reduction work, rather than unassigned judgment.
- Zoom remains usable at full extent and in a dense region; record the observation so the deferred rasterization question has data.

---

- U4. **Retune style presets for location scale**

**Goal:** Presets look right when shapes are roughly 6 viewBox units across instead of 14.6.

**Requirements:** R4

**Dependencies:** U3

**Files:**
- Modify: `src/lib/map-styles.ts`
- Modify: `src/components/MapTab.tsx` (only if the outline slider bound needs lowering)
- Test: `src/lib/__tests__/map-styles.test.ts`

**Approach:**
- Render the SCO save under all five presets and judge before changing numbers. Strokes default to matching the fill, so `0.15` may already be correct — do not change it on arithmetic alone.
- Expect the map to read as busier: adjacent same-owner locations now have borders where provinces hid them. That is inherent to the granularity change. If it reads worse than the province map at default zoom, say so explicitly rather than accepting it by default — that outcome is what the deferred stroke-based-border work exists for.
- If the outline clone layer proves too expensive at `max=2`, lower the slider's `max` attribute in `MapTab.tsx`. Do not add a runtime clamp: `outlineWidth` only ever arrives from that bounded range input, so a clamp would guard a value that cannot go out of range.

**Test scenarios:**
- Happy path: each of the five presets returns a complete style config with non-empty `defaultFill` and `strokeWidth`.
- Happy path: a `styleOverrides` entry wins over the preset value for that key.
- Edge case: an empty overrides object returns preset values unchanged.

**Verification:**
- All five presets render legibly at default zoom and zoomed into a dense region such as the Holy Roman Empire, with an explicit judgement recorded on whether legibility regressed against the province map.

---

- U5. **Rename province terminology to location**

**Goal:** Every number that is now a location count is labeled as one, and the two count rows in the modal read as deliberately different quantities.

**Requirements:** R6, R8

**Dependencies:** U2

**Files:**
- Modify: `src/lib/format.ts` (`computeProvinceCount`, `findTagProvinceCount`)
- Modify: `src/lib/legend-sort.ts` (`LegendSortMode` `"provinces"` member)
- Modify: `src/lib/country-info.ts` (`provinceCount` field)
- Modify: `src/components/MapTab.tsx` (the `Provinces` stat)
- Modify: `src/components/MapLegend.tsx` (sort button tooltips)
- Modify: `src/components/ResultsSummary.tsx` (a second `config.groups`-sourced `Provinces` stat; currently unrendered outside its test, but it is exactly the case U5's own regression scenario forbids)
- Modify: `src/components/modal/overview/OverviewTab.tsx` (the `Provinces` row plus microcopy)
- Modify: `src/App.tsx` (call site of the renamed count helper)
- Test: `src/lib/__tests__/format.test.ts`
- Test: `src/lib/__tests__/legend-sort.test.ts`
- Test: `src/lib/__tests__/country-info.test.ts`
- Test: `src/components/__tests__/MapTab.test.tsx`
- Test: `src/components/__tests__/MapLegend.test.tsx`
- Test: `src/components/__tests__/ResultsSummary.test.tsx`
- Test: `src/components/modal/overview/__tests__/OverviewTab.test.tsx`

**Approach:**
- Rename the identifiers, not just the display strings — leaving `provinceCount` holding a location count is the kind of drift that misleads the next reader.
- `legend-sort.ts` sorting logic is unchanged; it already sorts on `group.paths.length`.
- Leave `stats.numProvinces` and its "Provinces (parsed)" row alone — that is a real province count from the save's country database.
- Because the two modal rows will differ by roughly 5x for the same country, add short microcopy (a tooltip or a parenthetical) naming what each counts. Without it the pair reads as the same inconsistency this plan set out to remove.
- Counts need no filtering logic of their own: U2 already excludes unresolvable names from `config.groups`, so `paths.length` counts painted shapes by construction.

**Test scenarios:**
- Happy path: the renamed total-count helper sums `paths.length` across all groups.
- Happy path: the renamed per-tag helper returns the matching group's `paths.length`, and `0` for an unknown tag — preserving the sentinel convention.
- Happy path: legend sort by location count orders groups descending by `paths.length`, with subject overlays still immediately after their overlord.
- Happy path: the map toolbar stat and the results summary both render the label "Locations".
- Happy path: the modal shows a "Locations" row and, when `stats.numProvinces > 0`, a separate "Provinces (parsed)" row, each with microcopy distinguishing them.
- Edge case: a country with zero locations shows `0`, not a blank or a dash.
- Regression: no user-facing string says "Provinces" for a count sourced from `config.groups`.

**Verification:**
- Grepping for `province` in `src/components/` and `src/lib/` returns only genuine province references from the save's country database.
- The displayed location count for a spot-checked country equals the number of shapes painted in that country's color.

---

- U6. **Verify both download paths at location scale**

**Goal:** The exported config loads against the locations map, users are told it changed, and `Download Map` still produces an image.

**Requirements:** R4, R7, R9

**Dependencies:** U2, U3

**Files:**
- Modify: `src/lib/mapchart-config.ts` (the `page` field in `defaultConfigValues`)
- Modify: `src/components/MapTab.tsx` (download notice; rasterization adjustments only if needed)
- Test: `src/lib/__tests__/mapchart-config.test.ts`
- Test: `src/components/__tests__/MapTab.test.tsx`

**Approach:**
- `page` must become `eu-v-locations`; a config claiming `eu-v-provinces` while carrying location IDs would be silently rejected.
- This breaks a downloaded-artifact contract in both directions, and the affected users are multiplayer groups maintaining a MapChart project across sessions. A PR-description note does not reach them: add a short line next to the Download Config button stating the config targets MapChart's EU5 Locations map and is not compatible with older province-map configs.
- The config grows from roughly 3.8k to 22.7k path names. Exercise a real import on mapchart.net and watch for size or entry-count limits as well as color fidelity.
- Exercise `Download Map` against the SCO save and watch for decode failures or blank output. Adjust only if it actually breaks.

**Test scenarios:**
- Happy path: a generated config has `page: "eu-v-locations"`.
- Happy path: the serialized config round-trips through `JSON.parse` with canonical location IDs in group paths.
- Happy path: the download controls render the compatibility notice.
- Happy path: `Download Map` triggers a canvas draw and produces a non-empty blob for a config with colored paths.
- Edge case: `Download Map` with an empty legend renders the map region without reserving legend space.
- Integration: a config downloaded from the app loads on mapchart.net's Locations map with colors and legend intact — a manual check, not an automated test.

**Verification:**
- A downloaded config pasted into mapchart.net's EU5 Locations map reproduces the in-app colors at full entry count.
- `Download Map` yields a usable PNG for the SCO save.

---

- U7. **Remove the superseded province layer**

**Goal:** The province-granularity assets and module are gone, once location rendering is proven.

**Requirements:** R1

**Dependencies:** U3, U4, U6 — all verified

**Files:**
- Delete: `public/eu-v-provinces.svg`
- Delete: `src/lib/province-mapping.ts`
- Delete: `src/lib/__tests__/province-mapping.test.ts`
- Delete: `src/lib/mapchart_province_mapping.json`
- Modify: `CLAUDE.md`

**Approach:**
- This unit is deliberately last. Every deletion here is one-way, and U3, U4 and U6 each carry an unverified outcome — render performance, visual legibility, rasterization. Holding the deletions until those pass keeps the fallback available exactly where the plan is least certain.
- Confirm nothing imports the deleted module or JSON before removing them; U2 severed the references, so this is a check rather than a change.
- Update `CLAUDE.md`: the architecture diagram's majority-voting step, the Province mapping / MapChart config / SVG map entries under Key Paths, the majority-voting bullet under Approach, the `playersOnly`-ordering and vassal-overlay bullets under Conventions, and the SVG-path-ID gotcha (now canonical location IDs). Add the new `scripts/` entries.

**Test scenarios:**
- `Test expectation: none -- deletions and documentation only; behavior is covered by U2 (pipeline), U3 (render) and U6 (export).`
- Regression: the full suite passes with no reference to the deleted files.

**Verification:**
- `npm run build` and the full test suite pass.
- `rg 'province-mapping|mapchart_province_mapping|eu-v-provinces'` returns no hits in `src/` or `public/`.
- `CLAUDE.md` describes the location pipeline, and `node scripts/check-location-coverage.mjs` still runs.

---

## System-Wide Impact

- **Interaction graph:** `MapRenderer`'s click handler, `MapLegend`'s sort and color-override controls, `MapTab`'s stat and both download buttons, `ResultsSummary`, and `CountryModal` via `country-info` all read from `config.groups`. All continue to work because the group shape is unchanged — only the meaning of `paths[]` changes from province IDs to canonical location IDs.
- **Error propagation:** Two changes, contrary to an earlier draft's claim of none. Unresolvable names are dropped at config-build time and counted, with a logger warning above the expected-miss baseline (R3). The mount-time fetch doubles in size and now has an explicit failure state with retry, where previously a failure produced an indefinite spinner.
- **State lifecycle risks:** The recolor effect must be idempotent across the fill, the inline `style` attribute, and the outline layer, or repeated runs accumulate DOM and stale transforms. It must also be gated on readiness or the first paint is blank. These are the two genuine new state hazards, and U3 covers each with dedicated tests.
- **API surface parity:** `ExportOptions.provinceMapping` and the `province-mapping` re-exports in `src/lib/index.ts` are removed; `location-resolve` replaces them. Internal surface, no external consumers.
- **Integration coverage:** The interesting cases all cross layers — first paint without prop changes, fetch-once-then-recolor, outline idempotence, reassignment showing the new color. Unit tests on pure helpers cannot prove any of them; each is specified as an integration scenario in U3.
- **Unchanged invariants:** The binary parser is untouched. `ParsedSave` keeps its shape, including `countryLocations`. `countryStats.numProvinces` remains a province count from the save. Pan/zoom `Transform` state, `map-styles.ts` override resolution, and the color-collision-avoidance logic in `mapchart-config.ts` all keep their current behavior.

---

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| Case mismatch between save names and asset IDs yields a blank map | The reason `location-resolve.ts` exists and is built in U2 before `province-mapping.ts` is deleted in U7. U1's coverage checker fails loudly if resolution breaks. |
| Location-index misalignment paints neighbours' colors | Majority voting used to absorb a one-slot shift and no longer will; `parse-binary-save.ts:489` already hedges on this alignment. U3 spot-checks one country against 1453 ground truth, because a visual check cannot distinguish a shifted map from a correct one. |
| Name drift from a game patch or asset revision passes silently | The miss count is compared against the measured ~5,864 baseline and warns when exceeded. `scripts/check-location-coverage.mjs` re-measures against any save on demand. |
| Zoom repaint cost at 22,711 nodes | Panning is composited and already carries `will-change: transform`; zoom forces re-rasterization and some presets add a CSS filter over every path. Unmeasured — U3 records an observation, and the rasterized-fallback contingency is unscoped work that would need its own unit. |
| 13 MB asset makes first load slow | 4.38 MB gzipped versus 2.1 MB for the asset it replaces, with Vercel compressing automatically. U3 carries a concrete first-paint threshold, and breaching it triggers the deferred precision-reduction work. |
| `Download Map` fails rasterizing 22,711 paths | Explicitly exercised in U6 rather than assumed. |
| Exported config is ~6x larger and may hit an import limit | U6's manual mapchart.net import checks entry count and fidelity, not just colors. |
| Outline override clones every colored path | Gated behind `outlineWidth > 0`, which every preset sets to `"0"`. U3 makes the layer's teardown idempotent so repeated recolors cannot compound it; U4 lowers the slider bound if needed. |
| Irreversible deletions land before rendering is proven | U7 holds every deletion until U3, U4 and U6 verify. |

---

## Documentation / Operational Notes

- `CLAUDE.md` updates are owned by U7 and enumerated there.
- Note in the PR description that previously downloaded MapChart configs will not load against the locations map, and that U6 adds an in-app notice for users who never read PR descriptions.
- `node scripts/check-location-coverage.mjs <save>` is the first thing to run if a save renders a mostly-empty map. It lives in `scripts/` deliberately: `diagnostics/` is gitignored, so anything placed there is invisible to clones and CI.
- Regenerate `src/lib/location-ids.json` with `node scripts/generate-location-ids.mjs` whenever `public/eu-v-locations.svg` is refreshed, then re-run the coverage checker.

---

## Sources & References

- MapChart EU5 Locations map: https://www.mapchart.net/eu-v-locations.html
- Asset URL: https://www.mapchart.net/svg/eu-v-locations.svg
- MapChart changelog (EU V maps released 2026-01-01, Maldives added 2026-03-29): https://www.mapchart.net/changelog.html
- EU5 map modding reference: https://eu5.paradoxwikis.com/Map_modding
- Coverage checker: `scripts/check-location-coverage.mjs` (U1)
- Test save: `MP_SCO_1453_05_02_cc5bd8de-1d79-424a-a350-3106f06b7050.eu5`
