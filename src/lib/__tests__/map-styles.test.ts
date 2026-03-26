import { describe, it, expect } from "vitest";
import {
  getStyleConfig,
  IDENTITY_TRANSFORM,
  clampScale,
  zoomDelta,
  zoomTowardCursor,
  panTransform,
  transformCss,
  zoomPercent,
  parseViewBox,
  getMapDimensions,
  computeDownloadLayout,
} from "../map-styles";

// =============================================================================
// Style configuration
// =============================================================================

describe("getStyleConfig", () => {
  it("returns parchment config for parchment style", () => {
    const config = getStyleConfig("parchment");
    expect(config.defaultFill).toBe("#e8dcc8");
    expect(config.stroke).toBe("match-fill");
    expect(config.bgColor).toBe("#b8c8c8");
    expect(config.legendBg).toBe("#f0e0c0");
  });

  it("returns modern config for modern style", () => {
    const config = getStyleConfig("modern");
    expect(config.defaultFill).toBe("#d1dbdd");
    expect(config.stroke).toBe("match-fill");
    expect(config.bgColor).toBe("#a8c4d4");
    expect(config.legendBg).toBe("#1e1e2e");
  });

  it("includes viewport class for parchment", () => {
    expect(getStyleConfig("parchment").viewportClass).toContain("parchment");
  });

  it("includes viewport class for modern", () => {
    expect(getStyleConfig("modern").viewportClass).toContain("modern");
  });
});

// =============================================================================
// Zoom / transform helpers
// =============================================================================

describe("clampScale", () => {
  it("clamps below minimum to 0.5", () => {
    expect(clampScale(0.1)).toBe(0.5);
  });

  it("clamps above maximum to 20", () => {
    expect(clampScale(25)).toBe(20);
  });

  it("passes through values in range", () => {
    expect(clampScale(5)).toBe(5);
  });

  it("returns 0.5 for zero", () => {
    expect(clampScale(0)).toBe(0.5);
  });

  it("returns 20 for exactly 20", () => {
    expect(clampScale(20)).toBe(20);
  });
});

describe("zoomDelta", () => {
  it("returns 0.9 for positive deltaY (zoom out)", () => {
    expect(zoomDelta(100)).toBe(0.9);
  });

  it("returns 1.1 for negative deltaY (zoom in)", () => {
    expect(zoomDelta(-100)).toBe(1.1);
  });

  it("returns 1.1 for zero deltaY", () => {
    expect(zoomDelta(0)).toBe(1.1);
  });
});

describe("zoomTowardCursor", () => {
  it("zooms in toward cursor position", () => {
    const result = zoomTowardCursor(IDENTITY_TRANSFORM, -100, 500, 300);
    expect(result.scale).toBeCloseTo(1.1);
    expect(result.x).not.toBe(0);
    expect(result.y).not.toBe(0);
  });

  it("zooms out from cursor position", () => {
    const prev = { x: 0, y: 0, scale: 2 };
    const result = zoomTowardCursor(prev, 100, 500, 300);
    expect(result.scale).toBeCloseTo(1.8);
  });

  it("clamps scale at minimum", () => {
    const prev = { x: 0, y: 0, scale: 0.55 };
    const result = zoomTowardCursor(prev, 100, 0, 0);
    expect(result.scale).toBe(0.5);
  });

  it("clamps scale at maximum", () => {
    const prev = { x: 0, y: 0, scale: 19 };
    const result = zoomTowardCursor(prev, -100, 0, 0);
    expect(result.scale).toBe(20);
  });

  it("preserves cursor as fixed point", () => {
    const prev = { x: 100, y: 50, scale: 1 };
    const cx = 400;
    const cy = 200;
    const result = zoomTowardCursor(prev, -100, cx, cy);
    // The cursor point should map to the same world coordinate before and after zoom
    const worldXBefore = (cx - prev.x) / prev.scale;
    const worldXAfter = (cx - result.x) / result.scale;
    expect(worldXBefore).toBeCloseTo(worldXAfter, 5);
  });
});

