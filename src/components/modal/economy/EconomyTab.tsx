import { Row } from "../ModalRow";
import { fmtCurrency } from "../../../lib/format";
import type { CountryInfo } from "../../../lib/country-info";
import { GoldFlowSection } from "./GoldFlowSection";
import { ProducesSection } from "./ProducesSection";

export const EconomyTab = ({
  stats,
  production,
}: {
  stats: CountryInfo["stats"];
  production: CountryInfo["production"];
}) => (
  <div className="modal-rows">
    <Row label="Treasury" value={fmtCurrency(stats.gold)} />
    <Row
      label="Monthly Income (est.)"
      value={fmtCurrency(stats.monthlyIncome)}
    />
    <Row label="Trade Value" value={fmtCurrency(stats.monthlyTradeValue)} />
    <GoldFlowSection stats={stats} />
    <ProducesSection production={production} />
  </div>
);
