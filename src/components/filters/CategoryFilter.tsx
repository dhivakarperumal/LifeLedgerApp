import {
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Colors } from "../../constants/colors";

const poppinsFontMap = {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
};

export type CategoryOption = string | { value: string; label: string };

type Props = {
  value: string; // "" = All Categories
  onChange: (category: string) => void;
  categories: CategoryOption[];
  multiSelect?: boolean;
};

/**
 * Category dropdown/select. Tapping the trigger opens a modal list.
 * Pass `multiSelect` to allow comma-separated selection (future-proofing).
 */
export function CategoryFilter({
  value,
  onChange,
  categories,
  multiSelect = false,
}: Props) {
  const [fontsLoaded] = useFonts(poppinsFontMap);
  const [open, setOpen] = useState(false);

  const values = value ? value.split(",") : [];
  const selectedOptions = categories
    .map((category) =>
      typeof category === "string"
        ? { value: category, label: category }
        : category,
    )
    .filter((category) => values.includes(category.value));
  const selected =
    selectedOptions.length === 0
      ? "All Categories"
      : multiSelect
        ? `${selectedOptions.length} selected`
        : selectedOptions[0].label;

  return (
    <View>
      {/* Trigger */}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Category: ${selected}`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          paddingVertical: 13,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: value !== "" ? "#8EA66B" : Colors.border,
          backgroundColor: Colors.white,
          gap: 10,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: value !== "" ? "#8EA66B" : "#F5F5F5",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name="grid-outline"
            size={15}
            color={value !== "" ? Colors.white : Colors.textSecondary}
          />
        </View>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: 14,
            fontWeight: "600",
            fontFamily: fontsLoaded ? "Poppins_600SemiBold" : undefined,
            color: value !== "" ? Colors.textPrimary : Colors.textSecondary,
          }}
        >
          {selected}
        </Text>
        {value !== "" && (
          <Pressable
            onPress={() => onChange("")}
            hitSlop={8}
            accessibilityLabel="Clear category"
          >
            <Ionicons
              name="close-circle"
              size={18}
              color={Colors.textSecondary}
            />
          </Pressable>
        )}
        <Ionicons name="chevron-down" size={17} color={Colors.textSecondary} />
      </Pressable>

      {/* Picker modal */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(19,34,25,0.44)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View
              style={{
                backgroundColor: Colors.white,
                borderRadius: 20,
                paddingTop: 16,
                paddingBottom: 8,
                maxHeight: 420,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.18,
                shadowRadius: 20,
                elevation: 10,
              }}
            >
              {/* Header */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 18,
                  marginBottom: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "800",
                    fontFamily: fontsLoaded ? "Poppins_700Bold" : undefined,
                    color: Colors.textPrimary,
                  }}
                >
                  Select Category
                </Text>
                <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                  <Ionicons
                    name="close"
                    size={21}
                    color={Colors.textSecondary}
                  />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* All Categories */}
                {[
                  { value: "", label: "All Categories" },
                  ...categories.map((category) =>
                    typeof category === "string"
                      ? { value: category, label: category }
                      : category,
                  ),
                ].map((category) => {
                  const isSelected = values.includes(category.value);
                  return (
                    <Pressable
                      key={category.value || "all-categories"}
                      onPress={() => {
                        if (category.value === "") {
                          onChange("");
                          setOpen(false);
                          return;
                        }
                        if (multiSelect) {
                          const nextValues = isSelected
                            ? values.filter((item) => item !== category.value)
                            : [...values, category.value];
                          onChange(nextValues.join(","));
                        } else {
                          onChange(category.value);
                          setOpen(false);
                        }
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 18,
                        paddingVertical: 13,
                        backgroundColor: isSelected ? "#F3F7EF" : Colors.white,
                      }}
                    >
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 14,
                          fontWeight: isSelected ? "700" : "500",
                          fontFamily: fontsLoaded
                            ? isSelected
                              ? "Poppins_600SemiBold"
                              : "Poppins_500Medium"
                            : undefined,
                          color: Colors.textPrimary,
                        }}
                      >
                        {category.label}
                      </Text>
                      {isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color="#8EA66B"
                        />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
