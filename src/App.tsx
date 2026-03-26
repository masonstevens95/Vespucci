import { useState, useCallback, useRef } from "react";
import { parseMeltedSave } from "./lib/save-parser";
import { parseBinarySave } from "./lib/binary";
import { exportMapChartConfig } from "./lib/export";
import { buildLocationToProvince } from "./lib/province-mapping";
import { isBinarySave, downloadConfig } from "./lib/save-utils";
import { getStyleConfig, getMapDimensions, computeDownloadLayout } from "./lib/map-styles";
import provinceMapping from "./lib/mapchart_province_mapping.json";
import type { ParsedSave, MapChartConfig, MapStyle } from "./lib/types";
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
  const [mapStyle, setMapStyle] = useState<MapStyle>("parchment");
  const [debug, setDebug] = useState<DebugData | null>(null);
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

  const handleDownload = useCallback(() => {
    if (debug) downloadConfig(debug.config);
  }, [debug]);

  const handleReset = useCallback(() => {
    setDebug(null);
    setStatus("idle");
    setError(null);
  }, []);

  const handleDownloadMap = useCallback(async () => {
    const layoutEl = mapLayoutRef.current;
    if (!layoutEl) return;

    const mapSvg = layoutEl.querySelector(".map-svg") as SVGSVGElement | null;
    const hasLegend = layoutEl.querySelector(".map-legend") !== null;
    if (!mapSvg) return;

    const dims = getMapDimensions(mapSvg.getAttribute("viewBox") ?? undefined);
    const dl = computeDownloadLayout(dims, hasLegend, 2);
    const style = getStyleConfig(mapStyle);

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
  }, [mapStyle, debug]);

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
          mapStyle={mapStyle}
          onMapStyleChange={setMapStyle}
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
            <div className="map-layout" ref={mapLayoutRef}>
              <div className="map-panel">
                <MapRenderer config={debug.config} mapStyle={mapStyle} onDownloadMap={handleDownloadMap} />
              </div>
              <div className="legend-panel">
                <MapLegend config={debug.config} mapStyle={mapStyle} />
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
