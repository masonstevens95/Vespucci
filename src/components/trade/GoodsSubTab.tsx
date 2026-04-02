import type { ParsedSave } from "../../lib/types";
import type { GoodSortMode } from "../../lib/trade-helpers";
import {
  fmtGood,
  fmtVal,
  fmtSurplus,
  surplusClass,
  buildGoodStats,
  sortGoodStats,
} from "../../lib/trade-helpers";
import { GoodModal } from "./GoodModal";

interface Props {
  producedGoods: Readonly<Record<string, number>>;
  markets: ParsedSave["trade"]["markets"];
  marketNames: Readonly<Record<number, string>>;
  sortMode: GoodSortMode;
  sortDir: "asc" | "desc";
  selectedGood: string | undefined;
  onSelectGood: (g: string | undefined) => void;
}

export const GoodsSubTab = ({
  producedGoods,
  markets,
  marketNames,
  sortMode,
  sortDir,
  selectedGood,
  onSelectGood,
}: Props) => {
  const sorted = sortGoodStats(buildGoodStats(producedGoods, markets), sortMode, sortDir);

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
              <div className="ranking-stat">
                <span className={`ranking-stat-val ${surplusClass(gs.totalSurplus)}`}>
                  {fmtSurplus(gs.totalSurplus)}
                </span>
                <span className="ranking-stat-lbl">Surplus</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedGood !== undefined ? (
        <GoodModal
          goodName={selectedGood}
          markets={markets}
          marketNames={marketNames}
          onClose={() => onSelectGood(undefined)}
        />
      ) : (<></>)}
    </>
  );
};
