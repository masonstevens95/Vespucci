import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, within, waitFor } from "@testing-library/react";
import { MapTab } from "../MapTab";
import type { MapChartConfig } from "../../lib/types";

const mockSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <path id="Uppland" fill="#d1dbdd" stroke="#000" d="M0,0 L10,10"/>
</svg>`;

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    text: () => Promise.resolve(mockSvg),
  } as Response);
});

const baseConfig: MapChartConfig = {
  groups: { "#ff0000": { label: "ENG", paths: ["Uppland"] } },
  title: "Test Map",
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

describe("MapTab", () => {
  it("renders toolbar with stats", () => {
    const { container } = render(
      <MapTab config={baseConfig} parseTimeMs={500} onCountryClick={() => {}} onReset={() => {}} />,
    );
    expect(container.querySelector(".toolbar")).toBeInTheDocument();
    expect(container.textContent).toContain("Countries");
    expect(container.textContent).toContain("Provinces");
  });

  it("renders style dropdown", () => {
    const { container } = render(
      <MapTab config={baseConfig} parseTimeMs={500} onCountryClick={() => {}} onReset={() => {}} />,
    );
    const select = container.querySelector(".style-select") as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe("parchment");
  });

  it("renders Download Map button", () => {
    const { container } = render(
      <MapTab config={baseConfig} parseTimeMs={500} onCountryClick={() => {}} onReset={() => {}} />,
    );
    const toolbar = container.querySelector(".toolbar")! as HTMLElement;
    expect(within(toolbar).getByText("Download Map")).toBeInTheDocument();
  });

  it("renders Download Config button", () => {
    const { container } = render(
      <MapTab config={baseConfig} parseTimeMs={500} onCountryClick={() => {}} onReset={() => {}} />,
    );
    const toolbar = container.querySelector(".toolbar")! as HTMLElement;
    expect(within(toolbar).getByText("Download Config")).toBeInTheDocument();
  });

  it("renders New File button", () => {
    const { container } = render(
      <MapTab config={baseConfig} parseTimeMs={500} onCountryClick={() => {}} onReset={() => {}} />,
    );
    const toolbar = container.querySelector(".toolbar")! as HTMLElement;
    expect(within(toolbar).getByText("New File")).toBeInTheDocument();
  });

  it("renders map and legend panels", async () => {
    const { container } = render(
      <MapTab config={baseConfig} parseTimeMs={500} onCountryClick={() => {}} onReset={() => {}} />,
    );
    await waitFor(() => {
      expect(container.querySelector(".map-layout")).toBeInTheDocument();
      expect(container.querySelector(".legend-panel")).toBeInTheDocument();
    });
  });

  it("renders debug content when provided", () => {
    const { container } = render(
      <MapTab
        config={baseConfig}
        parseTimeMs={500}
        onCountryClick={() => {}}
        onReset={() => {}}
        debugContent={<div className="test-debug">Debug</div>}
      />,
    );
    expect(container.querySelector(".test-debug")).toBeInTheDocument();
  });

  it("does not render debug content when not provided", () => {
    const { container } = render(
      <MapTab config={baseConfig} parseTimeMs={500} onCountryClick={() => {}} onReset={() => {}} />,
    );
    expect(container.querySelector(".test-debug")).not.toBeInTheDocument();
  });

  it("renders color pickers in style row", () => {
    const { container } = render(
      <MapTab config={baseConfig} parseTimeMs={500} onCountryClick={() => {}} onReset={() => {}} />,
    );
    const colorInputs = container.querySelectorAll(".style-color-input");
    expect(colorInputs.length).toBeGreaterThan(0);
  });
});
