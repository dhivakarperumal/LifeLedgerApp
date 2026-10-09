import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
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
import Svg, { Path } from "react-native-svg";
import api, { API_BASE_URL, getApiErrorMessage, logoutUser } from "../api";
import { AddButton } from "../components/AddButton";
import { AddPageHeader } from "../components/AddPageHeader";
import {
    createDateRangeSelection,
    isDateInRange,
    type DateRangeSelection,
} from "../components/DateRangeFilter";
import { DateTimePickerComponent } from "../components/DateTimePickerComponent";
import { useAddPageNavigation } from "../components/useAddPageNavigation";

import { CenteredPageLoader } from "../components/CenteredPageLoader";
import ConfirmPopup from "../components/ConfirmPopup";
import {
    formatLocalDate,
    formatLocalTime,
    parseLocalDate,
    parseLocalDateTime,
    parseLocalDateTimeValue,
} from "../components/dateTimeUtils";
import {
    countActiveFilters,
    DEFAULT_FILTER_STATE,
    type FilterState,
    type SortOption,
} from "../components/filters";
import { FormInput, FormLabel, FormOption } from "../components/FormControls";
import { GradientSafeAreaView as SafeAreaView } from "../components/GradientSafeAreaView";
import { PopupSelect } from "../components/PopupSelect";
import { SearchBar } from "../components/SearchBar";
import { createSessionDataCache } from "../components/SessionDataCache";
import { UploadFilePreview } from "../components/UploadFilePreview";
import { Colors } from "../constants/colors";

type IncomeRecord = {
  id: number | string;
  title: string;
  amount: number | string;
  remaining_amount?: number | string;
  category?: string;
  income_date?: string;
  time?: string;
  income_time?: string;
  payment_method?: string;
  notes?: string;
  recurring?: string;
  attachment?: string | null;
};

type IncomeData = {
  incomes: IncomeRecord[];
  categories: string[];
  monthlyBudget: number;
};

const incomeDataCache = createSessionDataCache<IncomeData>();

