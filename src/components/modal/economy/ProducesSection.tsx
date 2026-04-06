import { Row } from "../ModalRow";
import { topGoodsForCountry } from "../../../lib/rgo-helpers";
import { fmtGood } from "../../../lib/trade-helpers";
import type { RgoProductionEntry } from "../../../lib/types";

/** Format a single good + location count entry, e.g. "Grain (3 locs)". */
const fmtProdEntry = (good: string, count: number): string =>
  `${fmtGood(good)} (${count} loc${count !== 1 ? "s" : ""})`;

export const ProducesSection = ({
  production,
}: {
  production: Readonly<Record<string, RgoProductionEntry>>;
}) => {
  const top = topGoodsForCountry(production, 3);

  if (top.length === 0) {
    return <></>;
  } else {
    const text = top
      .map(({ good, entry }) => fmtProdEntry(good, entry.locationCount))
      .join(", ");
    return (
      <>
        <div className="modal-row-divider" />
        <Row label="Produces" value={text} />
      </>
    );
  }
};
