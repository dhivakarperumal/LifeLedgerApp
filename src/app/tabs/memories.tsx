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
  Image,
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
import api, { API_BASE_URL, getApiErrorMessage, logoutUser } from "../../api";
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
  memory_date: new Date().toISOString().slice(0, 10),
  location: "",
  mood: "Happy",
  tags: "",
  status: "published",
  is_favorite: false,
  voice_note: "",
};

function getList<T>(data: any, keys: string[] = []): T[] {
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  if (Array.isArray(data?.data)) return data.data;
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
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [categories, setCategories] = useState<MemoryCategory[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editorVisible, setEditorVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [form, setForm] = useState<MemoryForm>(initialForm);
  const [newMedia, setNewMedia] = useState<LocalMedia[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const handleUnauthorized = async () => {
    await logoutUser();
    router.replace("/auth/login");
  };

  const fetchData = async () => {
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
  };

  const refreshMemories = useEffectEvent(() => {
    void fetchData();
  });

  useEffect(() => {
    const timeout = setTimeout(() => refreshMemories(), 0);
    return () => clearTimeout(timeout);
  }, [refreshKey]);

  const filteredMemories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return memories.filter((memory) => {
      const categoryMatches =
        selectedCategory === "all" ||
        String(memory.category_id) === selectedCategory;
      const favoriteMatches = !favoriteOnly || isFavorite(memory);
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
        favoriteMatches &&
        (!query || searchable.includes(query))
      );
    });
  }, [memories, search, selectedCategory, favoriteOnly]);

  const openNewMemory = () => {
    setEditingId(null);
    setForm({
      ...initialForm,
      category_id: categories[0] ? String(categories[0].id) : "",
    });
    setNewMedia([]);
    setEditorVisible(true);
  };

  const openEditMemory = (memory: Memory) => {
    setEditingId(memory.id);
    setForm({
      title: memory.title || "",
      description: memory.description || "",
      category_id: memory.category_id ? String(memory.category_id) : "",
      memory_date: memory.memory_date
        ? new Date(memory.memory_date).toISOString().slice(0, 10)
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
  };

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

      setEditorVisible(false);
      setNewMedia([]);
      setRefreshKey((current) => current + 1);
      Alert.alert("Saved", editingId ? "Memory updated." : "Memory created.");
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
    Alert.alert("Delete memory", `Delete "${memory.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
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
        },
      },
    ]);
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
         
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 16,
            backgroundColor: Colors.white,
            borderWidth: 1,
            borderColor: "#DCE7E2",
            paddingHorizontal: 13,
            marginBottom: 14,
          }}
        >
          <Ionicons name="search-outline" size={20} color={Colors.sage} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search moments, places..."
            placeholderTextColor="#8B9994"
            style={{
              flex: 1,
              height: 48,
              paddingHorizontal: 10,
              color: Colors.textPrimary,
              fontSize: 15,
            }}
          />
          <Pressable
            onPress={() => setFavoriteOnly((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={
              favoriteOnly ? "Show all memories" : "Show favorite memories"
            }
            style={{ padding: 7 }}
          >
            <Ionicons
              name={favoriteOnly ? "heart" : "heart-outline"}
              size={21}
              color={favoriteOnly ? "#D64555" : Colors.sage}
            />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
        >
          {[{ id: "all", name: "All" }, ...categories].map((category) => {
            const active = selectedCategory === String(category.id);
            return (
              <Pressable
                key={String(category.id)}
                onPress={() => setSelectedCategory(String(category.id))}
                style={{
                  paddingHorizontal: 15,
                  paddingVertical: 9,
                  borderRadius: 18,
                  backgroundColor: active ? Colors.forest : Colors.white,
                  borderWidth: 1,
                  borderColor: active ? Colors.forest : "#DCE7E2",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: active ? Colors.white : Colors.textPrimary,
                  }}
                >
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={{ paddingVertical: 54, alignItems: "center" }}>
            <ActivityIndicator size="large" color={Colors.forest} />
          </View>
        ) : filteredMemories.length === 0 ? (
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
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            {filteredMemories.map((memory) => {
              const imageUrl = getMemoryImage(memory);
              return (
                <View
                  key={String(memory.id)}
                  style={{
                    width: "48.5%",
                    overflow: "hidden",
                    borderRadius: 18,
                    marginBottom: 14,
                    backgroundColor: Colors.white,
                    borderWidth: 1,
                    borderColor: "#DCE7E2",
                  }}
                >
                  <View style={{ height: 158, backgroundColor: "#DDE9E4" }}>
                    {imageUrl ? (
                      <Image
                        source={{ uri: imageUrl }}
                        resizeMode="cover"
                        style={{ width: "100%", height: "100%" }}
                      />
                    ) : (
                      <View
                        style={{
                          flex: 1,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons
                          name={
                            memory.media_type === "video"
                              ? "videocam-outline"
                              : memory.media_type === "audio"
                                ? "musical-notes-outline"
                                : "book-outline"
                          }
                          size={36}
                          color={Colors.forest}
                        />
                      </View>
                    )}
                    <Pressable
                      onPress={() => void toggleFavorite(memory)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isFavorite(memory) ? "Remove favorite" : "Add favorite"
                      }
                      style={{
                        position: "absolute",
                        top: 9,
                        right: 9,
                        width: 34,
                        height: 34,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 17,
                        backgroundColor: "rgba(255,255,255,0.94)",
                      }}
                    >
                      <Ionicons
                        name={isFavorite(memory) ? "heart" : "heart-outline"}
                        size={19}
                        color={isFavorite(memory) ? "#D64555" : Colors.forest}
                      />
                    </Pressable>
                  </View>
                  <View style={{ padding: 12 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: Colors.textPrimary,
                        fontSize: 17,
                        fontWeight: "800",
                      }}
                    >
                      {memory.title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: Colors.olive,
                        fontSize: 11,
                        fontWeight: "700",
                        marginTop: 3,
                      }}
                    >
                      {memory.category_name || "General"}
                    </Text>
                    {memory.location ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginTop: 8,
                        }}
                      >
                        <Ionicons
                          name="location-outline"
                          size={13}
                          color={Colors.sage}
                        />
                        <Text
                          numberOfLines={1}
                          style={{
                            color: Colors.sage,
                            fontSize: 12,
                            marginLeft: 4,
                            flex: 1,
                          }}
                        >
                          {memory.location}
                        </Text>
                      </View>
                    ) : null}
                    <Text
                      style={{ color: Colors.sage, fontSize: 12, marginTop: 7 }}
                    >
                      {formatDate(memory.memory_date)}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "flex-end",
                        gap: 5,
                        marginTop: 9,
                      }}
                    >
                      <Pressable
                        onPress={() => openEditMemory(memory)}
                        accessibilityRole="button"
                        accessibilityLabel="Edit memory"
                        hitSlop={5}
                        style={{ padding: 6 }}
                      >
                        <Ionicons
                          name="create-outline"
                          size={19}
                          color={Colors.forest}
                        />
                      </Pressable>
                      <Pressable
                        onPress={() => handleDelete(memory)}
                        accessibilityRole="button"
                        accessibilityLabel="Delete memory"
                        hitSlop={5}
                        style={{ padding: 6 }}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={19}
                          color="#C84C4C"
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

      <Pressable
        onPress={openNewMemory}
        accessibilityRole="button"
        accessibilityLabel="Add memory"
        accessibilityHint="Opens the new memory form"
        style={{
          position: "absolute",
          right: 20,
          bottom: 88,
          width: 58,
          height: 58,
          borderRadius: 29,
          borderWidth: 2,
          borderColor: "#B8C0BC",
          backgroundColor: Colors.forest,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 7,
          elevation: 8,
        }}
      >
        <Ionicons name="add" size={30} color={Colors.white} />
      </Pressable>

      <Modal
        visible={editorVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditorVisible(false)}
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
              maxHeight: "92%",
              paddingHorizontal: 18,
              paddingTop: 18,
              paddingBottom: insets.bottom + 16,
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
                  fontSize: 22,
                  fontWeight: "800",
                  color: Colors.forest,
                }}
              >
                {editingId ? "Edit memory" : "New memory"}
              </Text>
              <Pressable
                onPress={() => setEditorVisible(false)}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Close editor"
                style={{ padding: 6 }}
              >
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
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
                placeholder="Give this memory a title"
              />
              <FormField
                label="Description"
                value={form.description}
                onChangeText={(value) => updateForm("description", value)}
                placeholder="What do you want to remember?"
                multiline
              />
              <Text style={fieldLabel}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 14 }}
              >
                {categories.map((category) => {
                  const selected = form.category_id === String(category.id);
                  return (
                    <Pressable
                      key={String(category.id)}
                      onPress={() =>
                        updateForm("category_id", String(category.id))
                      }
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 14,
                        backgroundColor: selected ? "#E5F1E9" : "#F4F6F4",
                        borderWidth: 1,
                        borderColor: selected ? Colors.sage : "#E3E9E5",
                      }}
                    >
                      <Text style={{ color: Colors.forest, fontWeight: "600" }}>
                        {category.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <FormField
                label="Date"
                value={form.memory_date}
                onChangeText={(value) => updateForm("memory_date", value)}
                placeholder="YYYY-MM-DD"
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
              <FormField
                label="Voice note"
                value={form.voice_note}
                onChangeText={(value) => updateForm("voice_note", value)}
                placeholder="Add a note or voice summary"
                multiline
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

              <Text style={fieldLabel}>Attachments</Text>
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
                <Text style={{ color: Colors.textPrimary, fontWeight: "600" }}>
                  Mark as favorite
                </Text>
              </Pressable>
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
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    <View style={{ marginBottom: 13 }}>
      <Text style={fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#899791"
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? "top" : "center"}
        style={{
          minHeight: multiline ? 88 : 46,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "#DFE7E2",
          backgroundColor: "#F8FAF8",
          color: Colors.textPrimary,
          fontSize: 15,
        }}
      />
    </View>
  );
}

const fieldLabel = {
  marginBottom: 7,
  color: Colors.sage,
  fontSize: 12,
  fontWeight: "700" as const,
  textTransform: "uppercase" as const,
};
