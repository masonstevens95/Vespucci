import { describe, it, expect } from "vitest";
import { TokenReader } from "../token-reader";
import { BinaryToken } from "../tokens";
import { T } from "../game-tokens";
import { readCountries, readCountryTags, readCountryEntry, readCountryDatabase } from "../sections/countries";
import { readLocationOwnership, readLocationEntries, readLocationEntry } from "../sections/locations";
import { readIOManager, readIOEntries, readIOEntry } from "../sections/io-manager";
import { readDiplomacy, readDiplomacyEntry } from "../sections/diplomacy";
import { readPlayedCountry } from "../sections/players";
import { readMetadataLocations } from "../sections/metadata";
import { findDependencies } from "../sections/dependencies";
import { findWarSubjects } from "../sections/war-subjects";
import { tokenId } from "../token-names";
import { bytes, u16, eq, open, close, uintVal, intVal, quotedStr } from "./helpers";
import type { RGB } from "../../types";

// =============================================================================
// metadata.ts
// =============================================================================

describe("readMetadataLocations", () => {
  it("reads location names from metadata > compatibility > locations", () => {
    const COMPAT = T.compatibility!;
    const LOC = T.locations!;
    const data = bytes(
      u16(COMPAT), eq(), open(),
        u16(LOC), eq(), open(),
          quotedStr("stockholm"), quotedStr("paris"), quotedStr("london"),
        close(),
      close(),
      close(), // end of metadata
    );
    const r = new TokenReader(data, ["stockholm", "paris", "london"]);
    const names: Record<number, string> = {};
    readMetadataLocations(r, names);
    expect(names).toEqual({ 0: "stockholm", 1: "paris", 2: "london" });
  });

  it("skips unknown fields in metadata", () => {
    const COMPAT = T.compatibility!;
    const LOC = T.locations!;
    const UNKNOWN = 0x9999;
    const data = bytes(
      u16(UNKNOWN), eq(), uintVal(42),
      u16(COMPAT), eq(), open(),
        u16(LOC), eq(), open(),
          quotedStr("rome"),
        close(),
      close(),
      close(),
    );
    const r = new TokenReader(data, ["rome"]);
    const names: Record<number, string> = {};
    readMetadataLocations(r, names);
    expect(names[0]).toBe("rome");
  });

  it("skips unknown fields in compatibility block", () => {
    const COMPAT = T.compatibility!;
    const LOC = T.locations!;
    const UNKNOWN = 0x9999;
    const data = bytes(
      u16(COMPAT), eq(), open(),
        u16(UNKNOWN), eq(), uintVal(0),
        u16(LOC), eq(), open(),
          quotedStr("berlin"),
        close(),
      close(),
      close(),
    );
    const r = new TokenReader(data, ["berlin"]);
    const names: Record<number, string> = {};
    readMetadataLocations(r, names);
    expect(names[0]).toBe("berlin");
  });

  it("handles empty locations block", () => {
    const COMPAT = T.compatibility!;
    const LOC = T.locations!;
    const data = bytes(
      u16(COMPAT), eq(), open(),
        u16(LOC), eq(), open(), close(),
      close(),
      close(),
    );
    const r = new TokenReader(data);
    const names: Record<number, string> = {};
    readMetadataLocations(r, names);
    expect(names).toEqual({});
  });

  it("returns empty for no compatibility section", () => {
    const data = bytes(close());
    const r = new TokenReader(data);
    const names: Record<number, string> = {};
    readMetadataLocations(r, names);
    expect(names).toEqual({});
  });
});

// =============================================================================
// countries.ts
// =============================================================================

describe("readCountries", () => {
  it("delegates to readCountryTags and readCountryDatabase", () => {
    const TAGS = T.tags!;
    const DB = T.database!;
    const FLAG = T.flag!;
    const data = bytes(
      u16(TAGS), eq(), open(),
        uintVal(0), eq(), quotedStr("SWE"),
      close(),
      u16(DB), eq(), open(),
        uintVal(0), eq(), open(),
          u16(FLAG), eq(), quotedStr("SWE"),
          u16(T.capital!), eq(), uintVal(1),
        close(),
      close(),
      close(), // end of countries
    );
    const r = new TokenReader(data, ["SWE"]);
    const tags: Record<number, string> = {};
    const colors: Record<string, RGB> = {};
    const capitals: Record<number, number> = {};
    readCountries(r, tags, colors, capitals, new Set());
    expect(tags[0]).toBe("SWE");
    expect(capitals[0]).toBe(1);
  });

  it("skips unknown fields", () => {
    const UNKNOWN = 0x8888;
    const TAGS = T.tags!;
    const data = bytes(
      u16(UNKNOWN), eq(), uintVal(99),
      u16(TAGS), eq(), open(),
        uintVal(0), eq(), quotedStr("FRA"),
      close(),
      close(),
    );
    const r = new TokenReader(data, ["FRA"]);
    const tags: Record<number, string> = {};
    readCountries(r, tags, {}, {}, new Set());
    expect(tags[0]).toBe("FRA");
  });
});

