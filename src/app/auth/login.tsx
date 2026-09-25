import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Alert,
  Image,
  ImageBackground,
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

// ─── Feature icon pill ───────────────────────────────────────────────────────
function FeaturePill({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <View className="items-center gap-1">
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
        {icon}
      </View>
      <Text className="text-center text-[10px] font-semibold leading-3 text-white/85">
        {label}
      </Text>
    </View>
  );
}

// ─── Social button ────────────────────────────────────────────────────────────
function SocialButton({
  logo,
  label,
  bgColor = Colors.white,
  textColor = Colors.textPrimary,
  borderColor = Colors.border,
  onPress,
}: {
  logo: React.ReactNode;
  label: string;
  bgColor?: string;
  textColor?: string;
  borderColor?: string;
  onPress?: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      className="h-[52px] flex-1 flex-row items-center justify-center gap-2 rounded-[14px] border-[1.5px] shadow-md"
      style={{
        borderColor,
        backgroundColor: bgColor,
        opacity: pressed ? 0.75 : 1,
      }}
    >
      {logo}
      <Text className="text-[13px] font-bold" style={{ color: textColor }}>
        {label}
      </Text>
    </Pressable>
  );
}

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
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero section ─────────────────────────────────────────────── */}
          <ImageBackground
            source={require("../../../assets/images/bgbanner.png")}
            resizeMode="cover"
            className="h-[260px] w-full overflow-hidden rounded-b-[36px]"
          >
            {/* Dark green overlay for readability */}
            <View className="flex-1 bg-[rgba(18,53,26,0.55)] px-6 pb-8 pt-5">
              {/* Logo row */}
              <View className="flex-row items-center gap-2.5">
                <View className="h-11 w-11 items-center justify-center rounded-[14px] bg-white/25">
                  <Image
                    source={require("../../../assets/images/logo.png")}
                    className="h-[30px] w-[30px]"
                    resizeMode="contain"
                    accessibilityLabel="Life Ledger logo"
                  />
                </View>
                <View>
                  <Text className="text-xl font-bold text-white">
                    <Text className="text-white">Life </Text>
                    <Text className="text-[#D7D83B]">Ledger</Text>
                  </Text>
                  <Text className="mt-px text-[11px] text-white/75">
                    Track Today · Build a Better Tomorrow
                  </Text>
                </View>
              </View>

              {/* Feature icons */}
              <View className="mt-7 flex-row justify-between">
                <FeaturePill
                  icon={
                    <Ionicons
                      name="wallet-outline"
                      size={22}
                      color={Colors.white}
                    />
                  }
                  label={"Expense\nTracking"}
                />
                <FeaturePill
                  icon={
                    <Ionicons
                      name="images-outline"
                      size={22}
                      color={Colors.white}
                    />
                  }
                  label="Memories"
                />
                <FeaturePill
                  icon={
                    <Ionicons
                      name="book-outline"
                      size={22}
                      color={Colors.white}
                    />
                  }
                  label="Diary"
                />
                <FeaturePill
                  icon={
                    <Ionicons
                      name="calendar-outline"
                      size={22}
                      color={Colors.white}
                    />
                  }
                  label={"Events &\nReminders"}
                />
              </View>
            </View>
          </ImageBackground>

          {/* ── Login card ──────────────────────────────────────────────────── */}
          <View className="mx-4 mb-6 mt-[-1px] rounded-[28px] bg-white p-6 shadow-lg">
            {/* Header */}
            <Text className="text-center text-[22px] font-bold text-[#263238]">
              Welcome Back
            </Text>
            <Text className="mb-6 mt-1 text-center text-[13px] text-[#7B8589]">
              Login to your Life Ledger account
            </Text>

            {/* Email field */}
            <View className="mb-[14px]">
              <Text className="mb-2 text-[13px] font-semibold text-[#263238]">
                Email or Mobile Number
              </Text>
              <View className="h-[52px] flex-row items-center rounded-[14px] border border-[#E5EAE7] bg-[#F9FAFC] px-[14px]">
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={Colors.textMuted}
                />
                <TextInput
                  value={identifier}
                  onChangeText={setIdentifier}
                  accessibilityLabel="Email or mobile number"
                  placeholder="Email or mobile number"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  keyboardType="email-address"
                  returnKeyType="next"
                  selectionColor={Colors.primary}
                  className="ml-2.5 flex-1 text-[15px] text-[#263238]"
                />
              </View>
            </View>

            {/* Password field */}
            <View className="mb-4">
              <Text className="mb-2 text-[13px] font-semibold text-[#263238]">
                Password
              </Text>
              <View className="h-[52px] flex-row items-center rounded-[14px] border border-[#E5EAE7] bg-[#F9FAFC] px-[14px]">
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={Colors.textMuted}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  accessibilityLabel="Password"
                  placeholder="Password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPassword}
                  autoComplete="current-password"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  selectionColor={Colors.primary}
                  className="ml-2.5 flex-1 text-[15px] text-[#263238]"
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
                <Text className="text-[13px] text-[#7B8589]">Remember Me</Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  Alert.alert(
                    "Coming soon",
                    "Password recovery is not yet available.",
                  )
                }
              >
                <Text className="text-[13px] font-semibold text-[#366039]">
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
              className="mb-5 h-[54px] flex-row items-center bg-black justify-center gap-2.5 rounded-2xl"
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
              <Text className="text-[13px] text-[#7B8589]">
                Don&apos;t have an account?
              </Text>
              <Pressable
                onPress={() => router.push("/auth/register")}
                className="active:opacity-60"
              >
                <Text className="text-[13px] font-bold text-[#366039] underline">
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
