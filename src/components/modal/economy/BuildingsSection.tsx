import { useState } from "react";
import { fmtGood } from "../../../lib/trade-helpers";
import { fmtCurrency } from "../../../lib/format";
import type { BuildingSummary } from "../../../lib/types";

// ---------------------------------------------------------------------------
// Produced variant (has output column)
// ---------------------------------------------------------------------------

type ProducedCol = "type" | "count" | "levels" | "output" | "profit";

const sortProduced = (
  buildings: readonly BuildingSummary[],
  col: ProducedCol,
  dir: "asc" | "desc",
): BuildingSummary[] => {
  const m = dir === "asc" ? 1 : -1;
  return [...buildings].sort((a, b) => {
    if (col === "type")   { return m * a.type.localeCompare(b.type); }
    if (col === "count")  { return m * (a.count - b.count); }
    if (col === "levels") { return m * (a.totalLevel - b.totalLevel); }
    if (col === "output") { return m * (a.totalOutput - b.totalOutput); }
    return m * (a.totalProfit - b.totalProfit);
  });
};

// ---------------------------------------------------------------------------
// Other variant (has upkeep column)
// ---------------------------------------------------------------------------

type OtherCol = "type" | "count" | "levels" | "upkeep" | "profit";

const sortOther = (
  buildings: readonly BuildingSummary[],
  col: OtherCol,
  dir: "asc" | "desc",
): BuildingSummary[] => {
  const m = dir === "asc" ? 1 : -1;
  return [...buildings].sort((a, b) => {
    if (col === "type")   { return m * a.type.localeCompare(b.type); }
    if (col === "count")  { return m * (a.count - b.count); }
    if (col === "levels") { return m * (a.totalLevel - b.totalLevel); }
    if (col === "upkeep") { return m * (a.totalUpkeep - b.totalUpkeep); }
    return m * (a.totalProfit - b.totalProfit);
  });
};

// ---------------------------------------------------------------------------
// Shared column header
// ---------------------------------------------------------------------------

const ColHeader = <C extends string>({
  label, col, active, dir, align, onClick,
}: {
  label: string; col: C; active: boolean; dir: "asc" | "desc";
  align?: "right"; onClick: (c: C) => void;
}) => (
  <span
    className={`produces-col-sortable${active ? " produces-col-active" : ""}`}
    style={align ? { textAlign: "right" } : undefined}
    onClick={() => onClick(col)}
  >
    {label}{active ? (dir === "desc" ? " ↓" : " ↑") : ""}
  </span>
);

// ---------------------------------------------------------------------------
// Public components
// ---------------------------------------------------------------------------

export const ProducedBuildingsSection = ({
  buildings,
}: {
  buildings: readonly BuildingSummary[];
}) => {
  const [sortCol, setSortCol] = useState<ProducedCol>("output");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  if (buildings.length === 0) { return <></>; }

  const handleSort = (col: ProducedCol) => {
    if (col === sortCol) { setSortDir(d => d === "desc" ? "asc" : "desc"); }
    else { setSortCol(col); setSortDir(col === "type" ? "asc" : "desc"); }
  };
  const sorted = sortProduced(buildings, sortCol, sortDir);

  return (
    <div className="produces-wrap">
      <div className="produces-scroll">
        <div className="produces-row produces-row-header">
          <ColHeader label="Type"      col="type"   active={sortCol==="type"}   dir={sortDir} onClick={handleSort} />
          <ColHeader label="Count"     col="count"  active={sortCol==="count"}  dir={sortDir} align="right" onClick={handleSort} />
          <ColHeader label="Levels"    col="levels" active={sortCol==="levels"} dir={sortDir} align="right" onClick={handleSort} />
          <ColHeader label="Output/mo" col="output" active={sortCol==="output"} dir={sortDir} align="right" onClick={handleSort} />
          <ColHeader label="Profit/mo" col="profit" active={sortCol==="profit"} dir={sortDir} align="right" onClick={handleSort} />
        </div>
        {sorted.map(b => (
          <div key={b.type} className="produces-row">
            <span>{fmtGood(b.type)}</span>
            <span className="produces-col-num">{b.count}</span>
            <span className="produces-col-num">{b.totalLevel}</span>
            <span className="produces-col-num">{b.totalOutput > 0 ? b.totalOutput.toFixed(1) : "—"}</span>
            <span className="produces-col-num">{b.totalProfit > 0 ? fmtCurrency(b.totalProfit) : "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const OtherBuildingsSection = ({
  buildings,
}: {
  buildings: readonly BuildingSummary[];
}) => {
  const [sortCol, setSortCol] = useState<OtherCol>("count");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  if (buildings.length === 0) { return <></>; }

  const handleSort = (col: OtherCol) => {
    if (col === sortCol) { setSortDir(d => d === "desc" ? "asc" : "desc"); }
    else { setSortCol(col); setSortDir(col === "type" ? "asc" : "desc"); }
  };
  const sorted = sortOther(buildings, sortCol, sortDir);

  return (
    <div className="produces-wrap">
      <div className="produces-scroll">
        <div className="produces-row produces-row-header">
          <ColHeader label="Type"       col="type"   active={sortCol==="type"}   dir={sortDir} onClick={handleSort} />
          <ColHeader label="Count"      col="count"  active={sortCol==="count"}  dir={sortDir} align="right" onClick={handleSort} />
          <ColHeader label="Levels"     col="levels" active={sortCol==="levels"} dir={sortDir} align="right" onClick={handleSort} />
          <ColHeader label="Upkeep/mo"  col="upkeep" active={sortCol==="upkeep"} dir={sortDir} align="right" onClick={handleSort} />
          <ColHeader label="Profit/mo"  col="profit" active={sortCol==="profit"} dir={sortDir} align="right" onClick={handleSort} />
        </div>
        {sorted.map(b => (
          <div key={b.type} className="produces-row">
            <span>{fmtGood(b.type)}</span>
            <span className="produces-col-num">{b.count}</span>
            <span className="produces-col-num">{b.totalLevel}</span>
            <span className="produces-col-num">{b.totalUpkeep > 0 ? fmtCurrency(b.totalUpkeep) : "—"}</span>
            <span className="produces-col-num">{b.totalProfit > 0 ? fmtCurrency(b.totalProfit) : "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
