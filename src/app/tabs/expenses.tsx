import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    LayoutAnimation,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
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
import { DateTimePickerComponent } from "../../components/DateTimePickerComponent";
import {
    formatLocalDate,
    formatLocalTime,
    parseLocalDateTime,
} from "../../components/dateTimeUtils";
import {
    DEFAULT_FILTER_STATE,
    type FilterState,
    type SortOption,
    type ViewModeOption,
} from "../../components/filters";
import {
    FormField,
    FormLabel,
} from "../../components/FormControls";
import { GradientSafeAreaView as SafeAreaView } from "../../components/GradientSafeAreaView";
import { PopupSelect } from "../../components/PopupSelect";
import { SearchBar } from "../../components/SearchBar";
import { Colors } from "../../constants/colors";

type ExpenseItem = {
  id: number | string;
  title: string;
  category?: string;
  expense_amount?: number | string;
  amount?: number | string;
  expense_date?: string;
  expense_time?: string;
  time?: string;
  payment_method?: string;
  notes?: string;
  location?: string;
  from?: string;
  to?: string;
  transfer_id?: number | string;
  transfer_amount?: number | string;
  recurring?: string;
};

type TransferItem = {
  id: number | string;
  title: string;
  amount?: number | string;
  total_expense?: number | string;
  remaining_amount?: number | string;
};

type PickedAttachment = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

type ExpenseForm = {
  title: string;
  expense_amount: string;
  transfer_id: string;
  transfer_amount: string;
  category: string;
  from: string;
  to: string;
  payment_method: string;
  date: string;
  time: string;
  notes: string;
  location: string;
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

const paymentTypeOptions = [
  "Cash",
  "UPI",
  "Card",
  "Bank Transfer",
  "Wallet",
];

/** Category accent colours used by expense badges */
const categoryAccents: Record<string, { bg: string; color: string }> = {
  Food: { bg: "#FFF0E6", color: "#F97316" },
  Travel: { bg: "#E6F0FF", color: "#3B82F6" },
  Bills: { bg: "#FEF3C7", color: "#D97706" },
  Shopping: { bg: "#FCE7F3", color: "#EC4899" },
  Health: { bg: "#ECFDF5", color: "#10B981" },
  Education: { bg: "#EDE9FE", color: "#7C3AED" },
  Other: { bg: "#F3F4F6", color: "#6B7280" },
};

function getCurrentDate() {
  const now = new Date();
  // Use local date instead of UTC to avoid timezone-related date mismatches
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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

function getTransferRows(data: any): TransferItem[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.transfers)) return data.transfers;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.transfers)) return data.data.transfers;
  return [];
}

function getTransferBalance(transfer: TransferItem) {
  const remaining = Number(transfer.remaining_amount);
  if (Number.isFinite(remaining)) return remaining;
  return Math.max(
    0,
    Number(transfer.amount || 0) - Number(transfer.total_expense || 0),
  );
}

function isTravelCategory(category: string) {
  return category.trim().toLowerCase().includes("travel");
}

