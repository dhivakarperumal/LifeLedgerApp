import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../constants/colors";

export function LoadingScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.replace("/tabs"), 1800);
    return () => clearTimeout(timer);
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
