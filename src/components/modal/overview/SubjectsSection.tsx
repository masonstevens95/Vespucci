import { resolveDisplayName } from "../../../lib/country-info";

export const SubjectsSection = ({
  subjects,
  open,
  onToggle,
  countryNames,
}: {
  subjects: readonly string[];
  open: boolean;
  onToggle: () => void;
  countryNames: Readonly<Record<string, string>>;
}) => {
  if (subjects.length === 0) {
    return <></>;
  }
  return (
    <div className="modal-row">
      <span className="modal-row-label modal-collapsible" onClick={onToggle}>
        {open ? "▾" : "▸"} Subjects ({subjects.length})
      </span>
      {open ? (
        <div className="modal-subject-list">
          {subjects.map((sub) => (
            <span key={sub} className="modal-subject-tag">
              {resolveDisplayName(sub, countryNames)} ({sub})
            </span>
          ))}
        </div>
      ) : (
        <></>
      )}
    </div>
  );
};
