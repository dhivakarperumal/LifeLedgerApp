import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api, { getApiErrorMessage, getStoredUser, logoutUser } from "../api";
import { AddButton } from "../components/AddButton";
import { FormInput, FormOption } from "../components/FormControls";
import { GradientSafeAreaView as SafeAreaView } from "../components/GradientSafeAreaView";
import { Colors } from "../constants/colors";

type CategoryType =
  "Expensive" | "Income" | "Transfer" | "Memories" | "Diary" | "CalendarEvent";
type Category = {
  id?: number | string;
  catId: string;
  user_id?: string | number | null;
  name: string;
  description?: string;
  status?: string;
  catType?: string;
  category_type?: string;
  type?: string;
  subcategory?: string[];
  images?: string[] | string;
};

type CategoryForm = {
  name: string;
  description: string;
  status: "Active" | "Inactive";
  catType: CategoryType;
  subcategory: string;
};

const categoryTypes: CategoryType[] = [
  "Expensive",
  "Income",
  "Transfer",
  "Memories",
  "Diary",
  "CalendarEvent",
];

const initialForm: CategoryForm = {
  name: "",
  description: "",
  status: "Active",
  catType: "Expensive",
  subcategory: "",
};

function getCategoryType(category: Category) {
  return String(
    category.catType || category.category_type || category.type || "Expensive",
  ).trim();
}

function getCategoryRows(data: unknown): Category[] {
  let rows: unknown = data;
  if (rows && typeof rows === "object" && !Array.isArray(rows)) {
    const response = rows as Record<string, unknown>;
    rows = response.categories ?? response.data;
  }
  if (!Array.isArray(rows)) return [];
  return rows.filter(
    (row): row is Category => !!row && typeof row === "object" && "name" in row,
  );
}

