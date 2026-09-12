import { useState } from "react";
import type { MapChartConfig, MapStyle } from "../lib/types";
import { getStyleConfig } from "../lib/map-styles";
import type { StyleOverrides, ColorOverrides } from "../lib/map-styles";
import { sortLegendEntries, extractTag } from "../lib/legend-sort";
import type { LegendSortMode } from "../lib/legend-sort";

interface Props {
  config: MapChartConfig;
  mapStyle: MapStyle;
  styleOverrides: StyleOverrides;
  colorOverrides: ColorOverrides;
  onColorChange: (originalHex: string, newHex: string) => void;
  onCountryClick: (tag: string) => void;
}

export const MapLegend = ({ config, mapStyle, styleOverrides, colorOverrides, onColorChange, onCountryClick }: Props) => {
  const [sortMode, setSortMode] = useState<LegendSortMode>("alpha");
  const rawEntries = Object.entries(config.groups);

  if (rawEntries.length === 0) {
    return null;
  }

  const style = getStyleConfig(mapStyle, styleOverrides);

  const legendEntries = sortLegendEntries(
    rawEntries.map(([hex, group]) => ({ hex, group })),
    sortMode,
  );

  return (
    <div
      className={`map-legend map-legend-${mapStyle}`}
      style={{
        backgroundColor: style.legendBg,
        borderColor: style.legendBorder,
      }}
    >
      <div className="map-legend-header" style={{ borderBottomColor: style.legendBorder }}>
        <h3
          className="map-legend-title"
          style={{ color: style.titleColor }}
        >
          {config.title || "Legend"}
        </h3>
        <div className="map-legend-sort">
          <button
            className={`legend-sort-btn ${sortMode === "alpha" ? "active" : ""}`}
            onClick={() => setSortMode("alpha")}
            title="Sort alphabetically"
          >
            A-Z
          </button>
          <button
            className={`legend-sort-btn ${sortMode === "locations" ? "active" : ""}`}
            onClick={() => setSortMode("locations")}
            title="Sort by direct location count"
          >
            #
          </button>
          <button
            className={`legend-sort-btn ${sortMode === "total" ? "active" : ""}`}
            onClick={() => setSortMode("total")}
            title="Sort by total locations (direct + subjects)"
          >
            ##
          </button>
        </div>
      </div>
      <div className="map-legend-entries">
        {legendEntries.map(({ hex: originalHex, group }) => {
          const displayHex = colorOverrides[originalHex] ?? originalHex;
          const tag = extractTag(group.label);
          return (
            <div key={originalHex} className="map-legend-entry">
              <label className="map-legend-swatch-label">
                <input
                  type="color"
                  value={displayHex}
                  onChange={(e) => onColorChange(originalHex, e.target.value)}
                  className="map-legend-color-input"
                />
                <span
                  className="map-legend-swatch"
                  style={{ backgroundColor: displayHex, borderColor: style.legendBorder }}
                />
              </label>
              <span
                className="map-legend-label map-legend-clickable"
                style={{ color: style.labelColor }}
                onClick={() => onCountryClick(tag)}
              >
                {group.label}
              </span>
              <span className="map-legend-count">{group.paths.length}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