describe("readCountryTags", () => {
  it("reads U32=string entries until close", () => {
    const data = bytes(
      uintVal(0), eq(), quotedStr("SWE"),
      uintVal(1), eq(), quotedStr("FRA"),
      close(),
    );
    const r = new TokenReader(data, ["SWE", "FRA"]);
    const tags: Record<number, string> = {};
    readCountryTags(r, tags);
    expect(tags).toEqual({ 0: "SWE", 1: "FRA" });
  });

  it("handles empty block", () => {
    const data = bytes(close());
    const r = new TokenReader(data);
    const tags: Record<number, string> = {};
    readCountryTags(r, tags);
    expect(tags).toEqual({});
  });

  it("skips non-integer tokens", () => {
    const UNKNOWN = 0x7777;
    const data = bytes(
      u16(UNKNOWN), eq(), uintVal(0),
      uintVal(0), eq(), quotedStr("SWE"),
      close(),
    );
    const r = new TokenReader(data, ["SWE"]);
    const tags: Record<number, string> = {};
    readCountryTags(r, tags);
    expect(tags[0]).toBe("SWE");
  });

  it("reads I32 entries", () => {
    const data = bytes(
      intVal(5), eq(), quotedStr("ENG"),
      close(),
    );
    const r = new TokenReader(data, ["ENG"]);
    const tags: Record<number, string> = {};
    readCountryTags(r, tags);
    expect(tags[5]).toBe("ENG");
  });
});

describe("readCountryDatabase", () => {
  it("skips non-block entries (ID = none)", () => {
    const NONE_TOKEN = 0x9876;
    const data = bytes(
      uintVal(42), eq(), u16(NONE_TOKEN),
      uintVal(99), eq(), open(),
        u16(T.flag!), eq(), quotedStr("SWE"),
        u16(T.COLOR), eq(), u16(T.RGB), open(),
          uintVal(0), uintVal(0), uintVal(255),
        close(),
      close(),
      close(),
    );
    const r = new TokenReader(data, ["SWE"]);
    const colors: Record<string, RGB> = {};
    readCountryDatabase(r, colors, {}, new Set());
    expect(colors["SWE"]).toEqual([0, 0, 255]);
  });

  it("handles empty block", () => {
    const data = bytes(close());
    const r = new TokenReader(data);
    const colors: Record<string, RGB> = {};
    readCountryDatabase(r, colors, {}, new Set());
    expect(colors).toEqual({});
  });

  it("skips non-integer keyed entries", () => {
    const UNKNOWN = 0x7777;
    const data = bytes(
      u16(UNKNOWN), eq(), uintVal(0),
      close(),
    );
    const r = new TokenReader(data);
    readCountryDatabase(r, {}, {}, new Set());
    // Just ensure it doesn't crash
  });
});

