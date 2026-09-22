"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { missingSupabaseEnv } from "@/lib/supabase";

/** معرّف لاتيني داخل نص عربي — يحتاج عزلًا ثنائي الاتجاه وإلا قفزت النقطة لآخر السطر */
function Code({ children }: { children: string }) {
  return (
    <code dir="ltr" className="rounded-lg bg-black/40 px-2 py-1 font-mono text-[0.9em] text-gold-300">
      {children}
    </code>
  );
}

/**
 * شاشة «الإعدادات ناقصة».
 * تفصل بين الحالتين لأن العلاج مختلف تمامًا:
 * على Vercel يجب إعادة النشر بعد إضافة المتغيّرات، ومحليًا يكفي ملف واحد.
 */
export default function ConfigNeeded() {
  const missing = missingSupabaseEnv();

  // يُقرأ بعد الترطيب لا أثناء العرض: الخادم لا يعرف اسم المضيف،
  // وقراءته أثناء العرض تُنتج HTML مختلفًا بين الخادم والمتصفّح.
  const [isLocal, setIsLocal] = useState(false);
  useEffect(() => {
    setIsLocal(/^(localhost|127\.0\.0\.1|\[::1\]|192\.168\.|10\.)/.test(window.location.hostname));
  }, []);

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-3xl place-items-center px-5 py-10">
      <div className="card w-full p-8">
        <div className="mb-4 text-center text-6xl">⚠️</div>
        <h1 className="mb-3 text-center text-4xl font-black">ينقص ربط قاعدة البيانات</h1>
        <p className="mb-6 text-center text-xl text-white/70">
          اللعبة تحتاج مشروع Supabase لتخزين الغرف واللاعبين.
        </p>

        {missing.length > 0 && (
          <div className="mb-6 rounded-2xl bg-black/30 p-5">
            <div className="mb-3 text-lg font-bold text-white/70">المتغيّرات الناقصة:</div>
            <ul className="flex flex-col gap-2">
              {missing.map((name) => (
                <li key={name} className="flex items-center gap-2 text-lg">
                  <span className="text-red-300">✗</span>
                  <Code>{name}</Code>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* الموقع المنشور */}
        <section
          className={`mb-4 rounded-2xl p-5 ${isLocal ? "bg-white/5" : "gold-border bg-gold-500/10"}`}
        >
          <h2 className="mb-3 text-2xl font-black">🌐 على Vercel (الموقع المنشور)</h2>
          <ol className="flex list-inside list-decimal flex-col gap-2 text-lg leading-relaxed text-white/80">
            <li>
              افتح مشروعك على Vercel ← <b>Settings</b> ← <b>Environment Variables</b>
            </li>
            <li>
              أضف المتغيّرين، وقيمتهما من Supabase ← <b>Project Settings</b> ← <b>API</b>
              <div className="mt-2 flex flex-col gap-1 text-base">
                <span>
                  <Code>NEXT_PUBLIC_SUPABASE_URL</Code> ← قيمة <b>Project URL</b>
                </span>
                <span>
                  <Code>NEXT_PUBLIC_SUPABASE_ANON_KEY</Code> ← مفتاح <b>anon public</b>
                </span>
                <span className="text-white/60">
                  تسمّيه مشاريع Supabase الحديثة <b>publishable key</b> (يبدأ بـ{" "}
                  <Code>sb_publishable_</Code>) — تقبل اللعبة الاسمين، ويمكنك بدلًا من ذلك
                  تسمية المتغيّر <Code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</Code>
                </span>
              </div>
            </li>
            <li>
              فعّلهما لبيئات <b>Production</b> و<b>Preview</b> و<b>Development</b>
            </li>
            <li className="font-black text-gold-300">
              ثم <b>Deployments</b> ← آخر نشر ← <b>Redeploy</b> — هذه الخطوة إلزامية
            </li>
          </ol>
          <p className="mt-3 rounded-xl bg-black/30 p-3 text-base text-white/60">
            💡 قيم <Code>NEXT_PUBLIC_</Code> تُدمج داخل الصفحة <b>وقت البناء</b> لا وقت التشغيل،
            فإضافتها وحدها لا تكفي — لا بد من إعادة نشر لتُقرأ.
          </p>
        </section>

        {/* التشغيل المحلي */}
        <section className={`rounded-2xl p-5 ${isLocal ? "gold-border bg-gold-500/10" : "bg-white/5"}`}>
          <h2 className="mb-3 text-2xl font-black">💻 على جهازك</h2>
          <p className="mb-2 text-lg text-white/80">
            أنشئ ملفًا باسم <Code>.env.local</Code> في جذر المشروع (انسخ <Code>.env.example</Code>)
            واكتب فيه:
          </p>
          <pre
            dir="ltr"
            className="thin-scroll overflow-x-auto rounded-xl bg-black/50 p-4 text-left font-mono text-sm leading-relaxed text-gold-200"
          >{`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...`}</pre>
          <p className="mt-2 text-lg text-white/80">
            ثم أعد تشغيل <Code>npm run dev</Code>.
          </p>
        </section>

        <p className="mt-6 text-center text-lg text-white/60">
          لم تنشئ قاعدة البيانات بعد؟ شغّل <Code>supabase/schema.sql</Code> في
          Supabase ← SQL Editor. التفاصيل في ملف README.
        </p>

        <div className="mt-6 text-center">
          <Link href="/" className="tap inline-block rounded-2xl bg-saudi-600 px-8 py-4 text-xl font-black">
            الصفحة الرئيسية
          </Link>
        </div>
      </div>
    </main>
  );
}
