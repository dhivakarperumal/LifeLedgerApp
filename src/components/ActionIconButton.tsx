import { Eye, Pencil, Trash2 } from "lucide-react-native";
import { useState } from "react";
import {
  Pressable,
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
  view: {
    Icon: Eye,
    foreground: "#2563EB",
    background: "#EFF6FF",
    hoverBackground: "#DBEAFE",
  },
  edit: {
    Icon: Pencil,
    foreground: "#16A34A",
    background: "#F0FDF4",
    hoverBackground: "#DCFCE7",
  },
  delete: {
    Icon: Trash2,
    foreground: "#DC2626",
    background: "#FEF2F2",
    hoverBackground: "#FEE2E2",
  },
} as const;

export function ActionIconButton({
  action,
  label,
  onPress,
  disabled = false,
}: ActionIconButtonProps) {
  const [hovered, setHovered] = useState(false);
  const { Icon, foreground, background, hoverBackground } = ACTIONS[action];

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
      className="h-9 w-9 items-center justify-center rounded-lg border-2 border-gray-200 p-2 transition-colors duration-200"
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        marginTop: 8,
        padding: 8,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        borderWidth: 2,
        borderColor: "#E5E7EB",
        backgroundColor: hovered ? hoverBackground : background,
        opacity: disabled ? 0.5 : pressed ? 0.72 : 1,
      })}
    >
      <Icon size={18} strokeWidth={2} color={foreground} />
    </Pressable>
  );
}
