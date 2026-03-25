/**
 * Color utilities for map generation.
 *
 * All functions are pure, use immutable variables, and never throw.
 */

import type { RGB } from "./types";

/** Convert 0-255 RGB components to a hex color string. */
export const rgbToHex = (r: number, g: number, b: number): string =>
  `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

/** Convert a single 0-1 channel value toward white by a fraction. */
export const lightenChannel = (channel: number, fraction: number): number =>
  Math.round(channel + (255 - channel) * fraction);

/** Lighten an RGB color toward white by a fraction (0=unchanged, 1=white). */
export const lightenColor = (rgb: RGB, fraction: number): RGB => [
  lightenChannel(rgb[0], fraction),
  lightenChannel(rgb[1], fraction),
  lightenChannel(rgb[2], fraction),
];

/** Compute HSV intermediate values for a given hue sector. */
const hsvComponents = (
  h: number,
  s: number,
  v: number,
): { f: number; p: number; q: number; t: number } => {
  const f = h * 6 - Math.floor(h * 6);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  return { f, p, q, t };
};

/** Map an HSV hue sector (0-5) to raw RGB floats (0-1 range). */
const sectorToRgb = (
  sector: number,
  v: number,
  p: number,
  q: number,
  t: number,
): readonly [number, number, number] => {
  switch (sector) {
    case 0:  return [v, t, p];
    case 1:  return [q, v, p];
    case 2:  return [p, v, t];
    case 3:  return [p, q, v];
    case 4:  return [t, p, v];
    default: return [v, p, q];
  }
};

/** Convert HSV (h: 0-1, s: 0-1, v: 0-1) to RGB (0-255). */
export const hsvToRgb = (h: number, s: number, v: number): RGB => {
  const sector = Math.floor(h * 6) % 6;
  const { p, q, t } = hsvComponents(h, s, v);
  const [rf, gf, bf] = sectorToRgb(sector, v, p, q, t);
  return [Math.round(rf * 255), Math.round(gf * 255), Math.round(bf * 255)];
};

/** Golden ratio constant for hue spacing. */
const GOLDEN_RATIO = 0.618033988749895;

/** Compute the hue for the nth color in a golden-ratio sequence. */
export const goldenHue = (n: number): number =>
  (n * GOLDEN_RATIO) % 1.0;

/** Generate N visually distinct colors using golden ratio hue spacing. */
export const generateDistinctColors = (n: number): readonly RGB[] =>
  Array.from({ length: n }, (_, i) => hsvToRgb(goldenHue(i), 0.65, 0.85));
