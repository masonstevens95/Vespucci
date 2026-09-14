/**
 * Map framing: what region of the map to show, and the transform that shows it.
 *
 * The map opens on the whole 1200x680 world, which in most multiplayer saves
 * means the territory anyone cares about occupies a small corner of the frame.
 * These helpers measure where the player countries actually are and turn that
 * into an opening view — and, at download time, into the region the exported
 * PNG crops to, so the image and the screen agree.
 *
 * Geometry is measured from the live SVG rather than a precomputed asset: the
 * document is already parsed and in the DOM, and only the player's paths need
 * measuring.
 *
 * All functions are pure, use immutable variables, and never throw.
 */

import { clampScale, IDENTITY_TRANSFORM } from "./map-styles";
import type { Transform, ViewBoxDimensions } from "./map-styles";

/** A rectangle in SVG viewBox user units. */
export interface Bounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Sentinel for "nothing measurable" — no players, or no path whose geometry
 * could be read. Consumers fall back to the whole map rather than framing it.
 */
export const NO_BOUNDS: Bounds = { x: 0, y: 0, width: 0, height: 0 };

/** True when a region describes a real area rather than the sentinel. */
export const hasBounds = (bounds: Bounds): boolean =>
  bounds.width > 0 && bounds.height > 0;

/**
 * Read one element's bounding box, or nothing when it cannot be measured.
 *
 * `getBBox` throws in jsdom, which is where this project's tests run, and a
 * degenerate path can legitimately have no area. Neither should sink the fit,
 * so both come back as "no contribution" rather than as an error.
 */
const measure = (el: SVGGraphicsElement): Bounds | undefined => {
  try {
    const box = el.getBBox();
    return box.width > 0 || box.height > 0
      ? { x: box.x, y: box.y, width: box.width, height: box.height }
      : undefined;
  } catch {
    return undefined;
  }
};

/** Union two regions. */
const merge = (a: Bounds, b: Bounds): Bounds => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
};

/** The smallest region containing every measurable element. */
export const unionBounds = (
  elements: Iterable<SVGGraphicsElement>,
): Bounds => {
  let result: Bounds | undefined = undefined;
  for (const el of elements) {
    const box = measure(el);
    if (box === undefined) {
      /* unmeasurable or zero-area — contributes nothing */
    } else {
      result = result === undefined ? box : merge(result, box);
    }
  }
  return result ?? NO_BOUNDS;
};

/**
 * Grow a region by a margin, clamped to the map.
 *
 * The margin is a fraction of the region's own size, so a small holding gets
 * proportionally as much breathing room as a large one. Clamping matters for
 * a country on the map's edge, where padding would otherwise push the frame
 * into empty space beyond the document.
 *
 * A zero-area region is the sentinel, not a point to pad: `unionBounds` skips
 * zero-area boxes, so the two cases are indistinguishable by construction.
 */
export const padBounds = (
  bounds: Bounds,
  margin: number,
  map: ViewBoxDimensions,
): Bounds => {
  if (!hasBounds(bounds)) {
    return NO_BOUNDS;
  } else {
    /* real region — pad it below */
  }

  const padX = bounds.width * margin;
  const padY = bounds.height * margin;

  const left = Math.max(0, bounds.x - padX);
  const top = Math.max(0, bounds.y - padY);
  const right = Math.min(map.width, bounds.x + bounds.width + padX);
  const bottom = Math.min(map.height, bounds.y + bounds.height + padY);

  return { x: left, y: top, width: right - left, height: bottom - top };
};

/**
 * The transform that frames a region in the viewport.
 *
 * `.map-svg` is `width: 100%`, so the map's on-screen size follows the
 * container's width and the unit conversion is `containerWidth / map.width`.
 * That is deliberately not taken from the SVG's own bounding rect, which would
 * already include the live transform and make the fit depend on its own
 * output.
 *
 * Returns the identity transform whenever there is nothing to frame or nothing
 * to frame it in, so callers get today's whole-map view as the fallback.
 */
export const fitTransform = (
  region: Bounds,
  map: ViewBoxDimensions,
  containerWidth: number,
  viewport: ViewBoxDimensions,
): Transform => {
  if (!hasBounds(region) || containerWidth <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return IDENTITY_TRANSFORM;
  } else {
    /* everything measurable — fit below */
  }

  const pxPerUnit = containerWidth / map.width;
  const regionW = region.width * pxPerUnit;
  const regionH = region.height * pxPerUnit;

  // The smaller ratio is the binding constraint: it is the one that keeps the
  // whole region inside the viewport rather than cropping the other axis.
  const scale = clampScale(
    Math.min(viewport.width / regionW, viewport.height / regionH),
  );

  const centerX = (region.x + region.width / 2) * pxPerUnit;
  const centerY = (region.y + region.height / 2) * pxPerUnit;

  return {
    scale,
    x: viewport.width / 2 - centerX * scale,
    y: viewport.height / 2 - centerY * scale,
  };
};
