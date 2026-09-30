import {
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useEffect, useState } from "react";
import {
    Animated,
    Dimensions,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../constants/colors";
import { DateRangeFilter, type DateRangeSelection } from "../DateRangeFilter";
import { AmountRangeFilter } from "./AmountRangeFilter";
import { CategoryFilter, type CategoryOption } from "./CategoryFilter";
import { SortFilter } from "./SortFilter";
import { StatusFilter } from "./StatusFilter";
import {
    DEFAULT_FILTER_STATE,
    type FilterState,
    type SortOption,
    type StatusOption,
} from "./filterTypes";

const poppinsFontMap = {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
};

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type SectionKey = "date" | "category" | "status" | "amount" | "sort";

type SectionConfig = {
  key: SectionKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const SECTIONS: SectionConfig[] = [
  { key: "date", label: "Date Range", icon: "calendar-outline" },
  { key: "category", label: "Category", icon: "grid-outline" },
  { key: "status", label: "Status", icon: "toggle-outline" },
  { key: "amount", label: "Amount Range", icon: "cash-outline" },
  { key: "sort", label: "Sort By", icon: "swap-vertical-outline" },
];

export type FilterBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Current committed filter state (passed in from parent so sheet restores it) */
  currentFilters: FilterState;
  /** Called when the user presses Apply Filters */
  onApply: (filters: FilterState) => void;
  /** Category list to populate the CategoryFilter */
  categories?: CategoryOption[];
  /** Allow multiple categories when the parent supports a comma-separated value. */
  multiSelectCategories?: boolean;
  /** Control which filter sections to show */
  sections?: SectionKey[];
};

/**
 * FilterBottomSheet — slides up from the bottom with smooth animation.
 * All filter state is kept locally as a draft and only committed on Apply.
 * On Reset, draft reverts to DEFAULT_FILTER_STATE.
 */
export function FilterBottomSheet({
  visible,
  onClose,
  currentFilters,
  onApply,
  categories = [],
  multiSelectCategories = false,
  sections = ["date", "category", "status", "amount", "sort"],
}: FilterBottomSheetProps) {
  const [fontsLoaded] = useFonts(poppinsFontMap);
  const insets = useSafeAreaInsets();

  // Draft state — cloned from currentFilters each time the sheet opens
  const [draft, setDraft] = useState<FilterState>(() => currentFilters);

  // Collapsed/expanded state for each section
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    date: true,
    category: false,
    status: false,
    amount: false,
    sort: false,
  });

  // Slide-up animation
  const [translateY] = useState(() => new Animated.Value(SCREEN_HEIGHT));

  useEffect(() => {
    if (visible) {
      Keyboard.dismiss();
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 260,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateY]);

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  const handleReset = () => {
    setDraft(DEFAULT_FILTER_STATE);
  };

  const toggleSection = (key: SectionKey) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateDraft = (partial: Partial<FilterState>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  };

  const visibleSections = SECTIONS.filter((s) => sections.includes(s.key));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(19,34,25,0.50)",
        }}
      >
        {/* Sheet container — intercept taps so backdrop only fires outside */}
        <Pressable onPress={(e) => e.stopPropagation()} style={{ flex: 1 }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1, justifyContent: "flex-end" }}
          >
            <Animated.View
              style={{
                transform: [{ translateY }],
                backgroundColor: Colors.white,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                maxHeight: SCREEN_HEIGHT * 0.9,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.12,
                shadowRadius: 20,
                elevation: 16,
              }}
            >
              {/* Drag handle */}
              <View
                style={{
                  alignItems: "center",
                  paddingTop: 12,
                  paddingBottom: 4,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: "#D1D5DB",
                  }}
                />
              </View>

              {/* Header */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: Colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "800",
                    fontFamily: fontsLoaded ? "Poppins_700Bold" : undefined,
                    color: Colors.textPrimary,
                  }}
                >
                  Filters
                </Text>
                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  accessibilityLabel="Close filters"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: "#F5F5F5",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="close" size={20} color={Colors.textPrimary} />
                </Pressable>
              </View>

              {/* Scrollable filter sections */}
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
              >
                {visibleSections.map((section) => (
                  <View
                    key={section.key}
                    style={{
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      borderRadius: 16,
                      overflow: "hidden",
                      backgroundColor: Colors.white,
                    }}
                  >
                    {/* Section header (accordion toggle) */}
                    <Pressable
                      onPress={() => toggleSection(section.key)}
                      accessibilityRole="button"
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 14,
                        paddingVertical: 13,
                        backgroundColor: expanded[section.key]
                          ? "#F8FBF6"
                          : Colors.white,
                      }}
                    >
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 17,
                          backgroundColor: expanded[section.key]
                            ? "#8EA66B"
                            : "#F0F0F0",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 12,
                        }}
                      >
                        <Ionicons
                          name={section.icon}
                          size={17}
                          color={
                            expanded[section.key]
                              ? Colors.white
                              : Colors.textSecondary
                          }
                        />
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 14,
                          fontWeight: "700",
                          fontFamily: fontsLoaded
                            ? "Poppins_600SemiBold"
                            : undefined,
                          color: Colors.textPrimary,
                        }}
                      >
                        {section.label}
                      </Text>
                      <Ionicons
                        name={
                          expanded[section.key] ? "chevron-up" : "chevron-down"
                        }
                        size={18}
                        color={Colors.textSecondary}
                      />
                    </Pressable>

                    {/* Section body */}
                    {expanded[section.key] && (
                      <View
                        style={{
                          paddingHorizontal: 14,
                          paddingBottom: 14,
                          paddingTop: 4,
                          borderTopWidth: 1,
                          borderTopColor: Colors.border,
                        }}
                      >
                        {section.key === "date" && (
                          <DateRangeFilter
                            value={draft.dateRange}
                            onChange={(dateRange: DateRangeSelection) =>
                              updateDraft({ dateRange })
                            }
                            style={{ marginTop: 8 }}
                          />
                        )}
                        {section.key === "category" && (
                          <View style={{ marginTop: 8 }}>
                            <CategoryFilter
                              value={draft.category}
                              onChange={(category) => updateDraft({ category })}
                              categories={categories}
                              multiSelect={multiSelectCategories}
                            />
                          </View>
                        )}
                        {section.key === "status" && (
                          <View style={{ marginTop: 8 }}>
                            <StatusFilter
                              value={draft.status as StatusOption}
                              onChange={(status) => updateDraft({ status })}
                            />
                          </View>
                        )}
                        {section.key === "amount" && (
                          <View style={{ marginTop: 8 }}>
                            <AmountRangeFilter
                              minAmount={draft.amountMin}
                              maxAmount={draft.amountMax}
                              onChangeMin={(amountMin) =>
                                updateDraft({ amountMin })
                              }
                              onChangeMax={(amountMax) =>
                                updateDraft({ amountMax })
                              }
                            />
                          </View>
                        )}
                        {section.key === "sort" && (
                          <View style={{ marginTop: 8 }}>
                            <SortFilter
                              value={draft.sort as SortOption}
                              onChange={(sort) => updateDraft({ sort })}
                            />
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>

              {/* Fixed bottom action bar */}
              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                  paddingHorizontal: 16,
                  paddingTop: 12,
                  paddingBottom: 16 + insets.bottom,
                  borderTopWidth: 1,
                  borderTopColor: Colors.border,
                  backgroundColor: Colors.white,
                }}
              >
                {/* Reset */}
                <Pressable
                  onPress={handleReset}
                  accessibilityRole="button"
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 14,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: Colors.border,
                    backgroundColor: Colors.white,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      fontFamily: fontsLoaded
                        ? "Poppins_600SemiBold"
                        : undefined,
                      color: Colors.textSecondary,
                    }}
                  >
                    Reset
                  </Text>
                </Pressable>

                {/* Apply */}
                <Pressable
                  onPress={handleApply}
                  accessibilityRole="button"
                  style={{
                    flex: 2,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 14,
                    borderRadius: 14,
                    backgroundColor: "#8EA66B",
                    shadowColor: "#8EA66B",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.35,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                      fontFamily: fontsLoaded ? "Poppins_700Bold" : undefined,
                      color: Colors.white,
                    }}
                  >
                    Apply Filters
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
