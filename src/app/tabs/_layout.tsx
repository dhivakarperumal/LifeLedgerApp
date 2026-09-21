import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { BottomTabBar } from "../../Navigations/BottomTabBar";
import { TopHeader } from "../../Navigations/TopHeader";
import { Colors } from "../../constants/colors";

export default function TabsLayout() {
  return (
    <>
      <StatusBar style="light" backgroundColor={Colors.surface} />
      <Tabs
        screenOptions={{
          headerShown: true,
          headerTitle: () => <TopHeader />,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.textPrimary,
          tabBarActiveTintColor: Colors.textPrimary,
          tabBarInactiveTintColor: Colors.primaryLight,
          tabBarStyle: { display: "none" },
        }}
        tabBar={(props) => <BottomTabBar {...props} />}
      >
        <Tabs.Screen
          name="index"
          options={{ title: "Home", headerShown: false }}
        />
        <Tabs.Screen name="expenses" options={{ title: "Expenses" }} />
        <Tabs.Screen name="memories" options={{ title: "Memories" }} />
        <Tabs.Screen name="diary" options={{ title: "Diary" }} />
        <Tabs.Screen name="more" options={{ title: "More" }} />
      </Tabs>
    </>
  );
}