describe("readCountryEntry", () => {
  it("extracts flag and color", () => {
    const data = bytes(
      u16(T.flag!), eq(), quotedStr("NED"),
      u16(T.COLOR), eq(), u16(T.RGB), open(),
        uintVal(250), uintVal(84), uintVal(5),
      close(),
      close(),
    );
    const r = new TokenReader(data);
    const colors: Record<string, RGB> = {};
    const capitals: Record<number, number> = {};
    const overlordCandidates = new Set<string>();
    readCountryEntry(r, 42, colors, capitals, overlordCandidates);
    expect(colors["NED"]).toEqual([250, 84, 5]);
  });

  it("handles nested blocks with value tokens at depth > 1", () => {
    const SCORE = 0x4444;
    const RATING = 0x5555;
    const data = bytes(
      u16(T.flag!), eq(), quotedStr("SWE"),
      u16(SCORE), eq(), open(),
        u16(RATING), eq(), open(),
          u16(BinaryToken.LOOKUP_U16), [0x00, 0x00],
          eq(),
          u16(0x0d4a), [0x01, 0x02, 0x03],
        close(),
      close(),
      u16(T.COLOR), eq(), u16(T.RGB), open(),
        uintVal(10), uintVal(20), uintVal(30),
      close(),
      close(),
    );
    const r = new TokenReader(data);
    const colors: Record<string, RGB> = {};
    readCountryEntry(r, 0, colors, {}, new Set());
    expect(colors["SWE"]).toEqual([10, 20, 30]);
  });

  it("survives complex nested entries without misalignment", () => {
    const SCORE = 0x4444;
    const INNER = 0x5555;
    const data = bytes(
      u16(SCORE), eq(), open(),
        u16(INNER), eq(), open(),
          uintVal(42),
          u16(BinaryToken.LOOKUP_U16), [0x00, 0x00],
          eq(),
          u16(0x0d4a), [0x01, 0x02, 0x03],
        close(),
      close(),
      u16(T.flag!), eq(), quotedStr("TEST"),
      u16(T.COLOR), eq(), u16(T.RGB), open(),
        uintVal(100), uintVal(200), uintVal(50),
      close(),
      u16(T.capital!), eq(), uintVal(999),
      close(),
    );
    const r = new TokenReader(data);
    const colors: Record<string, RGB> = {};
    const capitals: Record<number, number> = {};
    readCountryEntry(r, 7, colors, capitals, new Set());
    expect(colors["TEST"]).toEqual([100, 200, 50]);
    expect(capitals[7]).toBe(999);
  });

  it("extracts capital", () => {
    const data = bytes(
      u16(T.flag!), eq(), quotedStr("SWE"),
      u16(T.capital!), eq(), uintVal(100),
      close(),
    );
    const r = new TokenReader(data);
    const colors: Record<string, RGB> = {};
    const capitals: Record<number, number> = {};
    readCountryEntry(r, 7, colors, capitals, new Set());
    expect(capitals[7]).toBe(100);
  });

  it("handles entry with no flag", () => {
    const data = bytes(
      u16(T.capital!), eq(), uintVal(50),
      close(),
    );
    const r = new TokenReader(data);
    const colors: Record<string, RGB> = {};
    const capitals: Record<number, number> = {};
    readCountryEntry(r, 3, colors, capitals, new Set());
    expect(capitals[3]).toBe(50);
    expect(Object.keys(colors)).toHaveLength(0);
  });

  it("detects overlord candidates via subject_tax", () => {
    const data = bytes(
      u16(T.flag!), eq(), quotedStr("BOH"),
      u16(T.subjectTax!), eq(), u16(BinaryToken.F32), [0x00, 0x00, 0x80, 0x3f], // 1.0f
      close(),
    );
    const r = new TokenReader(data);
    const overlord = new Set<string>();
    readCountryEntry(r, 0, {}, {}, overlord);
    expect(overlord.has("BOH")).toBe(true);
  });

  it("skips subject_tax when zero", () => {
    const data = bytes(
      u16(T.flag!), eq(), quotedStr("AAA"),
      u16(T.subjectTax!), eq(), u16(BinaryToken.F32), [0x00, 0x00, 0x00, 0x00], // 0.0f
      close(),
    );
    const r = new TokenReader(data);
    const overlord = new Set<string>();
    readCountryEntry(r, 0, {}, {}, overlord);
    expect(overlord.has("AAA")).toBe(false);
  });

  it("uses mapColor as color fallback", () => {
    const MAP_COLOR = T.mapColor!;
    const data = bytes(
      u16(T.flag!), eq(), quotedStr("ENG"),
      u16(MAP_COLOR), eq(), u16(T.RGB), open(),
        uintVal(255), uintVal(0), uintVal(0),
      close(),
      close(),
    );
    const r = new TokenReader(data);
    const colors: Record<string, RGB> = {};
    readCountryEntry(r, 1, colors, {}, new Set());
    expect(colors["ENG"]).toEqual([255, 0, 0]);
  });
});

// =============================================================================
// locations.ts
// =============================================================================

