import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MapLegend } from "../MapLegend";
import type { MapChartConfig } from "../../lib/types";

const baseConfig: MapChartConfig = {
  groups: {},
  title: "",
  hidden: [],
  background: "#ffffff",
  borders: "#000",
  legendFont: "Helvetica",
  legendFontColor: "#000",
  legendBorderColor: "#00000000",
  legendBgColor: "#00000000",
  legendWidth: 150,
  legendBoxShape: "square",
  legendTitleMode: "attached",
  areBordersShown: true,
  defaultColor: "#d1dbdd",
  labelsColor: "#6a0707",
  labelsFont: "Arial",
  strokeWidth: "medium",
  areLabelsShown: false,
  uncoloredScriptColor: "#ffff33",
  zoomLevel: "1.00",
  zoomX: "0.00",
  zoomY: "0.00",
  v6: true,
  mapTitleScale: 1,
  page: "eu-v-provinces",
  mapVersion: null,
  legendPosition: "bottom_left",
  legendSize: "medium",
  legendTranslateX: "0.00",
  legendStatus: "show",
  scalingPatterns: true,
  legendRowsSameColor: true,
  legendColumnCount: 1,
};

describe("MapLegend", () => {
  it("renders nothing for empty groups", () => {
    const { container } = render(<MapLegend config={baseConfig} mapStyle="parchment" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders title from config", () => {
    const config = {
      ...baseConfig,
      title: "EU5 MP - 1610",
      groups: { "#ff0000": { label: "ENG", paths: ["London"] } },
    };
    render(<MapLegend config={config} mapStyle="parchment" />);
    expect(screen.getByText("EU5 MP - 1610")).toBeInTheDocument();
  });

  it("falls back to 'Legend' when title is empty", () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["London"] } },
    };
    render(<MapLegend config={config} mapStyle="parchment" />);
    expect(screen.getByText("Legend")).toBeInTheDocument();
  });

  it("renders an entry for each group", () => {
    const config = {
      ...baseConfig,
      groups: {
        "#ff0000": { label: "ENG - Alice", paths: ["London", "York"] },
        "#0000ff": { label: "FRA - Bob", paths: ["Paris"] },
      },
    };
    const { container } = render(<MapLegend config={config} mapStyle="parchment" />);
    const entries = container.querySelectorAll(".map-legend-entry");
    expect(entries).toHaveLength(2);
  });

  it("renders color swatches with correct background", () => {
    const config = {
      ...baseConfig,
      groups: {
        "#ff0000": { label: "ENG", paths: ["London"] },
        "#00ff00": { label: "FRA", paths: ["Paris"] },
      },
    };
    const { container } = render(<MapLegend config={config} mapStyle="parchment" />);
    const swatches = container.querySelectorAll(".map-legend-swatch");
    const colors = Array.from(swatches).map(
      (s) => (s as HTMLElement).style.backgroundColor,
    );
    expect(colors).toContain("rgb(255, 0, 0)");
    expect(colors).toContain("rgb(0, 255, 0)");
  });

  it("renders labels", () => {
    const config = {
      ...baseConfig,
      groups: {
        "#ff0000": { label: "ENG - Alice", paths: ["London"] },
      },
    };
    const { container } = render(<MapLegend config={config} mapStyle="parchment" />);
    const labels = container.querySelectorAll(".map-legend-label");
    const texts = Array.from(labels).map((l) => l.textContent);
    expect(texts).toContain("ENG - Alice");
  });

  it("renders province counts", () => {
    const config = {
      ...baseConfig,
      groups: {
        "#ff0000": { label: "ENG", paths: ["London", "York", "Bath"] },
      },
    };
    const { container } = render(<MapLegend config={config} mapStyle="parchment" />);
    const count = container.querySelector(".map-legend-count");
    expect(count?.textContent).toBe("3");
  });

  it("applies parchment style class", () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["London"] } },
    };
    const { container } = render(<MapLegend config={config} mapStyle="parchment" />);
    expect(container.querySelector(".map-legend-parchment")).toBeInTheDocument();
  });

  it("applies modern style class", () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["London"] } },
    };
    const { container } = render(<MapLegend config={config} mapStyle="modern" />);
    expect(container.querySelector(".map-legend-modern")).toBeInTheDocument();
  });
});
