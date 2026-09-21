import { Text, View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../constants/colors";

export default function Memories() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: Colors.contentBackground }}
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: insets.bottom + 100, // clear the floating bottom tab bar
      }}
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
          className="text-sm font-semibold uppercase tracking-widest"
          style={{ color: Colors.olive }}
        >
          Your memories
        </Text>
        <Text
          className="mt-3 text-lg font-semibold"
          style={{ color: Colors.forest }}
        >
          Your memory wall is waiting
        </Text>
        <Text className="mt-1" style={{ color: Colors.sage }}>
          Add a photo or a note to make your first memory.
        </Text>
      </View>
    </ScrollView>
  );
}

