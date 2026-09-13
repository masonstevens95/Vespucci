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
  page: "eu-v-locations",
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
    const { container } = render(<MapLegend config={baseConfig} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} onColorChange={() => {}} onCountryClick={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders title from config", () => {
    const config = {
      ...baseConfig,
      title: "EU5 MP - 1610",
      groups: { "#ff0000": { label: "ENG", paths: ["London"] } },
    };
    render(<MapLegend config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} onColorChange={() => {}} onCountryClick={() => {}} />);
    expect(screen.getByText("EU5 MP - 1610")).toBeInTheDocument();
  });

  it("falls back to 'Legend' when title is empty", () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["London"] } },
    };
    render(<MapLegend config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} onColorChange={() => {}} onCountryClick={() => {}} />);
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
    const { container } = render(<MapLegend config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} onColorChange={() => {}} onCountryClick={() => {}} />);
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
    const { container } = render(<MapLegend config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} onColorChange={() => {}} onCountryClick={() => {}} />);
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
    const { container } = render(<MapLegend config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} onColorChange={() => {}} onCountryClick={() => {}} />);
    const labels = container.querySelectorAll(".map-legend-label");
    const texts = Array.from(labels).map((l) => l.textContent);
    expect(texts).toContain("ENG - Alice");
  });

  it("renders location counts", () => {
    const config = {
      ...baseConfig,
      groups: {
        "#ff0000": { label: "ENG", paths: ["London", "York", "Bath"] },
      },
    };
    const { container } = render(<MapLegend config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} onColorChange={() => {}} onCountryClick={() => {}} />);
    const count = container.querySelector(".map-legend-count");
    expect(count?.textContent).toBe("3");
  });

  it("applies parchment style class", () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["London"] } },
    };
    const { container } = render(<MapLegend config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} onColorChange={() => {}} onCountryClick={() => {}} />);
    expect(container.querySelector(".map-legend-parchment")).toBeInTheDocument();
  });

  it("applies modern style class", () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["London"] } },
    };
    const { container } = render(<MapLegend config={config} subjectOverlords={{}} mapStyle="modern" styleOverrides={{}} colorOverrides={{}} onColorChange={() => {}} onCountryClick={() => {}} />);
    expect(container.querySelector(".map-legend-modern")).toBeInTheDocument();
  });

  // Style override tests
  it("applies custom legendBg via inline style", () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["London"] } },
    };
    const { container } = render(
      <MapLegend config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{ legendBg: "#112233" }} colorOverrides={{}} onColorChange={() => {}} onCountryClick={() => {}} />,
    );
    const legend = container.querySelector(".map-legend") as HTMLElement;
    expect(legend.style.backgroundColor).toBe("rgb(17, 34, 51)");
  });

  it("applies custom legendBorder via inline style", () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["London"] } },
    };
    const { container } = render(
      <MapLegend config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{ legendBorder: "#aabbcc" }} colorOverrides={{}} onColorChange={() => {}} onCountryClick={() => {}} />,
    );
    const legend = container.querySelector(".map-legend") as HTMLElement;
    expect(legend.style.borderColor).toBe("rgb(170, 187, 204)");
  });

  it("applies custom titleColor to legend title", () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["London"] } },
    };
    const { container } = render(
      <MapLegend config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{ titleColor: "#ff0000" }} colorOverrides={{}} onColorChange={() => {}} onCountryClick={() => {}} />,
    );
    const title = container.querySelector(".map-legend-title") as HTMLElement;
    expect(title.style.color).toBe("rgb(255, 0, 0)");
  });

  it("applies custom labelColor to entry labels", () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["London"] } },
    };
    const { container } = render(
      <MapLegend config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{ labelColor: "#00ff00" }} colorOverrides={{}} onColorChange={() => {}} onCountryClick={() => {}} />,
    );
    const label = container.querySelector(".map-legend-label") as HTMLElement;
    expect(label.style.color).toBe("rgb(0, 255, 0)");
  });

  // Color override tests
  it("displays overridden color on swatch", () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["London"] } },
    };
    const { container } = render(
      <MapLegend config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{ "#ff0000": "#00ff00" }} onColorChange={() => {}} onCountryClick={() => {}} />,
    );
    const swatch = container.querySelector(".map-legend-swatch") as HTMLElement;
    expect(swatch.style.backgroundColor).toBe("rgb(0, 255, 0)");
  });

  it("renders color input with overridden value", () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["London"] } },
    };
    const { container } = render(
      <MapLegend config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{ "#ff0000": "#0000ff" }} onColorChange={() => {}} onCountryClick={() => {}} />,
    );
    const input = container.querySelector(".map-legend-color-input") as HTMLInputElement;
    expect(input.value).toBe("#0000ff");
  });

  it("uses original color when no override", () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["London"] } },
    };
    const { container } = render(
      <MapLegend config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} onColorChange={() => {}} onCountryClick={() => {}} />,
    );
    const input = container.querySelector(".map-legend-color-input") as HTMLInputElement;
    expect(input.value).toBe("#ff0000");
  });
});

