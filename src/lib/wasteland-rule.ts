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
 * Contiguous wastelands resolve as one unit. Chains like Siberian_Wasteland_1..16
 * contain members whose only neighbours are other wastelands; resolving each
 * in isolation would leave every chain interior unfilled and would let two
 * touching wastelands take different colours. The whole connected component is
 * tested against its combined outer border and fills entirely or not at all.
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
 * Group wastelands into connected components over wasteland-to-wasteland edges.
 *
 * Iterative rather than recursive: the longest chains run to dozens of members,
 * and a recursive flood fill would put that depth on the stack for no gain.
 */
export const wastelandComponents = (
  wastelands: ReadonlySet<number>,
  adjacency: AdjacencyGraph,
): readonly (readonly number[])[] => {
  const seen = new Set<number>();
  const components: number[][] = [];

  for (const start of wastelands) {
    if (seen.has(start)) {
      /* already part of a component */
    } else {
      const component: number[] = [];
      const queue = [start];
      seen.add(start);
      while (queue.length > 0) {
        const current = queue.pop() as number;
        component.push(current);
        for (const neighbor of adjacency[current] ?? []) {
          if (wastelands.has(neighbor) && !seen.has(neighbor)) {
            seen.add(neighbor);
            queue.push(neighbor);
          } else {
            /* not a wasteland, or already in a component */
          }
        }
      }
      components.push(component);
    }
  }
  return components;
};

/**
 * The positions bordering a component from outside it.
 *
 * Deduped, so a location touching three members of a chain is one border
 * location rather than three.
 */
export const outerNeighbors = (
  component: readonly number[],
  adjacency: AdjacencyGraph,
): readonly number[] => {
  const members = new Set(component);
  const outer = new Set<number>();
  for (const member of component) {
    for (const neighbor of adjacency[member] ?? []) {
      if (members.has(neighbor)) {
        /* inside the component — not part of its border */
      } else {
        outer.add(neighbor);
      }
    }
  }
  return [...outer];
};

/**
 * The one country enclosing a component, or UNENCLOSED.
 *
 * Three ways to fail, and they are the whole rule: nothing borders the
 * component at all (a detached island shape, which nothing encloses), some
 * border location is unowned (unclaimed frontier or uncolonized land), or the
 * border carries more than one owner.
 */
export const enclosingTag = (
  component: readonly number[],
  ownerByPath: ReadonlyMap<string, string>,
  adjacency: AdjacencyGraph,
  ids: readonly string[] = CANONICAL_IDS,
): string => {
  const outer = outerNeighbors(component, adjacency);
  if (outer.length === 0) {
    return UNENCLOSED;
  } else {
    /* something borders it — is it all one country? */
  }

  let claimant = UNENCLOSED;
  for (const position of outer) {
    const id = ids[position] ?? "";
    const owner = ownerByPath.get(id) ?? UNENCLOSED;
    if (owner === UNENCLOSED) {
      // Unowned land on the border. Whatever this is, it is not an enclave.
      return UNENCLOSED;
    } else if (claimant === UNENCLOSED) {
      claimant = owner;
    } else if (claimant === owner) {
      /* still unanimous */
    } else {
      return UNENCLOSED;
    }
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
 */
export const enclosedWastelands = (
  wastelandPaths: readonly string[],
  ownerByPath: ReadonlyMap<string, string>,
  adjacency: AdjacencyGraph,
  ids: readonly string[] = CANONICAL_IDS,
): ReadonlyMap<string, string> => {
  const fills = new Map<string, string>();
  if (adjacency.length === 0 || ownerByPath.size === 0) {
    return fills;
  } else {
    /* there is a graph and somebody owns something */
  }

  const wastelands = wastelandPositions(wastelandPaths, ids);
  for (const component of wastelandComponents(wastelands, adjacency)) {
    const tag = enclosingTag(component, ownerByPath, adjacency, ids);
    if (tag === UNENCLOSED) {
      /* mixed, unclaimed or detached — leave the whole component grey */
    } else {
      for (const member of component) {
        const id = ids[member] ?? "";
        if (id === "") {
          /* position outside the id list — nothing to paint */
        } else {
          fills.set(id, tag);
        }
      }
    }
  }
  return fills;
};
