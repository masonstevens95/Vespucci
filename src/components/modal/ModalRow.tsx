import { fmtNum } from "../../lib/format";

/** Format a raw string token as title-case display text. */
export const fmtTitle = (s: string): string =>
  s !== "" ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";

/** A single label: value row. */
export const Row = ({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) => (
  <div className="modal-row">
    <span className="modal-row-label">{label}</span>
    <span className={`modal-row-value${muted ? " modal-muted" : ""}`}>
      {value || "—"}
    </span>
  </div>
);

/** A numeric row with compact formatting. */
export const NumRow = ({
  label,
  value,
  decimals,
}: {
  label: string;
  value: number;
  decimals?: number;
}) => (
  <Row
    label={label}
    value={decimals !== undefined ? value.toFixed(decimals) : fmtNum(value)}
  />
);
