import { BlurView } from "expo-blur";
import { Video, ResizeMode } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { router, type Href } from "expo-router";
import { Film, Phone } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getPlayablePropertyVideoUrl } from "@/lib/propertyVideo";
import type { Property } from "@/types/property";
import { formatMonthlyRent } from "@/lib/formatInr";

export type PropertyCardProps = {
  property: Property;
  isActive: boolean;
  /** When false, do not mount expo-av Video (releases hardware decoder). */
  reelVideosEnabled: boolean;
  /**
   * `feed` — full reel card with video playback when active.
   * `grid` — compact card with static thumbnail only (no Video; saves memory).
   */
  variant?: "feed" | "grid";
};

function VideoLoadingOverlay() {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View className="absolute inset-0 overflow-hidden rounded-t-[1.5rem]">
      <BlurView
        intensity={Platform.OS === "ios" ? 55 : 40}
        tint="light"
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: pulse,
            backgroundColor: "rgba(255,255,255,0.35)",
          },
        ]}
      />
      <View className="absolute inset-0 items-center justify-center gap-4 px-8">
        <View className="h-4 w-full max-w-[220px] rounded-full bg-neutral-300/80" />
        <View className="h-4 w-full max-w-[160px] rounded-full bg-neutral-300/60" />
        <View className="mt-2 h-12 w-12 rounded-full border border-white/60 bg-white/25" />
        <ActivityIndicator size="large" color="#059669" />
      </View>
    </View>
  );
}

function areaLine(property: Property) {
  return [property.area_name, property.area, property.location]
    .filter(Boolean)
    .join(" · ");
}

function openPropertyDetail(propertyId: string) {
  router.push(`/(property)/${propertyId}` as Href);
}

export function PropertyCard(props: PropertyCardProps) {
  if (props.variant === "grid") {
    return <PropertyCardGrid property={props.property} />;
  }
  return (
    <PropertyCardFeed
      property={props.property}
      isActive={props.isActive}
      reelVideosEnabled={props.reelVideosEnabled}
    />
  );
}

