import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";
import api, { API_BASE_URL, getApiErrorMessage, logoutUser } from "../api";
import { AddButton } from "../components/AddButton";
import { AddPageHeader } from "../components/AddPageHeader";
import { CenteredPageLoader } from "../components/CenteredPageLoader";
import ConfirmPopup from "../components/ConfirmPopup";
import {
    createDateRangeSelection,
    isDateInRange,
    type DateRangeSelection,
} from "../components/DateRangeFilter";
import { DateTimePickerComponent } from "../components/DateTimePickerComponent";
import {
    formatLocalDate,
    parseLocalDate,
    parseLocalDateTimeValue,
} from "../components/dateTimeUtils";
import {
    countActiveFilters,
    DEFAULT_FILTER_STATE,
    type FilterState,
    type SortOption,
    type ViewModeOption,
} from "../components/filters";
import { FormInput, FormLabel, FormOption } from "../components/FormControls";
import { GradientSafeAreaView as SafeAreaView } from "../components/GradientSafeAreaView";
import { PopupSelect } from "../components/PopupSelect";
import { SearchBar } from "../components/SearchBar";
import { createSessionDataCache } from "../components/SessionDataCache";
import { useAddPageNavigation } from "../components/useAddPageNavigation";
import { Colors } from "../constants/colors";

type TransferRecord = {
  id: number | string;
  title: string;
  amount: number | string;
  total_expense?: number | string;
  category?: string;
  payment_method?: string;
  transfer_date?: string;
  time?: string;
  transfer_time?: string;
  source_income_id?: number | string | null;
  notes?: string;
  receipt?: string | null;
};

type IncomeRecord = {
  id: number | string;
  title: string;
  amount?: number | string;
  remaining_amount?: number | string;
};

type ExpenseRecord = {
  id: number | string;
  title?: string;
  category?: string;
  expense_amount?: number | string;
  amount?: number | string;
};

type TransfersData = {
  transfers: TransferRecord[];
  incomes: IncomeRecord[];
  expenses: ExpenseRecord[];
  categoryOptions: string[];
};

const transfersDataCache = createSessionDataCache<TransfersData>();

type TransferForm = {
  title: string;
  amount: string;
  paymentMethod: string;
  category: string;
  date: string;
  time: string;
  notes: string;
};

type PickedReceipt = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

const paymentMethods = ["Cash", "Bank Transfer", "UPI", "Card", "Other"];
const transferKeywords = [
  "transfer",
  "transfers",
  "budget transfer",
  "budgettransfer",
  "saving",
  "savings",
  "investment",
  "investments",
];

const transferFormStyles = StyleSheet.create({
  input: {
    minHeight: 52,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    color: "#25332C",
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: "top",
  },
});

function parseLocalTime(value?: string | null) {
  if (!value) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;

  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function emptyForm(): TransferForm {
  return {
    title: "",
    amount: "",
    paymentMethod: "Cash",
    category: "",
    date: formatLocalDate(new Date()),
    time: "09:00",
    notes: "",
  };
}

function getRows(data: any, key: string): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.[key])) return data.data[key];
  return [];
}

