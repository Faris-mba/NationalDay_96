"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HostStage from "@/components/host/HostStage";
import HostControls from "@/components/host/HostControls";
import Scoreboard from "@/components/Scoreboard";
import Confetti from "@/components/Confetti";
import { supabaseConfigured } from "@/lib/supabase";
import ConfigNeeded from "@/components/ConfigNeeded";
import { useCountdown, useRoomChannel } from "@/lib/useRoom";
import { useQuestionData } from "@/lib/useQuestionData";
import { getClientId, recallHostRoom, rememberHostRoom } from "@/lib/identity";
import { loadMutePreference, play, setMuted as setMutedPref, unlockAudio } from "@/lib/sound";
import { stepNumber, totalSteps } from "@/lib/questions";
import * as game from "@/lib/game";
import type { Buzz, Room, Team } from "@/lib/types";

export default function HostPage() {
  const [code, setCode] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const started = useRef(false);

  // استعادة الغرفة السابقة من هذا المتصفّح، وإلا أنشئ غرفة جديدة
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const existing = recallHostRoom();
    if (existing) {
      setCode(existing);
      return;
    }
    setCreating(true);
    game
      .createRoom()
      .then((room) => {
        rememberHostRoom(room.code);
        setCode(room.code);
      })
      .catch((e: unknown) => setBootError(e instanceof Error ? e.message : "تعذّر إنشاء الغرفة"))
      .finally(() => setCreating(false));
  }, []);

  if (!supabaseConfigured) return <ConfigNeeded />;

  if (bootError) {
    return (
      <main className="grid min-h-screen place-items-center p-10 text-center">
        <div className="card max-w-2xl p-10">
          <div className="mb-4 text-6xl">⚠️</div>
          <h1 className="mb-3 text-4xl font-black">ما قدرنا نبدأ</h1>
          <p className="text-2xl text-white/70">{bootError}</p>
          <Link href="/" className="mt-6 inline-block text-xl text-gold-300 underline">
            رجوع
          </Link>
        </div>
      </main>
    );
  }

  if (!code || creating) {
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="animate-pulse text-4xl text-white/60">جارٍ تجهيز الغرفة…</div>
      </main>
    );
  }

  return <HostRoom code={code} onNewRoom={() => setCode(null)} />;
}

/* ------------------------------------------------------------------ */

