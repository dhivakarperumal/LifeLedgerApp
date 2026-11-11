import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { usePathname, useRouter } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Wallet } from "lucide-react-native";
import {
  SafeAreaView as SafeAreaContainer,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import api, {
  getApiErrorMessage,
  getAppLockToken,
  getStoredToken,
  getStoredUser,
  logoutUser,
  setAppLockToken,
} from "../api";
import ConfirmPopup from "../components/ConfirmPopup";
import { GradientSafeAreaView as SafeAreaView } from "../components/GradientSafeAreaView";
import { Colors } from "../constants/colors";
import {
  BiometricPrompt,
  PasswordForm,
  PatternGrid,
  PinKeypad,
} from "./AppLockControls";
export type LockMethod = "pin" | "pattern" | "password";

export type AppLockSettings = {
  enabled: boolean;
  method: LockMethod;
  biometricEnabled: boolean;
  biometricEnrolled: boolean;
  configured: boolean;
  lockOnHidden: boolean;
  idleTimeoutMinutes: number;
};

const DEFAULT_APP_LOCK_SETTINGS: AppLockSettings = {
  enabled: false,
  method: "password",
  biometricEnabled: false,
  biometricEnrolled: false,
  configured: false,
  lockOnHidden: true,
  idleTimeoutMinutes: 5,
};

type AppLockContextValue = {
  settings: AppLockSettings;
  locked: boolean;
  ready: boolean;
  biometricAvailable: boolean;
  serviceAvailable: boolean;
  serviceError: string | null;
  configured: boolean;
  loading: boolean;
  loadError: string;
  unlocking: boolean;
  saveSettings: (
    settings: AppLockSettings,
    credential?: string,
    accountPassword?: string,
  ) => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  applySettings: (
    settings: AppLockSettings,
    credential?: string,
    accountPassword?: string,
  ) => Promise<void>;
  lock: () => Promise<void>;
  unlockWithCredential: (
    method: LockMethod,
    credential: string,
  ) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<{ success: boolean; message: string }>;
  acceptGrant: (token: unknown) => void;
  setLoadError: (message: string) => void;
};

const AppLockContext = createContext<AppLockContextValue | null>(null);

export function useAppLock() {
  const context = useContext(AppLockContext);
  if (!context) {
    throw new Error("useAppLock must be used within AppLockProvider.");
  }
  return context;
}

function isPublicPath(pathname: string) {
  return pathname.startsWith("/auth/");
}

function normalizeSettings(value: unknown): AppLockSettings {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const method =
    record.method === "pin" ||
    record.method === "pattern" ||
    record.method === "password"
      ? record.method
      : DEFAULT_APP_LOCK_SETTINGS.method;
  const configuredValue =
    record.configured ??
    record.credentialConfigured ??
    record.hasCredential ??
    record.setupComplete;
  return {
    enabled: record.enabled === true,
    method,
    biometricEnabled: record.biometricEnabled === true,
    biometricEnrolled: record.biometricEnrolled === true,
    configured:
      typeof configuredValue === "boolean"
        ? configuredValue
        : record.enabled === true,
    lockOnHidden: record.lockOnHidden !== false,
    idleTimeoutMinutes: Number.isFinite(Number(record.idleTimeoutMinutes))
      ? Math.max(0, Number(record.idleTimeoutMinutes))
      : 5,
  };
}

function responseSettings(data: unknown) {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    return record.settings ?? record.data ?? data;
  }
  return data;
}

function isSessionAuthenticationError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const failure = error as { status?: unknown; message?: unknown };
  if (failure.status !== 401 || typeof failure.message !== "string") {
    return false;
  }
  return /authentication required|unauthenticated|session expired|invalid token|token expired/i.test(
    failure.message,
  );
}

