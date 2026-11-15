import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Service-role client. Bypasses RLS — use ONLY in server code, ONLY after the
 * caller's permission has been checked (e.g. requireAdmin()).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY).");
  return createClient<Database>(publicEnv.supabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
