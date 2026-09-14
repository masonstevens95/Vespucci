import { describe, it, expect } from "vitest";
import {
  cleanLocationName,
  splitTokens,
  afterBrace,
  beforeBrace,
  matchKeyValue,
  matchBlockStart,
  matchOwner,
  parseRgbLine,
  findSectionLine,
  findSectionEnd,
  parseLocationNames,
  parseCountryTags,
  parseLocationOwnership,
  parseCountryColors,
  parseCountryCapitals,
  parseSubjects,
  parsePlayerCountries,
  collectMatchedSubjects,
  buildCountryLocations,
  buildTagToPlayers,
  parseMeltedSave,
} from "../save-parser";
import { buildMinimalSave } from "./fixtures/minimal-save";

// =============================================================================
// Line-level helpers
// =============================================================================

describe("cleanLocationName", () => {
  it("strips quotes", () => {
    expect(cleanLocationName('"moscow"')).toBe("moscow");
  });
  it("strips braces", () => {
    expect(cleanLocationName("tokyo}")).toBe("tokyo");
  });
  it("trims whitespace", () => {
    expect(cleanLocationName("  paris  ")).toBe("paris");
  });
  it("returns empty for junk", () => {
    expect(cleanLocationName('"}"')).toBe("");
  });
});

describe("splitTokens", () => {
  it("splits whitespace", () => {
    expect(splitTokens("a b  c")).toEqual(["a", "b", "c"]);
  });
  it("returns empty for blank", () => {
    expect(splitTokens("   ")).toEqual([]);
  });
});

describe("afterBrace", () => {
  it("extracts after {", () => {
    expect(afterBrace("locations={ foo bar")).toBe("foo bar");
  });
  it("returns empty if no brace", () => {
    expect(afterBrace("no brace")).toBe("");
  });
});

describe("beforeBrace", () => {
  it("extracts before }", () => {
    expect(beforeBrace("foo bar }")).toBe("foo bar");
  });
  it("returns full string if no brace", () => {
    expect(beforeBrace("no brace")).toBe("no brace");
  });
});

describe("matchKeyValue", () => {
  it("matches digit=word", () => {
    expect(matchKeyValue("42=SWE")).toEqual(["42", "SWE"]);
  });
  it("returns undefined for non-match", () => {
    expect(matchKeyValue("flag=SWE")).toBeUndefined();
  });
});

describe("matchBlockStart", () => {
  it("matches digit={", () => {
    expect(matchBlockStart("5={")).toBe("5");
  });
  it("returns undefined for non-match", () => {
    expect(matchBlockStart("name={")).toBeUndefined();
  });
});

describe("matchOwner", () => {
  it("matches owner=N", () => {
    expect(matchOwner("owner=42")).toBe(42);
  });
  it("returns undefined for non-match", () => {
    expect(matchOwner("controller=42")).toBeUndefined();
  });
});

describe("parseRgbLine", () => {
  it("parses R G B", () => {
    expect(parseRgbLine("255 128 0")).toEqual([255, 128, 0]);
  });
  it("returns undefined for too few parts", () => {
    expect(parseRgbLine("255 128")).toBeUndefined();
  });
  it("returns undefined for NaN", () => {
    expect(parseRgbLine("red green blue")).toBeUndefined();
  });
});

// =============================================================================
// Section finders
// =============================================================================

describe("findSectionLine", () => {
  it("finds matching line", () => {
    expect(findSectionLine(["a", "b={", "c"], "b={")).toBe(1);
  });
  it("respects startFrom", () => {
    expect(findSectionLine(["a={", "b", "a={"], "a={", 1)).toBe(2);
  });
  it("returns -1 when not found", () => {
    expect(findSectionLine(["a", "b"], "c")).toBe(-1);
  });
});

describe("findSectionEnd", () => {
  it("finds next unindented section", () => {
    const lines = ["start={", "\tcontent", "next={"];
    expect(findSectionEnd(lines, 0)).toBe(2);
  });
  it("returns lines.length when no next section", () => {
    const lines = ["start={", "\tcontent"];
    expect(findSectionEnd(lines, 0)).toBe(2);
  });
});

// =============================================================================
// Step parsers
// =============================================================================

