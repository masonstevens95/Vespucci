/**
 * Which wastelands a single country completely encloses.
 *
 * Wastelands are unowned by definition, so they never appear in any country's
 * location list and render as grey holes inside otherwise-contiguous
 * territory. This module decides which of those holes can be honestly painted
 * over: a wasteland is claimed only when one country owns *every* land
 * neighbour it has. A second owner anywhere on that border, or a single
 * unowned neighbour, leaves it grey.
 *
 * That is deliberately stricter than letting the surrounding countries vote.
 * A plurality fills nearly everything, but it invents ownership the save never
 * asserts — a desert with three French neighbours and two Castilian ones would
 * become French because it was outvoted. Unanimity states nothing the map does
 * not already show: the shape is an enclave, and leaving it grey is the
 * artifact.
 *
 * The sea is not a neighbour. The asset holds land paths only — sea zones and
 * lakes have no shape at all — so a coastal wasteland simply has fewer entries
 * in the graph, and touching open water never disqualifies it.
 *
 * The claim reaches one step into the desert. A wasteland is judged on every
 * ordinary location that it — or any wasteland touching it — touches. Judging
 * on its own neighbours alone would leave chain interiors unfilled, since their
 * only neighbours are other wastelands; judging a whole connected component at
 * once goes too far the other way.
 *
 * Too far, because the asset chains deserts together with corridor shapes
 * (`Connector_Egypt5`, `Connector_Libya16`, `Horn_Desert_Corridor3`). Those put
 * the entire Sahara in one component of 125 shapes whose outer border touches
 * 21 countries, so it could never be unanimous. Egypt's own deserts sat in a
 * component bordered by the Mamluks on 42 of 49 locations and stayed grey
 * because of the other seven. A veto a continent away is not a fact about the
 * shape being painted.
 *
 * One step is the smallest reach that keeps touching wastelands in agreement,
 * which the component rule gave for free. If A and B touch and both fill, then
 * A's reach includes B's ordinary neighbours, so all of them carry A's tag;
 * B filling means they all carry B's tag; so the tags are equal. Where B has no
 * ordinary neighbour at all its tag came from its wasteland neighbours', which
 * include A's. At reach zero that argument fails, and both sample saves duly
 * produce a dozen places where two touching deserts take different colours.
 *
 * Ownership arrives as `BorderOwnership.ownerByPath`, which covers every
 * country in the save rather than only the painted ones. Reading it from
 * `config.groups` instead would hide AI territory whenever `playersOnly` is on,
 * so a wasteland wedged between France and a hidden Castile would read as
 * French-enclosed and fill — the same trap the border rule already avoids.
 *
 * All functions are pure, use immutable variables, and never throw.
 */

import locationIds from "./location-ids.json";
import type { AdjacencyGraph } from "./location-adjacency";

/** Sentinel for a component no single country encloses. */
export const UNENCLOSED = "";

const CANONICAL_IDS: readonly string[] = locationIds as readonly string[];

/** Position of each canonical id in the id list, which the graph is keyed by. */
const positionIndex = (ids: readonly string[]): ReadonlyMap<string, number> =>
  new Map(ids.map((id, i) => [id, i]));

const POSITIONS = positionIndex(CANONICAL_IDS);

/** The position map for an id list, reusing the prebuilt one for the real list. */
const positionsFor = (ids: readonly string[]): ReadonlyMap<string, number> =>
  ids === CANONICAL_IDS ? POSITIONS : positionIndex(ids);

/**
 * Resolve canonical wasteland path ids to the positions the graph is keyed by.
 *
 * An id the list does not carry is skipped rather than throwing, so one
 * drifted id cannot cost every other fill.
 */
export const wastelandPositions = (
  paths: readonly string[],
  ids: readonly string[] = CANONICAL_IDS,
): ReadonlySet<number> => {
  const positions = positionsFor(ids);
  const result = new Set<number>();
  for (const path of paths) {
    const pos = positions.get(path);
    if (pos === undefined) {
      /* an id the graph does not cover — nothing to paint */
    } else {
      result.add(pos);
    }
  }
  return result;
};

/**
 * How far a country's claim reaches into a wasteland, in wasteland steps.
 *
 * One. See the note at the top of this file: zero lets two touching deserts
 * disagree, and more than one starts letting distant countries veto shapes
 * they are nowhere near.
 */
export const CLAIM_REACH = 1;

/**
 * The one country claiming a wasteland, or UNENCLOSED.
 *
 * Walks out through wasteland neighbours up to `reach` steps and looks at every
 * ordinary location met on the way. Three ways to fail, and they are the whole
 * rule: nothing ordinary is within reach (a detached shape, which nothing
 * encloses), something within reach is unowned (unclaimed frontier or
 * uncolonized land), or more than one country is within reach.
 */
export const claimingTag = (
  start: number,
  wastelands: ReadonlySet<number>,
  ownerByPath: ReadonlyMap<string, string>,
  adjacency: AdjacencyGraph,
  ids: readonly string[] = CANONICAL_IDS,
  reach: number = CLAIM_REACH,
): string => {
  const walked = new Set<number>([start]);
  let frontier: number[] = [start];
  let claimant = UNENCLOSED;

  for (let step = 0; step <= reach && frontier.length > 0; step++) {
    const next: number[] = [];
    for (const current of frontier) {
      for (const neighbor of adjacency[current] ?? []) {
        if (wastelands.has(neighbor)) {
          if (step < reach && !walked.has(neighbor)) {
            walked.add(neighbor);
            next.push(neighbor);
          } else {
            /* past the reach, or already walked */
          }
        } else {
          const owner = ownerByPath.get(ids[neighbor] ?? "") ?? UNENCLOSED;
          if (owner === UNENCLOSED) {
            // Unowned land within reach. Whatever this is, it is not an enclave.
            return UNENCLOSED;
          } else if (claimant === UNENCLOSED) {
            claimant = owner;
          } else if (claimant === owner) {
            /* still unanimous */
          } else {
            return UNENCLOSED;
          }
        }
      }
    }
    frontier = next;
  }
  return claimant;
};

/**
 * Decide which wastelands are enclosed, keyed by canonical path id.
 *
 * `wastelandPaths` are canonical ids, already resolved from save names and
 * already stripped of names with no shape on the map. The wasteland list is
 * authoritative: a location that appears both here and in `ownerByPath` is
 * treated as a wasteland, so contradictory input resolves one way rather than
 * half each.
 *
 * Each shape is judged on its own, within the reach — so the far end of a long
 * chain no longer vetoes the near end.
 */
export const enclosedWastelands = (
  wastelandPaths: readonly string[],
  ownerByPath: ReadonlyMap<string, string>,
  adjacency: AdjacencyGraph,
  ids: readonly string[] = CANONICAL_IDS,
  reach: number = CLAIM_REACH,
): ReadonlyMap<string, string> => {
  const fills = new Map<string, string>();
  if (adjacency.length === 0 || ownerByPath.size === 0) {
    return fills;
  } else {
    /* there is a graph and somebody owns something */
  }

  const wastelands = wastelandPositions(wastelandPaths, ids);
  for (const position of wastelands) {
    const tag = claimingTag(position, wastelands, ownerByPath, adjacency, ids, reach);
    if (tag === UNENCLOSED) {
      /* mixed, unclaimed or out of reach of any land — leave it grey */
    } else {
      const id = ids[position] ?? "";
      if (id === "") {
        /* position outside the id list — nothing to paint */
      } else {
        fills.set(id, tag);
      }
    }
  }
  return fills;
};
