import { useState, useCallback, useRef } from "react";
import { parseMeltedSave } from "./lib/save-parser";
import { parseBinarySave } from "./lib/binary";
import { exportMapChartConfig } from "./lib/export";
import { buildLocationToProvince } from "./lib/province-mapping";
import { isBinarySave, downloadConfig } from "./lib/save-utils";
import {
  getStyleConfig,
  getBaseStyleConfig,
  getMapDimensions,
  computeDownloadLayout,
  hasCustomOverrides,
  EDITABLE_COLOR_KEYS,
  STYLE_FIELD_LABELS,
  MAP_STYLE_OPTIONS,
} from "./lib/map-styles";
import type { StyleOverrides } from "./lib/map-styles";
import provinceMapping from "./lib/mapchart_province_mapping.json";
import type { ParsedSave, MapChartConfig, MapStyle } from "./lib/types";
import { DropZone } from "./components/DropZone";
import { CountryGroups } from "./components/CountryGroups";
import { DebugPanel } from "./components/DebugPanel";
import { MapRenderer } from "./components/MapRenderer";
import { MapLegend } from "./components/MapLegend";
import { CountryModal } from "./components/CountryModal";
import { buildCountryInfo } from "./lib/country-info";
import type { CountryInfo } from "./lib/country-info";
import { Stat } from "./components/Stat";
import { buildRankingEntries, sortRankings, filterPlayersOnly, isGreatPower } from "./lib/ranking-sort";
import type { RankingSortMode } from "./lib/ranking-sort";
import "./App.css";

export type Status = "idle" | "reading" | "parsing" | "done" | "error";
export type AppTab = "map" | "economy" | "trade" | "military" | "wars" | "rankings";

