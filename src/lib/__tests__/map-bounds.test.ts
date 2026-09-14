import { describe, it, expect } from "vitest";
import {
  NO_BOUNDS,
  hasBounds,
  unionBounds,
  padBounds,
  framedRegion,
  fitTransform,
  type Bounds,
} from "../map-bounds";
import { IDENTITY_TRANSFORM } from "../map-styles";

const MAP = { width: 1200, height: 680 };

/** A stand-in for an SVG path that reports a fixed bounding box. */
const stub = (x: number, y: number, width: number, height: number) =>
  ({ getBBox: () => ({ x, y, width, height }) }) as unknown as SVGGraphicsElement;

/** A stand-in whose geometry cannot be measured, as in jsdom. */
const unmeasurable = () =>
  ({
    getBBox: () => {
      throw new Error("Not implemented");
    },
  }) as unknown as SVGGraphicsElement;

describe("unionBounds", () => {
  it("returns a single box unchanged", () => {
    expect(unionBounds([stub(10, 20, 30, 40)])).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    });
  });

  it("spans two disjoint boxes", () => {
    expect(unionBounds([stub(0, 0, 10, 10), stub(90, 40, 10, 10)])).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    });
  });

  it("is unchanged by a box nested inside another", () => {
    expect(unionBounds([stub(0, 0, 100, 100), stub(20, 20, 10, 10)])).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
  });

  it("returns the sentinel for an empty list", () => {
    expect(unionBounds([])).toBe(NO_BOUNDS);
  });

  it("skips an unmeasurable element and unions the rest", () => {
    expect(unionBounds([unmeasurable(), stub(5, 5, 10, 10)])).toEqual({
      x: 5,
      y: 5,
      width: 10,
      height: 10,
    });
  });

  it("returns the sentinel when every element is unmeasurable", () => {
    // The jsdom case: getBBox is not implemented there, so a component test
    // that does not stub it must fall back rather than error.
    expect(unionBounds([unmeasurable(), unmeasurable()])).toBe(NO_BOUNDS);
  });

  it("skips a zero-area box rather than collapsing the union onto it", () => {
    expect(unionBounds([stub(0, 0, 0, 0), stub(50, 50, 10, 10)])).toEqual({
      x: 50,
      y: 50,
      width: 10,
      height: 10,
    });
  });

  it("accepts negative coordinates", () => {
    expect(unionBounds([stub(-20, -10, 10, 10), stub(0, 0, 10, 10)])).toEqual({
      x: -20,
      y: -10,
      width: 30,
      height: 20,
    });
  });
});

describe("hasBounds", () => {
  it("is false for the sentinel", () => {
    expect(hasBounds(NO_BOUNDS)).toBe(false);
  });

  it("is true for a real region", () => {
    expect(hasBounds({ x: 0, y: 0, width: 10, height: 10 })).toBe(true);
  });
});

describe("padBounds", () => {
  it("grows a centred region on all four sides", () => {
    const padded = padBounds({ x: 100, y: 100, width: 100, height: 100 }, 0.1, MAP);
    expect(padded).toEqual({ x: 90, y: 90, width: 120, height: 120 });
  });

  it("clamps to the map rather than extending past the left edge", () => {
    const padded = padBounds({ x: 0, y: 100, width: 100, height: 100 }, 0.5, MAP);
    expect(padded.x).toBe(0);
    expect(padded.x + padded.width).toBeLessThanOrEqual(MAP.width);
  });

  it("clamps to the map rather than extending past the bottom edge", () => {
    const padded = padBounds({ x: 100, y: 630, width: 100, height: 50 }, 0.5, MAP);
    expect(padded.y).toBeGreaterThanOrEqual(0);
    expect(padded.y + padded.height).toBeLessThanOrEqual(MAP.height);
  });

  it("never exceeds the map even with a huge margin", () => {
    const padded = padBounds({ x: 500, y: 300, width: 100, height: 100 }, 10, MAP);
    expect(padded).toEqual({ x: 0, y: 0, width: MAP.width, height: MAP.height });
  });

  it("treats a zero-area region as the sentinel", () => {
    // unionBounds skips zero-area boxes, so "a point" and "nothing measurable"
    // are the same case and both fall back to the whole map.
    expect(padBounds({ x: 600, y: 340, width: 0, height: 0 }, 0.1, MAP)).toBe(NO_BOUNDS);
  });

  it("returns the sentinel for the sentinel", () => {
    expect(padBounds(NO_BOUNDS, 0.1, MAP)).toBe(NO_BOUNDS);
  });

  it("is a no-op at zero margin", () => {
    const region: Bounds = { x: 10, y: 10, width: 50, height: 50 };
    expect(padBounds(region, 0, MAP)).toEqual(region);
  });
});

