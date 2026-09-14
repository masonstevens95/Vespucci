---
title: "feat: Render subject locations in the overlord's color with dashes"
type: feat
status: active
date: 2026-09-13
deepened: 2026-09-13
---

# feat: Render subject locations in the overlord's color with dashes

## Summary

Subjects (vassals, fiefdoms, marches, personal unions — every type) are painted their overlord's exact color with a dashed hatch instead of a lighter shade, in both Players-only and full-map modes. The change is confined to **how paths are painted**: no location changes which group it belongs to, so legend identity, click-to-modal, counts and the exported config all keep working exactly as they do today.

---

## Problem Frame

`src/lib/export.ts` represents a player overlord's subjects as a `TAG_vassals` overlay tinted with `lightenColor(overlordColor, 1/3)`.

A lighter shade is a weak signal. At location granularity the shapes average ~6 viewBox units across — about 2.4x smaller than the province shapes the styling was tuned for — and a one-third lightening of an already-pale country color reads as a different nation, particularly in the Holy Roman Empire where subjects and independents interleave.

The relationship is also invisible with Players-only off: subjects render in their own colors and nothing indicates who they answer to, so the same save tells two different stories depending on a checkbox.

---

## Requirements

- R1. Subject locations are painted the overlord's exact color, not a derived shade.
- R2. Subjects are distinguished from directly-held locations by a dashed hatch fill.
- R3. The treatment applies in both Players-only and full-map modes.
- R4. All subject types share one style; `subject_type` stays unparsed.
- R5. Overriding an overlord's color carries to its subjects' hatch, on the map *and* in the legend swatch.
- R6. The downloaded PNG shows the hatching — in the map area *and* in the legend it draws onto the canvas.
- R7. The exported MapChart config is unchanged in structure and keeps every country's own entry.
- R8. Legend keeps its count split, its overlord-then-subject ordering, and its "total" sort mode.
- R9. No location is painted twice, and no country's own location count changes.

---

## Scope Boundaries

- Per-type patterns (vassal vs. fiefdom vs. march) and the parser work to retain `subject_type`.
- Changing which group a location belongs to. This plan changes paint only — see Key Technical Decisions.
- How subjects are *detected*: `src/lib/binary/sections/dependencies.ts` and the text parser are untouched.
- Making mapchart.net render hatching — see Deferred.
- `lightenColor` stays exported and tested; it remains the source of the subject overlay's export hex.

### Deferred to Follow-Up Work

- Teaching the exported config to carry hatching. MapChart's UI has patterns, but the per-group representation is undocumented; recovering it needs a patterned map exported from mapchart.net and inspected. **Note:** the `scalingPatterns` field we already emit is *not* evidence for this — see Key Technical Decisions.
- Bounding `resolveUniqueHex` recursion. `nudgeColor` caps red and green at 255 and never varies blue, so a saturated nudge chain could in principle recurse without terminating. This plan does not increase the number of lightened hexes, so exposure is unchanged — but it is a real latent sharp edge worth a separate fix.

---

## Context & Research

### Verified facts

| Fact | Detail |
|---|---|
| Subject types captured | All — `isValidDependency` accepts any non-empty `subject_type` |
| `subject_type` retained? | No. Parsed into a local, used for validation, discarded |
| Current subject color | `lightenColor(overlordColor, 1/3)` at `src/lib/export.ts:77` |
| Current overlay gating | Built only when `shouldFilterPlayers`, and only for *player* overlords |
| Average location size | ~6.0 viewBox units across, vs ~14.6 for provinces |
| `overlordSubjects` writers | Four independent sources — `dependencies.ts`, `io-manager.ts`, `war-subjects.ts`, and the capital-owner pass in `parse-binary-save.ts` |
| Chains are routine | `overlordSubjects` holds flat pairs with no transitive rollup, so a tag being both overlord and subject is common |
| SVG asset background | No `<defs>`, no background rect — the ocean is a CSS `backgroundColor` on the container, and a canvas fill in the download path |

### Three coupled sets in `exportMapChartConfig`

These move together; treating them as independent is what an earlier draft of this plan got wrong:

