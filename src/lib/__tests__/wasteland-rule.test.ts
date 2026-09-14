import { describe, it, expect } from "vitest";
import {
  enclosedWastelands,
  wastelandComponents,
  wastelandPositions,
  UNENCLOSED,
} from "../wasteland-rule";
import type { AdjacencyGraph } from "../location-adjacency";

/**
 * A hand-built world. Ownership is supplied per test; these are only the
 * shapes and which of them are uninhabitable.
 *
 *   Alpha  Bravo  Charlie  Delta  Echo   — ordinary locations
 *   Waste1 Waste2 Waste3   Island        — wastelands
 */
const IDS = [
  "Alpha",
  "Bravo",
  "Charlie",
  "Delta",
  "Echo",
  "Waste1",
  "Waste2",
  "Waste3",
  "Island",
];

const at = (id: string): number => IDS.indexOf(id);

/** Build a symmetric graph from unordered touching pairs. */
const graphOf = (pairs: readonly (readonly [string, string])[]): AdjacencyGraph => {
  const out: number[][] = IDS.map(() => []);
  for (const [a, b] of pairs) {
    out[at(a)].push(at(b));
    out[at(b)].push(at(a));
  }
  return out;
};

/** Build an ownerByPath map the way border-rule.ts hands one over. */
const owners = (
  byTag: Record<string, readonly string[]>,
): ReadonlyMap<string, string> => {
  const map = new Map<string, string>();
  for (const [tag, ids] of Object.entries(byTag)) {
    for (const id of ids) {
      map.set(id, tag);
    }
  }
  return map;
};

/** The rule, over the fixture id list. */
const fills = (
  wastelands: readonly string[],
  byTag: Record<string, readonly string[]>,
  pairs: readonly (readonly [string, string])[],
): Record<string, string> =>
  Object.fromEntries(
    enclosedWastelands(wastelands, owners(byTag), graphOf(pairs), IDS),
  );

describe("wastelandPositions", () => {
  it("maps canonical ids to the positions the graph is keyed by", () => {
    const positions = wastelandPositions(["Waste1", "Island"], IDS);
    expect([...positions].sort((a, b) => a - b)).toEqual([at("Waste1"), at("Island")].sort((a, b) => a - b));
  });

  it("drops an id the graph does not cover", () => {
    // A name that resolved to a shape the id list does not carry. Skipped
    // rather than throwing, so one drifted id cannot cost every fill.
    expect(wastelandPositions(["Waste1", "Nowhere"], IDS).size).toBe(1);
  });
});

describe("wastelandComponents", () => {
  it("groups wastelands that touch each other", () => {
    const graph = graphOf([["Waste1", "Waste2"]]);
    const components = wastelandComponents(
      wastelandPositions(["Waste1", "Waste2"], IDS),
      graph,
    );
    expect(components.length).toBe(1);
    expect([...components[0]].sort()).toEqual([at("Waste1"), at("Waste2")].sort());
  });

  it("keeps wastelands that do not touch in separate components", () => {
    const graph = graphOf([
      ["Waste1", "Alpha"],
      ["Waste2", "Bravo"],
    ]);
    const components = wastelandComponents(
      wastelandPositions(["Waste1", "Waste2"], IDS),
      graph,
    );
    expect(components.length).toBe(2);
  });

  it("does not join two wastelands through an owned location between them", () => {
    // Alpha sits between them: they are neighbours of the same country, not
    // of each other, and must vote separately.
    const graph = graphOf([
      ["Waste1", "Alpha"],
      ["Alpha", "Waste2"],
    ]);
    const components = wastelandComponents(
      wastelandPositions(["Waste1", "Waste2"], IDS),
      graph,
    );
    expect(components.length).toBe(2);
  });
});

