import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
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

import { PropertyCard } from "@/components/PropertyCard";
import { useVideoFeedSuspension } from "@/contexts/VideoFeedSuspension";
import { supabase } from "@/lib/supabase";
import type { PropertyFeedItem } from "@/types/property";

const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 65,
  minimumViewTime: 280,
};

/** Lean projection for feed cards + video resolution (no description / owner_phone). */
const FEED_COLUMNS =
  "id,title,video_url,video_storage_path,price_monthly,area_name,created_at" as const;

const FEED_PAGE_SIZE = 15;

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

  const [properties, setProperties] = useState<PropertyFeedItem[]>([]);
  const propertiesRef = useRef<PropertyFeedItem[]>([]);
  useEffect(() => {
    propertiesRef.current = properties;
  }, [properties]);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  const feedBootstrappedRef = useRef(false);
  const fetchInFlightRef = useRef(false);

  const fetchFeedPage = useCallback(
    async (opts: { reset: boolean }) => {
      if (fetchInFlightRef.current) return;
      const offset = opts.reset ? 0 : propertiesRef.current.length;
      if (!opts.reset && !hasMore) return;

      fetchInFlightRef.current = true;
      if (opts.reset) {
        setLoading(true);
        setError(null);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const { data, error: queryError } = await supabase
          .from("properties")
          .select(FEED_COLUMNS)
          .order("created_at", { ascending: false })
          .range(offset, offset + FEED_PAGE_SIZE - 1);

        if (queryError) {
          setError(queryError.message);
          if (opts.reset) setProperties([]);
          setHasMore(false);
          return;
        }

        const rows = (data as PropertyFeedItem[]) ?? [];
        setError(null);
        setHasMore(rows.length === FEED_PAGE_SIZE);

        if (opts.reset) {
          setProperties(rows);
        } else {
          setProperties((prev) => [...prev, ...rows]);
        }
      } finally {
        fetchInFlightRef.current = false;
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [hasMore],
  );

  useFocusEffect(
    useCallback(() => {
      if (feedBootstrappedRef.current) {
        return;
      }
      feedBootstrappedRef.current = true;
      void fetchFeedPage({ reset: true });
    }, [fetchFeedPage]),
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

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const rows = viewableItems.filter(
        (v) =>
          v.isViewable &&
          v.item != null &&
          typeof v.item === "object" &&
          "id" in v.item,
      ) as (ViewToken & { item: PropertyFeedItem })[];
      if (rows.length === 0) return;
      rows.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      const primary = rows[0]?.item;
      if (primary?.id != null) {
        setActiveId(String(primary.id));
      }
    },
  ).current;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setHasMore(true);
    await fetchFeedPage({ reset: true });
  }, [fetchFeedPage]);

  const onEndReached = useCallback(() => {
    if (loading || loadingMore || refreshing || !hasMore) return;
    void fetchFeedPage({ reset: false });
  }, [loading, loadingMore, refreshing, hasMore, fetchFeedPage]);

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
        ListFooterComponent={
          loadingMore ? (
            <View className="py-6">
              <ActivityIndicator color="#059669" />
            </View>
          ) : null
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
        onEndReached={onEndReached}
        onEndReachedThreshold={0.35}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          properties.length === 0
            ? { flexGrow: 1, paddingBottom: 32 }
            : { paddingBottom: 32 }
        }
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={4}
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
