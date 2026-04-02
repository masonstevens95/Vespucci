import { useState } from "react";
import type { ParsedSave } from "../../lib/types";
import {
  type DetailSortMode,
  fmtGood,
  fmtVal,
  fmtSurplus,
  surplusClass,
  marketName,
  collectGoodEntries,
  sortGoods,
} from "../../lib/trade-helpers";
import { SortHeader } from "./SortHeader";

interface Props {
  goodName: string;
  markets: ParsedSave["trade"]["markets"];
  marketNames: Readonly<Record<number, string>>;
  onClose: () => void;
}

export const GoodModal = ({ goodName, markets, marketNames, onClose }: Props) => {
  const [detailSort, setDetailSort] = useState<DetailSortMode>("supply");

  const allGoods = collectGoodEntries(goodName, markets);
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
                <span className={surplusClass(mg.surplus)}>
                  {fmtSurplus(mg.surplus)}
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