describe("panTransform", () => {
  it("applies drag offset to origin", () => {
    const origin = { x: 10, y: 20, scale: 1.5 };
    const result = panTransform(origin, 100, 200, 150, 250);
    expect(result.x).toBe(60);
    expect(result.y).toBe(70);
    expect(result.scale).toBe(1.5);
  });

  it("handles zero movement", () => {
    const origin = { x: 5, y: 10, scale: 2 };
    const result = panTransform(origin, 100, 100, 100, 100);
    expect(result).toEqual(origin);
  });

  it("handles negative drag", () => {
    const origin = { x: 0, y: 0, scale: 1 };
    const result = panTransform(origin, 200, 200, 100, 100);
    expect(result.x).toBe(-100);
    expect(result.y).toBe(-100);
  });
});

describe("transformCss", () => {
  it("formats identity transform", () => {
    expect(transformCss(IDENTITY_TRANSFORM)).toBe("translate(0px, 0px) scale(1)");
  });

  it("formats non-zero transform", () => {
    expect(transformCss({ x: 50, y: -30, scale: 2.5 })).toBe("translate(50px, -30px) scale(2.5)");
  });
});

describe("zoomPercent", () => {
  it("formats 1 as 100%", () => {
    expect(zoomPercent(1)).toBe("100%");
  });

  it("formats 2.5 as 250%", () => {
    expect(zoomPercent(2.5)).toBe("250%");
  });

  it("rounds fractional percentages", () => {
    expect(zoomPercent(1.333)).toBe("133%");
  });
});

describe("IDENTITY_TRANSFORM", () => {
  it("has zero offset and scale 1", () => {
    expect(IDENTITY_TRANSFORM).toEqual({ x: 0, y: 0, scale: 1 });
  });
});

// =============================================================================
// SVG viewBox helpers
// =============================================================================

describe("parseViewBox", () => {
  it("parses standard viewBox", () => {
    expect(parseViewBox("0 0 1200 680")).toEqual({ width: 1200, height: 680 });
  });

  it("ignores x/y offset", () => {
    expect(parseViewBox("10 20 800 600")).toEqual({ width: 800, height: 600 });
  });

  it("returns defaults for invalid viewBox", () => {
    expect(parseViewBox("")).toEqual({ width: 1200, height: 680 });
  });

  it("returns defaults for zero dimensions", () => {
    expect(parseViewBox("0 0 0 0")).toEqual({ width: 1200, height: 680 });
  });

  it("returns defaults for partial viewBox", () => {
    expect(parseViewBox("0 0")).toEqual({ width: 1200, height: 680 });
  });
});

describe("getMapDimensions", () => {
  it("parses provided viewBox", () => {
    expect(getMapDimensions("0 0 1000 500")).toEqual({ width: 1000, height: 500 });
  });

  it("returns defaults for undefined", () => {
    expect(getMapDimensions(undefined)).toEqual({ width: 1200, height: 680 });
  });
});

// =============================================================================
// Download layout helpers
// =============================================================================

describe("computeDownloadLayout", () => {
  it("computes layout with legend", () => {
    const layout = computeDownloadLayout({ width: 1200, height: 680 }, true, 2);
    expect(layout.canvasWidth).toBe(3000); // (1200 + 300) * 2
    expect(layout.canvasHeight).toBe(1360); // 680 * 2
    expect(layout.mapWidth).toBe(1200);
    expect(layout.mapHeight).toBe(680);
    expect(layout.legendX).toBe(2420); // 1200 * 2 + 20
    expect(layout.legendY).toBe(20);
    expect(layout.legendWidth).toBe(520); // (300 - 40) * 2
    expect(layout.legendHeight).toBe(1320); // 1360 - 40
    expect(layout.scale).toBe(2);
    expect(layout.hasLegend).toBe(true);
  });

  it("computes layout without legend", () => {
    const layout = computeDownloadLayout({ width: 1200, height: 680 }, false, 2);
    expect(layout.canvasWidth).toBe(2400); // 1200 * 2
    expect(layout.canvasHeight).toBe(1360);
    expect(layout.hasLegend).toBe(false);
  });

  it("scales correctly at 1x", () => {
    const layout = computeDownloadLayout({ width: 800, height: 400 }, true, 1);
    expect(layout.canvasWidth).toBe(1100); // (800 + 300) * 1
    expect(layout.canvasHeight).toBe(400);
    expect(layout.legendX).toBe(820); // 800 * 1 + 20
  });

  it("handles custom dimensions", () => {
    const layout = computeDownloadLayout({ width: 500, height: 300 }, false, 3);
    expect(layout.canvasWidth).toBe(1500);
    expect(layout.canvasHeight).toBe(900);
  });
});
