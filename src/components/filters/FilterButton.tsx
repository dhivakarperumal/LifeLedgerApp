import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { Colors } from "../../constants/colors";

type Props = {
  onPress: () => void;
  activeCount?: number;
};

/**
 * Compact rounded filter button with optional active-count badge.
 * Press opens the FilterBottomSheet from the parent.
 */
export function FilterButton({ onPress, activeCount = 0 }: Props) {
  const isActive = activeCount > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        isActive ? `Filter — ${activeCount} active` : "Open filters"
      }
      style={{
        width: 40,
        height: 40,
        marginLeft: 6,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 20,
        backgroundColor: isActive ? "#8EA66B" : "transparent",
      }}
    >
      <Ionicons
        name="options-outline"
        size={20}
        color={isActive ? Colors.white : Colors.textSecondary}
      />
      {isActive && (
        <View
          style={{
            position: "absolute",
            top: -2,
            right: -2,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: Colors.white,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 3,
            borderWidth: 1,
            borderColor: "#8EA66B",
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: "800",
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
