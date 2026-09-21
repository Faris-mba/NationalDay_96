"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Timer from "@/components/Timer";
import { useCountdown, useRoomChannel } from "@/lib/useRoom";
import { useQuestionData } from "@/lib/useQuestionData";
import { getClientId, recallPlayer } from "@/lib/identity";
import { loadMutePreference, play, setMuted as setMutedPref, unlockAudio } from "@/lib/sound";
import * as game from "@/lib/game";
import { ROUND_META, TEAMS, type ActiveQuestion, type Player, type Room } from "@/lib/types";

const LATIN = ["A", "B", "C", "D"];
const OPTION_COLORS = ["#e04f5f", "#2f7fd4", "#e9a13b", "#3aa76d"];

export default function PlayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const upper = (code ?? "").toUpperCase();
  const router = useRouter();

  const saved = useMemo(() => (typeof window === "undefined" ? null : recallPlayer(upper)), [upper]);
  const clientId = useMemo(() => (typeof window === "undefined" ? "" : getClientId()), []);

  const presence = useMemo(
    () =>
      saved
        ? { clientId, playerId: saved.playerId, name: saved.name, role: "player" as const }
        : null,
    [clientId, saved]
  );

  const { room, players, status, refresh } = useRoomChannel({ code: upper, presence });
  const me = useMemo(
    () => players.find((p) => p.client_id === clientId) ?? null,
    [players, clientId]
  );

  // لم ينضم بعد على هذا الجهاز ⇒ لصفحة الانضمام
  useEffect(() => {
    if (!saved) router.replace(`/join/${upper}`);
  }, [saved, router, upper]);

  // انضم سابقًا لكن المقدّم حذفه أو أُعيد ضبط الغرفة ⇒ انضمام من جديد
  useEffect(() => {
    if (saved && status === "live" && players.length > 0 && !me) {
      router.replace(`/join/${upper}`);
    }
  }, [saved, status, players.length, me, router, upper]);

  // نبضة حضور كل 25 ثانية حتى تبقى الشاشة ظاهرة كـ«متصل»
  useEffect(() => {
    if (!me) return;
    const id = window.setInterval(() => void game.heartbeat(me.id), 25000);
    return () => window.clearInterval(id);
  }, [me]);

  if (!saved) return null;

  if (status === "missing") {
    return (
      <Shell>
        <div className="card p-8 text-center">
          <div className="mb-3 text-5xl">🔎</div>
          <p className="text-2xl">انتهت هذه الغرفة أو حُذفت.</p>
          <Link href="/" className="mt-5 inline-block rounded-2xl bg-saudi-600 px-8 py-4 text-xl font-black">
            الصفحة الرئيسية
          </Link>
        </div>
      </Shell>
    );
  }

  if (!room || !me) {
    return (
      <Shell>
        <div className="animate-pulse text-center text-2xl text-white/60">جارٍ الاتصال…</div>
      </Shell>
    );
  }

  return <PlayRoom room={room} me={me} players={players} status={status} refresh={refresh} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center px-5">{children}</main>;
}

/* ================================================================== */

interface RoomProps {
  room: Room;
  me: Player;
  players: Player[];
  status: string;
  refresh: () => Promise<void>;
}