export default function Expenses() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const router = useRouter();
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    totalAmount: 0,
    totalTransfer: 0,
    recurring: 0,
  });
  const [categoryOptions, setCategoryOptions] = useState<string[]>(fallbackCategories);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [dateRange, setDateRange] = useState<DateRangeSelection>(() =>
    createDateRangeSelection("All"),
  );
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [sort, setSort] = useState<SortOption>(DEFAULT_FILTER_STATE.sort);
  const [viewMode, setViewMode] = useState<ViewModeOption>("card");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showSummaryCards, setShowSummaryCards] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<number | string | null>(null);
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);
  const [categoryFilterSearch, setCategoryFilterSearch] = useState("");
  const [formErrors, setFormErrors] = useState({
    category: "",
    payment_method: "",
    transfer_amount: "",
  });
  const [saving, setSaving] = useState(false);
  const [manualTransfer, setManualTransfer] = useState(false);
  const [customTransferAmount, setCustomTransferAmount] = useState(false);
  const [attachment, setAttachment] = useState<PickedAttachment | null>(null);
  const [form, setForm] = useState<ExpenseForm>({
    title: "",
    expense_amount: "",
    transfer_id: "",
    transfer_amount: "",
    category: fallbackCategories[0],
    from: "",
    to: "",
    payment_method: "Cash",
    date: getCurrentDate(),
    time: getCurrentTime(),
    notes: "",
    location: "",
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            showSummaryCards ? "Hide expense summaries" : "Show expense summaries"
          }
          accessibilityState={{ selected: showSummaryCards }}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setShowSummaryCards((visible) => !visible);
          }}
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 22,
            marginRight: 12,
            backgroundColor: showSummaryCards
              ? "rgba(255,255,255,0.28)"
              : "rgba(255,255,255,0.15)",
          }}
        >
          <Ionicons
            name={showSummaryCards ? "funnel" : "funnel-outline"}
            size={22}
            color={showSummaryCards ? Colors.accent : Colors.white}
          />
        </Pressable>
      ),
    });
  }, [navigation, showSummaryCards]);

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

  const transferAmountOptions = useMemo(
    () => [
      { label: "No transfer", value: "", description: "" },
      ...transfers.map((transfer) => {
        const amount = getTransferBalance(transfer);
        return {
          label: `${transfer.title || "Transfer"} • ${formatAmount(amount)}`,
          value: String(transfer.id),
          description: amount > 0 ? `Available: ${formatAmount(amount)}` : "Unavailable",
          disabled: amount <= 0,
        };
      }),
    ],
    [transfers],
  );

  const applyExpenseFilters = (filters: FilterState) => {
    setDateRange(filters.dateRange);
    setSelectedCategory(filters.category || "All");
    setAmountMin(filters.amountMin);
    setAmountMax(filters.amountMax);
    setSort(filters.sort);
    setViewMode(filters.viewMode);
  };

  const showAllExpenses = () => {
    setSearch("");
    applyExpenseFilters(DEFAULT_FILTER_STATE);
  };

  const openAddExpense = () => {
    resetForm();
    setFormErrors({ category: "", payment_method: "", transfer_amount: "" });
    setIsModalVisible(true);
  };

  const handleUnauthorized = useCallback(async () => {
    await logoutUser();
    router.replace("/auth/login");
  }, [router]);

  const fetchAll = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) setRefreshing(true);
      const [expensesRes, statsRes, categoriesRes, transfersRes] =
        await Promise.all([
          api.get("/expenses"),
          api.get("/expenses/stats"),
          api.get("/categories"),
          api.get("/transfers").catch(() => null),
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
          const categoryType = String(
            category.catType ??
              category.category_type ??
              category.type ??
              "Expensive",
          )
            .trim()
            .toLowerCase();
          if (
            !categoryType.includes("expense") &&
            !categoryType.includes("expensive")
          ) {
            return "";
          }
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
      setTransfers(getTransferRows(transfersRes?.data));
      setStats(
        statsRes?.data || {
          total: 0,
          totalAmount: 0,
          totalTransfer: 0,
          recurring: 0,
        },
      );
      setCategoryOptions(acceptableCategories);
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
      setRefreshing(false);
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
    setEditingExpenseId(null);
    setForm({
      title: "",
      expense_amount: "",
      transfer_id: "",
      transfer_amount: "",
      category: categoryOptions[0] || fallbackCategories[0],
      from: "",
      to: "",
      payment_method: "Cash",
      date: getCurrentDate(),
      time: getCurrentTime(),
      notes: "",
      location: "",
    });
    setManualTransfer(false);
    setCustomTransferAmount(false);
    setAttachment(null);
  };

  const applyTransferSelection = (transferId: string, useFullBalance = true) => {
    const selectedTransfer = transfers.find(
      (transfer) => String(transfer.id) === String(transferId),
    );
    if (!selectedTransfer) {
      setForm((current) => ({
        ...current,
        transfer_id: transferId,
        transfer_amount: useFullBalance ? "" : current.transfer_amount,
      }));
      return;
    }

    setCustomTransferAmount(false);
    setForm((current) => ({
      ...current,
      transfer_id: String(selectedTransfer.id),
      transfer_amount: useFullBalance
        ? String(getTransferBalance(selectedTransfer))
        : current.transfer_amount,
    }));
  };

  const pickAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if ((file.size || 0) > 10 * 1024 * 1024) {
        Alert.alert("Receipt too large", "Choose a file smaller than 10 MB.");
        return;
      }
      setAttachment({
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType || "application/octet-stream",
        size: file.size,
      });
    } catch (error) {
      Alert.alert("Unable to select receipt", getApiErrorMessage(error));
    }
  };

  const handleCreateExpense = async () => {
    const nextErrors = {
      category: !form.category.trim() ? "Please select a category." : "",
      payment_method: !form.payment_method.trim()
        ? "Please select a payment type."
        : "",
      transfer_amount: "",
    };

    setFormErrors(nextErrors);

    if (!form.title.trim() || !form.expense_amount || !form.category.trim() || !form.date.trim()) {
      Alert.alert(
        "Error",
        "Title, expense amount, category, and date are required.",
      );
      return;
    }

    if (!form.payment_method.trim()) {
      Alert.alert("Payment Type required", "Please select a payment type.");
      return;
    }

    const isTravel = isTravelCategory(form.category);
    if (isTravel && (!form.from.trim() || !form.to.trim())) {
      Alert.alert(
        "Travel details required",
        "Enter both a starting point and destination.",
      );
      return;
    }

    if (form.transfer_id) {
      const selectedTransfer = transfers.find(
        (transfer) => String(transfer.id) === form.transfer_id,
      );
      const transferBalance = selectedTransfer
        ? getTransferBalance(selectedTransfer)
        : 0;
      const selectedAmount = Number(form.transfer_amount);
      if (!selectedTransfer || !Number.isFinite(selectedAmount) || selectedAmount <= 0) {
        nextErrors.transfer_amount = "Select a valid available transfer amount.";
        setFormErrors(nextErrors);
        Alert.alert("Transfer amount required", "Select a valid available transfer amount.");
        return;
      }
      if (selectedAmount > transferBalance) {
        nextErrors.transfer_amount = `Choose an amount up to ${formatAmount(transferBalance)}.`;
        setFormErrors(nextErrors);
        Alert.alert(
          "Transfer amount too high",
          `Choose an amount up to ${formatAmount(transferBalance)}.`,
        );
        return;
      }
    }

    try {
      setSaving(true);
      const isEditing = editingExpenseId !== null;

      const payload = new FormData();
      
      // Mirror Web logic for appending fields
      const formEntries = {
        title: form.title.trim(),
        expense_amount: form.expense_amount,
        category: form.category.trim(),
        payment_method: form.payment_method,
        date: form.date.trim(), // Use "date", NOT "expense_date"
        time: form.time, // Use "time", NOT "expense_time"
        notes: form.notes || "",
        location: form.location.trim(),
        transfer_id: form.transfer_id || "",
        transfer_amount: form.transfer_amount || "",
      };

      Object.entries(formEntries).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== "") {
          payload.append(k, String(v));
        }
      });

      // Handle from/to based on travel category like Web
      if (isTravel) {
        if (form.from.trim()) payload.append("from", form.from.trim());
        if (form.to.trim()) payload.append("to", form.to.trim());
      } else {
        payload.append("from", "");
        payload.append("to", "");
      }

      if (attachment) {
        payload.append("attachment", {
          uri: attachment.uri,
          name: attachment.name,
          type: attachment.mimeType,
        } as any);
      }

      const requestConfig = {
        headers: { "Content-Type": "multipart/form-data" },
      };
      const response = isEditing
        ? await api.put(`/expenses/${editingExpenseId}`, payload, requestConfig)
        : await api.post("/expenses", payload, requestConfig);

      const savedExpense = response?.data?.expense || response?.data || null;
      if (isEditing) {
        setExpenses((current) =>
          current.map((item) =>
            String(item.id) === String(editingExpenseId) && savedExpense
              ? { ...item, ...savedExpense }
              : item,
          ),
        );
      } else {
        setExpenses((current) =>
          savedExpense ? [savedExpense, ...current] : current,
        );
      }
      setIsModalVisible(false);
      resetForm();
      void fetchAll();
      Alert.alert(
        "Success",
        isEditing ? "Expense updated successfully." : "Expense saved successfully.",
      );
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

  const handleEditExpense = (expense: ExpenseItem) => {
    const rawDate = expense.expense_date || "";
    const dateMatch = rawDate.match(/^(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch?.[1] ||
      (rawDate && !Number.isNaN(new Date(rawDate).getTime())
        ? formatLocalDate(new Date(rawDate))
        : getCurrentDate());
    const rawTime = expense.expense_time || expense.time || "";
    const dateTimeMatch = rawDate.match(/T(\d{2}:\d{2})/);

    setForm({
      title: expense.title || "",
      expense_amount: String(expense.expense_amount ?? expense.amount ?? ""),
      transfer_id: String(expense.transfer_id ?? ""),
      transfer_amount: String(expense.transfer_amount ?? ""),
      category: expense.category || categoryOptions[0] || fallbackCategories[0],
      from: expense.from || "",
      to: expense.to || "",
      payment_method: expense.payment_method || "Cash",
      date,
      time: rawTime.slice(0, 5) || dateTimeMatch?.[1] || getCurrentTime(),
      notes: expense.notes || "",
      location: expense.location || "",
    });
    setFormErrors({ category: "", payment_method: "", transfer_amount: "" });
    setEditingExpenseId(expense.id);
    setAttachment(null);
    setIsModalVisible(true);
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
      style={{ flex: 1, backgroundColor: "#F2F5EA" }}
    >
      <View style={{ flex: 1, backgroundColor: "#F2F5EA" }}>
        {/* ── Hero Header ── */}
        <View
          style={{
            paddingTop: showSummaryCards ? 8 : 0,
            paddingBottom: showSummaryCards ? 28 : 0,
            paddingHorizontal: 20,
          }}
        >
          {showSummaryCards && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
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
          )}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void fetchAll(true)}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 0,
            paddingBottom: insets.bottom + 100,
          }}
        >
          {/* ── Search bar + Filter button ── */}
          <SearchBar
            className="mt-5"
            value={search}
            onChangeText={setSearch}
            placeholder="Search expenses…"
            filterSheet={{
              currentFilters: filterValues,
              onApply: applyExpenseFilters,
              categories: categoryOptions,
              sections: ["date", "category", "amount", "sort", "viewMode"],
              initialExpandedSections: ["viewMode"],
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ fontSize: 12, color: "#94A3B8" }}>
                {visibleExpenses.length} item
                {visibleExpenses.length !== 1 ? "s" : ""}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View all expenses"
                onPress={showAllExpenses}
                hitSlop={8}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.primary }}>
                  View All
                </Text>
                <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
              </Pressable>
            </View>
          </View>

          {visibleExpenses.length === 0 ? (
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
            <View
              style={
                viewMode === "card"
                  ? {
                      flexDirection: "row",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                    }
                  : undefined
              }
            >
              {visibleExpenses.map((expense, index) => {
                const accent = categoryAccents[expense.category || "Other"] || {
                  bg: "#F3F4F6",
                  color: "#6B7280",
                };

                return (
                  <View
                    key={String(expense.id)}
                    style={{
                      width: viewMode === "card" ? "48.5%" : "100%",
                      minWidth: 0,
                      backgroundColor: "#FFFFFF",
                      borderRadius: 16,
                      padding: viewMode === "card" ? 12 : 16,
                      marginBottom: 10,
                      flexDirection: viewMode === "card" ? "column" : "row",
                      alignItems: viewMode === "card" ? "stretch" : "center",
                      borderWidth: 1,
                      borderColor: "#E4E8E3",
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: viewMode === "card" ? 0 : 0.04,
                      shadowRadius: viewMode === "card" ? 0 : 6,
                      elevation: viewMode === "card" ? 0 : 2,
                    }}
                  >
                    {/* Info */}
                    <View
                      style={{
                        flex: 1,
                        minWidth: 0,
                        marginLeft: 0,
                        marginTop: 0,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "800",
                          color: "#293930",
                        }}
                        numberOfLines={viewMode === "card" ? 2 : 1}
                      >
                        {expense.title || "Expense"}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          alignItems: "center",
                          marginTop: 4,
                          gap: 4,
                        }}
                      >
                        <View
                          style={{
                            backgroundColor:
                              viewMode === "card" ? "transparent" : accent.bg,
                            borderRadius: 6,
                            maxWidth: "100%",
                            paddingHorizontal: viewMode === "card" ? 0 : 7,
                            paddingVertical: viewMode === "card" ? 0 : 2,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "700",
                              color:
                                viewMode === "card" ? "#818D84" : accent.color,
                            }}
                            numberOfLines={1}
                          >
                            {expense.category || "Other"}
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 11,
                            color: "#7C8880",
                            flexShrink: 1,
                          }}
                          numberOfLines={1}
                        >
                          {formatDate(expense.expense_date)}
                        </Text>
                      </View>
                      {expense.location ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginTop: 6,
                            gap: 5,
                          }}
                        >
                          <Ionicons
                            name="location-outline"
                            size={12}
                            color="#64748B"
                          />
                          <Text
                            style={{ fontSize: 11, color: "#64748B", flex: 1 }}
                            numberOfLines={1}
                          >
                            {expense.location}
                          </Text>
                        </View>
                      ) : null}
                      {expense.from?.trim() || expense.to?.trim() ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "flex-start",
                            marginTop: 6,
                            gap: 5,
                          }}
                        >
                          <Ionicons
                            name="navigate-outline"
                            size={12}
                            color="#64748B"
                            style={{ marginTop: 2 }}
                          />
                          <View style={{ flex: 1, gap: 2 }}>
                            {expense.from?.trim() ? (
                              <Text
                                style={{ fontSize: 11, color: "#64748B" }}
                                numberOfLines={viewMode === "card" ? 2 : 1}
                              >
                                From: {expense.from.trim()}
                              </Text>
                            ) : null}
                            {expense.to?.trim() ? (
                              <Text
                                style={{ fontSize: 11, color: "#64748B" }}
                                numberOfLines={viewMode === "card" ? 2 : 1}
                              >
                                To: {expense.to.trim()}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ) : null}
                    </View>

                    {/* Amount and expense actions */}
                    <View
                      style={{
                        flexDirection: "column",
                        alignItems: viewMode === "card" ? "stretch" : "flex-end",
                        marginLeft: viewMode === "card" ? 0 : 10,
                        marginTop: viewMode === "card" ? 12 : 0,
                        paddingTop: viewMode === "card" ? 12 : 0,
                        borderTopWidth: viewMode === "card" ? 1 : 0,
                        borderTopColor: "#EEF1EE",
                        gap: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: viewMode === "card" ? 14 : 15,
                          fontWeight: "800",
                          color: "#B64C45",
                        }}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {formatAmount(
                          expense.expense_amount ?? expense.amount ?? 0,
                        )}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          gap: 4,
                        }}
                      >
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Edit ${expense.title || "expense"}`}
                          onPress={() => handleEditExpense(expense)}
                          hitSlop={8}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            backgroundColor: "#EEF5F0",
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <Ionicons name="create-outline" size={16} color={Colors.primary} />
                        </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${expense.title || "expense"}`}
                        onPress={() => handleDeleteExpense(expense)}
                        hitSlop={10}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 10,
                          backgroundColor: "#FFF4F2",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Ionicons name="trash-outline" size={15} color="#EF4444" />
                      </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>

      <AddButton
        onPress={openAddExpense}
        accessibilityLabel="Add expense"
        accessibilityHint="Opens the new expense form"
        bottomOffset={84}
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

            <View className="mb-3 flex-row items-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3">
              <Ionicons name="search-outline" size={17} color="#667085" />
              <TextInput
                accessibilityLabel="Search categories in filter"
                value={categoryFilterSearch}
                onChangeText={setCategoryFilterSearch}
                placeholder="Search categories"
                placeholderTextColor="#98A2B3"
                className="h-11 flex-1 px-2 text-sm text-[#25332C]"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {categoryFilterSearch ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear category search"
                  onPress={() => setCategoryFilterSearch("")}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={18} color="#667085" />
                </Pressable>
              ) : null}
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {["All", ...categoryOptions]
                .filter((item) =>
                  item.toLowerCase().includes(categoryFilterSearch.trim().toLowerCase()),
                )
                .map((item) => {
                const active = selectedCategory === item;
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
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: active ? "800" : "600",
                        color: "#1E293B",
                      }}
                    >
                      {item}
                    </Text>
                    {active && (
                      <Ionicons name="checkmark" size={18} color="#1B4332" />
                    )}
                  </Pressable>
                );
              })}
              {categoryFilterSearch &&
              !["All", ...categoryOptions].some((item) =>
                item
                  .toLowerCase()
                  .includes(categoryFilterSearch.trim().toLowerCase()),
              ) ? (
                <Text className="py-6 text-center text-sm text-[#667085]">
                  No categories found
                </Text>
              ) : null}
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
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1, justifyContent: "flex-end" }}
          >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              paddingHorizontal: 20,
              paddingTop: 10,
              paddingBottom: insets.bottom + 4,
              height: "92%",
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
                  {editingExpenseId === null ? "Add Expense" : "Edit Expense"}
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

            <ScrollView
              style={{ flex: 1, minHeight: 0 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              keyboardDismissMode="none"
            >
              <FormField
                label="Expense title *"
                value={form.title}
                onChangeText={(text) =>
                  setForm((current) => ({ ...current, title: text }))
                }
                placeholder="e.g. Grocery, Petrol…"
              />

              <FormField
                label="Expense amount (₹) *"
                value={form.expense_amount}
                onChangeText={(text) =>
                  setForm((current) => ({ ...current, expense_amount: text }))
                }
                placeholder="0.00"
                keyboardType="decimal-pad"
              />

              <PopupSelect
                label="Transfer Amount"
                placeholder="Select Transfer Amount"
                options={transferAmountOptions}
                value={form.transfer_id}
                error={formErrors.transfer_amount}
                onChange={(transferId) => {
                  const selectedTransfer = transfers.find(
                    (transfer) => String(transfer.id) === transferId,
                  );

                  setFormErrors((current) => ({ ...current, transfer_amount: "" }));
                  setForm((current) => ({
                    ...current,
                    transfer_id: transferId,
                    transfer_amount: selectedTransfer
                      ? String(getTransferBalance(selectedTransfer))
                      : "",
                  }));
                }}
              />

              {Number(form.transfer_amount) > 0 ? (
                <View
                  style={{
                    marginBottom: 16,
                    padding: 14,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: "#E2E8F0",
                    backgroundColor: "#F8FAFC",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 8,
                      gap: 6,
                    }}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={15}
                      color="#64748B"
                    />
                    <Text
                      style={{
                        color: "#64748B",
                        fontSize: 11,
                        fontWeight: "800",
                        textTransform: "uppercase",
                      }}
                    >
                      Live calculation
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      paddingVertical: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: "#E2E8F0",
                    }}
                  >
                    <Text style={{ color: "#64748B", fontSize: 13 }}>
                      Selected transfer amount
                    </Text>
                    <Text style={{ color: "#D97706", fontWeight: "800" }}>
                      {formatAmount(Number(form.transfer_amount))}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      paddingVertical: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: "#E2E8F0",
                    }}
                  >
                    <Text style={{ color: "#64748B", fontSize: 13 }}>
                      Expense amount
                    </Text>
                    <Text style={{ color: "#E11D48", fontWeight: "800" }}>
                      {Number(form.expense_amount) > 0
                        ? `− ${formatAmount(Number(form.expense_amount))}`
                        : "Enter expense above"}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: 4,
                      paddingHorizontal: 10,
                      paddingVertical: 9,
                      borderRadius: 10,
                      backgroundColor:
                        Number(form.expense_amount) > 0 &&
                        Number(form.expense_amount) <=
                          Number(form.transfer_amount)
                          ? "#DCFCE7"
                          : Number(form.expense_amount) >
                              Number(form.transfer_amount)
                            ? "#FEE2E2"
                            : "#F1F5F9",
                    }}
                  >
                    <Text style={{ color: "#334155", fontWeight: "800" }}>
                      {Number(form.expense_amount) >
                      Number(form.transfer_amount)
                        ? "Over budget"
                        : "Remaining balance"}
                    </Text>
                    <Text
                      style={{
                        color:
                          Number(form.expense_amount) >
                          Number(form.transfer_amount)
                            ? "#DC2626"
                            : "#16A34A",
                        fontSize: 17,
                        fontWeight: "900",
                      }}
                    >
                      {formatAmount(
                        Number(form.transfer_amount) -
                          (Number(form.expense_amount) || 0),
                      )}
                    </Text>
                  </View>
                </View>
              ) : null}

              <PopupSelect
                label="Category"
                placeholder="Select Category"
                options={categoryOptions}
                value={form.category}
                error={formErrors.category}
                onChange={(item) => {
                  setFormErrors((current) => ({ ...current, category: "" }));
                  setForm((current) => ({
                    ...current,
                    category: item,
                    from: isTravelCategory(item) ? current.from : "",
                    to: isTravelCategory(item) ? current.to : "",
                  }));
                }}
              />

              {isTravelCategory(form.category) ? (
                <View style={{ marginBottom: 4 }}>
                  <FormField
                    label="From location"
                    value={form.from}
                    onChangeText={(text) =>
                      setForm((current) => ({ ...current, from: text }))
                    }
                    placeholder="Starting point"
                  />
                  <FormField
                    label="To location"
                    value={form.to}
                    onChangeText={(text) =>
                      setForm((current) => ({ ...current, to: text }))
                    }
                    placeholder="Destination"
                  />
                </View>
              ) : null}

              <PopupSelect
                label="Payment Type"
                placeholder="Select Payment Type"
                options={paymentTypeOptions}
                value={form.payment_method}
                error={formErrors.payment_method}
                onChange={(value) => {
                  setFormErrors((current) => ({ ...current, payment_method: "" }));
                  setForm((current) => ({ ...current, payment_method: value }));
                }}
              />

              <FormField
                label="Location"
                value={form.location}
                onChangeText={(text) =>
                  setForm((current) => ({
                    ...current,
                    location: text,
                  }))
                }
                placeholder="Where was this expense?"
              />

              <View>
                <DateTimePickerComponent
                  mode="datetime"
                  compact
                  value={parseLocalDateTime(form.date, form.time)}
                  onChange={(date) => {
                    if (!date) return;
                    setForm((current) => ({
                      ...current,
                      date: formatLocalDate(date),
                      time: formatLocalTime(date),
                    }));
                  }}
                  label="Date & Time"
                  placeholder="Select date and time"
                />
              </View>

              <FormField
                label="Notes"
                value={form.notes}
                onChangeText={(text) =>
                  setForm((current) => ({ ...current, notes: text }))
                }
                placeholder="Optional details…"
                multiline
              />

              <View style={{ marginBottom: 12 }}>
                <ModalSectionLabel label="Attachment / Receipt (Optional)" />
                <Pressable
                  onPress={() => void pickAttachment()}
                  style={{
                    minHeight: 46,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: Colors.sage,
                    borderRadius: 12,
                    backgroundColor: "#F4F8F5",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons
                    name="attach-outline"
                    size={19}
                    color={Colors.forest}
                  />
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color: Colors.forest,
                      fontWeight: "700",
                      textAlign: "center",
                    }}
                  >
                    {attachment?.name || "Choose an image or PDF receipt"}
                  </Text>
                  {attachment ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Remove receipt attachment"
                      hitSlop={8}
                      onPress={(event) => {
                        event.stopPropagation();
                        setAttachment(null);
                      }}
                    >
                      <Ionicons name="close-circle" size={19} color="#64748B" />
                    </Pressable>
                  ) : null}
                </Pressable>
              </View>
            </ScrollView>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                <Pressable
                  onPress={() => {
                    setIsModalVisible(false);
                    resetForm();
                  }}
                  disabled={saving}
                  style={{
                    flex: 1,
                    height: 54,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: "#CBD5E1",
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "#FFFFFF",
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: "#475569", fontWeight: "700" }}>
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleCreateExpense}
                  disabled={saving}
                  style={{
                    flex: 1.5,
                    borderRadius: 14,
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
                    {saving
                      ? editingExpenseId === null
                        ? "Saving…"
                        : "Updating…"
                      : editingExpenseId === null
                        ? "Save Expense"
                        : "Update Expense"}
                  </Text>
                </Pressable>
              </View>
          </View>
          </KeyboardAvoidingView>
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
                      }}
                    >
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
        flexGrow: 1,
        flexBasis: 145,
        minWidth: 145,
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
  return <FormLabel>{label}</FormLabel>;
}