export function AppLockProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);
  const previousPathname = useRef(pathname);
  const [settings, setSettings] = useState(DEFAULT_APP_LOCK_SETTINGS);
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [serviceAvailable, setServiceAvailable] = useState(true);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const mountedRef = useRef(true);
  const lastActivityAtRef = useRef(0);

  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await api.get("/app-lock/status");
      const nextSettings = normalizeSettings(responseSettings(data));
      setSettings(nextSettings);
      setConfigured(nextSettings.configured);
      setServiceAvailable(true);
      setServiceError(null);
      if (!nextSettings.enabled) {
        setAppLockToken(null);
        setLocked(false);
      } else if (!getAppLockToken()) {
        setLocked(true);
      }
      setLoadError("");
      return nextSettings;
    } catch (error) {
      const message = getApiErrorMessage(
        error,
        "App Lock status could not be verified.",
      );
      setServiceAvailable(false);
      setServiceError(message);
      setLoadError(message);
      setSettings({
        ...DEFAULT_APP_LOCK_SETTINGS,
        enabled: true,
        configured: true,
      });
      setConfigured(true);
      setLocked(true);
      throw error;
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    await fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    let active = true;
    if (Platform.OS !== "web") {
      void import("expo-local-authentication")
        .then(async (LocalAuthentication) => {
          const [hasHardware, enrolled] = await Promise.all([
            LocalAuthentication.hasHardwareAsync(),
            LocalAuthentication.isEnrolledAsync(),
          ]);
          if (active) setBiometricAvailable(hasHardware && enrolled);
        })
        .catch(() => {
          if (active) setBiometricAvailable(false);
        });
    }

    return () => {
      active = false;
    };
  }, []);

  const lock = useCallback(async (broadcast = true) => {
    const token = getAppLockToken();
    setAppLockToken(null);
    setLocked(true);
    setLoadError("");
    if (token && userIdRef.current) {
      try {
        await api.post(
          "/app-lock/lock",
          null,
          { headers: { "X-App-Lock-Token": token } },
        );
      } catch (error) {
        setLoadError(
          `App Lock was applied on this device, but the server could not revoke its grant: ${getApiErrorMessage(error)}`
        );
      }
    }
    if (broadcast && Platform.OS === "web" && typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(
        `life-ledger-lock-${userIdRef.current || "guest"}`,
      );
      channel.postMessage({ type: "lock" });
      channel.close();
    }
  }, []);

  const lockRef = useRef(lock);
  useEffect(() => {
    lockRef.current = lock;
  }, [lock]);

  const initializeUser = useCallback(async () => {
    let token: string | null;
    let storedUser: Awaited<ReturnType<typeof getStoredUser>>;
    try {
      token = await getStoredToken();
      storedUser = token ? await getStoredUser() : null;
    } catch (error) {
      const message = getApiErrorMessage(
        error,
        "Your account session could not be verified.",
      );
      setServiceError(message);
      setServiceAvailable(false);
      setLoadError(message);
      setSettings({
        ...DEFAULT_APP_LOCK_SETTINGS,
        enabled: true,
        configured: true,
      });
      setConfigured(true);
      setLocked(true);
      setLoading(false);
      setReady(true);
      return;
    }
    const nextUserId = token
      ? String(storedUser?.id ?? storedUser?.user?.id ?? "authenticated")
      : null;

    if (nextUserId === userIdRef.current && ready) return;
    userIdRef.current = nextUserId;
    setAppLockToken(null);
    setLoading(true);
    setReady(false);
    setLoadError("");

    if (!nextUserId) {
      setSettings(DEFAULT_APP_LOCK_SETTINGS);
      setConfigured(false);
      setLocked(false);
      setServiceAvailable(true);
      setServiceError(null);
      setLoading(false);
      setReady(true);
      return;
    }

    setLocked(true);
    try {
      const [lockResult, settingsResult] = await Promise.allSettled([
        api.post("/app-lock/lock"),
        fetchSettings(),
      ]);
      if (lockResult.status === "rejected") throw lockResult.reason;
      if (settingsResult.status === "rejected") throw settingsResult.reason;
    } catch (error) {
      if (!mountedRef.current) return;
      if ((error as { status?: number })?.status === 401) {
        await logoutUser();
        router.replace("/auth/login");
      }
      setSettings({
        ...DEFAULT_APP_LOCK_SETTINGS,
        enabled: true,
        configured: true,
      });
      setConfigured(true);
      setLocked(true);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setReady(true);
      }
    }
  }, [fetchSettings, ready, router]);

  const saveSettings = useCallback(
    async (
      nextSettings: AppLockSettings,
      credential?: string,
      accountPassword?: string,
    ) => {
      const isFirstSetup = !configured;
      if (nextSettings.enabled && isFirstSetup && !credential) {
        throw new Error("Create a lock credential before enabling App Lock.");
      }
      if (
        nextSettings.enabled &&
        configured &&
        nextSettings.method !== settings.method &&
        !credential
      ) {
        throw new Error(
          "Create and confirm the new lock credential before enabling App Lock.",
        );
      }
      if (!accountPassword?.trim()) {
        throw new Error("Enter your account password to confirm these changes.");
      }
      if (nextSettings.enabled && nextSettings.biometricEnabled) {
        if (!biometricAvailable || Platform.OS === "web") {
          throw new Error(
            "Fingerprint or face authentication is unavailable on this device.",
          );
        }
        const LocalAuthentication = await import("expo-local-authentication");
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Confirm App Lock",
          cancelLabel: "Cancel",
          disableDeviceFallback: true,
        });
        if (!result.success) {
          throw new Error(
            "Biometric authentication was not completed. App Lock was not enabled.",
          );
        }
      }
      const body = {
        enabled: nextSettings.enabled,
        method: nextSettings.method,
        biometricEnabled: nextSettings.biometricEnabled,
        lockOnHidden: nextSettings.lockOnHidden,
        idleTimeoutMinutes: nextSettings.idleTimeoutMinutes,
        currentPassword: accountPassword,
        confirmDisable: settings.enabled && !nextSettings.enabled,
        ...(credential
          ? { credential, confirmCredential: credential }
          : {}),
      };
      const response = await api.put("/app-lock/settings", body);
      const returnedSettings = responseSettings(response.data);
      const savedSettings = normalizeSettings({
        ...nextSettings,
        ...(returnedSettings && typeof returnedSettings === "object"
          ? returnedSettings
          : {}),
        configured: configured || Boolean(credential),
      });
      setSettings(savedSettings);
      setConfigured(savedSettings.configured);
      setServiceAvailable(true);
      setServiceError(null);
      setLoadError("");
      if (!savedSettings.enabled) {
        setAppLockToken(null);
        setLocked(false);
      } else {
        await lock(false);
        if (savedSettings.biometricEnabled) {
          const { data } = await api.post("/app-lock/unlock", {
            method: "biometric",
          });
          if (typeof data?.token !== "string" || !data.token.trim()) {
            throw new Error(
              "The server did not return a valid App Lock grant.",
            );
          }
          setAppLockToken(data.token);
          setLocked(false);
          setLoadError("");
        }
      }
    },
    [biometricAvailable, configured, lock, settings.enabled, settings.method],
  );

  const acceptGrant = useCallback((token: unknown) => {
    if (typeof token !== "string" || !token.trim()) {
      throw new Error("The server did not return a valid App Lock grant.");
    }
    setAppLockToken(token);
    setLocked(false);
    setLoadError("");
  }, []);

  const unlockWithCredential = useCallback(
    async (method: LockMethod, credential: string) => {
      setUnlocking(true);
      try {
        const { data } = await api.post("/app-lock/unlock", {
          method,
          credential,
        });
        acceptGrant(data?.token);
        return true;
      } catch (error) {
        const status = (error as { status?: number })?.status;
        if (isSessionAuthenticationError(error)) {
          await logoutUser();
          router.replace("/auth/login");
          throw new Error("Your session has expired. Sign in again to unlock App Lock.");
        }
        if (status === 400 || status === 401 || status === 422) return false;
        throw error;
      } finally {
        setUnlocking(false);
      }
    },
    [acceptGrant, router],
  );

  const unlockWithBiometrics = useCallback(async () => {
    if (!biometricAvailable || Platform.OS === "web") {
      return {
        success: false,
        message: "Biometrics are unavailable. Use your lock credential.",
      };
    }
    setUnlocking(true);
    try {
      const LocalAuthentication = await import("expo-local-authentication");
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Life Ledger",
        cancelLabel: "Use lock credential",
        disableDeviceFallback: true,
      });
      if (!result.success) {
        return {
          success: false,
          message: `Biometric authentication was not completed. Enter your ${settings.method} to unlock.`,
        };
      }
      const response = await api.post("/app-lock/unlock", {
        method: "biometric",
      });
      acceptGrant(response.data?.token);
      return { success: true, message: "" };
    } catch (error) {
      if (isSessionAuthenticationError(error)) {
        await logoutUser();
        router.replace("/auth/login");
        return {
          success: false,
          message: "Your session has expired. Sign in again to unlock App Lock.",
        };
      }
      return {
        success: false,
        message: getApiErrorMessage(
          error,
          `Biometric unlock failed. Enter your ${settings.method} to unlock.`,
        ),
      };
    } finally {
      setUnlocking(false);
    }
  }, [
    acceptGrant,
    biometricAvailable,
    router,
    settings.method,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    pathnameRef.current = pathname;
    const wasPublic = isPublicPath(previousPathname.current);
    const isPublic = isPublicPath(pathname);
    previousPathname.current = pathname;
    if (!initializedRef.current || wasPublic !== isPublic) {
      initializedRef.current = true;
      void initializeUser();
    }
  }, [initializeUser, pathname]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        settings.enabled &&
        settings.lockOnHidden &&
        !isPublicPath(pathnameRef.current) &&
        (nextState === "inactive" || nextState === "background")
      ) {
        void lock();
      }
    });
    return () => subscription.remove();
  }, [lock, settings.enabled, settings.lockOnHidden]);

  useEffect(() => {
    if (
      !settings.enabled ||
      locked ||
      loading ||
      settings.idleTimeoutMinutes <= 0
    ) {
      return undefined;
    }
    const timeoutMs = settings.idleTimeoutMinutes * 60 * 1000;
    lastActivityAtRef.current = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - lastActivityAtRef.current >= timeoutMs) {
        void lockRef.current();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, locked, settings.enabled, settings.idleTimeoutMinutes]);

  useEffect(() => {
    if (!userIdRef.current || Platform.OS !== "web") return;
    const channel = typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel(`life-ledger-lock-${userIdRef.current}`)
      : null;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "lock") void lock(false);
    };
    channel?.addEventListener("message", onMessage);
    return () => {
      channel?.removeEventListener("message", onMessage);
      channel?.close();
    };
  }, [lock, ready]);

  const value = useMemo(
    () => ({
      settings,
      locked,
      ready,
      biometricAvailable,
      serviceAvailable,
      serviceError,
      configured,
      loading,
      loadError,
      unlocking,
      saveSettings,
      refreshSettings,
      refreshStatus: refreshSettings,
      applySettings: saveSettings,
      lock: () => lock(),
      unlockWithCredential,
      unlockWithBiometrics,
      acceptGrant,
      setLoadError,
    }),
    [
      settings,
      locked,
      ready,
      biometricAvailable,
      serviceAvailable,
      serviceError,
      configured,
      loading,
      loadError,
      unlocking,
      saveSettings,
      refreshSettings,
      lock,
      unlockWithCredential,
      unlockWithBiometrics,
      acceptGrant,
    ],
  );
  const mustLock = settings.enabled && locked && !isPublicPath(pathname);
  const mustBlock =
    !ready || Boolean(serviceError) || mustLock;

  return (
    <AppLockContext.Provider value={value}>
      {mustBlock ? (
        <View style={{ flex: 1 }}>
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ flex: 1 }}
          >
            {children}
          </View>
          <View style={StyleSheet.absoluteFill}>
            {!ready ? (
              <AppLockLoadingScreen />
            ) : serviceError ? (
              <AppLockScreen
                error={serviceError}
                onRetry={() => {
                  void refreshSettings().catch(() => undefined);
                }}
              />
            ) : (
              <AppLockScreen error={null} onRetry={() => undefined} />
            )}
          </View>
        </View>
      ) : (
        <View
          style={{ flex: 1 }}
          onTouchStart={() => {
            lastActivityAtRef.current = Date.now();
          }}
        >
          {children}
        </View>
      )}
    </AppLockContext.Provider>
  );
}

