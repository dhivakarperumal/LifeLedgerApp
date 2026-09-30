import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../constants/colors";

type AddButtonProps = {
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint: string;
};

export function AddButton({
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: AddButtonProps) {
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={[styles.button, { bottom: insets.bottom + 92 }]}
    >
      <Ionicons name="add" size={30} color={Colors.white} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    right: 20,
    width: 60,
    height: 60,
    padding: 0,
    borderRadius: 30,
    backgroundColor: Colors.deepForest,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.deepForest,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 9,
    elevation: 9,
    zIndex: 10,
  },
});
