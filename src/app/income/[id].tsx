import Ionicons from "@expo/vector-icons/Ionicons";
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
import api, {
  API_BASE_URL,
  getApiErrorMessage,
  logoutUser,
} from "../../api";
import { GradientSafeAreaView as SafeAreaView } from "../../components/GradientSafeAreaView";
import { Pagination } from "../../components/Pagination";
import { PageHeader } from "../../components/PageHeader";
import { Colors } from "../../constants/colors";

type DetailRecord = Record<string, unknown>;

type IncomeDetails = {
  income: DetailRecord;
  transfers: DetailRecord[];
  expenses: DetailRecord[];
};

type IncomeField = [string, unknown];
const detailItemsPerPage = 5;

function isRecord(value: unknown): value is DetailRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseIncomeDetails(responseData: unknown): IncomeDetails {
  let candidate: unknown = responseData;

  for (let depth = 0; depth < 5; depth += 1) {
    if (!isRecord(candidate)) break;
    if (
      isRecord(candidate.income) &&
      Array.isArray(candidate.transfers) &&
      Array.isArray(candidate.expenses)
    ) {
      if (
        !candidate.transfers.every(isRecord) ||
        !candidate.expenses.every(isRecord)
      ) {
        throw new Error("The server returned invalid income detail records.");
      }
      return {
        income: candidate.income,
        transfers: candidate.transfers,
        expenses: candidate.expenses,
      };
    }

    candidate =
      candidate.data ?? candidate.result ?? candidate.incomeDetails ?? null;
  }

  throw new Error("The server returned incomplete income details.");
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return "-";
}

function formatAmount(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value) return "-";
  const datePart = value.split(/[T ]/)[0];
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getAttachmentUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL.replace(/\/api\/?$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
}

