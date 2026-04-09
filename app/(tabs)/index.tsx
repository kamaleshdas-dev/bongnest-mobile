import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Pressable,
  Text,
  View,
  type ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import { Plus } from "lucide-react-native";
import { useIsFocused } from "@react-navigation/native";

import { PropertyCard } from "@/components/PropertyCard";
import { useVideoFeedSuspension } from "@/contexts/VideoFeedSuspension";
import { supabase } from "@/lib/supabase";
import type { Property } from "@/types/property";

const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 65,
  minimumViewTime: 280,
};

export default function HomeScreen() {
  const pathname = usePathname();
  const isFocused = useIsFocused();
  const { suspended, suspend } = useVideoFeedSuspension();

  const onAddProperty = useCallback(() => {
    suspend();
    requestAnimationFrame(() => {
      router.push("/add-property");
    });
  }, [suspend]);

  /** Mount feed videos only on Home tab while no other route holds the decoder. */
  const reelVideosEnabled =
    isFocused &&
    !suspended &&
    !pathname?.includes("add-property");

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null); // always string id for stable === with item.id
  const firstFocus = useRef(true);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const rows = viewableItems.filter(
        (v) =>
          v.isViewable &&
          v.item != null &&
          typeof v.item === "object" &&
          "id" in v.item,
      ) as (ViewToken & { item: Property })[];
      if (rows.length === 0) return;
      // Stable "primary" cell: smallest list index among visible rows (topmost in data order).
      rows.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      const primary = rows[0]?.item;
      if (primary?.id != null) {
        setActiveId(String(primary.id));
      }
    },
  ).current;

  const fetchProperties = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("properties")
      .select("*");

    if (queryError) {
      setError(queryError.message);
      return;
    }

    setProperties((data as Property[]) ?? []);
    setError(null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (firstFocus.current) {
          setLoading(true);
          firstFocus.current = false;
        }
        await fetchProperties();
        if (!cancelled) {
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [fetchProperties]),
  );

  useEffect(() => {
    if (properties.length > 0 && activeId == null) {
      setActiveId(String(properties[0].id));
    }
  }, [properties, activeId]);

  useEffect(() => {
    if (!reelVideosEnabled) {
      setActiveId(null);
    }
  }, [reelVideosEnabled]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProperties();
    setRefreshing(false);
  }, [fetchProperties]);

  if (loading && properties.length === 0) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <ActivityIndicator size="large" color="#059669" />
        <Text className="mt-4 text-neutral-500 dark:text-neutral-400">
          Loading BongNest…
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top"]}
      className="flex-1 bg-neutral-50 dark:bg-neutral-950"
    >
      <FlatList
        data={properties}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <PropertyCard
            property={item}
            isActive={activeId != null && String(activeId) === String(item.id)}
            reelVideosEnabled={reelVideosEnabled}
          />
        )}
        ListHeaderComponent={
          <View className="px-6 pb-6 pt-3">
            <Text className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
              BongNest
            </Text>
            <Text className="mt-1.5 text-base leading-6 text-neutral-500 dark:text-neutral-400">
              Premium rentals, curated for you
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View className="items-center px-10 py-20">
            <Text className="text-center text-base leading-6 text-neutral-500 dark:text-neutral-400">
              {error ?? "No properties yet. Check back soon."}
            </Text>
          </View>
        }
        viewabilityConfig={VIEWABILITY_CONFIG}
        onViewableItemsChanged={onViewableItemsChanged}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#059669"
            colors={["#059669"]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          properties.length === 0
            ? { flexGrow: 1, paddingBottom: 32 }
            : { paddingBottom: 32 }
        }
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={4}
        // Video + Android: clipping subviews breaks players and decoder reuse.
        removeClippedSubviews={false}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add property"
        onPress={onAddProperty}
        className="absolute bottom-6 right-6 h-16 w-16 items-center justify-center rounded-3xl bg-emerald-600 shadow-2xl shadow-emerald-900/30 active:opacity-90"
      >
        <Plus size={28} color="#ffffff" strokeWidth={3} />
      </Pressable>
    </SafeAreaView>
  );
}
