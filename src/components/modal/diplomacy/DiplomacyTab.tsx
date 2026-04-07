import { Row, NumRow } from "../ModalRow";
import type { CountryInfo } from "../../../lib/country-info";
import type { RoyalMarriageData, ActiveCBData } from "../../../lib/types";
import { RoyalMarriagesSection } from "./RoyalMarriagesSection";
import { CasusBelliSection } from "./CasusBelliSection";

export const DiplomacyTab = ({
  info,
  stats,
  countryNames,
  royalMarriages,
  activeCBs,
}: {
  info: CountryInfo;
  stats: CountryInfo["stats"];
  countryNames: Readonly<Record<string, string>>;
  royalMarriages: readonly RoyalMarriageData[];
  activeCBs: readonly ActiveCBData[];
}) => {
  const tag = info.tag;

  return (
    <div className="modal-rows">
      {stats.greatPowerScore > 0 ? (
        <NumRow
          label="Great Power Score"
          value={stats.greatPowerScore}
          decimals={0}
        />
      ) : (
        <></>
      )}
      {stats.diplomaticReputation !== 0 ? (
        <NumRow
          label="Diplomatic Reputation"
          value={stats.diplomaticReputation}
          decimals={1}
        />
      ) : (
        <></>
      )}
      {stats.powerProjection > 0 ? (
        <NumRow
          label="Power Projection"
          value={stats.powerProjection}
          decimals={1}
        />
      ) : (
        <></>
      )}
      <NumRow label="Allies" value={stats.numAllies} decimals={0} />
      {info.overlord !== "" ? (
        <NumRow
          label="Liberty Desire"
          value={stats.libertyDesire}
          decimals={1}
        />
      ) : (
        <></>
      )}
      {info.subjects.length > 0 ? (
        <Row label="Subjects" value={String(info.subjects.length)} />
      ) : (
        <></>
      )}
      <RoyalMarriagesSection
        tag={tag}
        royalMarriages={royalMarriages}
        countryNames={countryNames}
      />
      <CasusBelliSection
        tag={tag}
        activeCBs={activeCBs}
        countryNames={countryNames}
      />
    </div>
  );
};
