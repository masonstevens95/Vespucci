import { useState } from "react";
import type { ParsedSave, RgoProductionEntry } from "../../lib/types";
import {
  type DetailSortMode,
  type MarketGoodEntry,
  fmtGood,
  fmtVal,
  fmtSurplus,
  surplusClass,
  marketName,
  collectGoodEntries,
  sortGoods,
} from "../../lib/trade-helpers";
import { topProducersForGood } from "../../lib/rgo-helpers";
import { resolveDisplayName } from "../../lib/country-info";
import { isProducedGood } from "../../lib/goods-catalog";
import { createLogger } from "../../lib/logger";

const log = createLogger("GoodModal");
import { SortHeader } from "./SortHeader";

interface Props {
  goodName: string;
  markets: ParsedSave["trade"]["markets"];
  marketNames: Readonly<Record<number, string>>;
  countryProduction: Readonly<Record<string, Readonly<Record<string, RgoProductionEntry>>>>;
  countryNames: Readonly<Record<string, string>>;
  onClose: () => void;
}

/** Compute the max of a numeric field across entries (minimum 1 to avoid division by zero). */
const maxOf = (entries: readonly MarketGoodEntry[], fn: (g: MarketGoodEntry) => number): number =>
  entries.reduce((mx, g) => Math.max(mx, fn(g)), 0) || 1;

/** A table cell with a proportional bar behind the text. */
const BarCell = ({ value, label, max, color }: {
  value: number;
  label: string;
  max: number;
  color: string;
}) => (
  <span className="trade-bar-cell">
    <span className="trade-bar" style={{ width: `${(value / max) * 100}%`, background: color }} />
    <span className="trade-bar-label">{label}</span>
  </span>
);

export const GoodModal = ({ goodName, markets, marketNames, countryProduction, countryNames, onClose }: Props) => {
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

  const allGoods = collectGoodEntries(goodName, markets);
  const isProduced = isProducedGood(goodName);
  const rgoProducers = isProduced ? [] : topProducersForGood(goodName, countryProduction, 5);
  log.info(`good=${goodName} isProduced=${isProduced} rgoProducers:${rgoProducers.length}`);
  const sorted = sortGoods(allGoods, detailSort, detailDir);

  const totalSupply = allGoods.reduce((s, g) => s + g.supply, 0);
  const totalDemand = allGoods.reduce((s, g) => s + g.demand, 0);
  const totalProd = allGoods.reduce((s, g) => s + g.totalProduction, 0);
  const avgPrice = allGoods.length > 0
    ? allGoods.reduce((s, g) => s + g.price, 0) / allGoods.length
    : 0;

  const maxPrice = maxOf(allGoods, g => g.price);
  const maxSupply = maxOf(allGoods, g => g.supply);
  const maxDemand = maxOf(allGoods, g => g.demand);

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
              <SortHeader col="price" label="Price" active={detailSort === "price"} dir={detailDir} onSort={handleSort} />
              <SortHeader col="supply" label="Supply" active={detailSort === "supply"} dir={detailDir} onSort={handleSort} />
              <SortHeader col="demand" label="Demand" active={detailSort === "demand"} dir={detailDir} onSort={handleSort} />
              <SortHeader col="surplus" label="Surplus" active={detailSort === "surplus"} dir={detailDir} onSort={handleSort} />
              <SortHeader col="stockpile" label="Stockpile" active={detailSort === "stockpile"} dir={detailDir} onSort={handleSort} />
              <SortHeader col="totalProduction" label="Prod." active={detailSort === "totalProduction"} dir={detailDir} onSort={handleSort} />
            </div>
            {sorted.map((mg) => (
              <div key={mg.marketId} className="trade-market-row">
                <span>{marketName(mg.marketId, marketNames)}</span>
                <BarCell value={mg.price} label={mg.price.toFixed(2)} max={maxPrice} color="#48a" />
                <BarCell value={mg.supply} label={fmtVal(mg.supply)} max={maxSupply} color="#4a8" />
                <BarCell value={mg.demand} label={fmtVal(mg.demand)} max={maxDemand} color="#a84" />
                <span className={surplusClass(mg.surplus)}>
                  {fmtSurplus(mg.surplus)}
                </span>
                <span>{fmtVal(mg.stockpile)}</span>
                <span>{fmtVal(mg.totalProduction)}</span>
              </div>
            ))}
          </div>
          {rgoProducers.length > 0 ? (
            <>
              <div className="modal-divider" />
              <div className="trade-producers-header">Top RGO Producers</div>
              <div className="trade-producers-list">
                <div className="trade-producer-row" style={{ borderBottom: "1px solid #333", paddingBottom: "0.2rem", marginBottom: "0.1rem" }}>
                  <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#666" }}>Country</span>
                  <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#666" }}>Tag</span>
                  <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#666", textAlign: "right" }}>RGO Lvl</span>
                  <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#666", textAlign: "right" }}>Locs</span>
                </div>
                {rgoProducers.map((p) => (
                  <div key={p.tag} className="trade-producer-row">
                    <span className="trade-producer-name">
                      {resolveDisplayName(p.tag, countryNames)}
                    </span>
                    <span className="trade-producer-tag">{p.tag}</span>
                    <span className="trade-producer-size">{p.totalSize}</span>
                    <span className="trade-producer-locs">{p.locationCount}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (<></>)}
        </div>
      </div>
    </div>
  );
};
