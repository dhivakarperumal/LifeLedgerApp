import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  Text,
  View,
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
  const [user, setUser] = useState<UserProfile | null>(null);
  const [sideMenuVisible, setSideMenuVisible] = useState(false);
  const [sideMenuMounted, setSideMenuMounted] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const drawerPosition = useRef(new Animated.Value(-320)).current;

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

  useEffect(() => {
    if (sideMenuVisible) {
      setSideMenuMounted(true);
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
        toValue: -320,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setSideMenuMounted(false);
        }
      });
    }
  }, [drawerPosition, sideMenuMounted, sideMenuVisible]);

  const navigateFromMenu = (
    path:
      | "/tabs"
      | "/tabs/expenses"
      | "/tabs/memories"
      | "/tabs/diary"
      | "/tabs/more",
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
      <View className="flex-1 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityLabel="Open navigation menu"
            className="mr-1 h-9 w-9 items-center justify-center rounded-full"
            onPress={() => setSideMenuVisible(true)}
            style={{ backgroundColor: "rgba(255,255,255,0.14)" }}
          >
            <Ionicons name="menu-outline" size={23} color={Colors.white} />
          </Pressable>
          <Image
            source={require("../../assets/images/logo.png")}
            className="h-8 w-8 rounded-lg"
            resizeMode="cover"
            accessibilityLabel="Life Ledger logo"
          />
          <Text className="text-lg font-bold" style={{ color: "#FFFFFF" }}>
            Life Ledger
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityLabel="Notifications"
            className="h-9 w-9 items-center justify-center rounded-full"
            onPress={() =>
              Alert.alert("Notifications", "You are all caught up.")
            }
            style={{ backgroundColor: "rgba(255,255,255,0.14)" }}
          >
            <Ionicons
              name="notifications-outline"
              size={19}
              color={Colors.white}
            />
            <View
              className="absolute right-0 top-0 h-4 w-4 items-center justify-center rounded-full"
              style={{ backgroundColor: Colors.danger }}
            >
              <Text
                className="text-[9px] font-bold"
                style={{ color: Colors.white }}
              >
                3
              </Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityLabel="Open profile menu"
            className="h-9 w-9 items-center justify-center rounded-full"
            onPress={() => setMenuVisible(true)}
            style={{ backgroundColor: Colors.primaryLight }}
          >
            <Text
              className="text-base font-bold"
              style={{ color: Colors.primaryDark }}
            >
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
          className="flex-1 flex-row"
          onPress={() => setSideMenuVisible(false)}
          style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
        >
          <Animated.View
            className="w-80"
            style={{
              backgroundColor: Colors.white,
              elevation: 14,
              transform: [{ translateX: drawerPosition }],
            }}
          >
            <Pressable
              className="flex-1"
              onPress={(event) => event.stopPropagation()}
            >
              <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
              <View
                className="flex-row items-center justify-between border-b px-5 pb-5 pt-3"
                style={{ borderColor: Colors.border }}
              >
                <View className="flex-row items-center gap-3">
                  <View
                    className="h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: Colors.bgCard }}
                  >
                    <Image
                      source={require("../../assets/images/logo.png")}
                      className="h-9 w-9"
                      resizeMode="contain"
                      accessibilityLabel="Life Ledger logo"
                    />
                  </View>
                  <View>
                    <Text
                      className="text-lg font-bold"
                      style={{ color: Colors.textPrimary }}
                    >
                      Life Ledger
                    </Text>
                    <Text
                      className="text-xs"
                      style={{ color: Colors.textMuted }}
                    >
                      Your daily companion
                    </Text>
                  </View>
                </View>
                <Pressable
                  accessibilityLabel="Close navigation menu"
                  onPress={() => setSideMenuVisible(false)}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={Colors.textSecondary}
                  />
                </Pressable>
              </View>

              <View className="px-4 pt-6">
                {[
                  ["Home", "home-outline", "/tabs"],
                  ["Expenses", "wallet-outline", "/tabs/expenses"],
                  ["Memories", "images-outline", "/tabs/memories"],
                  ["Diary", "book-outline", "/tabs/diary"],
                  ["More", "grid-outline", "/tabs/more"],
                ].map(([label, icon, path]) => (
                  <Pressable
                    key={label}
                    accessibilityRole="button"
                    className="mb-2 flex-row items-center rounded-2xl px-4 py-4"
                    onPress={() =>
                      navigateFromMenu(
                        path as
                          | "/tabs"
                          | "/tabs/expenses"
                          | "/tabs/memories"
                          | "/tabs/diary"
                          | "/tabs/more",
                      )
                    }
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? Colors.bgCard : "transparent",
                    })}
                  >
                    <Ionicons
                      name={icon as never}
                      size={23}
                      color={Colors.primary}
                    />
                    <Text
                      className="ml-4 text-base font-semibold"
                      style={{ color: Colors.textPrimary }}
                    >
                      {label}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={Colors.textMuted}
                      style={{ marginLeft: "auto" }}
                    />
                  </Pressable>
                ))}
              </View>
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
          className="flex-1"
          onPress={() => setMenuVisible(false)}
          style={{ backgroundColor: "rgba(0,0,0,0.18)" }}
        >
          <Pressable
            className="absolute right-4 top-16 w-56 rounded-2xl p-2"
            onPress={(event) => event.stopPropagation()}
            style={{
              backgroundColor: Colors.white,
              elevation: 8,
              shadowColor: Colors.primaryDark,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.18,
              shadowRadius: 12,
            }}
          >
            <View
              className="border-b px-3 pb-3 pt-2"
              style={{ borderColor: Colors.border }}
            >
              <Text
                className="text-xs font-semibold uppercase"
                style={{ color: Colors.textMuted }}
              >
                Account
              </Text>
              <Text
                className="mt-1 text-base font-bold"
                style={{ color: Colors.textPrimary }}
              >
                {displayName}
              </Text>
              {user?.email && user.email !== displayName && (
                <Text
                  className="mt-1 text-xs"
                  style={{ color: Colors.textMuted }}
                >
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
              <Text
                className="ml-3 text-sm font-semibold"
                style={{ color: Colors.textPrimary }}
              >
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
              <Text
                className="ml-3 text-sm font-semibold"
                style={{ color: Colors.danger }}
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
