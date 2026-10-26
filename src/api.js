import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://lifetracking.qtechx.com/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

let cachedToken;
let tokenCacheVersion = 0;
let tokenReadPromise = null;
let cachedUser;
let userCacheVersion = 0;
let userReadPromise = null;
let appLockToken = null;
const inFlightGetRequests = new Map();

const clearInFlightGetRequests = () => {
  inFlightGetRequests.clear();
};

/* =========================
   TOKEN MANAGEMENT
========================= */

export const setAuthToken = async (token) => {
  tokenCacheVersion += 1;
  clearInFlightGetRequests();
  cachedToken = token || null;
  tokenReadPromise = null;

  if (token) {
    await AsyncStorage.setItem("userToken", token);
  } else {
    await AsyncStorage.removeItem("userToken");
  }
};

export const getStoredToken = async () => {
  if (cachedToken !== undefined) {
    return cachedToken;
  }

  if (!tokenReadPromise) {
    const version = tokenCacheVersion;
    const request = AsyncStorage.getItem("userToken")
      .then((token) => {
        const value = token || null;
        if (version !== tokenCacheVersion) return cachedToken || null;
        cachedToken = value;
        return value;
      })
      .finally(() => {
        if (tokenReadPromise === request) tokenReadPromise = null;
      });
    tokenReadPromise = request;
  }

  return tokenReadPromise;
};

export const clearTokenCache = () => {
  tokenCacheVersion += 1;
  clearInFlightGetRequests();
  cachedToken = undefined;
  tokenReadPromise = null;
};

export const getShared = (url) => {
  const existingRequest = inFlightGetRequests.get(url);
  if (existingRequest) return existingRequest;

  const request = api.get(url).finally(() => {
    if (inFlightGetRequests.get(url) === request) {
      inFlightGetRequests.delete(url);
    }
  });
  inFlightGetRequests.set(url, request);
  return request;
};

export const getAppLockToken = () => appLockToken;

export const setAppLockToken = (token) => {
  appLockToken = token || null;
};

/* =========================
   USER PROFILE
========================= */

export const saveUser = async (user) => {
  if (user) {
    userCacheVersion += 1;
    cachedUser = user;
    userReadPromise = null;
    await AsyncStorage.setItem("userProfile", JSON.stringify(user));
  }
};

export const getStoredUser = async () => {
  if (cachedUser !== undefined) {
    return cachedUser;
  }

  if (!userReadPromise) {
    const version = userCacheVersion;
    const request = AsyncStorage.getItem("userProfile")
      .then((user) => {
        if (version !== userCacheVersion) return cachedUser || null;
        if (!user) return (cachedUser = null);
        try {
          cachedUser = JSON.parse(user);
          return cachedUser;
        } catch {
          cachedUser = null;
          return null;
        }
      })
      .finally(() => {
        if (userReadPromise === request) userReadPromise = null;
      });
    userReadPromise = request;
  }

  return userReadPromise;
};

/* =========================
   API ERROR
========================= */

export const getApiErrorMessage = (
  error,
  fallback = "Something went wrong",
) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
};

/* =========================
   REQUEST INTERCEPTOR
========================= */

api.interceptors.request.use(
  async (config) => {
    const token = await getStoredToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (appLockToken) {
      config.headers["X-App-Lock-Token"] = appLockToken;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

/* =========================
   RESPONSE INTERCEPTOR
========================= */

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    if (error.response) {
      const status = error.response.status;

      const isAppLockUnlock = String(error.config?.url || "").includes(
        "/app-lock/unlock",
      );
      if (status === 401 && !isAppLockUnlock) {
        await logoutUser();
      }

      return Promise.reject({
        status,
        message:
          error.response.data?.message ||
          error.response.data?.error ||
          "Server error",
        data: error.response.data,
      });
    }

    return Promise.reject({
      status: "network_error",
      message:
        "Network connection failed. Please check your internet connection.",
    });
  },
);

/* =========================
   LOGIN
========================= */

export const loginWithIdentifier = async (identifier, password) => {
  try {
    const response = await api.post("/auth/login", {
      identifier: String(identifier || "").trim(),
      password: String(password || ""),
    });

    const data = response.data || {};

    if (data.token) {
      await setAuthToken(data.token);
    }

    if (data.user) {
      await saveUser(data.user);
    }

    return {
      ...data,
      message: data.message || "Login successful",
    };
  } catch (error) {
    throw error;
  }
};

/* =========================
   REGISTRATION
========================= */

export const registerUser = async ({ username, email, phone, password }) => {
  const response = await api.post("/auth/register", {
    username: String(username || "").trim(),
    email: String(email || "").trim(),
    phone: String(phone || "").trim(),
    role: "admin",
    password: String(password || ""),
  });

  return response.data || {};
};

/* =========================
   LOGOUT
========================= */

export const logoutUser = async () => {
  try {
    await AsyncStorage.multiRemove(["userToken", "userProfile"]);
  } finally {
    clearTokenCache();
    userCacheVersion += 1;
    cachedUser = null;
    userReadPromise = null;
    setAppLockToken(null);
  }
};

/* =========================
   CHECK LOGIN
========================= */

export const isLoggedIn = async () => {
  const token = await getStoredToken();
  return !!token;
};

export default api;
