import { useState } from "react";
import type { CountryInfo } from "../lib/country-info";
import { resolveDisplayName } from "../lib/country-info";
import { fmtNum, fmtCurrency, fmtLanguage, fmtGovType } from "../lib/format";
import { isGreatPower } from "../lib/ranking-sort";

interface Props {
  info: CountryInfo;
  countryNames: Readonly<Record<string, string>>;
  onClose: () => void;
}

type ModalTab = "overview" | "economy" | "government" | "military" | "diplomacy";

/** Format a raw string token as title-case display text. */
const fmtTitle = (s: string): string =>
  s !== "" ? s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "—";

/** A single label: value row. */
const Row = ({ label, value, muted }: { label: string; value: string; muted?: boolean }) => (
  <div className="modal-row">
    <span className="modal-row-label">{label}</span>
    <span className={`modal-row-value${muted ? " modal-muted" : ""}`}>{value || "—"}</span>
  </div>
);

/** A numeric row with compact formatting. */
const NumRow = ({ label, value, decimals }: { label: string; value: number; decimals?: number }) => (
  <Row label={label} value={decimals !== undefined ? value.toFixed(decimals) : fmtNum(value)} />
);

export const CountryModal = ({ info, countryNames, onClose }: Props) => {
  const { stats } = info;
  const [tab, setTab] = useState<ModalTab>("overview");
  const [subjectsOpen, setSubjectsOpen] = useState(false);

  const tabBtn = (t: ModalTab, label: string) => (
    <button
      className={`subtab-btn${tab === t ? " subtab-active" : ""}`}
      onClick={() => setTab(t)}
    >{label}</button>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ borderColor: info.color }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>x</button>

        <div className="modal-header" style={{ borderBottomColor: info.color }}>
          <span className="modal-swatch" style={{ backgroundColor: info.color }} />
          <div className="modal-titles">
            <h2 className="modal-name">{info.displayName}</h2>
            <span className="modal-tag">{info.tag}</span>
          </div>
        </div>

        <div className="modal-body">
          <div className="subtab-bar">
            {tabBtn("overview", "Overview")}
            {tabBtn("government", "Government")}
            {tabBtn("economy", "Economy")}
            {tabBtn("military", "Military")}
            {tabBtn("diplomacy", "Diplomacy")}
          </div>

          <div className="modal-tab-content">
            {tab === "overview" ? (
              <OverviewTab info={info} stats={stats} countryNames={countryNames} subjectsOpen={subjectsOpen} setSubjectsOpen={setSubjectsOpen} />
            ) : tab === "economy" ? (
              <EconomyTab stats={stats} />
            ) : tab === "government" ? (
              <GovernmentTab stats={stats} />
            ) : tab === "military" ? (
              <MilitaryTab stats={stats} />
            ) : (
              <DiplomacyTab info={info} stats={stats} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Tab components ─────────────────────────────────────────────────────

const OverviewTab = ({ info, stats, countryNames, subjectsOpen, setSubjectsOpen }: {
  info: CountryInfo;
  stats: CountryInfo["stats"];
  countryNames: Readonly<Record<string, string>>;
  subjectsOpen: boolean;
  setSubjectsOpen: (v: boolean) => void;
}) => (
  <div className="modal-rows">
    <Row label="Player" value={info.players.length > 0 ? info.players.join(", ") : "AI"} muted={info.players.length === 0} />
    {stats.govType !== "" ? <Row label="Government" value={fmtGovType(stats.govType)} /> : <></>}
    {stats.courtLanguage !== "" ? <Row label="Language" value={fmtLanguage(stats.courtLanguage)} /> : <></>}
    {stats.primaryCulture !== "" ? <Row label="Culture" value={fmtTitle(stats.primaryCulture)} /> : <></>}
    {stats.religion !== "" ? <Row label="Religion" value={fmtTitle(stats.religion)} /> : <></>}
    {stats.score > 0 ? (
      <Row label="Rank" value={`#${stats.score}${isGreatPower(stats.score) ? " (Great Power)" : ""}`} />
    ) : <></>}
    <NumRow label="Provinces" value={info.provinceCount} />
    {stats.numProvinces > 0 ? <NumRow label="Provinces (parsed)" value={stats.numProvinces} /> : <></>}
    {stats.totalDevelopment > 0 ? <NumRow label="Total Development" value={stats.totalDevelopment} decimals={0} /> : <></>}
    <NumRow label="Population" value={stats.population} />

    {info.overlord !== "" ? (
      <Row label="Overlord" value={`${resolveDisplayName(info.overlord, countryNames)} (${info.overlord})`} />
    ) : <></>}

    {info.subjects.length > 0 ? (
      <div className="modal-row">
        <span
          className="modal-row-label modal-collapsible"
          onClick={() => setSubjectsOpen(!subjectsOpen)}
        >
          {subjectsOpen ? "▾" : "▸"} Subjects ({info.subjects.length})
        </span>
        {subjectsOpen ? (
          <div className="modal-subject-list">
            {info.subjects.map((sub) => (
              <span key={sub} className="modal-subject-tag">
                {resolveDisplayName(sub, countryNames)} ({sub})
              </span>
            ))}
          </div>
        ) : <></>}
      </div>
    ) : <></>}
  </div>
);

const EconomyTab = ({ stats }: { stats: CountryInfo["stats"] }) => (
  <div className="modal-rows">
    <Row label="Treasury" value={fmtCurrency(stats.gold)} />
    <Row label="Monthly Income (est.)" value={fmtCurrency(stats.monthlyIncome)} />
    <Row label="Trade Value" value={fmtCurrency(stats.monthlyTradeValue)} />
    {stats.monthlyGoldIncome > 0 ? <NumRow label="Monthly Gold Income" value={stats.monthlyGoldIncome} decimals={1} /> : <></>}
    {stats.monthlyGoldExpense > 0 ? <NumRow label="Monthly Gold Expense" value={stats.monthlyGoldExpense} decimals={1} /> : <></>}
    {stats.inflation !== 0 ? (
      <>
        <div className="modal-row-divider" />
        <NumRow label="Inflation" value={stats.inflation} decimals={2} />
      </>
    ) : <></>}
  </div>
);

const GovernmentTab = ({ stats }: { stats: CountryInfo["stats"] }) => (
  <div className="modal-rows">
    {stats.govType !== "" ? <Row label="Government Type" value={fmtGovType(stats.govType)} /> : <></>}
    <div className="modal-row-divider" />
    <NumRow label="Stability" value={stats.stability} decimals={0} />
    {stats.stabilityInvestment > 0 ? <NumRow label="Stability Investment" value={stats.stabilityInvestment} decimals={1} /> : <></>}
    <div className="modal-row-divider" />
    <NumRow label="Legitimacy" value={stats.legitimacy} decimals={1} />
    <div className="modal-row-divider" />
    <NumRow label="Prestige" value={stats.prestige} decimals={1} />
    {stats.monthlyPrestige !== 0 ? <NumRow label="Monthly Prestige" value={stats.monthlyPrestige} decimals={2} /> : <></>}
    {stats.prestigeDecay !== 0 ? <NumRow label="Prestige Decay" value={stats.prestigeDecay} decimals={2} /> : <></>}
    <div className="modal-row-divider" />
    {stats.powerProjection > 0 ? <NumRow label="Power Projection" value={stats.powerProjection} decimals={1} /> : <></>}
    {stats.warExhaustion > 0 ? <NumRow label="War Exhaustion" value={stats.warExhaustion} decimals={1} /> : <></>}
  </div>
);

const MilitaryTab = ({ stats }: { stats: CountryInfo["stats"] }) => {
  const regStr = stats.infantryStr + stats.cavalryStr + stats.artilleryStr;
  const levyStr = stats.levyInfantryStr + stats.levyCavalryStr;
  const totalShips = stats.heavyShips + stats.lightShips + stats.galleys + stats.transports;

  return (
    <div className="modal-rows">
      <NumRow label="Regular Strength" value={regStr} />
      <Row label="Infantry / Cavalry / Artillery" value={`${stats.infantry} / ${stats.cavalry} / ${stats.artillery}`} />
      <NumRow label="Army Frontage" value={stats.armyFrontage} />
      {levyStr > 0 ? <NumRow label="Raised Levies" value={levyStr} /> : <></>}
      <div className="modal-row-divider" />
      <NumRow label="Manpower" value={stats.maxManpower} />
      {stats.monthlyManpower > 0 ? <NumRow label="Monthly Manpower" value={stats.monthlyManpower} decimals={0} /> : <></>}
      <NumRow label="Expected Army Size" value={stats.expectedArmySize} />
      {stats.armyMaintenance > 0 ? <NumRow label="Army Maintenance" value={stats.armyMaintenance} decimals={1} /> : <></>}
      {stats.armyTradition > 0 ? <NumRow label="Army Tradition" value={stats.armyTradition} decimals={1} /> : <></>}
      <div className="modal-row-divider" />
      {totalShips > 0 ? (
        <>
          <NumRow label="Navy Frontage" value={stats.navyFrontage} />
          <Row label="Heavy / Light / Galley" value={`${stats.heavyShips} / ${stats.lightShips} / ${stats.galleys}`} />
          <NumRow label="Transports" value={stats.transports} />
          <NumRow label="Sailors" value={stats.maxSailors} />
          {stats.monthlySailors > 0 ? <NumRow label="Monthly Sailors" value={stats.monthlySailors} decimals={0} /> : <></>}
          <NumRow label="Expected Navy Size" value={stats.expectedNavySize} />
          {stats.navyMaintenance > 0 ? <NumRow label="Navy Maintenance" value={stats.navyMaintenance} decimals={1} /> : <></>}
          {stats.navyTradition > 0 ? <NumRow label="Navy Tradition" value={stats.navyTradition} decimals={1} /> : <></>}
        </>
      ) : (
        <Row label="Navy" value="None" muted={true} />
      )}
      <div className="modal-row-divider" />
      {stats.warExhaustion > 0 ? <NumRow label="War Exhaustion" value={stats.warExhaustion} decimals={1} /> : <></>}
    </div>
  );
};

const DiplomacyTab = ({ info, stats }: { info: CountryInfo; stats: CountryInfo["stats"] }) => (
  <div className="modal-rows">
    {stats.greatPowerScore > 0 ? <NumRow label="Great Power Score" value={stats.greatPowerScore} decimals={0} /> : <></>}
    {stats.diplomaticReputation !== 0 ? <NumRow label="Diplomatic Reputation" value={stats.diplomaticReputation} decimals={1} /> : <></>}
    {stats.powerProjection > 0 ? <NumRow label="Power Projection" value={stats.powerProjection} decimals={1} /> : <></>}
    <NumRow label="Allies" value={stats.numAllies} decimals={0} />
    {info.overlord !== "" ? (
      <NumRow label="Liberty Desire" value={stats.libertyDesire} decimals={1} />
    ) : <></>}
    {info.subjects.length > 0 ? (
      <Row label="Subjects" value={String(info.subjects.length)} />
    ) : <></>}
  </div>
);
