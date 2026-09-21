"use client";

import { getSupabase } from "./supabase";
import { buildPlaylist, mergeSettings, type Segment } from "./questions";
import type {
  ActiveQuestion,
  Answer,
  Buzz,
  HostSettings,
  Player,
  PlayerCategory,
  Room,
  RoundState,
  Team,
  Vote,
} from "./types";
import { MILLION_LADDER } from "./types";
import { imagePoints } from "./scoring";
import { balancedTeam } from "./teams";

/* ==================================================================
 *  إنشاء الغرفة والانضمام
 * ================================================================== */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // بلا I و O لتفادي اللبس

function randomCode(): string {
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export async function createRoom(): Promise<Room> {
  const sb = getSupabase();
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode();
    const { data, error } = await sb
      .from("rooms")
      .insert({ code, phase: "lobby", round_state: emptyRoundState() })
      .select()
      .single();

    if (!error && data) return data as Room;
    // 23505 = تعارض رمز موجود مسبقًا ⇒ جرّب رمزًا آخر
    if (error && error.code !== "23505") throw error;
  }
  throw new Error("تعذّر توليد رمز غرفة فريد، حاول مرة أخرى");
}

export function emptyRoundState(): RoundState {
  return {
    lifelines: { falcons: {}, elite: {} },
    ladder: { falcons: 0, elite: 0 },
  };
}

export async function fetchRoom(code: string): Promise<Room | null> {
  const { data, error } = await getSupabase()
    .from("rooms")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return (data as Room) ?? null;
}

export async function fetchRoomById(id: string): Promise<Room | null> {
  const { data, error } = await getSupabase().from("rooms").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Room) ?? null;
}

export async function fetchPlayers(roomId: string): Promise<Player[]> {
  const { data, error } = await getSupabase()
    .from("players")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Player[];
}


export interface JoinInput {
  roomId: string;
  clientId: string;
  name: string;
  category: PlayerCategory;
  team: Team | "auto";
}

export async function joinRoom(input: JoinInput): Promise<Player> {
  const sb = getSupabase();

  // العودة لنفس اللاعب لو كان منضمًا من قبل (نفس الجهاز)
  const { data: existing } = await sb
    .from("players")
    .select("*")
    .eq("room_id", input.roomId)
    .eq("client_id", input.clientId)
    .maybeSingle();

  if (existing) {
    const patch: Partial<Player> = {
      name: input.name,
      category: input.category,
      last_seen_at: new Date().toISOString(),
    };
    // تغيير الفريق يدويًا فقط؛ «auto» لا يعيد توزيع من انضم سابقًا
    if (input.team !== "auto") patch.team = input.team;

    const { data, error } = await sb
      .from("players")
      .update(patch)
      .eq("id", (existing as Player).id)
      .select()
      .single();
    if (error) throw error;
    return data as Player;
  }

  const players = await fetchPlayers(input.roomId);
  const team = input.team === "auto" ? balancedTeam(players) : input.team;

  const { data, error } = await sb
    .from("players")
    .insert({
      room_id: input.roomId,
      client_id: input.clientId,
      name: input.name,
      category: input.category,
      team,
    })
    .select()
    .single();

  if (error) {
    // سباق: جهازان أرسلا في نفس اللحظة ⇒ اقرأ الصف الموجود
    if (error.code === "23505") {
      const { data: again } = await sb
        .from("players")
        .select("*")
        .eq("room_id", input.roomId)
        .eq("client_id", input.clientId)
        .single();
      if (again) return again as Player;
    }
    throw error;
  }
  return data as Player;
}

export async function heartbeat(playerId: string) {
  await getSupabase()
    .from("players")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", playerId);
}

/* ==================================================================
 *  تحكّم المقدّم
 * ================================================================== */

export async function updateRoom(roomId: string, patch: Partial<Room>): Promise<Room> {
  const { data, error } = await getSupabase()
    .from("rooms")
    .update(patch)
    .eq("id", roomId)
    .select()
    .single();
  if (error) throw error;
  return data as Room;
}

