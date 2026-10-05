import { Stack } from "expo-router";
import { NavigationBar } from "expo-navigation-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import "../../global.css";

export default function RootLayout() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync("#000000").catch(() => undefined);
  }, []);

  return (
    <>
      {Platform.OS === "android" && <NavigationBar style="light" />}
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
        {Platform.OS === "android" && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              left: 0,
              height: insets.bottom,
              backgroundColor: "#000000",
            }}
          />
        )}
      </View>
    </>
  );
}
