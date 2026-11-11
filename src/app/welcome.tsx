import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  CalendarDays,
  Fingerprint,
  ListChecks,
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
  const artSize = Math.min(width * 0.74, height * 0.37, 300);
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

  const goToPage = (nextPage: number) => {
    if (nextPage < 0 || nextPage >= pages.length) return;
    setPage(nextPage);
    scrollRef.current?.scrollTo({ x: width * nextPage, animated: true });
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <StatusBar style="dark" />
      <View style={{ flex: 1, paddingTop: 8 }}>
        <View
          style={{
            height: 48,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: Colors.deepForest, fontSize: 19, fontWeight: "800" }}>
            Life
          </Text>
          <Text style={{ color: "#27812D", fontSize: 19, fontWeight: "800" }}>
            Ledger
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() => void finishWelcome()}
            hitSlop={10}
            style={{ position: "absolute", right: 20, paddingVertical: 8 }}
          >
            <Text style={{ color: "#64746E", fontSize: 13, fontWeight: "600" }}>
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
                    borderRadius: artSize * 0.38,
                    backgroundColor: "#F1F8EA",
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
                      borderRadius: 22,
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
                  <View
                    style={{
                      position: "absolute",
                      bottom: artSize * 0.1,
                      left: artSize * 0.12,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      borderRadius: 20,
                      backgroundColor: "#FFFFFF",
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      shadowColor: "#1B4332",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.1,
                      shadowRadius: 8,
                      elevation: 3,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: "#3D9B3C",
                      }}
                    />
                    <Text
                      style={{
                        color: Colors.deepForest,
                        fontSize: 10,
                        fontWeight: "700",
                        letterSpacing: 0.8,
                      }}
                    >
                      {item.label}
                    </Text>
                  </View>
                </View>

                <Text
                  style={{
                    marginTop: 28,
                    color: "#0D2928",
                    fontSize: 25,
                    lineHeight: 32,
                    fontWeight: "800",
                    textAlign: "center",
                  }}
                >
                  {item.title}
                </Text>
                <Text
                  style={{
                    maxWidth: 340,
                    marginTop: 8,
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

        <View style={{ alignItems: "center", paddingBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            {pages.map((item, index) => (
              <View
                key={item.title}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: index === page ? "#187A27" : "#D7EAD4",
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

          <View
            style={{
              width: "100%",
              minHeight: 58,
              marginTop: 24,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => {
                if (page === pages.length - 1) {
                  void finishWelcome();
                } else {
                  goToPage(page + 1);
                }
              }}
              style={{
                minWidth: 140,
                minHeight: 48,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 26,
                backgroundColor: "#23852B",
                paddingHorizontal: 22,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>
                  Continue
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
