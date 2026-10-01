import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
    AudioModule,
    RecordingPresets,
    setAudioModeAsync,
    useAudioRecorder,
} from "expo-audio";
import * as DocumentPicker from "expo-document-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
    useCallback,
    useEffect,
    useEffectEvent,
    useMemo,
    useState,
} from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
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
import {
    createDateRangeSelection,
    isDateInRange,
    type DateRangeSelection,
} from "../../components/DateRangeFilter";
import { FormInput, FormOption } from "../../components/FormControls";
import { GradientSafeAreaView as SafeAreaView } from "../../components/GradientSafeAreaView";
import { SearchBar } from "../../components/SearchBar";
import {
    countActiveFilters,
    DEFAULT_FILTER_STATE,
    type FilterState,
    type ViewModeOption,
} from "../../components/filters";
import { Colors } from "../../constants/colors";

type DiaryEntry = {
  id: number | string;
  title: string;
  content?: string;
  category_id?: number | string | null;
  category_name?: string;
  mood?: string;
  tags?: string[] | string;
  location?: string;
  entry_date?: string;
  entry_time?: string;
  status?: string;
  is_favorite?: boolean | number | string;
  is_private?: boolean | number | string;
  is_locked?: boolean | number | string;
  attachments?: (string | Record<string, any>)[];
  media_files?: (string | Record<string, any>)[];
  attachment_count?: number;
};

type DiaryCategory = {
  id: number | string;
  name: string;
  catType?: string;
  type?: string;
  category_type?: string;
};

type LocalAttachment = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

type DiaryForm = {
  title: string;
  content: string;
  category_id: string;
  mood: string;
  tags: string;
  location: string;
  entry_date: string;
  entry_time: string;
  is_favorite: boolean;
  is_private: boolean;
  is_locked: boolean;
};

const MAX_ATTACHMENT_FILE_SIZE = 100 * 1024 * 1024;
const moods = [
  { name: "Happy", emoji: "😊" },
  { name: "Excited", emoji: "😍" },
  { name: "Calm", emoji: "😌" },
  { name: "Normal", emoji: "😐" },
  { name: "Sad", emoji: "😔" },
  { name: "Angry", emoji: "😡" },
  { name: "Tired", emoji: "😴" },
  { name: "Thoughtful", emoji: "🤔" },
  { name: "Confident", emoji: "😎" },
  { name: "Loved", emoji: "❤️" },
];
const entryFilters = ["all", "recent", "favorites", "drafts"] as const;
type EntryFilter = (typeof entryFilters)[number];
const entryFilterLabels: Record<EntryFilter, string> = {
  all: "All entries",
  recent: "Recent",
  favorites: "Favorites",
  drafts: "Drafts",
};
const diaryDateTileColors = [
  "#EAF5E8",
  "#FCEBF0",
  "#FFF5D9",
  "#E8F3FC",
  "#F0EAFF",
];
const diaryTagColors = [
  { background: "#E5F1FF", color: "#2465A6" },
  { background: "#EAF4E6", color: "#386A38" },
  { background: "#FCE8EC", color: "#A3314A" },
  { background: "#EEE9FF", color: "#6241A8" },
  { background: "#FFF3D4", color: "#8B5C12" },
];

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : undefined;
}