function formatAmount(value: number | string | undefined) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = parseLocalDate(value) ?? parseLocalDateTimeValue(value);
  if (!date) return String(value).split("T")[0];
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getReceiptUrl(receipt: string) {
  if (/^https?:\/\//i.test(receipt)) return receipt;
  return `${API_BASE_URL.replace(/\/api\/?$/, "")}${receipt.startsWith("/") ? "" : "/"}${receipt}`;
}

type MetricTone = "transfer" | "moved" | "spent" | "remaining";

const metricPalettes = {
  transfer: {
    background: "#FCFBFF",
    border: "#EBE6F8",
    icon: ["#B39AFF", "#7651E8"] as const,
    value: "#3224B8",
    caption: "#7F8792",
    waveBack: "#EEEAFE",
    waveFront: "#DDD7FF",
    accent: "#8664F3",
    badge: "#ECE8FF",
  },
  moved: {
    background: "#FFFCF6",
    border: "#F1E9D8",
    icon: ["#FFD360", "#F3A900"] as const,
    value: "#E36C00",
    caption: "#858B92",
    waveBack: "#FFF3D9",
    waveFront: "#FFE3A9",
    accent: "#F7B52C",
    badge: "#FFF0CD",
  },
  spent: {
    background: "#FFFAFA",
    border: "#F4E5E5",
    icon: ["#FF8787", "#EF4149"] as const,
    value: "#C51B20",
    caption: "#858B92",
    waveBack: "#FDEBEC",
    waveFront: "#F9D5D9",
    accent: "#EF6E7A",
    badge: "#FCE4E6",
  },
  remaining: {
    background: "#FBFFFC",
    border: "#E4F0E8",
    icon: ["#5BE49A", "#13A95C"] as const,
    value: "#0C4B2A",
    caption: "#858F91",
    waveBack: "#E3F6EA",
    waveFront: "#C9EED8",
    accent: "#48CC85",
    badge: "#E0F5E8",
  },
} as const;

function Metric({
  label,
  value,
  caption,
  tone,
  icon,
  cardWidth,
}: {
  label: string;
  value: string;
  caption: string;
  tone: MetricTone;
  icon: keyof typeof Ionicons.glyphMap;
  cardWidth: number;
}) {
  const palette = metricPalettes[tone];
  const iconSize = Math.min(40, Math.max(36, cardWidth * 0.14));
  const secondaryIconSize = Math.min(34, Math.max(28, cardWidth * 0.08));
  const cardHeight = 140;

  return (
    <View
      style={{
        width: cardWidth,
        height: cardHeight,
        paddingHorizontal: Math.min(18, Math.max(12, cardWidth * 0.04)),
        paddingVertical: 8,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: 24,
        backgroundColor: palette.background,
        shadowColor: "#26352A",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 4,
      }}
    >
      <Svg
        width="100%"
        height={cardHeight * 0.22}
        viewBox="0 0 320 100"
        preserveAspectRatio="none"
        pointerEvents="none"
        style={{ position: "absolute", left: 0, bottom: 0 }}
      >
        <Path
          d="M0 48 C48 34 70 76 122 60 C175 44 195 30 238 43 C271 53 294 59 320 47 L320 100 L0 100 Z"
          fill={palette.waveBack}
        />
        <Path
          d="M0 73 C55 58 86 91 137 77 C190 63 213 49 254 63 C282 72 301 80 320 70 L320 100 L0 100 Z"
          fill={palette.waveFront}
        />
      </Svg>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <LinearGradient
          colors={palette.icon}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: iconSize,
            height: iconSize,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: iconSize * 0.31,
          }}
        >
          <Ionicons name={icon} size={iconSize * 0.48} color="#FFFFFF" />
        </LinearGradient>
        <View
          style={{
            width: secondaryIconSize,
            height: secondaryIconSize,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: secondaryIconSize / 2,
            backgroundColor: palette.badge,
          }}
        >
          <Ionicons
            name="chevron-forward"
            size={secondaryIconSize * 0.58}
            color={palette.value}
          />
        </View>
      </View>
      <Text
        numberOfLines={1}
        style={{
          marginTop: 2,
          color: "#17221A",
          fontSize: Math.min(14, Math.max(12, cardWidth * 0.04)),
          lineHeight: Math.min(16, Math.max(14, cardWidth * 0.045)),
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
      <Text
        adjustsFontSizeToFit
        numberOfLines={1}
        style={{
          marginTop: 1,
          color: palette.value,
          fontSize: Math.min(30, Math.max(20, cardWidth * 0.075)),
          lineHeight: Math.min(32, Math.max(24, cardWidth * 0.082)),
          fontWeight: "900",
        }}
      >
        {value}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          maxWidth: "74%",
          marginTop: 1,
          color: palette.caption,
          fontSize: Math.min(11, Math.max(10, cardWidth * 0.027)),
          fontWeight: "500",
        }}
      >
        {caption}
      </Text>
      <Svg
        width={36}
        height={29}
        viewBox="0 0 40 32"
        pointerEvents="none"
        style={{ position: "absolute", right: 9, bottom: 9 }}
      >
        <Rect
          x={1}
          y={20}
          width={9}
          height={11}
          rx={3}
          fill={palette.accent}
          opacity={0.55}
        />
        <Rect
          x={14}
          y={13}
          width={9}
          height={18}
          rx={3}
          fill={palette.accent}
          opacity={0.68}
        />
        <Rect
          x={27}
          y={4}
          width={9}
          height={27}
          rx={3}
          fill={palette.accent}
          opacity={0.82}
        />
      </Svg>
    </View>
  );
}

