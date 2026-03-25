/**
 * EU5 Save → MapChart Config Exporter
 *
 * Converts a melted (text-mode) EU5 save file into a MapChart config
 * compatible with https://www.mapchart.net/eu-v-provinces.html
 *
 * Expects the save to already be melted to text (via rakaly).
 * In a React app, melting can happen server-side or via WASM.
 */

// =============================================================================
// Types
// =============================================================================

export type RGB = [number, number, number];

export interface ParsedSave {
  /** country_tag -> list of EU5 location names */
  countryLocations: Record<string, string[]>;
  /** country_tag -> list of player display names */
  tagToPlayers: Record<string, string[]>;
  /** country_tag -> [r, g, b] */
  countryColors: Record<string, RGB>;
  /** overlord_tag -> set of subject tags */
  overlordSubjects: Record<string, Set<string>>;
}

export interface MapChartGroup {
  label: string;
  paths: string[];
}

export interface MapChartConfig {
  groups: Record<string, MapChartGroup>;
  title: string;
  hidden: string[];
  background: string;
  borders: string;
  legendFont: string;
  legendFontColor: string;
  legendBorderColor: string;
  legendBgColor: string;
  legendWidth: number;
  legendBoxShape: string;
  legendTitleMode: string;
  areBordersShown: boolean;
  defaultColor: string;
  labelsColor: string;
  labelsFont: string;
  strokeWidth: string;
  areLabelsShown: boolean;
  uncoloredScriptColor: string;
  zoomLevel: string;
  zoomX: string;
  zoomY: string;
  v6: boolean;
  mapTitleScale: number;
  page: string;
  mapVersion: null;
  legendPosition: string;
  legendSize: string;
  legendTranslateX: string;
  legendStatus: string;
  scalingPatterns: boolean;
  legendRowsSameColor: boolean;
  legendColumnCount: number;
}

export interface ExportOptions {
  title?: string;
  playersOnly?: boolean;
  /** MapChart province mapping: province_name -> [eu5_location, ...] */
  provinceMapping?: Record<string, string[]>;
}

// =============================================================================
// Color utilities
// =============================================================================

