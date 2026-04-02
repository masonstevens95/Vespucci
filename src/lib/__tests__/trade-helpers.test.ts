import { describe, it, expect } from "vitest";
import {
  fmtGood,
  marketName,
  fmtVal,
  fmtSurplus,
  surplusClass,
  fmtDialect,
  capacityPct,
  buildGoodStats,
  collectGoodEntries,
  sortGoodStats,
  sortMarkets,
  sortGoods,
  type GoodAggStats,
  type MarketGoodType,
} from "../trade-helpers";

// ─── Fixtures ──────────────────────────────────────────────────────────────

const mkGood = (name: string, overrides: Partial<MarketGoodType> = {}): MarketGoodType => ({
  name,
  price: 1,
  supply: 10,
  demand: 8,
  surplus: -2,
  stockpile: 5,
  totalProduction: 10,
  ...overrides,
});

const mkMarket = (id: number, goods: MarketGoodType[] = [], overrides = {}) => ({
  id,
  centerLocation: 0,
  dialect: "",
  population: 1000,
  price: 1.5,
  food: 500,
  capacity: 2000,
  goods,
  ...overrides,
});

// ─── fmtGood ───────────────────────────────────────────────────────────────

describe("fmtGood", () => {
  it("strips goods_ prefix and title-cases", () => {
    expect(fmtGood("goods_cocoa")).toBe("Cocoa");
  });

  it("strips goods_ prefix and handles multi-word", () => {
    expect(fmtGood("goods_red_wine")).toBe("Red Wine");
  });

  it("handles name without goods_ prefix", () => {
    expect(fmtGood("wool")).toBe("Wool");
  });

  it("title-cases underscore-separated words", () => {
    expect(fmtGood("grain_and_fish")).toBe("Grain And Fish");
  });
});

// ─── marketName ───────────────────────────────────────────────────────────

describe("marketName", () => {
  it("returns name when id is found", () => {
    expect(marketName(1, { 1: "Venice", 2: "London" })).toBe("Venice");
  });

  it("returns fallback when id is not found", () => {
    expect(marketName(99, { 1: "Venice" })).toBe("Market 99");
  });
});

// ─── fmtVal ───────────────────────────────────────────────────────────────

describe("fmtVal", () => {
  it("returns — for 0", () => {
    expect(fmtVal(0)).toBe("—");
  });

  it("returns — for negative", () => {
    expect(fmtVal(-5)).toBe("—");
  });

  it("returns plain number for 1", () => {
    expect(fmtVal(1)).toBe("1");
  });

  it("returns plain number for 999", () => {
    expect(fmtVal(999)).toBe("999");
  });

  it("returns K suffix for 1000", () => {
    expect(fmtVal(1000)).toBe("1.0K");
  });

  it("returns K suffix for 1500", () => {
    expect(fmtVal(1500)).toBe("1.5K");
  });

  it("returns M suffix for 1_000_000", () => {
    expect(fmtVal(1_000_000)).toBe("1.0M");
  });

  it("returns M suffix for 2_500_000", () => {
    expect(fmtVal(2_500_000)).toBe("2.5M");
  });
});

// ─── fmtSurplus ───────────────────────────────────────────────────────────

describe("fmtSurplus", () => {
  it("returns 0 for zero", () => {
    expect(fmtSurplus(0)).toBe("0");
  });

  it("positive 500 → +500 (oversupply)", () => {
    expect(fmtSurplus(500)).toBe("+500");
  });

  it("negative -500 → -500 (deficit)", () => {
    expect(fmtSurplus(-500)).toBe("-500");
  });

  it("positive 1500 → +1.5K", () => {
    expect(fmtSurplus(1500)).toBe("+1.5K");
  });

  it("negative -1500 → -1.5K", () => {
    expect(fmtSurplus(-1500)).toBe("-1.5K");
  });

  it("positive 2_000_000 → +2.0M", () => {
    expect(fmtSurplus(2_000_000)).toBe("+2.0M");
  });

  it("negative -2_000_000 → -2.0M", () => {
    expect(fmtSurplus(-2_000_000)).toBe("-2.0M");
  });

  it("small positive 5 → +5", () => {
    expect(fmtSurplus(5)).toBe("+5");
  });

  it("small negative -5 → -5", () => {
    expect(fmtSurplus(-5)).toBe("-5");
  });
});

