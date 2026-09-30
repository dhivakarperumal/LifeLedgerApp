import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { Pressable, Text, View } from "react-native";
import { Colors } from "../../constants/colors";

const poppinsFontMap = {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
};

type Props = {
  onPress: () => void;
  activeCount?: number;
};

/**
 * Compact rounded filter button with optional active-count badge.
 * Press opens the FilterBottomSheet from the parent.
 */
export function FilterButton({ onPress, activeCount = 0 }: Props) {
  const [fontsLoaded] = useFonts(poppinsFontMap);
  const isActive = activeCount > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        isActive ? `Filter — ${activeCount} active` : "Open filters"
      }
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 50,
        borderWidth: 1.5,
        borderColor: isActive ? "#8EA66B" : Colors.border,
        backgroundColor: isActive ? "#8EA66B" : Colors.white,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 6,
        elevation: 3,
      }}
    >
      <Ionicons
        name="options-outline"
        size={17}
        color={isActive ? Colors.white : Colors.textSecondary}
      />
      <Text
        style={{
          fontSize: 13,
          fontWeight: "600",
          fontFamily: fontsLoaded ? "Poppins_600SemiBold" : undefined,
          color: isActive ? Colors.white : Colors.textPrimary,
        }}
      >
        Filter
      </Text>
      {isActive && (
        <View
          style={{
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: Colors.white,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 3,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: "800",
              fontFamily: fontsLoaded ? "Poppins_700Bold" : undefined,
              color: "#8EA66B",
              lineHeight: 12,
            }}
          >
            {activeCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