// ---------------------------------------------------------------------------
// Subject rows: hatched swatch drawn from the OVERLORD's colour.
// ---------------------------------------------------------------------------

describe("MapLegend — subject swatches", () => {
  const FRA = "#0000ff";
  const LIGHTENED = "#5555ff";

  const swatchStyle = (container: HTMLElement, label: string): string => {
    const row = [...container.querySelectorAll(".map-legend-entry")].find(
      (e) => e.querySelector(".map-legend-label")?.textContent?.trim() === label,
    );
    return (row?.querySelector(".map-legend-swatch") as HTMLElement)?.getAttribute("style") ?? "";
  };

  // Inline styles are normalised to rgb() by the DOM, so compare in that form.
  const asRgb = (hex: string): string => {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
  };

  const withSubjects = {
    ...baseConfig,
    groups: {
      [FRA]: { label: "FRA", paths: ["A"] },
      [LIGHTENED]: { label: "FRA - subjects", paths: ["B"] },
    },
  };

  it("hatches a players-only subject row and leaves the overlord flat", () => {
    const { container } = render(
      <MapLegend config={withSubjects} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} onColorChange={() => {}} onCountryClick={() => {}} />,
    );
    expect(swatchStyle(container, "FRA - subjects")).toContain("repeating-linear-gradient");
    expect(swatchStyle(container, "FRA")).not.toContain("repeating-linear-gradient");
  });

  it("stripes the subject swatch in the overlord's colour, not its own hex", () => {
    const { container } = render(
      <MapLegend config={withSubjects} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} onColorChange={() => {}} onCountryClick={() => {}} />,
    );
    const style = swatchStyle(container, "FRA - subjects");
    expect(style).toContain(asRgb(FRA));
    expect(style).not.toContain(asRgb(LIGHTENED));
  });

  it("moves the subject swatch when the overlord's colour is overridden", () => {
    const { container } = render(
      <MapLegend config={withSubjects} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{ [FRA]: "#ff0000" }} onColorChange={() => {}} onCountryClick={() => {}} />,
    );
    expect(swatchStyle(container, "FRA - subjects")).toContain(asRgb("#ff0000"));
  });

  it("hatches a full-map subject row via subjectOverlords", () => {
    const config = {
      ...baseConfig,
      groups: {
        [FRA]: { label: "FRA", paths: ["A"] },
        "#00ff00": { label: "BUR", paths: ["B"] },
      },
    };
    const { container } = render(
      <MapLegend config={config} subjectOverlords={{ BUR: "FRA" }} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} onColorChange={() => {}} onCountryClick={() => {}} />,
    );
    const style = swatchStyle(container, "BUR");
    expect(style).toContain("repeating-linear-gradient");
    expect(style).toContain(asRgb(FRA));
  });

  it("keeps a flat swatch when the overlord has no row", () => {
    const config = {
      ...baseConfig,
      groups: { [LIGHTENED]: { label: "GONE - subjects", paths: ["B"] } },
    };
    const { container } = render(
      <MapLegend config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} onColorChange={() => {}} onCountryClick={() => {}} />,
    );
    expect(swatchStyle(container, "GONE - subjects")).not.toContain("repeating-linear-gradient");
  });

  it("keeps the colour picker reachable on subject rows", () => {
    const { container } = render(
      <MapLegend config={withSubjects} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} onColorChange={() => {}} onCountryClick={() => {}} />,
    );
    expect(container.querySelectorAll("input.map-legend-color-input")).toHaveLength(2);
  });

  it("keeps the own/subject count split", () => {
    const { container } = render(
      <MapLegend config={withSubjects} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} onColorChange={() => {}} onCountryClick={() => {}} />,
    );
    const counts = [...container.querySelectorAll(".map-legend-count")].map((e) => e.textContent);
    expect(counts).toEqual(["1", "1"]);
  });
});
