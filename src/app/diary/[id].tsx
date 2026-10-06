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
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api, { API_BASE_URL, getApiErrorMessage, logoutUser } from "../../api";
import { GradientSafeAreaView as SafeAreaView } from "../../components/GradientSafeAreaView";
import { Colors } from "../../constants/colors";

type DiaryMedia = {
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

type DiaryDetailsEntry = {
  id: number | string;
  title: string;
  content?: string;
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
  created_at?: string;
  updated_at?: string;
  attachments?: (string | DiaryMedia)[];
  media_files?: (string | DiaryMedia)[];
  image_path?: string;
  video_path?: string;
  audio_path?: string;
  file_path?: string;
};

const mediaBaseUrl = API_BASE_URL.replace(/\/api\/?$/, "");

function booleanValue(value: DiaryDetailsEntry["is_favorite"]) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function formatDate(value?: string) {
  if (!value) return "—";
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

function mediaUrl(value?: string) {
  if (!value) return "";
  if (/^(https?:|file:|content:|data:)/i.test(value)) return value;
  return `${mediaBaseUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

function mediaUrlFor(item: string | DiaryMedia) {
  return mediaUrl(
    typeof item === "string"
      ? item
      : item.file_url || item.url || item.src || item.path,
  );
}

function mediaName(item: string | DiaryMedia, index: number) {
  if (typeof item !== "string") {
    return item.file_name || item.name || `Attachment ${index + 1}`;
  }
  return item.split("/").pop() || `Attachment ${index + 1}`;
}

function mediaType(item: string | DiaryMedia) {
  const type =
    typeof item === "string" ? "" : String(item.file_type || item.type || "");
  const source =
    typeof item === "string" ? item : `${type} ${mediaName(item, 0)}`;
  const value = source.toLowerCase();
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

function getAttachments(entry: DiaryDetailsEntry): (string | DiaryMedia)[] {
  const listed = [...(entry.attachments || []), ...(entry.media_files || [])];
  if (listed.length) {
    const seen = new Set<string>();
    return listed.filter((item) => {
      const key = `${mediaUrlFor(item)}|${mediaName(item, 0)}`;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return [
    entry.image_path,
    entry.video_path,
    entry.audio_path,
    entry.file_path,
  ].filter((value): value is string => Boolean(value));
}

export default function DiaryDetails() {
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [entry, setEntry] = useState<DiaryDetailsEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    const fetchEntry = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const response = await api.get(`/diary/${id}`);
        if (active) {
          setEntry(
            response.data?.entry || response.data?.diary || response.data,
          );
        }
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
            "Unable to load diary entry",
            getApiErrorMessage(error, "Please try again."),
            [
              {
                text: "Back to diary",
                onPress: () => router.replace("/tabs/diary"),
              },
            ],
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchEntry();
    return () => {
      active = false;
    };
  }, [id, refreshKey, router]);

  const attachments = useMemo(
    () => (entry ? getAttachments(entry) : []),
    [entry],
  );

  const toggleFavorite = async () => {
    if (!entry) return;
    const previous = booleanValue(entry.is_favorite);
    setEntry((current) =>
      current ? { ...current, is_favorite: !previous } : current,
    );
    try {
      await api.patch(`/diary/${entry.id}/favorite`);
    } catch (error) {
      setEntry((current) =>
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

  const deleteEntry = () => {
    if (!entry) return;
    Alert.alert("Delete diary entry", `Delete "${entry.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/diary/${entry.id}`);
            router.replace("/tabs/diary");
          } catch (error) {
            const status =
              (error as any)?.status || (error as any)?.response?.status;
            if (status === 401) {
              await logoutUser();
              router.replace("/auth/login");
            } else {
              Alert.alert(
                "Unable to delete diary entry",
                getApiErrorMessage(error, "Please try again."),
              );
            }
          }
        },
      },
    ]);
  };

  const editEntry = () => {
    if (entry) {
      router.replace({
        pathname: "/tabs/diary",
        params: { edit: String(entry.id) },
      });
    }
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/tabs/diary");
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
            Loading diary entry...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!entry) return null;

  const favorite = booleanValue(entry.is_favorite);
  const tags = parseTags(entry.tags);

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: Colors.contentBackground }}
    >
      <LinearGradient
        colors={Colors.greenGradient}
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
            accessibilityLabel="Back to diary"
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
              Diary
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
            <HeaderAction label="Edit entry" onPress={editEntry}>
              <Ionicons name="create-outline" size={19} color={Colors.white} />
            </HeaderAction>
            <HeaderAction label="Delete entry" onPress={deleteEntry}>
              <Ionicons name="trash-outline" size={19} color={Colors.white} />
            </HeaderAction>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => setRefreshKey((current) => current + 1)}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 18,
          paddingBottom: insets.bottom + 30,
        }}
      >
        <View style={{ marginBottom: 16 }}>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 7,
              marginBottom: 9,
            }}
          >
            <MetaPill
              label={entry.category_name || "General"}
              icon="pricetag-outline"
            />
            <MetaPill
              label={entry.status || "published"}
              icon="bookmark-outline"
            />
            <MetaPill label={entry.mood || "Normal"} icon="happy-outline" />
          </View>
          <Text
            style={{
              color: Colors.textPrimary,
              fontSize: 27,
              fontWeight: "800",
            }}
          >
            {entry.title}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 9,
            marginBottom: 17,
          }}
        >
          <InfoItem
            icon="calendar-outline"
            label="Date"
            value={formatDate(entry.entry_date)}
          />
          <InfoItem
            icon="time-outline"
            label="Time"
            value={entry.entry_time || "Not set"}
          />
          <InfoItem
            icon="location-outline"
            label="Location"
            value={entry.location || "No location"}
          />
          <InfoItem
            icon="heart-outline"
            label="Favorite"
            value={favorite ? "Yes" : "No"}
          />
        </View>

        <View
          style={{
            marginBottom: 14,
            padding: 16,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#E0E8E3",
            backgroundColor: Colors.white,
          }}
        >
          <Text style={sectionLabel}>Diary entry</Text>
          <Text
            selectable
            style={{ color: "#475A53", fontSize: 15, lineHeight: 23 }}
          >
            {plainContent(entry.content) || "No content provided."}
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
          <InfoItem
            icon="eye-off-outline"
            label="Private"
            value={booleanValue(entry.is_private) ? "Yes" : "No"}
          />
          <InfoItem
            icon="lock-closed-outline"
            label="Locked"
            value={booleanValue(entry.is_locked) ? "Yes" : "No"}
          />
        </View>

        <View
          style={{
            marginBottom: 14,
            padding: 16,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#E0E8E3",
            backgroundColor: Colors.white,
          }}
        >
          <Text style={sectionLabel}>Tags</Text>
          {tags.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
              {tags.map((tag, index) => (
                <MetaPill
                  key={`${tag}-${index}`}
                  label={tag}
                  icon="pricetag-outline"
                />
              ))}
            </View>
          ) : (
            <Text style={{ color: Colors.sage, fontSize: 13 }}>
              No tags added.
            </Text>
          )}
        </View>

        <View
          style={{
            marginBottom: 14,
            padding: 16,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#E0E8E3",
            backgroundColor: Colors.white,
          }}
        >
          <Text style={sectionLabel}>Record details</Text>
          <Text style={detailText}>
            Created: {formatDateTime(entry.created_at)}
          </Text>
          <Text style={[detailText, { marginTop: 7 }]}>
            Updated: {formatDateTime(entry.updated_at)}
          </Text>
        </View>

        {attachments.length > 0 ? (
          <View
            style={{
              padding: 16,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#E0E8E3",
              backgroundColor: Colors.white,
            }}
          >
            <Text style={sectionLabel}>Media and attachments</Text>
            <View style={{ gap: 12 }}>
              {attachments.map((item, index) => {
                const url = mediaUrlFor(item);
                const kind = mediaType(item);
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
        <Text style={{ color: Colors.sage, fontSize: 12 }}>{label}</Text>
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

function MetaPill({
  label,
  icon,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
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
      <Ionicons name={icon} size={12} color={Colors.forest} />
      <Text style={{ color: Colors.forest, fontSize: 12, fontWeight: "600" }}>
        {label}
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
  if (kind === "image") {
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
          style={{ width: "100%", height: 230 }}
        />
        <Text numberOfLines={1} style={attachmentNameStyle}>
          {name}
        </Text>
      </View>
    );
  }
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

function VideoAttachment({ url, name }: { url: string; name: string }) {
  const player = useVideoPlayer(url);
  return (
    <View
      style={{
        overflow: "hidden",
        borderRadius: 12,
        backgroundColor: "#101915",
      }}
    >
      <VideoView
        player={player}
        nativeControls
        contentFit="contain"
        style={{ width: "100%", height: 230 }}
      />
      <Text
        numberOfLines={1}
        style={[attachmentNameStyle, { backgroundColor: Colors.white }]}
      >
        {name}
      </Text>
    </View>
  );
}

function AudioAttachment({ url, name }: { url: string; name: string }) {
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);
  const elapsed = `${Math.floor(status.currentTime / 60)}:${String(Math.floor(status.currentTime % 60)).padStart(2, "0")}`;
  return (
    <View style={attachmentRowStyle}>
      <Pressable
        onPress={() => (status.playing ? player.pause() : player.play())}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? `Pause ${name}` : `Play ${name}`}
        style={{
          width: 40,
          height: 40,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 20,
          backgroundColor: Colors.forest,
        }}
      >
        <Ionicons
          name={status.playing ? "pause" : "play"}
          size={18}
          color={Colors.white}
        />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{ color: Colors.textPrimary, fontSize: 13, fontWeight: "600" }}
        >
          {name}
        </Text>
        <Text style={{ marginTop: 3, color: Colors.sage, fontSize: 12 }}>
          {elapsed}
        </Text>
      </View>
    </View>
  );
}

const sectionLabel = {
  marginBottom: 10,
  color: Colors.sage,
  fontSize: 12,
  fontWeight: "700" as const,
  textTransform: "uppercase" as const,
};
const detailText = { color: Colors.textPrimary, fontSize: 13 };
const attachmentNameStyle = {
  paddingHorizontal: 10,
  paddingVertical: 8,
  color: Colors.textPrimary,
  fontSize: 12,
};
const attachmentRowStyle = {
  minHeight: 60,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 10,
  padding: 10,
  borderRadius: 12,
  backgroundColor: "#F3F7F4",
};
