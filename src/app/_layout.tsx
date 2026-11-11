import { Stack, usePathname } from "expo-router";
import { NavigationBar } from "expo-navigation-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppLockProvider, useAppLock } from "../security/AppLockProvider";
import "../../global.css";

export default function RootLayout() {
  return (
    <AppLockProvider>
      <RootNavigation />
    </AppLockProvider>
  );
}

function RootNavigation() {
  const insets = useSafeAreaInsets();
  const { ready } = useAppLock();
  const pathname = usePathname();
  const lightSystemBackground = !ready || pathname === "/welcome";

  useEffect(() => {
    if (Platform.OS === "android") {
      void SystemUI.setBackgroundColorAsync(
        lightSystemBackground ? "#F8FAFC" : "#000000",
      ).catch(() => undefined);
    }
  }, [lightSystemBackground]);

  return (
    <>
      {Platform.OS === "android" && (
        <NavigationBar style={lightSystemBackground ? "light" : "dark"} />
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
              backgroundColor: lightSystemBackground ? "#F8FAFC" : "#000000",
              zIndex: 1,
            }}
          />
        )}
      </View>
    </>
  );
}
