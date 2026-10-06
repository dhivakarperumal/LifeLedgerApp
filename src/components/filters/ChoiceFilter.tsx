import {
    Poppins_500Medium,
    Poppins_600SemiBold,
} from "@expo-google-fonts/poppins";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Colors } from "../../constants/colors";
import { PopupSelect } from "../PopupSelect";
import { toTitleCase } from "../formLabelUtils";

export type ChoiceFilterOption = {
  value: string;
  label: string;
};

export type ChoiceFilterGroup = {
  key: string;
  label: string;
  options: ChoiceFilterOption[];
  presentation?: "chips" | "select" | "popup";
};

type Props = {
  value: string;
  options: ChoiceFilterOption[];
  onChange: (value: string) => void;
  presentation?: "chips" | "select" | "popup";
  label?: string;
};

export function ChoiceFilter({
  value,
  options,
  onChange,
  presentation = "chips",
  label,
}: Props) {
  const [fontsLoaded] = useFonts({ Poppins_500Medium, Poppins_600SemiBold });
  const [isExpanded, setIsExpanded] = useState(false);

  if (presentation === "popup") {
    return (
      <PopupSelect
        label={label ?? "Select an option"}
        placeholder="Select an option"
        options={options.map((option) => ({
          ...option,
          label: toTitleCase(option.label),
        }))}
        value={value}
        onChange={onChange}
        searchPlaceholder={`Search ${(label ?? "options").toLowerCase()}`}
        showLabel={false}
      />
    );
  }

  if (presentation === "select") {
    const selectedOption = options.find((option) => option.value === value);

    return (
      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose an option"
          accessibilityState={{ expanded: isExpanded }}
          onPress={() => setIsExpanded((expanded) => !expanded)}
          style={{
            minHeight: 48,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: Colors.border,
            borderRadius: 12,
            backgroundColor: Colors.white,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              marginRight: 8,
              color: Colors.textPrimary,
              fontSize: 13,
              fontWeight: "600",
              fontFamily: fontsLoaded ? "Poppins_600SemiBold" : undefined,
            }}
          >
            {selectedOption?.label ?? "Select an option"}
          </Text>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={Colors.textSecondary}
          />
        </Pressable>

        {isExpanded && (
          <View
            style={{
              marginTop: 6,
              borderWidth: 1,
              borderColor: Colors.border,
              borderRadius: 12,
              backgroundColor: Colors.white,
              overflow: "hidden",
            }}
          >
            {options.map((option) => {
              const selected = value === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => {
                    onChange(option.value);
                    setIsExpanded(false);
                  }}
                  style={{
                    minHeight: 42,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: Colors.border,
                    backgroundColor: selected ? "#F3F7EF" : Colors.white,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? Colors.forest : Colors.textPrimary,
                      fontSize: 12,
                      fontWeight: selected ? "600" : "500",
                      fontFamily: fontsLoaded
                        ? selected
                          ? "Poppins_600SemiBold"
                          : "Poppins_500Medium"
                        : undefined,
                    }}
                  >
                    {toTitleCase(option.label)}
                  </Text>
                  {selected ? (
                    <Ionicons name="checkmark" size={17} color={Colors.forest} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    );
  }

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
