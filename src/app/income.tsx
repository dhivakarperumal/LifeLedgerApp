import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api, { API_BASE_URL, getApiErrorMessage, logoutUser } from "../api";

type IncomeRecord = {
  id: number | string;
  title: string;
  amount: number | string;
  remaining_amount?: number | string;
  category?: string;
  income_date?: string;
  payment_method?: string;
  notes?: string;
  recurring?: string;
  attachment?: string | null;
};

type IncomeForm = {
  title: string;
  amount: string;
  category: string;
  date: string;
  paymentMethod: string;
  notes: string;
  recurring: "Yes" | "No";
};

type PickedAttachment = {
  uri: string;
  name: string;
  mimeType: string;
};

const paymentMethods = ["Cash", "Bank Transfer", "UPI", "Card", "Other"];
const incomeKeywords = [
  "income",
  "incomes",
  "earning",
  "earnings",
  "revenue",
  "salary",
  "business",
  "freelance",
];
const pageSize = 10;

function createInitialForm(): IncomeForm {
  return {
    title: "",
    amount: "",
    category: "",
    date: new Date().toISOString().slice(0, 10),
    paymentMethod: "Cash",
    notes: "",
    recurring: "No",
  };
}

function getRows(data: any, key: string) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.[key])) return data.data[key];
  return [];
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

