import { useEffect, useRef, useState, useCallback } from "react";
import type { MapChartConfig, MapStyle } from "../lib/types";
import {
  getStyleConfig,
  IDENTITY_TRANSFORM,
  zoomTowardCursor,
  transformCss,
  zoomPercent,
} from "../lib/map-styles";
import type { Transform } from "../lib/map-styles";

interface Props {
  config: MapChartConfig;
  mapStyle: MapStyle;
  onDownloadMap: () => void;
}

export const MapRenderer = ({ config, mapStyle, onDownloadMap }: Props) => {
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

      const style = getStyleConfig(mapStyle);

      // Set default fill on all paths
      const allPaths = svg.querySelectorAll("path");
      for (const p of allPaths) {
        p.setAttribute("fill", style.defaultFill);
        p.setAttribute("stroke-width", style.strokeWidth);
      }

      // Apply colors from config groups
      for (const [hex, group] of Object.entries(config.groups)) {
        for (const pathId of group.paths) {
          const el = svg.getElementById(pathId);
          if (el) {
            el.setAttribute("fill", hex);
          }
        }
      }

      // Set stroke to match fill (removes province borders, keeps country outlines via color contrast)
      for (const p of allPaths) {
        const fill = p.getAttribute("fill") ?? style.defaultFill;
        p.setAttribute("stroke", fill);
      }

      setSvgContent(new XMLSerializer().serializeToString(svg));
      setLoading(false);
    };
    loadSvg();
    return () => { cancelled = true; };
  }, [config, mapStyle]);

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

  const style = getStyleConfig(mapStyle);

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
        <button className="btn secondary" onClick={onDownloadMap}>Download Map</button>
      </div>
      <div
        ref={containerRef}
        className={style.viewportClass}
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
