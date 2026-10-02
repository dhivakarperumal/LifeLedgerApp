import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../constants/colors";
import { formFieldStyles } from "./FormControls";

type PickerMode = "date" | "time" | "datetime";
type PickerSection = "date" | "time";
type CalendarView = "calendar" | "months" | "years";

export type DateTimePickerComponentProps = {
  mode?: PickerMode;
  value?: Date | null;
  onChange: (value: Date | null) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  compact?: boolean;
  labelStyle?: StyleProp<TextStyle>;
};

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => index);
const PICKER_ROW_HEIGHT = 40;

function sameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function hourOf(date: Date) {
  return date.getHours() % 12 || 12;
}

function isBeforeMonth(date: Date, year: number, month: number) {
  return (
    date.getFullYear() > year ||
    (date.getFullYear() === year && date.getMonth() > month)
  );
}

function isAfterMonth(date: Date, year: number, month: number) {
  return (
    date.getFullYear() < year ||
    (date.getFullYear() === year && date.getMonth() < month)
  );
}

export function DateTimePickerComponent({
  mode = "date",
  value = null,
  onChange,
  minimumDate,
  maximumDate,
  placeholder = "Select date and time",
  label,
  disabled = false,
  compact = false,
  labelStyle,
}: DateTimePickerComponentProps) {
  const isCompactNarrow = useWindowDimensions().width < 390;
  const [visible, setVisible] = useState(false);
  const [section, setSection] = useState<PickerSection>(
    mode === "time" ? "time" : "date",
  );
  const [draft, setDraft] = useState(() => value ?? new Date());
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const initialDate = value ?? new Date();
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
  });
  const [calendarView, setCalendarView] = useState<CalendarView>("calendar");
  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);
  const periodScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!visible || section !== "time") return;

    const frame = requestAnimationFrame(() => {
      hourScrollRef.current?.scrollTo({
        y: (hourOf(draft) - 1) * PICKER_ROW_HEIGHT,
        animated: false,
      });
      minuteScrollRef.current?.scrollTo({
        y: draft.getMinutes() * PICKER_ROW_HEIGHT,
        animated: false,
      });
      periodScrollRef.current?.scrollTo({
        y: (draft.getHours() >= 12 ? 1 : 0) * PICKER_ROW_HEIGHT,
        animated: false,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [draft, section, visible]);

  const openPicker = (nextSection: PickerSection) => {
    setDraft(value ? new Date(value) : new Date());
    const initialDate = value ? new Date(value) : new Date();
    setCalendarMonth(
      new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
    );
    setCalendarView("calendar");
    setSection(nextSection);
    setVisible(true);
  };

  const resetDraftToCurrentValue = () => {
    setDraft(value ? new Date(value) : new Date());
  };

  const closePicker = () => {
    resetDraftToCurrentValue();
    setVisible(false);
  };

  const isSelectableDay = (date: Date) => {
    const day = startOfDay(date);
    return (
      (!minimumDate || day >= startOfDay(minimumDate)) &&
      (!maximumDate || day <= startOfDay(maximumDate))
    );
  };

  const isSelectableMonth = (year: number, month: number) => {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    return (
      (!minimumDate || monthEnd >= startOfDay(minimumDate)) &&
      (!maximumDate || monthStart <= startOfDay(maximumDate))
    );
  };

  const isValidSelection = (date: Date) => {
    if (mode === "date") {
      return isSelectableDay(date);
    }
    return (
      (!minimumDate || date >= minimumDate) &&
      (!maximumDate || date <= maximumDate)
    );
  };

  const selectDay = (day: number) => {
    const nextDate = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      day,
      draft.getHours(),
      draft.getMinutes(),
      draft.getSeconds(),
      draft.getMilliseconds(),
    );

    if (
      minimumDate &&
      sameDay(nextDate, minimumDate) &&
      nextDate < minimumDate
    ) {
      nextDate.setHours(
        minimumDate.getHours(),
        minimumDate.getMinutes(),
        minimumDate.getSeconds(),
        minimumDate.getMilliseconds(),
      );
    }
    if (
      maximumDate &&
      sameDay(nextDate, maximumDate) &&
      nextDate > maximumDate
    ) {
      nextDate.setHours(
        maximumDate.getHours(),
        maximumDate.getMinutes(),
        maximumDate.getSeconds(),
        maximumDate.getMilliseconds(),
      );
    }

    setDraft(nextDate);
  };

  const updateTime = (update: (date: Date) => void) => {
    setDraft((current) => {
      const nextDate = new Date(current);
      update(nextDate);
      return nextDate;
    });
  };

  const confirmSelection = () => {
    if (!isValidSelection(draft)) return;
    onChange(new Date(draft));
    closePicker();
  };

  const changeMonth = (amount: number) => {
    const nextMonth = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + amount,
      1,
    );
    if (
      (minimumDate &&
        isAfterMonth(
          minimumDate,
          nextMonth.getFullYear(),
          nextMonth.getMonth(),
        )) ||
      (maximumDate &&
        isBeforeMonth(
          maximumDate,
          nextMonth.getFullYear(),
          nextMonth.getMonth(),
        ))
    ) {
      return;
    }
    setCalendarMonth(nextMonth);
  };

  const monthDays = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
    0,
  ).getDate();
  const calendarOffset = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth(),
    1,
  ).getDay();
  const currentYear = new Date().getFullYear();
  const firstYear = minimumDate?.getFullYear() ?? currentYear - 100;
  const lastYear = maximumDate?.getFullYear() ?? currentYear + 100;
  const years =
    lastYear >= firstYear
      ? Array.from(
          { length: lastYear - firstYear + 1 },
          (_, index) => firstYear + index,
        )
      : [];
  const selectedHour = hourOf(draft);
  const selectedPeriod = draft.getHours() >= 12 ? "PM" : "AM";

  return (
    <View>
      {label ? (
        compact ? (
          <View style={styles.compactLabelRow}>
            <View style={styles.compactLabelAccent} />
            <Text style={[styles.compactLabel, labelStyle]}>{label}</Text>
          </View>
        ) : (
          <Text style={[formFieldStyles.label, labelStyle]}>{label}</Text>
        )
      ) : null}
      <View style={[styles.fields, mode !== "datetime" && styles.singleField]}>
        {mode !== "time" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              value ? `Date, ${formatDate(value)}` : placeholder
            }
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => openPicker("date")}
            style={({ pressed }) => {
              const combinedStyles: any[] = [styles.field];
              if (mode === "datetime") combinedStyles.push(styles.fieldHalf);
              if (compact) combinedStyles.push(styles.compactField);
              if (compact && isCompactNarrow) {
                combinedStyles.push(styles.compactFieldNarrow);
              }
              if (disabled) combinedStyles.push(styles.disabledField);
              if (pressed) combinedStyles.push(styles.pressedField);
              return combinedStyles;
            }}
          >
            {compact ? (
              <View
                style={[
                  styles.compactIconTile,
                  isCompactNarrow && styles.compactIconTileNarrow,
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={isCompactNarrow ? 14 : 18}
                  color={Colors.primary}
                />
              </View>
            ) : (
              <View style={styles.fieldHeading}>
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={Colors.primary}
                />
                <Text style={styles.fieldLabel}>Date</Text>
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={Colors.textSecondary}
                  style={styles.fieldChevron}
                />
              </View>
            )}
            {compact ? (
              <View style={styles.compactFieldCopy}>
                <Text style={styles.compactFieldLabel}>Date</Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={isCompactNarrow ? 0.7 : 0.85}
                  style={[
                    styles.compactFieldValue,
                    !value ? styles.placeholder : null,
                    isCompactNarrow && styles.compactFieldValueNarrow,
                  ]}
                >
                  {value
                    ? formatDate(value)
                    : mode === "date"
                      ? placeholder
                      : "Select date"}
                </Text>
              </View>
            ) : (
              <Text
                style={[styles.fieldValue, !value ? styles.placeholder : null]}
              >
                {value
                  ? formatDate(value)
                  : mode === "date"
                    ? placeholder
                    : "Select date"}
              </Text>
            )}
            {compact ? (
              <Ionicons
                name="chevron-down"
                size={isCompactNarrow ? 14 : 16}
                color={Colors.textPrimary}
              />
            ) : null}
          </Pressable>
        ) : null}
        {mode !== "date" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              value ? `Time, ${formatTime(value)}` : placeholder
            }
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => openPicker("time")}
            style={({ pressed }) => {
              const combinedStyles: any[] = [styles.field];
              if (mode === "datetime") combinedStyles.push(styles.fieldHalf);
              if (compact) combinedStyles.push(styles.compactField);
              if (compact && isCompactNarrow) {
                combinedStyles.push(styles.compactFieldNarrow);
              }
              if (disabled) combinedStyles.push(styles.disabledField);
              if (pressed) combinedStyles.push(styles.pressedField);
              return combinedStyles;
            }}
          >
            {compact ? (
              <View
                style={[
                  styles.compactIconTile,
                  isCompactNarrow && styles.compactIconTileNarrow,
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={isCompactNarrow ? 14 : 18}
                  color={Colors.primary}
                />
              </View>
            ) : (
              <View style={styles.fieldHeading}>
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={Colors.primary}
                />
                <Text style={styles.fieldLabel}>Time</Text>
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={Colors.textSecondary}
                  style={styles.fieldChevron}
                />
              </View>
            )}
            {compact ? (
              <View style={styles.compactFieldCopy}>
                <Text style={styles.compactFieldLabel}>Time</Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={isCompactNarrow ? 0.7 : 0.85}
                  style={[
                    styles.compactFieldValue,
                    !value ? styles.placeholder : null,
                    isCompactNarrow && styles.compactFieldValueNarrow,
                  ]}
                >
                  {value
                    ? formatTime(value)
                    : mode === "time"
                      ? placeholder
                      : "Select time"}
                </Text>
              </View>
            ) : (
              <Text
                style={[styles.fieldValue, !value ? styles.placeholder : null]}
              >
                {value
                  ? formatTime(value)
                  : mode === "time"
                    ? placeholder
                    : "Select time"}
              </Text>
            )}
            {compact ? (
              <Ionicons
                name="chevron-down"
                size={isCompactNarrow ? 14 : 16}
                color={Colors.textPrimary}
              />
            ) : null}
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.fields, mode !== "datetime" && styles.singleField]}>
        {mode !== "time" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={value ? `Date, ${formatDate(value)}` : placeholder}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => openPicker("date")}
            style={({ pressed }) => [
              styles.field,
              mode === "datetime" && styles.fieldHalf,
              compact && styles.compactField,
              compact && isCompactNarrow && styles.compactFieldNarrow,
              disabled && styles.disabledField,
              pressed && styles.pressedField,
            ]}
          >
            {compact ? (
              <View
                style={[
                  styles.compactIconTile,
                  isCompactNarrow && styles.compactIconTileNarrow,
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={isCompactNarrow ? 14 : 18}
                  color={Colors.primary}
                />
              </View>
            ) : (
              <View style={styles.fieldHeading}>
                <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
                <Text style={styles.fieldLabel}>Date</Text>
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={Colors.textSecondary}
                  style={styles.fieldChevron}
                />
              </View>
            )}
            {compact ? (
              <View style={styles.compactFieldCopy}>
                <Text style={styles.compactFieldLabel}>Date</Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={isCompactNarrow ? 0.7 : 0.85}
                  style={[
                    styles.compactFieldValue,
                    !value && styles.placeholder,
                    isCompactNarrow && styles.compactFieldValueNarrow,
                  ]}
                >
                  {value
                    ? formatDate(value)
                    : mode === "date"
                      ? placeholder
                      : "Select date"}
                </Text>
              </View>
            ) : (
              <Text style={[styles.fieldValue, !value && styles.placeholder]}>
                {value
                  ? formatDate(value)
                  : mode === "date"
                    ? placeholder
                    : "Select date"}
              </Text>
            )}
            {compact ? (
              <Ionicons
                name="chevron-down"
                size={isCompactNarrow ? 14 : 16}
                color={Colors.textPrimary}
              />
            ) : null}
          </Pressable>
        ) : null}
        {mode !== "date" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={value ? `Time, ${formatTime(value)}` : placeholder}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => openPicker("time")}
            style={({ pressed }) => [
              styles.field,
              mode === "datetime" && styles.fieldHalf,
              compact && styles.compactField,
              compact && isCompactNarrow && styles.compactFieldNarrow,
              disabled && styles.disabledField,
              pressed && styles.pressedField,
            ]}
          >
            {compact ? (
              <View
                style={[
                  styles.compactIconTile,
                  isCompactNarrow && styles.compactIconTileNarrow,
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={isCompactNarrow ? 14 : 18}
                  color={Colors.primary}
                />
              </View>
            ) : (
              <View style={styles.fieldHeading}>
                <Ionicons name="time-outline" size={18} color={Colors.primary} />
                <Text style={styles.fieldLabel}>Time</Text>
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={Colors.textSecondary}
                  style={styles.fieldChevron}
                />
              </View>
            )}
            {compact ? (
              <View style={styles.compactFieldCopy}>
                <Text style={styles.compactFieldLabel}>Time</Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={isCompactNarrow ? 0.7 : 0.85}
                  style={[
                    styles.compactFieldValue,
                    !value && styles.placeholder,
                    isCompactNarrow && styles.compactFieldValueNarrow,
                  ]}
                >
                  {value
                    ? formatTime(value)
                    : mode === "time"
                      ? placeholder
                      : "Select time"}
                </Text>
              </View>
            ) : (
              <Text style={[styles.fieldValue, !value && styles.placeholder]}>
                {value
                  ? formatTime(value)
                  : mode === "time"
                    ? placeholder
                    : "Select time"}
              </Text>
            )}
            {compact ? (
              <Ionicons
                name="chevron-down"
                size={isCompactNarrow ? 14 : 16}
                color={Colors.textPrimary}
              />
            ) : null}
          </Pressable>
        ) : null}
      </View>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={closePicker}
        statusBarTranslucent
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close date and time picker"
            onPress={closePicker}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView edges={["bottom"]} style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.headerCopy}>
                <Text style={styles.sheetTitle}>
                  {section === "date" ? "Choose Date" : "Set Time"}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {section === "date"
                    ? formatDate(draft)
                    : mode === "datetime"
                      ? `${formatDate(draft)}  ·  ${formatTime(draft)}`
                      : formatTime(draft)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close picker"
                hitSlop={10}
                onPress={closePicker}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={21} color={Colors.textPrimary} />
              </Pressable>
            </View>

            {mode === "datetime" ? (
              <View style={styles.segmentedControl}>
                {(["date", "time"] as const).map((pickerSection) => (
                  <Pressable
                    key={pickerSection}
                    accessibilityRole="button"
                    accessibilityState={{ selected: section === pickerSection }}
                    onPress={() => setSection(pickerSection)}
                    style={[
                      styles.segment,
                      section === pickerSection && styles.segmentSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        section === pickerSection && styles.segmentTextSelected,
                      ]}
                    >
                      {pickerSection === "date" ? "Date" : "Time"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {section === "date" ? (
              <View>
                <View style={styles.monthHeader}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Previous month"
                    disabled={
                      !!minimumDate &&
                      isAfterMonth(
                        minimumDate,
                        calendarMonth.getFullYear(),
                        calendarMonth.getMonth(),
                      )
                    }
                    onPress={() => changeMonth(-1)}
                    style={styles.monthArrow}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={19}
                      color={Colors.primary}
                    />
                  </Pressable>
                  <View style={styles.monthTitleGroup}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setCalendarView("months")}
                      style={styles.monthTitleButton}
                    >
                      <Text style={styles.monthTitle}>
                        {MONTHS[calendarMonth.getMonth()]}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setCalendarView("years")}
                      style={styles.monthTitleButton}
                    >
                      <Text style={styles.monthTitle}>
                        {calendarMonth.getFullYear()}
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Next month"
                    disabled={
                      !!maximumDate &&
                      isBeforeMonth(
                        maximumDate,
                        calendarMonth.getFullYear(),
                        calendarMonth.getMonth(),
                      )
                    }
                    onPress={() => changeMonth(1)}
                    style={styles.monthArrow}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={19}
                      color={Colors.primary}
                    />
                  </Pressable>
                </View>

                {calendarView === "calendar" ? (
                  <View>
                    <View style={styles.calendarGrid}>
                      {WEEKDAYS.map((weekday) => (
                        <Text key={weekday} style={styles.weekday}>
                          {weekday}
                        </Text>
                      ))}
                      {Array.from({ length: calendarOffset }, (_, index) => (
                        <View
                          key={`blank-${index}`}
                          style={styles.calendarCell}
                        />
                      ))}
                      {Array.from({ length: monthDays }, (_, index) => {
                        const day = index + 1;
                        const date = new Date(
                          calendarMonth.getFullYear(),
                          calendarMonth.getMonth(),
                          day,
                        );
                        const selected = sameDay(date, draft);
                        const today = sameDay(date, new Date());
                        const selectable = isSelectableDay(date);
                        return (
                          <Pressable
                            key={day}
                            accessibilityRole="button"
                            accessibilityLabel={date.toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              },
                            )}
                            accessibilityState={{
                              selected,
                              disabled: !selectable,
                            }}
                            disabled={!selectable}
                            onPress={() => selectDay(day)}
                            style={[
                              styles.calendarCell,
                              selected && styles.calendarCellSelected,
                              today && !selected && styles.calendarCellToday,
                            ]}
                          >
                            <Text
                              style={[
                                styles.dayText,
                                selected && styles.dayTextSelected,
                                !selectable && styles.dayTextDisabled,
                                today && !selected && styles.dayTextToday,
                              ]}
                            >
                              {day}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                {calendarView === "months" ? (
                  <View style={styles.selectionGrid}>
                    {MONTHS.map((month, index) => {
                      const selectable = isSelectableMonth(
                        calendarMonth.getFullYear(),
                        index,
                      );
                      return (
                        <Pressable
                          key={month}
                          accessibilityRole="button"
                          accessibilityState={{
                            selected: calendarMonth.getMonth() === index,
                            disabled: !selectable,
                          }}
                          disabled={!selectable}
                          onPress={() => {
                            setCalendarMonth(
                              new Date(calendarMonth.getFullYear(), index, 1),
                            );
                            setCalendarView("calendar");
                          }}
                          style={[
                            styles.selectionOption,
                            calendarMonth.getMonth() === index &&
                              styles.selectionOptionSelected,
                            !selectable && styles.disabledOption,
                          ]}
                        >
                          <Text
                            style={[
                              styles.selectionOptionText,
                              calendarMonth.getMonth() === index &&
                                styles.selectionOptionTextSelected,
                            ]}
                          >
                            {month.slice(0, 3)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}

                {calendarView === "years" ? (
                  <ScrollView style={styles.yearList}>
                    <View style={styles.yearGrid}>
                      {years.map((year) => (
                        <Pressable
                          key={year}
                          accessibilityRole="button"
                          accessibilityState={{
                            selected: calendarMonth.getFullYear() === year,
                            disabled: !isSelectableMonth(
                              year,
                              calendarMonth.getMonth(),
                            ),
                          }}
                          disabled={
                            !isSelectableMonth(year, calendarMonth.getMonth())
                          }
                          onPress={() => {
                            setCalendarMonth(
                              new Date(year, calendarMonth.getMonth(), 1),
                            );
                            setCalendarView("calendar");
                          }}
                          style={[
                            styles.selectionOption,
                            styles.yearOption,
                            calendarMonth.getFullYear() === year &&
                              styles.selectionOptionSelected,
                            !isSelectableMonth(
                              year,
                              calendarMonth.getMonth(),
                            ) && styles.disabledOption,
                          ]}
                        >
                          <Text
                            style={[
                              styles.selectionOptionText,
                              calendarMonth.getFullYear() === year &&
                                styles.selectionOptionTextSelected,
                            ]}
                          >
                            {year}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                ) : null}
              </View>
            ) : (
              <View style={styles.timePicker}>
                <TimeWheel
                  label="Hour"
                  options={HOUR_OPTIONS}
                  selectedValue={selectedHour}
                  scrollRef={hourScrollRef}
                  formatOption={(hour) => String(hour).padStart(2, "0")}
                  onSelect={(hour) =>
                    updateTime((date) => {
                      const isAfternoon = date.getHours() >= 12;
                      date.setHours((hour % 12) + (isAfternoon ? 12 : 0));
                    })
                  }
                />
                <TimeWheel
                  label="Minute"
                  options={MINUTE_OPTIONS}
                  selectedValue={draft.getMinutes()}
                  scrollRef={minuteScrollRef}
                  formatOption={(minute) => String(minute).padStart(2, "0")}
                  onSelect={(minute) =>
                    updateTime((date) => date.setMinutes(minute))
                  }
                />
                <TimeWheel
                  label="Period"
                  options={["AM", "PM"]}
                  selectedValue={selectedPeriod}
                  scrollRef={periodScrollRef}
                  formatOption={(period) => period}
                  onSelect={(period) =>
                    updateTime((date) => {
                      const hour = date.getHours() % 12;
                      date.setHours(hour + (period === "PM" ? 12 : 0));
                    })
                  }
                />
              </View>
            )}

            {!isValidSelection(draft) ? (
              <Text accessibilityRole="alert" style={styles.validationMessage}>
                Choose a value within the allowed date range.
              </Text>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={closePicker}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={!isValidSelection(draft)}
                onPress={confirmSelection}
                style={({ pressed }) => [
                  styles.confirmButton,
                  styles.applyButton,
                  !isValidSelection(draft) && styles.confirmDisabled,
                  pressed && isValidSelection(draft) && styles.confirmPressed,
                ]}
              >
                <View style={styles.confirmButtonInner}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.confirmText}>Apply</Text>
                </View>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

type TimeWheelProps<T extends string | number> = {
  label: string;
  options: T[];
  selectedValue: T;
  scrollRef: React.RefObject<ScrollView | null>;
  formatOption: (option: T) => string;
  onSelect: (option: T) => void;
};

function TimeWheel<T extends string | number>({
  label,
  options,
  selectedValue,
  scrollRef,
  formatOption,
  onSelect,
}: TimeWheelProps<T>) {
  return (
    <View style={styles.wheelColumn}>
      <Text style={styles.wheelLabel}>{label}</Text>
      <View style={styles.wheelViewport}>
        <View pointerEvents="none" style={styles.wheelSelection} />
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={PICKER_ROW_HEIGHT}
          decelerationRate="fast"
          contentContainerStyle={styles.wheelContent}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(
              event.nativeEvent.contentOffset.y / PICKER_ROW_HEIGHT,
            );
            const nextOption = options[index];
            if (nextOption !== undefined) onSelect(nextOption);
          }}
        >
          {options.map((option) => {
            const selected = option === selectedValue;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  onSelect(option);
                  scrollRef.current?.scrollTo({
                    y: options.indexOf(option) * PICKER_ROW_HEIGHT,
                    animated: true,
                  });
                }}
                style={styles.wheelOption}
              >
                <Text
                  style={[
                    styles.wheelOptionText,
                    selected && styles.wheelOptionTextSelected,
                  ]}
                >
                  {formatOption(option)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 8,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  fields: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  singleField: {
    flexDirection: "column",
  },
  field: {
    minHeight: 72,
    flex: 1,
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    backgroundColor: Colors.white,
  },
  fieldHalf: {
    flex: 1,
    minWidth: 0,
  },
  compactField: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  compactFieldNarrow: {
    minHeight: 60,
    paddingVertical: 8,
    paddingHorizontal: 7,
    gap: 5,
  },
  compactIconTile: {
    width: 30,
    height: 30,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: "#F1F5EF",
  },
  compactIconTileNarrow: {
    width: 24,
    height: 24,
    borderRadius: 7,
  },
  compactFieldCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  compactFieldLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  compactFieldValue: {
    minWidth: 0,
    color: Colors.textPrimary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
    includeFontPadding: false,
  },
  compactFieldValueNarrow: {
    fontSize: 12,
    lineHeight: 16,
  },
  compactLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  compactLabelAccent: {
    width: 8,
    height: 28,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  compactLabel: {
    marginBottom: 0,
    color: "#263238",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0,
  },
  disabledField: {
    opacity: 0.5,
  },
  pressedField: {
    borderColor: Colors.primary,
  },
  fieldHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fieldChevron: {
    marginLeft: "auto",
  },
  fieldLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  fieldValue: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  placeholder: {
    color: Colors.textSecondary,
    fontWeight: "400",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(19, 34, 25, 0.48)",
  },
  sheet: {
    maxHeight: "92%",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: Colors.white,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    marginBottom: 18,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  headerCopy: {
    flex: 1,
  },
  sheetTitle: {
    color: Colors.textPrimary,
    fontSize: 19,
    fontWeight: "700",
  },
  sheetSubtitle: {
    marginTop: 2,
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: Colors.bgCard,
  },
  segmentedControl: {
    flexDirection: "row",
    marginBottom: 12,
    padding: 4,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
  },
  segment: {
    minHeight: 38,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  segmentSelected: {
    backgroundColor: Colors.white,
    elevation: 1,
  },
  segmentText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  segmentTextSelected: {
    color: Colors.primary,
  },
  monthHeader: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  monthArrow: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
  },
  monthTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  monthTitleButton: {
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  monthTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  weekday: {
    width: "14.2857%",
    height: 34,
    textAlign: "center",
    textAlignVertical: "center",
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  calendarCell: {
    width: "14.2857%",
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
  },
  calendarCellSelected: {
    backgroundColor: Colors.primary,
  },
  calendarCellToday: {
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  dayText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "500",
  },
  dayTextSelected: {
    color: Colors.white,
    fontWeight: "700",
  },
  dayTextDisabled: {
    color: "#C2C8C5",
  },
  dayTextToday: {
    color: Colors.primary,
    fontWeight: "700",
  },
  selectionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    paddingVertical: 8,
  },
  selectionOption: {
    width: "25%",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  selectionOptionSelected: {
    backgroundColor: Colors.primary,
  },
  disabledOption: {
    opacity: 0.4,
  },
  selectionOptionText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  selectionOptionTextSelected: {
    color: Colors.white,
  },
  yearList: {
    maxHeight: 224,
  },
  yearGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  yearOption: {
    width: "25%",
  },
  timePicker: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
  },
  wheelColumn: {
    flex: 1,
    minWidth: 0,
  },
  wheelLabel: {
    marginBottom: 8,
    textAlign: "center",
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  wheelViewport: {
    height: 160,
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
  },
  wheelSelection: {
    position: "absolute",
    zIndex: 1,
    top: 60,
    right: 5,
    left: 5,
    height: PICKER_ROW_HEIGHT,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 9,
    backgroundColor: "rgba(54, 96, 57, 0.08)",
  },
  wheelContent: {
    paddingVertical: 60,
  },
  wheelOption: {
    height: PICKER_ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelOptionText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: "500",
  },
  wheelOptionTextSelected: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: "700",
  },
  validationMessage: {
    marginTop: 4,
    color: Colors.danger,
    fontSize: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  cancelButton: {
    minHeight: 48,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
  },
  cancelText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  confirmButton: {
    minHeight: 48,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  confirmDisabled: {
    opacity: 0.45,
  },
  confirmPressed: {
    opacity: 0.85,
  },
  confirmButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  applyButton: {
    backgroundColor: "#2D6A4F",
  },
  confirmText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
});
