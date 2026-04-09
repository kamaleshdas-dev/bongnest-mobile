import { LinearGradient } from "expo-linear-gradient";
import { Search } from "lucide-react-native";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SearchScreen() {
  return (
    <SafeAreaView className="flex-1 bg-neutral-950">
      <LinearGradient
        colors={["#020617", "#0b1220", "#020617"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />

      <View className="flex-1 px-6 pt-4">
        <Text className="text-3xl font-bold tracking-tight text-white">
          Search
        </Text>
        <Text className="mt-1 text-sm text-white/60">
          Coming soon — fast filters and saved searches.
        </Text>

        <View className="mt-8 items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40">
          <Search size={26} color="#a7f3d0" />
          <Text className="mt-3 text-base font-semibold text-white">
            Premium search is on the way
          </Text>
          <Text className="mt-1 text-center text-sm leading-6 text-white/60">
            We’ll add locality filters, budget sliders, and smart recommendations.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

