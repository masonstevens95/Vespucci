import type { MapChartConfig } from "../lib/types";
import { Stat } from "./Stat";

interface ResultsSummaryProps {
  config: MapChartConfig;
  fileSizeMb: number;
  parseTimeMs: number;
  onDownload: () => void;
  onReset: () => void;
}

export function ResultsSummary({
  config,
  fileSizeMb,
  parseTimeMs,
  onDownload,
  onReset,
}: ResultsSummaryProps) {
  const locationCount = Object.values(config.groups).reduce(
    (n, g) => n + g.paths.length,
    0,
  );

  return (
    <div className="results-summary">
      <h2>Results</h2>
      <div className="stats">
        <Stat label="File" value={`${fileSizeMb.toFixed(0)} MB`} />
        <Stat label="Parse time" value={`${(parseTimeMs / 1000).toFixed(1)}s`} />
        <Stat label="Countries" value={String(Object.keys(config.groups).length)} />
        <Stat label="Locations" value={String(locationCount)} />
      </div>
      <div className="actions">
        <button className="btn primary" onClick={onDownload}>
          Download mapchart_config.txt
        </button>
        <button className="btn secondary" onClick={onReset}>
          Upload another file
        </button>
      </div>
    </div>
  );
}
