import {
    Poppins_600SemiBold,
    Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { useFonts } from "expo-font";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    Animated,
    Image,
    StatusBar,
    Text,
    View,
    useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isLoggedIn } from "../api";
import { Colors } from "../constants/colors";

export function LoadingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const logoSize = Math.min(width * 0.28, 128);
  const [fontsLoaded] = useFonts({ Poppins_600SemiBold, Poppins_700Bold });
  const [rotation] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1100,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [rotation]);

  useEffect(() => {
    let cancelled = false;

    const redirect = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1800));
      const loggedIn = await isLoggedIn().catch(() => false);

      if (!cancelled) {
        router.replace(loggedIn ? "/tabs" : "/auth/login");
      }
    };

    void redirect();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle="dark-content"
        translucent
        backgroundColor="transparent"
      />
      <View style={styles.background}>
        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + 12,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          <View style={styles.brand}>
            <View
              style={[
                styles.logoBadge,
                {
                  width: logoSize,
                  height: logoSize,
                  borderRadius: logoSize / 2,
                },
              ]}
            >
              <Image
                source={require("../../assets/images/logo.png")}
                resizeMode="contain"
                style={{
                  width: logoSize,
                  height: logoSize,
                  borderRadius: logoSize / 2,
                }}
                accessibilityLabel="Life Ledger logo"
              />
            </View>
            <Text
              style={[
                styles.wordmark,
                fontsLoaded && { fontFamily: "Poppins_700Bold" },
              ]}
            >
              <Text style={styles.wordmarkLife}>Life </Text>
              <Text style={styles.wordmarkLedger}>Ledger</Text>
            </Text>
            <View style={styles.tagline}>
              <Text style={styles.taglineText}>Expense</Text>
              <View style={styles.taglineDot} />
              <Text style={styles.taglineText}>Memories</Text>
              <View style={styles.taglineDot} />
              <Text style={styles.taglineText}>Diary</Text>
            </View>
          </View>

          <View style={styles.loading}>
            <Animated.View
              style={[styles.spinner, { transform: [{ rotate: spin }] }]}
            />
            <Text
              style={[
                styles.loadingText,
                fontsLoaded && { fontFamily: "Poppins_600SemiBold" },
              ]}
            >
              Loading...
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = {
  screen: {
    flex: 1,
    backgroundColor: Colors.loadingBackground,
  },
  background: {
    flex: 1,
    width: "100%" as const,
    backgroundColor: Colors.loadingBackground,
  },
  content: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 20,
  },
  brand: {
    alignItems: "center" as const,
  },
  logoBadge: {
    overflow: "hidden" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: Colors.white,
  },
  wordmark: {
    marginTop: 4,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
  },
  wordmarkLife: {
    color: Colors.deepForest,
  },
  wordmarkLedger: {
    color: Colors.forest,
  },
  tagline: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 9,
    marginTop: 3,
    flexWrap: "wrap" as const,
  },
  taglineText: {
    color: Colors.textPrimary,
    fontSize: 12,
    letterSpacing: 1.5,
  },
  taglineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  loading: {
    alignItems: "center" as const,
    marginTop: 32,
  },
  spinner: {
    width: 48,
    height: 48,
    borderWidth: 5,
    borderColor: "#DDE7D8",
    borderTopColor: "#578F42",
    borderRightColor: "#578F42",
    borderRadius: 24,
  },
  loadingText: {
    marginTop: 8,
    color: Colors.primaryDark,
    fontSize: 14,
    fontWeight: "600" as const,
  },
};
