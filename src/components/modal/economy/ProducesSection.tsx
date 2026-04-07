import { useState } from "react";
import { fmtGood } from "../../../lib/trade-helpers";
import type { RgoProductionEntry } from "../../../lib/types";

type SortCol = "good" | "locs" | "levels" | "price" | "rank";

const sortEntries = (
  entries: readonly [string, RgoProductionEntry][],
  col: SortCol,
  dir: "asc" | "desc",
  goodAvgPrices: Readonly<Record<string, number>>,
  goodsRankings: Readonly<Record<string, number>>,
): [string, RgoProductionEntry][] => {
  const m = dir === "asc" ? 1 : -1;
  return [...entries].sort(([aG, aE], [bG, bE]) => {
    if (col === "good") { return m * aG.localeCompare(bG); }
    if (col === "locs") { return m * (aE.locationCount - bE.locationCount); }
    if (col === "levels") { return m * (aE.totalSize - bE.totalSize); }
    if (col === "price") {
      return m * ((goodAvgPrices[aG] ?? 0) - (goodAvgPrices[bG] ?? 0));
    }
    /* rank: lower number = better; missing rank sorts to bottom */
    const aR = goodsRankings[aG] ?? Infinity;
    const bR = goodsRankings[bG] ?? Infinity;
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

export const ProducesSection = ({
  production,
  goodsRankings,
  goodAvgPrices,
}: {
  production: Readonly<Record<string, RgoProductionEntry>>;
  goodsRankings: Readonly<Record<string, number>>;
  goodAvgPrices: Readonly<Record<string, number>>;
}) => {
  const [sortCol, setSortCol] = useState<SortCol>("levels");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const entries = Object.entries(production) as [string, RgoProductionEntry][];

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

    const sorted = sortEntries(entries, sortCol, sortDir, goodAvgPrices, goodsRankings);

    return (
      <>
        <div className="modal-row-divider" />
        <div className="modal-section-label">Produces</div>
        <div className="produces-wrap">
          <div className="produces-row produces-row-header">
            <ColHeader label="Good" col="good" active={sortCol === "good"} dir={sortDir} onClick={handleSort} />
            <ColHeader label="Locs" col="locs" active={sortCol === "locs"} dir={sortDir} align="right" onClick={handleSort} />
            <ColHeader label="Levels" col="levels" active={sortCol === "levels"} dir={sortDir} align="right" onClick={handleSort} />
            <ColHeader label="Price" col="price" active={sortCol === "price"} dir={sortDir} align="right" onClick={handleSort} />
            <ColHeader label="Rank" col="rank" active={sortCol === "rank"} dir={sortDir} align="right" onClick={handleSort} />
          </div>
          <div className="produces-scroll">
            {sorted.map(([good, entry]) => {
              const rank = goodsRankings[good];
              const price = goodAvgPrices[good];
              return (
                <div key={good} className="produces-row">
                  <span>{fmtGood(good)}</span>
                  <span className="produces-col-num">{entry.locationCount}</span>
                  <span className="produces-col-num">{entry.totalSize}</span>
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
      </>
    );
  }
};
