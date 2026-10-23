import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../constants/colors";
import {
  BOTTOM_TAB_BAR_HEIGHT,
  FLOATING_ACTION_BUTTON_GAP,
} from "../constants/layout";

type AddButtonProps = {
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint: string;
  bottomOffset?: number;
};

export function AddButton({
  onPress,
  accessibilityLabel,
  accessibilityHint,
  bottomOffset,
}: AddButtonProps) {
  const insets = useSafeAreaInsets();
  const bottom =
    bottomOffset === undefined
      ? BOTTOM_TAB_BAR_HEIGHT + FLOATING_ACTION_BUTTON_GAP
      : insets.bottom + bottomOffset;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={[styles.button, { bottom }]}
    >
      <Ionicons name="add" size={24} color={Colors.white} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    right: 18,
    width: 52,
    height: 52,
    padding: 0,
    borderRadius: 26,
    backgroundColor: Colors.deepForest,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.deepForest,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 7,
    elevation: 8,
    zIndex: 10,
  },
});