export const SHOW_DEBUG = import.meta.env.DEV;

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
  const [mapStyle, setMapStyle] = useState<MapStyle>("parchment");
  const [styleOverrides, setStyleOverrides] = useState<StyleOverrides>({});
  const [colorOverrides, setColorOverrides] = useState<Record<string, string>>({});
  const [debug, setDebug] = useState<DebugData | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<AppTab>("map");
  const [rankSort, setRankSort] = useState<RankingSortMode>("rank");
  const [rankPlayersOnly, setRankPlayersOnly] = useState(false);
  const [rankHighlightGP, setRankHighlightGP] = useState(true);
  const mapLayoutRef = useRef<HTMLDivElement>(null);

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

  const handleDownloadConfig = useCallback(() => {
    if (debug) downloadConfig(debug.config);
  }, [debug]);

  const handleCountryClick = useCallback((tag: string) => {
    if (!debug) return;
    const config = debug.config;
    // Find province count for this tag
    const group = Object.values(config.groups).find((g) => g.label.startsWith(tag));
    const provinceCount = group?.paths.length ?? 0;
    const info = buildCountryInfo(tag, debug.parsed, provinceCount);
    setSelectedCountry(info);
  }, [debug]);

  const handleColorChange = useCallback((originalHex: string, newHex: string) => {
    setColorOverrides((prev) => ({ ...prev, [originalHex]: newHex }));
  }, []);

  const handleReset = useCallback(() => {
    setColorOverrides({});
    setDebug(null);
    setStatus("idle");
    setError(null);
  }, []);

  const handleStyleChange = useCallback((newStyle: MapStyle) => {
    setMapStyle(newStyle);
    setStyleOverrides({});
  }, []);

  const handleOverrideChange = useCallback((key: keyof StyleOverrides, value: string) => {
    setStyleOverrides((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleDownloadMap = useCallback(async () => {
    const layoutEl = mapLayoutRef.current;
    if (!layoutEl) return;

    const mapSvg = layoutEl.querySelector(".map-svg") as SVGSVGElement | null;
    const hasLegend = layoutEl.querySelector(".map-legend") !== null;
    if (!mapSvg) return;

    const dims = getMapDimensions(mapSvg.getAttribute("viewBox") ?? undefined);
    const dl = computeDownloadLayout(dims, hasLegend, 2);
    const style = getStyleConfig(mapStyle, styleOverrides);

    const canvas = document.createElement("canvas");
    canvas.width = dl.canvasWidth;
    canvas.height = dl.canvasHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = style.bgColor;
    ctx.fillRect(0, 0, dl.canvasWidth, dl.canvasHeight);

    const svgClone = mapSvg.cloneNode(true) as SVGSVGElement;
    svgClone.setAttribute("width", String(dl.mapWidth));
    svgClone.setAttribute("height", String(dl.mapHeight));
    const svgBlob = new Blob([new XMLSerializer().serializeToString(svgClone)], { type: "image/svg+xml" });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, dl.mapWidth * dl.scale, dl.mapHeight * dl.scale);
      URL.revokeObjectURL(svgUrl);

      if (dl.hasLegend && debug) {
        ctx.fillStyle = style.legendBg;
        ctx.fillRect(dl.legendX, dl.legendY, dl.legendWidth, dl.legendHeight);
        ctx.strokeStyle = style.legendBorder;
        ctx.lineWidth = 2;
        ctx.strokeRect(dl.legendX, dl.legendY, dl.legendWidth, dl.legendHeight);

        ctx.fillStyle = style.titleColor;
        ctx.font = `bold ${14 * dl.scale}px Cinzel, Georgia, serif`;
        ctx.fillText(debug.config.title || "Legend", dl.legendX + 12 * dl.scale, dl.legendY + 22 * dl.scale);

        ctx.strokeStyle = style.legendBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(dl.legendX + 10 * dl.scale, dl.legendY + 28 * dl.scale);
        ctx.lineTo(dl.legendX + dl.legendWidth - 10 * dl.scale, dl.legendY + 28 * dl.scale);
        ctx.stroke();

        const entries = Object.entries(debug.config.groups);
        let ey = dl.legendY + 38 * dl.scale;
        const rowH = 11 * dl.scale;
        for (const [hex, group] of entries) {
          if (ey + rowH > dl.canvasHeight - 40) break;
          ctx.fillStyle = hex;
          ctx.fillRect(dl.legendX + 10 * dl.scale, ey, 8 * dl.scale, 8 * dl.scale);
          ctx.strokeStyle = style.legendBorder;
          ctx.lineWidth = 1;
          ctx.strokeRect(dl.legendX + 10 * dl.scale, ey, 8 * dl.scale, 8 * dl.scale);
          ctx.fillStyle = style.labelColor;
          ctx.font = `${7 * dl.scale}px Crimson Pro, Georgia, serif`;
          ctx.fillText(group.label, dl.legendX + 22 * dl.scale, ey + 7 * dl.scale);
          ctx.fillStyle = style.countColor;
          ctx.font = `${6 * dl.scale}px monospace`;
          ctx.fillText(String(group.paths.length), dl.legendX + dl.legendWidth - 20 * dl.scale, ey + 7 * dl.scale);
          ey += rowH;
        }
      }

      const link = document.createElement("a");
      link.download = "eu5_map.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = svgUrl;
  }, [mapStyle, styleOverrides, debug]);

  const isLoading = status === "reading" || status === "parsing";
  const isCustom = hasCustomOverrides(getBaseStyleConfig(mapStyle), styleOverrides);
  const provinceCount = debug
    ? Object.values(debug.config.groups).reduce((n, g) => n + g.paths.length, 0)
    : 0;

  return (
    <div className={status === "done" ? "app app-wide" : "app"}>
      <header className="app-header">
        <div className="header-row">
          <h1>EU5 Map Maker</h1>
          <div className="header-links">
            <a
              href="https://www.buymeacoffee.com/masoncstevg"
              target="_blank"
              rel="noopener noreferrer"
              className="bmc-link"
            >
              <img
                src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
                alt="Buy Me A Coffee"
                className="bmc-img"
              />
            </a>
            <a
              href="https://github.com/masonstevens95/eu5-map-maker"
              target="_blank"
              rel="noopener noreferrer"
              className="github-link"
            >
              <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              GitHub
            </a>
          </div>
        </div>
        {status === "done" && (
          <nav className="app-tabs">
            {(["map", "rankings", "economy", "trade", "military", "wars"] as const).map((tab) => (
              <button
                key={tab}
                className={`app-tab ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="app-main">
        {/* Pre-parse options */}
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

        {/* Post-parse content */}
        {status === "done" && debug && (
          <>
            {activeTab === "map" && (
              <>
                <div className="toolbar">
                  <div className="toolbar-row">
                    <div className="toolbar-stats">
                      <Stat label="Countries" value={String(Object.keys(debug.config.groups).length)} />
                      <Stat label="Provinces" value={String(provinceCount)} />
                      <Stat label="Parse" value={`${(debug.parseTimeMs / 1000).toFixed(1)}s`} />
                    </div>
                    <div className="toolbar-controls">
                      <label className="option">
                        Style:
                        <select
                          value={isCustom ? "__custom" : mapStyle}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val !== "__custom") handleStyleChange(val as MapStyle);
                          }}
                          className="style-select"
                        >
                          {MAP_STYLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                          {isCustom && <option value="__custom" disabled>Custom</option>}
                        </select>
                      </label>
                    </div>
                    <div className="toolbar-actions">
                      <button className="btn primary" onClick={handleDownloadMap}>Download Map</button>
                      <button className="btn secondary" onClick={handleDownloadConfig}>Download Config</button>
                      <button className="btn secondary" onClick={handleReset}>New File</button>
                    </div>
                  </div>

                  <div className="toolbar-style-row">
                    {EDITABLE_COLOR_KEYS.map((key) => {
                      const base = getBaseStyleConfig(mapStyle);
                      const current = (styleOverrides[key] ?? base[key]) as string;
                      return (
                        <label key={key} className="style-field">
                          <span className="style-field-label">{STYLE_FIELD_LABELS[key]}</span>
                          <input
                            type="color"
                            value={current}
                            onChange={(e) => handleOverrideChange(key, e.target.value)}
                            className="style-color-input"
                          />
                        </label>
                      );
                    })}
                    <label className="style-field">
                      <span className="style-field-label">{STYLE_FIELD_LABELS.outlineWidth}</span>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={styleOverrides.outlineWidth ?? getBaseStyleConfig(mapStyle).outlineWidth}
                        onChange={(e) => handleOverrideChange("outlineWidth", e.target.value)}
                        className="style-range-input"
                      />
                    </label>
                  </div>
                </div>

                <div className="map-layout" ref={mapLayoutRef}>
                  <div className="map-panel">
                    <MapRenderer
                      config={debug.config}
                      mapStyle={mapStyle}
                      styleOverrides={styleOverrides}
                      colorOverrides={colorOverrides}
                      onProvinceClick={handleCountryClick}
                    />
                  </div>
                  <div className="legend-panel">
                    <MapLegend
                      config={debug.config}
                      mapStyle={mapStyle}
                      styleOverrides={styleOverrides}
                      colorOverrides={colorOverrides}
                      onColorChange={handleColorChange}
                      onCountryClick={handleCountryClick}
                    />
                  </div>
                </div>

                {SHOW_DEBUG && (
                  <div className="details-section">
                    <CountryGroups groups={debug.config.groups} />
                    <DebugPanel
                      parsed={debug.parsed}
                      locToProvince={debug.locToProvince}
                      config={debug.config}
                      provinceMapping={provinceMapping}
                    />
                  </div>
                )}
              </>
            )}

            {activeTab === "economy" && (
              <div className="tab-placeholder">
                <h2>Economy</h2>
                <p>Country economy rankings and comparison — coming soon</p>
              </div>
            )}

            {activeTab === "trade" && (
              <div className="tab-placeholder">
                <h2>Trade</h2>
                <p>Trade routes and values — coming soon</p>
              </div>
            )}

            {activeTab === "military" && (
              <div className="tab-placeholder">
                <h2>Military</h2>
                <p>Army and navy statistics — coming soon</p>
              </div>
            )}

            {activeTab === "wars" && (
              <div className="tab-placeholder">
                <h2>Wars</h2>
                <p>Active and past wars — coming soon</p>
              </div>
            )}

            {activeTab === "rankings" && (() => {
              const allEntries = buildRankingEntries(
                debug.parsed.countryStats,
                debug.parsed.countryNames,
                debug.parsed.tagToPlayers,
                debug.parsed.countryColors,
              );
              const filtered = filterPlayersOnly(allEntries, rankPlayersOnly);
              const sorted = sortRankings(filtered, rankSort);
              const fmtN = (n: number): string =>
                n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M"
                : n >= 1_000 ? (n / 1_000).toFixed(1) + "K"
                : n > 0 ? n.toFixed(0) : "—";

              return (
                <div className="rankings-tab">
                  <div className="rankings-controls">
                    <label className="option">
                      Sort:
                      <select value={rankSort} onChange={(e) => setRankSort(e.target.value as RankingSortMode)} className="style-select">
                        <option value="rank">Rank</option>
                        <option value="country">Country Name</option>
                        <option value="player">Player Name</option>
                        <option value="population">Population</option>
                        <option value="income">Income</option>
                      </select>
                    </label>
                    <label className="option">
                      <input type="checkbox" checked={rankPlayersOnly} onChange={(e) => setRankPlayersOnly(e.target.checked)} />
                      Players only
                    </label>
                    <label className="option">
                      <input type="checkbox" checked={rankHighlightGP} onChange={(e) => setRankHighlightGP(e.target.checked)} />
                      Highlight Great Powers
                    </label>
                  </div>
                  <div className="rankings-grid">
                    {sorted.map((entry, i) => (
                      <div
                        key={entry.tag}
                        className={`ranking-row${entry.players.length > 0 ? " ranking-player" : ""}${rankHighlightGP && isGreatPower(entry.stats.score) ? " ranking-gp" : ""}`}
                        style={{ borderLeftColor: entry.color }}
                        onClick={() => handleCountryClick(entry.tag)}
                      >
                        <span className="ranking-pos">{i + 1}</span>
                        <div className="ranking-info">
                          <span className="ranking-name">{entry.name}</span>
                          {entry.players.length > 0 ? (
                            <span className="ranking-player-name">{entry.players.join(", ")}</span>
                          ) : (
                            <span className="ranking-ai">AI</span>
                          )}
                        </div>
                        <div className="ranking-stats">
                          <div className="ranking-stat">
                            <span className="ranking-stat-val">{entry.stats.score > 0 ? `#${entry.stats.score}` : "—"}</span>
                            <span className="ranking-stat-lbl">Rank</span>
                          </div>
                          <div className="ranking-stat">
                            <span className="ranking-stat-val">{fmtN(entry.stats.population)}</span>
                            <span className="ranking-stat-lbl">Pop</span>
                          </div>
                          <div className="ranking-stat">
                            <span className="ranking-stat-val">{fmtN(entry.stats.monthlyIncome)}</span>
                            <span className="ranking-stat-lbl">Income</span>
                          </div>
                          <div className="ranking-stat">
                            <span className="ranking-stat-val">{fmtN(entry.stats.maxManpower)}</span>
                            <span className="ranking-stat-lbl">Manpower</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
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
