import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../constants/colors";

type BottomTabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

type IconName = ComponentProps<typeof Ionicons>["name"];

const tabIcons: Record<string, IconName> = {
  index: "home-outline",
  expenses: "wallet-outline",
  memories: "images-outline",
  diary: "book-outline",
  more: "grid-outline",
};

export function BottomTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  return (
    <SafeAreaView
      edges={["bottom"]}
      className="border-t"
      style={{
        backgroundColor: Colors.surface,
        borderTopColor: Colors.border,
      }}
    >
      <View className="flex-row pt-3" style={{ minHeight: 72 }}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : (options.title ?? route.name);
          const color = focused ? Colors.tabActive : Colors.primaryLight;

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
              className="flex-1 items-center gap-1"
            >
              <Ionicons
                name={tabIcons[route.name] ?? "ellipse-outline"}
                color={color}
                size={23}
              />
              <Text className="text-xs font-semibold" style={{ color }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
