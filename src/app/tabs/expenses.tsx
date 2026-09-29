import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import api, { getApiErrorMessage, logoutUser } from "../../api";
import { Colors } from "../../constants/colors";

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

type ExpenseForm = {
  title: string;
  expense_amount: string;
  category: string;
  payment_method: string;
  date: string;
  time: string;
  notes: string;
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

const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  Food: "restaurant-outline",
  Travel: "car-outline",
  Bills: "document-text-outline",
  Shopping: "bag-handle-outline",
  Health: "medkit-outline",
  Education: "school-outline",
  Other: "ellipsis-horizontal-outline",
};

const paymentMethods = [
  "Cash",
  "UPI",
  "Bank Transfer",
  "Card",
  "Cheque",
  "Other",
];

function getCurrentDate() {
  return new Date().toISOString().split("T")[0];
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

export default function Expenses() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    totalAmount: 0,
    totalTransfer: 0,
    recurring: 0,
  });
  const [categoryOptions, setCategoryOptions] =
    useState<string[]>(fallbackCategories);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ExpenseForm>({
    title: "",
    expense_amount: "",
    category: fallbackCategories[0],
    payment_method: "Cash",
    date: getCurrentDate(),
    time: getCurrentTime(),
    notes: "",
  });

  const handleUnauthorized = async () => {
    await logoutUser();
    router.replace("/auth/login");
  };

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [expensesRes, statsRes, categoriesRes] = await Promise.all([
        api.get("/expenses"),
        api.get("/expenses/stats"),
        api.get("/categories"),
      ]);

      const categories = Array.isArray(categoriesRes?.data)
        ? categoriesRes.data
            .map(
              (category: any) =>
                category?.name || category?.category || category,
            )
            .filter(Boolean)
        : fallbackCategories;

      const acceptableCategories = categories.length
        ? categories.filter(
            (category: string) =>
              fallbackCategories.includes(category) ||
              category.trim().length > 0,
          )
        : fallbackCategories;

      setExpenses(Array.isArray(expensesRes?.data) ? expensesRes.data : []);
      setStats(
        statsRes?.data || {
          total: 0,
          totalAmount: 0,
          totalTransfer: 0,
          recurring: 0,
        },
      );
      setCategoryOptions(acceptableCategories);
      setSelectedCategory("All");
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
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const visibleExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return expenses.filter((expense) => {
      const matchesCategory =
        selectedCategory === "All" ||
        (expense.category || "Other") === selectedCategory;

      const haystack = `${expense.title || ""} ${expense.category || ""} ${
        expense.notes || ""
      }`.toLowerCase();

      const matchesSearch = !query || haystack.includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [expenses, search, selectedCategory]);

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
    setForm({
      title: "",
      expense_amount: "",
      category: categoryOptions[0] || fallbackCategories[0],
      payment_method: "Cash",
      date: getCurrentDate(),
      time: getCurrentTime(),
      notes: "",
    });
  };

  const handleCreateExpense = async () => {
    if (
      !form.title.trim() ||
      !form.expense_amount ||
      Number(form.expense_amount) <= 0
    ) {
      Alert.alert(
        "Validation",
        "Please enter a valid title and expense amount.",
      );
      return;
    }

    try {
      setSaving(true);
      const payload = new FormData();

      payload.append("title", form.title.trim());
      payload.append("expense_amount", String(Number(form.expense_amount)));
      payload.append("category", form.category);
      payload.append("payment_method", form.payment_method);
      payload.append("expense_date", form.date);
      payload.append("expense_time", form.time);
      payload.append("notes", form.notes || "");

      const response = await api.post("/expenses", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const savedExpense = response?.data?.expense || response?.data || null;
      setExpenses((current) =>
        savedExpense ? [savedExpense, ...current] : current,
      );
      setIsModalVisible(false);
      resetForm();
      fetchAll();
      Alert.alert("Success", "Expense saved successfully.");
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
      style={{ flex: 1, backgroundColor: Colors.contentBackground }}
    >
      <View style={{ flex: 1, backgroundColor: Colors.contentBackground }}>
        <LinearGradient
          colors={[Colors.headerStart, Colors.headerEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: 18, paddingBottom: 18 }}
        >
          <View
            style={{
              paddingHorizontal: 18,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: "#F3F7F4",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: Colors.headerStart,
                  }}
                >
                  L
                </Text>
              </View>
              <Text
                style={{ fontSize: 28, color: Colors.white, fontWeight: "800" }}
              >
                Expense
              </Text>
            </View>

            <Pressable
              onPress={() => setIsModalVisible(true)}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: "rgba(255,255,255,0.15)",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="add" size={24} color={Colors.white} />
            </Pressable>
          </View>
        </LinearGradient>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: insets.bottom + 120,
          }}
        >
          <View
            style={{ flexDirection: "row", alignItems: "stretch", gap: 12 }}
          >
            <StatCard
              label="Total"
              value={formatAmount(stats.totalAmount || totals.totalExpense)}
              accent="#240046"
            />
            <StatCard
              label="Today"
              value={formatAmount(totals.todayExpense)}
              accent="#0B8D51"
            />
          </View>

          <View
            style={{
              marginTop: 18,
              backgroundColor: Colors.white,
              borderRadius: 18,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: "#E7EDEB",
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Ionicons name="search-outline" size={20} color="#6F7F9E" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search expense..."
              placeholderTextColor="#7B8895"
              style={{
                flex: 1,
                marginLeft: 10,
                fontSize: 16,
                color: "#17284A",
              }}
            />
          </View>

          <View
            style={{
              marginTop: 18,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                letterSpacing: 1.4,
                color: "#6A7176",
                fontWeight: "700",
              }}
            >
              CATEGORY
            </Text>
            <Text
              style={{ fontSize: 12, color: Colors.forest, fontWeight: "700" }}
            >
              {categoryOptions.length} filters
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 12, gap: 10 }}
          >
            {["All", ...categoryOptions].map((category) => {
              const isSelected = selectedCategory === category;
              const icon =
                category === "All"
                  ? "grid-outline"
                  : categoryIcons[category] || "pricetag-outline";

              return (
                <Pressable
                  key={category}
                  onPress={() => setSelectedCategory(category)}
                  style={{
                    width: 80,
                    minHeight: 74,
                    backgroundColor: isSelected ? "#E8F6EE" : Colors.white,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: isSelected ? "#B7E0C7" : "#E7EDEB",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 8,
                  }}
                >
                  <Ionicons
                    name={icon}
                    size={20}
                    color={isSelected ? Colors.forest : "#2E4A44"}
                  />
                  <Text
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: isSelected ? Colors.forest : "#2E4A44",
                      fontWeight: isSelected ? "700" : "600",
                    }}
                  >
                    {category}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ marginTop: 12 }}>
            {loading ? (
              <View style={{ paddingVertical: 32, alignItems: "center" }}>
                <Text style={{ color: "#586A78", fontSize: 15 }}>
                  Loading expenses...
                </Text>
              </View>
            ) : visibleExpenses.length === 0 ? (
              <View
                style={{
                  backgroundColor: Colors.white,
                  borderRadius: 18,
                  padding: 26,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#E7EDEB",
                }}
              >
                <Ionicons name="receipt-outline" size={36} color="#8A99A4" />
                <Text
                  style={{
                    marginTop: 10,
                    fontSize: 18,
                    fontWeight: "700",
                    color: "#1F2D2D",
                  }}
                >
                  No expenses found
                </Text>
                <Text style={{ marginTop: 6, color: "#6A7176", fontSize: 13 }}>
                  Try a different category or add a new expense.
                </Text>
              </View>
            ) : (
              visibleExpenses.map((expense) => {
                const icon =
                  categoryIcons[String(expense.category || "Other")] ||
                  "pricetag-outline";

                return (
                  <View
                    key={String(expense.id)}
                    style={{
                      backgroundColor: Colors.white,
                      borderRadius: 18,
                      padding: 14,
                      marginBottom: 12,
                      borderWidth: 1,
                      borderColor: "#E7EDEB",
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <View
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 16,
                        backgroundColor: "#EAF4EE",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Ionicons name={icon} size={22} color={Colors.forest} />
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: "800",
                          color: "#1F2D2D",
                        }}
                      >
                        {expense.title || "Expense"}
                      </Text>
                      <Text
                        style={{ marginTop: 4, fontSize: 12, color: "#6A7176" }}
                      >
                        {expense.category || "Other"} ·{" "}
                        {formatDate(expense.expense_date)}
                      </Text>
                    </View>

                    <View style={{ alignItems: "flex-end", marginRight: 10 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "800",
                          color: "#D64545",
                        }}
                      >
                        {formatAmount(
                          expense.expense_amount ?? expense.amount ?? 0,
                        )}
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => handleDeleteExpense(expense)}
                      hitSlop={10}
                      style={{ padding: 4 }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color="#D64545"
                      />
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </View>

      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: Colors.white,
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              paddingHorizontal: 18,
              paddingTop: 18,
              paddingBottom: insets.bottom + 18,
              maxHeight: "88%",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 18,
              }}
            >
              <Text
                style={{ fontSize: 24, fontWeight: "800", color: "#17284A" }}
              >
                Add Expense
              </Text>
              <Pressable onPress={() => setIsModalVisible(false)}>
                <Ionicons name="close" size={22} color="#17284A" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TextField
                label="Title"
                value={form.title}
                onChangeText={(text) =>
                  setForm((current) => ({ ...current, title: text }))
                }
                placeholder="e.g. Grocery"
              />

              <TextField
                label="Amount"
                value={form.expense_amount}
                onChangeText={(text) =>
                  setForm((current) => ({ ...current, expense_amount: text }))
                }
                placeholder="0.00"
                keyboardType="decimal-pad"
              />

              <View style={{ marginBottom: 14 }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: "#6A7176",
                    fontWeight: "700",
                    marginBottom: 8,
                    letterSpacing: 1.2,
                  }}
                >
                  CATEGORY
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {categoryOptions.map((item) => {
                    const selected = form.category === item;
                    return (
                      <Pressable
                        key={item}
                        onPress={() =>
                          setForm((current) => ({ ...current, category: item }))
                        }
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 12,
                          backgroundColor: selected ? "#EAF6EE" : "#F3F5F4",
                          borderWidth: 1,
                          borderColor: selected ? "#BEE1C8" : "#E5ECEA",
                        }}
                      >
                        <Text
                          style={{
                            color: selected ? Colors.forest : "#2E4A44",
                            fontWeight: selected ? "700" : "600",
                          }}
                        >
                          {item}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={{ flexDirection: "row", gap: 12, marginBottom: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#6A7176",
                      fontWeight: "700",
                      marginBottom: 8,
                      letterSpacing: 1.2,
                    }}
                  >
                    DATE
                  </Text>
                  <TextInput
                    value={form.date}
                    onChangeText={(text) =>
                      setForm((current) => ({ ...current, date: text }))
                    }
                    placeholder="YYYY-MM-DD"
                    style={inputStyle}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#6A7176",
                      fontWeight: "700",
                      marginBottom: 8,
                      letterSpacing: 1.2,
                    }}
                  >
                    TIME
                  </Text>
                  <TextInput
                    value={form.time}
                    onChangeText={(text) =>
                      setForm((current) => ({ ...current, time: text }))
                    }
                    placeholder="HH:MM"
                    style={inputStyle}
                  />
                </View>
              </View>

              <Text
                style={{
                  fontSize: 12,
                  color: "#6A7176",
                  fontWeight: "700",
                  marginBottom: 8,
                  letterSpacing: 1.2,
                }}
              >
                PAYMENT METHOD
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                {paymentMethods.map((method) => {
                  const selected = form.payment_method === method;
                  return (
                    <Pressable
                      key={method}
                      onPress={() =>
                        setForm((current) => ({
                          ...current,
                          payment_method: method,
                        }))
                      }
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 12,
                        backgroundColor: selected ? "#F1E9FF" : "#F3F5F4",
                        borderWidth: 1,
                        borderColor: selected ? "#D3C5FF" : "#E5ECEA",
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? "#4B1F7D" : "#2E4A44",
                          fontWeight: selected ? "700" : "600",
                        }}
                      >
                        {method}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextField
                label="Notes"
                value={form.notes}
                onChangeText={(text) =>
                  setForm((current) => ({ ...current, notes: text }))
                }
                placeholder="Optional detail"
                multiline
              />

              <Pressable
                onPress={handleCreateExpense}
                disabled={saving}
                style={{
                  marginTop: 18,
                  backgroundColor: Colors.forest,
                  borderRadius: 16,
                  height: 52,
                  justifyContent: "center",
                  alignItems: "center",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                <Text
                  style={{
                    color: Colors.white,
                    fontWeight: "800",
                    fontSize: 16,
                  }}
                >
                  {saving ? "Saving..." : "Save Expense"}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Colors.white,
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: "#E7EDEB",
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          backgroundColor: `${accent}1A`,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <Ionicons name="wallet-outline" size={20} color={accent} />
      </View>
      <Text
        style={{
          fontSize: 11,
          color: "#6A7176",
          letterSpacing: 1.2,
          fontWeight: "700",
        }}
      >
        {label.toUpperCase()}
      </Text>
      <Text
        style={{
          fontSize: 22,
          color: "#1F2D2D",
          fontWeight: "800",
          marginTop: 6,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "number-pad" | "decimal-pad" | "numeric";
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text
        style={{
          fontSize: 12,
          color: "#6A7176",
          fontWeight: "700",
          marginBottom: 8,
          letterSpacing: 1.2,
        }}
      >
        {label.toUpperCase()}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        style={{
          ...inputStyle,
          minHeight: multiline ? 88 : 44,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}

const inputStyle = {
  backgroundColor: "#F5F7F6",
  borderWidth: 1,
  borderColor: "#E5ECEA",
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 15,
  color: "#17284A",
};
