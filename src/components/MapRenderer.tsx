import { useEffect, useRef, useState, useCallback } from "react";
import type { MapChartConfig, MapStyle } from "../lib/types";
import {
  getStyleConfig,
  IDENTITY_TRANSFORM,
  zoomTowardCursor,
  transformCss,
  zoomPercent,
} from "../lib/map-styles";
import type { Transform, StyleOverrides, ColorOverrides } from "../lib/map-styles";
import { applyColorOverrides } from "../lib/map-styles";
import { framedRegion, fitTransform } from "../lib/map-bounds";
import { getMapDimensions } from "../lib/map-styles";
import { qualifyingPairs, coastalLocations } from "../lib/border-rule";
import type { BorderOwnership } from "../lib/border-rule";
import {
  sharedBorders,
  coastline,
  vertexIndex,
  polylineToPathData,
} from "../lib/border-segments";
import { pathVertices } from "../lib/svg-path";
import type { AdjacencyGraph } from "../lib/location-adjacency";
import canonicalIds from "../lib/location-ids.json";
import { createLogger } from "../lib/logger";
import { isSubjectEntry } from "../lib/legend-sort";

const log = createLogger("MapRenderer");

const MAP_ASSET = "/eu-v-locations.svg";
const SVG_NS = "http://www.w3.org/2000/svg";
const OUTLINE_CLASS = "outline-layer";
const BORDER_CLASS = "border-layer";

/** The canonical id list the adjacency graph is keyed by. */
const CANONICAL_IDS = canonicalIds as readonly string[];

/**
 * Stable empty default for `playerPaths`.
 *
 * A literal `= []` in the destructure would allocate a new array on every
 * render, and the fit effect keys on this prop — it would re-frame the map
 * continuously and fight the user's panning.
 */
const NO_PATHS: readonly string[] = [];
const DEFS_CLASS = "hatch-defs";

/** Hatch geometry, in viewBox units (locations average ~6 units across). */
const HATCH_PERIOD = 1.6;
const HATCH_STRIPE = 0.55;
const HATCH_ANGLE = 45;

/** Darken a hex for the hatch stripe and the seam stroke. */
const shadeHex = (hex: string, factor: number): string => {
  const n = parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return hex;
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((c) => Math.max(0, Math.min(255, Math.round(c * factor))));
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
};

/** Stable, selector-safe pattern id for a resolved colour. */
const hatchIdFor = (hex: string): string => `hatch-${hex.replace("#", "")}`;

interface Props {
  config: MapChartConfig;
  /** Subject tag -> root overlord tag. Paint-time only; no group changes. */
  subjectOverlords: Readonly<Record<string, string>>;
  /**
   * Who owns what and who is playing, used to decide where country borders
   * fall. Absent leaves the map unbordered.
   */
  borderOwnership?: BorderOwnership;
  /** Location adjacency graph; absent leaves the map unbordered. */
  adjacency?: AdjacencyGraph;
  /** Id list the graph is keyed by. Overridable so tests can use a small one. */
  adjacencyIds?: readonly string[];
  /**
   * Path ids held by the player countries. The map opens framed on these, and
   * "Reset View" returns there. Empty leaves the whole map in view.
   */
  playerPaths?: readonly string[];
  mapStyle: MapStyle;
  styleOverrides: StyleOverrides;
  colorOverrides: ColorOverrides;
  onProvinceClick?: (tag: string) => void;
}

/**
 * Renders the location map: 22,711 SVG paths, colored from config groups.
 *
 * The document is fetched and parsed exactly once, on mount. Recoloring then
 * mutates the live nodes in place — at this path count, re-parsing and
 * re-serializing on every style or color change costs seconds per interaction.
 *
 * Two properties carry the design:
 *  - the recolor effect is gated on `ready`, because the load is async and an
 *    ungated effect would run once against an empty path map and never re-run,
 *    leaving the map uncolored until the user happened to touch a control;
 *  - the recolor effect is idempotent over fill, the inline `style` attribute
 *    and the outline layer, because nothing rebuilds the document any more.
 *    Resetting only `fill` would accumulate outline clones and leave stale
 *    shrink transforms behind as permanent hairline gaps.
 */
