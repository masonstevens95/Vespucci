import { useState, useCallback } from "react";
import { parseMeltedSave } from "./lib/save-parser";
import { parseBinarySave } from "./lib/binary";
import { exportMapChartConfig } from "./lib/export";
import { buildLocationToProvince } from "./lib/province-mapping";
import { isBinarySave } from "./lib/save-utils";
import provinceMapping from "./lib/mapchart_province_mapping.json";
import type { ParsedSave, MapChartConfig } from "./lib/types";
import { DropZone } from "./components/DropZone";
import { CountryGroups } from "./components/CountryGroups";
import { DebugPanel } from "./components/DebugPanel";
import { CountryModal } from "./components/CountryModal";
import { AppHeader } from "./components/AppHeader";
import { MapTab, SHOW_DEBUG } from "./components/MapTab";
import { RankingsTab } from "./components/RankingsTab";
import { PlaceholderTab } from "./components/PlaceholderTab";
import { MilitaryTab } from "./components/MilitaryTab";
import { buildCountryInfo } from "./lib/country-info";
import type { CountryInfo } from "./lib/country-info";
import { findTagProvinceCount } from "./lib/format";
import "./App.css";

export type Status = "idle" | "reading" | "parsing" | "done" | "error";
export type AppTab = "map" | "rankings" | "economy" | "trade" | "military" | "wars";

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
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<AppTab>("map");

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

  const handleCountryClick = useCallback((tag: string) => {
    if (!debug) return;
    const count = findTagProvinceCount(tag, debug.config.groups);
    const info = buildCountryInfo(tag, debug.parsed, count);
    setSelectedCountry(info);
  }, [debug]);

  const handleReset = useCallback(() => {
    setDebug(null);
    setStatus("idle");
    setError(null);
  }, []);

  const isLoading = status === "reading" || status === "parsing";

  return (
    <div className={status === "done" ? "app app-wide" : "app"}>
      <AppHeader
        showTabs={status === "done"}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <main className="app-main">
        {status !== "done" && (
          <div className="options-bar">
            <label className="option">
              <input
                type="checkbox"
                checked={playersOnly}
                onChange={(e) => setPlayersOnly(e.target.checked)}
                disabled={isLoading}
              />
              Players only
            </label>
            <label className="option">
              Title:
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isLoading}
                className="title-input"
              />
            </label>
          </div>
        )}

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
            {activeTab === "map" && (
              <MapTab
                config={debug.config}
                parseTimeMs={debug.parseTimeMs}
                onCountryClick={handleCountryClick}
                onReset={handleReset}
                debugContent={SHOW_DEBUG ? (
                  <div className="details-section">
                    <CountryGroups groups={debug.config.groups} />
                    <DebugPanel
                      parsed={debug.parsed}
                      locToProvince={debug.locToProvince}
                      config={debug.config}
                      provinceMapping={provinceMapping}
                    />
                  </div>
                ) : undefined}
              />
            )}

            {activeTab === "rankings" && (
              <RankingsTab parsed={debug.parsed} onCountryClick={handleCountryClick} />
            )}

            {activeTab === "economy" && (
              <PlaceholderTab title="Economy" description="Country economy rankings and comparison — coming soon" />
            )}

            {activeTab === "trade" && (
              <PlaceholderTab title="Trade" description="Trade routes and values — coming soon" />
            )}

            {activeTab === "military" && (
              <MilitaryTab parsed={debug.parsed} onCountryClick={handleCountryClick} />
            )}

            {activeTab === "wars" && (
              <PlaceholderTab title="Wars" description="Active and past wars — coming soon" />
            )}
          </>
        )}

        {selectedCountry !== undefined && debug && (
          <CountryModal
            info={selectedCountry}
            countryNames={debug.parsed.countryNames}
            onClose={() => setSelectedCountry(undefined)}
          />
        )}
      </main>
    </div>
  );
}
