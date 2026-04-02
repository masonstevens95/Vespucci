import type { MarketType, MarketSortMode } from "../../lib/trade-helpers";
import {
  fmtVal,
  fmtDialect,
  marketName,
  sortMarkets,
} from "../../lib/trade-helpers";
import type { ParsedSave, RGB } from "../../lib/types";
import { MarketModal } from "./MarketModal";

const rgbToHex = ([r, g, b]: RGB): string =>
  "#" + [r, g, b].map(c => c.toString(16).padStart(2, "0")).join("");

interface Props {
  markets: ParsedSave["trade"]["markets"];
  marketNames: Readonly<Record<number, string>>;
  marketOwners: Readonly<Record<number, string>>;
  countryNames: Readonly<Record<string, string>>;
  countryColors: Readonly<Record<string, RGB>>;
  sortMode: MarketSortMode;
  sortDir: "asc" | "desc";
  selectedMarket: MarketType | undefined;
  onSelectMarket: (m: MarketType | undefined) => void;
}

export const MarketsSubTab = ({
  markets,
  marketNames,
  marketOwners,
  countryNames,
  countryColors,
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
          const ownerTag = marketOwners[market.id] ?? "";
          const ownerName = ownerTag !== "" ? (countryNames[ownerTag] ?? ownerTag) : "";
          const ownerColor = ownerTag !== "" && countryColors[ownerTag] !== undefined
            ? rgbToHex(countryColors[ownerTag])
            : "#48a";
          return (
            <div
              key={market.id}
              className="ranking-row"
              style={{ borderLeftColor: ownerColor }}
              onClick={() => onSelectMarket(market)}
            >
              <span className="ranking-pos">{idx + 1}</span>
              <div className="ranking-info">
                <span className="ranking-name">{marketName(market.id, marketNames)}</span>
                <span className="ranking-ai">
                  {ownerName !== "" ? "Owned by " + ownerName + " · " : ""}
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
          ownerName={countryNames[marketOwners[selectedMarket.id] ?? ""] ?? (marketOwners[selectedMarket.id] ?? "")}
          onClose={() => onSelectMarket(undefined)}
        />
      ) : (<></>)}
    </>
  );
};
