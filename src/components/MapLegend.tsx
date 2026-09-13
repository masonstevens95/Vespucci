import { useState } from "react";
import type { MapChartConfig, MapStyle } from "../lib/types";
import { getStyleConfig } from "../lib/map-styles";
import type { StyleOverrides, ColorOverrides } from "../lib/map-styles";
import { sortLegendEntries, extractTag, isSubjectEntry } from "../lib/legend-sort";
import type { LegendSortMode } from "../lib/legend-sort";

/** Darken a hex, matching the renderer's hatch stripe. */
const shadeHex = (hex: string, factor: number): string => {
  const n = parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return hex;
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((c) => Math.max(0, Math.min(255, Math.round(c * factor))));
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
};

interface Props {
  config: MapChartConfig;
  /** Subject tag -> root overlord tag; drives the hatched swatch. */
  subjectOverlords: Readonly<Record<string, string>>;
  mapStyle: MapStyle;
  styleOverrides: StyleOverrides;
  colorOverrides: ColorOverrides;
  onColorChange: (originalHex: string, newHex: string) => void;
  onCountryClick: (tag: string) => void;
}

export const MapLegend = ({ config, subjectOverlords, mapStyle, styleOverrides, colorOverrides, onColorChange, onCountryClick }: Props) => {
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

  // The map paints a subject with its overlord's colour, so the swatch must
  // read from the same source. Striping the row's own hex would make an
  // overlord recolour move the map while leaving the legend behind.
  const overlordHexByTag = new Map<string, string>();
  for (const [hex, group] of rawEntries) {
    if (!isSubjectEntry(group.label)) {
      overlordHexByTag.set(extractTag(group.label), colorOverrides[hex] ?? hex);
    } else {
      /* overlay rows never define a country's own colour */
    }
  }

  /** The overlord colour this row should show, or "" when it is not a subject. */
  const subjectBaseHex = (label: string): string => {
    const tag = extractTag(label);
    const overlordTag = isSubjectEntry(label) ? tag : subjectOverlords[tag] ?? "";
    if (overlordTag === "") {
      return "";
    } else {
      return overlordHexByTag.get(overlordTag) ?? "";
    }
  };

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
          const hatchBase = subjectBaseHex(group.label);
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
                  style={
                    hatchBase !== ""
                      ? {
                          background: `repeating-linear-gradient(45deg, ${hatchBase} 0 3px, ${shadeHex(hatchBase, 0.62)} 3px 5px)`,
                          borderColor: style.legendBorder,
                        }
                      : { backgroundColor: displayHex, borderColor: style.legendBorder }
                  }
                  title={hatchBase !== "" ? "Painted in the overlord's colour" : undefined}
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
