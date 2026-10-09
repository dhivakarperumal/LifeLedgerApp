import {
    Poppins_600SemiBold,
    Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { cloneElement, isValidElement, type ReactNode } from "react";
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    type DimensionValue,
    type StyleProp,
    type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../constants/colors";

type BottomSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  height?: DimensionValue;
  maxHeight?: DimensionValue;
};

type BottomSheetHeaderProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
};

type BottomSheetContentProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

type BottomSheetFooterProps = BottomSheetContentProps & {
  bottomInset?: number;
};

const sheetFonts = {
  Poppins_600SemiBold,
  Poppins_700Bold,
};

export function BottomSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
  height,
  maxHeight = "88%",
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts(sheetFonts);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close bottom sheet"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "position"}
          keyboardVerticalOffset={0}
          style={[
            styles.sheet,
            {
              height,
              maxHeight,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={styles.handle} />
          <BottomSheetHeader
            title={title}
            subtitle={subtitle}
            onClose={onClose}
            fontsLoaded={fontsLoaded}
          />
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={[
              styles.scrollContent,
              { flexGrow: 1 },
              { paddingBottom: Math.max(insets.bottom, 16) + 16 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
            bounces={true}
          >
            {children}
          </ScrollView>
          {footer ? renderFooter(footer, insets.bottom) : null}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export function BottomSheetHeader({
  title,
  subtitle,
  onClose,
  fontsLoaded = false,
}: BottomSheetHeaderProps & { fontsLoaded?: boolean }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text
          numberOfLines={1}
          style={[
            styles.title,
            fontsLoaded && { fontFamily: "Poppins_700Bold" },
          ]}
        >
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={8}
        onPress={onClose}
        style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
      >
        <Ionicons name="close" size={20} color={Colors.white} />
      </Pressable>
    </View>
  );
}

export function BottomSheetContent({
  children,
  style,
}: BottomSheetContentProps) {
  return <View style={[styles.content, style]}>{children}</View>;
}

export function BottomSheetFooter({
  children,
  style,
  bottomInset = 0,
}: BottomSheetFooterProps) {
  return (
    <View
      style={[
        styles.footer,
        { paddingBottom: Math.max(bottomInset, 16) },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function renderFooter(footer: ReactNode, bottomInset: number) {
  if (
    isValidElement<BottomSheetFooterProps>(footer) &&
    footer.type === BottomSheetFooter
  ) {
    return cloneElement(footer, {
      bottomInset: Math.max(bottomInset, footer.props.bottomInset ?? 0),
    });
  }

  return (
    <BottomSheetFooter bottomInset={bottomInset}>{footer}</BottomSheetFooter>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(19, 34, 25, 0.48)",
  },
  sheet: {
    width: "100%",
    maxHeight: "82%",
    overflow: "hidden",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: Colors.white,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  handle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.18)",
    backgroundColor: Colors.primaryDark,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: Colors.white,
    fontSize: 19,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 3,
    color: Colors.primaryLight,
    fontSize: 13,
  },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  pressed: {
    opacity: 0.7,
  },
  scrollArea: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    padding: 20,
    gap: 12,
  },
  content: {
    gap: 12,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bgSurface,
  },
});