describe("parseLocationNames", () => {
  it("extracts location names from metadata", () => {
    const lines = ["metadata={", "\tcompatibility={", "\t\tlocations={",
      "\t\t\tstockholm paris london", "\t\t}", "\t}", "}"];
    // Keyed by location id: the save's location database numbers from 1.
    expect(parseLocationNames(lines)).toEqual({ 1: "stockholm", 2: "paris", 3: "london" });
  });
  it("handles locations on same line as brace", () => {
    const lines = ["metadata={", "\tlocations={ rome vienna", "\t\tberlin }", "}"];
    expect(parseLocationNames(lines)).toEqual({ 1: "rome", 2: "vienna", 3: "berlin" });
  });
  it("strips quotes", () => {
    expect(parseLocationNames(['locations={ "moscow" "tokyo" }'])).toEqual({ 1: "moscow", 2: "tokyo" });
  });
  it("returns empty for no locations block", () => {
    expect(parseLocationNames(["metadata={", "}"])).toEqual({});
  });
  it("ignores locations block past line 100", () => {
    const lines = new Array(101).fill("").concat(["locations={ late }"]);
    expect(parseLocationNames(lines)).toEqual({});
  });
});

describe("parseCountryTags", () => {
  it("extracts tag mapping", () => {
    const lines = ["countries={", "\ttags={", "\t\t0=SWE", "\t\t1=FRA", "\t\t42=ENG", "\t}", "}"];
    expect(parseCountryTags(lines)).toEqual({ 0: "SWE", 1: "FRA", 42: "ENG" });
  });
  it("returns empty when no countries section", () => {
    expect(parseCountryTags(["other={", "}"])).toEqual({});
  });
  it("handles non-sequential IDs", () => {
    expect(parseCountryTags(["countries={", "\ttags={", "\t\t5=AAA", "\t\t100=BBB", "\t}", "}"])).toEqual({ 5: "AAA", 100: "BBB" });
  });
  it("skips non-matching lines in tags block", () => {
    const lines = ["countries={", "\ttags={", "\t\tgarbage_line", "\t\t0=SWE", "\t}", "}"];
    expect(parseCountryTags(lines)).toEqual({ 0: "SWE" });
  });
  it("returns empty when countries section has no tags block", () => {
    const lines = ["countries={", "\tother_stuff={", "\t}", "}"];
    expect(parseCountryTags(lines)).toEqual({});
  });
});

describe("parseLocationOwnership", () => {
  it("extracts ownership past line 1000", () => {
    const padding = new Array(1005).fill("");
    const lines = [...padding, "locations={", "\tlocations={", "\t\t0={", "\t\t\towner=1", "\t\t}",
      "\t\t3={", "\t\t\towner=0", "\t\t}", "\t}", "}"];
    expect(parseLocationOwnership(lines, { 0: "SWE", 1: "FRA" })).toEqual({ 0: "FRA", 3: "SWE" });
  });
  it("skips unknown owners", () => {
    const padding = new Array(1005).fill("");
    const lines = [...padding, "locations={", "\tlocations={", "\t\t0={", "\t\t\towner=999", "\t\t}", "\t}", "}"];
    expect(parseLocationOwnership(lines, { 0: "SWE" })).toEqual({});
  });
  it("skips lines before inner locations block", () => {
    const padding = new Array(1005).fill("");
    const lines = [...padding, "locations={", "\tother_stuff={", "\tlocations={", "\t\t0={", "\t\t\towner=0", "\t\t}", "\t}", "}"];
    expect(parseLocationOwnership(lines, { 0: "SWE" })).toEqual({ 0: "SWE" });
  });
  it("returns empty if no section past 1000", () => {
    expect(parseLocationOwnership(["locations={", "\tlocations={", "\t\t0={", "\t\t\towner=0", "\t\t}", "\t}", "}"], { 0: "SWE" })).toEqual({});
  });
});

