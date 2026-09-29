import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View, ActivityIndicator } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { TopHeader } from "../../Navigations/TopHeader";
import api, { getStoredUser } from "../../api";
import { Colors } from "../../constants/colors";
import { HOME_QUOTES, HOME_QUOTE_INDEX_KEY } from "../../constants/homeQuotes";

type StoredUser = {
  name?: string;
  email?: string;
};

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

const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  Food: "restaurant-outline",
  Travel: "car-outline",
  Bills: "document-text-outline",
  Shopping: "bag-handle-outline",
  Health: "medkit-outline",
  Education: "school-outline",
  Other: "ellipsis-horizontal-outline",
};

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

export default function Index() {
  const insets = useSafeAreaInsets();
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [userName, setUserName] = useState("there");
  const [homeQuote, setHomeQuote] = useState<string>(HOME_QUOTES[0]);

  // Data states
  const [isLoading, setIsLoading] = useState(true);
  const [recentTransactions, setRecentTransactions] = useState<ExpenseItem[]>([]);
  const [overview, setOverview] = useState({
    totalSpent: 0,
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
          setIsLoading(true);
          const expensesRes = await api.get("/expenses");
          if (!isActive) return;

          const expensesData: ExpenseItem[] = Array.isArray(expensesRes?.data)
            ? expensesRes.data
            : [];

          // Process stats
          const now = new Date();
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();

          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0, 0, 0, 0);

          let totalSpent = 0;
          let thisMonthSpent = 0;
          let thisWeekSpent = 0;

          const categoryTotals: Record<string, number> = {};

          expensesData.forEach((exp) => {
            const amount = Number(exp.expense_amount ?? exp.amount ?? 0);
            if (isNaN(amount)) return;

            totalSpent += amount;

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

            const cat = exp.category || "Other";
            categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;
          });

          setOverview({
            totalSpent,
            thisMonth: thisMonthSpent,
            thisWeek: thisWeekSpent,
          });

          // Top categories
          const catColors = [Colors.primary, Colors.olive, Colors.primaryLight];
          const sortedCats = Object.entries(categoryTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([label, value], idx) => ({
              label,
              value,
              percentage: totalSpent > 0 ? Math.round((value / totalSpent) * 100) : 0,
              color: catColors[idx] || Colors.textSecondary,
            }));

          setTopCategories(sortedCats);
          setRecentTransactions(expensesData.slice(0, 3));
        } catch (error) {
          console.error("Failed to fetch home data:", error);
        } finally {
          if (isActive) setIsLoading(false);
        }
      };

      fetchData();

      return () => {
        isActive = false;
      };
    }, [])
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

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: Colors.headerStart }}
    >
      <View style={{ flex: 1, backgroundColor: Colors.contentBackground }}>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 104 + insets.bottom }}
        >
          <LinearGradient
            colors={[Colors.headerStart, Colors.headerEnd]}
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
              <View
                className="mr-3 h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: Colors.olive }}
              >
                <Ionicons name="leaf" size={20} color={Colors.accent} />
              </View>
              <Text
                className="flex-1 text-base italic"
                style={{ color: Colors.white }}
              >
                “{homeQuote}”
              </Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.white} />
            </View>
          </LinearGradient>

          <View className="-mt-8 px-5">
            <View className="flex-row justify-between">
              {[
                ["wallet", "Expense"],
                ["book", "Diary"],
                ["calendar", "Event"],
                ["image", "Memory"],
                ["swap-horizontal", "Transfer"],
              ].map(([icon, label]) => (
                <Pressable key={label} className="flex-1 items-center">
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
            </View>

            {isLoading ? (
              <View style={{ marginTop: 60, alignItems: "center" }}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={{ marginTop: 12, color: Colors.textSecondary }}>Loading your overview...</Text>
              </View>
            ) : (
              <>
                <View className="mt-12 flex-row items-center justify-between">
                  <Text
                    className="text-xl font-bold"
                    style={{ color: Colors.textPrimary }}
                  >
                    Overview
                  </Text>
                  <Pressable
                    className="flex-row items-center rounded-full border px-3 py-2"
                    style={{
                      borderColor: Colors.border,
                      backgroundColor: Colors.white,
                    }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: Colors.textPrimary }}
                    >
                      This Month
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={18}
                      color={Colors.textPrimary}
                    />
                  </Pressable>
                </View>

                <View
                  className="mt-4 rounded-3xl p-6"
                  style={{
                    backgroundColor: Colors.white,
                    shadowColor: Colors.primaryDark,
                    shadowOpacity: 0.06,
                    shadowRadius: 12,
                    elevation: 2,
                  }}
                >
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text
                        className="text-base"
                        style={{ color: Colors.textSecondary }}
                      >
                        Total Spent
                      </Text>
                      <Text
                        className="mt-1 text-3xl font-bold"
                        style={{ color: Colors.textPrimary }}
                      >
                        {formatAmount(overview.totalSpent)}
                      </Text>
                    </View>
                    <View
                      className="rounded-xl p-4"
                      style={{ backgroundColor: Colors.bgCard }}
                    >
                      <Text
                        className="text-sm"
                        style={{ color: Colors.textSecondary }}
                      >
                        This Week{" "}
                        <Text
                          className="font-bold"
                          style={{ color: Colors.textPrimary }}
                        >
                          {formatAmount(overview.thisWeek)}
                        </Text>
                      </Text>
                      <Text
                        className="mt-4 text-sm"
                        style={{ color: Colors.textSecondary }}
                      >
                        This Month{" "}
                        <Text
                          className="font-bold"
                          style={{ color: Colors.textPrimary }}
                        >
                          {formatAmount(overview.thisMonth)}
                        </Text>
                      </Text>
                    </View>
                  </View>
                </View>

                <View
                  className="mt-4 rounded-3xl p-6"
                  style={{ backgroundColor: Colors.white }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text
                      className="text-lg font-bold"
                      style={{ color: Colors.textPrimary }}
                    >
                      Top Categories
                    </Text>
                    <Pressable className="flex-row items-center">
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: Colors.primary }}
                      >
                        View All
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={17}
                        color={Colors.primary}
                      />
                    </Pressable>
                  </View>
                  
                  {topCategories.length > 0 ? (
                    <>
                      <View className="mt-4 flex-row gap-1">
                        {topCategories.map((cat, idx) => (
                          <View
                            key={idx}
                            className="h-3 rounded-full"
                            style={{ 
                              backgroundColor: cat.color,
                              flex: Math.max(cat.percentage, 5) // ensure it's at least visible
                            }}
                          />
                        ))}
                      </View>
                      <View className="mt-5 flex-row justify-between flex-wrap gap-y-2">
                        {topCategories.map((cat, idx) => (
                          <View key={idx} className="flex-row items-center w-[48%] mb-2">
                            <View
                              className="mr-2 h-6 w-6 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            <Text
                              className="text-sm"
                              style={{ color: Colors.textPrimary }}
                              numberOfLines={1}
                            >
                              {cat.label}{" "}
                              <Text style={{ color: Colors.olive }}>{cat.percentage}%</Text>
                            </Text>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : (
                    <Text style={{ marginTop: 12, color: Colors.textSecondary }}>No category data available yet.</Text>
                  )}
                </View>

                <View className="mt-7 flex-row items-center justify-between">
                  <Text
                    className="text-lg font-bold"
                    style={{ color: Colors.textPrimary }}
                  >
                    Recent Transactions
                  </Text>
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: Colors.primary }}
                  >
                    View All ›
                  </Text>
                </View>
                
                {recentTransactions.length > 0 ? (
                  recentTransactions.map((tx) => {
                    const iconName = categoryIcons[tx.category || "Other"] || "pricetag-outline";
                    return (
                      <View
                        key={String(tx.id)}
                        className="mt-3 flex-row items-center rounded-3xl p-4"
                        style={{ backgroundColor: Colors.white }}
                      >
                        <View
                          className="mr-4 h-12 w-12 items-center justify-center rounded-full"
                          style={{ backgroundColor: Colors.bgCard }}
                        >
                          <Ionicons name={iconName} size={21} color={Colors.primary} />
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
                            {tx.category || "Other"} · {formatDate(tx.expense_date)}
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
                  <View className="mt-3 rounded-3xl p-6 items-center" style={{ backgroundColor: Colors.white }}>
                    <Text style={{ color: Colors.textSecondary }}>No recent transactions found.</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
