import type { Player, Team } from "./types";

/**
 * يختار الفريق الأنسب للاعب جديد:
 * الأقل عددًا أولًا، ثم الأقل نقاطًا عند تساوي العدد.
 */
export function balancedTeam(players: Player[]): Team {
  const falcons = players.filter((p) => p.team === "falcons");
  const elite = players.filter((p) => p.team === "elite");

  if (falcons.length !== elite.length) {
    return falcons.length < elite.length ? "falcons" : "elite";
  }

  const sum = (list: Player[]) => list.reduce((total, p) => total + p.score, 0);
  const sf = sum(falcons);
  const se = sum(elite);
  if (sf !== se) return sf < se ? "falcons" : "elite";

  return Math.random() < 0.5 ? "falcons" : "elite";
}
