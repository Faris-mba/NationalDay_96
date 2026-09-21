/**
 * اختبارات منطق اللعبة الخالص (بلا شبكة ولا قاعدة بيانات).
 * شغّلها بـ: npm test
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ALL_QUESTIONS,
  buildPlaylist,
  effectiveBank,
  mergeSettings,
  stepNumber,
  totalSteps,
} from "../src/lib/questions";
import { imagePoints } from "../src/lib/scoring";
import { balancedTeam } from "../src/lib/teams";
import type { HostSettings, Player, Team } from "../src/lib/types";

const base: HostSettings = mergeSettings(null);
const withFamily: HostSettings = mergeSettings({
  familyMembers: ["أبو فهد", "أم فهد", "سارة", "فهد"],
});

/* ------------------------------------------------------------------ */

test("بنك الأسئلة سليم: معرّفات فريدة وإجابات صحيحة", () => {
  const ids = new Set<string>();
  for (const q of ALL_QUESTIONS) {
    assert.ok(!ids.has(q.id), `معرّف مكرّر: ${q.id}`);
    ids.add(q.id);
    assert.ok(q.text.trim().length > 0, `سؤال بلا نص: ${q.id}`);

    if (q.options) {
      assert.equal(q.options.length, 4, `${q.id} يجب أن يملك 4 خيارات`);
      assert.ok(
        q.answer !== undefined && q.options[q.answer] !== undefined,
        `${q.id} فهرس إجابة غير صالح`
      );
      assert.equal(new Set(q.options).size, 4, `${q.id} فيه خيارات مكرّرة`);
    } else {
      assert.ok(
        q.answerText || q.round === "family",
        `${q.id} بلا خيارات وبلا إجابة نصّية`
      );
    }
  }
});

test("أسئلة الصور تشير إلى مسار داخل public/images", () => {
  for (const q of ALL_QUESTIONS.filter((x) => x.round === "image")) {
    assert.ok(q.image?.startsWith("/images/"), `${q.id} مسار صورة غير صالح`);
  }
});

test("سلّم المليون مكتمل للفريقين", () => {
  const ladder = [100, 200, 500, 1000, 2000, 5000];
  for (const set of ["a", "b"] as const) {
    const levels = ALL_QUESTIONS.filter((q) => q.round === "million" && q.set === set)
      .map((q) => q.level)
      .sort((x, y) => (x ?? 0) - (y ?? 0));
    assert.deepEqual(levels, ladder, `مجموعة ${set} ناقصة`);
  }
});

/* ------------------------------------------------------------------ */

test("قائمة التشغيل ثابتة لنفس رمز الغرفة", () => {
  const a = buildPlaylist("ABCD", base);
  const b = buildPlaylist("ABCD", base);
  assert.deepEqual(
    a.map((s) => s.questions.map((q) => q.instanceId)),
    b.map((s) => s.questions.map((q) => q.instanceId)),
    "نفس الرمز يجب أن يعطي نفس الترتيب"
  );
});

test("قائمة التشغيل تختلف بين الغرف", () => {
  const a = buildPlaylist("ABCD", base).flatMap((s) => s.questions.map((q) => q.id));
  const b = buildPlaylist("WXYZ", base).flatMap((s) => s.questions.map((q) => q.id));
  assert.notDeepEqual(a, b, "غرفتان مختلفتان يُفترض أن تختلف أسئلتهما");
});

test("جولة العائلة تُتخطّى بلا أسماء، وتظهر عند إضافتها", () => {
  const without = buildPlaylist("ABCD", base);
  assert.ok(!without.some((s) => s.round === "family"), "يجب تخطّي جولة العائلة بلا أسماء");

  const withNames = buildPlaylist("ABCD", withFamily);
  const family = withNames.find((s) => s.round === "family");
  assert.ok(family, "يجب أن تظهر جولة العائلة بعد إضافة الأسماء");
  assert.deepEqual(family.questions[0].familyOptions, withFamily.familyMembers);
});

test("أسئلة العائلة المخصّصة تتقدّم على الجاهزة", () => {
  const custom = mergeSettings({
    familyMembers: ["أ", "ب"],
    familyQuestions: ["مين أكثر واحد ينسى مفاتيحه؟"],
  });
  const family = buildPlaylist("ABCD", custom).find((s) => s.round === "family");
  assert.equal(family?.questions[0].text, "مين أكثر واحد ينسى مفاتيحه؟");
});

test("لا يتكرّر سؤال داخل نفس اللعبة (عدا المليون)", () => {
  const seen = new Map<string, number>();
  for (const segment of buildPlaylist("ABCD", withFamily)) {
    if (segment.round === "million") continue;
    for (const q of segment.questions) {
      seen.set(q.id, (seen.get(q.id) ?? 0) + 1);
    }
  }
  const repeated = [...seen.entries()].filter(([, n]) => n > 1);
  assert.deepEqual(repeated, [], `أسئلة مكرّرة: ${repeated.map(([id]) => id).join(", ")}`);
});

