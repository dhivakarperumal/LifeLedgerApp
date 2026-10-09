import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, Text, View } from "react-native";

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
  const isImage =
    mimeType?.toLowerCase().startsWith("image/") ||
    imageExtension.test(name) ||
    imageExtension.test(uri);

  return (
    <View className="mb-3 flex-row items-center rounded-xl border border-[#DDE5DD] bg-white p-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Preview ${name}`}
        onPress={onOpen}
        className="min-w-0 flex-1 flex-row items-center"
      >
        {isImage ? (
          <Image
            source={{ uri }}
            className="h-16 w-16 rounded-lg bg-[#EEF3E9]"
            resizeMode="cover"
            accessibilityLabel={`${name} preview`}
          />
        ) : (
          <View className="h-16 w-16 items-center justify-center rounded-lg bg-[#EEF3E9]">
            <Ionicons name="document-text-outline" size={28} color="#426C92" />
            <Text className="mt-1 text-[9px] font-bold uppercase text-[#526058]">
              {mimeType === "application/pdf" || /\.pdf(?:[?#]|$)/i.test(name)
                ? "PDF"
                : "FILE"}
            </Text>
          </View>
        )}
        <View className="ml-3 min-w-0 flex-1">
          <Text
            className="text-xs font-semibold text-[#526058]"
            numberOfLines={2}
          >
            {name}
          </Text>
          <Text className="mt-1 text-[10px] text-[#7B8580]">
            {isImage ? "Image preview" : "Document preview"}
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