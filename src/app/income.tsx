import Ionicons from "@expo/vector-icons/Ionicons";
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
import Svg, { Path } from "react-native-svg";
import api, {
  API_BASE_URL,
  getApiErrorMessage,
  getShared,
  logoutUser,
} from "../api";
import { AddButton } from "../components/AddButton";
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
import { CommonScreenHeader } from "../components/CommonScreenHeader";
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

type TransferRecord = {
  id: number | string;
  transfer_id?: number | string;
  transfer_date?: string;
  date?: string;
  from?: string;
  from_name?: string;
  source?: string;
  source_name?: string;
  source_income_id?: number | string | null;
  source_income_title?: string;
  sourceIncomeTitle?: string;
  to?: string;
  to_name?: string;
  destination?: string;
  destination_name?: string;
  target?: string;
  target_name?: string;
  title?: string;
  previous_amount?: number | string;
  previousAmount?: number | string;
  amount?: number | string;
  transfer_amount?: number | string;
  transferAmount?: number | string;
  added_amount?: number | string;
  addedAmount?: number | string;
  total_transferred?: number | string;
  totalTransferred?: number | string;
  remaining_amount?: number | string;
  remainingAmount?: number | string;
  purpose?: string;
  category?: string;
  reason?: string;
  created_by?: string | number;
  created_by_name?: string;
  createdBy?: string | number;
  created_at?: string;
  [key: string]: unknown;
};

type TransferHistoryRecord = {
  id?: number | string;
  created_at?: string;
  previous_amount?: number | string;
  added_amount?: number | string;
  amount?: number | string;
  transfer_amount?: number | string;
  purpose?: string;
  category?: string;
  reason?: string;
  notes?: string;
  adjustment?: TransferHistoryRecord;
  [key: string]: unknown;
};

type TransferFundingResult = {
  previous_amount?: number | string;
  added_amount?: number | string;
  total_transferred?: number | string;
  remaining_amount?: number | string;
  income_remaining_amount?: number | string;
};

type IncomeData = {
  incomes: IncomeRecord[];
  categories: string[];
  monthlyBudget: number;
};

export const incomeDataCache = createSessionDataCache<IncomeData>();

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

function getTransferHistoryRows(data: unknown): TransferHistoryRecord[] {
  const asRecord = (value: unknown): Record<string, unknown> | null =>
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const response = asRecord(data);
  const nested = asRecord(response?.data);
  const candidates = [
    data,
    response?.history,
    response?.adjustments,
    response?.data,
    nested?.history,
    nested?.adjustments,
    nested?.data,
  ];
  const rows = candidates.find(Array.isArray);
  if (!Array.isArray(rows)) return [];

  const getScalar = (
    record: Record<string, unknown>,
    keys: string[],
  ): string | number | undefined => {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" || typeof value === "number") {
        return value;
      }
    }
    return undefined;
  };
  const getText = (
    record: Record<string, unknown>,
    keys: string[],
  ): string | undefined => {
    const value = getScalar(record, keys);
    return value === undefined ? undefined : String(value);
  };

  return rows.flatMap((row): TransferHistoryRecord[] => {
    const record = asRecord(row);
    if (!record) return [];
    const adjustment = asRecord(record.adjustment);
    const source = adjustment ? { ...record, ...adjustment } : record;

    return [
      {
        id: getScalar(source, ["id"]),
        created_at: getText(source, ["created_at"]),
        transfer_date: getText(source, ["transfer_date"]),
        date: getText(source, ["date"]),
        previous_amount: getScalar(source, ["previous_amount"]),
        added_amount: getScalar(source, ["added_amount"]),
        amount: getScalar(source, ["amount"]),
        transfer_amount: getScalar(source, ["transfer_amount"]),
        purpose: getText(source, ["purpose"]),
        category: getText(source, ["category"]),
        reason: getText(source, ["reason"]),
        notes: getText(source, ["notes"]),
      },
    ];
  });
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

