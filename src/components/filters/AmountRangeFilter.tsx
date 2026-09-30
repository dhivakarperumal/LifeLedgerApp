import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { useFonts } from "expo-font";
import { Text, TextInput, View } from "react-native";
import { Colors } from "../../constants/colors";

const poppinsFontMap = {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
};

type Props = {
  minAmount: string;
  maxAmount: string;
  onChangeMin: (value: string) => void;
  onChangeMax: (value: string) => void;
};

function formatWithCommas(value: string): string {
  const digits = value.replace(/[^0-9]/g, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function stripCommas(value: string): string {
  return value.replace(/,/g, "");
}

/**
 * AmountRangeFilter — Min / Max inputs with ₹ prefix and comma formatting.
 * Values are stored as plain digit strings (no commas) in state.
 */
export function AmountRangeFilter({
  minAmount,
  maxAmount,
  onChangeMin,
  onChangeMax,
}: Props) {
  const [fontsLoaded] = useFonts(poppinsFontMap);

  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      {(["min", "max"] as const).map((field) => {
        const rawValue = field === "min" ? minAmount : maxAmount;
        const displayValue = formatWithCommas(rawValue);
        const onChangeFn = field === "min" ? onChangeMin : onChangeMax;
        const label = field === "min" ? "Min Amount" : "Max Amount";
        const placeholder = field === "min" ? "0" : "999,999";

        return (
          <View key={field} style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "600",
                fontFamily: fontsLoaded ? "Poppins_600SemiBold" : undefined,
                color: Colors.textSecondary,
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {label}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 1.5,
                borderColor: rawValue !== "" ? "#8EA66B" : Colors.border,
                borderRadius: 12,
                backgroundColor: Colors.white,
                paddingHorizontal: 12,
                paddingVertical: 11,
                gap: 6,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  fontFamily: fontsLoaded ? "Poppins_700Bold" : undefined,
                  color: "#8EA66B",
                }}
              >
                ₹
              </Text>
              <TextInput
                value={displayValue}
                onChangeText={(text) => onChangeFn(stripCommas(text))}
                placeholder={placeholder}
                placeholderTextColor={Colors.textSecondary}
                keyboardType="numeric"
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontWeight: "600",
                  fontFamily: fontsLoaded ? "Poppins_600SemiBold" : undefined,
                  color: Colors.textPrimary,
                  padding: 0,
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
