import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";
import api, { API_BASE_URL, getApiErrorMessage, logoutUser } from "../../api";
import { Colors } from "../../constants/colors";

type MemoryMedia = {
  id?: number | string;
  file_url?: string;
  url?: string;
  src?: string;
  path?: string;
  file_name?: string;
  name?: string;
  file_type?: string;
  type?: string;
};

type MemoryRecord = {
  id: number | string;
  title: string;
  description?: string;
  category_name?: string;
  status?: string;
  mood?: string;
  location?: string;
  memory_date?: string;
  is_favorite?: boolean | number | string;
  tags?: string[] | string;
  voice_note?: string;
  media_type?: string;
  media_url?: string;
  media_gallery?: (string | MemoryMedia)[];
  created_at?: string;
  updated_at?: string;
};

const mediaBaseUrl = API_BASE_URL.replace(/\/api\/?$/, "");

function isFavorite(value?: MemoryRecord["is_favorite"]) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function getMediaUrl(value?: string) {
  if (!value) return "";
  if (/^(https?:|file:|content:|data:)/i.test(value)) return value;
  return `${mediaBaseUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

function mediaUrlOf(item: string | MemoryMedia) {
  return getMediaUrl(
    typeof item === "string"
      ? item
      : item.file_url || item.url || item.src || item.path,
  );
}

function mediaName(item: string | MemoryMedia, index: number) {
  if (typeof item !== "string") {
    return item.file_name || item.name || `Attachment ${index + 1}`;
  }
  return item.split("/").pop() || `Attachment ${index + 1}`;
}

function mediaKind(item: string | MemoryMedia, fallback = "") {
  const type =
    typeof item === "string"
      ? fallback
      : String(item.file_type || item.type || fallback);
  const value = `${type} ${mediaName(item, 0)}`.toLowerCase();
  if (
    value.includes("image") ||
    /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(value)
  )
    return "image";
  if (value.includes("video") || /\.(mp4|webm|mov|m4v|mkv)(\?|$)/i.test(value))
    return "video";
  if (value.includes("audio") || /\.(mp3|wav|m4a|aac|ogg)(\?|$)/i.test(value))
    return "audio";
  return "file";
}

function parseTags(value?: string[] | string) {
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

function formatDate(value?: string) {
  if (!value) return "No date";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getGallery(memory: MemoryRecord) {
  const items = [...(memory.media_gallery || [])];
  if (memory.media_url) items.unshift(memory.media_url);
  const seen = new Set<string>();
  return items.filter((item) => {
    const url = mediaUrlOf(item);
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

export default function MemoryDetails() {
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [memory, setMemory] = useState<MemoryRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchMemory = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const response = await api.get(`/memories/${id}`);
        if (active) setMemory(response.data?.memory || response.data);
      } catch (error) {
        const status =
          (error as any)?.status || (error as any)?.response?.status;
        if (status === 401) {
          await logoutUser();
          if (active) router.replace("/auth/login");
          return;
        }
        if (active) {
          Alert.alert(
            "Unable to load memory",
            getApiErrorMessage(error, "Please try again."),
            [
              {
                text: "Back to memories",
                onPress: () => router.replace("/tabs/memories"),
              },
            ],
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchMemory();
    return () => {
      active = false;
    };
  }, [id, router]);

  const gallery = useMemo(() => (memory ? getGallery(memory) : []), [memory]);

  const toggleFavorite = async () => {
    if (!memory) return;
    const previous = isFavorite(memory.is_favorite);
    setMemory((current) =>
      current ? { ...current, is_favorite: !previous } : current,
    );
    try {
      await api.patch(`/memories/${memory.id}/favorite`);
    } catch (error) {
      setMemory((current) =>
        current ? { ...current, is_favorite: previous } : current,
      );
      const status = (error as any)?.status || (error as any)?.response?.status;
      if (status === 401) {
        await logoutUser();
        router.replace("/auth/login");
      } else {
        Alert.alert(
          "Unable to update favorite",
          getApiErrorMessage(error, "Please try again."),
        );
      }
    }
  };

  const deleteMemory = () => {
    if (!memory) return;
    Alert.alert("Delete memory", `Delete "${memory.title}" permanently?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/memories/${memory.id}`);
            router.replace("/tabs/memories");
          } catch (error) {
            const status =
              (error as any)?.status || (error as any)?.response?.status;
            if (status === 401) {
              await logoutUser();
              router.replace("/auth/login");
            } else {
              Alert.alert(
                "Unable to delete memory",
                getApiErrorMessage(error, "Please try again."),
              );
            }
          }
        },
      },
    ]);
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/tabs/memories");
  };

  if (loading) {
    return (
      <SafeAreaView
        edges={["top", "bottom"]}
        style={{ flex: 1, backgroundColor: Colors.contentBackground }}
      >
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color={Colors.forest} />
          <Text style={{ color: Colors.sage, marginTop: 12 }}>
            Loading memory...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!memory) return null;

  const favorite = isFavorite(memory.is_favorite);
  const tags = parseTags(memory.tags);
  const primaryItem: string | MemoryMedia | undefined = memory.media_url
    ? { file_url: memory.media_url, file_type: memory.media_type }
    : gallery[0];
  const primaryUrl = primaryItem ? mediaUrlOf(primaryItem) : "";
  const primaryKind = primaryItem
    ? mediaKind(primaryItem, memory.media_type)
    : "";
  const extraMedia = gallery.filter((item) => mediaUrlOf(item) !== primaryUrl);

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: Colors.contentBackground }}
    >
      <LinearGradient
        colors={[Colors.headerStart, Colors.headerEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 16, paddingVertical: 12 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Back to memories"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 8,
              paddingRight: 8,
            }}
          >
            <Ionicons name="arrow-back" size={21} color={Colors.white} />
            <Text
              style={{ color: Colors.white, fontSize: 15, fontWeight: "700" }}
            >
              Memories
            </Text>
          </Pressable>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <HeaderAction
              label={favorite ? "Remove favorite" : "Add favorite"}
              onPress={() => void toggleFavorite()}
            >
              <Ionicons
                name={favorite ? "heart" : "heart-outline"}
                size={19}
                color={favorite ? Colors.accent : Colors.white}
              />
            </HeaderAction>
            <HeaderAction label="Delete memory" onPress={deleteMemory}>
              <Ionicons name="trash-outline" size={19} color={Colors.white} />
            </HeaderAction>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 16,
          paddingBottom: insets.bottom + 28,
        }}
      >
        {primaryUrl && primaryKind === "image" ? (
          <ImageHero
            url={primaryUrl}
            title={memory.title}
            category={memory.category_name || "General"}
            status={memory.status || "published"}
          />
        ) : primaryUrl && primaryKind === "video" ? (
          <VideoAttachment url={primaryUrl} name={memory.title} hero />
        ) : primaryUrl && primaryKind === "audio" ? (
          <AudioAttachment url={primaryUrl} name={memory.title} hero />
        ) : (
          <LinearGradient
            colors={[Colors.primaryDark, Colors.headerStart]}
            style={{
              height: 230,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 17,
              marginBottom: 15,
            }}
          >
            <Ionicons
              name="book-outline"
              size={42}
              color="rgba(255,255,255,0.55)"
            />
            <Text
              style={{
                color: Colors.white,
                fontSize: 22,
                fontWeight: "800",
                marginTop: 10,
              }}
            >
              {memory.title}
            </Text>
          </LinearGradient>
        )}

        {primaryKind !== "image" ? (
          <View style={{ marginBottom: 15 }}>
            <MetaPills
              category={memory.category_name || "General"}
              status={memory.status || "published"}
            />
            <Text
              style={{
                color: Colors.textPrimary,
                fontSize: 25,
                fontWeight: "800",
                marginTop: 8,
              }}
            >
              {memory.title}
            </Text>
          </View>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 9,
            marginBottom: 14,
          }}
        >
          {memory.memory_date ? (
            <InfoItem
              icon="calendar-outline"
              label="Date"
              value={formatDate(memory.memory_date)}
            />
          ) : null}
          {memory.location ? (
            <InfoItem
              icon="location-outline"
              label="Location"
              value={memory.location}
            />
          ) : null}
          {memory.mood ? (
            <InfoItem icon="time-outline" label="Mood" value={memory.mood} />
          ) : null}
          <InfoItem
            icon="heart-outline"
            label="Favorite"
            value={favorite ? "Yes" : "No"}
          />
        </View>

        <View style={sectionCardStyle}>
          <Text style={sectionLabel}>About this memory</Text>
          <Text selectable style={bodyTextStyle}>
            {memory.description || "No description provided for this memory."}
          </Text>
        </View>

        {extraMedia.length ? (
          <View style={sectionCardStyle}>
            <Text style={sectionLabel}>Media and attachments</Text>
            <View style={{ gap: 12 }}>
              {extraMedia.map((item, index) => {
                const url = mediaUrlOf(item);
                const kind = mediaKind(item);
                const name = mediaName(item, index);
                if (!url) return null;
                return (
                  <AttachmentPreview
                    key={`${url}-${index}`}
                    url={url}
                    name={name}
                    kind={kind}
                  />
                );
              })}
            </View>
          </View>
        ) : null}

        {tags.length || memory.voice_note ? (
          <View style={sectionCardStyle}>
            {tags.length ? (
              <>
                <Text style={sectionLabel}>Tags</Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}
                >
                  {tags.map((tag, index) => (
                    <MetaPill key={`${tag}-${index}`} category={`#${tag}`} />
                  ))}
                </View>
              </>
            ) : null}
            {memory.voice_note ? (
              <View style={{ marginTop: tags.length ? 18 : 0 }}>
                <Text style={sectionLabel}>Voice note transcript</Text>
                <Text style={[bodyTextStyle, { fontStyle: "italic" }]}>
                  {memory.voice_note}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {memory.created_at || memory.updated_at ? (
          <View style={[sectionCardStyle, { marginBottom: 0 }]}>
            <Text style={sectionLabel}>Record details</Text>
            {memory.created_at ? (
              <Text style={smallDetailStyle}>
                Created: {formatDateTime(memory.created_at)}
              </Text>
            ) : null}
            {memory.updated_at ? (
              <Text style={[smallDetailStyle, { marginTop: 6 }]}>
                Last modified: {formatDateTime(memory.updated_at)}
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function HeaderAction({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 38,
        height: 38,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 19,
        backgroundColor: "rgba(255,255,255,0.14)",
      }}
    >
      {children}
    </Pressable>
  );
}

function ImageHero({
  url,
  title,
  category,
  status,
}: {
  url: string;
  title: string;
  category: string;
  status: string;
}) {
  return (
    <View
      style={{
        height: 270,
        overflow: "hidden",
        borderRadius: 17,
        marginBottom: 15,
        backgroundColor: "#DCE7E2",
      }}
    >
      <Image
        source={{ uri: url }}
        resizeMode="cover"
        style={{ width: "100%", height: "100%" }}
      />
      <LinearGradient
        colors={["transparent", "rgba(8,20,14,0.82)"]}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          justifyContent: "flex-end",
          padding: 18,
        }}
      >
        <MetaPills category={category} status={status} inverse />
        <Text
          numberOfLines={2}
          style={{
            color: Colors.white,
            fontSize: 24,
            fontWeight: "800",
            marginTop: 8,
          }}
        >
          {title}
        </Text>
      </LinearGradient>
    </View>
  );
}

function MetaPills({
  category,
  status,
  inverse = false,
}: {
  category: string;
  status: string;
  inverse?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
      <View
        style={{
          paddingHorizontal: 9,
          paddingVertical: 6,
          borderRadius: 14,
          backgroundColor: inverse ? "rgba(255,255,255,0.22)" : "#EAF2EC",
        }}
      >
        <Text
          style={{
            color: inverse ? Colors.white : Colors.forest,
            fontSize: 11,
            fontWeight: "700",
          }}
        >
          {category}
        </Text>
      </View>
      <View
        style={{
          paddingHorizontal: 9,
          paddingVertical: 6,
          borderRadius: 14,
          backgroundColor:
            status === "published"
              ? inverse
                ? "rgba(52,154,98,0.7)"
                : "#E6F4EB"
              : inverse
                ? "rgba(207,149,48,0.75)"
                : "#FFF2D9",
        }}
      >
        <Text
          style={{
            color: inverse ? Colors.white : Colors.textPrimary,
            fontSize: 11,
            fontWeight: "700",
          }}
        >
          {status}
        </Text>
      </View>
    </View>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: "46%",
        minHeight: 76,
        justifyContent: "center",
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#E0E8E3",
        backgroundColor: Colors.white,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name={icon} size={15} color={Colors.sage} />
        <Text style={{ color: Colors.sage, fontSize: 11 }}>{label}</Text>
      </View>
      <Text
        numberOfLines={2}
        style={{
          marginTop: 5,
          color: Colors.textPrimary,
          fontSize: 14,
          fontWeight: "700",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function AttachmentPreview({
  url,
  name,
  kind,
}: {
  url: string;
  name: string;
  kind: string;
}) {
  if (kind === "image")
    return (
      <View
        style={{
          overflow: "hidden",
          borderRadius: 12,
          backgroundColor: "#F2F5F3",
        }}
      >
        <Image
          source={{ uri: url }}
          resizeMode="contain"
          style={{ width: "100%", height: 220 }}
        />
        <Text numberOfLines={1} style={attachmentNameStyle}>
          {name}
        </Text>
      </View>
    );
  if (kind === "video") return <VideoAttachment url={url} name={name} />;
  if (kind === "audio") return <AudioAttachment url={url} name={name} />;
  return (
    <Pressable
      onPress={() => void Linking.openURL(url)}
      accessibilityRole="link"
      style={attachmentRowStyle}
    >
      <Ionicons name="document-text-outline" size={20} color={Colors.forest} />
      <Text
        numberOfLines={1}
        style={{ flex: 1, color: Colors.textPrimary, fontSize: 13 }}
      >
        {name}
      </Text>
      <Ionicons name="open-outline" size={18} color={Colors.sage} />
    </Pressable>
  );
}

function VideoAttachment({
  url,
  name,
  hero = false,
}: {
  url: string;
  name: string;
  hero?: boolean;
}) {
  const player = useVideoPlayer(url);
  return (
    <View
      style={{
        overflow: "hidden",
        borderRadius: hero ? 17 : 12,
        marginBottom: hero ? 15 : 0,
        backgroundColor: "#101915",
      }}
    >
      <VideoView
        player={player}
        nativeControls
        contentFit="contain"
        style={{ width: "100%", height: hero ? 270 : 220 }}
      />
      {!hero ? (
        <Text
          numberOfLines={1}
          style={[attachmentNameStyle, { backgroundColor: Colors.white }]}
        >
          {name}
        </Text>
      ) : null}
    </View>
  );
}

function AudioAttachment({
  url,
  name,
  hero = false,
}: {
  url: string;
  name: string;
  hero?: boolean;
}) {
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);
  const elapsed = `${Math.floor(status.currentTime / 60)}:${String(Math.floor(status.currentTime % 60)).padStart(2, "0")}`;
  return (
    <View
      style={[
        attachmentRowStyle,
        hero
          ? { minHeight: 150, marginBottom: 15, borderRadius: 17, padding: 18 }
          : null,
      ]}
    >
      <Pressable
        onPress={() => (status.playing ? player.pause() : player.play())}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? `Pause ${name}` : `Play ${name}`}
        style={{
          width: 46,
          height: 46,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 23,
          backgroundColor: Colors.forest,
        }}
      >
        <Ionicons
          name={status.playing ? "pause" : "play"}
          size={19}
          color={Colors.white}
        />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: "700" }}
        >
          {name}
        </Text>
        <Text style={{ color: Colors.sage, fontSize: 11, marginTop: 4 }}>
          {elapsed}
        </Text>
      </View>
      <Ionicons name="musical-notes-outline" size={21} color={Colors.sage} />
    </View>
  );
}

function MetaPill({ category }: { category: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: "#EAF2EC",
      }}
    >
      <Ionicons name="pricetag-outline" size={12} color={Colors.forest} />
      <Text style={{ color: Colors.forest, fontSize: 11, fontWeight: "600" }}>
        {category}
      </Text>
    </View>
  );
}

const sectionCardStyle = {
  marginBottom: 14,
  padding: 16,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "#E0E8E3",
  backgroundColor: Colors.white,
};
const sectionLabel = {
  marginBottom: 10,
  color: Colors.sage,
  fontSize: 11,
  fontWeight: "700" as const,
  textTransform: "uppercase" as const,
};
const bodyTextStyle = { color: "#475A53", fontSize: 15, lineHeight: 23 };
const smallDetailStyle = { color: Colors.textPrimary, fontSize: 13 };
const attachmentNameStyle = {
  paddingHorizontal: 10,
  paddingVertical: 8,
  color: Colors.textPrimary,
  fontSize: 12,
};
const attachmentRowStyle = {
  minHeight: 64,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 10,
  padding: 10,
  borderRadius: 12,
  backgroundColor: "#F3F7F4",
};