describe("readLocationOwnership", () => {
  it("finds inner locations block and reads entries", () => {
    const LOC = T.locations!;
    const OWNER = T.owner!;
    const data = bytes(
      u16(LOC), eq(), open(),
        u16(BinaryToken.I32), [1, 0, 0, 0], eq(), open(),
          u16(OWNER), eq(), uintVal(0),
        close(),
      close(),
      close(),
    );
    const r = new TokenReader(data);
    const owners: Record<number, string> = {};
    readLocationOwnership(r, data, { 0: "SWE" }, owners, {});
    expect(owners[1]).toBe("SWE");
  });

  it("skips unknown fields before locations", () => {
    const LOC = T.locations!;
    const OWNER = T.owner!;
    const UNKNOWN = 0x9999;
    const data = bytes(
      u16(UNKNOWN), eq(), uintVal(42),
      u16(LOC), eq(), open(),
        u16(BinaryToken.I32), [1, 0, 0, 0], eq(), open(),
          u16(OWNER), eq(), uintVal(0),
        close(),
      close(),
      close(),
    );
    const r = new TokenReader(data);
    const owners: Record<number, string> = {};
    readLocationOwnership(r, data, { 0: "SWE" }, owners, {});
    expect(owners[1]).toBe("SWE");
  });

  it("handles empty outer block", () => {
    const data = bytes(close());
    const r = new TokenReader(data);
    const owners: Record<number, string> = {};
    readLocationOwnership(r, data, {}, owners, {});
    expect(owners).toEqual({});
  });
});

describe("readLocationEntries", () => {
  it("reads location ID -> owner mappings", () => {
    const OWNER = T.owner!;
    const data = bytes(
      u16(BinaryToken.I32), [1, 0, 0, 0], eq(), open(),
        u16(OWNER), eq(), uintVal(0),
      close(),
      u16(BinaryToken.I32), [2, 0, 0, 0], eq(), open(),
        u16(OWNER), eq(), uintVal(1),
      close(),
      close(),
    );
    const r = new TokenReader(data);
    const tags = { 0: "SWE", 1: "FRA" };
    const owners: Record<number, string> = {};
    readLocationEntries(r, data, tags, owners, {});
    expect(owners).toEqual({ 1: "SWE", 2: "FRA" });
  });

  it("skips entries with unknown owner", () => {
    const OWNER = T.owner!;
    const data = bytes(
      u16(BinaryToken.I32), [1, 0, 0, 0], eq(), open(),
        u16(OWNER), eq(), uintVal(999),
      close(),
      close(),
    );
    const r = new TokenReader(data);
    const owners: Record<number, string> = {};
    readLocationEntries(r, data, { 0: "SWE" }, owners, {});
    expect(owners).toEqual({});
  });

  it("skips non-integer keyed entries", () => {
    const UNKNOWN = 0x7777;
    const OWNER = T.owner!;
    const data = bytes(
      u16(UNKNOWN), eq(), uintVal(0),
      u16(BinaryToken.I32), [1, 0, 0, 0], eq(), open(),
        u16(OWNER), eq(), uintVal(0),
      close(),
      close(),
    );
    const r = new TokenReader(data);
    const owners: Record<number, string> = {};
    readLocationEntries(r, data, { 0: "SWE" }, owners, {});
    expect(owners[1]).toBe("SWE");
  });

  it("handles empty block", () => {
    const data = bytes(close());
    const r = new TokenReader(data);
    const owners: Record<number, string> = {};
    readLocationEntries(r, data, {}, owners, {});
    expect(owners).toEqual({});
  });
});

describe("readLocationEntry", () => {
  it("reads owner from entry block", () => {
    const OWNER = T.owner!;
    const data = bytes(
      u16(OWNER), eq(), uintVal(0),
      close(),
    );
    const r = new TokenReader(data);
    const owners: Record<number, string> = {};
    readLocationEntry(r, data, 5, { 0: "SWE" }, owners, {});
    expect(owners[5]).toBe("SWE");
  });

  it("reads owner even when not the first field", () => {
    const UNKNOWN = 0x8888;
    const OWNER = T.owner!;
    const data = bytes(
      u16(UNKNOWN), eq(), uintVal(0),
      u16(OWNER), eq(), uintVal(0),
      close(),
    );
    const r = new TokenReader(data);
    const owners: Record<number, string> = {};
    readLocationEntry(r, data, 5, { 0: "SWE" }, owners, {});
    expect(owners[5]).toBe("SWE");
  });

  it("skips entry when no owner present", () => {
    const UNKNOWN = 0x8888;
    const data = bytes(
      u16(UNKNOWN), eq(), uintVal(0),
      close(),
    );
    const r = new TokenReader(data);
    const owners: Record<number, string> = {};
    readLocationEntry(r, data, 5, { 0: "SWE" }, owners, {});
    expect(owners).toEqual({});
  });
});

// =============================================================================
// io-manager.ts
// =============================================================================

