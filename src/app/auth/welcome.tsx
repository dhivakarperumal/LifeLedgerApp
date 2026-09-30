import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image, ImageBackground, Pressable, Text, View } from "react-native";
import { GradientSafeAreaView as SafeAreaView } from "../../components/GradientSafeAreaView";
import { Colors } from "../../constants/colors";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-[#E8F5E9]">
      <StatusBar style="light" />
      <View className="flex-1">
        <ImageBackground
          source={require("../../../assets/images/bgbanner.png")}
          resizeMode="cover"
          className="flex-1 w-full justify-end"
        >
          {/* Overlay to ensure text readability */}
          <View className="absolute inset-0 bg-black/30" />
          
          <View className="px-6 pb-12 pt-8 bg-gradient-to-t from-black/80 to-transparent w-full">
            <View className="items-center mb-8">
              <View className="h-[100px] w-[100px] items-center justify-center rounded-[28px] overflow-hidden mb-5 shadow-lg border-2 border-white/20">
                <Image
                  source={require("../../../assets/images/logo.png")}
                  className="h-full w-full"
                  resizeMode="cover"
                  accessibilityLabel="Life Ledger logo"
                />
              </View>
              <Text className="text-4xl font-bold text-white text-center mb-2">
                Life <Text className="text-[#D7D83B]">Ledger</Text>
              </Text>
              <Text className="text-base text-white/90 text-center">
                Track Today · Build a Better Tomorrow
              </Text>
            </View>

            <View className="gap-4 w-full">
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/auth/login")}
                className="h-[56px] flex-row items-center bg-black justify-center rounded-2xl active:opacity-80"
              >
                <Text className="text-lg font-bold text-white">
                  Next
                </Text>
              </Pressable>
              
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/auth/login")}
                className="h-[56px] flex-row items-center justify-center rounded-2xl active:opacity-80"
              >
                <Text className="text-lg font-bold text-white/80">
                  Skip
                </Text>
              </Pressable>
            </View>
          </View>
        </ImageBackground>
      </View>
    </SafeAreaView>
  );
}
