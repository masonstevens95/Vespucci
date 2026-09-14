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
    const { container } = render(<MapRenderer config={baseConfig} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    expect(within(container).getByText("Loading map...")).toBeInTheDocument();
  });

  it("renders map after SVG loads", async () => {
    const { container } = render(<MapRenderer config={baseConfig} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitForMapReady(container);
  });

  it("shows toolbar with Reset View and zoom", async () => {
    const { container } = render(<MapRenderer config={baseConfig} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitForMapReady(container);
    const toolbar = container.querySelector(".map-toolbar")! as HTMLElement;
    expect(within(toolbar).getByText("Reset View")).toBeInTheDocument();
    expect(within(toolbar).getByText("100%")).toBeInTheDocument();
  });

  it("applies location colors from config groups", async () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["Uppland"] } },
    };
    const { container } = render(<MapRenderer config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitForMapReady(container);
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).toContain('fill="#ff0000"');
  });

  it("does not color unmatched locations", async () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["Uppland"] } },
    };
    const { container } = render(<MapRenderer config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitForMapReady(container);
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).toContain('id="Middlesex"');
    expect(html).not.toContain('id="Middlesex" fill="#ff0000"');
  });

  // Location strokes match fill (invisible internal borders)
  it("sets location strokes to match fill", async () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["Uppland"] } },
    };
    const { container } = render(<MapRenderer config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitForMapReady(container);
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).toContain('fill="#ff0000" stroke="#ff0000"');
    expect(html).toContain('fill="#e8dcc8" stroke="#e8dcc8"');
  });

  // Outline layer tests
  it("no longer outlines every location when outlineWidth > 0", async () => {
    // Outline width now means country borders. Without ownership and an
    // adjacency graph there is nothing to border, so a raised width alone
    // draws nothing — and in particular does not resurrect the per-location
    // clones or the shrink that made them visible.
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["Uppland"] } },
    };
    const { container } = render(<MapRenderer config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{ outlineWidth: "0.6" }} colorOverrides={{}} />);
    await waitForMapReady(container);
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).not.toContain("outline-layer");
    expect(html).not.toContain("scale(0.995)");
  });

  it("no outline layer with default settings", async () => {
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG", paths: ["Uppland"] } },
    };
    const { container } = render(<MapRenderer config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitForMapReady(container);
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).not.toContain("outline-layer");
  });

  it("does not create outline layer when width is 0", async () => {
    const { container } = render(
      <MapRenderer config={baseConfig} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{ outlineWidth: "0" }} colorOverrides={{}} />,
    );
    await waitForMapReady(container);
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).not.toContain("outline-layer");
  });

  it("applies parchment default fill in parchment style", async () => {
    const { container } = render(<MapRenderer config={baseConfig} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitForMapReady(container);
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).toContain('fill="#e8dcc8"');
  });

  it("applies gray default fill in modern style", async () => {
    const { container } = render(<MapRenderer config={baseConfig} subjectOverlords={{}} mapStyle="modern" styleOverrides={{}} colorOverrides={{}} />);
    await waitForMapReady(container);
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).toContain('fill="#d1dbdd"');
  });

  it("adds style-specific class to renderer", async () => {
    const { container } = render(<MapRenderer config={baseConfig} subjectOverlords={{}} mapStyle="modern" styleOverrides={{}} colorOverrides={{}} />);
    await waitForMapReady(container);
    expect(container.querySelector(".map-renderer-modern")).toBeInTheDocument();
  });

  it("resets transform on Reset View click", async () => {
    const { container } = render(<MapRenderer config={baseConfig} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitForMapReady(container);
    const toolbar = container.querySelector(".map-toolbar")! as HTMLElement;
    const viewport = container.querySelector(".map-viewport")!;
    fireEvent.wheel(viewport, { deltaY: -100 });
    fireEvent.click(within(toolbar).getByText("Reset View"));
    expect(within(toolbar).getByText("100%")).toBeInTheDocument();
  });

  it("removes width/height and adds map-svg class", async () => {
    const { container } = render(<MapRenderer config={baseConfig} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitForMapReady(container);
    const svg = container.querySelector(".map-svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute("width")).toBeNull();
    expect(svg?.getAttribute("height")).toBeNull();
  });

  // Style override tests
  it("applies custom defaultFill from overrides", async () => {
    const { container } = render(
      <MapRenderer config={baseConfig} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{ defaultFill: "#aabbcc" }} colorOverrides={{}} />,
    );
    await waitForMapReady(container);
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    expect(html).toContain('fill="#aabbcc"');
  });

  it("applies custom bgColor to viewport inline style", async () => {
    const { container } = render(
      <MapRenderer config={baseConfig} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{ bgColor: "#112233" }} colorOverrides={{}} />,
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
    const { container } = render(<MapRenderer config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
    await waitForMapReady(container);
    const html = container.querySelector(".map-transform")?.innerHTML ?? "";
    // The path had style="fill:#d1dbdd" which would override the fill attribute.
    // After stripping, fill="#ff0000" should take effect.
    expect(html).not.toContain('style=');
    expect(html).toContain('id="Red_Sea_Coast" fill="#ff0000"');
  });

  // Location click tests
  it("fires onProvinceClick with tag on single click", async () => {
    const onClick = vi.fn();
    const config = {
      ...baseConfig,
      groups: { "#ff0000": { label: "ENG - Alice", paths: ["Uppland"] } },
    };
    const { container } = render(
      <MapRenderer config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} onProvinceClick={onClick} />,
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
      <MapRenderer config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} onProvinceClick={onClick} />,
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
      <MapRenderer config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} onProvinceClick={onClick} />,
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
    const { container } = render(<MapRenderer config={baseConfig} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />);
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
      <MapRenderer config={redConfig} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
    );
    await waitForMapReady(container);
    expect(container.querySelector("#Uppland")?.getAttribute("fill")).toBe("#ff0000");
  });

  it("does not refetch the document when only colors change", async () => {
    const { container, rerender } = render(
      <MapRenderer config={redConfig} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
    );
    await waitForMapReady(container);
    const callsAfterLoad = vi.mocked(globalThis.fetch).mock.calls.length;

    rerender(
      <MapRenderer config={redConfig} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{ "#ff0000": "#00ff00" }} />,
    );
    await waitFor(() => {
      expect(container.querySelector("#Uppland")?.getAttribute("fill")).toBe("#00ff00");
    });
    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(callsAfterLoad);
  });

  it("clears a previous owner's color when a location changes hands", async () => {
    const { container, rerender } = render(
      <MapRenderer config={redConfig} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
    );
    await waitForMapReady(container);
    expect(container.querySelector("#Uppland")?.getAttribute("fill")).toBe("#ff0000");

    // Uppland moves to another country; Middlesex takes the red group.
    rerender(
      <MapRenderer
        config={{ ...baseConfig, groups: { "#ff0000": { label: "ENG", paths: ["Middlesex"] } } }}
        subjectOverlords={{}}
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

  it("never applies the old shrink transform, at any outline width", async () => {
    // The shrink existed only to make the per-location outline visible. Left
    // behind, it would leave permanent hairline gaps between provinces.
    const { container, rerender } = render(
      <MapRenderer config={redConfig} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{ outlineWidth: "0.6" }} colorOverrides={{}} />,
    );
    await waitForMapReady(container);
    expect(container.querySelector("#Uppland")?.getAttribute("style") ?? "").not.toContain("scale(0.995)");

    rerender(
      <MapRenderer config={redConfig} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{ outlineWidth: "0" }} colorOverrides={{}} />,
    );
    await waitFor(() => {
      expect(container.querySelector(".outline-layer")).toBeNull();
    });
    expect(container.querySelector("#Uppland")?.getAttribute("style")).toBeNull();
  });

  it("puts stroke-width in a stylesheet scoped away from layered paths", async () => {
    const { container } = render(
      <MapRenderer config={redConfig} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{ outlineWidth: "0.6" }} colorOverrides={{}} />,
    );
    await waitForMapReady(container);

    const css = container.querySelector(".map-svg > style")?.textContent ?? "";
    // Scoped with `>` on purpose: a descendant selector would also beat the
    // border layer's own stroke-width, since author CSS outranks a
    // presentation attribute.
    expect(css).toContain(".map-svg > path");
    expect(css).toContain("stroke-width: 0.15");
  });

  it("shows an error with retry when the document fails to load", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error("offline"));
    const { container } = render(
      <MapRenderer config={redConfig} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
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
      <MapRenderer config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
    );
    await waitForMapReady(container);
    expect(container.querySelector("#Uppland")?.getAttribute("fill")).toBe("#ff0000");
    expect(container.querySelector("#Middlesex")?.getAttribute("fill")).toBe("#e8dcc8");
  });
});

