import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { NavigationBar } from "expo-navigation-bar";
import { Tabs } from "expo-router";
import { useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  StatusBar,
  Text,
  View,
} from "react-native";
import { BottomTabBar } from "../../Navigations/BottomTabBar";
import { Colors } from "../../constants/colors";

function FavoriteHeaderButton() {
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        isFavorite ? "Remove from favorites" : "Add to favorites"
      }
      accessibilityState={{ selected: isFavorite }}
      className="mr-4 h-9 w-9 items-center justify-center rounded-full bg-white/15 active:bg-white/25"
      onPress={() => setIsFavorite((current) => !current)}
    >
      <Ionicons
        name={isFavorite ? "heart" : "heart-outline"}
        size={20}
        color={isFavorite ? Colors.accent : Colors.white}
      />
    </Pressable>
  );
}

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
          headerTitle: ({ children }) => (
            <View className="flex-row items-center gap-3">
              <Image
                source={require("../../../assets/images/logo.png")}
                className="h-8 w-8 rounded-lg"
                resizeMode="cover"
                accessibilityLabel="Life Ledger logo"
              />
              <Text className="text-lg font-bold text-white">{children}</Text>
            </View>
          ),
          headerTitleAlign: "left",
          headerTitleContainerStyle: {
            flex: 1,
            marginHorizontal: 0,
            paddingHorizontal: 16,
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
        <Tabs.Screen
          name="memories"
          options={{
            title: "Memories",
            headerRight: () => <FavoriteHeaderButton />,
          }}
        />
        <Tabs.Screen
          name="diary"
          options={{
            title: "Diary",
            headerRight: () => <FavoriteHeaderButton />,
          }}
        />
        <Tabs.Screen name="more" options={{ title: "More" }} />
      </Tabs>
    </>
  );
}
