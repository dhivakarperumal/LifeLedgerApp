import { Text, View } from "react-native";
import { Colors } from "../../constants/colors";

export default function More() {
  return (
    <View
      className="flex-1 px-6 py-8"
      style={{ backgroundColor: Colors.contentBackground }}
    >
      <Text className="text-3xl font-bold" style={{ color: Colors.forest }}>
        More
      </Text>
      <Text className="mt-2 text-base" style={{ color: Colors.sage }}>
        Manage your preferences and make Life Ledger yours.
      </Text>
      <View
        className="mt-8 rounded-3xl p-5"
        style={{ backgroundColor: Colors.white }}
      >
        <Text
          className="text-lg font-semibold"
          style={{ color: Colors.forest }}
        >
          Settings
        </Text>
        <Text className="mt-1" style={{ color: Colors.sage }}>
          More tools and preferences will live here.
        </Text>
      </View>
    </View>
  );
}
