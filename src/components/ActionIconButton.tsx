import { Eye, Pencil, Trash2 } from "lucide-react-native";
import { useState } from "react";
import {
  Pressable,
  useColorScheme,
  type GestureResponderEvent,
} from "react-native";

type ActionKind = "view" | "edit" | "delete";

type ActionIconButtonProps = {
  action: ActionKind;
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  disabled?: boolean;
};

const ACTIONS = {
  view: { Icon: Eye, foreground: "#2563EB", background: "#EFF6FF" },
  edit: { Icon: Pencil, foreground: "#16803C", background: "#EFF8F1" },
  delete: { Icon: Trash2, foreground: "#DC3545", background: "#FFF1F2" },
} as const;

export function ActionIconButton({
  action,
  label,
  onPress,
  disabled = false,
}: ActionIconButtonProps) {
  const [hovered, setHovered] = useState(false);
  const isDark = useColorScheme() === "dark";
  const { Icon, foreground, background } = ACTIONS[action];
  const darkBackgrounds = {
    view: "#172B45",
    edit: "#193624",
    delete: "#442126",
  };
  const darkBorders = {
    view: "#426A9E",
    edit: "#4B895E",
    delete: "#A85660",
  };
  const darkForegrounds = {
    view: "#93C5FD",
    edit: "#86D49A",
    delete: "#FDA4AF",
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: isDark ? darkBorders[action] : "#E5E7EB",
        backgroundColor: isDark
          ? darkBackgrounds[action]
          : hovered
            ? `${background}CC`
            : background,
        opacity: disabled ? 0.5 : pressed ? 0.72 : 1,
      })}
    >
      <Icon
        size={18}
        strokeWidth={2}
        color={isDark ? darkForegrounds[action] : foreground}
      />
    </Pressable>
  );
}
