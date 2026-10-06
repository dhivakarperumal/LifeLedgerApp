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
import { getApiErrorMessage, registerUser } from "../../api";
import { FormInput, FormLabel } from "../../components/FormControls";
import { GradientSafeAreaView as SafeAreaView } from "../../components/GradientSafeAreaView";
import { Colors } from "../../constants/colors";

type FormState = {
  username: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
};

const initialForm: FormState = {
  username: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

function FormField({
  icon,
  label,
  placeholder,
  value,
  onChangeText,
  ...props
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  [key: string]: unknown;
}) {
  return (
    <View className="mb-4">
      <FormLabel>{label}</FormLabel>
      <View className="min-h-[52px] flex-row items-center rounded-[14px] border border-[#E5EAE7] bg-[#F9FAFC] px-[14px]">
        <Ionicons name={icon} size={20} color={Colors.textMuted} />
        <FormInput
          bordered={false}
          {...props}
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={label}
          placeholder={placeholder}
          selectionColor={Colors.primary}
          className="ml-2.5 flex-1 py-[14px] text-base text-[#263238]"
        />
      </View>
    </View>
  );
}

function PasswordField({
  label,
  placeholder,
  value,
  onChangeText,
  visible,
  onToggle,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <View className="mb-4">
      <FormLabel>{label}</FormLabel>
      <View className="min-h-[52px] flex-row items-center rounded-[14px] border border-[#E5EAE7] bg-[#F9FAFC] px-[14px]">
        <Ionicons
          name="lock-closed-outline"
          size={20}
          color={Colors.textMuted}
        />
        <FormInput
          bordered={false}
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={label}
          placeholder={placeholder}
          secureTextEntry={!visible}
          autoComplete="password"
          selectionColor={Colors.primary}
          className="ml-2.5 flex-1 py-[14px] text-base text-[#263238]"
        />
        <Pressable
          hitSlop={10}
          onPress={onToggle}
          accessibilityLabel={visible ? "Hide password" : "Show password"}
        >
          <Ionicons
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={Colors.textMuted}
          />
        </Pressable>
      </View>
    </View>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async () => {
    if (
      !form.username.trim() ||
      !form.email.trim() ||
      !form.phone.trim() ||
      !form.password
    ) {
      Alert.alert(
        "Missing details",
        "Complete all fields to create your account.",
      );
      return;
    }

    if (form.password !== form.confirmPassword) {
      Alert.alert("Passwords do not match", "Enter the same password twice.");
      return;
    }

    setIsSubmitting(true);
    try {
      await registerUser(form);
      Alert.alert("Registration successful", "Please log in to continue.", [
        { text: "OK", onPress: () => router.replace("/auth/login") },
      ]);
    } catch (error) {
      Alert.alert(
        "Registration failed",
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
          className="flex-1"
        >
          <View className="grow justify-center pb-6">
            <View className="mx-4 rounded-[28px] bg-white p-6 shadow-lg">
              <FormField
                icon="person-outline"
                label="Full Name"
                placeholder="Full Name"
                value={form.username}
                onChangeText={(value) => updateField("username", value)}
                autoCapitalize="words"
                autoComplete="name"
              />
              <FormField
                icon="mail-outline"
                label="Email Address"
                placeholder="Email Address"
                value={form.email}
                onChangeText={(value) => updateField("email", value)}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
              />
              <FormField
                icon="call-outline"
                label="Mobile Number"
                placeholder="Mobile Number"
                value={form.phone}
                onChangeText={(value) => updateField("phone", value)}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
              <PasswordField
                label="Password"
                placeholder="Password"
                value={form.password}
                onChangeText={(value) => updateField("password", value)}
                visible={showPassword}
                onToggle={() => setShowPassword((value) => !value)}
              />
              <PasswordField
                label="Confirm Password"
                placeholder="Confirm Password"
                value={form.confirmPassword}
                onChangeText={(value) => updateField("confirmPassword", value)}
                visible={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((value) => !value)}
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create account"
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
                className="mt-[6px] mb-5 h-[54px] flex-row items-center justify-center gap-2.5 rounded-2xl"
              >
                {isSubmitting ? (
                  <Ionicons
                    name="refresh-outline"
                    size={20}
                    color={Colors.primaryDark}
                  />
                ) : (
                  <Ionicons
                    name="person-add-outline"
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
                  {isSubmitting ? "Creating account..." : "Create Account"}
                </Text>
              </Pressable>

              <View className="flex-row justify-center gap-1">
                <Text className="text-sm text-[#7B8589]">
                  Already have an account?
                </Text>
                <Pressable onPress={() => router.replace("/auth/login")}>
                  <Text className="text-sm font-bold text-[#366039]">
                    Login
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