// ─── surplusClass ─────────────────────────────────────────────────────────

describe("surplusClass", () => {
  it("returns trade-surplus-pos for positive (oversupply)", () => {
    expect(surplusClass(1)).toBe("trade-surplus-pos");
  });

  it("returns trade-surplus-neg for negative (deficit)", () => {
    expect(surplusClass(-1)).toBe("trade-surplus-neg");
  });

  it("returns empty string for zero", () => {
    expect(surplusClass(0)).toBe("");
  });
});

// ─── fmtDialect ───────────────────────────────────────────────────────────

describe("fmtDialect", () => {
  it("formats multi-word dialect", () => {
    expect(fmtDialect("western_roman")).toBe("Western Roman");
  });

  it("formats single word dialect", () => {
    expect(fmtDialect("latin")).toBe("Latin");
  });
});

// ─── capacityPct ──────────────────────────────────────────────────────────

describe("capacityPct", () => {
  it("returns percentage when capacity > 0", () => {
    expect(capacityPct(500, 1000)).toBe("50.0%");
  });

  it("returns 0.0% when population is 0", () => {
    expect(capacityPct(0, 100)).toBe("0.0%");
  });

  it("returns — when capacity is 0", () => {
    expect(capacityPct(500, 0)).toBe("—");
  });
});

// ─── buildGoodStats ───────────────────────────────────────────────────────

describe("buildGoodStats", () => {
  it("aggregates good across 2 markets", () => {
    const markets = [
      mkMarket(1, [mkGood("goods_grain", { price: 2, supply: 100, demand: 80, surplus: -20, totalProduction: 50 })]),
      mkMarket(2, [mkGood("goods_grain", { price: 4, supply: 200, demand: 150, surplus: -50, totalProduction: 100 })]),
    ];
    const producedGoods = { "goods_grain": 300 };
    const result = buildGoodStats(producedGoods, markets);
    expect(result).toHaveLength(1);
    const stat = result[0];
    expect(stat.name).toBe("goods_grain");
    expect(stat.totalProduction).toBe(300);
    expect(stat.totalSupply).toBe(300);
    expect(stat.totalDemand).toBe(230);
    expect(stat.totalSurplus).toBe(-70);
    expect(stat.avgPrice).toBe(3); // (2 + 4) / 2
    expect(stat.marketCount).toBe(2);
  });

  it("handles good not present in any market", () => {
    const markets: ReturnType<typeof mkMarket>[] = [];
    const producedGoods = { "goods_grain": 500 };
    const result = buildGoodStats(producedGoods, markets);
    expect(result).toHaveLength(1);
    const stat = result[0];
    expect(stat.avgPrice).toBe(0);
    expect(stat.totalSupply).toBe(0);
    expect(stat.totalDemand).toBe(0);
    expect(stat.totalSurplus).toBe(0);
    expect(stat.marketCount).toBe(0);
  });

  it("returns one entry per producedGood key", () => {
    const markets = [
      mkMarket(1, [
        mkGood("goods_grain", { supply: 100 }),
        mkGood("goods_wine", { supply: 50 }),
      ]),
    ];
    const producedGoods = { "goods_grain": 300, "goods_wine": 200 };
    const result = buildGoodStats(producedGoods, markets);
    expect(result).toHaveLength(2);
    const names = result.map(r => r.name);
    expect(names).toContain("goods_grain");
    expect(names).toContain("goods_wine");
  });
});

// ─── collectGoodEntries ───────────────────────────────────────────────────

describe("collectGoodEntries", () => {
  it("returns entries with marketId for each market containing the good", () => {
    const markets = [
      mkMarket(1, [mkGood("goods_grain", { supply: 100 })]),
      mkMarket(2, [mkGood("goods_grain", { supply: 200 })]),
    ];
    const entries = collectGoodEntries("goods_grain", markets);
    expect(entries).toHaveLength(2);
    expect(entries[0].marketId).toBe(1);
    expect(entries[0].supply).toBe(100);
    expect(entries[1].marketId).toBe(2);
    expect(entries[1].supply).toBe(200);
  });

  it("returns empty array when good not found in any market", () => {
    const markets = [
      mkMarket(1, [mkGood("goods_wool")]),
    ];
    const entries = collectGoodEntries("goods_grain", markets);
    expect(entries).toHaveLength(0);
  });

  it("handles multiple markets where only some have the good", () => {
    const markets = [
      mkMarket(1, [mkGood("goods_grain")]),
      mkMarket(2, [mkGood("goods_wool")]),
      mkMarket(3, [mkGood("goods_grain", { supply: 999 })]),
    ];
    const entries = collectGoodEntries("goods_grain", markets);
    expect(entries).toHaveLength(2);
    expect(entries.map(e => e.marketId)).toEqual([1, 3]);
  });
});