function DetailField({ label, value }: { label: string; value: unknown }) {
  return (
    <View style={{ minWidth: "45%", flexGrow: 1 }}>
      <Text
        style={{
          color: Colors.textSecondary,
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <Text
        selectable
        style={{
          color: Colors.textPrimary,
          fontSize: 14,
          fontWeight: "600",
          lineHeight: 20,
          marginTop: 4,
        }}
      >
        {displayValue(value)}
      </Text>
    </View>
  );
}

function DetailsCard({
  title,
  fields,
  id,
  attachment,
  onOpenAttachment,
}: {
  title: string;
  fields: IncomeField[];
  id?: unknown;
  attachment?: unknown;
  onOpenAttachment: (path: string) => void;
}) {
  const attachmentPath =
    typeof attachment === "string" && attachment.trim() ? attachment : null;

  return (
    <View
      style={{
        backgroundColor: Colors.white,
        borderColor: Colors.border,
        borderRadius: 18,
        borderWidth: 1,
        marginBottom: 12,
        padding: 16,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <Text
          style={{
            color: Colors.textPrimary,
            flex: 1,
            fontSize: 16,
            fontWeight: "800",
            lineHeight: 22,
          }}
        >
          {title}
        </Text>
        {id !== undefined && id !== null ? (
          <Text style={{ color: Colors.textSecondary, fontSize: 12, marginLeft: 8 }}>
            #{displayValue(id)}
          </Text>
        ) : null}
      </View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          columnGap: 16,
          rowGap: 16,
          marginTop: 16,
        }}
      >
        {fields.map(([label, value]) => (
          <DetailField key={label} label={label} value={value} />
        ))}
      </View>
      {attachmentPath ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpenAttachment(attachmentPath)}
          style={{
            alignItems: "center",
            alignSelf: "flex-start",
            backgroundColor: "#EAF1EA",
            borderRadius: 11,
            flexDirection: "row",
            marginTop: 16,
            paddingHorizontal: 13,
            paddingVertical: 10,
          }}
        >
          <Ionicons name="attach-outline" size={17} color={Colors.primary} />
          <Text
            style={{
              color: Colors.primary,
              fontSize: 13,
              fontWeight: "700",
              marginLeft: 6,
            }}
          >
            Open attachment
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SectionHeading({
  title,
  count,
  icon,
}: {
  title: string;
  count: number;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <View
      style={{
        alignItems: "center",
        flexDirection: "row",
        marginBottom: 12,
        marginTop: 10,
      }}
    >
      <Ionicons name={icon} size={19} color={Colors.primary} />
      <Text
        style={{
          color: Colors.textPrimary,
          fontSize: 17,
          fontWeight: "800",
          marginLeft: 8,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          backgroundColor: "#E7EEE5",
          borderRadius: 20,
          marginLeft: 8,
          paddingHorizontal: 8,
          paddingVertical: 3,
        }}
      >
        <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: "700" }}>
          {count}
        </Text>
      </View>
    </View>
  );
}

function SectionPagination({
  currentPage,
  totalPages,
  totalItems,
  itemLabel,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <View style={{ alignItems: "center", marginTop: 4 }}>
      <Text style={{ color: Colors.textSecondary, fontSize: 12, marginBottom: 10 }}>
        Showing {(currentPage - 1) * detailItemsPerPage + 1}–
        {Math.min(currentPage * detailItemsPerPage, totalItems)} of {totalItems}{" "}
        {itemLabel}
      </Text>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </View>
  );
}

export default function IncomeDetailsPage() {
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [details, setDetails] = useState<IncomeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [transferPage, setTransferPage] = useState(1);
  const [expensePage, setExpensePage] = useState(1);
  const requestId = useRef(0);

  const loadDetails = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    if (!id) {
      setDetails(null);
      setError("This income record could not be found.");
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const response = await api.get(
        `/incomes/${encodeURIComponent(id)}/details`,
      );
      const nextDetails = parseIncomeDetails(response.data);
      if (
        nextDetails.income.id !== undefined &&
        String(nextDetails.income.id) !== id
      ) {
        throw new Error("The server returned details for a different income.");
      }
      if (currentRequestId === requestId.current) {
        setDetails(nextDetails);
        setTransferPage(1);
        setExpensePage(1);
      }
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
      setDetails(null);
      setNotFound(status === 404);
      setError(
        status === 404
          ? "This income may have been deleted or is no longer available."
          : getApiErrorMessage(loadError, "Unable to load income details."),
      );
    } finally {
      if (currentRequestId === requestId.current) setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    // The request manages loading and result state asynchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDetails();
    return () => {
      requestId.current += 1;
    };
  }, [loadDetails, refreshKey]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/income");
  };

  const openAttachment = async (path: string) => {
    try {
      await Linking.openURL(getAttachmentUrl(path));
    } catch {
      Alert.alert("Unable to open attachment", "No app could open this file.");
    }
  };

  const income = details?.income;
  const transferTotalPages = Math.ceil(
    (details?.transfers.length ?? 0) / detailItemsPerPage,
  );
  const expenseTotalPages = Math.ceil(
    (details?.expenses.length ?? 0) / detailItemsPerPage,
  );
  const displayedTransferPage = Math.min(
    transferPage,
    Math.max(transferTotalPages, 1),
  );
  const displayedExpensePage = Math.min(
    expensePage,
    Math.max(expenseTotalPages, 1),
  );
  const paginatedTransfers =
    details?.transfers.slice(
      (displayedTransferPage - 1) * detailItemsPerPage,
      displayedTransferPage * detailItemsPerPage,
    ) ?? [];
  const paginatedExpenses =
    details?.expenses.slice(
      (displayedExpensePage - 1) * detailItemsPerPage,
      displayedExpensePage * detailItemsPerPage,
    ) ?? [];
  const title =
    typeof income?.title === "string" ? income.title : "Income details";

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{ backgroundColor: Colors.contentBackground, flex: 1 }}
    >
      <PageHeader
        onBack={goBack}
        accessibilityLabel="Back to income"
        title={
          <View>
            <Text
              numberOfLines={1}
              style={{ color: Colors.white, fontSize: 18, fontWeight: "700" }}
            >
              Income details
            </Text>
            {income ? (
              <Text
                numberOfLines={1}
                style={{ color: Colors.primaryLight, fontSize: 12, marginTop: 2 }}
              >
                {title}
              </Text>
            ) : null}
          </View>
        }
      />

      {loading && !details ? (
        <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ color: Colors.textSecondary, marginTop: 12 }}>
            Loading income details...
          </Text>
        </View>
      ) : details && income ? (
        <ScrollView
          contentContainerStyle={{
            paddingBottom: insets.bottom + 28,
            paddingHorizontal: 16,
            paddingTop: 18,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              backgroundColor: "#EAF2E8",
              borderColor: "#D8E5D5",
              borderRadius: 18,
              borderWidth: 1,
              marginBottom: 20,
              padding: 18,
            }}
          >
            <Text
              style={{
                color: Colors.textSecondary,
                fontSize: 12,
                fontWeight: "700",
                letterSpacing: 0.7,
                textTransform: "uppercase",
              }}
            >
              Total income
            </Text>
            <Text
              style={{
                color: Colors.primaryDark,
                fontSize: 30,
                fontWeight: "900",
                marginTop: 5,
              }}
            >
              {formatAmount(income?.amount)}
            </Text>
            <Text
              style={{
                color: Colors.textSecondary,
                fontSize: 13,
                marginTop: 8,
              }}
            >
              Remaining balance{" "}
              <Text style={{ color: Colors.primary, fontWeight: "800" }}>
                {formatAmount(income?.remaining_amount)}
              </Text>
            </Text>
          </View>

          <SectionHeading title="Income" count={1} icon="wallet-outline" />
          <DetailsCard
            title={title}
            id={income.id}
            attachment={income.attachment}
            onOpenAttachment={(path) => void openAttachment(path)}
            fields={[
              ["Category", income.category],
              ["Income date", formatDate(income.income_date)],
              ["Payment method", income.payment_method],
              ["Recurring", income.recurring],
              ["Monthly budget", formatAmount(income.monthly_budget)],
              ["Notes", income.notes],
              ["Created", income.created_at],
              ["Last updated", income.updated_at],
            ]}
          />

          <SectionHeading
            title="Transfers"
            count={details.transfers.length}
            icon="swap-horizontal-outline"
          />
          {details.transfers.length ? (
            paginatedTransfers.map((transfer, index) => (
              <DetailsCard
                key={String(transfer.id ?? index)}
                title={displayValue(transfer.title)}
                id={transfer.id}
                attachment={transfer.receipt}
                onOpenAttachment={(path) => void openAttachment(path)}
                fields={[
                  ["Category", transfer.category],
                  ["Amount", formatAmount(transfer.amount)],
                  ["Remaining", formatAmount(transfer.remaining_amount)],
                  ["Transfer date", formatDate(transfer.transfer_date)],
                  ["Payment method", transfer.payment_method],
                  ["From", transfer.transfer_from],
                  ["To", transfer.transfer_to],
                  ["Total expense", formatAmount(transfer.total_expense)],
                  ["Total allocated", formatAmount(transfer.total_allocated)],
                  ["Total returned", formatAmount(transfer.total_returned)],
                  [
                    "Group total transferred",
                    formatAmount(transfer.group_total_transferred),
                  ],
                  ["Notes", transfer.notes],
                ]}
              />
            ))
          ) : (
            <Text style={{ color: Colors.textSecondary, marginBottom: 16 }}>
              No transfers for this income.
            </Text>
          )}
          <SectionPagination
            currentPage={displayedTransferPage}
            totalPages={transferTotalPages}
            totalItems={details.transfers.length}
            itemLabel="transfers"
            onPageChange={setTransferPage}
          />

          <SectionHeading
            title="Expenses"
            count={details.expenses.length}
            icon="receipt-outline"
          />
          {details.expenses.length ? (
            paginatedExpenses.map((expense, index) => (
              <DetailsCard
                key={String(expense.id ?? index)}
                title={displayValue(expense.title)}
                id={expense.id}
                attachment={expense.attachment}
                onOpenAttachment={(path) => void openAttachment(path)}
                fields={[
                  ["Amount", formatAmount(expense.expense_amount)],
                  ["Category", expense.category],
                  ["Date", formatDate(expense.expense_date)],
                  ["Time", expense.expense_time],
                  ["Payment method", expense.payment_method],
                  ["Location", expense.location],
                  ["From", expense.from],
                  ["To", expense.to],
                  ["Linked transfer", expense.linked_transfer_title],
                  ["Transfer amount", formatAmount(expense.transfer_amount)],
                  ["Remaining", formatAmount(expense.remaining_amount)],
                  ["Recurring", expense.recurring],
                  ["Notes", expense.notes],
                ]}
              />
            ))
          ) : (
            <Text style={{ color: Colors.textSecondary, marginBottom: 16 }}>
              No expenses for this income.
            </Text>
          )}
          <SectionPagination
            currentPage={displayedExpensePage}
            totalPages={expenseTotalPages}
            totalItems={details.expenses.length}
            itemLabel="expenses"
            onPageChange={setExpensePage}
          />
        </ScrollView>
      ) : (
        <View
          style={{
            alignItems: "center",
            flex: 1,
            justifyContent: "center",
            paddingHorizontal: 28,
          }}
        >
          <Ionicons
            name={notFound ? "wallet-outline" : "cloud-offline-outline"}
            size={42}
            color={Colors.sage}
          />
          <Text
            style={{
              color: Colors.textPrimary,
              fontSize: 17,
              fontWeight: "700",
              marginTop: 14,
              textAlign: "center",
            }}
          >
            {notFound ? "Income not found" : "Unable to load income details"}
          </Text>
          <Text
            style={{
              color: Colors.textSecondary,
              fontSize: 14,
              marginTop: 7,
              textAlign: "center",
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
                  backgroundColor: Colors.primary,
                  borderRadius: 12,
                  paddingHorizontal: 18,
                  paddingVertical: 11,
                }}
              >
                <Text style={{ color: Colors.white, fontWeight: "700" }}>
                  Retry
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace("/income")}
              style={{
                backgroundColor: Colors.white,
                borderColor: "#DCE5DD",
                borderRadius: 12,
                borderWidth: 1,
                paddingHorizontal: 18,
                paddingVertical: 11,
              }}
            >
              <Text style={{ color: Colors.forest, fontWeight: "700" }}>
                Back to income
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
