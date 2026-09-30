import {
    Poppins_500Medium,
    Poppins_600SemiBold,
} from "@expo-google-fonts/poppins";
import { useFonts } from "expo-font";
import { Pressable, Text, View } from "react-native";
import { Colors } from "../../constants/colors";

export type ChoiceFilterOption = {
  value: string;
  label: string;
};

export type ChoiceFilterGroup = {
  key: string;
  label: string;
  options: ChoiceFilterOption[];
};

type Props = {
  value: string;
  options: ChoiceFilterOption[];
  onChange: (value: string) => void;
};

export function ChoiceFilter({ value, options, onChange }: Props) {
  const [fontsLoaded] = useFonts({ Poppins_500Medium, Poppins_600SemiBold });

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            style={{
              minHeight: 40,
              justifyContent: "center",
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: selected ? "#8EA66B" : Colors.border,
              backgroundColor: selected ? "#F3F7EF" : Colors.white,
            }}
          >
            <Text
              style={{
                color: selected ? Colors.forest : Colors.textSecondary,
                fontSize: 12,
                fontWeight: selected ? "600" : "500",
                fontFamily: fontsLoaded
                  ? selected
                    ? "Poppins_600SemiBold"
                    : "Poppins_500Medium"
                  : undefined,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
