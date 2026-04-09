import { BlurView } from "expo-blur";
import { Video, ResizeMode } from "expo-av";
import { Phone } from "lucide-react-native";
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

type PropertyCardProps = {
  property: Property;
  isActive: boolean;
  /** When false, do not mount expo-av Video (releases hardware decoder). */
  reelVideosEnabled: boolean;
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

export function PropertyCard({
  property,
  isActive,
  reelVideosEnabled,
}: PropertyCardProps) {
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

          {property.price_monthly != null && (
            <View className="absolute left-4 top-4 rounded-full bg-emerald-600 px-3.5 py-2 shadow-md shadow-emerald-900/30">
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

      <View className="gap-1.5 px-5 pb-3 pt-5">
        <Text
          className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50"
          numberOfLines={2}
        >
          {property.title}
        </Text>
        {(property.location ||
          property.area ||
          property.area_name) && (
          <Text
            className="text-base leading-6 text-neutral-500 dark:text-neutral-400"
            numberOfLines={2}
          >
            {[property.area_name, property.area, property.location]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        )}
        {property.description ? (
          <Text
            className="pt-1 text-sm leading-5 text-neutral-600 dark:text-neutral-400"
            numberOfLines={3}
          >
            {property.description}
          </Text>
        ) : null}
      </View>

      <View className="px-5 pb-6">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Connect for 99 rupees"
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
