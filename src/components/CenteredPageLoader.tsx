import { ActivityIndicator, Text, View } from "react-native";
import { Colors } from "../constants/colors";

export function CenteredPageLoader({ message }: { message: string }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={{ marginTop: 12, color: Colors.textSecondary }}>
        {message}
      </Text>
    </View>
  );
}
