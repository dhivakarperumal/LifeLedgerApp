import {
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { Colors } from "../../constants/colors";
import { FormLabel } from "../FormControls";

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
  const [search, setSearch] = useState("");

  const values = value ? value.split(",") : [];
  const normalizedCategories = categories
    .map((category) =>
      typeof category === "string"
        ? { value: category, label: category }
        : category,
    );
  const selectedOptions = normalizedCategories
    .filter((category) => values.includes(category.value));
  const query = search.trim().toLowerCase();
  const filteredCategories = normalizedCategories.filter((category) =>
    `${category.label} ${category.value}`.toLowerCase().includes(query),
  );
  const selected =
    selectedOptions.length === 0
      ? "All Categories"
      : multiSelect
        ? `${selectedOptions.length} selected`
        : selectedOptions[0].label;

  const closePicker = () => {
    setOpen(false);
    setSearch("");
  };

  return (
    <View>
      {/* Trigger */}
      <Pressable
        onPress={() => {
          setSearch("");
          setOpen(true);
        }}
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
            onPress={(event) => {
              event.stopPropagation();
              onChange("");
            }}
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
        onRequestClose={closePicker}
      >
        <Pressable
          onPress={closePicker}
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
                <Pressable onPress={closePicker} hitSlop={8}>
                  <Ionicons
                    name="close"
                    size={21}
                    color={Colors.textSecondary}
                  />
                </Pressable>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginHorizontal: 16,
                  marginBottom: 8,
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  borderRadius: 12,
                  backgroundColor: "#F8FAF7",
                }}
              >
                <Ionicons
                  name="search-outline"
                  size={17}
                  color={Colors.textSecondary}
                />
                <TextInput
                  accessibilityLabel="Search categories in filter"
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search categories"
                  placeholderTextColor={Colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    flex: 1,
                    height: 44,
                    marginLeft: 8,
                    color: Colors.textPrimary,
                    fontSize: 14,
                  }}
                />
                {search ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear category search"
                    onPress={() => setSearch("")}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={Colors.textSecondary}
                    />
                  </Pressable>
                ) : null}
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* All Categories */}
                {[
                  { value: "", label: "All Categories" },
                  ...filteredCategories,
                ].map((category) => {
                  if (
                    category.value !== "" &&
                    query &&
                    !`${category.label} ${category.value}`
                      .toLowerCase()
                      .includes(query)
                  ) {
                    return null;
                  }
                  const isSelected =
                    category.value === ""
                      ? values.length === 0
                      : values.includes(category.value);
                  return (
                    <Pressable
                      key={category.value || "all-categories"}
                      onPress={() => {
                        if (category.value === "") {
                          onChange("");
                          closePicker();
                          return;
                        }
                        if (multiSelect) {
                          const nextValues = isSelected
                            ? values.filter((item) => item !== category.value)
                            : [...values, category.value];
                          onChange(nextValues.join(","));
                        } else {
                          onChange(category.value);
                          closePicker();
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
                      <View style={{ flex: 1 }}>
                        <FormLabel inline color={Colors.textPrimary}>
                          {category.label}
                        </FormLabel>
                      </View>
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
                {query && filteredCategories.length === 0 ? (
                  <View style={{ alignItems: "center", paddingVertical: 20 }}>
                    <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>
                      No categories found
                    </Text>
                  </View>
                ) : null}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
