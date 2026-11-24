import Ionicons from "@expo/vector-icons/Ionicons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ExpoLinking from "expo-linking";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Pressable,
    RefreshControl,
    Share,
    ScrollView,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api, { API_BASE_URL, getApiErrorMessage, logoutUser } from "../../api";
import { AttachmentFileActions } from "../../components/AttachmentFileActions";
import ConfirmPopup from "../../components/ConfirmPopup";
import { parseLocalDate } from "../../components/dateTimeUtils";
import { GradientSafeAreaView as SafeAreaView } from "../../components/GradientSafeAreaView";
import { PageHeader } from "../../components/PageHeader";
import { Colors } from "../../constants/colors";

type DiaryMedia = {
  id?: number | string;
  file_url?: string;
  url?: string;
  src?: string;
  path?: string;
  file_path?: string;
  file_name?: string;
  filename?: string;
  name?: string;
  file_type?: string;
  mime_type?: string;
  mimeType?: string;
  media_type?: string;
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
  images?: (string | DiaryMedia)[];
  videos?: (string | DiaryMedia)[];
  audio?: (string | DiaryMedia)[];
  media_url?: string;
  media_type?: string;
  image_path?: string;
  video_path?: string;
  audio_path?: string;
  file_path?: string;
};

type AttachmentCategory = "images" | "videos" | "audio" | "zip" | "files";
type MediaTabId = "personal" | "all" | AttachmentCategory;
type DiaryAttachment = {
  media: string | DiaryMedia;
  url: string;
  fileName: string;
  category: AttachmentCategory;
  kind: string;
};
const mediaCategoryOptions: {
  id: AttachmentCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "images", label: "Images", icon: "image-outline" },
  { id: "videos", label: "Videos", icon: "videocam-outline" },
  { id: "audio", label: "Audio", icon: "musical-notes-outline" },
  { id: "zip", label: "ZIP", icon: "archive-outline" },
  { id: "files", label: "Files", icon: "document-text-outline" },
];

const mediaBaseUrl = API_BASE_URL.replace(/\/api\/?$/, "");

function booleanValue(value: DiaryDetailsEntry["is_favorite"]) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = parseLocalDate(value);
  if (!date) return value;
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
      : item.file_url || item.url || item.src || item.path || item.file_path,
  );
}

function mediaName(item: string | DiaryMedia, index: number) {
  if (typeof item !== "string") {
    return (
      item.file_name || item.filename || item.name || `Attachment ${index + 1}`
    );
  }
  return item.split("/").pop() || `Attachment ${index + 1}`;
}

function mediaType(item: string | DiaryMedia) {
  const type =
    typeof item === "string"
      ? ""
      : String(
          item.file_type ||
            item.mime_type ||
            item.mimeType ||
            item.media_type ||
            item.type ||
            "",
        );
  const source =
    typeof item === "string"
      ? item
      : `${type} ${mediaName(item, 0)} ${mediaUrlFor(item)}`;
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
  if (value.includes("zip") || /\.(zip|rar|7z)(\?|$)/i.test(value))
    return "archive";
  return "file";
}

function getAttachmentCategory(
  media: string | DiaryMedia,
  fallback?: AttachmentCategory,
): AttachmentCategory {
  if (fallback) return fallback;
  const kind = mediaType(media);
  if (kind === "image") return "images";
  if (kind === "video") return "videos";
  if (kind === "audio") return "audio";
  if (kind === "archive") return "zip";
  return "files";
}

