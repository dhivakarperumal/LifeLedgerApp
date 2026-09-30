import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { Colors } from "../constants/colors";

export const DATE_RANGE_PRESETS = [
  "All",
  "Today",
  "Yesterday",
  "This Week",
  "Last Week",
  "This Month",
  "Last Month",
  "This Year",
  "Last Year",
  "Custom Range",
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

export type DateRangeSelection = {
  filter: DateRangePreset;
  startDate: string | null;
  endDate: string | null;
};

type DateRangeFilterProps = {
  value: DateRangeSelection;
  onChange: (selection: DateRangeSelection) => void;
  style?: ViewStyle;
};

type DateField = "from" | "to";

const optionIcons: Record<
  DateRangePreset,
  keyof typeof Ionicons.glyphMap
> = {
  All: "calendar-outline",
  Today: "today-outline",
  Yesterday: "time-outline",
  "This Week": "calendar-outline",
  "Last Week": "calendar-clear-outline",
  "This Month": "calendar-number-outline",
  "Last Month": "time-outline",
  "This Year": "calendar-outline",
  "Last Year": "time-outline",
  "Custom Range": "calendar-sharp",
};

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : undefined;
}

function formatDate(value: string | null) {
  const date = parseDateKey(value);
  return date
    ? date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Select date";
}

