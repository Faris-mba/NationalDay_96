"use client";

import { useState } from "react";

interface Props {
  src: string;
  /** 1 = أقرب تقريب، 5 = الصورة كاملة */
  step: number;
  label: string;
  className?: string;
}

/** بديل مؤقت يُعرض إن لم تكن الصورة موجودة بعد في public/images */
function placeholder(label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#00401e"/>
      <stop offset="55%" stop-color="#006C35"/>
      <stop offset="100%" stop-color="#0a8f4a"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#g)"/>
  <g fill="#D4AF37" opacity="0.28">
    <circle cx="200" cy="170" r="120"/><circle cx="1010" cy="640" r="160"/>
    <rect x="520" y="90" width="160" height="620" rx="80"/>
  </g>
  <text x="600" y="420" font-family="sans-serif" font-size="64" font-weight="bold"
        fill="#ffffff" text-anchor="middle">صورة مؤقتة</text>
  <text x="600" y="500" font-family="sans-serif" font-size="38"
        fill="#f4dd8f" text-anchor="middle">${label.replace(/[<>&]/g, "")}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default function ZoomImage({ src, step, label, className = "" }: Props) {
  const [failed, setFailed] = useState(false);

  // درجة 1 = تقريب شديد جدًا، ثم تتوسع تدريجيًا حتى الصورة كاملة
  const scales = [5, 3.2, 2.1, 1.45, 1];
  const scale = scales[Math.min(4, Math.max(0, step - 1))];

  return (
    <div className={`relative overflow-hidden rounded-3xl gold-border bg-black/40 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={failed ? placeholder(label) : src}
        alt="صورة اللغز"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
        style={{
          transform: `scale(${scale})`,
          transition: "transform 900ms cubic-bezier(.2,.8,.3,1)",
          filter: step === 1 ? "saturate(1.1)" : "none",
        }}
      />
      <div className="absolute bottom-4 left-4 rounded-full bg-black/60 px-4 py-2 text-xl font-bold text-gold-300">
        التقريب {step} / 5
      </div>
    </div>
  );
}
