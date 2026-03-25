import { describe, it, expect } from "vitest";
import { TokenReader } from "../token-reader";
import { BinaryToken } from "../tokens";
import { T } from "../game-tokens";
import { readCountries, readCountryTags, readCountryEntry } from "../sections/countries";
import { readLocationOwnership, readLocationEntries } from "../sections/locations";
import { readIOManager, readIOEntry } from "../sections/io-manager";
import { readDiplomacy, readDiplomacyEntry } from "../sections/diplomacy";
import { readPlayedCountry } from "../sections/players";
import { readCountryDatabase } from "../sections/countries";
import { bytes, u16, eq, open, close, uintVal,  quotedStr } from "./helpers";
import type { RGB } from "../../types";

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
});

describe("readCountryDatabase", () => {
  it("skips non-block entries (ID = none)", () => {
    const NONE_TOKEN = 0x9876; // some token representing "none"
    const data = bytes(
      // Entry 1: 42 = none (non-block, should be skipped)
      uintVal(42), eq(), u16(NONE_TOKEN),
      // Entry 2: 99 = { flag=SWE color=RGB{0,0,255} }
      uintVal(99), eq(), open(),
        u16(T.flag!), eq(), quotedStr("SWE"),
        u16(T.COLOR), eq(), u16(T.RGB), open(),
          uintVal(0), uintVal(0), uintVal(255),
        close(),
      close(),
      close(), // end of database
    );
    const r = new TokenReader(data, ["SWE"]);
    const colors: Record<string, RGB> = {};
    readCountryDatabase(r, colors, {}, new Set());
    expect(colors["SWE"]).toEqual([0, 0, 255]);
  });
});

describe("readCountryEntry", () => {
  it("extracts flag and color", () => {
    const data = bytes(
      u16(T.flag!), eq(), quotedStr("NED"),
      u16(T.COLOR), eq(), u16(T.RGB), open(),
        uintVal(250), uintVal(84), uintVal(5),
      close(),
      close(), // end of entry
    );
    const r = new TokenReader(data);
    const colors: Record<string, RGB> = {};
    const capitals: Record<number, number> = {};
    const overlordCandidates = new Set<string>();
    readCountryEntry(r, 42, colors, capitals, overlordCandidates);
    expect(colors["NED"]).toEqual([250, 84, 5]);
  });

  it("handles nested blocks with value tokens at depth > 1", () => {
    // Simulates: flag=SWE, score={ rating={ LOOKUP=FIXED5 } }, color=RGB{0,0,255}
    // The FIXED5 (0x0d4a) at depth 3 must have its 3-byte payload consumed
    const SCORE = 0x4444; // fake "score" token
    const RATING = 0x5555; // fake "score_rating" token
    const data = bytes(
      u16(T.flag!), eq(), quotedStr("SWE"),
      u16(SCORE), eq(), open(),
        u16(RATING), eq(), open(),
          u16(BinaryToken.LOOKUP_U16), [0x00, 0x00], // lookup at depth 3
          eq(),
          u16(0x0d4a), [0x01, 0x02, 0x03], // FIXED5 unsigned 3-byte at depth 3
        close(),
      close(),
      u16(T.COLOR), eq(), u16(T.RGB), open(),
        uintVal(10), uintVal(20), uintVal(30),
      close(),
      close(), // end of entry
    );
    const r = new TokenReader(data);
    const colors: Record<string, RGB> = {};
    readCountryEntry(r, 0, colors, {}, new Set());
    expect(colors["SWE"]).toEqual([10, 20, 30]);
  });

  it("survives complex nested entries without misalignment", () => {
    // Simulates a country entry with many nested blocks and value types
    // that could cause depth tracking issues in a single-pass approach
    const SCORE = 0x4444;
    const INNER = 0x5555;
    const data = bytes(
      u16(SCORE), eq(), open(), // depth 2
        u16(INNER), eq(), open(), // depth 3
          uintVal(42),
          u16(BinaryToken.LOOKUP_U16), [0x00, 0x00],
          eq(),
          u16(0x0d4a), [0x01, 0x02, 0x03], // FIXED5
        close(), // depth 2
      close(), // depth 1
      u16(T.flag!), eq(), quotedStr("TEST"),
      u16(T.COLOR), eq(), u16(T.RGB), open(),
        uintVal(100), uintVal(200), uintVal(50),
      close(),
      u16(T.capital!), eq(), uintVal(999),
      close(), // depth 0
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
});

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
      close(), // end of outer
    );
    const r = new TokenReader(data);
    const owners: Record<number, string> = {};
    readLocationOwnership(r, { 0: "SWE" }, owners);
    expect(owners[1]).toBe("SWE");
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
      close(), // end of block
    );
    const r = new TokenReader(data);
    const tags = { 0: "SWE", 1: "FRA" };
    const owners: Record<number, string> = {};
    readLocationEntries(r, tags, owners);
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
    readLocationEntries(r, { 0: "SWE" }, owners);
    expect(owners).toEqual({});
  });
});

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
});

describe("readDiplomacy", () => {
  it("collects country IDs with liberty_desire", () => {
    const data = bytes(
      uintVal(42), eq(), open(),
        u16(T.libertyDesire!), eq(), uintVal(10),
      close(),
      uintVal(99), eq(), open(),
        u16(0x9999), eq(), uintVal(0), // no liberty_desire
      close(),
      close(), // end of diplomacy block
    );
    const r = new TokenReader(data);
    const subjects = new Set<number>();
    readDiplomacy(r, subjects);
    expect(subjects).toEqual(new Set([42]));
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
});

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
});
