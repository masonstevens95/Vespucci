/**
 * Build a minimal synthetic EU5 melted save for testing.
 *
 * The location ownership section must start after line 1000 (the parser
 * skips lines 0-999 when looking for the second locations={} block).
 */
export function buildMinimalSave(overrides: {
  locationNames?: string[];
  tags?: Record<number, string>;
  ownership?: Record<number, number>;
  colors?: Record<string, [number, number, number]>;
  /** country_id -> capital_location_id */
  capitals?: Record<number, number>;
  ioVassals?: { leader: number; members: number[] }[];
  overlordCandidateFlags?: string[];
  diplomacySubjects?: { countryId: number; libertyDesire: number; relations: number[] }[];
  players?: { name: string; country: number }[];
} = {}): string {
  const locNames = overrides.locationNames ?? ["stockholm", "paris", "london"];
  const tags = overrides.tags ?? { 0: "SWE", 1: "FRA", 2: "ENG" };
  // Location ids are 1-based, matching the gamestate's own location database:
  // its keys run 1..N against an N-entry name array.
  const ownership = overrides.ownership ?? { 1: 0, 2: 1, 3: 2 };
  const colors = overrides.colors ?? { SWE: [0, 0, 255], FRA: [0, 0, 200], ENG: [255, 0, 0] };
  const capitals = overrides.capitals ?? {};
  const ioVassals = overrides.ioVassals ?? [];
  const overlordFlags = overrides.overlordCandidateFlags ?? [];
  const dipSubjects = overrides.diplomacySubjects ?? [];
  const players = overrides.players ?? [];

  const sections: string[] = [];

  // Header + metadata locations (must be in first 100 lines)
  sections.push("SAV02000000000000000000000000");
  sections.push("metadata={");
  sections.push("\tcompatibility={");
  sections.push("\t\tlocations={");
  sections.push(`\t\t\t${locNames.join(" ")}`);
  sections.push("\t\t}");
  sections.push("\t}");
  sections.push("}");

  // Countries section
  sections.push("countries={");
  sections.push("\ttags={");
  for (const [id, tag] of Object.entries(tags)) {
    sections.push(`\t\t${id}=${tag}`);
  }
  sections.push("\t}");
  // Build reverse map: tag -> country ID for database entries
  const tagToId: Record<string, number> = {};
  for (const [id, tag] of Object.entries(tags)) {
    tagToId[tag] = parseInt(id);
  }

  sections.push("\tdatabase={");
  for (const [flag, [r, g, b]] of Object.entries(colors)) {
    const countryId = tagToId[flag] ?? 0;
    sections.push(`\t\t${countryId}={`);
    sections.push(`\t\t\tflag=${flag}`);
    sections.push(`\t\t\tcolor=rgb {`);
    sections.push(`\t\t\t\t${r} ${g} ${b}`);
    sections.push(`\t\t\t}`);
    if (capitals[countryId] !== undefined) {
      sections.push(`\t\t\tcapital=${capitals[countryId]}`);
    }
    // Add subject_tax for overlord candidates
    if (overlordFlags.includes(flag)) {
      sections.push(`\t\t\tlast_months_subject_tax=100.5`);
    }
    sections.push(`\t\t}`);
  }
  sections.push("\t}");
  sections.push("}");

  // Pad to line 1000+
  const currentLength = sections.length;
  for (let i = 0; i < 1005 - currentLength; i++) {
    sections.push("");
  }

  // Location ownership section (must be past line 1000)
  sections.push("locations={");
  sections.push("\tlocations={");
  for (const [locId, ownerId] of Object.entries(ownership)) {
    sections.push(`\t\t${locId}={`);
    sections.push(`\t\t\towner=${ownerId}`);
    sections.push(`\t\t\tcontroller=${ownerId}`);
    sections.push(`\t\t}`);
  }
  sections.push("\t}");
  sections.push("}");

  // IO manager
  if (ioVassals.length > 0) {
    sections.push("international_organization_manager={");
    sections.push("\tdatabase={");
    ioVassals.forEach((io, idx) => {
      sections.push(`\t\t${idx}={`);
      sections.push(`\t\t\ttype=loc`);
      sections.push(`\t\t\tleader=${io.leader}`);
      sections.push(`\t\t\tall_members={`);
      sections.push(`\t\t\t\t${io.members.join(" ")}`);
      sections.push(`\t\t\t}`);
      sections.push(`\t\t}`);
    });
    sections.push("\t}");
    sections.push("}");
  }

  // Diplomacy manager
  if (dipSubjects.length > 0) {
    sections.push("diplomacy_manager={");
    for (const sub of dipSubjects) {
      sections.push(`\t${sub.countryId}={`);
      sections.push(`\t\tliberty_desire=${sub.libertyDesire}`);
      if (sub.relations.length > 0) {
        sections.push(`\t\trelations={`);
        for (const rel of sub.relations) {
          sections.push(`\t\t\t${rel}={`);
          sections.push(`\t\t\t}`);
        }
        sections.push(`\t\t}`);
      }
      sections.push(`\t}`);
    }
    sections.push("}");
  }

  // Player countries
  for (const player of players) {
    sections.push("played_country={");
    sections.push(`\tname="${player.name}"`);
    sections.push(`\tcountry=${player.country}`);
    sections.push("}");
  }

  return sections.join("\n");
}