// ---------------------------------------------------------------------------
// Subject hatching: subjects take the OVERLORD's colour, textured.
// ---------------------------------------------------------------------------

describe("MapRenderer — subject hatching", () => {
  const FRA = "#0000ff";
  const LIGHTENED = "#5555ff"; // what the config stores for the overlay

  const patternRefOf = (container: HTMLElement, id: string): string =>
    container.querySelector(`#${id}`)?.getAttribute("fill") ?? "";

  const patternIdFromFill = (fill: string): string =>
    fill.replace(/^url\(#/, "").replace(/\)$/, "");

  it("paints a players-only subject overlay with the overlord's colour", async () => {
    const config: MapChartConfig = {
      ...baseConfig,
      groups: {
        [FRA]: { label: "FRA", paths: ["Uppland"] },
        [LIGHTENED]: { label: "FRA - subjects", paths: ["Middlesex"] },
      },
    };
    const { container } = render(
      <MapRenderer config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
    );
    await waitForMapReady(container);

    const subjectFill = patternRefOf(container, "Middlesex");
    expect(subjectFill).toMatch(/^url\(#/);

    const pattern = container.querySelector(`#${patternIdFromFill(subjectFill)}`);
    expect(pattern).not.toBeNull();
    // The overlord's colour, NOT the lightened shade stored in the config.
    expect(pattern?.innerHTML ?? "").toContain(FRA);
    expect(pattern?.innerHTML ?? "").not.toContain(LIGHTENED);
  });

  it("paints a full-map subject group with its overlord's colour", async () => {
    const config: MapChartConfig = {
      ...baseConfig,
      groups: {
        [FRA]: { label: "FRA", paths: ["Uppland"] },
        "#00ff00": { label: "BUR", paths: ["Middlesex"] },
      },
    };
    const { container } = render(
      <MapRenderer config={config} subjectOverlords={{ BUR: "FRA" }} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
    );
    await waitForMapReady(container);

    const subjectFill = patternRefOf(container, "Middlesex");
    expect(subjectFill).toMatch(/^url\(#/);
    const pattern = container.querySelector(`#${patternIdFromFill(subjectFill)}`);
    expect(pattern?.innerHTML ?? "").toContain(FRA);
  });

  it("leaves directly-held locations on a flat fill", async () => {
    const config: MapChartConfig = {
      ...baseConfig,
      groups: { [FRA]: { label: "FRA", paths: ["Uppland"] } },
    };
    const { container } = render(
      <MapRenderer config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
    );
    await waitForMapReady(container);
    expect(container.querySelector("#Uppland")?.getAttribute("fill")).toBe(FRA);
  });

  it("uses userSpaceOnUse so the hatch does not scale per shape", async () => {
    // The SVG default is objectBoundingBox, which gives one stripe on a small
    // location and dense banding on a large one.
    const config: MapChartConfig = {
      ...baseConfig,
      groups: {
        [FRA]: { label: "FRA", paths: ["Uppland"] },
        [LIGHTENED]: { label: "FRA - subjects", paths: ["Middlesex"] },
      },
    };
    const { container } = render(
      <MapRenderer config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
    );
    await waitForMapReady(container);
    const pattern = container.querySelector("pattern");
    expect(pattern?.getAttribute("patternUnits")).toBe("userSpaceOnUse");
  });

  it("makes the hatch opaque so the ocean cannot show through", async () => {
    // The asset has no background rect; the ocean is a CSS background on the
    // container, so transparent gaps would read as water.
    const config: MapChartConfig = {
      ...baseConfig,
      groups: {
        [FRA]: { label: "FRA", paths: ["Uppland"] },
        [LIGHTENED]: { label: "FRA - subjects", paths: ["Middlesex"] },
      },
    };
    const { container } = render(
      <MapRenderer config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
    );
    await waitForMapReady(container);
    expect(container.querySelector("pattern rect")).not.toBeNull();
  });

  it("gives a hatched path a real stroke, not a url() reference", async () => {
    const config: MapChartConfig = {
      ...baseConfig,
      groups: {
        [FRA]: { label: "FRA", paths: ["Uppland"] },
        [LIGHTENED]: { label: "FRA - subjects", paths: ["Middlesex"] },
      },
    };
    const { container } = render(
      <MapRenderer config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
    );
    await waitForMapReady(container);
    const stroke = container.querySelector("#Middlesex")?.getAttribute("stroke") ?? "";
    expect(stroke).not.toMatch(/^url\(/);
    // And not the overlord's flat fill, or the seam between them vanishes.
    expect(stroke).not.toBe(FRA);
  });

  it("moves the subject hatch when the overlord's colour is overridden", async () => {
    const config: MapChartConfig = {
      ...baseConfig,
      groups: {
        [FRA]: { label: "FRA", paths: ["Uppland"] },
        [LIGHTENED]: { label: "FRA - subjects", paths: ["Middlesex"] },
      },
    };
    const { container, rerender } = render(
      <MapRenderer config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
    );
    await waitForMapReady(container);

    rerender(
      <MapRenderer config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{ [FRA]: "#ff0000" }} />,
    );
    await waitFor(() => {
      expect(container.querySelector("#Uppland")?.getAttribute("fill")).toBe("#ff0000");
    });
    const subjectFill = patternRefOf(container, "Middlesex");
    const pattern = container.querySelector(`#${patternIdFromFill(subjectFill)}`);
    expect(pattern?.innerHTML ?? "").toContain("#ff0000");
  });

  it("does not accumulate pattern definitions across recolors", async () => {
    const config: MapChartConfig = {
      ...baseConfig,
      groups: {
        [FRA]: { label: "FRA", paths: ["Uppland"] },
        [LIGHTENED]: { label: "FRA - subjects", paths: ["Middlesex"] },
      },
    };
    const { container, rerender } = render(
      <MapRenderer config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
    );
    await waitForMapReady(container);
    for (const style of ["modern", "dark", "pastel"] as const) {
      rerender(
        <MapRenderer config={config} subjectOverlords={{}} mapStyle={style} styleOverrides={{}} colorOverrides={{}} />,
      );
    }
    await waitFor(() => {
      expect(container.querySelectorAll("pattern").length).toBeGreaterThan(0);
    });
    expect(container.querySelectorAll("pattern")).toHaveLength(1);
  });

  it("shares one pattern between overlords resolved to the same colour", async () => {
    const config: MapChartConfig = {
      ...baseConfig,
      groups: {
        [FRA]: { label: "FRA", paths: ["Uppland"] },
        [LIGHTENED]: { label: "FRA - subjects", paths: ["Middlesex"] },
        "#0000fe": { label: "ENG", paths: [] },
        "#5555fe": { label: "ENG - subjects", paths: ["Red_Sea_Coast"] },
      },
    };
    const { container } = render(
      <MapRenderer
        config={config}
        subjectOverlords={{}}
        mapStyle="parchment"
        styleOverrides={{}}
        colorOverrides={{ "#0000fe": FRA }}
      />,
    );
    await waitForMapReady(container);
    expect(container.querySelectorAll("pattern")).toHaveLength(1);
  });

  it("falls back to a flat fill when the overlord has no group", async () => {
    const config: MapChartConfig = {
      ...baseConfig,
      groups: { [LIGHTENED]: { label: "GONE - subjects", paths: ["Middlesex"] } },
    };
    const { container } = render(
      <MapRenderer config={config} subjectOverlords={{}} mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
    );
    await waitForMapReady(container);
    expect(container.querySelector("#Middlesex")?.getAttribute("fill")).toBe(LIGHTENED);
  });
});

// =============================================================================
// Fitted opening view
// =============================================================================

describe("fitting the view to player territory", () => {
  const owned: MapChartConfig = {
    ...baseConfig,
    groups: {
      "#ff0000": { label: "ENG - Alice", paths: ["Middlesex"] },
      "#0000ff": { label: "SWE", paths: ["Uppland"] },
    },
  };

  /**
   * jsdom implements neither getBBox nor layout, so without these the fit has
   * nothing to measure and falls back to identity. Stubbing both is what makes
   * the fitted path observable at all — a test that omits them is exercising
   * the fallback, which is asserted separately below.
   */
  const stubGeometry = (boxes: Record<string, [number, number, number, number]>) => {
    const proto = SVGElement.prototype as unknown as Record<string, unknown>;
    const hadBBox = "getBBox" in proto;
    const priorBBox = proto.getBBox;
    proto.getBBox = function (this: SVGElement) {
      const box = boxes[this.id];
      if (!box) throw new Error("no geometry");
      return { x: box[0], y: box[1], width: box[2], height: box[3] };
    };

    const priorW = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const priorH = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 600 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 340 });

    return () => {
      if (hadBBox) proto.getBBox = priorBBox;
      else delete proto.getBBox;
      if (priorW) Object.defineProperty(HTMLElement.prototype, "clientWidth", priorW);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
      if (priorH) Object.defineProperty(HTMLElement.prototype, "clientHeight", priorH);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
    };
  };

  const zoomText = (container: HTMLElement) =>
    container.querySelector(".zoom-level")?.textContent ?? "";

  it("opens zoomed in on the player's territory", async () => {
    // Middlesex occupies a small corner, so framing it magnifies the view.
    const restore = stubGeometry({ Middlesex: [100, 100, 60, 40] });
    try {
      const { container } = render(
        <MapRenderer config={owned} subjectOverlords={{}} playerPaths={["Middlesex"]}
          mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
      );
      await waitForMapReady(container);
      await waitFor(() => {
        expect(zoomText(container)).not.toBe("100%");
      });
      expect(parseInt(zoomText(container), 10)).toBeGreaterThan(100);
    } finally {
      restore();
    }
  });

  it("frames both players when there are several", async () => {
    const restore = stubGeometry({ Middlesex: [100, 100, 50, 50], Uppland: [900, 400, 50, 50] });
    try {
      const { container } = render(
        <MapRenderer config={owned} subjectOverlords={{}} playerPaths={["Middlesex", "Uppland"]}
          mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
      );
      await waitForMapReady(container);
      // A region spanning most of the map cannot magnify as much as one corner.
      await waitFor(() => expect(zoomText(container)).not.toBe(""));
      expect(parseInt(zoomText(container), 10)).toBeLessThan(200);
    } finally {
      restore();
    }
  });

  it("returns to the fitted view on Reset View, not to 100%", async () => {
    const restore = stubGeometry({ Middlesex: [100, 100, 60, 40] });
    try {
      const { container } = render(
        <MapRenderer config={owned} subjectOverlords={{}} playerPaths={["Middlesex"]}
          mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
      );
      await waitForMapReady(container);
      await waitFor(() => expect(zoomText(container)).not.toBe("100%"));
      const fitted = zoomText(container);

      const viewport = container.querySelector(".map-viewport")!;
      fireEvent.wheel(viewport, { deltaY: 100, clientX: 10, clientY: 10 });
      await waitFor(() => expect(zoomText(container)).not.toBe(fitted));

      fireEvent.click(within(container).getByText("Reset View"));
      await waitFor(() => expect(zoomText(container)).toBe(fitted));
    } finally {
      restore();
    }
  });

  it("opens on the whole map when the save has no players", async () => {
    const restore = stubGeometry({ Middlesex: [100, 100, 60, 40] });
    try {
      const { container } = render(
        <MapRenderer config={owned} subjectOverlords={{}} playerPaths={[]}
          mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
      );
      await waitForMapReady(container);
      expect(zoomText(container)).toBe("100%");
    } finally {
      restore();
    }
  });

  it("opens on the whole map when player paths name ids the asset lacks", async () => {
    const restore = stubGeometry({ Middlesex: [100, 100, 60, 40] });
    try {
      const { container } = render(
        <MapRenderer config={owned} subjectOverlords={{}} playerPaths={["Nowhere_At_All"]}
          mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
      );
      await waitForMapReady(container);
      expect(zoomText(container)).toBe("100%");
    } finally {
      restore();
    }
  });

  it("opens on the whole map when geometry cannot be measured", async () => {
    // No stub at all: jsdom's own behaviour. The fit must degrade rather than
    // throw, which is what keeps the component usable in this environment.
    const { container } = render(
      <MapRenderer config={owned} subjectOverlords={{}} playerPaths={["Middlesex"]}
        mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
    );
    await waitForMapReady(container);
    expect(zoomText(container)).toBe("100%");
  });

  it("gives a single tiny holding surrounding context instead of filling the frame", async () => {
    // framedRegion widens below its floor, so a one-province player gets the
    // minimum region rather than a wall of colour at maximum zoom.
    const restore = stubGeometry({ Middlesex: [600, 340, 0.5, 0.5] });
    try {
      const { container } = render(
        <MapRenderer config={owned} subjectOverlords={{}} playerPaths={["Middlesex"]}
          mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
      );
      await waitForMapReady(container);
      // Minimum region is a quarter of the map's width: 300 units against a
      // 600px viewport at 0.5 px/unit fits at 4x.
      await waitFor(() => expect(zoomText(container)).toBe("400%"));
    } finally {
      restore();
    }
  });

  it("does not re-frame when only the style changes", async () => {
    const restore = stubGeometry({ Middlesex: [100, 100, 60, 40] });
    try {
      const { container, rerender } = render(
        <MapRenderer config={owned} subjectOverlords={{}} playerPaths={["Middlesex"]}
          mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
      );
      await waitForMapReady(container);
      await waitFor(() => expect(zoomText(container)).not.toBe("100%"));

      // Pan away, then change style: the view must stay where the user put it.
      const viewport = container.querySelector(".map-viewport")!;
      fireEvent.wheel(viewport, { deltaY: 100, clientX: 10, clientY: 10 });
      await waitFor(() => expect(zoomText(container)).not.toBe(""));
      const afterPan = zoomText(container);

      rerender(
        <MapRenderer config={owned} subjectOverlords={{}} playerPaths={["Middlesex"]}
          mapStyle="dark" styleOverrides={{ outlineWidth: "0.6" }} colorOverrides={{}} />,
      );
      // The dark preset repaints unowned land, which is the signal that the
      // recolor pass has run under the new style.
      await waitFor(() => {
        expect(container.querySelector("#Uppland")?.getAttribute("fill")).not.toBe("#e8dcc8");
      });
      expect(zoomText(container)).toBe(afterPan);
    } finally {
      restore();
    }
  });

  it("re-frames when a different save's players arrive", async () => {
    const restore = stubGeometry({ Middlesex: [100, 100, 60, 40], Uppland: [0, 0, 1100, 600] });
    try {
      const { container, rerender } = render(
        <MapRenderer config={owned} subjectOverlords={{}} playerPaths={["Middlesex"]}
          mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
      );
      await waitForMapReady(container);
      await waitFor(() => expect(zoomText(container)).not.toBe("100%"));
      const first = zoomText(container);

      rerender(
        <MapRenderer config={owned} subjectOverlords={{}} playerPaths={["Uppland"]}
          mapStyle="parchment" styleOverrides={{}} colorOverrides={{}} />,
      );
      await waitFor(() => expect(zoomText(container)).not.toBe(first));
    } finally {
      restore();
    }
  });

  it("still paints correctly at the fitted scale", async () => {
    // The fit and the recolor are separate effects; neither may clobber the
    // other's work.
    const restore = stubGeometry({ Middlesex: [100, 100, 60, 40] });
    try {
      const { container } = render(
        <MapRenderer config={owned} subjectOverlords={{}} playerPaths={["Middlesex"]}
          mapStyle="parchment" styleOverrides={{ outlineWidth: "0.6" }} colorOverrides={{}} />,
      );
      await waitForMapReady(container);
      await waitFor(() => expect(zoomText(container)).not.toBe("100%"));
      expect(container.querySelector("#Middlesex")?.getAttribute("fill")).toBe("#ff0000");
      expect(container.querySelector("#Uppland")?.getAttribute("fill")).toBe("#0000ff");
    } finally {
      restore();
    }
  });
});

// =============================================================================
// Country border outlines
// =============================================================================

describe("country borders", () => {
  /**
   * Four locations in a row, each a walked square so consecutive vertices sit
   * along the shared edges rather than only at corners:
   *
   *   Alpha | Bravo | Charlie | Delta
   */
  const squareData = (x: number, size: number) => {
    const pts: string[] = [];
    for (let i = 0; i < size; i++) pts.push(`${x + i} 0`);
    for (let i = 0; i < size; i++) pts.push(`${x + size} ${i}`);
    for (let i = size; i > 0; i--) pts.push(`${x + i} ${size}`);
    for (let i = size; i > 0; i--) pts.push(`${x} ${i}`);
    return `M${pts.join("L")}Z`;
  };

  const borderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path id="Alpha" fill="#d1dbdd" d="${squareData(0, 10)}"/>
    <path id="Bravo" fill="#d1dbdd" d="${squareData(10, 10)}"/>
    <path id="Charlie" fill="#d1dbdd" d="${squareData(20, 10)}"/>
    <path id="Delta" fill="#d1dbdd" d="${squareData(30, 10)}"/>
  </svg>`;

  const IDS = ["Alpha", "Bravo", "Charlie", "Delta"];
  const CHAIN = [[1], [0, 2], [1, 3], [2]];

  const ownershipOf = (
    owners: Record<string, string>,
    players: string[],
  ) => ({
    ownerByPath: new Map(Object.entries(owners)),
    playerTags: new Set(players),
  });

  const config = (paths: string[]): MapChartConfig => ({
    ...baseConfig,
    groups: { "#ff0000": { label: "SWE - Alice", paths } },
  });

  const renderBorders = (
    owners: Record<string, string>,
    players: string[],
    overrides: Record<string, string> = { outlineWidth: "0.6" },
  ) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      text: () => Promise.resolve(borderSvg),
    } as Response);
    return render(
      <MapRenderer
        config={config(["Alpha"])}
        subjectOverlords={{}}
        borderOwnership={ownershipOf(owners, players)}
        adjacency={CHAIN}
        adjacencyIds={IDS}
        mapStyle="parchment"
        styleOverrides={overrides}
        colorOverrides={{}}
      />,
    );
  };

  const borderPaths = (container: HTMLElement) =>
    container.querySelectorAll(".border-layer path");

  /** Every x coordinate in the drawn border data. */
  const drawnXs = (container: HTMLElement): number[] => {
    const d = borderPaths(container)[0]?.getAttribute("d") ?? "";
    return [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => parseFloat(m[1]));
  };

  /** Drawn segments running along the vertical line x = at. */
  const drawnEdgesAlongX = (container: HTMLElement, at: number): number => {
    const d = borderPaths(container)[0]?.getAttribute("d") ?? "";
    return d.split("M").reduce((total, subpath) => {
      const xs = [...subpath.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => parseFloat(m[1]));
      return total + xs.filter((x, i) => i > 0 && x === at && xs[i - 1] === at).length;
    }, 0);
  };

  /** The x = 10 line is where Alpha and Bravo meet. */
  const SHARED_EDGE_X = 10;

  it("draws a border between a player and an adjacent AI", async () => {
    const { container } = renderBorders({ Alpha: "SWE", Bravo: "AI1" }, ["SWE"]);
    await waitForMapReady(container);
    await waitFor(() => expect(borderPaths(container).length).toBeGreaterThan(0));
  });

  it("strokes the border with the configured colour and width", async () => {
    const { container } = renderBorders({ Alpha: "SWE", Bravo: "AI1" }, ["SWE"], {
      outlineWidth: "0.6",
      outlineColor: "#ff00ff",
    });
    await waitForMapReady(container);
    await waitFor(() => expect(borderPaths(container).length).toBeGreaterThan(0));
    const path = borderPaths(container)[0];
    expect(path.getAttribute("stroke")).toBe("#ff00ff");
    expect(path.getAttribute("stroke-width")).toBe("0.6");
    expect(path.getAttribute("fill")).toBe("none");
  });

  it("draws nothing at width 0", async () => {
    const { container } = renderBorders({ Alpha: "SWE", Bravo: "AI1" }, ["SWE"], {
      outlineWidth: "0",
    });
    await waitForMapReady(container);
    expect(container.querySelector(".border-layer")).toBeNull();
  });

  it("draws nothing on a country's internal edges", async () => {
    // Both are SWE, so their shared edge carries no line — though their
    // seaward edges are coast and do, right up to the corners of it.
    const { container } = renderBorders({ Alpha: "SWE", Bravo: "SWE" }, ["SWE"]);
    await waitForMapReady(container);
    await waitFor(() => expect(borderPaths(container).length).toBeGreaterThan(0));
    expect(drawnEdgesAlongX(container, SHARED_EDGE_X)).toBe(0);
  });

  it("draws nothing against unclaimed land", async () => {
    // Bravo has no owner. Alpha's edge with it stays bare, while Alpha's
    // seaward edges are coast — wilderness and sea are not the same thing.
    const { container } = renderBorders({ Alpha: "SWE" }, ["SWE"]);
    await waitForMapReady(container);
    await waitFor(() => expect(borderPaths(container).length).toBeGreaterThan(0));
    expect(drawnEdgesAlongX(container, SHARED_EDGE_X)).toBe(0);
  });

  it("draws the coastline of player territory", async () => {
    // Alpha's far edge (x = 0) touches no neighbour, so it faces the sea.
    const { container } = renderBorders({ Alpha: "SWE", Bravo: "AI1" }, ["SWE"]);
    await waitForMapReady(container);
    await waitFor(() => expect(borderPaths(container).length).toBeGreaterThan(0));
    expect(drawnXs(container)).toContain(0);
  });

  it("does not draw an AI country's coastline", async () => {
    // Charlie is AI-held and touches nothing to its east, but its coast is not
    // ours to draw — in playersOnly mode it is not even painted.
    const { container } = renderBorders({ Alpha: "SWE", Bravo: "AI1", Charlie: "AI1" }, ["SWE"]);
    await waitForMapReady(container);
    await waitFor(() => expect(borderPaths(container).length).toBeGreaterThan(0));
    expect(Math.max(...drawnXs(container))).toBeLessThanOrEqual(SHARED_EDGE_X);
  });

  it("draws nothing between two AI countries", async () => {
    const { container } = renderBorders({ Bravo: "AI1", Charlie: "AI2" }, ["SWE"]);
    await waitForMapReady(container);
    expect(borderPaths(container).length).toBe(0);
  });

  it("draws nothing for a save with no players", async () => {
    const { container } = renderBorders({ Alpha: "SWE", Bravo: "AI1" }, []);
    await waitForMapReady(container);
    expect(borderPaths(container).length).toBe(0);
  });

  it("no longer outlines every location", async () => {
    // The old outline cloned every coloured path and shrank each fill so the
    // stroke showed at every edge. Both must be gone.
    const { container } = renderBorders({ Alpha: "SWE", Bravo: "AI1" }, ["SWE"]);
    await waitForMapReady(container);
    expect(container.querySelector(".outline-layer")).toBeNull();
    expect(container.querySelector("#Alpha")?.getAttribute("style") ?? "").not.toContain(
      "scale(0.995)",
    );
  });

  it("keeps exactly one border layer across repeated recolors", async () => {
    const { container, rerender } = renderBorders({ Alpha: "SWE", Bravo: "AI1" }, ["SWE"]);
    await waitForMapReady(container);
    await waitFor(() => expect(borderPaths(container).length).toBeGreaterThan(0));
    const before = borderPaths(container).length;

    // The width is a live slider, so one drag fires many recolors.
    for (const w of ["0.7", "0.8", "0.9"]) {
      rerender(
        <MapRenderer
          config={config(["Alpha"])}
          subjectOverlords={{}}
          borderOwnership={ownershipOf({ Alpha: "SWE", Bravo: "AI1" }, ["SWE"])}
          adjacency={CHAIN}
          adjacencyIds={IDS}
          mapStyle="parchment"
          styleOverrides={{ outlineWidth: w }}
          colorOverrides={{}}
        />,
      );
    }
    await waitFor(() => {
      expect(borderPaths(container)[0]?.getAttribute("stroke-width")).toBe("0.9");
    });
    expect(container.querySelectorAll(".border-layer")).toHaveLength(1);
    expect(borderPaths(container).length).toBe(before);
  });

  it("removes the layer when the width returns to 0", async () => {
    const { container, rerender } = renderBorders({ Alpha: "SWE", Bravo: "AI1" }, ["SWE"]);
    await waitForMapReady(container);
    await waitFor(() => expect(borderPaths(container).length).toBeGreaterThan(0));

    rerender(
      <MapRenderer
        config={config(["Alpha"])}
        subjectOverlords={{}}
        borderOwnership={ownershipOf({ Alpha: "SWE", Bravo: "AI1" }, ["SWE"])}
        adjacency={CHAIN}
        adjacencyIds={IDS}
        mapStyle="parchment"
        styleOverrides={{ outlineWidth: "0" }}
        colorOverrides={{}}
      />,
    );
    await waitFor(() => expect(container.querySelector(".border-layer")).toBeNull());
  });

  it("leaves the fills alone", async () => {
    const { container } = renderBorders({ Alpha: "SWE", Bravo: "AI1" }, ["SWE"]);
    await waitForMapReady(container);
    await waitFor(() => expect(borderPaths(container).length).toBeGreaterThan(0));
    expect(container.querySelector("#Alpha")?.getAttribute("fill")).toBe("#ff0000");
    expect(container.querySelector("#Bravo")?.getAttribute("fill")).toBe("#e8dcc8");
  });

  it("survives a style preset change", async () => {
    const { container, rerender } = renderBorders({ Alpha: "SWE", Bravo: "AI1" }, ["SWE"]);
    await waitForMapReady(container);
    await waitFor(() => expect(borderPaths(container).length).toBeGreaterThan(0));

    rerender(
      <MapRenderer
        config={config(["Alpha"])}
        subjectOverlords={{}}
        borderOwnership={ownershipOf({ Alpha: "SWE", Bravo: "AI1" }, ["SWE"])}
        adjacency={CHAIN}
        adjacencyIds={IDS}
        mapStyle="dark"
        styleOverrides={{ outlineWidth: "0.6" }}
        colorOverrides={{}}
      />,
    );
    await waitFor(() => expect(borderPaths(container).length).toBeGreaterThan(0));
  });

  it("puts the border inside a group so the location stroke-width rule misses it", async () => {
    // .map-svg > path sets the location stroke width; a direct child would be
    // overridden by it, since author CSS beats presentation attributes.
    const { container } = renderBorders({ Alpha: "SWE", Bravo: "AI1" }, ["SWE"]);
    await waitForMapReady(container);
    await waitFor(() => expect(borderPaths(container).length).toBeGreaterThan(0));
    expect(container.querySelectorAll(".map-svg > path.border-line")).toHaveLength(0);
    expect(container.querySelector(".map-svg > .border-layer")).not.toBeNull();
  });

  it("draws nothing when the adjacency graph is empty", async () => {
    // A failed chunk load resolves to an empty graph.
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      text: () => Promise.resolve(borderSvg),
    } as Response);
    const { container } = render(
      <MapRenderer
        config={config(["Alpha"])}
        subjectOverlords={{}}
        borderOwnership={ownershipOf({ Alpha: "SWE", Bravo: "AI1" }, ["SWE"])}
        adjacency={[]}
        adjacencyIds={IDS}
        mapStyle="parchment"
        styleOverrides={{ outlineWidth: "0.6" }}
        colorOverrides={{}}
      />,
    );
    await waitForMapReady(container);
    expect(borderPaths(container).length).toBe(0);
  });
});
