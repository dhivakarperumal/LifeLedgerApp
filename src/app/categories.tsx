import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    useWindowDimensions,
    View,
    type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";
import api, {
    API_BASE_URL,
    getApiErrorMessage,
    getStoredUser,
    logoutUser,
} from "../api";
import { AddButton } from "../components/AddButton";
import { CenteredPageLoader } from "../components/CenteredPageLoader";
import ConfirmPopup from "../components/ConfirmPopup";
import {
    countActiveFilters,
    DEFAULT_FILTER_STATE,
    type FilterState,
    type StatusOption,
    type ViewModeOption,
} from "../components/filters";
import { FormInput, FormLabel, FormOption } from "../components/FormControls";
import { GradientSafeAreaView as SafeAreaView } from "../components/GradientSafeAreaView";
import { PopupSelect } from "../components/PopupSelect";
import { SearchBar } from "../components/SearchBar";
import { createSessionDataCache } from "../components/SessionDataCache";
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

type CategoriesData = {
  categories: Category[];
  userId: string | number | null;
};

const categoriesDataCache = createSessionDataCache<CategoriesData>();

type CategoryForm = {
  name: string;
  description: string;
  status: "Active" | "Inactive";
  catType: CategoryType;
  subcategory: string;
};

type CategoryImage = {
  uri: string;
  name: string;
  mimeType: string;
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
    rows = response.categories ?? response.category ?? response.data;
  }
  if (!Array.isArray(rows)) return [];
  return rows.filter(
    (row): row is Category => !!row && typeof row === "object" && "name" in row,
  );
}

function getCategoryImage(category: Category): string | null {
  const images = category.images;
  if (Array.isArray(images)) return images.find((image) => !!image) || null;
  if (typeof images !== "string" || !images.trim()) return null;

  try {
    const parsed: unknown = JSON.parse(images);
    if (Array.isArray(parsed)) {
      return parsed.find((image): image is string => typeof image === "string") || null;
    }
  } catch {
    return images;
  }

  return images;
}

