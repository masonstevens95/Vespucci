import type { ParsedSave } from "./types";

// ─── Sort mode types ───────────────────────────────────────────────────────

export type GoodSortMode = "production" | "name" | "price" | "supply" | "demand" | "surplus" | "markets";
export type MarketSortMode = "population" | "price" | "food" | "capacity" | "goods" | "totalProduction";
export type DetailSortMode = "supply" | "price" | "demand" | "surplus" | "stockpile" | "totalProduction";

// ─── Domain types ──────────────────────────────────────────────────────────

export type MarketType = ParsedSave["trade"]["markets"][number];
export type MarketGoodType = MarketType["goods"][number];
export type MarketGoodEntry = MarketGoodType & { readonly marketId: number };

export interface GoodAggStats {
  readonly name: string;
  readonly totalProduction: number;
  readonly avgPrice: number;
  readonly totalSupply: number;
  readonly totalDemand: number;
  readonly totalSurplus: number;
  readonly marketCount: number;
}

// ─── Formatters ────────────────────────────────────────────────────────────

/** Format a good name for display. Strips goods_ prefix, title-cases. */
export const fmtGood = (name: string): string =>
  name.replace(/^goods_/, "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

/** Resolve a market name from the names map. */
export const marketName = (id: number, names: Readonly<Record<number, string>>): string =>
  names[id] !== undefined ? names[id] : `Market ${id}`;

/** Format large numbers compactly. */
export const fmtVal = (n: number): string =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M"
    : n >= 1_000 ? (n / 1_000).toFixed(1) + "K"
    : n > 0 ? n.toFixed(0)
    : "—";

/** Format a signed surplus value. Positive = oversupply, negative = deficit. */
export const fmtSurplus = (surplus: number): string => {
  const abs = Math.abs(surplus);
  const mag = abs >= 1_000_000 ? (abs / 1_000_000).toFixed(1) + "M"
    : abs >= 1_000 ? (abs / 1_000).toFixed(1) + "K"
    : abs.toFixed(0);
  return surplus > 0 ? "+" + mag : surplus < 0 ? "-" + mag : "0";
};

/** CSS class for surplus sign. Positive = green (oversupply), negative = red (deficit). */
export const surplusClass = (surplus: number): string =>
  surplus > 0 ? "trade-surplus-pos"
    : surplus < 0 ? "trade-surplus-neg"
    : "";

/** Format a dialect string for display (title-case, spaces). */
export const fmtDialect = (d: string): string =>
  d.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

/** Population-to-capacity percentage, or "—" if capacity is 0. */
export const capacityPct = (population: number, capacity: number): string =>
  capacity > 0 ? ((population / capacity) * 100).toFixed(1) + "%" : "—";


/** Filter produced goods keys by search term matched against formatted name. */
export const filterGoods = (
  producedGoods: Readonly<Record<string, number>>,
  query: string,
): Record<string, number> => {
  if (query === "") { return { ...producedGoods }; }
  const q = query.toLowerCase();
  const result: Record<string, number> = {};
  for (const key of Object.keys(producedGoods)) {
    if (fmtGood(key).toLowerCase().includes(q)) {
      result[key] = producedGoods[key];
    }
  }
  return result;
};

/** Filter markets by search term matched against market name or owner name. */
export const filterMarkets = (
  markets: ParsedSave["trade"]["markets"],
  marketNames: Readonly<Record<number, string>>,
  marketOwners: Readonly<Record<number, string>>,
  countryNames: Readonly<Record<string, string>>,
  query: string,
): ParsedSave["trade"]["markets"] => {
  if (query === "") { return [...markets]; }
  const q = query.toLowerCase();
  return markets.filter(m => {
    const name = marketName(m.id, marketNames).toLowerCase();
    const ownerTag = marketOwners[m.id] ?? "";
    const owner = (countryNames[ownerTag] ?? ownerTag).toLowerCase();
    return name.includes(q) || owner.includes(q);
  });
};

// ─── Data helpers ──────────────────────────────────────────────────────────

/**
 * Build a global good → average price map across all markets.
 * Used to show price context in the country production table.
 */
export const buildGoodAvgPrices = (
  markets: ParsedSave["trade"]["markets"],
): Record<string, number> => {
  const acc: Record<string, { sum: number; count: number }> = {};
  for (const market of markets) {
    for (const good of market.goods) {
      if (!acc[good.name]) {
        acc[good.name] = { sum: 0, count: 0 };
      } else {
        /* already initialised */
      }
      acc[good.name].sum += good.price;
      acc[good.name].count += 1;
    }
  }
  const result: Record<string, number> = {};
  for (const [name, { sum, count }] of Object.entries(acc)) {
    result[name] = count > 0 ? sum / count : 0;
  }
  return result;
};

/** Build aggregate stats per good across all markets. */
export const buildGoodStats = (
  producedGoods: Readonly<Record<string, number>>,
  markets: ParsedSave["trade"]["markets"],
): GoodAggStats[] =>
  Object.keys(producedGoods).map(name => {
    const entries = markets
      .map(m => m.goods.find(g => g.name === name))
      .filter((g): g is MarketGoodType => g !== undefined);
    const marketCount = entries.length;
    const totalSupply = entries.reduce((s, g) => s + g.supply, 0);
    const totalDemand = entries.reduce((s, g) => s + g.demand, 0);
    const totalSurplus = entries.reduce((s, g) => s + g.surplus, 0);
    const avgPrice = marketCount > 0
      ? entries.reduce((s, g) => s + g.price, 0) / marketCount
      : 0;
    return { name, totalProduction: producedGoods[name], avgPrice, totalSupply, totalDemand, totalSurplus, marketCount };
  });

/** Collect all market entries for a specific good, each tagged with marketId. */
export const collectGoodEntries = (
  goodName: string,
  markets: ParsedSave["trade"]["markets"],
): MarketGoodEntry[] =>
  markets
    .map(m => {
      const g = m.goods.find(g2 => g2.name === goodName);
      return g !== undefined ? ({ marketId: m.id, ...g } as MarketGoodEntry) : undefined;
    })
    .filter((x): x is MarketGoodEntry => x !== undefined);

// ─── Sort helpers ──────────────────────────────────────────────────────────

/** Sort aggregate good stats by a given mode and direction. */
export const sortGoodStats = (
  goods: GoodAggStats[],
  mode: GoodSortMode,
  dir: "asc" | "desc",
): GoodAggStats[] => {
  const m = dir === "asc" ? 1 : -1;
  return [...goods].sort((a, b) => {
    if (mode === "production") { return m * (a.totalProduction - b.totalProduction); }
    else if (mode === "supply") { return m * (a.totalSupply - b.totalSupply); }
    else if (mode === "demand") { return m * (a.totalDemand - b.totalDemand); }
    else if (mode === "price") { return m * (a.avgPrice - b.avgPrice); }
    else if (mode === "surplus") { return m * (a.totalSurplus - b.totalSurplus); }
    else if (mode === "markets") { return m * (a.marketCount - b.marketCount); }
    else { return m * a.name.localeCompare(b.name); }
  });
};

/** Sort markets by a given mode and direction. */
export const sortMarkets = (
  markets: ParsedSave["trade"]["markets"],
  mode: MarketSortMode,
  dir: "asc" | "desc",
): ParsedSave["trade"]["markets"] => {
  const m = dir === "asc" ? 1 : -1;
  return [...markets].sort((a, b) => {
    if (mode === "population") { return m * (a.population - b.population); }
    else if (mode === "price") { return m * (a.price - b.price); }
    else if (mode === "food") { return m * (a.food - b.food); }
    else if (mode === "capacity") { return m * (a.capacity - b.capacity); }
    else if (mode === "totalProduction") {
      const aProd = a.goods.reduce((s, g) => s + g.totalProduction, 0);
      const bProd = b.goods.reduce((s, g) => s + g.totalProduction, 0);
      return m * (aProd - bProd);
    }
    else { return m * (a.goods.length - b.goods.length); }
  });
};

/** Sort goods within a market/good detail view by chosen column and direction. */
export const sortGoods = <T extends MarketGoodType>(goods: readonly T[], mode: DetailSortMode, dir: "asc" | "desc"): T[] => {
  const m = dir === "asc" ? 1 : -1;
  return [...goods].sort((a, b) => {
    if (mode === "price") { return m * (a.price - b.price); }
    else if (mode === "demand") { return m * (a.demand - b.demand); }
    else if (mode === "surplus") { return m * (a.surplus - b.surplus); }
    else if (mode === "stockpile") { return m * (a.stockpile - b.stockpile); }
    else if (mode === "totalProduction") { return m * (a.totalProduction - b.totalProduction); }
    else { return m * (a.supply - b.supply); }
  });
};
