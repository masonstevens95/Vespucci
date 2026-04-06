import type { CountryInfo } from "../../../lib/country-info";

export const SOCIETAL_AXES: readonly {
  key: keyof CountryInfo["stats"]["societalValues"];
  left: string;
  right: string;
}[] = [
  { key: "centralization", left: "Centralized", right: "Decentralized" },
  { key: "innovative", left: "Traditionalist", right: "Innovative" },
  { key: "humanist", left: "Humanist", right: "Spiritualist" },
  { key: "plutocracy", left: "Plutocratic", right: "Aristocratic" },
  { key: "freeSubjects", left: "Free Subjects", right: "Serfdom" },
  { key: "freeTrade", left: "Free Trade", right: "Mercantile" },
  { key: "conciliatory", left: "Belligerent", right: "Conciliatory" },
  { key: "quantity", left: "Quantity", right: "Quality" },
  { key: "defensive", left: "Offensive", right: "Defensive" },
  { key: "naval", left: "Naval", right: "Land" },
  {
    key: "traditionalEconomy",
    left: "Capital Econ.",
    right: "Traditional Econ.",
  },
  { key: "communalism", left: "Communalist", right: "Individualist" },
  { key: "inward", left: "Inward", right: "Outward" },
  { key: "liberalism", left: "Absolutist", right: "Liberal" },
  { key: "jurisprudence", left: "Mysticism", right: "Jurisprudence" },
  { key: "unsinicized", left: "Sinicized", right: "Unsinicized" },
];

export const SocietalValuesSection = ({
  sv,
}: {
  sv: CountryInfo["stats"]["societalValues"];
}) => {
  // Filter disabled axes: 0 = not set, > 100 = disabled (e.g., 999 from raw 99900)
  const isActive = (v: number): boolean => v > 0 && v <= 100;
  const hasAny = Object.values(sv).some(isActive);
  if (!hasAny) {
    return <></>;
  }
  return (
    <>
      <div className="modal-row-divider" />
      <div className="modal-section-label">Societal Values</div>
      {SOCIETAL_AXES.map((axis) => {
        const val = sv[axis.key];
        if (!isActive(val)) {
          return null;
        }
        // 0-100 internal → -100 to +100 display (50 = center/0)
        const display = Math.round((val - 50) * 2);
        const sign = display > 0 ? "+" : "";
        return (
          <div key={axis.key} className="sv-axis">
            <span className="sv-label sv-left">{axis.left}</span>
            <div className="sv-bar-track">
              <div className="sv-bar-center" />
              <div className="sv-bar-fill" style={{ width: `${val}%` }} />
              <div className="sv-bar-marker" style={{ left: `${val}%` }}>
                <span className="sv-bar-value">
                  {sign}
                  {display}
                </span>
              </div>
            </div>
            <span className="sv-label sv-right">{axis.right}</span>
          </div>
        );
      })}
    </>
  );
};
