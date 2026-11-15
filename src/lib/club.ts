import "server-only";
import { cache } from "react";
import { brand } from "@/config/brand";
import { createClient } from "@/lib/supabase/server";

/** Club-wide settings (time zone, default capacity). Cached per request. */
export const getClubSettings = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("club_settings").select("timezone, default_capacity").maybeSingle();
  return {
    timeZone: data?.timezone ?? brand.timeZone,
    defaultCapacity: data?.default_capacity ?? 10,
  };
});
