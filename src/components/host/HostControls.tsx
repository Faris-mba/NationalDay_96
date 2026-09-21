"use client";

import { useState } from "react";
import { TEAMS } from "@/lib/types";
import type { Buzz, Player, Room, Team } from "@/lib/types";

interface Props {
  room: Room;
  players: Player[];
  buzzes: Buzz[];
  busy: boolean;
  muted: boolean;
  progress: { current: number; total: number };
  onStart: () => void;
  onNext: () => void;
  onBack: () => void;
  onReveal: () => void;
  onPause: () => void;
  onSkipQuestion: () => void;
  onSkipRound: () => void;
  onAddTime: (s: number) => void;
  onZoom: (step: number) => void;
  onAdjust: (team: Team, delta: number) => void;
  onJudgeBuzz: (buzz: Buzz, correct: boolean) => void;
  onJudgeMillion: (correct: boolean) => void;
  onLifeline: (team: Team, l: "fiftyFifty" | "askFamily" | "askTeam") => void;
  onShowVotes: () => void;
  onSetFinalist: (team: Team, playerId: string | null) => void;
  onToggleMute: () => void;
  onReset: () => void;
}

const btn =
  "tap rounded-2xl px-5 py-4 text-xl font-black transition active:scale-95 disabled:opacity-35 disabled:active:scale-100";

