import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LogOut, UserRound } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
    Animated,
    Easing,
    Image,
    Modal,
    Pressable,
    ScrollView,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import api, { getStoredToken, getStoredUser, logoutUser } from "../api";
import ConfirmPopup from "../components/ConfirmPopup";
import { parseLocalDate } from "../components/dateTimeUtils";
import { GradientSafeAreaView as SafeAreaView } from "../components/GradientSafeAreaView";
import {
    getProfileImageUri,
    getProfileInitial,
    ProfileAvatar,
} from "../components/ProfileAvatar";
import { Colors } from "../constants/colors";

type UserProfile = {
  name?: string;
  email?: string;
} & import("../components/ProfileAvatar").UserWithProfileImage;

type NotificationItem = {
  id: number | string;
  name: string;
  type: string;
  date: string;
  time: string;
};

function notificationDateKey(value?: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parsed = parseLocalDate(value);
  return parsed
    ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`
    : "";
}

function formatNotificationDate(value?: string) {
  if (!value) return "";
  const parsed = parseLocalDate(value);
  if (!parsed) return value;
  return parsed.toLocaleDateString("en-CA");
}

export function TopHeader({ showLogo = true }: { showLogo?: boolean } = {}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sideMenuVisible, setSideMenuVisible] = useState(false);
  const [sideMenuMounted, setSideMenuMounted] = useState(false);
  const [sidebarProfileMenuVisible, setSidebarProfileMenuVisible] =
    useState(false);
  const [sidebarProfileMenuAnimation] = useState(
    () => new Animated.Value(0),
  );
  const [menuVisible, setMenuVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const [drawerPosition] = useState(() => new Animated.Value(-width));

  useEffect(() => {
    let cancelled = false;

    void Promise.all([getStoredToken(), getStoredUser()]).then(
      ([token, storedUser]) => {
        if (!cancelled) {
          setIsLoggedIn(!!token);
          setUser(storedUser);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = user?.name?.trim() || user?.email?.trim() || "User";
  const profileImageUri = isLoggedIn ? getProfileImageUri(user) : null;
  const profileInitial = isLoggedIn ? getProfileInitial(user) : null;

  useEffect(() => {
    Animated.timing(sidebarProfileMenuAnimation, {
      toValue: sidebarProfileMenuVisible ? 1 : 0,
      duration: sidebarProfileMenuVisible ? 180 : 140,
      easing: sidebarProfileMenuVisible
        ? Easing.out(Easing.cubic)
        : Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [sidebarProfileMenuAnimation, sidebarProfileMenuVisible]);

  useEffect(() => {
    let cancelled = false;

    const loadNotifications = async () => {
      try {
        const [eventsResponse, remindersResponse] = await Promise.all([
          api.get("/calendar/events").catch(() => ({ data: [] })),
          api.get("/calendar/reminders").catch(() => ({ data: [] })),
        ]);

        if (cancelled) return;

        const normalizeItem = (item: any): NotificationItem | null => {
          const date =
            item?.startDate ||
            item?.start_date ||
            item?.event_date ||
            item?.date ||
            item?.reminderDate ||
            item?.reminder_date ||
            "";
          const time =
            item?.startTime ||
            item?.start_time ||
            item?.reminderTime ||
            item?.reminder_time ||
            "";

          if (!item?.title && !item?.name) return null;

          return {
            id:
              item?.id ??
              `${item?.title ?? item?.name ?? "event"}-${date}-${time}`,
            name: item?.title || item?.name || "Upcoming Event",
            type: (item?.category || item?.type || "EVENT").toUpperCase(),
            date: date ? formatNotificationDate(date) : "",
            time: time || "All day",
          };
        };

        const events = Array.isArray(eventsResponse?.data)
          ? eventsResponse.data
          : Array.isArray(eventsResponse?.data?.data)
            ? eventsResponse.data.data
            : [];
        const reminders = Array.isArray(remindersResponse?.data)
          ? remindersResponse.data
          : Array.isArray(remindersResponse?.data?.data)
            ? remindersResponse.data.data
            : [];

        const upcoming = [...events, ...reminders]
          .map(normalizeItem)
          .filter((item): item is NotificationItem => !!item)
          .filter((item) => item.date || item.time)
          .sort((a, b) => {
            const dateDiff = (
              notificationDateKey(a.date) || "9999-99-99"
            ).localeCompare(notificationDateKey(b.date) || "9999-99-99");
            if (dateDiff !== 0) return dateDiff;
            return (a.time || "99:99").localeCompare(b.time || "99:99");
          })
          .slice(0, 3);

        setNotifications(upcoming);
      } catch {
        if (!cancelled) setNotifications([]);
      }
    };

    void loadNotifications();

    return () => {
      cancelled = true;
    };
  }, []);

  const openSideMenu = () => {
    setSidebarProfileMenuVisible(false);
    setSideMenuMounted(true);
    setSideMenuVisible(true);
  };

  const closeSideMenu = () => {
    setSidebarProfileMenuVisible(false);
    setSideMenuVisible(false);
  };

  useEffect(() => {
    if (sideMenuVisible) {
      drawerPosition.setValue(-width);
      Animated.timing(drawerPosition, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }).start();
      return;
    }

    if (sideMenuMounted) {
      Animated.timing(drawerPosition, {
        duration: 220,
        easing: Easing.in(Easing.cubic),
        toValue: -width,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setSideMenuMounted(false);
        }
      });
    }
  }, [drawerPosition, sideMenuMounted, sideMenuVisible, width]);

  const navigateFromMenu = (
    path:
      | "/tabs"
      | "/tabs/expenses"
      | "/tabs/memories"
      | "/tabs/diary"
      | "/tabs/more"
      | "/categories"
      | "/income"
      | "/transfers"
      | "/calendar"
      | "/reports",
  ) => {
    setSidebarProfileMenuVisible(false);
    setSideMenuVisible(false);
    router.replace(path);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logoutUser();
      setIsLoggedIn(false);
      setUser(null);
    } finally {
      setMenuVisible(false);
      setSidebarProfileMenuVisible(false);
      setSideMenuVisible(false);
      setIsLoggingOut(false);
      setShowLogoutPopup(false);
      router.replace("/auth/login");
    }
  };

  return (
    <>
      <View className="w-full flex-1 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityLabel="Open navigation menu"
            className="mr-1 h-9 w-9 items-center justify-center rounded-full bg-white/15"
            onPress={openSideMenu}
          >
            <View className="items-start gap-[3px]">
              <View className="h-1 w-6 rounded-full bg-white" />
              <View className="h-1 w-4 rounded-full bg-white" />
              <View className="h-1 w-6 rounded-full bg-white" />
            </View>
          </Pressable>
          {showLogo && (
            <Image
              source={require("../../assets/images/logo.png")}
              className="h-8 w-8 rounded-lg"
              resizeMode="cover"
              accessibilityLabel="Life Ledger logo"
            />
          )}
          <Text className="text-lg font-bold text-white">Life Ledger</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityLabel="Notifications"
            className="h-9 w-9 items-center justify-center rounded-full bg-white/15"
            onPress={() => setNotificationsVisible(true)}
          >
            <Ionicons
              name="notifications-outline"
              size={19}
              color={Colors.white}
            />
            <View className="absolute right-0 top-0 h-4 w-4 items-center justify-center rounded-full bg-[#E74C4C]">
              <Text className="text-[9px] font-bold text-white">3</Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open account menu"
            className="h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#ADBEA3]"
            onPress={() => setMenuVisible(true)}
          >
            <ProfileAvatar
              imageUri={profileImageUri}
              initial={profileInitial}
              size={36}
              iconColor="#264B2A"
            />
          </Pressable>
        </View>
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={notificationsVisible}
        onRequestClose={() => setNotificationsVisible(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-[rgba(9,18,11,0.56)] px-6"
          onPress={() => setNotificationsVisible(false)}
        >
          <Pressable
            className="w-full overflow-hidden rounded-[30px] bg-[#F4F5F3] p-6 shadow-2xl"
            onPress={(event) => event.stopPropagation()}
            style={{ maxWidth: 440, marginVertical: 28 }}
          >
            <View className="mb-4 flex-row items-center justify-between gap-3">
              <Text className="text-[18px] font-black text-[#1D2B1D]">
                Notifications
              </Text>
              <View className="flex-row items-center gap-2">
                <View className="rounded-full border border-[#E74C4C] bg-[#FDE7E7] px-2.5 py-1.5">
                  <Text className="text-[8px] font-bold text-[#E74C4C]">
                    {notifications.length || 0} UPCOMING
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Close notifications"
                  onPress={() => setNotificationsVisible(false)}
                  className="h-9 w-9 items-center justify-center rounded-full border border-[#D7DDD8] bg-[#EEF2EF]"
                >
                  <Ionicons name="close" size={18} color="#1D2B1D" />
                </Pressable>
              </View>
            </View>

            <View className="mt-1 gap-3">
              {notifications.length > 0 ? (
                notifications.map((item) => (
                  <View
                    key={item.id}
                    className="border-b border-[#D7DDD8] pb-3"
                  >
                    <View className="flex-row items-end justify-between gap-3">
                      <Text className="flex-1 text-[13px] font-black text-[#1D2B1D]">
                        {item.name}
                      </Text>
                      <Text className="text-[10px] font-medium text-[#5D6A5D]">
                        {item.date}
                        {item.time ? ` • ${item.time}` : ""}
                      </Text>
                    </View>
                    <Text className="mt-1 text-[9px] font-bold tracking-[1.2px] text-[#5D6A5D]">
                      {item.type}
                    </Text>
                  </View>
                ))
              ) : (
                <View className="items-center justify-center py-4">
                  <Text className="text-[14px] font-medium text-[#5D6A5D]">
                    No upcoming events found.
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              className="mt-6 items-center justify-center rounded-[22px] bg-[#366039] px-4 py-4"
              onPress={() => {
                setNotificationsVisible(false);
                router.push("/calendar");
              }}
            >
              <Text className="text-[13px] font-bold uppercase tracking-[1px] text-white">
                Manage Reminders
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        animationType="none"
        onRequestClose={closeSideMenu}
        transparent
        visible={sideMenuMounted}
      >
        <Pressable
          className="flex-1 flex-row bg-[rgba(0,0,0,0.35)]"
          onPress={closeSideMenu}
        >
          <Animated.View
            className="h-full bg-[#264B2A] shadow-2xl"
            style={{
              width,
              transform: [{ translateX: drawerPosition }],
            }}
          >
            <Pressable
              className="flex-1"
              onPress={(event) => event.stopPropagation()}
            >
              <SafeAreaView
                className="flex-1 bg-[#264B2A]"
                edges={["top", "bottom"]}
              >
                <View className="flex-row items-center justify-between border-b border-[#447449] px-5 pb-5 pt-3">
                  <View className="flex-row items-center gap-3">
                    <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#366039]">
                      <Image
                        source={require("../../assets/images/logo.png")}
                        className="h-9 w-9 rounded-xl"
                        resizeMode="contain"
                        accessibilityLabel="Life Ledger logo"
                      />
                    </View>
                    <View>
                      <Text className="text-lg font-bold text-white">
                        Life Ledger
                      </Text>
                      <Text className="text-xs text-[#ADBEA3]">
                        Your daily companion
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close navigation menu"
                    onPress={closeSideMenu}
                    className="h-10 w-10 items-center justify-center rounded-full border border-white/40 active:bg-white/15"
                  >
                    <Ionicons name="close" size={24} color={Colors.white} />
                  </Pressable>
                </View>

                <ScrollView className="flex-1 px-4 pt-6">
                  <View className="mb-5">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Open profile menu"
                      accessibilityState={{
                        expanded: sidebarProfileMenuVisible,
                      }}
                      className="flex-row items-center rounded-2xl bg-[#366039] p-3"
                      onPress={() =>
                        setSidebarProfileMenuVisible((visible) => !visible)
                      }
                    >
                      <View className="mr-3 h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#ADBEA3]">
                        <ProfileAvatar
                          imageUri={profileImageUri}
                          initial={profileInitial}
                          size={40}
                          iconColor="#264B2A"
                        />
                      </View>
                      <Text className="flex-1 text-sm font-semibold text-white">
                        {isLoggedIn ? displayName : "Log in"}
                      </Text>
                      <Ionicons
                        name={
                          sidebarProfileMenuVisible
                            ? "chevron-up"
                            : "chevron-down"
                        }
                        size={18}
                        color={Colors.primaryLight}
                      />
                    </Pressable>
                    <Animated.View
                      pointerEvents={
                        sidebarProfileMenuVisible ? "auto" : "none"
                      }
                      style={{
                        height: sidebarProfileMenuAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 116],
                        }),
                        opacity: sidebarProfileMenuAnimation,
                        overflow: "hidden",
                        transform: [
                          {
                            translateY:
                              sidebarProfileMenuAnimation.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-8, 0],
                              }),
                          },
                        ],
                      }}
                    >
                      <View className="mt-2 rounded-2xl border border-[#447449] bg-[#F4F6F3] p-2">
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Profile"
                          className="min-h-11 flex-row items-center rounded-xl px-3 py-3 active:bg-[#E5EAE7]"
                          onPress={() => {
                            setSidebarProfileMenuVisible(false);
                            setSideMenuVisible(false);
                            router.push(
                              isLoggedIn ? "/profile" : "/auth/login",
                            );
                          }}
                        >
                          <UserRound size={19} color={Colors.primary} />
                          <Text className="ml-3 text-sm font-semibold text-[#263238]">
                            Profile
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Logout"
                          disabled={isLoggingOut}
                          className="min-h-11 flex-row items-center rounded-xl px-3 py-3 active:bg-[#FDECEC]"
                          onPress={() => {
                            setSidebarProfileMenuVisible(false);
                            setSideMenuVisible(false);
                            setShowLogoutPopup(true);
                          }}
                        >
                          <LogOut size={19} color={Colors.danger} />
                          <Text className="ml-3 text-sm font-semibold text-[#E74C4C]">
                            Logout
                          </Text>
                        </Pressable>
                      </View>
                    </Animated.View>
                  </View>
                  {[
                    ["Home", "home-outline", "/tabs"],
                    ["Expenses", "wallet-outline", "/tabs/expenses"],
                    ["Memories", "images-outline", "/tabs/memories"],
                    ["Diary", "book-outline", "/tabs/diary"],
                    ["Categories", "pricetag-outline", "/categories"],
                    ["Monthly Income", "cash-outline", "/income"],
                    [
                      "Transfers & Transactions",
                      "swap-horizontal-outline",
                      "/transfers",
                    ],
                    ["Calendar", "calendar-outline", "/calendar"],
                    ["Reports", "bar-chart-outline", "/reports"],
                    ["Settings", "settings-outline", "/tabs/more"],
                    ["More", "grid-outline", "/tabs/more"],
                  ].map(([label, icon, path]) => (
                    <Pressable
                      key={label}
                      accessibilityRole="button"
                      className="active:bg-[#366039] mb-2 flex-row items-center rounded-2xl px-4 py-4"
                      onPress={() =>
                        navigateFromMenu(
                          path as
                            | "/tabs"
                            | "/tabs/expenses"
                            | "/tabs/memories"
                            | "/tabs/diary"
                            | "/tabs/more"
                            | "/categories"
                            | "/income"
                            | "/transfers"
                            | "/calendar"
                            | "/reports",
                        )
                      }
                    >
                      <Ionicons
                        name={icon as never}
                        size={23}
                        color={Colors.accent}
                      />
                      <Text className="ml-4 text-base font-semibold text-white">
                        {label}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={Colors.primaryLight}
                        className="ml-auto"
                      />
                    </Pressable>
                  ))}
                </ScrollView>
              </SafeAreaView>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
        transparent
        visible={menuVisible}
      >
        <Pressable
          className="flex-1 bg-[rgba(0,0,0,0.18)]"
          onPress={() => setMenuVisible(false)}
        >
          <Pressable
            className="absolute right-4 top-16 w-56 rounded-2xl bg-white p-2 shadow-2xl"
            onPress={(event) => event.stopPropagation()}
          >
            <View className="border-b border-[#E5EAE7] px-3 pb-3 pt-2">
              <Text className="text-xs font-semibold uppercase text-[#7B8589]">
                Account
              </Text>
              <Text className="mt-1 text-base font-bold text-[#263238]">
                {displayName}
              </Text>
              {user?.email && user.email !== displayName && (
                <Text className="mt-1 text-xs text-[#7B8589]">
                  {user.email}
                </Text>
              )}
            </View>
            <Pressable
              className="mt-1 flex-row items-center rounded-xl px-3 py-3"
              onPress={() => {
                setMenuVisible(false);
                router.push(isLoggedIn ? "/profile" : "/auth/login");
              }}
            >
              <Ionicons
                name="person-outline"
                size={20}
                color={Colors.primary}
              />
              <Text className="ml-3 text-sm font-semibold text-[#263238]">
                Profile
              </Text>
            </Pressable>
            <Pressable
              className="flex-row items-center rounded-xl px-3 py-3"
              disabled={isLoggingOut}
              onPress={() => {
                setMenuVisible(false);
                setShowLogoutPopup(true);
              }}
            >
              <Ionicons
                name="log-out-outline"
                size={20}
                color={Colors.danger}
              />
              <Text className="ml-3 text-sm font-semibold text-[#E74C4C]">
                {isLoggingOut ? "Logging out..." : "Logout"}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <ConfirmPopup
        visible={showLogoutPopup}
        type="logout"
        loading={isLoggingOut}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutPopup(false)}
      />
    </>
  );
}