function formatAmount(value: number | string | undefined) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getAttachmentUrl(attachment: string) {
  if (/^https?:\/\//i.test(attachment)) return attachment;
  return `${API_BASE_URL.replace(/\/api\/?$/, "")}${attachment.startsWith("/") ? "" : "/"}${attachment}`;
}

function Metric({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  tone: "green" | "mint" | "amber" | "blue" | "rose";
}) {
  const tones = {
    green: "border-[#DCE8DE] bg-[#315640]",
    mint: "border-[#DDECE4] bg-[#F1F8F3]",
    amber: "border-[#EEE5D5] bg-[#FFF8EC]",
    blue: "border-[#DEE7EF] bg-[#F2F7FA]",
    rose: "border-[#F0DFDE] bg-[#FCF3F2]",
  };
  const textTone = tone === "green" ? "text-white" : "text-[#293930]";
  const mutedTone = tone === "green" ? "text-white/70" : "text-[#7C8880]";

  return (
    <View
      className={`mb-3 min-h-[105px] flex-1 rounded-2xl border p-3.5 ${tones[tone]}`}
    >
      <Text
        className={`text-[10px] font-bold uppercase tracking-[0.8px] ${mutedTone}`}
      >
        {label}
      </Text>
      <Text
        className={`mt-2 text-[19px] font-extrabold ${textTone}`}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text
        className={`mt-1 text-[10px] font-medium ${mutedTone}`}
        numberOfLines={1}
      >
        {caption}
      </Text>
    </View>
  );
}

export default function Income() {
  const router = useRouter();
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<string[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [incomeFilter, setIncomeFilter] = useState("All Income");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [currentPage, setCurrentPage] = useState(1);
  const [editorVisible, setEditorVisible] = useState(false);
  const [budgetVisible, setBudgetVisible] = useState(false);
  const [detailsIncome, setDetailsIncome] = useState<IncomeRecord | null>(null);
  const [editingIncomeId, setEditingIncomeId] = useState<
    number | string | null
  >(null);
  const [existingAttachment, setExistingAttachment] = useState<string | null>(
    null,
  );
  const [attachment, setAttachment] = useState<PickedAttachment | null>(null);
  const [form, setForm] = useState<IncomeForm>(createInitialForm);
  const [budgetDraft, setBudgetDraft] = useState("0");

  const handleUnauthorized = useCallback(async () => {
    await logoutUser();
    router.replace("/auth/login");
  }, [router]);

  const fetchIncome = useCallback(async () => {
    setLoading(true);
    try {
      const incomeResponse = await api.get("/incomes");
      setIncomes(getRows(incomeResponse.data, "incomes"));

      const [categoryResult, budgetResult] = await Promise.allSettled([
        api.get("/categories"),
        api.get("/incomes/monthly-budget"),
      ]);

      for (const result of [categoryResult, budgetResult]) {
        if (
          result.status === "rejected" &&
          (result.reason as { status?: number })?.status === 401
        ) {
          await handleUnauthorized();
          return;
        }
      }

      if (categoryResult.status === "fulfilled") {
        const categories = getRows(categoryResult.value.data, "categories");
        const names: string[] = categories
          .filter((category: any) => {
            if (typeof category === "string") return false;
            const typeValue = String(
              category?.catType ||
                category?.type ||
                category?.category_type ||
                "",
            )
              .trim()
              .toLowerCase();
            const nameValue = String(category?.name || "")
              .trim()
              .toLowerCase();
            return (
              typeValue.includes("income") ||
              typeValue.includes("earning") ||
              typeValue.includes("revenue") ||
              incomeKeywords.some((keyword) => nameValue.includes(keyword))
            );
          })
          .map((category: any) => String(category.name || "").trim())
          .filter(Boolean);
        setIncomeCategories(Array.from(new Set<string>(names)));
      }

      if (budgetResult.status === "fulfilled") {
        const nextBudget = Number(budgetResult.value.data?.monthly_budget ?? 0);
        if (Number.isFinite(nextBudget)) setMonthlyBudget(nextBudget);
      }
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 401) {
        await handleUnauthorized();
        return;
      }
      Alert.alert("Unable to load income", getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      void fetchIncome();
    }, [fetchIncome]),
  );

  const filteredIncomes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return incomes.filter((income) => {
      const searchable =
        `${income.title || ""} ${income.category || ""} ${income.payment_method || ""}`.toLowerCase();
      const matchesSearch = !query || searchable.includes(query);
      const matchesFilter =
        incomeFilter === "All Income" ||
        (incomeFilter === "Recurring" && income.recurring === "Yes") ||
        (incomeFilter === "One-time" && income.recurring !== "Yes");
      return matchesSearch && matchesFilter;
    });
  }, [incomes, incomeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredIncomes.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedIncomes = filteredIncomes.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize,
  );
  const totalIncome = incomes.reduce(
    (total, income) => total + Number(income.amount || 0),
    0,
  );
  const remainingIncome = incomes.reduce(
    (total, income) =>
      total + Number(income.remaining_amount ?? income.amount ?? 0),
    0,
  );
  const now = new Date();
  const monthlyIncome = incomes
    .filter((income) => {
      const date = new Date(income.income_date || "");
      return (
        !Number.isNaN(date.getTime()) &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    })
    .reduce((total, income) => total + Number(income.amount || 0), 0);
  const recurringIncome = incomes
    .filter((income) => income.recurring === "Yes")
    .reduce((total, income) => total + Number(income.amount || 0), 0);

  const updateForm = <K extends keyof IncomeForm>(
    key: K,
    value: IncomeForm[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const closeEditor = () => {
    setEditorVisible(false);
    setEditingIncomeId(null);
    setExistingAttachment(null);
    setAttachment(null);
    setForm(createInitialForm());
  };

  const openAddIncome = () => {
    setEditingIncomeId(null);
    setExistingAttachment(null);
    setAttachment(null);
    setForm(createInitialForm());
    setEditorVisible(true);
  };

  const openEditIncome = (income: IncomeRecord) => {
    setEditingIncomeId(income.id);
    setExistingAttachment(income.attachment || null);
    setAttachment(null);
    setForm({
      title: income.title || "",
      amount: String(income.amount ?? ""),
      category: income.category || "",
      date: income.income_date
        ? String(income.income_date).split("T")[0]
        : createInitialForm().date,
      paymentMethod: income.payment_method || "Cash",
      notes: income.notes || "",
      recurring: income.recurring === "Yes" ? "Yes" : "No",
    });
    setEditorVisible(true);
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
      setAttachment({
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType || "application/octet-stream",
      });
    } catch (error) {
      Alert.alert("Unable to select file", getApiErrorMessage(error));
    }
  };

  const submitIncome = async () => {
    const title = form.title.trim();
    const amount = Number(form.amount);
    if (
      !title ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !form.category.trim()
    ) {
      Alert.alert(
        "Check the income details",
        "Enter a title, a valid amount, and a category.",
      );
      return;
    }

    setSaving(true);
    try {
      const payload = new FormData();
      payload.append("title", title);
      payload.append("amount", String(amount));
      payload.append("category", form.category.trim());
      payload.append("date", form.date);
      payload.append("paymentMethod", form.paymentMethod);
      payload.append("notes", form.notes);
      payload.append("recurring", form.recurring);
      if (attachment) {
        payload.append("attachment", {
          uri: attachment.uri,
          name: attachment.name,
          type: attachment.mimeType,
        } as any);
      }

      const response = editingIncomeId
        ? await api.put(`/incomes/${editingIncomeId}`, payload, {
            headers: { "Content-Type": "multipart/form-data" },
          })
        : await api.post("/incomes", payload, {
            headers: { "Content-Type": "multipart/form-data" },
          });
      const savedIncome = response.data?.income || response.data;

      if (editingIncomeId) {
        setIncomes((current) =>
          current.map((income) =>
            income.id === editingIncomeId ? savedIncome : income,
          ),
        );
        setCurrentPage(1);
      } else {
        setIncomes((current) => [savedIncome, ...current]);
        setCurrentPage(1);
      }
      closeEditor();
      Alert.alert(
        "Saved",
        editingIncomeId ? "Income updated." : "Income added.",
      );
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 401) {
        await handleUnauthorized();
        return;
      }
      Alert.alert("Unable to save income", getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const deleteIncome = (income: IncomeRecord) => {
    Alert.alert("Delete income?", `Delete “${income.title}”?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void api
            .delete(`/incomes/${income.id}`)
            .then(() => {
              setIncomes((current) =>
                current.filter((item) => item.id !== income.id),
              );
              setCurrentPage(1);
              if (detailsIncome?.id === income.id) setDetailsIncome(null);
            })
            .catch((error) =>
              Alert.alert("Unable to delete income", getApiErrorMessage(error)),
            );
        },
      },
    ]);
  };

  const saveBudget = async () => {
    const value = Number(budgetDraft || 0);
    if (!Number.isFinite(value) || value < 0) {
      Alert.alert("Invalid budget", "Enter a non-negative budget amount.");
      return;
    }
    setBudgetSaving(true);
    try {
      await api.put("/incomes/monthly-budget", { monthly_budget: value });
      setMonthlyBudget(value);
      setBudgetVisible(false);
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 401) {
        await handleUnauthorized();
        return;
      }
      Alert.alert("Unable to save budget", getApiErrorMessage(error));
    } finally {
      setBudgetSaving(false);
    }
  };

  const openAttachment = async (path: string) => {
    try {
      await Linking.openURL(getAttachmentUrl(path));
    } catch {
      Alert.alert("Unable to open attachment", "No app could open this file.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F5F6F2]" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-between px-5 pb-4 pt-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="h-10 w-10 items-center justify-center rounded-full bg-white"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color="#25332C" />
        </Pressable>
        <Text className="text-[18px] font-bold text-[#25332C]">
          Monthly Income
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add income"
          className="h-10 w-10 items-center justify-center rounded-full bg-[#315640]"
          onPress={openAddIncome}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 36 }}
      >
        <View className="flex-row gap-3">
          <Metric
            label="Total income"
            value={formatAmount(totalIncome)}
            caption="All recorded income"
            tone="green"
          />
          <Metric
            label="This month"
            value={formatAmount(monthlyIncome)}
            caption="Income this month"
            tone="mint"
          />
        </View>
        <View className="flex-row gap-3">
          <Metric
            label="Remaining"
            value={formatAmount(remainingIncome)}
            caption="Available income"
            tone="blue"
          />
          <Metric
            label="Recurring"
            value={formatAmount(recurringIncome)}
            caption="Recurring records"
            tone="rose"
          />
        </View>
        <View className="mb-5 flex-row items-center justify-between rounded-2xl border border-[#E5E8E2] bg-white px-4 py-3.5">
          <View className="flex-row items-center">
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-[#FFF3E3]">
              <Ionicons name="wallet-outline" size={20} color="#B07837" />
            </View>
            <View>
              <Text className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#859087]">
                Monthly budget
              </Text>
              <Text className="mt-0.5 text-[18px] font-extrabold text-[#293930]">
                {formatAmount(monthlyBudget)}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setBudgetDraft(String(monthlyBudget));
              setBudgetVisible(true);
            }}
            className="flex-row items-center rounded-lg bg-[#EDF3EE] px-3 py-2"
          >
            <Ionicons name="create-outline" size={15} color="#315640" />
            <Text className="ml-1.5 text-[12px] font-bold text-[#315640]">
              Edit
            </Text>
          </Pressable>
        </View>

        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <Text className="text-[17px] font-bold text-[#293930]">
              Income records
            </Text>
            <Text className="mt-0.5 text-[12px] text-[#859087]">
              {incomes.length} {incomes.length === 1 ? "record" : "records"}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={openAddIncome}
            className="flex-row items-center rounded-xl bg-[#315640] px-3.5 py-2.5"
          >
            <Ionicons name="add" size={17} color="#FFFFFF" />
            <Text className="ml-1 text-[12px] font-bold text-white">
              Add income
            </Text>
          </Pressable>
        </View>

        <View className="mb-3 flex-row items-center rounded-xl border border-[#E4E8E3] bg-white px-3">
          <Ionicons name="search-outline" size={18} color="#87918A" />
          <TextInput
            accessibilityLabel="Search income"
            className="h-12 flex-1 px-3 text-[14px] text-[#25332C]"
            placeholder="Search title, category, payment"
            placeholderTextColor="#9AA39D"
            value={search}
            onChangeText={(value) => {
              setSearch(value);
              setCurrentPage(1);
            }}
          />
          {!!search && (
            <Pressable
              onPress={() => setSearch("")}
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={18} color="#87918A" />
            </Pressable>
          )}
        </View>

        <View className="mb-4 flex-row items-center justify-between">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 7 }}
          >
            {["All Income", "Recurring", "One-time"].map((filter) => {
              const selected = incomeFilter === filter;
              return (
                <Pressable
                  key={filter}
                  className={`rounded-full border px-3 py-2 ${selected ? "border-[#315640] bg-[#315640]" : "border-[#E0E5DF] bg-white"}`}
                  onPress={() => {
                    setIncomeFilter(filter);
                    setCurrentPage(1);
                  }}
                >
                  <Text
                    className={`text-[11px] font-bold ${selected ? "text-white" : "text-[#637068]"}`}
                  >
                    {filter}
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
            <Text className="mt-3 text-[13px] font-medium text-[#7B8580]">
              Loading income...
            </Text>
          </View>
        ) : filteredIncomes.length === 0 ? (
          <View className="items-center rounded-2xl border border-[#E4E8E3] bg-white px-6 py-12">
            <Ionicons name="receipt-outline" size={34} color="#A4ADA6" />
            <Text className="mt-3 text-[16px] font-bold text-[#25332C]">
              No income records found
            </Text>
            <Text className="mt-1 text-center text-[13px] text-[#7B8580]">
              Add an income record or adjust your search.
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
            {paginatedIncomes.map((income) => (
              <View
                key={income.id}
                className={`mb-3 rounded-2xl border border-[#E4E8E3] bg-white p-4 ${viewMode === "grid" ? "w-[48%]" : "w-full"}`}
              >
                <View className="flex-row items-start justify-between gap-2">
                  <View className="min-w-0 flex-1">
                    <Text
                      className="text-[14px] font-bold text-[#293930]"
                      numberOfLines={2}
                    >
                      {income.title}
                    </Text>
                    <Text
                      className="mt-1 text-[11px] font-medium text-[#818D84]"
                      numberOfLines={1}
                    >
                      {income.category || "Uncategorized"}
                    </Text>
                  </View>
                  <Text
                    className="text-[14px] font-extrabold text-[#25805A]"
                    numberOfLines={1}
                  >
                    {formatAmount(income.remaining_amount ?? income.amount)}
                  </Text>
                </View>
                <Text className="mt-3 text-[11px] font-medium text-[#7C8880]">
                  {formatDate(income.income_date)} ·{" "}
                  {income.payment_method || "-"}
                </Text>
                <View className="mt-3 flex-row items-center justify-between border-t border-[#EEF0ED] pt-3">
                  <View className="flex-row items-center gap-2">
                    <View
                      className={`rounded-full px-2 py-1 ${income.recurring === "Yes" ? "bg-[#E7F4EC]" : "bg-[#F1F3F0]"}`}
                    >
                      <Text
                        className={`text-[10px] font-bold ${income.recurring === "Yes" ? "text-[#25805A]" : "text-[#758078]"}`}
                      >
                        {income.recurring === "Yes" ? "Recurring" : "One-time"}
                      </Text>
                    </View>
                    {income.attachment && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="View income attachment"
                        className="h-7 w-7 items-center justify-center rounded-full bg-[#EEF3F8]"
                        onPress={() => setDetailsIncome(income)}
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
                      accessibilityLabel={`Edit ${income.title}`}
                      className="h-8 w-8 items-center justify-center rounded-full bg-[#EEF3F8]"
                      onPress={() => openEditIncome(income)}
                    >
                      <Ionicons
                        name="create-outline"
                        size={16}
                        color="#426C92"
                      />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${income.title}`}
                      className="h-8 w-8 items-center justify-center rounded-full bg-[#FBEDEC]"
                      onPress={() => deleteIncome(income)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color="#B64C45"
                      />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {!loading && filteredIncomes.length > 0 && (
          <View className="mt-1 flex-row items-center justify-between rounded-xl border border-[#E4E8E3] bg-white px-3 py-2.5">
            <Text className="text-[11px] font-semibold text-[#6F7B73]">
              Showing{" "}
              {Math.min(
                (safeCurrentPage - 1) * pageSize + 1,
                filteredIncomes.length,
              )}
              -{Math.min(safeCurrentPage * pageSize, filteredIncomes.length)} of{" "}
              {filteredIncomes.length}
            </Text>
            <View className="flex-row items-center gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous page"
                disabled={safeCurrentPage === 1}
                className="h-8 w-8 items-center justify-center rounded-lg border border-[#E1E6E0] disabled:opacity-40"
                onPress={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                <Ionicons name="chevron-back" size={16} color="#526058" />
              </Pressable>
              <Text className="text-[11px] font-bold text-[#6F7B73]">
                {safeCurrentPage} / {totalPages}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next page"
                disabled={safeCurrentPage === totalPages}
                className="h-8 w-8 items-center justify-center rounded-lg border border-[#E1E6E0] disabled:opacity-40"
                onPress={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
              >
                <Ionicons name="chevron-forward" size={16} color="#526058" />
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={closeEditor}
        transparent
        visible={editorVisible}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[92%] rounded-t-[26px] bg-[#F8F9F6] px-5 pb-8 pt-5">
            <View className="mb-4 flex-row items-center justify-between">
              <View>
                <Text className="text-[20px] font-bold text-[#25332C]">
                  {editingIncomeId ? "Edit income" : "Add income"}
                </Text>
                <Text className="mt-1 text-[12px] text-[#818B84]">
                  Record a new income source
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close income form"
                className="h-9 w-9 items-center justify-center rounded-full bg-white"
                onPress={closeEditor}
              >
                <Ionicons name="close" size={20} color="#526058" />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text className="mb-1.5 text-[12px] font-bold text-[#46534B]">
                Income title
              </Text>
              <TextInput
                className="mb-4 rounded-xl border border-[#E1E6E0] bg-white px-4 py-3 text-[14px] text-[#25332C]"
                placeholder="e.g. Freelance payment"
                placeholderTextColor="#9AA39D"
                value={form.title}
                onChangeText={(value) => updateForm("title", value)}
              />

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="mb-1.5 text-[12px] font-bold text-[#46534B]">
                    Amount
                  </Text>
                  <TextInput
                    className="mb-4 rounded-xl border border-[#E1E6E0] bg-white px-4 py-3 text-[14px] text-[#25332C]"
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#9AA39D"
                    value={form.amount}
                    onChangeText={(value) => updateForm("amount", value)}
                  />
                </View>
                <View className="flex-1">
                  <Text className="mb-1.5 text-[12px] font-bold text-[#46534B]">
                    Date
                  </Text>
                  <TextInput
                    className="mb-4 rounded-xl border border-[#E1E6E0] bg-white px-4 py-3 text-[14px] text-[#25332C]"
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9AA39D"
                    value={form.date}
                    onChangeText={(value) => updateForm("date", value)}
                  />
                </View>
              </View>

              <Text className="mb-1.5 text-[12px] font-bold text-[#46534B]">
                Category
              </Text>
              <TextInput
                className="mb-2 rounded-xl border border-[#E1E6E0] bg-white px-4 py-3 text-[14px] text-[#25332C]"
                placeholder="Choose or enter a category"
                placeholderTextColor="#9AA39D"
                value={form.category}
                onChangeText={(value) => updateForm("category", value)}
              />
              {incomeCategories.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 7, paddingBottom: 14 }}
                >
                  {incomeCategories.map((category) => (
                    <Pressable
                      key={category}
                      className={`rounded-full border px-3 py-2 ${form.category === category ? "border-[#315640] bg-[#315640]" : "border-[#E1E6E0] bg-white"}`}
                      onPress={() => updateForm("category", category)}
                    >
                      <Text
                        className={`text-[11px] font-bold ${form.category === category ? "text-white" : "text-[#637068]"}`}
                      >
                        {category}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              <Text className="mb-2 text-[12px] font-bold text-[#46534B]">
                Payment method
              </Text>
              <View className="mb-4 flex-row flex-wrap gap-2">
                {paymentMethods.map((method) => (
                  <Pressable
                    key={method}
                    className={`rounded-full border px-3 py-2 ${form.paymentMethod === method ? "border-[#315640] bg-[#315640]" : "border-[#E1E6E0] bg-white"}`}
                    onPress={() => updateForm("paymentMethod", method)}
                  >
                    <Text
                      className={`text-[11px] font-bold ${form.paymentMethod === method ? "text-white" : "text-[#637068]"}`}
                    >
                      {method}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text className="mb-2 text-[12px] font-bold text-[#46534B]">
                Recurring income
              </Text>
              <View className="mb-4 flex-row gap-2">
                {(["Yes", "No"] as const).map((value) => (
                  <Pressable
                    key={value}
                    className={`flex-1 items-center rounded-xl border py-3 ${form.recurring === value ? "border-[#315640] bg-[#E7F0E8]" : "border-[#E1E6E0] bg-white"}`}
                    onPress={() => updateForm("recurring", value)}
                  >
                    <Text
                      className={`text-[13px] font-bold ${form.recurring === value ? "text-[#315640]" : "text-[#637068]"}`}
                    >
                      {value}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text className="mb-1.5 text-[12px] font-bold text-[#46534B]">
                Notes
              </Text>
              <TextInput
                className="mb-4 min-h-[78px] rounded-xl border border-[#E1E6E0] bg-white px-4 py-3 text-[14px] text-[#25332C]"
                multiline
                placeholder="Add any useful details"
                placeholderTextColor="#9AA39D"
                textAlignVertical="top"
                value={form.notes}
                onChangeText={(value) => updateForm("notes", value)}
              />

              <Text className="mb-2 text-[12px] font-bold text-[#46534B]">
                Attachment / receipt
              </Text>
              {existingAttachment && !attachment && (
                <Pressable
                  className="mb-2 flex-row items-center rounded-xl border border-[#DDE5DD] bg-white p-3"
                  onPress={() => void openAttachment(existingAttachment)}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={20}
                    color="#426C92"
                  />
                  <Text
                    className="ml-2 flex-1 text-[12px] font-semibold text-[#526058]"
                    numberOfLines={1}
                  >
                    Current receipt · tap to open
                  </Text>
                  <Ionicons name="open-outline" size={16} color="#7B8580" />
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={() => void pickAttachment()}
                className="mb-5 flex-row items-center rounded-xl border border-dashed border-[#BEC9BF] bg-white px-4 py-3"
              >
                <Ionicons
                  name="cloud-upload-outline"
                  size={19}
                  color="#426C62"
                />
                <Text
                  className="ml-2 flex-1 text-[12px] font-semibold text-[#59675F]"
                  numberOfLines={1}
                >
                  {attachment?.name || "Choose image or PDF"}
                </Text>
                {attachment && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Remove selected attachment"
                    onPress={() => setAttachment(null)}
                    className="p-1"
                  >
                    <Ionicons name="close-circle" size={19} color="#B64C45" />
                  </Pressable>
                )}
              </Pressable>
            </ScrollView>

            <View className="flex-row gap-3 pt-3">
              <Pressable
                className="flex-1 items-center rounded-xl border border-[#DDE3DC] bg-white py-3.5"
                disabled={saving}
                onPress={closeEditor}
              >
                <Text className="text-[14px] font-bold text-[#58645C]">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                className="flex-1 flex-row items-center justify-center rounded-xl bg-[#315640] py-3.5"
                disabled={saving}
                onPress={() => void submitIncome()}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-[14px] font-bold text-white">
                    {editingIncomeId ? "Update income" : "Save income"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setBudgetVisible(false)}
        transparent
        visible={budgetVisible}
      >
        <View className="flex-1 justify-center bg-black/40 px-5">
          <View className="rounded-2xl bg-[#F8F9F6] p-5">
            <Text className="text-[19px] font-bold text-[#25332C]">
              Monthly budget
            </Text>
            <Text className="mb-4 mt-1 text-[12px] text-[#818B84]">
              Set your income budget for the month
            </Text>
            <TextInput
              className="mb-5 rounded-xl border border-[#E1E6E0] bg-white px-4 py-3 text-[15px] text-[#25332C]"
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#9AA39D"
              value={budgetDraft}
              onChangeText={setBudgetDraft}
            />
            <View className="flex-row gap-3">
              <Pressable
                className="flex-1 items-center rounded-xl border border-[#DDE3DC] bg-white py-3"
                disabled={budgetSaving}
                onPress={() => setBudgetVisible(false)}
              >
                <Text className="text-[13px] font-bold text-[#58645C]">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                className="flex-1 items-center rounded-xl bg-[#315640] py-3"
                disabled={budgetSaving}
                onPress={() => void saveBudget()}
              >
                {budgetSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-[13px] font-bold text-white">
                    Save budget
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setDetailsIncome(null)}
        transparent
        visible={!!detailsIncome}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-[26px] bg-[#F8F9F6] px-5 pb-9 pt-5">
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-[10px] font-bold uppercase tracking-[1px] text-[#818B84]">
                  Income details
                </Text>
                <Text
                  className="mt-1 text-[20px] font-bold text-[#25332C]"
                  numberOfLines={1}
                >
                  {detailsIncome?.title}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close income details"
                className="h-9 w-9 items-center justify-center rounded-full bg-white"
                onPress={() => setDetailsIncome(null)}
              >
                <Ionicons name="close" size={20} color="#526058" />
              </Pressable>
            </View>
            <View className="mb-4 flex-row gap-3">
              <View className="flex-1 rounded-xl bg-white p-3">
                <Text className="text-[10px] font-bold uppercase text-[#87918A]">
                  Category
                </Text>
                <Text className="mt-1 text-[14px] font-bold text-[#293930]">
                  {detailsIncome?.category || "-"}
                </Text>
              </View>
              <View className="flex-1 rounded-xl bg-white p-3">
                <Text className="text-[10px] font-bold uppercase text-[#87918A]">
                  Amount
                </Text>
                <Text className="mt-1 text-[14px] font-extrabold text-[#25805A]">
                  {formatAmount(detailsIncome?.amount)}
                </Text>
              </View>
            </View>
            <View className="mb-3 flex-row gap-3">
              <View className="flex-1 rounded-xl bg-white p-3">
                <Text className="text-[10px] font-bold uppercase text-[#87918A]">
                  Date
                </Text>
                <Text className="mt-1 text-[13px] font-bold text-[#293930]">
                  {formatDate(detailsIncome?.income_date)}
                </Text>
              </View>
              <View className="flex-1 rounded-xl bg-white p-3">
                <Text className="text-[10px] font-bold uppercase text-[#87918A]">
                  Payment
                </Text>
                <Text className="mt-1 text-[13px] font-bold text-[#293930]">
                  {detailsIncome?.payment_method || "-"}
                </Text>
              </View>
            </View>
            {!!detailsIncome?.notes && (
              <View className="mb-3 rounded-xl bg-white p-3">
                <Text className="text-[10px] font-bold uppercase text-[#87918A]">
                  Notes
                </Text>
                <Text className="mt-1 text-[13px] leading-5 text-[#526058]">
                  {detailsIncome.notes}
                </Text>
              </View>
            )}
            {!!detailsIncome?.attachment && (
              <Pressable
                className="flex-row items-center justify-center rounded-xl bg-[#315640] py-3.5"
                onPress={() => void openAttachment(detailsIncome.attachment!)}
              >
                <Ionicons name="open-outline" size={17} color="#FFFFFF" />
                <Text className="ml-2 text-[13px] font-bold text-white">
                  Open attachment
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
