import { Image, Text, View } from "react-native";
import { Colors } from "../constants/colors";

export function TopHeader() {
  return (
    <View className="flex-row items-center gap-2">
      <Image
        source={require("../../assets/images/logo.png")}
        className="h-8 w-8 rounded-lg"
        resizeMode="cover"
        accessibilityLabel="Life Ledger logo"
      />
      <Text className="text-lg font-bold" style={{ color: Colors.primary }}>
        Life Ledger
      </Text>
    </View>
  );
}
