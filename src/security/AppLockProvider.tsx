import { Ionicons } from "@expo/vector-icons";
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
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api, {
  getApiErrorMessage,
  getAppLockToken,
  getStoredToken,
  getStoredUser,
  logoutUser,
  setAppLockToken,
} from "../api";
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
      if (Platform.OS !== "web") {
        try {
          const LocalAuthentication = await import("expo-local-authentication");
          const [hasHardware, enrolled] = await Promise.all([
            LocalAuthentication.hasHardwareAsync(),
            LocalAuthentication.isEnrolledAsync(),
          ]);
          setBiometricAvailable(hasHardware && enrolled);
        } catch {
          setBiometricAvailable(false);
        }
      } else {
        setBiometricAvailable(false);
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
      await api.post("/app-lock/lock");
      await fetchSettings();
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
      if (isFirstSetup && !credential) {
        throw new Error("Create a lock credential before enabling App Lock.");
      }
      if (!accountPassword?.trim()) {
        throw new Error("Enter your account password to confirm these changes.");
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
        configured: true,
      });
      setSettings(savedSettings);
      setConfigured(
        typeof savedSettings.configured === "boolean"
          ? savedSettings.configured
          : true,
      );
      setServiceAvailable(true);
      setServiceError(null);
      setLoadError("");
      if (!savedSettings.enabled) {
        setAppLockToken(null);
        setLocked(false);
      } else {
        await lock(false);
      }
    },
    [configured, lock, settings.enabled],
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
  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: Colors.contentBackground,
      }}
    >
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={{ color: Colors.textSecondary, marginTop: 12 }}>
        Securing Life Ledger...
      </Text>
    </SafeAreaView>
  );
}

function AppLockScreen({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  const insets = useSafeAreaInsets();
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

  const clearCredential = () => {
    setCredential("");
    setResetKey((current) => current + 1);
  };

  const submitCredential = async (value = credential) => {
    if (!value || busy) return;
    setBusy(true);
    setErrorMessage("");
    try {
      if (await unlockWithCredential(settings.method, value)) return;
      clearCredential();
      setErrorMessage(
        `That ${settings.method} is incorrect. Please try again.`,
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
    setErrorMessage("");
    setBusy(true);
    try {
      const result = await unlockWithBiometrics();
      if (!result.success) setErrorMessage(result.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <SafeAreaView
        edges={["top", "bottom"]}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: Colors.contentBackground,
          paddingHorizontal: 28,
        }}
      >
        <Ionicons name="lock-closed-outline" size={42} color={Colors.primary} />
        <Text
          style={{
            marginTop: 16,
            color: Colors.textPrimary,
            fontSize: 18,
            fontWeight: "800",
            textAlign: "center",
          }}
        >
          App Lock service unavailable
        </Text>
        <Text
          style={{
            marginTop: 8,
            color: Colors.textSecondary,
            fontSize: 14,
            textAlign: "center",
          }}
        >
          {error}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={{
            marginTop: 20,
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: 13,
            backgroundColor: Colors.primary,
          }}
        >
          <Text style={{ color: Colors.white, fontWeight: "700" }}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: "#F7F7F5" }}
    >
      <StatusBar barStyle="dark-content" />
      <ScrollView
        scrollEnabled={!patternDrawing}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 20,
          paddingTop: 18,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width: "100%", maxWidth: 420, alignItems: "center" }}>
          <View
            style={{
              width: 112,
              height: 112,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 56,
              backgroundColor: "#DDEEDA",
              shadowColor: "#103B2C",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 2,
            }}
          >
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 18,
                backgroundColor: "#1C5C3C",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="lock-closed" size={32} color="#F7F7F5" />
            </View>
          </View>

          <Text
            style={{
              marginTop: 18,
              color: "#183B2D",
              fontSize: 27,
              fontWeight: "800",
              textAlign: "center",
            }}
          >
            {settings.method === "pin"
              ? "Enter PIN to unlock"
              : settings.method === "pattern"
                ? "Draw pattern to unlock"
                : "Enter password to unlock"}
          </Text>
        </View>

        {settings.biometricEnabled && biometricAvailable ? (
          <View style={{ marginTop: 10, marginBottom: 8 }}>
            <BiometricPrompt
              available={biometricAvailable}
              busy={busy}
              message="Unlock with fingerprint or face"
              onPress={() => void submitBiometrics()}
            />
          </View>
        ) : null}

        <View
          style={{
            width: "100%",
            maxWidth: 360,
            alignSelf: "center",
            alignItems: "center",
            marginTop: 8,
          }}
        >
          {settings.method === "pin" ? (
            <>
              <PinKeypad
                key={resetKey}
                value={credential}
                maxLength={6}
                onChange={setCredential}
                onSubmit={(value) => void submitCredential(value)}
                minLength={4}
                submitLabel="Unlock"
                variant="lock"
              />
              <View style={{ marginTop: 18, width: "100%", maxWidth: 310, alignSelf: "center" }}>
                <PrimaryButton
                  label={unlocking ? "Verifying..." : "Unlock"}
                  disabled={unlocking || credential.length < 4}
                  onPress={() => void submitCredential()}
                />
              </View>
            </>
          ) : settings.method === "pattern" ? (
            <PatternGrid
              key={resetKey}
              resetKey={String(resetKey)}
              variant="lock"
              onDrawingChange={setPatternDrawing}
              onInvalid={() => setErrorMessage("Draw at least 4 different dots to unlock.")}
              onComplete={(pattern) => {
                setCredential(pattern);
                void submitCredential(pattern);
              }}
            />
          ) : (
            <View style={{ width: "100%", gap: 12 }}>
              <PasswordForm
                value={credential}
                onChange={setCredential}
                placeholder="Enter your password"
              />
              <PrimaryButton
                label={unlocking ? "Checking..." : "Unlock"}
                disabled={unlocking || !credential}
                onPress={() => void submitCredential()}
              />
            </View>
          )}
        </View>

        {errorMessage ? (
          <View
            accessibilityLiveRegion="polite"
            style={{
              alignSelf: "center",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              maxWidth: 360,
              marginTop: 12,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 14,
              backgroundColor: "#FEE2E2",
              borderWidth: 1,
              borderColor: "#FECACA",
            }}
          >
            <Ionicons name="alert-circle" size={18} color="#DC2626" />
            <Text
              style={{
                flex: 1,
                color: "#B91C1C",
                fontSize: 13,
                fontWeight: "600",
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
      </ScrollView>
    </SafeAreaView>
  );
}

function PrimaryButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: "100%",
        minHeight: 56,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 16,
        backgroundColor: disabled
          ? "#285B38"
          : pressed
            ? Colors.primaryDark
            : Colors.primary,
        opacity: pressed && !disabled ? 0.88 : 1,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: disabled ? 0 : 0.22,
        shadowRadius: 6,
        elevation: disabled ? 0 : 2,
      })}
    >
      {disabled && (label === "Checking..." || label === "Verifying...") ? (
        <ActivityIndicator color={Colors.white} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="lock-open-outline" size={18} color={Colors.white} />
          <Text style={{ color: disabled ? "#D5E84E" : Colors.white, fontSize: 15, fontWeight: "800", letterSpacing: 0.3 }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