export const MapRenderer = ({ config, subjectOverlords, playerPaths = NO_PATHS, borderOwnership, adjacency, adjacencyIds = CANONICAL_IDS, mapStyle, styleOverrides, colorOverrides, onProvinceClick }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pathMapRef = useRef<Map<string, SVGPathElement>>(new Map());
  const strokeStyleRef = useRef<SVGStyleElement | null>(null);
  const defsRef = useRef<SVGDefsElement | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [transform, setTransform] = useState<Transform>(IDENTITY_TRANSFORM);
  // Where "Reset View" goes back to. Identity until a fit succeeds, so a save
  // with no players keeps today's reset behaviour.
  const fittedRef = useRef<Transform>(IDENTITY_TRANSFORM);
  // The paths the current frame was computed from, so an identical set arriving
  // as a fresh array does not re-frame the map.
  const fittedPathsRef = useRef<readonly string[] | undefined>(undefined);
  // Extracted border geometry, keyed on the inputs it came from so a restyle
  // redraws without re-extracting.
  const borderCacheRef = useRef<
    | {
        ownership: BorderOwnership;
        adjacency: AdjacencyGraph;
        ids: readonly string[];
        data: string;
      }
    | undefined
  >(undefined);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const locationToTagRef = useRef<Map<string, string>>(new Map());

  // Build location → tag lookup whenever config changes
  useEffect(() => {
    const map = new Map<string, string>();
    for (const [, group] of Object.entries(config.groups)) {
      const tag = group.label.includes(" - ") ? group.label.split(" - ")[0] : group.label;
      for (const path of group.paths) {
        map.set(path, tag);
      }
    }
    locationToTagRef.current = map;
  }, [config]);

  // Handle click on map — find location path and fire callback
  const handleMapClick = useCallback((e: React.MouseEvent) => {
    if (!onProvinceClick) return;
    const target = e.target as SVGElement;
    // Path IDs must stay on the injected nodes for this lookup to work.
    const id = target.getAttribute?.("id") ?? "";
    if (id === "") return;
    const tag = locationToTagRef.current.get(id);
    if (tag !== undefined) {
      onProvinceClick(tag);
    }
  }, [onProvinceClick]);

  // ---------------------------------------------------------------------------
  // Effect A: fetch, parse and inject the document — once per mount.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    // No state reset here: `ready` and `loadError` already hold their initial
    // values on mount, and the retry handler clears them before bumping
    // reloadKey. Resetting synchronously inside the effect would queue a
    // cascading render on every mount for no benefit.

    const loadSvg = async () => {
      const text = await fetch(MAP_ASSET)
        .then((resp) => resp.text())
        .catch((err: unknown) => {
          log.error(`failed to load ${MAP_ASSET}: ${String(err)}`);
          return "";
        });

      if (cancelled) return;

      if (text === "") {
        setLoadError(`Could not load the map (${MAP_ASSET}).`);
        return;
      } else {
        /* document fetched — parse below */
      }

      const doc = new DOMParser().parseFromString(text, "image/svg+xml");
      const parsed = doc.querySelector("svg");
      if (!parsed) {
        setLoadError("The map file could not be parsed.");
        return;
      } else {
        /* parsed successfully */
      }

      const host = svgHostRef.current;
      if (!host) return;

      const svg = document.importNode(parsed, true) as SVGSVGElement;
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.setAttribute("class", "map-svg");

      // Build the id → element map in one pass. Cheaper than repeated document
      // lookups, and keeps resolution local to this component.
      const map = new Map<string, SVGPathElement>();
      for (const p of svg.querySelectorAll("path")) {
        // Some paths carry style="fill:..." which overrides the fill attribute.
        p.removeAttribute("style");
        const id = p.getAttribute("id") ?? "";
        if (id !== "") {
          map.set(id, p);
        } else {
          /* unnamed path — colorable only by position, which we never do */
        }
      }

      // stroke-width lives in a stylesheet inside the document rather than on
      // 22,711 attributes. The child combinator matters: a descendant rule
      // would also beat the stroke-width the outline clones set on themselves,
      // giving a hairline outline on screen and a correct one in the download.
      const strokeStyle = svg.ownerDocument.createElementNS(SVG_NS, "style") as SVGStyleElement;
      svg.insertBefore(strokeStyle, svg.firstChild);

      // Hatch pattern definitions live here; the recolor pass rebuilds them.
      const defs = svg.ownerDocument.createElementNS(SVG_NS, "defs") as SVGDefsElement;
      defs.setAttribute("class", DEFS_CLASS);
      svg.insertBefore(defs, svg.firstChild);

      svgRef.current = svg;
      defsRef.current = defs;
      pathMapRef.current = map;
      strokeStyleRef.current = strokeStyle;
      host.replaceChildren(svg);
      setReady(true);
    };

    loadSvg();
    return () => { cancelled = true; };
  }, [reloadKey]);

  // ---------------------------------------------------------------------------
  // Effect B: recolor the live document. Runs per interaction, never re-parses.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!ready) return;
    const svg = svgRef.current;
    if (!svg) return;

    const style = getStyleConfig(mapStyle, styleOverrides);
    const groups = applyColorOverrides(config.groups, colorOverrides);

    // --- RESET ---------------------------------------------------------------
    // Remove the outline layer before querying paths, so clones are not treated
    // as map shapes, and clear the inline styles the outline pass writes.
    // The per-location outline is gone — borders are drawn between countries
    // now, in their own layer. A document rendered before that change can
    // still carry the old layer, so removing it is cheap insurance; its shrink
    // transform is cleared with the inline style in the path reset below.
    const staleOutline = svg.querySelector(`.${OUTLINE_CLASS}`);
    if (staleOutline) {
      staleOutline.remove();
    } else {
      /* nothing left over */
    }

    const paths = pathMapRef.current;
    for (const p of paths.values()) {
      p.removeAttribute("style");
      p.removeAttribute("data-hatch-base");
      p.setAttribute("fill", style.defaultFill);
    }

    // Patterns are regenerated every pass; an add-only pass would accumulate
    // definitions exactly as the outline layer would.
    const defs = defsRef.current;
    if (defs) {
      defs.replaceChildren();
    } else {
      /* defs missing — hatching degrades to flat fills below */
    }

    const strokeStyle = strokeStyleRef.current;
    if (strokeStyle) {
      strokeStyle.textContent = `.map-svg > path { stroke-width: ${style.strokeWidth}; }`;
    } else {
      /* stylesheet missing — strokes fall back to the asset's own width */
    }

    // --- APPLY ---------------------------------------------------------------
    // Resolve each group's display colour first, so a subject can look up its
    // overlord's colour after overrides rather than before.
    const tagOf = (label: string): string =>
      label.includes(" - ") ? label.split(" - ")[0] : label;
    const hexByTag = new Map<string, string>();
    for (const [hex, group] of Object.entries(groups)) {
      if (!isSubjectEntry(group.label)) {
        hexByTag.set(tagOf(group.label), hex);
      } else {
        /* overlay rows never define a country's own colour */
      }
    }

    /** The overlord whose colour this group should carry, or "" for none. */
    const overlordHexFor = (label: string): string => {
      const tag = tagOf(label);
      const overlordTag = isSubjectEntry(label) ? tag : subjectOverlords[tag] ?? "";
      if (overlordTag === "") return "";
      return hexByTag.get(overlordTag) ?? "";
    };

    const ensureHatch = (baseHex: string): string => {
      const id = hatchIdFor(baseHex);
      if (!defs) return "";
      if (!defs.querySelector(`#${id}`)) {
        const pattern = svg.ownerDocument.createElementNS(SVG_NS, "pattern");
        pattern.setAttribute("id", id);
        // userSpaceOnUse: the SVG default scales the pattern per shape, giving
        // one stripe on a small location and dense banding on a large one.
        pattern.setAttribute("patternUnits", "userSpaceOnUse");
        pattern.setAttribute("width", String(HATCH_PERIOD));
        pattern.setAttribute("height", String(HATCH_PERIOD));
        pattern.setAttribute("patternTransform", `rotate(${HATCH_ANGLE})`);

        // Opaque by construction: the asset has no background rect and the
        // ocean is painted by the container, so gaps would read as water.
        const bg = svg.ownerDocument.createElementNS(SVG_NS, "rect");
        bg.setAttribute("width", String(HATCH_PERIOD));
        bg.setAttribute("height", String(HATCH_PERIOD));
        bg.setAttribute("fill", baseHex);
        pattern.appendChild(bg);

        const stripe = svg.ownerDocument.createElementNS(SVG_NS, "rect");
        stripe.setAttribute("width", String(HATCH_STRIPE));
        stripe.setAttribute("height", String(HATCH_PERIOD));
        stripe.setAttribute("fill", shadeHex(baseHex, 0.62));
        pattern.appendChild(stripe);

        defs.appendChild(pattern);
      } else {
        /* one definition per resolved colour — reuse it */
      }
      return `url(#${id})`;
    };

    const hatchedIds = new Set<string>();
    const coloredIds = new Set<string>();
    let misses = 0;
    for (const [hex, group] of Object.entries(groups)) {
      const overlordHex = overlordHexFor(group.label);
      const hatchRef = overlordHex !== "" ? ensureHatch(overlordHex) : "";
      for (const pathId of group.paths) {
        const el = paths.get(pathId);
        if (el) {
          if (hatchRef !== "") {
            el.setAttribute("fill", hatchRef);
            el.setAttribute("data-hatch-base", overlordHex);
            hatchedIds.add(pathId);
          } else {
            el.setAttribute("fill", hex);
          }
          coloredIds.add(pathId);
        } else {
          misses++;
        }
      }
    }

    // Config paths are canonical IDs resolved from location-ids.json, so every
    // one should exist in the asset. A miss means the id list and the shipped
    // SVG have drifted apart — regenerate with scripts/generate-location-ids.mjs.
    if (misses > 0) {
      log.warn(
        `${misses} config path id(s) had no shape in ${MAP_ASSET} — ` +
          `location-ids.json may be stale relative to the asset.`,
      );
    } else {
      /* every config path resolved to a shape */
    }

    // Strokes match their own fill, hiding internal borders. A hatched path
    // instead takes a darker seam colour: copying its fill would put a
    // url(...) reference in the stroke, and using the overlord's flat colour
    // would erase the boundary between held and subject territory.
    for (const p of paths.values()) {
      const base = p.getAttribute("data-hatch-base") ?? "";
      if (base !== "") {
        p.setAttribute("stroke", shadeHex(base, 0.45));
      } else {
        p.setAttribute("stroke", p.getAttribute("fill") ?? style.defaultFill);
      }
    }

  }, [ready, config, subjectOverlords, mapStyle, styleOverrides, colorOverrides]);

  /**
   * Frame the map on the player countries once the document is ready.
   *
   * Deliberately separate from the recolor effect above, which re-runs on every
   * style change, colour override and outline-width drag — re-framing there
   * would yank the view out from under a user who had panned. This keys only on
   * readiness and the player paths, so it re-frames when a new save loads and
   * not otherwise.
   */
  useEffect(() => {
    if (!ready) return;
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;

    // Content comparison, not identity: a parent that rebuilds the array on
    // every render would otherwise re-frame the map continuously and undo the
    // user's panning. Only runs when the reference actually changed, so the
    // cost is one pass per save rather than one per render.
    const previous = fittedPathsRef.current;
    const unchanged =
      previous !== undefined &&
      previous.length === playerPaths.length &&
      previous.every((id, i) => id === playerPaths[i]);
    if (unchanged) return;
    fittedPathsRef.current = playerPaths;

    const map = getMapDimensions(svg.getAttribute("viewBox") ?? undefined);
    const paths = pathMapRef.current;
    const elements: SVGPathElement[] = [];
    for (const id of playerPaths) {
      const el = paths.get(id);
      if (el) {
        elements.push(el);
      } else {
        /* id with no shape in the asset — nothing to measure */
      }
    }

    // Every failure mode lands on identity: no players, no measurable geometry
    // (jsdom, where getBBox is unimplemented), or an unmeasured container.
    const fitted = fitTransform(
      framedRegion(elements, map),
      map,
      container.clientWidth,
      { width: container.clientWidth, height: container.clientHeight },
    );

    fittedRef.current = fitted;
    setTransform(fitted);
  }, [ready, playerPaths]);

  /**
   * Draw the country borders and coastlines.
   *
   * Extraction and drawing share one effect so the path map can be read where
   * refs are allowed to be read, but the expensive half is cached on its own
   * inputs: it costs roughly 400 ms for a large multiplayer save and depends
   * only on who owns what and which locations touch, so dragging the width
   * slider or switching preset must not pay for it again.
   */
  useEffect(() => {
    if (!ready) return;
    const svg = svgRef.current;
    if (!svg) return;

    const stale = svg.querySelector(`.${BORDER_CLASS}`);
    if (stale) {
      stale.remove();
    } else {
      /* no layer from a previous pass */
    }

    const style = getStyleConfig(mapStyle, styleOverrides);
    const wanted =
      parseFloat(style.outlineWidth) > 0 &&
      borderOwnership !== undefined &&
      adjacency !== undefined &&
      adjacency.length > 0;
    if (!wanted) {
      return;
    } else {
      /* borders are on and the inputs are present */
    }

    const cached = borderCacheRef.current;
    const fresh =
      cached !== undefined &&
      cached.ownership === borderOwnership &&
      cached.adjacency === adjacency &&
      cached.ids === adjacencyIds;

    if (!fresh) {
      const paths = pathMapRef.current;
      const verts = new Map<string, ReturnType<typeof pathVertices>>();
      const vertsOf = (id: string) => {
        const hit = verts.get(id);
        if (hit !== undefined) return hit;
        const parsed = pathVertices(paths.get(id)?.getAttribute("d") ?? "");
        verts.set(id, parsed);
        return parsed;
      };

      const parts: string[] = [];
      for (const [a, b] of qualifyingPairs(borderOwnership, adjacency, adjacencyIds)) {
        for (const line of sharedBorders(vertsOf(a), vertsOf(b))) {
          parts.push(polylineToPathData(line));
        }
      }

      // Coastline joins the same layer and the same stroke, so a realm reads
      // as one outline rather than political lines and sea lines in different
      // hands.
      // Every location neighbours several others, so its near-test is built
      // once and reused rather than rebuilt per pairing.
      const tests = new Map<string, ReturnType<typeof vertexIndex>>();
      const testOf = (id: string) => {
        const hit = tests.get(id);
        if (hit !== undefined) return hit;
        const test = vertexIndex(vertsOf(id));
        tests.set(id, test);
        return test;
      };

      for (const { id, neighbors } of coastalLocations(borderOwnership, adjacency, adjacencyIds)) {
        for (const line of coastline(vertsOf(id), neighbors.map(testOf))) {
          parts.push(polylineToPathData(line));
        }
      }

      // One element holding every border as a subpath, rather than thousands
      // of elements: a large save yields ~9,400 polylines, and the browser
      // handles them far better as a single stroked path.
      borderCacheRef.current = {
        ownership: borderOwnership,
        adjacency,
        ids: adjacencyIds,
        data: parts.join(""),
      };
    } else {
      /* same inputs — reuse the geometry and just restyle it */
    }

    const data = borderCacheRef.current?.data ?? "";
    if (data === "") {
      return;
    } else {
      /* there are borders to draw */
    }

    // Inside a group on purpose: the asset's own stylesheet sets
    // `.map-svg > path { stroke-width }`, and author CSS beats a presentation
    // attribute, so a direct child would be forced to the location width.
    const layer = svg.ownerDocument.createElementNS(SVG_NS, "g");
    layer.setAttribute("class", BORDER_CLASS);

    const line = svg.ownerDocument.createElementNS(SVG_NS, "path");
    line.setAttribute("class", "border-line");
    line.setAttribute("d", data);
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", style.outlineColor);
    line.setAttribute("stroke-width", style.outlineWidth);
    line.setAttribute("stroke-linejoin", "round");
    line.setAttribute("stroke-linecap", "round");
    layer.appendChild(line);

    // Appended last so it sits above the fills; a border drawn underneath
    // would be covered by the territory on either side of it.
    svg.appendChild(layer);
  }, [ready, borderOwnership, adjacency, adjacencyIds, mapStyle, styleOverrides]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setTransform((prev) => zoomTowardCursor(prev, e.deltaY, cx, cy));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: transform.x, originY: transform.y };
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
  }, [transform.x, transform.y]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    setTransform((prev) => ({
      ...prev,
      x: drag.originX + (e.clientX - drag.startX),
      y: drag.originY + (e.clientY - drag.startY),
    }));
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    dragRef.current = null;
    // Only treat as click if mouse barely moved (< 5px)
    const down = mouseDownPosRef.current;
    if (down) {
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        handleMapClick(e);
      }
    }
    mouseDownPosRef.current = null;
  }, [handleMapClick]);

  const handleReset = useCallback(() => {
    // Back to how the map opened, which is the fitted player view when there
    // was one and the whole map otherwise.
    setTransform(fittedRef.current);
  }, []);

  const handleRetry = useCallback(() => {
    setReady(false);
    setLoadError("");
    setReloadKey((k) => k + 1);
  }, []);

  const style = getStyleConfig(mapStyle, styleOverrides);

  return (
    <div className={`map-renderer map-renderer-${mapStyle}`}>
      <div className="map-toolbar">
        <button className="btn secondary" onClick={handleReset}>Reset View</button>
        <span className="zoom-level">{zoomPercent(transform.scale)}</span>
      </div>
      <div
        ref={containerRef}
        className={style.viewportClass}
        style={{ backgroundColor: style.bgColor }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { dragRef.current = null; mouseDownPosRef.current = null; }}
      >
        {/* Rendered unconditionally: a mount-time effect needs this node to
            exist as its injection target. The spinner is an overlay. */}
        <div
          ref={svgHostRef}
          className="map-transform"
          style={{
            transform: transformCss(transform),
            transformOrigin: "0 0",
          }}
        />
        {loadError !== "" && (
          <div className="map-load-error">
            <p>{loadError}</p>
            <button className="btn secondary" onClick={handleRetry}>Retry</button>
          </div>
        )}
        {!ready && loadError === "" && (
          <div className="map-loading">
            <div className="spinner" />
            <span>Loading map...</span>
          </div>
        )}
      </div>
    </div>
  );
};
