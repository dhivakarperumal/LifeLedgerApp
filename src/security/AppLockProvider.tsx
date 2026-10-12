import { Ionicons } from "@expo/vector-icons";
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
    if (
      !settings.biometricEnabled ||
      !biometricAvailable ||
      Platform.OS === "web"
    ) {
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
    settings.biometricEnabled,
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
      style={{ flex: 1, backgroundColor: "#F8FAF3" }}
    >
      <StatusBar barStyle="dark-content" />
      <LockScreenArtwork />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          paddingHorizontal: 20,
          paddingTop: 26,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width: "100%", maxWidth: 420, alignItems: "center" }}>
          <View
            style={{
              width: 80,
              height: 80,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 22,
              overflow: "hidden",
              shadowColor: "#173B26",
              shadowOffset: { width: 0, height: 5 },
              shadowOpacity: 0.16,
              shadowRadius: 10,
              elevation: 4,
            }}
          >
            <LinearGradient
              colors={["#247340", "#0B4729"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, {
                alignItems: "center",
                justifyContent: "center",
              }]}
            >
              <Ionicons name="wallet" size={37} color="#F4F8E9" />
              <View style={{ position: "absolute", right: 15, bottom: 14, flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
                <View style={{ width: 5, height: 9, borderRadius: 2, backgroundColor: "#C9E849" }} />
                <View style={{ width: 5, height: 14, borderRadius: 2, backgroundColor: "#C9E849" }} />
                <View style={{ width: 5, height: 19, borderRadius: 2, backgroundColor: "#C9E849" }} />
              </View>
            </LinearGradient>
          </View>
          <Text
            style={{
              marginTop: 10,
              color: "#153A2D",
              fontSize: 27,
              fontWeight: "800",
            }}
          >
            Life <Text style={{ color: "#85AD16" }}>Ledger</Text>
          </Text>
          <Text
            style={{
              marginTop: 3,
              color: "#244537",
              fontSize: 10,
              fontWeight: "600",
              textAlign: "center",
              textTransform: "uppercase",
            }}
          >
            Your money. A better tomorrow.
          </Text>
        </View>

        <View style={{ alignItems: "center", marginTop: 24, marginBottom: 10 }}>
          <View style={{ width: 38, height: 42, alignItems: "center", justifyContent: "center", marginBottom: 9 }}>
            <Ionicons name="lock-closed" size={31} color="#12472E" />
          </View>
          <Text style={{ color: "#18382C", fontSize: 18, fontWeight: "500", textAlign: "center" }}>
            {settings.method === "pin"
              ? "Enter PIN to unlock"
              : settings.method === "pattern"
                ? "Draw pattern to unlock"
                : "Enter password to unlock"}
          </Text>
        </View>

        {settings.biometricEnabled && biometricAvailable && settings.method !== "pin" ? (
          <View style={{ marginBottom: 12 }}>
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
                onBiometric={
                  settings.biometricEnabled && biometricAvailable
                    ? () => void submitBiometrics()
                    : undefined
                }
              />
              <View style={{ marginTop: 8, width: "100%", maxWidth: 290, alignSelf: "center" }}>
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

function LockScreenArtwork() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={{ position: "absolute", left: 28, top: 92, width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#EFF6E7", transform: [{ rotate: "-12deg" }] }}>
        <Ionicons name="receipt-outline" size={25} color="#8CB98A" />
      </View>
      <View style={{ position: "absolute", right: 27, top: 132, width: 45, height: 45, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#EFF6E7", transform: [{ rotate: "12deg" }] }}>
        <Ionicons name="bar-chart" size={24} color="#72A77A" />
      </View>
      <View style={{ position: "absolute", bottom: -105, left: -90, width: "145%", height: 235, borderRadius: 180, backgroundColor: "#D8EDB8" }} />
      <View style={{ position: "absolute", bottom: -128, left: -75, width: "140%", height: 205, borderRadius: 160, backgroundColor: "#8FC779" }} />
      <View style={{ position: "absolute", bottom: -148, left: -65, width: "135%", height: 185, borderRadius: 150, backgroundColor: "#397E47" }} />
      <View style={{ position: "absolute", bottom: -170, left: -50, width: "130%", height: 165, borderRadius: 130, backgroundColor: "#0D4D32" }} />
      <View style={{ position: "absolute", right: 46, bottom: 30, alignItems: "center" }}>
        <Ionicons name="leaf" size={47} color="#2F8A43" style={{ transform: [{ rotate: "-28deg" }] }} />
        <Ionicons name="leaf" size={38} color="#57A84A" style={{ position: "absolute", left: 25, top: 17, transform: [{ rotate: "23deg" }] }} />
        <View style={{ width: 3, height: 46, marginTop: -7, backgroundColor: "#17613A" }} />
      </View>
      <View style={{ position: "absolute", right: 86, bottom: 15, flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
        <View style={{ width: 24, height: 12, borderRadius: 12, backgroundColor: "#B8D82B" }} />
        <View style={{ width: 35, height: 30, borderRadius: 8, backgroundColor: "#A6CC22", borderTopWidth: 4, borderTopColor: "#E0EF48" }} />
        <View style={{ width: 30, height: 22, borderRadius: 8, backgroundColor: "#8AB81C", borderTopWidth: 4, borderTopColor: "#D5E944" }} />
      </View>
    </View>
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
        minHeight: 50,
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
