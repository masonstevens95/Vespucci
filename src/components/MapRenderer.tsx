import { useEffect, useRef, useState, useCallback } from "react";
import type { MapChartConfig } from "../lib/types";

interface Props {
  config: MapChartConfig;
}

export const MapRenderer = ({ config }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
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

      // Remove fixed width/height so it scales with CSS
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.setAttribute("class", "map-svg");

      // Apply colors from config groups
      for (const [hex, group] of Object.entries(config.groups)) {
        for (const pathId of group.paths) {
          const el = svg.getElementById(pathId);
          if (el) {
            el.setAttribute("fill", hex);
          }
        }
      }

      // Set border color
      const allPaths = svg.querySelectorAll("path");
      for (const p of allPaths) {
        p.setAttribute("stroke", config.borders);
        p.setAttribute("stroke-width", config.strokeWidth === "medium" ? "0.1" : "0.05");
      }

      setSvgContent(new XMLSerializer().serializeToString(svg));
      setLoading(false);
    };
    loadSvg();
    return () => { cancelled = true; };
  }, [config]);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((prev) => {
      const newScale = Math.max(0.5, Math.min(20, prev.scale * delta));
      // Zoom toward cursor position
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { ...prev, scale: newScale };
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const ratio = newScale / prev.scale;
      return {
        scale: newScale,
        x: cx - (cx - prev.x) * ratio,
        y: cy - (cy - prev.y) * ratio,
      };
    });
  }, []);

  // Pan start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: transform.x, originY: transform.y };
  }, [transform.x, transform.y]);

  // Pan move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    setTransform((prev) => ({
      ...prev,
      x: drag.originX + (e.clientX - drag.startX),
      y: drag.originY + (e.clientY - drag.startY),
    }));
  }, []);

  // Pan end
  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Reset view
  const handleReset = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  if (loading) {
    return (
      <div className="map-loading">
        <div className="spinner" />
        <span>Loading map...</span>
      </div>
    );
  }

  return (
    <div className="map-renderer">
      <div className="map-toolbar">
        <button className="btn secondary" onClick={handleReset}>Reset View</button>
        <span className="zoom-level">{Math.round(transform.scale * 100)}%</span>
      </div>
      <div
        ref={containerRef}
        className="map-viewport"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="map-transform"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: "0 0",
          }}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>
    </div>
  );
};
