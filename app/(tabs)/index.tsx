import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  Pressable,
  Text,
  View,
  type ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Plus } from "lucide-react-native";

import { PropertyCard } from "@/components/PropertyCard";
import { supabase } from "@/lib/supabase";
import type { Property } from "@/types/property";

const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 65,
  minimumViewTime: 280,
};

export default function HomeScreen() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      const item = first?.item as Property | undefined;
      if (item?.id) {
        setActiveId(item.id);
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await fetchProperties();
      if (!cancelled) {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchProperties]);

  useEffect(() => {
    if (properties.length > 0 && activeId == null) {
      setActiveId(properties[0].id);
    }
  }, [properties, activeId]);

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
          <PropertyCard property={item} isActive={activeId === item.id} />
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
        removeClippedSubviews={Platform.OS === "android"}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add property"
        onPress={() => router.push("/add-property")}
        className="absolute bottom-6 right-6 h-16 w-16 items-center justify-center rounded-3xl bg-emerald-600 shadow-2xl shadow-emerald-900/30 active:opacity-90"
      >
        <Plus size={28} color="#ffffff" strokeWidth={3} />
      </Pressable>
    </SafeAreaView>
  );
}
