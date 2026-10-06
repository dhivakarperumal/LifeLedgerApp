import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { getApiErrorMessage, loginWithIdentifier } from "../../api";
import { FormInput, FormLabel } from "../../components/FormControls";
import { GradientSafeAreaView as SafeAreaView } from "../../components/GradientSafeAreaView";
import { KeyboardAwareFormScrollView } from "../../components/KeyboardAwareFormScrollView";
import { Colors } from "../../constants/colors";


// ─── Main screen ──────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!identifier.trim() || !password) {
      Alert.alert(
        "Missing details",
        "Enter your email or mobile number and password.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await loginWithIdentifier(identifier, password);
      router.replace("/tabs");
    } catch (error) {
      Alert.alert(
        "Login failed",
        getApiErrorMessage(error, "Please check your details and try again."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-[#F2F5EA]">
      <StatusBar style="dark" />
      <KeyboardAwareFormScrollView>
        <View
          className="justify-center bg-[#DFE7C8] px-5"
          style={{
            minHeight: 225,
            borderBottomLeftRadius: 62,
            borderBottomRightRadius: 62,
          }}
        >
          <View className="flex-row items-center gap-3">
          <Image
            source={require("../../../assets/images/logo.png")}
            accessibilityLabel="Life Ledger logo"
            resizeMode="contain"
              className="h-14 w-14 rounded-full"
          />
            <View className="flex-1">
              <Text className="text-[34px] font-extrabold leading-[40px] text-[#202936]">
                LifeLedger
              </Text>
              <Text className="mt-2 text-[11px] font-bold tracking-[0.32em] text-[#58636A]">
                LOG IN TO YOUR ACCOUNT
              </Text>
            </View>
          </View>
        </View>

        <View className="mx-5 mt-8">
          <View className="mt-2 mb-5">
            <FormLabel color="#4B5563">Email</FormLabel>
            <View className="h-16 flex-row items-center rounded-[32px] border border-[#D1DABB] bg-[#DFE7C8] px-5">
              <FormInput
                bordered={false}
                value={identifier}
                onChangeText={setIdentifier}
                accessibilityLabel="Email Address"
                placeholder="Enter email address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                keyboardType="email-address"
                returnKeyType="next"
                selectionColor={Colors.primary}
                className="flex-1 text-[15px] font-semibold text-[#263238]"
              />
            </View>
          </View>

          <View className="mt-2 mb-5">
            <FormLabel color="#4B5563">Password</FormLabel>
            <View className="h-16 flex-row items-center rounded-[32px] border border-[#D1DABB] bg-[#DFE7C8] px-5">
              <FormInput
                bordered={false}
                value={password}
                onChangeText={setPassword}
                accessibilityLabel="Password"
                placeholder="Enter password"
                secureTextEntry={!showPassword}
                autoComplete="current-password"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                selectionColor={Colors.primary}
                className="flex-1 text-[15px] font-semibold text-[#263238]"
              />
              <Pressable
                hitSlop={10}
                onPress={() => setShowPassword((v) => !v)}
                className="h-9 w-9 items-center justify-center rounded-full bg-[#EDF1E0]"
                accessibilityLabel={
                  showPassword ? "Hide password" : "Show password"
                }
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={Colors.primary}
                />
              </Pressable>
            </View>
          </View>

          <View className="mb-5">
            <Pressable
              onPress={() =>
                Alert.alert(
                  "Coming soon",
                  "Password recovery is not yet available.",
                )
              }
            >
              <Text className="text-[13px] font-bold tracking-[0.08em] text-[#366039]">
                Forgot Password?
              </Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign In"
            disabled={isSubmitting}
            onPress={handleSubmit}
            style={({ pressed }) => ({
              backgroundColor: isSubmitting
                ? Colors.primaryLight
                : pressed
                  ? Colors.primaryDark
                  : Colors.primary,
              shadowColor: Colors.primaryDark,
              shadowOpacity: pressed || isSubmitting ? 0 : 0.45,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
              elevation: pressed || isSubmitting ? 0 : 8,
            })}
            className="mb-10 mt-2 h-[60px] flex-row items-center justify-center gap-3 rounded-full bg-[#366039]"
          >
            {isSubmitting && (
              <Ionicons
                name="refresh-outline"
                size={20}
                color={Colors.primaryDark}
              />
            )}
            <Text className="text-[17px] font-extrabold tracking-[0.22em] text-white">
              {isSubmitting ? "Signing In" : "Sign In"}
            </Text>
          </Pressable>

          <View className="flex-row flex-wrap items-center justify-center gap-x-1">
            <Text className="text-[12px] font-bold tracking-[0.08em] text-[#707982]">
              Don&apos;t have an account?
            </Text>
            <Pressable
              onPress={() => router.push("/auth/register")}
              className="min-h-10 justify-center px-2 active:opacity-60"
            >
              <Text className="text-[12px] font-extrabold tracking-[0.08em] text-[#366039] underline">
                Sign Up
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAwareFormScrollView>
    </SafeAreaView>
  );
}
