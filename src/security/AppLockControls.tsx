import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  PanResponder,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Line } from "react-native-svg";
import { Colors } from "../constants/colors";

const controlColors = {
  surface: "#FFFFFF",
  border: "#DCE5DD",
  muted: "#718078",
  ink: "#263238",
};

const KEYPAD_DIGITS = [
  [
    { key: "1", sub: "" },
    { key: "2", sub: "ABC" },
    { key: "3", sub: "DEF" },
  ],
  [
    { key: "4", sub: "GHI" },
    { key: "5", sub: "JKL" },
    { key: "6", sub: "MNO" },
  ],
  [
    { key: "7", sub: "PQRS" },
    { key: "8", sub: "TUV" },
    { key: "9", sub: "WXYZ" },
  ],
];

export function PinKeypad({
  value,
  onChange,
  onSubmit,
  minLength = 1,
  maxLength = 6,
  submitLabel = "Continue",
  onBiometric,
  variant = "default",
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  minLength?: number;
  maxLength?: number;
  submitLabel?: string;
  onBiometric?: () => void;
  variant?: "default" | "lock";
}) {
  const lockStyle = variant === "lock";
  const keySize = lockStyle ? 68 : 72;
  const keyGap = lockStyle ? 18 : 0;
  const handlePressDigit = (digit: string) => {
    if (value.length < maxLength) {
      const nextValue = `${value}${digit}`;
      onChange(nextValue);
      if (nextValue.length === maxLength) {
        setTimeout(() => onSubmit(nextValue), 80);
      }
    }
  };
  const handleDelete = () => {
    if (value.length > 0) onChange(value.slice(0, -1));
  };
  const handleClear = () => {
    if (value.length > 0) onChange("");
  };
  const renderDigit = (digit: string, subtitle = "") => (
    <Pressable
      key={digit}
      accessibilityRole="button"
      accessibilityLabel={`Number ${digit}`}
      onPress={() => handlePressDigit(digit)}
      style={({ pressed }) => ({
        width: keySize,
        height: keySize,
        borderRadius: keySize / 2,
        backgroundColor: pressed ? "#DCEBCC" : lockStyle ? "#F5F8EF" : "#F4F7F4",
        borderWidth: 1,
        borderColor: pressed ? "#C8DAC9" : lockStyle ? "#C8D6C8" : "#E2EBE2",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOpacity: pressed || lockStyle ? 0 : 0.04,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
        elevation: pressed || lockStyle ? 0 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 26,
          fontWeight: lockStyle ? "500" : "700",
          color: Colors.textPrimary,
          lineHeight: 30,
        }}
      >
        {digit}
      </Text>
      {subtitle && !lockStyle ? (
        <Text style={{ fontSize: 9, fontWeight: "700", color: "#7E9082", letterSpacing: 1.5, marginTop: 1 }}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
  const renderActionSlot = () => {
    if (onBiometric) {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Unlock with biometrics"
          onPress={onBiometric}
          style={{ width: keySize, height: keySize, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="finger-print" size={32} color={Colors.primary} />
        </Pressable>
      );
    }
    if (value.length > 0) {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear all"
          onPress={handleClear}
          style={{ width: keySize, height: keySize, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: "#6A7B70" }}>CLEAR</Text>
        </Pressable>
      );
    }
    return <View style={{ width: keySize, height: keySize }} />;
  };
  const renderDelete = () => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Delete digit"
      disabled={value.length === 0}
      onPress={handleDelete}
      onLongPress={handleClear}
      style={({ pressed }) => ({
        width: keySize,
        height: keySize,
        borderRadius: keySize / 2,
        backgroundColor: pressed ? "#E6EEE7" : "transparent",
        alignItems: "center",
        justifyContent: "center",
        opacity: value.length === 0 ? 0.3 : 1,
      })}
    >
      <Ionicons name="backspace-outline" size={26} color={controlColors.ink} />
    </Pressable>
  );

  return (
    <View style={{ width: "100%", alignItems: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: lockStyle ? 16 : 14, marginVertical: lockStyle ? 12 : 18 }}>
        {Array.from({ length: maxLength }, (_, index) => {
          const isFilled = value.length > index;
          return (
            <View
              key={index}
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                borderWidth: isFilled ? 0 : 2,
                borderColor: isFilled ? Colors.primary : lockStyle ? "#A8C4A0" : "#CAD6CD",
                backgroundColor: isFilled ? Colors.primary : lockStyle ? "#F5F8EF" : "#EEF3EF",
              }}
            />
          );
        })}
      </View>
      <View
        style={{
          width: "100%",
          maxWidth: lockStyle ? 276 : 290,
          alignSelf: "center",
          paddingHorizontal: lockStyle ? 8 : 0,
        }}
      >
        {KEYPAD_DIGITS.map((row, rowIndex) => (
          <View
            key={rowIndex}
            style={{
              width: "100%",
              flexDirection: "row",
              justifyContent: lockStyle ? "center" : "space-between",
              alignItems: "center",
              columnGap: keyGap,
              marginBottom: 12,
            }}
          >
            {row.map((item) => renderDigit(item.key, item.sub))}
          </View>
        ))}
        <View style={{ width: "100%", flexDirection: "row", justifyContent: lockStyle ? "center" : "space-between", alignItems: "center", columnGap: keyGap, marginBottom: 6 }}>
          {renderActionSlot()}
          {renderDigit("0")}
          {renderDelete()}
        </View>
      </View>
    </View>
  );
}

export function PatternGrid({
  onComplete,
  onInvalid,
  onDrawingChange,
  resetKey,
  variant = "default",
}: {
  onComplete: (pattern: string) => void;
  onInvalid?: (message: string) => void;
  onDrawingChange?: (drawing: boolean) => void;
  resetKey: string;
  variant?: "default" | "lock";
}) {
  const lockStyle = variant === "lock";
  const [size, setSize] = useState(240);
  const [path, setPath] = useState<number[]>([]);
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null);
  const [panHandlers, setPanHandlers] = useState<
    ReturnType<typeof PanResponder.create>["panHandlers"] | null
  >(null);
  const pathRef = useRef<number[]>([]);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const sizeRef = useRef(size);
  const callbacksRef = useRef({ onComplete, onInvalid, onDrawingChange });
  const dotSize = 18;

  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  useEffect(() => {
    callbacksRef.current = { onComplete, onInvalid, onDrawingChange };
  }, [onComplete, onInvalid, onDrawingChange]);

  const addDotsOnSegment = useCallback((from: { x: number; y: number }, to: { x: number; y: number }) => {
    const padding = 10;
    const gridContentSize = sizeRef.current - padding * 2;
    const spacing = gridContentSize / 3;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const segmentLengthSquared = dx * dx + dy * dy;
    const crossed = Array.from({ length: 9 }, (_, dot) => {
      const center = {
        x: padding + ((dot % 3) + 0.5) * spacing,
        y: padding + (Math.floor(dot / 3) + 0.5) * spacing,
      };
      const progress = segmentLengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((center.x - from.x) * dx + (center.y - from.y) * dy) /
                segmentLengthSquared,
            ),
          );
      const distance = Math.hypot(
        center.x - (from.x + progress * dx),
        center.y - (from.y + progress * dy),
      );
      return { dot, progress, distance };
    })
      .filter(({ dot, distance }) =>
        !pathRef.current.includes(dot) && distance <= spacing * 0.32
      )
      .sort((a, b) => a.progress - b.progress);

    if (crossed.length > 0) {
      const nextPath = [...pathRef.current, ...crossed.map(({ dot }) => dot)];
      pathRef.current = nextPath;
      setPath(nextPath);
    }
  }, []);

  const updateDrawing = useCallback((x: number, y: number) => {
    const point = { x, y };
    const lastPoint = lastPointRef.current;
    if (lastPoint) addDotsOnSegment(lastPoint, point);
    lastPointRef.current = point;
    setCurrentPoint(point);
  }, [addDotsOnSegment]);

  const finishPattern = useCallback(() => {
    const selectedPath = pathRef.current;
    if (selectedPath.length >= 4) {
      callbacksRef.current.onComplete(selectedPath.join("."));
    } else if (selectedPath.length > 0) {
      callbacksRef.current.onInvalid?.("Connect at least 4 different dots.");
    }
    pathRef.current = [];
    lastPointRef.current = null;
    setPath([]);
    setCurrentPoint(null);
    callbacksRef.current.onDrawingChange?.(false);
  }, []);

  const cancelPattern = useCallback(() => {
    pathRef.current = [];
    lastPointRef.current = null;
    setPath([]);
    setCurrentPoint(null);
    callbacksRef.current.onDrawingChange?.(false);
  }, []);

  useEffect(() => {
    const responder = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          pathRef.current = [];
          lastPointRef.current = null;
          setPath([]);
          callbacksRef.current.onDrawingChange?.(true);
          updateDrawing(event.nativeEvent.locationX, event.nativeEvent.locationY);
        },
        onPanResponderMove: (event) => {
          updateDrawing(event.nativeEvent.locationX, event.nativeEvent.locationY);
        },
        onPanResponderRelease: (event) => {
          updateDrawing(event.nativeEvent.locationX, event.nativeEvent.locationY);
          finishPattern();
        },
        onPanResponderTerminate: cancelPattern,
    });
    setPanHandlers(responder.panHandlers);
  }, [cancelPattern, finishPattern, updateDrawing]);

  return (
    <View
      key={resetKey}
      onLayout={(event) => {
        const nextSize = Math.min(event.nativeEvent.layout.width, lockStyle ? 300 : 260);
        if (nextSize > 0) {
          sizeRef.current = nextSize;
          setSize(nextSize);
        }
      }}
      {...(panHandlers ?? {})}
      onTouchCancel={cancelPattern}
      style={{
        width: "100%",
        maxWidth: lockStyle ? 300 : 260,
        aspectRatio: 1,
        alignSelf: "center",
        flexDirection: "row",
        flexWrap: "wrap",
        overflow: "hidden",
        borderRadius: lockStyle ? 0 : 24,
        backgroundColor: lockStyle ? "transparent" : "#F5F8F5",
        padding: 10,
      }}
    >
      <Svg
        pointerEvents="none"
        width={size}
        height={size}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {path.slice(1).map((dot, index) => {
          const centerFor = (selectedDot: number) => ({
            x: 10 + ((selectedDot % 3) + 0.5) * ((size - 20) / 3),
            y: 10 + (Math.floor(selectedDot / 3) + 0.5) * ((size - 20) / 3),
          });
          const start = centerFor(path[index]);
          const end = centerFor(dot);
          return (
            <Line
              key={`${path[index]}-${dot}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={lockStyle ? "#77BB10" : Colors.primary}
              strokeWidth={4}
              strokeLinecap="round"
            />
          );
        })}
        {currentPoint && path.length > 0 ? (
          <Line
            x1={10 + ((path[path.length - 1] % 3) + 0.5) * ((size - 20) / 3)}
            y1={10 + (Math.floor(path[path.length - 1] / 3) + 0.5) * ((size - 20) / 3)}
            x2={currentPoint.x}
            y2={currentPoint.y}
            stroke={lockStyle ? "#77BB10" : Colors.primary}
            strokeWidth={3}
            strokeLinecap="round"
          />
        ) : null}
      </Svg>
      {Array.from({ length: 9 }, (_, dot) => {
        const selectedIndex = path.indexOf(dot);
        return (
          <View
            key={dot}
            style={{
              width: "33.333%",
              height: "33.333%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: lockStyle && selectedIndex >= 0 ? 24 : dotSize,
                height: lockStyle && selectedIndex >= 0 ? 24 : dotSize,
                borderRadius: lockStyle && selectedIndex >= 0 ? 12 : dotSize / 2,
                borderWidth: selectedIndex >= 0 ? 0 : lockStyle ? 0 : 2,
                borderColor: "#9EADA2",
                backgroundColor: selectedIndex >= 0
                  ? lockStyle ? "#3F970F" : Colors.primary
                  : lockStyle ? "#A7BE9E" : controlColors.surface,
                transform: [{ scale: selectedIndex >= 0 ? 1.2 : 1 }],
                shadowColor: lockStyle && selectedIndex >= 0 ? "#9DEB3A" : "transparent",
                shadowOpacity: lockStyle && selectedIndex >= 0 ? 0.8 : 0,
                shadowRadius: lockStyle ? 10 : 0,
                elevation: lockStyle && selectedIndex >= 0 ? 3 : 0,
              }}
            />
            {selectedIndex >= 0 && !lockStyle ? (
              <Text
                style={{
                  position: "absolute",
                  color: Colors.white,
                  fontSize: 8,
                  fontWeight: "800",
                }}
              >
                {selectedIndex + 1}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export function PasswordForm({
  value,
  onChange,
  placeholder = "Enter password",
  showToggle = true,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showToggle?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View
      style={{
        width: "100%",
        minHeight: 54,
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: controlColors.border,
        backgroundColor: controlColors.surface,
        paddingLeft: 15,
        paddingRight: 12,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        style={{ flex: 1, minHeight: 52, color: controlColors.ink, fontSize: 15 }}
      />
      {showToggle ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? "Hide password" : "Show password"}
          onPress={() => setVisible((current) => !current)}
          hitSlop={10}
          style={{ padding: 7 }}
        >
          <Ionicons
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={controlColors.muted}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

export function BiometricPrompt({
  available,
  busy,
  message,
  onPress,
}: {
  available: boolean;
  busy: boolean;
  message: string;
  onPress: () => void;
}) {
  return (
    <View style={{ width: "100%", alignItems: "center", gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Unlock with biometrics"
        accessibilityState={{ disabled: !available || busy }}
        disabled={!available || busy}
        onPress={onPress}
        style={({ pressed }) => ({
          width: 66,
          height: 66,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 22,
          backgroundColor: "#E8F2E8",
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <Ionicons
          name="finger-print-outline"
          size={38}
          color={available ? Colors.primary : "#A8B2AC"}
        />
      </Pressable>
      <Text style={{ color: controlColors.muted, fontSize: 12, textAlign: "center" }}>
        {message}
      </Text>
    </View>
  );
}
