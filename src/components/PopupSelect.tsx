import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Pressable,
    Platform,
    ScrollView,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from "react-native";

export type PopupSelectOption =
  | string
  | {
      label: string;
      value: string;
      description?: string;
      disabled?: boolean;
    };

type PopupSelectProps = {
  label: string;
  placeholder: string;
  options: PopupSelectOption[];
  value?: string;
  onChange: (value: string) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  loading?: boolean;
  error?: string;
  required?: boolean;
  disabled?: boolean;
};

export function PopupSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  searchPlaceholder,
  emptyMessage,
  loading = false,
  error,
  required = false,
  disabled = false,
}: PopupSelectProps) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const normalizedOptions = useMemo(
    () =>
      options.map((option) =>
        typeof option === "string"
          ? { label: option, value: option }
          : {
              label: option.label,
              value: option.value,
              description: option.description,
              disabled: option.disabled,
            },
      ),
    [options],
  );

  const selectedOption = normalizedOptions.find((option) => option.value === value);

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return normalizedOptions;

    return normalizedOptions.filter((option) => {
      const haystack = [
        option.label,
        option.value,
        option.description ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [normalizedOptions, search]);

  const openPicker = () => {
    if (!disabled) {
      setVisible(true);
    }
  };

  const closePicker = () => {
    setVisible(false);
    setSearch("");
  };

  const handleSelect = (optionValue: string, optionDisabled?: boolean) => {
    if (optionDisabled) return;
    onChange(optionValue);
    closePicker();
  };

  return (
    <View className="mb-4">
      {label ? (
        <Text className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#46534B]">
          {label}
          {required ? " *" : ""}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={openPicker}
        disabled={disabled}
        className={`min-h-[50px] w-full flex-row items-center justify-between rounded-xl border bg-white px-3.5 py-3 ${
          error
            ? "border-[#FECACA]"
            : disabled
              ? "border-[#E5E7EB] opacity-60"
              : "border-[#E5E7EB]"
        }`}
      >
        <Text
          className={`text-sm font-semibold ${selectedOption ? "text-[#25332C]" : "text-[#9AA39D]"}`}
          numberOfLines={1}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Ionicons name="chevron-down-outline" size={18} color="#667085" />
      </Pressable>

      {error ? (
        <Text className="mt-1 text-xs font-medium text-[#D92D20]">{error}</Text>
      ) : null}

      <Modal
        transparent
        animationType="slide"
        visible={visible}
        onRequestClose={closePicker}
      >
        <Pressable className="flex-1 bg-black/40" onPress={closePicker}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{
                flex: 1,
                justifyContent: isDesktop ? "center" : "flex-end",
              }}
            >
              <Pressable
                onPress={(event) => event.stopPropagation()}
                className={
                  isDesktop
                    ? "mx-auto my-auto w-[92%] max-w-[420px] overflow-hidden rounded-[28px] bg-white p-4"
                    : "mt-auto w-full overflow-hidden rounded-t-[28px] bg-white p-4 pb-5"
                }
                style={{ maxHeight: "90%" }}
              >
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-bold text-[#25332C]">{label}</Text>
              <Pressable
                onPress={closePicker}
                className="h-8 w-8 items-center justify-center rounded-full bg-[#F1F5F9]"
              >
                <Ionicons name="close" size={16} color="#475569" />
              </Pressable>
            </View>

            <View className="mb-3 flex-row items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2">
              <Ionicons name="search-outline" size={16} color="#667085" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}`}
                placeholderTextColor="#94A3B8"
                className="flex-1 text-sm text-[#25332C]"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {loading ? (
              <View className="flex-row items-center justify-center gap-2 py-8">
                <ActivityIndicator size="small" color="#1B4332" />
                <Text className="text-sm font-medium text-[#475569]">
                  Loading options...
                </Text>
              </View>
            ) : filteredOptions.length === 0 ? (
              <View className="items-center justify-center py-8">
                <Text className="text-sm font-semibold text-[#475569]">
                  {emptyMessage ?? "No options found"}
                </Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                className={isDesktop ? "max-h-[50vh]" : "max-h-[56vh]"}
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets
                keyboardDismissMode="none"
              >
                {filteredOptions.map((option) => {
                  const optionDisabled = Boolean(option.disabled);
                  const isSelected = option.value === value;

                  return (
                    <Pressable
                      key={option.value || option.label}
                      onPress={() => handleSelect(option.value, optionDisabled)}
                      disabled={optionDisabled}
                      className={`mb-2 flex-row items-center justify-between rounded-xl border px-3 py-3 ${
                        isSelected
                          ? "border-[#DDE9DF] bg-[#EEF6F0]"
                          : optionDisabled
                            ? "border-[#F3F4F6] bg-[#F9FAFB] opacity-60"
                            : "border-[#EEF2F5] bg-white"
                      }`}
                    >
                      <View className="flex-1">
                        <Text
                          className={`text-sm font-semibold ${
                            isSelected ? "text-[#1F3C2F]" : "text-[#344054]"
                          }`}
                        >
                          {option.label}
                        </Text>
                        {option.description ? (
                          <Text className="mt-1 text-xs text-[#667085]">
                            {option.description}
                          </Text>
                        ) : null}
                      </View>

                      {isSelected ? (
                        <Ionicons name="checkmark" size={18} color="#315640" />
                      ) : optionDisabled ? (
                        <Text className="text-[10px] font-bold uppercase text-[#98A2B3]">
                          Unavailable
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}
