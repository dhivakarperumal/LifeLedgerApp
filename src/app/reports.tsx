import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import { LinearGradient } from "expo-linear-gradient";
import * as Print from "expo-print";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    Share,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import api, { getApiErrorMessage, logoutUser } from "../api";
import { CenteredPageLoader } from "../components/CenteredPageLoader";
import {
    createDateRangeSelection,
    isDateInRange,
    type DateRangeSelection,
} from "../components/DateRangeFilter";
import { GradientSafeAreaView as SafeAreaView } from "../components/GradientSafeAreaView";
import { SearchBar } from "../components/SearchBar";
import { createSessionDataCache } from "../components/SessionDataCache";
import { formatLocalDate, parseLocalDate } from "../components/dateTimeUtils";
import {
    countActiveFilters,
    DEFAULT_FILTER_STATE,
    type FilterState,
    type SortOption,
} from "../components/filters";
import { Colors } from "../constants/colors";

type ReportType = "expense" | "transfer";
type ReportRecord = {
  id: number | string;
  title: string;
  category?: string;
  payment_method?: string;
  paymentMethod?: string;
  notes?: string;
  recurring?: string;
  expense_amount?: number | string;
  amount?: number | string;
  remaining_amount?: number | string;
  expense_date?: string;
  transfer_date?: string;
  _type: ReportType;
  _date?: string;
};

type ReportsData = {
  expenses: ReportRecord[];
  transfers: ReportRecord[];
};

const reportsDataCache = createSessionDataCache<ReportsData>();

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
  const date = parseLocalDate(value);
  if (!date) return value.split("T")[0];
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function getRecordAmount(record: ReportRecord) {
  return record._type === "expense"
    ? Number(record.expense_amount || 0)
    : Number(record.amount || 0);
}

type MetricTone =
  "report" | "expense" | "transfer" | "spent" | "moved" | "remaining";

const metricPalettes = {
  report: {
    background: "#FCFBFF",
    border: "#EBE6F8",
    icon: ["#B39AFF", "#7651E8"] as const,
    value: "#3824BD",
    caption: "#7F8792",
    waveBack: "#EEEAFE",
    waveFront: "#DDD7FF",
    accent: "#8A68F4",
    badge: "#ECE8FF",
  },
  expense: {
    background: "#FBFFFC",
    border: "#E4F0E8",
    icon: ["#77E881", "#16B852"] as const,
    value: "#0D5425",
    caption: "#818B89",
    waveBack: "#E2F8E5",
    waveFront: "#C8F1CF",
    accent: "#45C96A",
    badge: "#E0F7E4",
  },
  transfer: {
    background: "#FAFCFF",
    border: "#E3EAF5",
    icon: ["#8FC0FF", "#2877E9"] as const,
    value: "#1248AA",
    caption: "#7D8A98",
    waveBack: "#E7F1FF",
    waveFront: "#D1E5FF",
    accent: "#438EEB",
    badge: "#E1EEFF",
  },
  spent: {
    background: "#FFFCF8",
    border: "#F2E8DB",
    icon: ["#FFAA3D", "#F57A00"] as const,
    value: "#A9410D",
    caption: "#878A8D",
    waveBack: "#FFF0DB",
    waveFront: "#FFE1B9",
    accent: "#F5A32D",
    badge: "#FFF0D8",
  },
  moved: {
    background: "#FFFAFC",
    border: "#F1E4EA",
    icon: ["#FF90B0", "#F33168"] as const,
    value: "#BE153F",
    caption: "#88868D",
    waveBack: "#FCE8EF",
    waveFront: "#F8D1DF",
    accent: "#EC537E",
    badge: "#FCE5EC",
  },
  remaining: {
    background: "#F8FFFD",
    border: "#DFF0EC",
    icon: ["#48E3CE", "#02A994"] as const,
    value: "#0E4F49",
    caption: "#828E8B",
    waveBack: "#DEF6F1",
    waveFront: "#C4EEE7",
    accent: "#35CDB9",
    badge: "#DFF7F2",
  },
} as const;

