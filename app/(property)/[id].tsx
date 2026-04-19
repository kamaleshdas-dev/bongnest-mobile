import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { ResizeMode, Video } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, Film, MapPin, PhoneCall, Share2, X } from "lucide-react-native";
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import {
  CONNECT_UNLOCK_FEE_PAISE,
  getRazorpayKeyId,
  RAZORPAY_CHECKOUT_DESCRIPTION,
  RAZORPAY_MERCHANT_NAME,
} from "@/lib/razorpayConfig";
import {
  getPlayablePropertyVideoUrl,
  isSupabasePublicObjectVideoUrl,
} from "@/lib/propertyVideo";
import { supabase } from "@/lib/supabase";
import type { Property } from "@/types/property";

function areaLine(property: Property) {
  return [property.area_name, property.area, property.location]
    .filter(Boolean)
    .join(" · ");
}

function parseRazorpayFailure(err: unknown): { cancelled: boolean; message: string } {
  const e = err as {
    code?: string | number;
    description?: string;
    message?: string;
    error?: { description?: string };
  };
  const message =
    e?.description ??
    e?.error?.description ??
    e?.message ??
    (typeof err === "string" ? err : "Payment could not be completed.");
  const lower = String(message).toLowerCase();
  const code = e?.code;
  const cancelled =
    code === 0 ||
    code === "0" ||
    code === 2 ||
    code === "2" ||
    lower.includes("cancel") ||
    lower.includes("back") ||
    lower.includes("dismiss");
  return { cancelled, message: String(message) };
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
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

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
    setVideoReady(false);
    setVideoError(false);

    if (!property) {
      setPlayableUri(null);
      return;
    }

    if (!isFocused) {
      setPlayableUri(null);
      return;
    }

    const raw = property.video_url?.trim();
    if (!raw) {
      setPlayableUri(null);
      return;
    }

    if (isSupabasePublicObjectVideoUrl(raw)) {
      setPlayableUri(raw);
      return;
    }

    let cancelled = false;
    setPlayableUri(null);

    (async () => {
      const uri = await getPlayablePropertyVideoUrl(property);
      if (!cancelled) setPlayableUri(uri);
    })();

    return () => {
      cancelled = true;
    };
  }, [property, isFocused]);

  const priceLabel = property ? formatMonthlyRent(property.price_monthly) : "—";
  const area = property ? areaLine(property) : "";
  const ownerPhone = property?.owner_phone?.trim() || null;
  const shouldPlayVideo =
    isFocused && videoReady && Boolean(playableUri) && !videoError;

  const trimmedVideoUrl = property?.video_url?.trim() ?? "";
  const videoResolving =
    isFocused &&
    Boolean(trimmedVideoUrl) &&
    playableUri == null &&
    !videoError;

  const handlePayment = useCallback(async () => {
    const keyId = getRazorpayKeyId();
    if (!keyId) {
      Alert.alert(
        "Configuration required",
        "Add EXPO_PUBLIC_RAZORPAY_KEY_ID to your environment (e.g. rzp_test_… from the Razorpay dashboard), then restart Expo.",
      );
      return;
    }

    if (Platform.OS === "web") {
      Alert.alert(
        "Not available on web",
        "Open this screen in the BongNest iOS or Android app to complete payment.",
      );
      return;
    }

    if (paymentInProgress) return;
    setPaymentInProgress(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        Alert.alert("Sign in required", authError.message);
        return;
      }
      const user = authData.user;
      const meta = user?.user_metadata as
        | { full_name?: string; phone?: string }
        | undefined;

      const options: Record<string, unknown> = {
        description: RAZORPAY_CHECKOUT_DESCRIPTION,
        currency: "INR",
        key: keyId,
        amount: String(CONNECT_UNLOCK_FEE_PAISE),
        name: RAZORPAY_MERCHANT_NAME,
        prefill: {
          email: user?.email ?? "",
          contact: meta?.phone ?? "",
          name: meta?.full_name ?? user?.email?.split("@")[0] ?? "",
        },
        theme: { color: "#10b981" },
      };

      // Native module — require at runtime so Metro/web don't resolve it at load time.
      const RazorpayCheckout = require("react-native-razorpay")
        .default as typeof import("react-native-razorpay").default;

      await RazorpayCheckout.open(options);

      setIsUnlocked(true);
      setPaymentOpen(false);
    } catch (err: unknown) {
      const { cancelled, message } = parseRazorpayFailure(err);
      if (cancelled) {
        Alert.alert(
          "Payment cancelled",
          "No charge was made. You can try again when you're ready.",
        );
      } else {
        Alert.alert("Payment failed", message);
      }
    } finally {
      setPaymentInProgress(false);
    }
  }, [paymentInProgress]);

  const onCallOwner = useCallback(async () => {
    if (!ownerPhone) return;
    try {
      await Linking.openURL(`tel:${ownerPhone}`);
    } catch {
      /* ignore */
    }
  }, [ownerPhone]);

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

          {!isFocused ? (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-center text-sm text-white/40">
                Video paused while away
              </Text>
            </View>
          ) : videoResolving ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#34d399" />
            </View>
          ) : playableUri && !videoError ? (
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

          {isUnlocked && ownerPhone ? (
            <View className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4">
              <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
                Owner phone
              </Text>
              <Text className="mt-2 text-lg font-semibold text-white">
                {ownerPhone}
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
        {!isUnlocked ? (
          <Pressable
            onPress={() => setPaymentOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Connect for 99 rupees"
            className="items-center justify-center rounded-2xl bg-emerald-500 py-4 shadow-lg shadow-emerald-900/30 active:opacity-92"
          >
            <Text className="text-lg font-bold text-white">Connect for ₹99</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onCallOwner}
            disabled={!ownerPhone}
            accessibilityRole="button"
            accessibilityLabel="Call owner"
            className="flex-row items-center justify-center gap-3 rounded-2xl bg-white/10 py-4 active:opacity-92 disabled:opacity-50"
          >
            <PhoneCall size={22} color="#a7f3d0" strokeWidth={2.3} />
            <Text className="text-lg font-bold text-white">Call Owner</Text>
          </Pressable>
        )}
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
                Pay a one-time ₹99 connect fee via Razorpay. After a successful
                payment, the owner&apos;s phone number is unlocked so you can
                call them directly.
              </Text>
              <Pressable
                onPress={() => void handlePayment()}
                disabled={paymentInProgress}
                accessibilityRole="button"
                accessibilityLabel="Pay 99 rupees with Razorpay"
                className="mt-3 flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 active:opacity-90 disabled:opacity-60"
              >
                {paymentInProgress ? (
                  <ActivityIndicator color="#fff" />
                ) : null}
                <Text className="text-base font-bold text-white">
                  {paymentInProgress ? "Opening checkout…" : "Pay ₹99 with Razorpay"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
