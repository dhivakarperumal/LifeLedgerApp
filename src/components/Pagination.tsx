import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, Text, View, type ViewStyle } from "react-native";
import { Colors } from "../constants/colors";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  style?: ViewStyle;
};

type PageItem = number | "start-ellipsis" | "end-ellipsis";

function getPageItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const start = Math.max(2, Math.min(currentPage - 1, totalPages - 4));
  const end = Math.min(totalPages - 1, start + 2);
  const items: PageItem[] = [1];

  if (start > 2) items.push("start-ellipsis");
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < totalPages - 1) items.push("end-ellipsis");
  items.push(totalPages);

  return items;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  style,
}: PaginationProps) {
  const pageCount = Math.floor(totalPages);
  if (!Number.isFinite(pageCount) || pageCount < 1) return null;

  const page = Math.max(1, Math.min(Math.floor(currentPage), pageCount));
  const items = getPageItems(page, pageCount);

  const buttonStyle = (selected = false, disabled = false) => ({
    minWidth: 36,
    height: 36,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: selected ? Colors.primary : Colors.white,
    borderWidth: 1,
    borderColor: selected ? Colors.primary : Colors.border,
    opacity: disabled ? 0.45 : 1,
  });

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        },
        style,
      ]}
      accessibilityRole="toolbar"
      accessibilityLabel="Pagination"
    >
      <Pressable
        onPress={() => onPageChange(page - 1)}
        disabled={page === 1}
        style={buttonStyle(false, page === 1)}
        accessibilityRole="button"
        accessibilityLabel="Previous page"
      >
        <Ionicons name="chevron-back" size={18} color={Colors.textPrimary} />
      </Pressable>

      {items.map((item) =>
        typeof item === "number" ? (
          <Pressable
            key={item}
            onPress={() => onPageChange(item)}
            style={buttonStyle(item === page)}
            accessibilityRole="button"
            accessibilityLabel={`Page ${item}`}
            accessibilityState={{ selected: item === page }}
          >
            <Text
              style={{
                color: item === page ? Colors.white : Colors.textPrimary,
                fontSize: 14,
                fontWeight: item === page ? "600" : "400",
              }}
            >
              {item}
            </Text>
          </Pressable>
        ) : (
          <Text
            key={item}
            style={{ color: Colors.textSecondary, paddingHorizontal: 2 }}
            accessibilityLabel="More pages"
          >
            …
          </Text>
        ),
      )}

      <Pressable
        onPress={() => onPageChange(page + 1)}
        disabled={page === pageCount}
        style={buttonStyle(false, page === pageCount)}
        accessibilityRole="button"
        accessibilityLabel="Next page"
      >
        <Ionicons name="chevron-forward" size={18} color={Colors.textPrimary} />
      </Pressable>
    </View>
  );
}
