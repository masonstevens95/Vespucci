import { describe, it, expect } from "vitest";
import { readCountryForces } from "../sections/units";
import { u16, i32, eq, open, close, bytes, intVal, uintVal, block } from "./helpers";
import { BinaryToken } from "../tokens";

// Token IDs (from eu5-tokens.json)
const UNIT_MGR = 12766;
const SUBUNIT_MGR = 12765;
const DATABASE = 1451;
const IS_ARMY = 11578;
const COUNTRY = 11479;
const FRONTAGE = 12070;
const OWNER = 10258;
const STRENGTH = 10462;
const TYPE = 0xe1;

const boolYes = (): number[] => [...u16(BinaryToken.BOOL), 1];

/** Encode a value as 3-byte FIXED5 (0x0d4a) = val * 1000 LE. */
const fixed5_3 = (val: number): number[] => {
  const raw = Math.round(val * 1000);
  return [raw & 0xff, (raw >> 8) & 0xff, (raw >> 16) & 0xff];
};

/** Build a unit_manager entry: id = { country=X frontage=Y [is_army=yes] } */
const unitEntry = (id: number, country: number, frontage: number, isArmy: boolean): number[] => [
  ...uintVal(id), ...eq(), ...open(),
  ...(isArmy ? [...u16(IS_ARMY), ...eq(), ...boolYes()] : []),
  ...u16(COUNTRY), ...eq(), ...intVal(country),
  ...u16(FRONTAGE), ...eq(), ...u16(0x0d4a), ...fixed5_3(frontage),
  ...close(),
];

/** Build a subunit_manager entry: id = { owner=X type=S strength=F } */
const subunitEntry = (id: number, owner: number, type: string, strength: number): number[] => {
  // Encode strength as a 3-byte FIXED5 (0x0d4a) = val * 1000 as 3-byte LE
  const raw = Math.round(strength * 1000);
  const strBytes = [raw & 0xff, (raw >> 8) & 0xff, (raw >> 16) & 0xff];
  return [
    ...uintVal(id), ...eq(), ...open(),
    ...u16(OWNER), ...eq(), ...intVal(owner),
    ...u16(TYPE), ...eq(), ...u16(BinaryToken.UNQUOTED), ...u16(type.length), ...Array.from(new TextEncoder().encode(type)),
    ...u16(STRENGTH), ...eq(), ...u16(0x0d4a), ...strBytes,
    ...close(),
  ];
};

/** Build a minimal gamestate with unit_manager and subunit_manager sections. */
const buildGamestate = (
  units: number[][],
  subunits: number[][],
): Uint8Array => bytes(
  // unit_manager = { database = { ...units } }
  u16(UNIT_MGR), eq(), open(),
  u16(DATABASE), eq(), open(),
  ...units.flat().map(b => [b]),
  close(),
  close(),
  // subunit_manager = { database = { ...subunits } }
  u16(SUBUNIT_MGR), eq(), open(),
  u16(DATABASE), eq(), open(),
  ...subunits.flat().map(b => [b]),
  close(),
  close(),
);

describe("readCountryForces", () => {
  const tags: Record<number, string> = { 100: "BOH", 200: "GBR" };

  it("sums army frontage per country", () => {
    const data = buildGamestate(
      [unitEntry(1, 100, 800, true), unitEntry(2, 100, 400, true)],
      [],
    );
    const forces = readCountryForces(data, [], tags);
    expect(forces["BOH"].armyFrontage).toBe(1200);
  });

  it("sums navy frontage separately from army", () => {
    const data = buildGamestate(
      [unitEntry(1, 100, 500, true), unitEntry(2, 100, 150, false)],
      [],
    );
    const forces = readCountryForces(data, [], tags);
    expect(forces["BOH"].armyFrontage).toBe(500);
    expect(forces["BOH"].navyFrontage).toBe(150);
  });

  it("separates frontage by country", () => {
    const data = buildGamestate(
      [unitEntry(1, 100, 800, true), unitEntry(2, 200, 600, true)],
      [],
    );
    const forces = readCountryForces(data, [], tags);
    expect(forces["BOH"].armyFrontage).toBe(800);
    expect(forces["GBR"].armyFrontage).toBe(600);
  });

  it("classifies subunit types into categories", () => {
    const data = buildGamestate(
      [],
      [
        subunitEntry(1, 100, "a_arquebusiers", 200),
        subunitEntry(2, 100, "a_lancers", 60),
        subunitEntry(3, 100, "a_falconet", 60),
        subunitEntry(4, 100, "a_matchlock_levy", 150),
        subunitEntry(5, 100, "n_carrack", 100),
      ],
    );
    const forces = readCountryForces(data, [], tags);
    expect(forces["BOH"].infantry).toBe(1);
    expect(forces["BOH"].cavalry).toBe(1);
    expect(forces["BOH"].artillery).toBe(1);
    expect(forces["BOH"].levyInfantry).toBe(1);
    expect(forces["BOH"].heavyShips).toBe(1);
  });

  it("sums strength per category", () => {
    const data = buildGamestate(
      [],
      [
        subunitEntry(1, 100, "a_arquebusiers", 200),
        subunitEntry(2, 100, "a_arquebusiers", 150),
      ],
    );
    const forces = readCountryForces(data, [], tags);
    expect(forces["BOH"].infantry).toBe(2);
    expect(forces["BOH"].infantryStr).toBeCloseTo(350, 0);
  });

  it("returns empty forces for unknown country IDs", () => {
    const data = buildGamestate(
      [unitEntry(1, 999, 500, true)],
      [],
    );
    const forces = readCountryForces(data, [], tags);
    expect(Object.keys(forces)).toHaveLength(0);
  });

  it("merges unit_manager frontage with subunit_manager counts", () => {
    const data = buildGamestate(
      [unitEntry(1, 100, 800, true)],
      [subunitEntry(1, 100, "a_arquebusiers", 200)],
    );
    const forces = readCountryForces(data, [], tags);
    expect(forces["BOH"].armyFrontage).toBe(800);
    expect(forces["BOH"].infantry).toBe(1);
    expect(forces["BOH"].infantryStr).toBeCloseTo(200, 0);
  });
});
