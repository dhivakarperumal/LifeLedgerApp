import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api, { getApiErrorMessage, logoutUser } from "../../api";
import { AddButton } from "../../components/AddButton";
import {
  createDateRangeSelection,
  isDateInRange,
  type DateRangeSelection,
} from "../../components/DateRangeFilter";
import { FormInput, FormOption } from "../../components/FormControls";
import { GradientSafeAreaView as SafeAreaView } from "../../components/GradientSafeAreaView";
import { SearchBar } from "../../components/SearchBar";
import {
  DEFAULT_FILTER_STATE,
  type FilterState,
  type SortOption,
  type ViewModeOption,
} from "../../components/filters";
import { Colors } from "../../constants/colors";

type ExpenseItem = {
  id: number | string;
  title: string;
  category?: string;
  expense_amount?: number | string;
  amount?: number | string;
  expense_date?: string;
  payment_method?: string;
  notes?: string;
  recurring?: string;
};

type ExpenseForm = {
  title: string;
  expense_amount: string;
  category: string;
  payment_method: string;
  date: string;
  time: string;
  notes: string;
};

const fallbackCategories = [
  "Food",
  "Travel",
  "Bills",
  "Shopping",
  "Health",
  "Education",
  "Other",
];

const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  Food: "restaurant-outline",
  Travel: "car-outline",
  Bills: "document-text-outline",
  Shopping: "bag-handle-outline",
  Health: "medkit-outline",
  Education: "school-outline",
  Other: "ellipsis-horizontal-outline",
};

/** Category accent colours — icon bg + icon tint */
const categoryAccents: Record<string, { bg: string; color: string }> = {
  Food: { bg: "#FFF0E6", color: "#F97316" },
  Travel: { bg: "#E6F0FF", color: "#3B82F6" },
  Bills: { bg: "#FEF3C7", color: "#D97706" },
  Shopping: { bg: "#FCE7F3", color: "#EC4899" },
  Health: { bg: "#ECFDF5", color: "#10B981" },
  Education: { bg: "#EDE9FE", color: "#7C3AED" },
  Other: { bg: "#F3F4F6", color: "#6B7280" },
};

const paymentMethods = [
  "Cash",
  "UPI",
  "Bank Transfer",
  "Card",
  "Cheque",
  "Other",
];

const paymentIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  Cash: "cash-outline",
  UPI: "phone-portrait-outline",
  "Bank Transfer": "business-outline",
  Card: "card-outline",
  Cheque: "document-outline",
  Other: "ellipsis-horizontal-outline",
};

function getCurrentDate() {
  return new Date().toISOString().split("T")[0];
}

function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;
}

