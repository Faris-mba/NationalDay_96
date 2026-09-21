export type Team = "falcons" | "elite";
export type PlayerCategory = "kid" | "adult";

export type RoundKey =
  | "trivia"
  | "kids"
  | "dialect"
  | "image"
  | "buzzer"
  | "family"
  | "million";

export type Phase =
  | "lobby"
  | "round_intro"
  | "question"
  | "reveal"
  | "scores"
  | "finished";

export interface Question {
  id: string;
  round: RoundKey;
  text: string;
  options?: string[];
  /** فهرس الإجابة الصحيحة داخل options */
  answer?: number;
  /** إجابة نصّية لجولة البازر (يحكم عليها المقدّم) */
  answerText?: string;
  image?: string;
  region?: string;
  level?: number;
  set?: "a" | "b";
  category: "kids" | "adults" | "all";
  difficulty: "easy" | "medium" | "hard";
  verify?: boolean;
  verifyNote?: string;
}

/** السؤال كما يُكتب في الغرفة: نسخة من السؤال + بيانات العرض */
export interface ActiveQuestion extends Question {
  /** معرّف فريد لهذا العرض تحديدًا (يسمح بتكرار السؤال نفسه دون تعارض) */
  instanceId: string;
  points: number;
  /** جولة الصغار فقط */
  kidsOnly?: boolean;
  /** خيارات جولة «مين يعرف العائلة؟» تأتي من إعدادات المقدّم */
  familyOptions?: string[];
  /** الفريق صاحب الدور في المليون */
  team?: Team;
}

export interface LifelineState {
  fiftyFifty?: boolean;
  askFamily?: boolean;
  askTeam?: boolean;
}

export interface RoundState {
  /** فهارس الخيارات المحذوفة بوسيلة «حذف إجابتين» */
  removedOptions?: number[];
  /** هل فُتح البازر؟ */
  buzzerOpen?: boolean;
  /** الفريق الذي انتقلت له الفرصة بعد خطأ */
  buzzerTurn?: Team | null;
  /** لاعبون استُبعدوا من البازر في هذا السؤال */
  buzzerLockedOut?: string[];
  /** هل تُعرض نتيجة التصويت على التلفزيون؟ */
  showVotes?: boolean;
  /** درجة تقريب الصورة (1 = أقرب) */
  zoomStep?: number;
  /** وسائل المساعدة المستهلكة لكل فريق في المليون */
  lifelines?: Record<Team, LifelineState>;
  /** رصيد المليون الحالي لكل فريق */
  ladder?: Record<Team, number>;
  /** نتيجة «اسأل العائلة» معروضة */
  askFamilyOpen?: boolean;
}

export interface HostSettings {
  familyMembers: string[];
  familyQuestions: string[];
  /** تعديلات/إضافات على بنك الأسئلة */
  customQuestions: Question[];
  /** معرّفات أسئلة مستبعدة */
  disabledQuestionIds: string[];
  muted?: boolean;
}

export interface Room {
  id: string;
  code: string;
  phase: Phase;
  round_index: number;
  step_index: number;
  current_question: ActiveQuestion | null;
  question_started_at: string | null;
  question_duration: number;
  paused_at: string | null;
  paused_ms: number;
  score_falcons: number;
  score_elite: number;
  settings: Partial<HostSettings>;
  round_state: RoundState;
  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  client_id: string;
  name: string;
  category: PlayerCategory;
  team: Team;
  score: number;
  is_finalist: boolean;
  last_seen_at: string;
  created_at: string;
}

export interface Answer {
  id: string;
  room_id: string;
  player_id: string;
  question_id: string;
  round_key: string;
  answer: string;
  is_correct: boolean | null;
  points: number;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface Buzz {
  id: string;
  room_id: string;
  player_id: string;
  question_id: string;
  verdict: "correct" | "wrong" | null;
  created_at: string;
}

export interface Vote {
  id: string;
  room_id: string;
  player_id: string;
  question_id: string;
  choice: string;
  created_at: string;
}

export const TEAMS: Record<Team, { name: string; emoji: string; color: string }> = {
  falcons: { name: "الصقور", emoji: "🟢", color: "#0a8f4a" },
  elite: { name: "النخبة", emoji: "🟡", color: "#E8B923" },
};

export const ROUND_META: Record<RoundKey, { title: string; emoji: string; subtitle: string }> = {
  trivia: { title: "أسئلة سعودية", emoji: "🧠", subtitle: "اختر الإجابة الصحيحة قبل انتهاء الوقت" },
  kids: { title: "سؤال الصغار", emoji: "🧒", subtitle: "الصغار فقط — والنقاط مضاعفة!" },
  dialect: { title: "وش الكلمة؟", emoji: "🗣️", subtitle: "كلمة من لهجات المملكة… خمّن معناها" },
  image: { title: "خمّن الصورة", emoji: "🖼️", subtitle: "كل ما خمّنت أبكر، النقاط أكثر" },
  buzzer: { title: "أسرع إجابة", emoji: "⚡", subtitle: "أول من يضغط البازر يجاوب" },
  family: { title: "مين يعرف العائلة؟", emoji: "😂", subtitle: "صوّتوا… والنتيجة على الشاشة" },
  million: { title: "المليون السعودي", emoji: "🎯", subtitle: "بطل من كل فريق — وسلّم النقاط" },
};

export const MILLION_LADDER = [100, 200, 500, 1000, 2000, 5000];
