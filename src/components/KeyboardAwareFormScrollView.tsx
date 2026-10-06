import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";

type KeyboardAwareFormScrollViewProps = {
  children: ReactNode;
};

export function KeyboardAwareFormScrollView({
  children,
}: KeyboardAwareFormScrollViewProps) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        keyboardDismissMode="none"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
