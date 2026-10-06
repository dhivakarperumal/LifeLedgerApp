import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { TopHeader } from "../../Navigations/TopHeader";
import api, { getStoredUser } from "../../api";
import { GradientSafeAreaView as SafeAreaView } from "../../components/GradientSafeAreaView";
import { Colors } from "../../constants/colors";
import { HOME_QUOTES, HOME_QUOTE_INDEX_KEY } from "../../constants/homeQuotes";

type StoredUser = {
  name?: string;
  email?: string;
};

type ExpenseItem = {
  id: number | string;
  title: string;
  category?:
    | string
    | {
        name?: string;
        category_name?: string;
        categoryName?: string;
      };
  category_name?: string;
  categoryName?: string;
  expense_amount?: number | string;
  amount?: number | string;
  expense_date?: string;
  payment_method?: string;
  notes?: string;
  recurring?: string;
};

type IncomeItem = {
  amount?: number | string;
  income_date?: string;
};

type MonthlyOverviewItem = {
  key: string;
  label: string;
  income: number;
  expense: number;
};

type BudgetCategoryItem = {
  label: string;
  amount: number;
  share: number;
  color: string;
};

type CalendarEvent = {
  id: number | string;
  title?: string;
  name?: string;
  startDate?: string;
  start_date?: string;
  event_date?: string;
  date?: string;
  startTime?: string;
  start_time?: string;
};

const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  Food: "restaurant-outline",
  Travel: "car-outline",
  Bills: "document-text-outline",
  Shopping: "bag-handle-outline",
  Health: "medkit-outline",
  Education: "school-outline",
  Other: "ellipsis-horizontal-outline",
};

let hasLoadedHomeOnce = false;

