import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../constants/colors";

type BottomTabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

type IconName = ComponentProps<typeof Ionicons>["name"];

const tabIcons: Record<string, { outline: IconName; solid: IconName }> = {
  index: { outline: "home-outline", solid: "home" },
  expenses: { outline: "wallet-outline", solid: "wallet" },
  memories: { outline: "images-outline", solid: "images" },
  diary: { outline: "book-outline", solid: "book" },
  more: { outline: "grid-outline", solid: "grid" },
};

export function BottomTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#1E5128", "#12351A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <SafeAreaView edges={["bottom"]}>
          <View style={styles.tabContainer}>
            {state.routes.map((route, index) => {
              const { options } = descriptors[route.key];
              const focused = state.index === index;
              const label =
                typeof options.tabBarLabel === "string"
                  ? options.tabBarLabel
                  : options.title ?? route.name;

              // Colors for the new design
              const iconColor = focused ? "#1E5128" : "#FFFFFF";
              const textColor = focused ? "#1E5128" : "#FFFFFF";
              
              // Get appropriate icon based on focus state
              const routeIcons = tabIcons[route.name] ?? { outline: "ellipse-outline", solid: "ellipse" };
              const iconName = focused ? routeIcons.solid : routeIcons.outline;

              const handlePress = () => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              };

              return (
                <Pressable
                  key={route.key}
                  accessibilityRole="tab"
                  accessibilityState={focused ? { selected: true } : {}}
                  accessibilityLabel={options.tabBarAccessibilityLabel}
                  testID={options.tabBarButtonTestID}
                  onPress={handlePress}
                  onLongPress={() =>
                    navigation.emit({ type: "tabLongPress", target: route.key })
                  }
                  style={styles.tabButton}
                >
                  <View style={[styles.tabItem, focused && styles.tabItemFocused]}>
                    <Ionicons name={iconName} color={iconColor} size={24} />
                    <Text style={[styles.tabLabel, { color: textColor, fontWeight: focused ? "700" : "500" }]}>
                      {label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
  },
  gradient: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    // Add subtle shadow for the overall bar
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  tabContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 8,
    minHeight: 76,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 4,
  },
  tabItemFocused: {
    backgroundColor: "#dff2b3", // Light vibrant green-yellow
    // Glowing effect
    shadowColor: "#dff2b3",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  tabLabel: {
    fontSize: 12,
  },
});
