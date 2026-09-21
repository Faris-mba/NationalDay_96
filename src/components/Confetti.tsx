"use client";

import { useEffect, useRef } from "react";

/** كونفيتي أخضر وأبيض وذهبي على canvas — بلا مكتبات. */
export default function Confetti({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const colors = ["#006C35", "#0a8f4a", "#ffffff", "#D4AF37", "#f4dd8f"];
    const count = reduced ? 60 : 220;

    const pieces = Array.from({ length: count }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * -window.innerHeight,
      w: 6 + Math.random() * 10,
      h: 10 + Math.random() * 16,
      vy: 1.6 + Math.random() * 3.4,
      vx: -1.2 + Math.random() * 2.4,
      rot: Math.random() * Math.PI,
      vr: -0.12 + Math.random() * 0.24,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const p of pieces) {
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.vr;
        if (p.y > window.innerHeight + 40) {
          p.y = -30;
          p.x = Math.random() * window.innerWidth;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [active]);

  if (!active) return null;
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-50" aria-hidden />;
}
