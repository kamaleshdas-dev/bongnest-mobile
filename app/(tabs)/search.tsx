import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { MapPin, Search as SearchIcon } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ListRenderItem,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PropertyCard } from "@/components/PropertyCard";
import { useVideoFeedSuspension } from "@/contexts/VideoFeedSuspension";
import { supabase } from "@/lib/supabase";
import type { Property } from "@/types/property";

const QUICK_AREAS = ["New Town", "Salt Lake", "Sector V", "Garia"] as const;
const NUM_COLUMNS = 2;
const HORIZONTAL_PAD = 16;
const COLUMN_GAP = 12;

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

const GridItem = memo(function GridItem({ item }: { item: Property }) {
  return (
    <View className="min-w-0 flex-1 px-0.5">
      <PropertyCard
        property={item}
        isActive={false}
        reelVideosEnabled={false}
        variant="grid"
      />
    </View>
  );
});

type SearchListHeaderProps = {
  query: string;
  onQueryChange: (q: string) => void;
  selectedArea: string | null;
  onToggleArea: (area: string) => void;
  showInitialLoading: boolean;
};

function SearchListHeader({
  query,
  onQueryChange,
  selectedArea,
  onToggleArea,
  showInitialLoading,
}: SearchListHeaderProps) {
  return (
    <View className="pb-1">
      <Text className="text-3xl font-bold tracking-tight text-white">
        Search
      </Text>
      <Text className="mt-1 text-sm text-white/55">
        Find rentals by area or keyword
      </Text>

      <View className="mt-5 flex-row items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-3.5 shadow-xl shadow-black/40">
        <SearchIcon size={22} color="#a7f3d0" />
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search by title or area…"
          placeholderTextColor="rgba(255,255,255,0.35)"
          className="flex-1 text-base text-white"
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View className="mt-4">
        <Text className="mb-2 pl-0.5 text-xs font-semibold uppercase tracking-widest text-white/45">
          Quick filters
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexDirection: "row",
            gap: 8,
            paddingBottom: 4,
          }}
        >
          {QUICK_AREAS.map((area) => {
            const active = selectedArea === area;
            return (
              <Pressable
                key={area}
                onPress={() => onToggleArea(area)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                className={`flex-row items-center gap-1.5 rounded-full border px-4 py-2.5 ${
                  active
                    ? "border-emerald-400/60 bg-emerald-500/20"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <MapPin
                  size={14}
                  color={active ? "#a7f3d0" : "rgba(255,255,255,0.45)"}
                />
                <Text
                  className={`text-sm font-semibold ${
                    active ? "text-emerald-100" : "text-white/80"
                  }`}
                >
                  {area}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {showInitialLoading ? (
        <View className="mt-12 items-center py-8">
          <ActivityIndicator size="large" color="#34d399" />
          <Text className="mt-3 text-sm text-white/45">Loading listings…</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function SearchScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const { suspend, resume } = useVideoFeedSuspension();

  const [query, setQuery] = useState("");
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebouncedValue(query.trim(), 320);

  useFocusEffect(
    useCallback(() => {
      suspend();
      return () => {
        resume();
      };
    }, [suspend, resume]),
  );

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let q = supabase.from("properties").select("*");

      if (selectedArea) {
        q = q.ilike("area_name", `%${selectedArea}%`);
      }

      if (debouncedQuery.length > 0) {
        const safe = debouncedQuery.replace(/[%*,]/g, " ").trim();
        if (safe.length > 0) {
          q = q.or(`title.ilike.%${safe}%,area_name.ilike.%${safe}%`);
        }
      }

      const { data, error: qErr } = await q.order("id", { ascending: false });

      if (qErr) {
        setError(qErr.message);
        setProperties([]);
        return;
      }

      setProperties((data as Property[]) ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Search failed.");
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, selectedArea]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const onToggleArea = useCallback((area: string) => {
    setSelectedArea((prev) => (prev === area ? null : area));
  }, []);

  const listEmptyCopy = useMemo(() => {
    if (error) return error;
    if (debouncedQuery || selectedArea) {
      return "No listings match. Try another area or keyword.";
    }
    return "Search or pick an area to explore listings.";
  }, [error, debouncedQuery, selectedArea]);

  const innerWidth = windowWidth - HORIZONTAL_PAD * 2;
  const columnWidth = (innerWidth - COLUMN_GAP) / NUM_COLUMNS;
  const rowHeight = columnWidth * (4 / 3) + 88;

  const getItemLayout = useCallback(
    (_data: ArrayLike<Property> | null | undefined, index: number) => ({
      length: rowHeight,
      offset: rowHeight * Math.floor(index / NUM_COLUMNS),
      index,
    }),
    [rowHeight],
  );

  const renderItem: ListRenderItem<Property> = useCallback(
    ({ item }) => <GridItem item={item} />,
    [],
  );

  const showInitialLoading = loading && properties.length === 0;

  const listHeader = useMemo(
    () => (
      <SearchListHeader
        query={query}
        onQueryChange={setQuery}
        selectedArea={selectedArea}
        onToggleArea={onToggleArea}
        showInitialLoading={showInitialLoading}
      />
    ),
    [
      query,
      selectedArea,
      onToggleArea,
      showInitialLoading,
    ],
  );

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={["top"]}>
      <LinearGradient
        colors={["#020617", "#0b1220", "#020617"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />

      <FlatList
        data={properties}
        keyExtractor={(item) => String(item.id)}
        numColumns={NUM_COLUMNS}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={Keyboard.dismiss}
        columnWrapperStyle={
          properties.length > 0
            ? { gap: COLUMN_GAP, marginBottom: 0 }
            : undefined
        }
        contentContainerStyle={{
          paddingHorizontal: HORIZONTAL_PAD,
          paddingTop: 8,
          paddingBottom: 100,
          flexGrow: 1,
        }}
        ListEmptyComponent={
          !loading ? (
            <View className="mt-8 items-center px-4">
              <Text className="text-center text-sm leading-6 text-white/50">
                {listEmptyCopy}
              </Text>
            </View>
          ) : null
        }
        getItemLayout={properties.length > 0 ? getItemLayout : undefined}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
        updateCellsBatchingPeriod={50}
      />
    </SafeAreaView>
  );
}
