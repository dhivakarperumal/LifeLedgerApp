import { Ionicons } from "@expo/vector-icons";
import {
    AudioModule,
    RecordingPresets,
    setAudioModeAsync,
    useAudioRecorder,
} from "expo-audio";
import * as DocumentPicker from "expo-document-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api, { API_BASE_URL, getApiErrorMessage, logoutUser } from "../../api";
import { AddButton } from "../../components/AddButton";
import { CenteredPageLoader } from "../../components/CenteredPageLoader";
import ConfirmPopup from "../../components/ConfirmPopup";
import {
    createDateRangeSelection,
    isDateInRange,
    type DateRangeSelection,
} from "../../components/DateRangeFilter";
import { DateTimePickerComponent } from "../../components/DateTimePickerComponent";
import {
    formatLocalDateTime,
    parseLocalDateTimeValue,
} from "../../components/dateTimeUtils";
import {
    countActiveFilters,
    DEFAULT_FILTER_STATE,
    type FilterState,
    type ViewModeOption,
} from "../../components/filters";
import {
    FormField,
    FormLabel,
} from "../../components/FormControls";
import { GradientSafeAreaView as SafeAreaView } from "../../components/GradientSafeAreaView";
import { PopupSelect } from "../../components/PopupSelect";
import { SearchBar } from "../../components/SearchBar";
import { Colors } from "../../constants/colors";

type Memory = {
  id: number | string;
  title: string;
  description?: string;
  category_id?: number | string;
  category_name?: string;
  memory_date?: string;
  location?: string;
  mood?: string;
  tags?: string[] | string;
  status?: string;
  is_favorite?: boolean | number | string;
  media_type?: string;
  media_url?: string;
  media_gallery?: (string | Record<string, any>)[];
  voice_note?: string;
};

type MemoryCategory = {
  id: number | string;
  name: string;
  type?: string;
  catType?: string;
  category_type?: string;
};

type LocalMedia = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

type MemoryForm = {
  title: string;
  description: string;
  category_id: string;
  memory_date: string;
  location: string;
  mood: string;
  tags: string;
  status: string;
  is_favorite: boolean;
  voice_note: string;
};

const MAX_MEDIA_FILES = 10;
const MAX_MEDIA_FILE_SIZE = 100 * 1024 * 1024;
const mediaServerUrl = API_BASE_URL.replace(/\/api\/?$/, "");
const initialForm: MemoryForm = {
  title: "",
  description: "",
  category_id: "",
  memory_date: formatLocalDateTime(new Date()),
  location: "",
  mood: "Happy",
  tags: "",
  status: "published",
  is_favorite: false,
  voice_note: "",
};
const memoryMediaFilterOptions = [
  { value: "all", label: "All" },
  { value: "photos", label: "Photos" },
  { value: "videos", label: "Videos" },
  { value: "audio", label: "Audio" },
  { value: "places", label: "Places" },
  { value: "favorites", label: "Favorites" },
];

function getList<T>(data: any, keys: string[] = []): T[] {
  let current = data;
  for (let depth = 0; depth < 3 && current; depth += 1) {
    if (Array.isArray(current)) return current;
    for (const key of keys) {
      if (Array.isArray(current?.[key])) return current[key];
    }
    if (Array.isArray(current?.data)) return current.data;
    current = current?.data;
  }
  return [];
}

