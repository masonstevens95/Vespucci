/**
 * Which location pairs get a border drawn between them.
 *
 * The rule: two adjacent locations, both owned, owned by different countries,
 * and at least one of them player-held. That excludes the internal edges
 * within a country, the coastline and the frontier with unclaimed land
 * (neither has an owner on the far side), and borders between two AI
 * countries (no player side).
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
