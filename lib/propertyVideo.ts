import { supabase } from "@/lib/supabase";
import type { Property } from "@/types/property";

const BUCKET = "property-videos";

/**
 * Extract object path inside the bucket from a Supabase Storage URL
 * (public, sign, or authenticated URL shapes).
 */
export function extractStorageObjectPathFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === BUCKET);
    if (idx === -1) return null;
    return parts.slice(idx + 1).join("/");
  } catch {
    return null;
  }
}

/**
 * Returns a URL that expo-av can play. Prefer a fresh signed URL when we can
 * derive the object path (fixes private buckets + expired signed links).
 */
export async function getPlayablePropertyVideoUrl(
  property: Property,
): Promise<string | null> {
  const raw = property.video_url?.trim();
  if (!raw) return null;

  // Public object URLs work in-browser and in expo-av; re-signing can fail per-object
  // and is unnecessary here—use the URL as-is.
  if (raw.includes("/object/public/")) {
    return raw;
  }

  const path =
    property.video_storage_path?.trim() ||
    extractStorageObjectPathFromUrl(raw);

  if (!path) {
    return raw;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days

  if (error || !data?.signedUrl) {
    return raw;
  }

  return data.signedUrl;
}
