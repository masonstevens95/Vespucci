import { useState } from "react";
import type {
  MarketType,
  DetailSortMode,
} from "../../lib/trade-helpers";
import {
  fmtGood,
  fmtVal,
  fmtSurplus,
  surplusClass,
  fmtDialect,
  capacityPct,
  marketName,
  sortGoods,
} from "../../lib/trade-helpers";
import { SortHeader } from "./SortHeader";

interface Props {
  market: MarketType;
  marketNames: Readonly<Record<number, string>>;
  ownerName: string;
  onClose: () => void;
}

export const MarketModal = ({ market, marketNames, ownerName, onClose }: Props) => {
  const [detailSort, setDetailSort] = useState<DetailSortMode>("supply");
  const [detailDir, setDetailDir] = useState<"asc" | "desc">("desc");

  const handleSort = (col: DetailSortMode) => {
    if (col === detailSort) {
      setDetailDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setDetailSort(col);
      setDetailDir("desc");
    }
  };

  const sortedGoods = sortGoods(market.goods, detailSort, detailDir);

  const totalProd = market.goods.reduce((s, g) => s + g.totalProduction, 0);
  const totalSupply = market.goods.reduce((s, g) => s + g.supply, 0);
  const totalDemand = market.goods.reduce((s, g) => s + g.demand, 0);
  const pct = capacityPct(market.population, market.capacity);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ borderColor: "#48a", maxWidth: "750px" }} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>x</button>
        <div className="modal-header" style={{ borderBottomColor: "#48a" }}>
          <div className="modal-titles">
            <h2 className="modal-name">{marketName(market.id, marketNames)}</h2>
            <span className="modal-tag">
              {ownerName !== "" ? "Owned by " + ownerName + " · " : ""}
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
              <span className="modal-stat-value">{pct}</span>
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
              <SortHeader col="price" label="Price" active={detailSort === "price"} dir={detailDir} onSort={handleSort} />
              <SortHeader col="supply" label="Supply" active={detailSort === "supply"} dir={detailDir} onSort={handleSort} />
              <SortHeader col="demand" label="Demand" active={detailSort === "demand"} dir={detailDir} onSort={handleSort} />
              <SortHeader col="surplus" label="Surplus" active={detailSort === "surplus"} dir={detailDir} onSort={handleSort} />
              <SortHeader col="stockpile" label="Stockpile" active={detailSort === "stockpile"} dir={detailDir} onSort={handleSort} />
              <SortHeader col="totalProduction" label="Prod." active={detailSort === "totalProduction"} dir={detailDir} onSort={handleSort} />
            </div>
            {sortedGoods.map((g) => (
              <div key={g.name} className="trade-market-row">
                <span>{fmtGood(g.name)}</span>
                <span>{g.price.toFixed(2)}</span>
                <span>{fmtVal(g.supply)}</span>
                <span>{fmtVal(g.demand)}</span>
                <span className={surplusClass(g.surplus)}>
                  {fmtSurplus(g.surplus)}
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
