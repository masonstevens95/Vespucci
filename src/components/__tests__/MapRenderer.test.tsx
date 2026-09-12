import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor, within, cleanup } from "@testing-library/react";
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
  <path id="Red_Sea_Coast" fill="#d1dbdd" stroke="#000" style="fill:#d1dbdd;stroke:#000" d="M40,40 L50,50"/>
</svg>`;

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    text: () => Promise.resolve(mockSvg),
  } as Response);
});

// This project runs vitest with globals disabled, so React Testing Library's
// automatic cleanup never registers and every rendered tree stays in the
// document. That matters here because the map's path IDs then appear many times
// over, and an "#id" selector resolves to the first match in the document rather
// than the one inside this test's container.
afterEach(() => {
  cleanup();
});


/**
 * The map container renders unconditionally so the mount-time effect has an
 * injection target, which means ".map-renderer" is present before the document
 * has loaded.
 *
 * Gating on the spinner alone is racy: the spinner clears on the render commit
 * that sets `ready`, while the recolor effect runs just after that commit, so a
 * poll can land in between and observe an injected-but-unpainted document. The
 * stylesheet's contents are written only by the recolor pass, which makes them
 * a true "painted" signal.
 */
const waitForMapReady = async (container: HTMLElement) => {
  await waitFor(() => {
    expect(container.querySelector(".map-loading")).toBeNull();
    const strokeStyle = container.querySelector(".map-svg > style");
    expect(strokeStyle?.textContent ?? "").not.toBe("");
  });
};

describe("MapRenderer", () => {
  it("shows loading state initially", () => {
    const { container } = render(<MapRenderer config={baseConfig} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    expect(within(container).getByText("Loading map...")).toBeInTheDocument();
  });

  it("renders map after SVG loads", async () => {
    const { container } = render(<MapRenderer config={baseConfig} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitForMapReady(container);
  });

  it("shows toolbar with Reset View and zoom", async () => {
    const { container } = render(<MapRenderer config={baseConfig} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitForMapReady(container);
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
    await waitForMapReady(container);
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).toContain('fill="#ff0000"');
  });

  it("does not color unmatched provinces", async () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["Uppland"] } },
    };
    const { container } = render(<MapRenderer config={config} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitForMapReady(container);
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
    await waitForMapReady(container);
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
    await waitForMapReady(container);
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
    await waitForMapReady(container);
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).not.toContain("outline-layer");
  });

  it("does not create outline layer when width is 0", async () => {
    const { container } = render(
      <MapRenderer config={baseConfig} mapStyle="parchment" styleOverrides={{ outlineWidth: "0" }} colorOverrides={{}} />,
    );
    await waitForMapReady(container);
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
    await waitForMapReady(container);
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).toContain('stroke="#ff00ff"');
  });

  it("applies parchment default fill in parchment style", async () => {
    const { container } = render(<MapRenderer config={baseConfig} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitForMapReady(container);
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).toContain('fill="#e8dcc8"');
  });

  it("applies gray default fill in modern style", async () => {
    const { container } = render(<MapRenderer config={baseConfig} mapStyle="modern" styleOverrides={{}} colorOverrides={{}} />);
    await waitForMapReady(container);
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).toContain('fill="#d1dbdd"');
  });

  it("adds style-specific class to renderer", async () => {
    const { container } = render(<MapRenderer config={baseConfig} mapStyle="modern" styleOverrides={{}} colorOverrides={{}} />);
    await waitForMapReady(container);
    expect(container.querySelector(".map-renderer-modern")).toBeInTheDocument();
  });

  it("resets transform on Reset View click", async () => {
    const { container } = render(<MapRenderer config={baseConfig} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitForMapReady(container);
    const toolbar = container.querySelector(".map-toolbar")! as HTMLElement;
    const viewport = container.querySelector(".map-viewport")!;
    fireEvent.wheel(viewport, { deltaY: -100 });
    fireEvent.click(within(toolbar).getByText("Reset View"));
    expect(within(toolbar).getByText("100%")).toBeInTheDocument();
  });

  it("removes width/height and adds map-svg class", async () => {
    const { container } = render(<MapRenderer config={baseConfig} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitForMapReady(container);
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
    await waitForMapReady(container);
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).toContain('fill="#aabbcc"');
  });

  it("applies custom bgColor to viewport inline style", async () => {
    const { container } = render(
      <MapRenderer config={baseConfig} mapStyle="parchment" styleOverrides={{ bgColor: "#112233" }} colorOverrides={{}} />,
    );
    await waitForMapReady(container);
    const viewport = container.querySelector(".map-viewport") as HTMLElement;
    expect(viewport.style.backgroundColor).toBe("rgb(17, 34, 51)");
  });

  // Inline style override fix
  it("strips inline style so fill attribute takes effect", async () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "TUR", paths: ["Red_Sea_Coast"] } },
    };
    const { container } = render(<MapRenderer config={config} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitForMapReady(container);
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    // The path had style="fill:#d1dbdd" which would override the fill attribute.
    // After stripping, fill="#ff0000" should take effect.
    expect(html).not.toContain('style=');
    expect(html).toContain('id="Red_Sea_Coast" fill="#ff0000"');
  });

  // Province click tests
  it("fires onProvinceClick with tag on single click", async () => {
    const onClick = vi.fn();
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG - Alice", paths: ["Uppland"] } },
    };
    const { container } = render(
      <MapRenderer config={config} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} onProvinceClick={onClick} />,
    );
    await waitForMapReady(container);
    const viewport = container.querySelector(".map-viewport")!;
    // Simulate click (mouseDown + mouseUp at same position)
    fireEvent.mouseDown(viewport, { clientX: 100, clientY: 100, button: 0 });
    // Fire mouseUp on an SVG path element
    const path = container.querySelector("#Uppland");
    expect(path).not.toBeNull();
    fireEvent.mouseUp(path!, { clientX: 100, clientY: 100 });
    expect(onClick).toHaveBeenCalledWith("ENG");
  });

  it("does not fire onProvinceClick when dragging", async () => {
    const onClick = vi.fn();
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["Uppland"] } },
    };
    const { container } = render(
      <MapRenderer config={config} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} onProvinceClick={onClick} />,
    );
    await waitForMapReady(container);
    const viewport = container.querySelector(".map-viewport")!;
    // Simulate drag (mouseDown then mouseUp far away)
    fireEvent.mouseDown(viewport, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.mouseMove(viewport, { clientX: 200, clientY: 200 });
    fireEvent.mouseUp(viewport, { clientX: 200, clientY: 200 });
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not fire onProvinceClick for uncolored provinces", async () => {
    const onClick = vi.fn();
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["Uppland"] } },
    };
    const { container } = render(
      <MapRenderer config={config} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} onProvinceClick={onClick} />,
    );
    await waitForMapReady(container);
    const viewport = container.querySelector(".map-viewport")!;
    // Click on Middlesex which is not in any group
    fireEvent.mouseDown(viewport, { clientX: 100, clientY: 100, button: 0 });
    const path = container.querySelector("#Middlesex");
    expect(path).not.toBeNull();
    fireEvent.mouseUp(path!, { clientX: 100, clientY: 100 });
    expect(onClick).not.toHaveBeenCalled();
  });

  it("uses default cursor, not grab", async () => {
    const { container } = render(<MapRenderer config={baseConfig} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitForMapReady(container);
    const viewport = container.querySelector(".map-viewport") as HTMLElement;
    const style = window.getComputedStyle(viewport);
    expect(style.cursor).not.toBe("grab");
  });
});

// ---------------------------------------------------------------------------
// Effect-split behaviour: readiness, idempotence, error handling.
// ---------------------------------------------------------------------------

describe("MapRenderer — load and recolor split", () => {
  const redConfig: MapChartConfig = {
    ...baseConfig,
    groups: { "#ff0000": { label: "ENG", paths: ["Uppland"] } },
  };

  it("paints on first load with no prop changes", async () => {
    // The recolor effect is gated on readiness. Without that gate it would run
    // once against an empty path map and never re-run, leaving a grey map.
    const { container } = render(
      <MapRenderer config={redConfig} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
    );
    await waitForMapReady(container);
    expect(container.querySelector("#Uppland")?.getAttribute("fill")).toBe("#ff0000");
  });

  it("does not refetch the document when only colors change", async () => {
    const { container, rerender } = render(
      <MapRenderer config={redConfig} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
    );
    await waitForMapReady(container);
    const callsAfterLoad = vi.mocked(globalThis.fetch).mock.calls.length;

    rerender(
      <MapRenderer config={redConfig} mapStyle="parchment" styleOverrides={{}} colorOverrides={{ "#ff0000": "#00ff00" }} />,
    );
    await waitFor(() => {
      expect(container.querySelector("#Uppland")?.getAttribute("fill")).toBe("#00ff00");
    });
    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(callsAfterLoad);
  });

  it("clears a previous owner's color when a location changes hands", async () => {
    const { container, rerender } = render(
      <MapRenderer config={redConfig} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
    );
    await waitForMapReady(container);
    expect(container.querySelector("#Uppland")?.getAttribute("fill")).toBe("#ff0000");

    // Uppland moves to another country; Middlesex takes the red group.
    rerender(
      <MapRenderer
        config={{ ...baseConfig, groups: { "#ff0000": { label: "ENG", paths: ["Middlesex"] } } }}
        mapStyle="parchment"
        styleOverrides={{}}
        colorOverrides={{}}
      />,
    );
    await waitFor(() => {
      expect(container.querySelector("#Middlesex")?.getAttribute("fill")).toBe("#ff0000");
    });
    // Reset-then-apply: the old owner's color must not persist.
    expect(container.querySelector("#Uppland")?.getAttribute("fill")).toBe("#e8dcc8");
  });

  it("keeps exactly one outline layer across repeated recolors", async () => {
    const { container, rerender } = render(
      <MapRenderer config={redConfig} mapStyle="parchment" styleOverrides={{ outlineWidth: "0.6" }} colorOverrides={{}} />,
    );
    await waitForMapReady(container);
    expect(container.querySelectorAll(`.outline-layer`)).toHaveLength(1);

    // The outline width is a live slider, so one drag fires many recolors.
    for (const w of ["0.7", "0.8", "0.9", "1.0"]) {
      rerender(
        <MapRenderer config={redConfig} mapStyle="parchment" styleOverrides={{ outlineWidth: w }} colorOverrides={{}} />,
      );
    }
    await waitFor(() => {
      expect(container.querySelector(".outline-layer")).toBeInTheDocument();
    });
    expect(container.querySelectorAll(`.outline-layer`)).toHaveLength(1);
  });

  it("removes the outline layer and its shrink transform when width returns to 0", async () => {
    const { container, rerender } = render(
      <MapRenderer config={redConfig} mapStyle="parchment" styleOverrides={{ outlineWidth: "0.6" }} colorOverrides={{}} />,
    );
    await waitForMapReady(container);
    expect(container.querySelector("#Uppland")?.getAttribute("style") ?? "").toContain("scale(0.995)");

    rerender(
      <MapRenderer config={redConfig} mapStyle="parchment" styleOverrides={{ outlineWidth: "0" }} colorOverrides={{}} />,
    );
    await waitFor(() => {
      expect(container.querySelector(".outline-layer")).toBeNull();
    });
    // A stale shrink transform would leave permanent hairline gaps.
    expect(container.querySelector("#Uppland")?.getAttribute("style")).toBeNull();
  });

  it("puts stroke-width in a stylesheet scoped away from outline clones", async () => {
    const { container } = render(
      <MapRenderer config={redConfig} mapStyle="parchment" styleOverrides={{ outlineWidth: "0.6" }} colorOverrides={{}} />,
    );
    await waitForMapReady(container);

    const css = container.querySelector(".map-svg > style")?.textContent ?? "";
    // A descendant selector would also beat the clones' own stroke-width.
    expect(css).toContain(".map-svg > path");
    expect(css).toContain("stroke-width: 0.15");

    const clone = container.querySelector(".outline-layer path");
    expect(clone?.getAttribute("stroke-width")).toBe("0.6");
  });

  it("shows an error with retry when the document fails to load", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error("offline"));
    const { container } = render(
      <MapRenderer config={redConfig} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
    );
    await waitFor(() => {
      expect(container.querySelector(".map-load-error")).toBeInTheDocument();
    });
    // Not a permanent spinner.
    expect(container.querySelector(".map-loading")).toBeNull();

    const errorBox = container.querySelector(".map-load-error") as HTMLElement;
    fireEvent.click(within(errorBox).getByText("Retry"));
    await waitForMapReady(container);
    expect(container.querySelector("#Uppland")?.getAttribute("fill")).toBe("#ff0000");
  });

  it("skips config paths with no shape without affecting other paths", async () => {
    const config: MapChartConfig = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["Uppland", "Not_On_The_Map"] } },
    };
    const { container } = render(
      <MapRenderer config={config} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
    );
    await waitForMapReady(container);
    expect(container.querySelector("#Uppland")?.getAttribute("fill")).toBe("#ff0000");
    expect(container.querySelector("#Middlesex")?.getAttribute("fill")).toBe("#e8dcc8");
  });
});
