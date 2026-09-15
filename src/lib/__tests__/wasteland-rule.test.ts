import { describe, it, expect } from "vitest";
import {
  enclosedWastelands,
  claimingTag,
  wastelandPositions,
  CLAIM_REACH,
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

describe("claimingTag — how far a claim reaches", () => {
  const tagFor = (
    of: string,
    wastelands: readonly string[],
    byTag: Record<string, readonly string[]>,
    pairs: readonly (readonly [string, string])[],
    reach: number = CLAIM_REACH,
  ) =>
    claimingTag(
      at(of),
      wastelandPositions(wastelands, IDS),
      owners(byTag),
      graphOf(pairs),
      IDS,
      reach,
    );

  it("reaches through a touching wasteland to the land beyond it", () => {
    // Waste1 touches no ordinary location of its own; Waste2 carries it.
    expect(
      tagFor("Waste1", ["Waste1", "Waste2"], { FRA: ["Alpha"] }, [
        ["Waste1", "Waste2"],
        ["Waste2", "Alpha"],
      ]),
    ).toBe("FRA");
  });

  it("does not reach two wastelands deep", () => {
    // Alpha is two steps away, so nothing is within reach and nothing claims it.
    expect(
      tagFor("Waste1", ["Waste1", "Waste2", "Waste3"], { FRA: ["Alpha"] }, [
        ["Waste1", "Waste2"],
        ["Waste2", "Waste3"],
        ["Waste3", "Alpha"],
      ]),
    ).toBe(UNENCLOSED);
  });

  it("lets a far country veto only what it is near", () => {
    // The shape of the Egyptian deserts: a chain with France at one end and
    // Spain at the other. Each end is claimed by the country beside it; only
    // the middle, which is near both, stays grey. Under a whole-component rule
    // the Spanish end vetoed the French end too.
    const chain = ["Waste1", "Waste2", "Waste3"] as const;
    const world = { FRA: ["Alpha"], SPA: ["Delta"] };
    const pairs = [
      ["Waste1", "Alpha"],
      ["Waste1", "Waste2"],
      ["Waste2", "Waste3"],
      ["Waste3", "Delta"],
    ] as const;
    expect(tagFor("Waste1", chain, world, pairs)).toBe("FRA");
    expect(tagFor("Waste2", chain, world, pairs)).toBe(UNENCLOSED);
    expect(tagFor("Waste3", chain, world, pairs)).toBe("SPA");
  });

  it("keeps two touching wastelands in agreement", () => {
    // The invariant the reach exists to preserve: A's reach covers B's own
    // neighbours, so if both are claimed at all they are claimed by the same
    // country. At reach 0 this pair would come out FRA and SPA.
    const chain = ["Waste1", "Waste2"] as const;
    const world = { FRA: ["Alpha"], SPA: ["Delta"] };
    const pairs = [
      ["Waste1", "Alpha"],
      ["Waste1", "Waste2"],
      ["Waste2", "Delta"],
    ] as const;
    expect(tagFor("Waste1", chain, world, pairs)).toBe(UNENCLOSED);
    expect(tagFor("Waste2", chain, world, pairs)).toBe(UNENCLOSED);

    expect(tagFor("Waste1", chain, world, pairs, 0)).toBe("FRA");
    expect(tagFor("Waste2", chain, world, pairs, 0)).toBe("SPA");
  });

  it("is vetoed by unowned land within reach, not beyond it", () => {
    const chain = ["Waste1", "Waste2"] as const;
    const pairs = [
      ["Waste1", "Alpha"],
      ["Waste1", "Waste2"],
      ["Waste2", "Echo"],
    ] as const;
    // Echo is unowned and one step away, so it counts.
    expect(tagFor("Waste1", chain, { FRA: ["Alpha"] }, pairs)).toBe(UNENCLOSED);
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
    // Waste2's only neighbours are other wastelands, and the reach is what
    // carries it: judged on its own neighbours it would be a grey hole in the
    // middle of a filled chain.
    expect(
      fills(["Waste1", "Waste2", "Waste3"], { FRA: ["Alpha", "Bravo"] }, [
        ["Waste1", "Waste2"],
        ["Waste2", "Waste3"],
        ["Waste1", "Alpha"],
        ["Waste3", "Bravo"],
      ]),
    ).toEqual({ Waste1: "FRA", Waste2: "FRA", Waste3: "FRA" });
  });

  it("leaves both ends grey when a short chain is contested", () => {
    // Each shape is within reach of both countries, so neither is claimed —
    // and, importantly, they do not come out different colours.
    expect(
      fills(["Waste1", "Waste2"], { FRA: ["Alpha"], SPA: ["Delta"] }, [
        ["Waste1", "Waste2"],
        ["Waste1", "Alpha"],
        ["Waste2", "Delta"],
      ]),
    ).toEqual({});
  });

  it("claims the near end of a long chain even when the far end is foreign", () => {
    // The Egyptian case. Waste1 and Waste3 are each beside one country and out
    // of reach of the other; Waste2 sits between them and stays grey.
    expect(
      fills(["Waste1", "Waste2", "Waste3"], { FRA: ["Alpha"], SPA: ["Delta"] }, [
        ["Waste1", "Alpha"],
        ["Waste1", "Waste2"],
        ["Waste2", "Waste3"],
        ["Waste3", "Delta"],
      ]),
    ).toEqual({ Waste1: "FRA", Waste3: "SPA" });
  });

  it("resolves shapes out of reach of each other independently", () => {
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
