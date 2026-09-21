"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { balancedTeam, fetchPlayers, fetchRoom, joinRoom } from "@/lib/game";
import { getClientId, recallPlayer, rememberPlayer } from "@/lib/identity";
import { supabaseConfigured } from "@/lib/supabase";
import { TEAMS, type Player, type PlayerCategory, type Room, type Team } from "@/lib/types";
import { unlockAudio } from "@/lib/sound";

type TeamChoice = Team | "auto";

export default function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const upper = (code ?? "").toUpperCase();
  const router = useRouter();

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<PlayerCategory>("adult");
  const [team, setTeam] = useState<TeamChoice>("auto");
  const [submitting, setSubmitting] = useState(false);

  // تحميل الغرفة + استعادة اللاعب لو انضم من قبل على هذا الجهاز
  useEffect(() => {
    if (!supabaseConfigured) {
      setError("إعدادات Supabase ناقصة — راجع README");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchRoom(upper);
        if (cancelled) return;
        if (!r) {
          setError("ما لقينا غرفة بهذا الرمز. تأكد من الرمز المعروض على التلفزيون.");
          setLoading(false);
          return;
        }
        setRoom(r);
        setPlayers(await fetchPlayers(r.id));

        const saved = recallPlayer(upper);
        if (saved) {
          setName(saved.name);
          setCategory((saved.category as PlayerCategory) ?? "adult");
          setTeam((saved.team as Team) ?? "auto");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "تعذّر الاتصال");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [upper]);

  const autoTeam = useMemo(() => (players.length ? balancedTeam(players) : "falcons"), [players]);
  const counts = useMemo(
    () => ({
      falcons: players.filter((p) => p.team === "falcons").length,
      elite: players.filter((p) => p.team === "elite").length,
    }),
    [players]
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room || submitting) return;
    const clean = name.trim();
    if (clean.length < 2) {
      setError("اكتب اسمك (حرفين على الأقل)");
      return;
    }

    setSubmitting(true);
    setError(null);
    unlockAudio(); // نفتح الصوت الآن لأن هذه أول لمسة من اللاعب
    try {
      const player = await joinRoom({
        roomId: room.id,
        clientId: getClientId(),
        name: clean,
        category,
        team,
      });
      rememberPlayer(upper, {
        playerId: player.id,
        name: player.name,
        team: player.team,
        category: player.category,
      });
      router.replace(`/play/${upper}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الانضمام، جرّب مرة ثانية");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="animate-pulse text-3xl text-white/60">لحظة…</div>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div className="card w-full max-w-md p-8">
          <div className="mb-4 text-6xl">🤔</div>
          <p className="text-2xl">{error}</p>
          <Link href="/" className="mt-6 inline-block rounded-2xl bg-saudi-600 px-8 py-4 text-xl font-black">
            الصفحة الرئيسية
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-5 py-8">
      <header className="text-center">
        <div className="text-5xl">🇸🇦</div>
        <h1 className="mt-2 text-4xl font-black">
          تحدي <span className="gold-text">العائلة</span>
        </h1>
        <p className="mt-2 text-xl text-white/60">
          غرفة <span className="font-black tracking-widest text-gold-300" dir="ltr">{room.code}</span>
        </p>
      </header>

      <form onSubmit={submit} className="flex flex-col gap-6">
        {/* الاسم */}
        <div>
          <label htmlFor="name" className="mb-2 block text-2xl font-bold">
            وش اسمك؟
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 20))}
            placeholder="اكتب اسمك هنا"
            autoComplete="off"
            className="w-full rounded-2xl bg-black/30 px-5 py-5 text-center text-3xl font-bold outline-none ring-2 ring-white/15 focus:ring-gold-500"
          />
        </div>

        {/* الفئة */}
        <div>
          <span className="mb-2 block text-2xl font-bold">أنت من؟</span>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["kid", "🧒 صغير", "لك أسئلة خاصة بنقاط مضاعفة"],
                ["adult", "🧔 كبير", "الأسئلة العامة"],
              ] as const
            ).map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className={`tap rounded-2xl p-4 text-right transition active:scale-95 ${
                  category === value ? "bg-gold-500 text-ink" : "bg-white/10"
                }`}
              >
                <div className="text-2xl font-black">{label}</div>
                <div className={`text-sm ${category === value ? "text-ink/70" : "text-white/50"}`}>{hint}</div>
              </button>
            ))}
          </div>
        </div>

        {/* الفريق */}
        <div>
          <span className="mb-2 block text-2xl font-bold">فريقك</span>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setTeam("auto")}
              className={`tap rounded-2xl p-4 text-right transition active:scale-95 ${
                team === "auto" ? "bg-gold-500 text-ink" : "bg-white/10"
              }`}
            >
              <div className="text-2xl font-black">🎲 وزّعوني تلقائيًا</div>
              <div className={`text-sm ${team === "auto" ? "text-ink/70" : "text-white/50"}`}>
                بيتم ضمّك لفريق {TEAMS[autoTeam].name} ليبقى الفريقان متوازنين
              </div>
            </button>

            <div className="grid grid-cols-2 gap-3">
              {(["falcons", "elite"] as Team[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTeam(t)}
                  className="tap rounded-2xl p-4 transition active:scale-95"
                  style={{
                    background: team === t ? TEAMS[t].color : "rgba(255,255,255,.08)",
                    color: team === t && t === "elite" ? "#04140b" : "#fff",
                    border: `2px solid ${team === t ? TEAMS[t].color : "transparent"}`,
                  }}
                >
                  <div className="text-3xl">{TEAMS[t].emoji}</div>
                  <div className="text-2xl font-black">{TEAMS[t].name}</div>
                  <div className={`text-sm ${team === t ? "opacity-70" : "text-white/50"}`}>
                    {counts[t]} لاعب
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="rounded-2xl bg-red-900/40 px-4 py-3 text-center text-lg">{error}</p>}

        <button
          type="submit"
          disabled={submitting || name.trim().length < 2}
          className="tap rounded-3xl bg-saudi-600 py-6 text-3xl font-black shadow-xl transition active:scale-[.98] disabled:opacity-40"
        >
          {submitting ? "جارٍ الانضمام…" : "يلا نبدأ! 🚀"}
        </button>

        <p className="text-center text-sm text-white/40">
          يُحفظ اسمك على هذا الجوال، فلو أغلقت الصفحة ترجع لنفس الفريق ونفس نقاطك.
        </p>
      </form>
    </main>
  );
}