- `vassalOverlays` — built only for player overlords, only when `shouldFilterPlayers`
- `vassalSubjectTags` — derived from `Object.keys(tagToPlayers)`, gated the same way, and used to remove subject locations from the base pool
- `allowedTags` — `new Set([...Object.keys(tagToPlayers), ...Object.keys(vassalOverlays.locations)])`

Widening overlay construction without adjusting the other two admits every non-player overlay through the allowlist and double-paints subject locations. **This plan changes none of the three.**

### Relevant code and patterns

- `src/lib/export.ts` — `buildVassalOverlays` and the three sets above. Untouched by this plan except for a clarifying comment.
- `src/lib/legend-sort.ts` — `isSubjectEntry` / `subjectOverlordTag` derive the overlord tag from the `" - subjects"` label suffix; `sortLegendEntries` interleaves and computes the `"total"` mode.
- `src/lib/map-styles.ts` — `applyColorOverrides` re-keys groups by override hex, so display color must be resolved *after* it.
- `src/components/MapRenderer.tsx` — effect A injects once; effect B resets then repaints. Pattern defs follow the same lifecycle. The stroke pass copies each path's `fill` into its `stroke`.
- `src/components/MapTab.tsx` — `handleDownloadMap` draws its **own** legend onto the canvas from `Object.entries(config.groups)` with `ctx.fillStyle = hex`. This is a second, independent legend renderer.
- `src/components/CountryGroups.tsx` — dev-only debug panel that also renders `backgroundColor: hex` per group.

### Institutional learnings

`docs/solutions/` does not exist. The applicable hard-won knowledge is in `CLAUDE.md`'s Gotchas, which this plan honors: the recolor pass must stay idempotent, and `stroke-width` lives in a `<style>` scoped `.map-svg > path` precisely so it does not override nested elements.

---

## Key Technical Decisions

- **Paint-only: no location changes groups.** Three architectures were considered.

  | Approach | Legend identity | Click-to-modal | Config entries | Players-only risk |
  |---|---|---|---|---|
  | Merge subjects into overlord's group | lost | overlord only | one per bloc | high |
  | Widen `TAG_vassals` overlays to all overlords | lost in full map | overlord only | one per bloc | **breaks the filter** |
  | **Re-paint subject paths in place** (chosen) | kept | unchanged | one per country | none |

  The first two both re-home locations, and everything downstream reads group membership — the legend, `findTagLocationCount`, `locationToTagRef`, the exported config. Re-painting in place satisfies R1, R2, R3 and R5 while leaving all of that untouched. It is the only one of the three that does not trade subject identity for subject color.

- **Players-only mode keeps the existing overlay unchanged.** With the filter on, subject tags are non-player and would be dropped entirely without `TAG_vassals`; the overlay is what keeps them on the map. Its construction, its lightened export hex, and the three coupled sets all stay exactly as they are. Only its paint changes.

- **Full-map mode paints subjects in place.** With the filter off no overlays are built and every subject already has its own group. The renderer paints those groups' paths with the overlord's hatch. Nothing is re-homed, so R7 and R9 hold by construction.

- **The renderer learns the relationship from a small tag→tag map.** `exportMapChartConfig` additionally returns `subjectOverlords: Record<subjectTag, rootOverlordTag>`, flattened through chains. Deriving it from labels alone is not possible in full-map mode, where a subject group's label carries no hint of its overlord. Keyed by tag rather than by hex, because `applyColorOverrides` re-keys groups and hex is therefore unstable.

- **Chains flatten to the root overlord for paint only.** With A→B→C, C is painted A's hatch. Nothing moves between groups, so B keeps its own group, its own legend row and its own modal — the chain rollup exists solely so every hatch resolves to a color that is actually on the map.

- **The hatch is an opaque two-color pattern.** The asset has no background rect and the ocean is painted by the container, so transparent gaps would let sea show through every subject location. The pattern carries a background rect in the overlord's resolved color with stripes in a derived tint.

- **Patterns use `patternUnits="userSpaceOnUse"` with geometry in viewBox units.** The SVG default is `objectBoundingBox`, which scales the pattern per shape — producing one stripe on a small location and dense banding on a large one, the exact failure this needs to avoid. `scalingPatterns` in `defaultConfigValues()` is an inert field in the exported MapChart JSON that our renderer never reads; it is not the control here, and its presence is not evidence that MapChart's config carries per-group patterns.