export default function HostControls(p: Props) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"main" | "scores" | "players">("main");
  const q = p.room.current_question;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="tap fixed bottom-4 left-4 z-40 rounded-2xl bg-black/70 px-6 py-3 text-xl font-bold backdrop-blur"
      >
        🎛️ إظهار لوحة التحكم
      </button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-gold-500/30 bg-black/85 backdrop-blur-xl">
      <div className="mx-auto max-w-[1800px] px-5 py-3">
        <div className="mb-3 flex items-center gap-3">
          {(
            [
              ["main", "🎛️ التحكم"],
              ["scores", "🔢 النقاط"],
              ["players", "👥 اللاعبون"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`tap rounded-xl px-4 py-2 text-lg font-bold ${
                tab === key ? "bg-gold-500 text-ink" : "bg-white/10 text-white/70"
              }`}
            >
              {label}
            </button>
          ))}

          <span className="mr-auto text-lg text-white/50">
            {p.room.phase !== "lobby" && p.room.phase !== "finished" && (
              <>
                سؤال {p.progress.current} من {p.progress.total} ·{" "}
              </>
            )}
            {p.busy ? "…جارٍ الحفظ" : "متصل"}
          </span>

          <button onClick={p.onToggleMute} className="tap rounded-xl bg-white/10 px-4 py-2 text-lg">
            {p.muted ? "🔇 مكتوم" : "🔊 الصوت"}
          </button>
          <button onClick={() => setOpen(false)} className="tap rounded-xl bg-white/10 px-4 py-2 text-lg">
            إخفاء ⌄
          </button>
        </div>

        {tab === "main" && (
          <div className="flex flex-wrap items-center gap-3">
            {p.room.phase === "lobby" ? (
              <button
                onClick={p.onStart}
                disabled={p.busy || p.players.length === 0}
                className={`${btn} bg-saudi-600 px-10 text-2xl hover:bg-saudi-500`}
              >
                ▶️ ابدأ اللعبة
              </button>
            ) : (
              <>
                <button onClick={p.onBack} disabled={p.busy} className={`${btn} bg-white/10`}>
                  ⏮ السابق
                </button>

                {p.room.phase === "question" && (
                  <button onClick={p.onReveal} disabled={p.busy} className={`${btn} bg-gold-500 text-ink`}>
                    👁️ إظهار الإجابة
                  </button>
                )}

                <button onClick={p.onNext} disabled={p.busy} className={`${btn} bg-saudi-600 px-10 text-2xl`}>
                  {p.room.phase === "question" ? "⏭ التالي" : "⏭ السؤال التالي"}
                </button>

                <button onClick={p.onPause} disabled={p.busy} className={`${btn} bg-white/10`}>
                  {p.room.paused_at ? "▶️ متابعة" : "⏸ إيقاف مؤقت"}
                </button>

                <button onClick={() => p.onAddTime(10)} disabled={p.busy} className={`${btn} bg-white/10`}>
                  ⏱️ +10 ثوانٍ
                </button>

                <button onClick={p.onSkipQuestion} disabled={p.busy} className={`${btn} bg-white/10`}>
                  ⤵️ تخطّي السؤال
                </button>
                <button onClick={p.onSkipRound} disabled={p.busy} className={`${btn} bg-white/10`}>
                  ⏩ تخطّي الجولة
                </button>

                {q?.round === "image" && (
                  <div className="flex items-center gap-2 rounded-2xl bg-white/5 px-3 py-2">
                    <span className="text-lg text-white/60">التقريب</span>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        onClick={() => p.onZoom(s)}
                        className={`tap h-11 w-11 rounded-xl text-lg font-black ${
                          (p.room.round_state.zoomStep ?? 1) === s ? "bg-gold-500 text-ink" : "bg-white/10"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                    <button
                      onClick={() => p.onZoom((p.room.round_state.zoomStep ?? 1) + 1)}
                      className={`${btn} bg-white/10 py-2`}
                    >
                      🔍 وسّع
                    </button>
                  </div>
                )}

                {q?.round === "family" && (
                  <button onClick={p.onShowVotes} disabled={p.busy} className={`${btn} bg-gold-500 text-ink`}>
                    📊 اعرض النتائج
                  </button>
                )}

                {q?.round === "buzzer" && <BuzzJudge {...p} />}

                {q?.round === "million" && <MillionControls {...p} />}
              </>
            )}

            <button onClick={p.onReset} disabled={p.busy} className={`${btn} mr-auto bg-red-900/60 text-lg`}>
              ♻️ إعادة ضبط اللعبة
            </button>
          </div>
        )}

        {tab === "scores" && (
          <div className="flex flex-wrap gap-5">
            {(["falcons", "elite"] as Team[]).map((team) => (
              <div
                key={team}
                className="flex items-center gap-2 rounded-2xl px-4 py-3"
                style={{ background: `${TEAMS[team].color}22` }}
              >
                <span className="ml-2 text-2xl font-black">
                  {TEAMS[team].emoji} {TEAMS[team].name}
                </span>
                <span className="w-24 text-center text-3xl font-black tabular-nums">
                  {(team === "falcons" ? p.room.score_falcons : p.room.score_elite).toLocaleString("ar-SA")}
                </span>
                {[-500, -100, -50, +50, +100, +500].map((d) => (
                  <button
                    key={d}
                    onClick={() => p.onAdjust(team, d)}
                    disabled={p.busy}
                    className={`${btn} bg-white/10 px-4 py-2 text-lg`}
                  >
                    {d > 0 ? `+${d}` : d}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {tab === "players" && (
          <div className="thin-scroll flex max-h-44 flex-wrap gap-2 overflow-y-auto">
            {p.players.length === 0 && <span className="text-lg text-white/50">لا يوجد لاعبون بعد</span>}
            {p.players.map((pl) => (
              <div
                key={pl.id}
                className="flex items-center gap-2 rounded-2xl px-3 py-2"
                style={{ background: `${TEAMS[pl.team].color}22` }}
              >
                <span className="text-lg font-bold">
                  {pl.category === "kid" ? "🧒 " : ""}
                  {pl.name}
                </span>
                <span className="text-lg tabular-nums text-white/60">{pl.score}</span>
                {pl.is_finalist && <span title="بطل المليون">🎯</span>}
                <button
                  onClick={() => p.onSetFinalist(pl.team, pl.is_finalist ? null : pl.id)}
                  className="tap rounded-lg bg-white/10 px-2 py-1 text-sm"
                >
                  {pl.is_finalist ? "إلغاء البطل" : "اجعله بطل الفريق"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BuzzJudge(p: Props) {
  const byId = new Map(p.players.map((x) => [x.id, x]));
  const pending = p.buzzes.find((b) => b.verdict === null);
  if (!pending) return <span className="text-lg text-white/50">بانتظار ضغطة بازر…</span>;
  const player = byId.get(pending.player_id);

  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-2">
      <span className="text-xl font-black">{player?.name ?? "لاعب"} :</span>
      <button onClick={() => p.onJudgeBuzz(pending, true)} disabled={p.busy} className={`${btn} bg-saudi-600`}>
        ✅ صح
      </button>
      <button onClick={() => p.onJudgeBuzz(pending, false)} disabled={p.busy} className={`${btn} bg-red-800`}>
        ❌ خطأ
      </button>
    </div>
  );
}

function MillionControls(p: Props) {
  const team = p.room.current_question?.team ?? "falcons";
  const used = p.room.round_state.lifelines?.[team] ?? {};

  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-2">
      <button
        onClick={() => p.onLifeline(team, "fiftyFifty")}
        disabled={p.busy || !!used.fiftyFifty}
        className={`${btn} bg-white/10 py-2 text-lg`}
      >
        ✂️ حذف إجابتين
      </button>
      <button
        onClick={() => p.onLifeline(team, "askFamily")}
        disabled={p.busy || !!used.askFamily}
        className={`${btn} bg-white/10 py-2 text-lg`}
      >
        👨‍👩‍👧 اسأل العائلة
      </button>
      <button
        onClick={() => p.onLifeline(team, "askTeam")}
        disabled={p.busy || !!used.askTeam}
        className={`${btn} bg-white/10 py-2 text-lg`}
      >
        🤝 مساعدة الفريق
      </button>
      {p.room.round_state.askFamilyOpen && (
        <button onClick={p.onShowVotes} disabled={p.busy} className={`${btn} bg-gold-500 py-2 text-lg text-ink`}>
          📊 اعرض التصويت
        </button>
      )}
      <span className="mx-2 w-px self-stretch bg-white/20" />
      <button onClick={() => p.onJudgeMillion(true)} disabled={p.busy} className={`${btn} bg-saudi-600`}>
        ✅ صح
      </button>
      <button onClick={() => p.onJudgeMillion(false)} disabled={p.busy} className={`${btn} bg-red-800`}>
        ❌ خطأ
      </button>
    </div>
  );
}
