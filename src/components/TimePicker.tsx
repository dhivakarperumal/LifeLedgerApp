import DateTimePicker, {
    type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Clock } from "lucide-react-native";
import { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { toTitleCase } from "./formLabelUtils";

interface TimePickerProps {
  value?: Date;
  onChange: (time: Date) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

function formatTime(time: Date): string {
  const hours = time.getHours();
  const hour12 = hours % 12 || 12;
  const minutes = String(time.getMinutes()).padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";

  return `${String(hour12).padStart(2, "0")}:${minutes} ${period}`;
}

export default function TimePicker({
  value,
  onChange,
  label = "Time",
  placeholder = "Select time",
  disabled = false,
}: TimePickerProps) {
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const displayLabel = toTitleCase(label);
  const hasValue = value instanceof Date && !Number.isNaN(value.getTime());
  const displayedTime = hasValue ? value : new Date();

  const handleChange = (event: DateTimePickerEvent, selectedTime?: Date) => {
    if (Platform.OS === "android") {
      setIsPickerVisible(false);
    }

    if (event.type === "set" && selectedTime) {
      onChange(selectedTime);
    }
  };

  const openPicker = () => {
    if (!disabled) {
      setIsPickerVisible(true);
    }
  };

  return (
    <View className="mb-4 w-full">
      <Text
        className={`mb-2 text-sm font-medium ${
          disabled ? "text-gray-400" : "text-gray-700"
        }`}
      >
        {displayLabel}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${displayLabel}, ${hasValue ? formatTime(displayedTime) : placeholder}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={openPicker}
        className={`h-[50px] w-full flex-row items-center justify-between rounded-xl border px-4 ${
          disabled
            ? "border-gray-200 bg-gray-50"
            : isPickerVisible
              ? "border-[#8EA66B] bg-white"
              : "border-gray-200 bg-white"
        }`}
      >
        <Text
          className={`text-[15px] ${
            hasValue && !disabled ? "text-gray-800" : "text-gray-400"
          }`}
        >
          {hasValue ? formatTime(displayedTime) : placeholder}
        </Text>
        <Clock size={20} color={disabled ? "#9CA3AF" : "#8EA66B"} />
      </Pressable>

      {isPickerVisible && Platform.OS === "android" && (
        <DateTimePicker
          value={displayedTime}
          mode="time"
          display="default"
          onChange={handleChange}
          accentColor="#8EA66B"
        />
      )}

      {Platform.OS === "ios" && (
        <Modal
          animationType="slide"
          transparent
          visible={isPickerVisible}
          onRequestClose={() => setIsPickerVisible(false)}
        >
          <View className="flex-1 justify-end bg-black/40">
            <View className="rounded-t-2xl bg-white px-4 pb-8 pt-4">
              <View className="flex-row justify-end border-b border-gray-100 pb-3">
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setIsPickerVisible(false)}
                  className="px-2 py-1"
                >
                  <Text className="text-base font-semibold text-[#8EA66B]">
                    Done
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={displayedTime}
                mode="time"
                display="spinner"
                onChange={handleChange}
                accentColor="#8EA66B"
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