function getAttachments(entry: DiaryDetailsEntry): DiaryAttachment[] {
  const sources: {
    media: string | DiaryMedia;
    category?: AttachmentCategory;
  }[] = [
    ...(entry.images || []).map((media) => ({ media, category: "images" as const })),
    ...(entry.videos || []).map((media) => ({ media, category: "videos" as const })),
    ...(entry.audio || []).map((media) => ({ media, category: "audio" as const })),
    ...(entry.attachments || []).map((media) => ({ media })),
    ...(entry.media_files || []).map((media) => ({ media })),
    ...(entry.image_path ? [{ media: entry.image_path, category: "images" as const }] : []),
    ...(entry.video_path ? [{ media: entry.video_path, category: "videos" as const }] : []),
    ...(entry.audio_path ? [{ media: entry.audio_path, category: "audio" as const }] : []),
    ...(entry.file_path ? [{ media: entry.file_path, category: "files" as const }] : []),
    ...(entry.media_url ? [{ media: { file_url: entry.media_url, file_type: entry.media_type } }] : []),
  ];
  const seen = new Set<string>();

  return sources.reduce<DiaryAttachment[]>((result, { media, category }, index) => {
    const url = mediaUrlFor(media);
    if (!url || seen.has(url)) return result;
    seen.add(url);
    const kind = category
      ? category === "images"
        ? "image"
        : category === "videos"
          ? "video"
          : category === "audio"
            ? "audio"
            : category === "zip"
              ? "archive"
              : "file"
      : mediaType(media);
    result.push({
      media,
      url,
      fileName: mediaName(media, index),
      category: getAttachmentCategory(media, category),
      kind,
    });
    return result;
  }, []);
}

