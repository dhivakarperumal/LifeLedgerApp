import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { isLoggedIn } from "../api";
import { GradientSafeAreaView as SafeAreaView } from "../components/GradientSafeAreaView";
import { Colors } from "../constants/colors";

function WalletIllustration() {
  return (
    <View className="relative h-[132px] w-[160px]">
      <View className="absolute left-0 top-3 h-[30px] w-[136px] rounded-tl-[22px] rounded-tr-[4px] bg-[#7E3F20]" />
      <View
        className="absolute left-[36px] top-[-12px]"
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 38,
          borderLeftColor: "transparent",
          borderRightWidth: 38,
          borderRightColor: "transparent",
          borderBottomWidth: 48,
          borderBottomColor: "#82C51B",
        }}
      />
      <View
        className="absolute left-[54px] top-[-5px]"
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 20,
          borderLeftColor: "transparent",
          borderRightWidth: 20,
          borderRightColor: "transparent",
          borderBottomWidth: 32,
          borderBottomColor: "#A2D52A",
        }}
      />
      <View className="absolute left-0 top-[32px] h-[100px] w-[144px] rounded-tl-[16px] rounded-bl-[20px] rounded-br-[3px] bg-[#AE5E24]" />
      <View className="absolute right-0 top-[74px] h-[36px] w-[52px] rounded-[18px] bg-[#85421E]" />
      <View className="absolute right-0 top-[68px] h-[36px] w-[52px] items-center justify-center rounded-[18px] bg-[#FF9900]">
        <View className="h-4 w-4 rounded-full bg-[#FFD331]" />
      </View>
    </View>
  );
}

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
        className="h-[236px] w-[236px] items-center justify-center rounded-full"
        style={{
          backgroundColor: Colors.white,
          shadowColor: Colors.primaryDark,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.14,
          shadowRadius: 22,
          elevation: 8,
        }}
      >
        <WalletIllustration />
      </View>
      <Text
        className="mt-12 text-3xl font-bold tracking-[1.5px]"
        style={{ color: Colors.loadingText }}
      >
        LifeLedger
      </Text>
      <Text
        className="mt-3 text-lg font-semibold"
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
