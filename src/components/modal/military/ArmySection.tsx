import { Row, NumRow } from "../ModalRow";
import type { CountryInfo } from "../../../lib/country-info";

export const ArmySection = ({ stats }: { stats: CountryInfo["stats"] }) => {
  const regStr = stats.infantryStr + stats.cavalryStr + stats.artilleryStr;
  const levyStr = stats.levyInfantryStr + stats.levyCavalryStr;
  return (
    <>
      <NumRow label="Regular Strength" value={regStr} />
      <Row
        label="Infantry / Cavalry / Artillery"
        value={`${stats.infantry} / ${stats.cavalry} / ${stats.artillery}`}
      />
      <NumRow label="Army Frontage" value={stats.armyFrontage} />
      {levyStr > 0 ? <NumRow label="Raised Levies" value={levyStr} /> : <></>}
      <div className="modal-row-divider" />
      <NumRow label="Manpower" value={stats.maxManpower} />
      {stats.monthlyManpower > 0 ? (
        <NumRow
          label="Monthly Manpower"
          value={stats.monthlyManpower}
          decimals={0}
        />
      ) : (
        <></>
      )}
      <NumRow label="Expected Army Size" value={stats.expectedArmySize} />
      {stats.armyMaintenance > 0 ? (
        <NumRow
          label="Army Maintenance"
          value={stats.armyMaintenance}
          decimals={1}
        />
      ) : (
        <></>
      )}
      {stats.armyTradition > 0 ? (
        <NumRow
          label="Army Tradition"
          value={stats.armyTradition}
          decimals={1}
        />
      ) : (
        <></>
      )}
    </>
  );
};
