"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchRoom, saveSettings } from "@/lib/game";
import { ALL_QUESTIONS, effectiveBank, mergeSettings } from "@/lib/questions";
import { recallHostRoom } from "@/lib/identity";
import { supabaseConfigured } from "@/lib/supabase";
import ConfigNeeded from "@/components/ConfigNeeded";
import { ROUND_META, type HostSettings, type Question, type Room, type RoundKey } from "@/lib/types";

const ROUND_KEYS = Object.keys(ROUND_META) as RoundKey[];

export default function SettingsPage() {
  const [code, setCode] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [settings, setSettings] = useState<HostSettings>(mergeSettings(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [tab, setTab] = useState<"family" | "bank" | "review">("family");

  const load = useCallback(async (value: string) => {
    setLoading(true);
    try {
      const r = await fetchRoom(value);
      if (r) {
        setRoom(r);
        setSettings(mergeSettings(r.settings));
      } else {
        setRoom(null);
      }
    } catch {
      setRoom(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    const saved = recallHostRoom();
    if (saved) {
      setCode(saved);
      void load(saved);
    } else {
      setLoading(false);
    }
  }, [load]);

  const persist = useCallback(
    async (next: HostSettings) => {
      setSettings(next);
      if (!room) return;
      setSaving("saving");
      try {
        await saveSettings(room.id, next);
        setSaving("saved");
        window.setTimeout(() => setSaving("idle"), 1800);
      } catch {
        setSaving("error");
      }
    },
    [room]
  );

  if (!supabaseConfigured) return <ConfigNeeded />;

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center">
        <span className="animate-pulse text-2xl text-white/60">جارٍ التحميل…</span>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8">
      <header className="mb-6 flex flex-wrap items-center gap-4">
        <h1 className="text-4xl font-black">
          ⚙️ إعدادات <span className="gold-text">المقدّم</span>
        </h1>
        <Link href="/host" className="mr-auto text-lg text-white/60 underline">
          ← رجوع لشاشة التلفزيون
        </Link>
      </header>

      {/* اختيار الغرفة */}
      <div className="card mb-6 flex flex-wrap items-center gap-3 p-5">
        <label htmlFor="room-code" className="text-xl font-bold">
          رمز الغرفة
        </label>
        <input
          id="room-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
          placeholder="ABCD"
          className="w-40 rounded-xl bg-black/30 px-4 py-3 text-center text-2xl font-black tracking-widest outline-none ring-2 ring-white/15 focus:ring-gold-500"
        />
        <button
          onClick={() => void load(code)}
          disabled={code.length !== 4}
          className="tap rounded-xl bg-saudi-600 px-6 py-3 text-lg font-black disabled:opacity-40"
        >
          تحميل
        </button>
        <span className="text-lg">
          {room ? (
            <span className="text-saudi-300">✓ متصل بالغرفة {room.code}</span>
          ) : (
            <span className="text-amber-300">
              بلا غرفة — افتح <Link href="/host" className="underline">شاشة التلفزيون</Link> أولًا لإنشاء واحدة
            </span>
          )}
        </span>
        <span className="mr-auto text-lg">
          {saving === "saving" && "…جارٍ الحفظ"}
          {saving === "saved" && <span className="text-saudi-300">✓ حُفظ</span>}
          {saving === "error" && <span className="text-red-300">✗ فشل الحفظ</span>}
        </span>
      </div>

      <nav className="mb-5 flex flex-wrap gap-3">
        {(
          [
            ["family", "👨‍👩‍👧 العائلة"],
            ["bank", "📚 بنك الأسئلة"],
            ["review", "🔍 معلومات تحتاج مراجعتك"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`tap rounded-2xl px-5 py-3 text-lg font-black ${
              tab === key ? "bg-gold-500 text-ink" : "bg-white/10"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "family" && <FamilyTab settings={settings} onChange={persist} />}
      {tab === "bank" && <BankTab settings={settings} onChange={persist} />}
      {tab === "review" && <ReviewTab settings={settings} />}
    </main>
  );
}

/* ================================================================== */

function FamilyTab({
  settings,
  onChange,
}: {
  settings: HostSettings;
  onChange: (s: HostSettings) => void;
}) {
  const [member, setMember] = useState("");
  const [question, setQuestion] = useState("");

  const addMember = () => {
    const clean = member.trim();
    if (!clean || settings.familyMembers.includes(clean)) return;
    onChange({ ...settings, familyMembers: [...settings.familyMembers, clean] });
    setMember("");
  };

  const addQuestion = () => {
    const clean = question.trim();
    if (!clean) return;
    onChange({ ...settings, familyQuestions: [...settings.familyQuestions, clean] });
    setQuestion("");
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="card p-6">
        <h2 className="mb-2 text-2xl font-black">أسماء أفراد العائلة</h2>
        <p className="mb-4 text-lg text-white/60">
          هذه الأسماء تصير خيارات التصويت في جولة «مين يعرف العائلة؟». تحتاج اسمين على الأقل،
          وإلا تُتخطّى الجولة تلقائيًا.
        </p>
        <div className="mb-4 flex gap-3">
          <input
            value={member}
            onChange={(e) => setMember(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMember()}
            placeholder="مثال: أبو فهد"
            className="flex-1 rounded-xl bg-black/30 px-4 py-3 text-xl outline-none ring-2 ring-white/15 focus:ring-gold-500"
          />
          <button onClick={addMember} className="tap rounded-xl bg-saudi-600 px-6 text-xl font-black">
            إضافة
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {settings.familyMembers.map((m) => (
            <span key={m} className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xl">
              {m}
              <button
                onClick={() =>
                  onChange({ ...settings, familyMembers: settings.familyMembers.filter((x) => x !== m) })
                }
                className="tap text-red-300"
                aria-label={`حذف ${m}`}
              >
                ✕
              </button>
            </span>
          ))}
          {settings.familyMembers.length === 0 && (
            <span className="text-lg text-white/40">ما أضفت أسماء بعد</span>
          )}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-2 text-2xl font-black">أسئلة العائلة</h2>
        <p className="mb-4 text-lg text-white/60">
          أسئلة لطيفة فقط. تُعرض قبل الأسئلة الجاهزة. (مثال: مين أكثر واحد يضحّك الجلسة؟)
        </p>
        <div className="mb-4 flex gap-3">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addQuestion()}
            placeholder="مين أكثر واحد يحب القهوة؟"
            className="flex-1 rounded-xl bg-black/30 px-4 py-3 text-xl outline-none ring-2 ring-white/15 focus:ring-gold-500"
          />
          <button onClick={addQuestion} className="tap rounded-xl bg-saudi-600 px-6 text-xl font-black">
            إضافة
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {settings.familyQuestions.map((qq, i) => (
            <li key={`${qq}-${i}`} className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 text-xl">
              <span className="flex-1">{qq}</span>
              <button
                onClick={() =>
                  onChange({
                    ...settings,
                    familyQuestions: settings.familyQuestions.filter((_, idx) => idx !== i),
                  })
                }
                className="tap text-red-300"
              >
                حذف
              </button>
            </li>
          ))}
          {settings.familyQuestions.length === 0 && (
            <li className="text-lg text-white/40">بلا أسئلة مخصّصة — ستُستخدم الأسئلة الجاهزة</li>
          )}
        </ul>
      </section>
    </div>
  );
}

/* ================================================================== */

function BankTab({
  settings,
  onChange,
}: {
  settings: HostSettings;
  onChange: (s: HostSettings) => void;
}) {
  const [filter, setFilter] = useState<RoundKey | "all">("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Question | null>(null);

  const bank = useMemo(() => {
    const overrides = new Map(settings.customQuestions.map((q) => [q.id, q]));
    const merged = ALL_QUESTIONS.map((q) => overrides.get(q.id) ?? q);
    for (const q of settings.customQuestions) {
      if (!merged.some((m) => m.id === q.id)) merged.push(q);
    }
    return merged;
  }, [settings.customQuestions]);

  const visible = bank.filter(
    (q) =>
      (filter === "all" || q.round === filter) &&
      (!search || q.text.includes(search) || q.options?.some((o) => o.includes(search)))
  );

  const disabled = new Set(settings.disabledQuestionIds);

  const toggle = (id: string) => {
    const next = new Set(disabled);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...settings, disabledQuestionIds: [...next] });
  };

  const saveQuestion = (q: Question) => {
    const others = settings.customQuestions.filter((c) => c.id !== q.id);
    onChange({ ...settings, customQuestions: [...others, q] });
    setEditing(null);
  };

  const newQuestion = () =>
    setEditing({
      id: `custom-${Date.now().toString(36)}`,
      round: "trivia",
      text: "",
      options: ["", "", "", ""],
      answer: 0,
      category: "all",
      difficulty: "easy",
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث في الأسئلة…"
          className="min-w-52 flex-1 rounded-xl bg-black/30 px-4 py-3 text-lg outline-none ring-2 ring-white/15 focus:ring-gold-500"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as RoundKey | "all")}
          className="rounded-xl bg-black/40 px-4 py-3 text-lg"
        >
          <option value="all">كل الجولات</option>
          {ROUND_KEYS.map((r) => (
            <option key={r} value={r}>
              {ROUND_META[r].emoji} {ROUND_META[r].title}
            </option>
          ))}
        </select>
        <button onClick={newQuestion} className="tap rounded-xl bg-gold-500 px-5 py-3 text-lg font-black text-ink">
          ＋ سؤال جديد
        </button>
        <span className="text-lg text-white/50">{visible.length} سؤال</span>
      </div>

      {editing && <QuestionEditor question={editing} onCancel={() => setEditing(null)} onSave={saveQuestion} />}

      <ul className="flex flex-col gap-2">
        {visible.map((q) => {
          const off = disabled.has(q.id);
          const custom = settings.customQuestions.some((c) => c.id === q.id);
          return (
            <li
              key={q.id}
              className={`card flex flex-wrap items-center gap-3 p-4 ${off ? "opacity-40" : ""}`}
            >
              <span className="text-2xl">{ROUND_META[q.round].emoji}</span>
              <div className="min-w-52 flex-1">
                <div className="text-lg font-bold">{q.text || "(بلا نص)"}</div>
                <div className="text-sm text-white/50">
                  {q.options ? q.options[q.answer ?? 0] : q.answerText} ·{" "}
                  {q.category === "kids" ? "صغار" : q.category === "adults" ? "كبار" : "الكل"}
                  {q.verify && <span className="text-amber-300"> · يحتاج مراجعة</span>}
                  {custom && <span className="text-gold-300"> · معدّل</span>}
                </div>
              </div>
              <button onClick={() => setEditing(q)} className="tap rounded-xl bg-white/10 px-4 py-2 text-lg">
                تعديل
              </button>
              <button
                onClick={() => toggle(q.id)}
                className={`tap rounded-xl px-4 py-2 text-lg ${off ? "bg-saudi-600" : "bg-white/10"}`}
              >
                {off ? "تفعيل" : "استبعاد"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function QuestionEditor({
  question,
  onSave,
  onCancel,
}: {
  question: Question;
  onSave: (q: Question) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Question>({ ...question, options: [...(question.options ?? [])] });
  const usesOptions = draft.round !== "buzzer" && draft.round !== "family";

  return (
    <div className="card gold-border flex flex-col gap-4 p-6">
      <h3 className="text-2xl font-black">تعديل السؤال</h3>

      <div className="flex flex-wrap gap-3">
        <select
          value={draft.round}
          onChange={(e) => setDraft({ ...draft, round: e.target.value as RoundKey })}
          className="rounded-xl bg-black/40 px-4 py-3 text-lg"
        >
          {ROUND_KEYS.map((r) => (
            <option key={r} value={r}>
              {ROUND_META[r].title}
            </option>
          ))}
        </select>
        <select
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value as Question["category"] })}
          className="rounded-xl bg-black/40 px-4 py-3 text-lg"
        >
          <option value="all">للكل</option>
          <option value="kids">للصغار</option>
          <option value="adults">للكبار</option>
        </select>
        <select
          value={draft.difficulty}
          onChange={(e) => setDraft({ ...draft, difficulty: e.target.value as Question["difficulty"] })}
          className="rounded-xl bg-black/40 px-4 py-3 text-lg"
        >
          <option value="easy">سهل</option>
          <option value="medium">متوسط</option>
          <option value="hard">صعب</option>
        </select>
        <label className="flex items-center gap-2 text-lg">
          <input
            type="checkbox"
            checked={!!draft.verify}
            onChange={(e) => setDraft({ ...draft, verify: e.target.checked })}
            className="h-5 w-5"
          />
          يحتاج مراجعة
        </label>
      </div>

      <textarea
        value={draft.text}
        onChange={(e) => setDraft({ ...draft, text: e.target.value })}
        placeholder="نص السؤال"
        rows={2}
        className="rounded-xl bg-black/30 px-4 py-3 text-xl outline-none ring-2 ring-white/15 focus:ring-gold-500"
      />

      {draft.round === "image" && (
        <input
          value={draft.image ?? ""}
          onChange={(e) => setDraft({ ...draft, image: e.target.value })}
          placeholder="/images/اسم-الصورة.jpg"
          dir="ltr"
          className="rounded-xl bg-black/30 px-4 py-3 text-lg outline-none ring-2 ring-white/15"
        />
      )}

      {usesOptions ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <label key={i} className="flex items-center gap-3">
              <input
                type="radio"
                name="correct"
                checked={draft.answer === i}
                onChange={() => setDraft({ ...draft, answer: i })}
                className="h-5 w-5"
              />
              <input
                value={draft.options?.[i] ?? ""}
                onChange={(e) => {
                  const options = [...(draft.options ?? ["", "", "", ""])];
                  options[i] = e.target.value;
                  setDraft({ ...draft, options });
                }}
                placeholder={`الخيار ${i + 1}`}
                className="flex-1 rounded-xl bg-black/30 px-4 py-3 text-lg outline-none ring-2 ring-white/15 focus:ring-gold-500"
              />
            </label>
          ))}
          <span className="text-sm text-white/50">اختر الدائرة بجانب الإجابة الصحيحة</span>
        </div>
      ) : (
        <input
          value={draft.answerText ?? ""}
          onChange={(e) => setDraft({ ...draft, answerText: e.target.value })}
          placeholder="الإجابة (يقرأها المقدّم)"
          className="rounded-xl bg-black/30 px-4 py-3 text-lg outline-none ring-2 ring-white/15"
        />
      )}

      <div className="flex gap-3">
        <button
          onClick={() => onSave(draft)}
          disabled={!draft.text.trim()}
          className="tap rounded-xl bg-saudi-600 px-8 py-3 text-lg font-black disabled:opacity-40"
        >
          حفظ
        </button>
        <button onClick={onCancel} className="tap rounded-xl bg-white/10 px-8 py-3 text-lg font-black">
          إلغاء
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */

function ReviewTab({ settings }: { settings: HostSettings }) {
  const list = effectiveBank(settings).filter((q) => q.verify);

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-6">
        <h2 className="mb-2 text-2xl font-black">🔍 معلومات تحتاج مراجعتك</h2>
        <p className="text-lg text-white/70">
          هذه الأسئلة وُضعت عليها علامة «تحتاج تأكيد»: إمّا معلومة قد تتغيّر مع الوقت، أو نسبة كلمة
          إلى منطقة معيّنة. راجعها قبل الحفلة، وعدّلها أو استبعدها من تبويب «بنك الأسئلة».
        </p>
        <p className="mt-3 text-xl font-black text-amber-300">{list.length} سؤال بحاجة لنظرة</p>
      </div>

      <ul className="flex flex-col gap-2">
        {list.map((q) => (
          <li key={q.id} className="card p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{ROUND_META[q.round].emoji}</span>
              <div className="flex-1">
                <div className="text-lg font-bold">{q.text}</div>
                <div className="mt-1 text-lg text-saudi-300">
                  الإجابة: {q.options ? q.options[q.answer ?? 0] : q.answerText}
                </div>
                {q.verifyNote && <div className="mt-1 text-base text-amber-200/80">⚠️ {q.verifyNote}</div>}
              </div>
              <code className="text-sm text-white/30" dir="ltr">
                {q.id}
              </code>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
