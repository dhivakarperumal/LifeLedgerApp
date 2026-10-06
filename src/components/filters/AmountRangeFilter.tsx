import {
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { useFonts } from "expo-font";
import { Text, TextInput, View } from "react-native";
import { Colors } from "../../constants/colors";
import { FormLabel } from "../FormControls";

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
  const normalized = value.replace(/[^0-9.]/g, "");
  const [wholePart = "", ...fractionParts] = normalized.split(".");
  const whole = wholePart ? Number(wholePart).toLocaleString("en-IN") : "";
  const fraction = fractionParts.join("").slice(0, 2);
  return `${whole}${fractionParts.length ? `.${fraction}` : ""}`;
}

function stripCommas(value: string): string {
  const normalized = value.replace(/[^0-9.]/g, "");
  const [whole = "", ...fractionParts] = normalized.split(".");
  return fractionParts.length
    ? `${whole}.${fractionParts.join("").slice(0, 2)}`
    : whole;
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
            <FormLabel color={Colors.textSecondary}>{label}</FormLabel>
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
                keyboardType="decimal-pad"
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
