import { resolveDisplayName } from "../../../lib/country-info";
import type { RoyalMarriageData } from "../../../lib/types";

export const RoyalMarriagesSection = ({
  tag,
  royalMarriages,
  countryNames,
}: {
  tag: string;
  royalMarriages: readonly RoyalMarriageData[];
  countryNames: Readonly<Record<string, string>>;
}) => {
  const myMarriages = royalMarriages.filter(
    (rm) => rm.countryATag === tag || rm.countryBTag === tag
  );
  if (myMarriages.length === 0) {
    return <></>;
  }
  return (
    <>
      <div className="modal-row-divider" />
      <div className="modal-section-label">Royal Marriages ({myMarriages.length})</div>
      {myMarriages.map((rm, i) => {
        const otherTag = rm.countryATag === tag ? rm.countryBTag : rm.countryATag;
        return (
          <div key={`rm${i}`} className="modal-row">
            <span className="modal-row-label">{resolveDisplayName(otherTag, countryNames)}</span>
            <span className="modal-row-value modal-muted">{otherTag}</span>
          </div>
        );
      })}
    </>
  );
};
