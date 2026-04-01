/**
 * Number and string formatting helpers.
 *
 * All functions are pure. No null, no exceptions, every if has an else.
 */

/** Format a number with K/M suffix for compact display. */
export const fmtNum = (n: number): string =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M"
    : n >= 1_000 ? (n / 1_000).toFixed(1) + "K"
    : n > 0 ? n.toFixed(0)
    : "—";

/** Format a currency value (gold/income) — FIXED5 values are 1000x, so divide and show 1 decimal. */
export const fmtCurrency = (n: number): string =>
  n !== 0 ? (n / 1000).toFixed(1) : "—";

/** Compute total province count from a MapChart config's groups. */
export const computeProvinceCount = (
  groups: Readonly<Record<string, { paths: readonly string[] }>>,
): number =>
  Object.values(groups).reduce((n, g) => n + g.paths.length, 0);

/** Find the province count for a specific tag from config groups. */
export const findTagProvinceCount = (
  tag: string,
  groups: Readonly<Record<string, { label: string; paths: readonly string[] }>>,
): number => {
  const group = Object.values(groups).find((g) => g.label.startsWith(tag));
  return group !== undefined ? group.paths.length : 0;
};

/** Format a court language string for display (replace underscores, title case). */
export const fmtLanguage = (lang: string): string =>
  lang !== ""
    ? lang.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "";

/** Format a government type for display (capitalize first letter). */
export const fmtGovType = (gov: string): string =>
  gov !== ""
    ? gov.charAt(0).toUpperCase() + gov.slice(1)
    : "";
