import { useState } from "react";
import {
  countActiveFilters,
  DEFAULT_FILTER_STATE,
  type FilterState,
} from "./filterTypes";

/**
 * useFilterState — manages committed filter state for a listing page.
 *
 * Usage:
 *   const {
 *     filters,            // committed filters to pass to API / client filtering
 *     sheetVisible,       // whether the bottom sheet is open
 *     activeFilterCount,  // badge count for FilterButton
 *     openSheet,          // call to open the sheet
 *     closeSheet,
 *     applyFilters,       // called by FilterBottomSheet onApply
 *     resetFilters,
 *   } = useFilterState();
 */
export function useFilterState(initial: FilterState = DEFAULT_FILTER_STATE) {
  const [filters, setFilters] = useState<FilterState>(initial);
  const [sheetVisible, setSheetVisible] = useState(false);

  const activeFilterCount = countActiveFilters(filters);

  const openSheet = () => setSheetVisible(true);
  const closeSheet = () => setSheetVisible(false);

  const applyFilters = (next: FilterState) => {
    setFilters(next);
    setSheetVisible(false);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTER_STATE);
  };

  return {
    filters,
    sheetVisible,
    activeFilterCount,
    openSheet,
    closeSheet,
    applyFilters,
    resetFilters,
  };
}
