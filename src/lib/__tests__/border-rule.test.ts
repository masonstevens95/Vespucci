import { describe, it, expect } from "vitest";
import { buildOwnership, qualifyingPairs, NO_OWNERSHIP } from "../border-rule";
import type { AdjacencyGraph } from "../location-adjacency";
import { buildLocationIndex } from "../location-resolve";

/**
 * A row of five touching locations:
 *
 *   0 Alpha — 1 Bravo — 2 Charlie — 3 Delta — 4 Echo
 */
const IDS = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"];
const index = buildLocationIndex(IDS);

const CHAIN: AdjacencyGraph = [[1], [0, 2], [1, 3], [2, 4], [3]];

const ownership = (
  countryLocations: Record<string, string[]>,
  players: Record<string, string[]> = {},
  subjects: Record<string, string> = {},
) => buildOwnership(countryLocations, players, subjects, index);

/** Pairs as sorted "A|B" strings, for order-independent assertions. */
const pairKeys = (
  countryLocations: Record<string, string[]>,
  players: Record<string, string[]> = {},
  subjects: Record<string, string> = {},
  graph: AdjacencyGraph = CHAIN,
) =>
  qualifyingPairs(ownership(countryLocations, players, subjects), graph, IDS)
    .map(([a, b]) => [a, b].sort().join("|"))
    .sort();

describe("buildOwnership", () => {
  it("maps each resolved path to its owning tag", () => {
    const o = ownership({ SWE: ["alpha", "bravo"], FRA: ["charlie"] });
    expect(o.ownerByPath.get("Alpha")).toBe("SWE");
    expect(o.ownerByPath.get("Charlie")).toBe("FRA");
  });

  it("covers AI countries, not only players", () => {
    // The whole point: with playersOnly on, AI territory is absent from the
    // config but must still be present here.
    const o = ownership({ SWE: ["alpha"], AI1: ["bravo"] }, { SWE: ["Alice"] });
    expect(o.ownerByPath.get("Bravo")).toBe("AI1");
  });

  it("drops a location name with no shape on the map", () => {
    const o = ownership({ SWE: ["alpha", "some_sea_zone"] });
    expect(o.ownerByPath.size).toBe(1);
  });

  it("marks player tags as player-side", () => {
    expect(ownership({ SWE: ["alpha"] }, { SWE: ["Alice"] }).playerTags.has("SWE")).toBe(true);
  });

  it("marks a player's subject as player-side", () => {
    // A subject's frontier with a neighbouring AI is part of the realm.
    const o = ownership({ SWE: ["alpha"], SCO: ["bravo"] }, { SWE: ["Alice"] }, { SCO: "SWE" });
    expect(o.playerTags.has("SCO")).toBe(true);
  });

  it("marks a subject of a subject of a player as player-side", () => {
    // subjectOverlords maps to the ROOT overlord, so chains resolve already.
    const o = ownership({ SWE: ["alpha"] }, { SWE: ["Alice"] }, { SCO: "SWE", WLS: "SWE" });
    expect(o.playerTags.has("WLS")).toBe(true);
  });

  it("does not mark an AI's subject as player-side", () => {
    const o = ownership({ AI1: ["alpha"] }, { SWE: ["Alice"] }, { VAS: "AI1" });
    expect(o.playerTags.has("VAS")).toBe(false);
  });

  it("has no player tags for a save with no players", () => {
    expect(ownership({ AI1: ["alpha"] }).playerTags.size).toBe(0);
  });
});

describe("qualifyingPairs", () => {
  it("draws a border between a player and an adjacent AI", () => {
    expect(pairKeys({ SWE: ["alpha"], AI1: ["bravo"] }, { SWE: ["Alice"] })).toEqual([
      "Alpha|Bravo",
    ]);
  });

  it("draws a border between two players", () => {
    expect(
      pairKeys({ SWE: ["alpha"], FRA: ["bravo"] }, { SWE: ["Alice"], FRA: ["Bob"] }),
    ).toEqual(["Alpha|Bravo"]);
  });

  it("draws a border between an overlord and its own subject", () => {
    // Subjects keep their own tag, so the boundary is a border like any other.
    expect(
      pairKeys({ SWE: ["alpha"], SCO: ["bravo"] }, { SWE: ["Alice"] }, { SCO: "SWE" }),
    ).toEqual(["Alpha|Bravo"]);
  });

  it("draws no border on a country's internal edges", () => {
    expect(pairKeys({ SWE: ["alpha", "bravo"] }, { SWE: ["Alice"] })).toEqual([]);
  });

  it("draws no border against unclaimed land", () => {
    // Bravo belongs to nobody: coastline and wilderness behave the same way.
    expect(pairKeys({ SWE: ["alpha"] }, { SWE: ["Alice"] })).toEqual([]);
  });

  it("draws no border between two AI countries", () => {
    expect(
      pairKeys({ AI1: ["alpha"], AI2: ["bravo"], SWE: ["echo"] }, { SWE: ["Alice"] }),
    ).toEqual([]);
  });

  it("draws the player's border but not the AI-AI one beside it", () => {
    expect(
      pairKeys(
        { SWE: ["alpha"], AI1: ["bravo"], AI2: ["charlie"] },
        { SWE: ["Alice"] },
      ),
    ).toEqual(["Alpha|Bravo"]);
  });

  it("draws nothing for a save with no players", () => {
    expect(pairKeys({ AI1: ["alpha"], AI2: ["bravo"] })).toEqual([]);
  });

  it("draws nothing for a player with no land neighbours", () => {
    const island: AdjacencyGraph = [[], [], [], [], []];
    expect(pairKeys({ SWE: ["alpha"], AI1: ["bravo"] }, { SWE: ["Alice"] }, {}, island)).toEqual(
      [],
    );
  });

  it("reports each pair once, not once per direction", () => {
    const pairs = qualifyingPairs(
      ownership({ SWE: ["alpha"], AI1: ["bravo"] }, { SWE: ["Alice"] }),
      CHAIN,
      IDS,
    );
    expect(pairs).toHaveLength(1);
  });

  it("finds every border along a chain of different owners", () => {
    expect(
      pairKeys(
        { SWE: ["alpha"], AI1: ["bravo"], FRA: ["charlie"] },
        { SWE: ["Alice"], FRA: ["Bob"] },
      ),
    ).toEqual(["Alpha|Bravo", "Bravo|Charlie"]);
  });

  it("ignores an adjacency entry pointing past the id list", () => {
    const ragged: AdjacencyGraph = [[1, 99], [0], [], [], []];
    expect(() =>
      qualifyingPairs(
        ownership({ SWE: ["alpha"], AI1: ["bravo"] }, { SWE: ["Alice"] }),
        ragged,
        IDS,
      ),
    ).not.toThrow();
  });

  it("draws nothing with the empty ownership sentinel", () => {
    expect(qualifyingPairs(NO_OWNERSHIP, CHAIN, IDS)).toEqual([]);
  });

  it("draws nothing with an empty adjacency graph", () => {
    // A failed chunk load resolves to an empty graph.
    expect(
      qualifyingPairs(ownership({ SWE: ["alpha"] }, { SWE: ["Alice"] }), [], IDS),
    ).toEqual([]);
  });
});