- **Hatched paths take a distinct stroke, not their own fill.** The existing stroke pass copies `fill` into `stroke` to hide internal borders. Applied to a hatched path that would copy a `url(#…)` reference, which is not meaningful for a stroke, and matching the overlord's flat color instead would erase the seam between an overlord's own territory and its subject's — the one boundary this feature exists to show.

- **One pattern per resolved color, not per overlord tag.** Two overlords overridden to the same hex produce the same hatch and can share a definition; keying by tag would create duplicate identical patterns.

---

## Open Questions

### Resolved During Planning

- Do we need `subject_type`? No — one style covers every type, and `overlordSubjects` already captures all of them.
- Can subjects share the overlord's hex in the config? No — `groups` is keyed by hex. This is why the distinction is a paint concern, not a config one.
- Does the legend machinery survive? Yes, untouched — no group membership changes.
- Does click-to-modal change? No. Subject groups keep their own labels in full-map mode, and Players-only behaves exactly as today.
- Which color feeds the hatch? The overlord's post-override resolved color, so legend edits carry through.
- What controls per-shape vs. fixed hatch size? `patternUnits`, not `scalingPatterns`.

### Deferred to Implementation

- **Hatch geometry** — stripe angle, width, period, and the stripe/background contrast. Decide by rendering the test save across all five presets, including dark and satellite where figure and ground are both low-key (U4).
- **Whether `<pattern>` survives canvas rasterization**, and whether the tuned period survives being drawn at 2x. Definitions live in the same document so nothing external is referenced, but a flat fill is a plausible-looking failure (U4).
- **Legibility floor** — whether a ~6-unit shape can show a readable stripe at default zoom, and what to do if not. The retreat path is not obvious once the lighter shade is gone from the screen, so name the outcome rather than assuming success (U4).
- **Subject row count semantics under chains** — whether a legend subject row should count direct subjects or the whole subtree. Only affects Players-only mode, where the overlay already defines it as direct (U3).

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

What changes is the paint step. Group membership is identical to today in both modes:

```
PLAYERS-ONLY MODE                      FULL-MAP MODE
  groups:                                groups:
    FRA          → own paths               FRA  → own paths
    FRA_vassals  → subjects' paths         BUR  → own paths   (BUR is FRA's subject)
  (unchanged from today)                 (unchanged from today)

  paint:                                 paint:
    FRA          flat                      FRA  flat
    FRA_vassals  hatch(FRA's color)        BUR  hatch(FRA's color)
```

Resolving a group's paint, inside the existing recolor effect:

```
for each group (after applyColorOverrides):
    tag = tag from group label
    overlord =
        isSubjectEntry(label) ? extractTag(label)        // TAG_vassals overlay
                              : subjectOverlords[tag]     // full-map subject
    if overlord exists and has a group:
        color = that group's resolved hex
        fill  = url(ensurePattern(color))
        stroke = distinct seam tint of color
    else:
        fill  = own resolved hex
        stroke = same
```

The reset step clears generated pattern definitions for the same reason it clears the outline layer: nothing rebuilds the document any more, so an add-only pass accumulates.

---

## Implementation Units

- U1. **Expose the subject→overlord relationship**

**Goal:** The app can tell, for any country tag, which overlord's color its locations should carry.

**Requirements:** R3, R4, R7, R9

**Dependencies:** None

**Files:**
- Modify: `src/lib/export.ts` (return `subjectOverlords` alongside the config)
- Modify: `src/lib/types.ts` (the returned shape)
- Modify: `src/App.tsx` (store it in `DebugData`, pass to `MapTab`)
- Modify: `src/components/MapTab.tsx` (thread to `MapRenderer` and `MapLegend`)
- Test: `src/lib/__tests__/export.test.ts`

**Approach:**
- Build `subjectOverlords: Record<subjectTag, rootOverlordTag>` from `overlordSubjects`, flattening chains to the root. A cycle guard is required — four independent writers populate `overlordSubjects` and none of them guarantees acyclicity.
- Change `exportMapChartConfig`'s return from `MapChartConfig` to a small container carrying the config and this map. This ripples into `App.tsx` and the config fixtures in tests; that is the cost of the mapping being unavailable from labels in full-map mode.
- **Do not touch** `buildVassalOverlays`, `vassalSubjectTags`, or `allowedTags`. The mapping is additive; group membership is unchanged in both modes.
- Add a comment at the `lightenColor` assignment recording that the overlay hex is now export-only on screen but still what the config and the dev `CountryGroups` panel render.

