import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { Colors } from "../constants/colors";

type GradientSafeAreaViewProps = {
  children: ReactNode;
  className?: string;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
};

export function GradientSafeAreaView({
  children,
  className,
  edges,
  style,
}: GradientSafeAreaViewProps) {
  return (
    <LinearGradient
      colors={Colors.greenGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.background}
    >
      <SafeAreaView edges={edges} style={styles.safeArea}>
        <View className={className} style={[styles.content, style]}>
          {children}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    flex: 1,
  },
});
