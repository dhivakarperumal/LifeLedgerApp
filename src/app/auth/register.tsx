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
import { getApiErrorMessage, registerUser } from "../../api";
import { FormInput, FormLabel } from "../../components/FormControls";
import { GradientSafeAreaView as SafeAreaView } from "../../components/GradientSafeAreaView";
import { KeyboardAwareFormScrollView } from "../../components/KeyboardAwareFormScrollView";
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
  label,
  placeholder,
  value,
  onChangeText,
  ...props
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  [key: string]: unknown;
}) {
  return (
    <View className="mb-4">
      <FormLabel color="#4B5563">{label}</FormLabel>
      <View className="h-14 flex-row items-center rounded-[32px] border border-[#D1DABB] bg-[#DFE7C8] px-5">
        <FormInput
          bordered={false}
          {...props}
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={label}
          placeholder={placeholder}
          selectionColor={Colors.primary}
          className="flex-1 text-[15px] font-semibold text-[#263238]"
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
      <FormLabel color="#4B5563">{label}</FormLabel>
      <View className="h-14 flex-row items-center rounded-[32px] border border-[#D1DABB] bg-[#DFE7C8] px-5">
        <FormInput
          bordered={false}
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={label}
          placeholder={placeholder}
          secureTextEntry={!visible}
          autoComplete="password"
          selectionColor={Colors.primary}
          className="flex-1 text-[15px] font-semibold text-[#263238]"
        />
        <Pressable
          hitSlop={10}
          onPress={onToggle}
          className="h-9 w-9 items-center justify-center rounded-full bg-[#EDF1E0]"
          accessibilityLabel={visible ? "Hide password" : "Show password"}
        >
          <Ionicons
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={Colors.primary}
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
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-[#F2F5EA]">
      <StatusBar style="dark" />
      <KeyboardAwareFormScrollView>
        <View
          className="justify-center bg-[#DFE7C8] px-5"
          style={{
            minHeight: 145,
            borderBottomLeftRadius: 62,
            borderBottomRightRadius: 62,
          }}
        >
          <View className="flex-row items-center gap-3">
            <Image
              source={require("../../../assets/images/logo.png")}
              accessibilityLabel="Life Ledger logo"
              resizeMode="contain"
              className="h-12 w-12 rounded-full"
            />
            <View className="flex-1">
              <Text className="text-[34px] font-extrabold leading-[40px] text-[#202936]">
                Join Us
              </Text>
              <Text className="mt-2 text-[11px] font-bold tracking-[0.32em] text-[#58636A]">
                CREATE YOUR NEW ACCOUNT
              </Text>
            </View>
          </View>
        </View>

        <View className="mx-5 mt-7">
          <FormField
            label="Username"
            placeholder="Enter username"
            value={form.username}
            onChangeText={(value) => updateField("username", value)}
            autoCapitalize="words"
            autoComplete="name"
          />
          <FormField
            label="Email"
            placeholder="Enter email"
            value={form.email}
            onChangeText={(value) => updateField("email", value)}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
          />
          <FormField
            label="Phone"
            placeholder="Enter phone number"
            value={form.phone}
            onChangeText={(value) => updateField("phone", value)}
            keyboardType="phone-pad"
            autoComplete="tel"
          />
          <PasswordField
            label="Password"
            placeholder="Enter password"
            value={form.password}
            onChangeText={(value) => updateField("password", value)}
            visible={showPassword}
            onToggle={() => setShowPassword((value) => !value)}
          />
          <PasswordField
            label="Confirm Password"
            placeholder="Confirm password"
            value={form.confirmPassword}
            onChangeText={(value) => updateField("confirmPassword", value)}
            visible={showConfirmPassword}
            onToggle={() => setShowConfirmPassword((value) => !value)}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign Up"
            disabled={isSubmitting}
            onPress={handleSubmit}
            style={({ pressed }) => ({
              backgroundColor: isSubmitting
                ? Colors.primaryLight
                : pressed
                  ? Colors.primaryDark
                  : Colors.primary,
              shadowColor: Colors.primaryDark,
              shadowOpacity: pressed || isSubmitting ? 0 : 0.25,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: pressed || isSubmitting ? 0 : 5,
            })}
            className="mb-7 mt-2 h-16 flex-row items-center justify-center rounded-full bg-[#366039]"
          >
            {isSubmitting ? (
              <Ionicons
                name="refresh-outline"
                size={20}
                color={Colors.primaryDark}
              />
            ) : null}
            <Text className="text-[16px] font-extrabold tracking-[0.18em] text-white">
              {isSubmitting ? "Signing Up" : "Sign Up"}
            </Text>
          </Pressable>

          <View className="flex-row flex-wrap items-center justify-center gap-x-1">
            <Text className="text-[12px] font-bold tracking-[0.08em] text-[#707982]">
              Already have an account?
            </Text>
            <Pressable onPress={() => router.replace("/auth/login")}>
              <Text className="text-[12px] font-extrabold tracking-[0.08em] text-[#366039] underline">
                Log In
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAwareFormScrollView>
    </SafeAreaView>
  );
}
