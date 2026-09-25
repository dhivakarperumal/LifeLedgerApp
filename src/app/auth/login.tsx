import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getApiErrorMessage, loginWithIdentifier } from "../../api";
import { Colors } from "../../constants/colors";

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
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: Colors.canvas }}
    >
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            className="overflow-hidden rounded-b-[42px] px-6 pb-12 pt-5"
            style={{ backgroundColor: Colors.headerStart }}
          >
            <View
              className="absolute -right-16 -top-20 h-64 w-64 rounded-full"
              style={{ backgroundColor: "rgba(215,216,59,0.16)" }}
            />
            <View
              className="absolute -bottom-24 -left-20 h-56 w-56 rounded-full"
              style={{ backgroundColor: "rgba(173,190,163,0.12)" }}
            />
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View
                  className="h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: Colors.primaryLight }}
                >
                  <Image
                    source={require("../../../assets/images/logo.png")}
                    className="h-8 w-8"
                    resizeMode="contain"
                    accessibilityLabel="Life Ledger logo"
                  />
                </View>
                <Text
                  className="text-lg font-bold"
                  style={{ color: Colors.white }}
                >
                  Life Ledger
                </Text>
              </View>
              <Ionicons
                name="shield-checkmark"
                size={25}
                color={Colors.accent}
              />
            </View>
            <Text
              className="mt-12 text-4xl font-bold"
              style={{ color: Colors.white }}
            >
              Welcome back.
            </Text>
            <Text
              className="mt-2 text-base"
              style={{ color: Colors.primaryLight }}
            >
              Your everyday life, organized beautifully.
            </Text>
          </View>

          <View className="px-6 pb-8 pt-9">
            <Text
              className="text-2xl font-bold"
              style={{ color: Colors.textPrimary }}
            >
              Sign in to your ledger
            </Text>
            <Text
              className="mt-2 text-sm leading-5"
              style={{ color: Colors.textSecondary }}
            >
              Pick up where you left off with your expenses, diary, and
              memories.
            </Text>

            <View className="mt-8">
              <Text
                className="mb-2 ml-1 text-sm font-semibold"
                style={{ color: Colors.textPrimary }}
              >
                Email or mobile number
              </Text>
              <View
                className="h-14 flex-row items-center rounded-2xl border px-4"
                style={{
                  backgroundColor: Colors.white,
                  borderColor: Colors.border,
                }}
              >
                <Ionicons
                  name="person-outline"
                  size={21}
                  color={Colors.textSecondary}
                />
                <TextInput
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  keyboardType="email-address"
                  returnKeyType="next"
                  selectionColor={Colors.primary}
                  className="ml-3 flex-1 text-base"
                  style={{ color: Colors.textPrimary }}
                />
              </View>
            </View>

            <View className="mt-5">
              <View className="mb-2 flex-row items-center justify-between px-1">
                <Text
                  className="text-sm font-semibold"
                  style={{ color: Colors.textPrimary }}
                >
                  Password
                </Text>
                <Text
                  className="text-xs font-semibold"
                  style={{ color: Colors.primary }}
                >
                  Keep it private
                </Text>
              </View>
              <View
                className="h-14 flex-row items-center rounded-2xl border px-4"
                style={{
                  backgroundColor: Colors.white,
                  borderColor: Colors.border,
                }}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={21}
                  color={Colors.textSecondary}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPassword}
                  autoComplete="current-password"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  selectionColor={Colors.primary}
                  className="ml-3 flex-1 text-base"
                  style={{ color: Colors.textPrimary }}
                />
                <Pressable
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                  hitSlop={10}
                  onPress={() => setShowPassword((visible) => !visible)}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color={Colors.textSecondary}
                  />
                </Pressable>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              className="mt-8 h-14 flex-row items-center justify-center rounded-2xl"
              disabled={isSubmitting}
              onPress={handleSubmit}
              style={({ pressed }) => ({
                backgroundColor:
                  pressed || isSubmitting ? Colors.primaryDark : Colors.primary,
                opacity: isSubmitting ? 0.75 : 1,
              })}
            >
              {isSubmitting ? (
                <Ionicons name="refresh" size={22} color={Colors.white} />
              ) : (
                <Ionicons name="arrow-forward" size={22} color={Colors.white} />
              )}
              <Text
                className="ml-3 text-base font-bold"
                style={{ color: Colors.white }}
              >
                {isSubmitting ? "Signing in..." : "Secure sign in"}
              </Text>
            </Pressable>

            <View className="mt-8 flex-row items-center">
              <View
                className="h-px flex-1"
                style={{ backgroundColor: Colors.border }}
              />
              <Text
                className="mx-4 text-xs font-semibold uppercase"
                style={{ color: Colors.textMuted }}
              >
                Life Ledger
              </Text>
              <View
                className="h-px flex-1"
                style={{ backgroundColor: Colors.border }}
              />
            </View>

            <View
              className="mt-6 flex-row items-center rounded-2xl p-4"
              style={{ backgroundColor: Colors.bgCard }}
            >
              <View
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: Colors.white }}
              >
                <Ionicons name="lock-closed" size={18} color={Colors.primary} />
              </View>
              <Text
                className="ml-3 flex-1 text-xs leading-5"
                style={{ color: Colors.textSecondary }}
              >
                Your account details are sent securely to the Life Ledger API.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