function getCategoryImageUri(uri: string): string {
  if (/^(https?:|file:|content:|data:)/i.test(uri)) return uri;
  const apiOrigin = API_BASE_URL.replace(/\/api\/?$/i, "");
  return `${apiOrigin}/${uri.replace(/^\/+/, "")}`;
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
  const { form: rawForm, id: rawEditId } = useLocalSearchParams<{
    form?: string | string[];
    id?: string | string[];
  }>();
  const formParam = Array.isArray(rawForm) ? rawForm[0] : rawForm;
  const editId = Array.isArray(rawEditId) ? rawEditId[0] : rawEditId;
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const statCardWidth: ViewStyle["width"] = "31.8%";
  const compactStats = screenWidth < 480;
  const [categories, setCategories] = useState<Category[]>(
    () => categoriesDataCache.get()?.categories ?? [],
  );
  const [userId, setUserId] = useState<string | number | null>(
    () => categoriesDataCache.get()?.userId ?? null,
  );
  const [loading, setLoading] = useState(() => !categoriesDataCache.hasData());
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<StatusOption>("All");
  const [viewMode, setViewMode] = useState<ViewModeOption>(
    DEFAULT_FILTER_STATE.viewMode,
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(initialForm);
  const [selectedImage, setSelectedImage] = useState<CategoryImage | null>(null);
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);

  const fetchCategories = useCallback(async (
    showLoading = !categoriesDataCache.hasData(),
  ) => {
    if (showLoading && !categoriesDataCache.hasData()) setLoading(true);
    try {
      const data = await categoriesDataCache.load(async () => {
        const [response, user] = await Promise.all([
          api.get("/categories"),
          getStoredUser(),
        ]);
        const currentUserId = user?.user_id || null;
        return {
          userId: currentUserId,
          categories: getCategoryRows(response.data).filter(
            (category) =>
              !currentUserId ||
              category.user_id === currentUserId ||
              category.user_id === null ||
              category.user_id === undefined ||
              category.user_id === "",
          ),
        };
      });
      setUserId(data.userId);
      setCategories(data.categories);
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 401) {
        await logoutUser();
        router.replace("/auth/login");
        return;
      }
      Alert.alert("Unable to load categories", getApiErrorMessage(error));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [router]);

  const refreshCategories = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchCategories(false);
    } finally {
      setRefreshing(false);
    }
  }, [fetchCategories]);

  useFocusEffect(
    useCallback(() => {
      void fetchCategories(!categoriesDataCache.hasData());
    }, [fetchCategories]),
  );

  const categoryFilterValues = useMemo<FilterState>(
    () => ({
      ...DEFAULT_FILTER_STATE,
      status: statusFilter,
      viewMode,
      custom: { categoryType: typeFilter },
    }),
    [statusFilter, typeFilter, viewMode],
  );

  const applyCategoryFilters = (filters: FilterState) => {
    setStatusFilter(filters.status);
    setTypeFilter(filters.custom?.categoryType || "All");
    setViewMode(filters.viewMode);
  };

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

  const openAddModal = useCallback(() => {
    setEditingCategory(null);
    setForm(initialForm);
    setSelectedImage(null);
    setExistingImage(null);
    setImageRemoved(false);
    setModalVisible(true);
  }, []);

  const openEditModal = useCallback((category: Category) => {
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
    setSelectedImage(null);
    setExistingImage(getCategoryImage(category));
    setImageRemoved(false);
    setModalVisible(true);
  }, []);

  const closeCategoryForm = () => {
    if (router.canGoBack()) router.back();
    else setModalVisible(false);
  };

  useEffect(() => {
    if (formParam === "new") {
      const timeout = setTimeout(() => {
        openAddModal();
        router.setParams({ form: undefined });
      }, 0);
      return () => clearTimeout(timeout);
    }
    if (formParam !== "edit" || !editId || loading) return;
    const category = categories.find(
      (item) => String(item.id ?? item.catId) === editId,
    );
    if (!category) {
      Alert.alert("Category not found", "This category is no longer available.");
      if (router.canGoBack()) router.back();
      return;
    }
    const timeout = setTimeout(() => {
      openEditModal(category);
      router.setParams({ form: undefined, id: undefined });
    }, 0);
    return () => clearTimeout(timeout);
  }, [categories, editId, formParam, loading, openAddModal, openEditModal, router]);

  const pickCategoryImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.9,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      const name = asset.fileName || asset.uri.split("/").pop() || "category-image";
      const supportedExtension = /\.(jpe?g|png)$/i.test(name) || /\.(jpe?g|png)(?:\?|$)/i.test(asset.uri);
      const supportedMimeType = ["image/jpeg", "image/jpg", "image/png"].includes(
        (asset.mimeType || "").toLowerCase(),
      );
      if (!supportedExtension && !supportedMimeType) {
        Alert.alert("Unsupported image", "Choose a JPG, JPEG, or PNG image.");
        return;
      }

      const extension = name.match(/\.(jpe?g|png)$/i)?.[1]?.toLowerCase();
      const mimeType =
        asset.mimeType ||
        (extension === "png" ? "image/png" : "image/jpeg");
      setSelectedImage({ uri: asset.uri, name, mimeType });
      setExistingImage(null);
      setImageRemoved(false);
    } catch (error) {
      Alert.alert("Unable to select image", getApiErrorMessage(error));
    }
  };

  const removeCategoryImage = () => {
    setSelectedImage(null);
    setExistingImage(null);
    setImageRemoved(true);
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
      images: imageRemoved ? [] : editingCategory?.images ?? [],
      subcategory: form.subcategory
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
    };

    setSaving(true);
    try {
      let requestData: typeof categoryData | FormData = categoryData;
      let requestConfig = undefined;
      if (selectedImage) {
        const payload = new FormData();
        payload.append("name", categoryData.name);
        payload.append("description", categoryData.description);
        payload.append("status", categoryData.status);
        payload.append("catType", categoryData.catType);
        payload.append("catId", categoryData.catId);
        if (categoryData.user_id != null) {
          payload.append("user_id", String(categoryData.user_id));
        }
        categoryData.subcategory.forEach((subcategory) =>
          payload.append("subcategory[]", subcategory),
        );
        payload.append("images[]", {
          uri: selectedImage.uri,
          name: selectedImage.name,
          type: selectedImage.mimeType,
        } as any);
        requestData = payload;
        requestConfig = { headers: { "Content-Type": "multipart/form-data" } };
      }

      if (editingCategory) {
        const response = await api.put(`/categories/${catId}`, requestData, requestConfig);
        const saved = getCategoryRows(response.data)[0] || {
          ...categoryData,
          ...(selectedImage ? { images: [selectedImage.uri] } : {}),
        };
        setCategories((current) =>
          current.map((category) =>
            category.catId === catId ? { ...category, ...saved } : category,
          ),
        );
      } else {
        const response = await api.post("/categories", requestData, requestConfig);
        const saved = getCategoryRows(response.data)[0] || {
          ...categoryData,
          ...(selectedImage ? { images: [selectedImage.uri] } : {}),
        };
        setCategories((current) => [
          { ...categoryData, ...saved, catId: saved.catId || catId },
          ...current,
        ]);
      }
      Alert.alert(
        "Saved",
        editingCategory
          ? "Category updated successfully."
          : "Category added successfully.",
      );
      closeCategoryForm();
    } catch (error) {
      Alert.alert("Unable to save category", getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = (category: Category) => {
    setPendingDelete(category);
  };

  const confirmDeleteCategory = async () => {
    if (!pendingDelete) return;
    const category = pendingDelete;
    setPendingDelete(null);
    try {
      await api.delete(`/categories/${category.catId}`);
      setCategories((current) =>
        current.filter((item) => item.catId !== category.catId),
      );
    } catch (error) {
      Alert.alert("Unable to delete category", getApiErrorMessage(error));
    }
  };

  const setFormValue = <K extends keyof CategoryForm>(
    key: K,
    value: CategoryForm[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <SafeAreaView className="flex-1 bg-[#F2F5EA]" edges={["bottom"]}>
      <StatusBar
        style="light"
      />
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

      {loading ? (
        <CenteredPageLoader message="Loading categories..." />
      ) : (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              if (!loading) void refreshCategories();
            }}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 90,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            flexWrap: "nowrap",
            justifyContent: "space-between",
            marginTop: 24,
            marginBottom: 16,
          }}
        >
          <SummaryStatCard
            title="Total"
            value={categories.length}
            caption="Total items"
            icon="document-text-outline"
            tone="total"
            cardWidth={statCardWidth}
            compact={compactStats}
            badgeText="Σ"
          />
          <SummaryStatCard
            title="Active"
            value={activeCount}
            caption="Active items"
            icon="checkmark"
            tone="active"
            cardWidth={statCardWidth}
            compact={compactStats}
          />
          <SummaryStatCard
            title="Inactive"
            value={inactiveCount}
            caption="Inactive items"
            icon="close"
            tone="inactive"
            cardWidth={statCardWidth}
            compact={compactStats}
          />
        </View>

        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or ID"
          activeFilterCount={
            countActiveFilters(categoryFilterValues) +
            (typeFilter === "All" ? 0 : 1)
          }
          filterSheet={{
            currentFilters: categoryFilterValues,
            onApply: applyCategoryFilters,
            onReset: () => {
              setTypeFilter("All");
              setStatusFilter("All");
              setViewMode(DEFAULT_FILTER_STATE.viewMode);
            },
            sections: ["status", "viewMode"],
            additionalFilters: [
              {
                key: "categoryType",
                label: "Category type",
                presentation: "select",
                options: [
                  { label: "All types", value: "All" },
                  ...categoryTypes.map((type) => ({
                    label: type,
                    value: type,
                  })),
                ],
              },
            ],
          }}
          style={{ marginBottom: 12 }}
        />

        {filteredCategories.length === 0 ? (
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
          <View
            style={
              viewMode === "card"
                ? {
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    rowGap: 12,
                  }
                : { gap: 12 }
            }
          >
            {filteredCategories.map((category) => {
              const type = getCategoryType(category);
              const [typeBackground, typeColor] = getTypeColors(type);
              const active = (category.status || "Active") === "Active";
              const categoryImage = getCategoryImage(category);
              return (
                <View
                  key={category.catId || category.id}
                  className="min-w-0 rounded-2xl border border-[#E4E8E3] bg-white"
                  style={{
                    width: viewMode === "card" ? "48.5%" : "100%",
                    padding: viewMode === "card" ? 12 : 16,
                  }}
                >
                  <View
                    className={`gap-2 ${viewMode === "card" ? "flex-col items-start" : "flex-row items-start justify-between"}`}
                  >
                    <View
                      className={`min-w-0 flex-1 ${viewMode === "card" ? "flex-row items-center" : "mr-3 flex-row items-center"}`}
                    >
                      {categoryImage ? (
                        <Image
                          source={{ uri: getCategoryImageUri(categoryImage) }}
                          className={`${viewMode === "card" ? "h-10 w-10" : "h-12 w-12"} rounded-xl bg-[#F1F4EF]`}
                        />
                      ) : (
                        <View
                          className={`${viewMode === "card" ? "h-10 w-10" : "h-12 w-12"} items-center justify-center rounded-xl bg-[#F1F4EF]`}
                        >
                          <Ionicons name="image-outline" size={20} color="#87918A" />
                        </View>
                      )}
                      <View className="ml-3 min-w-0 flex-1">
                        <Text
                          className="text-base font-bold text-[#25332C]"
                          numberOfLines={2}
                        >
                          {category.name}
                        </Text>
                        <Text
                          className="mt-1 text-xs font-semibold text-[#8A948D]"
                          numberOfLines={1}
                        >
                          {category.catId || "No ID"}
                        </Text>
                      </View>
                    </View>
                    <View
                      className="rounded-full px-2.5 py-1"
                      style={{
                        maxWidth: "100%",
                        backgroundColor: typeBackground,
                      }}
                    >
                      <Text
                        className="text-xs font-bold"
                        style={{ color: typeColor }}
                        numberOfLines={1}
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
                  <View
                    className={`mt-4 border-t border-[#EEF0ED] pt-3 ${viewMode === "card" ? "gap-2" : "flex-row items-center justify-between"}`}
                  >
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
                    <View
                      className="flex-row gap-2"
                      style={{ alignSelf: viewMode === "card" ? "flex-end" : undefined }}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${category.name}`}
                        className="h-9 w-9 items-center justify-center rounded-full bg-[#EEF3F8]"
                        onPress={() =>
                          router.push({
                            pathname: "/categories",
                            params: {
                              form: "edit",
                              id: String(category.id ?? category.catId),
                            },
                          })
                        }
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
      )}

      <AddButton
        onPress={() =>
          router.push({ pathname: "/categories", params: { form: "new" } })
        }
        accessibilityLabel="Add category"
        accessibilityHint="Opens the new category form"
        bottomOffset={37}
      />

      <ConfirmPopup
        visible={pendingDelete !== null}
        type="delete"
        message={
          pendingDelete
            ? `Delete ${pendingDelete.name}? This action cannot be undone.`
            : undefined
        }
        onConfirm={confirmDeleteCategory}
        onCancel={() => setPendingDelete(null)}
      />
      <ConfirmPopup
        visible={successMessage !== null}
        type="success"
        message={successMessage ?? ""}
        onConfirm={() => setSuccessMessage(null)}
      />

      {modalVisible && (
        <View className="absolute inset-0 z-50 bg-[#F8F9F6]" style={{ paddingBottom: insets.bottom }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={0}
            style={{ flex: 1 }}
          >
          <View
            className="flex-1 bg-[#F8F9F6] px-5 pb-5 pt-5"
          >
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
                accessibilityLabel="Go back"
                className="h-9 w-9 items-center justify-center rounded-full bg-white"
                onPress={closeCategoryForm}
              >
                <Ionicons name="arrow-back" size={20} color="#526058" />
              </Pressable>
            </View>

            <ScrollView
              style={{ flex: 1, minHeight: 0 }}
              contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              automaticallyAdjustKeyboardInsets
              keyboardDismissMode="interactive"
              bounces={true}
            >
              <FormLabel>Category name *</FormLabel>
              <FormInput
                accessibilityLabel="Category name, required"
                autoCapitalize="words"
                borderColor="#AAB8AE"
                maxLength={60}
                placeholder="e.g. Groceries"
                returnKeyType="done"
                style={{
                  minHeight: 54,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: "#FFFFFF",
                  color: "#25332C",
                  fontSize: 16,
                  marginBottom: 16,
                }}
                value={form.name}
                onChangeText={(value) => setFormValue("name", value)}
              />

              <FormLabel>Category Image</FormLabel>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={selectedImage || existingImage ? "Change category image" : "Upload category image"}
                className="mb-4 min-h-[50px] flex-row items-center rounded-xl border border-[#E4E8E3] bg-white px-4 py-3"
                onPress={() => void pickCategoryImage()}
              >
                <Ionicons name="cloud-upload-outline" size={19} color="#315640" />
                <Text className="ml-3 text-sm font-semibold text-[#315640]">
                  {selectedImage || existingImage ? "Change image" : "Upload image"}
                </Text>
              </Pressable>
              {!!(selectedImage?.uri || existingImage) && (
                <View className="mb-4 flex-row items-center rounded-xl border border-[#E4E8E3] bg-white p-3">
                  <Image
                    source={{
                      uri: getCategoryImageUri(selectedImage?.uri || existingImage!),
                    }}
                    className="h-16 w-16 rounded-lg bg-[#F1F4EF]"
                  />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs font-bold text-[#46534B]">
                      Image preview
                    </Text>
                    <Text className="mt-1 text-xs text-[#7B8580]" numberOfLines={1}>
                      {selectedImage?.name || "Current category image"}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Remove category image"
                    className="items-center px-2 py-1"
                    onPress={removeCategoryImage}
                  >
                    <Ionicons name="trash-outline" size={18} color="#B64C45" />
                    <Text className="mt-1 text-[10px] font-semibold text-[#B64C45]">
                      Remove
                    </Text>
                  </Pressable>
                </View>
              )}

              <PopupSelect
                label="Category type"
                placeholder="Select category type"
                options={categoryTypes}
                value={form.catType}
                onChange={(value) => {
                  const selectedType = categoryTypes.find(
                    (type) => type === value,
                  );
                  if (selectedType) setFormValue("catType", selectedType);
                }}
              />

              <FormLabel>Description</FormLabel>
              <FormInput
                accessibilityLabel="Category description"
                borderColor="#AAB8AE"
                multiline
                placeholder="Add a short description"
                textAlignVertical="top"
                style={{
                  minHeight: 88,
                  marginBottom: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: "#FFFFFF",
                  color: "#25332C",
                  fontSize: 15,
                }}
                value={form.description}
                onChangeText={(value) => setFormValue("description", value)}
              />

              <FormLabel>Subcategories</FormLabel>
              <FormInput
                accessibilityLabel="Subcategories"
                borderColor="#AAB8AE"
                multiline
                placeholder={"Add one subcategory per line\nFor example: Food"}
                textAlignVertical="top"
                style={{
                  minHeight: 88,
                  marginBottom: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: "#FFFFFF",
                  color: "#25332C",
                  fontSize: 15,
                }}
                value={form.subcategory}
                onChangeText={(value) => setFormValue("subcategory", value)}
              />

              <FormLabel>Status</FormLabel>
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
                      <FormLabel inline color={selected ? "#315640" : "#637068"}>
                        {status}
                      </FormLabel>
                    </FormOption>
                  );
                })}
              </View>
            </ScrollView>

            <View className="flex-row gap-3 pt-3">
              <Pressable
                className="flex-1 items-center rounded-xl border border-[#DDE3DC] bg-white py-3.5"
                disabled={saving}
                onPress={closeCategoryForm}
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
            </KeyboardAvoidingView>
        </View>
      )}
    </SafeAreaView>
  );
}

function SummaryStatCard({
  title,
  value,
  caption,
  icon,
  tone,
  cardWidth,
  compact,
  badgeText,
}: {
  title: string;
  value: number;
  caption: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: "total" | "active" | "inactive";
  cardWidth: ViewStyle["width"];
  compact: boolean;
  badgeText?: string;
}) {
  const palette = {
    total: {
      background: "#FCFEFA",
      border: "#E7F0E2",
      iconGradient: ["#9ACD6D", "#4B8E3D"] as const,
      iconColor: "#FFFFFF",
      value: "#102D17",
      caption: "#87938A",
      waveBack: "#E6F5DD",
      waveFront: "#D1EEBF",
      chart: "#75A95B",
      dots: "#AFBEA8",
    },
    active: {
      background: "#FCFEFA",
      border: "#E7F0E2",
      iconGradient: ["#A6DB77", "#5EA544"] as const,
      iconColor: "#168632",
      value: "#087A2F",
      caption: "#87938A",
      waveBack: "#E6F5DD",
      waveFront: "#D1EEBF",
      chart: "#4D9D48",
      dots: "#AFBEA8",
    },
    inactive: {
      background: "#FFFCFC",
      border: "#F4E6E5",
      iconGradient: ["#FFB8B7", "#F57B7A"] as const,
      iconColor: "#C31E1B",
      value: "#A41412",
      caption: "#92939A",
      waveBack: "#FCE9E9",
      waveFront: "#F8D5D7",
      chart: "#DA777A",
      dots: "#D5B7B8",
    },
  }[tone];

  return (
    <View
      style={{
        width: cardWidth,
        height: 110,
        marginBottom: 12,
        padding: compact ? 6 : 10,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: compact ? 15 : 20,
        backgroundColor: palette.background,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 7 },
        shadowOpacity: 0.07,
        shadowRadius: 17,
        elevation: 5,
      }}
    >
      <Svg
        width="100%"
        height={compact ? 55 : 65}
        viewBox="0 0 320 100"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
        }}
      >
        <Path
          d="M0 50 C45 38 66 72 113 62 C162 50 176 26 226 40 C268 51 291 56 320 48 L320 100 L0 100 Z"
          fill={palette.waveBack}
        />
        <Path
          d="M0 73 C45 60 74 87 122 79 C176 70 193 49 241 61 C276 70 299 79 320 70 L320 100 L0 100 Z"
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
          colors={palette.iconGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: compact ? 32 : 42,
            height: compact ? 32 : 42,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: compact ? 12 : 16,
          }}
        >
          {tone === "total" ? (
            <Ionicons
              name={icon}
              size={compact ? 18 : 23}
              color={palette.iconColor}
            />
          ) : (
            <View
              style={{
                width: compact ? 24 : 30,
                height: compact ? 24 : 30,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: compact ? 12 : 16,
                backgroundColor: "#FFFFFF",
              }}
            >
              <Ionicons
                name={icon}
                size={compact ? 15 : 19}
                color={palette.iconColor}
              />
            </View>
          )}
          {badgeText ? (
            <View
              style={{
                position: "absolute",
                right: compact ? -3 : -4,
                bottom: compact ? -2 : -3,
                width: compact ? 18 : 24,
                height: compact ? 18 : 24,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2,
                borderColor: palette.iconGradient[1],
                borderRadius: compact ? 9 : 12,
                backgroundColor: "#FFFFFF",
              }}
            >
              <Text
                style={{
                  color: palette.iconGradient[1],
                  fontSize: compact ? 10 : 13,
                  fontWeight: "900",
                }}
              >
                {badgeText}
              </Text>
            </View>
          ) : null}
        </LinearGradient>
        <Ionicons
          name="ellipsis-horizontal"
          size={compact ? 14 : 18}
          color={palette.dots}
        />
      </View>

      <Text
        style={{
          marginTop: compact ? 3 : 6,
          color: "#18221B",
          fontSize: compact ? 10 : 14,
          fontWeight: "700",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          marginTop: 1,
          color: palette.value,
          fontSize: compact ? 25 : 34,
          lineHeight: compact ? 28 : 36,
          fontWeight: "900",
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          marginTop: 2,
          maxWidth: compact ? "52%" : "60%",
          color: palette.caption,
          fontSize: compact ? 8 : 10,
          fontWeight: "500",
        }}
        numberOfLines={2}
      >
        {caption}
      </Text>

      <Svg
        width={compact ? 26 : 48}
        height={compact ? 21 : 36}
        viewBox="0 0 90 64"
        style={{
          position: "absolute",
          right: compact ? 5 : 11,
          bottom: compact ? 8 : 10,
        }}
      >
        <Rect x={1} y={42} width={17} height={20} rx={5} fill={palette.chart} />
        <Rect
          x={25}
          y={30}
          width={17}
          height={32}
          rx={5}
          fill={palette.chart}
        />
        <Rect
          x={49}
          y={17}
          width={17}
          height={45}
          rx={5}
          fill={palette.chart}
        />
        <Path
          d="M7 36 C22 28 29 19 42 22 C55 25 58 12 74 7 M64 6 L75 6 L74 17"
          fill="none"
          stroke={palette.chart}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
