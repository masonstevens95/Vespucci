import type { MapChartGroup } from "../lib/types";

interface CountryGroupsProps {
  groups: Record<string, MapChartGroup>;
}

export function CountryGroups({ groups }: CountryGroupsProps) {
  return (
    <div className="country-list">
      <h3>Country Groups</h3>
      <div className="group-grid">
        {Object.entries(groups).sort((a, b) => a[1].label.localeCompare(b[1].label)).map(([hex, group]) => (
          <div key={hex} className="group-card">
            <div className="color-swatch" style={{ backgroundColor: hex }} />
            <div className="group-info">
              <span className="group-label">{group.label}</span>
              <span className="group-count">{group.paths.length} locations</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