**Execution note:** Write the cycle-guard test before the flattening logic — a malformed save producing an infinite loop at config-build time would prevent the app loading at all.

**Patterns to follow:**
- `buildVassalOverlays`'s existing traversal of `overlordSubjects`.
- Pure arrow functions, `const`, explicit `else`, no exceptions, per `CLAUDE.md`.

**Test scenarios:**
- Happy path: a direct subject maps to its overlord.
- Happy path: A→B→C flattens so C maps to A, and B also maps to A.
- Happy path: an overlord with vassal, fiefdom and march subjects maps all three to itself, regardless of type (R4).
- Happy path: with `playersOnly` true, the config is byte-identical to today's output — the mapping is purely additive.
- Happy path: with `playersOnly` false, every country still has its own group, including subjects.
- Edge case: a country that is neither overlord nor subject is absent from the mapping.
- Edge case: a cycle (A→B, B→A) terminates and attributes each tag deterministically rather than looping.
- Edge case: a tag listed as a subject under two overlords resolves to exactly one, deterministically.
- Edge case: an overlord with no subjects contributes no entries.
- Integration: total painted paths across all groups equals resolved locations, in both modes — nothing dropped or duplicated (R9).

**Verification:**
- Location totals and group membership are unchanged from before the unit in both modes; only the extra mapping is new.

---

- U2. **Paint subject paths with the overlord's hatch**

**Goal:** Subject locations render in the overlord's exact color, textured rather than tinted.

**Requirements:** R1, R2, R5

**Dependencies:** U1

**Files:**
- Modify: `src/components/MapRenderer.tsx`
- Test: `src/components/__tests__/MapRenderer.test.tsx`

**Approach:**
- Create a `<defs>` container during the mount-time load, beside the existing `<style>` injection.
- In the recolor pass, resolve each group's overlord — by label suffix for `TAG_vassals` overlays, by `subjectOverlords` lookup for full-map subject groups — then paint its paths with a hatch built from the *overlord's* resolved hex.
- Define patterns as opaque: a background rect in the overlord's resolved color, stripes in a derived tint, `patternUnits="userSpaceOnUse"`, geometry in viewBox units. Transparent gaps would let the container's ocean color show through every subject location.
- Give hatched paths a distinct stroke rather than letting the existing stroke pass copy a `url(#…)` fill or the overlord's flat color — the overlord/subject seam must stay visible.
- Clear generated patterns in the reset step, alongside the outline layer.
- Cache patterns by resolved color so overlords sharing a color share one definition.

**Execution note:** Write the failing test for "a subject path resolves to the overlord's color, not the lightened one" first — this is the requirement most likely to pass superficially while reading the wrong color source.

**Patterns to follow:**
- The existing reset-then-apply structure and its idempotence guarantees.
- `applyColorOverrides` as the single source of resolved display color.
- `isSubjectEntry` / `extractTag` from `src/lib/legend-sort.ts` for the overlay case.

**Test scenarios:**
- Happy path: in Players-only mode, a `TAG_vassals` path is filled by pattern reference whose color equals the overlord's — not `lightenColor` of it.
- Happy path: in full-map mode, a subject country's own path is hatched with its overlord's color while keeping its own group.
- Happy path: a directly-held path keeps a flat fill with no pattern reference.
- Happy path: the generated pattern carries `patternUnits="userSpaceOnUse"`.
- Happy path: the pattern is opaque — it contains a background rect, so no container color shows through.
- Happy path: a hatched path's stroke is neither a `url(...)` reference nor the overlord's flat fill.
- Integration: overriding the overlord's color updates both its flat fill and its subjects' hatch (R5).
- Integration: recoloring repeatedly leaves exactly one pattern definition per resolved color — no accumulation.
- Integration: switching style presets repaints hatches without refetching the document.
- Integration: enabling outline width with subjects present leaves exactly one `.outline-layer`.
- Edge case: two overlords resolved to the same hex share one pattern definition.
- Edge case: a subject whose overlord has no group falls back to its own resolved color, flat, rather than painting `undefined`.
- Edge case: a group with zero paths produces no pattern and does not throw.