describe("readIOManager", () => {
  it("finds database and reads IO entries", () => {
    const DB = T.database!;
    const data = bytes(
      u16(DB), eq(), open(),
        uintVal(0), eq(), open(),
          u16(T.TYPE_ENGINE), eq(), quotedStr("autocephalous_patriarchate"),
          u16(T.leader!), eq(), uintVal(0),
          u16(T.allMembers!), eq(), open(), uintVal(0), uintVal(1), close(),
        close(),
      close(),
      close(),
    );
    const r = new TokenReader(data);
    const subjects: Record<string, Set<string>> = {};
    readIOManager(r, { 0: "ENG", 1: "SCO" }, subjects, new Set());
    expect(subjects["ENG"]).toEqual(new Set(["SCO"]));
  });

  it("skips unknown fields before database", () => {
    const DB = T.database!;
    const UNKNOWN = 0x9999;
    const data = bytes(
      u16(UNKNOWN), eq(), uintVal(42),
      u16(DB), eq(), open(),
        uintVal(0), eq(), open(),
          u16(T.TYPE_ENGINE), eq(), quotedStr("loc"),
          u16(T.leader!), eq(), uintVal(0),
          u16(T.allMembers!), eq(), open(), uintVal(0), uintVal(1), close(),
        close(),
      close(),
      close(),
    );
    const r = new TokenReader(data);
    const subjects: Record<string, Set<string>> = {};
    readIOManager(r, { 0: "ENG", 1: "SCO" }, subjects, new Set());
    expect(subjects["ENG"]).toEqual(new Set(["SCO"]));
  });

  it("handles empty block", () => {
    const data = bytes(close());
    const r = new TokenReader(data);
    const subjects: Record<string, Set<string>> = {};
    readIOManager(r, {}, subjects, new Set());
    expect(subjects).toEqual({});
  });
});

describe("readIOEntries", () => {
  it("handles non-block entries (ID = none)", () => {
    const NONE_TOKEN = 0x9876;
    const data = bytes(
      uintVal(42), eq(), u16(NONE_TOKEN),
      close(),
    );
    const r = new TokenReader(data);
    const subjects: Record<string, Set<string>> = {};
    readIOEntries(r, {}, subjects, new Set());
    expect(subjects).toEqual({});
  });

  it("skips non-integer keyed entries", () => {
    const UNKNOWN = 0x7777;
    const data = bytes(
      u16(UNKNOWN), eq(), uintVal(0),
      close(),
    );
    const r = new TokenReader(data);
    const subjects: Record<string, Set<string>> = {};
    readIOEntries(r, {}, subjects, new Set());
    expect(subjects).toEqual({});
  });
});

describe("readIOEntry", () => {
  it("extracts lordship IO with leader and members", () => {
    const data = bytes(
      u16(T.TYPE_ENGINE), eq(), quotedStr("autocephalous_patriarchate"),
      u16(T.leader!), eq(), uintVal(0),
      u16(T.allMembers!), eq(), open(),
        uintVal(0), uintVal(1), uintVal(2),
      close(),
      close(),
    );
    const r = new TokenReader(data);
    const tags = { 0: "ENG", 1: "SCO", 2: "WLS" };
    const subjects: Record<string, Set<string>> = {};
    const matched = new Set<string>();
    readIOEntry(r, tags, subjects, matched);
    expect(subjects["ENG"]).toEqual(new Set(["SCO", "WLS"]));
    expect(matched).toEqual(new Set(["SCO", "WLS"]));
  });

  it("also matches type=loc for lordship", () => {
    const data = bytes(
      u16(T.TYPE_ENGINE), eq(), quotedStr("loc"),
      u16(T.leader!), eq(), uintVal(0),
      u16(T.allMembers!), eq(), open(), uintVal(0), uintVal(1), close(),
      close(),
    );
    const r = new TokenReader(data);
    const subjects: Record<string, Set<string>> = {};
    readIOEntry(r, { 0: "ENG", 1: "SCO" }, subjects, new Set());
    expect(subjects["ENG"]).toEqual(new Set(["SCO"]));
  });

  it("ignores non-lordship IO types", () => {
    const data = bytes(
      u16(T.TYPE_ENGINE), eq(), quotedStr("hre"),
      u16(T.leader!), eq(), uintVal(0),
      close(),
    );
    const r = new TokenReader(data);
    const subjects: Record<string, Set<string>> = {};
    readIOEntry(r, { 0: "ENG" }, subjects, new Set());
    expect(subjects).toEqual({});
  });

  it("handles entry with no type", () => {
    const UNKNOWN = 0x9999;
    const data = bytes(
      u16(UNKNOWN), eq(), uintVal(0),
      close(),
    );
    const r = new TokenReader(data);
    const subjects: Record<string, Set<string>> = {};
    readIOEntry(r, {}, subjects, new Set());
    expect(subjects).toEqual({});
  });

  it("skips leader not in country tags", () => {
    const data = bytes(
      u16(T.TYPE_ENGINE), eq(), quotedStr("loc"),
      u16(T.leader!), eq(), uintVal(999),
      u16(T.allMembers!), eq(), open(), uintVal(999), uintVal(1), close(),
      close(),
    );
    const r = new TokenReader(data);
    const subjects: Record<string, Set<string>> = {};
    readIOEntry(r, { 1: "SCO" }, subjects, new Set());
    expect(subjects).toEqual({});
  });
});

