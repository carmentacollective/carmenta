import { createClient } from "@supabase/supabase-js";
import { env, assertEnv } from "@/lib/env";

/**
 * Supabase Client for File Storage
 *
 * Creates a client instance for uploading and managing files in Supabase Storage.
 * Uses publishable key (sb_publishable_...) for client-side direct uploads.
 *
 * Files are stored in the 'carmenta-files' bucket with structure:
 * {userId}/{connectionId}/{timestamp}-{nanoid}.{ext}
 */

let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
    if (supabaseClient) return supabaseClient;

    assertEnv(env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
    assertEnv(
        env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );

    supabaseClient = createClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    );

    return supabaseClient;
}
