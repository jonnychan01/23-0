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

// ---------------- ERA ----------------

const ERA_MULTIPLIERS: Record<string, number> = {
  "1890s": 1.55,
  "1900s": 1.50,
  "1910s": 1.45,
  "1920s": 1.40,
  "1930s": 1.38,
  "1940s": 1.35,
  "1950s": 1.30,
  "1960s": 1.25,
  "1970s": 1.18,
  "1980s": 1.10,
  "1990s": 1.05,
  "2000s": 1.02,
  "2010s": 1.00,
  "2020s": 1.00,
};

function eraMultiplier(decade: string): number {
  return ERA_MULTIPLIERS[decade] ?? 1.0;
}

function isPreStatEra(decade: string): boolean {
  return decade < "1970s";
}

// ---------------- STAT ESTIMATION ----------------

function estimateStat(
  p: DraftedPlayer,
  stat: number,
  type: keyof DraftedPlayer
): number {
  if (stat > 0) return stat;
  if (!isPreStatEra(p.decade)) return stat;

  const g = Math.max(p.games, 1);

  switch (type) {
    case "disposals":
      return ["C", "ROV", "WNG"].includes(p.position) ? g * 18 : g * 12;

    case "marks":
      if (p.position.includes("B")) return g * 5;
      if (p.position.includes("F")) return g * 4;
      return g * 3;

    case "tackles":
      return g * 3;

    case "clearances":
      return ["C", "ROV"].includes(p.position) ? g * 4 : g * 1;

    case "inside50s":
      return p.position.includes("F") ? g * 4 : g * 1;

    case "hitouts":
      return p.position === "RK" ? g * 25 : 0;

    default:
      return stat;
  }
}

// ---------------- PLAYER RATING ----------------

function playerRating(p: DraftedPlayer): number {
  const era = eraMultiplier(p.decade);

  const disposals  = estimateStat(p, p.disposals, "disposals");
  const marks      = estimateStat(p, p.marks, "marks");
  const tackles    = estimateStat(p, p.tackles, "tackles");
  const clearances = estimateStat(p, p.clearances, "clearances");
  const inside50s  = estimateStat(p, p.inside50s, "inside50s");
  const hitouts    = estimateStat(p, p.hitouts, "hitouts");

  let raw = 0;

  if (["FF", "FP", "CHF"].includes(p.position)) {
    raw =
      p.goals * 5.0 +
      marks * 2.0 +
      inside50s * 1.5 +
      disposals * 0.8;
  } else if (["C", "WNG", "ROV"].includes(p.position)) {
    raw =
      disposals * 1.8 +
      clearances * 2.5 +
      inside50s * 1.5 +
      tackles * 1.2;
  } else if (["FB", "BP", "CHB", "HBF"].includes(p.position)) {
    raw =
      marks * 2.5 +
      tackles * 2.0 +
      disposals * 1.0;
  } else if (["RK"].includes(p.position)) {
    raw =
      hitouts * 1.5 +
      clearances * 1.5 +
      disposals * 1.0;
  } else {
    raw =
      p.goals * 3.0 +
      disposals * 1.2 +
      marks * 1.5 +
      tackles * 1.5;
  }

  const gameFactor =
    Math.log10(Math.max(p.games, 1)) / Math.log10(350);

  return raw * era * (0.85 + 0.15 * gameFactor);
}

// ---------------- HELPERS ----------------

function sigmoid(x: number, midpoint: number, steepness: number): number {
  return 1 / (1 + Math.exp(-steepness * (x - midpoint)));
}

function sum(arr: { rating: number }[]): number {
  return arr.reduce((s, r) => s + r.rating, 0);
}

// ---------------- SIMULATION ----------------

export function simulate(roster: DraftedPlayer[]): SimResult {
  if (roster.length === 0) {
    return {
      wins: 0,
      losses: 23,
      teamRating: 0,
      breakdown: {
        attacking: 0,
        midfield: 0,
        defensive: 0,
        ruck: 0,
        balance: 0,
      },
      mvp: "N/A",
    };
  }

  const ratings = roster.map((p) => ({
    player: p,
    rating: playerRating(p),
  }));

  ratings.sort((a, b) => b.rating - a.rating);

  const forwardPositions  = new Set(["FF", "FP", "CHF"]);
  const midfieldPositions = new Set(["C", "WNG", "ROV"]);
  const backPositions     = new Set(["FB", "BP", "CHB", "HBF"]);
  const ruckPositions     = new Set(["RK"]);

  const forwards = ratings.filter((r) => forwardPositions.has(r.player.position));
  const mids     = ratings.filter((r) => midfieldPositions.has(r.player.position));
  const backs    = ratings.filter((r) => backPositions.has(r.player.position));
  const rucks    = ratings.filter((r) => ruckPositions.has(r.player.position));

  const totalRating = sum(ratings);
  const avgRating   = totalRating / roster.length;

  // ---------------- NORMALIZATION (FIXED) ----------------

  const normalize = (value: number) =>
    Math.min(100, (value / avgRating) * 100);

  const attackScore = normalize(sum(forwards) / Math.max(forwards.length, 1));
  const midScore    = normalize(sum(mids)     / Math.max(mids.length, 1));
  const defScore    = normalize(sum(backs)    / Math.max(backs.length, 1));
  const ruckScore   = normalize(sum(rucks)    / Math.max(rucks.length, 1));

  const normalizedAvg = Math.min(100, avgRating / avgRating * 100); // always 100 (intentional anchor)

  // ---------------- BALANCE ----------------

  const zoneScores = [attackScore, midScore, defScore, ruckScore].filter(
    (score, i) =>
      [forwards.length, mids.length, backs.length, rucks.length][i] > 0
  );

  const avgZone =
    zoneScores.reduce((a, b) => a + b, 0) / zoneScores.length;

  const variance =
    zoneScores.reduce((s, v) => s + Math.pow(v - avgZone, 2), 0) /
    zoneScores.length;

  const balancePenalty = Math.min(15, Math.sqrt(variance) * 0.25);

  // ---------------- DEPTH (FIXED) ----------------

  const bottom6 = ratings.slice(-6);
  const bottom6Avg =
    bottom6.reduce((s, r) => s + r.rating, 0) /
    Math.max(bottom6.length, 1);

  const depthFactor = Math.max(
    0.7,
    Math.min(1.05, bottom6Avg / avgRating)
  );

  // ---------------- FINAL TEAM RATING ----------------

  const compositeRating = Math.max(
    0,
    Math.min(
      100,
      (attackScore * 0.30 +
        midScore * 0.30 +
        defScore * 0.20 +
        ruckScore * 0.05 +
        normalizedAvg * 0.15) *
        depthFactor -
        balancePenalty
    )
  );

  // ---------------- WINS (FIXED CURVE) ----------------

  const winProb23 = sigmoid(compositeRating, 48, 0.07);
  const rawWins   = winProb23 * 23;

  const varianceNoise = (Math.random() - 0.5) * 3;

  const wins = Math.max(
    0,
    Math.min(23, Math.round(rawWins + varianceNoise))
  );

  const mvp = ratings[0]?.player.name ?? "Unknown";

  return {
    wins,
    losses: 23 - wins,
    teamRating: Math.round(compositeRating * 10) / 10,
    breakdown: {
      attacking: Math.round(attackScore),
      midfield:  Math.round(midScore),
      defensive: Math.round(defScore),
      ruck:      Math.round(ruckScore),
      balance:   Math.round(100 - balancePenalty * 4),
    },
    mvp,
  };
}