// =============================================================================
// diplomacy.ts
// =============================================================================

describe("readDiplomacy", () => {
  it("collects country IDs with liberty_desire", () => {
    const data = bytes(
      uintVal(42), eq(), open(),
        u16(T.libertyDesire!), eq(), uintVal(10),
      close(),
      uintVal(99), eq(), open(),
        u16(0x9999), eq(), uintVal(0),
      close(),
      close(),
    );
    const r = new TokenReader(data);
    const subjects = new Set<number>();
    readDiplomacy(r, subjects);
    expect(subjects).toEqual(new Set([42]));
  });

  it("handles empty block", () => {
    const data = bytes(close());
    const r = new TokenReader(data);
    const subjects = new Set<number>();
    readDiplomacy(r, subjects);
    expect(subjects).toEqual(new Set());
  });

  it("skips non-integer entries", () => {
    const UNKNOWN = 0x7777;
    const data = bytes(
      u16(UNKNOWN), eq(), uintVal(0),
      close(),
    );
    const r = new TokenReader(data);
    const subjects = new Set<number>();
    readDiplomacy(r, subjects);
    expect(subjects).toEqual(new Set());
  });

  it("handles non-integer entry without trailing eq", () => {
    const UNKNOWN = 0x7777;
    const data = bytes(
      u16(UNKNOWN),
      close(),
    );
    const r = new TokenReader(data);
    const subjects = new Set<number>();
    readDiplomacy(r, subjects);
    expect(subjects).toEqual(new Set());
  });
});

describe("readDiplomacyEntry", () => {
  it("returns true when liberty_desire is present", () => {
    const data = bytes(
      u16(T.libertyDesire!), eq(), uintVal(10),
      close(),
    );
    const r = new TokenReader(data);
    expect(readDiplomacyEntry(r)).toBe(true);
  });

  it("returns false when no liberty_desire", () => {
    const data = bytes(
      u16(0x9999), eq(), uintVal(0),
      close(),
    );
    const r = new TokenReader(data);
    expect(readDiplomacyEntry(r)).toBe(false);
  });

  it("handles nested blocks", () => {
    const data = bytes(
      u16(0x9999), eq(), open(),
        uintVal(42),
      close(),
      u16(T.libertyDesire!), eq(), uintVal(5),
      close(),
    );
    const r = new TokenReader(data);
    expect(readDiplomacyEntry(r)).toBe(true);
  });

  it("returns false for empty entry", () => {
    const data = bytes(close());
    const r = new TokenReader(data);
    expect(readDiplomacyEntry(r)).toBe(false);
  });
});

// =============================================================================
// players.ts
// =============================================================================

