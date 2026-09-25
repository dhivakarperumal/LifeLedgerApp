import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { TopHeader } from "../../Navigations/TopHeader";
import { Colors } from "../../constants/colors";

export default function Index() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: Colors.headerStart }}
    >
      <View style={{ flex: 1, backgroundColor: Colors.contentBackground }}>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 104 + insets.bottom }}
        >
          <LinearGradient
            colors={[Colors.headerStart, Colors.headerEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingHorizontal: 22,
              paddingTop: 12,
              paddingBottom: 54,
              borderBottomLeftRadius: 42,
              borderBottomRightRadius: 42,
            }}
          >
            <View className="h-11">
              <TopHeader />
            </View>

            <Text
              className="mt-7 text-xs font-semibold"
              style={{ color: Colors.primaryLight, letterSpacing: 1.5 }}
            >
              MONDAY, SEPTEMBER 21, 2026
            </Text>
            <Text
              className="mt-2 text-3xl font-bold"
              style={{ color: Colors.white }}
            >
              👋 Good Afternoon,
            </Text>
            <Text
              className="text-3xl font-bold"
              style={{ color: Colors.accent }}
            >
              Dhivakar P
            </Text>

            <View
              className="mt-5 flex-row items-center rounded-3xl px-5 py-4"
              style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
            >
              <View
                className="mr-4 h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: Colors.olive }}
              >
                <Ionicons name="leaf" size={24} color={Colors.accent} />
              </View>
              <Text
                className="flex-1 text-lg italic"
                style={{ color: Colors.white }}
              >
                “Don’t be afraid to give up the good to go for the great.”
              </Text>
              <Ionicons name="chevron-forward" size={25} color={Colors.white} />
            </View>
          </LinearGradient>

          <View className="-mt-8 px-5">
            <View className="flex-row justify-between">
              {[
                ["wallet", "Expense"],
                ["book", "Diary"],
                ["calendar", "Event"],
                ["image", "Memory"],
                ["swap-horizontal", "Transfer"],
              ].map(([icon, label]) => (
                <Pressable key={label} className="items-center">
                  <View
                    className="h-20 w-20 items-center justify-center rounded-3xl"
                    style={{
                      backgroundColor: Colors.bgCard,
                      shadowColor: Colors.primaryDark,
                      shadowOpacity: 0.1,
                      shadowRadius: 10,
                      elevation: 3,
                    }}
                  >
                    <Ionicons
                      name={icon as never}
                      size={30}
                      color={Colors.primary}
                    />
                  </View>
                  <Text
                    className="mt-2 text-xs font-semibold"
                    style={{ color: Colors.textPrimary }}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View className="mt-12 flex-row items-center justify-between">
              <Text
                className="text-3xl font-bold"
                style={{ color: Colors.textPrimary }}
              >
                Overview
              </Text>
              <Pressable
                className="flex-row items-center rounded-full border px-4 py-3"
                style={{
                  borderColor: Colors.border,
                  backgroundColor: Colors.white,
                }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{ color: Colors.textPrimary }}
                >
                  This Month
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={Colors.textPrimary}
                />
              </Pressable>
            </View>

            <View
              className="mt-4 rounded-3xl p-6"
              style={{
                backgroundColor: Colors.white,
                shadowColor: Colors.primaryDark,
                shadowOpacity: 0.06,
                shadowRadius: 12,
                elevation: 2,
              }}
            >
              <View className="flex-row items-center justify-between">
                <View>
                  <Text
                    className="text-base"
                    style={{ color: Colors.textSecondary }}
                  >
                    Total Spent
                  </Text>
                  <Text
                    className="mt-1 text-4xl font-bold"
                    style={{ color: Colors.textPrimary }}
                  >
                    ₹1,780
                  </Text>
                  <Text
                    className="mt-2 text-sm"
                    style={{ color: Colors.olive }}
                  >
                    ↓ 12% less than last month
                  </Text>
                </View>
                <View
                  className="rounded-xl p-4"
                  style={{ backgroundColor: Colors.bgCard }}
                >
                  <Text
                    className="text-sm"
                    style={{ color: Colors.textSecondary }}
                  >
                    This Week{" "}
                    <Text
                      className="font-bold"
                      style={{ color: Colors.textPrimary }}
                    >
                      ₹1,780
                    </Text>
                  </Text>
                  <Text
                    className="mt-4 text-sm"
                    style={{ color: Colors.textSecondary }}
                  >
                    This Month{" "}
                    <Text
                      className="font-bold"
                      style={{ color: Colors.textPrimary }}
                    >
                      ₹4,520
                    </Text>
                  </Text>
                </View>
              </View>
            </View>

            <View
              className="mt-4 rounded-3xl p-6"
              style={{ backgroundColor: Colors.white }}
            >
              <View className="flex-row items-center justify-between">
                <Text
                  className="text-lg font-bold"
                  style={{ color: Colors.textPrimary }}
                >
                  Top Categories
                </Text>
                <Pressable className="flex-row items-center">
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: Colors.primary }}
                  >
                    View All
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={17}
                    color={Colors.primary}
                  />
                </Pressable>
              </View>
              <View className="mt-4 flex-row gap-1">
                <View
                  className="h-3 flex-[76] rounded-full"
                  style={{ backgroundColor: Colors.primary }}
                />
                <View
                  className="h-3 flex-[14] rounded-full"
                  style={{ backgroundColor: Colors.olive }}
                />
                <View
                  className="h-3 flex-[10] rounded-full"
                  style={{ backgroundColor: Colors.primaryLight }}
                />
              </View>
              <View className="mt-5 flex-row justify-between">
                {[
                  ["Bills", "76%", Colors.primary],
                  ["Travel", "14%", Colors.olive],
                  ["Food", "10%", Colors.primaryLight],
                ].map(([label, value, color]) => (
                  <View key={label as string} className="flex-row items-center">
                    <View
                      className="mr-2 h-6 w-6 rounded-full"
                      style={{ backgroundColor: color as string }}
                    />
                    <Text
                      className="text-sm"
                      style={{ color: Colors.textPrimary }}
                    >
                      {label}{" "}
                      <Text style={{ color: Colors.olive }}>{value}</Text>
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View className="mt-7 flex-row items-center justify-between">
              <Text
                className="text-xl font-bold"
                style={{ color: Colors.textPrimary }}
              >
                Recent Transactions
              </Text>
              <Text
                className="text-sm font-semibold"
                style={{ color: Colors.primary }}
              >
                View All ›
              </Text>
            </View>
            <View
              className="mt-3 flex-row items-center rounded-3xl p-4"
              style={{ backgroundColor: Colors.white }}
            >
              <View
                className="mr-4 h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: Colors.bgCard }}
              >
                <Ionicons name="restaurant" size={25} color={Colors.primary} />
              </View>
              <View className="flex-1">
                <Text
                  className="text-base font-semibold"
                  style={{ color: Colors.textPrimary }}
                >
                  Lunch with Friends
                </Text>
                <Text
                  className="mt-1 text-sm"
                  style={{ color: Colors.textSecondary }}
                >
                  Food · Sep 21, 2026
                </Text>
              </View>
              <Text
                className="text-base font-bold"
                style={{ color: Colors.danger }}
              >
                - ₹350
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
