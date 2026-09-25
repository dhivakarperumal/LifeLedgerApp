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
  placeholder,
  value,
  onChangeText,
  ...props
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  [key: string]: unknown;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 52,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: 14,
        backgroundColor: Colors.bgDark,
        marginBottom: 14,
      }}
    >
      <Ionicons name={icon} size={20} color={Colors.textMuted} />
      <TextInput
        {...props}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        selectionColor={Colors.primary}
        style={{
          flex: 1,
          marginLeft: 10,
          fontSize: 15,
          color: Colors.textPrimary,
          paddingVertical: 14,
        }}
      />
    </View>
  );
}

function PasswordField({
  placeholder,
  value,
  onChangeText,
  visible,
  onToggle,
}: {
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 52,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: 14,
        backgroundColor: Colors.bgDark,
        marginBottom: 14,
      }}
    >
      <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        secureTextEntry={!visible}
        autoComplete="password"
        selectionColor={Colors.primary}
        style={{
          flex: 1,
          marginLeft: 10,
          fontSize: 15,
          color: Colors.textPrimary,
          paddingVertical: 14,
        }}
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
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: "#E8F5E9" }}
    >
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              backgroundColor: Colors.headerStart,
              paddingHorizontal: 24,
              paddingTop: 20,
              paddingBottom: 30,
              borderBottomLeftRadius: 36,
              borderBottomRightRadius: 36,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                position: "absolute",
                right: -45,
                top: -35,
                width: 170,
                height: 170,
                borderRadius: 85,
                backgroundColor: "rgba(215,216,59,0.12)",
              }}
            />
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={{
                  height: 44,
                  width: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 14,
                  backgroundColor: Colors.primaryLight,
                }}
              >
                <Image
                  source={require("../../../assets/images/logo.png")}
                  style={{ height: 30, width: 30 }}
                  resizeMode="contain"
                  accessibilityLabel="Life Ledger logo"
                />
              </View>
              <View>
                <Text
                  style={{
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: "700",
                  }}
                >
                  Life <Text style={{ color: Colors.accent }}>Ledger</Text>
                </Text>
                <Text
                  style={{
                    color: Colors.primaryLight,
                    fontSize: 11,
                    marginTop: 1,
                  }}
                >
                  Track Today · Build a Better Tomorrow
                </Text>
              </View>
            </View>
            <Text
              style={{
                color: Colors.white,
                fontSize: 24,
                fontWeight: "700",
                marginTop: 28,
              }}
            >
              Create your account
            </Text>
            <Text
              style={{ color: Colors.primaryLight, fontSize: 14, marginTop: 5 }}
            >
              Start tracking your life with clarity and confidence.
            </Text>
          </View>

          <View
            style={{
              marginHorizontal: 16,
              marginTop: -1,
              backgroundColor: Colors.white,
              borderRadius: 28,
              padding: 24,
              shadowColor: "#000",
              shadowOpacity: 0.06,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }}
          >
            <FormField
              icon="person-outline"
              placeholder="Full Name"
              value={form.username}
              onChangeText={(value) => updateField("username", value)}
              autoCapitalize="words"
              autoComplete="name"
            />
            <FormField
              icon="mail-outline"
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
              placeholder="Mobile Number"
              value={form.phone}
              onChangeText={(value) => updateField("phone", value)}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
            <PasswordField
              placeholder="Password"
              value={form.password}
              onChangeText={(value) => updateField("password", value)}
              visible={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
            />
            <PasswordField
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
                height: 52,
                borderRadius: 14,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                backgroundColor: isSubmitting
                  ? Colors.primaryLight
                  : pressed
                    ? Colors.primaryDark
                    : Colors.primary,
                marginTop: 6,
                marginBottom: 20,
              })}
            >
              <Ionicons
                name="person-add-outline"
                size={20}
                color={isSubmitting ? Colors.primaryDark : Colors.white}
              />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: isSubmitting ? Colors.primaryDark : Colors.white,
                }}
              >
                {isSubmitting ? "Creating account..." : "Create Account"}
              </Text>
            </Pressable>

            <View
              style={{ flexDirection: "row", justifyContent: "center", gap: 4 }}
            >
              <Text style={{ fontSize: 13, color: Colors.textSecondary }}>
                Already have an account?
              </Text>
              <Pressable onPress={() => router.replace("/auth/login")}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: Colors.primary,
                  }}
                >
                  Login
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
