import { useState } from "react";
import type { ParsedSave } from "../lib/types";

interface Props {
  parsed: ParsedSave;
}

type GoodSortMode = "production" | "name" | "price" | "supply" | "demand" | "markets";
type MarketSortMode = "population" | "price" | "food" | "capacity" | "goods";
type DetailSortMode = "supply" | "price" | "demand" | "surplus" | "stockpile" | "totalProduction";

/** Format a good name for display. */
const fmtGood = (name: string): string =>
  name.replace(/^goods_/, "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

/** Resolve a market name from the names map. */
const marketName = (id: number, names: Readonly<Record<number, string>>): string =>
  names[id] ?? `Market ${id}`;

/** Format large numbers compactly. */
const fmtVal = (n: number): string =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M"
    : n >= 1_000 ? (n / 1_000).toFixed(1) + "K"
    : n > 0 ? n.toFixed(0)
    : "—";

/** Format a dialect string for display. */
const fmtDialect = (d: string): string =>
  d.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

type MarketType = ParsedSave["trade"]["markets"][number];
type MarketGoodType = MarketType["goods"][number];
type MarketGoodEntry = MarketGoodType & { readonly marketId: number };

type TradeSubTab = "goods" | "markets";

export const TradeTab = ({ parsed }: Props) => {
  const { trade } = parsed;
  const [subTab, setSubTab] = useState<TradeSubTab>("goods");
  const [goodSortMode, setGoodSortMode] = useState<GoodSortMode>("production");
  const [marketSortMode, setMarketSortMode] = useState<MarketSortMode>("population");
  const [selectedMarket, setSelectedMarket] = useState<MarketType | undefined>(undefined);
  const [selectedGood, setSelectedGood] = useState<string | undefined>(undefined);

  return (
    <div className="rankings-tab">
      <div className="rankings-controls">
        <div className="subtab-bar">
          <button
            className={`subtab-btn${subTab === "goods" ? " subtab-active" : ""}`}
            onClick={() => setSubTab("goods")}
          >
            Goods ({Object.keys(trade.producedGoods).length})
          </button>
          <button
            className={`subtab-btn${subTab === "markets" ? " subtab-active" : ""}`}
            onClick={() => setSubTab("markets")}
          >
            Markets ({trade.markets.length})
          </button>
        </div>
        {subTab === "goods" ? (
          <label className="option">
            Sort:
            <select
              value={goodSortMode}
              onChange={(e) => setGoodSortMode(e.target.value as GoodSortMode)}
              className="style-select"
            >
              <option value="production">By Production</option>
              <option value="supply">By Total Supply</option>
              <option value="demand">By Total Demand</option>
              <option value="price">By Avg Price</option>
              <option value="markets">By # Markets</option>
              <option value="name">By Name</option>
            </select>
          </label>
        ) : (
          <label className="option">
            Sort:
            <select
              value={marketSortMode}
              onChange={(e) => setMarketSortMode(e.target.value as MarketSortMode)}
              className="style-select"
            >
              <option value="population">By Population</option>
              <option value="price">By Price Level</option>
              <option value="food">By Food</option>
              <option value="capacity">By Capacity</option>
              <option value="goods">By # Goods</option>
            </select>
          </label>
        )}
      </div>

      {subTab === "goods" ? (
        <GoodsSubTab
          producedGoods={trade.producedGoods}
          markets={trade.markets}
          marketNames={trade.marketNames}
          sortMode={goodSortMode}
          selectedGood={selectedGood}
          onSelectGood={setSelectedGood}
        />
      ) : (
        <MarketsSubTab
          markets={trade.markets}
          marketNames={trade.marketNames}
          sortMode={marketSortMode}
          selectedMarket={selectedMarket}
          onSelectMarket={setSelectedMarket}
        />
      )}
    </div>
  );
};

interface GoodAggStats {
  readonly name: string;
  readonly totalProduction: number;
  readonly avgPrice: number;
  readonly totalSupply: number;
  readonly totalDemand: number;
  readonly totalSurplus: number;
  readonly marketCount: number;
}

const buildGoodStats = (
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

const sortGoodStats = (goods: GoodAggStats[], mode: GoodSortMode): GoodAggStats[] =>
  [...goods].sort((a, b) => {
    if (mode === "production") { return b.totalProduction - a.totalProduction; }
    else if (mode === "supply") { return b.totalSupply - a.totalSupply; }
    else if (mode === "demand") { return b.totalDemand - a.totalDemand; }
    else if (mode === "price") { return b.avgPrice - a.avgPrice; }
    else if (mode === "markets") { return b.marketCount - a.marketCount; }
    else { return a.name.localeCompare(b.name); }
  });

const GoodsSubTab = ({ producedGoods, markets, marketNames, sortMode, selectedGood, onSelectGood }: {
  producedGoods: Readonly<Record<string, number>>;
  markets: ParsedSave["trade"]["markets"];
  marketNames: Readonly<Record<number, string>>;
  sortMode: GoodSortMode;
  selectedGood: string | undefined;
  onSelectGood: (g: string | undefined) => void;
}) => {
  const sorted = sortGoodStats(buildGoodStats(producedGoods, markets), sortMode);

  return (
    <>
      <div className="rankings-grid">
        {sorted.map((gs, idx) => (
          <div
            key={gs.name}
            className={`ranking-row${selectedGood === gs.name ? " trade-good-selected" : ""}`}
            style={{ borderLeftColor: "#48a" }}
            onClick={() => onSelectGood(selectedGood === gs.name ? undefined : gs.name)}
          >
            <span className="ranking-pos">{idx + 1}</span>
            <div className="ranking-info">
              <span className="ranking-name">{fmtGood(gs.name)}</span>
              <span className="ranking-ai">{gs.marketCount} markets</span>
            </div>
            <div className="ranking-stats">
              <div className="ranking-stat">
                <span className="ranking-stat-val">{fmtVal(gs.totalProduction)}</span>
                <span className="ranking-stat-lbl">Production</span>
              </div>
              <div className="ranking-stat">
                <span className="ranking-stat-val">{gs.avgPrice.toFixed(2)}</span>
                <span className="ranking-stat-lbl">Avg Price</span>
              </div>
              <div className="ranking-stat">
                <span className="ranking-stat-val">{fmtVal(gs.totalSupply)}</span>
                <span className="ranking-stat-lbl">Supply</span>
              </div>
              <div className="ranking-stat">
                <span className="ranking-stat-val">{fmtVal(gs.totalDemand)}</span>
                <span className="ranking-stat-lbl">Demand</span>
              </div>
              <div className={`ranking-stat`}>
                <span className={`ranking-stat-val ${gs.totalSurplus > 0 ? "trade-surplus-pos" : gs.totalSurplus < 0 ? "trade-surplus-neg" : ""}`}>
                  {gs.totalSurplus > 0 ? "+" : ""}{fmtVal(gs.totalSurplus)}
                </span>
                <span className="ranking-stat-lbl">Surplus</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedGood !== undefined ? (
        <GoodModal goodName={selectedGood} markets={markets} marketNames={marketNames} onClose={() => onSelectGood(undefined)} />
      ) : (<></>)}
    </>
  );
};

const sortMarkets = (markets: ParsedSave["trade"]["markets"], mode: MarketSortMode): ParsedSave["trade"]["markets"] =>
  [...markets].sort((a, b) => {
    if (mode === "population") { return b.population - a.population; }
    else if (mode === "price") { return b.price - a.price; }
    else if (mode === "food") { return b.food - a.food; }
    else if (mode === "capacity") { return b.capacity - a.capacity; }
    else { return b.goods.length - a.goods.length; }
  });

const MarketsSubTab = ({ markets, marketNames, sortMode, selectedMarket, onSelectMarket }: {
  markets: ParsedSave["trade"]["markets"];
  marketNames: Readonly<Record<number, string>>;
  sortMode: MarketSortMode;
  selectedMarket: MarketType | undefined;
  onSelectMarket: (m: MarketType | undefined) => void;
}) => {
  const sortedMarkets = sortMarkets(markets, sortMode);

  return (
    <>
      <div className="rankings-grid">
        {sortedMarkets.map((market, idx) => {
          const totalProd = market.goods.reduce((s, g) => s + g.totalProduction, 0);
          return (
            <div
              key={market.id}
              className="ranking-row"
              style={{ borderLeftColor: "#48a" }}
              onClick={() => onSelectMarket(market)}
            >
              <span className="ranking-pos">{idx + 1}</span>
              <div className="ranking-info">
                <span className="ranking-name">{marketName(market.id, marketNames)}</span>
                <span className="ranking-ai">
                  {market.goods.length} goods
                  {market.dialect !== "" ? ` · ${fmtDialect(market.dialect)}` : ""}
                </span>
              </div>
              <div className="ranking-stats">
                <div className="ranking-stat">
                  <span className="ranking-stat-val">{fmtVal(market.population)}</span>
                  <span className="ranking-stat-lbl">Population</span>
                </div>
                <div className="ranking-stat">
                  <span className="ranking-stat-val">{market.price.toFixed(1)}</span>
                  <span className="ranking-stat-lbl">Price Level</span>
                </div>
                <div className="ranking-stat">
                  <span className="ranking-stat-val">{fmtVal(market.food)}</span>
                  <span className="ranking-stat-lbl">Food</span>
                </div>
                <div className="ranking-stat">
                  <span className="ranking-stat-val">{fmtVal(market.capacity)}</span>
                  <span className="ranking-stat-lbl">Capacity</span>
                </div>
                <div className="ranking-stat">
                  <span className="ranking-stat-val">{fmtVal(totalProd)}</span>
                  <span className="ranking-stat-lbl">Total Prod.</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedMarket !== undefined ? (
        <MarketModal market={selectedMarket} marketNames={marketNames} onClose={() => onSelectMarket(undefined)} />
      ) : (<></>)}
    </>
  );
};

// ─── Sortable column header ────────────────────────────────────────────────

const SortHeader = ({ col, label, active, onSort }: {
  col: DetailSortMode;
  label: string;
  active: boolean;
  onSort: (col: DetailSortMode) => void;
}) => (
  <span
    className={`trade-sort-header${active ? " trade-sort-active" : ""}`}
    onClick={() => onSort(col)}
  >
    {label}{active ? " ▾" : ""}
  </span>
);

const sortGoods = <T extends MarketGoodType>(goods: readonly T[], mode: DetailSortMode): T[] =>
  [...goods].sort((a, b) => {
    if (mode === "price") { return b.price - a.price; }
    else if (mode === "demand") { return b.demand - a.demand; }
    else if (mode === "surplus") { return b.surplus - a.surplus; }
    else if (mode === "stockpile") { return b.stockpile - a.stockpile; }
    else if (mode === "totalProduction") { return b.totalProduction - a.totalProduction; }
    else { return b.supply - a.supply; }
  });

// ─── Good detail modal ─────────────────────────────────────────────────────

/** Modal showing per-market breakdown for a specific good. */
const GoodModal = ({ goodName, markets, marketNames, onClose }: {
  goodName: string;
  markets: ParsedSave["trade"]["markets"];
  marketNames: Readonly<Record<number, string>>;
  onClose: () => void;
}) => {
  const [detailSort, setDetailSort] = useState<DetailSortMode>("supply");

  const allGoods: MarketGoodEntry[] = markets
    .map(m => {
      const g = m.goods.find(g2 => g2.name === goodName);
      return g ? ({ marketId: m.id, ...g } as MarketGoodEntry) : null;
    })
    .filter((x): x is MarketGoodEntry => x !== null);

  const sorted = sortGoods(allGoods, detailSort);

  const totalSupply = allGoods.reduce((s, g) => s + g.supply, 0);
  const totalDemand = allGoods.reduce((s, g) => s + g.demand, 0);
  const totalProd = allGoods.reduce((s, g) => s + g.totalProduction, 0);
  const avgPrice = allGoods.length > 0
    ? allGoods.reduce((s, g) => s + g.price, 0) / allGoods.length
    : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ borderColor: "#48a", maxWidth: "750px" }} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>x</button>
        <div className="modal-header" style={{ borderBottomColor: "#48a" }}>
          <div className="modal-titles">
            <h2 className="modal-name">{fmtGood(goodName)}</h2>
            <span className="modal-tag">Traded in {allGoods.length} markets</span>
          </div>
        </div>
        <div className="modal-body">
          <div className="modal-stats-grid">
            <div className="modal-stat">
              <span className="modal-stat-value">{fmtVal(totalProd)}</span>
              <span className="modal-stat-label">Total Production</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-value">{fmtVal(totalSupply)}</span>
              <span className="modal-stat-label">Total Supply</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-value">{fmtVal(totalDemand)}</span>
              <span className="modal-stat-label">Total Demand</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-value">{avgPrice.toFixed(2)}</span>
              <span className="modal-stat-label">Avg Price</span>
            </div>
          </div>
          <div className="modal-divider" />
          <div className="trade-good-markets">
            <div className="trade-market-header">
              <span>Market</span>
              <SortHeader col="price" label="Price" active={detailSort === "price"} onSort={setDetailSort} />
              <SortHeader col="supply" label="Supply" active={detailSort === "supply"} onSort={setDetailSort} />
              <SortHeader col="demand" label="Demand" active={detailSort === "demand"} onSort={setDetailSort} />
              <SortHeader col="surplus" label="Surplus" active={detailSort === "surplus"} onSort={setDetailSort} />
              <SortHeader col="stockpile" label="Stockpile" active={detailSort === "stockpile"} onSort={setDetailSort} />
              <SortHeader col="totalProduction" label="Prod." active={detailSort === "totalProduction"} onSort={setDetailSort} />
            </div>
            {sorted.map((mg) => (
              <div key={mg.marketId} className="trade-market-row">
                <span>{marketName(mg.marketId, marketNames)}</span>
                <span>{mg.price.toFixed(2)}</span>
                <span>{fmtVal(mg.supply)}</span>
                <span>{fmtVal(mg.demand)}</span>
                <span className={mg.surplus > 0 ? "trade-surplus-pos" : mg.surplus < 0 ? "trade-surplus-neg" : ""}>
                  {mg.surplus > 0 ? "+" : ""}{fmtVal(mg.surplus)}
                </span>
                <span>{fmtVal(mg.stockpile)}</span>
                <span>{fmtVal(mg.totalProduction)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Market detail modal ───────────────────────────────────────────────────

/** Modal showing all goods in a specific market. */
const MarketModal = ({ market, marketNames, onClose }: {
  market: MarketType;
  marketNames: Readonly<Record<number, string>>;
  onClose: () => void;
}) => {
  const [detailSort, setDetailSort] = useState<DetailSortMode>("supply");
  const sortedGoods = sortGoods(market.goods, detailSort);

  const totalProd = market.goods.reduce((s, g) => s + g.totalProduction, 0);
  const totalSupply = market.goods.reduce((s, g) => s + g.supply, 0);
  const totalDemand = market.goods.reduce((s, g) => s + g.demand, 0);
  const capacityPct = market.capacity > 0
    ? ((market.population / market.capacity) * 100).toFixed(1)
    : "—";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ borderColor: "#48a", maxWidth: "750px" }} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>x</button>
        <div className="modal-header" style={{ borderBottomColor: "#48a" }}>
          <div className="modal-titles">
            <h2 className="modal-name">{marketName(market.id, marketNames)}</h2>
            <span className="modal-tag">
              {market.dialect !== "" ? fmtDialect(market.dialect) + " · " : ""}
              {market.goods.length} goods
            </span>
          </div>
        </div>
        <div className="modal-body">
          <div className="modal-stats-grid">
            <div className="modal-stat">
              <span className="modal-stat-value">{fmtVal(market.population)}</span>
              <span className="modal-stat-label">Population</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-value">{market.price.toFixed(2)}</span>
              <span className="modal-stat-label">Price Level</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-value">{fmtVal(market.food)}</span>
              <span className="modal-stat-label">Food</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-value">{fmtVal(market.capacity)}</span>
              <span className="modal-stat-label">Capacity</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-value">{capacityPct}{capacityPct !== "—" ? "%" : ""}</span>
              <span className="modal-stat-label">Pop / Capacity</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-value">{fmtVal(totalProd)}</span>
              <span className="modal-stat-label">Total Prod.</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-value">{fmtVal(totalSupply)}</span>
              <span className="modal-stat-label">Total Supply</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-value">{fmtVal(totalDemand)}</span>
              <span className="modal-stat-label">Total Demand</span>
            </div>
          </div>
          <div className="modal-divider" />
          <div className="trade-good-markets">
            <div className="trade-market-header">
              <span>Good</span>
              <SortHeader col="price" label="Price" active={detailSort === "price"} onSort={setDetailSort} />
              <SortHeader col="supply" label="Supply" active={detailSort === "supply"} onSort={setDetailSort} />
              <SortHeader col="demand" label="Demand" active={detailSort === "demand"} onSort={setDetailSort} />
              <SortHeader col="surplus" label="Surplus" active={detailSort === "surplus"} onSort={setDetailSort} />
              <SortHeader col="stockpile" label="Stockpile" active={detailSort === "stockpile"} onSort={setDetailSort} />
              <SortHeader col="totalProduction" label="Prod." active={detailSort === "totalProduction"} onSort={setDetailSort} />
            </div>
            {sortedGoods.map((g) => (
              <div key={g.name} className="trade-market-row">
                <span>{fmtGood(g.name)}</span>
                <span>{g.price.toFixed(2)}</span>
                <span>{fmtVal(g.supply)}</span>
                <span>{fmtVal(g.demand)}</span>
                <span className={g.surplus > 0 ? "trade-surplus-pos" : g.surplus < 0 ? "trade-surplus-neg" : ""}>
                  {g.surplus > 0 ? "+" : ""}{fmtVal(g.surplus)}
                </span>
                <span>{fmtVal(g.stockpile)}</span>
                <span>{fmtVal(g.totalProduction)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