**Verification:**
- On the test save in both modes, subjects read as the same color as their overlord, separated only by texture, with the seam between them still visible.

---

- U3. **Show the hatch in the legend**

**Goal:** The legend communicates the same distinction the map does, from the same color source.

**Requirements:** R2, R5, R8

**Dependencies:** U1

**Files:**
- Modify: `src/components/MapLegend.tsx`
- Test: `src/components/__tests__/MapLegend.test.tsx`
- Test: `src/lib/__tests__/legend-sort.test.ts`

**Approach:**
- Render a hatched swatch for any row that is a subject — the `TAG_vassals` overlay in Players-only mode, or a row whose tag is in `subjectOverlords` in full-map mode.
- **The swatch stripes must use the overlord row's resolved display hex**, the same source the map hatch uses. Striping the row's own hex would make R5 pass on the map and visibly fail in the legend: the user overrides an overlord color, the map moves, the swatch does not.
- Keep the color picker on subject rows. The row's own hex still governs the exported config, so the control is not meaningless — but add a title explaining that the map shows the overlord's color, so the lack of on-map response reads as intentional.
- `legend-sort.ts` needs no logic change. Verify rather than assume, since U1 adds no entries and removes none.

**Patterns to follow:**
- The existing `map-legend-swatch` span and its `borderColor` treatment.
- `isSubjectEntry` for the overlay case.

**Test scenarios:**
- Happy path: a subject row renders a hatched swatch; an overlord row renders a flat one.
- Happy path: the subject swatch's stripe color is the overlord's resolved hex, not the row's own.
- Integration: overriding the overlord's color changes the subject row's swatch stripes (R5).
- Happy path: each subject row still appears immediately after its overlord, and counts stay split (R8).
- Happy path: `"total"` sort still orders overlords by own-plus-subject count.
- Happy path: in full-map mode every subject country still has its own named row.
- Edge case: a subject row whose overlord is absent renders a flat swatch rather than a hatch with no color.
- Edge case: the color picker remains reachable by keyboard on subject rows.

**Verification:**
- Legend and map agree on which countries are subjects and on what color they carry.

---

- U4. **Tune geometry, fix the PNG legend, and state the export divergence**

**Goal:** The hatch reads correctly at location scale and the downloaded PNG is internally consistent.

**Requirements:** R2, R6

**Dependencies:** U2, U3

**Files:**
- Modify: `src/components/MapRenderer.tsx` (pattern geometry constants)
- Modify: `src/components/MapTab.tsx` (canvas legend; compatibility note)
- Test: `src/components/__tests__/MapRenderer.test.tsx`
- Test: `src/components/__tests__/MapTab.test.tsx`

**Approach:**
- Tune stripe angle, width, period and stripe/background contrast by rendering the test save. Check a dense region and a large contiguous subject holding — they fail in opposite directions — and check all five presets, since dark and satellite have low figure/ground contrast to begin with.
- **Fix `handleDownloadMap`'s canvas legend.** It draws swatches with `ctx.fillStyle = hex` straight from `config.groups`, which for a subject row is the export-only lightened hex. Left alone, the PNG shows hatched territory on the map and a flat lightened swatch in its own legend — mismatched inside a single image. Resolve the overlord's displayed hex for subject rows and draw the swatch as stripes of it.
- Confirm the hatch survives rasterization, including at the 2x scale the download draws at, where a tuned period could collapse into sub-pixel banding.
- Extend the existing `toolbar-note` to say subjects export as a lighter shade because MapChart cannot carry the on-screen hatching. The precedent is deliberate: the same note exists because a PR description never reaches the multiplayer groups who keep a MapChart project across sessions.

**Patterns to follow:**
- The existing `toolbar-note` and Download Config `title` added for the locations-map change.

**Test scenarios:**
- Happy path: generated patterns carry the tuned geometry rather than placeholders.
- Happy path: the download controls render the subject-export note.
- Integration: the serialized SVG used by the download path contains the pattern *definitions*, not only references — a reference without its definition is exactly how this fails silently.
- Integration: the canvas legend draws subject rows using the overlord's resolved hex, not the group's own.
- Edge case: with a color override active, the canvas legend and the map agree on the subject color.

**Verification:**
- The hatch is legible at default zoom and in a dense region, across all five presets.
- A downloaded PNG shows hatched subjects whose legend swatches match the map.

