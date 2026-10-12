import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api, { API_BASE_URL, getApiErrorMessage } from "../api";
import { AddButton } from "../components/AddButton";
import { AddPageHeader } from "../components/AddPageHeader";
import { CenteredPageLoader } from "../components/CenteredPageLoader";
import ConfirmPopup from "../components/ConfirmPopup";
import { DateTimePickerComponent } from "../components/DateTimePickerComponent";
import { FormInput, FormLabel } from "../components/FormControls";
import { GradientSafeAreaView as SafeAreaView } from "../components/GradientSafeAreaView";
import { PopupSelect } from "../components/PopupSelect";
import { createSessionDataCache } from "../components/SessionDataCache";
import { parseLocalDate, parseLocalDateTimeValue } from "../components/dateTimeUtils";
import { useAddPageNavigation } from "../components/useAddPageNavigation";
import { Colors } from "../constants/colors";

type CalendarEntry = {
  id: number | string;
  title: string;
  category?: string | { id?: number | string; name?: string };
  category_id?: number | string | null;
  categoryId?: number | string | null;
  category_name?: string;
  priority?: string;
  repeat?: string;
  recurrence?: string;
  repeat_frequency?: string;
  repeatFrequency?: string;
  startDate?: string;
  startTime?: string;
  location?: string;
  description?: string;
  reminderDate?: string;
  reminderTime?: string;
  notes?: string;
  status?: string;
};

type EventCategory = {
  id: number | string;
  name: string;
  catType: string;
  catId?: string;
  images?: string | string[];
  image?: string;
  imageUrl?: string;
  image_url?: string;
  icon?: string;
  iconName?: string;
  icon_name?: string;
  iconUrl?: string;
  icon_url?: string;
  emoji?: string;
};

type CalendarData = {
  events: CalendarEntry[];
  reminders: CalendarEntry[];
};

const calendarDataCache = createSessionDataCache<CalendarData>();

type EntryType = "event" | "reminder";
type EntryForm = {
  title: string;
  category: string;
  categoryId: string;
  date: string;
  time: string;
  location: string;
  repeat: string;
  priority: string;
  details: string;
};

const calendarFormStyles = StyleSheet.create({
  input: {
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#AAB8AE",
    backgroundColor: "#FFFFFF",
    color: "#263238",
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: "top",
  },
});

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateString(value: string): Date | null {
  return parseLocalDate(value);
}

