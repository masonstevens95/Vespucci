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

interface Props {
  config: MapChartConfig;
  mapStyle: MapStyle;
  styleOverrides: StyleOverrides;
  colorOverrides: ColorOverrides;
}

export const MapRenderer = ({ config, mapStyle, styleOverrides, colorOverrides }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [transform, setTransform] = useState<Transform>(IDENTITY_TRANSFORM);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  // Fetch and color the SVG
  useEffect(() => {
    let cancelled = false;
    const loadSvg = async () => {
      setLoading(true);
      const resp = await fetch("/eu-v-provinces.svg");
      const text = await resp.text();
      if (cancelled) return;

      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "image/svg+xml");
      const svg = doc.querySelector("svg");
      if (!svg) return;

      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.setAttribute("class", "map-svg");

      const style = getStyleConfig(mapStyle, styleOverrides);
      const ns = "http://www.w3.org/2000/svg";

      // Apply color overrides to groups
      const groups = applyColorOverrides(config.groups, colorOverrides);

      // Build set of colored path IDs
      const coloredIds = new Set<string>();
      for (const [, group] of Object.entries(groups)) {
        for (const pathId of group.paths) {
          coloredIds.add(pathId);
        }
      }

      // Fill layer: set fills and match-fill strokes (invisible province borders)
      // Remove inline styles first — some SVG paths have style="fill:..." which
      // overrides the fill attribute.
      const allPaths = svg.querySelectorAll("path");
      for (const p of allPaths) {
        p.removeAttribute("style");
        p.setAttribute("fill", style.defaultFill);
        p.setAttribute("stroke-width", style.strokeWidth);
      }

      for (const [hex, group] of Object.entries(groups)) {
        for (const pathId of group.paths) {
          const el = svg.getElementById(pathId);
          if (el) {
            el.setAttribute("fill", hex);
          }
        }
      }

      for (const p of allPaths) {
        const fill = p.getAttribute("fill") ?? style.defaultFill;
        p.setAttribute("stroke", fill);
      }

      // Outline layer BEHIND fills: thick stroke on cloned paths.
      // Fill paths are slightly scaled down (transform-box: fill-box)
      // so the outline peeks through at all edges.
      if (parseFloat(style.outlineWidth) > 0) {
        const outlineGroup = svg.ownerDocument.createElementNS(ns, "g");
        outlineGroup.setAttribute("class", "outline-layer");
        for (const p of allPaths) {
          const pathId = p.getAttribute("id") ?? "";
          if (coloredIds.has(pathId)) {
            const outline = p.cloneNode(false) as SVGPathElement;
            outline.removeAttribute("id");
            outline.setAttribute("fill", "none");
            outline.setAttribute("stroke", style.outlineColor);
            outline.setAttribute("stroke-width", style.outlineWidth);
            outline.setAttribute("stroke-linejoin", "round");
            outlineGroup.appendChild(outline);
          }
        }
        svg.insertBefore(outlineGroup, svg.firstChild);

        // Shrink colored fill paths slightly so outline peeks through
        for (const p of allPaths) {
          const pathId = p.getAttribute("id") ?? "";
          if (coloredIds.has(pathId)) {
            p.setAttribute("style",
              "transform-box: fill-box; transform-origin: center; transform: scale(0.995);");
          }
        }
      }

      setSvgContent(new XMLSerializer().serializeToString(svg));
      setLoading(false);
    };
    loadSvg();
    return () => { cancelled = true; };
  }, [config, mapStyle, styleOverrides, colorOverrides]);

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

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleReset = useCallback(() => {
    setTransform(IDENTITY_TRANSFORM);
  }, []);

  const style = getStyleConfig(mapStyle, styleOverrides);

  if (loading) {
    return (
      <div className="map-loading">
        <div className="spinner" />
        <span>Loading map...</span>
      </div>
    );
  }

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
        onMouseLeave={handleMouseUp}
      >
        <div
          className="map-transform"
          style={{
            transform: transformCss(transform),
            transformOrigin: "0 0",
          }}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>
    </div>
  );
};
