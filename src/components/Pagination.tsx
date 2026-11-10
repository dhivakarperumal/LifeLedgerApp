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
    minWidth: 34,
    height: 38,
    paddingHorizontal: 7,
    borderRadius: 12,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: selected ? Colors.primary : "transparent",
    opacity: disabled ? 0.35 : 1,
  });

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          alignSelf: "center",
          gap: 3,
          padding: 5,
          marginBottom: 15,
          borderRadius: 17,
          borderWidth: 1,
          borderColor: "#E5ECE5",
          backgroundColor: Colors.white,
          shadowColor: "#263238",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.07,
          shadowRadius: 8,
          elevation: 2,
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
        <Ionicons
          name="chevron-back"
          size={18}
          color={page === 1 ? Colors.textMuted : Colors.primary}
        />
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
                fontSize: 13,
                fontWeight: item === page ? "700" : "500",
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
        <Ionicons
          name="chevron-forward"
          size={18}
          color={page === pageCount ? Colors.textMuted : Colors.primary}
        />
      </Pressable>
    </View>
  );
}
