import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { getApiErrorMessage, getStoredToken, getStoredUser, logoutUser } from "../../api";
import ConfirmPopup from "../../components/ConfirmPopup";
import {
    getProfileImageUri,
    getProfileInitial,
    ProfileAvatar,
} from "../../components/ProfileAvatar";
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
      className="mt-5 flex-row items-center rounded-3xl border border-[#E9EEF0] bg-white px-4 py-5"
      style={{
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
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
          className="text-lg font-bold text-[#1F2D2D]"
          style={{ fontFamily: "Roboto Condensed, sans-serif" }}
        >
          {item.label}
        </Text>
        <Text
          className="mt-1 text-xs font-medium uppercase tracking-[0.9px] text-[#7B8589]"
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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [profileInitial, setProfileInitial] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([getStoredToken(), getStoredUser()]).then(
      ([token, user]) => {
        if (active) {
          setIsLoggedIn(!!token);
          setProfileImageUri(token ? getProfileImageUri(user) : null);
          setProfileInitial(token ? getProfileInitial(user) : null);
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const handleSignOut = async () => {
    setShowLogoutPopup(false);
    setIsSigningOut(true);
    try {
      await logoutUser();
      router.replace({
        pathname: "/auth/login",
        params: { successMessage: "Logged out successfully." },
      });
    } catch (error) {
      Alert.alert(
        "Sign out failed",
        getApiErrorMessage(error, "Please try again."),
      );
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 140,
        backgroundColor: Colors.contentBackground,
      }}
      style={{ flex: 1, backgroundColor: Colors.contentBackground }}
    >
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isLoggedIn ? "Open profile" : "Open login"}
            onPress={() => router.push(isLoggedIn ? "/profile" : "/auth/login")}
            className="mr-3 h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-[#2F4E39]"
          >
            <ProfileAvatar
              imageUri={profileImageUri}
              initial={profileInitial}
              size={56}
              iconColor={Colors.white}
            />
          </Pressable>

          <View>
            <Text
              className="text-xl font-bold text-[#1E2A2F]"
              style={{ fontFamily: "Roboto Condensed, sans-serif" }}
            >
              Dhivakar P
            </Text>
            <Text
              className="text-xs font-bold tracking-[1.5px] text-[#6E7A7F]"
              style={{ fontFamily: "Roboto Condensed, sans-serif" }}
            >
              PREMIUM MEMBER
            </Text>
          </View>
        </View>

       
      </View>

      <Text
        className="mt-3 mb-2 text-xs font-bold tracking-[1.5px] text-[#6A7176]"
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
                  : item.label === "Transfers & Transactions"
                    ? () => router.push("/transfers")
                    : item.label === "Calendar & Reminders"
                      ? () => router.push("/calendar")
                      : item.label === "Analytics & Reports"
                        ? () => router.push("/reports")
                        : undefined
          }
        />
      ))}

      <Text
        className="mt-5 mb-2 text-xs font-bold tracking-[1.5px] text-[#6A7176]"
        style={{ fontFamily: "Roboto Condensed, sans-serif" }}
      >
        APP SETTINGS
      </Text>

      {appItems.map((item) => (
        <MoreMenuRow key={item.label} item={item} />
      ))}

      <Pressable
        onPress={() => setShowLogoutPopup(true)}
        disabled={isSigningOut}
        className="mt-8 mb-4 flex-row items-center justify-center rounded-3xl border border-[#F0B7B7] bg-white px-5 py-5"
        style={{
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 2,
        }}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        accessibilityState={{ disabled: isSigningOut }}
      >
        <Ionicons name="log-out-outline" size={20} color="#DD4B4B" />
        <Text
          className="ml-3 text-base font-bold text-[#D94A4A]"
          style={{ fontFamily: "Roboto Condensed, sans-serif" }}
        >
          {isSigningOut ? "SIGNING OUT..." : "SIGN OUT ACCOUNT"}
        </Text>
      </Pressable>
      <ConfirmPopup
        visible={showLogoutPopup}
        type="logout"
        onConfirm={handleSignOut}
        onCancel={() => setShowLogoutPopup(false)}
        loading={isSigningOut}
      />
    </ScrollView>
  );
}
