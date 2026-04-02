import type { MarketType, MarketSortMode } from "../../lib/trade-helpers";
import {
  fmtVal,
  fmtDialect,
  marketName,
  sortMarkets,
} from "../../lib/trade-helpers";
import type { ParsedSave } from "../../lib/types";
import { MarketModal } from "./MarketModal";

interface Props {
  markets: ParsedSave["trade"]["markets"];
  marketNames: Readonly<Record<number, string>>;
  sortMode: MarketSortMode;
  sortDir: "asc" | "desc";
  selectedMarket: MarketType | undefined;
  onSelectMarket: (m: MarketType | undefined) => void;
}

export const MarketsSubTab = ({
  markets,
  marketNames,
  sortMode,
  sortDir,
  selectedMarket,
  onSelectMarket,
}: Props) => {
  const sortedMarkets = sortMarkets(markets, sortMode, sortDir);

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
        <MarketModal
          market={selectedMarket}
          marketNames={marketNames}
          onClose={() => onSelectMarket(undefined)}
        />
      ) : (<></>)}
    </>
  );
};
