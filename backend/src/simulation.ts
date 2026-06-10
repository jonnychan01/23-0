export interface DraftedPlayer {
  id: number;
  name: string;
  club: string;
  decade: string;
  games: number;
  goals: number;
  disposals: number;
  marks: number;
  tackles: number;
  hitouts: number;
  clearances: number;
  inside50s: number;
  position: string;
}

export interface SimResult {
  wins: number;
  losses: number;
  teamRating: number;
  breakdown: {
    attacking: number;
    midfield: number;
    defensive: number;
    ruck: number;
    balance: number;
  };
  mvp: string;
}

const ERA_MULTIPLIERS: Record<string, number> = {
  "1970s": 1.12,
  "1980s": 1.08,
  "1990s": 1.04,
  "2000s": 1.02,
  "2010s": 1.00,
  "2020s": 1.00,
};

function eraMultiplier(decade: string): number {
  return ERA_MULTIPLIERS[decade] ?? 1.0;
}

function sigmoid(x: number, midpoint: number, steepness: number): number {
  return 1 / (1 + Math.exp(-steepness * (x - midpoint)));
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// Raw score 0-100 based on position benchmarks
// 50 = solid player, 100 = theoretical max
function rawPlayerScore(p: DraftedPlayer): number {
  const { goals, disposals, marks, tackles, clearances, hitouts } = p;

  if (p.position === "FF") {
    return (
      Math.min(100, (goals / 6.0)      * 55) +
      Math.min(100, (marks / 10.0)     * 30) +
      Math.min(100, (disposals / 22.0) * 15)
    );
  } else if (p.position === "FP") {
    return (
      Math.min(100, (goals / 6.0)      * 60) +
      Math.min(100, (marks / 8.0)      * 25) +
      Math.min(100, (disposals / 18.0) * 15)
    );
  } else if (p.position === "CHF") {
    return (
      Math.min(100, (goals / 3.0)      * 30) +
      Math.min(100, (marks / 11.0)     * 40) +
      Math.min(100, (disposals / 26.0) * 30)
    );
  } else if (p.position === "HFF") {
    return (
      Math.min(100, (disposals / 38.0) * 35) +
      Math.min(100, (clearances / 8.0) * 25) +
      Math.min(100, (tackles / 6.5)    * 20) +
      Math.min(100, (goals / 2.0)      * 20)
    );
  } else if (p.position === "MID") {
    return (
      Math.min(100, (disposals / 40.0) * 30) +
      Math.min(100, (clearances / 9.0) * 35) +
      Math.min(100, (tackles / 8.0)    * 25) +
      Math.min(100, (goals / 1.5)      * 10)
    );
  } else if (p.position === "WNG") {
    return (
      Math.min(100, (disposals / 32.0) * 50) +
      Math.min(100, (marks / 6.0)      * 25) +
      Math.min(100, (tackles / 3.5)    * 15) +
      Math.min(100, (goals / 1.0)      * 10)
    );
  } else if (p.position === "RUC") {
    return (
      Math.min(100, (hitouts / 30.0)   * 55) +
      Math.min(100, (marks / 12.0)     * 25) +
      Math.min(100, (disposals / 24.0) * 20)
    );
  } else if (p.position === "CHB") {
    return (
      Math.min(100, (disposals / 28.0) * 40) +
      Math.min(100, (marks / 9.0)      * 35) +
      Math.min(100, (tackles / 5.0)    * 25)
    );
  } else if (p.position === "HBF") {
    return (
      Math.min(100, (disposals / 34.0) * 45) +
      Math.min(100, (marks / 7.0)      * 30) +
      Math.min(100, (tackles / 6.0)    * 25)
    );
  } else if (p.position === "FB") {
    return (
      Math.min(100, (disposals / 30.0) * 45) +
      Math.min(100, (marks / 9.0)      * 40) +
      Math.min(100, (tackles / 4.0)    * 15)
    );
  } else if (p.position === "BP") {
    return (
      Math.min(100, (disposals / 28.0) * 45) +
      Math.min(100, (marks / 7.0)      * 40) +
      Math.min(100, (tackles / 4.5)    * 15)
    );
  }
  return 0;
}

function playerScore(p: DraftedPlayer): number {
  const era = eraMultiplier(p.decade);
  const gameFactor = Math.min(1.0,
    Math.log10(Math.max(p.games, 1)) / Math.log10(250)
  );

  const raw = rawPlayerScore(p) * era * (0.85 + 0.15 * gameFactor);

  // Sigmoid so average players (~30 raw) score ~35, elite (~90 raw) score ~90+
  // Stops average stats from inflating to 80+
  return Math.min(100, sigmoid(raw, 45, 0.08) * 100);
}

export function simulate(roster: DraftedPlayer[]): SimResult {
  if (roster.length === 0) {
    return {
      wins: 0, losses: 23, teamRating: 0,
      breakdown: { attacking: 0, midfield: 0, defensive: 0, ruck: 0, balance: 0 },
      mvp: "N/A",
    };
  }

  const scored = roster.map(p => ({ player: p, score: playerScore(p) }));
  scored.sort((a, b) => b.score - a.score);

  const forwards = scored.filter(r => ["FF", "FP", "CHF", "HFF"].includes(r.player.position));
  const mids     = scored.filter(r => ["MID", "WNG"].includes(r.player.position));
  const backs    = scored.filter(r => ["FB", "BP", "CHB", "HBF"].includes(r.player.position));
  const rucks    = scored.filter(r => r.player.position === "RUC");

  const attackScore = avg(forwards.map(r => r.score));
  const midScore    = avg(mids.map(r => r.score));
  const defScore    = avg(backs.map(r => r.score));
  const ruckScore   = avg(rucks.map(r => r.score));

  const attackFinal = forwards.length > 0 ? attackScore : 15;
  const midFinal    = mids.length > 0     ? midScore    : 15;
  const defFinal    = backs.length > 0    ? defScore    : 15;
  const ruckFinal   = rucks.length > 0    ? ruckScore   : 20;

  // Geometric mean — weak zones drag whole team down
  const composite =
    Math.pow(attackFinal, 0.25) *
    Math.pow(midFinal,    0.28) *
    Math.pow(defFinal,    0.22) *
    Math.pow(ruckFinal,   0.10) *
    Math.pow(avg(scored.map(r => r.score)), 0.15);

  const teamRating = Math.min(100, composite);

  // Sigmoid win mapping:
  // teamRating 90+ → ~22-23 wins
  // teamRating 60  → ~12-14 wins  
  // teamRating 40  → ~5-8 wins
  // teamRating 20  → ~1-3 wins
  const winProb = sigmoid(teamRating, 43, 0.10);
  const rawWins = winProb * 23;

  const noise = teamRating >= 88 ? 0 : (Math.random() - 0.5) * 4.0;
  const wins = Math.max(0, Math.min(23, Math.round(rawWins + noise)));

  const zones = [attackFinal, midFinal, defFinal, ruckFinal];
  const avgZone = avg(zones);
  const variance = avg(zones.map(z => Math.pow(z - avgZone, 2)));
  const balanceScore = Math.max(0, Math.round(100 - Math.sqrt(variance)));

  return {
    wins,
    losses: 23 - wins,
    teamRating: Math.round(teamRating * 10) / 10,
    breakdown: {
      attacking: Math.round(attackScore),
      midfield:  Math.round(midScore),
      defensive: Math.round(defScore),
      ruck:      Math.round(ruckScore),
      balance:   balanceScore,
    },
    mvp: scored[0]?.player.name ?? "Unknown",
  };
}