import { Row } from "../ModalRow";
import { fmtCurrency } from "../../../lib/format";
import type { CountryInfo } from "../../../lib/country-info";
import { GoldFlowSection } from "./GoldFlowSection";

export const EconomyTab = ({ stats }: { stats: CountryInfo["stats"] }) => (
  <div className="modal-rows">
    <Row label="Treasury" value={fmtCurrency(stats.gold)} />
    <Row
      label="Monthly Income (est.)"
      value={fmtCurrency(stats.monthlyIncome)}
    />
    <Row label="Trade Value" value={fmtCurrency(stats.monthlyTradeValue)} />
    <GoldFlowSection stats={stats} />
  </div>
);
