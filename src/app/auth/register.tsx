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
import { getApiErrorMessage, registerUser } from "../../api";
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
    <View className="mb-[14px]">
      <Text className="mb-2 text-[13px] font-semibold text-[#263238]">
        {label}
      </Text>
      <View className="min-h-[52px] flex-row items-center rounded-[14px] border border-[#E5EAE7] bg-[#F9FAFC] px-[14px]">
        <Ionicons name={icon} size={20} color={Colors.textMuted} />
        <TextInput
          {...props}
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={label}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          selectionColor={Colors.primary}
          className="ml-2.5 flex-1 py-[14px] text-[15px] text-[#263238]"
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
    <View className="mb-[14px]">
      <Text className="mb-2 text-[13px] font-semibold text-[#263238]">
        {label}
      </Text>
      <View className="min-h-[52px] flex-row items-center rounded-[14px] border border-[#E5EAE7] bg-[#F9FAFC] px-[14px]">
        <Ionicons
          name="lock-closed-outline"
          size={20}
          color={Colors.textMuted}
        />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={label}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={!visible}
          autoComplete="password"
          selectionColor={Colors.primary}
          className="ml-2.5 flex-1 py-[14px] text-[15px] text-[#263238]"
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
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          className="flex-1"
        >
          <View className="grow pb-6">
            <View className="overflow-hidden rounded-b-[36px] bg-[#1E5128] px-6 pt-5 pb-[30px]">
              <View className="absolute -right-[45px] -top-[35px] h-[170px] w-[170px] rounded-full bg-[rgba(215,216,59,0.12)]" />
              <View className="flex-row items-center gap-[10px]">
                <View className="h-11 w-11 items-center justify-center rounded-[14px] bg-[#ADBEA3]">
                  <Image
                    source={require("../../../assets/images/logo.png")}
                    className="h-[30px] w-[30px]"
                    resizeMode="contain"
                    accessibilityLabel="Life Ledger logo"
                  />
                </View>
                <View>
                  <Text className="text-xl font-bold text-white">
                    Life <Text className="text-[#D7D83B]">Ledger</Text>
                  </Text>
                  <Text className="mt-px text-[11px] text-[#ADBEA3]">
                    Track Today · Build a Better Tomorrow
                  </Text>
                </View>
              </View>
              <Text className="mt-7 text-2xl font-bold text-white">
                Create your account
              </Text>
              <Text className="mt-[5px] text-sm text-[#ADBEA3]">
                Start tracking your life with clarity and confidence.
              </Text>
            </View>

            <View className="mx-4 -mt-px rounded-[28px] bg-white p-6 shadow-md shadow-black/10">
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
                className={`h-[52px] flex-row items-center justify-center gap-2 rounded-[14px] bg-black mt-[6px] mb-5 ${isSubmitting ? "opacity-60" : "active:opacity-80"}`}
              >
                <Ionicons
                  name="person-add-outline"
                  size={20}
                  color={Colors.white}
                />
                <Text className="text-base font-bold text-white">
                  {isSubmitting ? "Creating account..." : "Create Account"}
                </Text>
              </Pressable>

              <View className="flex-row justify-center gap-1">
                <Text className="text-[13px] text-[#7B8589]">
                  Already have an account?
                </Text>
                <Pressable onPress={() => router.replace("/auth/login")}>
                  <Text className="text-[13px] font-bold text-[#366039]">
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