describe("readPlayedCountry", () => {
  it("extracts player name and country tag", () => {
    const data = bytes(
      u16(T.NAME_ENGINE), eq(), quotedStr("Alice"),
      u16(T.country!), eq(), uintVal(0),
      close(),
    );
    const r = new TokenReader(data);
    const tags = { 0: "SWE" };
    const players: Record<string, string[]> = {};
    readPlayedCountry(r, tags, players);
    expect(players).toEqual({ SWE: ["Alice"] });
  });

  it("skips entries with unknown country ID", () => {
    const data = bytes(
      u16(T.NAME_ENGINE), eq(), quotedStr("Bob"),
      u16(T.country!), eq(), uintVal(999),
      close(),
    );
    const r = new TokenReader(data);
    const players: Record<string, string[]> = {};
    readPlayedCountry(r, { 0: "SWE" }, players);
    expect(players).toEqual({});
  });

  it("doesn't duplicate player names", () => {
    const data = bytes(
      u16(T.NAME_ENGINE), eq(), quotedStr("Alice"),
      u16(T.country!), eq(), uintVal(0),
      close(),
    );
    const r = new TokenReader(data);
    const players: Record<string, string[]> = { SWE: ["Alice"] };
    readPlayedCountry(r, { 0: "SWE" }, players);
    expect(players).toEqual({ SWE: ["Alice"] });
  });

  it("skips entry with no name", () => {
    const data = bytes(
      u16(T.country!), eq(), uintVal(0),
      close(),
    );
    const r = new TokenReader(data);
    const players: Record<string, string[]> = {};
    readPlayedCountry(r, { 0: "SWE" }, players);
    expect(players).toEqual({});
  });

  it("skips entry with no country", () => {
    const data = bytes(
      u16(T.NAME_ENGINE), eq(), quotedStr("Alice"),
      close(),
    );
    const r = new TokenReader(data);
    const players: Record<string, string[]> = {};
    readPlayedCountry(r, { 0: "SWE" }, players);
    expect(players).toEqual({});
  });

  it("handles unknown fields", () => {
    const UNKNOWN = 0x9999;
    const data = bytes(
      u16(UNKNOWN), eq(), uintVal(42),
      u16(T.NAME_ENGINE), eq(), quotedStr("Carol"),
      u16(T.country!), eq(), uintVal(1),
      close(),
    );
    const r = new TokenReader(data);
    const players: Record<string, string[]> = {};
    readPlayedCountry(r, { 1: "FRA" }, players);
    expect(players).toEqual({ FRA: ["Carol"] });
  });
});

// =============================================================================
// dependencies.ts
// =============================================================================

describe("findDependencies", () => {
  const DEP_ID = tokenId("dependency")!;
  const FIRST_ID = tokenId("first")!;
  const SECOND_ID = tokenId("second")!;
  const SUBTYPE_ID = 0x2ffa; // subject_type

  const buildDepBlock = (
    first: number,
    second: number,
    subjectType: string,
    dynStrings: string[],
  ): Uint8Array => {
    let strIdx = dynStrings.indexOf(subjectType);
    if (strIdx < 0) {
      strIdx = dynStrings.length;
      dynStrings.push(subjectType);
    }

    return bytes(
      u16(DEP_ID), eq(), open(),
        u16(FIRST_ID), eq(), uintVal(first),
        u16(SECOND_ID), eq(), uintVal(second),
        u16(SUBTYPE_ID), eq(), u16(BinaryToken.LOOKUP_U16), [strIdx & 0xff, (strIdx >> 8) & 0xff],
      close(),
    );
  };

  it("extracts overlord-subject relationships", () => {
    const dynStrings = ["vassal"];
    const data = buildDepBlock(0, 1, "vassal", dynStrings);
    const tags = { 0: "BOH", 1: "SIL" };
    const subjects: Record<string, Set<string>> = {};
    findDependencies(data, dynStrings, tags, subjects);
    expect(subjects["BOH"]).toEqual(new Set(["SIL"]));
  });

  it("skips when overlord and subject are the same", () => {
    const dynStrings = ["vassal"];
    const data = buildDepBlock(0, 0, "vassal", dynStrings);
    const tags = { 0: "BOH" };
    const subjects: Record<string, Set<string>> = {};
    findDependencies(data, dynStrings, tags, subjects);
    expect(subjects).toEqual({});
  });

  it("skips when subject tag does not start with uppercase", () => {
    const dynStrings = ["vassal"];
    const data = buildDepBlock(0, 1, "vassal", dynStrings);
    const tags: Record<number, string> = { 0: "BOH", 1: "---" };
    const subjects: Record<string, Set<string>> = {};
    findDependencies(data, dynStrings, tags, subjects);
    expect(subjects).toEqual({});
  });

  it("skips when country IDs are not in tags", () => {
    const dynStrings = ["vassal"];
    const data = buildDepBlock(0, 1, "vassal", dynStrings);
    const subjects: Record<string, Set<string>> = {};
    findDependencies(data, dynStrings, {}, subjects);
    expect(subjects).toEqual({});
  });

  it("handles empty data", () => {
    const subjects: Record<string, Set<string>> = {};
    findDependencies(new Uint8Array([]), [], {}, subjects);
    expect(subjects).toEqual({});
  });

  it("handles multiple dependencies", () => {
    const dynStrings = ["vassal", "fiefdom"];
    const data1 = buildDepBlock(0, 1, "vassal", dynStrings);
    const data2 = buildDepBlock(0, 2, "fiefdom", dynStrings);
    const combined = new Uint8Array([...data1, ...data2]);
    const tags = { 0: "BOH", 1: "SIL", 2: "MOR" };
    const subjects: Record<string, Set<string>> = {};
    findDependencies(combined, dynStrings, tags, subjects);
    expect(subjects["BOH"]).toEqual(new Set(["SIL", "MOR"]));
  });
});

