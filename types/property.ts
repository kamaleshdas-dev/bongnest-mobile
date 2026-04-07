/** Row shape for the Supabase `properties` table (extend as your schema grows). */
export type Property = {
  id: string;
  title: string;
  video_url: string | null;
  price_monthly: number | null;
  location?: string | null;
  area?: string | null;
  description?: string | null;
};
