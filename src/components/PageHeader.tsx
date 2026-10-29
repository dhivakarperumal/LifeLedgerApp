import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import {
  Pressable,
  StatusBar,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../constants/colors";

type PageHeaderProps = {
  title: ReactNode;
  onBack: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  right?: ReactNode;
  topInsetApplied?: boolean;
  showStatusBar?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PageHeader({
  title,
  onBack,
  accessibilityLabel = "Go back",
  disabled = false,
  right,
  topInsetApplied = false,
  showStatusBar = true,
  style,
}: PageHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <>
      {showStatusBar ? (
        <StatusBar
          barStyle="light-content"
        />
      ) : null}
      <LinearGradient
        colors={Colors.greenGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-start",
            paddingHorizontal: 16,
            paddingBottom: 16,
            paddingTop: (topInsetApplied ? 0 : insets.top) + 8,
          },
          style,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onBack}
          style={{
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.15)",
          }}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.white} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
          {typeof title === "string" ? (
            <Text
              numberOfLines={1}
              style={{ color: Colors.white, fontSize: 18, fontWeight: "700" }}
            >
              {title}
            </Text>
          ) : (
            title
          )}
        </View>
        {right ? <View style={{ marginLeft: 12 }}>{right}</View> : null}
      </LinearGradient>
    </>
  );
}
