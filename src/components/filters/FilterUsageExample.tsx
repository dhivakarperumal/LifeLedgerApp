/**
 * EXAMPLE: How to use the filter system on any listing page
 * ─────────────────────────────────────────────────────────
 * Copy this pattern to Expense, Income, Transfer, Memories, Diary, Reports, etc.
 * Only the `categories` array and the filtering logic changes per page.
 */
import { useState } from "react";
import { FlatList, Text, View } from "react-native";
import { FilterBottomSheet, useFilterState } from ".";
import { isDateInRange } from "../DateRangeFilter";
import { SearchBar } from "../SearchBar";

// ─── Example data type ───────────────────────────────────────────────────────
type Expense = {
  id: number;
  title: string;
  category: string;
  amount: number;
  date: string; // "YYYY-MM-DD"
  status: "Active" | "Inactive";
};

const SAMPLE_EXPENSES: Expense[] = [
  {
    id: 1,
    title: "Groceries",
    category: "Food",
    amount: 1200,
    date: "2026-09-28",
    status: "Active",
  },
  {
    id: 2,
    title: "Electricity",
    category: "Utilities",
    amount: 3500,
    date: "2026-09-15",
    status: "Active",
  },
  {
    id: 3,
    title: "Netflix",
    category: "Entertainment",
    amount: 649,
    date: "2026-08-01",
    status: "Inactive",
  },
  {
    id: 4,
    title: "Gym",
    category: "Health",
    amount: 1999,
    date: "2026-09-30",
    status: "Active",
  },
];

const EXPENSE_CATEGORIES = [
  "Food",
  "Utilities",
  "Entertainment",
  "Health",
  "Transport",
  "Shopping",
];

// ─── Page component ──────────────────────────────────────────────────────────
export default function ExpenseListExample() {
  const [search, setSearch] = useState("");

  const {
    filters,
    sheetVisible,
    activeFilterCount,
    openSheet,
    closeSheet,
    applyFilters,
  } = useFilterState();

  // Client-side filtering (replace with API params for server-side)
  const filtered = SAMPLE_EXPENSES.filter((expense) => {
    // Search
    if (search && !expense.title.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    // Date range
    if (!isDateInRange(expense.date, filters.dateRange)) return false;
    // Category
    if (filters.category && expense.category !== filters.category) return false;
    // Status
    if (filters.status !== "All" && expense.status !== filters.status)
      return false;
    // Amount range
    if (filters.amountMin && expense.amount < Number(filters.amountMin))
      return false;
    if (filters.amountMax && expense.amount > Number(filters.amountMax))
      return false;
    return true;
  }).sort((a, b) => {
    switch (filters.sort) {
      case "Oldest First":
        return a.date.localeCompare(b.date);
      case "Amount: High to Low":
        return b.amount - a.amount;
      case "Amount: Low to High":
        return a.amount - b.amount;
      default:
        return b.date.localeCompare(a.date); // Newest First
    }
  });

  return (
    <View style={{ flex: 1, backgroundColor: "#F9FAFC" }}>
      {/* ── Search + Filter bar ── */}
      <View style={{ padding: 16 }}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          onFilterPress={openSheet}
          activeFilterCount={activeFilterCount}
        />
      </View>

      {/* ── List ── */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: "#E5EAE7",
            }}
          >
            <Text style={{ fontWeight: "700", fontSize: 15, color: "#263238" }}>
              {item.title}
            </Text>
            <Text style={{ color: "#7B8589", marginTop: 2 }}>
              {item.category} · {item.date} · ₹
              {item.amount.toLocaleString("en-IN")}
            </Text>
          </View>
        )}
      />

      {/* ── Filter bottom sheet ── */}
      <FilterBottomSheet
        visible={sheetVisible}
        onClose={closeSheet}
        currentFilters={filters}
        onApply={applyFilters}
        categories={EXPENSE_CATEGORIES}
        // Optionally hide sections you don't need:
        // sections={["date", "category", "sort"]}
      />
    </View>
  );
}
