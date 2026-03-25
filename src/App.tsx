import { useState, useCallback } from "react";
import { parseMeltedSave } from "./lib/save-parser";
import { exportMapChartConfig } from "./lib/export";
import { buildLocationToProvince } from "./lib/province-mapping";
import provinceMapping from "./lib/mapchart_province_mapping.json";
import type { ParsedSave, MapChartConfig } from "./lib/types";
import "./App.css";

type Status = "idle" | "reading" | "parsing" | "done" | "error";

interface DebugData {
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
        const text = await file.text();
        const sizeMb = text.length / 1024 / 1024;

        // Quick validation: melted saves start with "SAV0200" (text mode header)
        const firstLine = text.split("\n")[0];
        if (firstLine.startsWith("SAV") && firstLine[4] !== "0") {
          setError(
            "This looks like a binary .eu5 save. Please melt it first with:\n" +
            "rakaly melt --format eu5 -u stringify -o melted.txt your_save.eu5\n\n" +
            "Then upload the melted .txt file.",
          );
          setStatus("error");
          return;
        }

        setStatus("parsing");

        // Parse in a microtask to let the UI update
        await new Promise((r) => setTimeout(r, 0));

        const t0 = performance.now();
        const parsed = parseMeltedSave(text);
        const locToProvince = buildLocationToProvince(provinceMapping);
        const config = exportMapChartConfig(text, provinceMapping, {
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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDownload = useCallback(() => {
    if (!debug) return;
    const blob = new Blob([JSON.stringify(debug.config)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mapchart_config.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [debug]);

  const handleReparse = useCallback(() => {
    setDebug(null);
    setStatus("idle");
    setError(null);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>EU5 Map Maker</h1>
        <p className="subtitle">
          Upload a melted EU5 save file to generate a MapChart config
        </p>
      </header>

      <main className="app-main">
        {/* Options */}
        <div className="options-bar">
          <label className="option">
            <input
              type="checkbox"
              checked={playersOnly}
              onChange={(e) => setPlayersOnly(e.target.checked)}
              disabled={status === "parsing" || status === "reading"}
            />
            Players only
          </label>
          <label className="option">
            Title:
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={status === "parsing" || status === "reading"}
              className="title-input"
            />
          </label>
        </div>

        {/* Upload zone */}
        {status !== "done" && (
          <div
            className={`drop-zone ${status === "reading" || status === "parsing" ? "loading" : ""}`}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            {status === "idle" || status === "error" ? (
              <>
                <div className="drop-icon">&#128506;</div>
                <p>Drop a melted save file here or click to browse</p>
                <p className="hint">
                  Melt binary saves with: <code>rakaly melt --format eu5 -u stringify -o melted.txt save.eu5</code>
                </p>
                <input
                  type="file"
                  accept=".txt,.eu5"
                  onChange={handleInputChange}
                  className="file-input"
                />
              </>
            ) : (
              <div className="spinner-container">
                <div className="spinner" />
                <p>{status === "reading" ? "Reading file..." : "Parsing save data..."}</p>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="error-box">
            <pre>{error}</pre>
          </div>
        )}

        {/* Results */}
        {status === "done" && debug && (
          <div className="results">
            <div className="results-summary">
              <h2>Results</h2>
              <div className="stats">
                <Stat label="File" value={`${debug.fileSizeMb.toFixed(0)} MB`} />
                <Stat label="Parse time" value={`${(debug.parseTimeMs / 1000).toFixed(1)}s`} />
                <Stat label="Countries" value={String(Object.keys(debug.config.groups).length)} />
                <Stat label="Provinces" value={String(Object.values(debug.config.groups).reduce((n, g) => n + g.paths.length, 0))} />
              </div>

              <div className="actions">
                <button className="btn primary" onClick={handleDownload}>
                  Download mapchart_config.txt
                </button>
                <button className="btn secondary" onClick={handleReparse}>
                  Upload another file
                </button>
              </div>
            </div>

            {/* Country list */}
            <div className="country-list">
              <h3>Country Groups</h3>
              <div className="group-grid">
                {Object.entries(debug.config.groups).map(([hex, group]) => (
                  <div key={hex} className="group-card">
                    <div className="color-swatch" style={{ backgroundColor: hex }} />
                    <div className="group-info">
                      <span className="group-label">{group.label}</span>
                      <span className="group-count">{group.paths.length} provinces</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Debug accordion */}
            <div className="debug-section">
              <h3>Debug Data</h3>

              <Accordion title={`Location Ownership (${Object.keys(debug.parsed.countryLocations).length} countries)`}>
                <div className="debug-scroll">
                  {Object.entries(debug.parsed.countryLocations)
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

              <Accordion title={`Country Colors (${Object.keys(debug.parsed.countryColors).length})`}>
                <div className="debug-scroll color-grid">
                  {Object.entries(debug.parsed.countryColors)
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

              <Accordion title={`Players (${Object.keys(debug.parsed.tagToPlayers).length} countries)`}>
                <div className="debug-scroll">
                  {Object.entries(debug.parsed.tagToPlayers)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([tag, players]) => (
                      <div key={tag} className="debug-entry">
                        <strong>{tag}</strong>: {players.join(", ")}
                      </div>
                    ))}
                </div>
              </Accordion>

              <Accordion title={`Vassal Relationships (${Object.values(debug.parsed.overlordSubjects).reduce((n, s) => n + s.size, 0)} subjects)`}>
                <div className="debug-scroll">
                  {Object.entries(debug.parsed.overlordSubjects)
                    .sort((a, b) => b[1].size - a[1].size)
                    .map(([overlord, subjects]) => (
                      <div key={overlord} className="debug-entry">
                        <strong>{overlord}</strong> ({subjects.size} subjects):{" "}
                        {[...subjects].sort().join(", ")}
                      </div>
                    ))}
                </div>
              </Accordion>

              <Accordion title={`Province Mapping (${Object.keys(provinceMapping).length} provinces)`}>
                <div className="debug-scroll">
                  <p className="debug-hint">
                    {Object.keys(provinceMapping).length} MapChart provinces mapping to{" "}
                    {Object.keys(debug.locToProvince).length} EU5 locations
                  </p>
                  {Object.entries(provinceMapping)
                    .slice(0, 50)
                    .map(([province, locs]) => (
                      <div key={province} className="debug-entry">
                        <strong>{province}</strong>: {(locs as string[]).join(", ")}
                      </div>
                    ))}
                  {Object.keys(provinceMapping).length > 50 && (
                    <p className="debug-hint">... showing first 50 of {Object.keys(provinceMapping).length}</p>
                  )}
                </div>
              </Accordion>

              <Accordion title="Raw Config JSON">
                <div className="debug-scroll">
                  <pre className="json-pre">
                    {JSON.stringify(debug.config, null, 2).slice(0, 5000)}
                    {JSON.stringify(debug.config, null, 2).length > 5000 && "\n... (truncated)"}
                  </pre>
                </div>
              </Accordion>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`accordion ${open ? "open" : ""}`}>
      <button className="accordion-header" onClick={() => setOpen(!open)}>
        <span className="accordion-arrow">{open ? "\u25BC" : "\u25B6"}</span>
        {title}
      </button>
      {open && <div className="accordion-body">{children}</div>}
    </div>
  );
}
