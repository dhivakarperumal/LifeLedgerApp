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
          backgroundColor: Colors.white,
          borderRadius: 50,
          paddingHorizontal: 16,
          paddingVertical: 11,
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
      </View>

      {/* Filter / action button */}
      {onFilterPress && (
        <Pressable
          onPress={onFilterPress}
          accessibilityRole="button"
          accessibilityLabel="Filter"
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: filterActive ? Colors.primary : Colors.white,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: filterActive ? Colors.primaryDark : "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: filterActive ? 0.25 : 0.06,
            shadowRadius: filterActive ? 8 : 6,
            elevation: filterActive ? 6 : 3,
            borderWidth: 1,
            borderColor: filterActive ? Colors.primary : Colors.border,
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
                top: 7,
                right: 7,
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
  );
}
