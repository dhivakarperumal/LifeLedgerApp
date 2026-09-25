import { Stack } from "expo-router";
import * as SystemUI from "expo-system-ui";
import "../../global.css";

// Set the root view background to black so the Android system navigation bar
// region (gesture pill / 3-button area) is pure black — works in Expo Go too.
void SystemUI.setBackgroundColorAsync("#000000").catch(() => undefined);

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
