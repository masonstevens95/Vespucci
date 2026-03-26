/**
 * Map style configuration and zoom/transform helpers.
 *
 * All functions are pure with immutable variables.
 * No null, no exceptions, every if has an else.
 */

import type { MapStyle } from "./types";

// =============================================================================
// Style configuration
// =============================================================================

export interface StyleConfig {
  readonly defaultFill: string;
  readonly stroke: string;
  readonly strokeWidth: string;
  readonly viewportClass: string;
  readonly bgColor: string;
  readonly legendBg: string;
  readonly legendBorder: string;
  readonly titleColor: string;
  readonly labelColor: string;
  readonly countColor: string;
}

const PARCHMENT: StyleConfig = {
  defaultFill: "#e8dcc8",
  stroke: "match-fill",
  strokeWidth: "0.15",
  viewportClass: "map-viewport map-viewport-parchment",
  bgColor: "#b8c8c8",
  legendBg: "#f0e0c0",
  legendBorder: "#8b7355",
  titleColor: "#3d2b1f",
  labelColor: "#3d2b1f",
  countColor: "#8b7355",
};

const MODERN: StyleConfig = {
  defaultFill: "#d1dbdd",
  stroke: "match-fill",
  strokeWidth: "0.15",
  viewportClass: "map-viewport map-viewport-modern",
  bgColor: "#a8c4d4",
  legendBg: "#1e1e2e",
  legendBorder: "#444444",
  titleColor: "#ffffff",
  labelColor: "#dddddd",
  countColor: "#888888",
};

/** Look up the full style config for a given map style. */
export const getStyleConfig = (style: MapStyle): StyleConfig =>
  style === "parchment" ? PARCHMENT : MODERN;

// =============================================================================
// Zoom / transform helpers
// =============================================================================

export interface Transform {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

/** The identity (reset) transform. */
export const IDENTITY_TRANSFORM: Transform = { x: 0, y: 0, scale: 1 };

/** Clamp a scale value within the allowed range. */
export const clampScale = (scale: number): number =>
  Math.max(0.5, Math.min(20, scale));

/** Compute the zoom multiplier for a wheel delta. */
export const zoomDelta = (deltaY: number): number =>
  deltaY > 0 ? 0.9 : 1.1;

/**
 * Compute a new transform that zooms toward a cursor position.
 *
 * @param prev     Current transform state
 * @param deltaY   Wheel event deltaY (positive = zoom out)
 * @param cursorX  Cursor X relative to the viewport
 * @param cursorY  Cursor Y relative to the viewport
 */
export const zoomTowardCursor = (
  prev: Transform,
  deltaY: number,
  cursorX: number,
  cursorY: number,
): Transform => {
  const factor = zoomDelta(deltaY);
  const newScale = clampScale(prev.scale * factor);
  const ratio = newScale / prev.scale;
  return {
    scale: newScale,
    x: cursorX - (cursorX - prev.x) * ratio,
    y: cursorY - (cursorY - prev.y) * ratio,
  };
};

/**
 * Compute a panned transform from a drag gesture.
 *
 * @param origin   Transform at the start of the drag
 * @param startX   Mouse X at drag start
 * @param startY   Mouse Y at drag start
 * @param currentX Current mouse X
 * @param currentY Current mouse Y
 */
export const panTransform = (
  origin: Transform,
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
): Transform => ({
  ...origin,
  x: origin.x + (currentX - startX),
  y: origin.y + (currentY - startY),
});

/** Build a CSS transform string from a Transform. */
export const transformCss = (t: Transform): string =>
  `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;

/** Format zoom level as a percentage string. */
export const zoomPercent = (scale: number): string =>
  `${Math.round(scale * 100)}%`;

// =============================================================================
// SVG viewBox helpers
// =============================================================================

export interface ViewBoxDimensions {
  readonly width: number;
  readonly height: number;
}

/** Default map dimensions when viewBox is missing. */
const DEFAULT_DIMENSIONS: ViewBoxDimensions = { width: 1200, height: 680 };

/** Parse width and height from an SVG viewBox string. */
export const parseViewBox = (viewBox: string): ViewBoxDimensions => {
  const parts = viewBox.split(" ").map(Number);
  const w = parts[2] ?? 0;
  const h = parts[3] ?? 0;
  return w > 0 && h > 0
    ? { width: w, height: h }
    : DEFAULT_DIMENSIONS;
};

/** Get map dimensions from a viewBox string, with fallback. */
export const getMapDimensions = (viewBox: string | undefined): ViewBoxDimensions =>
  viewBox !== undefined
    ? parseViewBox(viewBox)
    : DEFAULT_DIMENSIONS;

// =============================================================================
// Download layout helpers
// =============================================================================

export interface DownloadLayout {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly legendX: number;
  readonly legendY: number;
  readonly legendWidth: number;
  readonly legendHeight: number;
  readonly scale: number;
  readonly hasLegend: boolean;
}

/** Compute the canvas layout for a map + legend download image. */
export const computeDownloadLayout = (
  mapDims: ViewBoxDimensions,
  hasLegend: boolean,
  renderScale: number,
): DownloadLayout => {
  const legendPanelWidth = hasLegend ? 300 : 0;
  const canvasWidth = (mapDims.width + legendPanelWidth) * renderScale;
  const canvasHeight = mapDims.height * renderScale;
  const legendX = mapDims.width * renderScale + 20;
  const legendY = 20;
  const legendWidth = (legendPanelWidth - 40) * renderScale;
  const legendHeight = canvasHeight - 40;

  return {
    canvasWidth,
    canvasHeight,
    mapWidth: mapDims.width,
    mapHeight: mapDims.height,
    legendX,
    legendY,
    legendWidth,
    legendHeight,
    scale: renderScale,
    hasLegend,
  };
};
