import { useState, useCallback, useRef } from "react";
import type { MapChartConfig, MapStyle } from "../lib/types";
import type { StyleOverrides } from "../lib/map-styles";
import {
  getStyleConfig,
  getBaseStyleConfig,
  getMapDimensions,
  computeDownloadLayout,
  hasCustomOverrides,
  EDITABLE_COLOR_KEYS,
  STYLE_FIELD_LABELS,
  MAP_STYLE_OPTIONS,
} from "../lib/map-styles";
import { downloadConfig } from "../lib/save-utils";
import { computeProvinceCount } from "../lib/format";
import { MapRenderer } from "./MapRenderer";
import { MapLegend } from "./MapLegend";
import { Stat } from "./Stat";

export const SHOW_DEBUG = import.meta.env.DEV;

interface Props {
  config: MapChartConfig;
  parseTimeMs: number;
  onCountryClick: (tag: string) => void;
  onReset: () => void;
  debugContent?: React.ReactNode;
}

export const MapTab = ({ config, parseTimeMs, onCountryClick, onReset, debugContent }: Props) => {
  const [mapStyle, setMapStyle] = useState<MapStyle>("parchment");
  const [styleOverrides, setStyleOverrides] = useState<StyleOverrides>({});
  const [colorOverrides, setColorOverrides] = useState<Record<string, string>>({});
  const mapLayoutRef = useRef<HTMLDivElement>(null);

  const isCustom = hasCustomOverrides(getBaseStyleConfig(mapStyle), styleOverrides);
  const provinceCount = computeProvinceCount(config.groups);

  const handleStyleChange = useCallback((newStyle: MapStyle) => {
    setMapStyle(newStyle);
    setStyleOverrides({});
  }, []);

  const handleOverrideChange = useCallback((key: keyof StyleOverrides, value: string) => {
    setStyleOverrides((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleColorChange = useCallback((originalHex: string, newHex: string) => {
    setColorOverrides((prev) => ({ ...prev, [originalHex]: newHex }));
  }, []);

  const handleDownloadConfig = useCallback(() => {
    downloadConfig(config);
  }, [config]);

  const handleDownloadMap = useCallback(async () => {
    const layoutEl = mapLayoutRef.current;
    if (!layoutEl) return;

    const mapSvg = layoutEl.querySelector(".map-svg") as SVGSVGElement | null;
    const hasLegend = layoutEl.querySelector(".map-legend") !== null;
    if (!mapSvg) return;

    const dims = getMapDimensions(mapSvg.getAttribute("viewBox") ?? undefined);
    const dl = computeDownloadLayout(dims, hasLegend, 2);
    const style = getStyleConfig(mapStyle, styleOverrides);

    const canvas = document.createElement("canvas");
    canvas.width = dl.canvasWidth;
    canvas.height = dl.canvasHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = style.bgColor;
    ctx.fillRect(0, 0, dl.canvasWidth, dl.canvasHeight);

    const svgClone = mapSvg.cloneNode(true) as SVGSVGElement;
    svgClone.setAttribute("width", String(dl.mapWidth));
    svgClone.setAttribute("height", String(dl.mapHeight));
    const svgBlob = new Blob([new XMLSerializer().serializeToString(svgClone)], { type: "image/svg+xml" });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, dl.mapWidth * dl.scale, dl.mapHeight * dl.scale);
      URL.revokeObjectURL(svgUrl);

      if (dl.hasLegend) {
        ctx.fillStyle = style.legendBg;
        ctx.fillRect(dl.legendX, dl.legendY, dl.legendWidth, dl.legendHeight);
        ctx.strokeStyle = style.legendBorder;
        ctx.lineWidth = 2;
        ctx.strokeRect(dl.legendX, dl.legendY, dl.legendWidth, dl.legendHeight);

        ctx.fillStyle = style.titleColor;
        ctx.font = `bold ${14 * dl.scale}px Cinzel, Georgia, serif`;
        ctx.fillText(config.title || "Legend", dl.legendX + 12 * dl.scale, dl.legendY + 22 * dl.scale);

        ctx.strokeStyle = style.legendBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(dl.legendX + 10 * dl.scale, dl.legendY + 28 * dl.scale);
        ctx.lineTo(dl.legendX + dl.legendWidth - 10 * dl.scale, dl.legendY + 28 * dl.scale);
        ctx.stroke();

        const entries = Object.entries(config.groups);
        let ey = dl.legendY + 38 * dl.scale;
        const rowH = 11 * dl.scale;
        for (const [hex, group] of entries) {
          if (ey + rowH > dl.canvasHeight - 40) break;
          ctx.fillStyle = hex;
          ctx.fillRect(dl.legendX + 10 * dl.scale, ey, 8 * dl.scale, 8 * dl.scale);
          ctx.strokeStyle = style.legendBorder;
          ctx.lineWidth = 1;
          ctx.strokeRect(dl.legendX + 10 * dl.scale, ey, 8 * dl.scale, 8 * dl.scale);
          ctx.fillStyle = style.labelColor;
          ctx.font = `${7 * dl.scale}px Crimson Pro, Georgia, serif`;
          ctx.fillText(group.label, dl.legendX + 22 * dl.scale, ey + 7 * dl.scale);
          ctx.fillStyle = style.countColor;
          ctx.font = `${6 * dl.scale}px monospace`;
          ctx.fillText(String(group.paths.length), dl.legendX + dl.legendWidth - 20 * dl.scale, ey + 7 * dl.scale);
          ey += rowH;
        }
      }

      const link = document.createElement("a");
      link.download = "eu5_map.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = svgUrl;
  }, [mapStyle, styleOverrides, config]);

  return (
    <>
      <div className="toolbar">
        <div className="toolbar-row">
          <div className="toolbar-stats">
            <Stat label="Countries" value={String(Object.keys(config.groups).length)} />
            <Stat label="Provinces" value={String(provinceCount)} />
            <Stat label="Parse" value={`${(parseTimeMs / 1000).toFixed(1)}s`} />
          </div>
          <div className="toolbar-controls">
            <label className="option">
              Style:
              <select
                value={isCustom ? "__custom" : mapStyle}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val !== "__custom") handleStyleChange(val as MapStyle);
                }}
                className="style-select"
              >
                {MAP_STYLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
                {isCustom && <option value="__custom" disabled>Custom</option>}
              </select>
            </label>
          </div>
          <div className="toolbar-actions">
            <button className="btn primary" onClick={handleDownloadMap}>Download Map</button>
            <button className="btn secondary" onClick={handleDownloadConfig}>Download Config</button>
            <button className="btn secondary" onClick={onReset}>New File</button>
          </div>
        </div>

        <div className="toolbar-style-row">
          {EDITABLE_COLOR_KEYS.map((key) => {
            const base = getBaseStyleConfig(mapStyle);
            const current = (styleOverrides[key] ?? base[key]) as string;
            return (
              <label key={key} className="style-field">
                <span className="style-field-label">{STYLE_FIELD_LABELS[key]}</span>
                <input
                  type="color"
                  value={current}
                  onChange={(e) => handleOverrideChange(key, e.target.value)}
                  className="style-color-input"
                />
              </label>
            );
          })}
          <label className="style-field">
            <span className="style-field-label">{STYLE_FIELD_LABELS.outlineWidth}</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={styleOverrides.outlineWidth ?? getBaseStyleConfig(mapStyle).outlineWidth}
              onChange={(e) => handleOverrideChange("outlineWidth", e.target.value)}
              className="style-range-input"
            />
          </label>
        </div>
      </div>

      <div className="map-layout" ref={mapLayoutRef}>
        <div className="map-panel">
          <MapRenderer
            config={config}
            mapStyle={mapStyle}
            styleOverrides={styleOverrides}
            colorOverrides={colorOverrides}
            onProvinceClick={onCountryClick}
          />
        </div>
        <div className="legend-panel">
          <MapLegend
            config={config}
            mapStyle={mapStyle}
            styleOverrides={styleOverrides}
            colorOverrides={colorOverrides}
            onColorChange={handleColorChange}
            onCountryClick={onCountryClick}
          />
        </div>
      </div>

      {debugContent}
    </>
  );
};
