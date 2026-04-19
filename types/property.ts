/** Row shape for the Supabase `properties` table (extend as your schema grows). */
export type Property = {
  id: string;
  title: string;
  video_url: string | null;
  /** Storage path inside bucket `property-videos` (e.g. uploads/abc.mp4). Optional but recommended. */
  video_storage_path?: string | null;
  price_monthly: number | null;
  owner_id?: string | null;
  created_at?: string | null;
  location?: string | null;
  area?: string | null;
  area_name?: string | null;
  description?: string | null;
  owner_phone?: string | null;
};
