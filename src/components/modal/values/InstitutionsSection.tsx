import { fmtTitle } from "../ModalRow";

export const InstitutionsSection = ({ institutions }: { institutions: readonly string[] }) => {
  if (institutions.length === 0) {
    return <></>;
  }
  return (
    <>
      <div className="modal-section-label">Institutions ({institutions.length})</div>
      <div className="modal-institution-list">
        {institutions.map((name) => (
          <span key={name} className="modal-institution-tag">{fmtTitle(name)}</span>
        ))}
      </div>
    </>
  );
};
