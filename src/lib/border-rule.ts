/**
 * Which location pairs get a border drawn between them.
 *
 * A border runs between two adjacent locations that are both owned, owned by
 * different countries, and at least one of them player-held. That excludes the
 * internal edges within a country, the frontier with unclaimed land (nothing
 * owned on the far side), and borders between two AI countries (no player
 * side).
 *
 * Coastline is handled separately, because it is not a border with anything:
 * sea zones have no shape in the asset, so a coast is the stretch of perimeter
 * touching no land neighbour at all.
 *
 * Ownership deliberately comes from every country in the save rather than
 * from the rendered config. With `playersOnly` on — the default — the config
 * holds only player groups and their vassal overlays, so AI territory is
 * neither painted nor present, and reading ownership from it would make every
 * player-versus-AI border disappear in the mode most users are in.
 *
 * All functions are pure, use immutable variables, and never throw.
 */

import { resolveCountryLocations } from "./location-resolve";
import type { AdjacencyGraph } from "./location-adjacency";

/** Who holds what, and whose borders are worth drawing. */
export interface BorderOwnership {
  /** Canonical path id -> owning country tag, across every country. */
  readonly ownerByPath: ReadonlyMap<string, string>;
  /** Tags whose borders should be drawn: players and their subjects. */
  readonly playerTags: ReadonlySet<string>;
}

/** An adjacent pair whose shared border should be drawn. */
export type BorderPair = readonly [string, string];

/** A location whose coastline should be drawn, with its land neighbours. */
export interface CoastalLocation {
  readonly id: string;
  readonly neighbors: readonly string[];
}

/** Nothing owned, nobody playing — the shape a save with no players takes. */
export const NO_OWNERSHIP: BorderOwnership = {
  ownerByPath: new Map(),
  playerTags: new Set(),
};

/**
 * Build the ownership view the border rule needs.
 *
 * A subject keeps its own tag rather than being folded into its overlord's,
 * so the boundary between an overlord and its subject is a border like any
 * other. A subject still counts as player-side, though: its frontier with a
 * neighbouring AI is part of the player's realm and should be drawn.
 *
 * `subjectOverlords` maps a subject to its *root* overlord, so a subject of a
 * subject of a player is player-side too.
 */
export const buildOwnership = (
  countryLocations: Readonly<Record<string, readonly string[]>>,
  tagToPlayers: Readonly<Record<string, readonly string[]>>,
  subjectOverlords: Readonly<Record<string, string>>,
  locationIndex?: Record<string, string>,
): BorderOwnership => {
  const { resolved } = resolveCountryLocations(
    countryLocations as Record<string, string[]>,
    locationIndex,
  );

  const ownerByPath = new Map<string, string>();
  for (const [tag, paths] of Object.entries(resolved)) {
    for (const path of paths) {
      if (ownerByPath.has(path)) {
        /* already claimed — first tag wins; real ownership is exclusive */
      } else {
        ownerByPath.set(path, tag);
      }
    }
  }

  const players = new Set(Object.keys(tagToPlayers));
  const playerTags = new Set(players);
  for (const [subject, overlord] of Object.entries(subjectOverlords)) {
    if (players.has(overlord)) {
      playerTags.add(subject);
    } else {
      /* a subject of an AI — its borders are AI borders */
    }
  }

  return { ownerByPath, playerTags };
};

/**
 * Every adjacent pair that qualifies for a border.
 *
 * Each pair is reported once, in canonical-id order, so the caller does not
 * draw the same border twice from opposite sides.
 */
export const qualifyingPairs = (
  ownership: BorderOwnership,
  adjacency: AdjacencyGraph,
  ids: readonly string[],
): BorderPair[] => {
  if (ownership.playerTags.size === 0) {
    return [];
  } else {
    /* somebody is playing — look for their borders */
  }

  const pairs: BorderPair[] = [];
  adjacency.forEach((neighbors, i) => {
    const here = ids[i];
    if (here === undefined) {
      return;
    } else {
      /* a real id — check its owner */
    }
    const mine = ownership.ownerByPath.get(here);
    if (mine === undefined) {
      // Unclaimed land, or a shape nobody owns. Its edges are not borders.
      return;
    } else {
      /* owned — compare against each neighbour */
    }

    for (const n of neighbors) {
      if (n <= i) {
        continue; // the pair is reported from the lower index only
      } else {
        /* unseen pair */
      }
      const there = ids[n];
      if (there === undefined) {
        continue;
      } else {
        /* a real id */
      }
      const theirs = ownership.ownerByPath.get(there);
      if (theirs === undefined || theirs === mine) {
        // Unowned on the far side, or the same country: no border.
        continue;
      } else {
        /* two different owners — is either one ours? */
      }
      if (ownership.playerTags.has(mine) || ownership.playerTags.has(theirs)) {
        pairs.push([here, there]);
      } else {
        /* two AI countries — not this feature's concern */
      }
    }
  });
  return pairs;
};

/**
 * Player-held locations whose coastline should be drawn, with their land
 * neighbours.
 *
 * Coastline cannot be found as a border with the sea, because sea zones have
 * no shape in the asset — the ocean is the container's background. It is the
 * complement instead: the stretch of perimeter touching none of these
 * neighbours. Passing the neighbours here rather than computing coast
 * elsewhere keeps the "what counts as touching" question in one place.
 *
 * Only player territory, matching the country borders: an AI coastline would
 * be a stray line around unpainted grey in the default playersOnly mode.
 */
export const coastalLocations = (
  ownership: BorderOwnership,
  adjacency: AdjacencyGraph,
  ids: readonly string[],
): CoastalLocation[] => {
  if (ownership.playerTags.size === 0) {
    return [];
  } else {
    /* somebody is playing — find their coasts */
  }

  const result: CoastalLocation[] = [];
  adjacency.forEach((neighbors, i) => {
    const here = ids[i];
    if (here === undefined) {
      return;
    } else {
      /* a real id */
    }
    const owner = ownership.ownerByPath.get(here);
    if (owner === undefined || !ownership.playerTags.has(owner)) {
      return;
    } else {
      /* player-held — its seaward edges are coast */
    }
    result.push({
      id: here,
      neighbors: neighbors
        .map((n) => ids[n])
        .filter((id): id is string => id !== undefined),
    });
  });
  return result;
};