function getTimeGreeting(hour: number) {
  if (hour < 5 || hour >= 21) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatAmount(value: number | string | undefined) {
  const numeric = Number(value || 0);
  return `₹${numeric.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatAxisAmount(value: number) {
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return String(Math.round(value));
}

function formatDate(dateString?: string) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function eventDateKey(value?: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : dateKey(date);
}

function monthDateKey(value?: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}/.test(value)) return value.slice(0, 7);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getIncomeRecords(data: any): IncomeItem[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.incomes)) return data.incomes;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.incomes)) return data.data.incomes;
  return [];
}

function getExpenseCategoryName(expense: ExpenseItem) {
  const category = expense.category;
  if (typeof category === "string" && category.trim()) return category.trim();
  if (category && typeof category === "object") {
    const nestedName =
      category.name || category.category_name || category.categoryName;
    if (nestedName?.trim()) return nestedName.trim();
  }
  return (
    expense.category_name?.trim() || expense.categoryName?.trim() || "Other"
  );
}

function getCalendarEvents(data: any): CalendarEvent[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.events)) return data.events;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.events)) return data.data.events;
  if (Array.isArray(data?.data?.data)) return data.data.data;
  return [];
}

function SectionHeader({
  title,
  onAction,
}: {
  title: string;
  onAction?: () => void;
}) {
  return (
    <View className="mt-7 mb-3 flex-row items-center justify-between">
      <Text className="text-base font-bold" style={{ color: Colors.textPrimary }}>
        {title}
      </Text>
      {onAction && (
        <Text
          className="text-sm font-semibold"
          style={{ color: Colors.primary }}
          onPress={onAction}
        >
          View All ›
        </Text>
      )}
    </View>
  );
}

function EmptyStateCard({ message }: { message: string }) {
  return (
    <View
      className="rounded-3xl p-5 items-center justify-center border"
      style={{
        backgroundColor: Colors.white,
        borderColor: Colors.border,
        borderStyle: "dashed",
      }}
    >
      <Text
        style={{
          color: Colors.textSecondary,
          fontStyle: "italic",
          fontSize: 13,
        }}
      >
        {message}
      </Text>
    </View>
  );
}

export default function Index() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [userName, setUserName] = useState("there");
  const [homeQuote, setHomeQuote] = useState<string>(HOME_QUOTES[0]);

  // Data states
  const [isLoading, setIsLoading] = useState(!hasLoadedHomeOnce);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<ExpenseItem[]>(
    [],
  );
  const [recentMemories, setRecentMemories] = useState<any[]>([]);
  const [recentDiary, setRecentDiary] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [monthlyOverview, setMonthlyOverview] = useState<MonthlyOverviewItem[]>(
    [],
  );
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [budgetCategories, setBudgetCategories] = useState<
    BudgetCategoryItem[]
  >([]);

  const [overview, setOverview] = useState({
    totalSpent: 0,
    todaySpent: 0,
    thisMonth: 0,
    thisWeek: 0,
  });
  const [topCategories, setTopCategories] = useState<
    { label: string; value: number; percentage: number; color: string }[]
  >([]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let isActive = true;

    void getStoredUser().then((user: StoredUser | null) => {
      if (!isActive) return;

      const name = user?.name?.trim();
      const emailName = user?.email?.split("@")[0]?.trim();
      setUserName(name || emailName || "there");
    });

    return () => {
      isActive = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const rotateQuote = async () => {
        const storedIndex = await AsyncStorage.getItem(
          HOME_QUOTE_INDEX_KEY,
        ).catch(() => null);
        const parsedIndex = Number.parseInt(storedIndex ?? "", 10);
        const previousIndex =
          Number.isInteger(parsedIndex) &&
          parsedIndex >= 0 &&
          parsedIndex < HOME_QUOTES.length
            ? parsedIndex
            : -1;
        const nextIndex = (previousIndex + 1) % HOME_QUOTES.length;

        if (!isActive) return;

        setHomeQuote(HOME_QUOTES[nextIndex]);
        void AsyncStorage.setItem(
          HOME_QUOTE_INDEX_KEY,
          String(nextIndex),
        ).catch(() => undefined);
      };

      void rotateQuote();

      return () => {
        isActive = false;
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const fetchData = async () => {
        try {
          if (!hasLoadedHomeOnce) setIsLoading(true);
          const [
            expensesRes,
            memoriesRes,
            diaryRes,
            eventsRes,
            incomesRes,
            budgetRes,
          ] = await Promise.allSettled([
            api.get("/expenses"),
            api.get("/memories"),
            api.get("/diary"),
            api.get("/calendar/events"),
            api.get("/incomes"),
            api.get("/incomes/monthly-budget"),
          ]);

          if (!isActive) return;

          // Parse Responses
          const expensesData: ExpenseItem[] =
            expensesRes.status === "fulfilled" &&
            Array.isArray(expensesRes.value?.data)
              ? expensesRes.value.data
              : expensesRes.status === "fulfilled" &&
                  Array.isArray(expensesRes.value?.data?.data)
                ? expensesRes.value.data.data
                : expensesRes.status === "fulfilled" &&
                    Array.isArray(expensesRes.value?.data?.expenses)
                  ? expensesRes.value.data.expenses
                  : [];

          const memoriesData =
            memoriesRes.status === "fulfilled" &&
            Array.isArray(memoriesRes.value?.data)
              ? memoriesRes.value.data
              : memoriesRes.status === "fulfilled" &&
                  Array.isArray(memoriesRes.value?.data?.data)
                ? memoriesRes.value.data.data
                : memoriesRes.status === "fulfilled" &&
                    Array.isArray(memoriesRes.value?.data?.memories)
                  ? memoriesRes.value.data.memories
                  : [];

          const diaryData =
            diaryRes.status === "fulfilled" &&
            Array.isArray(diaryRes.value?.data)
              ? diaryRes.value.data
              : diaryRes.status === "fulfilled" &&
                  Array.isArray(diaryRes.value?.data?.data)
                ? diaryRes.value.data.data
                : diaryRes.status === "fulfilled" &&
                    Array.isArray(diaryRes.value?.data?.entries)
                  ? diaryRes.value.data.entries
                  : [];

          const eventsData =
            eventsRes.status === "fulfilled"
              ? getCalendarEvents(eventsRes.value.data)
              : [];
          const incomeData =
            incomesRes.status === "fulfilled"
              ? getIncomeRecords(incomesRes.value.data)
              : [];
          if (budgetRes.status === "fulfilled") {
            const value = Number(
              budgetRes.value.data?.monthly_budget ??
                budgetRes.value.data?.data?.monthly_budget ??
                0,
            );
            setMonthlyBudget(Number.isFinite(value) ? Math.max(value, 0) : 0);
          }

          // Process expenses stats
          const now = new Date();
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();

          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0, 0, 0, 0);

          let totalSpent = 0;
          let todaySpent = 0;
          let thisMonthSpent = 0;
          let thisWeekSpent = 0;
          const monthlyCategoryTotals: Record<string, number> = {};
          const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

          const monthlyData = Array.from({ length: 6 }, (_, index) => {
            const monthDate = new Date(
              currentYear,
              currentMonth - 5 + index,
              1,
            );
            return {
              key: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`,
              label: monthDate.toLocaleDateString("en-US", { month: "short" }),
              income: 0,
              expense: 0,
            };
          });
          const monthlyDataByKey = new Map(
            monthlyData.map((month) => [month.key, month]),
          );

          const categoryTotals: Record<string, number> = {};

          expensesData.forEach((exp) => {
            const amount = Number(exp.expense_amount ?? exp.amount ?? 0);
            if (isNaN(amount)) return;

            totalSpent += amount;

            const expenseDateValue = eventDateKey(exp.expense_date);
            if (expenseDateValue === dateKey(now)) {
              todaySpent += amount;
            }

            if (exp.expense_date) {
              const expDate = new Date(exp.expense_date);
              if (!isNaN(expDate.getTime())) {
                if (
                  expDate.getMonth() === currentMonth &&
                  expDate.getFullYear() === currentYear
                ) {
                  thisMonthSpent += amount;
                }
                if (expDate >= startOfWeek) {
                  thisWeekSpent += amount;
                }
              }
            }

            const cat = getExpenseCategoryName(exp);
            categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;
            if (monthDateKey(exp.expense_date) === currentMonthKey) {
              monthlyCategoryTotals[cat] =
                (monthlyCategoryTotals[cat] || 0) + amount;
            }

            const month = monthlyDataByKey.get(monthDateKey(exp.expense_date));
            if (month) month.expense += amount;
          });

          incomeData.forEach((income) => {
            const amount = Number(income.amount ?? 0);
            if (!Number.isFinite(amount)) return;
            const month = monthlyDataByKey.get(
              monthDateKey(income.income_date),
            );
            if (month) month.income += amount;
          });

          setMonthlyOverview(monthlyData);
          const budgetColors = ["#78965F", "#4D8762", "#EAB45B", "#67A6C2"];
          setBudgetCategories(
            Object.entries(monthlyCategoryTotals)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
              .map(([label, amount], index) => ({
                label,
                amount,
                share:
                  thisMonthSpent > 0
                    ? Math.round((amount / thisMonthSpent) * 100)
                    : 0,
                color: budgetColors[index] || Colors.primary,
              })),
          );

          setOverview({
            totalSpent,
            todaySpent,
            thisMonth: thisMonthSpent,
            thisWeek: thisWeekSpent,
          });

          // Top categories
          const catColors = [Colors.primary, Colors.olive, Colors.primaryLight];
          const sortedCats = Object.entries(categoryTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([label, value], idx) => ({
              label,
              value,
              percentage:
                totalSpent > 0 ? Math.round((value / totalSpent) * 100) : 0,
              color: catColors[idx] || Colors.textSecondary,
            }));

          setTopCategories(sortedCats);

          const currentDateKey = dateKey(now);
          setRecentTransactions(
            expensesData
              .filter(
                (expense) =>
                  eventDateKey(expense.expense_date) === currentDateKey,
              )
              .slice(0, 3),
          );
          setRecentMemories(
            memoriesData
              .filter(
                (memory: any) =>
                  eventDateKey(memory.memory_date || memory.created_at) ===
                  currentDateKey,
              )
              .slice(0, 3),
          );
          setRecentDiary(
            diaryData
              .filter(
                (diary: any) =>
                  eventDateKey(diary.entry_date || diary.created_at) ===
                  currentDateKey,
              )
              .slice(0, 3),
          );
          setCalendarEvents(eventsData);
        } catch (error) {
          console.error("Failed to fetch home data:", error);
        } finally {
          if (isActive) {
            hasLoadedHomeOnce = true;
            setIsLoading(false);
            setIsRefreshing(false);
          }
        }
      };

      fetchData();

      return () => {
        isActive = false;
      };
    }, [refreshKey]),
  );

  const dateLabel = currentTime
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
  const greeting = getTimeGreeting(currentTime.getHours());
  const todayKey = dateKey(currentTime);
  const todayEvents = calendarEvents.filter((event) =>
    [event.startDate, event.start_date, event.event_date, event.date]
      .map(eventDateKey)
      .includes(todayKey),
  );
  const largestMonthlyAmount = Math.max(
    0,
    ...monthlyOverview.flatMap(({ income, expense }) => [income, expense]),
  );
  const chartMagnitude = largestMonthlyAmount
    ? 10 ** Math.floor(Math.log10(largestMonthlyAmount))
    : 1000;
  const chartMaximum = largestMonthlyAmount
    ? Math.ceil(largestMonthlyAmount / chartMagnitude) * chartMagnitude
    : 1000;
  const chartTicks = [
    chartMaximum,
    (chartMaximum * 2) / 3,
    chartMaximum / 3,
    0,
  ];
  const budgetUsage =
    monthlyBudget > 0 ? (overview.thisMonth / monthlyBudget) * 100 : 0;
  const budgetRingProgress = Math.min(budgetUsage, 100);
  const budgetRingCircumference = 2 * Math.PI * 31;

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: Colors.headerStart }}
    >
      <View style={{ flex: 1, backgroundColor: Colors.contentBackground }}>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                setRefreshKey((current) => current + 1);
              }}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          contentContainerStyle={{ paddingBottom: 104 + insets.bottom }}
        >
          <LinearGradient
            colors={Colors.greenGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingHorizontal: 22,
              paddingTop: 12,
              paddingBottom: 54,
              borderBottomLeftRadius: 42,
              borderBottomRightRadius: 42,
            }}
          >
            <View className="h-11">
              <TopHeader />
            </View>

            <Text
              className="mt-6 text-xs font-semibold"
              style={{ color: Colors.primaryLight, letterSpacing: 1.5 }}
            >
              {dateLabel}
            </Text>
            <Text
              className="mt-2 text-2xl font-bold"
              style={{ color: Colors.white }}
            >
              {greeting},👋
            </Text>
            <Text
              className="text-2xl font-bold"
              style={{ color: Colors.accent }}
            >
              {userName}
            </Text>

            <View
              className="mt-5 flex-row items-center rounded-3xl px-5 py-4"
              style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
            >
              <Text
                className="flex-1 text-base italic"
                style={{ color: Colors.white }}
              >
                “{homeQuote}”
              </Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.white} />
            </View>
          </LinearGradient>

          <View className="-mt-8">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 18 }}
            >
              {[
                { icon: "wallet", label: "Expense", route: "/tabs/expenses" },
                { icon: "book", label: "Diary", route: "/tabs/diary" },
                { icon: "image", label: "Memory", route: "/tabs/memories" },
                {
                  icon: "swap-horizontal",
                  label: "Transfer",
                  route: "/transfers",
                },
                { icon: "cash", label: "Income", route: "/income" },
                { icon: "grid", label: "Category", route: "/categories" },
                { icon: "calendar", label: "Event", route: "/events" },
                { icon: "pie-chart", label: "Report", route: "/reports" },
              ].map(({ icon, label, route }) => (
                <Pressable
                  key={label}
                  className="items-center"
                  style={{ width: 60 }}
                  onPress={() => router.push(route as any)}
                >
                  <View
                    className="h-14 w-14 items-center justify-center rounded-2xl"
                    style={{
                      backgroundColor: Colors.bgCard,
                      shadowColor: Colors.primaryDark,
                      shadowOpacity: 0.1,
                      shadowRadius: 10,
                      elevation: 3,
                    }}
                  >
                    <Ionicons
                      name={icon as never}
                      size={22}
                      color={Colors.primary}
                    />
                  </View>
                  <Text
                    className="mt-2 text-center text-[11px] font-semibold"
                    style={{ color: Colors.textPrimary }}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View className="px-5">
            {isLoading ? (
              <View style={{ marginTop: 60, alignItems: "center" }}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={{ marginTop: 12, color: Colors.textSecondary }}>
                  Loading your overview...
                </Text>
              </View>
            ) : (
              <>
                <View className="mt-8">
                  <Text
                    className="text-[18px] font-black leading-none"
                    style={{ color: Colors.textPrimary }}
                  >
                    Overview
                  </Text>

                  <View className="mt-6 flex-row items-start justify-between gap-4">
                    <View className="flex-1">
                      <View
                        className="items-center justify-center rounded-full border border-gray-200 px-5 py-3 shadow-md"
                        style={{
                          backgroundColor: "#f7e1e4",
                        }}
                      >
                        <Text
                          className="text-[10px] font-bold tracking-[1px]"
                          style={{ color: "#d35d69" }}
                        >
                          TODAY SPENT
                        </Text>
                      </View>

                      <Text
                        className="mt-8 w-full text-center  text-[30px] font-black leading-none"
                        style={{ color: Colors.textPrimary }}
                      >
                        ₹{overview.todaySpent || 0}
                      </Text>
                    </View>

                    <View className="flex-1 gap-3">
                      <View
                        className="flex-row items-center rounded-[26px] border border-gray-200 px-4 py-4 shadow-md"
                        style={{ backgroundColor: "#edf3ee" }}
                      >
                        <View
                          className="mr-3 h-11 w-11 items-center justify-center rounded-full"
                          style={{ backgroundColor: "#dcefe0" }}
                        >
                          <Ionicons
                            name="calendar-outline"
                            size={20}
                            color={Colors.primary}
                          />
                        </View>

                        <View className="flex-1">
                          <Text
                            className="text-[9px] font-bold tracking-[1px]"
                            style={{ color: Colors.primary }}
                          >
                            THIS WEEK
                          </Text>
                          <Text
                            className="mt-1 text-[15px] font-black leading-none"
                            style={{ color: Colors.textPrimary }}
                          >
                            ₹{overview.thisWeek || 935}
                          </Text>
                        </View>
                      </View>

                      <View
                        className="flex-row items-center rounded-[26px] border border-gray-200 px-4 py-4 shadow-md"
                        style={{ backgroundColor: "#edf3ee" }}
                      >
                        <View
                          className="mr-3 h-11 w-11 items-center justify-center rounded-full"
                          style={{ backgroundColor: "#dcefe0" }}
                        >
                          <Ionicons
                            name="bar-chart-outline"
                            size={20}
                            color={Colors.primary}
                          />
                        </View>

                        <View className="flex-1">
                          <Text
                            className="text-[9px] font-bold tracking-[1px]"
                            style={{ color: Colors.primary }}
                          >
                            THIS MONTH
                          </Text>
                          <Text
                            className="mt-1 text-[15px] font-black leading-none"
                            style={{ color: Colors.textPrimary }}
                          >
                            ₹{overview.thisMonth || 3518}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>

                <View
                  className="mt-8 rounded-[28px] bg-white px-5 py-5"
                  style={{ backgroundColor: Colors.white }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text
                      className="text-[12px] font-bold uppercase"
                      style={{ color: Colors.textPrimary }}
                    >
                      Top Categories
                    </Text>
                    <Text
                      className="text-[12px] font-bold uppercase"
                      style={{ color: Colors.primary }}
                    >
                      Analytics
                    </Text>
                  </View>

                  {topCategories.length > 0 ? (
                    <>
                      <View className="mt-5 flex-row overflow-hidden rounded-full">
                        {topCategories.map((category, index) => (
                          <View
                            key={category.label}
                            className="h-3"
                            style={{
                              backgroundColor: category.color,
                              flex: Math.max(category.value, 0.01),
                              borderTopLeftRadius: index === 0 ? 999 : 0,
                              borderBottomLeftRadius: index === 0 ? 999 : 0,
                              borderTopRightRadius:
                                index === topCategories.length - 1 ? 999 : 0,
                              borderBottomRightRadius:
                                index === topCategories.length - 1 ? 999 : 0,
                            }}
                          />
                        ))}
                      </View>

                      <View className="mt-5 flex-row flex-wrap justify-between gap-y-4">
                        {topCategories.map((category) => (
                          <View
                            key={category.label}
                            className="w-[48%] flex-row items-center"
                          >
                            <View
                              className="mr-2 h-4 w-4 rounded-full"
                              style={{ backgroundColor: category.color }}
                            />
                            <Text
                              className="text-[13px] font-medium"
                              style={{ color: Colors.textPrimary }}
                              numberOfLines={1}
                            >
                              {category.label}{" "}
                              <Text
                                className="font-bold"
                                style={{ color: Colors.olive }}
                              >
                                {category.percentage}%
                              </Text>
                            </Text>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : (
                    <Text
                      className="mt-4 text-[13px]"
                      style={{ color: Colors.textSecondary }}
                    >
                      No category data available yet.
                    </Text>
                  )}
                </View>

                <View
                  className="mt-4 rounded-[24px] bg-white px-4 py-4"
                  style={{ backgroundColor: Colors.white }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text
                      className="text-[13px] font-bold"
                      style={{ color: Colors.textPrimary }}
                    >
                      Monthly Overview
                    </Text>
                    <View className="flex-row items-center rounded-full bg-[#F2F4F3] px-3 py-1.5">
                      <Text
                        className="mr-1 text-[10px] font-semibold"
                        style={{ color: Colors.textSecondary }}
                      >
                        This Month
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={12}
                        color={Colors.textSecondary}
                      />
                    </View>
                  </View>

                  <View className="mt-4 flex-row">
                    <View
                      className="mr-2 justify-between"
                      style={{ height: 92, width: 26 }}
                    >
                      {chartTicks.map((tick, index) => (
                        <Text
                          key={index}
                          className="text-[8px]"
                          style={{ color: Colors.textSecondary }}
                        >
                          {formatAxisAmount(tick)}
                        </Text>
                      ))}
                    </View>

                    <View className="flex-1">
                      <View style={{ height: 92 }}>
                        {[0, 1, 2, 3].map((line) => (
                          <View
                            key={line}
                            style={{
                              position: "absolute",
                              top: (92 / 3) * line,
                              left: 0,
                              right: 0,
                              borderTopWidth: 1,
                              borderColor: "#EEF0EF",
                            }}
                          />
                        ))}
                        <View
                          className="absolute bottom-0 left-0 right-0 flex-row items-end justify-around"
                          style={{ height: 86 }}
                        >
                          {monthlyOverview.map((month) => (
                            <View
                              key={month.key}
                              className="flex-1 flex-row items-end justify-center gap-[3px]"
                              style={{ height: 86 }}
                            >
                              <View
                                className="w-[8px] rounded-t-full"
                                style={{
                                  height:
                                    month.income > 0
                                      ? Math.max(
                                          (month.income / chartMaximum) * 86,
                                          3,
                                        )
                                      : 0,
                                  backgroundColor: "#78965F",
                                }}
                              />
                              <View
                                className="w-[8px] rounded-t-full"
                                style={{
                                  height:
                                    month.expense > 0
                                      ? Math.max(
                                          (month.expense / chartMaximum) * 86,
                                          3,
                                        )
                                      : 0,
                                  backgroundColor: "#FF756B",
                                }}
                              />
                            </View>
                          ))}
                        </View>
                      </View>

                      <View className="mt-1 flex-row justify-around">
                        {monthlyOverview.map((month) => (
                          <Text
                            key={month.key}
                            className="flex-1 text-center text-[9px]"
                            style={{ color: Colors.textSecondary }}
                          >
                            {month.label}
                          </Text>
                        ))}
                      </View>
                    </View>
                  </View>

                  <View className="mt-3 flex-row items-center justify-center gap-4">
                    <View className="flex-row items-center">
                      <View
                        className="mr-1.5 h-2 w-2 rounded-full"
                        style={{ backgroundColor: "#78965F" }}
                      />
                      <Text
                        className="text-[10px]"
                        style={{ color: Colors.textPrimary }}
                      >
                        Income
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <View
                        className="mr-1.5 h-2 w-2 rounded-full"
                        style={{ backgroundColor: "#FF756B" }}
                      />
                      <Text
                        className="text-[10px]"
                        style={{ color: Colors.textPrimary }}
                      >
                        Expense
                      </Text>
                    </View>
                  </View>
                </View>

                <View
                  className="mt-4 rounded-[24px] bg-white px-4 py-4"
                  style={{ backgroundColor: Colors.white }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text
                      className="text-[14px] font-bold"
                      style={{ color: Colors.textPrimary }}
                    >
                      Monthly Budget
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push("/income")}
                      className="flex-row items-center rounded-full bg-[#78965F] px-3 py-2"
                    >
                      <Ionicons
                        name={monthlyBudget > 0 ? "create-outline" : "add"}
                        size={14}
                        color={Colors.white}
                      />
                      <Text className="ml-1 text-[10px] font-bold text-white">
                        {monthlyBudget > 0 ? "Edit Budget" : "Add Budget"}
                      </Text>
                    </Pressable>
                  </View>

                  <View className="mt-3 flex-row items-center">
                    <View className="mr-3 items-center justify-center">
                      <Svg width={76} height={76} viewBox="0 0 76 76">
                        <Circle
                          cx={38}
                          cy={38}
                          r={31}
                          fill="none"
                          stroke="#E1E7DF"
                          strokeWidth={7}
                        />
                        <Circle
                          cx={38}
                          cy={38}
                          r={31}
                          fill="none"
                          stroke="#78965F"
                          strokeWidth={7}
                          strokeLinecap="round"
                          strokeDasharray={`${budgetRingCircumference} ${budgetRingCircumference}`}
                          strokeDashoffset={
                            budgetRingCircumference *
                            (1 - budgetRingProgress / 100)
                          }
                          rotation={-90}
                          origin="38, 38"
                        />
                      </Svg>
                      <Text
                        className="absolute text-[13px] font-bold"
                        style={{ color: Colors.textPrimary }}
                      >
                        {monthlyBudget > 0
                          ? `${Math.round(budgetUsage)}%`
                          : "--"}
                      </Text>
                    </View>

                    <View className="flex-1">
                      <Text
                        className="text-[17px] font-extrabold"
                        style={{ color: Colors.textPrimary }}
                      >
                        {formatAmount(overview.thisMonth)}
                      </Text>
                      <Text
                        className="mt-0.5 text-[10px]"
                        style={{ color: Colors.textSecondary }}
                      >
                        of {formatAmount(monthlyBudget)} used
                      </Text>
                    </View>
                  </View>

                 
                </View>

                {/* --- Today's Expenses --- */}
                <SectionHeader title="Today's Expenses" />
                {recentTransactions.length > 0 ? (
                  recentTransactions.map((tx) => {
                    const iconName =
                      categoryIcons[getExpenseCategoryName(tx)] ||
                      "pricetag-outline";
                    return (
                      <View
                        key={String(tx.id)}
                        className="mb-3 flex-row items-center rounded-3xl p-4"
                        style={{ backgroundColor: Colors.white }}
                      >
                        <View
                          className="mr-4 h-12 w-12 items-center justify-center rounded-full"
                          style={{ backgroundColor: Colors.bgCard }}
                        >
                          <Ionicons
                            name={iconName}
                            size={21}
                            color={Colors.primary}
                          />
                        </View>
                        <View className="flex-1">
                          <Text
                            className="text-base font-semibold"
                            style={{ color: Colors.textPrimary }}
                            numberOfLines={1}
                          >
                            {tx.title || "Expense"}
                          </Text>
                          <Text
                            className="mt-1 text-sm"
                            style={{ color: Colors.textSecondary }}
                          >
                            {getExpenseCategoryName(tx)} ·{" "}
                            {formatDate(tx.expense_date)}
                          </Text>
                        </View>
                        <Text
                          className="text-base font-bold"
                          style={{ color: Colors.danger }}
                        >
                          - {formatAmount(tx.expense_amount ?? tx.amount ?? 0)}
                        </Text>
                      </View>
                    );
                  })
                ) : (
                  <EmptyStateCard message="No expenses recorded today." />
                )}

                {/* --- Today's Memories --- */}
                <SectionHeader title="Today's Memories" />
                {recentMemories.length > 0 ? (
                  recentMemories.map((memory) => {
                    return (
                      <View
                        key={String(memory.id)}
                        className="mb-3 flex-row items-center rounded-3xl p-4"
                        style={{ backgroundColor: Colors.white }}
                      >
                        <View
                          className="mr-4 h-12 w-12 items-center justify-center rounded-full"
                          style={{ backgroundColor: "#F3E8FF" }}
                        >
                          <Ionicons
                            name="images-outline"
                            size={21}
                            color="#9333EA"
                          />
                        </View>
                        <View className="flex-1">
                          <Text
                            className="text-base font-semibold"
                            style={{ color: Colors.textPrimary }}
                            numberOfLines={1}
                          >
                            {memory.title || "Memory"}
                          </Text>
                          <Text
                            className="mt-1 text-sm"
                            style={{ color: Colors.textSecondary }}
                          >
                            {memory.category_name || "Uncategorized"} ·{" "}
                            {formatDate(
                              memory.memory_date || memory.created_at,
                            )}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <EmptyStateCard message="No memories recorded today." />
                )}

                {/* --- Today's Diary Entries --- */}
                <SectionHeader title="Today's Diary Entries" />
                {recentDiary.length > 0 ? (
                  recentDiary.map((diary) => {
                    return (
                      <View
                        key={String(diary.id)}
                        className="mb-3 flex-row items-center rounded-3xl p-4"
                        style={{ backgroundColor: Colors.white }}
                      >
                        <View
                          className="mr-4 h-12 w-12 items-center justify-center rounded-full"
                          style={{ backgroundColor: "#E0F2FE" }}
                        >
                          <Ionicons
                            name="book-outline"
                            size={21}
                            color="#0284C7"
                          />
                        </View>
                        <View className="flex-1">
                          <Text
                            className="text-base font-semibold"
                            style={{ color: Colors.textPrimary }}
                            numberOfLines={1}
                          >
                            {diary.title || "Diary Entry"}
                          </Text>
                          <Text
                            className="mt-1 text-sm"
                            style={{ color: Colors.textSecondary }}
                          >
                            {diary.mood || "No Mood"} ·{" "}
                            {formatDate(diary.entry_date || diary.created_at)}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <EmptyStateCard message="No diary entries recorded today." />
                )}

                {/* --- Recent Events --- */}
                <SectionHeader
                  title="Today's Calendar Events"
                  onAction={() => router.push("/calendar")}
                />
                {todayEvents.length > 0 ? (
                  todayEvents.map((event) => {
                    return (
                      <View
                        key={String(event.id)}
                        className="mb-3 flex-row items-center rounded-3xl p-4"
                        style={{ backgroundColor: Colors.white }}
                      >
                        <View
                          className="mr-4 h-12 w-12 items-center justify-center rounded-full"
                          style={{ backgroundColor: "#FEF3C7" }}
                        >
                          <Ionicons
                            name="calendar-outline"
                            size={21}
                            color="#D97706"
                          />
                        </View>
                        <View className="flex-1">
                          <Text
                            className="text-base font-semibold"
                            style={{ color: Colors.textPrimary }}
                            numberOfLines={1}
                          >
                            {event.title || event.name || "Event"}
                          </Text>
                          <Text
                            className="mt-1 text-sm"
                            style={{ color: Colors.textSecondary }}
                          >
                            {formatDate(
                              event.startDate ||
                                event.start_date ||
                                event.event_date ||
                                event.date,
                            )}
                            {event.startTime || event.start_time
                              ? ` · ${event.startTime || event.start_time}`
                              : ""}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <EmptyStateCard message="No events scheduled for today." />
                )}
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
