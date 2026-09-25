import { useState, type PropsWithChildren } from "react";
import {
  RefreshControl,
  ScrollView,
  type ScrollViewProps,
} from "react-native";
import { Colors } from "../constants/colors";

type RefreshableScrollViewProps = PropsWithChildren<
  ScrollViewProps & { onRefresh?: () => void | Promise<void> }
>;

export function RefreshableScrollView({
  children,
  onRefresh,
  ...props
}: RefreshableScrollViewProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        onRefresh?.(),
        new Promise<void>((resolve) => setTimeout(resolve, 600)),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView
      {...props}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={Colors.primary}
          colors={[Colors.primary]}
          progressBackgroundColor={Colors.white}
        />
      }
    >
      {children}
    </ScrollView>
  );
}