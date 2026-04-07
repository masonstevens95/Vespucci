# RGOs (Resource Gathering Operations) — Research Notes

Source: https://eu5.paradoxwikis.com/Resource_gathering_operation  
Last checked: 2026-04-06

---

## What the game tracks

Each location has one RGO producing a single raw material. Five extraction methods exist: **farming, mines, gathering, forestry, hunting grounds**. RGOs are levelled — each level employs 1,000 laborers and adds 1,000 to the location's max population capacity.

**Per-RGO stats that matter:**
| Stat | Description |
|---|---|
| Good type | Which raw material is produced (grain, iron, silver, etc.) |
| Size | Levels built (each = 1 unit output, 1k workers) |
| Employment | Current workers employed |
| Max size | Ceiling based on population, development, terrain, societal values |
| Method | farming / hunting / gathering / forestry / mining |
| Output scale | Multiplier from modifiers (serfdom SV, devastation, levies, etc.) |

**Output formula (from wiki):**
```
RGO profit per level = output_per_level × market_price × market_access × control
```

Notable production hotspots: Almadén (Mercury ×4), Falun (Copper ×5), Ternate/Tidore/Amassing (Cloves ×6), Malmo (Fish ×6).

---

## What's currently parsed

### From `market_manager` (already done)
- `producedGoods` — global good → total production totals
- Per-market: `price`, `supply`, `demand`, `surplus`, `stockpile`, `totalProduction` per good

### From `locations` (currently skipped)
`readLocationEntry` reads `owner` then calls `r.skipBlock()`, discarding everything else — including the entire `rgo = { ... }` block inside every location.

---

## What could be extracted

### Tokens available in the binary save

All confirmed present in `eu5-tokens.json`:

| Token ID | Name | What it holds |
|---|---|---|
| 15683 | `rgo` | Container block — lives inside each location entry |
| 11856 | `raw_material` | Good type string (e.g. `"grain"`, `"silver"`) |
| 11860 | `raw_material_size` | RGO level / size (integer) |
| 11882 | `employment_size` | Current workers employed |
| 13799 | `employed_in_rgo` | Workers specifically in RGO (vs buildings) |
| 12737 | `local_max_rgo_size` | Max size cap at this location |
| 18618 | `goods_method` | Method: farming / hunting / gathering / forestry / mining |
| 18724 | `raw_material_output` | Current output level (FIXED5) |
| 18639 | `rgo_workers` | RGO worker count |
| 18728 | `max_rgo_workers` | Max workers possible |
| 13521 | `output_scale` | Output multiplier from all modifiers |
| 12152 | `raw_modifier` | Raw material modifier |
| 18617 | `raw_material_occurrence` | How common the resource is at this location |

### Implementation path

**Step 1 — Location reader** (`sections/locations.ts`)  
Instead of `r.skipBlock()` after reading `owner`, scan the block for an `rgo = { ... }` sub-block and extract the fields above. Add `RgoData` type:

```ts
interface RgoData {
  readonly good: string;          // raw_material
  readonly size: number;          // raw_material_size
  readonly employment: number;    // employment_size
  readonly maxSize: number;       // local_max_rgo_size
  readonly method: string;        // goods_method
  readonly outputScale: number;   // output_scale (FIXED5)
}
```

**Step 2 — ParsedSave**  
Add `locationRgos: Record<number, RgoData>` (locationId → RgoData).

**Step 3 — Per-country rollup** (pure helper)  
From `locationRgos` + `locationOwners`, build:
```ts
// tag → { good → { totalSize, totalEmployment, locationCount } }
Record<string, Record<string, { totalSize: number; totalEmployment: number; locationCount: number }>>
```

---

## UI opportunities

### GoodsSubTab / GoodModal (existing trade views)
- **Production sources**: show which countries produce the most of a selected good (using the per-country rollup). Currently `totalProduction` in market goods comes from market supply chain — RGO data gives the upstream source.
- **Method badge**: show whether a good predominantly comes from farming, mines, etc.

### Country modal — Economy tab
- Add a **"Produces"** row listing the top 2–3 goods by total RGO size, e.g. "Grain (3 locations), Iron (2 locations), Silver (1 location)".

### Map overlay (new)
- Color locations by their RGO good type — a production map. Could be a new `MapStyle` variant or a separate toggle.

### GoodsSubTab — new column
- **"Locations"**: how many distinct RGO locations produce this good globally (from `locationRgos`).

---

## Cost/benefit

| Task | Effort | Value |
|---|---|---|
| Extend location reader to capture `rgo` block | Low — already scanning the block, just stop skipping | High — unlocks everything below |
| Add per-country production rollup | Low — pure map/reduce over locationRgos | Medium — new country modal row |
| "Produces" in country modal | Low — display only | Medium |
| Production sources in GoodModal | Medium — UI work | High — answers "who makes this?" |
| Map coloring by good type | High — new render path | High — visually compelling |