function formatAmount(value: number | string | undefined) {
  const numeric = Number(value || 0);
  return `₹${numeric.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateString?: string) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function Expenses() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    totalAmount: 0,
    totalTransfer: 0,
    recurring: 0,
  });
  const [categoryOptions, setCategoryOptions] =
    useState<string[]>(fallbackCategories);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [dateRange, setDateRange] = useState<DateRangeSelection>(() =>
    createDateRangeSelection("All"),
  );
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [sort, setSort] = useState<SortOption>(DEFAULT_FILTER_STATE.sort);
  const [viewMode, setViewMode] = useState<ViewModeOption>("card");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ExpenseForm>({
    title: "",
    expense_amount: "",
    category: fallbackCategories[0],
    payment_method: "Cash",
    date: getCurrentDate(),
    time: getCurrentTime(),
    notes: "",
  });

  const filterValues = useMemo<FilterState>(
    () => ({
      ...DEFAULT_FILTER_STATE,
      dateRange,
      category: selectedCategory === "All" ? "" : selectedCategory,
      amountMin,
      amountMax,
      sort,
      viewMode,
    }),
    [dateRange, selectedCategory, amountMin, amountMax, sort, viewMode],
  );

  const applyExpenseFilters = (filters: FilterState) => {
    setDateRange(filters.dateRange);
    setSelectedCategory(filters.category || "All");
    setAmountMin(filters.amountMin);
    setAmountMax(filters.amountMax);
    setSort(filters.sort);
    setViewMode(filters.viewMode);
  };

  const handleUnauthorized = useCallback(async () => {
    await logoutUser();
    router.replace("/auth/login");
  }, [router]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [expensesRes, statsRes, categoriesRes] = await Promise.all([
        api.get("/expenses"),
        api.get("/expenses/stats"),
        api.get("/categories"),
      ]);

      const categoryRows = Array.isArray(categoriesRes?.data)
        ? categoriesRes.data
        : Array.isArray(categoriesRes?.data?.categories)
          ? categoriesRes.data.categories
          : Array.isArray(categoriesRes?.data?.data)
            ? categoriesRes.data.data
            : [];
      const categories: string[] = categoryRows
        .map((item: unknown): string => {
          if (typeof item === "string") return item.trim();
          if (!item || typeof item !== "object") return "";
          const category = item as Record<string, unknown>;
          const nestedCategory = category.category;
          const name =
            category.name ??
            category.category_name ??
            (typeof nestedCategory === "string"
              ? nestedCategory
              : (nestedCategory as Record<string, unknown> | undefined)
                  ?.name) ??
            category.title;
          return typeof name === "string" ? name.trim() : "";
        })
        .filter((category: string) => category.length > 0);
      const acceptableCategories = categories.length
        ? Array.from(new Set(categories))
        : fallbackCategories;

      setExpenses(Array.isArray(expensesRes?.data) ? expensesRes.data : []);
      setStats(
        statsRes?.data || {
          total: 0,
          totalAmount: 0,
          totalTransfer: 0,
          recurring: 0,
        },
      );
      setCategoryOptions(acceptableCategories);
      setSelectedCategory("All");
    } catch (error) {
      const status = (error as any)?.status || (error as any)?.response?.status;
      if (status === 401) {
        await handleUnauthorized();
        return;
      }
      console.error(error);
      Alert.alert(
        "Error",
        getApiErrorMessage(error, "Failed to load expenses."),
      );
      setExpenses([]);
      setCategoryOptions(fallbackCategories);
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      void fetchAll();
    }, [fetchAll]),
  );

  const visibleExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = expenses.filter((expense) => {
      const matchesCategory =
        selectedCategory === "All" ||
        (expense.category || "Other") === selectedCategory;
      const matchesDate = isDateInRange(expense.expense_date, dateRange);
      const amount = Number(expense.expense_amount ?? expense.amount ?? 0);
      const matchesMin = amountMin === "" || amount >= Number(amountMin);
      const matchesMax = amountMax === "" || amount <= Number(amountMax);
      const haystack = `${expense.title || ""} ${expense.category || ""} ${
        expense.notes || ""
      }`.toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      return (
        matchesCategory &&
        matchesSearch &&
        matchesDate &&
        matchesMin &&
        matchesMax
      );
    });
    return filtered.sort((left, right) => {
      const leftAmount = Number(left.expense_amount ?? left.amount ?? 0);
      const rightAmount = Number(right.expense_amount ?? right.amount ?? 0);
      const leftDate = new Date(left.expense_date || "").getTime() || 0;
      const rightDate = new Date(right.expense_date || "").getTime() || 0;
      if (sort === "Oldest First") return leftDate - rightDate;
      if (sort === "Amount: High to Low") return rightAmount - leftAmount;
      if (sort === "Amount: Low to High") return leftAmount - rightAmount;
      return rightDate - leftDate;
    });
  }, [
    expenses,
    search,
    selectedCategory,
    dateRange,
    amountMin,
    amountMax,
    sort,
  ]);

  const totals = useMemo(
    () => ({
      totalExpense: expenses.reduce(
        (sum, item) => sum + Number(item.expense_amount ?? item.amount ?? 0),
        0,
      ),
      todayExpense: expenses
        .filter((item) => {
          if (!item.expense_date) return false;
          const date = new Date(item.expense_date);
          const now = new Date();
          return (
            date.getFullYear() === now.getFullYear() &&
            date.getMonth() === now.getMonth() &&
            date.getDate() === now.getDate()
          );
        })
        .reduce(
          (sum, item) => sum + Number(item.expense_amount ?? item.amount ?? 0),
          0,
        ),
    }),
    [expenses],
  );

  const resetForm = () => {
    setForm({
      title: "",
      expense_amount: "",
      category: categoryOptions[0] || fallbackCategories[0],
      payment_method: "Cash",
      date: getCurrentDate(),
      time: getCurrentTime(),
      notes: "",
    });
  };

  const handleCreateExpense = async () => {
    if (
      !form.title.trim() ||
      !form.expense_amount ||
      Number(form.expense_amount) <= 0
    ) {
      Alert.alert(
        "Validation",
        "Please enter a valid title and expense amount.",
      );
      return;
    }

    try {
      setSaving(true);
      const payload = new FormData();
      payload.append("title", form.title.trim());
      payload.append("expense_amount", String(Number(form.expense_amount)));
      payload.append("category", form.category);
      payload.append("payment_method", form.payment_method);
      payload.append("expense_date", form.date);
      payload.append("expense_time", form.time);
      payload.append("notes", form.notes || "");

      const response = await api.post("/expenses", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const savedExpense = response?.data?.expense || response?.data || null;
      setExpenses((current) =>
        savedExpense ? [savedExpense, ...current] : current,
      );
      setIsModalVisible(false);
      resetForm();
      fetchAll();
      Alert.alert("Success", "Expense saved successfully.");
    } catch (error) {
      const status = (error as any)?.status || (error as any)?.response?.status;
      if (status === 401) {
        await handleUnauthorized();
        return;
      }
      Alert.alert(
        "Error",
        getApiErrorMessage(error, "Failed to save expense."),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = (expense: ExpenseItem) => {
    Alert.alert("Delete expense", `Delete "${expense.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/expenses/${expense.id}`);
            setExpenses((current) =>
              current.filter((item) => String(item.id) !== String(expense.id)),
            );
            Alert.alert("Deleted", "Expense removed.");
          } catch (error) {
            const status =
              (error as any)?.status || (error as any)?.response?.status;
            if (status === 401) {
              await handleUnauthorized();
              return;
            }
            Alert.alert(
              "Error",
              getApiErrorMessage(error, "Failed to delete expense."),
            );
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{ flex: 1, backgroundColor: "#F0F4F8" }}
    >
      <View style={{ flex: 1, backgroundColor: "#F0F4F8" }}>
        {/* ── Hero Header ── */}
        <View
          style={{
            paddingTop: insets.top + 16,
            paddingBottom: 28,
            paddingHorizontal: 20,
          }}
        >
          {/* Stat cards inside header */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <HeroStatCard
              title="Total Amount"
              subtitle="All time expenses"
              value={formatAmount(stats.totalAmount || totals.totalExpense)}
              icon="wallet-outline"
              iconBg="#8EB379"
              iconColor="#FFFFFF"
              trendPercent="8%"
              trendText="more than last month"
            />
            <HeroStatCard
              title="Today Amount"
              subtitle="Your expenses today"
              value={formatAmount(totals.todayExpense)}
              icon="calendar-outline"
              iconBg="#DDF2D1"
              iconColor="#7E9E67"
              trendPercent="12%"
              trendText="more than yesterday"
            />
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => void fetchAll()}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 18,
            paddingBottom: insets.bottom + 100,
          }}
        >
          {/* ── Search bar + Filter button ── */}
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Search expenses…"
            filterSheet={{
              currentFilters: filterValues,
              onApply: applyExpenseFilters,
              categories: categoryOptions,
              sections: ["date", "category", "amount", "sort", "viewMode"],
            }}
            style={{ marginBottom: 12 }}
          />

          {/* Active filter chip */}
          {selectedCategory !== "All" && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#E8F5E9",
                  borderRadius: 20,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderWidth: 1,
                  borderColor: "#B7DFC5",
                  gap: 6,
                }}
              >
                <Ionicons
                  name={categoryIcons[selectedCategory] || "pricetag-outline"}
                  size={13}
                  color="#1B4332"
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: "#1B4332",
                  }}
                >
                  {selectedCategory}
                </Text>
                <Pressable
                  onPress={() => setSelectedCategory("All")}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={16} color="#2D6A4F" />
                </Pressable>
              </View>
              <Text style={{ marginLeft: 10, fontSize: 12, color: "#94A3B8" }}>
                {visibleExpenses.length} result
                {visibleExpenses.length !== 1 ? "s" : ""}
              </Text>
            </View>
          )}

          {/* ── Expense list ── */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "800", color: "#1E293B" }}>
              {selectedCategory === "All"
                ? "All Expenses"
                : `${selectedCategory} Expenses`}
            </Text>
            <Text style={{ fontSize: 12, color: "#94A3B8" }}>
              {visibleExpenses.length} item
              {visibleExpenses.length !== 1 ? "s" : ""}
            </Text>
          </View>

          {loading ? (
            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 20,
                padding: 40,
                alignItems: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <Ionicons name="hourglass-outline" size={36} color="#94A3B8" />
              <Text
                style={{
                  marginTop: 12,
                  fontSize: 15,
                  color: "#64748B",
                  fontWeight: "600",
                }}
              >
                Loading expenses…
              </Text>
            </View>
          ) : visibleExpenses.length === 0 ? (
            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 20,
                padding: 40,
                alignItems: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: "#F1F5F9",
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <Ionicons name="receipt-outline" size={34} color="#94A3B8" />
              </View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: "#1E293B",
                  marginBottom: 6,
                }}
              >
                No expenses found
              </Text>
              <Text
                style={{ fontSize: 13, color: "#94A3B8", textAlign: "center" }}
              >
                Try a different category or{"\n"}tap + to add a new expense.
              </Text>
            </View>
          ) : (
            visibleExpenses.map((expense, index) => {
              const icon =
                categoryIcons[String(expense.category || "Other")] ||
                "pricetag-outline";
              const accent = categoryAccents[expense.category || "Other"] || {
                bg: "#F3F4F6",
                color: "#6B7280",
              };

              return (
                <View
                  key={String(expense.id)}
                  style={{
                    backgroundColor:
                      viewMode === "card" ? "#FFFFFF" : "transparent",
                    borderRadius: viewMode === "card" ? 18 : 0,
                    padding: viewMode === "card" ? 16 : 10,
                    marginBottom: viewMode === "card" ? 10 : 0,
                    flexDirection: "row",
                    alignItems: "center",
                    borderBottomWidth: viewMode === "table" ? 1 : 0,
                    borderBottomColor: "#E4E8E3",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: viewMode === "card" ? 0.06 : 0,
                    shadowRadius: 8,
                    elevation: viewMode === "card" ? 3 : 0,
                  }}
                >
                  {/* Icon */}
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 15,
                      backgroundColor: accent.bg,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons name={icon} size={22} color={accent.color} />
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "700",
                        color: "#1E293B",
                      }}
                      numberOfLines={1}
                    >
                      {expense.title || "Expense"}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginTop: 4,
                        gap: 6,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: accent.bg,
                          borderRadius: 6,
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: accent.color,
                          }}
                        >
                          {expense.category || "Other"}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, color: "#94A3B8" }}>
                        {formatDate(expense.expense_date)}
                      </Text>
                    </View>
                  </View>

                  {/* Amount + delete */}
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "800",
                        color: "#EF4444",
                      }}
                    >
                      {formatAmount(
                        expense.expense_amount ?? expense.amount ?? 0,
                      )}
                    </Text>
                    <Pressable
                      onPress={() => handleDeleteExpense(expense)}
                      hitSlop={10}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        backgroundColor: "#FEF2F2",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={14}
                        color="#EF4444"
                      />
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>

      <AddButton
        onPress={() => setIsModalVisible(true)}
        accessibilityLabel="Add expense"
        accessibilityHint="Opens the new expense form"
      />

      {/* ── Category Filter Modal ── */}
      <Modal
        visible={isFilterSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsFilterSheetVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(15, 23, 42, 0.45)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 18,
              paddingTop: 12,
              paddingBottom: insets.bottom + 20,
              maxHeight: "78%",
            }}
          >
            <View
              style={{
                width: 44,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#E2E8F0",
                alignSelf: "center",
                marginBottom: 16,
              }}
            />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <Text
                style={{ fontSize: 20, fontWeight: "800", color: "#1E293B" }}
              >
                Filter by category
              </Text>
              <Pressable
                onPress={() => setIsFilterSheetVisible(false)}
                hitSlop={10}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: "#F1F5F9",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Ionicons name="close" size={16} color="#475569" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {["All", ...categoryOptions].map((item) => {
                const active = selectedCategory === item;
                const icon =
                  item === "All"
                    ? "funnel-outline"
                    : categoryIcons[item] || "pricetag-outline";
                const accent =
                  item === "All"
                    ? { bg: "#E8F5E9", color: "#1B4332" }
                    : categoryAccents[item] || {
                        bg: "#F3F4F6",
                        color: "#6B7280",
                      };
                return (
                  <Pressable
                    key={item}
                    onPress={() => {
                      setSelectedCategory(item);
                      setIsFilterSheetVisible(false);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: active ? "#E8F5E9" : "#F8FAFC",
                      borderWidth: 1,
                      borderColor: active ? "#B7DFC5" : "#E2E8F0",
                      borderRadius: 14,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      marginBottom: 10,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          backgroundColor: accent.bg,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons name={icon} size={16} color={accent.color} />
                      </View>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: active ? "800" : "600",
                          color: "#1E293B",
                        }}
                      >
                        {item}
                      </Text>
                    </View>
                    {active && (
                      <Ionicons name="checkmark" size={18} color="#1B4332" />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Add Expense Modal ── */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              paddingHorizontal: 20,
              paddingTop: 10,
              paddingBottom: insets.bottom + 20,
              maxHeight: "92%",
            }}
          >
            {/* Drag handle */}
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#E2E8F0",
                alignSelf: "center",
                marginBottom: 16,
              }}
            />

            {/* Modal header */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <View>
                <Text
                  style={{ fontSize: 22, fontWeight: "900", color: "#1E293B" }}
                >
                  Add Expense
                </Text>
                <Text style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
                  Fill in the details below
                </Text>
              </View>
              <Pressable
                onPress={() => setIsModalVisible(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "#F1F5F9",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Ionicons name="close" size={18} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TextField
                label="Title"
                value={form.title}
                onChangeText={(text) =>
                  setForm((current) => ({ ...current, title: text }))
                }
                placeholder="e.g. Grocery, Petrol…"
                icon="create-outline"
              />

              <TextField
                label="Amount (₹)"
                value={form.expense_amount}
                onChangeText={(text) =>
                  setForm((current) => ({ ...current, expense_amount: text }))
                }
                placeholder="0.00"
                keyboardType="decimal-pad"
                icon="cash-outline"
              />

              {/* Category picker */}
              <View style={{ marginBottom: 16 }}>
                <ModalSectionLabel label="CATEGORY" />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {categoryOptions.map((item) => {
                    const selected = form.category === item;
                    const accent = categoryAccents[item] || {
                      bg: "#F3F4F6",
                      color: "#6B7280",
                    };
                    const icon = categoryIcons[item] || "pricetag-outline";
                    return (
                      <FormOption
                        key={item}
                        selected={selected}
                        onPress={() =>
                          setForm((current) => ({ ...current, category: item }))
                        }
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 12,
                          backgroundColor: selected ? "#1B4332" : "#F8FAFC",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Ionicons
                          name={icon}
                          size={14}
                          color={selected ? "#FFFFFF" : accent.color}
                        />
                        <Text
                          style={{
                            color: selected ? "#FFFFFF" : "#374151",
                            fontWeight: selected ? "700" : "600",
                            fontSize: 13,
                          }}
                        >
                          {item}
                        </Text>
                      </FormOption>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Date & Time */}
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <ModalSectionLabel label="DATE" />
                  <View style={inputWrapperStyle}>
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color="#94A3B8"
                      style={{ marginRight: 8 }}
                    />
                    <FormInput
                      bordered={false}
                      value={form.date}
                      onChangeText={(text) =>
                        setForm((current) => ({ ...current, date: text }))
                      }
                      placeholder="YYYY-MM-DD"
                      style={inlineInputStyle}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <ModalSectionLabel label="TIME" />
                  <View style={inputWrapperStyle}>
                    <Ionicons
                      name="time-outline"
                      size={16}
                      color="#94A3B8"
                      style={{ marginRight: 8 }}
                    />
                    <FormInput
                      bordered={false}
                      value={form.time}
                      onChangeText={(text) =>
                        setForm((current) => ({ ...current, time: text }))
                      }
                      placeholder="HH:MM"
                      style={inlineInputStyle}
                    />
                  </View>
                </View>
              </View>

              {/* Payment method */}
              <View style={{ marginBottom: 16 }}>
                <ModalSectionLabel label="PAYMENT METHOD" />
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
                  {paymentMethods.map((method) => {
                    const selected = form.payment_method === method;
                    const icon = paymentIcons[method] || "card-outline";
                    return (
                      <FormOption
                        key={method}
                        selected={selected}
                        onPress={() =>
                          setForm((current) => ({
                            ...current,
                            payment_method: method,
                          }))
                        }
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 12,
                          backgroundColor: selected ? "#F0FDF4" : "#F8FAFC",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <Ionicons
                          name={icon}
                          size={13}
                          color={selected ? "#2D6A4F" : "#94A3B8"}
                        />
                        <Text
                          style={{
                            color: selected ? "#1B4332" : "#374151",
                            fontWeight: selected ? "700" : "500",
                            fontSize: 13,
                          }}
                        >
                          {method}
                        </Text>
                      </FormOption>
                    );
                  })}
                </View>
              </View>

              <TextField
                label="Notes"
                value={form.notes}
                onChangeText={(text) =>
                  setForm((current) => ({ ...current, notes: text }))
                }
                placeholder="Optional details…"
                multiline
                icon="chatbubble-ellipses-outline"
              />

              <Pressable
                onPress={handleCreateExpense}
                disabled={saving}
                style={{
                  marginTop: 8,
                  borderRadius: 18,
                  height: 54,
                  justifyContent: "center",
                  alignItems: "center",
                  opacity: saving ? 0.7 : 1,
                  overflow: "hidden",
                  backgroundColor: "#1B4332",
                  shadowColor: "#1B4332",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.35,
                  shadowRadius: 12,
                  elevation: 8,
                  flexDirection: "row",
                  gap: 8,
                }}
              >
                <Ionicons
                  name={
                    saving ? "hourglass-outline" : "checkmark-circle-outline"
                  }
                  size={20}
                  color="#FFFFFF"
                />
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontWeight: "800",
                    fontSize: 16,
                    letterSpacing: 0.3,
                  }}
                >
                  {saving ? "Saving…" : "Save Expense"}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Filter Bottom Sheet ── */}
      <Modal
        visible={isFilterSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsFilterSheetVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              paddingHorizontal: 20,
              paddingTop: 10,
              paddingBottom: insets.bottom + 20,
              maxHeight: "80%",
            }}
          >
            {/* Drag handle */}
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#E2E8F0",
                alignSelf: "center",
                marginBottom: 16,
              }}
            />

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <Text
                style={{ fontSize: 20, fontWeight: "800", color: "#1E293B" }}
              >
                Filter by Category
              </Text>
              <Pressable
                onPress={() => setIsFilterSheetVisible(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: "#F1F5F9",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Ionicons name="close" size={16} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                {["All", ...categoryOptions].map((category) => {
                  const isSelected = selectedCategory === category;
                  const icon =
                    category === "All"
                      ? "grid-outline"
                      : categoryIcons[category] || "pricetag-outline";
                  const accent = categoryAccents[category] || {
                    bg: "#F3F4F6",
                    color: "#6B7280",
                  };

                  return (
                    <Pressable
                      key={category}
                      onPress={() => {
                        setSelectedCategory(category);
                        setIsFilterSheetVisible(false);
                      }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        backgroundColor: isSelected ? "#1B4332" : "#F8FAFC",
                        borderRadius: 16,
                        borderWidth: 1.5,
                        borderColor: isSelected ? "#1B4332" : "#E2E8F0",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Ionicons
                        name={icon}
                        size={16}
                        color={isSelected ? "#FFFFFF" : accent.color}
                      />
                      <Text
                        style={{
                          color: isSelected ? "#FFFFFF" : "#374151",
                          fontWeight: isSelected ? "700" : "600",
                          fontSize: 14,
                        }}
                      >
                        {category}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ─────────────────────────────────────────
   Sub-components
───────────────────────────────────────── */

function HeroStatCard({
  title,
  subtitle,
  value,
  icon,
  iconBg,
  iconColor,
  trendPercent,
  trendText,
}: {
  title: string;
  subtitle: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  trendPercent: string;
  trendText: string;
}) {
  const formattedValue = value.replace("₹", "₹ ");
  const [whole, fraction] = formattedValue.split(".");

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#F8FCF8",
        borderRadius: 20,
        padding: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 4,
        overflow: "hidden",
      }}
    >
      {/* Decorative wavy background approximation */}
      <View
        style={{
          position: "absolute",
          bottom: -20,
          left: -40,
          right: -40,
          height: "60%",
          backgroundColor: "#E8F5E9",
          borderTopLeftRadius: 150,
          borderTopRightRadius: 150,
          opacity: 0.6,
        }}
      />

      {/* Header Row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            flex: 1,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              backgroundColor: iconBg,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons name={icon} size={22} color={iconColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontSize: 14, fontWeight: "900", color: "#000000" }}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text
              style={{ fontSize: 11, color: "#8b929c", marginTop: 2 }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          </View>
        </View>
      </View>

      {/* Value */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: "900",
            color: "#163316",
            letterSpacing: -0.5,
          }}
        >
          {whole}
        </Text>
        {fraction && (
          <Text style={{ fontSize: 18, fontWeight: "900", color: "#163316" }}>
            .{fraction}
          </Text>
        )}
      </View>

      {/* Trend Row */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#E3F0E4",
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
          }}
        >
          <Ionicons name="trending-up" size={14} color="#337833" />
        </View>
        <Text style={{ fontSize: 13, fontWeight: "900", color: "#337833" }}>
          {trendPercent}
        </Text>
        <Text style={{ fontSize: 11, color: "#8b929c", flexShrink: 1 }}>
          {trendText}
        </Text>
      </View>
    </View>
  );
}

function ModalSectionLabel({ label }: { label: string }) {
  return (
    <Text
      style={{
        fontSize: 12,
        color: "#94A3B8",
        fontWeight: "700",
        letterSpacing: 1.3,
        marginBottom: 8,
      }}
    >
      {label}
    </Text>
  );
}

function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  icon,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "number-pad" | "decimal-pad" | "numeric";
  multiline?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <ModalSectionLabel label={label.toUpperCase()} />
      <View
        style={{
          ...inputWrapperStyle,
          minHeight: multiline ? 90 : 48,
          alignItems: multiline ? "flex-start" : "center",
          paddingTop: multiline ? 12 : 0,
        }}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={17}
            color="#94A3B8"
            style={{ marginRight: 8, marginTop: multiline ? 2 : 0 }}
          />
        )}
        <FormInput
          bordered={false}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
          style={{
            flex: 1,
            fontSize: 15,
            color: "#1E293B",
            textAlignVertical: multiline ? "top" : "center",
          }}
        />
      </View>
    </View>
  );
}

const inputWrapperStyle = {
  backgroundColor: "#F8FAFC",
  borderWidth: 1,
  borderColor: Colors.border,
  borderRadius: 14,
  paddingHorizontal: 14,
  paddingVertical: 10,
  flexDirection: "row" as const,
  alignItems: "center" as const,
};

const inlineInputStyle = {
  flex: 1,
  fontSize: 14,
  color: "#1E293B",
};
