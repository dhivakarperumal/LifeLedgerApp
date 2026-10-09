import { Ionicons } from "@expo/vector-icons";
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
    KeyboardAvoidingView,
    Linking,
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
import { AddPageHeader } from "../../components/AddPageHeader";
import { CenteredPageLoader } from "../../components/CenteredPageLoader";
import ConfirmPopup from "../../components/ConfirmPopup";
import {
    createDateRangeSelection,
    isDateInRange,
    type DateRangeSelection,
} from "../../components/DateRangeFilter";
import { DateTimePickerComponent } from "../../components/DateTimePickerComponent";
import {
    formatLocalDate,
    formatLocalTime,
    parseLocalDate,
    parseLocalDateTime,
} from "../../components/dateTimeUtils";
import {
    countActiveFilters,
    DEFAULT_FILTER_STATE,
    type FilterState,
    type ViewModeOption,
} from "../../components/filters";
import { FormInput, FormLabel } from "../../components/FormControls";
import { GradientSafeAreaView as SafeAreaView } from "../../components/GradientSafeAreaView";
import { PopupSelect } from "../../components/PopupSelect";
import { SearchBar } from "../../components/SearchBar";
import { UploadFilePreview } from "../../components/UploadFilePreview";
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
  const date = parseDateKey(value.slice(0, 10));
  if (!date) return value;
  return date.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function diaryDateParts(value?: string) {
  const date = value ? parseDateKey(value.slice(0, 10)) : undefined;
  if (!date)
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

// Groups an array of DiaryEntry into [{monthKey, label, entries}] sorted newest first
function groupEntriesByMonth(entries: DiaryEntry[]) {
  const map = new Map<string, { label: string; entries: DiaryEntry[] }>();
  for (const entry of entries) {
    const dateStr = entry.entry_date
      ? String(entry.entry_date).slice(0, 10)
      : "";
    const date = parseDateKey(dateStr);
    const isValid = !!date;
    const key = isValid
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      : "unknown";
    const label = isValid
      ? date.toLocaleDateString("en-IN", { month: "long", year: "numeric" })
      : "Unknown Date";
    if (!map.has(key)) map.set(key, { label, entries: [] });
    map.get(key)!.entries.push(entry);
  }
  // Sort groups newest first
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthKey, value]) => ({ monthKey, ...value }));
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
    entry_time: formatLocalTime(new Date()),
    is_favorite: false,
    is_private: false,
    is_locked: false,
  };
}