function PlayRoom({ room, me, players, status }: RoomProps) {
  const q = room.current_question;
  const { remaining, running } = useCountdown(room);
  const { answers, buzzes, votes } = useQuestionData(room.id, q?.instanceId ?? null);
  const [muted, setMuted] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => setMuted(loadMutePreference()), []);
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const myAnswer = answers.find((a) => a.player_id === me.id) ?? null;
  const myBuzz = buzzes.find((b) => b.player_id === me.id) ?? null;
  const myVote = votes.find((v) => v.player_id === me.id) ?? null;
  const teamMeta = TEAMS[me.team];

  const locked = room.phase !== "question" || !!room.paused_at || remaining <= 0;

  const answer = useCallback(
    async (value: string, meta?: Record<string, unknown>) => {
      if (!q || sending) return;
      setSending(true);
      try {
        await game.submitAnswer({
          roomId: room.id,
          playerId: me.id,
          question: q,
          answer: value,
          meta,
        });
        play("tick");
      } catch (e) {
        console.error(e);
      } finally {
        setSending(false);
      }
    },
    [q, room.id, me.id, sending]
  );

  const buzz = useCallback(async () => {
    if (!q || sending) return;
    setSending(true);
    play("buzz");
    try {
      await game.submitBuzz(room.id, me.id, q.instanceId);
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  }, [q, room.id, me.id, sending]);

  const vote = useCallback(
    async (choice: string) => {
      if (!q || sending) return;
      setSending(true);
      try {
        await game.submitVote(room.id, me.id, q.instanceId, choice);
        play("tick");
      } catch (e) {
        console.error(e);
      } finally {
        setSending(false);
      }
    },
    [q, room.id, me.id, sending]
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-6 pt-4">
      {/* رأس ثابت: اسمي، فريقي، نقاطي */}
      <header
        className="mb-4 flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{ background: `${teamMeta.color}26`, border: `2px solid ${teamMeta.color}66` }}
      >
        <span className="text-3xl">{teamMeta.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-black">
            {me.category === "kid" ? "🧒 " : ""}
            {me.name}
          </div>
          <div className="text-sm text-white/60">{teamMeta.name}</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-black tabular-nums">{me.score.toLocaleString("ar-SA")}</div>
          <div className="text-xs text-white/50">نقطتي</div>
        </div>
        <button
          onClick={() => {
            const next = !muted;
            setMuted(next);
            setMutedPref(next);
          }}
          className="tap rounded-xl bg-black/30 px-3 py-2 text-lg"
          aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </header>

      {status !== "live" && (
        <div className="mb-3 rounded-2xl bg-amber-900/50 px-4 py-2 text-center text-sm">
          ⚠️ إعادة اتصال… إجاباتك محفوظة
        </div>
      )}

      <PlayBody
        room={room}
        me={me}
        players={players}
        q={q}
        locked={locked}
        remaining={remaining}
        running={running}
        myAnswer={myAnswer?.answer ?? null}
        myBuzz={!!myBuzz}
        myVote={myVote?.choice ?? null}
        buzzRank={myBuzz ? buzzes.findIndex((b) => b.id === myBuzz.id) + 1 : 0}
        sending={sending}
        onAnswer={answer}
        onBuzz={buzz}
        onVote={vote}
      />
    </main>
  );
}

/* ================================================================== */

interface BodyProps {
  room: Room;
  me: Player;
  players: Player[];
  q: ActiveQuestion | null;
  locked: boolean;
  remaining: number;
  running: boolean;
  myAnswer: string | null;
  myBuzz: boolean;
  myVote: string | null;
  buzzRank: number;
  sending: boolean;
  onAnswer: (value: string, meta?: Record<string, unknown>) => void;
  onBuzz: () => void;
  onVote: (choice: string) => void;
}

function PlayBody(p: BodyProps) {
  const { room, me, q } = p;

  if (room.phase === "lobby") {
    return (
      <Center emoji="⏳">
        <div className="text-3xl font-black">جاهز!</div>
        <p className="mt-2 text-xl text-white/60">ننتظر المقدّم يبدأ اللعبة… شوف التلفزيون 📺</p>
      </Center>
    );
  }

  if (room.phase === "finished") {
    const winner =
      room.score_falcons === room.score_elite
        ? null
        : room.score_falcons > room.score_elite
          ? "falcons"
          : "elite";
    const iWon = winner === me.team;
    return (
      <Center emoji={winner === null ? "🤝" : iWon ? "🏆" : "👏"}>
        <div className="text-3xl font-black">
          {winner === null ? "تعادل!" : iWon ? "فريقك فاز! 🎉" : `فاز فريق ${TEAMS[winner].name}`}
        </div>
        <p className="mt-3 text-xl text-white/70">
          نقاطك: <span className="font-black text-gold-300">{me.score.toLocaleString("ar-SA")}</span>
        </p>
        <p className="mt-4 text-2xl text-gold-300">كل عام والوطن بخير 🇸🇦</p>
      </Center>
    );
  }

  if (!q) {
    return (
      <Center emoji="📺">
        <div className="text-2xl font-black">شوف التلفزيون</div>
      </Center>
    );
  }

  // جولة الصغار: الكبار يشوفون «دور الصغار!»
  if (q.kidsOnly && me.category !== "kid") {
    return (
      <Center emoji="🧒">
        <div className="text-4xl font-black text-gold-300">دور الصغار!</div>
        <p className="mt-3 text-xl text-white/60">خلّوا الصغار يجاوبون… وشجّعوهم 👏</p>
      </Center>
    );
  }

  const meta = ROUND_META[q.round];

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* شريط الجولة والوقت */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">{meta.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-black">{meta.title}</div>
          {q.kidsOnly && <div className="text-sm font-bold text-gold-300">نقاط مضاعفة ×2</div>}
        </div>
        {room.paused_at ? (
          <span className="rounded-xl bg-gold-500 px-3 py-2 font-black text-ink">⏸</span>
        ) : (
          room.phase === "question" &&
          q.round !== "buzzer" && (
            <Timer remaining={p.remaining} total={room.question_duration} running={p.running} size="phone" />
          )
        )}
      </div>

      {q.round === "buzzer" ? (
        <BuzzerBody {...p} />
      ) : q.round === "family" ? (
        <FamilyBody {...p} />
      ) : q.round === "million" ? (
        <MillionBody {...p} />
      ) : (
        <ChoiceBody {...p} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ChoiceBody(p: BodyProps) {
  const { q, locked, myAnswer, room } = p;
  if (!q?.options) return null;
  const revealed = room.phase === "reveal";

  return (
    <>
      <p className="rounded-2xl bg-black/25 px-4 py-3 text-center text-xl font-bold leading-relaxed">
        {q.round === "image" ? "شوف الصورة على التلفزيون واختر 👇" : q.text}
      </p>

      <div className="flex flex-1 flex-col gap-3">
        {q.options.map((opt, i) => {
          const value = String(i);
          const mine = myAnswer === value;
          const isCorrect = revealed && i === q.answer;
          const isWrongMine = revealed && mine && i !== q.answer;

          return (
            <button
              key={i}
              onClick={() => {
                // يمكن تغيير الإجابة ما دام الوقت باقيًا
                if (!locked) p.onAnswer(value, q.round === "image" ? { zoomStep: room.round_state.zoomStep ?? 1 } : undefined);
              }}
              disabled={locked}
              className={`tap flex min-h-[4.5rem] flex-1 items-center gap-4 rounded-2xl px-4 py-4 text-right transition active:scale-[.97] ${
                locked && !mine && !isCorrect ? "opacity-45" : ""
              }`}
              style={{
                background: isCorrect
                  ? "#0a8f4a"
                  : isWrongMine
                    ? "#7f1d1d"
                    : mine
                      ? OPTION_COLORS[i]
                      : `${OPTION_COLORS[i]}33`,
                border: `3px solid ${mine || isCorrect ? "#fff" : `${OPTION_COLORS[i]}88`}`,
              }}
            >
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl font-black"
                style={{ background: "rgba(0,0,0,.35)" }}
              >
                {LATIN[i]}
              </span>
              <span className="flex-1 text-xl font-bold leading-snug">{opt}</span>
              {mine && !revealed && <span className="text-2xl">✓</span>}
              {isCorrect && <span className="text-2xl">✅</span>}
              {isWrongMine && <span className="text-2xl">❌</span>}
            </button>
          );
        })}
      </div>

      <p className="text-center text-base text-white/50">
        {revealed
          ? myAnswer === String(q.answer)
            ? "صح عليك! 🎉"
            : myAnswer
              ? "مرة ثانية إن شاء الله 💪"
              : "ما جاوبت هالمرة"
          : myAnswer
            ? "إجابتك محفوظة — تقدر تغيّرها قبل ينتهي الوقت"
            : "اختر إجابة"}
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ */

function BuzzerBody(p: BodyProps) {
  const { room, me, q, myBuzz, buzzRank } = p;
  const turn = room.round_state.buzzerTurn;
  const lockedOut = (room.round_state.buzzerLockedOut ?? []).includes(me.id);
  const closed = !room.round_state.buzzerOpen || room.phase !== "question";
  const notMyTurn = !!turn && turn !== me.team;
  const disabled = closed || myBuzz || lockedOut || notMyTurn;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5">
      <p className="text-center text-lg text-white/60">السؤال على التلفزيون 📺</p>

      <button
        onClick={p.onBuzz}
        disabled={disabled}
        className={`tap grid h-56 w-56 place-items-center rounded-full text-4xl font-black shadow-2xl transition active:scale-95 ${
          disabled ? "bg-white/10 text-white/40" : "animate-pulse-ring bg-red-600 text-white"
        }`}
      >
        {myBuzz ? (
          <span className="text-center">
            <span className="block text-6xl">✋</span>
            <span className="text-2xl">ضغطت!</span>
          </span>
        ) : lockedOut ? (
          <span className="text-2xl">جاوبت خطأ</span>
        ) : notMyTurn ? (
          <span className="px-6 text-center text-2xl leading-snug">الدور على {TEAMS[turn!].name}</span>
        ) : closed ? (
          <span className="text-2xl">مقفل</span>
        ) : (
          "اضغط!"
        )}
      </button>

      {myBuzz && buzzRank > 0 && (
        <div className="animate-pop-in text-2xl font-black text-gold-300">
          {buzzRank === 1 ? "🥇 أنت الأول!" : `ترتيبك ${buzzRank}`}
        </div>
      )}

      {room.phase === "reveal" && q?.answerText && (
        <div className="rounded-2xl bg-saudi-700 px-6 py-4 text-center">
          <div className="text-sm text-white/70">الإجابة</div>
          <div className="text-2xl font-black">{q.answerText}</div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FamilyBody(p: BodyProps) {
  const { q, myVote, room } = p;
  const options = q?.familyOptions ?? [];

  if (!options.length) {
    return (
      <Center emoji="⚙️">
        <p className="text-xl text-white/70">
          ما أضاف المقدّم أسماء العائلة بعد — من صفحة الإعدادات.
        </p>
      </Center>
    );
  }

  return (
    <>
      <p className="rounded-2xl bg-black/25 px-4 py-3 text-center text-xl font-bold leading-relaxed">{q?.text}</p>
      <div className="flex flex-1 flex-col gap-3">
        {options.map((nameOption) => {
          const mine = myVote === nameOption;
          return (
            <button
              key={nameOption}
              onClick={() => room.phase === "question" && p.onVote(nameOption)}
              disabled={room.phase !== "question"}
              className={`tap min-h-[3.75rem] rounded-2xl px-5 py-4 text-xl font-black transition active:scale-[.97] ${
                mine ? "bg-gold-500 text-ink" : "bg-white/10"
              } ${room.phase !== "question" && !mine ? "opacity-45" : ""}`}
            >
              {nameOption} {mine && "✓"}
            </button>
          );
        })}
      </div>
      <p className="text-center text-base text-white/50">
        {myVote ? "تم تسجيل صوتك — النتيجة على التلفزيون" : "اختر واحدًا"}
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ */

function MillionBody(p: BodyProps) {
  const { room, me, q, myVote } = p;
  const team = q?.team;
  const finalist = p.players.find((pl) => pl.team === team && pl.is_finalist);
  const iAmFinalist = finalist?.id === me.id;
  const askFamily = room.round_state.askFamilyOpen;
  const askTeam = room.round_state.lifelines?.[team ?? "falcons"]?.askTeam;
  const removed = new Set(room.round_state.removedOptions ?? []);

  // «اسأل العائلة» يفتح التصويت للجميع
  if (askFamily && !iAmFinalist) {
    return (
      <>
        <p className="rounded-2xl bg-gold-500/20 px-4 py-3 text-center text-xl font-black text-gold-300">
          👨‍👩‍👧 ساعد {finalist?.name ?? "البطل"}! وش الإجابة الصح؟
        </p>
        <p className="rounded-2xl bg-black/25 px-4 py-3 text-center text-lg font-bold">{q?.text}</p>
        <div className="flex flex-1 flex-col gap-3">
          {(q?.options ?? []).map((opt, i) => {
            const mine = myVote === String(i);
            return (
              <button
                key={i}
                onClick={() => p.onVote(String(i))}
                className={`tap flex min-h-[3.75rem] items-center gap-3 rounded-2xl px-4 py-3 text-right transition active:scale-[.97] ${
                  mine ? "bg-gold-500 text-ink" : "bg-white/10"
                }`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-black/30 text-lg font-black">
                  {LATIN[i]}
                </span>
                <span className="flex-1 text-lg font-bold">{opt}</span>
                {mine && "✓"}
              </button>
            );
          })}
        </div>
      </>
    );
  }

  if (!iAmFinalist) {
    return (
      <Center emoji="🎯">
        <div className="text-2xl font-black">
          {finalist ? `دور ${finalist.name}` : `دور بطل ${team ? TEAMS[team].name : ""}`}
        </div>
        <p className="mt-3 text-lg text-white/60">
          {askTeam && team === me.team
            ? "🤝 ساعد بطلك بصوتك من الجلسة!"
            : "تابع على التلفزيون 📺"}
        </p>
      </Center>
    );
  }

  // شاشة البطل
  return (
    <>
      <div className="rounded-2xl bg-gold-500 px-4 py-3 text-center text-xl font-black text-ink">
        🎯 دورك — {q?.points.toLocaleString("ar-SA")} نقطة
      </div>
      <p className="rounded-2xl bg-black/25 px-4 py-3 text-center text-lg font-bold leading-relaxed">{q?.text}</p>
      <div className="flex flex-1 flex-col gap-3">
        {(q?.options ?? []).map((opt, i) => {
          const isRemoved = removed.has(i);
          const mine = p.myAnswer === String(i);
          const revealed = room.phase === "reveal";
          const isCorrect = revealed && i === q?.answer;
          return (
            <button
              key={i}
              onClick={() => !isRemoved && room.phase === "question" && p.onAnswer(String(i))}
              disabled={isRemoved || room.phase !== "question"}
              className={`tap flex min-h-[3.75rem] items-center gap-3 rounded-2xl px-4 py-3 text-right transition active:scale-[.97] ${
                isRemoved ? "opacity-15 line-through" : isCorrect ? "bg-saudi-500" : mine ? "bg-gold-500 text-ink" : "bg-white/10"
              }`}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-black/30 text-lg font-black">
                {LATIN[i]}
              </span>
              <span className="flex-1 text-lg font-bold">{opt}</span>
              {isCorrect && "✅"}
            </button>
          );
        })}
      </div>
      <p className="text-center text-sm text-white/50">قل إجابتك بصوت عالٍ — المقدّم يحكم</p>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Center({ emoji, children }: { emoji: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 text-7xl">{emoji}</div>
      {children}
    </div>
  );
}

