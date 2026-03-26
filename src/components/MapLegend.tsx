import type { MapChartConfig, MapStyle } from "../lib/types";
import { getStyleConfig } from "../lib/map-styles";
import type { StyleOverrides, ColorOverrides } from "../lib/map-styles";

interface Props {
  config: MapChartConfig;
  mapStyle: MapStyle;
  styleOverrides: StyleOverrides;
  colorOverrides: ColorOverrides;
  onColorChange: (originalHex: string, newHex: string) => void;
}

export const MapLegend = ({ config, mapStyle, styleOverrides, colorOverrides, onColorChange }: Props) => {
  const entries = Object.entries(config.groups);

  if (entries.length === 0) {
    return null;
  }

  const style = getStyleConfig(mapStyle, styleOverrides);

  return (
    <div
      className={`map-legend map-legend-${mapStyle}`}
      style={{
        backgroundColor: style.legendBg,
        borderColor: style.legendBorder,
      }}
    >
      <h3
        className="map-legend-title"
        style={{ color: style.titleColor, borderBottomColor: style.legendBorder }}
      >
        {config.title || "Legend"}
      </h3>
      <div className="map-legend-entries">
        {entries.map(([originalHex, group]) => {
          const displayHex = colorOverrides[originalHex] ?? originalHex;
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
              <span className="map-legend-label" style={{ color: style.labelColor }}>
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
