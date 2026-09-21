"use client";

import { useEffect, useRef, useState } from "react";
import { TEAMS, type Player, type Team } from "@/lib/types";

interface Props {
  falcons: number;
  elite: number;
  players?: Player[];
  compact?: boolean;
}

function useBump(value: number) {
  const [bump, setBump] = useState(false);
  const prev = useRef(value);
  const [delta, setDelta] = useState(0);

  useEffect(() => {
    if (value !== prev.current) {
      setDelta(value - prev.current);
      prev.current = value;
      setBump(true);
      const id = window.setTimeout(() => setBump(false), 900);
      return () => window.clearTimeout(id);
    }
  }, [value]);

  return { bump, delta };
}

function TeamScore({ team, score, count, compact }: { team: Team; score: number; count: number; compact?: boolean }) {
  const meta = TEAMS[team];
  const { bump, delta } = useBump(score);

  return (
    <div
      className={`relative flex flex-1 items-center justify-between gap-4 rounded-3xl px-6 ${
        compact ? "py-3" : "py-5"
      } transition-shadow`}
      style={{
        background: `linear-gradient(90deg, ${meta.color}33, ${meta.color}11)`,
        border: `2px solid ${meta.color}88`,
        boxShadow: bump ? `0 0 60px ${meta.color}66` : "none",
      }}
    >
      <div className="flex items-center gap-3">
        <span className={compact ? "text-3xl" : "text-5xl"}>{meta.emoji}</span>
        <div className="text-right">
          <div className={`font-black leading-none ${compact ? "text-2xl" : "text-5xl"}`}>{meta.name}</div>
          <div className={`text-white/60 ${compact ? "text-sm" : "text-xl"}`}>{count} لاعب</div>
        </div>
      </div>

      <div className="relative">
        <div
          className={`font-black tabular-nums leading-none ${compact ? "text-4xl" : "text-7xl"} ${
            bump ? "animate-score-pop" : ""
          }`}
          style={{ color: meta.color }}
        >
          {score.toLocaleString("ar-SA")}
        </div>
        {bump && delta !== 0 && (
          <div
            className={`absolute -top-8 left-1/2 -translate-x-1/2 font-black animate-slide-up ${
              compact ? "text-xl" : "text-3xl"
            }`}
            style={{ color: delta > 0 ? "#6ee7a0" : "#ff8b8b" }}
          >
            {delta > 0 ? `+${delta}` : delta}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Scoreboard({ falcons, elite, players = [], compact }: Props) {
  const countOf = (t: Team) => players.filter((p) => p.team === t).length;

  return (
    <div className={`flex w-full gap-4 ${compact ? "" : "gap-6"}`}>
      <TeamScore team="falcons" score={falcons} count={countOf("falcons")} compact={compact} />
      <TeamScore team="elite" score={elite} count={countOf("elite")} compact={compact} />
    </div>
  );
}