function getMediaUrl(value?: string) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `${mediaServerUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

function getMemoryImage(memory: Memory) {
  const gallery = Array.isArray(memory.media_gallery)
    ? memory.media_gallery
    : [];
  const image = gallery.find((item) => {
    const type =
      typeof item === "string" ? "" : String(item.file_type || item.type || "");
    const url =
      typeof item === "string"
        ? item
        : String(item.file_url || item.url || item.path || "");
    return (
      type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(url)
    );
  });
  const galleryUrl =
    typeof image === "string"
      ? image
      : image?.file_url || image?.url || image?.path;
  return getMediaUrl(
    galleryUrl ||
      (memory.media_type === "image" ? memory.media_url : undefined),
  );
}

function getMemoryMediaType(memory: Memory) {
  const declaredType = String(memory.media_type || "").toLowerCase();
  if (declaredType.startsWith("image") || declaredType === "photo")
    return "photos";
  if (declaredType.startsWith("video")) return "videos";
  if (declaredType.startsWith("audio") || memory.voice_note) return "audio";

  const gallery = Array.isArray(memory.media_gallery)
    ? memory.media_gallery
    : [];
  const types = gallery.map((item) => {
    const value =
      typeof item === "string"
        ? item
        : String(
            item.file_type || item.type || item.file_url || item.url || "",
          );
    if (/^image\//i.test(value) || /\.(png|jpe?g|gif|webp|bmp)$/i.test(value))
      return "photos";
    if (/^video\//i.test(value) || /\.(mp4|mov|webm|m4v)$/i.test(value))
      return "videos";
    if (/^audio\//i.test(value) || /\.(mp3|m4a|wav|aac|ogg)$/i.test(value))
      return "audio";
    return "";
  });
  return types.find(Boolean) || "all";
}

function getTags(tags?: string[] | string) {
  if (Array.isArray(tags)) return tags;
  if (typeof tags !== "string") return [];
  try {
    const parsed = JSON.parse(tags);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    return tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

function formatDate(value?: string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isFavorite(memory: Memory) {
  return (
    memory.is_favorite === true ||
    memory.is_favorite === 1 ||
    memory.is_favorite === "1" ||
    memory.is_favorite === "true"
  );
}

function getCategoryType(category: MemoryCategory) {
  return String(
    category.catType || category.type || category.category_type || "",
  )
    .trim()
    .toLowerCase();
}

export default function Memories() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { create: rawCreate, edit: rawEditId } = useLocalSearchParams<{
    create?: string | string[];
    edit?: string | string[];
  }>();
  const createParam = Array.isArray(rawCreate) ? rawCreate[0] : rawCreate;
  const editId = Array.isArray(rawEditId) ? rawEditId[0] : rawEditId;
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [categories, setCategories] = useState<MemoryCategory[]>([]);
  const [search, setSearch] = useState("");
  const [selectedMediaType, setSelectedMediaType] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [viewMode, setViewMode] = useState<ViewModeOption>("table");
  const [dateRange, setDateRange] = useState<DateRangeSelection>(() =>
    createDateRangeSelection("All"),
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDeleteMemory, setPendingDeleteMemory] =
    useState<Memory | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [form, setForm] = useState<MemoryForm>(initialForm);
  const [newMedia, setNewMedia] = useState<LocalMedia[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const filterValues = useMemo<FilterState>(
    () => ({
      ...DEFAULT_FILTER_STATE,
      dateRange,
      category: selectedCategory === "all" ? "" : selectedCategory,
      viewMode,
      custom: { mediaType: selectedMediaType },
    }),
    [dateRange, selectedCategory, selectedMediaType, viewMode],
  );
  const filterCategories = useMemo(
    () =>
      categories.map((category) => ({
        value: String(category.id),
        label: category.name,
      })),
    [categories],
  );
  const applyMemoryFilters = (filters: FilterState) => {
    setDateRange(filters.dateRange);
    setSelectedCategory(filters.category || "all");
    setViewMode(filters.viewMode);
    setSelectedMediaType(filters.custom?.mediaType || "all");
  };

  const handleUnauthorized = useCallback(async () => {
    await logoutUser();
    router.replace("/auth/login");
  }, [router]);

  const fetchData = useCallback(async () => {
    try {
      const [memoriesResult, categoriesResult] = await Promise.allSettled([
        api.get("/memories"),
        api.get("/categories"),
      ]);
      if (memoriesResult.status === "rejected") throw memoriesResult.reason;

      setMemories(getList<Memory>(memoriesResult.value.data, ["memories"]));
      const categoryRows =
        categoriesResult.status === "fulfilled"
          ? getList<MemoryCategory>(categoriesResult.value.data, ["categories"])
          : [];
      setCategories(
        categoryRows.filter((category) => {
          const type = getCategoryType(category);
          return !type || type === "memory" || type === "memories";
        }),
      );
      if (categoriesResult.status === "rejected")
        console.warn(
          "Memory categories could not be loaded.",
          categoriesResult.reason,
        );
    } catch (error) {
      const status = (error as any)?.status || (error as any)?.response?.status;
      if (status === 401) {
        await handleUnauthorized();
        return;
      }
      Alert.alert(
        "Unable to load memories",
        getApiErrorMessage(error, "Please try again."),
      );
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized]);

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      const timeout = setTimeout(() => void fetchData(), 0);
      return () => clearTimeout(timeout);
    }, [fetchData]),
  );

  const filteredMemories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return memories.filter((memory) => {
      const categoryMatches =
        selectedCategory === "all" ||
        String(memory.category_id) === selectedCategory;
      const dateMatches = isDateInRange(memory.memory_date, dateRange);
      const mediaMatches =
        selectedMediaType === "all" ||
        (selectedMediaType === "places"
          ? Boolean(memory.location)
          : selectedMediaType === "favorites"
            ? isFavorite(memory)
            : getMemoryMediaType(memory) === selectedMediaType);
      const searchable = [
        memory.title,
        memory.description,
        memory.location,
        memory.mood,
        memory.category_name,
        getTags(memory.tags).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return (
        categoryMatches &&
        dateMatches &&
        mediaMatches &&
        (!query || searchable.includes(query))
      );
    });
  }, [memories, search, selectedCategory, selectedMediaType, dateRange]);

  const memoryGroups = useMemo(() => {
    const groups = new Map<string, { label: string; memories: Memory[] }>();
    const sortedMemories = [...filteredMemories].sort((left, right) => {
      const leftDate = new Date(
        `${String(left.memory_date || "").slice(0, 10)}T12:00:00`,
      );
      const rightDate = new Date(
        `${String(right.memory_date || "").slice(0, 10)}T12:00:00`,
      );
      const leftTime = Number.isNaN(leftDate.getTime())
        ? 0
        : leftDate.getTime();
      const rightTime = Number.isNaN(rightDate.getTime())
        ? 0
        : rightDate.getTime();
      return rightTime - leftTime;
    });

    sortedMemories.forEach((memory) => {
      const rawDate = String(memory.memory_date || "").slice(0, 10);
      const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
        ? new Date(`${rawDate}T12:00:00`)
        : new Date("");
      const key = Number.isNaN(date.getTime())
        ? "undated"
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = Number.isNaN(date.getTime())
        ? "Undated"
        : date.toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric",
          });
      const group = groups.get(key) || { label, memories: [] };
      group.memories.push(memory);
      groups.set(key, group);
    });

    return Array.from(groups.entries()).map(([key, group]) => ({
      key,
      ...group,
    }));
  }, [filteredMemories]);

  const openNewMemory = useCallback(() => {
    setEditingId(null);
    setForm({
      ...initialForm,
      category_id: categories[0] ? String(categories[0].id) : "",
    });
    setNewMedia([]);
    setEditorVisible(true);
  }, [categories]);

  const openEditMemory = useCallback((memory: Memory) => {
    setEditingId(memory.id);
    setForm({
      title: memory.title || "",
      description: memory.description || "",
      category_id: memory.category_id ? String(memory.category_id) : "",
      memory_date: memory.memory_date
        ? formatLocalDateTime(
            parseLocalDateTimeValue(memory.memory_date) ?? new Date(),
          )
        : initialForm.memory_date,
      location: memory.location || "",
      mood: memory.mood || "Happy",
      tags: getTags(memory.tags).join(", "),
      status: memory.status || "published",
      is_favorite: isFavorite(memory),
      voice_note: memory.voice_note || "",
    });
    setNewMedia([]);
    setEditorVisible(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (createParam === "1") {
        openNewMemory();
        router.setParams({ create: undefined });
        return;
      }
      if (!editId) return;
      const target = memories.find(
        (memory) => String(memory.id) === String(editId),
      );
      if (!target) {
        if (!loading) {
          Alert.alert("Memory not found", "This memory is no longer available.");
          if (router.canGoBack()) router.back();
        }
        return;
      }
      openEditMemory(target);
      router.setParams({ edit: undefined });
    }, [createParam, editId, loading, memories, openEditMemory, openNewMemory, router]),
  );

  const pickMedia = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "image/*",
          "video/*",
          "audio/*",
          "application/pdf",
          "application/zip",
          "application/x-rar-compressed",
        ],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const additions = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType || "application/octet-stream",
        size: asset.size,
      }));
      const combined = [
        ...newMedia,
        ...additions.filter(
          (item) => !newMedia.some((existing) => existing.uri === item.uri),
        ),
      ];
      const oversized = combined.find(
        (item) => (item.size || 0) > MAX_MEDIA_FILE_SIZE,
      );
      if (oversized) {
        Alert.alert(
          "File too large",
          `${oversized.name} exceeds the 100 MB per-file limit.`,
        );
        return;
      }
      if (combined.length > MAX_MEDIA_FILES) {
        Alert.alert(
          "File limit",
          `Choose no more than ${MAX_MEDIA_FILES} media files.`,
        );
        return;
      }
      setNewMedia(combined);
    } catch (error) {
      Alert.alert(
        "Unable to select files",
        getApiErrorMessage(error, "Please try again."),
      );
    }
  };

  const toggleVoiceRecording = async () => {
    try {
      if (isRecording) {
        await recorder.stop();
        setIsRecording(false);
        if (recorder.uri) {
          const recordedFile: LocalMedia = {
            uri: recorder.uri,
            name: `voice-note-${Date.now()}.m4a`,
            mimeType: "audio/mp4",
          };
          setNewMedia((current) => {
            if (current.length >= MAX_MEDIA_FILES) {
              Alert.alert(
                "File limit",
                `Choose no more than ${MAX_MEDIA_FILES} media files.`,
              );
              return current;
            }
            return [...current, recordedFile];
          });
        }
        return;
      }

      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Microphone permission required",
          "Allow microphone access to record a voice note.",
        );
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
    } catch (error) {
      setIsRecording(false);
      Alert.alert(
        "Unable to record voice note",
        getApiErrorMessage(error, "Please try again."),
      );
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      Alert.alert("Title required", "Enter a title for this memory.");
      return;
    }
    try {
      setSubmitting(true);
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key === "is_favorite") payload.append(key, value ? "1" : "0");
        else if (key === "category_id") {
          if (value) payload.append(key, String(value));
        } else if (key === "tags") {
          payload.append(
            key,
            String(value)
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
              .join(","),
          );
        } else payload.append(key, String(value));
      });

      const response = editingId
        ? await api.put(`/memories/${editingId}`, payload, {
            headers: { "Content-Type": "multipart/form-data" },
          })
        : await api.post("/memories", payload, {
            headers: { "Content-Type": "multipart/form-data" },
          });
      const saved = response.data?.memory || response.data;
      const savedId = saved?.id || editingId;

      if (newMedia.length && savedId) {
        const mediaPayload = new FormData();
        newMedia.forEach((file) =>
          mediaPayload.append("media", {
            uri: file.uri,
            name: file.name,
            type: file.mimeType,
          } as any),
        );
        await api.put(`/memories/${savedId}`, mediaPayload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      setNewMedia([]);
      await fetchData();
      Alert.alert("Saved", editingId ? "Memory updated." : "Memory created.");
      if (router.canGoBack()) router.back();
      else setEditorVisible(false);
    } catch (error) {
      const status = (error as any)?.status || (error as any)?.response?.status;
      if (status === 401) {
        await handleUnauthorized();
        return;
      }
      Alert.alert(
        "Unable to save memory",
        getApiErrorMessage(error, "Please try again."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (memory: Memory) => {
    setPendingDeleteMemory(memory);
  };

  const confirmDeleteMemory = async () => {
    if (!pendingDeleteMemory) return;
    const memory = pendingDeleteMemory;
    setPendingDeleteMemory(null);
    try {
      await api.delete(`/memories/${memory.id}`);
      setMemories((current) =>
        current.filter((item) => item.id !== memory.id),
      );
    } catch (error) {
      const status =
        (error as any)?.status || (error as any)?.response?.status;
      if (status === 401) await handleUnauthorized();
      else
        Alert.alert(
          "Unable to delete memory",
          getApiErrorMessage(error, "Please try again."),
        );
    }
  };

  const toggleFavorite = async (memory: Memory) => {
    const previous = isFavorite(memory);
    setMemories((current) =>
      current.map((item) =>
        item.id === memory.id ? { ...item, is_favorite: !previous } : item,
      ),
    );
    try {
      await api.patch(`/memories/${memory.id}/favorite`);
    } catch (error) {
      setMemories((current) =>
        current.map((item) =>
          item.id === memory.id ? { ...item, is_favorite: previous } : item,
        ),
      );
      const status = (error as any)?.status || (error as any)?.response?.status;
      if (status === 401) await handleUnauthorized();
      else
        Alert.alert(
          "Unable to update favorite",
          getApiErrorMessage(error, "Please try again."),
        );
    }
  };

  const updateForm = (key: keyof MemoryForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{ flex: 1, backgroundColor: Colors.contentBackground }}
    >
      <ConfirmPopup
        visible={pendingDeleteMemory !== null}
        type="delete"
        message={
          pendingDeleteMemory
            ? `Delete "${pendingDeleteMemory.title}"?`
            : undefined
        }
        onConfirm={confirmDeleteMemory}
        onCancel={() => setPendingDeleteMemory(null)}
      />
      <ConfirmPopup
        visible={successMessage !== null}
        type="success"
        message={successMessage ?? ""}
        onConfirm={() => setSuccessMessage(null)}
      />
      {loading ? (
        <CenteredPageLoader message="Loading memories..." />
      ) : (
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              if (!loading) void refreshData();
            }}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: insets.bottom + 112,
        }}
      >
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search moments, places..."
          activeFilterCount={
            countActiveFilters(filterValues) +
            (selectedMediaType === "all" ? 0 : 1)
          }
          filterSheet={{
            currentFilters: filterValues,
            onApply: applyMemoryFilters,
            onReset: () => setSelectedMediaType("all"),
            categories: filterCategories,
            sections: ["date", "category", "viewMode"],
            additionalFilters: [
              {
                key: "mediaType",
                label: "Media type",
                options: memoryMediaFilterOptions,
                presentation: "select",
              },
            ],
          }}
          style={{ marginBottom: 14 }}
        />

        {filteredMemories.length === 0 ? (
          <View
            style={{
              alignItems: "center",
              paddingHorizontal: 24,
              paddingVertical: 48,
              borderRadius: 18,
              backgroundColor: Colors.white,
            }}
          >
            <Ionicons name="images-outline" size={38} color={Colors.sage} />
            <Text
              style={{
                color: Colors.textPrimary,
                fontWeight: "700",
                fontSize: 17,
                marginTop: 12,
              }}
            >
              No memories found
            </Text>
            <Text
              style={{
                color: Colors.sage,
                fontSize: 14,
                textAlign: "center",
                marginTop: 5,
              }}
            >
              Create a memory or change your search filters.
            </Text>
          </View>
        ) : (
          <View>
            {memoryGroups.map((group) => (
              <View key={group.key} style={{ marginBottom: 18 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 10,
                    paddingHorizontal: 2,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: "#D8E5D8",
                    }}
                  />
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 7,
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 20,
                      backgroundColor: "#E9F4E8",
                      borderWidth: 1,
                      borderColor: "#C5DEC3",
                    }}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={13}
                      color={Colors.forest}
                    />
                    <Text
                      style={{
                        color: Colors.forest,
                        fontSize: 12,
                        fontWeight: "700",
                        letterSpacing: 0.3,
                      }}
                    >
                      {group.label}
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        borderRadius: 10,
                        backgroundColor: Colors.forest,
                      }}
                    >
                      <Text
                        style={{
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: "700",
                        }}
                      >
                        {group.memories.length}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: "#D8E5D8",
                    }}
                  />
                </View>
                <View
                  style={{
                    flexDirection: viewMode === "card" ? "row" : "column",
                    flexWrap: viewMode === "card" ? "wrap" : "nowrap",
                    justifyContent:
                      viewMode === "card" ? "space-between" : undefined,
                    gap: 10,
                  }}
                >
                  {group.memories.map((memory) => {
                    const imageUrl = getMemoryImage(memory);
                    const mediaType = getMemoryMediaType(memory);
                    const memoryTags = getTags(memory.tags);
                    return (
                      <Pressable
                        key={String(memory.id)}
                        onPress={() =>
                          router.push({
                            pathname: "/memories/[id]",
                            params: { id: String(memory.id) },
                          })
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`View ${memory.title}`}
                        style={{
                          width: viewMode === "card" ? "48%" : "100%",
                          minWidth: 0,
                          flexDirection: viewMode === "card" ? "column" : "row",
                          minHeight: viewMode === "card" ? 220 : 148,
                          overflow: "hidden",
                          borderRadius: 18,
                          backgroundColor: Colors.white,
                          borderWidth: 1,
                          borderColor: "#E9EEEB",
                          shadowColor: "#24352B",
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: 0.06,
                          shadowRadius: 10,
                          elevation: 2,
                        }}
                      >
                        <View
                          style={{
                            width: viewMode === "card" ? "100%" : "31%",
                            height: viewMode === "card" ? 132 : undefined,
                            minHeight: viewMode === "card" ? 132 : 154,
                            position: "relative",
                            backgroundColor: "#DDE9E4",
                          }}
                        >
                          {imageUrl ? (
                            <Image
                              source={{ uri: imageUrl }}
                              resizeMode="cover"
                              style={{
                                position: "absolute",
                                top: 0,
                                right: 0,
                                bottom: 0,
                                left: 0,
                              }}
                            />
                          ) : (
                            <View
                              style={{
                                flex: 1,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor:
                                  getMemoryMediaType(memory) === "audio"
                                    ? "#27312F"
                                    : "#DDE9E4",
                              }}
                            >
                              <Ionicons
                                name={
                                  mediaType === "videos"
                                    ? "videocam-outline"
                                    : mediaType === "audio"
                                      ? "musical-notes"
                                      : "image-outline"
                                }
                                size={38}
                                color={
                                  getMemoryMediaType(memory) === "audio"
                                    ? Colors.white
                                    : Colors.forest
                                }
                              />
                            </View>
                          )}
                          <View
                            style={{
                              position: "absolute",
                              left: 8,
                              bottom: 8,
                              width: 28,
                              height: 28,
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: 14,
                              backgroundColor: "rgba(16,26,22,0.68)",
                            }}
                          >
                            <Ionicons
                              name={
                                mediaType === "videos"
                                  ? "play"
                                  : mediaType === "audio"
                                    ? "musical-notes"
                                    : "image-outline"
                              }
                              size={16}
                              color={Colors.white}
                            />
                          </View>
                        </View>
                        <View
                          style={{
                            flex: viewMode === "card" ? undefined : 1,
                            width: viewMode === "card" ? "100%" : undefined,
                            justifyContent: "center",
                            paddingVertical: viewMode === "card" ? 10 : 12,
                            paddingLeft: viewMode === "card" ? 10 : 12,
                            paddingRight: 8,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 4,
                            }}
                          >
                            <Text
                              numberOfLines={1}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                color: Colors.textPrimary,
                                fontSize: 16,
                                fontWeight: "800",
                              }}
                            >
                              {memory.title}
                            </Text>
                            <Pressable
                              onPress={(event) => {
                                event.stopPropagation();
                                Alert.alert(memory.title, "Memory options", [
                                  {
                                    text: "View",
                                    onPress: () =>
                                      router.push({
                                        pathname: "/memories/[id]",
                                        params: { id: String(memory.id) },
                                      }),
                                  },
                                  {
                                    text: "Edit",
                                    onPress: () =>
                                      router.push({
                                        pathname: "/memory-form" as any,
                                        params: { edit: String(memory.id) },
                                      }),
                                  },
                                  {
                                    text: isFavorite(memory)
                                      ? "Remove favorite"
                                      : "Add favorite",
                                    onPress: () => void toggleFavorite(memory),
                                  },
                                  {
                                    text: "Delete",
                                    style: "destructive",
                                    onPress: () => handleDelete(memory),
                                  },
                                  { text: "Cancel", style: "cancel" },
                                ]);
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={`Options for ${memory.title}`}
                              hitSlop={7}
                              style={{ paddingLeft: 5, paddingVertical: 3 }}
                            >
                              <Ionicons
                                name="ellipsis-vertical"
                                size={19}
                                color={Colors.textSecondary}
                              />
                            </Pressable>
                          </View>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              marginTop: 3,
                            }}
                          >
                            <Ionicons
                              name="calendar-outline"
                              size={14}
                              color={Colors.textSecondary}
                            />
                            <Text
                              numberOfLines={1}
                              style={{
                                color: Colors.textSecondary,
                                fontSize: 12,
                                marginLeft: 5,
                                flexShrink: 1,
                              }}
                            >
                              {formatDateTime(memory.memory_date)}
                            </Text>
                          </View>
                          {memory.description ? (
                            <Text
                              numberOfLines={2}
                              style={{
                                color: "#596367",
                                fontSize: 13,
                                lineHeight: 18,
                                marginTop: 5,
                              }}
                            >
                              {memory.description}
                            </Text>
                          ) : null}
                          <View
                            style={{
                              flexDirection: "row",
                              flexWrap: "wrap",
                              alignItems: "center",
                              gap: 6,
                              marginTop: 8,
                            }}
                          >
                            {memory.location ? (
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 4,
                                  paddingHorizontal: 9,
                                  paddingVertical: 5,
                                  borderRadius: 15,
                                  backgroundColor: "#E7F1E8",
                                }}
                              >
                                <Ionicons
                                  name="location-outline"
                                  size={13}
                                  color={Colors.forest}
                                />
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    maxWidth: "100%",
                                    flexShrink: 1,
                                    color: Colors.forest,
                                    fontSize: 11,
                                    fontWeight: "600",
                                  }}
                                >
                                  {memory.location}
                                </Text>
                              </View>
                            ) : null}
                            {memory.category_name ? (
                              <Text
                                numberOfLines={1}
                                style={{
                                  maxWidth: 100,
                                  overflow: "hidden",
                                  paddingHorizontal: 10,
                                  paddingVertical: 5,
                                  borderRadius: 15,
                                  backgroundColor: "#FBF0DD",
                                  color: "#775323",
                                  fontSize: 11,
                                  fontWeight: "600",
                                }}
                              >
                                {memory.category_name}
                              </Text>
                            ) : null}
                            {memoryTags.slice(0, 2).map((tag, index) => (
                              <Text
                                key={`${memory.id}-${tag}`}
                                numberOfLines={1}
                                style={{
                                  maxWidth: 92,
                                  overflow: "hidden",
                                  paddingHorizontal: 9,
                                  paddingVertical: 5,
                                  borderRadius: 15,
                                  backgroundColor:
                                    index === 0 ? "#EAF0E5" : "#F7E8EC",
                                  color: Colors.textPrimary,
                                  fontSize: 11,
                                  fontWeight: "600",
                                }}
                              >
                                {tag}
                              </Text>
                            ))}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      )}

      <AddButton
        onPress={() =>
          router.push({
            pathname: "/memory-form" as any,
            params: { create: "1" },
          })
        }
        accessibilityLabel="Add memory"
        accessibilityHint="Opens the new memory form"
        bottomOffset={84}
      />

      {editorVisible && (
        <View className="absolute inset-0 z-50 bg-white" style={{ paddingBottom: insets.bottom }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
          <View
            style={{
              paddingHorizontal: 18,
              paddingTop: 18,
              paddingBottom: 12,
              flex: 1,
              backgroundColor: Colors.white,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "800",
                  color: Colors.forest,
                }}
              >
                {editingId ? "Edit memory" : "New memory"}
              </Text>
              <Pressable
                onPress={() => {
                  if (router.canGoBack()) router.back();
                  else setEditorVisible(false);
                }}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                style={{ padding: 6 }}
              >
                <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView
              style={{ flex: 1, minHeight: 0 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              automaticallyAdjustKeyboardInsets
              keyboardDismissMode="none"
            >
              <FormField
                label="Title"
                value={form.title}
                onChangeText={(value) => updateForm("title", value)}
                placeholder="Give this memory a title"
              />
              <FormField
                label="Description"
                value={form.description}
                onChangeText={(value) => updateForm("description", value)}
                placeholder="What do you want to remember?"
                multiline
              />
              <PopupSelect
                label="Category"
                placeholder="Select Category"
                options={categories.map((category) => ({
                  value: String(category.id),
                  label: category.name,
                }))}
                value={form.category_id}
                loading={loading && categories.length === 0}
                onChange={(value) => updateForm("category_id", value)}
              />
              <DateTimePickerComponent
                mode="datetime"
                value={parseLocalDateTimeValue(form.memory_date)}
                onChange={(date) => {
                  if (date) {
                    updateForm("memory_date", formatLocalDateTime(date));
                  }
                }}
                label="Date & time"
                placeholder="Select date and time"
              />
              <FormField
                label="Location"
                value={form.location}
                onChangeText={(value) => updateForm("location", value)}
                placeholder="Where was it?"
              />
              <FormField
                label="Mood"
                value={form.mood}
                onChangeText={(value) => updateForm("mood", value)}
                placeholder="Happy, nostalgic..."
              />
              <FormField
                label="Tags"
                value={form.tags}
                onChangeText={(value) => updateForm("tags", value)}
                placeholder="family, travel, celebration"
              />
              <Pressable
                onPress={() => void toggleVoiceRecording()}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  minHeight: 46,
                  marginBottom: 14,
                  borderRadius: 12,
                  backgroundColor: isRecording ? "#B83E48" : Colors.forest,
                }}
              >
                <Ionicons
                  name={isRecording ? "stop-circle-outline" : "mic-outline"}
                  size={19}
                  color={Colors.white}
                />
                <Text style={{ color: Colors.white, fontWeight: "700" }}>
                  {isRecording ? "Stop recording" : "Record voice note"}
                </Text>
              </Pressable>

              <FormLabel>Attachments</FormLabel>
              <Pressable
                onPress={() => void pickMedia()}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  minHeight: 46,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: Colors.sage,
                  backgroundColor: "#F4F8F5",
                }}
              >
                <Ionicons
                  name="attach-outline"
                  size={19}
                  color={Colors.forest}
                />
                <Text style={{ color: Colors.forest, fontWeight: "700" }}>
                  Choose photos, video, audio or files
                </Text>
              </Pressable>
              {newMedia.map((file) => (
                <View
                  key={file.uri}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 8,
                    padding: 10,
                    borderRadius: 10,
                    backgroundColor: "#F4F6F4",
                  }}
                >
                  <Ionicons
                    name={
                      file.mimeType.startsWith("image/")
                        ? "image-outline"
                        : file.mimeType.startsWith("video/")
                          ? "videocam-outline"
                          : file.mimeType.startsWith("audio/")
                            ? "musical-notes-outline"
                            : "document-outline"
                    }
                    size={18}
                    color={Colors.forest}
                  />
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      marginLeft: 8,
                      color: Colors.textPrimary,
                      fontSize: 13,
                    }}
                  >
                    {file.name}
                  </Text>
                  <Pressable
                    onPress={() =>
                      setNewMedia((current) =>
                        current.filter((item) => item.uri !== file.uri),
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${file.name}`}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="close-circle" size={20} color="#B64D4D" />
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={() => updateForm("is_favorite", !form.is_favorite)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: form.is_favorite }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 9,
                  marginTop: 16,
                  marginBottom: 16,
                }}
              >
                <Ionicons
                  name={form.is_favorite ? "checkbox" : "square-outline"}
                  size={21}
                  color={Colors.forest}
                />
                <FormLabel inline color={Colors.textPrimary}>
                  Mark As Favorite
                </FormLabel>
              </Pressable>
            </ScrollView>

              <Pressable
                onPress={() => void handleSubmit()}
                disabled={submitting || isRecording}
                style={{
                  height: 50,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 14,
                  backgroundColor: Colors.forest,
                  opacity: submitting || isRecording ? 0.65 : 1,
                }}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text
                    style={{
                      color: Colors.white,
                      fontWeight: "800",
                      fontSize: 16,
                    }}
                  >
                    {editingId ? "Save changes" : "Create memory"}
                  </Text>
                )}
              </Pressable>
          </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </SafeAreaView>
  );
}
