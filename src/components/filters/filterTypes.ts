import type { DateRangeSelection } from "../DateRangeFilter";

// ─── Sort ────────────────────────────────────────────────────────────────────

export const SORT_OPTIONS = [
  "Newest First",
  "Oldest First",
  "Amount: High to Low",
  "Amount: Low to High",
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number];

// ─── Status ──────────────────────────────────────────────────────────────────

export const STATUS_OPTIONS = ["All", "Active", "Inactive"] as const;
export type StatusOption = (typeof STATUS_OPTIONS)[number];

// ─── Filter State ─────────────────────────────────────────────────────────────

export type FilterState = {
  dateRange: DateRangeSelection;
  category: string;   // "" means All Categories
  status: StatusOption;
  amountMin: string;  // raw string from input
  amountMax: string;
  sort: SortOption;
};

export const DEFAULT_FILTER_STATE: FilterState = {
  dateRange: { filter: "All", startDate: null, endDate: null },
  category: "",
  status: "All",
  amountMin: "",
  amountMax: "",
  sort: "Newest First",
};

/** Returns the number of non-default active filters (for the badge). */
export function countActiveFilters(filters: FilterState): number {
  let count = 0;
  if (filters.dateRange.filter !== "All") count++;
  if (filters.category !== "") count++;
  if (filters.status !== "All") count++;
  if (filters.amountMin !== "" || filters.amountMax !== "") count++;
  if (filters.sort !== "Newest First") count++;
  return count;
}
