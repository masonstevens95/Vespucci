import type { MapChartConfig, MapStyle } from "../lib/types";
import { getStyleConfig } from "../lib/map-styles";
import type { StyleOverrides } from "../lib/map-styles";

interface Props {
  config: MapChartConfig;
  mapStyle: MapStyle;
  styleOverrides: StyleOverrides;
}

export const MapLegend = ({ config, mapStyle, styleOverrides }: Props) => {
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
        {entries.map(([hex, group]) => (
          <div key={hex} className="map-legend-entry">
            <span
              className="map-legend-swatch"
              style={{ backgroundColor: hex, borderColor: style.legendBorder }}
            />
            <span className="map-legend-label" style={{ color: style.labelColor }}>
              {group.label}
            </span>
            <span className="map-legend-count">{group.paths.length}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