function getNextCategoryId(categories: Category[]) {
  const highestId = categories.reduce((highest, category) => {
    const match = String(category.catId || "").match(/^CAT(\d+)$/i);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `CAT${String(highestId + 1).padStart(3, "0")}`;
}

function getTypeColors(type: string) {
  if (type.toLowerCase() === "income") return ["#E7F6EE", "#18794E"];
  if (type.toLowerCase() === "transfer") return ["#E8F1FA", "#356B9A"];
  if (type.toLowerCase() === "memories") return ["#F9EFE3", "#A56326"];
  if (type.toLowerCase() === "diary") return ["#FBE9E8", "#B74B43"];
  return ["#F1ECDF", "#79652D"];
}

export default function Categories() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<Category[]>([]);
  const [userId, setUserId] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CategoryForm>(initialForm);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const [response, user] = await Promise.all([
        api.get("/categories"),
        getStoredUser(),
      ]);
      const currentUserId = user?.user_id || null;
      setUserId(currentUserId);
      setCategories(
        getCategoryRows(response.data).filter(
          (category) =>
            !currentUserId ||
            category.user_id === currentUserId ||
            category.user_id === null ||
            category.user_id === undefined ||
            category.user_id === "",
        ),
      );
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 401) {
        await logoutUser();
        router.replace("/auth/login");
        return;
      }
      Alert.alert("Unable to load categories", getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void fetchCategories();
    }, [fetchCategories]),
  );

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return categories.filter((category) => {
      const matchesSearch =
        !query ||
        `${category.name} ${category.catId || ""}`
          .toLowerCase()
          .includes(query);
      const matchesType =
        typeFilter === "All" ||
        getCategoryType(category).toLowerCase() === typeFilter.toLowerCase();
      const matchesStatus =
        statusFilter === "All" ||
        (category.status || "Active") === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [categories, search, statusFilter, typeFilter]);

  const activeCount = categories.filter(
    (category) => (category.status || "Active") === "Active",
  ).length;
  const inactiveCount = categories.length - activeCount;

  const openAddModal = () => {
    setEditingCategory(null);
    setForm(initialForm);
    setModalVisible(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setForm({
      name: category.name || "",
      description: category.description || "",
      status: category.status === "Inactive" ? "Inactive" : "Active",
      catType: (getCategoryType(category) as CategoryType) || "Expensive",
      subcategory: Array.isArray(category.subcategory)
        ? category.subcategory.join("\n")
        : "",
    });
    setModalVisible(true);
  };

  const saveCategory = async () => {
    const name = form.name.trim();
    if (!name) {
      Alert.alert("Category name required", "Enter a name to continue.");
      return;
    }

    const catId = editingCategory?.catId || getNextCategoryId(categories);
    const categoryData = {
      ...form,
      name,
      catId,
      user_id: userId || editingCategory?.user_id || null,
      images: editingCategory?.images ?? [],
      subcategory: form.subcategory
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
    };

    setSaving(true);
    try {
      if (editingCategory) {
        const response = await api.put(`/categories/${catId}`, categoryData);
        const saved = getCategoryRows(response.data)[0] || categoryData;
        setCategories((current) =>
          current.map((category) =>
            category.catId === catId ? { ...category, ...saved } : category,
          ),
        );
      } else {
        const response = await api.post("/categories", categoryData);
        const saved = getCategoryRows(response.data)[0] || response.data || {};
        setCategories((current) => [
          { ...categoryData, ...saved, catId: saved.catId || catId },
          ...current,
        ]);
      }
      setModalVisible(false);
    } catch (error) {
      Alert.alert("Unable to save category", getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = (category: Category) => {
    Alert.alert(
      "Delete category?",
      `Delete ${category.name}? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void api
              .delete(`/categories/${category.catId}`)
              .then(() =>
                setCategories((current) =>
                  current.filter((item) => item.catId !== category.catId),
                ),
              )
              .catch((error) =>
                Alert.alert(
                  "Unable to delete category",
                  getApiErrorMessage(error),
                ),
              );
          },
        },
      ],
    );
  };

  const setFormValue = <K extends keyof CategoryForm>(
    key: K,
    value: CategoryForm[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

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
          <Text className="ml-3 text-lg font-bold text-white">Categories</Text>
        </View>
      </LinearGradient>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void fetchCategories()}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingBottom: insets.bottom + 90,
        }}
      >
        <View className="mb-4 mt-6 flex-row gap-3">
          <SummaryStatCard
            title="Total"
            value={categories.length}
            icon="layers-outline"
            iconBg="#E2E8F0"
            iconColor="#475569"
          />
          <SummaryStatCard
            title="Active"
            value={activeCount}
            icon="checkmark-circle-outline"
            iconBg="#DDF2D1"
            iconColor="#388e3c"
          />
          <SummaryStatCard
            title="Inactive"
            value={inactiveCount}
            icon="close-circle-outline"
            iconBg="#FEE2E2"
            iconColor="#EF4444"
          />
        </View>

        <View className="mb-4 flex-row items-center rounded-xl border border-[#E4E8E3] bg-white px-3">
          <Ionicons name="search-outline" size={19} color="#87918A" />
          <TextInput
            accessibilityLabel="Search categories"
            className="h-12 flex-1 px-3 text-sm text-[#25332C]"
            placeholder="Search name or ID"
            placeholderTextColor="#9AA39D"
            value={search}
            onChangeText={setSearch}
          />
          {!!search && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setSearch("")}
            >
              <Ionicons name="close-circle" size={19} color="#87918A" />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 14 }}
        >
          {["All", ...categoryTypes].map((type) => {
            const selected = typeFilter === type;
            return (
              <Pressable
                key={type}
                className={`rounded-full border px-3.5 py-2 ${selected ? "border-[#315640] bg-[#315640]" : "border-[#E0E5DF] bg-white"}`}
                onPress={() => setTypeFilter(type)}
              >
                <Text
                  className={`text-xs font-bold ${selected ? "text-white" : "text-[#637068]"}`}
                >
                  {type === "All" ? "All types" : type}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="mb-3 flex-row gap-2">
          {["All", "Active", "Inactive"].map((status) => {
            const selected = statusFilter === status;
            return (
              <Pressable
                key={status}
                className={`rounded-lg px-3 py-2 ${selected ? "bg-[#E3ECE4]" : "bg-transparent"}`}
                onPress={() => setStatusFilter(status)}
              >
                <Text
                  className={`text-xs font-bold ${selected ? "text-[#315640]" : "text-[#7B8580]"}`}
                >
                  {status === "All" ? "All statuses" : status}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color="#315640" />
            <Text className="mt-3 text-sm font-medium text-[#7B8580]">
              Loading categories...
            </Text>
          </View>
        ) : filteredCategories.length === 0 ? (
          <View className="items-center rounded-2xl border border-[#E4E8E3] bg-white px-6 py-12">
            <Ionicons name="file-tray-outline" size={34} color="#A4ADA6" />
            <Text className="mt-3 text-base font-bold text-[#25332C]">
              No categories found
            </Text>
            <Text className="mt-1 text-center text-sm text-[#7B8580]">
              Try another filter or create a category.
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {filteredCategories.map((category) => {
              const type = getCategoryType(category);
              const [typeBackground, typeColor] = getTypeColors(type);
              const active = (category.status || "Active") === "Active";
              return (
                <View
                  key={category.catId || category.id}
                  className="rounded-2xl border border-[#E4E8E3] bg-white p-4"
                >
                  <View className="flex-row items-start justify-between">
                    <View className="mr-3 flex-1">
                      <Text className="text-base font-bold text-[#25332C]">
                        {category.name}
                      </Text>
                      <Text className="mt-1 text-xs font-semibold text-[#8A948D]">
                        {category.catId || "No ID"}
                      </Text>
                    </View>
                    <View
                      className="rounded-full px-2.5 py-1"
                      style={{ backgroundColor: typeBackground }}
                    >
                      <Text
                        className="text-xs font-bold"
                        style={{ color: typeColor }}
                      >
                        {type}
                      </Text>
                    </View>
                  </View>
                  <Text
                    className="mt-3 text-sm leading-5 text-[#69756D]"
                    numberOfLines={2}
                  >
                    {category.description || "No description"}
                  </Text>
                  <View className="mt-4 flex-row items-center justify-between border-t border-[#EEF0ED] pt-3">
                    <View className="flex-row items-center">
                      <View
                        className={`mr-2 h-2 w-2 rounded-full ${active ? "bg-[#2B9A65]" : "bg-[#C68A42]"}`}
                      />
                      <Text
                        className={`text-xs font-semibold ${active ? "text-[#25805A]" : "text-[#A56A2F]"}`}
                      >
                        {active ? "Active" : "Inactive"}
                      </Text>
                    </View>
                    <View className="flex-row gap-2">
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${category.name}`}
                        className="h-9 w-9 items-center justify-center rounded-full bg-[#EEF3F8]"
                        onPress={() => openEditModal(category)}
                      >
                        <Ionicons
                          name="create-outline"
                          size={17}
                          color="#426C92"
                        />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${category.name}`}
                        className="h-9 w-9 items-center justify-center rounded-full bg-[#FBEDEC]"
                        onPress={() => deleteCategory(category)}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={17}
                          color="#B64C45"
                        />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <AddButton
        onPress={openAddModal}
        accessibilityLabel="Add category"
        accessibilityHint="Opens the new category form"
      />

      <Modal
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
        transparent
        visible={modalVisible}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[90%] rounded-t-[26px] bg-[#F8F9F6] px-5 pb-8 pt-5">
            <View className="mb-5 flex-row items-center justify-between">
              <View>
                <Text className="text-xl font-bold text-[#25332C]">
                  {editingCategory ? "Edit category" : "New category"}
                </Text>
                {editingCategory && (
                  <Text className="mt-1 text-xs font-medium text-[#818B84]">
                    {editingCategory.catId}
                  </Text>
                )}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close form"
                className="h-9 w-9 items-center justify-center rounded-full bg-white"
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#526058" />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text className="mb-2 text-xs font-bold text-[#46534B]">
                Category name
              </Text>
              <FormInput
                className="mb-4 rounded-xl bg-white px-4 py-3 text-sm text-[#25332C]"
                placeholder="e.g. Groceries"
                value={form.name}
                onChangeText={(value) => setFormValue("name", value)}
              />

              <Text className="mb-2 text-xs font-bold text-[#46534B]">
                Category type
              </Text>
              <View className="mb-4 flex-row flex-wrap gap-2">
                {categoryTypes.map((type) => {
                  const selected = form.catType === type;
                  return (
                    <FormOption
                      key={type}
                      selected={selected}
                      className={`rounded-full px-3 py-2 ${selected ? "bg-[#315640]" : "bg-white"}`}
                      onPress={() => setFormValue("catType", type)}
                    >
                      <Text
                        className={`text-xs font-bold ${selected ? "text-white" : "text-[#637068]"}`}
                      >
                        {type}
                      </Text>
                    </FormOption>
                  );
                })}
              </View>

              <Text className="mb-2 text-xs font-bold text-[#46534B]">
                Description
              </Text>
              <FormInput
                className="mb-4 min-h-[88px] rounded-xl bg-white px-4 py-3 text-sm text-[#25332C]"
                multiline
                placeholder="Add a short description"
                textAlignVertical="top"
                value={form.description}
                onChangeText={(value) => setFormValue("description", value)}
              />

              <Text className="mb-2 text-xs font-bold text-[#46534B]">
                Subcategories
              </Text>
              <FormInput
                className="mb-4 min-h-[76px] rounded-xl bg-white px-4 py-3 text-sm text-[#25332C]"
                multiline
                placeholder="One per line"
                textAlignVertical="top"
                value={form.subcategory}
                onChangeText={(value) => setFormValue("subcategory", value)}
              />

              <Text className="mb-2 text-xs font-bold text-[#46534B]">
                Status
              </Text>
              <View className="mb-5 flex-row gap-2">
                {(["Active", "Inactive"] as const).map((status) => {
                  const selected = form.status === status;
                  return (
                    <FormOption
                      key={status}
                      selected={selected}
                      className={`flex-1 items-center rounded-xl py-3 ${selected ? "bg-[#E7F0E8]" : "bg-white"}`}
                      onPress={() => setFormValue("status", status)}
                    >
                      <Text
                        className={`text-sm font-bold ${selected ? "text-[#315640]" : "text-[#637068]"}`}
                      >
                        {status}
                      </Text>
                    </FormOption>
                  );
                })}
              </View>
            </ScrollView>

            <View className="flex-row gap-3 pt-3">
              <Pressable
                className="flex-1 items-center rounded-xl border border-[#DDE3DC] bg-white py-3.5"
                disabled={saving}
                onPress={() => setModalVisible(false)}
              >
                <Text className="text-sm font-bold text-[#58645C]">Cancel</Text>
              </Pressable>
              <Pressable
                className="flex-1 flex-row items-center justify-center rounded-xl bg-[#315640] py-3.5"
                disabled={saving}
                onPress={() => void saveCategory()}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-sm font-bold text-white">
                    {editingCategory ? "Save changes" : "Create category"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SummaryStatCard({
  title,
  value,
  icon,
  iconBg,
  iconColor,
}: {
  title: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 4,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          position: "absolute",
          bottom: -20,
          right: -20,
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: "#F0Fdf4",
          opacity: 0.6,
        }}
      />
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: iconBg,
            justifyContent: "center",
            alignItems: "center",
            marginRight: 8,
          }}
        >
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
        <Text style={{ fontSize: 11, fontWeight: "800", color: "#8b929c", flexShrink: 1 }} numberOfLines={1}>
          {title.toUpperCase()}
        </Text>
      </View>
      <View>
        <Text style={{ fontSize: 24, fontWeight: "900", color: "#111827", letterSpacing: -0.5 }}>
          {value}
        </Text>
      </View>
    </View>
  );
}
