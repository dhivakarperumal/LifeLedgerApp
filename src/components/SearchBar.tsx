import { Ionicons } from "@expo/vector-icons";
import { Pressable, TextInput, View, ViewStyle } from "react-native";
import { Colors } from "../constants/colors";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Called when the right filter/action icon is pressed */
  onFilterPress?: () => void;
  /** Whether a filter is currently active (highlights the filter button) */
  filterActive?: boolean;
  /** Pass a custom right icon name; defaults to the sliders/options icon */
  filterIcon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
};

/**
 * A consistent, app-wide search bar that matches the design shown in the
 * image: white pill container, leading magnifier icon, text input, and an
 * optional right-side filter/action button.
 */
export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search...",
  onFilterPress,
  filterActive = false,
  filterIcon = "options-outline",
  style,
}: Props) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        },
        style,
      ]}
    >
      {/* Input pill */}
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          minHeight: 52,
          backgroundColor: Colors.white,
          borderRadius: 50,
          paddingHorizontal: 16,
          paddingVertical: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 3,
          borderWidth: 1,
          borderColor: Colors.border,
        }}
      >
        <Ionicons
          name="search-outline"
          size={18}
          color={Colors.textSecondary}
        />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textSecondary}
          style={{
            flex: 1,
            marginLeft: 10,
            fontSize: 14,
            color: Colors.textPrimary,
            padding: 0,
          }}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {value.length > 0 && (
          <Pressable onPress={() => onChangeText("")} hitSlop={8}>
            <Ionicons
              name="close-circle"
              size={17}
              color={Colors.textSecondary}
            />
          </Pressable>
        )}
        {onFilterPress && (
          <Pressable
            onPress={onFilterPress}
            accessibilityRole="button"
            accessibilityLabel="Filter"
            style={{
              width: 36,
              height: 36,
              marginLeft: 8,
              borderRadius: 18,
              backgroundColor: filterActive ? Colors.primary : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name={filterIcon}
              size={20}
              color={filterActive ? Colors.white : Colors.textPrimary}
            />
            {filterActive && (
              <View
                style={{
                  position: "absolute",
                  top: 5,
                  right: 5,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: Colors.accent,
                  borderWidth: 1.5,
                  borderColor: Colors.primary,
                }}
              />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}
