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

// Per-game stats — simulation works on per-game averages not totals
function playerRating(p: DraftedPlayer): number {
  const era = eraMultiplier(p.decade);

  // Cap games at 250 so longevity doesn't dominate
  const gameFactor = Math.min(1.0,
    Math.log10(Math.max(p.games, 1)) / Math.log10(250)
  );

  // All stats are already per-game averages from the DB
  const goals      = p.goals;
  const disposals  = p.disposals;
  const marks      = p.marks;
  const tackles    = p.tackles;
  const clearances = p.clearances;
  const inside50s  = p.inside50s;
  const hitouts    = p.hitouts;

  let raw = 0;

  if (["FF", "FP"].includes(p.position)) {
    raw =
      goals * 8.0 +
      marks * 3.0 +
      inside50s * 2.0 +
      disposals * 1.0;
  } else if (["CHF", "HFF"].includes(p.position)) {
    raw =
      goals * 5.0 +
      marks * 4.0 +
      inside50s * 3.0 +
      disposals * 1.5;
  } else if (p.position === "MID") {
    raw =
      disposals * 3.0 +
      clearances * 4.0 +
      tackles * 2.5 +
      inside50s * 2.0 +
      goals * 3.0;
  } else if (p.position === "WNG") {
    raw =
      disposals * 2.5 +
      inside50s * 3.0 +
      marks * 2.0 +
      goals * 3.0 +
      tackles * 1.5;
  } else if (p.position === "RUC") {
    raw =
      hitouts * 2.5 +
      clearances * 3.0 +
      disposals * 1.5 +
      marks * 2.0;
  } else if (["CHB", "HBF"].includes(p.position)) {
    raw =
      marks * 4.0 +
      disposals * 2.5 +
      tackles * 3.0 +
      clearances * 1.5;
  } else if (["FB", "BP"].includes(p.position)) {
    raw =
      marks * 3.0 +
      tackles * 3.5 +
      disposals * 2.0;
  } else {
    raw =
      goals * 4.0 +
      disposals * 2.0 +
      marks * 2.5 +
      tackles * 2.0;
  }

  return raw * era * (0.85 + 0.15 * gameFactor);
}

function sigmoid(x: number, midpoint: number, steepness: number): number {
  return 1 / (1 + Math.exp(-steepness * (x - midpoint)));
}

function avg(arr: { rating: number }[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, r) => s + r.rating, 0) / arr.length;
}

export function simulate(roster: DraftedPlayer[]): SimResult {
  if (roster.length === 0) {
    return {
      wins: 0, losses: 23, teamRating: 0,
      breakdown: { attacking: 0, midfield: 0, defensive: 0, ruck: 0, balance: 0 },
      mvp: "N/A",
    };
  }

  const ratings = roster.map(p => ({ player: p, rating: playerRating(p) }));
  ratings.sort((a, b) => b.rating - a.rating);

  const forwards = ratings.filter(r => ["FF", "FP", "CHF", "HFF"].includes(r.player.position));
  const mids     = ratings.filter(r => ["MID", "WNG"].includes(r.player.position));
  const backs    = ratings.filter(r => ["FB", "BP", "CHB", "HBF"].includes(r.player.position));
  const rucks    = ratings.filter(r => r.player.position === "RUC");

  // Raised from 60 to 55 so ratings score higher, making good teams more achievable
  const EXPECTED = 55;
  const normalize = (val: number) => Math.min(100, (val / EXPECTED) * 100);

  const attackScore = normalize(avg(forwards));
  const midScore    = normalize(avg(mids));
  const defScore    = normalize(avg(backs));
  const ruckScore   = normalize(avg(rucks));
  const overallAvg  = normalize(avg(ratings));

  const zoneScores = [
    forwards.length > 0 ? attackScore : null,
    mids.length > 0     ? midScore    : null,
    backs.length > 0    ? defScore    : null,
    rucks.length > 0    ? ruckScore   : null,
  ].filter((s): s is number => s !== null);

  const avgZone = zoneScores.reduce((a, b) => a + b, 0) / zoneScores.length;
  const variance = zoneScores.reduce((s, v) => s + Math.pow(v - avgZone, 2), 0) / zoneScores.length;

  // Reduced from 0.3 to 0.25 — slightly less punishing for imbalanced rosters
  const balancePenalty = Math.min(20, Math.sqrt(variance) * 0.25);

  const bottom6Avg = avg(ratings.slice(-6));
  const depthFactor = Math.max(0.75, Math.min(1.05, bottom6Avg / avg(ratings)));

  const compositeRating = Math.max(0, Math.min(100,
    (attackScore * 0.28 +
     midScore    * 0.28 +
     defScore    * 0.20 +
     ruckScore   * 0.09 +
     overallAvg  * 0.15) * depthFactor - balancePenalty
  ));

  // midpoint 70→60: average teams win more; steepness 0.08→0.10: steeper spread
  // bad teams fall harder, great teams rise higher, but 23-0 needs ~95+ rating
  const winProb = sigmoid(compositeRating, 60, 0.10);
  const rawWins = winProb * 23;

  // Noise widened from ±1.25 to ±2.0 for more natural variance
  const noise = (Math.random() - 0.5) * 4.0;
  const wins = Math.max(0, Math.min(23, Math.round(rawWins + noise)));

  return {
    wins,
    losses: 23 - wins,
    teamRating: Math.round(compositeRating * 10) / 10,
    breakdown: {
      attacking: Math.round(attackScore),
      midfield:  Math.round(midScore),
      defensive: Math.round(defScore),
      ruck:      Math.round(ruckScore),
      // Reduced multiplier from 3 to 2.5 to match softer balance penalty
      balance:   Math.round(100 - balancePenalty * 2.5),
    },
    mvp: ratings[0]?.player.name ?? "Unknown",
  };
}