import type { MapChartConfig, MapStyle } from "../lib/types";

interface Props {
  config: MapChartConfig;
  mapStyle: MapStyle;
}

export const MapLegend = ({ config, mapStyle }: Props) => {
  const entries = Object.entries(config.groups);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className={`map-legend map-legend-${mapStyle}`}>
      <h3 className="map-legend-title">{config.title || "Legend"}</h3>
      <div className="map-legend-entries">
        {entries.map(([hex, group]) => (
          <div key={hex} className="map-legend-entry">
            <span
              className="map-legend-swatch"
              style={{ backgroundColor: hex }}
            />
            <span className="map-legend-label">{group.label}</span>
            <span className="map-legend-count">{group.paths.length}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
