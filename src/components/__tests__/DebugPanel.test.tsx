import { describe, it, expect } from "vitest";
import { render, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { DebugPanel } from "../DebugPanel";
import type { ParsedSave } from "../../lib/types";

const mockParsed: ParsedSave = {
  countryLocations: { ENG: ["london", "york"], FRA: ["paris"] },
  tagToPlayers: { ENG: ["Alice"] },
  countryColors: { ENG: [255, 0, 0], FRA: [0, 0, 255] },
  overlordSubjects: { ENG: new Set(["SCO", "WLS"]) },
  countryNames: {}, countryStats: {}, wars: [], trade: { producedGoods: {}, marketNames: {}, markets: [] },
};

const mockConfig = {
  groups: { "#ff0000": { label: "ENG", paths: ["London"] } },
  title: "", hidden: [] as string[], background: "#ffffff", borders: "#000",
  legendFont: "Helvetica", legendFontColor: "#000",
  legendBorderColor: "#00000000", legendBgColor: "#00000000",
  legendWidth: 150, legendBoxShape: "square", legendTitleMode: "attached",
  areBordersShown: true, defaultColor: "#d1dbdd", labelsColor: "#6a0707",
  labelsFont: "Arial", strokeWidth: "medium", areLabelsShown: false,
  uncoloredScriptColor: "#ffff33", zoomLevel: "1.00", zoomX: "0.00",
  zoomY: "0.00", v6: true, mapTitleScale: 1, page: "eu-v-provinces",
  mapVersion: null, legendPosition: "bottom_left", legendSize: "medium",
  legendTranslateX: "0.00", legendStatus: "show", scalingPatterns: true,
  legendRowsSameColor: true, legendColumnCount: 1,
};

const props = {
  parsed: mockParsed,
  locToProvince: { london: "Middlesex", paris: "Ile_de_France" },
  config: mockConfig,
  provinceMapping: { Middlesex: ["London"], Ile_de_France: ["Paris"] },
};

function renderPanel() {
  const { container } = render(<DebugPanel {...props} />);
  // Get the first rendered instance (strict mode renders twice)
  const root = container.querySelector(".debug-section")!;
  return { root, view: within(root as HTMLElement) };
}

describe("DebugPanel", () => {
  it("renders Debug Data heading", () => {
    const { view } = renderPanel();
    expect(view.getByText("Debug Data")).toBeInTheDocument();
  });

  it("renders all accordion titles", () => {
    const { view } = renderPanel();
    expect(view.getByText(/Location Ownership/)).toBeInTheDocument();
    expect(view.getByText(/Country Colors/)).toBeInTheDocument();
    expect(view.getByText(/Players/)).toBeInTheDocument();
    expect(view.getByText(/Vassal Relationships/)).toBeInTheDocument();
    expect(view.getByText(/Province Mapping/)).toBeInTheDocument();
    expect(view.getByText("Raw Config JSON")).toBeInTheDocument();
  });

  it("shows location ownership when expanded", async () => {
    const { view } = renderPanel();
    await userEvent.click(view.getByText(/Location Ownership/));
    expect(view.getByText("london, york")).toBeInTheDocument();
  });

  it("shows player data when expanded", async () => {
    const { root, view } = renderPanel();
    await userEvent.click(view.getByText(/Players/));
    // "Alice" is in a mixed-content node: <strong>ENG</strong>: Alice
    const entry = root.querySelector(".accordion.open .debug-entry");
    expect(entry?.textContent).toContain("Alice");
  });

  it("shows vassal data when expanded", async () => {
    const { view } = renderPanel();
    await userEvent.click(view.getByText(/Vassal Relationships/));
    expect(view.getByText(/SCO, WLS/)).toBeInTheDocument();
  });

  it("includes counts in accordion titles", () => {
    const { view } = renderPanel();
    expect(view.getByText(/Location Ownership \(2 countries\)/)).toBeInTheDocument();
    expect(view.getByText(/Country Colors \(2\)/)).toBeInTheDocument();
    expect(view.getByText(/Players \(1 countries\)/)).toBeInTheDocument();
    expect(view.getByText(/2 subjects/)).toBeInTheDocument();
    expect(view.getByText(/Province Mapping \(2 provinces\)/)).toBeInTheDocument();
  });
});
