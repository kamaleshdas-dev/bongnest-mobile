import { ResizeMode, Video } from "expo-av";
import { BlurView } from "expo-blur";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Home, IndianRupee, Upload } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "@/lib/supabase";

type PickedVideo = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  duration?: number | null;
};

function getSafeFileExt(mimeType?: string | null, fileName?: string | null) {
  const fromName = fileName?.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  if (!mimeType) return "mp4";
  if (mimeType.includes("quicktime")) return "mov";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("webm")) return "webm";
  return "mp4";
}

function makeObjectPath(ext: string) {
  const rand = Math.random().toString(16).slice(2);
  return `uploads/${Date.now()}-${rand}.${ext}`;
}

async function uriToBytes(uri: string): Promise<Uint8Array> {
  // Avoid Blob: some RN runtimes can't create Blobs from ArrayBuffers.
  // expo-file-system's File.bytes() is stable for file:// and content:// URIs.
  const file = new File(uri);
  const bytes = await file.bytes();
  return bytes as unknown as Uint8Array;
}

export default function AddPropertyScreen() {
  const videoRef = useRef<Video | null>(null);

  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [title, setTitle] = useState("");
  const [areaName, setAreaName] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const priceNumber = useMemo(() => {
    const n = Number(monthlyPrice);
    return Number.isFinite(n) ? n : NaN;
  }, [monthlyPrice]);

  const canSubmit =
    !submitting &&
    Boolean(video?.uri) &&
    title.trim().length >= 3 &&
    areaName.trim().length >= 2 &&
    ownerPhone.trim().length >= 8 &&
    Number.isFinite(priceNumber) &&
    priceNumber > 0;

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission needed",
        "Allow photo library access to pick a video.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
      videoMaxDuration: 30,
    });

    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;

    setVideo({
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      duration: asset.duration,
    });
  };

  const recordVideo = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission needed",
        "Allow camera access to record a video.",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
      videoMaxDuration: 30,
    });

    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;

    setVideo({
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      duration: asset.duration,
    });
  };

  const submit = async () => {
    if (!video?.uri) {
      Alert.alert("Missing video", "Please select or record a property video.");
      return;
    }

    if (!canSubmit) {
      Alert.alert(
        "Incomplete",
        "Please fill all fields correctly before submitting.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (userError || !userId) {
        Alert.alert("Login required", "Please log in first to add a property.");
        return;
      }

      const ext = getSafeFileExt(video.mimeType, video.fileName);
      const objectPath = makeObjectPath(ext);
      const contentType =
        video.mimeType ??
        (ext === "mov"
          ? "video/quicktime"
          : ext === "webm"
            ? "video/webm"
            : "video/mp4");

      const bytes = await uriToBytes(video.uri);

      const { error: uploadError } = await supabase.storage
        .from("property-videos")
        .upload(objectPath, bytes, {
          cacheControl: "3600",
          contentType,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("property-videos")
        .getPublicUrl(objectPath);

      const publicUrl = publicUrlData?.publicUrl;
      if (!publicUrl) {
        throw new Error(
          "Could not generate a public URL for the uploaded video.",
        );
      }

      const payload = {
        title: title.trim(),
        area_name: areaName.trim(),
        price_monthly: Math.round(priceNumber),
        owner_id: userId,
        owner_phone: ownerPhone.trim(),
        video_url: publicUrl,
      };

      const { error: insertError } = await supabase
        .from("properties")
        .insert(payload);
      if (insertError) throw insertError;

      Alert.alert("Uploaded", "Your property is live on BongNest.");
      setVideo(null);
      setTitle("");
      setAreaName("");
      setMonthlyPrice("");
      setOwnerPhone("");
      router.back();
    } catch (e: any) {
      Alert.alert("Upload failed", e?.message ?? "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-950">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={110}
      >
        <Pressable
          className="flex-1"
          onPress={Keyboard.dismiss}
          accessible={false}
        >
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-5 pb-10"
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            <View className="flex-row items-center justify-between pt-2">
              <View>
                <Text className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  Add Property
                </Text>
                <Text className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  Upload a short video tour (≤ 30s)
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go to Home"
                onPress={() => router.replace("/(tabs)")}
                className="h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-md shadow-black/10 active:opacity-80 dark:bg-neutral-900"
              >
                <Home size={20} color="#0f172a" />
              </Pressable>
            </View>

            <View className="mt-6 overflow-hidden rounded-3xl bg-white shadow-xl shadow-black/10 dark:bg-neutral-900">
              <View className="relative w-full overflow-hidden rounded-t-[1.5rem] bg-neutral-100 dark:bg-neutral-800">
                <View style={{ aspectRatio: 16 / 10 }} className="w-full">
                  {video?.uri ? (
                    <Video
                      ref={(r) => {
                        videoRef.current = r;
                      }}
                      source={{ uri: video.uri }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay
                      isMuted
                      isLooping
                      useNativeControls
                    />
                  ) : (
                    <View className="flex-1 items-center justify-center px-8">
                      <Text className="text-center text-base font-medium text-neutral-800 dark:text-neutral-100">
                        Add a video tour
                      </Text>
                      <Text className="mt-1.5 text-center text-sm leading-5 text-neutral-500 dark:text-neutral-400">
                        This makes listings feel premium and boosts conversions.
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View className="gap-3 px-5 py-5">
                <View className="flex-row gap-3">
                  <Pressable
                    onPress={pickFromLibrary}
                    disabled={submitting}
                    className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 shadow-lg shadow-emerald-900/20 active:opacity-90 disabled:opacity-60"
                  >
                    <Upload size={18} color="#ffffff" />
                    <Text className="text-base font-semibold text-white">
                      Choose Video
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={recordVideo}
                    disabled={submitting}
                    className="flex-1 items-center justify-center rounded-2xl bg-neutral-900 py-3.5 shadow-lg shadow-black/20 active:opacity-90 disabled:opacity-60 dark:bg-neutral-800"
                  >
                    <Text className="text-base font-semibold text-white">
                      Record (30s)
                    </Text>
                  </Pressable>
                </View>

                <View className="gap-4 pt-2">
                  <View>
                    <Text className="mb-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                      Title
                    </Text>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      placeholder="2BHK with balcony"
                      placeholderTextColor="#94a3b8"
                      className="rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 text-base text-neutral-900 shadow-sm shadow-black/5 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                      returnKeyType="next"
                    />
                  </View>

                  <View>
                    <Text className="mb-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                      Area Name
                    </Text>
                    <TextInput
                      value={areaName}
                      onChangeText={setAreaName}
                      placeholder="New Town"
                      placeholderTextColor="#94a3b8"
                      className="rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 text-base text-neutral-900 shadow-sm shadow-black/5 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                      returnKeyType="next"
                    />
                  </View>

                  <View>
                    <Text className="mb-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                      Monthly Price
                    </Text>
                    <View className="flex-row items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 shadow-sm shadow-black/5 dark:border-neutral-800 dark:bg-neutral-950">
                      <IndianRupee size={18} color="#059669" />
                      <TextInput
                        value={monthlyPrice}
                        onChangeText={setMonthlyPrice}
                        placeholder="25000"
                        placeholderTextColor="#94a3b8"
                        keyboardType={
                          Platform.OS === "ios" ? "number-pad" : "numeric"
                        }
                        className="flex-1 text-base text-neutral-900 dark:text-white"
                        returnKeyType="next"
                      />
                    </View>
                  </View>

                  <View>
                    <Text className="mb-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                      Owner Phone
                    </Text>
                    <TextInput
                      value={ownerPhone}
                      onChangeText={setOwnerPhone}
                      placeholder="9876543210"
                      placeholderTextColor="#94a3b8"
                      keyboardType="phone-pad"
                      className="rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 text-base text-neutral-900 shadow-sm shadow-black/5 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                      returnKeyType="done"
                    />
                  </View>
                </View>

                <Pressable
                  onPress={submit}
                  disabled={!canSubmit}
                  className="mt-3 items-center justify-center rounded-2xl bg-emerald-600 py-4 shadow-xl shadow-emerald-900/25 active:opacity-90 disabled:opacity-50"
                >
                  <Text className="text-lg font-semibold text-white">
                    Submit Listing
                  </Text>
                </Pressable>

                <Text className="pt-1 text-center text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  Tip: keep the first 2 seconds crisp—users decide fast.
                </Text>
              </View>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        </Pressable>

        {submitting && (
          <View className="absolute inset-0">
            <BlurView
              intensity={Platform.OS === "ios" ? 55 : 40}
              tint="light"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
              }}
            />
            <View className="flex-1 items-center justify-center px-10">
              <View className="w-full max-w-[360px] rounded-3xl bg-white/90 p-6 shadow-2xl shadow-black/20">
                <ActivityIndicator size="large" color="#059669" />
                <Text className="mt-4 text-center text-base font-semibold text-neutral-900">
                  Uploading video…
                </Text>
                <Text className="mt-1 text-center text-sm leading-5 text-neutral-600">
                  Please keep the app open while we publish your listing.
                </Text>
              </View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
