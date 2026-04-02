import type { DetailSortMode } from "../../lib/trade-helpers";

interface Props {
  col: DetailSortMode;
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onSort: (col: DetailSortMode) => void;
}

export const SortHeader = ({ col, label, active, dir, onSort }: Props) => (
  <span
    className={`trade-sort-header${active ? " trade-sort-active" : ""}`}
    onClick={() => onSort(col)}
  >
    {label}{active ? (dir === "desc" ? " ▾" : " ▴") : ""}
  </span>
);