function HostRoom({ code, onNewRoom }: { code: string; onNewRoom: () => void }) {
  const presence = useMemo(() => ({ clientId: `host-${getClientId()}`, role: "host" as const }), []);
  const { room, players, online, status, refresh } = useRoomChannel({ code, presence });
  const { remaining, total, running } = useCountdown(room);
  const { answers, buzzes, votes } = useQuestionData(room?.id ?? null, room?.current_question?.instanceId ?? null);

  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [joinUrl, setJoinUrl] = useState("");

  useEffect(() => setMuted(loadMutePreference()), []);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    setJoinUrl(`${base.replace(/\/$/, "")}/join/${code}`);
  }, [code]);

  // فتح الصوت بعد أول تفاعل (سياسة المتصفحات)
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // مؤثرات صوتية عند تغيّر الطور
  const prevPhase = useRef<string | null>(null);
  useEffect(() => {
    if (!room) return;
    if (prevPhase.current !== room.phase) {
      if (room.phase === "question") play("start");
      if (room.phase === "reveal") play("reveal");
      if (room.phase === "finished") play("win");
      prevPhase.current = room.phase;
    }
  }, [room]);

  // صوت البازر عند أول ضغطة
  const buzzCount = useRef(0);
  useEffect(() => {
    if (buzzes.length > buzzCount.current && buzzes.length > 0) play("buzz");
    buzzCount.current = buzzes.length;
  }, [buzzes.length]);

  const run = useCallback(
    async (fn: (r: Room) => Promise<unknown>) => {
      if (!room || busy) return;
      setBusy(true);
      try {
        await fn(room);
      } catch (e) {
        console.error(e);
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [room, busy, refresh]
  );

  const segments = useMemo(() => (room ? game.playlistFor(room) : []), [room]);
  const progress = useMemo(
    () =>
      room
        ? { current: stepNumber(segments, room.round_index, room.step_index), total: totalSteps(segments) }
        : { current: 0, total: 0 },
    [room, segments]
  );

  if (!room) {
    return (
      <main className="grid min-h-screen place-items-center gap-4 p-10 text-center">
        <div>
          <div className="mb-4 text-5xl">
            {status === "missing" ? "🔎 ما لقينا الغرفة" : "⏳ جارٍ الاتصال…"}
          </div>
          {status === "missing" && (
            <button
              onClick={() => {
                window.localStorage.removeItem("tahadi:host-room");
                onNewRoom();
              }}
              className="tap rounded-2xl bg-saudi-600 px-8 py-4 text-2xl font-black"
            >
              أنشئ غرفة جديدة
            </button>
          )}
        </div>
      </main>
    );
  }

  const onlineIds = new Set(online.filter((o) => o.playerId).map((o) => o.playerId!));

  return (
    <main className="flex min-h-screen flex-col gap-5 px-8 pb-40 pt-6">
      <Confetti active={room.phase === "finished"} />

      {/* شريط علوي: الرمز + حالة الاتصال */}
      <header className="flex items-center gap-6">
        <div className="text-5xl">🇸🇦</div>
        <div className="text-4xl font-black">
          تحدي <span className="gold-text">العائلة</span>
        </div>
        {room.phase !== "lobby" && (
          <div className="flex items-baseline gap-3 rounded-2xl bg-white/10 px-6 py-2">
            <span className="text-xl text-white/60">الرمز</span>
            <span className="text-4xl font-black tracking-widest" dir="ltr">
              {room.code}
            </span>
          </div>
        )}
        <div className="mr-auto flex items-center gap-4 text-xl">
          <span className={status === "live" ? "text-saudi-300" : "text-red-300"}>
            {status === "live" ? "● مباشر" : "○ إعادة اتصال…"}
          </span>
          <span className="text-white/50">{online.filter((o) => o.role === "player").length} متصل</span>
          <Link href="/host/settings" className="text-white/60 underline">
            ⚙️ الإعدادات
          </Link>
        </div>
      </header>

      <HostStage
        room={room}
        players={players}
        onlineIds={onlineIds}
        answers={answers}
        buzzes={buzzes}
        votes={votes}
        joinUrl={joinUrl}
        remaining={remaining}
        total={total}
        running={running}
      />

      {/* لوحة النقاط دائمًا أسفل الشاشة */}
      <Scoreboard falcons={room.score_falcons} elite={room.score_elite} players={players} />

      <HostControls
        room={room}
        players={players}
        buzzes={buzzes}
        busy={busy}
        muted={muted}
        progress={progress}
        onStart={() => run((r) => game.startGame(r))}
        onNext={() => run((r) => game.advance(r))}
        onBack={() => run((r) => game.goBack(r))}
        onReveal={() => run((r) => game.revealAnswer(r))}
        onPause={() => run((r) => game.togglePause(r))}
        onSkipQuestion={() => run((r) => game.skipQuestion(r))}
        onSkipRound={() => run((r) => game.skipRound(r))}
        onAddTime={(s) => run((r) => game.addTime(r, s))}
        onZoom={(s) => run((r) => game.setZoomStep(r, s))}
        onAdjust={(team: Team, delta: number) => run((r) => game.adjustScore(r, team, delta))}
        onJudgeBuzz={(b: Buzz, correct: boolean) => run((r) => game.judgeBuzz(r, b, correct))}
        onJudgeMillion={(correct: boolean) => run((r) => game.judgeMillion(r, correct))}
        onLifeline={(team, l) => run((r) => game.useLifeline(r, team, l))}
        onShowVotes={() => run((r) => game.showAskFamilyResults(r))}
        onSetFinalist={(team, playerId) => run((r) => game.setFinalist(r.id, team, playerId))}
        onToggleMute={() => {
          const next = !muted;
          setMuted(next);
          setMutedPref(next);
        }}
        onReset={() => {
          if (window.confirm("إعادة ضبط اللعبة: تُصفّر كل النقاط والإجابات. متأكد؟")) {
            void run((r) => game.resetGame(r));
          }
        }}
      />
    </main>
  );
}
