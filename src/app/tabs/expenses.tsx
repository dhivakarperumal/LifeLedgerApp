import { Text, View } from "react-native";
import { Colors } from "../../constants/colors";

export default function Expenses() {
  return (
    <View
      className="flex-1 px-6 py-8"
      style={{ backgroundColor: Colors.contentBackground }}
    >
      <Text className="text-3xl font-bold" style={{ color: Colors.forest }}>
        Expenses
      </Text>
      <Text className="mt-2 text-base" style={{ color: Colors.sage }}>
        See where your money goes and keep your plans on track.
      </Text>
      <View
        className="mt-8 rounded-3xl p-5"
        style={{ backgroundColor: Colors.white }}
      >
        <Text
          className="text-sm font-semibold uppercase tracking-widest"
          style={{ color: Colors.olive }}
        >
          This month
        </Text>
        <Text
          className="mt-3 text-2xl font-bold"
          style={{ color: Colors.forest }}
        >
          No expenses yet
        </Text>
        <Text className="mt-1" style={{ color: Colors.sage }}>
          Add an expense to start your overview.
        </Text>
      </View>
    </View>
  );
}
