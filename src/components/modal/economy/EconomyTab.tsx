import { useState } from "react";
import { Row } from "../ModalRow";
import { fmtCurrency } from "../../../lib/format";
import type { CountryInfo } from "../../../lib/country-info";
import { GoldFlowSection } from "./GoldFlowSection";
import { ProducesSection } from "./ProducesSection";
import { ProducedBuildingsSection, OtherBuildingsSection } from "./BuildingsSection";

type EconSubTab = "rgo" | "produced" | "other";

export const EconomyTab = ({
  stats,
  production,
  goodsRankings,
  goodAvgPrices,
  buildings,
}: {
  stats: CountryInfo["stats"];
  production: CountryInfo["production"];
  goodsRankings: CountryInfo["goodsRankings"];
  goodAvgPrices: CountryInfo["goodAvgPrices"];
  buildings: CountryInfo["buildings"];
}) => {
  const [subTab, setSubTab] = useState<EconSubTab>("rgo");

  const producedBuildings = buildings.filter(b => b.totalOutput > 0);
  const otherBuildings    = buildings.filter(b => b.totalOutput === 0);

  const rgoCount      = Object.keys(production).length;
  const producedCount = producedBuildings.length;
  const otherCount    = otherBuildings.length;

  const tabBtn = (t: EconSubTab, label: string, count: number) => (
    <button
      className={`subtab-btn${subTab === t ? " subtab-active" : ""}`}
      onClick={() => setSubTab(t)}
    >
      {label} ({count})
    </button>
  );

  return (
    <div className="modal-rows">
      <Row label="Treasury" value={fmtCurrency(stats.gold)} />
      <Row label="Monthly Income (est.)" value={fmtCurrency(stats.monthlyIncome)} />
      <Row label="Trade Value" value={fmtCurrency(stats.monthlyTradeValue)} />
      <GoldFlowSection stats={stats} />
      <div className="modal-row-divider" />

      <div className="subtab-bar">
        {tabBtn("rgo",      "RGO",            rgoCount)}
        {tabBtn("produced", "Produced Goods",  producedCount)}
        {tabBtn("other",    "Other",           otherCount)}
      </div>

      {subTab === "rgo" ? (
        <ProducesSection
          production={production}
          goodsRankings={goodsRankings}
          goodAvgPrices={goodAvgPrices}
        />
      ) : subTab === "produced" ? (
        <ProducedBuildingsSection buildings={producedBuildings} />
      ) : (
        <OtherBuildingsSection buildings={otherBuildings} />
      )}
    </div>
  );
};
