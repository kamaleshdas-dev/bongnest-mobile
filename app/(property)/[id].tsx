import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { ResizeMode, Video } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, Film, MapPin, Share2, X } from "lucide-react-native";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatMonthlyRent } from "@/lib/formatInr";
import { getPlayablePropertyVideoUrl } from "@/lib/propertyVideo";
import { supabase } from "@/lib/supabase";
import type { Property } from "@/types/property";

function areaLine(property: Property) {
  return [property.area_name, property.area, property.location]
    .filter(Boolean)
    .join(" · ");
}

export default function PropertyDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = useMemo(
    () => (Array.isArray(rawId) ? rawId[0] : rawId) ?? "",
    [rawId],
  );

  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isFocused = useIsFocused();

  const [property, setProperty] = useState<Property | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playableUri, setPlayableUri] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const videoHeight = Math.min((winW * 16) / 9, winH * 0.68);
  const bottomBarSpace = 88 + insets.bottom;

  useFocusEffect(
    useCallback(() => {
      return () => setPaymentOpen(false);
    }, []),
  );

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setFetchError("Missing property id.");
      setProperty(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    (async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setFetchError(error.message);
        setProperty(null);
      } else if (!data) {
        setFetchError("This listing is no longer available.");
        setProperty(null);
      } else {
        setProperty(data as Property);
        setFetchError(null);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!property) {
      setPlayableUri(null);
      return;
    }
    let cancelled = false;
    setPlayableUri(null);
    setVideoReady(false);
    setVideoError(false);

    (async () => {
      const uri = await getPlayablePropertyVideoUrl(property);
      if (!cancelled) setPlayableUri(uri);
    })();

    return () => {
      cancelled = true;
    };
  }, [property]);

  const priceLabel = property ? formatMonthlyRent(property.price_monthly) : "—";
  const area = property ? areaLine(property) : "";
  const shouldPlayVideo =
    isFocused && videoReady && Boolean(playableUri) && !videoError;

  const onShare = useCallback(async () => {
    if (!property) return;
    try {
      const message = `${property.title}${area ? ` — ${area}` : ""}\n\nShared from BongNest`;
      await Share.share(
        Platform.OS === "ios"
          ? { message, title: property.title }
          : { message },
      );
    } catch {
      /* user dismissed */
    }
  }, [property, area]);

  if (!id) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-950 px-6">
        <StatusBar style="light" />
        <Text className="text-center text-base text-white/60">
          Invalid link.
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-6 rounded-full bg-white/10 px-5 py-3 active:opacity-80"
        >
          <Text className="font-semibold text-white">Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-950">
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#34d399" />
        <Text className="mt-4 text-sm text-white/45">Loading listing…</Text>
      </View>
    );
  }

  if (fetchError || !property) {
    return (
      <View className="flex-1 bg-neutral-950 px-6 pt-4">
        <StatusBar style="light" />
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="mb-8 h-11 w-11 items-center justify-center self-start rounded-full bg-white/10 active:opacity-80"
          style={{ marginTop: insets.top + 4 }}
        >
          <ArrowLeft size={22} color="#fff" strokeWidth={2.2} />
        </Pressable>
        <Text className="text-center text-base leading-6 text-white/70">
          {fetchError ?? "Something went wrong."}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-neutral-950">
      <StatusBar style="light" />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: bottomBarSpace }}
      >
        <View style={{ width: winW, height: videoHeight }} className="relative bg-black">
          <LinearGradient
            colors={["#0f172a", "#1e293b", "#0f172a"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {playableUri && !videoError ? (
            <Video
              key={`${property.id}-${playableUri}`}
              source={{ uri: playableUri }}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.COVER}
              isLooping
              isMuted
              shouldPlay={shouldPlayVideo}
              useNativeControls={false}
              onReadyForDisplay={() => setVideoReady(true)}
              onError={() => setVideoError(true)}
            />
          ) : playableUri && videoError ? (
            <View className="flex-1 items-center justify-center px-8">
              <Text className="text-center text-white/55">
                Video unavailable
              </Text>
            </View>
          ) : (
            <View className="flex-1 items-center justify-center gap-2">
              <Film size={40} color="rgba(167,243,208,0.4)" strokeWidth={1.5} />
              <Text className="text-sm text-white/40">No video for this listing</Text>
            </View>
          )}

          <LinearGradient
            colors={["rgba(0,0,0,0.55)", "transparent", "rgba(0,0,0,0.35)"]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <View
            pointerEvents="box-none"
            className="absolute left-0 right-0 top-0 flex-row items-start justify-between px-4"
            style={{ paddingTop: insets.top + 10 }}
          >
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              className="active:opacity-85"
            >
              <View className="relative h-11 w-11 overflow-hidden rounded-full border border-white/15">
                <BlurView
                  intensity={Platform.OS === "ios" ? 48 : 36}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
                <View className="absolute inset-0 items-center justify-center bg-black/25">
                  <ArrowLeft size={22} color="#fff" strokeWidth={2.2} />
                </View>
              </View>
            </Pressable>

            <Pressable
              onPress={onShare}
              accessibilityRole="button"
              accessibilityLabel="Share listing"
              className="active:opacity-85"
            >
              <View className="relative h-11 w-11 overflow-hidden rounded-full border border-white/15">
                <BlurView
                  intensity={Platform.OS === "ios" ? 48 : 36}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
                <View className="absolute inset-0 items-center justify-center bg-black/25">
                  <Share2 size={20} color="#fff" strokeWidth={2.2} />
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        <View className="px-5 pt-7">
          <Text
            className="text-4xl font-bold tracking-tight text-emerald-400"
            numberOfLines={2}
          >
            {priceLabel}
          </Text>

          <Text
            className="mt-4 text-2xl font-semibold leading-8 tracking-tight text-white"
            numberOfLines={3}
          >
            {property.title}
          </Text>

          {area ? (
            <View className="mt-3 flex-row items-start gap-2">
              <MapPin
                size={18}
                color="rgba(255,255,255,0.45)"
                strokeWidth={2}
                style={{ marginTop: 2 }}
              />
              <Text className="flex-1 text-base leading-6 text-white/55">
                {area}
              </Text>
            </View>
          ) : null}

          <View className="mt-10 border-t border-white/10 pt-8">
            <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">
              About this place
            </Text>
            {property.description?.trim() ? (
              <Text className="mt-3 text-base leading-7 text-white/70">
                {property.description.trim()}
              </Text>
            ) : (
              <Text className="mt-3 text-base leading-7 text-white/40">
                The host has not added a description yet.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-neutral-950/95 px-5 pt-3"
        style={{
          paddingBottom: Math.max(insets.bottom, 12) + 8,
        }}
      >
        <Pressable
          onPress={() => setPaymentOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Connect for 99 rupees"
          className="items-center justify-center rounded-2xl bg-emerald-500 py-4 shadow-lg shadow-emerald-900/30 active:opacity-92"
        >
          <Text className="text-lg font-bold text-white">Connect for ₹99</Text>
        </Pressable>
      </View>

      <Modal
        visible={paymentOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPaymentOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <Pressable
            className="absolute inset-0"
            accessibilityLabel="Dismiss"
            onPress={() => setPaymentOpen(false)}
          />
          <View
            className="relative z-10 mx-4 overflow-hidden rounded-3xl border border-white/10 bg-neutral-900"
            style={{ marginBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="flex-row items-center justify-between border-b border-white/10 px-5 py-4">
              <Text className="text-lg font-semibold text-white">
                Razorpay
              </Text>
              <Pressable
                onPress={() => setPaymentOpen(false)}
                hitSlop={12}
                className="h-9 w-9 items-center justify-center rounded-full bg-white/10 active:opacity-80"
              >
                <X size={20} color="#fff" />
              </Pressable>
            </View>
            <View className="gap-3 px-5 py-6">
              <Text className="text-base leading-6 text-white/75">
                Checkout will open here. Razorpay payment integration is coming
                next — you'll be able to complete a secure ₹99 connect fee
                in one tap.
              </Text>
              <View className="mt-2 rounded-2xl border border-dashed border-emerald-500/40 bg-emerald-500/10 px-4 py-5">
                <Text className="text-center text-sm font-medium text-emerald-200/90">
                  Placeholder: Razorpay SDK / hosted checkout
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
