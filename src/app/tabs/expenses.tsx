import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Colors } from "../../constants/colors";

type Category =
  "Food" | "Travel" | "Bills" | "Shopping" | "Health" | "Education" | "Other";

type Expense = {
  id: string;
  title: string;
  category: Category;
  amount: number;
  date: Date;
};

const categoryOptions: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}[] = [
  { label: "All", icon: "grid" },
  { label: "Food", icon: "restaurant" },
  { label: "Travel", icon: "car-sport" },
  { label: "Bills", icon: "document-text" },
  { label: "Shopping", icon: "bag-handle" },
  { label: "Health", icon: "medkit" },
  { label: "Education", icon: "school" },
  { label: "Other", icon: "ellipsis-horizontal" },
];

const startingExpenses: Expense[] = [
  {
    id: "1",
    title: "Lunch with Friends",
    category: "Food",
    amount: 350,
    date: new Date(2026, 8, 21, 13, 15),
  },
  {
    id: "2",
    title: "Bus Ticket",
    category: "Travel",
    amount: 120,
    date: new Date(2026, 8, 21, 9, 30),
  },
  {
    id: "3",
    title: "Electricity Bill",
    category: "Bills",
    amount: 890,
    date: new Date(2026, 8, 20),
  },
  {
    id: "4",
    title: "Grocery Shopping",
    category: "Shopping",
    amount: 420,
    date: new Date(2026, 8, 19),
  },
  {
    id: "5",
    title: "Medicine",
    category: "Health",
    amount: 180,
    date: new Date(2026, 8, 18),
  },
  {
    id: "6",
    title: "Online Course",
    category: "Education",
    amount: 999,
    date: new Date(2026, 8, 17),
  },
];

const periods = ["All", "Today", "This Week", "This Month", "Custom"] as const;

function formatAmount(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function formatExpenseDate(date: Date) {
  const dateLabel = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeLabel = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    dateLabel + (date.getHours() || date.getMinutes() ? ` · ${timeLabel}` : "")
  );
}