type IncomeForm = {
  title: string;
  amount: string;
  category: string;
  date: string;
  time: string;
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

const incomeFormStyles = StyleSheet.create({
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
  budgetInput: {
    minHeight: 52,
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    color: "#25332C",
    fontSize: 16,
  },
});

function createInitialForm(): IncomeForm {
  return {
    title: "",
    amount: "",
    category: "",
    date: formatLocalDate(new Date()),
    time: formatLocalTime(new Date()),
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
  const date = parseLocalDate(value) ?? parseLocalDateTimeValue(value);
  if (!date) return String(value).split("T")[0];
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

function formatCompactAmount(value: number) {
  const amount = Number.isFinite(value) ? value : 0;
  const absoluteAmount = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (absoluteAmount >= 100_000) {
    return `${sign}₹${(absoluteAmount / 100_000).toLocaleString("en-IN", { maximumFractionDigits: 2 })}L`;
  }
  if (absoluteAmount >= 1_000) {
    return `${sign}₹${(absoluteAmount / 1_000).toLocaleString("en-IN", { maximumFractionDigits: 1 })}K`;
  }
  return `${sign}₹${absoluteAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function getAttachmentUrl(attachment: string) {
  if (/^https?:\/\//i.test(attachment)) return attachment;
  return `${API_BASE_URL.replace(/\/api\/?$/, "")}${attachment.startsWith("/") ? "" : "/"}${attachment}`;
}

type MetricTone = "total" | "monthly" | "remaining" | "recurring";

const metricPalettes = {
  total: {
    background: "#FCFFF9",
    border: "#E7F0E2",
    icon: ["#A6DD78", "#58A243"],
    value: "#0D421A",
    caption: "#858F91",
    waveBack: "#E9F7DD",
    waveFront: "#D0F0B6",
    accent: "#6DB14D",
    badge: "#EEF8E7",
  },
  monthly: {
    background: "#FCFFF9",
    border: "#E7F0E2",
    icon: ["#A5DE73", "#4C9839"],
    value: "#0C451A",
    caption: "#858F91",
    waveBack: "#E9F7DD",
    waveFront: "#D0F0B6",
    accent: "#63A94A",
    badge: "#EEF8E7",
  },
  remaining: {
    background: "#FBFCFF",
    border: "#E4EAF4",
    icon: ["#85B4FF", "#2869D7"],
    value: "#1046AE",
    caption: "#828D99",
    waveBack: "#E8F0FF",
    waveFront: "#D6E4FF",
    accent: "#216CE0",
    badge: "#E8F0FF",
  },
  recurring: {
    background: "#FFFCFA",
    border: "#F3E6E1",
    icon: ["#FFC1B2", "#F36C4C"],
    value: "#D9351E",
    caption: "#8A8F95",
    waveBack: "#FCEAE5",
    waveFront: "#FBD9D0",
    accent: "#F15B31",
    badge: "#FCE9E4",
  },
} as const;

function Metric({
  label,
  value,
  caption,
  tone,
  icon,
  topIcon,
  footerLabel,
  cardWidth,
  badgeText,
}: {
  label: string;
  value: string;
  caption: string;
  tone: MetricTone;
  icon: keyof typeof Ionicons.glyphMap;
  topIcon: keyof typeof Ionicons.glyphMap;
  footerLabel?: string;
  cardWidth: number;
  badgeText?: string;
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
        borderRadius: 27,
        backgroundColor: palette.background,
      }}
    >
      <Svg
        width="100%"
        height={cardHeight * 0.2}
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
          <Ionicons name={icon} size={iconSize * 0.45} color="#FFFFFF" />
          {badgeText ? (
            <View
              style={{
                position: "absolute",
                right: -5,
                bottom: -3,
                width: 31,
                height: 31,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2,
                borderColor: palette.icon[1],
                borderRadius: 16,
                backgroundColor: "#FFFFFF",
              }}
            >
              <Text
                style={{
                  color: palette.value,
                  fontSize: 16,
                  fontWeight: "900",
                }}
              >
                {badgeText}
              </Text>
            </View>
          ) : null}
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
            name={topIcon}
            size={secondaryIconSize * 0.55}
            color={palette.accent}
          />
        </View>
      </View>

      <Text
        numberOfLines={2}
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
          marginTop: 2,
          color: palette.value,
          fontSize: Math.min(30, Math.max(23, cardWidth * 0.075)),
          lineHeight: Math.min(32, Math.max(26, cardWidth * 0.082)),
          fontWeight: "900",
        }}
      >
        {value}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          marginTop: 1,
          color: palette.caption,
          fontSize: Math.min(11, Math.max(10, cardWidth * 0.027)),
          fontWeight: "500",
        }}
      >
        {caption}
      </Text>

      {footerLabel ? (
        <View
          style={{
            alignSelf: "flex-start",
            marginTop: 2,
            paddingHorizontal: 9,
            paddingVertical: 3,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.78)",
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              color: palette.value,
              fontSize: 10,
              fontWeight: "700",
            }}
          >
            {footerLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function Income() {
  const router = useRouter();
  const pathname = usePathname();
  const isNewIncomeRoute = pathname === "/income/new";
  const navigateToAddPage = useAddPageNavigation();
  const { form: rawForm, id: rawEditId } = useLocalSearchParams<{
    form?: string | string[];
    id?: string | string[];
  }>();
  const formParam = Array.isArray(rawForm) ? rawForm[0] : rawForm;
  const editId = Array.isArray(rawEditId) ? rawEditId[0] : rawEditId;
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [incomes, setIncomes] = useState<IncomeRecord[]>(
    () => incomeDataCache.get()?.incomes ?? [],
  );
  const [incomeCategories, setIncomeCategories] = useState<string[]>(
    () => incomeDataCache.get()?.categories ?? [],
  );
  const [monthlyBudget, setMonthlyBudget] = useState(
    () => incomeDataCache.get()?.monthlyBudget ?? 0,
  );
  const [loading, setLoading] = useState(() => !incomeDataCache.hasData());
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<IncomeRecord | null>(null);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [incomeFilter, setIncomeFilter] = useState("All Income");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeSelection>(() =>
    createDateRangeSelection("All"),
  );
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [sort, setSort] = useState<SortOption>(DEFAULT_FILTER_STATE.sort);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [editorVisible, setEditorVisible] = useState(isNewIncomeRoute);
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

  const filterValues = useMemo<FilterState>(
    () => ({
      ...DEFAULT_FILTER_STATE,
      dateRange,
      category: selectedCategory,
      amountMin,
      amountMax,
      sort,
      viewMode: viewMode === "grid" ? "card" : "table",
    }),
    [dateRange, selectedCategory, amountMin, amountMax, sort, viewMode],
  );

  const applyIncomeFilters = (filters: FilterState) => {
    setDateRange(filters.dateRange);
    setSelectedCategory(filters.category);
    setAmountMin(filters.amountMin);
    setAmountMax(filters.amountMax);
    setSort(filters.sort);
    setViewMode(filters.viewMode === "card" ? "grid" : "list");
  };

  const handleUnauthorized = useCallback(async () => {
    await logoutUser();
    router.replace("/auth/login");
  }, [router]);

  const fetchIncome = useCallback(async (
    showLoading = !incomeDataCache.hasData(),
  ) => {
    if (showLoading && !incomeDataCache.hasData()) setLoading(true);
    try {
      const data = await incomeDataCache.load(async () => {
        const incomeResponse = await api.get("/incomes");
        const [categoryResult, budgetResult] = await Promise.allSettled([
          api.get("/categories"),
          api.get("/incomes/monthly-budget"),
        ]);
        for (const result of [categoryResult, budgetResult]) {
          if (
            result.status === "rejected" &&
            (result.reason as { status?: number })?.status === 401
          ) {
            throw result.reason;
          }
        }

        const cachedData = incomeDataCache.get();
        let categories = cachedData?.categories ?? [];
        if (categoryResult.status === "fulfilled") {
          const rows = getRows(categoryResult.value.data, "categories");
          const names: string[] = rows
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
          categories = Array.from(new Set<string>(names));
        }

        let nextBudget = cachedData?.monthlyBudget ?? 0;
        if (budgetResult.status === "fulfilled") {
          const fetchedBudget = Number(
            budgetResult.value.data?.monthly_budget ?? 0,
          );
          if (Number.isFinite(fetchedBudget)) nextBudget = fetchedBudget;
        }

        return {
          incomes: getRows(incomeResponse.data, "incomes"),
          categories,
          monthlyBudget: nextBudget,
        };
      });
      setIncomes(data.incomes);
      setIncomeCategories(data.categories);
      setMonthlyBudget(data.monthlyBudget);
    } catch (error) {
      const status =
        (error as { status?: number; response?: { status?: number } })?.status ||
        (error as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        await handleUnauthorized();
        return;
      }
      Alert.alert("Unable to load income", getApiErrorMessage(error));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [handleUnauthorized]);

  const refreshIncome = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchIncome(false);
    } finally {
      setRefreshing(false);
    }
  }, [fetchIncome]);

  useFocusEffect(
    useCallback(() => {
      void fetchIncome(!incomeDataCache.hasData());
    }, [fetchIncome]),
  );

  const filteredIncomes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = incomes.filter((income) => {
      const searchable =
        `${income.title || ""} ${income.category || ""} ${income.payment_method || ""}`.toLowerCase();
      const matchesSearch = !query || searchable.includes(query);
      const matchesCategory =
        !selectedCategory || income.category === selectedCategory;
      const matchesFilter =
        incomeFilter === "All Income" ||
        (incomeFilter === "Recurring" && income.recurring === "Yes") ||
        (incomeFilter === "One-time" && income.recurring !== "Yes");
      const matchesDate = isDateInRange(income.income_date, dateRange);
      const amount = Number(income.amount || 0);
      const matchesMin = amountMin === "" || amount >= Number(amountMin);
      const matchesMax = amountMax === "" || amount <= Number(amountMax);
      return (
        matchesSearch &&
        matchesCategory &&
        matchesFilter &&
        matchesDate &&
        matchesMin &&
        matchesMax
      );
    });
    return filtered.sort((left, right) => {
      const leftAmount = Number(left.amount || 0);
      const rightAmount = Number(right.amount || 0);
      const leftDate = parseLocalDate(left.income_date)?.getTime() || 0;
      const rightDate = parseLocalDate(right.income_date)?.getTime() || 0;
      if (sort === "Oldest First") return leftDate - rightDate;
      if (sort === "Amount: High to Low") return rightAmount - leftAmount;
      if (sort === "Amount: Low to High") return leftAmount - rightAmount;
      return rightDate - leftDate;
    });
  }, [
    incomes,
    incomeFilter,
    search,
    dateRange,
    selectedCategory,
    amountMin,
    amountMax,
    sort,
  ]);

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
      const date = parseLocalDate(income.income_date);
      return (
        !!date &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    })
    .reduce((total, income) => total + Number(income.amount || 0), 0);
  const recurringIncome = incomes
    .filter((income) => income.recurring === "Yes")
    .reduce((total, income) => total + Number(income.amount || 0), 0);
  const metricCardWidth = Math.min(500, (screenWidth - 36 - 14) / 2);
  const updateForm = <K extends keyof IncomeForm>(
    key: K,
    value: IncomeForm[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const closeEditor = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (isNewIncomeRoute) {
      router.replace("/income");
      return;
    }
    setEditorVisible(false);
    setEditingIncomeId(null);
    setExistingAttachment(null);
    setAttachment(null);
    setForm(createInitialForm());
  };

  const openAddIncome = useCallback(() => {
    setEditingIncomeId(null);
    setExistingAttachment(null);
    setAttachment(null);
    setForm(createInitialForm());
    setEditorVisible(true);
  }, []);

  const openEditIncome = useCallback((income: IncomeRecord) => {
    const incomeDateTime = income.income_date
      ? parseLocalDateTimeValue(income.income_date)
      : null;
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
      time:
        income.time ||
        income.income_time ||
        (incomeDateTime ? formatLocalTime(incomeDateTime) : createInitialForm().time),
      paymentMethod: income.payment_method || "Cash",
      notes: income.notes || "",
      recurring: income.recurring === "Yes" ? "Yes" : "No",
    });
    setEditorVisible(true);
  }, []);

  useEffect(() => {
    if (isNewIncomeRoute) return;
    if (formParam === "new") {
      const timeout = setTimeout(() => {
        openAddIncome();
        router.setParams({ form: undefined });
      }, 0);
      return () => clearTimeout(timeout);
    }
    if (formParam === "budget") {
      const timeout = setTimeout(() => {
        setBudgetDraft(String(monthlyBudget));
        setBudgetVisible(true);
        router.setParams({ form: undefined });
      }, 0);
      return () => clearTimeout(timeout);
    }
    if (formParam !== "edit" || !editId || loading) return;
    const income = incomes.find((item) => String(item.id) === editId);
    if (!income) {
      Alert.alert("Income not found", "This income record is no longer available.");
      if (router.canGoBack()) router.back();
      return;
    }
    const timeout = setTimeout(() => {
      openEditIncome(income);
      router.setParams({ form: undefined, id: undefined });
    }, 0);
    return () => clearTimeout(timeout);
  }, [editId, formParam, incomes, isNewIncomeRoute, loading, monthlyBudget, openAddIncome, openEditIncome, router]);

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
      payload.append("time", form.time);
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
      } else {
        setIncomes((current) => [savedIncome, ...current]);
      }
      Alert.alert(
        "Saved",
        editingIncomeId ? "Income updated." : "Income added.",
      );
      closeEditor();
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
    setPendingDelete(income);
  };

  const confirmDeleteIncome = async () => {
    if (!pendingDelete) return;
    const income = pendingDelete;
    setPendingDelete(null);
    try {
      await api.delete(`/incomes/${income.id}`);
      setIncomes((current) => current.filter((item) => item.id !== income.id));
      if (detailsIncome?.id === income.id) setDetailsIncome(null);
    } catch (error) {
      Alert.alert("Unable to delete income", getApiErrorMessage(error));
    }
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
      Alert.alert("Saved", "Monthly income budget saved.");
      if (router.canGoBack()) router.back();
      else setBudgetVisible(false);
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
    <SafeAreaView className="flex-1 bg-[#F2F5EA]" edges={["bottom"]}>
      <ConfirmPopup
        visible={pendingDelete !== null}
        type="delete"
        message={
          pendingDelete
            ? `Delete “${pendingDelete.title}”?`
            : undefined
        }
        onConfirm={confirmDeleteIncome}
        onCancel={() => setPendingDelete(null)}
      />
      <ConfirmPopup
        visible={successMessage !== null}
        type="success"
        message={successMessage ?? ""}
        onConfirm={() => setSuccessMessage(null)}
      />
      <StatusBar
        style="light"
      />
      <LinearGradient
        colors={Colors.greenGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          display: isNewIncomeRoute ? "none" : "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingHorizontal: 16,
          paddingBottom: 16,
          paddingTop: insets.top + 8,
        }}
      >
        <View className="flex-row items-center">
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
          <Text className="ml-3 text-lg font-bold text-white">
            Monthly Income
          </Text>
        </View>
      </LinearGradient>

      {isNewIncomeRoute ? null : loading ? (
        <CenteredPageLoader message="Loading income..." />
      ) : (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              if (!loading) void refreshIncome();
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
            label="Income Total"
            value={formatCompactAmount(totalIncome)}
            caption="Total income received"
            tone="total"
            icon="wallet-outline"
            topIcon="trending-up-outline"
            footerLabel="All records"
            badgeText="₹"
            cardWidth={metricCardWidth}
          />
          <Metric
            label="Income This Month"
            value={formatCompactAmount(monthlyIncome)}
            caption="Income received this month"
            tone="monthly"
            icon="cash-outline"
            topIcon="trending-up-outline"
            footerLabel="Current month"
            badgeText="₹"
            cardWidth={metricCardWidth}
          />
          <Metric
            label="Remaining Amount"
            value={formatCompactAmount(remainingIncome)}
            caption="Available income"
            tone="remaining"
            icon="wallet-outline"
            topIcon="pie-chart-outline"
            cardWidth={metricCardWidth}
          />
          <Metric
            label="Recurring Income"
            value={formatCompactAmount(recurringIncome)}
            caption="Recurring income received"
            tone="recurring"
            icon="repeat-outline"
            topIcon="flag-outline"
            cardWidth={metricCardWidth}
          />
        </View>
        <View className="mb-5 flex-row items-center justify-between rounded-2xl border border-[#E5E8E2] bg-white px-4 py-3.5">
          <View className="flex-row items-center">
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-[#FFF3E3]">
              <Ionicons name="wallet-outline" size={20} color="#B07837" />
            </View>
            <View>
              <Text className="text-xs font-bold uppercase tracking-[0.8px] text-[#859087]">
                Monthly budget
              </Text>
              <Text className="mt-0.5 text-lg font-extrabold text-[#293930]">
                {formatAmount(monthlyBudget)}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              router.push({ pathname: "/income", params: { form: "budget" } });
            }}
            className="flex-row items-center rounded-lg bg-[#EDF3EE] px-3 py-2"
          >
            <Ionicons name="create-outline" size={15} color="#315640" />
            <Text className="ml-1.5 text-xs font-bold text-[#315640]">
              Edit
            </Text>
          </Pressable>
        </View>

        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <Text className="text-lg font-bold text-[#293930]">
              Income records
            </Text>
            <Text className="mt-0.5 text-xs text-[#859087]">
              {incomes.length} {incomes.length === 1 ? "record" : "records"}
            </Text>
          </View>
          
        </View>

        <SearchBar
          value={search}
          onChangeText={(value) => {
            setSearch(value);
          }}
          placeholder="Search title, category, payment"
          activeFilterCount={
            countActiveFilters(filterValues) +
            (incomeFilter === "All Income" ? 0 : 1)
          }
          filterSheet={{
            currentFilters: filterValues,
            onApply: applyIncomeFilters,
            onReset: () => setIncomeFilter("All Income"),
            categories: incomeCategories,
            sections: ["date", "category", "amount", "sort", "viewMode"],
          }}
          style={{ marginBottom: 12 }}
        />

       

        {filteredIncomes.length === 0 ? (
          <View className="items-center rounded-2xl border border-[#E4E8E3] bg-white px-6 py-12">
            <Ionicons name="receipt-outline" size={34} color="#A4ADA6" />
            <Text className="mt-3 text-base font-bold text-[#25332C]">
              No income records found
            </Text>
            <Text className="mt-1 text-center text-sm text-[#7B8580]">
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
            {filteredIncomes.map((income) => (
              <View
                key={income.id}
                className={`mb-3 min-w-0 rounded-2xl border border-[#E4E8E3] bg-white ${viewMode === "grid" ? "w-[48%] p-3" : "w-full p-4"}`}
              >
                <View
                  className={`gap-2 ${viewMode === "grid" ? "flex-col items-start" : "flex-row items-start justify-between"}`}
                >
                  <View className="min-w-0 flex-1">
                    <Text
                      className="text-sm font-bold text-[#293930]"
                      numberOfLines={2}
                    >
                      {income.title}
                    </Text>
                    <Text
                      className="mt-1 text-xs font-medium text-[#818D84]"
                      numberOfLines={1}
                    >
                      {income.category || "Uncategorized"}
                    </Text>
                  </View>
                  <Text
                    className="text-sm font-extrabold text-[#25805A]"
                    style={{
                      flexShrink: 1,
                      marginTop: viewMode === "grid" ? 2 : 0,
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {formatAmount(income.remaining_amount ?? income.amount)}
                  </Text>
                </View>
                <Text
                  className="mt-2 text-xs font-medium text-[#7C8880]"
                  numberOfLines={viewMode === "grid" ? 2 : 1}
                >
                  {formatDate(income.income_date)} ·{" "}
                  {income.payment_method || "-"}
                </Text>
                <View
                  className={`mt-3 border-t border-[#EEF0ED] pt-3 ${viewMode === "grid" ? "gap-2" : "flex-row items-center justify-between"}`}
                >
                  <View className="flex-row flex-wrap items-center gap-2">
                    <View
                      className={`rounded-full px-2 py-1 ${income.recurring === "Yes" ? "bg-[#E7F4EC]" : "bg-[#F1F3F0]"}`}
                    >
                      <Text
                        className={`text-xs font-bold ${income.recurring === "Yes" ? "text-[#25805A]" : "text-[#758078]"}`}
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
                  <View
                    className="flex-row gap-2"
                    style={{ alignSelf: viewMode === "grid" ? "flex-end" : undefined }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${income.title}`}
                      className="h-8 w-8 items-center justify-center rounded-full bg-[#EEF3F8]"
                      onPress={() =>
                        router.push({
                          pathname: "/income",
                          params: { form: "edit", id: String(income.id) },
                        })
                      }
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

      </ScrollView>
      )}

      {!isNewIncomeRoute && (
        <AddButton
          onPress={() => navigateToAddPage("/income/new")}
          accessibilityLabel="Add income"
          accessibilityHint="Opens the new income form"
          bottomOffset={37}
        />
      )}

      {editorVisible && (
        <View
          className={isNewIncomeRoute ? "flex-1 bg-[#F8F9F6]" : "absolute inset-0 z-50 bg-[#F8F9F6]"}
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
              title={editingIncomeId ? "Edit Income" : "Add New Income"}
              onBack={closeEditor}
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
              <FormLabel>Income title *</FormLabel>
              <FormInput
                accessibilityLabel="Income title, required"
                autoCapitalize="sentences"
                borderColor="#AAB8AE"
                maxLength={100}
                placeholder="e.g. Freelance payment"
                returnKeyType="next"
                style={incomeFormStyles.input}
                value={form.title}
                onChangeText={(value) => updateForm("title", value)}
              />

              <View>
                <FormLabel>Amount *</FormLabel>
                <FormInput
                  accessibilityLabel="Amount, required"
                  borderColor="#AAB8AE"
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  returnKeyType="done"
                  style={incomeFormStyles.input}
                  value={form.amount}
                  onChangeText={(value) => updateForm("amount", value)}
                />
              </View>

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
                    value={parseLocalDateTime(form.date, form.time)}
                    onChange={(time) => {
                      if (time) updateForm("time", formatLocalTime(time));
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
                  form.category && !incomeCategories.includes(form.category)
                    ? [...incomeCategories, form.category]
                    : incomeCategories
                }
                value={form.category}
                loading={loading && incomeCategories.length === 0}
                onChange={(value) => updateForm("category", value)}
              />

              <PopupSelect
                label="Payment Method"
                placeholder="Select payment method"
                options={paymentMethods}
                value={form.paymentMethod}
                onChange={(value) => updateForm("paymentMethod", value)}
              />

              <FormLabel>Recurring Income</FormLabel>
              <View className="mb-4 flex-row gap-2">
                {(["Yes", "No"] as const).map((value) => (
                  <FormOption
                    key={value}
                    selected={form.recurring === value}
                    className={`flex-1 items-center rounded-xl py-3 ${form.recurring === value ? "bg-[#E7F0E8]" : "bg-white"}`}
                    onPress={() => updateForm("recurring", value)}
                  >
                    <FormLabel inline color={form.recurring === value ? "#315640" : "#637068"}>
                      {value}
                    </FormLabel>
                  </FormOption>
                ))}
              </View>

              <FormLabel>Notes</FormLabel>
              <FormInput
                accessibilityLabel="Income notes"
                borderColor="#AAB8AE"
                multiline
                placeholder="Add any useful details"
                style={[incomeFormStyles.input, incomeFormStyles.multilineInput]}
                value={form.notes}
                onChangeText={(value) => updateForm("notes", value)}
              />

              <FormLabel>Attachment / Receipt</FormLabel>
              {attachment ? (
                <UploadFilePreview
                  uri={attachment.uri}
                  name={attachment.name}
                  mimeType={attachment.mimeType}
                  onOpen={() => void openAttachment(attachment.uri)}
                  onRemove={() => setAttachment(null)}
                  removeLabel="Remove selected attachment"
                />
              ) : existingAttachment ? (
                <UploadFilePreview
                  uri={getAttachmentUrl(existingAttachment)}
                  name={existingAttachment.split(/[\\/]/).pop() || "Current receipt"}
                  onOpen={() => void openAttachment(existingAttachment)}
                />
              ) : null}
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
                  className="ml-2 flex-1 text-xs font-semibold text-[#59675F]"
                  numberOfLines={1}
                >
                  {attachment || existingAttachment
                    ? "Replace attachment"
                    : "Choose image or PDF"}
                </Text>
              </Pressable>
            </ScrollView>

            <View className="flex-row gap-3 pt-3">
              <Pressable
                className="flex-1 items-center rounded-xl border border-[#DDE3DC] bg-white py-3.5"
                disabled={saving}
                onPress={closeEditor}
              >
                <Text className="text-sm font-bold text-[#58645C]">Cancel</Text>
              </Pressable>
              <Pressable
                className="flex-1 flex-row items-center justify-center rounded-xl bg-[#315640] py-3.5"
                disabled={saving}
                onPress={() => void submitIncome()}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-sm font-bold text-white">
                    {editingIncomeId ? "Update income" : "Save income"}
                  </Text>
                )}
              </Pressable>
            </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {budgetVisible && (
        <View className="absolute inset-0 z-50 bg-[#F8F9F6] px-5 py-5" style={{ paddingBottom: insets.bottom }}>
          <View className="flex-1">
            <View className="mb-5 flex-row items-center justify-between">
              <Text className="text-xl font-bold text-[#25332C]">Monthly budget</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                className="h-9 w-9 items-center justify-center rounded-full bg-white"
                onPress={() => {
                  if (router.canGoBack()) router.back();
                  else setBudgetVisible(false);
                }}
              >
                <Ionicons name="arrow-back" size={20} color="#526058" />
              </Pressable>
            </View>
            <Text className="text-base font-semibold text-[#25332C]">
              Set your income budget
            </Text>
            <Text className="mb-4 mt-1 text-xs text-[#818B84]">
              Set your income budget for the month
            </Text>
            <FormInput
              accessibilityLabel="Monthly income budget"
              borderColor="#AAB8AE"
              keyboardType="decimal-pad"
              placeholder="0.00"
              style={incomeFormStyles.budgetInput}
              value={budgetDraft}
              onChangeText={setBudgetDraft}
            />
            <View className="flex-row gap-3">
              <Pressable
                className="flex-1 items-center rounded-xl border border-[#DDE3DC] bg-white py-3"
                disabled={budgetSaving}
                onPress={() => {
                  if (router.canGoBack()) router.back();
                  else setBudgetVisible(false);
                }}
              >
                <Text className="text-sm font-bold text-[#58645C]">Cancel</Text>
              </Pressable>
              <Pressable
                className="flex-1 items-center rounded-xl bg-[#315640] py-3"
                disabled={budgetSaving}
                onPress={() => void saveBudget()}
              >
                {budgetSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-sm font-bold text-white">
                    Save budget
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      )}

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
                <Text className="text-xs font-bold uppercase tracking-[1px] text-[#818B84]">
                  Income details
                </Text>
                <Text
                  className="mt-1 text-xl font-bold text-[#25332C]"
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
                <Text className="text-xs font-bold uppercase text-[#87918A]">
                  Category
                </Text>
                <Text className="mt-1 text-sm font-bold text-[#293930]">
                  {detailsIncome?.category || "-"}
                </Text>
              </View>
              <View className="flex-1 rounded-xl bg-white p-3">
                <Text className="text-xs font-bold uppercase text-[#87918A]">
                  Amount
                </Text>
                <Text className="mt-1 text-sm font-extrabold text-[#25805A]">
                  {formatAmount(detailsIncome?.amount)}
                </Text>
              </View>
            </View>
            <View className="mb-3 flex-row gap-3">
              <View className="flex-1 rounded-xl bg-white p-3">
                <Text className="text-xs font-bold uppercase text-[#87918A]">
                  Date
                </Text>
                <Text className="mt-1 text-sm font-bold text-[#293930]">
                  {formatDate(detailsIncome?.income_date)}
                </Text>
              </View>
              <View className="flex-1 rounded-xl bg-white p-3">
                <Text className="text-xs font-bold uppercase text-[#87918A]">
                  Payment
                </Text>
                <Text className="mt-1 text-sm font-bold text-[#293930]">
                  {detailsIncome?.payment_method || "-"}
                </Text>
              </View>
            </View>
            {!!detailsIncome?.notes && (
              <View className="mb-3 rounded-xl bg-white p-3">
                <Text className="text-xs font-bold uppercase text-[#87918A]">
                  Notes
                </Text>
                <Text className="mt-1 text-sm leading-5 text-[#526058]">
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
                <Text className="ml-2 text-sm font-bold text-white">
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
