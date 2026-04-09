import { LinearGradient } from "expo-linear-gradient";
import { Link, router } from "expo-router";
import { Lock, Mail } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    return !loading && email.trim().length > 3 && password.length >= 6;
  }, [email, password, loading]);

  const onLogin = async () => {
    Keyboard.dismiss();
    if (!canSubmit) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const msg =
          error.message.toLowerCase().includes("invalid") ||
          error.message.toLowerCase().includes("credentials")
            ? "Invalid credentials"
            : error.message;
        Alert.alert("Login failed", msg);
        return;
      }

      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("Login failed", e?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-950">
      <LinearGradient
        colors={["#020617", "#0b1220", "#020617"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={110}
      >
        <Pressable
          className="flex-1 px-6"
          onPress={Keyboard.dismiss}
          accessible={false}
        >
          <View className="flex-1 justify-center">
            <View className="mb-8">
              <Text className="text-4xl font-bold tracking-tight text-white">
                BongNest
              </Text>
              <Text className="mt-2 text-base leading-6 text-white/70">
                Welcome back. Let’s find your next premium rental.
              </Text>
            </View>

            <View className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/40">
              <Text className="text-lg font-semibold text-white">Login</Text>
              <Text className="mt-1 text-sm text-white/60">
                Use your email and password
              </Text>

              <View className="mt-6 gap-4">
                <View className="gap-2">
                  <Text className="text-sm font-semibold text-white/80">
                    Email
                  </Text>
                  <View className="flex-row items-center gap-2 rounded-3xl border border-white/10 bg-black/20 px-4 py-3.5">
                    <Mail size={18} color="#a7f3d0" />
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="you@domain.com"
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      className="flex-1 text-base text-white"
                      returnKeyType="next"
                    />
                  </View>
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-semibold text-white/80">
                    Password
                  </Text>
                  <View className="flex-row items-center gap-2 rounded-3xl border border-white/10 bg-black/20 px-4 py-3.5">
                    <Lock size={18} color="#a7f3d0" />
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="••••••••"
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      secureTextEntry={!showPassword}
                      className="flex-1 text-base text-white"
                      returnKeyType="done"
                      onSubmitEditing={onLogin}
                    />
                    <Pressable
                      onPress={() => setShowPassword((s) => !s)}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                      className="rounded-2xl px-2 py-1"
                    >
                      <Text className="text-sm font-semibold text-emerald-200">
                        {showPassword ? "Hide" : "Show"}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <Pressable
                  onPress={onLogin}
                  disabled={!canSubmit}
                  className="mt-2 flex-row items-center justify-center rounded-3xl bg-emerald-600 py-4 shadow-xl shadow-emerald-900/30 active:opacity-90 disabled:opacity-50"
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text className="text-lg font-semibold text-white">
                      Continue
                    </Text>
                  )}
                </Pressable>

                <View className="mt-3 items-center">
                  <Link href="/(auth)/signup" asChild>
                    <Pressable className="px-2 py-2 active:opacity-80">
                      <Text className="text-sm text-white/70">
                        New to BongNest?{" "}
                        <Text className="font-semibold text-emerald-200">
                          Create Account
                        </Text>
                      </Text>
                    </Pressable>
                  </Link>
                </View>
              </View>
            </View>

            <Text className="mt-6 text-center text-xs leading-5 text-white/40">
              By continuing, you agree to BongNest terms.
            </Text>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