function getTransferValue(
  transfer: TransferRecord | TransferHistoryRecord,
  keys: string[],
) {
  for (const key of keys) {
    const value = transfer[key];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value);
    }
  }
  return "";
}

function transferDateValue(transfer: TransferRecord | TransferHistoryRecord) {
  const value = getTransferValue(transfer, [
    "transfer_date",
    "transferDate",
    "date",
    "transaction_date",
    "created_at",
  ]);
  if (!value) return "";
  const parsed = parseLocalDate(value) ?? parseLocalDateTimeValue(value);
  return parsed ? formatLocalDate(parsed) : value.split("T")[0];
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
  const [returnToIncomeAfterSuccess, setReturnToIncomeAfterSuccess] =
    useState(false);
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
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [transferCategories, setTransferCategories] = useState<string[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [transferPanelVisible, setTransferPanelVisible] = useState(false);
  const [selectedTransfer, setSelectedTransfer] =
    useState<TransferRecord | null>(null);
  const [transferHistory, setTransferHistory] = useState<
    TransferHistoryRecord[]
  >([]);
  const [fundingResult, setFundingResult] =
    useState<TransferFundingResult | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [funding, setFunding] = useState(false);
  const [selectedFundingIncomeId, setSelectedFundingIncomeId] = useState("");
  const [fundingAmount, setFundingAmount] = useState("");
  const [fundingPurpose, setFundingPurpose] = useState("");
  const [fundingReason, setFundingReason] = useState("");
  const [fundingDate, setFundingDate] = useState(formatLocalDate(new Date()));
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [transferToast, setTransferToast] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  const selectedFundingIncome =
    incomes.find(
      (income) => String(income.id) === selectedFundingIncomeId,
    ) ?? null;
  const fundingAvailableBalance = Number(
    selectedFundingIncome?.remaining_amount ?? selectedFundingIncome?.amount ?? 0,
  );

  useEffect(() => {
    if (!transferToast) return;
    const timeout = setTimeout(() => setTransferToast(null), 3500);
    return () => clearTimeout(timeout);
  }, [transferToast]);

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
        const [incomeResult, categoryResult, budgetResult] =
          await Promise.allSettled([
            getShared("/incomes"),
            getShared("/categories"),
            getShared("/incomes/monthly-budget"),
          ]);
        if (incomeResult.status === "rejected") throw incomeResult.reason;
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
          incomes: getRows(incomeResult.value.data, "incomes"),
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

  const fetchTransfers = useCallback(async (
    showLoading = true,
  ): Promise<TransferRecord[] | null> => {
    if (showLoading) setTransfersLoading(true);
    try {
      const [transferResult, categoryResult] = await Promise.allSettled([
        api.get("/transfers"),
        getShared("/categories"),
      ]);
      if (transferResult.status === "rejected") throw transferResult.reason;
      const records = getRows(
        transferResult.value.data,
        "transfers",
      ) as TransferRecord[];
      const categoryNames =
        categoryResult.status === "fulfilled"
          ? getRows(categoryResult.value.data, "categories")
              .filter((category: any) => {
                if (typeof category === "string") return false;
                const type = String(
                  category?.catType ||
                    category?.type ||
                    category?.category_type ||
                    "",
                ).toLowerCase();
                const name = String(category?.name || "").toLowerCase();
                return (
                  type.includes("transfer") ||
                  ["transfer", "saving", "investment"].some((keyword) =>
                    name.includes(keyword),
                  )
                );
              })
              .map((category: any) => String(category.name || "").trim())
              .filter(Boolean)
          : [];
      const recordPurposes = records
        .map((transfer) =>
          getTransferValue(transfer, ["purpose", "category"]),
        )
        .filter(Boolean);
      const purposes = Array.from(
        new Set([...categoryNames, ...recordPurposes]),
      );
      setTransfers(records);
      setTransferCategories(purposes);
      setSelectedTransfer((current) =>
        current
          ? records.find(
              (transfer) => String(transfer.id) === String(current.id),
            ) ?? current
          : null,
      );
      return records;
    } catch (error) {
      const status =
        (error as { status?: number; response?: { status?: number } })?.status ||
        (error as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        await handleUnauthorized();
        return null;
      }
      setTransferToast({
        kind: "error",
        message: getApiErrorMessage(error, "Unable to load transfers."),
      });
      return null;
    } finally {
      if (showLoading) setTransfersLoading(false);
    }
  }, [handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      void fetchTransfers();
    }, [fetchTransfers]),
  );

  const showTransferList = () => {
    setFabMenuOpen(false);
    setSelectedTransfer(null);
    setTransferPanelVisible(true);
    void fetchTransfers();
  };

  const openTransferDetails = async (transfer: TransferRecord) => {
    setSelectedTransfer(transfer);
    setTransferHistory([]);
    setFundingResult(null);
    setSelectedFundingIncomeId("");
    setFundingAmount("");
    setFundingPurpose(
      getTransferValue(transfer, ["purpose", "category"]),
    );
    setFundingReason("");
    const savedTransferDate = transferDateValue(transfer);
    const parsedTransferDate =
      parseLocalDate(savedTransferDate) ??
      parseLocalDateTimeValue(savedTransferDate);
    setFundingDate(formatLocalDate(parsedTransferDate ?? new Date()));
    setHistoryLoading(true);
    try {
      const response = await api.get(
        `/transfers/${transfer.id}/history`,
      );
      setTransferHistory(getTransferHistoryRows(response.data));
    } catch (error) {
      const status =
        (error as { status?: number; response?: { status?: number } })?.status ||
        (error as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        await handleUnauthorized();
        return;
      }
      setTransferToast({
        kind: "error",
        message: getApiErrorMessage(error, "Unable to load transfer history."),
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  const submitTransferFunding = async () => {
    if (!selectedTransfer) return;
    const amount = Number(fundingAmount);
    const transferDate = fundingDate;
    if (!selectedFundingIncomeId) {
      setTransferToast({ kind: "error", message: "Select an income source." });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setTransferToast({
        kind: "error",
        message: "Enter a transfer amount greater than zero.",
      });
      return;
    }
    if (amount > fundingAvailableBalance) {
      setTransferToast({
        kind: "error",
        message: `Amount exceeds available income balance (${formatAmount(fundingAvailableBalance)}).`,
      });
      return;
    }
    if (!fundingPurpose.trim()) {
      setTransferToast({ kind: "error", message: "Select a purpose." });
      return;
    }
    if (!fundingReason.trim()) {
      setTransferToast({ kind: "error", message: "Enter a reason." });
      return;
    }
    if (!parseLocalDate(transferDate)) {
      setTransferToast({ kind: "error", message: "Select a transfer date." });
      return;
    }

    setFunding(true);
    try {
      const fundingResponse = await api.post(
        `/transfers/${selectedTransfer.id}/fund-from-income`,
        {
          incomeId: Number(selectedFundingIncomeId),
          amount,
          purpose: fundingPurpose.trim(),
          reason: fundingReason.trim(),
          date: transferDate,
        },
      );
      const result = (
        fundingResponse.data?.data ?? fundingResponse.data
      ) as TransferFundingResult & {
        adjustment?: TransferHistoryRecord;
        transfer?: TransferRecord;
        message?: string;
      };
      const adjustment = result.adjustment ?? {};
      const updatedTransfer = result.transfer;
      const confirmedAmounts: TransferFundingResult = {
        previous_amount:
          result.previous_amount ??
          adjustment.previous_amount,
        added_amount:
          adjustment.added_amount ??
          adjustment.amount ??
          amount,
        total_transferred:
          result.total_transferred ??
          updatedTransfer?.amount ??
          selectedTransfer.amount,
        remaining_amount:
          updatedTransfer?.remaining_amount ??
          result.remaining_amount ??
          selectedTransfer.remaining_amount,
        income_remaining_amount: result.income_remaining_amount,
      };
      setFundingResult(confirmedAmounts);
      if (updatedTransfer) {
        setSelectedTransfer((current) =>
          current
            ? {
                ...current,
                ...updatedTransfer,
                previous_amount: confirmedAmounts.previous_amount,
                total_transferred: confirmedAmounts.total_transferred,
                remaining_amount: confirmedAmounts.remaining_amount,
              }
            : current,
        );
      }
      if (result.income_remaining_amount !== undefined) {
        setIncomes((current) =>
          current.map((income) =>
            String(income.id) === selectedFundingIncomeId
              ? {
                  ...income,
                  remaining_amount: result.income_remaining_amount,
                }
              : income,
          ),
        );
      }
      incomeDataCache.clear();
      const [, refreshedTransfers] = await Promise.all([
        fetchIncome(false),
        fetchTransfers(false),
      ]);
      const refreshedTransfer = refreshedTransfers?.find(
        (transfer) => String(transfer.id) === String(selectedTransfer.id),
      );
      if (refreshedTransfer) {
        setSelectedTransfer((current) =>
          current
            ? {
                ...current,
                ...refreshedTransfer,
                previous_amount: confirmedAmounts.previous_amount,
                total_transferred: confirmedAmounts.total_transferred,
                remaining_amount: confirmedAmounts.remaining_amount,
              }
            : current,
        );
      }
      try {
        const historyResponse = await api.get(
          `/transfers/${selectedTransfer.id}/history`,
        );
        setTransferHistory(getTransferHistoryRows(historyResponse.data));
      } catch (error) {
        const status =
          (error as { status?: number; response?: { status?: number } })
            ?.status ||
          (error as { response?: { status?: number } })?.response?.status;
        if (status === 401) {
          await handleUnauthorized();
          return;
        }
        setTransferToast({
          kind: "error",
          message: "Transfer funded, but its history could not be refreshed.",
        });
      }
      setSelectedFundingIncomeId("");
      setFundingAmount("");
      setFundingReason("");
      setReturnToIncomeAfterSuccess(true);
      setSuccessMessage(result.message ?? "Transfer funded successfully.");
    } catch (error) {
      const status =
        (error as { status?: number; response?: { status?: number } })?.status ||
        (error as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        await handleUnauthorized();
        return;
      }
      setTransferToast({
        kind: "error",
        message: getApiErrorMessage(error, "Unable to fund this transfer."),
      });
    } finally {
      setFunding(false);
    }
  };

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
    const isEditing = editingIncomeId !== null;
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

      const response = isEditing
        ? await api.put(`/incomes/${editingIncomeId}`, payload, {
            headers: { "Content-Type": "multipart/form-data" },
          })
        : await api.post("/incomes", payload, {
            headers: { "Content-Type": "multipart/form-data" },
          });
      const savedIncome = response.data?.income || response.data;

      if (isEditing) {
        setIncomes((current) =>
          current.map((income) =>
            String(income.id) === String(editingIncomeId)
              ? savedIncome
              : income,
          ),
        );
        incomeDataCache.clear();
      } else {
        setIncomes((current) => [savedIncome, ...current]);
      }
      setSuccessMessage(
        isEditing ? "Income updated successfully." : "Income added successfully.",
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
      setSuccessMessage("Income deleted successfully.");
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
      setSuccessMessage("Monthly income budget saved.");
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
    <SafeAreaView
      className="flex-1 bg-[#F2F5EA]"
      edges={["bottom"]}
    >
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
        onConfirm={() => {
          setSuccessMessage(null);
          if (returnToIncomeAfterSuccess) {
            setReturnToIncomeAfterSuccess(false);
            setSelectedTransfer(null);
            setTransferPanelVisible(false);
          }
        }}
      />
      {isNewIncomeRoute ? null : (
        <CommonScreenHeader
          title="Monthly Income"
          onBack={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/tabs/more");
          }}
        />
      )}

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
        <>
          {fabMenuOpen ? (
            <View
              style={{
                position: "absolute",
                right: 18,
                bottom: insets.bottom + 66,
                zIndex: 11,
                gap: 10,
              }}
            >
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setFabMenuOpen(false);
                  navigateToAddPage("/income/new");
                }}
                className="flex-row items-center rounded-full bg-white px-4 py-3"
                style={{ elevation: 5 }}
              >
                <Ionicons name="wallet-outline" size={18} color="#315640" />
                <Text className="ml-2 text-sm font-bold text-[#293930]">
                  Add Income
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={showTransferList}
                className="flex-row items-center rounded-full bg-white px-4 py-3"
                style={{ elevation: 5 }}
              >
                <Ionicons name="swap-horizontal-outline" size={18} color="#315640" />
                <Text className="ml-2 text-sm font-bold text-[#293930]">
                  Add Transfer
                </Text>
              </Pressable>
            </View>
          ) : null}
          <AddButton
            onPress={() => setFabMenuOpen((open) => !open)}
            accessibilityLabel="Open add actions"
            accessibilityHint="Choose Add Income or Add Transfer"
            bottomOffset={2}
          />
        </>
      )}

      {editorVisible && (
        <View
          className={isNewIncomeRoute ? "flex-1 bg-[#F8F9F6]" : "absolute inset-0 z-50 bg-[#F8F9F6]"}
          style={{ paddingBottom: insets.bottom }}
        >
          <CommonScreenHeader
            title={editingIncomeId === null ? "Add Income" : "Edit Income"}
            disabled={saving}
            onBack={closeEditor}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={0}
            style={{ flex: 1 }}
          >
            <View
              className="flex-1 bg-[#F8F9F6] px-5 pb-5"
            >
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
                <View className="flex-row gap-3 pt-3 pb-2">
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
                    {editingIncomeId !== null ? "Update income" : "Save income"}
                  </Text>
                )}
              </Pressable>
              </View>
            </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {budgetVisible && (
        <View className="absolute inset-0 z-50 bg-[#F8F9F6] px-5 py-5" style={{ paddingBottom: insets.bottom }}>
          <View className="flex-1">
            <CommonScreenHeader
              title="Monthly budget"
              showStatusBar={false}
              onBack={() => setBudgetVisible(false)}
              style={{ marginHorizontal: -20, marginTop: -20 }}
            />
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
                onPress={() => setBudgetVisible(false)}
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

      {transferPanelVisible ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 20,
            backgroundColor: "#F8F9F6",
          }}
        >
          <CommonScreenHeader
            title={
              selectedTransfer
                ? `Transfer #${selectedTransfer.transfer_id ?? selectedTransfer.id}`
                : "Transfers"
            }
            onBack={() => {
              if (selectedTransfer) setSelectedTransfer(null);
              else setTransferPanelVisible(false);
            }}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <View
              className="flex-1 bg-[#F8F9F6] px-5 pt-4"
              style={{ paddingBottom: Math.max(insets.bottom, 20) }}
            >
              {transferToast ? (
                <View
                  accessibilityRole="alert"
                  className={`mb-3 flex-row items-center rounded-xl px-3 py-2.5 ${
                    transferToast.kind === "success"
                      ? "bg-[#E7F4EC]"
                      : "bg-[#FFF0EF]"
                  }`}
                >
                  <Ionicons
                    name={
                      transferToast.kind === "success"
                        ? "checkmark-circle"
                        : "alert-circle"
                    }
                    size={18}
                    color={
                      transferToast.kind === "success" ? "#25805A" : "#B64C45"
                    }
                  />
                  <Text
                    className={`ml-2 flex-1 text-sm font-semibold ${
                      transferToast.kind === "success"
                        ? "text-[#236443]"
                        : "text-[#9E3933]"
                    }`}
                  >
                    {transferToast.message}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss notification"
                    onPress={() => setTransferToast(null)}
                  >
                    <Ionicons name="close" size={17} color="#7B8580" />
                  </Pressable>
                </View>
              ) : null}

              {selectedTransfer === null ? (
                <ScrollView
                  style={{ flex: 1 }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 8 }}
                >
                  {transfersLoading ? (
                    <View className="flex-row items-center justify-center py-10">
                      <ActivityIndicator color={Colors.primary} />
                      <Text className="ml-2 text-sm font-semibold text-[#68736E]">
                        Loading transfers...
                      </Text>
                    </View>
                  ) : transfers.length === 0 ? (
                    <View className="items-center rounded-2xl bg-white px-5 py-9">
                      <Ionicons
                        name="swap-horizontal-outline"
                        size={30}
                        color="#9AA39D"
                      />
                      <Text className="mt-3 text-sm font-bold text-[#293930]">
                        No transfers available
                      </Text>
                    </View>
                  ) : (
                    transfers.map((transfer) => {
                      const sourceIncomeTitle =
                        incomes.find(
                          (income) =>
                            String(income.id) ===
                            String(transfer.source_income_id ?? ""),
                        )?.title;
                      const transferRows = [
                        [
                          "Transfer ID",
                          getTransferValue(transfer, ["transfer_id", "id"]),
                        ],
                        ["Date", formatDate(transferDateValue(transfer))],
                        [
                          "From",
                          getTransferValue(transfer, [
                            "from",
                            "from_name",
                            "source",
                            "source_name",
                            "source_income_title",
                            "sourceIncomeTitle",
                          ]) ||
                            sourceIncomeTitle ||
                            (transfer.source_income_id
                              ? String(transfer.source_income_id)
                              : "-"),
                        ],
                        [
                          "To",
                          getTransferValue(transfer, [
                            "to",
                            "to_name",
                            "destination",
                            "destination_name",
                            "target",
                            "target_name",
                          ]) || "-",
                        ],
                        [
                          "Previous Amount",
                          formatAmount(
                            getTransferValue(transfer, [
                              "previous_amount",
                              "previousAmount",
                            ]),
                          ),
                        ],
                        [
                          "Transfer Amount",
                          formatAmount(
                            getTransferValue(transfer, [
                              "transfer_amount",
                              "transferAmount",
                              "amount",
                            ]),
                          ),
                        ],
                        [
                          "Remaining Amount",
                          formatAmount(
                            getTransferValue(transfer, [
                              "remaining_amount",
                              "remainingAmount",
                            ]),
                          ),
                        ],
                        [
                          "Purpose",
                          getTransferValue(transfer, ["purpose", "category"]) ||
                            "-",
                        ],
                        [
                          "Created By",
                          getTransferValue(transfer, [
                            "created_by_name",
                            "created_by",
                            "createdBy",
                          ]) || "-",
                        ],
                      ];

                      return (
                        <Pressable
                          key={String(transfer.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`View transfer ${transfer.transfer_id ?? transfer.id}`}
                          onPress={() => void openTransferDetails(transfer)}
                          className="mb-3 rounded-2xl border border-[#E5E8E2] bg-white p-4"
                        >
                          <View className="mb-3 flex-row items-center justify-between">
                            <Text className="text-base font-bold text-[#293930]">
                              Transfer #{transfer.transfer_id ?? transfer.id}
                            </Text>
                            <Ionicons
                              name="chevron-forward"
                              size={18}
                              color="#7B8580"
                            />
                          </View>
                          <View className="flex-row flex-wrap">
                            {transferRows.map(([label, value]) => (
                              <View
                                key={label}
                                className="mb-2 w-1/2 pr-2"
                              >
                                <Text className="text-[10px] font-bold uppercase text-[#87918A]">
                                  {label}
                                </Text>
                                <Text
                                  className="mt-0.5 text-xs font-semibold text-[#293930]"
                                  numberOfLines={2}
                                >
                                  {value}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                 
                </ScrollView>
              ) : (
                <ScrollView
                  style={{ flex: 1 }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 12 }}
                >
                  <View className="mb-3 flex-row flex-wrap">
                    {[
                      [
                        "Date",
                        formatDate(transferDateValue(selectedTransfer)),
                      ],
                      [
                        "From",
                        getTransferValue(selectedTransfer, [
                          "from",
                          "from_name",
                          "source",
                          "source_name",
                          "source_income_title",
                          "sourceIncomeTitle",
                        ]) ||
                          incomes.find(
                            (income) =>
                              String(income.id) ===
                              String(selectedTransfer.source_income_id ?? ""),
                          )?.title ||
                          "-",
                      ],
                      [
                        "To",
                        getTransferValue(selectedTransfer, [
                          "to",
                          "to_name",
                          "destination",
                          "destination_name",
                          "target",
                          "target_name",
                        ]) || "-",
                      ],
                      [
                        "Purpose",
                        getTransferValue(selectedTransfer, [
                          "purpose",
                          "category",
                        ]) || "-",
                      ],
                      [
                        "Created By",
                        getTransferValue(selectedTransfer, [
                          "created_by_name",
                          "created_by",
                          "createdBy",
                        ]) || "-",
                      ],
                    ].map(([label, value]) => (
                      <View key={label} className="mb-3 w-1/2 pr-2">
                        <Text className="text-[10px] font-bold uppercase text-[#87918A]">
                          {label}
                        </Text>
                        <Text className="mt-0.5 text-sm font-semibold text-[#293930]">
                          {value}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View className="mb-4 flex-row flex-wrap gap-2">
                    {[
                      [
                        "Previous Amount",
                        fundingResult?.previous_amount ??
                        selectedTransfer.previous_amount ??
                          selectedTransfer.previousAmount ??
                          0,
                      ],
                      [
                        "Added Amount",
                        fundingResult?.added_amount ??
                        selectedTransfer.added_amount ??
                          selectedTransfer.addedAmount ??
                          selectedTransfer.transfer_amount ??
                          selectedTransfer.transferAmount ??
                          selectedTransfer.amount ??
                          0,
                      ],
                      [
                        "Total Transferred",
                        fundingResult?.total_transferred ??
                        selectedTransfer.total_transferred ??
                          selectedTransfer.totalTransferred ??
                          selectedTransfer.amount ??
                          0,
                      ],
                      [
                        "Remaining Amount",
                        fundingResult?.remaining_amount ??
                        selectedTransfer.remaining_amount ??
                          selectedTransfer.remainingAmount ??
                          0,
                      ],
                    ].map(([label, value]) => (
                      <View
                        key={label}
                        className="min-w-[46%] flex-1 rounded-xl bg-white p-3"
                      >
                        <Text className="text-[10px] font-bold uppercase text-[#87918A]">
                          {label}
                        </Text>
                        <Text className="mt-1 text-sm font-extrabold text-[#293930]">
                          {formatAmount(String(value))}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View className="mb-4 rounded-2xl bg-white p-4">
                    <View className="mb-3 flex-row items-center justify-between">
                      <Text className="text-sm font-bold text-[#293930]">
                        Transfer history
                      </Text>
                      {historyLoading ? (
                        <ActivityIndicator
                          size="small"
                          color={Colors.primary}
                        />
                      ) : null}
                    </View>
                    {historyLoading ? (
                      <Text className="text-xs text-[#818D84]">
                        Loading history...
                      </Text>
                    ) : transferHistory.length === 0 ? (
                      <Text className="text-xs text-[#818D84]">
                        No history records.
                      </Text>
                    ) : (
                      transferHistory.map((history, index) => (
                        <View
                          key={`transfer-history-${index}-${String(
                            history.id ?? history.created_at ?? "record",
                          )}`}
                          className="border-t border-[#EEF0ED] py-3"
                        >
                          <View className="flex-row justify-between">
                            <Text className="text-xs font-bold text-[#293930]">
                              {formatAmount(
                                getTransferValue(history, [
                                  "added_amount",
                                  "amount",
                                  "transfer_amount",
                                ]),
                              )}
                            </Text>
                            <Text className="text-xs text-[#818D84]">
                              {formatDate(transferDateValue(history))}
                            </Text>
                          </View>
                          <Text className="mt-1 text-xs text-[#68736E]">
                            {getTransferValue(history, ["purpose", "category"]) ||
                              "-"}
                            {getTransferValue(history, ["reason", "notes"])
                              ? ` · ${getTransferValue(history, ["reason", "notes"])}`
                              : ""}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>

                  <Text className="mb-2 text-base font-bold text-[#293930]">
                    Fund from income
                  </Text>
                  <PopupSelect
                    label="Income source"
                    placeholder="Select income source"
                    required
                    options={incomes.map((income) => ({
                      label: income.title,
                      value: String(income.id),
                      description: `${formatAmount(income.remaining_amount ?? income.amount)} available`,
                    }))}
                    value={selectedFundingIncomeId}
                    onChange={setSelectedFundingIncomeId}
                  />
                  {selectedFundingIncome ? (
                    <View className="mb-3 rounded-xl bg-[#EAF5EC] px-3 py-2.5">
                      <Text className="text-xs font-semibold text-[#526058]">
                        Available income balance
                      </Text>
                      <Text className="mt-0.5 text-sm font-extrabold text-[#25805A]">
                        {formatAmount(fundingAvailableBalance)}
                      </Text>
                    </View>
                  ) : null}
                  <FormLabel>Additional transfer amount *</FormLabel>
                  <FormInput
                    accessibilityLabel="Additional transfer amount"
                    borderColor="#AAB8AE"
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    value={fundingAmount}
                    onChangeText={setFundingAmount}
                    style={incomeFormStyles.input}
                  />
                  <PopupSelect
                    label="Purpose"
                    placeholder="Select purpose"
                    required
                    options={
                      fundingPurpose &&
                      !transferCategories.includes(fundingPurpose)
                        ? [...transferCategories, fundingPurpose]
                        : transferCategories
                    }
                    value={fundingPurpose}
                    onChange={setFundingPurpose}
                  />
                  <FormLabel>Reason *</FormLabel>
                  <FormInput
                    accessibilityLabel="Transfer reason"
                    borderColor="#AAB8AE"
                    multiline
                    placeholder="Enter reason for this transfer"
                    value={fundingReason}
                    onChangeText={setFundingReason}
                    style={[
                      incomeFormStyles.input,
                      incomeFormStyles.multilineInput,
                    ]}
                  />
                  <DateTimePickerComponent
                    mode="date"
                    compact
                    value={parseLocalDate(fundingDate)}
                    onChange={(date) => {
                      if (date) setFundingDate(formatLocalDate(date));
                    }}
                    label="Transfer Date"
                    placeholder="Select transfer date"
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: funding, busy: funding }}
                    disabled={funding}
                    onPress={() => void submitTransferFunding()}
                    className="mb-2 min-h-12 flex-row items-center justify-center rounded-xl bg-[#315640] px-4 py-3"
                    style={{ opacity: funding ? 0.7 : 1 }}
                  >
                    {funding ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text className="text-sm font-bold text-white">
                        Fund transfer
                      </Text>
                    )}
                  </Pressable>
                </ScrollView>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      ) : null}

      {transferToast && !transferPanelVisible ? (
        <View
          accessibilityRole="alert"
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: insets.top + 10,
            left: 16,
            right: 16,
            zIndex: 30,
          }}
        >
          <View
            className={`flex-row items-center rounded-xl px-3 py-3 ${
              transferToast.kind === "success" ? "bg-[#E7F4EC]" : "bg-[#FFF0EF]"
            }`}
          >
            <Text className="flex-1 text-sm font-semibold text-[#293930]">
              {transferToast.message}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss notification"
              onPress={() => setTransferToast(null)}
            >
              <Ionicons name="close" size={17} color="#7B8580" />
            </Pressable>
          </View>
        </View>
      ) : null}

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
