import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiErrorMessage, getStoredToken } from "../api";
import { AddPageHeader } from "../components/AddPageHeader";
import { GradientSafeAreaView as SafeAreaView } from "../components/GradientSafeAreaView";
import { Colors } from "../constants/colors";
import {
  PasswordForm,
  PatternGrid,
  PinKeypad,
} from "../security/AppLockControls";
import {
  useAppLock,
  type LockMethod,
} from "../security/AppLockProvider";

const methodDetails: Record<
  LockMethod,
  { label: string; description: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  pin: {
    label: "PIN",
    description: "A private 4–6 digit code",
    icon: "keypad-outline",
  },
  pattern: {
    label: "Pattern",
    description: "A personal pattern across 9 dots",
    icon: "apps-outline",
  },
  password: {
    label: "Password",
    description: "12 characters minimum",
    icon: "lock-closed-outline",
  },
};

const timeoutOptions = [
  { label: "Disabled", value: 0 },
  { label: "1 minute", value: 1 },
  { label: "5 minutes", value: 5 },
  { label: "10 minutes", value: 10 },
  { label: "30 minutes", value: 30 },
];

const contentHeadingStyle = {
  color: "#26364B",
  fontSize: 16,
  fontWeight: "700" as const,
};

const subtitleStyle = {
  color: "#718096",
  fontSize: 13,
  lineHeight: 19,
  marginTop: 4,
};

const dividerStyle = {
  height: 1,
  marginVertical: 20,
  backgroundColor: "#E8EDF2",
};

