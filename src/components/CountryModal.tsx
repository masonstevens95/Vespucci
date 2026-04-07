import { useState } from "react";
import type { CountryInfo } from "../lib/country-info";
import type { RoyalMarriageData, ActiveCBData } from "../lib/types";
import { OverviewTab } from "./modal/overview/OverviewTab";
import { EconomyTab } from "./modal/economy/EconomyTab";
import { ValuesTab } from "./modal/values/ValuesTab";
import { GovernmentTab } from "./modal/government/GovernmentTab";
import { MilitaryTab } from "./modal/military/MilitaryTab";
import { DiplomacyTab } from "./modal/diplomacy/DiplomacyTab";

interface Props {
  info: CountryInfo;
  countryNames: Readonly<Record<string, string>>;
  royalMarriages: readonly RoyalMarriageData[];
  activeCBs: readonly ActiveCBData[];
  onClose: () => void;
}

type ModalTab =
  | "overview"
  | "economy"
  | "government"
  | "values"
  | "military"
  | "diplomacy";

export const CountryModal = ({
  info,
  countryNames,
  royalMarriages,
  activeCBs,
  onClose,
}: Props) => {
  const { stats } = info;
  const [tab, setTab] = useState<ModalTab>("overview");
  const [subjectsOpen, setSubjectsOpen] = useState(false);

  const tabBtn = (t: ModalTab, label: string) => (
    <button
      className={`subtab-btn${tab === t ? " subtab-active" : ""}`}
      onClick={() => setTab(t)}
    >
      {label}
    </button>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ borderColor: info.color }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          x
        </button>

        <div className="modal-header" style={{ borderBottomColor: info.color }}>
          <span
            className="modal-swatch"
            style={{ backgroundColor: info.color }}
          />
          <div className="modal-titles">
            <h2 className="modal-name">{info.displayName}</h2>
            <span className="modal-tag">{info.tag}</span>
          </div>
        </div>

        <div className="modal-body">
          <div className="subtab-bar">
            {tabBtn("overview", "Overview")}
            {tabBtn("government", "Government")}
            {tabBtn("values", "Values & Institutions")}
            {tabBtn("economy", "Economy")}
            {tabBtn("military", "Military")}
            {tabBtn("diplomacy", "Diplomacy")}
          </div>

          <div className="modal-tab-content">
            {tab === "overview" ? (
              <OverviewTab
                info={info}
                stats={stats}
                countryNames={countryNames}
                subjectsOpen={subjectsOpen}
                setSubjectsOpen={setSubjectsOpen}
              />
            ) : tab === "economy" ? (
              <EconomyTab stats={stats} production={info.production} goodsRankings={info.goodsRankings} goodAvgPrices={info.goodAvgPrices} />
            ) : tab === "government" ? (
              <GovernmentTab stats={stats} />
            ) : tab === "values" ? (
              <ValuesTab stats={stats} />
            ) : tab === "military" ? (
              <MilitaryTab stats={stats} />
            ) : (
              <DiplomacyTab
                info={info}
                stats={stats}
                countryNames={countryNames}
                royalMarriages={royalMarriages}
                activeCBs={activeCBs}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