describe("parseCountryColors", () => {
  it("extracts RGB colors keyed by flag", () => {
    const lines = ["database={", "\t0={", "\t\tflag=SWE", "\t\tcolor=rgb {", "\t\t\t0 0 255", "\t\t}", "\t}",
      "\t1={", "\t\tflag=FRA", "\t\tcolor=rgb {", "\t\t\t33 33 173", "\t\t}", "\t}", "}"];
    expect(parseCountryColors(lines)).toEqual({ SWE: [0, 0, 255], FRA: [33, 33, 173] });
  });
  it("handles flag before color at any distance", () => {
    const lines = ["database={", "\tflag=ENG", "\tsome=val", "\tcolor=rgb {", "\t\t255 0 0", "\t}", "}"];
    expect(parseCountryColors(lines)).toEqual({ ENG: [255, 0, 0] });
  });
  it("skips invalid RGB data", () => {
    const lines = ["database={", "\tflag=SWE", "\tcolor=rgb {", "\t\tnot a number", "\t}", "}"];
    expect(parseCountryColors(lines)).toEqual({});
  });
  it("returns empty when no database", () => {
    expect(parseCountryColors(["no_database={}"])).toEqual({});
  });
});

describe("parseCountryCapitals", () => {
  it("extracts country -> capital", () => {
    const lines = ["countries={", "\tdatabase={", "\t\t0={", "\t\t\tcapital=100", "\t\t}",
      "\t\t1={", "\t\t\tcapital=200", "\t\t}", "\t}", "}"];
    expect(parseCountryCapitals(lines)).toEqual({ 0: 100, 1: 200 });
  });
  it("returns empty when no countries", () => {
    expect(parseCountryCapitals(["other={}"])).toEqual({});
  });
});

describe("parseSubjects", () => {
  const baseTags = { 0: "ENG", 1: "FRA", 2: "SWE", 3: "SCO", 4: "WLS" };

  it("extracts IO type=loc subjects", () => {
    const lines = ["international_organization_manager={", "\tdatabase={", "\t\t0={",
      "\t\t\ttype=loc", "\t\t\tleader=0", "\t\t\tall_members={", "\t\t\t\t0 3 4",
      "\t\t\t}", "\t\t}", "\t}", "}", "next={"];
    expect(parseSubjects(lines, baseTags, {}, {})["ENG"]).toEqual(new Set(["SCO", "WLS"]));
  });

  it("handles empty all_members", () => {
    const lines = ["international_organization_manager={", "\tdatabase={", "\t\t0={",
      "\t\t\ttype=loc", "\t\t\tleader=0", "\t\t\tall_members={", "\t\t\t}",
      "\t\t}", "\t}", "}", "next={"];
    expect(parseSubjects(lines, baseTags, {}, {})).toEqual({});
  });

  it("ignores non-loc IO types", () => {
    const lines = ["international_organization_manager={", "\tdatabase={", "\t\t0={",
      "\t\t\ttype=hre", "\t\t\tleader=0", "\t\t\tall_members={", "\t\t\t\t0 1 2",
      "\t\t\t}", "\t\t}", "\t}", "}", "next={"];
    expect(parseSubjects(lines, baseTags, {}, {})).toEqual({});
  });

  it("matches capital ownership subjects", () => {
    const lines = ["diplomacy_manager={", "\t3={", "\t\tliberty_desire=10", "\t}", "}", "next={"];
    const result = parseSubjects(lines, baseTags, { 50: "ENG" }, { 3: 50 });
    expect(result["ENG"]).toEqual(new Set(["SCO"]));
  });

  it("skips self-owned capitals", () => {
    const lines = ["diplomacy_manager={", "\t3={", "\t\tliberty_desire=10", "\t}", "}", "next={"];
    expect(parseSubjects(lines, baseTags, { 50: "SCO" }, { 3: 50 })).toEqual({});
  });

  it("returns empty when no sections", () => {
    expect(parseSubjects(["nothing"], baseTags, {}, {})).toEqual({});
  });
});