test("جولة الصغار مُعلّمة kidsOnly وبنقاط مضاعفة", () => {
  const kids = buildPlaylist("ABCD", base).filter((s) => s.round === "kids");
  assert.ok(kids.length >= 3, "المتوقّع 3 فواصل لأسئلة الصغار على الأقل");
  for (const seg of kids) {
    assert.equal(seg.duration, 30, "مدة سؤال الصغار 30 ثانية");
    for (const q of seg.questions) {
      assert.equal(q.kidsOnly, true);
      assert.equal(q.points, 200, "نقاط الصغار مضاعفة");
    }
  }
});

test("أسئلة المليون موزّعة على الفريقين بالترتيب الصاعد", () => {
  const million = buildPlaylist("ABCD", base).find((s) => s.round === "million");
  assert.ok(million);
  const falcons = million.questions.filter((q) => q.team === "falcons");
  const elite = million.questions.filter((q) => q.team === "elite");
  assert.equal(falcons.length, 6);
  assert.equal(elite.length, 6);
  assert.deepEqual(falcons.map((q) => q.points), [100, 200, 500, 1000, 2000, 5000]);
  // بطل الصقور يكمل سلّمه قبل أن يبدأ بطل النخبة
  assert.ok(
    million.questions.findIndex((q) => q.team === "elite") === 6,
    "يجب أن ينتهي دور الفريق الأول قبل بدء الثاني"
  );
});

test("مدة اللعبة المقدّرة ضمن 30–45 دقيقة", () => {
  const segments = buildPlaylist("ABCD", withFamily);
  // وقت السؤال + ~12 ثانية للمقدّم (عرض الإجابة والتعليق)
  const seconds = segments.reduce((t, s) => t + s.questions.length * (s.duration + 12), 0);
  const minutes = seconds / 60;
  assert.ok(minutes >= 30 && minutes <= 45, `المدة المقدّرة ${minutes.toFixed(1)} دقيقة خارج النطاق`);
});

test("ترقيم الخطوات متسلسل ومطابق للمجموع", () => {
  const segments = buildPlaylist("ABCD", withFamily);
  const total = totalSteps(segments);
  let expected = 1;
  for (let r = 0; r < segments.length; r++) {
    for (let s = 0; s < segments[r].questions.length; s++) {
      assert.equal(stepNumber(segments, r, s), expected, `ترقيم خاطئ عند ${r}/${s}`);
      expected++;
    }
  }
  assert.equal(total, expected - 1);
});

/* ------------------------------------------------------------------ */

test("استبعاد سؤال من الإعدادات يمنعه من البنك الفعّال", () => {
  const victim = ALL_QUESTIONS.find((q) => q.round === "trivia")!;
  const settings = mergeSettings({ disabledQuestionIds: [victim.id] });
  assert.ok(!effectiveBank(settings).some((q) => q.id === victim.id));
  assert.ok(!buildPlaylist("ABCD", settings).some((s) => s.questions.some((q) => q.id === victim.id)));
});

test("السؤال المعدّل يستبدل الأصلي بنفس المعرّف", () => {
  const original = ALL_QUESTIONS.find((q) => q.round === "trivia")!;
  const settings = mergeSettings({
    customQuestions: [{ ...original, text: "نص معدّل تمامًا" }],
  });
  const found = effectiveBank(settings).filter((q) => q.id === original.id);
  assert.equal(found.length, 1, "يجب ألا يتكرّر السؤال بعد التعديل");
  assert.equal(found[0].text, "نص معدّل تمامًا");
});

/* ------------------------------------------------------------------ */

test("نقاط «خمّن الصورة» تقلّ كلما اتّسعت الصورة", () => {
  const points = [1, 2, 3, 4, 5].map((step) => imagePoints(500, step));
  assert.deepEqual(points, [500, 400, 300, 200, 100]);
  for (let i = 1; i < points.length; i++) {
    assert.ok(points[i] < points[i - 1], "النقاط يجب أن تتناقص");
  }
  // خارج النطاق لا يكسر الحساب
  assert.equal(imagePoints(500, 0), 500);
  assert.equal(imagePoints(500, 99), 100);
});

/* ------------------------------------------------------------------ */

function fakePlayer(team: Team, score = 0): Player {
  return {
    id: Math.random().toString(36),
    room_id: "r",
    client_id: Math.random().toString(36),
    name: "لاعب",
    category: "adult",
    team,
    score,
    is_finalist: false,
    last_seen_at: "",
    created_at: "",
  };
}

test("التوزيع التلقائي يوازن عدد اللاعبين", () => {
  assert.equal(balancedTeam([fakePlayer("falcons")]), "elite");
  assert.equal(balancedTeam([fakePlayer("elite"), fakePlayer("elite")]), "falcons");
});

test("عند تساوي العدد يوازن التوزيع حسب النقاط", () => {
  const players = [fakePlayer("falcons", 900), fakePlayer("elite", 100)];
  assert.equal(balancedTeam(players), "elite", "الفريق الأقل نقاطًا يأخذ اللاعب الجديد");
});

test("توزيع 10 لاعبين يُبقي الفريقين متساويين", () => {
  const players: Player[] = [];
  for (let i = 0; i < 10; i++) players.push(fakePlayer(balancedTeam(players)));
  const falcons = players.filter((p) => p.team === "falcons").length;
  assert.equal(falcons, 5, "المتوقّع 5 لكل فريق");
});
