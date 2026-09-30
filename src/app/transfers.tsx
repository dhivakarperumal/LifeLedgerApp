import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api, { API_BASE_URL, getApiErrorMessage, logoutUser } from "../api";
import { AddButton } from "../components/AddButton";
import {
    createDateRangeSelection,
    DateRangeFilter,
    isDateInRange,
    type DateRangeSelection,
} from "../components/DateRangeFilter";
import { FormInput, FormOption } from "../components/FormControls";
import { GradientSafeAreaView as SafeAreaView } from "../components/GradientSafeAreaView";
import { Colors } from "../constants/colors";

type TransferRecord = {
  id: number | string;
  title: string;
  amount: number | string;
  total_expense?: number | string;
  category?: string;
  payment_method?: string;
  transfer_date?: string;
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

type TransferForm = {
  title: string;
  amount: string;
  paymentMethod: string;
  category: string;
  date: string;
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
const pageSize = 10;

function emptyForm(): TransferForm {
  return {
    title: "",
    amount: "",
    paymentMethod: "Cash",
    category: "",
    date: new Date().toISOString().slice(0, 10),
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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).split("T")[0];
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

function Metric({
  label,
  value,
  caption,
  background,
  valueColor,
}: {
  label: string;
  value: string;
  caption: string;
  background: string;
  valueColor: string;
}) {
  return (
    <View
      className={`mb-3 min-h-[104px] flex-1 rounded-2xl border border-[#E4E8E3] p-3.5 ${background}`}
    >
      <Text className="text-xs font-bold uppercase tracking-[0.8px] text-[#7C8880]">
        {label}
      </Text>
      <Text
        className={`mt-2 text-lg font-extrabold ${valueColor}`}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text
        className="mt-1 text-xs font-medium text-[#818D84]"
        numberOfLines={1}
      >
        {caption}
      </Text>
    </View>
  );
}

export default function Transfers() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
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
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Transfers");
  const [dateRange, setDateRange] = useState<DateRangeSelection>(() =>
    createDateRangeSelection("All"),
  );
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingId, setDeletingId] = useState<number | string | null>(null);

  const handleUnauthorized = useCallback(async () => {
    await logoutUser();
    router.replace("/auth/login");
  }, [router]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const transferResponse = await api.get("/transfers");
      setTransfers(getRows(transferResponse.data, "transfers"));

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
          await handleUnauthorized();
          return;
        }
      }

      if (incomeResult.status === "fulfilled") {
        setIncomes(getRows(incomeResult.value.data, "incomes"));
      } else {
        setIncomes([]);
      }

      if (expensesResult.status === "fulfilled") {
        setExpenses(getRows(expensesResult.value.data, "expenses"));
      } else {
        setExpenses([]);
      }

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
        setCategoryOptions(Array.from(new Set<string>(filteredCategories)));
      } else {
        setCategoryOptions([]);
      }
    } catch (error) {
      if ((error as { status?: number })?.status === 401) {
        await handleUnauthorized();
        return;
      }
      Alert.alert("Unable to load transfers", getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      void loadAll();
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

  const visibleTransfers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transfers.filter((transfer) => {
      const searchable =
        `${transfer.title || ""} ${transfer.category || ""}`.toLowerCase();
      const matchesSearch = !query || searchable.includes(query);
      const matchesCategory =
        categoryFilter === "All Transfers" ||
        transfer.category === categoryFilter;
      const matchesDate = isDateInRange(transfer.transfer_date, dateRange);
      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [transfers, search, categoryFilter, dateRange]);
  const totalPages = Math.max(1, Math.ceil(visibleTransfers.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageTransfers = visibleTransfers.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize,
  );

  const updateForm = <K extends keyof TransferForm>(
    key: K,
    value: TransferForm[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const closeModal = () => {
    setModalVisible(false);
    setSelectedIncomeId("");
    setSelectedExpenseId("");
    setExpensePickerVisible(false);
    setEditingTransferId(null);
    setExistingReceipt(null);
    setReceipt(null);
    setForm(emptyForm());
  };

  const openAddTransfer = () => {
    setSelectedIncomeId("");
    setSelectedExpenseId("");
    setExpensePickerVisible(false);
    setEditingTransferId(null);
    setExistingReceipt(null);
    setReceipt(null);
    setForm(emptyForm());
    setModalVisible(true);
  };

  const openEditTransfer = (transfer: TransferRecord) => {
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
      notes: transfer.notes || "",
    });
    setModalVisible(true);
  };

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
      closeModal();
      setCurrentPage(1);
      await loadAll();
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
    Alert.alert(
      "Delete transfer?",
      "Any linked expenses will keep their data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setDeletingId(transfer.id);
            void api
              .delete(`/transfers/${transfer.id}`)
              .then(() => {
                setTransfers((current) =>
                  current.filter((item) => item.id !== transfer.id),
                );
                setCurrentPage(1);
                if (selectedTransfer?.id === transfer.id) {
                  setSelectedTransfer(null);
                }
              })
              .catch(async (error) => {
                if ((error as { status?: number })?.status === 401) {
                  await handleUnauthorized();
                  return;
                }
                Alert.alert(
                  "Unable to delete transfer",
                  getApiErrorMessage(error),
                );
              })
              .finally(() => setDeletingId(null));
          },
        },
      ],
    );
  };

  const openReceipt = async (path: string) => {
    try {
      await Linking.openURL(getReceiptUrl(path));
    } catch {
      Alert.alert("Unable to open receipt", "No app could open this file.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F5F6F2]" edges={["bottom"]}>
      <LinearGradient
        colors={Colors.greenGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingHorizontal: 20,
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void loadAll()}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingBottom: insets.bottom + 140,
        }}
      >
        <View className="flex-row mt-6 gap-3">
          <Metric
            label="Transfers"
            value={String(transfers.length)}
            caption="All records"
            background="bg-[#315640]"
            valueColor="text-white"
          />
          <Metric
            label="Moved"
            value={formatAmount(totalTransferred)}
            caption="Amount transferred"
            background="bg-white"
            valueColor="text-[#293930]"
          />
        </View>
        <View className="flex-row gap-3">
          <Metric
            label="Spent"
            value={formatAmount(totalExpense)}
            caption="Expense from transfers"
            background="bg-[#FFF4F1]"
            valueColor="text-[#B64C45]"
          />
          <Metric
            label="Remaining"
            value={formatAmount(totalRemaining)}
            caption="Balance in transfers"
            background="bg-[#EFF7F1]"
            valueColor="text-[#25805A]"
          />
        </View>

        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <Text className="text-lg font-bold text-[#293930]">
              Transfer records
            </Text>
            <Text className="mt-0.5 text-xs text-[#859087]">
              {transfers.length} {transfers.length === 1 ? "record" : "records"}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={openAddTransfer}
            className="flex-row items-center rounded-xl bg-[#315640] px-3.5 py-2.5"
          >
            <Ionicons name="add" size={17} color="#FFFFFF" />
            <Text className="ml-1 text-xs font-bold text-white">
              Add transfer
            </Text>
          </Pressable>
        </View>

        <View className="mb-3 flex-row items-center rounded-xl border border-[#E4E8E3] bg-white px-3">
          <Ionicons name="search-outline" size={18} color="#87918A" />
          <TextInput
            accessibilityLabel="Search transfers"
            className="h-12 flex-1 px-3 text-sm text-[#25332C]"
            placeholder="Search title or category"
            placeholderTextColor="#9AA39D"
            value={search}
            onChangeText={(value) => {
              setSearch(value);
              setCurrentPage(1);
            }}
          />
          {!!search && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setSearch("")}
            >
              <Ionicons name="close-circle" size={18} color="#87918A" />
            </Pressable>
          )}
        </View>

        <DateRangeFilter
          value={dateRange}
          onChange={(nextRange) => {
            setDateRange(nextRange);
            setCurrentPage(1);
          }}
          style={{ marginBottom: 12 }}
        />

        <View className="mb-4 flex-row items-center justify-between">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 7 }}
          >
            {["All Transfers", ...categoryOptions].map((category) => {
              const selected = categoryFilter === category;
              return (
                <Pressable
                  key={category}
                  className={`rounded-full border px-3 py-2 ${selected ? "border-[#315640] bg-[#315640]" : "border-[#E0E5DF] bg-white"}`}
                  onPress={() => {
                    setCategoryFilter(category);
                    setCurrentPage(1);
                  }}
                >
                  <Text
                    className={`text-xs font-bold ${selected ? "text-white" : "text-[#637068]"}`}
                  >
                    {category}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View className="ml-2 flex-row rounded-xl border border-[#E1E6E0] bg-white p-1">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="List view"
              className={`h-8 w-8 items-center justify-center rounded-lg ${viewMode === "list" ? "bg-[#E8F0E9]" : ""}`}
              onPress={() => setViewMode("list")}
            >
              <Ionicons
                name="list-outline"
                size={17}
                color={viewMode === "list" ? "#315640" : "#87918A"}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Grid view"
              className={`h-8 w-8 items-center justify-center rounded-lg ${viewMode === "grid" ? "bg-[#E8F0E9]" : ""}`}
              onPress={() => setViewMode("grid")}
            >
              <Ionicons
                name="grid-outline"
                size={16}
                color={viewMode === "grid" ? "#315640" : "#87918A"}
              />
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color="#315640" />
            <Text className="mt-3 text-sm font-medium text-[#7B8580]">
              Loading transfers...
            </Text>
          </View>
        ) : visibleTransfers.length === 0 ? (
          <View className="items-center rounded-2xl border border-[#E4E8E3] bg-white px-6 py-12">
            <Ionicons
              name="swap-horizontal-outline"
              size={34}
              color="#A4ADA6"
            />
            <Text className="mt-3 text-base font-bold text-[#25332C]">
              No transfer records found
            </Text>
            <Text className="mt-1 text-center text-sm text-[#7B8580]">
              Add a transfer or adjust your search.
            </Text>
          </View>
        ) : (
          <View
            className={
              viewMode === "grid"
                ? "flex-row flex-wrap justify-between"
                : "gap-3"
            }
          >
            {pageTransfers.map((transfer) => {
              const amount = Number(transfer.amount || 0);
              const expense = Number(transfer.total_expense || 0);
              const remaining = Math.max(amount - expense, 0);
              const progress =
                amount > 0 ? Math.min((expense / amount) * 100, 100) : 0;
              return (
                <View
                  key={transfer.id}
                  className={`mb-3 rounded-2xl border border-[#E4E8E3] bg-white p-4 ${viewMode === "grid" ? "w-[48%]" : "w-full"}`}
                >
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="min-w-0 flex-1">
                      <Text
                        className="text-sm font-bold text-[#293930]"
                        numberOfLines={2}
                      >
                        {transfer.title}
                      </Text>
                      <Text
                        className="mt-1 text-xs font-medium text-[#818D84]"
                        numberOfLines={1}
                      >
                        {transfer.category || "Uncategorized"} ·{" "}
                        {formatDate(transfer.transfer_date)}
                      </Text>
                    </View>
                    <Text
                      className="text-sm font-extrabold text-[#293930]"
                      numberOfLines={1}
                    >
                      {formatAmount(amount)}
                    </Text>
                  </View>
                  <View className="mt-3 h-2 overflow-hidden rounded-full bg-[#EDF0EC]">
                    <View
                      className="h-full rounded-full bg-[#D87967]"
                      style={{ width: `${progress}%` }}
                    />
                  </View>
                  <View className="mt-3 flex-row gap-2">
                    <View className="flex-1 rounded-lg bg-[#FBEFED] p-2">
                      <Text className="text-[9px] font-semibold text-[#A36B64]">
                        Spent
                      </Text>
                      <Text
                        className="mt-0.5 text-xs font-extrabold text-[#B64C45]"
                        numberOfLines={1}
                      >
                        {formatAmount(expense)}
                      </Text>
                    </View>
                    <View className="flex-1 rounded-lg bg-[#EFF7F1] p-2">
                      <Text className="text-[9px] font-semibold text-[#6F9077]">
                        Remaining
                      </Text>
                      <Text
                        className="mt-0.5 text-xs font-extrabold text-[#25805A]"
                        numberOfLines={1}
                      >
                        {formatAmount(remaining)}
                      </Text>
                    </View>
                  </View>
                  <View className="mt-3 flex-row items-center justify-between border-t border-[#EEF0ED] pt-3">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-xs font-medium text-[#7C8880]">
                        {transfer.payment_method || "-"}
                      </Text>
                      {transfer.receipt && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="View transfer receipt"
                          className="h-7 w-7 items-center justify-center rounded-full bg-[#EEF3F8]"
                          onPress={() => setSelectedTransfer(transfer)}
                        >
                          <Ionicons
                            name="attach-outline"
                            size={15}
                            color="#426C92"
                          />
                        </Pressable>
                      )}
                    </View>
                    <View className="flex-row gap-2">
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${transfer.title}`}
                        className="h-8 w-8 items-center justify-center rounded-full bg-[#EEF3F8]"
                        onPress={() => openEditTransfer(transfer)}
                      >
                        <Ionicons
                          name="create-outline"
                          size={16}
                          color="#426C92"
                        />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${transfer.title}`}
                        className="h-8 w-8 items-center justify-center rounded-full bg-[#FBEDEC]"
                        disabled={deletingId === transfer.id}
                        onPress={() => deleteTransfer(transfer)}
                      >
                        {deletingId === transfer.id ? (
                          <ActivityIndicator size="small" color="#B64C45" />
                        ) : (
                          <Ionicons
                            name="trash-outline"
                            size={16}
                            color="#B64C45"
                          />
                        )}
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {!loading && visibleTransfers.length > 0 && (
          <View className="mt-1 flex-row items-center justify-between rounded-xl border border-[#E4E8E3] bg-white px-3 py-2.5">
            <Text className="text-xs font-semibold text-[#6F7B73]">
              Showing{" "}
              {Math.min(
                (safeCurrentPage - 1) * pageSize + 1,
                visibleTransfers.length,
              )}
              -{Math.min(safeCurrentPage * pageSize, visibleTransfers.length)}{" "}
              of {visibleTransfers.length}
            </Text>
            <View className="flex-row items-center gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous page"
                disabled={safeCurrentPage === 1}
                className="h-8 w-8 items-center justify-center rounded-lg border border-[#E1E6E0] disabled:opacity-40"
                onPress={() =>
                  setCurrentPage((page) => Math.max(1, safeCurrentPage - 1))
                }
              >
                <Ionicons name="chevron-back" size={16} color="#526058" />
              </Pressable>
              <Text className="text-xs font-bold text-[#6F7B73]">
                {safeCurrentPage} / {totalPages}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next page"
                disabled={safeCurrentPage === totalPages}
                className="h-8 w-8 items-center justify-center rounded-lg border border-[#E1E6E0] disabled:opacity-40"
                onPress={() =>
                  setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))
                }
              >
                <Ionicons name="chevron-forward" size={16} color="#526058" />
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      <AddButton
        onPress={openAddTransfer}
        accessibilityLabel="Add transfer"
        accessibilityHint="Opens the new transfer form"
      />

      <Modal
        animationType="slide"
        onRequestClose={closeModal}
        transparent
        visible={modalVisible}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[92%] rounded-t-[26px] bg-[#F8F9F6] px-5 pb-8 pt-5">
            <View className="mb-4 flex-row items-center justify-between">
              <View>
                <Text className="text-xl font-bold text-[#25332C]">
                  {editingTransferId !== null
                    ? "Edit transfer"
                    : "Add transfer"}
                </Text>
                <Text className="mt-1 text-xs text-[#818B84]">
                  Move income into a budget or savings category
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close transfer form"
                className="h-9 w-9 items-center justify-center rounded-full bg-white"
                onPress={closeModal}
              >
                <Ionicons name="close" size={20} color="#526058" />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
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

              <Text className="mb-2 text-xs font-bold text-[#46534B]">
                Source income (optional)
              </Text>
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
                  <Text className="text-xs font-bold text-[#293930]">
                    No source
                  </Text>
                  <Text className="mt-1 text-xs text-[#818D84]">
                    Unlinked transfer
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
                      <Text
                        className="text-xs font-bold text-[#293930]"
                        numberOfLines={1}
                      >
                        {income.title}
                      </Text>
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

              <Text className="mb-1.5 text-xs font-bold text-[#46534B]">
                Transfer title
              </Text>
              <FormInput
                className="mb-4 rounded-xl bg-white px-4 py-3 text-sm text-[#25332C]"
                placeholder="e.g. Monthly savings"
                value={form.title}
                onChangeText={(value) => updateForm("title", value)}
              />

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="mb-1.5 text-xs font-bold text-[#46534B]">
                    Amount
                  </Text>
                  <FormInput
                    className="mb-4 rounded-xl bg-white px-4 py-3 text-sm text-[#25332C]"
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    value={form.amount}
                    onChangeText={(value) => updateForm("amount", value)}
                  />
                </View>
                <View className="flex-1">
                  <Text className="mb-1.5 text-xs font-bold text-[#46534B]">
                    Date
                  </Text>
                  <FormInput
                    className="mb-4 rounded-xl bg-white px-4 py-3 text-sm text-[#25332C]"
                    placeholder="YYYY-MM-DD"
                    value={form.date}
                    onChangeText={(value) => updateForm("date", value)}
                  />
                </View>
              </View>

              <Text className="mb-1.5 text-xs font-bold text-[#46534B]">
                Category
              </Text>
              <FormInput
                className="mb-2 rounded-xl bg-white px-4 py-3 text-sm text-[#25332C]"
                placeholder="Choose or enter a category"
                value={form.category}
                onChangeText={(value) => updateForm("category", value)}
              />
              {categoryOptions.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 7, paddingBottom: 14 }}
                >
                  {categoryOptions.map((category) => (
                    <FormOption
                      key={category}
                      selected={form.category === category}
                      className={`rounded-full px-3 py-2 ${form.category === category ? "bg-[#315640]" : "bg-white"}`}
                      onPress={() => updateForm("category", category)}
                    >
                      <Text
                        className={`text-xs font-bold ${form.category === category ? "text-white" : "text-[#637068]"}`}
                      >
                        {category}
                      </Text>
                    </FormOption>
                  ))}
                </ScrollView>
              )}

              <Text className="mb-2 text-xs font-bold text-[#46534B]">
                Payment method
              </Text>
              <View className="mb-4 flex-row flex-wrap gap-2">
                {paymentMethods.map((method) => (
                  <FormOption
                    key={method}
                    selected={form.paymentMethod === method}
                    className={`rounded-full px-3 py-2 ${form.paymentMethod === method ? "bg-[#315640]" : "bg-white"}`}
                    onPress={() => updateForm("paymentMethod", method)}
                  >
                    <Text
                      className={`text-xs font-bold ${form.paymentMethod === method ? "text-white" : "text-[#637068]"}`}
                    >
                      {method}
                    </Text>
                  </FormOption>
                ))}
              </View>

              <Text className="mb-1.5 text-xs font-bold text-[#46534B]">
                Notes
              </Text>
              <FormInput
                className="mb-4 min-h-[78px] rounded-xl bg-white px-4 py-3 text-sm text-[#25332C]"
                multiline
                placeholder="Add any useful details"
                textAlignVertical="top"
                value={form.notes}
                onChangeText={(value) => updateForm("notes", value)}
              />

              <Text className="mb-2 text-xs font-bold text-[#46534B]">
                Receipt
              </Text>
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
        </View>
      </Modal>

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