export default function AppLockSettingsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const {
    settings,
    saveSettings,
    configured,
    biometricAvailable,
    serviceAvailable,
    serviceError,
    lock,
  } = useAppLock();
  const [draftEnabled, setDraftEnabled] = useState(settings.enabled);
  const [draftMethod, setDraftMethod] = useState(settings.method);
  const [draftBiometricEnabled, setDraftBiometricEnabled] = useState(
    settings.biometricEnabled,
  );
  const [draftLockOnHidden, setDraftLockOnHidden] = useState(
    settings.lockOnHidden,
  );
  const [draftIdleTimeout, setDraftIdleTimeout] = useState(
    settings.idleTimeoutMinutes,
  );
  const [setupMethod, setSetupMethod] = useState<LockMethod | null>(null);
  const [setupPhase, setSetupPhase] = useState<"create" | "confirm">("create");
  const [credential, setCredential] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [credentialToSave, setCredentialToSave] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [setupError, setSetupError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [timeoutOptionsVisible, setTimeoutOptionsVisible] = useState(false);
  const wideLayout = width >= 700;

  const startSetup = (
    method: LockMethod,
    options: {
      biometric?: boolean;
    } = {},
  ) => {
    setSetupMethod(method);
    setDraftMethod(method);
    setSetupPhase("create");
    setCredential("");
    setConfirmation("");
    setCredentialToSave("");
    setSetupError("");
    if (options.biometric) setDraftBiometricEnabled(true);
    setResetKey((current) => current + 1);
  };

  const chooseMethod = (method: LockMethod) => {
    setSetupError("");
    setMessage("");
    startSetup(method);
  };

  const chooseBiometrics = () => {
    setSetupError("");
    setMessage("");
    if (!biometricAvailable) {
      setSetupError(
        "Fingerprint or face authentication is not enrolled on this device.",
      );
      return;
    }
    if (!configured) {
      startSetup(draftMethod, { biometric: true });
      setSetupError(
        `Create and confirm your ${methodDetails[draftMethod].label.toLowerCase()} fallback before saving fingerprint unlock.`,
      );
      return;
    }
    setDraftBiometricEnabled(true);
    setSetupMethod(null);
  };

  const toggleAppLock = (enabled: boolean) => {
    setSetupError("");
    setMessage("");
    setDraftEnabled(enabled);
    setConfirmDisable(false);
  };

  const currentEntry = setupPhase === "create" ? credential : confirmation;
  const setCurrentEntry = (value: string) => {
    if (setupPhase === "create") setCredential(value);
    else setConfirmation(value);
  };

  const submitSetup = async (value = currentEntry) => {
    if (!setupMethod || busy) return;
    const label = methodDetails[setupMethod].label;
    const patternLength =
      setupMethod === "pattern" ? value.split(".").filter(Boolean).length : 0;
    const inputLength = setupMethod === "pattern" ? patternLength : value.length;
    const minimumLength =
      setupMethod === "pin" ? 4 : setupMethod === "pattern" ? 4 : 12;
    const maximumLength =
      setupMethod === "pin" ? 6 : setupMethod === "pattern" ? 9 : 128;

    if (inputLength < minimumLength || inputLength > maximumLength) {
      setSetupError(
        setupMethod === "pin"
          ? "Your PIN must contain 4 to 6 digits."
          : setupMethod === "pattern"
            ? "Connect at least 4 different dots."
            : "Your password must contain at least 12 characters.",
      );
      setCurrentEntry("");
      setResetKey((current) => current + 1);
      return;
    }

    if (setupPhase === "create") {
      setCredential(value);
      setConfirmation("");
      setSetupPhase("confirm");
      setSetupError(`Enter your ${label} once more to confirm.`);
      setResetKey((current) => current + 1);
      return;
    }

    if (credential !== value) {
      setConfirmation("");
      setSetupError(`The ${label.toLowerCase()}s do not match. Please try again.`);
      setResetKey((current) => current + 1);
      return;
    }

    setCredentialToSave(value);
    setSetupMethod(null);
    setCredential("");
    setConfirmation("");
    setSetupPhase("create");
    setMessage(`${label} confirmed. Enter your account password to save.`);
  };

  const cancelSetup = () => {
    setSetupMethod(null);
    setSetupPhase("create");
    setCredential("");
    setConfirmation("");
    setCredentialToSave("");
    setDraftMethod(settings.method);
    setDraftBiometricEnabled(settings.biometricEnabled);
    setDraftEnabled(settings.enabled);
    setSetupError("");
  };

  const handleSave = async () => {
    if (!serviceAvailable || busy) return;
    if (settings.enabled && !draftEnabled && !confirmDisable) {
      setSetupError("Confirm disabling App Lock before saving.");
      return;
    }
    if (!accountPassword.trim()) {
      setSetupError("Enter your account password to confirm these changes.");
      return;
    }
    if (!configured && !credentialToSave) {
      setSetupError("Create and confirm a lock method before saving App Lock.");
      return;
    }
    setBusy(true);
    setSetupError("");
    setMessage("");
    try {
      const authToken = await getStoredToken();
      if (!authToken) {
        setAccountPassword("");
        router.replace("/auth/login");
        return;
      }
      await saveSettings(
        {
          ...settings,
          enabled: draftEnabled,
          method: draftMethod,
          biometricEnabled: draftBiometricEnabled,
          lockOnHidden: draftLockOnHidden,
          idleTimeoutMinutes: draftIdleTimeout,
        },
        credentialToSave || undefined,
        accountPassword,
      );
      setCredentialToSave("");
      setAccountPassword("");
      setMessage("Security settings saved.");
    } catch (error) {
      if ((error as { status?: number })?.status === 401) {
        setAccountPassword("");
        router.replace("/auth/login");
        return;
      }
      setSetupError(getApiErrorMessage(error, "Unable to save security settings."));
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/tabs/more");
  };

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{ flex: 1, backgroundColor: Colors.contentBackground }}
    >
      <ScrollView
        contentContainerStyle={{
          width: "100%",
          maxWidth: 1320,
          alignSelf: "center",
          paddingHorizontal: width >= 700 ? 34 : 16,
          paddingBottom: insets.bottom + 28,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AddPageHeader
          title="App Lock"
          onBack={goBack}
          horizontalInset={width >= 700 ? 34 : 16}
        />

        <View
          style={{
            flexDirection: wideLayout ? "row" : "column",
            alignItems: wideLayout ? "center" : "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <Text style={[subtitleStyle, { flex: 1, marginTop: 0 }]}>
            Require a verified lock method before opening private Life Ledger data.
          </Text>
          <View
            accessibilityLabel={
              settings.enabled ? "App Lock is on" : "App Lock is off"
            }
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 999,
              backgroundColor: settings.enabled ? "#EAF5E8" : "#EDF1F4",
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: settings.enabled ? "#3B8A58" : "#94A3B8",
              }}
            />
            <Text
              style={{
                color: settings.enabled ? "#28623D" : "#64748B",
                fontSize: 13,
                fontWeight: "700",
              }}
            >
              {settings.enabled ? "App Lock is on" : "App Lock is off"}
            </Text>
          </View>
        </View>

        <SettingsCard style={{ padding: width >= 700 ? 32 : 18 }}>
          <SettingSwitchRow
            title="Lock protection"
            description="Your private pages and authenticated data APIs are gated together."
            value={draftEnabled}
            disabled={!serviceAvailable || busy}
            onChange={toggleAppLock}
          />

          <View style={dividerStyle} />
          <Text style={contentHeadingStyle}>Choose a lock method</Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 12,
            }}
          >
            {[
              {
                key: "fingerprint",
                label: "Fingerprint",
                description: "Platform authenticator",
                icon: "finger-print-outline" as const,
              },
              {
                key: "pin",
                label: "PIN",
                description: "4 to 6 digits",
                icon: "key-outline" as const,
              },
              {
                key: "pattern",
                label: "Pattern",
                description: "Connect at least 4 dots",
                icon: "grid-outline" as const,
              },
              {
                key: "password",
                label: "Password",
                description: "12 characters minimum",
                icon: "lock-closed-outline" as const,
              },
            ].map((method) => {
              const selected =
                method.key === "fingerprint"
                  ? draftBiometricEnabled
                  : draftMethod === method.key;
              const handlePress = () => {
                if (method.key === "fingerprint") chooseBiometrics();
                else chooseMethod(method.key as LockMethod);
              };
              return (
                <Pressable
                  key={method.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  disabled={!serviceAvailable || busy}
                  onPress={handlePress}
                  style={({ pressed }) => ({
                    width: wideLayout ? "48%" : "100%",
                    minHeight: 82,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderRadius: 16,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? "#61794F" : "#E1E8F0",
                    backgroundColor: selected ? "#F1F5EE" : Colors.white,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Ionicons
                    name={method.icon}
                    size={23}
                    color={selected ? "#526B3F" : "#7186A3"}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: "#27364A", fontSize: 15, fontWeight: "600" }}>
                      {method.label}
                    </Text>
                    <Text style={{ color: "#718096", fontSize: 12, marginTop: 3 }}>
                      {method.description}
                    </Text>
                  </View>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={19} color="#61794F" />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          {draftBiometricEnabled ? (
            <View
              style={{
                marginTop: 18,
                padding: 16,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#E1E8F0",
                backgroundColor: "#F7F9F7",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <Ionicons
                  name="finger-print-outline"
                  size={22}
                  color="#61794F"
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#26364B", fontSize: 14, fontWeight: "700" }}>
                    Platform authenticator
                  </Text>
                  <Text style={[subtitleStyle, { marginTop: 5 }]}>
                    Unlock with the fingerprint or face authentication enrolled on this device. Life Ledger never reads biometric data.
                  </Text>
                  <Text style={{ color: "#526B3F", fontSize: 13, fontWeight: "600", marginTop: 10 }}>
                    {biometricAvailable
                      ? "Biometric authentication is available on this device."
                      : "No fingerprint or face authentication is enrolled on this device."}
                  </Text>
                </View>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginTop: 14,
                  paddingTop: 14,
                  borderTopWidth: 1,
                  borderTopColor: "#E1E8F0",
                }}
              >
                <Text style={{ flex: 1, color: "#334155", fontSize: 13 }}>
                  Allow biometrics as an alternate unlock method
                </Text>
                <Switch
                  value={draftBiometricEnabled}
                  disabled={busy || (!biometricAvailable && !draftBiometricEnabled)}
                  onValueChange={setDraftBiometricEnabled}
                  trackColor={{ false: "#D8DFD9", true: "#A8C4A8" }}
                  thumbColor={draftBiometricEnabled ? Colors.primary : "#FFFFFF"}
                  accessibilityLabel="Allow biometric unlock as an alternate method"
                />
              </View>
            </View>
          ) : null}
        </SettingsCard>

        <SettingsCard
          style={{
            marginTop: 20,
            padding: width >= 700 ? 32 : 18,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Ionicons name="timer-outline" size={22} color="#61794F" />
            <View style={{ flex: 1 }}>
              <Text style={contentHeadingStyle}>Lock policy</Text>
              <Text style={subtitleStyle}>
                Choose when the app should require your lock method again.
              </Text>
            </View>
          </View>
          <View
            style={{
              flexDirection: wideLayout ? "row" : "column",
              gap: 18,
              marginTop: 18,
            }}
          >
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: draftLockOnHidden }}
              disabled={!serviceAvailable || busy}
              onPress={() => setDraftLockOnHidden((current) => !current)}
              style={{
                flex: 1,
                minHeight: 80,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 12,
                padding: 16,
                borderRadius: 13,
                backgroundColor: "#F5F8FA",
              }}
            >
              <Ionicons
                name={draftLockOnHidden ? "checkbox" : "square-outline"}
                size={19}
                color={draftLockOnHidden ? "#61794F" : "#9AA9B8"}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#26364B", fontSize: 14, fontWeight: "700" }}>
                  Lock when the tab is hidden
                </Text>
                <Text style={{ color: "#718096", fontSize: 13, lineHeight: 19, marginTop: 5 }}>
                  Lock as soon as Life Ledger moves to the background.
                </Text>
              </View>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#334155", fontSize: 14, marginBottom: 8 }}>
                Inactivity timeout
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Inactivity timeout: ${timeoutOptions.find((option) => option.value === draftIdleTimeout)?.label || "Disabled"}`}
                accessibilityState={{ expanded: timeoutOptionsVisible }}
                onPress={() => setTimeoutOptionsVisible((current) => !current)}
                style={{
                  minHeight: 52,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 14,
                  borderRadius: 11,
                  borderWidth: 1,
                  borderColor: "#DCE5EF",
                  backgroundColor: Colors.white,
                }}
              >
                <Text style={{ color: "#334155", fontSize: 14 }}>
                  {timeoutOptions.find((option) => option.value === draftIdleTimeout)?.label || "Disabled"}
                </Text>
                <Ionicons name="chevron-down" size={17} color="#64748B" />
              </Pressable>
              {timeoutOptionsVisible ? (
                <View
                  style={{
                    marginTop: 6,
                    padding: 5,
                    borderRadius: 11,
                    borderWidth: 1,
                    borderColor: "#DCE5EF",
                    backgroundColor: Colors.white,
                  }}
                >
                  {timeoutOptions.map((option) => (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityState={{
                        selected: draftIdleTimeout === option.value,
                      }}
                      onPress={() => {
                        setDraftIdleTimeout(option.value);
                        setTimeoutOptionsVisible(false);
                      }}
                      style={{
                        minHeight: 40,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: 10,
                        borderRadius: 8,
                        backgroundColor:
                          draftIdleTimeout === option.value
                            ? "#F1F5EE"
                            : Colors.white,
                      }}
                    >
                      <Text style={{ color: "#334155", fontSize: 13 }}>
                        {option.label}
                      </Text>
                      {draftIdleTimeout === option.value ? (
                        <Ionicons name="checkmark" size={17} color="#61794F" />
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Lock now"
            disabled={!draftEnabled || !configured || busy}
            onPress={() => void lock()}
            style={({ pressed }) => ({
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: 9,
              minHeight: 48,
              marginTop: 20,
              paddingHorizontal: 17,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#DFE7EF",
              backgroundColor: Colors.white,
              opacity: !draftEnabled || !configured || pressed ? 0.5 : 1,
            })}
          >
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={draftEnabled && configured ? "#64748B" : "#A0ACB9"}
            />
            <Text style={{ color: "#64748B", fontSize: 14, fontWeight: "600" }}>
              Lock now
            </Text>
          </Pressable>
        </SettingsCard>

        {settings.enabled && !draftEnabled ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: confirmDisable }}
            disabled={busy}
            onPress={() => setConfirmDisable((current) => !current)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 12,
              marginTop: 16,
              marginHorizontal: wideLayout ? 8 : 0,
              paddingHorizontal: 20,
              paddingVertical: 18,
              borderRadius: 15,
              borderWidth: 1,
              borderColor: "#FCD34D",
              backgroundColor: "#FFFBEB",
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons
              name={confirmDisable ? "checkbox" : "square-outline"}
              size={19}
              color={confirmDisable ? "#A16207" : "#64748B"}
              style={{ marginTop: 1 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#451A03", fontSize: 15, fontWeight: "700" }}>
                Confirm disabling App Lock
              </Text>
              <Text style={{ color: "#78350F", fontSize: 14, lineHeight: 20, marginTop: 5 }}>
                Private pages will no longer require a separate unlock.
              </Text>
            </View>
          </Pressable>
        ) : null}

        {(setupMethod || credentialToSave || (!configured && draftEnabled)) ? (
          <SettingsCard style={{ marginTop: 20, padding: width >= 700 ? 32 : 18 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={contentHeadingStyle}>
                  {setupMethod
                    ? `${setupPhase === "create" ? "Create" : "Confirm"} ${methodDetails[setupMethod].label}`
                    : "Lock method"}
                </Text>
                <Text style={subtitleStyle}>
                  {setupMethod === "password"
                    ? "Use at least 12 characters."
                    : setupMethod === "pin"
                      ? "Choose 4 to 6 digits."
                      : setupMethod === "pattern"
                        ? "Connect at least 4 dots."
                        : credentialToSave
                          ? "Your new lock method is ready to save."
                          : "Select a method above to set up your credential."}
                </Text>
              </View>
              {setupMethod ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cancel credential setup"
                  onPress={cancelSetup}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle-outline" size={23} color={Colors.sage} />
                </Pressable>
              ) : null}
            </View>
            {setupMethod ? (
              <View style={{ marginTop: 18 }}>
                {setupMethod === "pin" ? (
                  <>
                    <PinKeypad
                      key={`${setupPhase}-${resetKey}`}
                      value={currentEntry}
                      onChange={setCurrentEntry}
                      onSubmit={(value) => void submitSetup(value)}
                      minLength={4}
                      submitLabel="Continue"
                    />
                    <View style={{ marginTop: 14, width: "100%", maxWidth: 290, alignSelf: "center" }}>
                      <PrimaryButton
                        label="Continue"
                        disabled={
                          currentEntry.length < 4 || currentEntry.length > 6
                        }
                        onPress={() => void submitSetup()}
                      />
                    </View>
                  </>
                ) : setupMethod === "pattern" ? (
                  <PatternGrid
                    key={`${setupPhase}-${resetKey}`}
                    resetKey={`${setupPhase}-${resetKey}`}
                    onComplete={(pattern) => {
                      setCurrentEntry(pattern);
                      void submitSetup(pattern);
                    }}
                  />
                ) : (
                  <View style={{ gap: 12 }}>
                    <PasswordForm
                      value={currentEntry}
                      onChange={setCurrentEntry}
                      placeholder={
                        setupPhase === "create"
                          ? "Create password"
                          : "Confirm password"
                      }
                    />
                    <PrimaryButton
                      label="Continue"
                      disabled={currentEntry.length < 12}
                      onPress={() => void submitSetup()}
                    />
                  </View>
                )}
              </View>
            ) : null}
            {setupError ? <Notice error>{setupError}</Notice> : null}
          </SettingsCard>
        ) : null}

        <SettingsCard style={{ marginTop: 20, padding: width >= 700 ? 32 : 18 }}>
          <Text style={contentHeadingStyle}>Confirm with your account password</Text>
          <Text style={subtitleStyle}>
            Required every time you change lock settings or credentials.
          </Text>
          <View style={{ width: wideLayout ? "58%" : "100%", marginTop: 18 }}>
            <Text style={{ color: "#334155", fontSize: 14, marginBottom: 8 }}>
              Account password
            </Text>
            <PasswordForm
              value={accountPassword}
              onChange={setAccountPassword}
              placeholder="Enter your account password"
            />
          </View>
        </SettingsCard>

        {!serviceAvailable ? (
          <Notice error>
            {serviceError ||
              "The App Lock service is unavailable. Reconnect and reload before changing settings."}
          </Notice>
        ) : null}
        {setupError && !setupMethod ? <Notice error>{setupError}</Notice> : null}
        {message ? <Notice success>{message}</Notice> : null}

        <View
          style={{
            flexDirection: wideLayout ? "row" : "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginTop: 24,
          }}
        >
          {busy ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
          <Pressable
            accessibilityRole="button"
            disabled={
              busy ||
              !serviceAvailable ||
              Boolean(setupMethod)
            }
            onPress={() => void handleSave()}
            className="mt-3 min-h-12 w-full max-w-[286px] items-center justify-center rounded-lg bg-green-600 px-5 py-3 active:bg-green-700 disabled:opacity-60"
          >
            <Text className="text-base font-semibold text-white">
              {busy ? "Saving..." : "Save Security Settings"}
            </Text>
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          padding: 16,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: "#E4EBE5",
          backgroundColor: Colors.white,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function SettingSwitchRow({
  title,
  description,
  value,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: Colors.textPrimary, fontSize: 15, fontWeight: "800" }}>
          {title}
        </Text>
        <Text style={{ color: Colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: "#D8DFD9", true: "#A8C4A8" }}
        thumbColor={value ? Colors.primary : "#FFFFFF"}
        accessibilityLabel={title}
      />
    </View>
  );
}

function Notice({
  children,
  error = false,
  success = false,
}: {
  children: ReactNode;
  error?: boolean;
  success?: boolean;
}) {
  return (
    <View
      accessibilityLiveRegion={error ? "polite" : undefined}
      style={{
        marginTop: 13,
        padding: 12,
        borderRadius: 13,
        backgroundColor: error ? "#FFF1EF" : success ? "#EAF5E8" : "#EDF2ED",
      }}
    >
      <Text
        style={{
          color: error ? "#9B3E36" : success ? Colors.primaryDark : Colors.textSecondary,
          fontSize: 12,
          lineHeight: 18,
          fontWeight: error || success ? "600" : "400",
        }}
      >
        {children}
      </Text>
    </View>
  );
}

function PrimaryButton({
  label,
  disabled,
  onPress,
  icon,
  backgroundColor = Colors.primary,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  backgroundColor?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        width: "100%",
        maxWidth: 286,
        flexDirection: "row",
        gap: 9,
        paddingHorizontal: 18,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 14,
        borderRadius: 13,
        backgroundColor: disabled
          ? "#78917A"
          : pressed
            ? Colors.primaryDark
            : backgroundColor,
      })}
    >
      {icon ? <Ionicons name={icon} size={18} color={Colors.white} /> : null}
      <Text style={{ color: Colors.white, fontSize: 14, fontWeight: "800" }}>
        {label}
      </Text>
    </Pressable>
  );
}