export function createDateRangeSelection(
  filter: DateRangePreset,
  referenceDate = new Date(),
  customDates?: { startDate: string | null; endDate: string | null },
): DateRangeSelection {
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const todayKey = dateKey(today);

  if (filter === "All") {
    return { filter, startDate: null, endDate: null };
  }
  if (filter === "Custom Range") {
    return {
      filter,
      startDate: customDates?.startDate ?? null,
      endDate: customDates?.endDate ?? null,
    };
  }
  if (filter === "Today") {
    return { filter, startDate: todayKey, endDate: todayKey };
  }
  if (filter === "Yesterday") {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const key = dateKey(yesterday);
    return { filter, startDate: key, endDate: key };
  }
  if (filter === "This Week" || filter === "Last Week") {
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    if (filter === "Last Week") weekStart.setDate(weekStart.getDate() - 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return {
      filter,
      startDate: dateKey(weekStart),
      endDate: filter === "This Week" ? todayKey : dateKey(weekEnd),
    };
  }
  if (filter === "This Month") {
    return {
      filter,
      startDate: dateKey(new Date(today.getFullYear(), today.getMonth(), 1)),
      endDate: todayKey,
    };
  }
  if (filter === "Last Month") {
    return {
      filter,
      startDate: dateKey(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      endDate: dateKey(new Date(today.getFullYear(), today.getMonth(), 0)),
    };
  }
  if (filter === "This Year") {
    return {
      filter,
      startDate: dateKey(new Date(today.getFullYear(), 0, 1)),
      endDate: todayKey,
    };
  }

  return {
    filter,
    startDate: dateKey(new Date(today.getFullYear() - 1, 0, 1)),
    endDate: dateKey(new Date(today.getFullYear() - 1, 11, 31)),
  };
}

export function isDateInRange(
  value: string | Date | null | undefined,
  range: DateRangeSelection,
) {
  if (!range.startDate && !range.endDate) return true;
  if (!value) return false;

  const key =
    value instanceof Date
      ? dateKey(value)
      : /^\d{4}-\d{2}-\d{2}/.test(value)
        ? value.slice(0, 10)
        : (() => {
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? null : dateKey(date);
          })();
  if (!key) return false;

  return (
    (!range.startDate || key >= range.startDate) &&
    (!range.endDate || key <= range.endDate)
  );
}

export function DateRangeFilter({
  value,
  onChange,
  style,
}: DateRangeFilterProps) {
  const [visible, setVisible] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [draftStart, setDraftStart] = useState(() => new Date());
  const [draftEnd, setDraftEnd] = useState(() => new Date());
  const [activeField, setActiveField] = useState<DateField>("from");
  const [androidPickerField, setAndroidPickerField] =
    useState<DateField | null>(null);
  const [validationError, setValidationError] = useState("");

  const selectedLabel =
    value.filter === "All"
      ? "All dates"
      : value.filter === "Custom Range" && value.startDate && value.endDate
        ? `${formatDate(value.startDate)} - ${formatDate(value.endDate)}`
        : value.filter;

  const close = () => {
    setVisible(false);
    setCustomMode(false);
    setAndroidPickerField(null);
    setValidationError("");
  };

  const selectPreset = (preset: DateRangePreset) => {
    if (preset === "Custom Range") {
      setDraftStart(
        parseDateKey(value.filter === preset ? value.startDate : null) ||
          new Date(),
      );
      setDraftEnd(
        parseDateKey(value.filter === preset ? value.endDate : null) ||
          new Date(),
      );
      setActiveField("from");
      setValidationError("");
      setCustomMode(true);
      return;
    }

    onChange(createDateRangeSelection(preset));
    close();
  };

  const updateDraft = (field: DateField, date: Date) => {
    if (field === "from") setDraftStart(date);
    else setDraftEnd(date);
    setValidationError("");
  };

  const applyCustomRange = () => {
    const startDate = dateKey(draftStart);
    const endDate = dateKey(draftEnd);
    if (startDate > endDate) {
      setValidationError("From Date must be on or before To Date.");
      return;
    }

    onChange(
      createDateRangeSelection("Custom Range", new Date(), {
        startDate,
        endDate,
      }),
    );
    close();
  };

  return (
    <View style={style}>
      <Pressable
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={`Date range: ${selectedLabel}`}
        accessibilityHint="Opens date range options"
        style={{
          minHeight: 50,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          borderWidth: 1,
          borderColor: value.filter === "All" ? Colors.border : Colors.forest,
          borderRadius: 14,
          backgroundColor: Colors.white,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            backgroundColor: "#EAF1EB",
          }}
        >
          <Ionicons name="calendar-outline" size={17} color={Colors.forest} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text
            style={{
              color: Colors.textSecondary,
              fontSize: 11,
              fontWeight: "600",
            }}
          >
            Date range
          </Text>
          <Text
            numberOfLines={1}
            style={{
              marginTop: 1,
              color: Colors.textPrimary,
              fontSize: 14,
              fontWeight: "700",
            }}
          >
            {selectedLabel}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
            backgroundColor: "rgba(19, 34, 25, 0.48)",
          }}
        >
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close date range options"
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
          />
          <View
            style={{
              width: "100%",
              maxWidth: 390,
              maxHeight: "90%",
              padding: 16,
              borderWidth: 1,
              borderColor: Colors.border,
              borderRadius: 20,
              backgroundColor: Colors.white,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.16,
              shadowRadius: 18,
              elevation: 10,
            }}
          >
            {customMode ? (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <Pressable
                    onPress={() => setCustomMode(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Back to date range options"
                    hitSlop={8}
                    style={{ padding: 4 }}
                  >
                    <Ionicons
                      name="arrow-back"
                      size={21}
                      color={Colors.forest}
                    />
                  </Pressable>
                  <Text
                    style={{
                      flex: 1,
                      marginLeft: 8,
                      color: Colors.textPrimary,
                      fontSize: 18,
                      fontWeight: "800",
                    }}
                  >
                    Custom date range
                  </Text>
                </View>

                <View style={{ flexDirection: "row", gap: 10 }}>
                  {(["from", "to"] as const).map((field) => {
                    const active = activeField === field;
                    const date = field === "from" ? draftStart : draftEnd;
                    return (
                      <Pressable
                        key={field}
                        onPress={() => {
                          setActiveField(field);
                          setValidationError("");
                          if (Platform.OS === "android") {
                            setAndroidPickerField(field);
                          }
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`${field === "from" ? "From Date" : "To Date"}: ${formatDate(dateKey(date))}`}
                        style={{
                          flex: 1,
                          minHeight: 62,
                          justifyContent: "center",
                          paddingHorizontal: 11,
                          borderWidth: 1,
                          borderColor: active ? Colors.forest : Colors.border,
                          borderRadius: 13,
                          backgroundColor: active ? "#F0F6F1" : Colors.white,
                        }}
                      >
                        <Text
                          style={{
                            color: Colors.textSecondary,
                            fontSize: 11,
                            fontWeight: "600",
                          }}
                        >
                          {field === "from" ? "From Date" : "To Date"}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{
                            marginTop: 4,
                            color: Colors.textPrimary,
                            fontSize: 13,
                            fontWeight: "700",
                          }}
                        >
                          {formatDate(dateKey(date))}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {Platform.OS === "ios" ? (
                  <View
                    style={{
                      marginTop: 14,
                      alignItems: "center",
                      overflow: "hidden",
                      borderRadius: 13,
                      backgroundColor: "#F7F9F7",
                    }}
                  >
                    <DateTimePicker
                      value={activeField === "from" ? draftStart : draftEnd}
                      mode="date"
                      display="spinner"
                      minimumDate={activeField === "to" ? draftStart : undefined}
                      maximumDate={activeField === "from" ? draftEnd : undefined}
                      onChange={(_, date) => {
                        if (date) updateDraft(activeField, date);
                      }}
                    />
                  </View>
                ) : null}

                {validationError ? (
                  <Text
                    accessibilityRole="alert"
                    style={{
                      marginTop: 10,
                      color: Colors.danger,
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    {validationError}
                  </Text>
                ) : null}

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    gap: 9,
                    marginTop: 18,
                  }}
                >
                  <Pressable
                    onPress={close}
                    accessibilityRole="button"
                    style={{
                      minWidth: 90,
                      minHeight: 44,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 14,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      borderRadius: 12,
                      backgroundColor: Colors.white,
                    }}
                  >
                    <Text
                      style={{
                        color: Colors.textSecondary,
                        fontSize: 14,
                        fontWeight: "700",
                      }}
                    >
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={applyCustomRange}
                    accessibilityRole="button"
                    style={{
                      minWidth: 100,
                      minHeight: 44,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      backgroundColor: Colors.forest,
                    }}
                  >
                    <Text
                      style={{
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: "700",
                      }}
                    >
                      Apply
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <Text
                    style={{
                      color: Colors.textPrimary,
                      fontSize: 18,
                      fontWeight: "800",
                    }}
                  >
                    Date range
                  </Text>
                  <Pressable
                    onPress={close}
                    accessibilityRole="button"
                    accessibilityLabel="Close date range options"
                    hitSlop={8}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="close" size={21} color={Colors.textSecondary} />
                  </Pressable>
                </View>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 2 }}
                >
                  {DATE_RANGE_PRESETS.map((preset) => {
                    const selected = value.filter === preset;
                    return (
                      <Pressable
                        key={preset}
                        onPress={() => selectPreset(preset)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        style={{
                          minHeight: 46,
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 11,
                          marginTop: 3,
                          borderRadius: 11,
                          backgroundColor: selected ? "#EAF2EB" : Colors.white,
                        }}
                      >
                        <Ionicons
                          name={optionIcons[preset]}
                          size={18}
                          color={selected ? Colors.forest : Colors.textSecondary}
                        />
                        <Text
                          style={{
                            flex: 1,
                            marginLeft: 11,
                            color: Colors.textPrimary,
                            fontSize: 14,
                            fontWeight: selected ? "700" : "500",
                          }}
                        >
                          {preset}
                        </Text>
                        {selected ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={19}
                            color={Colors.forest}
                          />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {Platform.OS === "android" && androidPickerField ? (
        <DateTimePicker
          value={androidPickerField === "from" ? draftStart : draftEnd}
          mode="date"
          display="default"
          minimumDate={androidPickerField === "to" ? draftStart : undefined}
          maximumDate={androidPickerField === "from" ? draftEnd : undefined}
          onChange={(event, date) => {
            if (event.type === "set" && date) {
              updateDraft(androidPickerField, date);
            }
            setAndroidPickerField(null);
          }}
        />
      ) : null}
    </View>
  );
}