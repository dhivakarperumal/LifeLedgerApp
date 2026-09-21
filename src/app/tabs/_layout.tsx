import { Tabs } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "react-native";
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
      <Tabs
        screenOptions={{
          headerShown: true,
          headerTitle: () => <TopHeader />,
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
