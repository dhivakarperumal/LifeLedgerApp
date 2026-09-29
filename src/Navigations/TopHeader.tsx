import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    Alert,
    Animated,
    Easing,
    Image,
    Modal,
    Pressable,
    ScrollView,
    Text,
    View,
    useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getStoredUser, logoutUser } from "../api";
import { Colors } from "../constants/colors";

type UserProfile = {
  name?: string;
  email?: string;
};

export function TopHeader() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [sideMenuVisible, setSideMenuVisible] = useState(false);
  const [sideMenuMounted, setSideMenuMounted] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [drawerPosition] = useState(() => new Animated.Value(-width));

  useEffect(() => {
    let cancelled = false;

    void getStoredUser().then((storedUser) => {
      if (!cancelled) {
        setUser(storedUser);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = user?.name?.trim() || user?.email?.trim() || "User";
  const userInitial = displayName.charAt(0).toUpperCase();
  const openSideMenu = () => {
    setSideMenuMounted(true);
    setSideMenuVisible(true);
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
    setSideMenuVisible(false);
    router.replace(path);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logoutUser();
    } finally {
      setMenuVisible(false);
      setIsLoggingOut(false);
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
          <Image
            source={require("../../assets/images/logo.png")}
            className="h-8 w-8 rounded-lg"
            resizeMode="cover"
            accessibilityLabel="Life Ledger logo"
          />
          <Text className="text-lg font-bold text-white">Life Ledger</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityLabel="Notifications"
            className="h-9 w-9 items-center justify-center rounded-full bg-white/15"
            onPress={() =>
              Alert.alert("Notifications", "You are all caught up.")
            }
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
            accessibilityLabel="Open profile menu"
            className="h-9 w-9 items-center justify-center rounded-full bg-[#ADBEA3]"
            onPress={() => setMenuVisible(true)}
          >
            <Text className="text-base font-bold text-[#264B2A]">
              {userInitial}
            </Text>
          </Pressable>
        </View>
      </View>

      <Modal
        animationType="none"
        onRequestClose={() => setSideMenuVisible(false)}
        transparent
        visible={sideMenuMounted}
      >
        <Pressable
          className="flex-1 flex-row bg-[rgba(0,0,0,0.35)]"
          onPress={() => setSideMenuVisible(false)}
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
                    onPress={() => setSideMenuVisible(false)}
                    className="h-10 w-10 items-center justify-center rounded-full border border-white/40 active:bg-white/15"
                  >
                    <Ionicons name="close" size={24} color={Colors.white} />
                  </Pressable>
                </View>

                <ScrollView className="flex-1 px-4 pt-6">
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
                router.push("/tabs/more");
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
              onPress={handleLogout}
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
    </>
  );
}
