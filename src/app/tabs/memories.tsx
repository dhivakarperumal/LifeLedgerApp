import { Text, View } from "react-native";
import { Colors } from "../../constants/colors";

export default function Memories() {
  return (
    <View
      className="flex-1 px-6 py-8"
      style={{ backgroundColor: Colors.contentBackground }}
    >
      <Text className="text-3xl font-bold" style={{ color: Colors.forest }}>
        Memories
      </Text>
      <Text className="mt-2 text-base" style={{ color: Colors.sage }}>
        Save the people, places, and moments you never want to lose.
      </Text>
      <View
        className="mt-8 rounded-3xl p-5"
        style={{ backgroundColor: Colors.white }}
      >
        <Text
          className="text-lg font-semibold"
          style={{ color: Colors.forest }}
        >
          Your memory wall is waiting
        </Text>
        <Text className="mt-1" style={{ color: Colors.sage }}>
          Add a photo or a note to make your first memory.
        </Text>
      </View>
    </View>
  );
}
