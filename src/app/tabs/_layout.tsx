import { LinearGradient } from "expo-linear-gradient";
import { NavigationBar } from "expo-navigation-bar";
import { Tabs } from "expo-router";
import { Platform, StatusBar } from "react-native";
import { BottomTabBar } from "../../Navigations/BottomTabBar";
import { TopHeader } from "../../Navigations/TopHeader";
import { Colors } from "../../constants/colors";

export default function TabsLayout() {
  return (
    <>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Colors.headerStart}
      />
      {/* Set Android system navigation bar buttons to light (white) for black background */}
      {Platform.OS === "android" && <NavigationBar style="dark" />}
      <Tabs
        screenOptions={{
          headerShown: true,
          headerTitle: () => <TopHeader />,
          headerTitleAlign: "left",
          headerTitleContainerStyle: {
            flex: 1,
            marginHorizontal: 0,
          },
          headerShadowVisible: false,
          headerBackground: () => (
            <LinearGradient
              colors={[Colors.headerStart, Colors.headerEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1 }}
            />
          ),
          headerTintColor: Colors.white,
          tabBarActiveTintColor: Colors.white,
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
