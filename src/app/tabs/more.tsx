import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Colors } from "../../constants/colors";

type MoreRowItem = {
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBackground: string;
};

const accountItems: MoreRowItem[] = [
  {
    label: "My Profile",
    subtitle: "Edit personal details",
    icon: "person-outline",
    iconColor: "#4D7CC4",
    iconBackground: "#EAF2FF",
  },
  {
    label: "Categories",
    subtitle: "View money movement",
    icon: "swap-horizontal-outline",
    iconColor: "#D18B35",
    iconBackground: "#FFF3E3",
  },
  {
    label: "Monthly Income",
    subtitle: "Manage budget source",
    icon: "cash-outline",
    iconColor: "#1F9D67",
    iconBackground: "#E8F8F0",
  },
  {
    label: "Transfers & Transactions",
    subtitle: "View money movement",
    icon: "swap-horizontal-outline",
    iconColor: "#D18B35",
    iconBackground: "#FFF3E3",
  },
  {
    label: "Calendar & Reminders",
    subtitle: "Meetings, bills & tasks",
    icon: "calendar-outline",
    iconColor: "#1C7D61",
    iconBackground: "#E8F5F1",
  },
  {
    label: "Analytics & Reports",
    subtitle: "Weekly, monthly & custom reports",
    icon: "bar-chart-outline",
    iconColor: "#4A6D87",
    iconBackground: "#EEF4F8",
  },
];

const appItems: MoreRowItem[] = [
  {
    label: "Settings",
    subtitle: "Privacy & notifications",
    icon: "settings-outline",
    iconColor: "#4B5563",
    iconBackground: "#EEF1F4",
  },
  {
    label: "Backup & Export",
    subtitle: "PDF, zip & cloud sync",
    icon: "cloud-upload-outline",
    iconColor: "#0E8AA5",
    iconBackground: "#E5F9FF",
  },
];

function MoreMenuRow({
  item,
  onPress,
}: {
  item: MoreRowItem;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="mt-3 flex-row items-center rounded-2xl border border-[#E9EEF0] bg-white px-4 py-3.5"
      style={{
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
      }}
    >
      <View
        className="mr-4 h-12 w-12 items-center justify-center rounded-xl"
        style={{ backgroundColor: item.iconBackground }}
      >
        <Ionicons name={item.icon} size={24} color={item.iconColor} />
      </View>

      <View className="flex-1">
        <Text
          className="text-[17px] font-bold text-[#1F2D2D]"
          style={{ fontFamily: "Roboto Condensed, sans-serif" }}
        >
          {item.label}
        </Text>
        <Text
          className="mt-1 text-[12px] font-medium uppercase tracking-[0.9px] text-[#7B8589]"
          style={{ fontFamily: "Roboto Condensed, sans-serif" }}
        >
          {item.subtitle}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#8E969B" />
    </Pressable>
  );
}

export default function More() {
  const router = useRouter();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 18,
        paddingTop: 20,
        paddingBottom: 80,
        backgroundColor: Colors.contentBackground,
      }}
      style={{ flex: 1, backgroundColor: Colors.contentBackground }}
    >
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <View className="mr-3 h-14 w-14 items-center justify-center rounded-xl bg-[#2F4E39]">
            <Text
              className="text-[30px] font-extrabold text-white"
              style={{ fontFamily: "Roboto Condensed, sans-serif" }}
            >
              D
            </Text>
          </View>

          <View>
            <Text
              className="text-[20px] font-bold text-[#1E2A2F]"
              style={{ fontFamily: "Roboto Condensed, sans-serif" }}
            >
              Dhivakar P
            </Text>
            <Text
              className="text-[10px] font-bold tracking-[1.5px] text-[#6E7A7F]"
              style={{ fontFamily: "Roboto Condensed, sans-serif" }}
            >
              PREMIUM MEMBER
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          className="h-10 w-10 items-center justify-center rounded-full bg-[#E9EEF0]"
        >
          <Ionicons name="create-outline" size={18} color="#3B4450" />
        </Pressable>
      </View>

      <View
        className="mb-5 overflow-hidden rounded-[24px] border border-[#E9EEF0] bg-white"
        style={{
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
          elevation: 2,
        }}
      >
        <View
          className="flex-row items-center justify-between px-5 py-4"
          style={{ backgroundColor: "#F7F3FF" }}
        >
          <View>
            <Text
              className="text-[10px] font-bold tracking-[1.4px] text-[#7C5CDA]"
              style={{ fontFamily: "Roboto Condensed, sans-serif" }}
            >
              MEMBER CARD
            </Text>
            <Text
              className="mt-1 text-[18px] font-bold text-[#1F2D2D]"
              style={{ fontFamily: "Roboto Condensed, sans-serif" }}
            >
              Premium Access
            </Text>
          </View>
          <View
            className="h-11 w-11 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "#E9DEF8" }}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={22}
              color="#5F3AC5"
            />
          </View>
        </View>

        <View className="flex-row gap-3 px-5 py-4">
          <View className="flex-1 rounded-2xl border border-[#E9EEF0] bg-[#F6F8F7] p-3">
            <Text
              className="text-[10px] font-bold tracking-[1.2px] text-[#7B8589]"
              style={{ fontFamily: "Roboto Condensed, sans-serif" }}
            >
              TOTAL
            </Text>
            <Text
              className="mt-1 text-[24px] font-extrabold text-[#1F2D2D]"
              style={{ fontFamily: "Roboto Condensed, sans-serif" }}
            >
              ₹24.8K
            </Text>
          </View>

          <View className="flex-1 rounded-2xl border border-[#E9EEF0] bg-[#F4FBF7] p-3">
            <Text
              className="text-[10px] font-bold tracking-[1.2px] text-[#7B8589]"
              style={{ fontFamily: "Roboto Condensed, sans-serif" }}
            >
              SAVED
            </Text>
            <Text
              className="mt-1 text-[24px] font-extrabold text-[#1F2D2D]"
              style={{ fontFamily: "Roboto Condensed, sans-serif" }}
            >
              ₹8.1K
            </Text>
          </View>
        </View>
      </View>

      <Text
        className="mt-3 mb-2 text-[11px] font-bold tracking-[1.5px] text-[#6A7176]"
        style={{ fontFamily: "Roboto Condensed, sans-serif" }}
      >
        ACCOUNT MANAGEMENT
      </Text>

      {accountItems.map((item) => (
        <MoreMenuRow
          key={item.label}
          item={item}
          onPress={
            item.label === "My Profile"
              ? () => router.push("/profile")
              : item.label === "Categories"
                ? () => router.push("/categories")
                : item.label === "Monthly Income"
                  ? () => router.push("/income")
                  : undefined
          }
        />
      ))}

      <Text
        className="mt-5 mb-2 text-[11px] font-bold tracking-[1.5px] text-[#6A7176]"
        style={{ fontFamily: "Roboto Condensed, sans-serif" }}
      >
        APP SETTINGS
      </Text>

      {appItems.map((item) => (
        <MoreMenuRow key={item.label} item={item} />
      ))}

      <Pressable
        className="mt-8 mb-4 flex-row items-center justify-center rounded-2xl border border-[#F0B7B7] bg-[#FBEAEA] px-5 py-4"
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Ionicons name="log-out-outline" size={20} color="#DD4B4B" />
        <Text
          className="ml-3 text-[16px] font-bold text-[#D94A4A]"
          style={{ fontFamily: "Roboto Condensed, sans-serif" }}
        >
          SIGN OUT ACCOUNT
        </Text>
      </Pressable>
    </ScrollView>
  );
}
