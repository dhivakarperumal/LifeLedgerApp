import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { Colors } from "../constants/colors";

export function AddPageHeader({
  title,
  subtitle,
  onBack,
  horizontalInset = 20,
  disabled = false,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  horizontalInset?: number;
  disabled?: boolean;
}) {
  return (
    <LinearGradient
      colors={Colors.greenGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        marginHorizontal: -horizontalInset,
        marginBottom: 15,
        paddingHorizontal: horizontalInset,
        paddingTop: 14,
        paddingBottom: 12,
        gap: 4,
      }}
    >
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityState={{ disabled }}
          className="h-10 w-10 items-center justify-center rounded-full border border-[#E6EBE7] bg-white"
          disabled={disabled}
          onPress={onBack}
        >
          <ArrowLeft size={20} color="#25332C" strokeWidth={2.2} />
        </Pressable>
        <Text
          className="min-w-0 flex-1 text-xl font-bold text-white"
          numberOfLines={1}
        >
          {title}
        </Text>
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