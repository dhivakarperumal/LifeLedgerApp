import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  // Get the safe area bottom inset (gesture bar / home indicator height)
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Rounded green gradient — only wraps the tab buttons, NOT the safe area */}
      <LinearGradient
        colors={[Colors.primaryDark, Colors.headerEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.tabContainer}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const label =
              typeof options.tabBarLabel === "string"
                ? options.tabBarLabel
                : (options.title ?? route.name);

            // Colors for the new design
            const iconColor = focused ? Colors.accent : "#FFFFFF";
            const textColor = focused ? Colors.accent : "#FFFFFF";

            // Get appropriate icon based on focus state
            const routeIcons = tabIcons[route.name] ?? {
              outline: "ellipse-outline",
              solid: "ellipse",
            };
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
                <View
                  style={[styles.tabItem, focused && styles.tabItemFocused]}
                >
                  <Ionicons name={iconName} color={iconColor} size={24} />
                  <Text
                    style={[
                      styles.tabLabel,
                      { color: textColor, fontWeight: focused ? "700" : "500" },
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </LinearGradient>

      {/*
        Pure black spacer that fills the system navigation bar / gesture zone.
        The container is transparent so the green gradient corners look correct.
        Only this spacer (below the gradient) is black.
      */}
      <View style={[styles.safeAreaSpacer, { height: insets.bottom }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    // transparent — so the green gradient rounded corners are not
    // contaminated by a black background bleeding through the corners
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
    paddingHorizontal: 4,
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
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 24,
    gap: 4,
  },
  tabItemFocused: {
    // no background — active state is shown via yellow icon & text only
  },
  tabLabel: {
    fontSize: 10,
  },
  // Only the area BELOW the green bar is black (fills gesture/nav bar zone)
  safeAreaSpacer: {
    backgroundColor: "#000000",
  },
});
