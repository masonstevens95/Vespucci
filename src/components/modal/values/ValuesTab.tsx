import type { CountryInfo } from "../../../lib/country-info";
import { InstitutionsSection } from "./InstitutionsSection";
import { SocietalValuesSection } from "./SocietalValuesSection";

export const ValuesTab = ({ stats }: { stats: CountryInfo["stats"] }) => (
  <div className="modal-rows">
    <InstitutionsSection institutions={stats.institutions} />
    <SocietalValuesSection sv={stats.societalValues} />
  </div>
);
