import { useState } from "react";
import type { ParsedSave } from "../lib/types";
import type { GoodSortMode, MarketSortMode, MarketType } from "../lib/trade-helpers";
import { filterGoods, filterMarkets } from "../lib/trade-helpers";
import { GoodsSubTab } from "./trade/GoodsSubTab";
import { MarketsSubTab } from "./trade/MarketsSubTab";

interface Props {
  parsed: ParsedSave;
}

type TradeSubTab = "goods" | "markets";

export const TradeTab = ({ parsed }: Props) => {
  const { trade } = parsed;
  const [subTab, setSubTab] = useState<TradeSubTab>("goods");
  const [goodSortMode, setGoodSortMode] = useState<GoodSortMode>("production");
  const [goodSortDir, setGoodSortDir] = useState<"desc" | "asc">("desc");
  const [marketSortMode, setMarketSortMode] = useState<MarketSortMode>("population");
  const [marketSortDir, setMarketSortDir] = useState<"desc" | "asc">("desc");
  const [selectedMarket, setSelectedMarket] = useState<MarketType | undefined>(undefined);
  const [selectedGood, setSelectedGood] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");

  const filteredGoods = filterGoods(trade.producedGoods, search);
  const filteredMarkets = filterMarkets(
    trade.markets, trade.marketNames, trade.marketOwners, parsed.countryNames, search,
  );

  return (
    <div className="rankings-tab">
      <div className="rankings-controls">
        <div className="subtab-bar">
          <button
            className={`subtab-btn${subTab === "goods" ? " subtab-active" : ""}`}
            onClick={() => setSubTab("goods")}
          >
            Goods ({Object.keys(filteredGoods).length})
          </button>
          <button
            className={`subtab-btn${subTab === "markets" ? " subtab-active" : ""}`}
            onClick={() => setSubTab("markets")}
          >
            Markets ({filteredMarkets.length})
          </button>
        </div>
        <input
          className="trade-search"
          type="text"
          placeholder={subTab === "goods" ? "Filter goods..." : "Filter markets..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {subTab === "goods" ? (
          <>
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
                <option value="surplus">By Surplus</option>
                <option value="markets">By # Markets</option>
                <option value="name">By Name</option>
              </select>
              <button
                className="sort-dir-btn"
                onClick={() => setGoodSortDir(d => d === "desc" ? "asc" : "desc")}
                title={goodSortDir === "desc" ? "Descending" : "Ascending"}
              >{goodSortDir === "desc" ? "↓" : "↑"}</button>
            </label>
          </>
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
              <option value="totalProduction">By Total Production</option>
              <option value="goods">By # Goods</option>
            </select>
            <button
              className="sort-dir-btn"
              onClick={() => setMarketSortDir(d => d === "desc" ? "asc" : "desc")}
              title={marketSortDir === "desc" ? "Descending" : "Ascending"}
            >{marketSortDir === "desc" ? "↓" : "↑"}</button>
          </label>
        )}
      </div>

      {subTab === "goods" ? (
        <GoodsSubTab
          producedGoods={filteredGoods}
          markets={trade.markets}
          marketNames={trade.marketNames}
          countryProduction={parsed.countryProduction}
          countryNames={parsed.countryNames}
          sortMode={goodSortMode}
          sortDir={goodSortDir}
          selectedGood={selectedGood}
          onSelectGood={setSelectedGood}
        />
      ) : (
        <MarketsSubTab
          markets={filteredMarkets}
          marketNames={trade.marketNames}
          marketOwners={trade.marketOwners}
          countryNames={parsed.countryNames}
          countryColors={parsed.countryColors}
          sortMode={marketSortMode}
          sortDir={marketSortDir}
          selectedMarket={selectedMarket}
          onSelectMarket={setSelectedMarket}
        />
      )}
    </div>
  );
};
