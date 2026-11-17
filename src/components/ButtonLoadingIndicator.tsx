import { useEffect, useState } from "react";
import { Animated, View } from "react-native";

type ButtonLoadingIndicatorProps = {
  size?: number;
  color1?: string;
  color2?: string;
};

export function ButtonLoadingIndicator({
  size = 20,
  color1 = "#FFFFFF",
  color2 = "#0C6011",
}: ButtonLoadingIndicatorProps) {
  const [outerRotation] = useState(() => new Animated.Value(0));
  const [innerRotation] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const outerAnimation = Animated.loop(
      Animated.timing(outerRotation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    );
    const innerAnimation = Animated.loop(
      Animated.timing(innerRotation, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    );

    outerAnimation.start();
    innerAnimation.start();
    return () => {
      outerAnimation.stop();
      innerAnimation.stop();
    };
  }, [innerRotation, outerRotation]);

  const outerSpin = outerRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const innerSpin = innerRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["360deg", "0deg"],
  });
  const innerSize = size * 0.7;
  const borderWidth = size * 0.1;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth,
          borderColor: "transparent",
          borderTopColor: color1,
          borderRightColor: color1,
          transform: [{ rotate: outerSpin }],
        }}
      />
      <Animated.View
        style={{
          position: "absolute",
          width: innerSize,
          height: innerSize,
          borderRadius: innerSize / 2,
          borderWidth: borderWidth * 0.7,
          borderColor: "transparent",
          borderTopColor: color2,
          borderRightColor: color2,
          transform: [{ rotate: innerSpin }],
        }}
      />
    </View>
  );
}
