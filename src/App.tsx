import { useState, useCallback } from "react";
import { parseMeltedSave } from "./lib/save-parser";
import { parseBinarySave } from "./lib/binary";
import { exportMapChartConfig } from "./lib/export";
import { buildLocationToProvince } from "./lib/province-mapping";
import { isBinarySave, downloadConfig } from "./lib/save-utils";
import provinceMapping from "./lib/mapchart_province_mapping.json";
import type { ParsedSave, MapChartConfig } from "./lib/types";
import { OptionsBar } from "./components/OptionsBar";
import { DropZone } from "./components/DropZone";
import { ResultsSummary } from "./components/ResultsSummary";
import { CountryGroups } from "./components/CountryGroups";
import { DebugPanel } from "./components/DebugPanel";
import { MapRenderer } from "./components/MapRenderer";
import { MapLegend } from "./components/MapLegend";
import "./App.css";

export type Status = "idle" | "reading" | "parsing" | "done" | "error";

export interface DebugData {
  parsed: ParsedSave;
  locToProvince: Record<string, string>;
  config: MapChartConfig;
  parseTimeMs: number;
  fileSizeMb: number;
}

export default function App() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [playersOnly, setPlayersOnly] = useState(true);
  const [title, setTitle] = useState("EU5 Map");
  const [debug, setDebug] = useState<DebugData | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setStatus("reading");

      try {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const sizeMb = bytes.length / 1024 / 1024;

        setStatus("parsing");
        await new Promise((r) => setTimeout(r, 0));

        const t0 = performance.now();

        // Parse binary or text save
        const parsed = isBinarySave(bytes)
          ? parseBinarySave(bytes)
          : parseMeltedSave(new TextDecoder().decode(bytes));

        const locToProvince = buildLocationToProvince(provinceMapping);
        const config = exportMapChartConfig(parsed, provinceMapping, {
          playersOnly,
          title,
        });
        const parseTimeMs = performance.now() - t0;

        setDebug({ parsed, locToProvince, config, parseTimeMs, fileSizeMb: sizeMb });
        setStatus("done");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    },
    [playersOnly, title],
  );

  const handleDownload = useCallback(() => {
    if (debug) downloadConfig(debug.config);
  }, [debug]);

  const handleReset = useCallback(() => {
    setDebug(null);
    setStatus("idle");
    setError(null);
  }, []);

  const isLoading = status === "reading" || status === "parsing";

  return (
    <div className={status === "done" ? "app app-wide" : "app"}>
      <header className="app-header">
        <h1>EU5 Map Maker</h1>
        <p className="subtitle">
          Upload an EU5 save file to generate a MapChart config
        </p>
      </header>

      <main className="app-main">
        <OptionsBar
          playersOnly={playersOnly}
          onPlayersOnlyChange={setPlayersOnly}
          title={title}
          onTitleChange={setTitle}
          disabled={isLoading}
        />

        {status !== "done" && (
          <DropZone
            loading={isLoading}
            loadingMessage={status === "reading" ? "Reading file..." : "Parsing save data..."}
            onFile={handleFile}
          />
        )}

        {error && (
          <div className="error-box">
            <pre>{error}</pre>
          </div>
        )}

        {status === "done" && debug && (
          <>
            <div className="results-bar">
              <ResultsSummary
                config={debug.config}
                fileSizeMb={debug.fileSizeMb}
                parseTimeMs={debug.parseTimeMs}
                onDownload={handleDownload}
                onReset={handleReset}
              />
            </div>
            <div className="map-layout">
              <div className="map-panel">
                <MapRenderer config={debug.config} />
              </div>
              <div className="legend-panel">
                <MapLegend config={debug.config} />
              </div>
            </div>
            <div className="details-section">
              <CountryGroups groups={debug.config.groups} />
              <DebugPanel
                parsed={debug.parsed}
                locToProvince={debug.locToProvince}
                config={debug.config}
                provinceMapping={provinceMapping}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
