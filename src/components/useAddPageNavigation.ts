import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useRef } from "react";

export function useAddPageNavigation() {
  const router = useRouter();
  const navigationPending = useRef(false);

  useFocusEffect(
    useCallback(() => {
      navigationPending.current = false;
    }, []),
  );

  return useCallback(
    (href: Href) => {
      if (navigationPending.current) return;
      navigationPending.current = true;
      router.push(href);
    },
    [router],
  );
}