// ─── sortGoodStats ────────────────────────────────────────────────────────

const mkAggStat = (overrides: Partial<GoodAggStats>): GoodAggStats => ({
  name: "a",
  totalProduction: 0,
  avgPrice: 0,
  totalSupply: 0,
  totalDemand: 0,
  totalSurplus: 0,
  marketCount: 0,
  ...overrides,
});

describe("sortGoodStats", () => {
  const goods: GoodAggStats[] = [
    mkAggStat({ name: "goods_wool", totalProduction: 100, avgPrice: 3, totalSupply: 50, totalDemand: 40, marketCount: 1 }),
    mkAggStat({ name: "goods_grain", totalProduction: 300, avgPrice: 1, totalSupply: 200, totalDemand: 150, marketCount: 3 }),
    mkAggStat({ name: "goods_wine", totalProduction: 200, avgPrice: 2, totalSupply: 100, totalDemand: 80, marketCount: 2 }),
  ];

  it("sorts by production desc", () => {
    const result = sortGoodStats(goods, "production", "desc");
    expect(result[0].totalProduction).toBe(300);
    expect(result[2].totalProduction).toBe(100);
  });

  it("sorts by production asc", () => {
    const result = sortGoodStats(goods, "production", "asc");
    expect(result[0].totalProduction).toBe(100);
    expect(result[2].totalProduction).toBe(300);
  });

  it("sorts by supply desc", () => {
    const result = sortGoodStats(goods, "supply", "desc");
    expect(result[0].totalSupply).toBe(200);
    expect(result[2].totalSupply).toBe(50);
  });

  it("sorts by supply asc", () => {
    const result = sortGoodStats(goods, "supply", "asc");
    expect(result[0].totalSupply).toBe(50);
    expect(result[2].totalSupply).toBe(200);
  });

  it("sorts by demand desc", () => {
    const result = sortGoodStats(goods, "demand", "desc");
    expect(result[0].totalDemand).toBe(150);
    expect(result[2].totalDemand).toBe(40);
  });

  it("sorts by demand asc", () => {
    const result = sortGoodStats(goods, "demand", "asc");
    expect(result[0].totalDemand).toBe(40);
    expect(result[2].totalDemand).toBe(150);
  });

  it("sorts by price desc", () => {
    const result = sortGoodStats(goods, "price", "desc");
    expect(result[0].avgPrice).toBe(3);
    expect(result[2].avgPrice).toBe(1);
  });

  it("sorts by price asc", () => {
    const result = sortGoodStats(goods, "price", "asc");
    expect(result[0].avgPrice).toBe(1);
    expect(result[2].avgPrice).toBe(3);
  });

  it("sorts by markets desc", () => {
    const result = sortGoodStats(goods, "markets", "desc");
    expect(result[0].marketCount).toBe(3);
    expect(result[2].marketCount).toBe(1);
  });

  it("sorts by markets asc", () => {
    const result = sortGoodStats(goods, "markets", "asc");
    expect(result[0].marketCount).toBe(1);
    expect(result[2].marketCount).toBe(3);
  });

  it("sorts by name desc (reverse alpha)", () => {
    const result = sortGoodStats(goods, "name", "desc");
    expect(result[0].name).toBe("goods_wool");
    expect(result[2].name).toBe("goods_grain");
  });

  it("sorts by name asc (alphabetical)", () => {
    const result = sortGoodStats(goods, "name", "asc");
    expect(result[0].name).toBe("goods_grain");
    expect(result[2].name).toBe("goods_wool");
  });
});

// ─── sortMarkets ──────────────────────────────────────────────────────────

