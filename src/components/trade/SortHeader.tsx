import type { DetailSortMode } from "../../lib/trade-helpers";

interface Props {
  col: DetailSortMode;
  label: string;
  active: boolean;
  onSort: (col: DetailSortMode) => void;
}

export const SortHeader = ({ col, label, active, onSort }: Props) => (
  <span
    className={`trade-sort-header${active ? " trade-sort-active" : ""}`}
    onClick={() => onSort(col)}
  >
    {label}{active ? " ▾" : ""}
  </span>
);
