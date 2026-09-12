import type { ParsedSave, MapChartConfig } from "../lib/types";
import { Accordion } from "./Accordion";
import { resolveCountryLocations } from "../lib/location-resolve";

interface DebugPanelProps {
  parsed: ParsedSave;
  config: MapChartConfig;
}

export function DebugPanel({ parsed, config }: DebugPanelProps) {
  const resolution = resolveCountryLocations(parsed.countryLocations);
  const painted = Object.values(config.groups).reduce((n, g) => n + g.paths.length, 0);
  return (
    <div className="debug-section">
      <h3>Debug Data</h3>

      <Accordion title={`Location Ownership (${Object.keys(parsed.countryLocations).length} countries)`}>
        <div className="debug-scroll">
          {Object.entries(parsed.countryLocations)
            .sort((a, b) => b[1].length - a[1].length)
            .map(([tag, locs]) => (
              <div key={tag} className="debug-entry">
                <strong>{tag}</strong>: {locs.length} locations
                <div className="debug-detail">
                  {locs.slice(0, 20).join(", ")}
                  {locs.length > 20 && ` ... +${locs.length - 20} more`}
                </div>
              </div>
            ))}
        </div>
      </Accordion>

      <Accordion title={`Country Colors (${Object.keys(parsed.countryColors).length})`}>
        <div className="debug-scroll color-grid">
          {Object.entries(parsed.countryColors)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([tag, [r, g, b]]) => (
              <div key={tag} className="color-entry">
                <div className="color-swatch-small" style={{ backgroundColor: `rgb(${r},${g},${b})` }} />
                <span>{tag}</span>
                <span className="color-hex">
                  #{r.toString(16).padStart(2, "0")}
                  {g.toString(16).padStart(2, "0")}
                  {b.toString(16).padStart(2, "0")}
                </span>
              </div>
            ))}
        </div>
      </Accordion>

      <Accordion title={`Players (${Object.keys(parsed.tagToPlayers).length} countries)`}>
        <div className="debug-scroll">
          {Object.entries(parsed.tagToPlayers)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([tag, players]) => (
              <div key={tag} className="debug-entry">
                <strong>{tag}</strong>: {players.join(", ")}
              </div>
            ))}
        </div>
      </Accordion>

      <Accordion title={`Vassal Relationships (${Object.values(parsed.overlordSubjects).reduce((n, s) => n + s.size, 0)} subjects)`}>
        <div className="debug-scroll">
          {Object.entries(parsed.overlordSubjects)
            .sort((a, b) => b[1].size - a[1].size)
            .map(([overlord, subjects]) => (
              <div key={overlord} className="debug-entry">
                <strong>{overlord}</strong> ({subjects.size} subjects):{" "}
                {[...subjects].sort().join(", ")}
              </div>
            ))}
        </div>
      </Accordion>

      <Accordion title={`Location Resolution (${painted} painted)`}>
        <div className="debug-scroll">
          <p className="debug-hint">
            {painted} canonical path IDs in config groups.{" "}
            {resolution.droppedCount === 0
              ? "Every owned location resolved to a shape."
              : `${resolution.droppedCount} owned location name(s) matched no shape.`}
          </p>
          {resolution.droppedCount > 0 && (
            <div className="debug-entry">
              <strong>Unresolved sample</strong>: {resolution.droppedSample.join(", ")}
              <div className="debug-detail">
                Run scripts/check-location-coverage.mjs to measure name alignment.
              </div>
            </div>
          )}
        </div>
      </Accordion>

      <Accordion title="Raw Config JSON">
        <div className="debug-scroll">
          <pre className="json-pre">
            {JSON.stringify(config, null, 2).slice(0, 5000)}
            {JSON.stringify(config, null, 2).length > 5000 && "\n... (truncated)"}
          </pre>
        </div>
      </Accordion>
    </div>
  );
}
