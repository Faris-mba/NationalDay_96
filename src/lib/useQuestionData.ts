"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "./supabase";
import { fetchAnswers, fetchBuzzes, fetchVotes } from "./game";
import type { Answer, Buzz, Vote } from "./types";

interface Result {
  answers: Answer[];
  buzzes: Buzz[];
  votes: Vote[];
  reload: () => Promise<void>;
}

/**
 * بيانات السؤال الحالي (إجابات/بازر/تصويت) مباشرةً من القاعدة.
 * الترتيب في buzzes مأخوذ من created_at الذي يملؤه Postgres،
 * فلا أثر لساعة الجوال على من ضغط أولًا.
 */
export function useQuestionData(roomId: string | null, questionId: string | null): Result {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [buzzes, setBuzzes] = useState<Buzz[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const qRef = useRef(questionId);
  qRef.current = questionId;

  const reload = useCallback(async () => {
    if (!roomId || !questionId) {
      setAnswers([]);
      setBuzzes([]);
      setVotes([]);
      return;
    }
    try {
      const [a, b, v] = await Promise.all([
        fetchAnswers(roomId, questionId),
        fetchBuzzes(roomId, questionId),
        fetchVotes(roomId, questionId),
      ]);
      if (qRef.current !== questionId) return; // تغيّر السؤال أثناء الجلب
      setAnswers(a);
      setBuzzes(b);
      setVotes(v);
    } catch {
      /* تجاهل: المزامنة الدورية ستعيد المحاولة */
    }
  }, [roomId, questionId]);

  useEffect(() => {
    setAnswers([]);
    setBuzzes([]);
    setVotes([]);
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!roomId) return;
    const sb = getSupabase();
    const channel = sb.channel(`qdata:${roomId}`);

    const bind = <T extends { question_id: string; id: string; room_id: string }>(
      table: "answers" | "buzzes" | "votes",
      setter: React.Dispatch<React.SetStateAction<T[]>>
    ) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as T;
          if (!row || row.question_id !== qRef.current) return;
          setter((prev) => {
            if (payload.eventType === "DELETE") return prev.filter((x) => x.id !== row.id);
            const next = payload.new as T;
            const idx = prev.findIndex((x) => x.id === next.id);
            if (idx === -1) return [...prev, next];
            const copy = [...prev];
            copy[idx] = next;
            return copy;
          });
        }
      );
    };

    bind<Answer>("answers", setAnswers);
    bind<Buzz>("buzzes", setBuzzes);
    bind<Vote>("votes", setVotes);

    channel.subscribe((s) => {
      if (s === "SUBSCRIBED") void reload();
    });

    return () => {
      void sb.removeChannel(channel);
    };
  }, [roomId, reload]);

  // ترتيب البازر دائمًا بوقت الخادم
  const orderedBuzzes = useMemo(
    () => [...buzzes].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [buzzes]
  );

  return { answers, buzzes: orderedBuzzes, votes, reload };
}

/** تجميع نتائج التصويت كنسب مئوية */
export function tallyVotes(votes: Vote[], options: string[]): Array<{ label: string; count: number; pct: number }> {
  const counts = new Map<string, number>();
  for (const o of options) counts.set(o, 0);
  for (const v of votes) counts.set(v.choice, (counts.get(v.choice) ?? 0) + 1);
  const total = votes.length || 1;
  return options
    .map((label) => {
      const count = counts.get(label) ?? 0;
      return { label, count, pct: Math.round((count / total) * 100) };
    })
    .sort((a, b) => b.count - a.count);
}
