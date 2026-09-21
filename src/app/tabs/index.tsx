import { Text, View } from "react-native";
import { Colors } from "../../constants/colors";

export default function Index() {
  return (
    <View
      className="flex-1 items-center justify-center px-6"
      style={{ backgroundColor: Colors.contentBackground }}
    >
     
      <Text className="mt-8 text-3xl font-bold" style={{ color: Colors.forest }}>
        Life Ledger
      </Text>
      <Text
        className="mt-2 text-center text-base"
        style={{ color: Colors.sage }}
      >
        Keep the moments that matter.
      </Text>
    </View>
  );
}
