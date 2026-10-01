import { Stack } from "expo-router";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import "../../global.css";

export default function RootLayout() {
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync("#000000").catch(() => undefined);
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