function Metric({
  label,
  value,
  caption,
  icon,
  tone,
  cardWidth,
}: {
  label: string;
  value: string;
  caption: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: MetricTone;
  cardWidth: number;
}) {
  const palette = metricPalettes[tone];
  const compact = cardWidth < 160;
  const iconSize = compact ? 28 : 34;
  const secondaryIconSize = compact ? 22 : 28;
  const cardHeight = 120;

  return (
    <View
      style={{
        width: cardWidth,
        height: cardHeight,
        paddingHorizontal: compact ? 10 : 14,
        paddingVertical: 6,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: 20,
        backgroundColor: palette.background,
        shadowColor: "#26352A",
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
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
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
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
        numberOfLines={2}
        style={{
          marginTop: 1,
          color: "#17221A",
          fontSize: compact ? 9 : 12,
          lineHeight: compact ? 10 : 14,
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
          fontSize: compact ? 15 : 24,
          lineHeight: compact ? 17 : 26,
          fontWeight: "900",
        }}
      >
        {value}
      </Text>
      <Text
        numberOfLines={compact ? 1 : 2}
        style={{
          maxWidth: compact ? "100%" : "74%",
          marginTop: 0,
          color: palette.caption,
          fontSize: compact ? 8 : 10,
          lineHeight: compact ? 9 : 12,
          fontWeight: "500",
        }}
      >
        {caption}
      </Text>
      {cardWidth >= 160 ? (
        <Svg
          width={32}
          height={25}
          viewBox="0 0 40 32"
          pointerEvents="none"
          style={{ position: "absolute", right: 8, bottom: 7 }}
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
      ) : null}
    </View>
  );
}

export default function Reports() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const metricCardWidth = Math.min(500, (screenWidth - 36 - 28) / 3);
  const [expenses, setExpenses] = useState<ReportRecord[]>(
    () => reportsDataCache.get()?.expenses ?? [],
  );
  const [transfers, setTransfers] = useState<ReportRecord[]>(
    () => reportsDataCache.get()?.transfers ?? [],
  );
  const [loading, setLoading] = useState(() => !reportsDataCache.hasData());
  const [refreshing, setRefreshing] = useState(false);
  const [reportType, setReportType] = useState<"all" | ReportType>("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [dateRange, setDateRange] = useState<DateRangeSelection>(() =>
    createDateRangeSelection("All"),
  );
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [sort, setSort] = useState<SortOption>(DEFAULT_FILTER_STATE.sort);
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null);

  const filterValues = useMemo<FilterState>(
    () => ({
      ...DEFAULT_FILTER_STATE,
      dateRange,
      category: categoryFilter === "All" ? "" : categoryFilter,
      amountMin,
      amountMax,
      sort,
      viewMode: viewMode === "grid" ? "card" : "table",
      custom: { paymentMethod: paymentFilter },
    }),
    [dateRange, categoryFilter, amountMin, amountMax, sort, viewMode, paymentFilter],
  );

  const applyReportFilters = (filters: FilterState) => {
    setDateRange(filters.dateRange);
    setCategoryFilter(filters.category || "All");
    setAmountMin(filters.amountMin);
    setAmountMax(filters.amountMax);
    setSort(filters.sort);
    setViewMode(filters.viewMode === "card" ? "grid" : "list");
    setPaymentFilter(filters.custom?.paymentMethod || "All");
  };

  const handleUnauthorized = useCallback(async () => {
    await logoutUser();
    router.replace("/auth/login");
  }, [router]);

  const fetchAll = useCallback(async (
    showLoading = !reportsDataCache.hasData(),
  ) => {
    if (showLoading && !reportsDataCache.hasData()) setLoading(true);
    try {
      const data = await reportsDataCache.load(async () => {
        const [expenseResponse, transferResponse] = await Promise.all([
          api.get("/expenses"),
          api.get("/transfers"),
        ]);
        return {
          expenses: getRows(expenseResponse.data, "expenses").map(
            (record: any) => ({
              ...record,
              _type: "expense" as const,
              _date: record.expense_date,
            }),
          ),
          transfers: getRows(transferResponse.data, "transfers").map(
            (record: any) => ({
              ...record,
              _type: "transfer" as const,
              _date: record.transfer_date,
            }),
          ),
        };
      });
      setExpenses(data.expenses);
      setTransfers(data.transfers);
    } catch (error) {
      if ((error as { status?: number })?.status === 401) {
        await handleUnauthorized();
        return;
      }
      Alert.alert("Unable to load reports", getApiErrorMessage(error));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [handleUnauthorized]);

  const refreshReports = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchAll(false);
    } finally {
      setRefreshing(false);
    }
  }, [fetchAll]);

  useFocusEffect(
    useCallback(() => {
      void fetchAll(!reportsDataCache.hasData());
    }, [fetchAll]),
  );

  const allRecords = useMemo(() => {
    const expenseRows = reportType === "transfer" ? [] : expenses;
    const transferRows = reportType === "expense" ? [] : transfers;
    return [...expenseRows, ...transferRows].sort((left, right) => {
      const leftTime = parseLocalDate(left._date)?.getTime() || 0;
      const rightTime = parseLocalDate(right._date)?.getTime() || 0;
      return rightTime - leftTime;
    });
  }, [expenses, transfers, reportType]);

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(
          allRecords
            .map((record) => record.category)
            .filter((category): category is string => Boolean(category)),
        ),
      ).sort(),
    ],
    [allRecords],
  );
  const paymentMethods = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(
          allRecords
            .map((record) => record.payment_method || record.paymentMethod)
            .filter((payment): payment is string => Boolean(payment)),
        ),
      ).sort(),
    ],
    [allRecords],
  );
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = allRecords.filter((record) => {
      const payment = record.payment_method || record.paymentMethod || "";
      const recordAmount = getRecordAmount(record);
      const amount = String(recordAmount);
      const matchesSearch =
        !query ||
        `${record.title || ""} ${record.category || ""} ${record.notes || ""} ${amount}`
          .toLowerCase()
          .includes(query);
      const matchesCategory =
        categoryFilter === "All" || record.category === categoryFilter;
      const matchesPayment =
        paymentFilter === "All" || payment === paymentFilter;
      const matchesDate = isDateInRange(record._date, dateRange);
      const matchesMin = amountMin === "" || recordAmount >= Number(amountMin);
      const matchesMax = amountMax === "" || recordAmount <= Number(amountMax);
      return (
        matchesSearch &&
        matchesCategory &&
        matchesPayment &&
        matchesDate &&
        matchesMin &&
        matchesMax
      );
    });
    return filtered.sort((left, right) => {
      const leftAmount = getRecordAmount(left);
      const rightAmount = getRecordAmount(right);
      const leftDate = parseLocalDate(left._date)?.getTime() || 0;
      const rightDate = parseLocalDate(right._date)?.getTime() || 0;
      if (sort === "Oldest First") return leftDate - rightDate;
      if (sort === "Amount: High to Low") return rightAmount - leftAmount;
      if (sort === "Amount: Low to High") return leftAmount - rightAmount;
      return rightDate - leftDate;
    });
  }, [
    allRecords,
    search,
    categoryFilter,
    paymentFilter,
    dateRange,
    amountMin,
    amountMax,
    sort,
  ]);

  const stats = useMemo(() => {
    const expenseRows = visible.filter((record) => record._type === "expense");
    const transferRows = visible.filter(
      (record) => record._type === "transfer",
    );
    return {
      totalRecords: visible.length,
      expenseCount: expenseRows.length,
      transferCount: transferRows.length,
      totalExpense: expenseRows.reduce(
        (sum, record) => sum + Number(record.expense_amount || 0),
        0,
      ),
      totalTransfer: transferRows.reduce(
        (sum, record) => sum + Number(record.amount || 0),
        0,
      ),
      totalRemaining: transferRows.reduce(
        (sum, record) => sum + Number(record.remaining_amount || 0),
        0,
      ),
      recurringCount: expenseRows.filter((record) => record.recurring === "Yes")
        .length,
    };
  }, [visible]);
  const categorySummary = useMemo(() => {
    const totals = new Map<string, number>();
    visible
      .filter((record) => record._type === "expense")
      .forEach((record) => {
        const category = record.category || "Uncategorized";
        totals.set(
          category,
          (totals.get(category) || 0) + Number(record.expense_amount || 0),
        );
      });
    const total = Array.from(totals.values()).reduce(
      (sum, amount) => sum + amount,
      0,
    );
    return Array.from(totals.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
      }));
  }, [visible]);
  const monthlyTrend = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, index) => {
      const month = new Date();
      month.setDate(1);
      month.setMonth(month.getMonth() - 5 + index);
      return month;
    });
    const totals = new Map<string, number>();

    visible
      .filter((record) => record._type === "expense" && record._date)
      .forEach((record) => {
        const date = parseLocalDate(record._date);
        if (!date) return;
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        totals.set(
          key,
          (totals.get(key) || 0) + Number(record.expense_amount || 0),
        );
      });

    return months.map((month) => {
      const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
      return {
        key,
        label: month.toLocaleDateString("en-IN", { month: "short" }),
        amount: totals.get(key) || 0,
      };
    });
  }, [visible]);
  const highestMonthlyTotal = Math.max(
    ...monthlyTrend.map((month) => month.amount),
    0,
  );

  const resetFilters = () => {
    setReportType("all");
    setSearch("");
    setCategoryFilter("All");
    setPaymentFilter("All");
    setDateRange(createDateRangeSelection("All"));
    setAmountMin("");
    setAmountMax("");
    setSort(DEFAULT_FILTER_STATE.sort);
    setViewMode("grid");
  };

  const changeReportType = (nextType: "all" | ReportType) => {
    setReportType(nextType);
    setCategoryFilter("All");
    setPaymentFilter("All");
  };

  const exportRows = visible.map((record, index) => ({
    index: index + 1,
    kind: record._type === "expense" ? "Expense" : "Transfer",
    title: record.title || "",
    category: record.category || "",
    amount: getRecordAmount(record),
    payment: record.payment_method || record.paymentMethod || "",
    date: formatDate(record._date),
    notes: record.notes || "",
    recurring: record._type === "expense" ? record.recurring || "No" : "-",
    remaining:
      record._type === "transfer" ? Number(record.remaining_amount || 0) : "",
  }));

  const exportCsv = async () => {
    if (!visible.length) {
      Alert.alert(
        "No report data",
        "There are no records to export with these filters.",
      );
      return;
    }
    const headers = [
      "#",
      "Type",
      "Title",
      "Category",
      "Amount",
      "Payment Method",
      "Date",
      "Notes",
      "Recurring",
      "Remaining",
    ];
    const body = exportRows.map((row) =>
      [
        row.index,
        row.kind,
        row.title,
        row.category,
        row.amount,
        row.payment,
        row.date,
        row.notes,
        row.recurring,
        row.remaining,
      ]
        .map(csvCell)
        .join(","),
    );
    const csv = [headers.map(csvCell).join(","), ...body].join("\r\n");
    setExporting("csv");
    try {
      if (Platform.OS === "web") {
        await Share.share({ message: csv, title: "Life Ledger report CSV" });
        return;
      }
      const file = new File(
        Paths.cache,
        `life-ledger-report-${dateKey(new Date())}.csv`,
      );
      file.create({ overwrite: true });
      file.write(csv);
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(
          "Sharing unavailable",
          "This device cannot share report files.",
        );
        return;
      }
      await Sharing.shareAsync(file.uri, {
        dialogTitle: "Export report CSV",
        mimeType: "text/csv",
        UTI: "public.comma-separated-values-text",
      });
    } catch (error) {
      Alert.alert("Unable to export CSV", getApiErrorMessage(error));
    } finally {
      setExporting(null);
    }
  };

  const exportPdf = async () => {
    if (!visible.length) {
      Alert.alert(
        "No report data",
        "There are no records to export with these filters.",
      );
      return;
    }
    const rows = exportRows
      .map(
        (row) => `<tr>
          <td>${row.index}</td><td>${escapeHtml(row.kind)}</td><td>${escapeHtml(row.title)}</td>
          <td>${escapeHtml(row.category || "-")}</td><td>₹${Number(row.amount).toFixed(2)}</td>
          <td>${escapeHtml(row.payment || "-")}</td><td>${escapeHtml(row.date)}</td>
          <td>${escapeHtml(row.recurring)}</td><td>${row.remaining === "" ? "-" : `₹${Number(row.remaining).toFixed(2)}`}</td>
        </tr>`,
      )
      .join("");
    const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body{font-family:Arial,sans-serif;color:#26362c;padding:24px}
        h1{margin:0;color:#315640;font-size:24px}p{color:#66756a;font-size:12px}
        .summary{display:flex;gap:10px;margin:18px 0}.metric{flex:1;padding:12px;border:1px solid #dce5dc;border-radius:8px}
        .label{font-size:10px;text-transform:uppercase;color:#78867c}.value{margin-top:6px;font-weight:bold;font-size:15px}
        table{width:100%;border-collapse:collapse;font-size:9px}th{background:#315640;color:white;text-align:left}
        th,td{padding:7px 5px;border-bottom:1px solid #e5eae5}tr{page-break-inside:avoid}
        @page{margin:24px}
      </style></head><body>
      <h1>Life Ledger Report</h1>
      <p>Generated ${escapeHtml(formatDate(formatLocalDate(new Date())))} · ${stats.totalRecords} records · ${escapeHtml(dateRange.filter)}</p>
      <div class="summary">
        <div class="metric"><div class="label">Expenses</div><div class="value">₹${stats.totalExpense.toFixed(2)}</div></div>
        <div class="metric"><div class="label">Transfers</div><div class="value">₹${stats.totalTransfer.toFixed(2)}</div></div>
        <div class="metric"><div class="label">Remaining</div><div class="value">₹${stats.totalRemaining.toFixed(2)}</div></div>
        <div class="metric"><div class="label">Records</div><div class="value">${stats.totalRecords}</div></div>
      </div>
      <table><thead><tr><th>#</th><th>Type</th><th>Title</th><th>Category</th><th>Amount</th><th>Payment</th><th>Date</th><th>Recurring</th><th>Remaining</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`;

    setExporting("pdf");
    try {
      if (Platform.OS === "web") {
        await Print.printAsync({ html });
        return;
      }
      const result = await Print.printToFileAsync({ html });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(
          "Sharing unavailable",
          "This device cannot share report files.",
        );
        return;
      }
      await Sharing.shareAsync(result.uri, {
        dialogTitle: "Export report PDF",
        mimeType: "application/pdf",
        UTI: ".pdf",
      });
    } catch (error) {
      Alert.alert("Unable to export PDF", getApiErrorMessage(error));
    } finally {
      setExporting(null);
    }
  };

  const hasFilters =
    reportType !== "all" ||
    !!search ||
    categoryFilter !== "All" ||
    paymentFilter !== "All" ||
    dateRange.filter !== "All" ||
    amountMin !== "" ||
    amountMax !== "" ||
    sort !== DEFAULT_FILTER_STATE.sort ||
    viewMode !== "grid";

  return (
    <SafeAreaView
      className="flex-1 bg-[#F2F5EA]"
      edges={["top", "bottom"]}
    >
      <LinearGradient
        colors={Colors.greenGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingHorizontal: 16,
          paddingBottom: 16,
          paddingTop: 8,
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
        <View className="ml-3 flex-row items-center">
          <Ionicons name="bar-chart-outline" size={20} color={Colors.accent} />
          <Text className="ml-2 text-lg font-bold text-white">Reports</Text>
        </View>
      </LinearGradient>

      {loading ? (
        <CenteredPageLoader message="Loading report data..." />
      ) : (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              if (!loading) void refreshReports();
            }}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 36 }}
      >
        <View className="mb-4 mt-8 flex-row">
          <Pressable
            accessibilityRole="button"
            disabled={exporting !== null}
            className={`mr-2 flex-1 flex-row items-center justify-center rounded-xl bg-[#315640] py-3 ${exporting === "pdf" ? "opacity-60" : ""}`}
            onPress={() => void exportPdf()}
          >
            {exporting === "pdf" ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons
                name="document-text-outline"
                size={17}
                color="#FFFFFF"
              />
            )}
            <Text className="ml-2 text-xs font-bold text-white">
              Export PDF
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={exporting !== null}
            className={`ml-2 flex-1 flex-row items-center justify-center rounded-xl border border-[#DCE5DC] bg-white py-3 ${exporting === "csv" ? "opacity-60" : ""}`}
            onPress={() => void exportCsv()}
          >
            {exporting === "csv" ? (
              <ActivityIndicator size="small" color="#315640" />
            ) : (
              <Ionicons name="download-outline" size={17} color="#315640" />
            )}
            <Text className="ml-2 text-xs font-bold text-[#315640]">
              Export CSV
            </Text>
          </Pressable>
        </View>

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
            label="Report Records"
            value={String(stats.totalRecords)}
            caption="Total report records"
            icon="document-text-outline"
            tone="report"
            cardWidth={metricCardWidth}
          />
          <Metric
            label="Expense Count"
            value={String(stats.expenseCount)}
            caption="Total expenses added"
            icon="wallet-outline"
            tone="expense"
            cardWidth={metricCardWidth}
          />
          <Metric
            label="Transfers Count"
            value={String(stats.transferCount)}
            caption="Total transfers done"
            icon="swap-horizontal-outline"
            tone="transfer"
            cardWidth={metricCardWidth}
          />
          <Metric
            label="Total Spend Amount"
            value={formatAmount(stats.totalExpense)}
            caption="Total expense amount"
            icon="cart-outline"
            tone="spent"
            cardWidth={metricCardWidth}
          />
          <Metric
            label="Transfer Amount"
            value={formatAmount(stats.totalTransfer)}
            caption="Total amount transferred"
            icon="paper-plane-outline"
            tone="moved"
            cardWidth={metricCardWidth}
          />
          <Metric
            label="Remaining Amount"
            value={formatAmount(stats.totalRemaining)}
            caption="Available balance"
            icon="wallet-outline"
            tone="remaining"
            cardWidth={metricCardWidth}
          />
        </View>

        <View className="mb-4 rounded-2xl border border-[#E4E8E3] bg-white p-4">
          <Text className="mb-3 text-sm font-bold text-[#293930]">
            Monthly spending · last 6 months
          </Text>
          {highestMonthlyTotal > 0 ? (
            monthlyTrend.map((month) => (
              <View
                key={month.key}
                className="mb-3 last:mb-0 flex-row items-center"
              >
                <Text className="w-9 text-xs font-semibold text-[#526058]">
                  {month.label}
                </Text>
                <View className="h-2 flex-1 overflow-hidden rounded-full bg-[#EDF0ED]">
                  <View
                    className="h-full rounded-full bg-[#315640]"
                    style={{
                      width: `${(month.amount / highestMonthlyTotal) * 100}%`,
                    }}
                  />
                </View>
                <Text className="ml-3 w-[92px] text-right text-[10px] font-bold text-[#293930]">
                  {formatAmount(month.amount)}
                </Text>
              </View>
            ))
          ) : (
            <Text className="text-xs text-[#7C8880]">
              No expense data in the last six months for these filters.
            </Text>
          )}
        </View>

        <View className="mb-4 rounded-2xl border border-[#E4E8E3] bg-white p-4">
          <Text className="mb-3 text-sm font-bold text-[#293930]">
            Spending by category
          </Text>
          {categorySummary.length ? (
            categorySummary.map((item) => (
              <View key={item.category} className="mb-3 last:mb-0">
                <View className="mb-1 flex-row items-center justify-between">
                  <Text
                    className="flex-1 text-xs font-semibold text-[#526058]"
                    numberOfLines={1}
                  >
                    {item.category}
                  </Text>
                  <Text className="ml-3 text-xs font-bold text-[#293930]">
                    {formatAmount(item.amount)} · {item.percentage}%
                  </Text>
                </View>
                <View className="h-2 overflow-hidden rounded-full bg-[#EDF0ED]">
                  <View
                    className="h-full rounded-full bg-[#315640]"
                    style={{ width: `${item.percentage}%` }}
                  />
                </View>
              </View>
            ))
          ) : (
            <Text className="text-xs text-[#7C8880]">
              No expense data in this report range.
            </Text>
          )}
        </View>

        <View className="mb-4 rounded-2xl border border-[#E4E8E3] bg-white p-3.5">
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Search title, category, notes, amount"
            activeFilterCount={
              countActiveFilters(filterValues) +
              (paymentFilter === "All" ? 0 : 1)
            }
            filterSheet={{
              currentFilters: filterValues,
              onApply: applyReportFilters,
              onReset: () => {
                setReportType("all");
                setPaymentFilter("All");
              },
              categories: categories.filter((category) => category !== "All"),
              sections: ["date", "category", "amount", "sort", "viewMode"],
              initialExpandedSections: ["viewMode"],
              additionalFilters: [
                {
                  key: "paymentMethod",
                  label: "Payment Method",
                  presentation: "select",
                  options: paymentMethods.map((payment) => ({
                    value: payment,
                    label: payment === "All" ? "All methods" : payment,
                  })),
                },
              ],
            }}
            style={{ marginBottom: 12 }}
          />

          <View className="mb-3 flex-row rounded-xl border border-[#E4E8E3] bg-[#F5F6F2] p-1">
            {(
              [
                ["all", "All"],
                ["expense", "Expenses"],
                ["transfer", "Transfers"],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                className={`flex-1 items-center rounded-lg py-2 ${reportType === value ? "bg-[#315640]" : ""}`}
                onPress={() => changeReportType(value)}
              >
                <Text
                  className={`text-xs font-bold ${reportType === value ? "text-white" : "text-[#78847B]"}`}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View className="flex-row items-center justify-between border-t border-[#EEF0ED] pt-3">
            <Text className="text-xs font-medium text-[#7C8880]">
              {visible.length} matching{" "}
              {visible.length === 1 ? "record" : "records"}
            </Text>
            {hasFilters && (
              <Pressable
                accessibilityRole="button"
                className="flex-row items-center"
                onPress={resetFilters}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={15}
                  color="#B64C45"
                />
                <Text className="ml-1 text-xs font-bold text-[#B64C45]">
                  Reset
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {visible.length === 0 ? (
          <View className="items-center rounded-2xl border border-[#E4E8E3] bg-white px-6 py-12">
            <Ionicons name="file-tray-outline" size={34} color="#A4ADA6" />
            <Text className="mt-3 text-base font-bold text-[#25332C]">
              No records found
            </Text>
            <Text className="mt-1 text-center text-sm text-[#7B8580]">
              Try changing the search or filters.
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
            {visible.map((record, index) => {
              const isExpense = record._type === "expense";
              const amount = getRecordAmount(record);
              const payment =
                record.payment_method || record.paymentMethod || "-";
              return (
                <View
                  key={`${record._type}-${record.id}`}
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
                        {record.title}
                      </Text>
                      <Text
                        className="mt-1 text-xs font-medium text-[#818D84]"
                        numberOfLines={viewMode === "grid" ? 2 : 1}
                      >
                        {formatDate(record._date)} · {payment}
                      </Text>
                    </View>
                    <View
                      className={`rounded-full px-2 py-1 ${isExpense ? "bg-[#FBEDEC]" : "bg-[#EAF2F8]"}`}
                    >
                      <Text
                        className={`text-[9px] font-bold ${isExpense ? "text-[#B64C45]" : "text-[#356B9A]"}`}
                        numberOfLines={1}
                      >
                        {isExpense ? "Expense" : "Transfer"}
                      </Text>
                    </View>
                  </View>
                  <View
                    className={`mt-3 gap-2 ${viewMode === "grid" ? "flex-col items-start" : "flex-row items-center justify-between"}`}
                  >
                    <Text
                      className={`text-base font-extrabold ${isExpense ? "text-[#B64C45]" : "text-[#356B9A]"}`}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {formatAmount(amount)}
                    </Text>
                    {record.category ? (
                      <Text
                        className={`rounded-lg bg-[#F1F3F0] px-2 py-1 text-[9px] font-bold text-[#68776D] ${viewMode === "grid" ? "max-w-full" : "max-w-[55%]"}`}
                        numberOfLines={1}
                      >
                        {record.category}
                      </Text>
                    ) : null}
                  </View>
                  <View className="mt-3 flex-row items-center justify-between border-t border-[#EEF0ED] pt-3">
                    {isExpense ? (
                      <Text
                        className={`text-xs font-semibold ${record.recurring === "Yes" ? "text-[#25805A]" : "text-[#818D84]"}`}
                      >
                        {record.recurring === "Yes" ? "Recurring" : "One-time"}
                      </Text>
                    ) : (
                      <Text
                        className="text-xs font-semibold text-[#25805A]"
                        numberOfLines={1}
                      >
                        Left {formatAmount(record.remaining_amount)}
                      </Text>
                    )}
                    <Text className="text-[9px] font-medium text-[#A0A9A2]">
                      #{index + 1}
                    </Text>
                  </View>
                  {!!record.notes && (
                    <Text
                      className="mt-2 text-xs leading-4 text-[#818D84]"
                      numberOfLines={2}
                    >
                      {record.notes}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

      </ScrollView>
      )}
    </SafeAreaView>
  );
}