function PropertyCardGrid({ property }: { property: Property }) {
  const priceLabel = formatMonthlyRent(property.price_monthly);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${property.title}`}
      onPress={() => openPropertyDetail(property.id)}
      className="mb-4 flex-1 overflow-hidden rounded-3xl border border-white/10 bg-neutral-900/80 shadow-lg shadow-black/30 active:opacity-92"
    >
      <View className="relative aspect-[3/4] w-full overflow-hidden rounded-t-3xl bg-neutral-800">
        <LinearGradient
          colors={["#0f172a", "#1e293b", "#0f172a"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View className="absolute inset-0 items-center justify-center">
          <Film size={36} color="rgba(167,243,208,0.45)" strokeWidth={1.5} />
          <Text className="mt-2 text-[11px] font-medium uppercase tracking-widest text-white/35">
            Preview
          </Text>
        </View>
        {property.price_monthly != null && (
          <View className="absolute left-2 top-2 rounded-full bg-emerald-600 px-2.5 py-1 shadow-md shadow-emerald-900/40">
            <Text
              className="text-[11px] font-bold text-white"
              numberOfLines={1}
            >
              {priceLabel}
            </Text>
          </View>
        )}
      </View>
      <View className="gap-1 px-3 pb-3 pt-2.5">
        <Text
          className="text-sm font-semibold leading-5 text-white"
          numberOfLines={2}
        >
          {property.title}
        </Text>
        {areaLine(property) ? (
          <Text className="text-xs text-white/45" numberOfLines={1}>
            {areaLine(property)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function PropertyCardFeed({
  property,
  isActive,
  reelVideosEnabled,
}: Omit<PropertyCardProps, "variant">) {
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);

  const displayUri =
    resolvedUri ?? property.video_url?.trim() ?? null;
  const showVideo = Boolean(displayUri);

  useEffect(() => {
    let cancelled = false;

    if (!isActive || !reelVideosEnabled) {
      setResolvedUri(null);
      setVideoReady(false);
      setVideoError(false);
      return () => {
        cancelled = true;
      };
    }

    setResolvedUri(null);
    setVideoReady(false);
    setVideoError(false);

    (async () => {
      const uri = await getPlayablePropertyVideoUrl(property);
      if (!cancelled) {
        setResolvedUri(uri);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    property.id,
    property.video_url,
    property.video_storage_path,
    isActive,
    reelVideosEnabled,
  ]);

  useEffect(() => {
    setVideoReady(false);
    setVideoError(false);
  }, [property.id, displayUri, isActive]);

  useEffect(() => {
    if (!reelVideosEnabled) {
      setVideoReady(false);
    }
  }, [reelVideosEnabled]);

  const priceLabel = formatMonthlyRent(property.price_monthly);
  const goDetail = () => openPropertyDetail(property.id);

  return (
    <View className="mx-4 mb-8 overflow-hidden rounded-3xl bg-white shadow-xl shadow-black/10 dark:bg-neutral-900">
      <View className="relative w-full overflow-hidden rounded-t-[1.5rem] bg-neutral-100 dark:bg-neutral-800">
        <View style={{ aspectRatio: 3 / 4 }} className="w-full">
          {showVideo && !videoError ? (
            <>
              {reelVideosEnabled && isActive && displayUri ? (
                <>
                  {!videoReady && <VideoLoadingOverlay />}
                  <Video
                    key={`${property.id}-${displayUri}`}
                    source={{ uri: displayUri }}
                    style={[
                      StyleSheet.absoluteFill,
                      { opacity: videoReady ? 1 : 0 },
                    ]}
                    resizeMode={ResizeMode.COVER}
                    isLooping
                    isMuted
                    shouldPlay
                    useNativeControls={false}
                    onReadyForDisplay={() => setVideoReady(true)}
                    onError={() => setVideoError(true)}
                  />
                </>
              ) : reelVideosEnabled && showVideo ? (
                <View className="flex-1 items-center justify-center bg-neutral-800 dark:bg-neutral-900">
                  <Text className="text-center text-sm text-white/45">
                    Scroll to play
                  </Text>
                </View>
              ) : (
                <View className="flex-1 items-center justify-center bg-neutral-900/90">
                  <Text className="text-center text-sm text-white/50">
                    Feed paused
                  </Text>
                </View>
              )}
            </>
          ) : showVideo && videoError ? (
            <View className="flex-1 items-center justify-center bg-neutral-200 px-6 dark:bg-neutral-700">
              <Text className="text-center text-neutral-600 dark:text-neutral-300">
                Video unavailable
              </Text>
            </View>
          ) : (
            <View className="flex-1 items-center justify-center bg-neutral-200 dark:bg-neutral-700">
              <Text className="text-center text-neutral-500 dark:text-neutral-400">
                No video for this listing
              </Text>
            </View>
          )}

          <Pressable
            onPress={goDetail}
            accessibilityRole="button"
            accessibilityLabel={`Open ${property.title}`}
            className="absolute inset-0 z-[1]"
          />

          {property.price_monthly != null && (
            <View
              pointerEvents="none"
              className="absolute left-4 top-4 z-[2] rounded-full bg-emerald-600 px-3.5 py-2 shadow-md shadow-emerald-900/30"
            >
              <Text
                className="text-sm font-semibold text-white"
                numberOfLines={1}
              >
                {priceLabel}
              </Text>
            </View>
          )}
        </View>
      </View>

      <Pressable
        onPress={goDetail}
        accessibilityRole="button"
        accessibilityLabel={`Open ${property.title}`}
        className="gap-1.5 px-5 pb-3 pt-5 active:opacity-90"
      >
        <Text
          className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50"
          numberOfLines={2}
        >
          {property.title}
        </Text>
        {areaLine(property) ? (
          <Text
            className="text-base leading-6 text-neutral-500 dark:text-neutral-400"
            numberOfLines={2}
          >
            {areaLine(property)}
          </Text>
        ) : null}
        {property.description ? (
          <Text
            className="pt-1 text-sm leading-5 text-neutral-600 dark:text-neutral-400"
            numberOfLines={3}
          >
            {property.description}
          </Text>
        ) : null}
      </Pressable>

      <View className="px-5 pb-6">
        <Pressable
          onPress={goDetail}
          accessibilityRole="button"
          accessibilityLabel="Connect for 99 rupees, open listing"
          className="flex-row items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 py-4 shadow-lg shadow-emerald-900/25 active:opacity-90 dark:bg-emerald-500"
        >
          <Phone size={22} color="#ffffff" strokeWidth={2.5} />
          <Text className="text-lg font-semibold text-white">
            Connect for ₹99
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