function parseTimeString(value: string): Date | null {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function entryDateKey(value?: string) {
  if (!value) return "";
  const date = parseLocalDateTimeValue(value);
  return date ? dateKey(date) : "";
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

function getEventCategoryRows(data: unknown): EventCategory[] {
  let rows: unknown = data;
  for (let depth = 0; depth < 3; depth += 1) {
    if (Array.isArray(rows)) break;
    if (!rows || typeof rows !== "object") return [];
    const response = rows as Record<string, unknown>;
    rows = response.categories ?? response.category ?? response.data;
  }
  if (!Array.isArray(rows)) return [];
  return rows.filter(
    (row): row is EventCategory =>
      !!row &&
      typeof row === "object" &&
      (row as EventCategory).catType === "CalendarEvent" &&
      (row as EventCategory).id !== undefined &&
      (row as EventCategory).id !== null &&
      typeof (row as EventCategory).name === "string",
  );
}

function getEntryCategoryName(entry: CalendarEntry, fallback: string) {
  if (typeof entry.category === "string" && entry.category.trim()) {
    return entry.category;
  }
  if (entry.category && typeof entry.category === "object") {
    return entry.category.name || fallback;
  }
  return entry.category_name || fallback;
}

function getEntryCategoryId(entry: CalendarEntry) {
  if (entry.category_id !== undefined && entry.category_id !== null) {
    return entry.category_id;
  }
  if (entry.categoryId !== undefined && entry.categoryId !== null) {
    return entry.categoryId;
  }
  return typeof entry.category === "object" ? entry.category?.id : undefined;
}

function getCategoryImage(category: EventCategory) {
  if (Array.isArray(category.images)) {
    return category.images.find((image) => !!image) || null;
  }
  if (typeof category.images === "string" && category.images.trim()) {
    try {
      const parsed: unknown = JSON.parse(category.images);
      if (Array.isArray(parsed)) {
        return parsed.find((image): image is string => typeof image === "string") || null;
      }
    } catch {
      return category.images;
    }
  }
  const iconUrl = category.icon || "";
  return (
    category.image_url ||
    category.imageUrl ||
    category.icon_url ||
    category.iconUrl ||
    category.image ||
    (/^(https?:|file:|content:|data:)/i.test(iconUrl) ? iconUrl : null)
  );
}

function getCategoryImageUri(uri: string) {
  if (/^(https?:|file:|content:|data:)/i.test(uri)) return uri;
  const apiOrigin = API_BASE_URL.replace(/\/api\/?$/i, "");
  return `${apiOrigin}/${uri.replace(/^\/+/, "")}`;
}

function EventCategoryIcon({
  category,
  size = 40,
}: {
  category: EventCategory;
  size?: number;
}) {
  const image = getCategoryImage(category);
  const iconName = category.iconName || category.icon_name || category.icon;
  const isIonicon = !!iconName && iconName in Ionicons.glyphMap;
  const textIcon = category.emoji ||
    (!image && iconName && !isIonicon && iconName.length <= 8 ? iconName : null);

  return (
    <View
      className="items-center justify-center overflow-hidden rounded-xl bg-[#ECF2EE]"
      style={{ width: size, height: size }}
    >
      {image ? (
        <Image
          source={{ uri: getCategoryImageUri(image) }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          accessibilityLabel={`${category.name} icon`}
        />
      ) : textIcon ? (
        <Text style={{ fontSize: size * 0.48 }}>{textIcon}</Text>
      ) : (
        <Ionicons
          name={isIonicon ? (iconName as keyof typeof Ionicons.glyphMap) : "pricetag-outline"}
          size={size * 0.52}
          color={Colors.primary}
        />
      )}
    </View>
  );
}

function formatDate(value?: string) {
  if (!value) return "Date not set";
  const parsed = parseLocalDate(value) ?? parseLocalDateTimeValue(value);
  if (!parsed) return value;
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
      className="mb-2 rounded-2xl border border-[#E5EAE7] bg-[#ECF2EE] p-3"
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
            {getEntryCategoryName(entry, "Personal")} · {entry.priority || "Medium"}
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
  const pathname = usePathname();
  const isNewEventRoute = pathname === "/calendar/new-event";
  const navigateToAddPage = useAddPageNavigation();
  const { create: rawCreate, date: rawCreateDate } = useLocalSearchParams<{
    create?: string | string[];
    date?: string | string[];
  }>();
  const createParam = Array.isArray(rawCreate) ? rawCreate[0] : rawCreate;
  const createDateParam = Array.isArray(rawCreateDate)
    ? rawCreateDate[0]
    : rawCreateDate;
  const initialSelectedDate = createDateParam
    ? parseDateString(createDateParam) ?? new Date()
    : new Date();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<CalendarEntry[]>(
    () => calendarDataCache.get()?.events ?? [],
  );
  const [reminders, setReminders] = useState<CalendarEntry[]>(
    () => calendarDataCache.get()?.reminders ?? [],
  );
  const [loading, setLoading] = useState(() => !calendarDataCache.hasData());
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    type: EntryType;
    entry: CalendarEntry;
  } | null>(null);
  const [activeType, setActiveType] = useState<EntryType>("event");
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [modalType, setModalType] = useState<EntryType | null>(() =>
    isNewEventRoute ? "event" : null,
  );
  const [editingEvent, setEditingEvent] = useState<CalendarEntry | null>(null);
  const [eventCategories, setEventCategories] = useState<EventCategory[]>([]);
  const [eventCategoriesLoading, setEventCategoriesLoading] = useState(false);
  const [eventCategoriesLoaded, setEventCategoriesLoaded] = useState(false);
  const [eventCategoriesError, setEventCategoriesError] = useState<string | null>(null);
  const [dayPopupDate, setDayPopupDate] = useState<Date | null>(null);
  const [form, setForm] = useState<EntryForm>({
    title: "",
    category: "",
    categoryId: "",
    date: dateKey(initialSelectedDate),
    time: "09:00",
    location: "",
    repeat: "None",
    priority: "Medium",
    details: "",
  });

  const fetchCalendar = useCallback(async (
    showLoading = !calendarDataCache.hasData(),
  ) => {
    if (showLoading && !calendarDataCache.hasData()) setLoading(true);
    try {
      const data = await calendarDataCache.load(async () => {
        const [eventResponse, reminderResponse] = await Promise.all([
          api.get("/calendar/events"),
          api.get("/calendar/reminders"),
        ]);
        return {
          events: getRows(eventResponse.data),
          reminders: getRows(reminderResponse.data),
        };
      });
      setEvents(data.events);
      setReminders(data.reminders);
    } catch (error) {
      Alert.alert("Calendar unavailable", getApiErrorMessage(error));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  const refreshCalendar = useCallback(async () => {
    setRefreshing(true);
    try {
      calendarDataCache.clear();
      await fetchCalendar(false);
    } finally {
      setRefreshing(false);
    }
  }, [fetchCalendar]);

  const fetchEventCategories = useCallback(async (): Promise<EventCategory[]> => {
    setEventCategoriesLoading(true);
    setEventCategoriesError(null);
    try {
      const response = await api.get("/categories", {
        params: { catType: "CalendarEvent" },
      });
      const categories = getEventCategoryRows(response.data);
      setEventCategories(categories);
      setEventCategoriesLoaded(true);
      return categories;
    } catch (error) {
      setEventCategoriesError(
        getApiErrorMessage(error, "Unable to load event categories."),
      );
      setEventCategoriesLoaded(false);
      return [];
    } finally {
      setEventCategoriesLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchCalendar(!calendarDataCache.hasData());
    }, [fetchCalendar]),
  );

  const openForm = useCallback((type: EntryType, date = selectedDate) => {
    setEditingEvent(null);
    setForm({
      title: "",
      category: type === "reminder" ? "Personal" : "",
      categoryId: "",
      date: dateKey(date),
      time: "09:00",
      location: "",
      repeat: "None",
      priority: "Medium",
      details: "",
    });
    setModalType(type);
  }, [selectedDate]);

  const closeEntryForm = () => {
    if (editingEvent) {
      setEditingEvent(null);
      setModalType(null);
      return;
    }
    if (router.canGoBack()) router.back();
    else if (isNewEventRoute) router.replace("/calendar");
    else setModalType(null);
  };

  const openEditEvent = useCallback((entry: CalendarEntry) => {
    const savedCategoryId = getEntryCategoryId(entry);
    const savedCategoryName = getEntryCategoryName(entry, "");
    const applySavedCategory = (categories: EventCategory[]) => {
      const matchingCategory = categories.find(
        (category) =>
          (savedCategoryId !== undefined &&
            String(category.id) === String(savedCategoryId)) ||
          category.name === savedCategoryName ||
          category.catId === savedCategoryName,
      );
      if (!matchingCategory) return;
      setForm((current) => ({
        ...current,
        category: matchingCategory.name,
        categoryId: String(matchingCategory.id),
      }));
    };
    const matchingCategory = eventCategories.find(
      (category) =>
        (savedCategoryId !== undefined &&
          String(category.id) === String(savedCategoryId)) ||
        category.name === savedCategoryName ||
        category.catId === savedCategoryName,
    );
    const eventDate = entry.startDate
      ? parseDateString(entry.startDate) ?? parseLocalDateTimeValue(entry.startDate)
      : null;

    setEditingEvent(entry);
    setForm({
      title: entry.title || "",
      category: matchingCategory?.name || savedCategoryName,
      categoryId: matchingCategory
        ? String(matchingCategory.id)
        : savedCategoryId === undefined
          ? ""
          : String(savedCategoryId),
      date: eventDate ? dateKey(eventDate) : dateKey(selectedDate),
      time: entry.startTime?.slice(0, 5) || "09:00",
      location: entry.location || "",
      repeat:
        entry.repeat ||
        entry.repeat_frequency ||
        entry.repeatFrequency ||
        entry.recurrence ||
        "None",
      priority: entry.priority || "Medium",
      details: entry.description || "",
    });
    setModalType("event");
    if (!eventCategoriesLoaded && !eventCategoriesLoading) {
      void fetchEventCategories().then(applySavedCategory);
    }
  }, [eventCategories, eventCategoriesLoaded, eventCategoriesLoading, fetchEventCategories, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      if (isNewEventRoute) return;
      if (createParam !== "event" && createParam !== "reminder") return;
      const requestedDate = createDateParam
        ? parseDateString(createDateParam)
        : null;
      if (requestedDate) setSelectedDate(requestedDate);
      openForm(createParam, requestedDate || selectedDate);
      router.setParams({ create: undefined });
    }, [createDateParam, createParam, isNewEventRoute, openForm, router, selectedDate]),
  );

  const saveEntry = async () => {
    if (!form.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
      Alert.alert(
        "Check the details",
        "Enter a title and date in YYYY-MM-DD format.",
      );
      return;
    }

    const selectedCategory = eventCategories.find(
      (category) => String(category.id) === form.categoryId,
    );
    setSaving(true);
    try {
      if (modalType === "event") {
        if (!selectedCategory) {
          Alert.alert("Select an event category", "Choose a category to continue.");
          return;
        }
        const payload = {
          title: form.title.trim(),
          category: selectedCategory.name,
          category_id: selectedCategory.id,
          startDate: form.date,
          startTime: form.time,
          location: form.location.trim(),
          repeat: form.repeat,
          priority: form.priority,
          description: form.details.trim(),
        };
        if (editingEvent) {
          await api.put(`/calendar/events/${editingEvent.id}`, payload);
        } else {
          await api.post("/calendar/events", payload);
        }
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
      calendarDataCache.clear();
      await fetchCalendar();
      const message = modalType === "event"
        ? editingEvent
          ? "Event updated successfully."
          : "Event added successfully."
        : "Reminder added successfully.";
      if (editingEvent) {
        setEditingEvent(null);
        setModalType(null);
      } else if (router.canGoBack()) router.back();
      else if (isNewEventRoute) router.replace("/calendar");
      else setModalType(null);
      setSuccessMessage(message);
    } catch (error) {
      Alert.alert("Unable to save", getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = (type: EntryType, entry: CalendarEntry) => {
    setPendingDelete({ type, entry });
  };

  const confirmDeleteEntry = async () => {
    if (!pendingDelete) return;
    const { type, entry } = pendingDelete;
    setPendingDelete(null);
    try {
      await api.delete(
        `/calendar/${type === "event" ? "events" : "reminders"}/${entry.id}`,
      );
      calendarDataCache.clear();
      await fetchCalendar();
      setSuccessMessage(
        type === "event"
          ? "Event deleted successfully."
          : "Reminder deleted successfully.",
      );
    } catch (error) {
      Alert.alert("Unable to delete", getApiErrorMessage(error));
    }
  };

  const completeReminder = async (reminder: CalendarEntry) => {
    try {
      await api.post(`/calendar/reminders/${reminder.id}/complete`);
      calendarDataCache.clear();
      await fetchCalendar();
      setSuccessMessage("Reminder marked as complete.");
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
      style={{
        backgroundColor: isNewEventRoute ? Colors.greenGradient[0] : Colors.primary,
      }}
    >
      {isNewEventRoute ? (
        <StatusBar
          barStyle="light-content"
          backgroundColor={Colors.greenGradient[0]}
          translucent={false}
        />
      ) : null}
      {isNewEventRoute ? null : loading ? (
        <View style={{ flex: 1, backgroundColor: Colors.white }}>
          <CenteredPageLoader message="Loading calendar..." />
        </View>
      ) : (
      <ScrollView
        className="flex-1"
        style={{ backgroundColor: Colors.contentBackground }}
        contentContainerStyle={{ paddingBottom: 190 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              if (!loading) void refreshCalendar();
            }}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        <LinearGradient
          colors={Colors.greenGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
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
                      onPress={() => {
                        setSelectedDate(date);
                        if (hasItems) setDayPopupDate(date);
                      }}
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
              className={`mr-1.5 min-h-[114px] flex-1 items-center justify-center rounded-2xl border border-white/70 px-2 py-4 ${activeType === type ? "bg-[#366039]" : "bg-[#264B2A]"}`}
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
           
          </View>

          {visibleEntries.length ? (
            visibleEntries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                type={activeType}
                onPress={() => {
                  if (activeType === "event") {
                    openEditEvent(entry);
                    return;
                  }
                  Alert.alert(
                    entry.title,
                    [
                      formatDate(entry.reminderDate),
                      entry.location,
                      entry.description,
                      entry.notes,
                    ]
                      .filter(Boolean)
                      .join("\n"),
                  );
                }}
                onDelete={() => deleteEntry(activeType, entry)}
                onComplete={
                  activeType === "reminder"
                    ? () => void completeReminder(entry)
                    : undefined
                }
              />
            ))
          ) : (
            <View className="items-center rounded-2xl border border-[#E5EAE7] bg-white px-6 py-8">
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

       
      </ScrollView>
      )}

      {!isNewEventRoute && <AddButton
        onPress={() =>
          navigateToAddPage(
            activeType === "event"
              ? {
                  pathname: "/calendar/new-event",
                  params: { date: dateKey(selectedDate) },
                }
              : {
                  pathname: "/calendar",
                  params: { create: "reminder", date: dateKey(selectedDate) },
                },
          )
        }
        accessibilityLabel={
          activeType === "event" ? "Add event" : "Add reminder"
        }
        accessibilityHint={
          activeType === "event"
            ? "Opens the new event form"
            : "Opens the new reminder form"
        }
        bottomOffset={37}
      />}

      <ConfirmPopup
        visible={pendingDelete !== null}
        type="delete"
        message={
          pendingDelete
            ? `Remove "${pendingDelete.entry.title}"?`
            : undefined
        }
        onConfirm={confirmDeleteEntry}
        onCancel={() => setPendingDelete(null)}
      />
      <ConfirmPopup
        visible={successMessage !== null}
        type="success"
        message={successMessage ?? ""}
        onConfirm={() => setSuccessMessage(null)}
      />

      {/* Day Entries Popup */}
      <Modal
        visible={dayPopupDate !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDayPopupDate(null)}
      >
        <Pressable
          className="flex-1 justify-center bg-black/50 px-4"
          onPress={() => setDayPopupDate(null)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className="rounded-3xl bg-white px-5 pb-5 pt-5">
              {/* Header */}
              <View className="mb-1 flex-row items-start justify-between">
                <View>
                  <Text className="text-2xl font-extrabold text-[#263238]">
                    {dayPopupDate
                      ? dayPopupDate.toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "long",
                        })
                      : ""}
                  </Text>
                  <Text className="mt-0.5 text-[10px] font-bold uppercase tracking-[1px] text-[#7B8589]">
                    Scheduled Reminders
                  </Text>
                </View>
                <Pressable
                  onPress={() => setDayPopupDate(null)}
                  className="h-8 w-8 items-center justify-center rounded-full bg-[#F2F2F2]"
                >
                  <Ionicons name="close" size={18} color="#263238" />
                </Pressable>
              </View>

              {/* Entry list */}
              <ScrollView
                style={{ maxHeight: 340 }}
                showsVerticalScrollIndicator={false}
                className="mt-3"
              >
                {(() => {
                  const popupKey = dayPopupDate ? dateKey(dayPopupDate) : "";
                  const popupEntries = [
                    ...events
                      .filter((e) => entryDateKey(e.startDate) === popupKey)
                      .map((e) => ({ entry: e, type: "event" as EntryType })),
                    ...reminders
                      .filter((r) => entryDateKey(r.reminderDate) === popupKey)
                      .map((r) => ({ entry: r, type: "reminder" as EntryType })),
                  ];
                  return popupEntries.map(({ entry, type }) => (
                    <View
                      key={`${type}-${entry.id}`}
                      className="mb-3 rounded-2xl border border-[#E5EAE7] bg-[#F9FAFC] px-3 py-3"
                    >
                      <View className="flex-row items-center">
                        <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-[#FFE4EE]">
                          <Ionicons
                            name={type === "reminder" ? "gift-outline" : "calendar-outline"}
                            size={20}
                            color="#E91E63"
                          />
                        </View>
                        <View className="flex-1">
                          <Text className="text-base font-extrabold text-[#263238]">
                            {entry.title}
                          </Text>
                          <Text className="text-[11px] font-bold uppercase tracking-[0.5px] text-[#E91E63]">
                            {getEntryCategoryName(entry, type === "reminder" ? "Reminder" : "Event")}
                          </Text>
                        </View>
                        <View className="rounded-xl border border-[#E5EAE7] bg-white px-3 py-1">
                          <Text className="text-xs font-bold text-[#263238]">
                            {type === "reminder"
                              ? entry.reminderTime || "All day"
                              : entry.startTime || "All day"}
                          </Text>
                        </View>
                      </View>
                      {/* Edit / Delete row */}
                      <View className="mt-3 flex-row">
                        <Pressable
                          onPress={() => {
                            setDayPopupDate(null);
                            if (type === "event") {
                              openEditEvent(entry);
                              return;
                            }
                            Alert.alert(
                              entry.title,
                              [
                                formatDate(entry.reminderDate),
                                entry.location,
                                entry.description,
                                entry.notes,
                              ]
                                .filter(Boolean)
                                .join("\n"),
                            );
                          }}
                          className="mr-2 flex-1 flex-row items-center justify-center rounded-xl border border-[#4CAF50] py-2"
                        >
                          <Ionicons name="create-outline" size={15} color="#4CAF50" />
                          <Text className="ml-1 text-sm font-bold text-[#4CAF50]">Edit</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setDayPopupDate(null);
                            deleteEntry(type, entry);
                          }}
                          className="flex-1 flex-row items-center justify-center rounded-xl border border-[#FF5252] py-2"
                        >
                          <Ionicons name="trash-outline" size={15} color="#FF5252" />
                          <Text className="ml-1 text-sm font-bold text-[#FF5252]">Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  ));
                })()}
              </ScrollView>

              {/* Add One More button */}
              <Pressable
                onPress={() => {
                  setDayPopupDate(null);
                  const date = dateKey(dayPopupDate ?? selectedDate);
                  navigateToAddPage(
                    activeType === "event"
                      ? { pathname: "/calendar/new-event", params: { date } }
                      : {
                          pathname: "/calendar",
                          params: { create: "reminder", date },
                        },
                  );
                }}
                className="mt-3 items-center rounded-2xl bg-[#1A1A2E] py-4"
              >
                <Text className="text-sm font-extrabold uppercase tracking-[1.5px] text-white">
                  ADD ONE MORE
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {modalType !== null && (
        <View
          className={isNewEventRoute ? "flex-1 bg-[#F9FAFC]" : "absolute inset-0 z-50 bg-[#F9FAFC]"}
          style={{ paddingBottom: insets.bottom }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={0}
            style={{ flex: 1 }}
          >
          <View
            className="flex-1 bg-[#F9FAFC] px-5 pb-5"
          >
            <AddPageHeader
              title={
                editingEvent
                  ? "Edit Event"
                  : modalType === "event"
                    ? "Add New Calendar Event"
                    : "New Reminder"
              }
              onBack={closeEntryForm}
              horizontalInset={20}
              disabled={saving}
            />
            <ScrollView
              style={{ flex: 1, minHeight: 0 }}
              contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              automaticallyAdjustKeyboardInsets
              keyboardDismissMode="interactive"
              bounces={true}
            >
              <View className="mb-4">
                <FormLabel>Title</FormLabel>
                <FormInput
                  accessibilityLabel="Title, required"
                  autoCapitalize="sentences"
                  maxLength={100}
                  value={form.title}
                  onChangeText={(value) =>
                    setForm((current) => ({ ...current, title: value }))
                  }
                  placeholder="What needs your attention?"
                  keyboardType="default"
                  returnKeyType="next"
                  style={calendarFormStyles.input}
                />
              </View>

              {modalType === "event" ? (
                <View className="mb-4">
                  <PopupSelect
                    label="Event Category"
                    placeholder="Select event category"
                    options={eventCategories.map((category) => ({
                      label: category.name,
                      value: String(category.id),
                      icon: <EventCategoryIcon category={category} size={34} />,
                    }))}
                    value={form.categoryId}
                    onChange={(categoryId) => {
                      const category = eventCategories.find(
                        (item) => String(item.id) === categoryId,
                      );
                      if (!category) return;
                      setForm((current) => ({
                        ...current,
                        category: category.name,
                        categoryId: String(category.id),
                      }));
                    }}
                    onOpen={() => {
                      if (!eventCategoriesLoaded && !eventCategoriesLoading) {
                        void fetchEventCategories();
                      }
                    }}
                    onRetry={() => void fetchEventCategories()}
                    loading={eventCategoriesLoading}
                    error={eventCategoriesError ?? undefined}
                    emptyMessage={
                      eventCategoriesError ??
                      "No CalendarEvent categories found."
                    }
                    required
                  />
                </View>
              ) : (
                <View className="mb-4">
                  <FormLabel>Category</FormLabel>
                  <FormInput
                    accessibilityLabel="Category"
                    autoCapitalize="sentences"
                    maxLength={60}
                    value={form.category}
                    onChangeText={(value) =>
                      setForm((current) => ({ ...current, category: value }))
                    }
                    placeholder="Personal"
                    keyboardType="default"
                    returnKeyType="done"
                    style={calendarFormStyles.input}
                  />
                </View>
              )}

              <View className="flex-row gap-3">
                <View className="min-w-0 flex-1">
                  <DateTimePickerComponent
                    mode="date"
                    label="Date"
                    value={parseDateString(form.date)}
                    placeholder="Select date"
                    onChange={(date) =>
                      setForm((current) => ({
                        ...current,
                        date: date ? dateKey(date) : current.date,
                      }))
                    }
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <DateTimePickerComponent
                    mode="time"
                    label="Time"
                    value={parseTimeString(form.time)}
                    placeholder="Select time"
                    onChange={(date) =>
                      setForm((current) => ({
                        ...current,
                        time: date
                          ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
                          : current.time,
                      }))
                    }
                  />
                </View>
              </View>

              {modalType === "event" ? (
                <>
                  <View className="mb-4">
                    <FormLabel>Location</FormLabel>
                    <FormInput
                      accessibilityLabel="Event location"
                      autoCapitalize="words"
                      maxLength={120}
                      value={form.location}
                      onChangeText={(location) =>
                        setForm((current) => ({ ...current, location }))
                      }
                      placeholder="Add location"
                      returnKeyType="next"
                      style={calendarFormStyles.input}
                    />
                  </View>
                  <PopupSelect
                    label="Repeat"
                    placeholder="Select repeat"
                    options={["Daily", "Weekly", "Monthly", "Yearly", "None"]}
                    value={form.repeat}
                    onChange={(repeat) =>
                      setForm((current) => ({ ...current, repeat }))
                    }
                  />
                </>
              ) : null}

              <View className="mb-4">
                <FormLabel>Notes</FormLabel>
                <FormInput
                  accessibilityLabel="Event or reminder notes"
                  value={form.details}
                  onChangeText={(value) =>
                    setForm((current) => ({ ...current, details: value }))
                  }
                  placeholder="Add details"
                  multiline
                  style={[calendarFormStyles.input, calendarFormStyles.multilineInput]}
                />
              </View>
              <PopupSelect
                label="Priority"
                placeholder="Select priority"
                options={["Low", "Medium", "High"]}
                value={form.priority}
                onChange={(priority) =>
                  setForm((current) => ({ ...current, priority }))
                }
              />
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
          </KeyboardAvoidingView>
        </View>
      )}

    </SafeAreaView>
  );
}
