import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import api, { getApiErrorMessage } from "../api";
import { Colors } from "../constants/colors";

type CalendarEntry = {
  id: number | string;
  title: string;
  category?: string;
  priority?: string;
  startDate?: string;
  startTime?: string;
  location?: string;
  description?: string;
  reminderDate?: string;
  reminderTime?: string;
  notes?: string;
  status?: string;
};

type EntryType = "event" | "reminder";
type EntryForm = {
  title: string;
  category: string;
  date: string;
  time: string;
  priority: string;
  details: string;
};

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function entryDateKey(value?: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : dateKey(date);
}

function getMonthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

function getRows(data: any): CalendarEntry[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.data)) return data.data.data;
  return [];
}

function formatDate(value?: string) {
  if (!value) return "Date not set";
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function EntryCard({
  entry,
  type,
  onPress,
  onDelete,
  onComplete,
}: {
  entry: CalendarEntry;
  type: EntryType;
  onPress: () => void;
  onDelete: () => void;
  onComplete?: () => void;
}) {
  const isReminder = type === "reminder";
  return (
    <Pressable
      onPress={onPress}
      className="mb-2 border border-[#E5EAE7] bg-[#ECF2EE] p-3"
    >
      <View className="flex-row items-start">
        <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-[#366039]">
          <Ionicons
            name={isReminder ? "notifications-outline" : "calendar-outline"}
            size={19}
            color={Colors.white}
          />
        </View>
        <View className="flex-1">
          <Text className="text-base font-extrabold text-[#263238]">
            {entry.title}
          </Text>
          <Text className="mt-1 text-xs font-medium text-[#7B8589]">
            {formatDate(isReminder ? entry.reminderDate : entry.startDate)}
            {"  ·  "}
            {isReminder
              ? entry.reminderTime || "All day"
              : entry.startTime || "All day"}
          </Text>
          <Text className="mt-1 text-[10px] font-bold uppercase tracking-[0.6px] text-[#447449]">
            {entry.category || "Personal"} · {entry.priority || "Medium"}
            {isReminder && entry.status ? ` · ${entry.status}` : ""}
          </Text>
        </View>
        {onComplete && entry.status !== "Completed" ? (
          <Pressable
            onPress={onComplete}
            accessibilityRole="button"
            accessibilityLabel="Mark reminder complete"
            className="ml-2 h-9 w-9 items-center justify-center rounded-full bg-[#ECF2EE]"
          >
            <Ionicons name="checkmark" size={20} color={Colors.primary} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${isReminder ? "reminder" : "event"}`}
          className="ml-2 h-9 w-9 items-center justify-center rounded-full bg-[#ECF2EE]"
        >
          <Ionicons name="trash-outline" size={17} color={Colors.danger} />
        </Pressable>
      </View>
      {(entry.location || entry.description || entry.notes) && (
        <Text className="ml-[52px] mt-2 text-sm leading-5 text-[#7B8589]">
          {[entry.location, entry.description, entry.notes]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      )}
    </Pressable>
  );
}

export default function CalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<CalendarEntry[]>([]);
  const [reminders, setReminders] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeType, setActiveType] = useState<EntryType>("event");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [modalType, setModalType] = useState<EntryType | null>(null);
  const [form, setForm] = useState<EntryForm>({
    title: "",
    category: "Personal",
    date: dateKey(new Date()),
    time: "09:00",
    priority: "Medium",
    details: "",
  });

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const [eventResponse, reminderResponse] = await Promise.all([
        api.get("/calendar/events"),
        api.get("/calendar/reminders"),
      ]);
      setEvents(getRows(eventResponse.data));
      setReminders(getRows(reminderResponse.data));
    } catch (error) {
      Alert.alert("Calendar unavailable", getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchCalendar();
    }, [fetchCalendar]),
  );

  const openForm = (type: EntryType) => {
    setForm({
      title: "",
      category: "Personal",
      date: dateKey(selectedDate),
      time: "09:00",
      priority: "Medium",
      details: "",
    });
    setModalType(type);
  };

  const saveEntry = async () => {
    if (!form.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
      Alert.alert(
        "Check the details",
        "Enter a title and date in YYYY-MM-DD format.",
      );
      return;
    }

    setSaving(true);
    try {
      if (modalType === "event") {
        await api.post("/calendar/events", {
          title: form.title.trim(),
          category: form.category.trim() || "Personal",
          startDate: form.date,
          startTime: form.time,
          priority: form.priority,
          description: form.details.trim(),
        });
      } else {
        await api.post("/calendar/reminders", {
          title: form.title.trim(),
          category: form.category.trim() || "Personal",
          reminderDate: form.date,
          reminderTime: form.time,
          priority: form.priority,
          notes: form.details.trim(),
          notificationEnabled: true,
        });
      }
      setModalType(null);
      await fetchCalendar();
    } catch (error) {
      Alert.alert("Unable to save", getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = (type: EntryType, entry: CalendarEntry) => {
    Alert.alert("Delete item?", `Remove "${entry.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(
              `/calendar/${type === "event" ? "events" : "reminders"}/${entry.id}`,
            );
            await fetchCalendar();
          } catch (error) {
            Alert.alert("Unable to delete", getApiErrorMessage(error));
          }
        },
      },
    ]);
  };

  const completeReminder = async (reminder: CalendarEntry) => {
    try {
      await api.post(`/calendar/reminders/${reminder.id}/complete`);
      await fetchCalendar();
    } catch (error) {
      Alert.alert("Unable to update reminder", getApiErrorMessage(error));
    }
  };

  const monthDays = getMonthDays(calendarMonth);
  const monthWeeks = Array.from({ length: 6 }, (_, weekIndex) =>
    monthDays.slice(weekIndex * 7, weekIndex * 7 + 7),
  );
  const monthLabel = calendarMonth.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
  const visibleEntries = (activeType === "event" ? events : reminders).filter(
    (entry) =>
      entryDateKey(
        activeType === "event" ? entry.startDate : entry.reminderDate,
      ) === dateKey(selectedDate),
  );

  return (
    <SafeAreaView
      className="flex-1"
      edges={["top"]}
      style={{ backgroundColor: Colors.primary }}
    >
      <ScrollView
        className="flex-1"
        style={{ backgroundColor: Colors.contentBackground }}
        contentContainerStyle={{ paddingBottom: 190 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[Colors.headerStart, Colors.headerEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingBottom: 20,
            paddingTop: 12,
          }}
        >
          <Pressable
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace("/tabs/more");
            }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-white/15"
          >
            <Ionicons name="arrow-back" size={20} color={Colors.white} />
          </Pressable>
          <View className="mr-3 items-center border-r border-white/30 pr-4">
            <Text className="text-4xl font-light text-white">
              {selectedDate.getDate().toString().padStart(2, "0")}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-xl font-extrabold text-white">
              Life Calendar
            </Text>
            <Text className="mt-1 text-sm font-medium text-[#ADBEA3]">
              {selectedDate.toLocaleDateString("en-IN", {
                weekday: "long",
                month: "long",
                year: "numeric",
              })}
            </Text>
          </View>
        </LinearGradient>

        <View className="px-4 pt-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Pressable
              onPress={() =>
                setCalendarMonth(
                  (month) =>
                    new Date(month.getFullYear(), month.getMonth() - 1, 1),
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              className="h-9 w-9 items-center justify-center rounded-full bg-white/80"
            >
              <Ionicons name="chevron-back" size={18} color={Colors.primary} />
            </Pressable>
            <Pressable
              onPress={() => {
                const now = new Date();
                setCalendarMonth(now);
                setSelectedDate(now);
              }}
              accessibilityRole="button"
              accessibilityLabel="Go to today"
            >
              <Text className="text-lg font-extrabold text-[#263238]">
                {monthLabel}
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                setCalendarMonth(
                  (month) =>
                    new Date(month.getFullYear(), month.getMonth() + 1, 1),
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Next month"
              className="h-9 w-9 items-center justify-center rounded-full bg-white/80"
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={Colors.primary}
              />
            </Pressable>
          </View>

          <View className="mb-1 flex-row">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <Text
                key={day}
                className="flex-1 py-2 text-center text-[10px] font-extrabold uppercase tracking-[0.5px] text-[#7B8589]"
              >
                {day}
              </Text>
            ))}
          </View>
          <View className="mb-4 rounded-2xl border border-[#E5EAE7] bg-white px-1 py-2">
            {monthWeeks.map((week, weekIndex) => (
              <View key={weekIndex} className="flex-row">
                {week.map((date) => {
                  const key = dateKey(date);
                  const isSelected = key === dateKey(selectedDate);
                  const isCurrentMonth =
                    date.getMonth() === calendarMonth.getMonth();
                  const isToday = key === dateKey(new Date());
                  const hasItems =
                    events.some(
                      (event) => entryDateKey(event.startDate) === key,
                    ) ||
                    reminders.some(
                      (reminder) => entryDateKey(reminder.reminderDate) === key,
                    );
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setSelectedDate(date)}
                      className="h-10 flex-1 items-center justify-center"
                      accessibilityRole="button"
                      accessibilityLabel={date.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    >
                      <View
                        className={`h-8 w-8 items-center justify-center rounded-full ${isSelected ? "bg-[#366039]" : isToday ? "border border-[#366039] bg-[#ECF2EE]" : ""}`}
                      >
                        <Text
                          className={`text-xs font-bold ${isSelected ? "text-white" : isCurrentMonth ? "text-[#263238]" : "text-[#7B8589]"}`}
                        >
                          {date.getDate()}
                        </Text>
                      </View>
                      {hasItems ? (
                        <View className="absolute bottom-0 h-1 w-1 rounded-full bg-[#447449]" />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        <View className="mx-4 mb-4 flex-row">
          {(["event", "reminder"] as const).map((type) => (
            <Pressable
              key={type}
              onPress={() => setActiveType(type)}
              className={`mr-1.5 min-h-[114px] flex-1 items-center justify-center border border-white/70 px-2 py-4 ${activeType === type ? "bg-[#366039]" : "bg-[#264B2A]"}`}
            >
              <Ionicons
                name={
                  type === "event"
                    ? "calendar-outline"
                    : "notifications-outline"
                }
                size={25}
                color={Colors.white}
              />
              <Text className="mt-2 text-center text-sm font-extrabold text-white">
                {type === "event"
                  ? `Events (${events.length})`
                  : `Reminders (${reminders.length})`}
              </Text>
              <Text className="mt-1 text-[10px] font-semibold uppercase tracking-[0.5px] text-[#ADBEA3]">
                {type === "event" ? "View schedule" : "View alerts"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View className="px-4">
          <View className="mb-3 flex-row items-center justify-between">
            <View>
              <Text className="text-lg font-extrabold text-[#263238]">
                {activeType === "event" ? "Events" : "Reminders"}
              </Text>
              <Text className="mt-0.5 text-xs font-medium text-[#7B8589]">
                {selectedDate.toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </Text>
            </View>
            <Pressable
              onPress={() => openForm(activeType)}
              className="flex-row items-center rounded-full bg-[#ECF2EE] px-3 py-2"
            >
              <Ionicons name="add" size={17} color={Colors.primary} />
              <Text className="ml-1 text-xs font-bold text-[#366039]">New</Text>
            </Pressable>
          </View>

          {loading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text className="mt-3 text-sm font-medium text-[#7B8589]">
                Loading calendar...
              </Text>
            </View>
          ) : visibleEntries.length ? (
            visibleEntries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                type={activeType}
                onPress={() =>
                  Alert.alert(
                    entry.title,
                    [
                      formatDate(
                        activeType === "event"
                          ? entry.startDate
                          : entry.reminderDate,
                      ),
                      entry.location,
                      entry.description,
                      entry.notes,
                    ]
                      .filter(Boolean)
                      .join("\n"),
                  )
                }
                onDelete={() => deleteEntry(activeType, entry)}
                onComplete={
                  activeType === "reminder"
                    ? () => void completeReminder(entry)
                    : undefined
                }
              />
            ))
          ) : (
            <View className="items-center border border-[#E5EAE7] bg-white px-6 py-8">
              <Ionicons
                name={
                  activeType === "event"
                    ? "calendar-outline"
                    : "notifications-outline"
                }
                size={30}
                color={Colors.primary}
              />
              <Text className="mt-3 text-base font-extrabold text-[#263238]">
                No {activeType === "event" ? "events" : "reminders"} for this
                day
              </Text>
              <Text className="mt-1 text-center text-sm text-[#7B8589]">
                Choose another date or add a new item.
              </Text>
            </View>
          )}
        </View>

        <Pressable
          onPress={() => openForm(activeType)}
          className="mx-4 mt-4 flex-row items-center justify-center border border-[#264B2A] bg-[#366039] py-4"
        >
          <Ionicons name="add" size={20} color={Colors.white} />
          <Text className="ml-2 text-base font-bold text-white">
            Add {activeType === "event" ? "Event" : "Reminder"}
          </Text>
        </Pressable>
      </ScrollView>

      <Pressable
        onPress={() => openForm(activeType)}
        accessibilityRole="button"
        accessibilityLabel={
          activeType === "event" ? "New event" : "New reminder"
        }
        className="absolute right-5 h-14 w-14 items-center justify-center rounded-full bg-[#366039] shadow-lg"
        style={{ bottom: 140, elevation: 8 }}
      >
        <Ionicons name="add" size={28} color={Colors.white} />
      </Pressable>

      <Modal
        visible={modalType !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setModalType(null)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[90%] rounded-t-3xl border-t-4 border-[#366039] bg-[#F9FAFC] px-5 pb-8 pt-5">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-xl font-extrabold capitalize text-[#264B2A]">
                New {modalType === "event" ? "event" : "reminder"}
              </Text>
              <Pressable
                onPress={() => setModalType(null)}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color={Colors.primaryDark} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {(
                [
                  ["title", "Title", "What needs your attention?"],
                  ["category", "Category", "Personal"],
                  ["date", "Date (YYYY-MM-DD)", "2026-09-29"],
                  ["time", "Time (HH:MM)", "09:00"],
                  ["details", "Notes", "Add details"],
                ] as const
              ).map(([key, label, placeholder]) => (
                <View key={key} className="mb-3">
                  <Text className="mb-1.5 text-xs font-bold uppercase tracking-[0.8px] text-[#7B8589]">
                    {label}
                  </Text>
                  <TextInput
                    value={form[key]}
                    onChangeText={(value) =>
                      setForm((current) => ({ ...current, [key]: value }))
                    }
                    placeholder={placeholder}
                    keyboardType={
                      key === "date" || key === "time"
                        ? "numbers-and-punctuation"
                        : "default"
                    }
                    multiline={key === "details"}
                    className="rounded-xl border border-[#E5EAE7] bg-white px-3.5 py-3 text-base text-[#263238]"
                  />
                </View>
              ))}
              <Text className="mb-2 text-xs font-bold uppercase tracking-[0.8px] text-[#7B8589]">
                Priority
              </Text>
              <View className="mb-5 flex-row">
                {["Low", "Medium", "High"].map((priority) => (
                  <Pressable
                    key={priority}
                    onPress={() =>
                      setForm((current) => ({ ...current, priority }))
                    }
                    className={`mr-2 flex-1 items-center rounded-xl border py-2.5 ${form.priority === priority ? "border-[#366039] bg-[#ECF2EE]" : "border-[#E5EAE7] bg-white"}`}
                  >
                    <Text className="text-sm font-bold text-[#263238]">
                      {priority}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                disabled={saving}
                onPress={() => void saveEntry()}
                className="items-center rounded-xl bg-[#366039] py-3.5"
              >
                {saving ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text className="text-base font-bold text-white">Save</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
