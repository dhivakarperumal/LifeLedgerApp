import { Stack } from "expo-router";
import { NavigationBar } from "expo-navigation-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppLockProvider, useAppLock } from "../security/AppLockProvider";
import "../../global.css";

export default function RootLayout() {
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync("#000000").catch(() => undefined);
  }, []);

  return (
    <AppLockProvider>
      <RootNavigation />
    </AppLockProvider>
  );
}

function RootNavigation() {
  const insets = useSafeAreaInsets();
  const { ready } = useAppLock();

  return (
    <>
      {Platform.OS === "android" && (
        <NavigationBar style={ready ? "dark" : "light"} />
      )}
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
              height: Math.max(insets.bottom, 0),
              backgroundColor: ready ? "#000000" : "#F8FAFC",
              zIndex: 1,
            }}
          />
        )}
      </View>
    </>
  );
}
