import type { CountryInfo } from "../../../lib/country-info";
import { ArmySection } from "./ArmySection";
import { NavySection } from "./NavySection";

export const MilitaryTab = ({ stats }: { stats: CountryInfo["stats"] }) => (
  <div className="modal-rows">
    <ArmySection stats={stats} />
    <NavySection stats={stats} />
  </div>
);