---

## System-Wide Impact

- **Interaction graph:** `MapRenderer` (paint), `MapLegend` (swatch), `MapTab` (threading, canvas legend), and the dev-only `CountryGroups` panel read from `config.groups`; `App.tsx` additionally stores the new mapping. Because no location changes groups, `locationToTagRef`, `findTagLocationCount`, the "Countries" stat and `legend-sort` all keep their current behavior in both modes.
- **Error propagation:** One new failure surface — chain flattening in U1 must terminate on a cyclic `overlordSubjects`, or config building hangs and the app never loads a save. Everything else falls back to a defined color rather than throwing, per the project's no-exceptions convention.
- **State lifecycle risks:** Generated pattern definitions are new mutable state inside the injected document and must be cleared in the recolor reset, or they accumulate — the same hazard the outline layer already demonstrated in this renderer.
- **API surface parity:** `exportMapChartConfig`'s return shape changes, rippling into `App.tsx`, `MapTab`, and config fixtures in tests. `MapChartConfig` itself is unchanged, so the exported artifact is untouched.
- **Integration coverage:** The cases that matter cross layers — an overlord override moving both the map hatch and the legend swatch, pattern definitions surviving serialization, and the canvas legend agreeing with the map. None is provable by unit tests on pure helpers.
- **Unchanged invariants:** Subject *detection* is untouched. Group membership, location counts, click-to-modal, the exported config's structure and per-country entries, the three coupled sets in `exportMapChartConfig`, location resolution, the canonical ID list, and pan/zoom are all unaffected.

---

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| Hatch aliases at ~6 viewBox units — a solid block or one stripe per shape | `patternUnits="userSpaceOnUse"` prevents per-shape scaling; U4 tunes against a dense region and a large holding, across all five presets |
| Transparent pattern gaps let ocean show through subjects | Pattern is specified opaque, with a background rect, and asserted in a U2 test |
| The overlord/subject seam disappears | Hatched paths take a distinct stroke instead of inheriting the overlord's flat color; asserted in U2 |
| `<pattern>` does not rasterize into the PNG, or the period collapses at 2x | Explicitly exercised in U4 rather than assumed; a flat fill is a plausible-looking failure |
| PNG's own legend contradicts its own map | U4 owns the canvas legend; without it R6 cannot be met |
| Pattern definitions accumulate across recolors | Cleared in the recolor reset, with a dedicated idempotence test — the outline layer already proved this failure mode is real here |
| Cyclic `overlordSubjects` hangs chain flattening | Cycle guard required, tested, and called out as an execution note; four independent writers populate the structure and none guarantees acyclicity |
| Screen and exported config disagree — hatch on screen, lighter shade in the file | Stated in the app via the existing `toolbar-note`, not only in the PR. True parity deferred pending discovery of MapChart's pattern representation |
| Legibility has no retreat path if no stripe period works | U4 names this as an outcome to report rather than assume away; the lighter shade remains available as a fallback because it is still the export hex |

---

## Documentation / Operational Notes

- `CLAUDE.md` Conventions: note that subject locations keep their own groups and are distinguished by paint, not membership, and that the overlay's lightened hex is export-only on screen.
- `CLAUDE.md` Gotchas: generated pattern definitions must be cleared in the recolor reset, alongside the outline-layer note; and `patternUnits` defaults to `objectBoundingBox`, which scales per shape.
- PR description: the exported config still encodes subjects as a lighter shade, so screen-vs-MapChart divergence is a known trade.

---

## Sources & References

- Subject parsing: `src/lib/binary/sections/dependencies.ts`
- Overlay construction and the three coupled sets: `src/lib/export.ts`
- Legend ordering and totals: `src/lib/legend-sort.ts`
- Renderer effect split and idempotence rules: `src/components/MapRenderer.tsx`
- Canvas legend in the download path: `src/components/MapTab.tsx`
- Prior plan establishing location granularity: `docs/plans/2026-09-12-001-feat-location-based-map-filling-plan.md`
- MapChart patterns overview: https://blog.mapchart.net/updates/making-maps-with-patterns/
- Test save: `MP_SCO_1453_05_02_cc5bd8de-1d79-424a-a350-3106f06b7050.eu5`
