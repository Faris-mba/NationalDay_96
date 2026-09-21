"use client";

import { useEffect, useRef } from "react";
import { play } from "@/lib/sound";

interface Props {
  remaining: number;
  total: number;
  running: boolean;
  size?: "tv" | "phone";
  /** تشغيل صوت العدّ التنازلي (شاشة التلفزيون فقط حتى لا تتداخل الأصوات) */
  withSound?: boolean;
}

export default function Timer({ remaining, total, running, size = "tv", withSound }: Props) {
  const lastSecond = useRef(-1);
  const seconds = Math.ceil(remaining);

  useEffect(() => {
    if (!withSound || !running) {
      lastSecond.current = -1;
      return;
    }
    if (seconds !== lastSecond.current) {
      lastSecond.current = seconds;
      if (seconds <= 5 && seconds > 0) play("tickUrgent");
      else if (seconds <= 10 && seconds > 0) play("tick");
    }
  }, [seconds, running, withSound]);

  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const urgent = seconds <= 5 && running;
  const dim = size === "tv" ? 168 : 92;
  const stroke = size === "tv" ? 14 : 9;
  const r = (dim - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className="relative shrink-0" style={{ width: dim, height: dim }}>
      <svg width={dim} height={dim} className="-rotate-90">
        <circle cx={dim / 2} cy={dim / 2} r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={stroke} />
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          stroke={urgent ? "#ff6b6b" : "#D4AF37"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 120ms linear, stroke 300ms" }}
        />
      </svg>
      <div
        className={`absolute inset-0 grid place-items-center font-black tabular-nums ${
          size === "tv" ? "text-6xl" : "text-3xl"
        } ${urgent ? "text-red-400" : "text-white"}`}
      >
        {seconds}
      </div>
    </div>
  );
}