function getList<T>(data: any, key: string): T[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function categoryIsDiary(category: DiaryCategory) {
  const type = String(
    category.catType || category.type || category.category_type || "",
  )
    .trim()
    .toLowerCase();
  const name = String(category.name || "")
    .trim()
    .toLowerCase();
  const aliases = [
    "diary",
    "journal",
    "daily",
    "journal entry",
    "diary entry",
    "dairy",
  ];
  return aliases.some((alias) => type.includes(alias) || name.includes(alias));
}

function asBoolean(value: DiaryEntry["is_favorite"]) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function parseTags(value?: DiaryEntry["tags"]) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

function plainContent(content?: string) {
  return String(content || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function formatDate(value?: string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function diaryDateParts(value?: string) {
  const date = value
    ? parseDateKey(value.slice(0, 10)) || new Date(value)
    : new Date(Number.NaN);
  if (Number.isNaN(date.getTime()))
    return { month: "—", day: "—", weekday: "" };
  return {
    month: date.toLocaleDateString("en-IN", { month: "short" }).toUpperCase(),
    day: String(date.getDate()),
    weekday: date.toLocaleDateString("en-IN", { weekday: "short" }),
  };
}

function formatEntryTime(value?: string) {
  if (!value) return "";
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function attachmentName(file: string | Record<string, any>, index: number) {
  if (typeof file === "string")
    return file.split("/").pop() || `Attachment ${index + 1}`;
  return String(
    file.file_name || file.name || file.filename || `Attachment ${index + 1}`,
  );
}

function attachmentId(file: string | Record<string, any>, index: number) {
  return typeof file === "string"
    ? `attachment-${index}-${file}`
    : String(file.id || `attachment-${index}`);
}

function attachmentKind(file: string | Record<string, any>) {
  const type =
    typeof file === "string"
      ? ""
      : String(file.file_type || file.type || "").toLowerCase();
  const name = attachmentName(file, 0).toLowerCase();
  if (type.includes("image") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name))
    return "image";
  if (type.includes("video") || /\.(mp4|webm|mov|m4v|ogg)$/i.test(name))
    return "video";
  if (type.includes("audio") || /\.(mp3|wav|m4a|aac|webm)$/i.test(name))
    return "audio";
  if (
    type.includes("zip") ||
    type.includes("compressed") ||
    /\.(zip|rar|7z)$/i.test(name)
  )
    return "zip";
  return "file";
}

function diaryImageUrl(entry: DiaryEntry) {
  const files = [...(entry.attachments || []), ...(entry.media_files || [])];
  const image = files.find((file) => {
    const type =
      typeof file === "string"
        ? ""
        : String(file.file_type || file.type || "").toLowerCase();
    const url =
      typeof file === "string"
        ? file
        : String(file.file_url || file.url || file.src || file.path || "");
    return (
      type.includes("image") || /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(url)
    );
  });
  if (!image) return "";

  const value =
    typeof image === "string"
      ? image
      : String(image.file_url || image.url || image.src || image.path || "");
  if (!value) return "";
  if (/^(https?:|file:|content:|data:)/i.test(value)) return value;
  const baseUrl = API_BASE_URL.replace(/\/api\/?$/, "");
  return `${baseUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

function initialDiaryForm(categoryId = ""): DiaryForm {
  return {
    title: "",
    content: "",
    category_id: categoryId,
    mood: "Happy",
    tags: "",
    location: "",
    entry_date: todayKey(),
    entry_time: "",
    is_favorite: false,
    is_private: false,
    is_locked: false,
  };
}

export default function Diary() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { edit: editParam } = useLocalSearchParams<{
    edit?: string | string[];
  }>();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [categories, setCategories] = useState<DiaryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeSelection>(() =>
    createDateRangeSelection("All"),
  );
  const [selectedFilter, setSelectedFilter] = useState<EntryFilter>("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedMood, setSelectedMood] = useState("all");
  const [viewMode, setViewMode] = useState<ViewModeOption>("card");
  const [entryPickerField, setEntryPickerField] = useState<
    "date" | "time" | null
  >(null);
  const [entryPickerDraft, setEntryPickerDraft] = useState(new Date());
  const [editorVisible, setEditorVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [form, setForm] = useState<DiaryForm>(initialDiaryForm());
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<
    (string | Record<string, any>)[]
  >([]);
  const [removedIds, setRemovedIds] = useState({
    image: [] as string[],
    video: [] as string[],
    audio: [] as string[],
    zip: [] as string[],
  });
  const [isRecording, setIsRecording] = useState(false);

  const filterValues = useMemo<FilterState>(
    () => ({
      ...DEFAULT_FILTER_STATE,
      dateRange,
      category: selectedCategory === "all" ? "" : selectedCategory,
      viewMode,
      custom: { entryType: selectedFilter, mood: selectedMood },
    }),
    [dateRange, selectedCategory, selectedFilter, selectedMood, viewMode],
  );
  const filterCategories = useMemo(
    () =>
      categories.map((category) => ({
        value: String(category.id),
        label: category.name,
      })),
    [categories],
  );
  const applyDiaryFilters = (filters: FilterState) => {
    setDateRange(filters.dateRange);
    setSelectedCategory(filters.category || "all");
    setSelectedFilter((filters.custom?.entryType as EntryFilter) || "all");
    setSelectedMood(filters.custom?.mood || "all");
    setViewMode(filters.viewMode);
  };

  const handleUnauthorized = useCallback(async () => {
    await logoutUser();
    router.replace("/auth/login");
  }, [router]);

  const fetchData = useCallback(async () => {
    try {
      const [entriesResult, categoriesResult] = await Promise.allSettled([
        api.get("/diary"),
        api.get("/categories"),
      ]);
      if (entriesResult.status === "rejected") throw entriesResult.reason;
      setEntries(getList<DiaryEntry>(entriesResult.value.data, "entries"));
      if (categoriesResult.status === "fulfilled") {
        setCategories(
          getList<DiaryCategory>(
            categoriesResult.value.data,
            "categories",
          ).filter(categoryIsDiary),
        );
      }
    } catch (error) {
      const status = (error as any)?.status || (error as any)?.response?.status;
      if (status === 401) {
        await handleUnauthorized();
        return;
      }
      Alert.alert(
        "Unable to load diary",
        getApiErrorMessage(error, "Please try again."),
      );
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      const timeout = setTimeout(() => void fetchData(), 0);
      return () => clearTimeout(timeout);
    }, [fetchData]),
  );

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = entries.filter((entry) => {
      const date = new Date(entry.entry_date || "");
      return (
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    }).length;
    return {
      total: entries.length,
      thisMonth,
      favorites: entries.filter((entry) => asBoolean(entry.is_favorite)).length,
      drafts: entries.filter((entry) => entry.status === "draft").length,
    };
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries
      .filter((entry) => {
        const statusMatches =
          selectedFilter === "favorites"
            ? asBoolean(entry.is_favorite)
            : selectedFilter === "drafts"
              ? entry.status === "draft"
              : true;
        const categoryMatches =
          selectedCategory === "all" ||
          String(entry.category_id) === selectedCategory ||
          entry.category_name === selectedCategory;
        const moodMatches =
          selectedMood === "all" || entry.mood === selectedMood;
        const dateMatches = isDateInRange(entry.entry_date, dateRange);
        const searchMatches =
          !term ||
          [
            entry.title,
            plainContent(entry.content),
            entry.location,
            entry.mood,
            entry.category_name,
            parseTags(entry.tags).join(" "),
          ]
            .join(" ")
            .toLowerCase()
            .includes(term);
        return (
          statusMatches &&
          categoryMatches &&
          moodMatches &&
          dateMatches &&
          searchMatches
        );
      })
      .sort(
        (left, right) =>
          new Date(right.entry_date || "").getTime() -
          new Date(left.entry_date || "").getTime(),
      );
  }, [
    entries,
    search,
    selectedFilter,
    dateRange,
    selectedCategory,
    selectedMood,
  ]);

  const openNewEntry = () => {
    setEditingId(null);
    setForm(initialDiaryForm(categories[0] ? String(categories[0].id) : ""));
    setAttachments([]);
    setExistingAttachments([]);
    setRemovedIds({ image: [], video: [], audio: [], zip: [] });
    setEditorVisible(true);
  };

  const openEditEntry = (entry: DiaryEntry) => {
    setEditingId(entry.id);
    setForm({
      title: entry.title || "",
      content: plainContent(entry.content),
      category_id: entry.category_id ? String(entry.category_id) : "",
      mood: entry.mood || "Happy",
      tags: parseTags(entry.tags).join(", "),
      location: entry.location || "",
      entry_date: String(entry.entry_date || todayKey()).slice(0, 10),
      entry_time: String(entry.entry_time || "").slice(0, 5),
      is_favorite: asBoolean(entry.is_favorite),
      is_private: asBoolean(entry.is_private),
      is_locked: asBoolean(entry.is_locked),
    });
    setExistingAttachments([
      ...(entry.media_files || []),
      ...(entry.attachments || []),
    ]);
    setAttachments([]);
    setRemovedIds({ image: [], video: [], audio: [], zip: [] });
    setEditorVisible(true);
  };
  const openRequestedEntry = useEffectEvent(() => {
    const requestedId = Array.isArray(editParam) ? editParam[0] : editParam;
    const requestedEntry = entries.find(
      (entry) => String(entry.id) === String(requestedId),
    );
    if (requestedEntry) {
      openEditEntry(requestedEntry);
      router.setParams({ edit: undefined });
    }
  });

  useEffect(() => {
    if (!editParam || !entries.length) return;
    const timeout = setTimeout(() => openRequestedEntry(), 0);
    return () => clearTimeout(timeout);
  }, [editParam, entries.length]);

  const pickAttachments = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "image/*",
          "video/*",
          "audio/*",
          "application/pdf",
          "application/zip",
          "application/x-rar-compressed",
          "text/plain",
        ],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const picked = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType || "application/octet-stream",
        size: asset.size,
      }));
      const oversized = picked.find(
        (file) => (file.size || 0) > MAX_ATTACHMENT_FILE_SIZE,
      );
      if (oversized) {
        Alert.alert(
          "File too large",
          `${oversized.name} exceeds the 100 MB per-file limit.`,
        );
        return;
      }
      setAttachments((current) => {
        const merged = [
          ...current,
          ...picked.filter(
            (file) => !current.some((existing) => existing.uri === file.uri),
          ),
        ];
        if (merged.length + existingAttachments.length > 10) {
          Alert.alert(
            "Attachment limit",
            "A diary entry can have up to 10 attachments.",
          );
          return current;
        }
        return merged;
      });
    } catch (error) {
      Alert.alert(
        "Unable to choose files",
        getApiErrorMessage(error, "Please try again."),
      );
    }
  };

  const toggleRecording = async () => {
    try {
      if (isRecording) {
        await recorder.stop();
        setIsRecording(false);
        if (recorder.uri) {
          const voiceFile: LocalAttachment = {
            uri: recorder.uri,
            name: `voice-note-${Date.now()}.m4a`,
            mimeType: "audio/mp4",
          };
          setAttachments((current) => [...current, voiceFile]);
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
        "Unable to record",
        getApiErrorMessage(error, "Please try again."),
      );
    }
  };

  const removeExistingAttachment = (
    file: string | Record<string, any>,
    index: number,
  ) => {
    const kind = attachmentKind(file);
    const id = attachmentId(file, index);
    if (kind !== "file") {
      setRemovedIds((current) => ({
        ...current,
        [kind]: [...new Set([...current[kind], id])],
      }));
    }
    setExistingAttachments((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const uploadAttachments = async (
    entryId: number | string,
    pending: LocalAttachment[],
  ) => {
    for (const [index, file] of pending.entries()) {
      const data = new FormData();
      data.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType,
      } as any);
      await api.post(`/diary/${entryId}/attachments`, data, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (event.total)
            setUploadProgress(
              Math.min(99, Math.round((event.loaded / event.total) * 100)),
            );
        },
      });
      if (pending.length > 1 && index < pending.length - 1)
        setUploadProgress(Math.round(((index + 1) / pending.length) * 100));
    }
  };

  const saveEntry = async (status: "draft" | "published") => {
    if (submitting || isRecording) return;
    if (!form.title.trim() || !form.content.trim()) {
      Alert.alert(
        "Entry required",
        "Add a title and write something before saving.",
      );
      return;
    }
    const oversized = attachments.find(
      (file) => (file.size || 0) > MAX_ATTACHMENT_FILE_SIZE,
    );
    if (oversized) {
      Alert.alert(
        "File too large",
        `${oversized.name} exceeds the 100 MB per-file limit.`,
      );
      return;
    }

    const payload: Record<string, any> = {
      ...form,
      status,
      category_id: form.category_id || null,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };
    if (removedIds.image.length) payload.removed_image_ids = removedIds.image;
    if (removedIds.video.length) payload.removed_video_ids = removedIds.video;
    if (removedIds.audio.length) payload.removed_audio_ids = removedIds.audio;
    if (removedIds.zip.length) payload.removed_zip_ids = removedIds.zip;

    try {
      setSubmitting(true);
      setUploadProgress(attachments.length ? 0 : null);
      const response = editingId
        ? await api.put(`/diary/${editingId}`, payload)
        : await api.post("/diary", payload);
      const saved =
        response.data?.entry || response.data?.diary || response.data;
      const savedId = saved?.id || editingId;

      if (attachments.length && savedId)
        await uploadAttachments(savedId, attachments);
      else if (attachments.length && !savedId) {
        Alert.alert(
          "Entry saved",
          "The entry was saved, but the server did not return an ID for its attachments.",
        );
      }
      setEditorVisible(false);
      setAttachments([]);
      await fetchData();
      if (savedId || !attachments.length)
        Alert.alert(
          "Saved",
          status === "draft" ? "Diary draft saved." : "Diary entry saved.",
        );
    } catch (error) {
      const code = (error as any)?.status || (error as any)?.response?.status;
      if (code === 401) {
        await handleUnauthorized();
        return;
      }
      Alert.alert(
        "Unable to save diary",
        getApiErrorMessage(error, "Please try again."),
      );
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const deleteEntry = (entry: DiaryEntry) => {
    Alert.alert("Delete diary entry", `Delete "${entry.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/diary/${entry.id}`);
            setEntries((current) =>
              current.filter((item) => item.id !== entry.id),
            );
          } catch (error) {
            const code =
              (error as any)?.status || (error as any)?.response?.status;
            if (code === 401) await handleUnauthorized();
            else
              Alert.alert(
                "Unable to delete entry",
                getApiErrorMessage(error, "Please try again."),
              );
          }
        },
      },
    ]);
  };

  const toggleFavorite = async (entry: DiaryEntry) => {
    const previous = asBoolean(entry.is_favorite);
    setEntries((current) =>
      current.map((item) =>
        item.id === entry.id ? { ...item, is_favorite: !previous } : item,
      ),
    );
    try {
      await api.patch(`/diary/${entry.id}/favorite`);
    } catch (error) {
      setEntries((current) =>
        current.map((item) =>
          item.id === entry.id ? { ...item, is_favorite: previous } : item,
        ),
      );
      const code = (error as any)?.status || (error as any)?.response?.status;
      if (code === 401) await handleUnauthorized();
      else
        Alert.alert(
          "Unable to update favorite",
          getApiErrorMessage(error, "Please try again."),
        );
    }
  };

  const updateForm = (key: keyof DiaryForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openEntryPicker = (field: "date" | "time") => {
    const nextDate =
      field === "date"
        ? parseDateKey(form.entry_date) || new Date()
        : new Date();
    if (field === "time" && /^\d{2}:\d{2}$/.test(form.entry_time)) {
      const [hours, minutes] = form.entry_time.split(":").map(Number);
      nextDate.setHours(hours, minutes, 0, 0);
    }
    setEntryPickerDraft(nextDate);
    setEntryPickerField(field);
  };

  const applyEntryPicker = (field: "date" | "time", date: Date) => {
    if (field === "date") {
      updateForm("entry_date", dateKey(date));
    } else {
      updateForm(
        "entry_time",
        `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
      );
    }
  };

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{ flex: 1, backgroundColor: Colors.contentBackground }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void fetchData()}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 18,
          paddingBottom: insets.bottom + 112,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        ></View>

        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search title, mood, tags..."
          activeFilterCount={
            countActiveFilters(filterValues) +
            (selectedFilter === "all" ? 0 : 1) +
            (selectedMood === "all" ? 0 : 1)
          }
          filterSheet={{
            currentFilters: filterValues,
            onApply: applyDiaryFilters,
            categories: filterCategories,
            sections: ["date", "category", "viewMode"],
            additionalFilters: [
              {
                key: "entryType",
                label: "Entry type",
                options: entryFilters.map((filter) => ({
                  value: filter,
                  label: entryFilterLabels[filter],
                })),
              },
              {
                key: "mood",
                label: "Mood",
                options: [
                  { value: "all", label: "All moods" },
                  ...moods.map((mood) => ({
                    value: mood.name,
                    label: `${mood.emoji} ${mood.name}`,
                  })),
                ],
              },
            ],
          }}
          style={{ marginBottom: 12 }}
        />

        {loading ? (
          <View style={{ paddingVertical: 42, alignItems: "center" }}>
            <ActivityIndicator size="large" color={Colors.forest} />
          </View>
        ) : filteredEntries.length === 0 ? (
          <View
            style={{
              padding: 28,
              alignItems: "center",
              borderRadius: 18,
              backgroundColor: Colors.white,
            }}
          >
            <Ionicons name="book-outline" size={38} color={Colors.sage} />
            <Text
              style={{
                color: Colors.textPrimary,
                fontSize: 17,
                fontWeight: "700",
                marginTop: 10,
              }}
            >
              No entries found
            </Text>
            <Text
              style={{
                color: Colors.sage,
                fontSize: 13,
                textAlign: "center",
                marginTop: 5,
              }}
            >
              Write about your day or adjust the filters.
            </Text>
          </View>
        ) : (
          <View
            style={{
              flexDirection: viewMode === "card" ? "row" : "column",
              flexWrap: viewMode === "card" ? "wrap" : "nowrap",
              justifyContent: viewMode === "card" ? "space-between" : undefined,
              gap: 10,
            }}
          >
            {filteredEntries.map((entry, index) => {
              const date = diaryDateParts(entry.entry_date);
              const tags = parseTags(entry.tags);
              const photoUrl = diaryImageUrl(entry);
              const mood = moods.find((item) => item.name === entry.mood);
              const moodTone = diaryTagColors[index % diaryTagColors.length];
              const attachmentCount =
                entry.attachment_count ||
                (entry.attachments?.length || 0) +
                  (entry.media_files?.length || 0);

              return (
                <Pressable
                  key={String(entry.id)}
                  onPress={() =>
                    router.push({
                      pathname: "/diary/[id]",
                      params: { id: String(entry.id) },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`View diary entry: ${entry.title}`}
                  style={{
                    position: "relative",
                    width: viewMode === "card" ? "48%" : "100%",
                    flexDirection: viewMode === "card" ? "column" : "row",
                    alignItems: viewMode === "card" ? "stretch" : "center",
                    gap: viewMode === "card" ? 7 : 10,
                    minHeight: viewMode === "card" ? 280 : 152,
                    padding: 11,
                    paddingRight: 12,
                    borderRadius: 19,
                    borderWidth: 1,
                    borderColor: "#E8EEEA",
                    backgroundColor: Colors.white,
                    shadowColor: "#26382E",
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.05,
                    shadowRadius: 9,
                    elevation: 2,
                  }}
                >
                  <View
                    style={{
                      width: viewMode === "card" ? "100%" : 68,
                      minHeight: viewMode === "card" ? 42 : 110,
                      flexDirection: viewMode === "card" ? "row" : "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: viewMode === "card" ? 8 : 0,
                      paddingHorizontal: viewMode === "card" ? 10 : 4,
                      borderRadius: viewMode === "card" ? 12 : 16,
                      backgroundColor:
                        diaryDateTileColors[index % diaryDateTileColors.length],
                    }}
                  >
                    <Text style={{ color: Colors.textPrimary, fontSize: 12 }}>
                      {date.month}
                    </Text>
                    <Text
                      style={{
                        color: "#111D20",
                        fontSize: 26,
                        fontWeight: "800",
                        lineHeight: 31,
                      }}
                    >
                      {date.day}
                    </Text>
                    <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
                      {date.weekday}
                    </Text>
                  </View>

                  <View
                    style={{
                      flex: viewMode === "card" ? undefined : 1,
                      width: viewMode === "card" ? "100%" : undefined,
                      minWidth: 0,
                      justifyContent: "center",
                      paddingVertical: viewMode === "card" ? 2 : 7,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        paddingRight: 20,
                        color: Colors.textPrimary,
                        fontSize: 16,
                        fontWeight: "800",
                      }}
                    >
                      {entry.title}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                        marginTop: 4,
                      }}
                    >
                      <Ionicons
                        name="time-outline"
                        size={14}
                        color={Colors.textSecondary}
                      />
                      <Text
                        numberOfLines={1}
                        style={{ color: Colors.textSecondary, fontSize: 12 }}
                      >
                        {formatEntryTime(entry.entry_time) ||
                          formatDate(entry.entry_date)}
                      </Text>
                      {asBoolean(entry.is_private) ||
                      asBoolean(entry.is_locked) ? (
                        <Ionicons
                          name="lock-closed-outline"
                          size={13}
                          color={Colors.olive}
                        />
                      ) : null}
                    </View>
                    {plainContent(entry.content) ? (
                      <Text
                        numberOfLines={2}
                        style={{
                          color: "#596367",
                          fontSize: 13,
                          lineHeight: 18,
                          marginTop: 5,
                        }}
                      >
                        {plainContent(entry.content)}
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
                      {[
                        entry.category_name || "General",
                        ...tags.slice(0, 2),
                      ].map((label, tagIndex) => {
                        const tone =
                          diaryTagColors[tagIndex % diaryTagColors.length];
                        return (
                          <Text
                            key={`${entry.id}-${label}`}
                            numberOfLines={1}
                            style={{
                              maxWidth: 100,
                              overflow: "hidden",
                              paddingHorizontal: 9,
                              paddingVertical: 5,
                              borderRadius: 14,
                              backgroundColor: tone.background,
                              color: tone.color,
                              fontSize: 11,
                              fontWeight: "600",
                            }}
                          >
                            {label}
                          </Text>
                        );
                      })}
                      {tags.length > 2 ? (
                        <Text
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 5,
                            borderRadius: 14,
                            backgroundColor: "#F0F3F2",
                            color: Colors.textSecondary,
                            fontSize: 11,
                          }}
                        >
                          +{tags.length - 2}
                        </Text>
                      ) : null}
                      {attachmentCount > 0 ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 3,
                            paddingHorizontal: 7,
                            paddingVertical: 5,
                            borderRadius: 14,
                            backgroundColor: "#F0F3F2",
                          }}
                        >
                          <Ionicons
                            name="attach-outline"
                            size={12}
                            color={Colors.textSecondary}
                          />
                          <Text
                            style={{
                              color: Colors.textSecondary,
                              fontSize: 11,
                            }}
                          >
                            {attachmentCount}
                          </Text>
                        </View>
                      ) : null}
                      {entry.status === "draft" ? (
                        <Text
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 5,
                            borderRadius: 14,
                            backgroundColor: "#FFF3D4",
                            color: "#8B5C12",
                            fontSize: 11,
                            fontWeight: "600",
                          }}
                        >
                          Draft
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View
                    style={{
                      width: viewMode === "card" ? "100%" : "28%",
                      minWidth: viewMode === "card" ? undefined : 88,
                      maxWidth: viewMode === "card" ? undefined : 176,
                      gap: 7,
                      alignItems: "stretch",
                    }}
                  >
                    <View
                      style={{
                        alignSelf: "flex-end",
                        maxWidth: "100%",
                        marginRight: 18,
                        paddingHorizontal: 9,
                        paddingVertical: 5,
                        borderRadius: 16,
                        backgroundColor: moodTone.background,
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          color: moodTone.color,
                          fontSize: 11,
                          fontWeight: "600",
                        }}
                      >
                        {mood?.emoji || "😊"} {entry.mood || "Happy"}
                      </Text>
                    </View>
                    <View
                      style={{
                        height: viewMode === "card" ? 88 : 96,
                        overflow: "hidden",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 15,
                        backgroundColor: "#E7EEE9",
                      }}
                    >
                      {photoUrl ? (
                        <Image
                          source={{ uri: photoUrl }}
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
                        <Ionicons
                          name="image-outline"
                          size={26}
                          color={Colors.sage}
                        />
                      )}
                    </View>
                  </View>

                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      Alert.alert(entry.title, "Entry options", [
                        {
                          text: "View",
                          onPress: () =>
                            router.push({
                              pathname: "/diary/[id]",
                              params: { id: String(entry.id) },
                            }),
                        },
                        { text: "Edit", onPress: () => openEditEntry(entry) },
                        {
                          text: asBoolean(entry.is_favorite)
                            ? "Remove favorite"
                            : "Add favorite",
                          onPress: () => void toggleFavorite(entry),
                        },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: () => deleteEntry(entry),
                        },
                        { text: "Cancel", style: "cancel" },
                      ]);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Options for ${entry.title}`}
                    hitSlop={7}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 5,
                      padding: 4,
                    }}
                  >
                    <Ionicons
                      name="ellipsis-vertical"
                      size={18}
                      color={Colors.textPrimary}
                    />
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {Platform.OS === "android" && entryPickerField ? (
        <DateTimePicker
          value={entryPickerDraft}
          mode={entryPickerField}
          display="default"
          onChange={(event, date) => {
            if (event.type === "set" && date && entryPickerField) {
              applyEntryPicker(entryPickerField, date);
            }
            setEntryPickerField(null);
          }}
        />
      ) : null}

      <Modal
        visible={Platform.OS === "ios" && entryPickerField !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEntryPickerField(null)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(14,31,26,0.48)",
          }}
        >
          <View
            style={{
              paddingHorizontal: 18,
              paddingTop: 16,
              paddingBottom: insets.bottom + 12,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              backgroundColor: Colors.white,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Pressable onPress={() => setEntryPickerField(null)}>
                <Text style={{ color: Colors.sage, fontSize: 15 }}>Cancel</Text>
              </Pressable>
              <Text
                style={{
                  color: Colors.forest,
                  fontSize: 16,
                  fontWeight: "700",
                }}
              >
                Select {entryPickerField === "date" ? "date" : "time"}
              </Text>
              <Pressable
                onPress={() => {
                  if (entryPickerField) {
                    applyEntryPicker(entryPickerField, entryPickerDraft);
                  }
                  setEntryPickerField(null);
                }}
              >
                <Text
                  style={{
                    color: Colors.forest,
                    fontSize: 15,
                    fontWeight: "700",
                  }}
                >
                  Done
                </Text>
              </Pressable>
            </View>
            {entryPickerField ? (
              <DateTimePicker
                value={entryPickerDraft}
                mode={entryPickerField}
                display="spinner"
                onChange={(_, date) => {
                  if (date) setEntryPickerDraft(date);
                }}
              />
            ) : null}
          </View>
        </View>
      </Modal>

      <AddButton
        onPress={openNewEntry}
        accessibilityLabel="Write diary entry"
        accessibilityHint="Opens a new diary entry"
      />

      <Modal
        visible={editorVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !isRecording && setEditorVisible(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(14,31,26,0.48)",
          }}
        >
          <View
            style={{
              maxHeight: "94%",
              paddingHorizontal: 18,
              paddingTop: 17,
              paddingBottom: insets.bottom + 15,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
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
                  color: Colors.forest,
                  fontSize: 22,
                  fontWeight: "800",
                }}
              >
                {editingId ? "Edit diary entry" : "Write in your diary"}
              </Text>
              <Pressable
                onPress={() => setEditorVisible(false)}
                disabled={submitting || isRecording}
                accessibilityRole="button"
                accessibilityLabel="Close editor"
                style={{ padding: 6 }}
              >
                <Ionicons name="close" size={23} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <FormField
                label="Title"
                value={form.title}
                onChangeText={(value) => updateForm("title", value)}
                placeholder="A title for today"
              />
              <View style={{ flexDirection: "row", gap: 9 }}>
                <DateRangeButton
                  label="Date"
                  value={form.entry_date}
                  displayValue={formatDate(form.entry_date)}
                  onPress={() => openEntryPicker("date")}
                />
                <DateRangeButton
                  label="Time"
                  value={form.entry_time}
                  displayValue={form.entry_time || "Select time"}
                  icon="time-outline"
                  onPress={() => openEntryPicker("time")}
                />
              </View>

              <Text style={labelStyle}>Mood</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 7, paddingBottom: 14 }}
              >
                {moods.map((mood) => {
                  const active = form.mood === mood.name;
                  return (
                    <FormOption
                      key={mood.name}
                      selected={active}
                      onPress={() => updateForm("mood", mood.name)}
                      style={{
                        alignItems: "center",
                        minWidth: 61,
                        paddingVertical: 8,
                        borderRadius: 13,
                        backgroundColor: active ? "#FFF2D9" : "#F5F7F5",
                      }}
                    >
                      <Text style={{ fontSize: 18 }}>{mood.emoji}</Text>
                      <Text
                        style={{
                          color: Colors.textPrimary,
                          fontSize: 12,
                          marginTop: 3,
                        }}
                      >
                        {mood.name}
                      </Text>
                    </FormOption>
                  );
                })}
              </ScrollView>

              <Text style={labelStyle}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 7, paddingBottom: 13 }}
              >
                {categories.map((category) => {
                  const active = form.category_id === String(category.id);
                  return (
                    <FormOption
                      key={String(category.id)}
                      selected={active}
                      onPress={() =>
                        updateForm("category_id", String(category.id))
                      }
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 13,
                        backgroundColor: active ? "#E6F1E9" : "#F5F7F5",
                      }}
                    >
                      <Text
                        style={{
                          color: Colors.forest,
                          fontSize: 13,
                          fontWeight: "600",
                        }}
                      >
                        {category.name}
                      </Text>
                    </FormOption>
                  );
                })}
              </ScrollView>

              <FormField
                label="Location"
                value={form.location}
                onChangeText={(value) => updateForm("location", value)}
                placeholder="Where were you?"
              />
              <FormField
                label="Tags"
                value={form.tags}
                onChangeText={(value) => updateForm("tags", value)}
                placeholder="family, travel, gratitude"
              />
              <FormField
                label="Today's entry"
                value={form.content}
                onChangeText={(value) => updateForm("content", value)}
                placeholder="Write about your day, thoughts, or moments..."
                multiline
              />

              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 14,
                  marginBottom: 14,
                }}
              >
                <ToggleField
                  label="Favorite"
                  checked={form.is_favorite}
                  onPress={() => updateForm("is_favorite", !form.is_favorite)}
                  icon="heart-outline"
                />
                <ToggleField
                  label="Private"
                  checked={form.is_private}
                  onPress={() => updateForm("is_private", !form.is_private)}
                  icon="eye-off-outline"
                />
                <ToggleField
                  label="Locked"
                  checked={form.is_locked}
                  onPress={() => updateForm("is_locked", !form.is_locked)}
                  icon="lock-closed-outline"
                />
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                <Pressable
                  onPress={() => void pickAttachments()}
                  style={{
                    flex: 1,
                    minHeight: 46,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 7,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: Colors.sage,
                    backgroundColor: "#F5F8F5",
                  }}
                >
                  <Ionicons
                    name="attach-outline"
                    size={18}
                    color={Colors.forest}
                  />
                  <Text
                    style={{
                      color: Colors.forest,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    Add attachments
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void toggleRecording()}
                  style={{
                    flex: 1,
                    minHeight: 46,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 7,
                    borderRadius: 12,
                    backgroundColor: isRecording ? "#B83E48" : Colors.forest,
                  }}
                >
                  <Ionicons
                    name={isRecording ? "stop-circle-outline" : "mic-outline"}
                    size={18}
                    color={Colors.white}
                  />
                  <Text
                    style={{
                      color: Colors.white,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    {isRecording ? "Stop recording" : "Record voice"}
                  </Text>
                </Pressable>
              </View>

              {existingAttachments.map((file, index) => (
                <AttachmentRow
                  key={`${attachmentId(file, index)}-${index}`}
                  name={attachmentName(file, index)}
                  onRemove={() => removeExistingAttachment(file, index)}
                />
              ))}
              {attachments.map((file) => (
                <AttachmentRow
                  key={file.uri}
                  name={file.name}
                  onRemove={() =>
                    setAttachments((current) =>
                      current.filter((item) => item.uri !== file.uri),
                    )
                  }
                />
              ))}
              {uploadProgress !== null ? (
                <Text
                  style={{ color: Colors.sage, fontSize: 12, marginTop: 9 }}
                >
                  Uploading attachments: {uploadProgress}%
                </Text>
              ) : null}

              <View
                style={{
                  flexDirection: "row",
                  gap: 9,
                  marginTop: 16,
                  marginBottom: 5,
                }}
              >
                <Pressable
                  onPress={() => void saveEntry("draft")}
                  disabled={submitting || isRecording}
                  style={{
                    flex: 1,
                    height: 48,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 13,
                    borderWidth: 1,
                    borderColor: "#B9C9BF",
                    backgroundColor: Colors.white,
                    opacity: submitting || isRecording ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: Colors.forest, fontWeight: "800" }}>
                    {submitting ? "Saving..." : "Save draft"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void saveEntry("published")}
                  disabled={submitting || isRecording}
                  style={{
                    flex: 1.3,
                    height: 48,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 13,
                    backgroundColor: Colors.forest,
                    opacity: submitting || isRecording ? 0.6 : 1,
                  }}
                >
                  {submitting ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <Text style={{ color: Colors.white, fontWeight: "800" }}>
                      {editingId ? "Save entry" : "Publish entry"}
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DateRangeButton({
  label,
  value,
  displayValue,
  icon = "calendar-outline",
  onPress,
}: {
  label: string;
  value: string;
  displayValue?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={labelStyle}>{label}</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${displayValue || (value ? formatDate(value) : "not selected")}`}
        style={{
          minHeight: 46,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 10,
          borderRadius: 11,
          borderWidth: 1,
          borderColor: "#DFE7E2",
          backgroundColor: Colors.white,
        }}
      >
        <Ionicons name={icon} size={17} color={Colors.forest} />
        <Text
          numberOfLines={1}
          style={{ flex: 1, color: Colors.textPrimary, fontSize: 13 }}
        >
          {displayValue ||
            (value ? formatDate(value) : `Select ${label.toLowerCase()}`)}
        </Text>
      </Pressable>
    </View>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View
      style={{
        flex: 1,
        minHeight: 76,
        justifyContent: "center",
        paddingHorizontal: 11,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#E0E8E3",
        backgroundColor: Colors.white,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name={icon} size={15} color={Colors.forest} />
        <Text
          numberOfLines={1}
          style={{ color: Colors.sage, fontSize: 12, fontWeight: "700" }}
        >
          {label}
        </Text>
      </View>
      <Text
        style={{
          color: Colors.textPrimary,
          fontSize: 21,
          fontWeight: "800",
          marginTop: 4,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 13 }}>
      <Text style={labelStyle}>{label}</Text>
      <FormInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline={multiline}
        numberOfLines={multiline ? 6 : 1}
        textAlignVertical={multiline ? "top" : "center"}
        style={{
          ...inputStyle,
          minHeight: multiline ? 130 : 45,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}

function ToggleField({
  label,
  checked,
  onPress,
  icon,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
    >
      <Ionicons
        name={checked ? "checkbox" : "square-outline"}
        size={19}
        color={Colors.forest}
      />
      <Ionicons name={icon} size={15} color={Colors.sage} />
      <Text style={{ color: Colors.textPrimary, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

function AttachmentRow({
  name,
  onRemove,
}: {
  name: string;
  onRemove: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 7,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: "#F4F7F4",
      }}
    >
      <Ionicons
        name="document-attach-outline"
        size={17}
        color={Colors.forest}
      />
      <Text
        numberOfLines={1}
        style={{ flex: 1, color: Colors.textPrimary, fontSize: 12 }}
      >
        {name}
      </Text>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${name}`}
        style={{ padding: 3 }}
      >
        <Ionicons name="close-circle" size={19} color="#B64D4D" />
      </Pressable>
    </View>
  );
}

const labelStyle = {
  marginBottom: 7,
  color: Colors.sage,
  fontSize: 12,
  fontWeight: "700" as const,
  textTransform: "uppercase" as const,
};
const inputStyle = {
  minHeight: 44,
  paddingHorizontal: 11,
  paddingVertical: 9,
  borderRadius: 11,
  borderWidth: 1,
  borderColor: "#DFE7E2",
  backgroundColor: "#F8FAF8",
  color: Colors.textPrimary,
  fontSize: 14,
};
