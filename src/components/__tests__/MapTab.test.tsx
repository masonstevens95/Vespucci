import { describe, it, expect, vi, beforeEach } from "vitest";

// The real graph is 718 KB; the point under test is *when* it is fetched.
const loadAdjacency = vi.hoisted(() => vi.fn(async () => [[1], [0]] as const));
vi.mock("../../lib/location-adjacency", () => ({ loadAdjacency }));
import { render, within, waitFor, fireEvent } from "@testing-library/react";
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

describe("MapTab", () => {
  it("renders toolbar with stats", () => {
    const { container } = render(
      <MapTab config={baseConfig} subjectOverlords={{}} parseTimeMs={500} onCountryClick={() => {}} onReset={() => {}} />,
    );
    expect(container.querySelector(".toolbar")).toBeInTheDocument();
    expect(container.textContent).toContain("Countries");
    expect(container.textContent).toContain("Locations");
  });

  it("renders style dropdown", () => {
    const { container } = render(
      <MapTab config={baseConfig} subjectOverlords={{}} parseTimeMs={500} onCountryClick={() => {}} onReset={() => {}} />,
    );
    const select = container.querySelector(".style-select") as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe("parchment");
  });

  it("renders Download Map button", () => {
    const { container } = render(
      <MapTab config={baseConfig} subjectOverlords={{}} parseTimeMs={500} onCountryClick={() => {}} onReset={() => {}} />,
    );
    const toolbar = container.querySelector(".toolbar")! as HTMLElement;
    expect(within(toolbar).getByText("Download Map")).toBeInTheDocument();
  });

  it("warns that the config targets the Locations map", () => {
    // The page id and every path id changed with location granularity, so a
    // config from this build will not load onto the provinces map. Multiplayer
    // groups keep a MapChart project across sessions and never read PR notes.
    const { container } = render(
      <MapTab config={baseConfig} subjectOverlords={{}} parseTimeMs={500} onCountryClick={() => {}} onReset={() => {}} />,
    );
    expect(container.textContent).toContain("EU5 Locations");
    expect(container.textContent).toContain("not compatible");
  });

  it("warns that subjects export as a lighter shade", () => {
    // The PNG and the screen hatch; the config cannot, so users who paste it
    // into mapchart.net must not read the difference as a bug.
    const { container } = render(
      <MapTab config={baseConfig} subjectOverlords={{}} parseTimeMs={500} onCountryClick={() => {}} onReset={() => {}} />,
    );
    expect(container.textContent).toContain("lighter shade");
    expect(container.textContent).toContain("hatching");
  });

  it("renders Download Config button", () => {
    const { container } = render(
      <MapTab config={baseConfig} subjectOverlords={{}} parseTimeMs={500} onCountryClick={() => {}} onReset={() => {}} />,
    );
    const toolbar = container.querySelector(".toolbar")! as HTMLElement;
    expect(within(toolbar).getByText("Download Config")).toBeInTheDocument();
  });

  it("renders New File button", () => {
    const { container } = render(
      <MapTab config={baseConfig} subjectOverlords={{}} parseTimeMs={500} onCountryClick={() => {}} onReset={() => {}} />,
    );
    const toolbar = container.querySelector(".toolbar")! as HTMLElement;
    expect(within(toolbar).getByText("New File")).toBeInTheDocument();
  });

  it("renders map and legend panels", async () => {
    const { container } = render(
      <MapTab config={baseConfig} subjectOverlords={{}} parseTimeMs={500} onCountryClick={() => {}} onReset={() => {}} />,
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
        subjectOverlords={{}}
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
      <MapTab config={baseConfig} subjectOverlords={{}} parseTimeMs={500} onCountryClick={() => {}} onReset={() => {}} />,
    );
    expect(container.querySelector(".test-debug")).not.toBeInTheDocument();
  });

  it("renders color pickers in style row", () => {
    const { container } = render(
      <MapTab config={baseConfig} subjectOverlords={{}} parseTimeMs={500} onCountryClick={() => {}} onReset={() => {}} />,
    );
    const colorInputs = container.querySelectorAll(".style-color-input");
    expect(colorInputs.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Cropped PNG export
// =============================================================================

describe("downloading a cropped map", () => {
  /**
   * Capture the cloned SVG the download serialises, which is where the crop
   * lands. jsdom has no canvas or image decoding, so the draw itself cannot
   * run — the viewBox on the serialised clone is the observable outcome.
   */
  const captureClone = () => {
    const serialised: string[] = [];
    const priorBlob = globalThis.Blob;
    class CapturingBlob {
      constructor(parts: string[]) {
        serialised.push(parts.join(""));
      }
    }
    (globalThis as unknown as Record<string, unknown>).Blob = CapturingBlob;

    const priorCreate = URL.createObjectURL;
    URL.createObjectURL = () => "blob:stub";

    const proto = SVGElement.prototype as unknown as Record<string, unknown>;
    const hadBBox = "getBBox" in proto;
    const priorBBox = proto.getBBox;
    proto.getBBox = function (this: SVGElement) {
      if (this.id === "Uppland") return { x: 100, y: 100, width: 200, height: 100 };
      throw new Error("no geometry");
    };

    // jsdom has no 2D context, and the handler bails without one before it ever
    // reaches the clone. A no-op context lets the crop path run.
    const priorContext = HTMLCanvasElement.prototype.getContext;
    const noopCtx = new Proxy(
      {},
      {
        get: () => () => undefined,
        set: () => true,
      },
    );
    HTMLCanvasElement.prototype.getContext = (() => noopCtx) as unknown as typeof priorContext;

    return {
      serialised,
      restore: () => {
        (globalThis as unknown as Record<string, unknown>).Blob = priorBlob;
        URL.createObjectURL = priorCreate;
        HTMLCanvasElement.prototype.getContext = priorContext;
        if (hadBBox) proto.getBBox = priorBBox;
        else delete proto.getBBox;
      },
    };
  };

  const clickDownload = async (container: HTMLElement) => {
    const toolbar = container.querySelector(".toolbar") as HTMLElement;
    fireEvent.click(within(toolbar).getByText("Download Map"));
    await waitFor(() => {
      expect(container.querySelector(".map-svg")).toBeInTheDocument();
    });
  };

  it("crops the exported SVG to the player region", async () => {
    const cap = captureClone();
    try {
      const { container } = render(
        <MapTab config={baseConfig} subjectOverlords={{}} playerPaths={["Uppland"]}
          parseTimeMs={500} onCountryClick={() => {}} onReset={() => {}} />,
      );
      await waitFor(() => expect(container.querySelector(".map-svg")).toBeInTheDocument());
      await clickDownload(container);
      await waitFor(() => expect(cap.serialised.length).toBeGreaterThan(0));
      // A viewBox other than the asset's own means the crop was applied.
      expect(cap.serialised[0]).toContain("viewBox");
      expect(cap.serialised[0]).not.toContain('viewBox="0 0 1200 680"');
    } finally {
      cap.restore();
    }
  });

  it("exports the whole map when the save has no players", async () => {
    const cap = captureClone();
    try {
      const { container } = render(
        <MapTab config={baseConfig} subjectOverlords={{}} playerPaths={[]}
          parseTimeMs={500} onCountryClick={() => {}} onReset={() => {}} />,
      );
      await waitFor(() => expect(container.querySelector(".map-svg")).toBeInTheDocument());
      await clickDownload(container);
      await waitFor(() => expect(cap.serialised.length).toBeGreaterThan(0));
      // The mock asset carries no viewBox, so an uncropped clone gains none.
      expect(cap.serialised[0]).not.toContain("viewBox");
    } finally {
      cap.restore();
    }
  });

  it("crops identically regardless of the on-screen view", async () => {
    const cap = captureClone();
    try {
      const { container } = render(
        <MapTab config={baseConfig} subjectOverlords={{}} playerPaths={["Uppland"]}
          parseTimeMs={500} onCountryClick={() => {}} onReset={() => {}} />,
      );
      await waitFor(() => expect(container.querySelector(".map-svg")).toBeInTheDocument());
      await clickDownload(container);
      await waitFor(() => expect(cap.serialised.length).toBeGreaterThan(0));
      const viewBoxOf = (svg: string) => /viewBox="([^"]*)"/.exec(svg)?.[1] ?? "";
      const before = viewBoxOf(cap.serialised[0]);
      expect(before).not.toBe("");

      // Zoom the viewport, then export again: the framing must not move.
      // Compared by viewBox rather than by the whole serialised document,
      // which is the actual claim and is immune to unrelated attribute churn.
      const viewport = container.querySelector(".map-viewport")!;
      fireEvent.wheel(viewport, { deltaY: -100, clientX: 50, clientY: 50 });
      await clickDownload(container);
      await waitFor(() => expect(cap.serialised.length).toBeGreaterThan(1));
      expect(viewBoxOf(cap.serialised[1])).toBe(before);
    } finally {
      cap.restore();
    }
  });
});

// =============================================================================
// Country borders
// =============================================================================

describe("country borders", () => {
  const ownership = {
    ownerByPath: new Map([["Uppland", "SWE"]]),
    playerTags: new Set(["SWE"]),
  };

  beforeEach(() => {
    loadAdjacency.mockClear();
  });

  const renderTab = (overrides: Record<string, unknown> = {}) =>
    render(
      <MapTab
        config={baseConfig}
        subjectOverlords={{}}
        borderOwnership={ownership}
        parseTimeMs={500}
        onCountryClick={() => {}}
        onReset={() => {}}
        {...overrides}
      />,
    );

  const setWidth = (container: HTMLElement, value: string) => {
    const range = container.querySelector(".style-range-input") as HTMLInputElement;
    fireEvent.change(range, { target: { value } });
  };

  it("does not fetch the adjacency graph at the default width", async () => {
    const { container } = renderTab();
    await waitFor(() => expect(container.querySelector(".map-svg")).toBeInTheDocument());
    expect(loadAdjacency).not.toHaveBeenCalled();
  });

  it("fetches the graph once the width is raised", async () => {
    const { container } = renderTab();
    await waitFor(() => expect(container.querySelector(".map-svg")).toBeInTheDocument());
    setWidth(container, "0.6");
    await waitFor(() => expect(loadAdjacency).toHaveBeenCalled());
  });

  it("fetches the graph only once across repeated width changes", async () => {
    const { container } = renderTab();
    await waitFor(() => expect(container.querySelector(".map-svg")).toBeInTheDocument());
    setWidth(container, "0.6");
    await waitFor(() => expect(loadAdjacency).toHaveBeenCalled());
    setWidth(container, "0.9");
    setWidth(container, "1.2");
    await waitFor(() => expect(loadAdjacency).toHaveBeenCalledTimes(1));
  });

  it("leaves the legend location count unchanged when borders are on", async () => {
    const { container } = renderTab();
    await waitFor(() => expect(container.querySelector(".map-svg")).toBeInTheDocument());
    // Just the count: the toolbar text also carries the slider's own value.
    const locationCount = () =>
      /(\d+)\s*Locations/.exec(container.querySelector(".toolbar")?.textContent ?? "")?.[1];
    const before = locationCount();
    expect(before).toBeDefined();
    setWidth(container, "0.6");
    await waitFor(() => expect(loadAdjacency).toHaveBeenCalled());
    expect(locationCount()).toBe(before);
  });

  it("renders without border ownership", async () => {
    // A melted save carries no ownership for this purpose; the map must still
    // draw, just without borders.
    const { container } = renderTab({ borderOwnership: undefined });
    await waitFor(() => expect(container.querySelector(".map-svg")).toBeInTheDocument());
    setWidth(container, "0.6");
    expect(container.querySelector(".border-layer")).toBeNull();
  });
});