describe("fitTransform", () => {
  // A viewport matching the map's aspect ratio keeps the arithmetic legible:
  // 600px wide against a 1200-unit map is exactly 0.5 pixels per unit.
  const viewport = { width: 600, height: 340 };

  it("frames a half-width region at double scale", () => {
    const t = fitTransform({ x: 0, y: 0, width: 600, height: 340 }, MAP, 600, viewport);
    expect(t.scale).toBeCloseTo(2);
  });

  it("centres the framed region in the viewport", () => {
    // Region centre is at (600, 340) in map units -> (300, 170) px at scale 1.
    // At scale 2 that lands at (600, 340), so the offset must pull it back to
    // the viewport centre (300, 170).
    const t = fitTransform({ x: 300, y: 170, width: 600, height: 340 }, MAP, 600, viewport);
    const pxPerUnit = 600 / MAP.width;
    const centreX = (300 + 600 / 2) * pxPerUnit;
    const centreY = (170 + 340 / 2) * pxPerUnit;
    expect(centreX * t.scale + t.x).toBeCloseTo(viewport.width / 2);
    expect(centreY * t.scale + t.y).toBeCloseTo(viewport.height / 2);
  });

  it("fits a wide region on the width axis", () => {
    // Wider than the viewport aspect: width is the binding constraint.
    const t = fitTransform({ x: 0, y: 0, width: 1200, height: 100 }, MAP, 600, viewport);
    expect(t.scale).toBeCloseTo(1);
  });

  it("fits a tall region on the height axis", () => {
    const t = fitTransform({ x: 0, y: 0, width: 100, height: 680 }, MAP, 600, viewport);
    expect(t.scale).toBeCloseTo(1);
  });

  it("returns identity for the sentinel region", () => {
    expect(fitTransform(NO_BOUNDS, MAP, 600, viewport)).toEqual(IDENTITY_TRANSFORM);
  });

  it("returns identity for an unmeasured container", () => {
    expect(fitTransform({ x: 0, y: 0, width: 100, height: 100 }, MAP, 0, viewport)).toEqual(
      IDENTITY_TRANSFORM,
    );
  });

  it("returns identity for a zero-sized viewport", () => {
    expect(
      fitTransform({ x: 0, y: 0, width: 100, height: 100 }, MAP, 600, { width: 0, height: 0 }),
    ).toEqual(IDENTITY_TRANSFORM);
  });

  it("clamps a tiny region at the maximum zoom", () => {
    // One province: the uncapped scale would be in the hundreds.
    const t = fitTransform({ x: 600, y: 340, width: 1, height: 1 }, MAP, 600, viewport);
    expect(t.scale).toBe(20);
  });

  it("clamps a whole-map region at the minimum zoom", () => {
    const t = fitTransform({ x: 0, y: 0, width: MAP.width, height: MAP.height }, MAP, 600, {
      width: 100,
      height: 57,
    });
    expect(t.scale).toBe(0.5);
  });

  it("is idempotent — fitting the same region twice gives the same transform", () => {
    const region: Bounds = { x: 200, y: 100, width: 400, height: 200 };
    const first = fitTransform(region, MAP, 600, viewport);
    const second = fitTransform(region, MAP, 600, viewport);
    expect(second).toEqual(first);
  });

  it("keeps the whole region inside the viewport", () => {
    const region: Bounds = { x: 200, y: 100, width: 400, height: 200 };
    const t = fitTransform(region, MAP, 600, viewport);
    const pxPerUnit = 600 / MAP.width;
    const left = region.x * pxPerUnit * t.scale + t.x;
    const top = region.y * pxPerUnit * t.scale + t.y;
    const right = (region.x + region.width) * pxPerUnit * t.scale + t.x;
    const bottom = (region.y + region.height) * pxPerUnit * t.scale + t.y;
    expect(left).toBeGreaterThanOrEqual(-0.01);
    expect(top).toBeGreaterThanOrEqual(-0.01);
    expect(right).toBeLessThanOrEqual(viewport.width + 0.01);
    expect(bottom).toBeLessThanOrEqual(viewport.height + 0.01);
  });
});

describe("framedRegion", () => {
  it("unions then pads in one step", () => {
    // Large enough to clear the minimum, so padding is the only effect.
    const region = framedRegion([stub(100, 100, 500, 300)], MAP, 0.1);
    expect(region).toEqual({ x: 50, y: 70, width: 600, height: 360 });
  });

  it("returns the sentinel when nothing is measurable", () => {
    expect(framedRegion([unmeasurable()], MAP)).toBe(NO_BOUNDS);
  });

  it("returns the sentinel for no elements", () => {
    expect(framedRegion([], MAP)).toBe(NO_BOUNDS);
  });

  it("applies the default margin when none is given", () => {
    const region = framedRegion([stub(100, 100, 500, 300)], MAP);
    expect(region.width).toBeGreaterThan(500);
  });

  it("widens a tiny holding to the minimum region", () => {
    // One province would otherwise frame a few viewBox units: a wall of colour
    // on screen and a few dozen pixels in the PNG.
    const region = framedRegion([stub(600, 340, 2, 2)], MAP);
    expect(region.width).toBeCloseTo(MAP.width * 0.25);
    expect(region.height).toBeCloseTo(MAP.width * 0.25 * (MAP.height / MAP.width));
  });

  it("keeps a widened region centred on the holding", () => {
    const region = framedRegion([stub(600, 340, 2, 2)], MAP);
    expect(region.x + region.width / 2).toBeCloseTo(601);
    expect(region.y + region.height / 2).toBeCloseTo(341);
  });

  it("shifts a widened region inside the map rather than clipping it", () => {
    // A holding in the corner: the region keeps its full size and slides in.
    const region = framedRegion([stub(0, 0, 2, 2)], MAP);
    expect(region.x).toBe(0);
    expect(region.y).toBe(0);
    expect(region.width).toBeCloseTo(MAP.width * 0.25);
  });

  it("leaves a region already above the minimum alone", () => {
    const region = framedRegion([stub(0, 0, 1000, 600)], MAP, 0);
    expect(region).toEqual({ x: 0, y: 0, width: 1000, height: 600 });
  });
});
