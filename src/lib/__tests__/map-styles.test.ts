import { describe, it, expect } from "vitest";
import {
  getStyleConfig,
  getBaseStyleConfig,
  mergeStyleOverrides,
  hasCustomOverrides,
  styleDisplayLabel,
  EDITABLE_COLOR_KEYS,
  STYLE_FIELD_LABELS,
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
    expect(config.bgColor).toBe("#b8c8c8");
    expect(config.legendBg).toBe("#f0e0c0");
    expect(config.outlineColor).toBe("#000000");
    expect(config.outlineWidth).toBe("0.6");
  });

  it("returns modern config for modern style", () => {
    const config = getStyleConfig("modern");
    expect(config.defaultFill).toBe("#d1dbdd");
    expect(config.bgColor).toBe("#a8c4d4");
    expect(config.legendBg).toBe("#1e1e2e");
    expect(config.outlineColor).toBe("#000000");
    expect(config.outlineWidth).toBe("0.6");
  });

  it("includes viewport class for parchment", () => {
    expect(getStyleConfig("parchment").viewportClass).toContain("parchment");
  });

  it("includes viewport class for modern", () => {
    expect(getStyleConfig("modern").viewportClass).toContain("modern");
  });

  it("applies overrides when provided", () => {
    const config = getStyleConfig("parchment", { bgColor: "#ff0000" });
    expect(config.bgColor).toBe("#ff0000");
    expect(config.defaultFill).toBe("#e8dcc8"); // unchanged
  });

  it("returns base config when overrides is undefined", () => {
    const config = getStyleConfig("parchment", undefined);
    expect(config.bgColor).toBe("#b8c8c8");
  });

  it("returns base config when overrides is empty", () => {
    const config = getStyleConfig("parchment", {});
    expect(config.bgColor).toBe("#b8c8c8");
  });
});

describe("getBaseStyleConfig", () => {
  it("returns parchment base", () => {
    expect(getBaseStyleConfig("parchment").bgColor).toBe("#b8c8c8");
  });

  it("returns modern base", () => {
    expect(getBaseStyleConfig("modern").bgColor).toBe("#a8c4d4");
  });
});

describe("mergeStyleOverrides", () => {
  it("applies overrides to base", () => {
    const base = getBaseStyleConfig("parchment");
    const merged = mergeStyleOverrides(base, { bgColor: "#aabbcc" });
    expect(merged.bgColor).toBe("#aabbcc");
    expect(merged.defaultFill).toBe("#e8dcc8");
  });

  it("preserves non-editable fields", () => {
    const base = getBaseStyleConfig("parchment");
    const merged = mergeStyleOverrides(base, { bgColor: "#aabbcc" });
    expect(merged.stroke).toBe(base.stroke);
    expect(merged.strokeWidth).toBe(base.strokeWidth);
    expect(merged.viewportClass).toBe(base.viewportClass);
    expect(merged.countColor).toBe(base.countColor);
  });

  it("handles empty overrides", () => {
    const base = getBaseStyleConfig("modern");
    const merged = mergeStyleOverrides(base, {});
    expect(merged).toEqual(base);
  });
});

describe("hasCustomOverrides", () => {
  it("returns false for empty overrides", () => {
    const base = getBaseStyleConfig("parchment");
    expect(hasCustomOverrides(base, {})).toBe(false);
  });

  it("returns false when override matches base", () => {
    const base = getBaseStyleConfig("parchment");
    expect(hasCustomOverrides(base, { bgColor: base.bgColor })).toBe(false);
  });

  it("returns true when override differs from base", () => {
    const base = getBaseStyleConfig("parchment");
    expect(hasCustomOverrides(base, { bgColor: "#ff0000" })).toBe(true);
  });

  it("returns true when any one field differs", () => {
    const base = getBaseStyleConfig("parchment");
    expect(hasCustomOverrides(base, {
      bgColor: base.bgColor,
      legendBorder: "#ffffff",
    })).toBe(true);
  });

});

describe("styleDisplayLabel", () => {
  it("returns Parchment for unmodified parchment", () => {
    expect(styleDisplayLabel("parchment", {})).toBe("Parchment");
  });

  it("returns Modern for unmodified modern", () => {
    expect(styleDisplayLabel("modern", {})).toBe("Modern");
  });

  it("returns Custom when overrides differ", () => {
    expect(styleDisplayLabel("parchment", { bgColor: "#000000" })).toBe("Custom");
  });

  it("returns Parchment when overrides match base", () => {
    expect(styleDisplayLabel("parchment", { bgColor: "#b8c8c8" })).toBe("Parchment");
  });
});

describe("hasCustomOverrides with outline", () => {
  it("detects custom outlineColor", () => {
    const base = getBaseStyleConfig("parchment");
    expect(hasCustomOverrides(base, { outlineColor: "#ff0000" })).toBe(true);
  });

  it("detects custom outlineWidth", () => {
    const base = getBaseStyleConfig("parchment");
    expect(hasCustomOverrides(base, { outlineWidth: "1.5" })).toBe(true);
  });

  it("returns false when outlineWidth matches base", () => {
    const base = getBaseStyleConfig("parchment");
    expect(hasCustomOverrides(base, { outlineWidth: "0.6" })).toBe(false);
  });


});

describe("EDITABLE_COLOR_KEYS", () => {
  it("contains expected keys", () => {
    expect(EDITABLE_COLOR_KEYS).toContain("bgColor");
    expect(EDITABLE_COLOR_KEYS).toContain("defaultFill");
    expect(EDITABLE_COLOR_KEYS).toContain("legendBg");
    expect(EDITABLE_COLOR_KEYS).toContain("legendBorder");
    expect(EDITABLE_COLOR_KEYS).toContain("titleColor");
    expect(EDITABLE_COLOR_KEYS).toContain("labelColor");
    expect(EDITABLE_COLOR_KEYS).toContain("outlineColor");
  });
});

describe("STYLE_FIELD_LABELS", () => {
  it("has a label for every editable key", () => {
    for (const key of EDITABLE_COLOR_KEYS) {
      expect(STYLE_FIELD_LABELS[key]).toBeDefined();
      expect(typeof STYLE_FIELD_LABELS[key]).toBe("string");
    }
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
