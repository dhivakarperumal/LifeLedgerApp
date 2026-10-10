import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  Share,
  Text,
  View,
} from "react-native";
import { getStoredToken } from "../api";
import { Colors } from "../constants/colors";

type AttachmentFileActionsProps = {
  url: string;
  name: string;
};

function safeFileName(name: string) {
  return (
    name
      .split(/[?#]/, 1)[0]
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
      .trim() || "attachment"
  );
}

function fileExtension(name: string) {
  return name.split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase();
}

function mimeTypeFor(name: string) {
  const extension = fileExtension(name);
  const mimeTypes: Record<string, string> = {
    aac: "audio/aac",
    bmp: "image/bmp",
    gif: "image/gif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    m4a: "audio/mp4",
    mkv: "video/x-matroska",
    mov: "video/quicktime",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    ogg: "audio/ogg",
    png: "image/png",
    rar: "application/vnd.rar",
    svg: "image/svg+xml",
    wav: "audio/wav",
    webm: "video/webm",
    webp: "image/webp",
    zip: "application/zip",
    "7z": "application/x-7z-compressed",
  };
  return (extension && mimeTypes[extension]) || "application/octet-stream";
}

function utiFor(name: string) {
  const extension = fileExtension(name);
  const utis: Record<string, string> = {
    gif: "com.compuserve.gif",
    jpeg: "public.jpeg",
    jpg: "public.jpeg",
    mov: "com.apple.quicktime-movie",
    mp3: "public.mp3",
    mp4: "public.mpeg-4",
    pdf: "com.adobe.pdf",
    png: "public.png",
    svg: "public.svg-image",
    wav: "com.microsoft.waveform-audio",
    webm: "org.webmproject.webm",
    webp: "org.webmproject.webp",
    zip: "public.zip-archive",
  };
  return (extension && utis[extension]) || "public.data";
}

async function downloadAttachment(url: string, name: string, directory: typeof Paths.cache | typeof Paths.document) {
  const token = await getStoredToken();
  const file = await File.downloadFileAsync(
    url,
    new File(directory, safeFileName(name)),
    {
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      idempotent: true,
    },
  );
  if (!file.exists) throw new Error("The attachment download did not complete.");
  return file;
}

function ActionButton({
  label,
  icon,
  color,
  backgroundColor,
  borderColor,
  onPress,
  disabled,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  backgroundColor: string;
  borderColor: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        minHeight: 46,
        paddingHorizontal: 14,
        borderRadius: 13,
        borderWidth: 1,
        borderColor,
        backgroundColor,
        opacity: disabled ? 0.55 : pressed ? 0.72 : 1,
      })}
    >
      <View
        style={{
          width: 28,
          height: 28,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 9,
          backgroundColor: Colors.white,
        }}
      >
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={{ color, fontSize: 13, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function AttachmentFileActions({
  url,
  name,
}: AttachmentFileActionsProps) {
  const [busy, setBusy] = useState<"download" | "share" | null>(null);

  const handleDownload = async () => {
    setBusy("download");
    try {
      if (Platform.OS === "web") {
        await Linking.openURL(url);
        return;
      }
      await downloadAttachment(url, name, Paths.document);
      Alert.alert("Download complete", `${name} was saved to this device.`);
    } catch (error) {
      Alert.alert(
        "Unable to download attachment",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    setBusy("share");
    try {
      if (Platform.OS === "web") {
        await Share.share({ title: name, message: url, url });
        return;
      }
      const file = await downloadAttachment(url, name, Paths.cache);
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Sharing unavailable", "This device cannot share files.");
        return;
      }
      await Sharing.shareAsync(file.uri, {
        dialogTitle: `Share ${name}`,
        mimeType: mimeTypeFor(name),
        UTI: utiFor(name),
      });
    } catch (error) {
      Alert.alert(
        "Unable to share attachment",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
      <ActionButton
        label={busy === "download" ? "Downloading…" : "Download"}
        icon="download-outline"
        color={Colors.forest}
        backgroundColor="#EAF2EC"
        borderColor="#D6E5D9"
        onPress={() => void handleDownload()}
        disabled={busy !== null}
      />
      <ActionButton
        label={busy === "share" ? "Preparing…" : "Share"}
        icon="share-social-outline"
        color="#315D8A"
        backgroundColor="#EDF4FA"
        borderColor="#D8E5F0"
        onPress={() => void handleShare()}
        disabled={busy !== null}
      />
    </View>
  );
}
