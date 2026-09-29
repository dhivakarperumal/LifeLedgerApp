import { Ionicons } from "@expo/vector-icons";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
const entryFilters = [
  "all",
  "recent",
  "favorites",
  "drafts",
  "month",
  "year",
] as const;
type EntryFilter = (typeof entryFilters)[number];

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [categories, setCategories] = useState<DiaryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<EntryFilter>("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedMood, setSelectedMood] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");
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

  const handleUnauthorized = async () => {
    await logoutUser();
    router.replace("/auth/login");
  };

  const fetchData = async () => {
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
  };

  const refreshEntries = useEffectEvent(() => {
    void fetchData();
  });

  useEffect(() => {
    const timeout = setTimeout(() => refreshEntries(), 0);
    return () => clearTimeout(timeout);
  }, [refreshKey]);

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
    const now = new Date();
    return entries
      .filter((entry) => {
        const date = new Date(entry.entry_date || "");
        const statusMatches =
          selectedFilter === "favorites"
            ? asBoolean(entry.is_favorite)
            : selectedFilter === "drafts"
              ? entry.status === "draft"
              : selectedFilter === "month"
                ? date.getMonth() === now.getMonth() &&
                  date.getFullYear() === now.getFullYear()
                : selectedFilter === "year"
                  ? date.getFullYear() === now.getFullYear()
                  : true;
        const categoryMatches =
          selectedCategory === "all" ||
          String(entry.category_id) === selectedCategory ||
          entry.category_name === selectedCategory;
        const moodMatches =
          selectedMood === "all" || entry.mood === selectedMood;
        const dateMatches =
          !selectedDate ||
          String(entry.entry_date || "").slice(0, 10) === selectedDate;
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
    selectedCategory,
    selectedMood,
    selectedDate,
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
      setRefreshKey((value) => value + 1);
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

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{ flex: 1, backgroundColor: Colors.contentBackground }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
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
        >
          <View>
            <Text
              style={{ color: Colors.forest, fontSize: 27, fontWeight: "800" }}
            >
              Diary
            </Text>
            <Text style={{ color: Colors.sage, fontSize: 14, marginTop: 3 }}>
              Make a little room for today.
            </Text>
          </View>
          <Pressable
            onPress={openNewEntry}
            accessibilityRole="button"
            accessibilityLabel="Write diary entry"
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: Colors.forest,
            }}
          >
            <Ionicons name="create-outline" size={23} color={Colors.white} />
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", gap: 9, marginBottom: 15 }}>
          <StatCard label="Entries" value={stats.total} icon="book-outline" />
          <StatCard
            label="This month"
            value={stats.thisMonth}
            icon="calendar-outline"
          />
          <StatCard
            label="Favorites"
            value={stats.favorites}
            icon="heart-outline"
          />
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#DCE7E2",
            backgroundColor: Colors.white,
            paddingHorizontal: 12,
            marginBottom: 12,
          }}
        >
          <Ionicons name="search-outline" size={19} color={Colors.sage} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search title, mood, tags..."
            placeholderTextColor="#899791"
            style={{
              flex: 1,
              height: 46,
              paddingHorizontal: 9,
              color: Colors.textPrimary,
              fontSize: 14,
            }}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 7, paddingBottom: 11 }}
        >
          {entryFilters.map((filter) => {
            const active = selectedFilter === filter;
            const label =
              filter === "all"
                ? "All"
                : filter === "month"
                  ? "This month"
                  : filter === "year"
                    ? "This year"
                    : filter[0].toUpperCase() + filter.slice(1);
            return (
              <Pressable
                key={filter}
                onPress={() => setSelectedFilter(filter)}
                style={{
                  paddingHorizontal: 13,
                  paddingVertical: 8,
                  borderRadius: 16,
                  backgroundColor: active ? Colors.forest : Colors.white,
                  borderWidth: 1,
                  borderColor: active ? Colors.forest : "#DCE7E2",
                }}
              >
                <Text
                  style={{
                    color: active ? Colors.white : Colors.textPrimary,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 9 }}>
          <TextInput
            value={selectedDate}
            onChangeText={setSelectedDate}
            placeholder="Filter date YYYY-MM-DD"
            placeholderTextColor="#899791"
            style={{ ...inputStyle, flex: 1, minHeight: 42 }}
          />
          <Pressable
            onPress={() => setSelectedDate("")}
            accessibilityRole="button"
            accessibilityLabel="Clear date filter"
            style={{
              width: 42,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              backgroundColor: Colors.white,
              borderWidth: 1,
              borderColor: "#DCE7E2",
            }}
          >
            <Ionicons name="close" size={19} color={Colors.sage} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 7, paddingBottom: 11 }}
        >
          {[{ id: "all", name: "All categories" }, ...categories].map(
            (category) => {
              const active = selectedCategory === String(category.id);
              return (
                <Pressable
                  key={String(category.id)}
                  onPress={() => setSelectedCategory(String(category.id))}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 15,
                    backgroundColor: active ? "#E6F1E9" : Colors.white,
                    borderWidth: 1,
                    borderColor: active ? "#BCD5C4" : "#DCE7E2",
                  }}
                >
                  <Text
                    style={{
                      color: Colors.forest,
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    {category.name}
                  </Text>
                </Pressable>
              );
            },
          )}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 7, paddingBottom: 15 }}
        >
          {["all", ...moods.map((mood) => mood.name)].map((mood) => {
            const active = selectedMood === mood;
            const moodInfo = moods.find((item) => item.name === mood);
            return (
              <Pressable
                key={mood}
                onPress={() => setSelectedMood(mood)}
                style={{
                  paddingHorizontal: 11,
                  paddingVertical: 7,
                  borderRadius: 14,
                  backgroundColor: active ? "#FFF2D9" : Colors.white,
                  borderWidth: 1,
                  borderColor: active ? "#F1D39A" : "#DCE7E2",
                }}
              >
                <Text style={{ color: Colors.textPrimary, fontSize: 12 }}>
                  {moodInfo ? `${moodInfo.emoji} ${mood}` : "All moods"}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

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
          filteredEntries.map((entry) => (
            <View
              key={String(entry.id)}
              style={{
                marginBottom: 12,
                padding: 15,
                borderRadius: 17,
                borderWidth: 1,
                borderColor: "#E0E8E3",
                backgroundColor: Colors.white,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 8,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: Colors.textPrimary,
                      fontSize: 18,
                      fontWeight: "800",
                    }}
                  >
                    {entry.title}
                  </Text>
                  <Text
                    style={{ color: Colors.sage, fontSize: 12, marginTop: 4 }}
                  >
                    {formatDate(entry.entry_date)}
                    {entry.entry_time
                      ? `  ·  ${entry.entry_time.slice(0, 5)}`
                      : ""}
                  </Text>
                </View>
                <Pressable
                  onPress={() => void toggleFavorite(entry)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    asBoolean(entry.is_favorite)
                      ? "Remove favorite"
                      : "Add favorite"
                  }
                  hitSlop={6}
                  style={{ padding: 4 }}
                >
                  <Ionicons
                    name={
                      asBoolean(entry.is_favorite) ? "heart" : "heart-outline"
                    }
                    size={21}
                    color={
                      asBoolean(entry.is_favorite) ? "#D64D5A" : Colors.sage
                    }
                  />
                </Pressable>
              </View>
              <Text
                numberOfLines={4}
                style={{
                  color: "#475A53",
                  fontSize: 14,
                  lineHeight: 20,
                  marginTop: 11,
                }}
              >
                {plainContent(entry.content)}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 7,
                  marginTop: 11,
                }}
              >
                <MetaPill
                  label={entry.category_name || "General"}
                  icon="pricetag-outline"
                />
                <MetaPill
                  label={`${moods.find((item) => item.name === entry.mood)?.emoji || "😊"} ${entry.mood || "Happy"}`}
                />
                {entry.location ? (
                  <MetaPill label={entry.location} icon="location-outline" />
                ) : null}
                {entry.attachment_count ||
                entry.attachments?.length ||
                entry.media_files?.length ? (
                  <MetaPill
                    label={`${entry.attachment_count || (entry.attachments?.length || 0) + (entry.media_files?.length || 0)} files`}
                    icon="attach-outline"
                  />
                ) : null}
                {entry.status === "draft" ? (
                  <MetaPill label="Draft" icon="bookmark-outline" />
                ) : null}
                {asBoolean(entry.is_private) || asBoolean(entry.is_locked) ? (
                  <MetaPill
                    label={asBoolean(entry.is_locked) ? "Locked" : "Private"}
                    icon="lock-closed-outline"
                  />
                ) : null}
              </View>
              {parseTags(entry.tags).length > 0 ? (
                <Text
                  numberOfLines={1}
                  style={{ color: Colors.olive, fontSize: 12, marginTop: 10 }}
                >
                  {parseTags(entry.tags)
                    .slice(0, 4)
                    .map((tag) => `#${tag}`)
                    .join("  ")}
                </Text>
              ) : null}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 15,
                  marginTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: "#EEF2EF",
                  paddingTop: 9,
                }}
              >
                <Pressable
                  onPress={() => openEditEntry(entry)}
                  accessibilityRole="button"
                  accessibilityLabel="Edit entry"
                  style={{ padding: 5 }}
                >
                  <Ionicons
                    name="create-outline"
                    size={19}
                    color={Colors.forest}
                  />
                </Pressable>
                <Pressable
                  onPress={() => deleteEntry(entry)}
                  accessibilityRole="button"
                  accessibilityLabel="Delete entry"
                  style={{ padding: 5 }}
                >
                  <Ionicons name="trash-outline" size={19} color="#C84C4C" />
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

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
                <View style={{ flex: 1 }}>
                  <FormField
                    label="Date"
                    value={form.entry_date}
                    onChangeText={(value) => updateForm("entry_date", value)}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FormField
                    label="Time"
                    value={form.entry_time}
                    onChangeText={(value) => updateForm("entry_time", value)}
                    placeholder="HH:MM"
                  />
                </View>
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
                    <Pressable
                      key={mood.name}
                      onPress={() => updateForm("mood", mood.name)}
                      style={{
                        alignItems: "center",
                        minWidth: 61,
                        paddingVertical: 8,
                        borderRadius: 13,
                        backgroundColor: active ? "#FFF2D9" : "#F5F7F5",
                        borderWidth: 1,
                        borderColor: active ? "#E9CA91" : "#E6ECE8",
                      }}
                    >
                      <Text style={{ fontSize: 18 }}>{mood.emoji}</Text>
                      <Text
                        style={{
                          color: Colors.textPrimary,
                          fontSize: 10,
                          marginTop: 3,
                        }}
                      >
                        {mood.name}
                      </Text>
                    </Pressable>
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
                    <Pressable
                      key={String(category.id)}
                      onPress={() =>
                        updateForm("category_id", String(category.id))
                      }
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 13,
                        backgroundColor: active ? "#E6F1E9" : "#F5F7F5",
                        borderWidth: 1,
                        borderColor: active ? "#BCD5C4" : "#E6ECE8",
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
                    </Pressable>
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
          style={{ color: Colors.sage, fontSize: 10, fontWeight: "700" }}
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

function MetaPill({
  label,
  icon,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        maxWidth: "100%",
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: "#F0F5F1",
      }}
    >
      {icon ? <Ionicons name={icon} size={12} color={Colors.forest} /> : null}
      <Text numberOfLines={1} style={{ color: Colors.forest, fontSize: 11 }}>
        {label}
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
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#899791"
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
  fontSize: 11,
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