describe("enclosedWastelands", () => {
  it("fills a wasteland whose every neighbour is the same country", () => {
    expect(
      fills(["Waste1"], { FRA: ["Alpha", "Bravo", "Charlie"] }, [
        ["Waste1", "Alpha"],
        ["Waste1", "Bravo"],
        ["Waste1", "Charlie"],
      ]),
    ).toEqual({ Waste1: "FRA" });
  });

  it("fills a wasteland with a single neighbour", () => {
    // One border is still the whole border.
    expect(
      fills(["Waste1"], { FRA: ["Alpha"] }, [["Waste1", "Alpha"]]),
    ).toEqual({ Waste1: "FRA" });
  });

  it("fills a coastal wasteland, since the sea is not a neighbour", () => {
    // The asset holds land paths only, so a coast simply means fewer entries
    // in the graph. Waste1 touches one French location and open water.
    expect(
      fills(["Waste1"], { FRA: ["Alpha"], SPA: ["Delta"] }, [
        ["Waste1", "Alpha"],
        ["Delta", "Echo"],
      ]),
    ).toEqual({ Waste1: "FRA" });
  });

  it("leaves a wasteland with two different owners on its border unfilled", () => {
    expect(
      fills(["Waste1"], { FRA: ["Alpha"], SPA: ["Delta"] }, [
        ["Waste1", "Alpha"],
        ["Waste1", "Delta"],
      ]),
    ).toEqual({});
  });

  it("leaves a wasteland with an unowned land neighbour unfilled", () => {
    // Echo is uncolonized: nobody owns it, so nobody encloses Waste1.
    expect(
      fills(["Waste1"], { FRA: ["Alpha", "Bravo"] }, [
        ["Waste1", "Alpha"],
        ["Waste1", "Bravo"],
        ["Waste1", "Echo"],
      ]),
    ).toEqual({});
  });

  it("leaves a wasteland with no neighbours at all unfilled", () => {
    // A detached island shape. Nothing encloses it, so nothing claims it.
    expect(fills(["Island"], { FRA: ["Alpha"] }, [])).toEqual({});
  });

  it("fills a chain of touching wastelands from their combined border", () => {
    expect(
      fills(["Waste1", "Waste2"], { FRA: ["Alpha", "Bravo"] }, [
        ["Waste1", "Waste2"],
        ["Waste1", "Alpha"],
        ["Waste2", "Bravo"],
      ]),
    ).toEqual({ Waste1: "FRA", Waste2: "FRA" });
  });

  it("fills the interior of a chain, which touches no owned location at all", () => {
    // Waste2's only neighbours are other wastelands. Resolving each member on
    // its own would leave it a hole in the middle of the filled chain.
    expect(
      fills(["Waste1", "Waste2", "Waste3"], { FRA: ["Alpha", "Bravo"] }, [
        ["Waste1", "Waste2"],
        ["Waste2", "Waste3"],
        ["Waste1", "Alpha"],
        ["Waste3", "Bravo"],
      ]),
    ).toEqual({ Waste1: "FRA", Waste2: "FRA", Waste3: "FRA" });
  });

  it("leaves a whole chain unfilled when one member touches a second country", () => {
    // No partial fill: the chain is one unit, so one Spanish neighbour at the
    // far end disqualifies the French end too.
    expect(
      fills(["Waste1", "Waste2"], { FRA: ["Alpha"], SPA: ["Delta"] }, [
        ["Waste1", "Waste2"],
        ["Waste1", "Alpha"],
        ["Waste2", "Delta"],
      ]),
    ).toEqual({});
  });

  it("resolves separate components independently", () => {
    expect(
      fills(["Waste1", "Waste2"], { FRA: ["Alpha"], SPA: ["Delta"] }, [
        ["Waste1", "Alpha"],
        ["Waste2", "Delta"],
      ]),
    ).toEqual({ Waste1: "FRA", Waste2: "SPA" });
  });

  it("treats the wasteland list as authoritative over ownership", () => {
    // Contradictory input — a location classified uninhabitable that some
    // country also claims. It stays a wasteland and takes the tag enclosing
    // it, rather than half-resolving as both.
    expect(
      fills(["Waste1"], { FRA: ["Alpha"], SPA: ["Waste1"] }, [
        ["Waste1", "Alpha"],
      ]),
    ).toEqual({ Waste1: "FRA" });
  });

  it("skips a wasteland id the graph does not cover", () => {
    expect(
      fills(["Nowhere", "Waste1"], { FRA: ["Alpha"] }, [["Waste1", "Alpha"]]),
    ).toEqual({ Waste1: "FRA" });
  });

  it("returns nothing for an empty wasteland list", () => {
    expect(fills([], { FRA: ["Alpha"] }, [["Alpha", "Bravo"]])).toEqual({});
  });

  it("returns nothing when nobody owns anything", () => {
    expect(fills(["Waste1"], {}, [["Waste1", "Alpha"]])).toEqual({});
  });

  it("returns nothing for an empty graph", () => {
    expect(
      enclosedWastelands(["Waste1"], owners({ FRA: ["Alpha"] }), [], IDS).size,
    ).toBe(0);
  });

  it("reports no tag with the empty-string sentinel, never null", () => {
    const result = enclosedWastelands(
      ["Waste1"],
      owners({}),
      graphOf([["Waste1", "Alpha"]]),
      IDS,
    );
    expect(result.get("Waste1") ?? UNENCLOSED).toBe(UNENCLOSED);
  });
});