function AppLockLoadingScreen() {
  const { width } = useWindowDimensions();
  const badgeSize = Math.min(width * 0.28, 128);

  return (
    <SafeAreaContainer
      edges={["top", "bottom"]}
      style={{
        flex: 1,
        backgroundColor: Colors.contentBackground,
      }}
    >
      <StatusBar barStyle="dark-content" />
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 20,
        }}
      >
        <View
          style={{
            width: badgeSize,
            height: badgeSize,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: badgeSize / 2,
            backgroundColor: Colors.white,
            shadowColor: Colors.deepForest,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.14,
            shadowRadius: 18,
            elevation: 8,
          }}
        >
          <Wallet
            size={Math.min(badgeSize * 0.46, 58)}
            color={Colors.deepForest}
            strokeWidth={2.4}
          />
        </View>
        <Text
          style={{
            marginTop: 34,
            fontSize: 21,
            lineHeight: 29,
            fontWeight: "700",
            letterSpacing: 1.1,
          }}
        >
          <Text style={{ color: Colors.deepForest }}>Life</Text>
          <Text style={{ color: "#27812D" }}>Ledger</Text>
        </Text>
        <Text
          style={{
            marginTop: 6,
            color: Colors.textSecondary,
            fontSize: 14,
            lineHeight: 21,
            fontWeight: "600",
            letterSpacing: 0.5,
            textAlign: "center",
          }}
        >
          Syncing your workspace...
        </Text>
        <ActivityIndicator
          size="small"
          color={Colors.primary}
          style={{ marginTop: 24 }}
        />
      </View>
    </SafeAreaContainer>
  );
}