function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function hsvToRgb(h: number, s: number, v: number): RGB {
  let r: number, g: number, b: number;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q; break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function generateDistinctColors(n: number): RGB[] {
  const golden = 0.618033988749895;
  const colors: RGB[] = [];
  let hue = 0;
  for (let i = 0; i < n; i++) {
    colors.push(hsvToRgb(hue, 0.65, 0.85));
    hue = (hue + golden) % 1.0;
  }
  return colors;
}

function lightenColor(rgb: RGB, fraction: number): RGB {
  return [
    Math.round(rgb[0] + (255 - rgb[0]) * fraction),
    Math.round(rgb[1] + (255 - rgb[1]) * fraction),
    Math.round(rgb[2] + (255 - rgb[2]) * fraction),
  ];
}

// =============================================================================
// Save parser
// =============================================================================

/**
 * Parse a melted (text-mode) EU5 save file.
 *
 * In a browser context, `text` is the full save content as a string.
 * This avoids filesystem I/O — the caller is responsible for reading/melting.
 */
export function parseMeltedSave(text: string): ParsedSave {
  const lines = text.split("\n");

  // Step 1: Master location list (metadata section, near top of file)
  const locationNames: Record<number, string> = {};
  for (let i = 0; i < Math.min(lines.length, 50000); i++) {
    const stripped = lines[i].trim();
    if (stripped.includes("locations={") && i < 100) {
      const after = stripped.split("{")[1]?.trim() ?? "";
      const allNames: string[] = [];
      if (after) allNames.push(...after.split(/\s+/).filter(Boolean));
      for (let j = i + 1; j < lines.length; j++) {
        const s = lines[j].trim();
        if (s.includes("}")) {
          const before = s.split("}")[0].trim();
          if (before) allNames.push(...before.split(/\s+/).filter(Boolean));
          break;
        }
        allNames.push(...s.split(/\s+/).filter(Boolean));
      }
      for (const name of allNames) {
        const clean = name.replace(/"/g, "");
        if (clean) locationNames[Object.keys(locationNames).length] = clean;
      }
      break;
    }
  }

  // Step 2: Country tags (numeric ID -> 3-letter tag)
  const countryTags: Record<number, string> = {};
  let countriesLineIdx = lines.findIndex((l) => l.trim() === "countries={");
  if (countriesLineIdx !== -1) {
    for (let i = countriesLineIdx; i < lines.length; i++) {
      if (lines[i].trim() === "tags={") {
        for (let j = i + 1; j < lines.length; j++) {
          const s = lines[j].trim();
          if (s === "}") break;
          const m = s.match(/^(\d+)=(\w+)$/);
          if (m) countryTags[parseInt(m[1])] = m[2];
        }
        break;
      }
    }
  }

  // Step 3: Location ownership
  const locationOwners: Record<number, string> = {};
  let locSectionIdx = -1;
  for (let i = 1000; i < lines.length; i++) {
    if (lines[i].trimEnd() === "locations={") {
      locSectionIdx = i;
      break;
    }
  }
  if (locSectionIdx !== -1) {
    let foundInner = false;
    let currentLocId: number | null = null;
    for (let i = locSectionIdx + 1; i < lines.length; i++) {
      const stripped = lines[i].trim();
      if (!foundInner && stripped === "locations={") {
        foundInner = true;
        continue;
      }
      if (!foundInner) continue;

      const locMatch = stripped.match(/^(\d+)=\{/);
      if (locMatch) {
        currentLocId = parseInt(locMatch[1]);
        continue;
      }

      const ownerMatch = stripped.match(/^owner=(\d+)/);
      if (ownerMatch && currentLocId !== null) {
        const ownerId = parseInt(ownerMatch[1]);
        if (countryTags[ownerId]) {
          locationOwners[currentLocId] = countryTags[ownerId];
        }
        currentLocId = null;
        continue;
      }

      if (lines[i].startsWith("\t}") && !lines[i].startsWith("\t\t")) break;
    }
  }

  // Step 4: Country colors from save (flag=TAG ... color=rgb { R G B })
  const countryColors: Record<string, RGB> = {};
  {
    let inDb = false;
    let currentFlag: string | null = null;
    for (let i = 0; i < lines.length; i++) {
      const stripped = lines[i].trim();
      if (stripped === "database={" && !inDb) { inDb = true; continue; }
      if (!inDb) continue;
      const flagMatch = stripped.match(/^flag=(\w+)$/);
      if (flagMatch) currentFlag = flagMatch[1];
      if (stripped === "color=rgb {" && currentFlag && i + 1 < lines.length) {
        const parts = lines[i + 1].trim().split(/\s+/);
        if (parts.length >= 3) {
          const r = parseInt(parts[0]), g = parseInt(parts[1]), b = parseInt(parts[2]);
          if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
            countryColors[currentFlag] = [r, g, b];
          }
        }
      }
    }
  }

  // Step 5: Subject/vassal relationships
  const overlordSubjects: Record<string, Set<string>> = {};

  // Source 1: IO type=loc entries
  const ioStartIdx = lines.findIndex((l) => l.trimEnd() === "international_organization_manager={");
  if (ioStartIdx !== -1) {
    let ioEndIdx = lines.length;
    for (let i = ioStartIdx + 1; i < lines.length; i++) {
      if (!lines[i].startsWith("\t") && lines[i].trim() && lines[i].trim().endsWith("={")) {
        ioEndIdx = i;
        break;
      }
    }

    let currentIo: { type: string | null; leader: number | null; members: number[] } | null = null;
    for (let i = ioStartIdx; i < ioEndIdx; i++) {
      const stripped = lines[i].trim();
      const entryMatch = stripped.match(/^(\d+)=\{$/);
      if (entryMatch && !currentIo) {
        currentIo = { type: null, leader: null, members: [] };
        continue;
      }
      if (currentIo) {
        const typeMatch = stripped.match(/^type=(\w+)$/);
        if (typeMatch) currentIo.type = typeMatch[1];
        const leaderMatch = stripped.match(/^leader=(\d+)$/);
        if (leaderMatch) currentIo.leader = parseInt(leaderMatch[1]);
        if (stripped.startsWith("all_members={") && i + 1 < ioEndIdx) {
          const nl = lines[i + 1].trim();
          if (nl !== "}") {
            currentIo.members = nl.split(/\s+/).filter((x) => /^\d+$/.test(x)).map(Number);
          }
        }
        if (stripped === "}" && lines[i].startsWith("\t\t}")) {
          if (currentIo.type === "loc" && currentIo.leader !== null && countryTags[currentIo.leader]) {
            const leaderTag = countryTags[currentIo.leader];
            if (!overlordSubjects[leaderTag]) overlordSubjects[leaderTag] = new Set();
            for (const mid of currentIo.members) {
              if (mid !== currentIo.leader && countryTags[mid]) {
                overlordSubjects[leaderTag].add(countryTags[mid]);
              }
            }
          }
          currentIo = null;
        }
      }
    }
  }

  const ioMatched = new Set<string>();
  for (const subs of Object.values(overlordSubjects)) {
    for (const s of subs) ioMatched.add(s);
  }

  // Source 2: Overlord candidates (countries with subject_tax income)
  const overlordCandidates = new Set<string>();
  {
    let curFlag: string | null = null;
    for (const line of lines) {
      const stripped = line.trim();
      const fm = stripped.match(/^flag=(\w+)$/);
      if (fm) curFlag = fm[1];
      if (curFlag && stripped.startsWith("last_months_subject_tax=")) {
        const val = parseFloat(stripped.split("=")[1]);
        if (val > 0) overlordCandidates.add(curFlag);
      }
    }
  }

  // Source 3: Diplomacy relations — match subjects to overlord candidates
  const dmStartIdx = lines.findIndex((l) => l.trimEnd() === "diplomacy_manager={");
  if (dmStartIdx !== -1) {
    let dmEndIdx = lines.length;
    for (let i = dmStartIdx + 1; i < lines.length; i++) {
      if (!lines[i].startsWith("\t") && lines[i].trim() && i > dmStartIdx + 1) {
        dmEndIdx = i;
        break;
      }
    }

    let curCountry: number | null = null;
    let hasLiberty = false;
    let relationPartners: number[] = [];

    const flushSubject = () => {
      if (curCountry !== null && hasLiberty) {
        const subTag = countryTags[curCountry];
        if (subTag && !ioMatched.has(subTag)) {
          for (const rp of relationPartners) {
            const rpTag = countryTags[rp];
            if (rpTag && overlordCandidates.has(rpTag)) {
              if (!overlordSubjects[rpTag]) overlordSubjects[rpTag] = new Set();
              overlordSubjects[rpTag].add(subTag);
              break;
            }
          }
        }
      }
    };

    for (let i = dmStartIdx; i < dmEndIdx; i++) {
      const line = lines[i];
      const stripped = line.trim();

      if (line.startsWith("\t") && !line.startsWith("\t\t")) {
        const m = stripped.match(/^(\d+)=\{$/);
        if (m) {
          flushSubject();
          curCountry = parseInt(m[1]);
          hasLiberty = false;
          relationPartners = [];
        }
      }

      if (stripped.startsWith("liberty_desire=")) hasLiberty = true;

      if (line.startsWith("\t\t\t") && !line.startsWith("\t\t\t\t")) {
        const m = stripped.match(/^(\d+)=\{$/);
        if (m) relationPartners.push(parseInt(m[1]));
      }
    }
    flushSubject();
  }

  // Step 6: Player countries (played_country entries)
  const playerCountries: Record<string, string> = {}; // player_name -> tag (last wins)
  {
    let inBlock = false;
    let curName: string | null = null;
    let curCountry: number | null = null;
    for (const line of lines) {
      const stripped = line.trim();
      if (stripped === "played_country={") {
        inBlock = true;
        curName = null;
        curCountry = null;
        continue;
      }
      if (inBlock) {
        const nm = stripped.match(/^name="(.+?)"$/);
        if (nm) curName = nm[1];
        const cm = stripped.match(/^country=(\d+)$/);
        if (cm) curCountry = parseInt(cm[1]);
        if (stripped === "}" && !line.startsWith("\t\t")) {
          if (curName && curCountry !== null && countryTags[curCountry]) {
            playerCountries[curName] = countryTags[curCountry];
          }
          inBlock = false;
        }
      }
    }
  }

  // Step 7: Build output
  const countryLocations: Record<string, string[]> = {};
  for (const [locIdStr, tag] of Object.entries(locationOwners)) {
    const locId = parseInt(locIdStr);
    const name = locationNames[locId] ?? `loc_${locId}`;
    if (!countryLocations[tag]) countryLocations[tag] = [];
    countryLocations[tag].push(name);
  }

  const tagToPlayers: Record<string, string[]> = {};
  for (const [name, tag] of Object.entries(playerCountries)) {
    if (!tagToPlayers[tag]) tagToPlayers[tag] = [];
    tagToPlayers[tag].push(name);
  }

  return { countryLocations, tagToPlayers, countryColors, overlordSubjects };
}

// =============================================================================
// Province mapping
// =============================================================================

/**
 * Build reverse mapping: eu5_location (lowercase) -> MapChart province name.
 */
export function buildLocationToProvince(
  provinceMapping: Record<string, string[]>,
): Record<string, string> {
  const locToProvince: Record<string, string> = {};
  for (const [province, locations] of Object.entries(provinceMapping)) {
    for (const loc of locations) {
      locToProvince[loc.toLowerCase()] = province;
    }
  }
  return locToProvince;
}

/**
 * Convert per-country EU5 location lists to MapChart province lists.
 * Resolves conflicts via majority owner.
 */
export function mapToProvinces(
  countryLocations: Record<string, string[]>,
  locToProvince: Record<string, string>,
): Record<string, string[]> {
  // province -> { tag: count }
  const provinceVotes: Record<string, Record<string, number>> = {};

  for (const [tag, locs] of Object.entries(countryLocations)) {
    for (const loc of locs) {
      const province = locToProvince[loc.toLowerCase()];
      if (province) {
        if (!provinceVotes[province]) provinceVotes[province] = {};
        provinceVotes[province][tag] = (provinceVotes[province][tag] ?? 0) + 1;
      }
    }
  }

  // Assign province to majority owner, group by country
  const result: Record<string, string[]> = {};
  for (const [province, votes] of Object.entries(provinceVotes)) {
    const winner = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
    if (!result[winner]) result[winner] = [];
    result[winner].push(province);
  }
  return result;
}

// =============================================================================
// MapChart config generator
// =============================================================================

export function generateMapChartConfig(
  countryLocations: Record<string, string[]>,
  countryColors: Record<string, RGB>,
  locToProvince: Record<string, string>,
  options: ExportOptions & { tagLabels?: Record<string, string> } = {},
): MapChartConfig {
  const countryProvinces = mapToProvinces(countryLocations, locToProvince);
  const tags = Object.keys(countryProvinces).sort(
    (a, b) => (countryProvinces[b]?.length ?? 0) - (countryProvinces[a]?.length ?? 0),
  );

  // Fill missing colors
  const colors = { ...countryColors };
  const missingTags = tags.filter((t) => !colors[t]);
  if (missingTags.length > 0) {
    const generated = generateDistinctColors(missingTags.length);
    missingTags.forEach((tag, i) => { colors[tag] = generated[i]; });
  }

  const usedHex: Record<string, string> = {};
  const groups: Record<string, MapChartGroup> = {};

  for (const tag of tags) {
    let rgb: RGB = colors[tag] ?? [128, 128, 128];
    let hexColor = rgbToHex(...rgb);

    while (usedHex[hexColor] && usedHex[hexColor] !== tag) {
      rgb = [Math.min(255, rgb[0] + 3), Math.min(255, rgb[1] + 2), rgb[2]];
      hexColor = rgbToHex(...rgb);
    }
    usedHex[hexColor] = tag;

    const label = options.tagLabels?.[tag] ?? tag;
    groups[hexColor] = { label, paths: countryProvinces[tag] };
  }

  return {
    groups,
    title: options.title ?? "",
    hidden: [],
    background: "#ffffff",
    borders: "#000",
    legendFont: "Helvetica",
    legendFontColor: "#000",
    legendBorderColor: "#00000000",
    legendBgColor: "#00000000",
    legendWidth: 150,
    legendBoxShape: "square",
    legendTitleMode: "attached",
    areBordersShown: true,
    defaultColor: "#d1dbdd",
    labelsColor: "#6a0707",
    labelsFont: "Arial",
    strokeWidth: "medium",
    areLabelsShown: false,
    uncoloredScriptColor: "#ffff33",
    zoomLevel: "1.00",
    zoomX: "0.00",
    zoomY: "0.00",
    v6: true,
    mapTitleScale: 1,
    page: "eu-v-provinces",
    mapVersion: null,
    legendPosition: "bottom_left",
    legendSize: "medium",
    legendTranslateX: "0.00",
    legendStatus: "show",
    scalingPatterns: true,
    legendRowsSameColor: true,
    legendColumnCount: 1,
  };
}

// =============================================================================
// High-level export (mirrors Python main())
// =============================================================================

export function exportMapChartConfig(
  saveText: string,
  provinceMapping: Record<string, string[]>,
  options: ExportOptions = {},
): MapChartConfig {
  const parsed = parseMeltedSave(saveText);
  let { countryLocations } = parsed;
  const { tagToPlayers, countryColors, overlordSubjects } = parsed;

  const locToProvince = buildLocationToProvince(provinceMapping);

  // Build labels
  const tagLabels: Record<string, string> = {};
  for (const tag of Object.keys(countryLocations)) {
    tagLabels[tag] = tagToPlayers[tag]
      ? `${tag} - ${tagToPlayers[tag].join(", ")}`
      : tag;
  }

  // Keep full copy for vassal lookup before filtering
  const allCountryLocations = { ...countryLocations };

  // Filter to players only
  if (options.playersOnly && Object.keys(tagToPlayers).length > 0) {
    const playerTagSet = new Set(Object.keys(tagToPlayers));
    countryLocations = Object.fromEntries(
      Object.entries(countryLocations).filter(([tag]) => playerTagSet.has(tag)),
    );
  }

  // Add vassal territory
  if (options.playersOnly && Object.keys(tagToPlayers).length > 0) {
    for (const overlordTag of Object.keys(tagToPlayers)) {
      const vassalTags = overlordSubjects[overlordTag];
      if (!vassalTags || vassalTags.size === 0) continue;

      const vassalLocs: string[] = [];
      for (const vtag of vassalTags) {
        if (allCountryLocations[vtag]) {
          vassalLocs.push(...allCountryLocations[vtag]);
        }
      }
      if (vassalLocs.length > 0) {
        const vassalKey = `${overlordTag}_vassals`;
        countryLocations[vassalKey] = vassalLocs;
        tagLabels[vassalKey] = `${overlordTag} - vassals and fiefdoms`;
        if (countryColors[overlordTag]) {
          countryColors[vassalKey] = lightenColor(countryColors[overlordTag], 2 / 3);
        }
      }
    }
  }

  return generateMapChartConfig(countryLocations, countryColors, locToProvince, {
    ...options,
    tagLabels,
  });
}
