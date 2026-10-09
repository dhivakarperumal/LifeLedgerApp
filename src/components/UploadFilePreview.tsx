import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { VideoView, useVideoPlayer } from "expo-video";
import { Image, Pressable, Text, View } from "react-native";

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);

  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="cover"
      style={{ width: 96, height: 64, borderRadius: 8 }}
    />
  );
}

function AudioPreview({ uri, name }: { uri: string; name: string }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={status.playing ? `Pause ${name}` : `Play ${name}`}
      accessibilityState={{ disabled: !status.isLoaded || Boolean(status.error) }}
      disabled={!status.isLoaded || Boolean(status.error)}
      onPress={() => (status.playing ? player.pause() : player.play())}
      className="h-16 w-16 items-center justify-center rounded-lg bg-[#366039]"
    >
      <Ionicons
        name={status.playing ? "pause" : "play"}
        size={24}
        color="#FFFFFF"
      />
    </Pressable>
  );
}

export function UploadFilePreview({
  uri,
  name,
  mimeType,
  onOpen,
  onRemove,
  removeLabel,
}: {
  uri: string;
  name: string;
  mimeType?: string;
  onOpen: () => void;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const imageExtension = /\.(png|jpe?g|gif|webp)(?:[?#]|$)/i;
  const videoExtension = /\.(mp4|webm|mov|m4v|ogv|avi|mkv)(?:[?#]|$)/i;
  const audioExtension = /\.(mp3|wav|m4a|aac|ogg|flac|amr|opus|3gp)(?:[?#]|$)/i;
  const fileMimeType = mimeType?.toLowerCase() || "";
  const isImage =
    fileMimeType.startsWith("image/") ||
    imageExtension.test(name) ||
    imageExtension.test(uri);
  const isVideo =
    !isImage &&
    (fileMimeType.startsWith("video/") ||
      videoExtension.test(name) ||
      videoExtension.test(uri));
  const isAudio =
    !isImage &&
    !isVideo &&
    (fileMimeType.startsWith("audio/") ||
      audioExtension.test(name) ||
      audioExtension.test(uri));
  const previewLabel = isImage
    ? "Image preview"
    : isVideo
      ? "Video preview"
      : isAudio
        ? "Audio preview"
        : "Document preview";

  return (
    <View className="mb-3 flex-row items-center rounded-xl border border-[#DDE5DD] bg-white p-3">
      {isImage ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Preview ${name}`}
          onPress={onOpen}
        >
          <Image
            source={{ uri }}
            className="h-16 w-16 rounded-lg bg-[#EEF3E9]"
            resizeMode="cover"
            accessibilityLabel={`${name} preview`}
          />
        </Pressable>
      ) : isVideo ? (
        <VideoPreview uri={uri} />
      ) : isAudio ? (
        <AudioPreview uri={uri} name={name} />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${name}`}
          onPress={onOpen}
          className="h-16 w-16 items-center justify-center rounded-lg bg-[#EEF3E9]"
        >
          <Ionicons name="document-text-outline" size={28} color="#426C92" />
          <Text className="mt-1 text-[9px] font-bold uppercase text-[#526058]">
            {fileMimeType === "application/pdf" || /\.pdf(?:[?#]|$)/i.test(name)
              ? "PDF"
              : "FILE"}
          </Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${name}`}
        onPress={onOpen}
        className="ml-3 min-w-0 flex-1 flex-row items-center"
      >
        <View className="min-w-0 flex-1">
          <Text
            className="text-xs font-semibold text-[#526058]"
            numberOfLines={2}
          >
            {name}
          </Text>
          <Text className="mt-1 text-[10px] text-[#7B8580]">
            {previewLabel}
          </Text>
        </View>
        <Ionicons name="open-outline" size={16} color="#7B8580" />
      </Pressable>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={removeLabel || "Remove file"}
          onPress={onRemove}
          className="ml-2 p-1"
        >
          <Ionicons name="close-circle" size={20} color="#B64C45" />
        </Pressable>
      ) : null}
    </View>
  );
}