export default function DiaryDetails() {
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [entry, setEntry] = useState<DiaryDetailsEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [activeMediaTab, setActiveMediaTab] = useState<MediaTabId>("personal");

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
  const mediaTabs: {
    id: MediaTabId;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    count?: number;
  }[] = [
    { id: "personal", label: "Personal", icon: "book-outline" },
    ...(attachments.length
      ? [
          {
            id: "all" as const,
            label: "All",
            icon: "document-text-outline" as const,
            count: attachments.length,
          },
          ...mediaCategoryOptions
            .map((category) => ({
              ...category,
              count: attachments.filter(
                (attachment) => attachment.category === category.id,
              ).length,
            }))
            .filter((category) => category.count > 0),
        ]
      : []),
  ];
  const selectedTab = mediaTabs.some((tab) => tab.id === activeMediaTab)
    ? activeMediaTab
    : "personal";
  const selectedMediaItems =
    selectedTab === "all"
      ? attachments
      : selectedTab === "personal"
        ? []
        : attachments.filter(
            (attachment) => attachment.category === selectedTab,
          );
  const coverImageUrl =
    attachments.find((attachment) => attachment.category === "images")?.url ||
    "";

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
    setShowDeletePopup(true);
  };

  const shareEntry = async () => {
    if (!entry) return;
    const content = plainContent(entry.content);
    const url = ExpoLinking.createURL(
      `diary/${encodeURIComponent(String(entry.id))}`,
    );
    try {
      await Share.share({
        title: entry.title,
        message: `${entry.title}${content ? `\n\n${content}` : ""}\n\n${url}`,
      });
    } catch (error) {
      Alert.alert(
        "Unable to share diary entry",
        getApiErrorMessage(error, "Please try again."),
      );
    }
  };

  const confirmDeleteEntry = async () => {
    if (!entry) return;
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
  };

  const editEntry = () => {
    if (entry) {
      router.push({
        pathname: "/diary-form" as any,
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
        edges={["bottom"]}
        style={{ flex: 1, backgroundColor: Colors.contentBackground }}
      >
        <PageHeader title="Diary" onBack={goBack} accessibilityLabel="Back to diary" />
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
      edges={["bottom"]}
      style={{ flex: 1, backgroundColor: Colors.contentBackground }}
    >
      <ConfirmPopup
        visible={showDeletePopup}
        type="delete"
        message={`Delete "${entry.title}"?`}
        onConfirm={confirmDeleteEntry}
        onCancel={() => setShowDeletePopup(false)}
      />
      <PageHeader
        title="Diary"
        onBack={goBack}
        accessibilityLabel="Back to diary"
        right={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <HeaderAction label="Share diary entry" onPress={() => void shareEntry()}>
              <Ionicons
                name="share-social-outline"
                size={19}
                color={Colors.white}
              />
            </HeaderAction>
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
        }
      />

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
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: insets.bottom + 30,
        }}
      >
        <View
          style={{
            minHeight: 224,
            justifyContent: "flex-end",
            overflow: "hidden",
            marginBottom: 14,
            padding: 18,
            borderRadius: 22,
            backgroundColor: "#234836",
          }}
        >
          {coverImageUrl ? (
            <Image
              source={{ uri: coverImageUrl }}
              resizeMode="cover"
              style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
            />
          ) : null}
          <LinearGradient
            colors={
              coverImageUrl
                ? ["#00000000", "#000000B8"]
                : Colors.greenGradient
            }
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 9 }}>
            {[entry.category_name || "General", entry.status || "published", entry.mood || "Normal"].map(
              (label, index) => (
                <Text
                  key={`${label}-${index}`}
                  style={{
                    overflow: "hidden",
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 14,
                    backgroundColor: "rgba(255,255,255,0.2)",
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  {label}
                </Text>
              ),
            )}
          </View>
          <Text
            style={{
              color: Colors.white,
              fontSize: 27,
              fontWeight: "800",
              textShadowColor: "rgba(0,0,0,0.35)",
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 5,
            }}
          >
            {entry.title}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 14 }}
          accessibilityRole="tablist"
          accessibilityLabel="Diary detail categories"
        >
          {mediaTabs.map((tab) => {
            const isActive = tab.id === selectedTab;
            return (
              <Pressable
                key={tab.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                onPress={() => setActiveMediaTab(tab.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 7,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 14,
                  backgroundColor: isActive ? Colors.forest : Colors.white,
                  borderWidth: 1,
                  borderColor: isActive ? Colors.forest : "#E0E8E3",
                }}
              >
                <Ionicons
                  name={tab.icon}
                  size={15}
                  color={isActive ? Colors.white : Colors.textSecondary}
                />
                <Text
                  style={{
                    color: isActive ? Colors.white : Colors.textSecondary,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {tab.label}
                </Text>
                {tab.count !== undefined ? (
                  <Text
                    style={{
                      color: isActive ? Colors.white : Colors.sage,
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    {tab.count}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {selectedTab === "personal" ? (
          <>
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
          </>
        ) : (
          <View
            style={{
              padding: 16,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#E0E8E3",
              backgroundColor: Colors.white,
            }}
          >
            <Text style={sectionLabel}>
              {mediaTabs.find((tab) => tab.id === selectedTab)?.label || "Media"}
            </Text>
            <View style={{ gap: 12 }}>
              {selectedMediaItems.map((attachment, index) => (
                <AttachmentPreview
                  key={`${attachment.url}-${index}`}
                  url={attachment.url}
                  name={attachment.fileName}
                  kind={attachment.kind}
                />
              ))}
            </View>
          </View>
        )}
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
        <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>
          <AttachmentFileActions url={url} name={name} />
        </View>
      </View>
    );
  }
  if (kind === "video") return <VideoAttachment url={url} name={name} />;
  if (kind === "audio") return <AudioAttachment url={url} name={name} />;
  return (
    <View>
      <Pressable
        onPress={() => void Linking.openURL(url)}
        accessibilityRole="link"
        style={attachmentRowStyle}
      >
        <Ionicons
          name={kind === "archive" ? "archive-outline" : "document-text-outline"}
          size={20}
          color={Colors.forest}
        />
        <Text
          numberOfLines={1}
          style={{ flex: 1, color: Colors.textPrimary, fontSize: 13 }}
        >
          {name}
        </Text>
        <Ionicons name="open-outline" size={18} color={Colors.sage} />
      </Pressable>
      <AttachmentFileActions url={url} name={name} />
    </View>
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
      <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>
        <AttachmentFileActions url={url} name={name} />
      </View>
    </View>
  );
}

function AudioAttachment({ url, name }: { url: string; name: string }) {
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);
  const elapsed = `${Math.floor(status.currentTime / 60)}:${String(Math.floor(status.currentTime % 60)).padStart(2, "0")}`;
  return (
    <View>
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
      <AttachmentFileActions url={url} name={name} />
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
