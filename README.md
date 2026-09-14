# Vespucci

A browser tool that reads **Europa Universalis V** save files and paints a political map you can style, explore, and export. Everything runs locally in your browser — saves are never uploaded anywhere.

Drop in a `.eu5` save and you get a colored world map at **location granularity** (all 22,711 map locations, not aggregated provinces), plus tabs for rankings, trade, military, and wars.

---

## Requirements

| | |
|---|---|
| **Node.js** | `^20.19.0` or `>=22.12.0` (required by Vite 8) |
| **npm** | 10+ (ships with the Node versions above) |
| **A save file** | `.eu5` binary save, or a pre-melted `.txt` |

Check your version:

```bash
node -v
```

If it's older, install a current Node — [nvm](https://github.com/nvm-sh/nvm) is the easy route:

```bash
nvm install 22 && nvm use 22
```

---

## Run it locally

```bash
git clone https://github.com/masonstevens95/eu5-map-maker.git
cd eu5-map-maker
npm install
npm run dev
```

Then open **http://localhost:5173**.

If port 5173 is already taken, Vite picks the next free one and prints the actual URL — read the terminal rather than assuming 5173.

### Using the app

1. Drag a save onto the drop zone, or click **Choose File**.
2. Wait for parsing. A large multiplayer save (~70 MB) takes roughly 5–10 seconds.
3. The map paints automatically. From there you can:
   - switch between five **style presets** (Parchment, Modern, Dark, Satellite, Pastel),
   - recolor any country by clicking its swatch in the legend,
   - pan by dragging, zoom with the scroll wheel,
   - click a country to open its detail modal,
   - **Download Map** for a PNG, or **Download Config** for a MapChart config.

**Players only** (on by default) limits the map to player-controlled nations. Turn it off to paint every country in the save.

### Where your saves live

Saves are in your Paradox user directory, under `Europa Universalis V/save games/`:

- **macOS** — `~/Documents/Paradox Interactive/Europa Universalis V/save games/`
- **Windows** — `%USERPROFILE%\Documents\Paradox Interactive\Europa Universalis V\save games\`
- **Linux** — `~/.local/share/Paradox Interactive/Europa Universalis V/save games/`

---

## Other commands

```bash
npm run build          # typecheck + production build into dist/
npm run preview        # serve the production build locally
npm run test           # vitest in watch mode
npm run test:coverage  # coverage report
npm run lint           # eslint
```

`npm run build` runs `tsc -b` first, so a type error fails the build.

---

## Map data

The map is a single committed SVG, `public/eu-v-locations.svg` (~13 MB, 22,711 paths), from [MapChart's EU5 Locations map](https://www.mapchart.net/eu-v-locations.html). It is committed rather than fetched at runtime so the app has no third-party dependency while running.

Saves name locations in lowercase (`stockholm`); the SVG uses `Title_Case` (`Stockholm`). The two are matched through `src/lib/location-ids.json`, a canonical ID list generated from the SVG itself.

### If the map renders mostly empty

That means save location names stopped lining up with the map asset — usually after a game patch or an updated SVG. Measure it:

```bash
node scripts/check-location-coverage.mjs path/to/your-save.eu5
```

A healthy save reports something like:

```
asset ids matched          22710 (100.00%)
unmatched asset ids        1
save names with no shape   5863 (expected: lakes/seas/wastelands)

  OK: name alignment healthy.
```

The ~5,863 unmatched save names are lakes, sea zones, and wastelands, which the land map correctly omits. Those are expected, not errors.

If you replace `public/eu-v-locations.svg` with a newer version, regenerate the ID list and re-check:

```bash
node scripts/generate-location-ids.mjs
node scripts/check-location-coverage.mjs path/to/your-save.eu5
```

---

## Exporting to MapChart

**Download Config** produces a `mapchart_config.txt` you can import at [mapchart.net](https://www.mapchart.net/eu-v-locations.html).

> ⚠️ The config targets MapChart's **EU5 Locations** map. It will not load onto their Provinces map — both the page identifier and every path ID differ. Configs exported by older builds of this app targeted the Provinces map and are not compatible with the current one.

---

## Project layout

```
public/eu-v-locations.svg   the map asset (22,711 location paths)
scripts/                    map-data tooling (id generation, coverage check)
src/lib/                    parsing, resolution, and export logic (pure functions)
src/lib/binary/             .eu5 binary save parser
src/components/             React UI
docs/plans/                 implementation plans
```

Architecture notes, conventions, and the gotchas worth knowing before changing the parser or renderer live in [`CLAUDE.md`](./CLAUDE.md).

---

## Troubleshooting

**The map is blank but the file parsed.** Run the coverage checker above — it tells you in one command whether this is a name-alignment problem.

**"Could not load the map".** The SVG asset failed to fetch. Use the Retry button; if it persists, confirm `public/eu-v-locations.svg` exists and isn't truncated (it should be ~13 MB).

**Parsing is slow.** Expected on large saves — the gamestate inside a 70 MB multiplayer save is around 260 MB uncompressed. The parse time is shown in the toolbar.

**`npm install` fails on engine checks.** Your Node is older than Vite 8 requires. See [Requirements](#requirements).
