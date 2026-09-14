import { describe, it, expect } from "vitest";
import { findDependencies } from "../sections/dependencies";
import { tokenId } from "../token-names";
import { bytes, u16, eq, open, close, intVal, quotedStr } from "./helpers";

const DEP = tokenId("dependency") ?? -1;
const FIRST = tokenId("first") ?? -1;
const SECOND = tokenId("second") ?? -1;
const NAMED_TARGETS = tokenId("named_targets") ?? -1;
const FLAG = tokenId("flag") ?? -1;
const SUBJECT_TYPE = 0x2ffa;

/**
 * Build a dependency block in the shape saves actually use.
 *
 * Observed in MP_SCO_1453 (diagnostics/diag-deps.mjs):
 *   dependency = { first = N second = M
 *     named_targets = { { flag = "subject_type"
 *         <tok> = { <tok> = subject_type <tok> = "fiefdom" } } } }
 *
 * subject_type is nested inside named_targets and appears as a VALUE, not as
 * a depth-1 key — which is what the parser originally looked for.
 */
const dependencyBlock = (first: number, second: number, type: string): number[] => [
  ...u16(DEP), ...eq(), ...open(),
  ...u16(FIRST), ...eq(), ...intVal(first),
  ...u16(SECOND), ...eq(), ...intVal(second),
  ...u16(NAMED_TARGETS), ...eq(), ...open(),
  ...open(),
  ...u16(FLAG), ...eq(), ...quotedStr("subject_type"),
  ...u16(0x006b), ...eq(), ...open(),
  ...u16(0x00e1), ...eq(), ...u16(SUBJECT_TYPE),
  ...u16(0x0041), ...eq(), ...quotedStr(type),
  ...close(),
  ...close(),
  ...close(),
  ...close(),
];

const run = (
  blocks: number[][],
  countryTags: Record<number, string>,
): Record<string, Set<string>> => {
  const data = bytes(...blocks);
  const overlordSubjects: Record<string, Set<string>> = {};
  findDependencies(data, [], countryTags, overlordSubjects);
  return overlordSubjects;
};

describe("findDependencies — subject_type nested in named_targets", () => {
  const tags = { 1587: "TUN", 1573: "GBS", 1574: "GFS", 1139: "TRP" };

  it("captures a fiefdom relationship", () => {
    // Gabes is a fiefdom of Tunis in MP_SCO_1453.
    const result = run([dependencyBlock(1587, 1573, "fiefdom")], tags);
    expect(result.TUN).toBeDefined();
    expect([...result.TUN]).toEqual(["GBS"]);
  });

  it("captures a vassal relationship", () => {
    const result = run([dependencyBlock(1587, 1574, "vassal")], tags);
    expect([...result.TUN]).toEqual(["GFS"]);
  });

  it("captures every subject type through the same path", () => {
    const result = run(
      [
        dependencyBlock(1587, 1573, "fiefdom"),
        dependencyBlock(1587, 1574, "vassal"),
        dependencyBlock(1587, 1139, "tributary"),
      ],
      tags,
    );
    expect([...result.TUN].sort()).toEqual(["GBS", "GFS", "TRP"]);
  });

  it("ignores a dependency whose ids have no tags", () => {
    const result = run([dependencyBlock(9998, 9999, "vassal")], tags);
    expect(result).toEqual({});
  });

  it("ignores a self-referential dependency", () => {
    const result = run([dependencyBlock(1587, 1587, "vassal")], tags);
    expect(result).toEqual({});
  });

  it("ignores a dependency with no subject_type at all", () => {
    // A block that is not a subject relationship must still be rejected.
    const plain = [
      ...u16(DEP), ...eq(), ...open(),
      ...u16(FIRST), ...eq(), ...intVal(1587),
      ...u16(SECOND), ...eq(), ...intVal(1573),
      ...close(),
    ];
    expect(run([plain], tags)).toEqual({});
  });

  it("drops a dependency referencing a non-canonical id", () => {
    // 9000 is a second id for TUN; only the first (1587) is canonical.
    const dup = { ...tags, 9000: "TUN" };
    const result = run([dependencyBlock(9000, 1573, "vassal")], dup);
    expect(result).toEqual({});
  });
});
