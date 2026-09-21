"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length === 4) router.push(`/join/${clean}`);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <div>
        <div className="mb-4 text-7xl">🇸🇦</div>
        <h1 className="text-6xl font-black leading-tight sm:text-7xl">
          تحدي <span className="gold-text">العائلة</span>
        </h1>
        <p className="mt-4 text-2xl text-white/70">لعبة اليوم الوطني — على التلفزيون ومن جوالاتكم</p>
      </div>

      <Link
        href="/host"
        className="tap w-full rounded-3xl bg-saudi-600 px-8 py-7 text-3xl font-black shadow-xl transition active:scale-[.98] hover:bg-saudi-500"
      >
        📺 ابدأ غرفة جديدة (شاشة التلفزيون)
      </Link>

      <form onSubmit={go} className="card w-full p-6">
        <label htmlFor="code" className="mb-3 block text-xl font-bold text-white/80">
          عندك رمز غرفة؟ اكتبه للانضمام
        </label>
        <div className="flex gap-3">
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
            placeholder="ABCD"
            inputMode="text"
            autoCapitalize="characters"
            className="w-full rounded-2xl bg-black/30 px-5 py-5 text-center text-4xl font-black tracking-[0.5em] outline-none ring-2 ring-white/15 focus:ring-gold-500"
          />
          <button
            type="submit"
            disabled={code.trim().length !== 4}
            className="tap shrink-0 rounded-2xl bg-gold-500 px-8 text-2xl font-black text-ink transition active:scale-95 disabled:opacity-40"
          >
            دخول
          </button>
        </div>
      </form>

      <Link href="/host/settings" className="text-lg text-white/50 underline underline-offset-8 hover:text-white/80">
        ⚙️ إعدادات المقدّم وبنك الأسئلة
      </Link>
    </main>
  );
}