export default function Transfers() {
  const router = useRouter();
  const pathname = usePathname();
  const isNewTransferRoute = pathname === "/transfers/new";
  const navigateToAddPage = useAddPageNavigation();
  const { form: rawForm, id: rawEditId } = useLocalSearchParams<{
    form?: string | string[];
    id?: string | string[];
  }>();
  const formParam = Array.isArray(rawForm) ? rawForm[0] : rawForm;
  const editId = Array.isArray(rawEditId) ? rawEditId[0] : rawEditId;
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [transfers, setTransfers] = useState<TransferRecord[]>(
    () => transfersDataCache.get()?.transfers ?? [],
  );
  const [incomes, setIncomes] = useState<IncomeRecord[]>(
    () => transfersDataCache.get()?.incomes ?? [],
  );
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(
    () => transfersDataCache.get()?.expenses ?? [],
  );
  const [categoryOptions, setCategoryOptions] = useState<string[]>(
    () => transfersDataCache.get()?.categoryOptions ?? [],
  );
  const [selectedIncomeId, setSelectedIncomeId] = useState("");
  const [selectedExpenseId, setSelectedExpenseId] = useState("");
  const [expensePickerVisible, setExpensePickerVisible] = useState(false);
  const [selectedTransfer, setSelectedTransfer] =
    useState<TransferRecord | null>(null);
  const [editingTransferId, setEditingTransferId] = useState<
    number | string | null
  >(null);
  const [form, setForm] = useState<TransferForm>(emptyForm);
  const [receipt, setReceipt] = useState<PickedReceipt | null>(null);
  const [existingReceipt, setExistingReceipt] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(isNewTransferRoute);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TransferRecord | null>(null);
  const [loading, setLoading] = useState(() => !transfersDataCache.hasData());
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Transfers");
  const [dateRange, setDateRange] = useState<DateRangeSelection>(() =>
    createDateRangeSelection("All"),
  );
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [sort, setSort] = useState<SortOption>(DEFAULT_FILTER_STATE.sort);
  const [viewMode, setViewMode] = useState<ViewModeOption>(
    DEFAULT_FILTER_STATE.viewMode,
  );
  const [deletingId, setDeletingId] = useState<number | string | null>(null);

  const handleUnauthorized = useCallback(async () => {
    await logoutUser();
    router.replace("/auth/login");
  }, [router]);

  const loadAll = useCallback(async (
    showLoading = !transfersDataCache.hasData(),
  ) => {
    if (showLoading && !transfersDataCache.hasData()) setLoading(true);
    try {
      const data = await transfersDataCache.load(async () => {
        const transferResponse = await api.get("/transfers");
        const [incomeResult, categoryResult, expensesResult] =
          await Promise.allSettled([
          api.get("/incomes"),
          api.get("/categories"),
          api.get("/expenses"),
        ]);
        for (const result of [incomeResult, categoryResult, expensesResult]) {
          if (
            result.status === "rejected" &&
            (result.reason as { status?: number })?.status === 401
          ) {
            throw result.reason;
          }
        }

        let categoryOptions: string[] = [];
        if (categoryResult.status === "fulfilled") {
          const categories = getRows(categoryResult.value.data, "categories");
          const filteredCategories = categories
            .filter((category: any) => {
              if (typeof category === "string") return false;
              const type = String(
                category?.catType ||
                  category?.type ||
                  category?.category_type ||
                  "",
              )
                .trim()
                .toLowerCase();
              const name = String(category?.name || "")
                .trim()
                .toLowerCase();
              return (
                type.includes("transfer") ||
                type.includes("saving") ||
                type.includes("investment") ||
                transferKeywords.some((keyword) => name.includes(keyword))
              );
            })
            .map((category: any) => String(category.name || "").trim())
            .filter(Boolean);
          categoryOptions = Array.from(new Set<string>(filteredCategories));
        }

        return {
          transfers: getRows(transferResponse.data, "transfers"),
          incomes:
            incomeResult.status === "fulfilled"
              ? getRows(incomeResult.value.data, "incomes")
              : [],
          expenses:
            expensesResult.status === "fulfilled"
              ? getRows(expensesResult.value.data, "expenses")
              : [],
          categoryOptions,
        };
      });
      setTransfers(data.transfers);
      setIncomes(data.incomes);
      setExpenses(data.expenses);
      setCategoryOptions(data.categoryOptions);
    } catch (error) {
      const status =
        (error as { status?: number; response?: { status?: number } })?.status ||
        (error as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        await handleUnauthorized();
        return;
      }
      Alert.alert("Unable to load transfers", getApiErrorMessage(error));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [handleUnauthorized]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAll(false);
    } finally {
      setRefreshing(false);
    }
  }, [loadAll]);

  useFocusEffect(
    useCallback(() => {
      void loadAll(!transfersDataCache.hasData());
    }, [loadAll]),
  );

  const selectedIncome = useMemo(
    () =>
      incomes.find(
        (income) => String(income.id) === String(selectedIncomeId),
      ) || null,
    [incomes, selectedIncomeId],
  );
  const editingTransfer = transfers.find(
    (transfer) => String(transfer.id) === String(editingTransferId),
  );
  const incomeBalance = Number(
    selectedIncome?.remaining_amount ?? selectedIncome?.amount ?? 0,
  );
  const balanceCredit =
    editingTransfer &&
    String(editingTransfer.source_income_id || "") === String(selectedIncomeId)
      ? Number(editingTransfer.amount || 0)
      : 0;
  const availableBalance = incomeBalance + balanceCredit;
  const transferAmount = Number(form.amount || 0);
  const remainingAfterTransfer = selectedIncome
    ? Math.max(availableBalance - transferAmount, 0)
    : 0;

  const totalTransferred = transfers.reduce(
    (sum, transfer) => sum + Number(transfer.amount || 0),
    0,
  );
  const totalExpense = transfers.reduce(
    (sum, transfer) => sum + Number(transfer.total_expense || 0),
    0,
  );
  const totalRemaining = transfers.reduce(
    (sum, transfer) =>
      sum +
      Math.max(
        Number(transfer.amount || 0) - Number(transfer.total_expense || 0),
        0,
      ),
    0,
  );
  const metricCardWidth = Math.min(500, (screenWidth - 36 - 14) / 2);

  const filterValues = useMemo<FilterState>(
    () => ({
      ...DEFAULT_FILTER_STATE,
      dateRange,
      category: categoryFilter === "All Transfers" ? "" : categoryFilter,
      amountMin,
      amountMax,
      sort,
      viewMode,
    }),
    [dateRange, categoryFilter, amountMin, amountMax, sort, viewMode],
  );

  const applyTransferFilters = (filters: FilterState) => {
    setDateRange(filters.dateRange);
    setCategoryFilter(filters.category || "All Transfers");
    setAmountMin(filters.amountMin);
    setAmountMax(filters.amountMax);
    setSort(filters.sort);
    setViewMode(filters.viewMode);
  };

  const visibleTransfers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = transfers.filter((transfer) => {
      const searchable =
        `${transfer.title || ""} ${transfer.category || ""}`.toLowerCase();
      const matchesSearch = !query || searchable.includes(query);
      const matchesCategory =
        categoryFilter === "All Transfers" ||
        transfer.category === categoryFilter;
      const matchesDate = isDateInRange(transfer.transfer_date, dateRange);
      const amount = Number(transfer.amount || 0);
      const matchesMin = amountMin === "" || amount >= Number(amountMin);
      const matchesMax = amountMax === "" || amount <= Number(amountMax);
      return (
        matchesSearch &&
        matchesCategory &&
        matchesDate &&
        matchesMin &&
        matchesMax
      );
    });
    return filtered.sort((left, right) => {
      const leftAmount = Number(left.amount || 0);
      const rightAmount = Number(right.amount || 0);
      const leftDate = parseLocalDate(left.transfer_date)?.getTime() || 0;
      const rightDate = parseLocalDate(right.transfer_date)?.getTime() || 0;
      if (sort === "Oldest First") return leftDate - rightDate;
      if (sort === "Amount: High to Low") return rightAmount - leftAmount;
      if (sort === "Amount: Low to High") return leftAmount - rightAmount;
      return rightDate - leftDate;
    });
  }, [
    transfers,
    search,
    categoryFilter,
    dateRange,
    amountMin,
    amountMax,
    sort,
  ]);
  const updateForm = <K extends keyof TransferForm>(
    key: K,
    value: TransferForm[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const closeModal = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (isNewTransferRoute) {
      router.replace("/transfers");
      return;
    }
    setModalVisible(false);
    setSelectedIncomeId("");
    setSelectedExpenseId("");
    setExpensePickerVisible(false);
    setEditingTransferId(null);
    setExistingReceipt(null);
    setReceipt(null);
    setForm(emptyForm());
  };

  const openAddTransfer = useCallback(() => {
    setSelectedIncomeId("");
    setSelectedExpenseId("");
    setExpensePickerVisible(false);
    setEditingTransferId(null);
    setExistingReceipt(null);
    setReceipt(null);
    setForm(emptyForm());
    setModalVisible(true);
  }, []);

  const openEditTransfer = useCallback((transfer: TransferRecord) => {
    setSelectedTransfer(null);
    setSelectedExpenseId("");
    setExpensePickerVisible(false);
    setEditingTransferId(transfer.id);
    setExistingReceipt(transfer.receipt || null);
    setSelectedIncomeId(
      transfer.source_income_id ? String(transfer.source_income_id) : "",
    );
    setReceipt(null);
    setForm({
      title: transfer.title || "",
      amount: String(transfer.amount ?? ""),
      paymentMethod: transfer.payment_method || "Cash",
      category: transfer.category || "",
      date: transfer.transfer_date
        ? String(transfer.transfer_date).split("T")[0]
        : emptyForm().date,
      time: transfer.time || transfer.transfer_time || "09:00",
      notes: transfer.notes || "",
    });
    setModalVisible(true);
  }, []);

  useEffect(() => {
    if (isNewTransferRoute) return;
    if (formParam === "new") {
      const timeout = setTimeout(openAddTransfer, 0);
      router.setParams({ form: undefined });
      return () => clearTimeout(timeout);
    }
    if (formParam !== "edit" || !editId || loading) return;
    const transfer = transfers.find((item) => String(item.id) === editId);
    if (!transfer) {
      Alert.alert("Transfer not found", "This transfer is no longer available.");
      if (router.canGoBack()) router.back();
      return;
    }
    const timeout = setTimeout(() => openEditTransfer(transfer), 0);
    router.setParams({ form: undefined, id: undefined });
    return () => clearTimeout(timeout);
  }, [editId, formParam, isNewTransferRoute, loading, openAddTransfer, openEditTransfer, router, transfers]);

  const pickReceipt = async () => {
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
      setReceipt({
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType || "application/octet-stream",
        size: file.size,
      });
    } catch (error) {
      Alert.alert("Unable to select receipt", getApiErrorMessage(error));
    }
  };

  const submitTransfer = async () => {
    const isEditing = editingTransferId !== null;
    const title = form.title.trim();
    const category = form.category.trim();
    const amount = Number(form.amount);
    if (
      !title ||
      !category ||
      !form.date ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      Alert.alert(
        "Check transfer details",
        "Enter a title, category, date, and an amount greater than zero.",
      );
      return;
    }
    if (selectedIncome && amount > availableBalance) {
      Alert.alert(
        "Insufficient income balance",
        `Available: ${formatAmount(availableBalance)}`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append("title", title);
      payload.append("amount", String(amount));
      payload.append("category", category);
      payload.append("paymentMethod", form.paymentMethod);
      payload.append("date", form.date);
      payload.append("time", form.time);
      payload.append("notes", form.notes);
      payload.append(
        "sourceIncomeId",
        selectedIncome ? String(selectedIncome.id) : "",
      );
      if (receipt) {
        payload.append("receipt", {
          uri: receipt.uri,
          name: receipt.name,
          type: receipt.mimeType,
        } as any);
      }

      if (editingTransferId !== null) {
        await api.put(`/transfers/${editingTransferId}`, payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post("/transfers", payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      await loadAll();
      Alert.alert(
        "Saved",
        isEditing
          ? "Transfer updated successfully."
          : "Transfer added successfully.",
      );
      if (router.canGoBack()) router.back();
      else closeModal();
    } catch (error) {
      if ((error as { status?: number })?.status === 401) {
        await handleUnauthorized();
        return;
      }
      Alert.alert(
        "Unable to save transfer",
        getApiErrorMessage(error, "Transfer failed."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const deleteTransfer = (transfer: TransferRecord) => {
    setPendingDelete(transfer);
  };

  const confirmDeleteTransfer = async () => {
    if (!pendingDelete) return;
    const transfer = pendingDelete;
    setPendingDelete(null);
    setDeletingId(transfer.id);
    try {
      await api.delete(`/transfers/${transfer.id}`);
      setTransfers((current) =>
        current.filter((item) => item.id !== transfer.id),
      );
      if (selectedTransfer?.id === transfer.id) setSelectedTransfer(null);
    } catch (error) {
      if ((error as { status?: number })?.status === 401) {
        await handleUnauthorized();
        return;
      }
      Alert.alert("Unable to delete transfer", getApiErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  const openReceipt = async (path: string) => {
    try {
      await Linking.openURL(getReceiptUrl(path));
    } catch {
      Alert.alert("Unable to open receipt", "No app could open this file.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F2F5EA]" edges={["bottom"]}>
      <ConfirmPopup
        visible={pendingDelete !== null}
        type="delete"
        message="Any linked expenses will keep their data."
        onConfirm={confirmDeleteTransfer}
        onCancel={() => setPendingDelete(null)}
        loading={pendingDelete !== null && deletingId === pendingDelete.id}
      />
      <ConfirmPopup
        visible={successMessage !== null}
        type="success"
        message={successMessage ?? ""}
        onConfirm={() => setSuccessMessage(null)}
      />
      <LinearGradient
        colors={Colors.greenGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          display: isNewTransferRoute ? "none" : "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingHorizontal: 16,
          paddingBottom: 16,
          paddingTop: insets.top + 8,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="h-10 w-10 items-center justify-center rounded-full bg-white/15"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/tabs/more");
          }}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.white} />
        </Pressable>
        <Text className="ml-3 text-lg font-bold text-white">Transfers</Text>
      </LinearGradient>

      {isNewTransferRoute ? null : loading ? (
        <CenteredPageLoader message="Loading transfers..." />
      ) : (
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              if (!loading) void refreshAll();
            }}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 140,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: 14,
            paddingTop: 24,
            paddingBottom: 16,
          }}
        >
          <Metric
            label="Transfer"
            value={String(transfers.length)}
            caption="All records"
            tone="transfer"
            icon="swap-horizontal-outline"
            cardWidth={metricCardWidth}
          />
          <Metric
            label="Moved"
            value={formatAmount(totalTransferred)}
            caption="Total amount moved"
            tone="moved"
            icon="paper-plane-outline"
            cardWidth={metricCardWidth}
          />
          <Metric
            label="Spend"
            value={formatAmount(totalExpense)}
            caption="Total amount spent"
            tone="spent"
            icon="cart-outline"
            cardWidth={metricCardWidth}
          />
          <Metric
            label="Remaining"
            value={formatAmount(totalRemaining)}
            caption="Available balance"
            tone="remaining"
            icon="wallet-outline"
            cardWidth={metricCardWidth}
          />
        </View>

       

        <SearchBar
          value={search}
          onChangeText={(value) => {
            setSearch(value);
          }}
          placeholder="Search title or category"
          activeFilterCount={countActiveFilters(filterValues)}
          filterSheet={{
            currentFilters: filterValues,
            onApply: applyTransferFilters,
            categories: categoryOptions,
            sections: ["date", "category", "amount", "sort", "viewMode"],
          }}
          style={{ marginBottom: 12 }}
        />

        {visibleTransfers.length === 0 ? (
          <View className="items-center rounded-2xl border border-[#E4E8E3] bg-white px-5 py-10">
            <View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-[#EEF5F0]">
              <Ionicons name="swap-horizontal-outline" size={26} color="#315640" />
            </View>
            <Text className="text-base font-bold text-[#293930]">
              No transfers found
            </Text>
            <Text className="mt-1 text-center text-xs text-[#859087]">
              Try changing your search or filters.
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
                    rowGap: 8,
                  }
                : { gap: 8 }
            }
          >
            {visibleTransfers.map((transfer) => (
              <View
                key={String(transfer.id)}
                style={{
                  width: viewMode === "card" ? "48.5%" : "100%",
                  borderRadius: viewMode === "card" ? 16 : 10,
                  borderWidth: 1,
                  borderColor: "#E4E8E3",
                  backgroundColor: "#FFFFFF",
                  padding: 10,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View details for ${transfer.title || "transfer"}`}
                  onPress={() => setSelectedTransfer(transfer)}
                >
                  <View
                    style={{
                      flexDirection: viewMode === "card" ? "column" : "row",
                      alignItems: viewMode === "card" ? "stretch" : "center",
                    }}
                  >
                    <View
                      className="items-center justify-center rounded-xl bg-[#EEF5F0]"
                      style={{
                        alignSelf: "flex-start",
                        width: viewMode === "card" ? 36 : 44,
                        height: viewMode === "card" ? 36 : 44,
                      }}
                    >
                      <Ionicons
                        name="swap-horizontal-outline"
                        size={viewMode === "card" ? 18 : 21}
                        color="#315640"
                      />
                    </View>
                    <View
                      style={{
                        minWidth: 0,
                        flex: 1,
                        marginLeft: viewMode === "card" ? 0 : 12,
                        marginTop: viewMode === "card" ? 6 : 0,
                      }}
                    >
                      <Text
                        className="text-sm font-bold text-[#293930]"
                        numberOfLines={1}
                      >
                        {transfer.title || "Untitled transfer"}
                      </Text>
                      <Text
                        className="mt-1 text-xs text-[#859087]"
                        numberOfLines={1}
                      >
                        {transfer.category || "Uncategorized"}
                      </Text>
                    </View>
                    <Text
                      className="text-base font-extrabold text-[#315640]"
                      style={{
                        marginLeft: viewMode === "card" ? 0 : 8,
                        marginTop: viewMode === "card" ? 4 : 0,
                        alignSelf:
                          viewMode === "card" ? "flex-start" : undefined,
                      }}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {formatAmount(transfer.amount)}
                    </Text>
                  </View>
                  <View
                    style={{
                      marginTop: viewMode === "card" ? 8 : 12,
                      paddingTop: 8,
                      borderTopWidth: 1,
                      borderTopColor: "#EEF1EE",
                      flexDirection: viewMode === "card" ? "column" : "row",
                      alignItems: viewMode === "card" ? "stretch" : "center",
                      gap: 6,
                    }}
                  >
                    <View className="flex-row items-center">
                      <Ionicons
                        name="calendar-outline"
                        size={14}
                        color="#87918A"
                      />
                      <Text className="ml-1.5 text-xs text-[#6F7B73]">
                        {formatDate(transfer.transfer_date)}
                      </Text>
                    </View>
                    <Text
                      className="text-xs font-medium text-[#6F7B73]"
                      numberOfLines={1}
                    >
                      {transfer.payment_method || "-"}
                    </Text>
                  </View>
                </Pressable>
                <View
                  className="flex-row justify-end gap-1"
                  style={{ marginTop: viewMode === "card" ? 8 : 12 }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View details for ${transfer.title || "transfer"}`}
                    onPress={() => setSelectedTransfer(transfer)}
                    className="h-8 w-8 items-center justify-center rounded-lg bg-[#EEF5F0]"
                  >
                    <Ionicons name="eye-outline" size={16} color="#315640" />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${transfer.title || "transfer"}`}
                    onPress={() =>
                      router.push({
                        pathname: "/transfers",
                        params: { form: "edit", id: String(transfer.id) },
                      })
                    }
                    className="h-8 w-8 items-center justify-center rounded-lg bg-[#EEF5F0]"
                  >
                    <Ionicons name="create-outline" size={17} color="#315640" />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${transfer.title || "transfer"}`}
                    disabled={deletingId === transfer.id}
                    onPress={() => deleteTransfer(transfer)}
                    className="h-8 w-8 items-center justify-center rounded-lg bg-[#FFF1EF]"
                  >
                    <Ionicons
                      name={deletingId === transfer.id ? "hourglass-outline" : "trash-outline"}
                      size={16}
                      color="#D94A43"
                    />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
      )}

      {!isNewTransferRoute && (
        <AddButton
          onPress={() => navigateToAddPage("/transfers/new")}
          accessibilityLabel="Add transfer"
          accessibilityHint="Opens the new transfer form"
          bottomOffset={37}
        />
      )}

      {modalVisible && (
        <View
          className={isNewTransferRoute ? "flex-1 bg-[#F8F9F6]" : "absolute inset-0 z-50 bg-[#F8F9F6]"}
          style={{ paddingBottom: insets.bottom }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={0}
            style={{ flex: 1 }}
          >
            <View
              className="flex-1 bg-[#F8F9F6] px-5 pb-5"
            >
            <AddPageHeader
              title={
                editingTransferId !== null
                  ? "Edit Transfer"
                  : "Add New Transfer"
              }
              subtitle="Move income into a budget or savings category"
              onBack={closeModal}
            />

            <ScrollView
              style={{ flex: 1, minHeight: 0 }}
              contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              automaticallyAdjustKeyboardInsets
              keyboardDismissMode="interactive"
              bounces={true}
            >
              <View className="mb-4">
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-xs font-bold uppercase tracking-[0.8px] text-[#7B8589]">
                    Transfer amount ₹
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setSelectedExpenseId("");
                      setExpensePickerVisible(false);
                    }}
                  >
                    <Text className="text-xs font-bold text-[#315640]">
                      Enter manually →
                    </Text>
                  </Pressable>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose an expense to fill the transfer amount"
                  accessibilityState={{ expanded: expensePickerVisible }}
                  className="h-12 flex-row items-center justify-between rounded-xl border border-[#E5EAE7] bg-white px-4"
                  onPress={() => setExpensePickerVisible((visible) => !visible)}
                >
                  <Text
                    className="mr-3 flex-1 text-sm font-semibold text-[#293930]"
                    numberOfLines={1}
                  >
                    {selectedExpenseId
                      ? (() => {
                          const selectedExpense = expenses.find(
                            (expense) =>
                              String(expense.id) === selectedExpenseId,
                          );
                          return selectedExpense
                            ? `${selectedExpense.title || selectedExpense.category || `Expense ${selectedExpense.id}`} — ${formatAmount(selectedExpense.expense_amount ?? selectedExpense.amount)}`
                            : "— No transfer / select record —";
                        })()
                      : "— No transfer / select record —"}
                  </Text>
                  <Ionicons
                    name={expensePickerVisible ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#526058"
                  />
                </Pressable>
                {expensePickerVisible && (
                  <View className="mt-1 max-h-56 rounded-xl border border-[#E5EAE7] bg-white p-1">
                    <ScrollView nestedScrollEnabled>
                      {expenses.length > 0 ? (
                        expenses.map((expense) => {
                          const selected =
                            String(expense.id) === selectedExpenseId;
                          return (
                            <FormOption
                              key={expense.id}
                              selected={selected}
                              className={`min-h-10 flex-row items-center rounded-lg px-3 py-2 ${selected ? "bg-[#E7F0E8]" : "bg-white"}`}
                              onPress={() => {
                                const amount = Number(
                                  expense.expense_amount ?? expense.amount ?? 0,
                                );
                                setSelectedExpenseId(String(expense.id));
                                updateForm("amount", String(amount));
                                setExpensePickerVisible(false);
                              }}
                            >
                              <Text
                                className="mr-3 flex-1 text-sm text-[#293930]"
                                numberOfLines={1}
                              >
                                {expense.title ||
                                  expense.category ||
                                  `Expense ${expense.id}`}
                              </Text>
                              <Text className="text-sm font-semibold text-[#526058]">
                                {formatAmount(
                                  expense.expense_amount ?? expense.amount,
                                )}
                              </Text>
                            </FormOption>
                          );
                        })
                      ) : (
                        <Text className="px-3 py-4 text-sm text-[#7B8589]">
                          No expenses available.
                        </Text>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              <FormLabel>Source Income (Optional)</FormLabel>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 14 }}
              >
                <FormOption
                  selected={!selectedIncomeId}
                  className={`w-[150px] rounded-xl p-3 ${!selectedIncomeId ? "bg-[#E7F0E8]" : "bg-white"}`}
                  onPress={() => {
                    setSelectedIncomeId("");
                    setForm((current) => ({ ...current, amount: "" }));
                  }}
                >
                  <FormLabel inline>
                    No Source
                  </FormLabel>
                  <Text className="mt-1 text-xs text-[#818D84]">
                    Unlinked Transfer
                  </Text>
                </FormOption>
                {incomes.map((income) => {
                  const selected =
                    String(income.id) === String(selectedIncomeId);
                  return (
                    <FormOption
                      key={income.id}
                      selected={selected}
                      className={`w-[180px] rounded-xl p-3 ${selected ? "bg-[#E7F0E8]" : "bg-white"}`}
                      onPress={() => {
                        setSelectedIncomeId(String(income.id));
                        setForm((current) => ({ ...current, amount: "" }));
                      }}
                    >
                      <FormLabel inline>
                        {income.title}
                      </FormLabel>
                      <Text className="mt-1 text-xs text-[#818D84]">
                        {formatAmount(income.remaining_amount ?? income.amount)}{" "}
                        available
                      </Text>
                    </FormOption>
                  );
                })}
              </ScrollView>
              {selectedIncome && (
                <View className="mb-4 flex-row justify-between rounded-xl bg-[#EFF7F1] px-3 py-2.5">
                  <Text className="text-xs font-semibold text-[#617367]">
                    Available {formatAmount(availableBalance)}
                  </Text>
                  <Text className="text-xs font-bold text-[#25805A]">
                    After transfer {formatAmount(remainingAfterTransfer)}
                  </Text>
                </View>
              )}
              {incomes.length === 0 && (
                <Pressable
                  accessibilityRole="button"
                  className="mb-4 flex-row items-center self-start"
                  onPress={() => {
                    closeModal();
                    router.push("/income");
                  }}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={16}
                    color="#315640"
                  />
                  <Text className="ml-1 text-xs font-bold text-[#315640]">
                    Add income record
                  </Text>
                </Pressable>
              )}

              <FormLabel>Transfer title *</FormLabel>
              <FormInput
                accessibilityLabel="Transfer title, required"
                autoCapitalize="sentences"
                borderColor="#AAB8AE"
                maxLength={100}
                placeholder="e.g. Monthly savings"
                returnKeyType="next"
                style={transferFormStyles.input}
                value={form.title}
                onChangeText={(value) => updateForm("title", value)}
              />

              <FormLabel>Amount *</FormLabel>
              <FormInput
                accessibilityLabel="Transfer amount, required"
                borderColor="#AAB8AE"
                keyboardType="decimal-pad"
                placeholder="0.00"
                returnKeyType="done"
                style={transferFormStyles.input}
                value={form.amount}
                onChangeText={(value) => updateForm("amount", value)}
              />

              <View className="flex-row gap-3">
                <View className="min-w-0 flex-1">
                  <DateTimePickerComponent
                    mode="date"
                    value={parseLocalDate(form.date)}
                    onChange={(date) => {
                      if (date) updateForm("date", formatLocalDate(date));
                    }}
                    label="Date"
                    placeholder="Select date"
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <DateTimePickerComponent
                    mode="time"
                    value={parseLocalTime(form.time)}
                    onChange={(date) => {
                      if (date) {
                        const formatted = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
                        updateForm("time", formatted);
                      }
                    }}
                    label="Time"
                    placeholder="Select time"
                  />
                </View>
              </View>

              <PopupSelect
                label="Category"
                placeholder="Select Category"
                required
                options={
                  form.category && !categoryOptions.includes(form.category)
                    ? [...categoryOptions, form.category]
                    : categoryOptions
                }
                value={form.category}
                loading={loading && categoryOptions.length === 0}
                onChange={(value) => updateForm("category", value)}
              />

              <PopupSelect
                label="Payment Method"
                placeholder="Select payment method"
                options={paymentMethods}
                value={form.paymentMethod}
                onChange={(value) => updateForm("paymentMethod", value)}
              />

              <FormLabel>Notes</FormLabel>
              <FormInput
                accessibilityLabel="Transfer notes"
                borderColor="#AAB8AE"
                multiline
                placeholder="Add any useful details"
                style={[transferFormStyles.input, transferFormStyles.multilineInput]}
                value={form.notes}
                onChangeText={(value) => updateForm("notes", value)}
              />

              <FormLabel>Receipt</FormLabel>
              {existingReceipt && !receipt && (
                <Pressable
                  className="mb-2 flex-row items-center rounded-xl border border-[#DDE5DD] bg-white p-3"
                  onPress={() => void openReceipt(existingReceipt)}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={19}
                    color="#426C92"
                  />
                  <Text
                    className="ml-2 flex-1 text-xs font-semibold text-[#526058]"
                    numberOfLines={1}
                  >
                    Current receipt · tap to open
                  </Text>
                  <Ionicons name="open-outline" size={16} color="#7B8580" />
                </Pressable>
              )}
              <View className="mb-5 flex-row items-center rounded-xl border border-dashed border-[#BEC9BF] bg-white px-4 py-3">
                <Pressable
                  accessibilityRole="button"
                  className="min-w-0 flex-1 flex-row items-center"
                  onPress={() => void pickReceipt()}
                >
                  <Ionicons
                    name="cloud-upload-outline"
                    size={19}
                    color="#426C62"
                  />
                  <Text
                    className="ml-2 flex-1 text-xs font-semibold text-[#59675F]"
                    numberOfLines={1}
                  >
                    {receipt?.name || "Choose image or PDF"}
                  </Text>
                </Pressable>
                {receipt && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Remove selected receipt"
                    className="ml-2 p-1"
                    onPress={() => setReceipt(null)}
                  >
                    <Ionicons name="close-circle" size={19} color="#B64C45" />
                  </Pressable>
                )}
              </View>
            </ScrollView>

            <View className="flex-row gap-3 pt-3">
              <Pressable
                className="flex-1 items-center rounded-xl border border-[#DDE3DC] bg-white py-3.5"
                disabled={submitting}
                onPress={closeModal}
              >
                <Text className="text-sm font-bold text-[#58645C]">Cancel</Text>
              </Pressable>
              <Pressable
                className="flex-1 flex-row items-center justify-center rounded-xl bg-[#315640] py-3.5"
                disabled={submitting}
                onPress={() => void submitTransfer()}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-sm font-bold text-white">
                    {editingTransferId !== null
                      ? "Save changes"
                      : "Save transfer"}
                  </Text>
                )}
              </Pressable>
            </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      <Modal
        animationType="slide"
        onRequestClose={() => setSelectedTransfer(null)}
        transparent
        visible={!!selectedTransfer}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-[26px] bg-[#F8F9F6] px-5 pb-9 pt-5">
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-xs font-bold uppercase tracking-[1px] text-[#818B84]">
                  Transfer details
                </Text>
                <Text
                  className="mt-1 text-xl font-bold text-[#25332C]"
                  numberOfLines={1}
                >
                  {selectedTransfer?.title}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close transfer details"
                className="h-9 w-9 items-center justify-center rounded-full bg-white"
                onPress={() => setSelectedTransfer(null)}
              >
                <Ionicons name="close" size={20} color="#526058" />
              </Pressable>
            </View>
            <View className="mb-3 flex-row gap-3">
              <View className="flex-1 rounded-xl bg-white p-3">
                <Text className="text-xs font-bold uppercase text-[#87918A]">
                  Amount
                </Text>
                <Text className="mt-1 text-sm font-extrabold text-[#293930]">
                  {formatAmount(selectedTransfer?.amount)}
                </Text>
              </View>
              <View className="flex-1 rounded-xl bg-white p-3">
                <Text className="text-xs font-bold uppercase text-[#87918A]">
                  Category
                </Text>
                <Text className="mt-1 text-sm font-bold text-[#293930]">
                  {selectedTransfer?.category || "-"}
                </Text>
              </View>
            </View>
            <View className="mb-3 flex-row gap-3">
              <View className="flex-1 rounded-xl bg-white p-3">
                <Text className="text-xs font-bold uppercase text-[#87918A]">
                  Date
                </Text>
                <Text className="mt-1 text-sm font-bold text-[#293930]">
                  {formatDate(selectedTransfer?.transfer_date)}
                </Text>
              </View>
              <View className="flex-1 rounded-xl bg-white p-3">
                <Text className="text-xs font-bold uppercase text-[#87918A]">
                  Payment
                </Text>
                <Text className="mt-1 text-sm font-bold text-[#293930]">
                  {selectedTransfer?.payment_method || "-"}
                </Text>
              </View>
            </View>
            {!!selectedTransfer?.notes && (
              <View className="mb-3 rounded-xl bg-white p-3">
                <Text className="text-xs font-bold uppercase text-[#87918A]">
                  Notes
                </Text>
                <Text className="mt-1 text-sm leading-5 text-[#526058]">
                  {selectedTransfer.notes}
                </Text>
              </View>
            )}
            {!!selectedTransfer?.receipt && (
              <Pressable
                className="flex-row items-center justify-center rounded-xl bg-[#315640] py-3.5"
                onPress={() => void openReceipt(selectedTransfer.receipt!)}
              >
                <Ionicons name="open-outline" size={17} color="#FFFFFF" />
                <Text className="ml-2 text-sm font-bold text-white">
                  Open receipt
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
