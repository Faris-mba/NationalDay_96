"use client";

import { useMemo } from "react";
import Timer from "@/components/Timer";
import ZoomImage from "@/components/ZoomImage";
import QrJoin from "@/components/QrJoin";
import { tallyVotes } from "@/lib/useQuestionData";
import { MILLION_LADDER, ROUND_META, TEAMS } from "@/lib/types";
import type { Answer, Buzz, Player, Room, Team, Vote } from "@/lib/types";

const LETTERS = ["أ", "ب", "ج", "د"];


interface Props {
  room: Room;
  players: Player[];
  onlineIds: Set<string>;
  answers: Answer[];
  buzzes: Buzz[];
  votes: Vote[];
  joinUrl: string;
  remaining: number;
  total: number;
  running: boolean;
}

export default function HostStage(props: Props) {
  const { room } = props;

  if (room.phase === "lobby") return <Lobby {...props} />;
  if (room.phase === "finished") return <Finished {...props} />;
  return <QuestionStage {...props} />;
}

/* ------------------------------------------------------------------ */

function Lobby({ room, players, onlineIds, joinUrl }: Props) {
  const falcons = players.filter((p) => p.team === "falcons");
  const elite = players.filter((p) => p.team === "elite");

  return (
    <div className="flex flex-1 items-center gap-10">
      <div className="flex flex-col items-center gap-6">
        <QrJoin url={joinUrl} size={400} />
        <div className="text-center">
          <div className="text-2xl text-white/60">امسح الرمز أو افتح</div>
          <div className="mt-1 text-3xl font-bold text-gold-300" dir="ltr">
            {joinUrl.replace(/^https?:\/\//, "")}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-6">
        <div>
          <div className="text-3xl text-white/70">رمز الغرفة</div>
          <div
            className="gold-text text-[11rem] font-black leading-none tracking-[0.15em]"
            dir="ltr"
          >
            {room.code}
          </div>
        </div>

        <div className="flex gap-5">
          {([["falcons", falcons], ["elite", elite]] as Array<[Team, Player[]]>).map(([team, list]) => (
            <div
              key={team}
              className="flex-1 rounded-3xl p-5"
              style={{ background: `${TEAMS[team].color}1f`, border: `2px solid ${TEAMS[team].color}77` }}
            >
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-4xl font-black">
                  {TEAMS[team].emoji} {TEAMS[team].name}
                </span>
                <span className="text-3xl font-black" style={{ color: TEAMS[team].color }}>
                  {list.length}
                </span>
              </div>
              <ul className="flex flex-wrap gap-2">
                {list.map((p) => (
                  <li
                    key={p.id}
                    className={`animate-pop-in rounded-full px-4 py-2 text-2xl font-bold ${
                      onlineIds.has(p.id) ? "bg-white/15" : "bg-white/5 text-white/45"
                    }`}
                  >
                    {p.category === "kid" ? "🧒 " : ""}
                    {p.name}
                  </li>
                ))}
                {list.length === 0 && <li className="py-2 text-2xl text-white/40">بانتظار اللاعبين…</li>}
              </ul>
            </div>
          ))}
        </div>

        <div className="text-2xl text-white/50">
          {players.length === 0
            ? "افتح جوالك وامسح الرمز للانضمام"
            : `انضم ${players.length} لاعب — اضغط «ابدأ اللعبة» متى ما جهزتم`}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function QuestionStage(props: Props) {
  const { room, players, answers, buzzes, votes, remaining, total, running } = props;
  const q = room.current_question;

  const answeredCount = answers.length;
  const eligible = useMemo(
    () => (q?.kidsOnly ? players.filter((p) => p.category === "kid") : players),
    [players, q?.kidsOnly]
  );

  if (!q) {
    return (
      <div className="flex flex-1 items-center justify-center text-5xl text-white/60">
        جارٍ تحضير السؤال…
      </div>
    );
  }

  const meta = ROUND_META[q.round];
  const revealed = room.phase === "reveal";

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* رأس الجولة */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-4">
            <span className="text-6xl">{meta.emoji}</span>
            <div>
              <div className="text-5xl font-black">{meta.title}</div>
              <div className="text-2xl text-white/60">{meta.subtitle}</div>
            </div>
          </div>
          {q.round === "dialect" && q.region && (
            <div className="mt-3 inline-block rounded-full bg-gold-500/20 px-5 py-2 text-3xl font-bold text-gold-300">
              من لهجة: {q.region}
            </div>
          )}
          {q.kidsOnly && (
            <div className="mt-3 inline-block animate-pulse-ring rounded-full bg-gold-500 px-6 py-2 text-3xl font-black text-ink">
              🧒 دور الصغار — النقاط مضاعفة!
            </div>
          )}
          {q.round === "million" && q.team && (
            <div
              className="mt-3 inline-block rounded-full px-6 py-2 text-3xl font-black"
              style={{ background: `${TEAMS[q.team].color}33`, color: TEAMS[q.team].color }}
            >
              🎯 دور بطل {TEAMS[q.team].name} — {q.points.toLocaleString("ar-SA")} نقطة
            </div>
          )}
        </div>

        <div className="flex items-center gap-6">
          {q.round !== "buzzer" && q.round !== "million" && (
            <div className="text-center">
              <div className="text-6xl font-black tabular-nums">
                {answeredCount}
                <span className="text-3xl text-white/50">/{eligible.length}</span>
              </div>
              <div className="text-xl text-white/50">جاوبوا</div>
            </div>
          )}
          {room.paused_at ? (
            <div className="rounded-3xl bg-gold-500 px-8 py-6 text-4xl font-black text-ink">⏸ إيقاف مؤقت</div>
          ) : (
            <Timer remaining={remaining} total={total} running={running} size="tv" withSound />
          )}
        </div>
      </div>

      {/* نص السؤال */}
      <div className="card gold-border px-10 py-8">
        <h2 className="text-center text-6xl font-black leading-snug">{q.text}</h2>
      </div>

      {/* المحتوى حسب نوع الجولة */}
      {q.round === "image" && q.image && (
        <div className="flex flex-1 gap-8">
          <ZoomImage
            src={q.image}
            step={revealed ? 5 : room.round_state.zoomStep ?? 1}
            label={q.options?.[q.answer ?? 0] ?? "معلم سعودي"}
            className="aspect-[3/2] flex-1"
          />
          <div className="flex w-[38%] flex-col justify-center gap-4">
            <Options q={q} revealed={revealed} answers={answers} players={players} compact />
          </div>
        </div>
      )}

      {q.round === "buzzer" && <BuzzerStage {...props} />}

      {q.round === "family" && <FamilyStage {...props} />}

      {q.round === "million" && <MillionStage {...props} />}

      {(q.round === "trivia" || q.round === "kids" || q.round === "dialect") && (
        <div className="flex-1">
          <Options q={q} revealed={revealed} answers={answers} players={players} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Options({
  q,
  revealed,
  answers,
  players,
  compact,
}: {
  q: NonNullable<Room["current_question"]>;
  revealed: boolean;
  answers: Answer[];
  players: Player[];
  compact?: boolean;
}) {
  if (!q.options) return null;
  const byPlayer = new Map(players.map((p) => [p.id, p]));

  const countFor = (i: number) => answers.filter((a) => a.answer === String(i)).length;
  const correctNames = revealed
    ? answers
        .filter((a) => a.answer === String(q.answer))
        .map((a) => byPlayer.get(a.player_id)?.name)
        .filter(Boolean)
    : [];

  return (
    <div className="flex h-full flex-col gap-4">
      <div className={`grid gap-4 ${compact ? "grid-cols-1" : "grid-cols-2"}`}>
        {q.options.map((opt, i) => {
          const isCorrect = revealed && i === q.answer;
          const isWrong = revealed && i !== q.answer;
          return (
            <div
              key={i}
              className={`flex items-center gap-5 rounded-3xl px-7 transition-all duration-500 ${
                compact ? "py-4" : "py-7"
              } ${
                isCorrect
                  ? "scale-[1.02] bg-saudi-500 shadow-[0_0_60px_rgba(10,143,74,.6)]"
                  : isWrong
                    ? "bg-white/5 opacity-40"
                    : "bg-white/10"
              }`}
            >
              <span
                className={`grid shrink-0 place-items-center rounded-2xl font-black ${
                  compact ? "h-12 w-12 text-2xl" : "h-16 w-16 text-4xl"
                } ${isCorrect ? "bg-white text-saudi-700" : "bg-gold-500 text-ink"}`}
              >
                {LETTERS[i]}
              </span>
              <span className={`flex-1 font-bold ${compact ? "text-3xl" : "text-4xl"}`}>{opt}</span>
              {revealed && (
                <span className={`tabular-nums font-black ${compact ? "text-2xl" : "text-3xl"} text-white/70`}>
                  {countFor(i)}
                </span>
              )}
              {isCorrect && <span className={compact ? "text-3xl" : "text-5xl"}>✅</span>}
            </div>
          );
        })}
      </div>

      {revealed && (
        <div className="animate-slide-up rounded-3xl bg-black/30 px-8 py-5 text-3xl">
          {correctNames.length ? (
            <>
              <span className="font-black text-saudi-300">أجابوا صح: </span>
              {correctNames.join("، ")}
            </>
          ) : (
            <span className="text-white/60">ما أحد جاوب صح هالمرة 😅</span>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function BuzzerStage({ room, players, buzzes }: Props) {
  const q = room.current_question!;
  const byId = new Map(players.map((p) => [p.id, p]));
  const first = buzzes[0];
  const firstPlayer = first ? byId.get(first.player_id) : null;
  const turn = room.round_state.buzzerTurn;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      {turn && (
        <div
          className="rounded-full px-10 py-4 text-4xl font-black"
          style={{ background: `${TEAMS[turn].color}33`, color: TEAMS[turn].color }}
        >
          ↪️ الفرصة الآن لفريق {TEAMS[turn].name}
        </div>
      )}

      {!first ? (
        <div className="animate-pulse text-center">
          <div className="text-[9rem] leading-none">⚡</div>
          <div className="text-6xl font-black text-gold-300">اضغطوا البازر!</div>
        </div>
      ) : (
        <div className="animate-pop-in text-center">
          <div className="text-4xl text-white/60">أول من ضغط</div>
          <div
            className="my-3 text-8xl font-black"
            style={{ color: firstPlayer ? TEAMS[firstPlayer.team].color : "#fff" }}
          >
            {firstPlayer?.name ?? "…"}
          </div>
          <div className="text-4xl text-white/70">
            {firstPlayer ? `${TEAMS[firstPlayer.team].emoji} ${TEAMS[firstPlayer.team].name}` : ""}
          </div>
        </div>
      )}

      {buzzes.length > 1 && (
        <div className="flex flex-wrap justify-center gap-3 text-2xl text-white/60">
          {buzzes.slice(1, 6).map((b, i) => (
            <span key={b.id} className="rounded-full bg-white/10 px-5 py-2">
              {i + 2}. {byId.get(b.player_id)?.name ?? "—"}
            </span>
          ))}
        </div>
      )}

      {room.phase === "reveal" && q.answerText && (
        <div className="animate-slide-up rounded-3xl bg-saudi-600 px-10 py-6 text-center">
          <div className="text-2xl text-white/70">الإجابة</div>
          <div className="text-6xl font-black">{q.answerText}</div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FamilyStage({ room, votes, players }: Props) {
  const q = room.current_question!;
  const options = q.familyOptions ?? [];
  const show = room.phase === "reveal" || room.round_state.showVotes;
  const results = tallyVotes(votes, options);

  if (!show) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="text-[8rem] leading-none">🗳️</div>
        <div className="text-6xl font-black text-gold-300">صوّتوا من جوالاتكم!</div>
        <div className="text-4xl text-white/60">
          صوّت {votes.length} من {players.length}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col justify-center gap-4">
      {results.map((r, i) => (
        <div key={r.label} className="flex items-center gap-5">
          <span className="w-64 shrink-0 truncate text-left text-4xl font-black">{r.label}</span>
          <div className="h-16 flex-1 overflow-hidden rounded-2xl bg-white/10">
            <div
              className="flex h-full animate-bar-grow items-center justify-end rounded-2xl pl-4"
              style={
                {
                  "--bar-w": `${Math.max(4, r.pct)}%`,
                  background:
                    i === 0
                      ? "linear-gradient(90deg,#D4AF37,#f4dd8f)"
                      : "linear-gradient(90deg,#0a8f4a,#5fb98c)",
                  animationDelay: `${i * 90}ms`,
                } as React.CSSProperties
              }
            >
              <span className={`text-3xl font-black ${i === 0 ? "text-ink" : "text-white"}`}>{r.pct}%</span>
            </div>
          </div>
          <span className="w-20 shrink-0 text-3xl font-bold tabular-nums text-white/60">{r.count}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MillionStage(props: Props) {
  const { room, answers, players, votes } = props;
  const q = room.current_question!;
  const team = q.team ?? "falcons";
  const revealed = room.phase === "reveal";
  const removed = new Set(room.round_state.removedOptions ?? []);
  const lifelines = room.round_state.lifelines?.[team] ?? {};
  const finalist = players.find((p) => p.team === team && p.is_finalist);
  const askFamily = room.round_state.askFamilyOpen;

  return (
    <div className="flex flex-1 gap-8">
      {/* سلّم النقاط */}
      <div className="flex w-64 shrink-0 flex-col-reverse justify-center gap-2">
        {MILLION_LADDER.map((value) => {
          const active = value === q.points;
          const passed = (room.round_state.ladder?.[team] ?? 0) >= value;
          return (
            <div
              key={value}
              className={`rounded-2xl px-5 py-3 text-3xl font-black tabular-nums transition-all ${
                active
                  ? "scale-105 bg-gold-500 text-ink shadow-[0_0_40px_rgba(212,175,55,.5)]"
                  : passed
                    ? "bg-saudi-600 text-white"
                    : "bg-white/5 text-white/40"
              }`}
            >
              {value.toLocaleString("ar-SA")}
            </div>
          );
        })}
      </div>

      <div className="flex flex-1 flex-col justify-center gap-5">
        {finalist && (
          <div className="text-3xl text-white/70">
            البطل: <span className="font-black text-white">{finalist.name}</span>
          </div>
        )}

        {askFamily ? (
          <div className="flex flex-col gap-3">
            <div className="text-4xl font-black text-gold-300">👨‍👩‍👧 اسأل العائلة</div>
            {tallyVotes(votes, (q.options ?? []).map((_, i) => String(i))).map((r) => {
              const idx = Number(r.label);
              return (
                <div key={r.label} className="flex items-center gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gold-500 text-2xl font-black text-ink">
                    {LETTERS[idx]}
                  </span>
                  <span className="w-72 shrink-0 truncate text-3xl font-bold">{q.options?.[idx]}</span>
                  <div className="h-12 flex-1 overflow-hidden rounded-xl bg-white/10">
                    <div
                      className="h-full animate-bar-grow rounded-xl bg-gradient-to-l from-saudi-500 to-saudi-300"
                      style={{ "--bar-w": `${Math.max(3, r.pct)}%` } as React.CSSProperties}
                    />
                  </div>
                  <span className="w-20 text-3xl font-black tabular-nums">{r.pct}%</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {(q.options ?? []).map((opt, i) => {
              const isCorrect = revealed && i === q.answer;
              return (
                <div
                  key={i}
                  className={`flex items-center gap-4 rounded-3xl px-6 py-6 transition-all ${
                    removed.has(i)
                      ? "opacity-15"
                      : isCorrect
                        ? "scale-[1.02] bg-saudi-500 shadow-[0_0_60px_rgba(10,143,74,.6)]"
                        : "bg-white/10"
                  }`}
                >
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gold-500 text-3xl font-black text-ink">
                    {LETTERS[i]}
                  </span>
                  <span className="text-4xl font-bold">{opt}</span>
                  {isCorrect && <span className="mr-auto text-5xl">✅</span>}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-4 text-2xl">
          {[
            ["fiftyFifty", "✂️ حذف إجابتين"],
            ["askFamily", "👨‍👩‍👧 اسأل العائلة"],
            ["askTeam", "🤝 مساعدة الفريق"],
          ].map(([key, label]) => (
            <span
              key={key}
              className={`rounded-full px-6 py-3 font-bold ${
                lifelines[key as keyof typeof lifelines]
                  ? "bg-white/5 text-white/30 line-through"
                  : "bg-gold-500/20 text-gold-300"
              }`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Finished({ room, players }: Props) {
  const falcons = room.score_falcons;
  const elite = room.score_elite;
  const winner: Team | "tie" = falcons === elite ? "tie" : falcons > elite ? "falcons" : "elite";

  const top = [...players].sort((a, b) => b.score - a.score).slice(0, 5);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
      <div className="text-[7rem] leading-none">🏆</div>
      {winner === "tie" ? (
        <div className="text-8xl font-black gold-text">تعادل! كلكم فائزون 🇸🇦</div>
      ) : (
        <>
          <div className="text-4xl text-white/70">الفريق الفائز</div>
          <div className="text-[9rem] font-black leading-none" style={{ color: TEAMS[winner].color }}>
            {TEAMS[winner].emoji} {TEAMS[winner].name}
          </div>
          <div className="text-6xl font-black gold-text">
            {Math.max(falcons, elite).toLocaleString("ar-SA")} نقطة
          </div>
        </>
      )}

      {top.length > 0 && (
        <div className="mt-4 w-full max-w-4xl">
          <div className="mb-3 text-3xl text-white/60">أفضل اللاعبين</div>
          <div className="flex flex-wrap justify-center gap-3">
            {top.map((p, i) => (
              <span key={p.id} className="rounded-full bg-white/10 px-6 py-3 text-3xl font-bold">
                {["🥇", "🥈", "🥉", "٤.", "٥."][i]} {p.name} — {p.score.toLocaleString("ar-SA")}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 text-4xl text-gold-300">كل عام والوطن بخير 🇸🇦</div>
    </div>
  );
}

