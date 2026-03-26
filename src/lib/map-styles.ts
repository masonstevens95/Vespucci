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
  readonly strokeWidth: string;
  readonly outlineColor: string;
  readonly outlineWidth: string;
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
  strokeWidth: "0.15",
  outlineColor: "#000000",
  outlineWidth: "0",
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
  strokeWidth: "0.15",
  outlineColor: "#000000",
  outlineWidth: "0",
  viewportClass: "map-viewport map-viewport-modern",
  bgColor: "#a8c4d4",
  legendBg: "#1e1e2e",
  legendBorder: "#444444",
  titleColor: "#ffffff",
  labelColor: "#dddddd",
  countColor: "#888888",
};

const DARK: StyleConfig = {
  defaultFill: "#2a2a3e",
  strokeWidth: "0.15",
  outlineColor: "#888888",
  outlineWidth: "0",
  viewportClass: "map-viewport map-viewport-dark",
  bgColor: "#0e0e1a",
  legendBg: "#161622",
  legendBorder: "#333350",
  titleColor: "#e0e0e0",
  labelColor: "#cccccc",
  countColor: "#666680",
};

const SATELLITE: StyleConfig = {
  defaultFill: "#3a5a3a",
  strokeWidth: "0.15",
  outlineColor: "#ffffff",
  outlineWidth: "0",
  viewportClass: "map-viewport map-viewport-satellite",
  bgColor: "#1a3050",
  legendBg: "#1a2a1a",
  legendBorder: "#3a5a3a",
  titleColor: "#d0e0d0",
  labelColor: "#c0d0c0",
  countColor: "#6a8a6a",
};

const PASTEL: StyleConfig = {
  defaultFill: "#f5f0eb",
  strokeWidth: "0.15",
  outlineColor: "#999999",
  outlineWidth: "0",
  viewportClass: "map-viewport map-viewport-pastel",
  bgColor: "#d4e6f1",
  legendBg: "#faf5f0",
  legendBorder: "#d5c4a1",
  titleColor: "#5a4a3a",
  labelColor: "#5a4a3a",
  countColor: "#a09080",
};

/** Color fields that get color pickers. */
export type StyleColorOverrides = Partial<Pick<StyleConfig,
  "defaultFill" | "bgColor" | "legendBg" | "legendBorder" | "titleColor" | "labelColor" | "outlineColor"
>>;

/** Non-color overrides (sliders). */
export type StyleMiscOverrides = {
  outlineWidth?: string;
};

/** All style overrides combined. */
export type StyleOverrides = StyleColorOverrides & StyleMiscOverrides;

/** The color fields that get color pickers. */
export const EDITABLE_COLOR_KEYS: readonly (keyof StyleColorOverrides)[] = [
  "bgColor", "defaultFill", "outlineColor", "legendBg", "legendBorder", "titleColor", "labelColor",
] as const;

/** Human-readable labels for all editable style fields. */
export const STYLE_FIELD_LABELS: Readonly<Record<keyof StyleColorOverrides | keyof StyleMiscOverrides, string>> = {
  bgColor: "Ocean",
  defaultFill: "Unowned Land",
  outlineColor: "Outline",
  legendBg: "Legend Bg",
  legendBorder: "Legend Border",
  titleColor: "Title Text",
  labelColor: "Label Text",
  outlineWidth: "Outline Width",
};

/** Style preset lookup. */
const STYLE_PRESETS: Readonly<Record<MapStyle, StyleConfig>> = {
  parchment: PARCHMENT,
  modern: MODERN,
  dark: DARK,
  satellite: SATELLITE,
  pastel: PASTEL,
};

/** Get the base (unmodified) style config for a preset. */
export const getBaseStyleConfig = (style: MapStyle): StyleConfig =>
  STYLE_PRESETS[style] ?? PARCHMENT;

/** All keys that can be overridden. */
const ALL_OVERRIDE_KEYS: readonly (keyof StyleOverrides)[] = [
  ...EDITABLE_COLOR_KEYS, "outlineWidth",
] as const;

/** Merge user overrides onto a base style config. */
export const mergeStyleOverrides = (
  base: StyleConfig,
  overrides: StyleOverrides,
): StyleConfig => ({
  ...base,
  ...overrides,
  // Preserve non-editable fields from base
  strokeWidth: base.strokeWidth,
  viewportClass: base.viewportClass,
  countColor: base.countColor,
});

/** Check whether any overrides differ from the base style. */
export const hasCustomOverrides = (
  base: StyleConfig,
  overrides: StyleOverrides,
): boolean =>
  ALL_OVERRIDE_KEYS.some((key) => {
    const val = overrides[key as keyof StyleOverrides];
    const baseVal = base[key as keyof StyleConfig];
    return val !== undefined && String(val) !== String(baseVal);
  });

/** Resolve the effective style config from a preset + overrides. */
export const getStyleConfig = (style: MapStyle, overrides?: StyleOverrides): StyleConfig => {
  const base = getBaseStyleConfig(style);
  return overrides !== undefined
    ? mergeStyleOverrides(base, overrides)
    : base;
};

/** Display labels for each preset. */
const PRESET_LABELS: Readonly<Record<MapStyle, string>> = {
  parchment: "Parchment",
  modern: "Modern",
  dark: "Dark",
  satellite: "Satellite",
  pastel: "Pastel",
};

/** All available style presets for dropdowns. */
export const MAP_STYLE_OPTIONS: readonly { value: MapStyle; label: string }[] = [
  { value: "parchment", label: "Parchment" },
  { value: "modern", label: "Modern" },
  { value: "dark", label: "Dark" },
  { value: "satellite", label: "Satellite" },
  { value: "pastel", label: "Pastel" },
];

/** Determine the display label for the style dropdown. */
export const styleDisplayLabel = (style: MapStyle, overrides: StyleOverrides): string =>
  hasCustomOverrides(getBaseStyleConfig(style), overrides)
    ? "Custom"
    : PRESET_LABELS[style] ?? style;

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

// =============================================================================
// Color override helpers
// =============================================================================

/** A map from original hex color to user-chosen replacement hex. */
export type ColorOverrides = Readonly<Record<string, string>>;

/** Apply color overrides to a config's groups, returning new groups keyed by the new hex. */
export const applyColorOverrides = (
  groups: Readonly<Record<string, { label: string; paths: string[] }>>,
  overrides: ColorOverrides,
): Record<string, { label: string; paths: string[] }> => {
  const result: Record<string, { label: string; paths: string[] }> = {};
  for (const [originalHex, group] of Object.entries(groups)) {
    const newHex = overrides[originalHex] ?? originalHex;
    result[newHex] = group;
  }
  return result;
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
