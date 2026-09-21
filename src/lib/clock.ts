"use client";

import { getSupabase } from "./supabase";

/**
 * فرق ساعة الجهاز عن ساعة الخادم بالمللي ثانية.
 * serverNow() = Date.now() + offset
 *
 * كل التوقيتات المعروضة (العدّ التنازلي، ترتيب البازر) تُحسب بساعة الخادم،
 * فجوال بساعة خاطئة لا يفسد اللعبة.
 */
let offset = 0;
let synced = false;

export async function syncClock(): Promise<number> {
  try {
    const sent = Date.now();
    const { data, error } = await getSupabase().rpc("server_now");
    if (error || !data) return offset;
    const received = Date.now();
    const roundTrip = received - sent;
    const serverMs = new Date(data as string).getTime();
    // نفترض أن نصف زمن الرحلة ذهابًا ونصفه إيابًا
    offset = serverMs + roundTrip / 2 - received;
    synced = true;
  } catch {
    /* نبقى على offset = 0 */
  }
  return offset;
}

export function serverNow(): number {
  return Date.now() + offset;
}

export function clockSynced(): boolean {
  return synced;
}
