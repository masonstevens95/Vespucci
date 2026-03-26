import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor, within } from "@testing-library/react";
import { MapRenderer } from "../MapRenderer";
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

const mockSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <path id="Uppland" fill="#d1dbdd" stroke="#000" d="M0,0 L10,10"/>
  <path id="Middlesex" fill="#d1dbdd" stroke="#000" d="M20,20 L30,30"/>
</svg>`;

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    text: () => Promise.resolve(mockSvg),
  } as Response);
});

describe("MapRenderer", () => {
  it("shows loading state initially", () => {
    const { container } = render(<MapRenderer config={baseConfig} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    expect(within(container).getByText("Loading map...")).toBeInTheDocument();
  });

  it("renders map after SVG loads", async () => {
    const { container } = render(<MapRenderer config={baseConfig} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitFor(() => {
      expect(container.querySelector(".map-renderer")).toBeInTheDocument();
    });
  });

  it("shows toolbar with Reset View and zoom", async () => {
    const { container } = render(<MapRenderer config={baseConfig} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitFor(() => {
      expect(container.querySelector(".map-toolbar")).toBeInTheDocument();
    });
    const toolbar = container.querySelector(".map-toolbar")! as HTMLElement;
    expect(within(toolbar).getByText("Reset View")).toBeInTheDocument();
    expect(within(toolbar).getByText("100%")).toBeInTheDocument();
  });

  it("applies province colors from config groups", async () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["Uppland"] } },
    };
    const { container } = render(<MapRenderer config={config} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitFor(() => {
      expect(container.querySelector(".map-renderer")).toBeInTheDocument();
    });
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).toContain('fill="#ff0000"');
  });

  it("does not color unmatched provinces", async () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["Uppland"] } },
    };
    const { container } = render(<MapRenderer config={config} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitFor(() => {
      expect(container.querySelector(".map-renderer")).toBeInTheDocument();
    });
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).toContain('id="Middlesex"');
    expect(html).not.toContain('id="Middlesex" fill="#ff0000"');
  });

  // Province strokes match fill (invisible internal borders)
  it("sets province strokes to match fill", async () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["Uppland"] } },
    };
    const { container } = render(<MapRenderer config={config} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitFor(() => {
      expect(container.querySelector(".map-renderer")).toBeInTheDocument();
    });
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).toContain('fill="#ff0000" stroke="#ff0000"');
    expect(html).toContain('fill="#e8dcc8" stroke="#e8dcc8"');
  });

  // Outline layer tests
  it("creates outline layer when outlineWidth > 0", async () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["Uppland"] } },
    };
    const { container } = render(<MapRenderer config={config} mapStyle="parchment" styleOverrides={{ outlineWidth: "0.6" }} colorOverrides={{}} />);
    await waitFor(() => {
      expect(container.querySelector(".map-renderer")).toBeInTheDocument();
    });
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).toContain("outline-layer");
    expect(html).toContain('fill="none"');
    expect(html).toContain('stroke="#000000"');
    expect(html).toContain("scale(0.995)");
  });

  it("no outline layer with default settings", async () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["Uppland"] } },
    };
    const { container } = render(<MapRenderer config={config} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitFor(() => {
      expect(container.querySelector(".map-renderer")).toBeInTheDocument();
    });
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).not.toContain("outline-layer");
  });

  it("does not create outline layer when width is 0", async () => {
    const { container } = render(
      <MapRenderer config={baseConfig} mapStyle="parchment" styleOverrides={{ outlineWidth: "0" }} colorOverrides={{}} />,
    );
    await waitFor(() => {
      expect(container.querySelector(".map-renderer")).toBeInTheDocument();
    });
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).not.toContain("outline-layer");
  });

  it("applies custom outlineColor from overrides", async () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["Uppland"] } },
    };
    const { container } = render(
      <MapRenderer config={config} mapStyle="parchment" styleOverrides={{ outlineColor: "#ff00ff", outlineWidth: "0.6" }} colorOverrides={{}} />,
    );
    await waitFor(() => {
      expect(container.querySelector(".map-renderer")).toBeInTheDocument();
    });
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).toContain('stroke="#ff00ff"');
  });

  it("applies parchment default fill in parchment style", async () => {
    const { container } = render(<MapRenderer config={baseConfig} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitFor(() => {
      expect(container.querySelector(".map-renderer")).toBeInTheDocument();
    });
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).toContain('fill="#e8dcc8"');
  });

  it("applies gray default fill in modern style", async () => {
    const { container } = render(<MapRenderer config={baseConfig} mapStyle="modern" styleOverrides={{}} colorOverrides={{}} />);
    await waitFor(() => {
      expect(container.querySelector(".map-renderer")).toBeInTheDocument();
    });
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).toContain('fill="#d1dbdd"');
  });

  it("adds style-specific class to renderer", async () => {
    const { container } = render(<MapRenderer config={baseConfig} mapStyle="modern" styleOverrides={{}} colorOverrides={{}} />);
    await waitFor(() => {
      expect(container.querySelector(".map-renderer-modern")).toBeInTheDocument();
    });
  });

  it("resets transform on Reset View click", async () => {
    const { container } = render(<MapRenderer config={baseConfig} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitFor(() => {
      expect(container.querySelector(".map-toolbar")).toBeInTheDocument();
    });
    const toolbar = container.querySelector(".map-toolbar")! as HTMLElement;
    const viewport = container.querySelector(".map-viewport")!;
    fireEvent.wheel(viewport, { deltaY: -100 });
    fireEvent.click(within(toolbar).getByText("Reset View"));
    expect(within(toolbar).getByText("100%")).toBeInTheDocument();
  });

  it("removes width/height and adds map-svg class", async () => {
    const { container } = render(<MapRenderer config={baseConfig} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitFor(() => {
      expect(container.querySelector(".map-renderer")).toBeInTheDocument();
    });
    const svg = container.querySelector(".map-svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute("width")).toBeNull();
    expect(svg?.getAttribute("height")).toBeNull();
  });

  // Style override tests
  it("applies custom defaultFill from overrides", async () => {
    const { container } = render(
      <MapRenderer config={baseConfig} mapStyle="parchment" styleOverrides={{ defaultFill: "#aabbcc" }} colorOverrides={{}} />,
    );
    await waitFor(() => {
      expect(container.querySelector(".map-renderer")).toBeInTheDocument();
    });
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).toContain('fill="#aabbcc"');
  });

  it("applies custom bgColor to viewport inline style", async () => {
    const { container } = render(
      <MapRenderer config={baseConfig} mapStyle="parchment" styleOverrides={{ bgColor: "#112233" }} colorOverrides={{}} />,
    );
    await waitFor(() => {
      expect(container.querySelector(".map-viewport")).toBeInTheDocument();
    });
    const viewport = container.querySelector(".map-viewport") as HTMLElement;
    expect(viewport.style.backgroundColor).toBe("rgb(17, 34, 51)");
  });
});
