import {
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useEffect, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    Modal,
    Pressable,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../constants/colors";

const poppinsFontMap = {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
};

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export type ViewMode = "card" | "table";

export type ViewModeBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  currentMode: ViewMode;
  onApply: (mode: ViewMode) => void;
};

export function ViewModeBottomSheet({
  visible,
  onClose,
  currentMode,
  onApply,
}: ViewModeBottomSheetProps) {
  const [fontsLoaded] = useFonts(poppinsFontMap);
  const insets = useSafeAreaInsets();
  const [draftMode, setDraftMode] = useState<ViewMode>(currentMode);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      setDraftMode(currentMode);
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
  }, [visible, currentMode]);

  const handleApply = () => {
    onApply(draftMode);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(19,34,25,0.50)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Animated.View
            style={{
              transform: [{ translateY }],
              backgroundColor: Colors.white,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingBottom: insets.bottom > 0 ? insets.bottom : 20,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.12,
              shadowRadius: 20,
              elevation: 16,
            }}
          >
            {/* Handle */}
            <View
              style={{
                alignItems: "center",
                paddingTop: 12,
                paddingBottom: 16,
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
            <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "800",
                  fontFamily: fontsLoaded ? "Poppins_700Bold" : undefined,
                  color: Colors.textPrimary,
                  textAlign: "center",
                }}
              >
                View Mode
              </Text>
            </View>

            {/* Options */}
            <View style={{ paddingHorizontal: 20, gap: 12 }}>
              <Pressable
                onPress={() => setDraftMode("card")}
                accessibilityRole="radio"
                accessibilityState={{ checked: draftMode === "card" }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 16,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: draftMode === "card" ? "#8EA66B" : Colors.border,
                  backgroundColor:
                    draftMode === "card" ? "#F3F7EF" : Colors.white,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor:
                      draftMode === "card" ? "#8EA66B" : "#F5F5F5",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 16,
                  }}
                >
                  <Ionicons
                    name="grid-outline"
                    size={22}
                    color={
                      draftMode === "card" ? Colors.white : Colors.textSecondary
                    }
                  />
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 16,
                    fontWeight: draftMode === "card" ? "700" : "500",
                    fontFamily: fontsLoaded
                      ? draftMode === "card"
                        ? "Poppins_600SemiBold"
                        : "Poppins_500Medium"
                      : undefined,
                    color:
                      draftMode === "card"
                        ? Colors.textPrimary
                        : Colors.textSecondary,
                  }}
                >
                  Card Mode
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setDraftMode("table")}
                accessibilityRole="radio"
                accessibilityState={{ checked: draftMode === "table" }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 16,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor:
                    draftMode === "table" ? "#8EA66B" : Colors.border,
                  backgroundColor:
                    draftMode === "table" ? "#F3F7EF" : Colors.white,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor:
                      draftMode === "table" ? "#8EA66B" : "#F5F5F5",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 16,
                  }}
                >
                  <Ionicons
                    name="list-outline"
                    size={24}
                    color={
                      draftMode === "table"
                        ? Colors.white
                        : Colors.textSecondary
                    }
                  />
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 16,
                    fontWeight: draftMode === "table" ? "700" : "500",
                    fontFamily: fontsLoaded
                      ? draftMode === "table"
                        ? "Poppins_600SemiBold"
                        : "Poppins_500Medium"
                      : undefined,
                    color:
                      draftMode === "table"
                        ? Colors.textPrimary
                        : Colors.textSecondary,
                  }}
                >
                  Table Mode
                </Text>
              </Pressable>
            </View>

            {/* Apply Button */}
            <View
              style={{
                paddingHorizontal: 20,
                paddingTop: 24,
                paddingBottom: 10,
              }}
            >
              <Pressable
                onPress={handleApply}
                accessibilityRole="button"
                style={{
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 16,
                  borderRadius: 16,
                  backgroundColor: "#8EA66B",
                  shadowColor: "#8EA66B",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    fontFamily: fontsLoaded ? "Poppins_700Bold" : undefined,
                    color: Colors.white,
                  }}
                >
                  Apply Selection
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