describe("parsePlayerCountries", () => {
  const tags = { 0: "SWE", 1: "FRA" };

  it("extracts player -> tag", () => {
    const lines = ["played_country={", '\tname="Alice"', "\tcountry=0", "}",
      "played_country={", '\tname="Bob"', "\tcountry=1", "}"];
    expect(parsePlayerCountries(lines, tags)).toEqual({ Alice: "SWE", Bob: "FRA" });
  });
  it("last entry wins for same player", () => {
    const lines = ["played_country={", '\tname="Alice"', "\tcountry=0", "}",
      "played_country={", '\tname="Alice"', "\tcountry=1", "}"];
    expect(parsePlayerCountries(lines, tags)).toEqual({ Alice: "FRA" });
  });
  it("skips unknown country IDs", () => {
    expect(parsePlayerCountries(["played_country={", '\tname="Alice"', "\tcountry=999", "}"], tags)).toEqual({});
  });
  it("returns empty for no blocks", () => {
    expect(parsePlayerCountries(["nothing"], tags)).toEqual({});
  });
});

// =============================================================================
// Build helpers
// =============================================================================

describe("collectMatchedSubjects", () => {
  it("collects all subject tags", () => {
    const result = collectMatchedSubjects({ A: new Set(["X", "Y"]), B: new Set(["Z"]) });
    expect(result).toEqual(new Set(["X", "Y", "Z"]));
  });
  it("returns empty for no subjects", () => {
    expect(collectMatchedSubjects({})).toEqual(new Set());
  });
});

describe("buildCountryLocations", () => {
  it("maps owners to named locations", () => {
    const result = buildCountryLocations({ 0: "SWE", 1: "FRA" }, { 0: "stockholm", 1: "paris" });
    expect(result).toEqual({ SWE: ["stockholm"], FRA: ["paris"] });
  });
  it("uses fallback name for unmapped IDs", () => {
    const result = buildCountryLocations({ 5: "SWE" }, {});
    expect(result).toEqual({ SWE: ["loc_5"] });
  });
});

describe("buildTagToPlayers", () => {
  it("groups players by tag", () => {
    const result = buildTagToPlayers({ Alice: "SWE", Bob: "SWE", Carol: "FRA" });
    expect(result).toEqual({ SWE: ["Alice", "Bob"], FRA: ["Carol"] });
  });
  it("returns empty for no players", () => {
    expect(buildTagToPlayers({})).toEqual({});
  });
});

// =============================================================================
// Integration
// =============================================================================

describe("parseMeltedSave", () => {
  it("parses a complete minimal save", () => {
    const save = buildMinimalSave({
      locationNames: ["stockholm", "paris", "london"],
      tags: { 0: "SWE", 1: "FRA", 2: "ENG" },
      ownership: { 1: 0, 2: 1, 3: 2 },
      colors: { SWE: [0, 0, 255], FRA: [33, 33, 173], ENG: [255, 0, 0] },
      players: [{ name: "Alice", country: 0 }, { name: "Bob", country: 1 }],
    });
    const result = parseMeltedSave(save);
    expect(result.countryLocations).toEqual({ SWE: ["stockholm"], FRA: ["paris"], ENG: ["london"] });
    expect(result.tagToPlayers).toEqual({ SWE: ["Alice"], FRA: ["Bob"] });
  });

  it("handles empty save", () => {
    const result = parseMeltedSave("");
    expect(result.countryLocations).toEqual({});
    expect(result.tagToPlayers).toEqual({});
    expect(result.countryColors).toEqual({});
    expect(result.overlordSubjects).toEqual({});
  });

  it("uses loc_N fallback for unmapped IDs", () => {
    const save = buildMinimalSave({
      locationNames: ["rome"],
      tags: { 0: "PAP" },
      ownership: { 1: 0, 5: 0 },
    });
    const result = parseMeltedSave(save);
    expect(result.countryLocations["PAP"]).toContain("rome");
    expect(result.countryLocations["PAP"]).toContain("loc_5");
  });

  it("detects vassals via capital ownership", () => {
    const save = buildMinimalSave({
      locationNames: ["london", "cardiff"],
      tags: { 0: "ENG", 1: "WLS" },
      ownership: { 1: 0, 2: 0 },
      colors: { ENG: [255, 0, 0], WLS: [0, 255, 0] },
      capitals: { 0: 1, 1: 2 },
      diplomacySubjects: [{ countryId: 1, libertyDesire: -14, relations: [] }],
    });
    const result = parseMeltedSave(save);
    expect(result.overlordSubjects["ENG"]).toEqual(new Set(["WLS"]));
  });
});
