import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The real graph is 718 KB; the point under test is *when* it is fetched.
const loadAdjacency = vi.hoisted(() => vi.fn(async () => [[1], [0]] as const));
vi.mock("../../lib/location-adjacency", () => ({ loadAdjacency }));
import { render, within, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { MapTab } from "../MapTab";
import type { MapChartConfig } from "../../lib/types";

const mockSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <path id="Uppland" fill="#d1dbdd" stroke="#000" d="M0,0 L10,10"/>
  <path id="Kolyma_Wasteland" fill="#d1dbdd" stroke="#000" d="M20,20 L30,30"/>
</svg>`;

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    text: () => Promise.resolve(mockSvg),
  } as Response);
});

// Vitest runs with globals disabled, so RTL's automatic cleanup never
// registers: without this every rendered tree stays mounted, the map's path
// ids appear many times over, and a waitFor poll can never settle.
afterEach(() => {
  cleanup();
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

  it("fetches the adjacency graph at the default width", async () => {
    // Borders are on by default, so the chunk is needed as soon as a map is
    // shown — but still not before then, which is what the code split buys.
    const { container } = renderTab();
    await waitFor(() => expect(loadAdjacency).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector(".map-svg")).toBeInTheDocument());
  });

  it("does not fetch the graph when outlines are turned off", async () => {
    const { container } = renderTab();
    await waitFor(() => expect(container.querySelector(".map-svg")).toBeInTheDocument());
    loadAdjacency.mockClear();
    setWidth(container, "0");
    setWidth(container, "0");
    expect(loadAdjacency).not.toHaveBeenCalled();
  });

  it("fetches the graph only once across repeated width changes", async () => {
    const { container } = renderTab();
    await waitFor(() => expect(container.querySelector(".map-svg")).toBeInTheDocument());
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
    await waitFor(() => expect(loadAdjacency).toHaveBeenCalled());
    setWidth(container, "1.5");
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

// =============================================================================
// Wasteland fill
// =============================================================================

describe("MapTab — wasteland fill", () => {
  const ENG = "#ff0000";
  const PARCHMENT_DEFAULT = "#e8dcc8";

  /** Uppland (0) touches Kolyma_Wasteland (1), matching the mocked graph. */
  const IDS = ["Uppland", "Kolyma_Wasteland"];

  const ownership = {
    ownerByPath: new Map([["Uppland", "ENG"]]),
    playerTags: new Set(["ENG"]),
  };

  const renderTab = (props: Record<string, unknown> = {}) =>
    render(
      <MapTab
        config={baseConfig}
        subjectOverlords={{}}
        borderOwnership={ownership}
        wastelandPaths={["Kolyma_Wasteland"]}
        adjacencyIds={IDS}
        parseTimeMs={500}
        onCountryClick={() => {}}
        onReset={() => {}}
        {...props}
      />,
    );

  const fillOf = (container: HTMLElement, id: string): string =>
    container.querySelector(`#${id}`)?.getAttribute("fill") ?? "";

  const toggleOf = (container: HTMLElement): HTMLInputElement =>
    [...container.querySelectorAll(".toolbar-controls input[type=checkbox]")][0] as HTMLInputElement;

  beforeEach(() => {
    loadAdjacency.mockClear();
  });

  it("offers the toggle, on by default", () => {
    const { container } = renderTab();
    expect(within(container).getByText("Fill wastelands")).toBeTruthy();
    expect(toggleOf(container).checked).toBe(true);
  });

  it("paints a wasteland its one neighbour encloses", async () => {
    const { container } = renderTab();
    await waitFor(() => {
      expect(fillOf(container, "Kolyma_Wasteland")).toBe(ENG);
    });
  });

  it("returns the wasteland to grey when the toggle is switched off", async () => {
    const { container } = renderTab();
    await waitFor(() => {
      expect(fillOf(container, "Kolyma_Wasteland")).toBe(ENG);
    });

    fireEvent.click(toggleOf(container));
    await waitFor(() => {
      expect(fillOf(container, "Kolyma_Wasteland")).toBe(PARCHMENT_DEFAULT);
    });
    // The country's own territory is untouched either way.
    expect(fillOf(container, "Uppland")).toBe(ENG);
  });

  it("leaves a wasteland grey when a second country borders it", async () => {
    const { container } = renderTab({
      borderOwnership: {
        ownerByPath: new Map([["Uppland", "ENG"], ["Kolyma_Wasteland", "FRA"]]),
        playerTags: new Set(["ENG"]),
      },
      // Both shapes owned, so nothing is a wasteland to enclose.
      wastelandPaths: [],
    });
    await waitFor(() => {
      expect(fillOf(container, "Uppland")).toBe(ENG);
    });
    expect(fillOf(container, "Kolyma_Wasteland")).toBe(PARCHMENT_DEFAULT);
  });

  it("fetches the graph for the fill even with the outline width at zero", async () => {
    const { container } = renderTab();
    await waitFor(() => expect(loadAdjacency).toHaveBeenCalled());
    loadAdjacency.mockClear();

    const range = container.querySelector(".style-range-input") as HTMLInputElement;
    fireEvent.change(range, { target: { value: "0" } });

    // Still painted: the fill does not depend on borders being drawn.
    await waitFor(() => {
      expect(fillOf(container, "Kolyma_Wasteland")).toBe(ENG);
    });
  });

  it("disables the toggle when the save reports no wastelands", () => {
    // A melted text save: the parser does not classify wastelands there, so
    // the checkbox could never do anything. Better to say so than to offer a
    // control that silently does nothing.
    const { container } = renderTab({ wastelandPaths: [] });
    const toggle = toggleOf(container);
    expect(toggle.disabled).toBe(true);
    expect(toggle.checked).toBe(false);
  });

  it("paints nothing before the graph arrives", () => {
    const { container } = renderTab();
    // Synchronous first paint, before the mocked fetch resolves.
    expect(fillOf(container, "Kolyma_Wasteland")).not.toBe(ENG);
  });
});
