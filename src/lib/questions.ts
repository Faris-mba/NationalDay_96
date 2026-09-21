import bank from "@data/questions.json";
import type { ActiveQuestion, HostSettings, Question, RoundKey, Team } from "./types";

export const ALL_QUESTIONS = bank.questions as Question[];

/** ------------------------------------------------------------------
 *  خلط ثابت (seeded) — نفس رمز الغرفة ⇒ نفس الترتيب دائمًا.
 *  هذا ما يجعل إعادة تحميل شاشة المقدّم لا تغيّر مجرى اللعبة.
 *  ------------------------------------------------------------------ */
function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** ------------------------------------------------------------------
 *  خطة الجولات — مصمّمة لتستغرق 30–45 دقيقة بإيقاع مقدّم معتاد.
 *  ------------------------------------------------------------------ */
interface SegmentPlan {
  round: RoundKey;
  count: number;
  duration: number;
  points: number;
}

export const GAME_PLAN: SegmentPlan[] = [
  { round: "trivia", count: 5, duration: 20, points: 100 },
  { round: "kids", count: 1, duration: 30, points: 200 },
  { round: "dialect", count: 5, duration: 20, points: 100 },
  { round: "trivia", count: 7, duration: 20, points: 100 },
  { round: "kids", count: 1, duration: 30, points: 200 },
  { round: "image", count: 5, duration: 30, points: 500 },
  { round: "buzzer", count: 6, duration: 25, points: 300 },
  { round: "kids", count: 1, duration: 30, points: 200 },
  { round: "family", count: 4, duration: 25, points: 0 },
  { round: "million", count: 12, duration: 45, points: 0 },
];

export interface Segment {
  round: RoundKey;
  questions: ActiveQuestion[];
  duration: number;
}

const DEFAULT_SETTINGS: HostSettings = {
  familyMembers: [],
  familyQuestions: [],
  customQuestions: [],
  disabledQuestionIds: [],
};

export function mergeSettings(partial: Partial<HostSettings> | null | undefined): HostSettings {
  return { ...DEFAULT_SETTINGS, ...(partial ?? {}) };
}

/**
 * بنك الأسئلة الفعلي = البنك الأساسي + أسئلة المقدّم المخصّصة،
 * مع استبعاد ما عطّله المقدّم. أي سؤال مخصّص بنفس id يستبدل الأصلي.
 */
export function effectiveBank(settings: HostSettings): Question[] {
  const custom = settings.customQuestions ?? [];
  const overrides = new Map(custom.map((q) => [q.id, q]));
  const disabled = new Set(settings.disabledQuestionIds ?? []);

  const merged = ALL_QUESTIONS.map((q) => overrides.get(q.id) ?? q);
  for (const q of custom) {
    if (!merged.some((m) => m.id === q.id)) merged.push(q);
  }
  return merged.filter((q) => !disabled.has(q.id));
}

/**
 * يبني قائمة تشغيل اللعبة كاملة. الترتيب مشتق من رمز الغرفة،
 * فأي جهاز يبني نفس القائمة — لكن المصدر الموثوق يبقى صف الغرفة
 * في قاعدة البيانات (الذي يحمل نسخة السؤال المعروض حاليًا).
 */
export function buildPlaylist(code: string, settings: HostSettings): Segment[] {
  const rand = mulberry32(hashSeed(code.toUpperCase()));
  const bankNow = effectiveBank(settings);

  const pools = new Map<RoundKey, Question[]>();
  for (const round of ["trivia", "kids", "dialect", "image", "buzzer", "family", "million"] as RoundKey[]) {
    const pool = bankNow.filter((q) => q.round === round);
    pools.set(round, round === "million" ? pool : shuffle(pool, rand));
  }

  // أسئلة العائلة المخصّصة من لوحة الإعدادات تتقدّم على الافتراضية
  const familyCustom = (settings.familyQuestions ?? [])
    .map((text) => text.trim())
    .filter(Boolean)
    .map<Question>((text, i) => ({
      id: `fam-custom-${i}`,
      round: "family",
      text,
      category: "all",
      difficulty: "easy",
    }));
  if (familyCustom.length) {
    pools.set("family", [...familyCustom, ...(pools.get("family") ?? [])]);
  }

  const familyOptions = (settings.familyMembers ?? []).map((n) => n.trim()).filter(Boolean);
  const cursors = new Map<RoundKey, number>();
  const segments: Segment[] = [];

  for (const plan of GAME_PLAN) {
    // بلا أسماء عائلة ⇒ لا معنى لجولة التصويت، نتخطّاها
    if (plan.round === "family" && familyOptions.length < 2) continue;

    const pool = pools.get(plan.round) ?? [];
    const questions: ActiveQuestion[] = [];

    if (plan.round === "million") {
      questions.push(...buildMillionSegment(pool));
    } else {
      let cursor = cursors.get(plan.round) ?? 0;
      for (let i = 0; i < plan.count && pool.length > 0; i++) {
        const q = pool[cursor % pool.length];
        cursor++;
        questions.push({
          ...q,
          instanceId: `${q.id}#${segments.length}-${i}`,
          points: plan.points,
          kidsOnly: plan.round === "kids",
          ...(plan.round === "family" ? { familyOptions } : {}),
        });
      }
      cursors.set(plan.round, cursor);
    }

    if (questions.length) {
      segments.push({ round: plan.round, questions, duration: plan.duration });
    }
  }

  return segments;
}

/** سلّم المليون: بطل الصقور يصعد سلّمه كاملًا، ثم بطل النخبة. */
function buildMillionSegment(pool: Question[]): ActiveQuestion[] {
  const byLevel = (set: "a" | "b") =>
    pool.filter((q) => q.set === set).sort((a, b) => (a.level ?? 0) - (b.level ?? 0));

  const teamOrder: Array<[Team, "a" | "b"]> = [
    ["falcons", "a"],
    ["elite", "b"],
  ];

  const out: ActiveQuestion[] = [];
  for (const [team, set] of teamOrder) {
    byLevel(set).forEach((q, i) => {
      out.push({
        ...q,
        instanceId: `${q.id}#million-${team}-${i}`,
        points: q.level ?? 100,
        team,
      });
    });
  }
  return out;
}

/** عدد الأسئلة الكلي — يُستخدم لشريط التقدّم على التلفزيون */
export function totalSteps(segments: Segment[]): number {
  return segments.reduce((sum, s) => sum + s.questions.length, 0);
}

export function stepNumber(segments: Segment[], roundIndex: number, stepIndex: number): number {
  let n = 0;
  for (let i = 0; i < roundIndex && i < segments.length; i++) n += segments[i].questions.length;
  return n + stepIndex + 1;
}

/** قائمة المعلومات التي تحتاج مراجعة بشرية */
export function questionsNeedingReview(settings?: HostSettings): Question[] {
  const list = settings ? effectiveBank(settings) : ALL_QUESTIONS;
  return list.filter((q) => q.verify);
}
