import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Image, View } from "react-native";
import { isLoggedIn } from "../api";

export function LoadingScreen() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const redirect = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1800));
      const loggedIn = await isLoggedIn().catch(() => false);

      if (!cancelled) {
        router.replace(loggedIn ? "/tabs" : "/auth/welcome");
      }
    };

    void redirect();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View className="flex-1 bg-[#F5F8F2]">
      <StatusBar hidden />
      <Image
        source={require("../../assets/images/loading_bg.png")}
        style={{ width: "100%", height: "100%" }}
        resizeMode="cover"
      />
    </View>
  );
}
