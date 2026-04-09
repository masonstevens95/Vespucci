import { useState } from "react";
import { goodDisplayName } from "../../../lib/goods-catalog";
import { isProducedGood } from "../../../lib/goods-catalog";

type SortCol = "good" | "amount" | "price" | "rank";

const sortEntries = (
  entries: readonly [string, number][],
  col: SortCol,
  dir: "asc" | "desc",
  goodAvgPrices: Readonly<Record<string, number>>,
  producedGoodsRankings: Readonly<Record<string, number>>,
): [string, number][] => {
  const m = dir === "asc" ? 1 : -1;
  return [...entries].sort(([aG, aAmt], [bG, bAmt]) => {
    if (col === "good") { return m * aG.localeCompare(bG); }
    if (col === "amount") { return m * (aAmt - bAmt); }
    if (col === "price") {
      return m * ((goodAvgPrices[aG] ?? 0) - (goodAvgPrices[bG] ?? 0));
    }
    const aR = producedGoodsRankings[aG] ?? Infinity;
    const bR = producedGoodsRankings[bG] ?? Infinity;
    return m * (aR - bR);
  });
};

const ColHeader = ({
  label,
  col,
  active,
  dir,
  align,
  onClick,
}: {
  label: string;
  col: SortCol;
  active: boolean;
  dir: "asc" | "desc";
  align?: "right";
  onClick: (c: SortCol) => void;
}) => (
  <span
    className={`produces-col-sortable${active ? " produces-col-active" : ""}`}
    style={align ? { textAlign: "right" } : undefined}
    onClick={() => onClick(col)}
  >
    {label}
    {active ? (dir === "desc" ? " ↓" : " ↑") : ""}
  </span>
);

export const ProducedGoodsSection = ({
  lastMonthProduced,
  producedGoodsRankings,
  goodAvgPrices,
}: {
  lastMonthProduced: Readonly<Record<string, number>>;
  producedGoodsRankings: Readonly<Record<string, number>>;
  goodAvgPrices: Readonly<Record<string, number>>;
}) => {
  const [sortCol, setSortCol] = useState<SortCol>("amount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const entries = (Object.entries(lastMonthProduced) as [string, number][])
    .filter(([good]) => isProducedGood(good));

  if (entries.length === 0) {
    return <></>;
  } else {
    const handleSort = (col: SortCol) => {
      if (col === sortCol) {
        setSortDir((d) => (d === "desc" ? "asc" : "desc"));
      } else {
        setSortCol(col);
        setSortDir(col === "good" ? "asc" : "desc");
      }
    };

    const sorted = sortEntries(entries, sortCol, sortDir, goodAvgPrices, producedGoodsRankings);

    return (
      <div className="produces-wrap">
        <div className="produces-scroll">
          <div className="produces-row produces-row-header" style={{ gridTemplateColumns: "1fr 3.5rem 3.5rem 3rem" }}>
            <ColHeader label="Good" col="good" active={sortCol === "good"} dir={sortDir} onClick={handleSort} />
            <ColHeader label="Total" col="amount" active={sortCol === "amount"} dir={sortDir} align="right" onClick={handleSort} />
            <ColHeader label="Price" col="price" active={sortCol === "price"} dir={sortDir} align="right" onClick={handleSort} />
            <ColHeader label="Rank" col="rank" active={sortCol === "rank"} dir={sortDir} align="right" onClick={handleSort} />
          </div>
          {sorted.map(([good, amount]) => {
            const rank = producedGoodsRankings[good];
            const price = goodAvgPrices[good];
            return (
              <div key={good} className="produces-row" style={{ gridTemplateColumns: "1fr 3.5rem 3.5rem 3rem" }}>
                <span>{goodDisplayName(good)}</span>
                <span className="produces-col-num">{Math.round(amount).toLocaleString()}</span>
                <span className="produces-col-num">
                  {price !== undefined ? price.toFixed(2) : "—"}
                </span>
                <span className="produces-col-rank">
                  {rank !== undefined ? `#${rank}` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
};
