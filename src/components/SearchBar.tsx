import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useState } from "react";
import { Pressable, TextInput, View, type ViewStyle } from "react-native";
import { Colors } from "../constants/colors";
import {
  FilterBottomSheet,
  type FilterBottomSheetProps,
} from "./filters/FilterBottomSheet";
import { FilterButton } from "./filters/FilterButton";
import {
  countActiveFilters,
  DEFAULT_FILTER_STATE,
} from "./filters/filterTypes";

type SearchBarFilterSheet = Omit<FilterBottomSheetProps, "visible" | "onClose">;

const poppinsFontMap = {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
};

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Called when the filter button is pressed */
  onFilterPress?: () => void;
  /** Number of active filters — shows badge when > 0 */
  activeFilterCount?: number;
  /** Backward-compatible single active-filter indicator. */
  filterActive?: boolean;
  /** Enables the shared bottom sheet while keeping committed state in the parent. */
  filterSheet?: SearchBarFilterSheet;
  /** Pass a custom right icon name; defaults to the sliders/options icon */
  filterIcon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
};

/**
 * Full-width rounded search bar with optional inline FilterButton on the right.
 * Pass `onFilterPress` and `activeFilterCount` to show the filter button.
 */
export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search...",
  onFilterPress,
  activeFilterCount,
  filterActive = false,
  filterSheet,
  style,
}: Props) {
  const [fontsLoaded] = useFonts(poppinsFontMap);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [filterSheetKey, setFilterSheetKey] = useState(0);
  const filterCount =
    activeFilterCount ??
    (filterSheet
      ? countActiveFilters(filterSheet.currentFilters)
      : filterActive
        ? 1
        : 0);

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
        },
        style,
      ]}
    >
      {/* Input pill */}
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          minHeight: 52,
          backgroundColor: Colors.white,
          borderRadius: 50,
          paddingHorizontal: 10,
          paddingVertical: 5,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 3,
          borderWidth: 1,
          borderColor: Colors.border,
        }}
      >
        <Ionicons
          name="search-outline"
          size={18}
          color={Colors.textSecondary}
        />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textSecondary}
          style={{
            flex: 1,
            marginLeft: 10,
            fontSize: 14,
            fontFamily: fontsLoaded ? "Poppins_400Regular" : undefined,
            color: Colors.textPrimary,
            padding: 0,
          }}
          returnKeyType="search"
        />
        {value.length > 0 && (
          <Pressable onPress={() => onChangeText("")} hitSlop={8}>
            <Ionicons
              name="close-circle"
              size={17}
              color={Colors.textSecondary}
            />
          </Pressable>
        )}
        {(onFilterPress || filterSheet) && (
          <FilterButton
            onPress={
              filterSheet
                ? () => {
                    setFilterSheetKey((key) => key + 1);
                    setFilterSheetVisible(true);
                  }
                : onFilterPress || (() => undefined)
            }
            activeCount={filterCount}
          />
        )}
      </View>

      {filterSheet && (
        <FilterBottomSheet
          key={filterSheetKey}
          {...filterSheet}
          visible={filterSheetVisible}
          onClose={() => setFilterSheetVisible(false)}
          onReset={() => {
            filterSheet.onApply(DEFAULT_FILTER_STATE);
            filterSheet.onReset?.();
          }}
        />
      )}
    </View>
  );
}