describe("sortMarkets", () => {
  const markets = [
    mkMarket(1, [mkGood("a"), mkGood("b")], { population: 500, price: 1.0, food: 100, capacity: 1000 }),
    mkMarket(2, [mkGood("a"), mkGood("b"), mkGood("c")], { population: 2000, price: 3.0, food: 800, capacity: 4000 }),
    mkMarket(3, [mkGood("a")], { population: 1000, price: 2.0, food: 400, capacity: 2000 }),
  ];

  it("sorts by population desc", () => {
    const result = sortMarkets(markets, "population", "desc");
    expect(result[0].population).toBe(2000);
    expect(result[2].population).toBe(500);
  });

  it("sorts by population asc", () => {
    const result = sortMarkets(markets, "population", "asc");
    expect(result[0].population).toBe(500);
    expect(result[2].population).toBe(2000);
  });

  it("sorts by price desc", () => {
    const result = sortMarkets(markets, "price", "desc");
    expect(result[0].price).toBe(3.0);
    expect(result[2].price).toBe(1.0);
  });

  it("sorts by price asc", () => {
    const result = sortMarkets(markets, "price", "asc");
    expect(result[0].price).toBe(1.0);
    expect(result[2].price).toBe(3.0);
  });

  it("sorts by food desc", () => {
    const result = sortMarkets(markets, "food", "desc");
    expect(result[0].food).toBe(800);
    expect(result[2].food).toBe(100);
  });

  it("sorts by food asc", () => {
    const result = sortMarkets(markets, "food", "asc");
    expect(result[0].food).toBe(100);
    expect(result[2].food).toBe(800);
  });

  it("sorts by capacity desc", () => {
    const result = sortMarkets(markets, "capacity", "desc");
    expect(result[0].capacity).toBe(4000);
    expect(result[2].capacity).toBe(1000);
  });

  it("sorts by capacity asc", () => {
    const result = sortMarkets(markets, "capacity", "asc");
    expect(result[0].capacity).toBe(1000);
    expect(result[2].capacity).toBe(4000);
  });

  it("sorts by goods count desc", () => {
    const result = sortMarkets(markets, "goods", "desc");
    expect(result[0].goods.length).toBe(3);
    expect(result[2].goods.length).toBe(1);
  });

  it("sorts by goods count asc", () => {
    const result = sortMarkets(markets, "goods", "asc");
    expect(result[0].goods.length).toBe(1);
    expect(result[2].goods.length).toBe(3);
  });
});

// ─── sortGoods ────────────────────────────────────────────────────────────

describe("sortGoods", () => {
  const goods: MarketGoodType[] = [
    mkGood("a", { price: 1, supply: 100, demand: 50, surplus: -10, stockpile: 20, totalProduction: 300 }),
    mkGood("b", { price: 3, supply: 300, demand: 200, surplus: -30, stockpile: 60, totalProduction: 100 }),
    mkGood("c", { price: 2, supply: 200, demand: 80, surplus: 5, stockpile: 40, totalProduction: 200 }),
  ];

  it("sorts by supply desc", () => {
    const result = sortGoods(goods, "supply", "desc");
    expect(result[0].supply).toBe(300);
    expect(result[2].supply).toBe(100);
  });

  it("sorts by supply asc", () => {
    const result = sortGoods(goods, "supply", "asc");
    expect(result[0].supply).toBe(100);
    expect(result[2].supply).toBe(300);
  });

  it("sorts by price desc", () => {
    const result = sortGoods(goods, "price", "desc");
    expect(result[0].price).toBe(3);
    expect(result[2].price).toBe(1);
  });

  it("sorts by demand desc", () => {
    const result = sortGoods(goods, "demand", "desc");
    expect(result[0].demand).toBe(200);
    expect(result[2].demand).toBe(50);
  });

  it("sorts by surplus desc (highest first)", () => {
    const result = sortGoods(goods, "surplus", "desc");
    expect(result[0].surplus).toBe(5);
    expect(result[2].surplus).toBe(-30);
  });

  it("sorts by surplus asc (lowest first)", () => {
    const result = sortGoods(goods, "surplus", "asc");
    expect(result[0].surplus).toBe(-30);
    expect(result[2].surplus).toBe(5);
  });

  it("sorts by stockpile desc", () => {
    const result = sortGoods(goods, "stockpile", "desc");
    expect(result[0].stockpile).toBe(60);
    expect(result[2].stockpile).toBe(20);
  });

  it("sorts by totalProduction desc", () => {
    const result = sortGoods(goods, "totalProduction", "desc");
    expect(result[0].totalProduction).toBe(300);
    expect(result[2].totalProduction).toBe(100);
  });
});