// =============================================================================
// war-subjects.ts
// =============================================================================

describe("findWarSubjects", () => {
  // Build a war participant with reason=Subject, padded so the scanner can find it.
  // findWarSubjects scans i <= sectionEnd - 10, so we need 10+ bytes after reason token.
  const buildWarSubjectBlock = (
    overlordId: number,
    subjectId: number,
    dynStrings: string[],
  ): Uint8Array => {
    const countryTok = T.country!;
    const calledAllyTok = T.calledAlly!;
    const reasonTok = T.reason!;

    let subjectIdx = dynStrings.indexOf("Subject");
    if (subjectIdx < 0) {
      subjectIdx = dynStrings.length;
      dynStrings.push("Subject");
    }

    // Pattern: country=U32(subjectId) called_ally=U32(overlordId) reason=LOOKUP("Subject") + padding
    return bytes(
      u16(countryTok), eq(), uintVal(subjectId),
      u16(calledAllyTok), eq(), uintVal(overlordId),
      u16(reasonTok), eq(), u16(BinaryToken.LOOKUP_U16), [subjectIdx & 0xff, (subjectIdx >> 8) & 0xff],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 10 bytes padding for scanner bounds
    );
  };

  it("extracts subject relationships from war data", () => {
    const dynStrings: string[] = [];
    const data = buildWarSubjectBlock(0, 1, dynStrings);
    const tags = { 0: "ENG", 1: "WLS" };
    const subjects: Record<string, Set<string>> = {};
    findWarSubjects(data, 0, data.length, dynStrings, tags, subjects);
    expect(subjects["ENG"]).toEqual(new Set(["WLS"]));
  });

  it("skips when overlord and subject are same", () => {
    const dynStrings: string[] = [];
    const data = buildWarSubjectBlock(0, 0, dynStrings);
    const tags = { 0: "ENG" };
    const subjects: Record<string, Set<string>> = {};
    findWarSubjects(data, 0, data.length, dynStrings, tags, subjects);
    expect(subjects).toEqual({});
  });

  it("uses latest overlord when subject appears multiple times", () => {
    const dynStrings: string[] = [];
    const data1 = buildWarSubjectBlock(0, 2, dynStrings);
    const data2 = buildWarSubjectBlock(1, 2, dynStrings);
    const combined = new Uint8Array([...data1, ...data2]);
    const tags = { 0: "ENG", 1: "FRA", 2: "WLS" };
    const subjects: Record<string, Set<string>> = {};
    findWarSubjects(combined, 0, combined.length, dynStrings, tags, subjects);
    // FRA should be the overlord since it appears later in the stream
    expect(subjects["FRA"]).toEqual(new Set(["WLS"]));
    expect(subjects["ENG"]).toBeUndefined();
  });

  it("handles empty section", () => {
    const subjects: Record<string, Set<string>> = {};
    findWarSubjects(new Uint8Array(20), 0, 5, [], {}, subjects);
    expect(subjects).toEqual({});
  });

  it("skips when subject tag does not start with uppercase", () => {
    const dynStrings: string[] = [];
    const data = buildWarSubjectBlock(0, 1, dynStrings);
    const tags: Record<number, string> = { 0: "ENG", 1: "---" };
    const subjects: Record<string, Set<string>> = {};
    findWarSubjects(data, 0, data.length, dynStrings, tags, subjects);
    expect(subjects).toEqual({});
  });

  it("handles non-Subject reason values", () => {
    const countryTok = T.country!;
    const calledAllyTok = T.calledAlly!;
    const reasonTok = T.reason!;
    const dynStrings = ["Alliance"]; // not "Subject"

    const data = bytes(
      u16(countryTok), eq(), uintVal(1),
      u16(calledAllyTok), eq(), uintVal(0),
      u16(reasonTok), eq(), u16(BinaryToken.LOOKUP_U16), [0x00, 0x00], // index 0 = "Alliance"
    );
    const tags = { 0: "ENG", 1: "WLS" };
    const subjects: Record<string, Set<string>> = {};
    findWarSubjects(data, 0, data.length, dynStrings, tags, subjects);
    expect(subjects).toEqual({});
  });
});
