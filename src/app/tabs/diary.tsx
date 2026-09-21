import { Text, View } from "react-native";
import { Colors } from "../../constants/colors";

export default function Diary() {
  return (
    <View
      className="flex-1 px-6 py-8"
      style={{ backgroundColor: Colors.contentBackground }}
    >
      <Text className="text-3xl font-bold" style={{ color: Colors.forest }}>
        Diary
      </Text>
      <Text className="mt-2 text-base" style={{ color: Colors.sage }}>
        A quiet place to reflect on today and make sense of yesterday.
      </Text>
      <View
        className="mt-8 rounded-3xl p-5"
        style={{ backgroundColor: Colors.white }}
      >
        <Text
          className="text-sm font-semibold uppercase tracking-widest"
          style={{ color: Colors.olive }}
        >
          Today
        </Text>
        <Text
          className="mt-3 text-lg font-semibold"
          style={{ color: Colors.forest }}
        >
          How was your day?
        </Text>
        <Text className="mt-1" style={{ color: Colors.sage }}>
          Write a few lines and make space for what matters.
        </Text>
      </View>
    </View>
  );
}
