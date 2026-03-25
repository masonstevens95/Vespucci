import { describe, it, expect } from "vitest";
import {
  rgbToHex,
  hsvToRgb,
  generateDistinctColors,
  lightenColor,
  lightenChannel,
  goldenHue,
} from "../colors";

describe("rgbToHex", () => {
  it("converts black", () => {
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
  });
  it("converts white", () => {
    expect(rgbToHex(255, 255, 255)).toBe("#ffffff");
  });
  it("converts arbitrary color", () => {
    expect(rgbToHex(255, 128, 0)).toBe("#ff8000");
  });
  it("pads single-digit hex values", () => {
    expect(rgbToHex(1, 2, 3)).toBe("#010203");
  });
});

describe("lightenChannel", () => {
  it("returns same value at fraction=0", () => {
    expect(lightenChannel(100, 0)).toBe(100);
  });
  it("returns 255 at fraction=1", () => {
    expect(lightenChannel(0, 1)).toBe(255);
  });
  it("returns midpoint at fraction=0.5 from 0", () => {
    expect(lightenChannel(0, 0.5)).toBe(128);
  });
  it("returns midpoint at fraction=0.5 from 100", () => {
    expect(lightenChannel(100, 0.5)).toBe(178);
  });
});

describe("lightenColor", () => {
  it("returns white at fraction=1", () => {
    expect(lightenColor([0, 0, 0], 1)).toEqual([255, 255, 255]);
  });
  it("returns same color at fraction=0", () => {
    expect(lightenColor([100, 50, 200], 0)).toEqual([100, 50, 200]);
  });
  it("returns midpoint at fraction=0.5", () => {
    expect(lightenColor([0, 0, 0], 0.5)).toEqual([128, 128, 128]);
  });
  it("lightens 2/3 toward white", () => {
    const result = lightenColor([90, 0, 0], 2 / 3);
    expect(result[0]).toBe(200);
    expect(result[1]).toBe(170);
    expect(result[2]).toBe(170);
  });
});

describe("hsvToRgb", () => {
  it("converts pure red (h=0)", () => {
    expect(hsvToRgb(0, 1, 1)).toEqual([255, 0, 0]);
  });
  it("converts pure green (h≈0.333)", () => {
    const [r, g, b] = hsvToRgb(1 / 3, 1, 1);
    expect(g).toBe(255);
    expect(r).toBeLessThanOrEqual(1);
    expect(b).toBeLessThanOrEqual(1);
  });
  it("converts pure blue (h≈0.666)", () => {
    const [r, g, b] = hsvToRgb(2 / 3, 1, 1);
    expect(b).toBe(255);
    expect(r).toBeLessThanOrEqual(1);
    expect(g).toBeLessThanOrEqual(1);
  });
  it("returns black when v=0", () => {
    expect(hsvToRgb(0.5, 1, 0)).toEqual([0, 0, 0]);
  });
  it("returns gray when s=0", () => {
    const [r, g, b] = hsvToRgb(0.5, 0, 0.5);
    expect(r).toBe(g);
    expect(g).toBe(b);
    expect(r).toBe(128);
  });
  it("covers all 6 hue sectors", () => {
    for (let sector = 0; sector < 6; sector++) {
      const h = (sector + 0.5) / 6;
      const rgb = hsvToRgb(h, 0.8, 0.9);
      expect(rgb.length).toBe(3);
      for (const c of rgb) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe("goldenHue", () => {
  it("returns 0 for n=0", () => {
    expect(goldenHue(0)).toBe(0);
  });
  it("returns golden ratio for n=1", () => {
    expect(goldenHue(1)).toBeCloseTo(0.618, 3);
  });
  it("wraps around modulo 1", () => {
    const h = goldenHue(2);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(1);
  });
  it("produces different values for sequential n", () => {
    const hues = Array.from({ length: 5 }, (_, i) => goldenHue(i));
    const unique = new Set(hues.map((h) => h.toFixed(5)));
    expect(unique.size).toBe(5);
  });
});

describe("generateDistinctColors", () => {
  it("returns empty array for n=0", () => {
    expect(generateDistinctColors(0)).toEqual([]);
  });
  it("returns N colors", () => {
    expect(generateDistinctColors(5)).toHaveLength(5);
  });
  it("produces valid RGB values", () => {
    for (const [r, g, b] of generateDistinctColors(20)) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(255);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(255);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(255);
    }
  });
  it("produces distinct colors", () => {
    const hexSet = new Set(generateDistinctColors(10).map(([r, g, b]) => `${r},${g},${b}`));
    expect(hexSet.size).toBe(10);
  });
  it("first color uses hue=0", () => {
    const [first] = generateDistinctColors(1);
    const expected = hsvToRgb(0, 0.65, 0.85);
    expect(first).toEqual(expected);
  });
});
