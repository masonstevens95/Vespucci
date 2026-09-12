import { fmtNum } from "../../lib/format";

/** Format a raw string token as title-case display text. */
export const fmtTitle = (s: string): string =>
  s !== "" ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";

/** A single label: value row. */
export const Row = ({
  label,
  value,
  muted,
  hint,
}: {
  label: string;
  value: string;
  muted?: boolean;
  /** Tooltip clarifying what the row counts, when the label alone is ambiguous. */
  hint?: string;
}) => (
  <div className="modal-row">
    <span className="modal-row-label" title={hint}>{label}</span>
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
  hint,
}: {
  label: string;
  value: number;
  decimals?: number;
  hint?: string;
}) => (
  <Row
    label={label}
    hint={hint}
    value={decimals !== undefined ? value.toFixed(decimals) : fmtNum(value)}
  />
);
