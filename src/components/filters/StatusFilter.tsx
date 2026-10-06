import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { Colors } from "../../constants/colors";
import { FormLabel } from "../FormControls";
import { STATUS_OPTIONS, type StatusOption } from "./filterTypes";

const STATUS_ICONS: Record<StatusOption, keyof typeof Ionicons.glyphMap> = {
  All: "apps-outline",
  Active: "checkmark-circle-outline",
  Inactive: "pause-circle-outline",
};

type Props = {
  value: StatusOption;
  onChange: (status: StatusOption) => void;
};

export function StatusFilter({ value, onChange }: Props) {
  return (
    <View style={{ gap: 6 }}>
      {STATUS_OPTIONS.map((option) => {
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
                name={STATUS_ICONS[option]}
                size={16}
                color={selected ? Colors.white : Colors.textSecondary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <FormLabel inline color={Colors.textPrimary}>
              {option}
              </FormLabel>
            </View>
            {selected && (
              <Ionicons name="checkmark-circle" size={20} color="#8EA66B" />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
