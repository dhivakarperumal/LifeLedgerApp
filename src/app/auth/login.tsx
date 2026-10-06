import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { getApiErrorMessage, loginWithIdentifier } from "../../api";
import { FormInput, FormLabel } from "../../components/FormControls";
import { GradientSafeAreaView as SafeAreaView } from "../../components/GradientSafeAreaView";
import { Colors } from "../../constants/colors";


// ─── Main screen ──────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-[#E8F5E9]">
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingVertical: 24 }}
          keyboardDismissMode="none"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Login card ──────────────────────────────────────────────────── */}
          <View className="mx-4 rounded-[28px] bg-white p-6 shadow-lg">
            {/* Header */}
            <Text className="text-center text-2xl font-bold text-[#263238]">
              Welcome Back
            </Text>
            <Text className="mb-6 mt-1 text-center text-sm text-[#7B8589]">
              Login to your Life Ledger account
            </Text>

            {/* Email field */}
            <View className="mb-4">
              <FormLabel>
                Email Or Mobile Number
              </FormLabel>
              <View className="h-[52px] flex-row items-center rounded-[14px] border border-[#E5EAE7] bg-[#F9FAFC] px-[14px]">
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={Colors.textMuted}
                />
                <FormInput
                  bordered={false}
                  value={identifier}
                  onChangeText={setIdentifier}
                  accessibilityLabel="Email Or Mobile Number"
                  placeholder="Email or mobile number"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  keyboardType="email-address"
                  returnKeyType="next"
                  selectionColor={Colors.primary}
                  className="ml-2.5 flex-1 text-base text-[#263238]"
                />
              </View>
            </View>

            {/* Password field */}
            <View className="mb-4">
              <FormLabel>
                Password
              </FormLabel>
              <View className="h-[52px] flex-row items-center rounded-[14px] border border-[#E5EAE7] bg-[#F9FAFC] px-[14px]">
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={Colors.textMuted}
                />
                <FormInput
                  bordered={false}
                  value={password}
                  onChangeText={setPassword}
                  accessibilityLabel="Password"
                  placeholder="Password"
                  secureTextEntry={!showPassword}
                  autoComplete="current-password"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  selectionColor={Colors.primary}
                  className="ml-2.5 flex-1 text-base text-[#263238]"
                />
                <Pressable
                  hitSlop={10}
                  onPress={() => setShowPassword((v) => !v)}
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={Colors.textMuted}
                  />
                </Pressable>
              </View>
            </View>

            {/* Remember me + Forgot password */}
            <View className="mb-5 flex-row items-center justify-between">
              <Pressable
                className="flex-row items-center gap-2"
                onPress={() => setRememberMe((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberMe }}
              >
                <View
                  className="h-5 w-5 items-center justify-center rounded-md"
                  style={{
                    borderWidth: rememberMe ? 0 : 1.5,
                    borderColor: Colors.border,
                    backgroundColor: rememberMe ? Colors.primary : Colors.white,
                  }}
                >
                  {rememberMe && (
                    <Ionicons name="checkmark" size={13} color={Colors.white} />
                  )}
                </View>
                <FormLabel inline color="#7B8589">Remember Me</FormLabel>
              </Pressable>

              <Pressable
                onPress={() =>
                  Alert.alert(
                    "Coming soon",
                    "Password recovery is not yet available.",
                  )
                }
              >
                <Text className="text-sm font-semibold text-[#366039]">
                  Forgot Password?
                </Text>
              </Pressable>
            </View>

            {/* Login button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Login"
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
              className="mb-5 h-[54px] flex-row items-center justify-center gap-2.5 rounded-2xl"
            >
              {isSubmitting ? (
                <Ionicons
                  name="refresh-outline"
                  size={20}
                  color={Colors.primaryDark}
                />
              ) : (
                <Ionicons
                  name="log-in-outline"
                  size={20}
                  color={Colors.white}
                />
              )}
              <Text
                className="text-base font-bold tracking-[0.4px]"
                style={{
                  color: isSubmitting ? Colors.primaryDark : Colors.white,
                }}
              >
                {isSubmitting ? "Logging in..." : "Login"}
              </Text>
            </Pressable>

            {/* OR divider */}
            <View className="mb-4 flex-row items-center">
              <View className="h-px flex-1 bg-[#E5EAE7]" />
              <Text className="mx-3 text-xs font-semibold text-[#7B8589]">
                OR
              </Text>
              <View className="h-px flex-1 bg-[#E5EAE7]" />
            </View>

            {/* Sign up link */}
            <View className="flex-row items-center justify-center gap-1">
              <Text className="text-sm text-[#7B8589]">
                Don&apos;t have an account?
              </Text>
              <Pressable
                onPress={() => router.push("/auth/register")}
                className="active:opacity-60"
              >
                <Text className="text-sm font-bold text-[#366039] underline">
                  Sign Up
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
