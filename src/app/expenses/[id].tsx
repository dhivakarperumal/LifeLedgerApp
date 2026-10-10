import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api, { getApiErrorMessage, logoutUser } from "../../api";
import {
  ExpenseDetailsContent,
  getExpenseDetailRecord,
  type ExpenseItem,
} from "../tabs/expenses";
import { GradientSafeAreaView as SafeAreaView } from "../../components/GradientSafeAreaView";
import { Colors } from "../../constants/colors";

export default function ExpenseDetailsPage() {
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [expense, setExpense] = useState<ExpenseItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestId = useRef(0);

  const loadExpense = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    if (!id) {
      setExpense(null);
      setError("This expense could not be found.");
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const response = await api.get(
        `/expenses/${encodeURIComponent(id)}`,
      );
      const record = getExpenseDetailRecord(response.data, id);
      if (currentRequestId !== requestId.current) return;
      if (!record || typeof record !== "object" || Array.isArray(record)) {
        setExpense(null);
        setError("This expense may have been deleted or is no longer available.");
        setNotFound(true);
        return;
      }

      setExpense(record as ExpenseItem);
    } catch (loadError) {
      if (currentRequestId !== requestId.current) return;
      const status =
        (loadError as { status?: number; response?: { status?: number } })
          ?.status ??
        (loadError as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        await logoutUser();
        router.replace("/auth/login");
        return;
      }

      setExpense(null);
      setNotFound(status === 404);
      setError(
        status === 404
          ? "This expense may have been deleted or is no longer available."
          : getApiErrorMessage(loadError, "Unable to load this expense."),
      );
    } finally {
      if (currentRequestId === requestId.current) setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    // The async request updates loading and result state after it starts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadExpense();
    return () => {
      requestId.current += 1;
    };
  }, [loadExpense, refreshKey]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/tabs/expenses");
  };

  const openAttachment = async (uri: string) => {
    try {
      await Linking.openURL(uri);
    } catch {
      Alert.alert("Unable to open attachment", "No app could open this file.");
    }
  };

  const title = expense?.title || expense?.name || "Expense details";

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: Colors.contentBackground }}
    >
      <LinearGradient
        colors={Colors.greenGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 16, paddingVertical: 12 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Back to expenses"
            style={{
              width: 38,
              height: 38,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 19,
              backgroundColor: Colors.white,
            }}
          >
            <Ionicons name="arrow-back" size={19} color={Colors.forest} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{ color: Colors.white, fontSize: 16, fontWeight: "700" }}
            >
              Expense details
            </Text>
            {expense ? (
              <Text
                numberOfLines={1}
                style={{ color: Colors.primaryLight, fontSize: 12, marginTop: 2 }}
              >
                {title}
              </Text>
            ) : null}
          </View>
        </View>
      </LinearGradient>

      {loading && !expense ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ color: Colors.sage, marginTop: 12 }}>
            Loading expense...
          </Text>
        </View>
      ) : expense ? (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 18,
            paddingBottom: insets.bottom + 28,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={{
              color: Colors.textPrimary,
              fontSize: 25,
              fontWeight: "800",
              marginBottom: 16,
            }}
          >
            {title}
          </Text>
          <ExpenseDetailsContent
            expense={expense}
            loading={loading}
            error={error}
            onRetry={() => setRefreshKey((current) => current + 1)}
            onOpenAttachment={openAttachment}
          />
        </ScrollView>
      ) : (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 28,
          }}
        >
          <Ionicons
            name={notFound ? "receipt-outline" : "cloud-offline-outline"}
            size={42}
            color={Colors.sage}
          />
          <Text
            style={{
              color: Colors.textPrimary,
              fontSize: 17,
              fontWeight: "700",
              textAlign: "center",
              marginTop: 14,
            }}
          >
            {notFound ? "Expense not found" : "Unable to load expense"}
          </Text>
          <Text
            style={{
              color: Colors.textSecondary,
              fontSize: 14,
              textAlign: "center",
              marginTop: 7,
            }}
          >
            {error}
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 22 }}>
            {!notFound ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setRefreshKey((current) => current + 1)}
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 11,
                  borderRadius: 12,
                  backgroundColor: Colors.primary,
                }}
              >
                <Text style={{ color: Colors.white, fontWeight: "700" }}>
                  Retry
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace("/tabs/expenses")}
              style={{
                paddingHorizontal: 18,
                paddingVertical: 11,
                borderRadius: 12,
                backgroundColor: Colors.white,
                borderWidth: 1,
                borderColor: "#DCE5DD",
              }}
            >
              <Text style={{ color: Colors.forest, fontWeight: "700" }}>
                Back to expenses
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
