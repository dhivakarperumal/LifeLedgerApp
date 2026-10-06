import { useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ConfirmPopupType =
  | "add"
  | "edit"
  | "delete"
  | "save"
  | "logout"
  | "cancel"
  | "success";

type ConfirmPopupProps = {
  visible: boolean;
  type?: ConfirmPopupType;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  icon?: ReactNode;
  destructive?: boolean;
};

const DEFAULTS: Record<
  ConfirmPopupType,
  { title: string; message: string; confirmText: string; cancelText: string }
> = {
  add: {
    title: "Add Confirmation",
    message: "Are you sure you want to add this?",
    confirmText: "Add",
    cancelText: "Cancel",
  },
  edit: {
    title: "Edit Confirmation",
    message: "Are you sure you want to save these changes?",
    confirmText: "Save",
    cancelText: "Cancel",
  },
  delete: {
    title: "Delete Confirmation",
    message: "Are you sure you want to delete this?",
    confirmText: "Delete",
    cancelText: "Cancel",
  },
  save: {
    title: "Save Confirmation",
    message: "Are you sure you want to save this?",
    confirmText: "Save",
    cancelText: "Cancel",
  },
  logout: {
    title: "Logout Confirmation",
    message: "Are you sure you want to logout?",
    confirmText: "Logout",
    cancelText: "Cancel",
  },
  cancel: {
    title: "Cancel Confirmation",
    message: "Are you sure you want to cancel?",
    confirmText: "Yes",
    cancelText: "No",
  },
  success: {
    title: "Success",
    message: "",
    confirmText: "OK",
    cancelText: "",
  },
};

export default function ConfirmPopup({
  visible,
  type = "save",
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  loading = false,
  icon,
  destructive,
}: ConfirmPopupProps) {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const defaults = DEFAULTS[type];
  const isBusy = loading || isSubmitting;
  const isDestructive = destructive ?? type === "delete";
  const colors = isDark
    ? {
        surface: "#202522",
        text: "#F4F6F3",
        muted: "#B5BEB8",
        border: "#3B443E",
        cancel: "#303832",
      }
    : {
        surface: "#FFFFFF",
        text: "#202936",
        muted: "#68736E",
        border: "#E6EBE5",
        cancel: "#F1F4EF",
      };

  const handleConfirm = async () => {
    if (isBusy || submittingRef.current) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await onConfirm?.();
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (isBusy) return;
    onCancel?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <View
        className="flex-1 items-center justify-center px-6"
        style={{
          paddingTop: Math.max(insets.top, 20),
          paddingBottom: Math.max(insets.bottom, 20),
          backgroundColor: "rgba(10, 16, 12, 0.52)",
        }}
      >
        <Pressable
          accessible={false}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
        />
        <View
          accessibilityViewIsModal
          className="w-full max-w-[420px] rounded-[28px] p-6"
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: isDark ? 0.36 : 0.18,
            shadowRadius: 24,
            elevation: 16,
          }}
        >
          {icon ? (
            <View className="mb-4 items-center">{icon}</View>
          ) : null}
          <Text
            accessibilityRole="header"
            className="text-center text-xl font-bold"
            style={{ color: colors.text }}
          >
            {title ?? defaults.title}
          </Text>
          <Text
            className="mt-3 text-center text-[15px] leading-6"
            style={{ color: colors.muted }}
          >
            {message ?? defaults.message}
          </Text>
          <View className="mt-7 flex-row gap-3">
            {type !== "success" && (
              <Pressable
                accessibilityRole="button"
                disabled={isBusy}
                onPress={handleCancel}
                className="min-h-12 flex-1 items-center justify-center rounded-2xl px-4"
                style={{ backgroundColor: colors.cancel, opacity: isBusy ? 0.6 : 1 }}
              >
                <Text
                  className="text-[15px] font-semibold"
                  style={{ color: colors.text }}
                >
                  {cancelText ?? defaults.cancelText}
                </Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isBusy, busy: isBusy }}
              disabled={isBusy}
              onPress={() => void handleConfirm()}
              className="min-h-12 flex-1 flex-row items-center justify-center rounded-2xl px-4"
              style={{
                backgroundColor: isDestructive ? "#C63F3F" : "#367343",
                opacity: isBusy ? 0.75 : 1,
              }}
            >
              {isBusy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-[15px] font-semibold text-white">
                  {confirmText ?? defaults.confirmText}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
