"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import { serverNow, syncClock } from "./clock";
import { fetchPlayers, fetchRoom } from "./game";
import type { Player, Room } from "./types";

export interface PresenceEntry {
  clientId: string;
  playerId?: string;
  name?: string;
  role: "host" | "player";
}

export interface RoomChannelState {
  room: Room | null;
  players: Player[];
  online: PresenceEntry[];
  status: "connecting" | "live" | "offline" | "missing";
  error: string | null;
  refresh: () => Promise<void>;
  broadcast: (event: string, payload?: Record<string, unknown>) => void;
  onBroadcast: (event: string, handler: (payload: Record<string, unknown>) => void) => () => void;
}

interface Options {
  code: string;
  presence?: PresenceEntry | null;
}

/**
 * الاشتراك الكامل بغرفة:
 *  - postgres_changes على rooms و players  ⇒ حالة اللعبة (المصدر الموثوق)
 *  - presence                              ⇒ من المتصل الآن فعليًا
 *  - broadcast                             ⇒ أحداث لحظية (بازر، مؤثرات)
 *
 * عند أي إعادة اتصال أو عودة للتبويب نعيد تحميل الحالة كاملة من القاعدة،
 * فلا تبقى الشاشة على حالة قديمة بعد انقطاع الإنترنت.
 */
export function useRoomChannel({ code, presence }: Options): RoomChannelState {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [online, setOnline] = useState<PresenceEntry[]>([]);
  const [status, setStatus] = useState<RoomChannelState["status"]>("connecting");
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const handlersRef = useRef(new Map<string, Set<(p: Record<string, unknown>) => void>>());
  const presenceRef = useRef(presence);
  presenceRef.current = presence;

  const upper = code?.toUpperCase() ?? "";

  const refresh = useCallback(async () => {
    if (!upper) return;
    try {
      const r = await fetchRoom(upper);
      if (!r) {
        setStatus("missing");
        setRoom(null);
        return;
      }
      roomIdRef.current = r.id;
      setRoom(r);
      setPlayers(await fetchPlayers(r.id));
      setError(null);
      setStatus((s) => (s === "missing" || s === "connecting" ? "live" : s));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر تحميل الغرفة");
      setStatus("offline");
    }
  }, [upper]);

  // التحميل الأول + معايرة الساعة مع الخادم
  useEffect(() => {
    void syncClock();
    void refresh();
  }, [refresh]);

  // الاشتراك في القناة
  useEffect(() => {
    if (!upper) return;
    const sb = getSupabase();
    const channel = sb.channel(`room:${upper}`, {
      config: { presence: { key: presenceRef.current?.clientId || `anon-${Math.random()}` } },
    });
    channelRef.current = channel;

    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `code=eq.${upper}` }, (payload) => {
        if (payload.eventType === "DELETE") {
          setRoom(null);
          setStatus("missing");
          return;
        }
        const next = payload.new as Room;
        roomIdRef.current = next.id;
        setRoom(next);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, (payload) => {
        const row = (payload.new ?? payload.old) as Player;
        if (!roomIdRef.current || row?.room_id !== roomIdRef.current) return;
        setPlayers((prev) => {
          if (payload.eventType === "DELETE") return prev.filter((p) => p.id !== row.id);
          const next = payload.new as Player;
          const idx = prev.findIndex((p) => p.id === next.id);
          if (idx === -1) return [...prev, next];
          const copy = [...prev];
          copy[idx] = next;
          return copy;
        });
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceEntry>();
        const flat: PresenceEntry[] = [];
        for (const entries of Object.values(state)) {
          for (const e of entries) flat.push(e as unknown as PresenceEntry);
        }
        setOnline(flat);
      })
      .on("broadcast", { event: "*" }, (msg) => {
        const set = handlersRef.current.get(msg.event as string);
        if (set) for (const h of set) h((msg.payload ?? {}) as Record<string, unknown>);
      });

    channel.subscribe((s) => {
      if (s === "SUBSCRIBED") {
        setStatus("live");
        // أعد تحميل الحالة: قد نكون فوّتنا تغييرات أثناء الانقطاع
        void refresh();
        if (presenceRef.current) void channel.track(presenceRef.current);
      } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
        setStatus("offline");
      }
    });

    return () => {
      channelRef.current = null;
      void sb.removeChannel(channel);
    };
  }, [upper, refresh]);

  // تحديث بيانات الحضور عند تغيّرها (بعد الانضمام مثلًا)
  useEffect(() => {
    if (presence && channelRef.current && status === "live") {
      void channelRef.current.track(presence);
    }
  }, [presence, status]);

  // العودة للتبويب أو رجوع الشبكة ⇒ إعادة مزامنة كاملة
  useEffect(() => {
    const resync = () => {
      if (document.visibilityState === "visible") {
        void syncClock();
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("online", resync);
    window.addEventListener("focus", resync);
    return () => {
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("online", resync);
      window.removeEventListener("focus", resync);
    };
  }, [refresh]);

  // شبكة أمان: مزامنة دورية هادئة كل 20 ثانية
  useEffect(() => {
    const id = window.setInterval(() => void refresh(), 20000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const broadcast = useCallback((event: string, payload: Record<string, unknown> = {}) => {
    void channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  const onBroadcast = useCallback(
    (event: string, handler: (payload: Record<string, unknown>) => void) => {
      const map = handlersRef.current;
      if (!map.has(event)) map.set(event, new Set());
      map.get(event)!.add(handler);
      return () => {
        map.get(event)?.delete(handler);
      };
    },
    []
  );

  return useMemo(
    () => ({ room, players, online, status, error, refresh, broadcast, onBroadcast }),
    [room, players, online, status, error, refresh, broadcast, onBroadcast]
  );
}

/**
 * العدّ التنازلي محسوبًا بساعة الخادم، ومتوقفًا عند الإيقاف المؤقت.
 */
export function useCountdown(room: Room | null): { remaining: number; total: number; running: boolean } {
  const [now, setNow] = useState(() => serverNow());

  const active = room?.phase === "question" && !room?.paused_at;

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(serverNow()), 100);
    return () => window.clearInterval(id);
  }, [active]);

  return useMemo(() => {
    const total = room?.question_duration ?? 0;
    if (room?.phase !== "question" || !room.question_started_at) {
      return { remaining: 0, total, running: false };
    }

    const started = new Date(room.question_started_at).getTime();
    // أثناء الإيقاف يتجمّد العدّاد على لحظة الإيقاف
    const nowMs = room.paused_at ? new Date(room.paused_at).getTime() : now;
    const elapsed = (nowMs - started - room.paused_ms) / 1000;
    const remaining = Math.max(0, total - elapsed);

    return { remaining, total, running: !room.paused_at && remaining > 0 };
  }, [room, now]);
}