export default function Expenses() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [expenses, setExpenses] = useState(startingExpenses);
  const [selectedPeriod, setSelectedPeriod] =
    useState<(typeof periods)[number]>("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("Food");

  const visibleExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return expenses
      .filter(
        (expense) =>
          selectedCategory === "All" || expense.category === selectedCategory,
      )
      .filter(
        (expense) =>
          !query ||
          `${expense.title} ${expense.category}`.toLowerCase().includes(query),
      )
      .sort((first, second) =>
        sortNewestFirst
          ? second.date.getTime() - first.date.getTime()
          : first.date.getTime() - second.date.getTime(),
      );
  }, [expenses, search, selectedCategory, sortNewestFirst]);

  const addExpense = () => {
    const amount = Number(newAmount.replace(/,/g, ""));
    if (!newTitle.trim() || !Number.isFinite(amount) || amount <= 0) {
      Alert.alert(
        "Check your expense",
        "Enter a title and an amount greater than zero.",
      );
      return;
    }

    setExpenses((current) => [
      {
        id: String(Date.now()),
        title: newTitle.trim(),
        category: newCategory,
        amount,
        date: new Date(),
      },
      ...current,
    ]);
    setSelectedCategory("All");
    setSearch("");
    setNewTitle("");
    setNewAmount("");
    setAddOpen(false);
  };

  const removeExpense = (expense: Expense) => {
    Alert.alert(expense.title, "Remove this expense?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          setExpenses((current) =>
            current.filter((item) => item.id !== expense.id),
          ),
      },
    ]);
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-[#0B8D51]">
      <View className="flex-1 bg-[#EFF5F3]">
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="pb-[150px]"
        >
          <LinearGradient
            colors={["#0B8D51", "#075B38"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="pt-2 pb-8"
          >
            <View className="px-6 flex-row items-center justify-between">
              <Image
                source={require("../../../assets/images/logo.png")}
                className="w-9 h-9 rounded-[9px]"
                resizeMode="cover"
                accessibilityLabel="Life Ledger logo"
              />
              <View className="flex-1 px-2.5">
                <Text className="text-white text-2xl font-extrabold">
                  Expense
                </Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  className="text-[#E1F0E8] text-[13px] mt-0.5"
                >
                  Track every rupee. Build a better tomorrow.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  searchOpen ? "Close search" : "Search expenses"
                }
                onPress={() => {
                  setSearchOpen((open) => !open);
                  setSearch("");
                }}
                className="w-[38px] h-[38px] rounded-[20px] bg-[#FFFFFF20] items-center justify-center"
              >
                <Ionicons
                  name={searchOpen ? "close" : "search"}
                  size={22}
                  color={Colors.white}
                />
              </Pressable>
            </View>
            {searchOpen && (
              <View className="mx-6 mt-2.5 h-[38px] rounded-xl bg-white flex-row items-center px-3">
                <Ionicons
                  name="search"
                  size={18}
                  color={Colors.textSecondary}
                />
                <TextInput
                  autoFocus
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search expenses"
                  placeholderTextColor={Colors.textSecondary}
                  className="flex-1 px-2.5 text-[#17284A]"
                />
              </View>
            )}
            {filtersVisible && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="mt-3 mx-6 p-1 rounded-[28px] border border-[#FFFFFF30] bg-[#FFFFFF12]"
              >
                {periods.map((period) => {
                  const selected = selectedPeriod === period;
                  return (
                    <Pressable
                      key={period}
                      accessibilityRole="tab"
                      accessibilityState={{ selected }}
                      onPress={() => setSelectedPeriod(period)}
                      style={{ minWidth: period === "This Month" ? 122 : 96 }}
                      className={`px-4 h-[34px] rounded-full items-center justify-center ${
                        selected ? "bg-white" : "bg-transparent"
                      }`}
                    >
                      <Text
                        className={`text-[14px] ${
                          selected
                            ? "text-[#064228] font-bold"
                            : "text-white font-medium"
                        }`}
                      >
                        {period}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </LinearGradient>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="z-10"
            contentContainerClassName="px-6 gap-2 mt-3 pb-2.5"
          >
            <SummaryCard
              title="Total Expense"
              amount="1,780"
              icon="wallet"
              width={Math.max(140, (width - 60) / 2.5)}
            />
            <SummaryCard
              title="Today"
              amount="350"
              icon="calendar"
              detail="3 transactions"
              width={Math.max(140, (width - 60) / 2.5)}
            />
            <SummaryCard
              title="This Month"
              amount="4,520"
              icon="bar-chart"
              change="8%"
              width={Math.max(140, (width - 60) / 2.5)}
            />
          </ScrollView>

          {filtersVisible && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="px-6 gap-2 pt-2.5 pb-1.5"
            >
              {categoryOptions.map((category) => {
                const selected = selectedCategory === category.label;
                return (
                  <Pressable
                    key={category.label}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedCategory(category.label)}
                    className={`w-[76px] h-[72px] rounded-xl border items-center justify-center gap-1 shadow-sm ${
                      selected
                        ? "bg-[#E0F3DE] border-[#BDE4B6]"
                        : "bg-white border-[#EDF1EF]"
                    }`}
                  >
                    <View
                      className={`w-[42px] h-[38px] rounded-lg items-center justify-center ${
                        selected ? "bg-[#398944]" : "bg-transparent"
                      }`}
                    >
                      <Ionicons
                        name={category.icon}
                        size={22}
                        color={selected ? Colors.white : "#08713A"}
                      />
                    </View>
                    <Text
                      className={`text-[12px] ${
                        selected
                          ? "text-[#17284A] font-bold"
                          : "text-[#17284A] font-medium"
                      }`}
                    >
                      {category.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <View className="mx-6 mt-1 mb-1 flex-row items-center justify-between">
            <Text className="text-[#17284A] text-lg font-extrabold">
              Recent Expenses
            </Text>
            <View className="flex-row items-center gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  filtersVisible ? "Hide filters" : "Show filters"
                }
                accessibilityState={{ expanded: filtersVisible }}
                onPress={() => setFiltersVisible((visible) => !visible)}
                className={`w-[38px] h-[38px] rounded-xl items-center justify-center shadow-sm ${
                  filtersVisible ? "bg-[#E0F3DE]" : "bg-white"
                }`}
              >
                <Ionicons
                  name="filter"
                  size={19}
                  color={filtersVisible ? Colors.primary : "#17284A"}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  sortNewestFirst ? "Sort oldest first" : "Sort latest first"
                }
                onPress={() => setSortNewestFirst((newest) => !newest)}
                className="h-[38px] px-2.5 rounded-2xl bg-white flex-row items-center gap-1.5 shadow-sm"
              >
                <Ionicons name="swap-vertical" size={17} color="#17284A" />
                <Text className="text-[#17284A] font-bold">
                  {sortNewestFirst ? "Latest First" : "Oldest First"}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#17284A" />
              </Pressable>
            </View>
          </View>

          <View className="mx-6 gap-1">
            {visibleExpenses.length ? (
              visibleExpenses.map((expense) => {
                const icon =
                  categoryOptions.find(
                    (category) => category.label === expense.category,
                  )?.icon ?? "ellipsis-horizontal";
                return (
                  <View
                    key={expense.id}
                    className="min-h-[60px] px-3.5 py-1.5 rounded-[17px] bg-white flex-row items-center gap-2.5"
                  >
                    <View className="w-[42px] h-[42px] rounded-[22px] bg-[#E2F2E5] items-center justify-center">
                      <Ionicons name={icon} size={24} color="#08713A" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text
                        numberOfLines={1}
                        className="text-[#17284A] text-[14px] font-bold"
                      >
                        {expense.title}
                      </Text>
                      <Text
                        numberOfLines={1}
                        className="text-[#6F7F9E] text-[11px] mt-0.5"
                      >
                        {expense.category} · {formatExpenseDate(expense.date)}
                      </Text>
                    </View>
                    <Text className="text-[#E00000] text-[15px] font-bold">
                      - {formatAmount(expense.amount)}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Options for ${expense.title}`}
                      onPress={() => removeExpense(expense)}
                      hitSlop={8}
                      className="w-[22px] items-center"
                    >
                      <Ionicons
                        name="ellipsis-vertical"
                        size={20}
                        color="#65708A"
                      />
                    </Pressable>
                  </View>
                );
              })
            ) : (
              <View className="items-center py-6 bg-white rounded-2xl">
                <Text className="text-[#17284A] font-bold">
                  No expenses found
                </Text>
                <Text className="text-[#6F7F9E] mt-1">
                  Try another category or search.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add expense"
          onPress={() => setAddOpen(true)}
          style={{ bottom: insets.bottom + 94 }}
          className="absolute right-5 w-[52px] h-[52px] rounded-full bg-[#0C7D3E] border border-[#90C83D] items-center justify-center shadow-md z-50"
        >
          <Ionicons name="add" size={30} color={Colors.white} />
        </Pressable>

        <Modal
          visible={addOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setAddOpen(false)}
        >
          <View className="flex-1 justify-end bg-[#00000055]">
            <View className="px-6 pt-6 pb-8 rounded-t-3xl bg-[#F8FBF9]">
              <View className="flex-row justify-between items-center mb-5">
                <Text className="text-[22px] font-extrabold text-[#17284A]">
                  Add Expense
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={() => setAddOpen(false)}
                >
                  <Ionicons name="close" size={24} color="#17284A" />
                </Pressable>
              </View>
              <Text className="text-[#6F7F9E] font-semibold mb-1.5">
                Expense name
              </Text>
              <TextInput
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="e.g. Lunch"
                placeholderTextColor={Colors.textSecondary}
                className="h-12 rounded-xl border border-[#EDF1EF] bg-white px-3.5 text-[#17284A] mb-3.5"
              />
              <Text className="text-[#6F7F9E] font-semibold mb-1.5">
                Amount (₹)
              </Text>
              <TextInput
                value={newAmount}
                onChangeText={setNewAmount}
                placeholder="0"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="decimal-pad"
                className="h-12 rounded-xl border border-[#EDF1EF] bg-white px-3.5 text-[#17284A] mb-4"
              />
              <Text className="text-[#6F7F9E] font-semibold mb-2">
                Category
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-2 pb-4"
              >
                {categoryOptions
                  .filter((category) => category.label !== "All")
                  .map((category) => {
                    const selected = newCategory === category.label;
                    return (
                      <Pressable
                        key={category.label}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() =>
                          setNewCategory(category.label as Category)
                        }
                        className={`py-2 px-3 rounded-[18px] border ${
                          selected
                            ? "bg-[#0B8D51] border-[#0B8D51]"
                            : "bg-white border-[#EDF1EF]"
                        }`}
                      >
                        <Text
                          className={`font-semibold ${
                            selected ? "text-white" : "text-[#17284A]"
                          }`}
                        >
                          {category.label}
                        </Text>
                      </Pressable>
                    );
                  })}
              </ScrollView>
              <Pressable
                accessibilityRole="button"
                onPress={addExpense}
                className="h-[52px] rounded-2xl bg-[#0B8D51] items-center justify-center"
              >
                <Text className="text-white text-[16px] font-bold">
                  Save Expense
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

function SummaryCard({
  title,
  amount,
  icon,
  width,
  detail,
  change,
}: {
  title: string;
  amount: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  width: number;
  detail?: string;
  change?: string;
}) {
  return (
    <View
      style={{ width }}
      className="p-3 rounded-2xl bg-[#FCFDFD] flex-col items-start shadow-sm"
    >
      <View className="w-[38px] h-[38px] rounded-full bg-[#E4F2E7] items-center justify-center mb-2">
        <Ionicons name={icon} size={22} color="#08713A" />
      </View>
      <Text
        numberOfLines={1}
        className="text-[#71809B] text-[13px] font-medium"
      >
        {title}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        className="text-[#17284A] text-[22px] font-extrabold mt-1 mb-1"
      >
        {formatAmount(Number(amount.replace(/,/g, "")))}
      </Text>
      {detail ? (
        <Text
          numberOfLines={1}
          className="text-[#064228] bg-[#E3F2E5] rounded-lg px-2 py-1 text-[11px] font-semibold self-start"
        >
          {detail}
        </Text>
      ) : change ? (
        <View className="flex-row items-center gap-1">
          <Ionicons name="arrow-up" size={14} color="#F00000" />
          <Text className="text-[#F00000] text-[12px] font-bold">{change}</Text>
          <Text className="text-[#71809B] text-[11px]">vs last month</Text>
        </View>
      ) : (
        <View className="flex-row items-center gap-1">
          <Ionicons name="arrow-down" size={14} color={Colors.primary} />
          <Text className="text-[#0B8D51] text-[12px] font-bold">12%</Text>
          <Text className="text-[#71809B] text-[11px]">vs last month</Text>
        </View>
      )}
    </View>
  );
}
