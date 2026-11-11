import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  CalendarDays,
  Fingerprint,
  ListChecks,
  LogIn,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react-native";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../constants/colors";
import { WELCOME_COMPLETED_STORAGE_KEY } from "../constants/storageKeys";

const pages = [
  {
    title: "Track Your Life",
    description:
      "Manage your expenses, income, tasks, diary and daily life in one place.",
    label: "YOUR LIFE, IN ONE PLACE",
    icon: Wallet,
    accentIcon: TrendingUp,
  },
  {
    title: "Stay Organized",
    description:
      "Plan your day, set reminders, create to-do lists and never miss what matters.",
    label: "MAKE EVERY DAY COUNT",
    icon: ListChecks,
    accentIcon: CalendarDays,
  },
  {
    title: "Your Data, Always Safe",
    description:
      "Protect your personal information with PIN, Pattern or Password security.",
    label: "YOUR PRIVACY COMES FIRST",
    icon: ShieldCheck,
    accentIcon: Fingerprint,
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const artSize = Math.min(width * 0.76, height * 0.34, 300);
  const finishWelcome = async () => {
    if (saving) return;
    setSaving(true);
    setError("");

    try {
      await AsyncStorage.setItem(WELCOME_COMPLETED_STORAGE_KEY, "true");
      router.replace("/auth/login");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Your progress could not be saved. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: "#FFFAF4" }}>
      <StatusBar style="dark" />
      <View style={{ flex: 1 }}>
        <View
          style={{
            height: 54,
            alignItems: "flex-end",
            justifyContent: "center",
            paddingHorizontal: 20,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip welcome and go to login"
            disabled={saving}
            onPress={() => void finishWelcome()}
            style={({ pressed }) => ({
              minWidth: 76,
              minHeight: 38,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "#D8D0BA",
              borderRadius: 22,
              backgroundColor: pressed ? "#F2F5EA" : "#FFFFFF",
              paddingHorizontal: 16,
              shadowColor: "#244B3D",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: pressed ? 0 : 0.08,
              shadowRadius: 5,
              elevation: pressed ? 0 : 2,
              opacity: saving ? 0.6 : 1,
            })}
          >
            <Text style={{ color: "#244B3D", fontSize: 13, fontWeight: "700" }}>
              Skip
            </Text>
          </Pressable>
        </View>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            setPage(Math.round(event.nativeEvent.contentOffset.x / width));
          }}
          style={{ flex: 1 }}
        >
          {pages.map((item, index) => {
            const PageIcon = item.icon;
            const PageAccentIcon = item.accentIcon;

            return (
              <View
                key={item.title}
                style={{
                  width,
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 28,
                  paddingBottom: 8,
                }}
              >
                <View
                  style={{
                    width: artSize,
                    height: artSize,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: artSize * 0.34,
                    backgroundColor: "#F2F5EA",
                  }}
                >
                  <View
                    style={{
                      position: "absolute",
                      top: artSize * 0.12,
                      right: artSize * 0.12,
                      width: artSize * 0.26,
                      height: artSize * 0.26,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: artSize * 0.09,
                      backgroundColor: "#FFFFFF",
                      shadowColor: "#1B4332",
                      shadowOffset: { width: 0, height: 5 },
                      shadowOpacity: 0.1,
                      shadowRadius: 10,
                      elevation: 3,
                    }}
                  >
                    <PageAccentIcon
                      size={artSize * 0.12}
                      color="#3D9B3C"
                      strokeWidth={2.2}
                    />
                  </View>
                  <View
                    style={{
                      width: artSize * 0.48,
                      height: artSize * 0.48,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: artSize * 0.18,
                      backgroundColor: "#FFFFFF",
                      shadowColor: "#1B4332",
                      shadowOffset: { width: 0, height: 12 },
                      shadowOpacity: 0.14,
                      shadowRadius: 18,
                      elevation: 7,
                    }}
                  >
                    <PageIcon
                      size={artSize * 0.29}
                      color={index === 2 ? "#27812D" : Colors.deepForest}
                      strokeWidth={1.7}
                    />
                  </View>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 24,
                  }}
                >
                  <View style={{ width: 28, height: 1.5, backgroundColor: "#C9A34E" }} />
                  <Text
                    style={{
                      color: Colors.deepForest,
                      fontSize: 10,
                      fontWeight: "800",
                      letterSpacing: 2,
                    }}
                  >
                    {item.label}
                  </Text>
                  <View style={{ width: 28, height: 1.5, backgroundColor: "#C9A34E" }} />
                </View>
                <Text
                  style={{
                    marginTop: 14,
                    color: "#0D2928",
                    fontSize: 29,
                    lineHeight: 36,
                    fontWeight: "800",
                    textAlign: "center",
                  }}
                >
                  {item.title}
                </Text>
                <Text
                  style={{
                    maxWidth: 340,
                    marginTop: 10,
                    color: "#475569",
                    fontSize: 15,
                    lineHeight: 23,
                    textAlign: "center",
                  }}
                >
                  {item.description}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        <View style={{ alignItems: "center", paddingHorizontal: 20, paddingBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            {pages.map((item, index) => (
              <View
                key={item.title}
                style={{
                  width: index === page ? 28 : 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: index === page ? "#064D3B" : "#E7D5A5",
                }}
              />
            ))}
          </View>

          {error ? (
            <Text
              accessibilityRole="alert"
              style={{
                marginTop: 10,
                color: "#B42318",
                fontSize: 13,
                textAlign: "center",
              }}
            >
              {error}
            </Text>
          ) : null}

          <View style={{ width: "100%", marginTop: 24 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Log in to Life Ledger"
              disabled={saving}
              onPress={() => void finishWelcome()}
              style={({ pressed }) => ({
                width: "100%",
                minHeight: 52,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                borderWidth: 1,
                borderColor: "#C9A34E",
                borderRadius: 28,
                backgroundColor: pressed ? "#123F33" : "#064D3B",
                paddingHorizontal: 12,
                opacity: saving ? 0.7 : 1,
                shadowColor: "#064D3B",
                shadowOffset: { width: 0, height: 5 },
                shadowOpacity: pressed ? 0.08 : 0.16,
                shadowRadius: 9,
                elevation: pressed ? 2 : 4,
              })}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <LogIn size={17} color="#FFFFFF" strokeWidth={2.3} />
              )}
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "800" }}>
                Log in
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
