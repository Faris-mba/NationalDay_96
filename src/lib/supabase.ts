"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * غيّرت Supabase تسمية المفاتيح: ما كان يُسمّى "anon key" صار يُعرض في
 * المشاريع الحديثة باسم "publishable key" (بصيغة sb_publishable_…).
 * كلاهما مفتاح العميل نفسه، فنقبل الاسمين حتى لا تفشل اللعبة لمجرد
 * أن المستخدم سمّى المتغيّر بما رآه في لوحة Supabase.
 *
 * ⚠️ لا بد أن تبقى هذه قراءات ثابتة (process.env.NAME) لا ديناميكية،
 * لأن Next يستبدل متغيّرات NEXT_PUBLIC_ نصيًّا وقت البناء.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

/**
 * أسماء المتغيّرات الناقصة، لعرضها للمستخدم بدل رسالة عامة.
 *
 * ⚠️ لا تحوّل هذا إلى قراءة ديناميكية مثل process.env[name]:
 * متغيّرات NEXT_PUBLIC_ تُستبدل نصيًّا وقت البناء، والقراءة الديناميكية
 * لا تُستبدل فتعود undefined دائمًا في المتصفّح.
 */
export function missingSupabaseEnv(): string[] {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return missing;
}

/**
 * عميل Supabase واحد لكل تبويب. Realtime مضبوط على معدّل أحداث مرتفع
 * لأن البازر والتصويت قد يصلان دفعة واحدة من كل الجوالات.
 */
export function getSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = SUPABASE_URL;
  const key = SUPABASE_KEY;

  if (!url || !key) {
    throw new Error(
      "إعدادات Supabase ناقصة: عرّف NEXT_PUBLIC_SUPABASE_URL ومعه " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY (أو NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)"
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 40 } },
  });

  return cached;
}
