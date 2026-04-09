import { LinearGradient } from "expo-linear-gradient";
import { LogOut, User } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "@/lib/supabase";

export default function ProfileScreen() {
  const [email, setEmail] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const loadUser = useCallback(async () => {
    setLoadingUser(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        Alert.alert("Could not load profile", error.message);
        setEmail(null);
        return;
      }
      setEmail(data.user?.email ?? null);
    } finally {
      setLoadingUser(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const onLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        Alert.alert("Logout failed", error.message);
      }
      // Root layout handles redirect to login.
    } catch (e: any) {
      Alert.alert("Logout failed", e?.message ?? "Something went wrong.");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-950">
      <LinearGradient
        colors={["#020617", "#050b18", "#020617"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />

      <View className="px-6 pt-4">
        <Text className="text-3xl font-bold tracking-tight text-white">
          Profile
        </Text>
        <Text className="mt-1 text-sm text-white/60">
          Your BongNest account
        </Text>
      </View>

      <View className="mt-6 gap-4 px-6">
        <View className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/40">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-3xl bg-emerald-500/10">
              <User size={22} color="#a7f3d0" />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-semibold tracking-widest text-white/50">
                EMAIL
              </Text>
              {loadingUser ? (
                <View className="mt-2 flex-row items-center gap-2">
                  <ActivityIndicator color="#10b981" />
                  <Text className="text-sm text-white/60">Loading…</Text>
                </View>
              ) : (
                <Text className="mt-1 text-base font-semibold text-white">
                  {email ?? "—"}
                </Text>
              )}
            </View>
          </View>
        </View>

        <View className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/40">
          <Text className="text-lg font-semibold text-white">My Listings</Text>
          <Text className="mt-1 text-sm leading-6 text-white/60">
            We’ll show your posted properties here soon.
          </Text>
          <View className="mt-4 h-24 rounded-3xl bg-black/20" />
        </View>

        <Pressable
          onPress={onLogout}
          disabled={signingOut}
          className="flex-row items-center justify-center gap-2 rounded-3xl bg-white/10 py-4 shadow-xl shadow-black/30 active:opacity-90 disabled:opacity-50"
        >
          {signingOut ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <LogOut size={18} color="#ffffff" />
              <Text className="text-base font-semibold text-white">Logout</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

