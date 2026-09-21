import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://veeturusi.qtechx.com/api";
  // process.env.EXPO_PUBLIC_API_URL || "http://10.11.28.32:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

const MAX_RETRIES = 1;
let cachedToken = null;

export function clearTokenCache() {
  cachedToken = null;
}

export async function setAuthToken(token) {
  if (token) {
    cachedToken = token;
    await AsyncStorage.setItem("userToken", token);
  } else {
    cachedToken = null;
    await AsyncStorage.removeItem("userToken");
  }
}

export async function getStoredToken() {
  const storageToken = await AsyncStorage.getItem("userToken");
  return storageToken || cachedToken || null;
}

export async function getStoredUser() {
  const storedUser = await AsyncStorage.getItem("userProfile");
  return storedUser ? JSON.parse(storedUser) : null;
}

export const NEW_ORDER_STATUSES = new Set([
  "pending",
  "new",
  "new order",
  "order placed",
]);

export function isNewOrderStatus(status) {
  return NEW_ORDER_STATUSES.has(
    String(status || "")
      .trim()
      .toLowerCase(),
  );
}

export function getApiErrorMessage(error, fallback = "Something went wrong") {
  return error?.message || error?.response?.data?.message || fallback;
}

api.interceptors.request.use(async (config) => {
  const storageToken = await AsyncStorage.getItem("userToken");
  const activeToken = storageToken || cachedToken;

  if (activeToken) {
    cachedToken = activeToken;
    config.headers.Authorization = `Bearer ${activeToken}`;
  } else {
    delete config.headers.Authorization;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const retryCount = originalRequest?._retryCount || 0;
    const isNetworkError =
      !error.response && (error.code || error.message === "Network Error");

    if (isNetworkError && originalRequest && retryCount < MAX_RETRIES) {
      originalRequest._retryCount = retryCount + 1;
      return api(originalRequest);
    }

    if (error.response) {
      if (error.response.status === 401) {
        try {
          await logoutUser();
        } catch {
          clearTokenCache();
        }
      }

      const message =
        error.response.data?.message ||
        error.response.data?.error ||
        "Server error";

      return Promise.reject({
        status: error.response.status,
        message,
        data: error.response.data,
      });
    }

    return Promise.reject({
      status: "network_error",
      message: `Network connection failed. Check that ${API_BASE_URL} is reachable.`,
    });
  },
);

export async function loginWithIdentifier(identifier, password) {
  const response = await api.post("/auth/login", {
    identifier: String(identifier || "").trim(),
    password: String(password || ""),
  });

  const { token, user, message } = response.data || {};

  if (token) {
    await setAuthToken(token);
  }

  if (user) {
    await AsyncStorage.setItem("userProfile", JSON.stringify(user));
  }

  return { ...response.data, message: message || "Login successful" };
}

export async function logoutUser() {
  await AsyncStorage.multiRemove(["userToken", "userProfile"]);
  clearTokenCache();
}

export default api;
