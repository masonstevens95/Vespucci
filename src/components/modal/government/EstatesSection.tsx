import { fmtTitle } from "../ModalRow";
import type { EstateData } from "../../../lib/types";

/** Map raw estate_type strings to display names. */
export const fmtEstateType = (type: string): string => {
  const known: Record<string, string> = {
    estate_nobles: "Nobility",
    estate_clergy: "Clergy",
    estate_burghers: "Burghers",
    estate_peasants: "Commoners",
    estate_dhimmi: "Dhimmi",
    estate_tribes: "Tribes",
    estate_cossacks: "Cossacks",
    estate_crown: "Crown",
  };
  return known[type] ?? fmtTitle(type.replace(/^estate_/, ""));
};

export const EstatesSection = ({ estates }: { estates: readonly EstateData[] }) => {
  const active = estates.filter((e) => e.type !== "");
  if (active.length === 0) {
    return <></>;
  }
  return (
    <>
      <div className="modal-row-divider" />
      <div className="modal-section-label">Estates</div>
      <div className="estates-table">
        <div className="estates-header">
          <span>Estate</span>
          <span>Power</span>
          <span>Satisfaction</span>
          <span>Privileges</span>
        </div>
        {active.map((e) => (
          <div key={e.type} className="estates-row">
            <span>{fmtEstateType(e.type)}</span>
            <span>{e.power > 0 ? `${(e.power / 100).toFixed(1)}%` : "—"}</span>
            <span>
              {e.satisfaction > 0
                ? `${(e.satisfaction / 100).toFixed(1)}%`
                : "—"}
            </span>
            <span>
              {e.maxPrivileges > 0
                ? `${e.numPrivileges}/${e.maxPrivileges}`
                : e.numPrivileges > 0
                ? `${e.numPrivileges}`
                : "—"}
            </span>
          </div>
        ))}
      </div>
    </>
  );
};
