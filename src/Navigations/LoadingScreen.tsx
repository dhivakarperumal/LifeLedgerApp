import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isLoggedIn } from "../api";
import { Colors } from "../constants/colors";

export function LoadingScreen() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const redirect = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1800));
      const loggedIn = await isLoggedIn().catch(() => false);

      if (!cancelled) {
        router.replace(loggedIn ? "/tabs" : "/auth/login");
      }
    };

    void redirect();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      className="flex-1 items-center justify-center"
      style={{ backgroundColor: Colors.loadingBackground }}
    >
      <StatusBar style="dark" />
      <View
        className="h-60 w-60 items-center justify-center rounded-full"
        style={{
          backgroundColor: Colors.white,
          shadowColor: Colors.primaryDark,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.14,
          shadowRadius: 22,
          elevation: 8,
        }}
      >
        <SymbolView
          name="wallet.pass"
          tintColor={Colors.primaryDark}
          size={92}
          weight="regular"
        />
      </View>
      <Text
        className="mt-12 text-4xl font-bold"
        style={{ color: Colors.loadingText }}
      >
        Life Ledger
      </Text>
      <Text
        className="mt-3 text-2xl font-semibold"
        style={{ color: Colors.loadingMuted }}
      >
        Syncing your workspace...
      </Text>
      <ActivityIndicator
        className="mt-12"
        size="large"
        color={Colors.primaryDark}
      />
    </SafeAreaView>
  );
}
