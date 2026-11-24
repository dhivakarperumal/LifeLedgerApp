import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
  View,
} from "react-native";
import { getStoredToken } from "../api";
import { Colors } from "../constants/colors";

type AuthenticatedMediaImageProps = {
  url: string;
  accessibilityLabel: string;
  resizeMode: "cover" | "contain";
  style: StyleProp<ViewStyle>;
};

export function AuthenticatedMediaImage({
  url,
  accessibilityLabel,
  resizeMode,
  style,
}: AuthenticatedMediaImageProps) {
  const [loadedSource, setLoadedSource] = useState<{
    url: string;
    source: ImageSourcePropType;
  } | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getStoredToken()
      .then((token) => {
        if (!active) return;
        setLoadedSource({
          url,
          source: {
            uri: url,
            ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
          },
        });
      })
      .catch(() => {
        if (active) setFailedUrl(url);
      });
    return () => {
      active = false;
    };
  }, [url]);

  const source = loadedSource?.url === url ? loadedSource.source : null;
  const failed = failedUrl === url;

  return (
    <View
      style={[
        style,
        {
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#E7EEE9",
        },
      ]}
      accessibilityLabel={accessibilityLabel}
    >
      {source && !failed ? (
        <Image
          source={source}
          resizeMode={resizeMode}
          onError={() => setFailedUrl(url)}
          style={{ width: "100%", height: "100%" }}
          accessibilityLabel={accessibilityLabel}
        />
      ) : failed ? (
        <Ionicons
          name="image-outline"
          size={26}
          color={Colors.sage}
          accessibilityLabel={`${accessibilityLabel} could not be loaded`}
        />
      ) : (
        <ActivityIndicator size="small" color={Colors.forest} />
      )}
    </View>
  );
}