export function playlistFor(room: Room): Segment[] {
  return buildPlaylist(room.code, mergeSettings(room.settings));
}

export function questionAt(segments: Segment[], roundIndex: number, stepIndex: number): ActiveQuestion | null {
  return segments[roundIndex]?.questions[stepIndex] ?? null;
}

/** ينتقل إلى موضع محدّد ويكتب نسخة السؤال في صف الغرفة */
export async function goTo(room: Room, roundIndex: number, stepIndex: number): Promise<Room> {
  const segments = playlistFor(room);

  if (roundIndex >= segments.length) {
    return updateRoom(room.id, {
      phase: "finished",
      current_question: null,
      question_started_at: null,
      paused_at: null,
    });
  }

  const question = questionAt(segments, roundIndex, stepIndex);
  if (!question) return room;

  const duration = segments[roundIndex].duration;
  const roundState: RoundState = {
    ...emptyRoundState(),
    lifelines: room.round_state?.lifelines ?? emptyRoundState().lifelines,
    ladder: room.round_state?.ladder ?? emptyRoundState().ladder,
    zoomStep: question.round === "image" ? 1 : undefined,
    buzzerOpen: question.round === "buzzer" ? true : undefined,
    buzzerTurn: null,
    buzzerLockedOut: [],
  };

  return updateRoom(room.id, {
    phase: "question",
    round_index: roundIndex,
    step_index: stepIndex,
    current_question: question,
    question_duration: duration,
    question_started_at: new Date().toISOString(),
    paused_at: null,
    paused_ms: 0,
    round_state: roundState,
  });
}

/** أول سؤال في اللعبة */
export async function startGame(room: Room): Promise<Room> {
  return goTo(room, 0, 0);
}

/** التالي: إن كان معروضًا سؤال ولم تُكشف الإجابة ⇒ اكشفها، وإلا انتقل */
export async function advance(room: Room): Promise<Room> {
  if (room.phase === "lobby") return startGame(room);
  if (room.phase === "finished") return room;

  if (room.phase === "question") return revealAnswer(room);

  const segments = playlistFor(room);
  const segment = segments[room.round_index];
  if (!segment) return updateRoom(room.id, { phase: "finished" });

  if (room.step_index + 1 < segment.questions.length) {
    return goTo(room, room.round_index, room.step_index + 1);
  }
  if (room.round_index + 1 < segments.length) {
    return goTo(room, room.round_index + 1, 0);
  }
  return updateRoom(room.id, { phase: "finished", current_question: null, paused_at: null });
}

/** رجوع خطوة (لو أخطأ المقدّم بالضغط) */
export async function goBack(room: Room): Promise<Room> {
  if (room.phase === "reveal") {
    return updateRoom(room.id, { phase: "question" });
  }
  const segments = playlistFor(room);
  if (room.step_index > 0) return goTo(room, room.round_index, room.step_index - 1);
  if (room.round_index > 0) {
    const prev = segments[room.round_index - 1];
    return goTo(room, room.round_index - 1, Math.max(0, prev.questions.length - 1));
  }
  return room;
}

/** تخطّي السؤال الحالي بلا احتساب نقاط */
export async function skipQuestion(room: Room): Promise<Room> {
  const segments = playlistFor(room);
  const segment = segments[room.round_index];
  if (!segment) return updateRoom(room.id, { phase: "finished" });
  if (room.step_index + 1 < segment.questions.length) {
    return goTo(room, room.round_index, room.step_index + 1);
  }
  if (room.round_index + 1 < segments.length) return goTo(room, room.round_index + 1, 0);
  return updateRoom(room.id, { phase: "finished", current_question: null, paused_at: null });
}

/** تخطّي الجولة كاملة */
export async function skipRound(room: Room): Promise<Room> {
  const segments = playlistFor(room);
  if (room.round_index + 1 < segments.length) return goTo(room, room.round_index + 1, 0);
  return updateRoom(room.id, { phase: "finished", current_question: null, paused_at: null });
}

