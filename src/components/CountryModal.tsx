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

type ModalTab = "overview" | "economy" | "government" | "values" | "military" | "diplomacy";

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
            {tabBtn("values", "Values & Institutions")}
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
            ) : tab === "values" ? (
              <ValuesTab stats={stats} />
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

// ─── Societal values display ────────────────────────────────────────────

const SOCIETAL_AXES: readonly { key: keyof CountryInfo["stats"]["societalValues"]; left: string; right: string }[] = [
  { key: "centralization", left: "Centralized", right: "Decentralized" },
  { key: "innovative", left: "Traditionalist", right: "Innovative" },
  { key: "humanist", left: "Humanist", right: "Spiritualist" },
  { key: "plutocracy", left: "Plutocratic", right: "Aristocratic" },
  { key: "freeSubjects", left: "Free Subjects", right: "Serfdom" },
  { key: "freeTrade", left: "Free Trade", right: "Mercantile" },
  { key: "conciliatory", left: "Belligerent", right: "Conciliatory" },
  { key: "quantity", left: "Quantity", right: "Quality" },
  { key: "defensive", left: "Offensive", right: "Defensive" },
  { key: "naval", left: "Naval", right: "Land" },
  { key: "traditionalEconomy", left: "Capital Econ.", right: "Traditional Econ." },
  { key: "communalism", left: "Communalist", right: "Individualist" },
  { key: "inward", left: "Inward", right: "Outward" },
  { key: "liberalism", left: "Absolutist", right: "Liberal" },
  { key: "jurisprudence", left: "Mysticism", right: "Jurisprudence" },
  { key: "unsinicized", left: "Sinicized", right: "Unsinicized" },
];

const SocietalValuesSection = ({ sv }: { sv: CountryInfo["stats"]["societalValues"] }) => {
  // Filter disabled axes: 0 = not set, > 100 = disabled (e.g., 999 from raw 99900)
  const isActive = (v: number): boolean => v > 0 && v <= 100;
  const hasAny = Object.values(sv).some(isActive);
  if (!hasAny) { return <></>; }
  return (
    <>
      <div className="modal-row-divider" />
      <div className="modal-section-label">Societal Values</div>
      {SOCIETAL_AXES.map(axis => {
        const val = sv[axis.key];
        if (!isActive(val)) { return null; }
        // 0-100 internal → -100 to +100 display (50 = center/0)
        const display = Math.round((val - 50) * 2);
        const sign = display > 0 ? "+" : "";
        return (
          <div key={axis.key} className="sv-axis">
            <span className="sv-label sv-left">{axis.left}</span>
            <div className="sv-bar-track">
              <div className="sv-bar-center" />
              <div className="sv-bar-fill" style={{ width: `${val}%` }} />
              <div className="sv-bar-marker" style={{ left: `${val}%` }}>
                <span className="sv-bar-value">{sign}{display}</span>
              </div>
            </div>
            <span className="sv-label sv-right">{axis.right}</span>
          </div>
        );
      })}
    </>
  );
};

const ValuesTab = ({ stats }: { stats: CountryInfo["stats"] }) => (
  <div className="modal-rows">
    {stats.institutions.length > 0 ? (
      <>
        <div className="modal-section-label">Institutions ({stats.institutions.length})</div>
        <div className="modal-institution-list">
          {stats.institutions.map(name => (
            <span key={name} className="modal-institution-tag">{fmtTitle(name)}</span>
          ))}
        </div>
      </>
    ) : <></>}
    <SocietalValuesSection sv={stats.societalValues} />
  </div>
);

const GovernmentTab = ({ stats }: { stats: CountryInfo["stats"] }) => {
  // Show the government-type-specific legitimacy variant
  const legitLabel =
    stats.republicanTradition > 0 ? "Republican Tradition"
    : stats.hordeUnity > 0 ? "Horde Unity"
    : stats.devotion > 0 ? "Devotion"
    : stats.tribalCohesion > 0 ? "Tribal Cohesion"
    : "Legitimacy";
  const legitValue =
    stats.republicanTradition > 0 ? stats.republicanTradition
    : stats.hordeUnity > 0 ? stats.hordeUnity
    : stats.devotion > 0 ? stats.devotion
    : stats.tribalCohesion > 0 ? stats.tribalCohesion
    : stats.legitimacy;

  return (
    <div className="modal-rows">
      {stats.govType !== "" ? <Row label="Government Type" value={fmtGovType(stats.govType)} /> : <></>}
      {stats.governmentPower > 0 ? <NumRow label="Government Power" value={stats.governmentPower / 100} decimals={0} /> : <></>}
      {stats.diplomaticCapacity > 0 ? <NumRow label="Diplomatic Capacity" value={stats.diplomaticCapacity / 100} decimals={0} /> : <></>}
      {stats.karma > 0 ? <NumRow label="Karma" value={stats.karma / 100} decimals={1} /> : <></>}
      {stats.religiousInfluence > 0 ? <NumRow label="Religious Influence" value={stats.religiousInfluence / 100} decimals={1} /> : <></>}
      {stats.purity > 0 ? <NumRow label="Purity" value={stats.purity / 100} decimals={1} /> : <></>}
      {stats.righteousness > 0 ? <NumRow label="Righteousness" value={stats.righteousness / 100} decimals={1} /> : <></>}
      <div className="modal-row-divider" />
      <NumRow label="Stability" value={stats.stability / 100} decimals={1} />
      {stats.stabilityInvestment > 0 ? <NumRow label="Stability Investment" value={stats.stabilityInvestment / 100} decimals={1} /> : <></>}
      <div className="modal-row-divider" />
      <NumRow label={legitLabel} value={legitValue / 100} decimals={1} />
      <div className="modal-row-divider" />
      <NumRow label="Prestige" value={stats.prestige / 100} decimals={1} />
      {stats.monthlyPrestige !== 0 ? <NumRow label="Monthly Prestige" value={stats.monthlyPrestige / 100} decimals={2} /> : <></>}
      {stats.prestigeDecay !== 0 ? <NumRow label="Prestige Decay" value={stats.prestigeDecay / 100} decimals={2} /> : <></>}
      <div className="modal-row-divider" />
      {stats.powerProjection > 0 ? <NumRow label="Power Projection" value={stats.powerProjection / 100} decimals={1} /> : <></>}
      {stats.warExhaustion > 0 ? <NumRow label="War Exhaustion" value={stats.warExhaustion / 100} decimals={1} /> : <></>}
    </div>
  );
};

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
      {stats.militaryTactics > 0 ? <NumRow label="Military Tactics" value={stats.militaryTactics} decimals={1} /> : <></>}
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
