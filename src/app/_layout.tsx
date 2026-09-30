import { Stack } from "expo-router";
import * as SystemUI from "expo-system-ui";
import "../../global.css";

void SystemUI.setBackgroundColorAsync("#000000").catch(() => undefined);

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