export async function togglePause(room: Room): Promise<Room> {
  if (room.paused_at) {
    const extra = Date.now() - new Date(room.paused_at).getTime();
    return updateRoom(room.id, {
      paused_at: null,
      paused_ms: room.paused_ms + Math.max(0, extra),
    });
  }
  return updateRoom(room.id, { paused_at: new Date().toISOString() });
}

/** يمنح وقتًا إضافيًا بإزاحة لحظة البدء للأمام */
export async function addTime(room: Room, seconds: number): Promise<Room> {
  if (!room.question_started_at) return room;
  const started = new Date(room.question_started_at).getTime();
  return updateRoom(room.id, {
    question_started_at: new Date(started + seconds * 1000).toISOString(),
  });
}

export async function setZoomStep(room: Room, step: number): Promise<Room> {
  return updateRoom(room.id, {
    round_state: { ...room.round_state, zoomStep: Math.min(5, Math.max(1, step)) },
  });
}

export async function adjustScore(room: Room, team: Team, delta: number): Promise<Room> {
  const key = team === "falcons" ? "score_falcons" : "score_elite";
  const current = team === "falcons" ? room.score_falcons : room.score_elite;
  return updateRoom(room.id, { [key]: Math.max(0, current + delta) } as Partial<Room>);
}

export async function setPlayerScore(playerId: string, score: number) {
  await getSupabase().from("players").update({ score: Math.max(0, score) }).eq("id", playerId);
}

export async function setPlayerTeam(playerId: string, team: Team) {
  await getSupabase().from("players").update({ team }).eq("id", playerId);
}

export async function setFinalist(roomId: string, team: Team, playerId: string | null) {
  const sb = getSupabase();
  // بطل واحد لكل فريق
  await sb.from("players").update({ is_finalist: false }).eq("room_id", roomId).eq("team", team);
  if (playerId) await sb.from("players").update({ is_finalist: true }).eq("id", playerId);
}

export async function removePlayer(playerId: string) {
  await getSupabase().from("players").delete().eq("id", playerId);
}

export async function saveSettings(roomId: string, settings: Partial<HostSettings>) {
  await getSupabase().from("rooms").update({ settings }).eq("id", roomId);
}

export async function resetGame(room: Room): Promise<Room> {
  const sb = getSupabase();
  await Promise.all([
    sb.from("answers").delete().eq("room_id", room.id),
    sb.from("buzzes").delete().eq("room_id", room.id),
    sb.from("votes").delete().eq("room_id", room.id),
    sb.from("players").update({ score: 0, is_finalist: false }).eq("room_id", room.id),
  ]);
  return updateRoom(room.id, {
    phase: "lobby",
    round_index: 0,
    step_index: 0,
    current_question: null,
    question_started_at: null,
    paused_at: null,
    paused_ms: 0,
    score_falcons: 0,
    score_elite: 0,
    round_state: emptyRoundState(),
  });
}

/* ==================================================================
 *  إجابات اللاعبين
 * ================================================================== */

