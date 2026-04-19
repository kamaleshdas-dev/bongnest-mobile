import { LinearGradient } from "expo-linear-gradient";
import { LogOut, Trash2, User } from "lucide-react-native";
import { router, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  TextInput,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "@/lib/supabase";
import type { Property } from "@/types/property";
import { formatMonthlyRent } from "@/lib/formatInr";

const LISTINGS_PAGE_SIZE = 20;

function areaLine(property: Pick<Property, "area_name">) {
  return property.area_name?.trim() || "";
}

function formatPostedAt(createdAt?: string | null) {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ProfileScreen() {
  const [email, setEmail] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [myListings, setMyListings] = useState<Property[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [loadingMoreListings, setLoadingMoreListings] = useState(false);
  const [refreshingListings, setRefreshingListings] = useState(false);
  const [hasMoreListings, setHasMoreListings] = useState(true);
  const [listingsOffset, setListingsOffset] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [listingQuery, setListingQuery] = useState("");
  const queryDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadUser = useCallback(async () => {
    setLoadingUser(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        Alert.alert("Could not load profile", error.message);
        setEmail(null);
        return;
      }
      const user = data.user ?? null;
      setEmail(user?.email ?? null);
      setUserId(user?.id ?? null);
    } finally {
      setLoadingUser(false);
    }
  }, []);

  const loadMyListings = useCallback(
    async ({
      ownerId,
      query,
      reset,
    }: {
      ownerId: string | null;
      query: string;
      reset: boolean;
    }) => {
      if (!ownerId) {
        setMyListings([]);
        setHasMoreListings(false);
        setListingsOffset(0);
        return;
      }
      const nextOffset = reset ? 0 : listingsOffset;
      const rangeFrom = nextOffset;
      const rangeTo = nextOffset + LISTINGS_PAGE_SIZE - 1;

      if (reset) {
        setLoadingListings(true);
      } else {
        setLoadingMoreListings(true);
      }
      try {
        let q = supabase
          .from("properties")
          .select(
            "id,title,price_monthly,area_name,created_at,video_url,owner_id",
          )
          .eq("owner_id", ownerId)
          .order("created_at", { ascending: false })
          .range(rangeFrom, rangeTo);

        const trimmed = query.trim();
        if (trimmed.length > 0) {
          // Search by title (fast + helpful for large inventories).
          q = q.ilike("title", `%${trimmed}%`);
        }

        const { data, error } = await q;

        if (error) {
          Alert.alert("Could not load listings", error.message);
          if (reset) setMyListings([]);
          return;
        }
        const rows = (data as Property[]) ?? [];
        setHasMoreListings(rows.length === LISTINGS_PAGE_SIZE);

        if (reset) {
          setMyListings(rows);
          setListingsOffset(rows.length);
        } else {
          setMyListings((current) => [...current, ...rows]);
          setListingsOffset(nextOffset + rows.length);
        }
      } finally {
        setLoadingListings(false);
        setLoadingMoreListings(false);
        setRefreshingListings(false);
      }
    },
    [listingsOffset],
  );

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!userId) return;
    loadMyListings({ ownerId: userId, query: listingQuery, reset: true });
  }, [userId, loadMyListings]);

  useEffect(() => {
    if (!userId) return;
    if (queryDebounceRef.current) clearTimeout(queryDebounceRef.current);
    queryDebounceRef.current = setTimeout(() => {
      loadMyListings({ ownerId: userId, query: listingQuery, reset: true });
    }, 280);
    return () => {
      if (queryDebounceRef.current) clearTimeout(queryDebounceRef.current);
    };
  }, [listingQuery, userId, loadMyListings]);

  const onRefreshListings = useCallback(() => {
    if (!userId) return;
    setRefreshingListings(true);
    setHasMoreListings(true);
    setListingsOffset(0);
    loadMyListings({ ownerId: userId, query: listingQuery, reset: true });
  }, [userId, loadMyListings, listingQuery]);

  const onLoadMoreListings = useCallback(() => {
    if (!userId) return;
    if (loadingListings || loadingMoreListings || refreshingListings) return;
    if (!hasMoreListings) return;
    loadMyListings({ ownerId: userId, query: listingQuery, reset: false });
  }, [
    userId,
    loadingListings,
    loadingMoreListings,
    refreshingListings,
    hasMoreListings,
    loadMyListings,
    listingQuery,
  ]);

  const onDeleteListing = useCallback(
    (property: Property) => {
      if (deletingId) return;
      Alert.alert(
        "Delete listing",
        "Are you sure you want to delete this property? This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              setDeletingId(property.id);
              try {
                const { data: authData, error: authError } =
                  await supabase.auth.getUser();
                if (authError || !authData.user?.id) {
                  Alert.alert(
                    "Delete failed",
                    authError?.message ?? "You must be signed in to delete.",
                  );
                  return;
                }

                const authUid = authData.user.id;

                if (property.owner_id != null && property.owner_id !== authUid) {
                  Alert.alert(
                    "Delete failed",
                    "This listing does not belong to your account.",
                  );
                  return;
                }

                const { data, error } = await supabase
                  .from("properties")
                  .delete()
                  .eq("id", property.id)
                  .eq("owner_id", authUid)
                  .select("id");

                if (error) {
                  Alert.alert("Delete failed", error.message);
                  return;
                }

                if (!data?.length) {
                  Alert.alert(
                    "Delete failed",
                    "No row was deleted. Check permissions or that the listing still exists.",
                  );
                  return;
                }

                setMyListings((current) =>
                  current.filter((p) => p.id !== property.id),
                );
              } finally {
                setDeletingId(null);
              }
            },
          },
        ],
      );
    },
    [deletingId],
  );

  const listHeader = useMemo(() => {
    return (
      <View>
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
            <View className="flex-row items-end justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-lg font-semibold text-white">
                  My Listings
                </Text>
                <Text className="mt-1 text-sm leading-6 text-white/60">
                  Search and manage your properties.
                </Text>
              </View>
              <View className="rounded-full bg-black/25 px-3 py-1.5">
                <Text className="text-xs font-semibold text-white/70">
                  {myListings.length}
                  {hasMoreListings ? "+" : ""} items
                </Text>
              </View>
            </View>

            <View className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <TextInput
                value={listingQuery}
                onChangeText={setListingQuery}
                placeholder="Search your listings…"
                placeholderTextColor="rgba(255,255,255,0.35)"
                className="text-base text-white"
                returnKeyType="search"
                autoCorrect={false}
              />
            </View>
          </View>
        </View>
      </View>
    );
  }, [
    email,
    hasMoreListings,
    listingQuery,
    loadingUser,
    myListings.length,
  ]);

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

  const listFooter = useMemo(() => {
    return (
      <View className="px-6 pb-8 pt-4">
        {loadingMoreListings ? (
          <View className="items-center justify-center py-4">
            <ActivityIndicator color="#10b981" />
            <Text className="mt-2 text-xs text-white/45">
              Loading more listings…
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={onLogout}
          disabled={signingOut}
          className="mt-2 flex-row items-center justify-center gap-2 rounded-3xl bg-white/10 py-4 shadow-xl shadow-black/30 active:opacity-90 disabled:opacity-50"
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
    );
  }, [loadingMoreListings, onLogout, signingOut]);

  return (
    <SafeAreaView className="flex-1 bg-neutral-950">
      <LinearGradient
        colors={["#020617", "#050b18", "#020617"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />

      <FlatList
        data={myListings}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        contentContainerStyle={{ paddingTop: 4 }}
        refreshing={refreshingListings}
        onRefresh={onRefreshListings}
        onEndReachedThreshold={0.35}
        onEndReached={onLoadMoreListings}
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={({ item }) => {
          const postedAt = formatPostedAt(item.created_at);
          const price = formatMonthlyRent(item.price_monthly);
          const area = areaLine(item);
          const hasVideo = Boolean(item.video_url?.trim());
          return (
            <View className="px-6">
              <View className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl shadow-black/40">
                <Pressable
                  onPress={() => router.push(`/(property)/${item.id}` as Href)}
                  className="flex-row gap-4 p-4 active:opacity-90"
                >
                  <View className="h-[96px] w-[72px] overflow-hidden rounded-2xl bg-black/25">
                    <View className="absolute inset-0 items-center justify-center">
                      <Text className="text-[11px] font-semibold text-white/35">
                        {hasVideo ? "VIDEO" : "PHOTO"}
                      </Text>
                    </View>
                    {hasVideo ? (
                      <View className="absolute left-2 top-2 rounded-full bg-emerald-500/25 px-2 py-0.5">
                        <Text className="text-[10px] font-bold text-emerald-100">
                          Reel
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View className="flex-1">
                    <View className="flex-row items-start justify-between gap-3">
                      <Text
                        className="flex-1 text-base font-semibold leading-6 text-white"
                        numberOfLines={2}
                      >
                        {item.title}
                      </Text>
                      <Pressable
                        onPress={() => onDeleteListing(item)}
                        disabled={deletingId === item.id}
                        hitSlop={10}
                        className="h-9 w-9 items-center justify-center rounded-full bg-red-500/15 active:opacity-90 disabled:opacity-60"
                      >
                        {deletingId === item.id ? (
                          <ActivityIndicator size="small" color="#fecaca" />
                        ) : (
                          <Trash2 size={16} color="#fecaca" strokeWidth={2} />
                        )}
                      </Pressable>
                    </View>

                    <Text
                      className="mt-1 text-lg font-bold text-emerald-300"
                      numberOfLines={1}
                    >
                      {price}
                    </Text>

                    {area ? (
                      <Text
                        className="mt-1 text-xs text-white/55"
                        numberOfLines={1}
                      >
                        {area}
                      </Text>
                    ) : null}

                    <View className="mt-3 flex-row items-center justify-between">
                      <Text className="text-[11px] font-medium text-white/35">
                        {postedAt ? `Posted ${postedAt}` : "Posted —"}
                      </Text>
                      <View className="rounded-full bg-black/25 px-2.5 py-1">
                        <Text className="text-[10px] font-semibold text-white/45">
                          ID {String(item.id).slice(0, 6).toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={() => {
          if (loadingListings) {
            return (
              <View className="px-6 pt-4">
                <View className="h-28 items-center justify-center rounded-3xl border border-white/10 bg-white/5">
                  <ActivityIndicator color="#10b981" />
                  <Text className="mt-3 text-xs text-white/45">
                    Loading your listings…
                  </Text>
                </View>
              </View>
            );
          }
          return (
            <View className="px-6 pt-4">
              <View className="items-center justify-center rounded-3xl border border-white/10 bg-white/5 px-5 py-10">
                <Text className="text-center text-sm text-white/60">
                  No listings found.
                </Text>
                <Text className="mt-2 text-center text-xs leading-5 text-white/45">
                  Try a different search, or post a new property from the Home
                  tab.
                </Text>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

