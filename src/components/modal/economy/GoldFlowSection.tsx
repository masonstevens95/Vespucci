import { NumRow } from "../ModalRow";
import type { CountryInfo } from "../../../lib/country-info";

export const GoldFlowSection = ({ stats }: { stats: CountryInfo["stats"] }) => (
  <>
    {stats.monthlyGoldIncome > 0 ? (
      <NumRow label="Monthly Gold Income" value={stats.monthlyGoldIncome} decimals={1} />
    ) : (
      <></>
    )}
    {stats.monthlyGoldExpense > 0 ? (
      <NumRow label="Monthly Gold Expense" value={stats.monthlyGoldExpense} decimals={1} />
    ) : (
      <></>
    )}
    {stats.inflation !== 0 ? (
      <>
        <div className="modal-row-divider" />
        <NumRow label="Inflation" value={stats.inflation} decimals={2} />
      </>
    ) : (
      <></>
    )}
  </>
);