export async function fetchAnswers(roomId: string, questionId: string): Promise<Answer[]> {
  const { data, error } = await getSupabase()
    .from("answers")
    .select("*")
    .eq("room_id", roomId)
    .eq("question_id", questionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Answer[];
}

export async function submitAnswer(args: {
  roomId: string;
  playerId: string;
  question: ActiveQuestion;
  answer: string;
  meta?: Record<string, unknown>;
}) {
  const { error } = await getSupabase().from("answers").upsert(
    {
      room_id: args.roomId,
      player_id: args.playerId,
      question_id: args.question.instanceId,
      round_key: args.question.round,
      answer: args.answer,
      meta: args.meta ?? {},
    },
    { onConflict: "room_id,player_id,question_id" }
  );
  if (error) throw error;
}

export async function submitBuzz(roomId: string, playerId: string, questionId: string) {
  // created_at يُملأ من ساعة Postgres — لا نرسل وقت الجهاز إطلاقًا
  const { error } = await getSupabase()
    .from("buzzes")
    .insert({ room_id: roomId, player_id: playerId, question_id: questionId });
  if (error && error.code !== "23505") throw error;
}

export async function fetchBuzzes(roomId: string, questionId: string): Promise<Buzz[]> {
  const { data, error } = await getSupabase()
    .from("buzzes")
    .select("*")
    .eq("room_id", roomId)
    .eq("question_id", questionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Buzz[];
}

export async function submitVote(roomId: string, playerId: string, questionId: string, choice: string) {
  const { error } = await getSupabase()
    .from("votes")
    .upsert(
      { room_id: roomId, player_id: playerId, question_id: questionId, choice },
      { onConflict: "room_id,player_id,question_id" }
    );
  if (error) throw error;
}

export async function fetchVotes(roomId: string, questionId: string): Promise<Vote[]> {
  const { data, error } = await getSupabase()
    .from("votes")
    .select("*")
    .eq("room_id", roomId)
    .eq("question_id", questionId);
  if (error) throw error;
  return (data ?? []) as Vote[];
}

/* ==================================================================
 *  الاحتساب والكشف
 * ================================================================== */


/**
 * يكشف الإجابة ويحتسب النقاط.
 * يُنفَّذ من شاشة المقدّم فقط (كاتب واحد ⇒ لا تعارض).
 */
export async function revealAnswer(room: Room): Promise<Room> {
  const q = room.current_question;
  if (!q) return updateRoom(room.id, { phase: "reveal" });

  // البازر والمليون يحتسبان بحكم المقدّم، لا بالكشف التلقائي
  if (q.round === "buzzer" || q.round === "million" || q.round === "family") {
    return updateRoom(room.id, {
      phase: "reveal",
      round_state: { ...room.round_state, buzzerOpen: false, showVotes: true },
    });
  }

  const [answers, players] = await Promise.all([
    fetchAnswers(room.id, q.instanceId),
    fetchPlayers(room.id),
  ]);

  const byId = new Map(players.map((p) => [p.id, p]));
  const gained: Record<Team, number> = { falcons: 0, elite: 0 };
  const playerGain = new Map<string, number>();
  const grades: Array<{ id: string; is_correct: boolean; points: number }> = [];

  for (const a of answers) {
    if (a.is_correct !== null) {
      // مُحتسب من قبل (كشف مكرّر) — لا نضاعف النقاط
      continue;
    }
    const player = byId.get(a.player_id);
    if (!player) continue;
    // جولة الصغار: لا تُحتسب إجابات الكبار
    if (q.kidsOnly && player.category !== "kid") {
      grades.push({ id: a.id, is_correct: false, points: 0 });
      continue;
    }

    const correct = q.answer !== undefined && a.answer === String(q.answer);
    let points = 0;
    if (correct) {
      const zoom = typeof a.meta?.zoomStep === "number" ? (a.meta.zoomStep as number) : 1;
      points = q.round === "image" ? imagePoints(q.points, zoom) : q.points;
      gained[player.team] += points;
      playerGain.set(player.id, (playerGain.get(player.id) ?? 0) + points);
    }
    grades.push({ id: a.id, is_correct: correct, points });
  }

  const sb = getSupabase();
  await Promise.all([
    ...grades.map((g) =>
      sb.from("answers").update({ is_correct: g.is_correct, points: g.points }).eq("id", g.id)
    ),
    ...Array.from(playerGain.entries()).map(([id, pts]) => {
      const p = byId.get(id);
      return sb.from("players").update({ score: (p?.score ?? 0) + pts }).eq("id", id);
    }),
  ]);

  return updateRoom(room.id, {
    phase: "reveal",
    score_falcons: room.score_falcons + gained.falcons,
    score_elite: room.score_elite + gained.elite,
  });
}

/** حكم المقدّم على ضغطة بازر */
export async function judgeBuzz(room: Room, buzz: Buzz, correct: boolean): Promise<Room> {
  const sb = getSupabase();
  const q = room.current_question;
  await sb.from("buzzes").update({ verdict: correct ? "correct" : "wrong" }).eq("id", buzz.id);

  const { data: player } = await sb.from("players").select("*").eq("id", buzz.player_id).single();
  const p = player as Player | null;
  if (!p || !q) return room;

  if (correct) {
    await sb.from("players").update({ score: p.score + q.points }).eq("id", p.id);
    const key = p.team === "falcons" ? "score_falcons" : "score_elite";
    const current = p.team === "falcons" ? room.score_falcons : room.score_elite;
    return updateRoom(room.id, {
      [key]: current + q.points,
      phase: "reveal",
      round_state: { ...room.round_state, buzzerOpen: false },
    } as Partial<Room>);
  }

  // خطأ ⇒ الفرصة تنتقل للفريق الثاني، ويُستبعد اللاعب من هذا السؤال
  const other: Team = p.team === "falcons" ? "elite" : "falcons";
  return updateRoom(room.id, {
    round_state: {
      ...room.round_state,
      buzzerOpen: true,
      buzzerTurn: other,
      buzzerLockedOut: [...(room.round_state.buzzerLockedOut ?? []), p.id],
    },
  });
}

/** حكم المقدّم في «المليون السعودي» */
export async function judgeMillion(room: Room, correct: boolean): Promise<Room> {
  const q = room.current_question;
  if (!q || !q.team) return room;

  const ladder = { ...(room.round_state.ladder ?? { falcons: 0, elite: 0 }) };
  const patch: Partial<Room> = { phase: "reveal" };

  if (correct) {
    const value = q.points;
    ladder[q.team] = value;
    const key = q.team === "falcons" ? "score_falcons" : "score_elite";
    const current = q.team === "falcons" ? room.score_falcons : room.score_elite;
    (patch as Record<string, unknown>)[key] = current + value;

    const sb = getSupabase();
    const { data: finalist } = await sb
      .from("players")
      .select("*")
      .eq("room_id", room.id)
      .eq("team", q.team)
      .eq("is_finalist", true)
      .maybeSingle();
    const f = finalist as Player | null;
    if (f) await sb.from("players").update({ score: f.score + value }).eq("id", f.id);
  }

  patch.round_state = { ...room.round_state, ladder, removedOptions: [] };
  return updateRoom(room.id, patch);
}

/** وسائل المساعدة في المليون */
export async function useLifeline(
  room: Room,
  team: Team,
  lifeline: "fiftyFifty" | "askFamily" | "askTeam"
): Promise<Room> {
  const q = room.current_question;
  const lifelines = { ...(room.round_state.lifelines ?? { falcons: {}, elite: {} }) };
  lifelines[team] = { ...(lifelines[team] ?? {}), [lifeline]: true };

  const next: RoundState = { ...room.round_state, lifelines };

  if (lifeline === "fiftyFifty" && q?.options && q.answer !== undefined) {
    const wrong = q.options.map((_, i) => i).filter((i) => i !== q.answer);
    // نحذف اثنين من الخيارات الخاطئة عشوائيًا
    const removed: number[] = [];
    while (removed.length < 2 && wrong.length) {
      removed.push(wrong.splice(Math.floor(Math.random() * wrong.length), 1)[0]);
    }
    next.removedOptions = removed;
  }

  if (lifeline === "askFamily") {
    next.askFamilyOpen = true;
    next.showVotes = false;
  }

  return updateRoom(room.id, { round_state: next });
}

export async function showAskFamilyResults(room: Room): Promise<Room> {
  return updateRoom(room.id, { round_state: { ...room.round_state, showVotes: true } });
}

export { MILLION_LADDER, imagePoints, balancedTeam };
