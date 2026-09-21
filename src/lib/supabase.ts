"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * عميل Supabase واحد لكل تبويب. Realtime مضبوط على معدّل أحداث مرتفع
 * لأن البازر والتصويت قد يصلان دفعة واحدة من كل الجوالات.
 */
export function getSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "إعدادات Supabase ناقصة: عرّف NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY في .env.local"
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 40 } },
  });

  return cached;
}
