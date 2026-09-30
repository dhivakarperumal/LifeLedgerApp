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
import { SORT_OPTIONS, type SortOption } from "./filterTypes";

const poppinsFontMap = {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
};

const SORT_ICONS: Record<SortOption, keyof typeof Ionicons.glyphMap> = {
  "Newest First": "arrow-down-outline",
  "Oldest First": "arrow-up-outline",
  "Amount: High to Low": "trending-down-outline",
  "Amount: Low to High": "trending-up-outline",
};

type Props = {
  value: SortOption;
  onChange: (sort: SortOption) => void;
};

export function SortFilter({ value, onChange }: Props) {
  const [fontsLoaded] = useFonts(poppinsFontMap);

  return (
    <View style={{ gap: 6 }}>
      {SORT_OPTIONS.map((option) => {
        const selected = value === option;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: selected ? "#8EA66B" : Colors.border,
              backgroundColor: selected ? "#F3F7EF" : Colors.white,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: selected ? "#8EA66B" : "#F5F5F5",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Ionicons
                name={SORT_ICONS[option]}
                size={16}
                color={selected ? Colors.white : Colors.textSecondary}
              />
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: 14,
                fontWeight: selected ? "700" : "500",
                fontFamily: fontsLoaded
                  ? selected
                    ? "Poppins_600SemiBold"
                    : "Poppins_500Medium"
                  : undefined,
                color: Colors.textPrimary,
              }}
            >
              {option}
            </Text>
            {selected && (
              <Ionicons name="checkmark-circle" size={20} color="#8EA66B" />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
