/**
 * On-demand loader for the location adjacency graph.
 *
 * The graph is 718 KB — over half the size of the entire app bundle — and is
 * read only when country borders are actually being drawn, which they are not
 * at the default outline width of 0. A static import would put that cost on
 * every visitor for a feature many never switch on, so the asset is
 * code-split behind a dynamic import.
 *
 * The promise is memoised rather than the value, so two callers arriving
 * together share one fetch instead of racing.
 */

/** Neighbour indices per canonical id, parallel to the canonical id list. */
export type AdjacencyGraph = readonly (readonly number[])[];

let pending: Promise<AdjacencyGraph> | undefined = undefined;

/**
 * Fetch the adjacency graph, reusing the in-flight or completed request.
 *
 * Resolves to an empty graph if the chunk cannot be loaded, so a failed fetch
 * costs the borders and nothing else.
 */
export const loadAdjacency = (): Promise<AdjacencyGraph> => {
  if (pending === undefined) {
    pending = import("./location-adjacency.json")
      .then((module) => module.default as AdjacencyGraph)
      .catch(() => [] as AdjacencyGraph);
  } else {
    /* already requested — reuse it */
  }
  return pending;
};
