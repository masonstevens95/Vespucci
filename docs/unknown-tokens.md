# Unknown Binary Tokens — Analysis from BOH Save Entry

## Token Categories

### Engine Tokens (0x00-0xFF) — Binary Format Markers
These are low-level binary format tokens, not game data fields.

| Token | Occurrences | Context | Likely Meaning |
|-------|------------|---------|----------------|
| 0x00 | 48 | Various | Null/none marker |
| 0x05 | 53 | Array entries | Array element separator |
| 0x06 | 41 | Array entries | Array element type |
| 0x07 | 6 | Various | Boolean true |
| 0x1b | 5 | `country_name = { unknown_0x1b = lookup }` | Name key (inside name block) |
| 0x2f | 4 | Field values | Unknown engine value type |
| 0x41 | 164 | `date = X, unknown_0x41 = lookup` | Action type / event type reference |
| 0xdb | 19 | Various blocks | Unknown engine marker |
| 0xdc | 4 | `country_name = { unknown_0xdc = { ... } }` | Name sub-block (adjective/genitive?) |
| 0xe1 | 39 | `unknown_0xe1 = lookup` | **TYPE** — definition/type reference (already used for gov type) |
| 0xf0 | 24 | Various | Unknown engine marker |

### Societal Value Axes (inside `societal_values = { }`)
16 entries matching the 16 axes from the wiki. Values are FIXED5 (0-10000 = 0-100 scale).
Names are obfuscated in our token map (garbage names from collisions).

| Token | BOH Value | Probable Axis (from wiki order) |
|-------|-----------|-------------------------------|
| 0x1c41 (7233) | 10000 (100%) | Centralization ↔ Decentralization |
| 0x116d (4461) | 1640 (16.4%) | Traditionalist ↔ Innovative |
| onchangestart_low* | 10000 (100%) | Spiritualist ↔ Humanist |
| 0x1c39 (7225) | 5900 (59%) | Aristocracy ↔ Plutocracy |
| 0x11b4 (4532) | 350 (3.5%) | Serfdom ↔ Free Subjects |
| has_karma* (12676) | 99900 (99.9%) | Mercantilism ↔ Free Trade |
| 0x16af (5807) | 4155 (41.6%) | Belligerent ↔ Conciliatory |
| 0x258d (9613) | 492 (4.9%) | Quality ↔ Quantity |
| uberwidget* | 4495 (45%) | Offensive ↔ Defensive |
| 0x118d (4493) | 4282 (42.8%) | Land ↔ Naval |
| debug_textbox* | 6554 (65.5%) | Capital Economy ↔ Traditional Economy |
| 0x1c9c (7324) | 2815 (28.2%) | Individualism ↔ Communalism |
| 0x1c96 (7318) | 99900 (99.9%) | Outward ↔ Inward |
| 0x1c6e (7278) | 99900 (99.9%) | Absolutism ↔ Liberalism |
| 0x3185 (12677) | 99900 (99.9%) | Mysticism ↔ Jurisprudence (Islamic) |
| 0x1b28 (6952) | 99900 (99.9%) | Sinicized ↔ Unsinicized |

\* Names like "has_karma", "onchangestart_low", "uberwidget", "debug_textbox" are **garbage token name collisions** — these IDs fall in the 0xd2d-0x270c gap where our token map has no entries, so the melter maps them to wrong names from a different token range.

### Estate IDs (inside `estates = { }`)
Estate slot mappings. Values are estate slot indices.

| Token | Likely Meaning |
|-------|---------------|
| 0x140a (5130) | Estate type 1 (Crown?) |
| asset_ids* | Estate type 2 |
| taskshader* | Estate type 3 |
| tree_sway_world_direction* | Estate type 4 |
| 0xafc (2812) | Estate type 5 |
| 0x1410 (5136) | Estate type 6 |
| 0x1411 (5137) | Estate type 7 |
| 0x1413 (5139) | Estate type 8 |

### Institution IDs (inside `institutions = { }`)
Boolean flags for which institutions are present.

| Token | Likely Meaning |
|-------|---------------|
| 0x885 (2181) | Institution 1 |
| 0x887 (2183) | Institution 2 |
| 0x888 (2184) | Institution 3 |
| 0x88a (2186) | Institution 4 |
| 0x88b (2187) | Institution 5 |
| 0x88d (2189) | Institution 6 |
| 0x88e (2190) | Institution 7 |
| 0x890 (2192) | Institution 8 |
| 0x891 (2193) | Institution 9 |
| 0x893 (2195) | Institution 10 |
| 0x894 (2196) | Institution 11 |
| 0x895 (2197) | Institution 12 |

### Score Component (inside `score_rating = { }`)
| Token | BOH Value | Likely Meaning |
|-------|-----------|---------------|
| propagating_zone_of_control* | 1290.67 | Military score component |
| core_locations* | 343.44 | Territory score component |
| 0x3172 (12658) | 206.89 | Economy/development score component |

### Other Identified Tokens
| Token | Context | Likely Meaning |
|-------|---------|---------------|
| 0xc49 (3145) | After `unknown_0xe1 = lookup` | Country definition type/subtype |
| 0x3172 (12658) | score_rating, score_rank | Score component (possibly "economic_rating") |
| 0x323f (12863) | Unknown context | Unknown game field |
| 0x32d2 (13010) | Unknown context | Unknown game field |

## Key Findings

1. **Societal values ARE parseable** — 16 FIXED5 values in `government > societal_values`. The token IDs fall in the gap but the structure is predictable (key-value pairs).

2. **Institutions ARE parseable** — boolean flags in `institutions = { }`. Token IDs are sequential (0x885-0x895 range).

3. **Estate assignments ARE parseable** — slot indices in `estates = { }`. Token IDs in the gap.

4. **Most "garbage" names** (onchangestart_low, uberwidget, debug_textbox, has_karma, asset_ids, taskshader) are **token collision artifacts** from IDs in the unmapped 0xd2d-0x270c gap being incorrectly resolved against the wrong token range.
