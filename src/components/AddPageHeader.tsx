import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../constants/colors";

export function AddPageHeader({
  title,
  subtitle,
  rightContent,
  onBack,
  horizontalInset = 20,
  disabled = false,
  compact = false,
  topInsetAlreadyApplied = false,
}: {
  title: string;
  subtitle?: string;
  rightContent?: ReactNode;
  onBack: () => void;
  horizontalInset?: number;
  disabled?: boolean;
  compact?: boolean;
  topInsetAlreadyApplied?: boolean;
}) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={Colors.greenGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        marginHorizontal: -horizontalInset,
        marginBottom: compact ? 8 : 15,
        paddingHorizontal: horizontalInset,
        paddingTop: compact
          ? 8
          : topInsetAlreadyApplied
            ? 8
            : Math.max(14, insets.top + 8),
        paddingBottom: compact ? 8 : 12,
        gap: 4,
      }}
    >
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityState={{ disabled }}
          className={`${compact ? "h-8 w-8" : "h-10 w-10"} items-center justify-center rounded-full ${
            compact ? "bg-white" : "border border-[#E6EBE7] bg-white"
          }`}
          disabled={disabled}
          onPress={onBack}
        >
          <ArrowLeft size={20} color="#25332C" strokeWidth={2.2} />
        </Pressable>
        <Text
          className={`min-w-0 flex-1 font-bold text-white ${
            compact ? "text-base" : "text-xl"
          }`}
          numberOfLines={1}
        >
          {title}
        </Text>
        {rightContent}
      </View>
      {subtitle ? (
        <Text
          className="text-xs text-white/75"
          numberOfLines={1}
          style={{ marginLeft: 52 }}
        >
          {subtitle}
        </Text>
      ) : null}
    </LinearGradient>
  );
}