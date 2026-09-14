import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const loadAdjacency = vi.hoisted(() => vi.fn(async () => [[1], [0]] as const));
vi.mock("../../lib/location-adjacency", () => ({ loadAdjacency }));

/**
 * Capture what MapTab hands the renderer.
 *
 * MapRenderer decides whether to re-extract border geometry by comparing the
 * ownership object it was given by *reference* — extraction costs over a
 * second on a large save. A memo that rebuilds the object on every render
 * would pay that on every colour tweak, and no DOM assertion can see the
 * difference. So the prop itself is the thing under test.
 */
const seen: { ownership: unknown[]; fills: unknown[] } = { ownership: [], fills: [] };
vi.mock("../MapRenderer", () => ({
  MapRenderer: (props: Record<string, unknown>) => {
    seen.ownership.push(props.borderOwnership);
    seen.fills.push(props.wastelandFills);
    return <div className="map-renderer-stub" />;
  },
}));

import { render, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { MapTab } from "../MapTab";
import type { MapChartConfig } from "../../lib/types";

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

const IDS = ["Uppland", "Kolyma_Wasteland"];

const ownership = {
  ownerByPath: new Map([["Uppland", "ENG"]]),
  playerTags: new Set(["ENG"]),
};

const renderTab = () =>
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
    />,
  );

const last = <T,>(xs: readonly T[]): T => xs[xs.length - 1];

beforeEach(() => {
  seen.ownership = [];
  seen.fills = [];
});

afterEach(() => {
  cleanup();
});

describe("MapTab — what the renderer is handed", () => {
  it("extends ownership with the wastelands the fill claimed", async () => {
    const { container } = renderTab();
    await waitFor(() => {
      expect(last(seen.fills)).toEqual({ Kolyma_Wasteland: "ENG" });
    });
    const extended = last(seen.ownership) as typeof ownership;
    // The enclave counts as English territory for the outline, so the border
    // wraps it instead of breaking at it.
    expect(extended.ownerByPath.get("Kolyma_Wasteland")).toBe("ENG");
    expect(extended.ownerByPath.get("Uppland")).toBe("ENG");
    expect(container.querySelector(".map-renderer-stub")).not.toBeNull();
  });

  it("leaves the save's own ownership untouched", async () => {
    renderTab();
    await waitFor(() => {
      expect(last(seen.fills)).toEqual({ Kolyma_Wasteland: "ENG" });
    });
    // Extended by copy: the object the export built still describes only what
    // countries actually own.
    expect(ownership.ownerByPath.has("Kolyma_Wasteland")).toBe(false);
  });

  it("keeps the same ownership object across an unrelated re-render", async () => {
    const { container } = renderTab();
    await waitFor(() => {
      expect(last(seen.fills)).toEqual({ Kolyma_Wasteland: "ENG" });
    });
    const beforeOwnership = last(seen.ownership);
    const beforeFills = last(seen.fills);

    const colorInput = container.querySelector(".style-color-input") as HTMLInputElement;
    fireEvent.change(colorInput, { target: { value: "#123456" } });
    await waitFor(() => {
      expect(seen.ownership.length).toBeGreaterThan(1);
    });

    // Identity, not equality: a fresh-but-equal object would cost a full
    // border re-extraction on every colour tweak, and a fresh fills object
    // would re-run the whole recolor pass with it.
    expect(last(seen.ownership)).toBe(beforeOwnership);
    expect(last(seen.fills)).toBe(beforeFills);
  });

  it("hands over the save's own ownership when the fill is switched off", async () => {
    const { container } = renderTab();
    await waitFor(() => {
      expect(last(seen.fills)).toEqual({ Kolyma_Wasteland: "ENG" });
    });

    const toggle = container.querySelector(
      ".toolbar-controls input[type=checkbox]",
    ) as HTMLInputElement;
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(last(seen.fills)).toEqual({});
    });
    // Not a copy of it — the very object, so nothing re-extracts.
    expect(last(seen.ownership)).toBe(ownership);
  });
});