function AppLockScreen({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const {
    settings,
    biometricAvailable,
    unlockWithCredential,
    unlockWithBiometrics,
    unlocking,
    loadError,
  } = useAppLock();
  const [credential, setCredential] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [patternDrawing, setPatternDrawing] = useState(false);
  const [storedUser, setStoredUser] = useState<{
    name?: string;
    email?: string;
  } | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const biometricAttemptedRef = useRef(false);

  useEffect(() => {
    let active = true;
    void getStoredUser().then((user) => {
      if (active && user) {
        setStoredUser(user);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const clearCredential = () => {
    setCredential("");
    setResetKey((current) => current + 1);
  };

  const submitCredential = async (value = credential) => {
    if (busy || unlocking) return;
    if (!value || !value.trim()) {
      setErrorMessage(
        settings.method === "pin"
          ? "Please enter your PIN."
          : settings.method === "pattern"
            ? "Please draw your pattern."
            : "Please enter your password.",
      );
      return;
    }
    if (settings.method === "pin" && value.length < 4) {
      setErrorMessage("Please enter at least 4 digits to unlock.");
      return;
    }
    setBusy(true);
    setErrorMessage("");
    try {
      if (await unlockWithCredential(settings.method, value)) return;
      clearCredential();
      setErrorMessage(
        `Incorrect ${settings.method}. Please check and try again.`,
      );
    } catch (verifyError) {
      setErrorMessage(
        verifyError instanceof Error
          ? verifyError.message
          : "The credential could not be verified.",
      );
      clearCredential();
    } finally {
      setBusy(false);
    }
  };

  const submitBiometrics = async () => {
    if (busy || unlocking) return;
    setErrorMessage("");
    setBusy(true);
    try {
      const result = await unlockWithBiometrics();
      if (!result.success && result.message) {
        setErrorMessage(result.message);
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (
      settings.biometricEnabled &&
      biometricAvailable &&
      !biometricAttemptedRef.current
    ) {
      biometricAttemptedRef.current = true;
      const timer = setTimeout(() => {
        void submitBiometrics();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [biometricAvailable, settings.biometricEnabled]);

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await logoutUser();
      router.replace("/auth/login");
    } catch {
      router.replace("/auth/login");
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  if (error) {
    return (
      <SafeAreaContainer
        edges={["top", "bottom"]}
        style={{
          flex: 1,
          backgroundColor: Colors.contentBackground,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        <StatusBar barStyle="dark-content" />
        <View
          style={{
            width: "100%",
            maxWidth: 400,
            backgroundColor: "#FFFFFF",
            borderRadius: 28,
            padding: 28,
            alignItems: "center",
            borderWidth: 1,
            borderColor: "#E2E8F0",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.08,
            shadowRadius: 16,
            elevation: 4,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: "#FEE2E2",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 18,
            }}
          >
            <Ionicons name="lock-closed" size={32} color="#DC2626" />
          </View>
          <Text
            style={{
              color: "#202936",
              fontSize: 20,
              fontWeight: "800",
              textAlign: "center",
            }}
          >
            App Lock Unavailable
          </Text>
          <Text
            style={{
              marginTop: 8,
              color: "#58636A",
              fontSize: 14,
              lineHeight: 21,
              textAlign: "center",
            }}
          >
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={({ pressed }) => ({
              marginTop: 24,
              width: "100%",
              height: 52,
              borderRadius: 26,
              backgroundColor: pressed ? Colors.primaryDark : Colors.primary,
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>
              Retry
            </Text>
          </Pressable>
        </View>
      </SafeAreaContainer>
    );
  }

  return (
    <SafeAreaContainer
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: Colors.contentBackground }}
    >
      <StatusBar barStyle="dark-content" />
      <ConfirmPopup
        visible={showLogoutConfirm}
        type="logout"
        title="Reset App Lock"
        message="If you forgot your lock code, you can sign out and log back in with your account password to reset it. Do you want to sign out?"
        confirmText="Sign Out"
        cancelText="Cancel"
        loading={isLoggingOut}
        onConfirm={handleSignOut}
        onCancel={() => setShowLogoutConfirm(false)}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          scrollEnabled={!patternDrawing}
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
            paddingTop: Math.max(insets.top, 24),
            paddingBottom: Math.max(insets.bottom, 24),
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 390,
              alignItems: "center",
            }}
          >
            {/* Lock Medallion */}
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: "#E2EBD5",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#264B2A",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.12,
                shadowRadius: 14,
                elevation: 4,
              }}
            >
              <LinearGradient
                colors={["#3D7A44", "#2E5E33"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{
                  width: 66,
                  height: 66,
                  borderRadius: 33,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="lock-closed" size={32} color="#FFFFFF" />
              </LinearGradient>
            </View>

            {/* Title & Subtitle */}
            <Text
              style={{
                marginTop: 20,
                color: "#202936",
                fontSize: 25,
                fontWeight: "800",
                textAlign: "center",
                letterSpacing: 0.2,
              }}
            >
              {settings.method === "pin"
                ? "Enter PIN to unlock"
                : settings.method === "pattern"
                  ? "Draw pattern to unlock"
                  : "Enter password to unlock"}
            </Text>

            <Text
              style={{
                marginTop: 6,
                marginBottom: 26,
                color: "#58636A",
                fontSize: 14,
                lineHeight: 20,
                textAlign: "center",
                maxWidth: 320,
              }}
            >
              {storedUser?.name
                ? `Welcome back, ${storedUser.name}. Enter your ${settings.method} to continue.`
                : `Enter your lock ${settings.method} to access Life Ledger.`}
            </Text>

            {/* Center Content */}
            {settings.method === "pin" ? (
              <View
                style={{
                  width: "100%",
                  backgroundColor: "#FFFFFF",
                  borderRadius: 30,
                  paddingVertical: 20,
                  paddingHorizontal: 16,
                  borderWidth: 1,
                  borderColor: "#E5ECE6",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.05,
                  shadowRadius: 12,
                  elevation: 2,
                  alignItems: "center",
                }}
              >
                <PinKeypad
                  key={resetKey}
                  value={credential}
                  maxLength={6}
                  minLength={4}
                  onChange={setCredential}
                  onSubmit={(value) => void submitCredential(value)}
                  onBiometric={
                    settings.biometricEnabled && biometricAvailable
                      ? () => void submitBiometrics()
                      : undefined
                  }
                  variant="lock"
                />
                <View
                  style={{
                    marginTop: 16,
                    width: "100%",
                    maxWidth: 290,
                    alignSelf: "center",
                  }}
                >
                  <PrimaryButton
                    label={busy || unlocking ? "Verifying..." : "Unlock"}
                    disabled={busy || unlocking}
                    onPress={() => void submitCredential()}
                  />
                </View>
              </View>
            ) : settings.method === "pattern" ? (
              <View
                style={{
                  width: "100%",
                  backgroundColor: "#FFFFFF",
                  borderRadius: 30,
                  padding: 22,
                  borderWidth: 1,
                  borderColor: "#E5ECE6",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.05,
                  shadowRadius: 12,
                  elevation: 2,
                  alignItems: "center",
                }}
              >
                <PatternGrid
                  key={resetKey}
                  resetKey={String(resetKey)}
                  variant="lock"
                  onDrawingChange={setPatternDrawing}
                  onInvalid={() =>
                    setErrorMessage("Connect at least 4 dots to unlock.")
                  }
                  onComplete={(pattern) => {
                    setCredential(pattern);
                    void submitCredential(pattern);
                  }}
                />

                {settings.biometricEnabled && biometricAvailable ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Unlock with biometrics"
                    disabled={busy || unlocking}
                    onPress={() => void submitBiometrics()}
                    style={({ pressed }) => ({
                      marginTop: 16,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      minHeight: 54,
                      paddingHorizontal: 24,
                      borderRadius: 27,
                      backgroundColor: pressed ? "#DFE7C8" : "#ECF4E9",
                      borderWidth: 1.2,
                      borderColor: "#D2E5CE",
                    })}
                  >
                    <Ionicons
                      name="finger-print"
                      size={22}
                      color={Colors.primary}
                    />
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "700",
                        color: Colors.primaryDark,
                      }}
                    >
                      Unlock with Biometrics
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View
                style={{
                  width: "100%",
                  backgroundColor: "#FFFFFF",
                  borderRadius: 28,
                  padding: 24,
                  borderWidth: 1,
                  borderColor: "#E5ECE6",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.05,
                  shadowRadius: 12,
                  elevation: 2,
                  gap: 16,
                }}
              >
                <PasswordForm
                  value={credential}
                  onChange={setCredential}
                  placeholder="Enter your lock password"
                  onSubmitEditing={() => void submitCredential()}
                  returnKeyType="done"
                />

                <PrimaryButton
                  label={busy || unlocking ? "Verifying..." : "Unlock"}
                  disabled={busy || unlocking}
                  onPress={() => void submitCredential()}
                />

                {settings.biometricEnabled && biometricAvailable ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Unlock with biometrics"
                    disabled={busy || unlocking}
                    onPress={() => void submitBiometrics()}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      minHeight: 54,
                      borderRadius: 27,
                      backgroundColor: pressed ? "#DFE7C8" : "#ECF4E9",
                      borderWidth: 1.2,
                      borderColor: "#CADDC5",
                    })}
                  >
                    <Ionicons
                      name="finger-print"
                      size={22}
                      color={Colors.primary}
                    />
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "700",
                        color: Colors.primaryDark,
                      }}
                    >
                      Unlock with Biometrics
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            )}

            {/* Error Notification Banner */}
            {errorMessage ? (
              <View
                accessibilityLiveRegion="polite"
                style={{
                  width: "100%",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  marginTop: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 18,
                  backgroundColor: "#FEF2F2",
                  borderWidth: 1,
                  borderColor: "#FECACA",
                }}
              >
                <Ionicons name="alert-circle" size={20} color="#DC2626" />
                <Text
                  style={{
                    flex: 1,
                    color: "#991B1B",
                    fontSize: 13,
                    fontWeight: "600",
                    lineHeight: 18,
                  }}
                >
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            {!errorMessage && loadError ? (
              <Text
                accessibilityLiveRegion="polite"
                style={{
                  alignSelf: "center",
                  maxWidth: 340,
                  marginTop: 14,
                  color: "#9B3E36",
                  fontSize: 12,
                  textAlign: "center",
                }}
              >
                {loadError}
              </Text>
            ) : null}

            {/* Footer Safety Options */}
            <View style={{ alignItems: "center", marginTop: 24, paddingBottom: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Forgot lock code, sign out"
                disabled={busy || unlocking}
                onPress={() => setShowLogoutConfirm(true)}
                style={({ pressed }) => ({
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: "#58636A",
                    textDecorationLine: "underline",
                  }}
                >
                  Forgot lock code? Sign out of account
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaContainer>
  );
}

function PrimaryButton({
  label,
  disabled = false,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const isBusy = label === "Checking..." || label === "Verifying...";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: "100%",
        minHeight: 64,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 32,
        backgroundColor: pressed ? "#244E28" : "#366039",
        opacity: isBusy ? 0.82 : pressed ? 0.92 : 1,
        shadowColor: "#1B3E1F",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: isBusy ? 0 : 0.35,
        shadowRadius: 12,
        elevation: isBusy ? 1 : 6,
      })}
    >
      <LinearGradient
        colors={["#3D7A44", "#2E5E33"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: 32 },
        ]}
      />
      {isBusy ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <ActivityIndicator color="#FFFFFF" size="small" />
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 17,
              fontWeight: "800",
              letterSpacing: 0.6,
            }}
          >
            {label}
          </Text>
        </View>
      ) : (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <Ionicons
            name="lock-open-outline"
            size={22}
            color="#FFFFFF"
          />
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 17,
              fontWeight: "800",
              letterSpacing: 0.8,
            }}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
