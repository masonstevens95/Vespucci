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
import { createLogger } from "../lib/logger";

const log = createLogger("MapRenderer");

const MAP_ASSET = "/eu-v-locations.svg";
const SVG_NS = "http://www.w3.org/2000/svg";
const OUTLINE_CLASS = "outline-layer";

interface Props {
  config: MapChartConfig;
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
export const MapRenderer = ({ config, mapStyle, styleOverrides, colorOverrides, onProvinceClick }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pathMapRef = useRef<Map<string, SVGPathElement>>(new Map());
  const strokeStyleRef = useRef<SVGStyleElement | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [transform, setTransform] = useState<Transform>(IDENTITY_TRANSFORM);
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

      svgRef.current = svg;
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
    const staleOutline = svg.querySelector(`.${OUTLINE_CLASS}`);
    if (staleOutline) {
      staleOutline.remove();
    } else {
      /* no outline layer from a previous pass */
    }

    const paths = pathMapRef.current;
    for (const p of paths.values()) {
      p.removeAttribute("style");
      p.setAttribute("fill", style.defaultFill);
    }

    const strokeStyle = strokeStyleRef.current;
    if (strokeStyle) {
      strokeStyle.textContent = `.map-svg > path { stroke-width: ${style.strokeWidth}; }`;
    } else {
      /* stylesheet missing — strokes fall back to the asset's own width */
    }

    // --- APPLY ---------------------------------------------------------------
    const coloredIds = new Set<string>();
    let misses = 0;
    for (const [hex, group] of Object.entries(groups)) {
      for (const pathId of group.paths) {
        const el = paths.get(pathId);
        if (el) {
          el.setAttribute("fill", hex);
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

    // Strokes match their own fill, hiding internal borders.
    for (const p of paths.values()) {
      p.setAttribute("stroke", p.getAttribute("fill") ?? style.defaultFill);
    }

    // --- OUTLINE (opt-in) ----------------------------------------------------
    // Clones every colored path, so it is gated on a non-zero width.
    if (parseFloat(style.outlineWidth) > 0) {
      const outlineGroup = svg.ownerDocument.createElementNS(SVG_NS, "g");
      outlineGroup.setAttribute("class", OUTLINE_CLASS);
      for (const pathId of coloredIds) {
        const p = paths.get(pathId);
        if (p) {
          const outline = p.cloneNode(false) as SVGPathElement;
          outline.removeAttribute("id");
          outline.setAttribute("fill", "none");
          outline.setAttribute("stroke", style.outlineColor);
          outline.setAttribute("stroke-width", style.outlineWidth);
          outline.setAttribute("stroke-linejoin", "round");
          outlineGroup.appendChild(outline);
        } else {
          /* colored id with no element — already counted as a miss */
        }
      }
      svg.insertBefore(outlineGroup, svg.firstChild);

      // Shrink colored fills slightly so the outline peeks through at all edges.
      for (const pathId of coloredIds) {
        const p = paths.get(pathId);
        if (p) {
          p.setAttribute("style",
            "transform-box: fill-box; transform-origin: center; transform: scale(0.995);");
        } else {
          /* nothing to shrink */
        }
      }
    } else {
      /* outline disabled — the reset above already removed any stale layer */
    }
  }, [ready, config, mapStyle, styleOverrides, colorOverrides]);

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
    setTransform(IDENTITY_TRANSFORM);
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
