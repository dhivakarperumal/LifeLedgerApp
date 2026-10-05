import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { CalendarDays, Clock3 } from "lucide-react-native";
import { useState } from "react";
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

export type DateTimePickerMode = "date" | "time" | "datetime";

interface DateTimePickerComponentProps {
  mode: DateTimePickerMode;
  value?: Date | null;
  onChange: (date?: Date) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
}

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function DateTimePickerComponent({
  mode,
  value,
  onChange,
  label,
  placeholder,
  disabled = false,
  compact = false,
}: DateTimePickerComponentProps) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(value ?? new Date());
  const [androidMode, setAndroidMode] = useState<"date" | "time">(
    mode === "time" ? "time" : "date",
  );
  const isValidValue = value instanceof Date && !Number.isNaN(value.getTime());

  const openPicker = (pickerMode: "date" | "time") => {
    if (disabled) return;
    Keyboard.dismiss();
    setDraft(value ?? new Date());
    setAndroidMode(pickerMode);
    setVisible(true);
  };

  const closePicker = () => setVisible(false);

  const applySelection = () => {
    onChange(draft);
    closePicker();
  };

  const handleNativeChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (event.type !== "set" || !selectedDate) {
      if (Platform.OS === "android") closePicker();
      return;
    }

    setDraft(selectedDate);
    if (Platform.OS === "android") {
      if (mode === "datetime" && androidMode === "date") {
        setAndroidMode("time");
      } else {
        onChange(selectedDate);
        closePicker();
      }
    }
  };

  const renderField = (fieldMode: "date" | "time") => {
    const fieldLabel = fieldMode === "date" ? "Date" : "Time";
    const displayValue = isValidValue
      ? fieldMode === "date"
        ? formatDate(value)
        : formatTime(value)
      : placeholder || `Select ${fieldMode}`;
    const accessibilityLabel = `${fieldLabel}, ${isValidValue ? displayValue : placeholder || `Select ${fieldMode}`}`;

    return (
      <Pressable
        key={fieldMode}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => openPicker(fieldMode)}
        className={`min-h-[50px] flex-1 flex-row items-center rounded-xl border border-[#E4E8E3] bg-white px-3 ${
          compact ? "py-2" : "py-3"
        } ${disabled ? "opacity-50" : ""}`}
      >
        <View className="mr-2 h-8 w-8 items-center justify-center rounded-lg bg-[#EEF3E9]">
          {fieldMode === "date" ? (
            <CalendarDays size={17} color="#8EA66B" />
          ) : (
            <Clock3 size={17} color="#8EA66B" />
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text
            numberOfLines={1}
            className={`text-xs font-semibold ${isValidValue ? "text-[#25332C]" : "text-[#9AA39D]"}`}
          >
            {displayValue}
          </Text>
        </View>
      </Pressable>
    );
  };

  const fields =
    mode === "datetime" ? (
      <View className="w-full flex-row gap-2">
        {renderField("date")}
        {renderField("time")}
      </View>
    ) : (
      <View className="w-full">{renderField(mode)}</View>
    );

  return (
    <View className="w-full">
      {label && (
        <Text className="mb-2 text-xs font-bold text-[#46534B]">{label}</Text>
      )}
      {fields}

      {Platform.OS === "android" && visible && (
        <DateTimePicker
          key={androidMode}
          value={draft}
          mode={androidMode}
          display="default"
          onChange={handleNativeChange}
          accentColor="#8EA66B"
        />
      )}

      {Platform.OS === "ios" && (
        <Modal
          animationType="slide"
          transparent
          visible={visible}
          onRequestClose={closePicker}
        >
          <View className="flex-1 justify-end bg-black/40">
            <View className="rounded-t-3xl bg-white px-5 pb-8 pt-5">
              <View className="mb-3 flex-row items-center justify-between border-b border-gray-100 pb-3">
                <Text className="text-base font-bold text-[#25332C]">
                  {mode === "datetime" ? "Date & time" : label || (mode === "date" ? "Date" : "Time")}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={closePicker}
                  className="px-2 py-1"
                >
                  <Text className="text-sm font-semibold text-[#7B8580]">
                    Cancel
                  </Text>
                </Pressable>
              </View>

              {mode !== "time" && (
                <DateTimePicker
                  value={draft}
                  mode="date"
                  display="spinner"
                  onChange={handleNativeChange}
                  accentColor="#8EA66B"
                />
              )}
              {mode !== "date" && (
                <DateTimePicker
                  value={draft}
                  mode="time"
                  display="spinner"
                  onChange={handleNativeChange}
                  accentColor="#8EA66B"
                />
              )}

              <Pressable
                accessibilityRole="button"
                onPress={applySelection}
                className="mt-3 items-center rounded-xl bg-[#315640] py-3.5"
              >
                <Text className="text-sm font-bold text-white">Apply</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