export default function Diary() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { create: rawCreate, edit: editParam } = useLocalSearchParams<{
    create?: string | string[];
    edit?: string | string[];
  }>();
  const createParam = Array.isArray(rawCreate) ? rawCreate[0] : rawCreate;
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [categories, setCategories] = useState<DiaryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeSelection>(() =>
    createDateRangeSelection("All"),
  );
  const [selectedFilter, setSelectedFilter] = useState<EntryFilter>("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedMood, setSelectedMood] = useState("all");
  const [viewMode, setViewMode] = useState<ViewModeOption>("table");
  const [editorVisible, setEditorVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDeleteEntry, setPendingDeleteEntry] =
    useState<DiaryEntry | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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
      .sort((left, right) => {
        const leftDate = parseDateKey(String(left.entry_date || "").slice(0, 10));
        const rightDate = parseDateKey(String(right.entry_date || "").slice(0, 10));
        return (rightDate?.getTime() || 0) - (leftDate?.getTime() || 0);
      });
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
    if (createParam === "1") {
      openNewEntry();
      router.setParams({ create: undefined });
      return;
    }
    const requestedId = Array.isArray(editParam) ? editParam[0] : editParam;
    const requestedEntry = entries.find(
      (entry) => String(entry.id) === String(requestedId),
    );
    if (requestedEntry) {
      openEditEntry(requestedEntry);
      router.setParams({ edit: undefined });
    } else if (!loading) {
      Alert.alert("Diary entry not found", "This entry is no longer available.");
      if (router.canGoBack()) router.back();
    }
  });

  useEffect(() => {
    if (createParam !== "1" && (!editParam || loading)) return;
    const timeout = setTimeout(() => openRequestedEntry(), 0);
    return () => clearTimeout(timeout);
  }, [createParam, editParam, loading, entries.length]);

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
          "Saved with a warning",
          "The entry was saved, but the server did not return an ID for its attachments.",
        );
      }
      setAttachments([]);
      await fetchData();
      if (savedId || !attachments.length) {
        Alert.alert(
          "Saved",
          status === "draft" ? "Diary draft saved." : "Diary entry saved.",
        );
      }
      if (router.canGoBack()) router.back();
      else setEditorVisible(false);
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
    setPendingDeleteEntry(entry);
  };

  const confirmDeleteEntry = async () => {
    if (!pendingDeleteEntry) return;
    const entry = pendingDeleteEntry;
    setPendingDeleteEntry(null);
    try {
      await api.delete(`/diary/${entry.id}`);
      setEntries((current) => current.filter((item) => item.id !== entry.id));
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

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{ flex: 1, backgroundColor: Colors.contentBackground }}
    >
      <ConfirmPopup
        visible={pendingDeleteEntry !== null}
        type="delete"
        message={
          pendingDeleteEntry
            ? `Delete "${pendingDeleteEntry.title}"?`
            : undefined
        }
        onConfirm={confirmDeleteEntry}
        onCancel={() => setPendingDeleteEntry(null)}
      />
      <ConfirmPopup
        visible={successMessage !== null}
        type="success"
        message={successMessage ?? ""}
        onConfirm={() => setSuccessMessage(null)}
      />
      {loading ? (
        <CenteredPageLoader message="Loading diary..." />
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
          paddingTop: 0,
          paddingBottom: insets.bottom + 112,
        }}
      >
        <SearchBar
          className="mt-5"
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
                presentation: "select",
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
                presentation: "popup",
              },
            ],
          }}
          style={{ marginBottom: 12 }}
        />

        {filteredEntries.length === 0 ? (
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
          <View style={{ gap: 20 }}>
            {groupEntriesByMonth(filteredEntries).map((group) => (
              <View key={group.monthKey}>
                {/* ── Month header ── */}
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
                          color: "#fff",
                          fontSize: 10,
                          fontWeight: "700",
                        }}
                      >
                        {group.entries.length}
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

                {/* ── Entries for this month ── */}
                <View
                  style={{
                    flexDirection: viewMode === "card" ? "row" : "column",
                    flexWrap: viewMode === "card" ? "wrap" : "nowrap",
                    justifyContent:
                      viewMode === "card" ? "space-between" : undefined,
                    gap: 10,
                  }}
                >
                  {group.entries.map((entry, index) => {
                    const date = diaryDateParts(entry.entry_date);
                    const moodLabel = (entry.mood || "").trim().toLowerCase();
                    const tags = parseTags(entry.tags).filter(
                      (tag) => tag.trim().toLowerCase() !== moodLabel,
                    );
                    const photoUrl = diaryImageUrl(entry);
                    const mood = moods.find((item) => item.name === entry.mood);
                    const moodTone =
                      diaryTagColors[index % diaryTagColors.length];
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
                          minWidth: 0,
                          flexDirection: viewMode === "card" ? "column" : "row",
                          alignItems:
                            viewMode === "card" ? "stretch" : "center",
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
                            flexDirection:
                              viewMode === "card" ? "row" : "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: viewMode === "card" ? 8 : 0,
                            paddingHorizontal: viewMode === "card" ? 10 : 4,
                            borderRadius: viewMode === "card" ? 12 : 16,
                            backgroundColor:
                              diaryDateTileColors[
                                index % diaryDateTileColors.length
                              ],
                          }}
                        >
                          <Text
                            style={{ color: Colors.textPrimary, fontSize: 12 }}
                          >
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
                          <Text
                            style={{
                              color: Colors.textSecondary,
                              fontSize: 12,
                            }}
                          >
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
                              style={{
                                color: Colors.textSecondary,
                                fontSize: 12,
                              }}
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
                                diaryTagColors[
                                  tagIndex % diaryTagColors.length
                                ];
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
                              marginRight: viewMode === "card" ? 0 : 18,
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
                              {
                                text: "Edit",
                                onPress: () =>
                                  router.push({
                                    pathname: "/diary-form" as any,
                                    params: { edit: String(entry.id) },
                                  }),
                              },
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
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      )}

      <AddButton
        onPress={() =>
          router.push({
            pathname: "/diary-form" as any,
            params: { create: "1" },
          })
        }
        accessibilityLabel="Write diary entry"
        accessibilityHint="Opens a new diary entry"
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
              paddingBottom: 12,
              flex: 1,
              backgroundColor: Colors.white,
            }}
          >
            <AddPageHeader
              title={editingId ? "Edit Diary" : "Add New Diary"}
              onBack={() => {
                if (router.canGoBack()) router.back();
                else setEditorVisible(false);
              }}
              horizontalInset={18}
              disabled={submitting || isRecording}
            />
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
                placeholder="A title for today"
              />
              <View style={{ flexDirection: "row", gap: 9 }}>
                <View style={{ flex: 1 }}>
                  <DateTimePickerComponent
                    mode="date"
                    value={parseLocalDate(form.entry_date)}
                    onChange={(date) => {
                      if (date) updateForm("entry_date", formatLocalDate(date));
                    }}
                    label="Date"
                    placeholder="Select date"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <DateTimePickerComponent
                    mode="time"
                    value={
                      /^\d{2}:\d{2}$/.test(form.entry_time)
                        ? parseLocalDateTime(form.entry_date, form.entry_time)
                        : null
                    }
                    onChange={(date) => {
                      if (date) updateForm("entry_time", formatLocalTime(date));
                    }}
                    label="Time"
                    placeholder="Select time"
                  />
                </View>
              </View>

              <PopupSelect
                label="Mood"
                placeholder="Select Mood"
                options={moods.map((mood) => ({
                  value: mood.name,
                  label: `${mood.emoji} ${mood.name}`,
                }))}
                value={form.mood}
                onChange={(value) => updateForm("mood", value)}
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
                label="Today's Entry"
                value={form.content}
                onChangeText={(value) => updateForm("content", value)}
                placeholder="Write about your day, thoughts, or moments..."
                multiline
              />

              <View
                style={{
                  width: "100%",
                  flexDirection: "row",
                  flexWrap: "nowrap",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <Pressable
                  onPress={() => void pickAttachments()}
                  style={{
                    flexGrow: 1,
                    flexShrink: 1,
                    flexBasis: 0,
                    minWidth: 0,
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
                    numberOfLines={1}
                    style={{
                      flexShrink: 1,
                      color: Colors.forest,
                      fontWeight: "700",
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  >
                    Add attachments
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void toggleRecording()}
                  style={{
                    flexGrow: 1,
                    flexShrink: 1,
                    flexBasis: 0,
                    minWidth: 0,
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
                    numberOfLines={1}
                    style={{
                      flexShrink: 1,
                      color: Colors.white,
                      fontWeight: "700",
                      fontSize: 12,
                      textAlign: "center",
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
                <UploadFilePreview
                  key={file.uri}
                  uri={file.uri}
                  name={file.name}
                  mimeType={file.mimeType}
                  onOpen={() => {
                    void Linking.openURL(file.uri).catch(() =>
                      Alert.alert("Unable to open attachment", "No app could open this file."),
                    );
                  }}
                  onRemove={() =>
                    setAttachments((current) =>
                      current.filter((item) => item.uri !== file.uri),
                    )
                  }
                  removeLabel={`Remove ${file.name}`}
                />
              ))}
              {uploadProgress !== null ? (
                <Text
                  style={{ color: Colors.sage, fontSize: 12, marginTop: 9 }}
                >
                  Uploading attachments: {uploadProgress}%
                </Text>
              ) : null}

            </ScrollView>

              <View
                style={{
                  marginTop: 16,
                  marginBottom: 5,
                }}
              >
                <Pressable
                  onPress={() => void saveEntry("published")}
                  disabled={submitting || isRecording}
                  style={{
                    width: "100%",
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
          </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </SafeAreaView>
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
    <View className="mb-4">
      <FormLabel>{label}</FormLabel>
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
