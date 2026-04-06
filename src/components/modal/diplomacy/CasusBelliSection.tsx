import { resolveDisplayName } from "../../../lib/country-info";
import type { ActiveCBData } from "../../../lib/types";

export const CasusBelliSection = ({
  tag,
  activeCBs,
  countryNames,
}: {
  tag: string;
  activeCBs: readonly ActiveCBData[];
  countryNames: Readonly<Record<string, string>>;
}) => {
  const held = activeCBs.filter((cb) => cb.holderTag === tag);
  const against = activeCBs.filter((cb) => cb.targetTag === tag);
  if (held.length === 0 && against.length === 0) {
    return <></>;
  }
  return (
    <>
      {held.length > 0 ? (
        <>
          <div className="modal-row-divider" />
          <div className="modal-section-label">Casus Belli Held ({held.length})</div>
          {held.map((cb, i) => (
            <div key={`cbh${i}`} className="modal-row">
              <span className="modal-row-label">vs {resolveDisplayName(cb.targetTag, countryNames)}</span>
              <span className="modal-row-value modal-muted">{cb.targetTag}</span>
            </div>
          ))}
        </>
      ) : (
        <></>
      )}
      {against.length > 0 ? (
        <>
          <div className="modal-row-divider" />
          <div className="modal-section-label">Casus Belli Against ({against.length})</div>
          {against.map((cb, i) => (
            <div key={`cba${i}`} className="modal-row">
              <span className="modal-row-label">by {resolveDisplayName(cb.holderTag, countryNames)}</span>
              <span className="modal-row-value modal-muted">{cb.holderTag}</span>
            </div>
          ))}
        </>
      ) : (
        <></>
      )}
    </>
  );
};
