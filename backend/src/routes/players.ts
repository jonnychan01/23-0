import { Router } from "express";
import { db } from "../db";

const router = Router();

const POS_MAP: Record<string, string> = {
  C: "MID", ROV: "MID", UTIL: "MID",
};

router.get("/candidates", async (req, res) => {
  const { club, decade, exclude } = req.query as Record<string, string>;

  if (!club || !decade) {
    return res.status(400).json({ error: "club and decade required" });
  }

  const excludeIds = exclude
    ? exclude.split(",").map(Number).filter(Boolean)
    : [];

  try {
    const result = await db.execute({
      sql: `SELECT * FROM players
            WHERE club = ? AND decade = ?
            ORDER BY (goals * 4.5 + disposals * 1.2 + marks * 1.8 + tackles * 1.5 + hitouts * 0.6 + clearances * 2.0 + inside50s * 1.6) DESC`,
      args: [club, decade],
    });

    const rows = result.rows
    .filter((r) => !excludeIds.includes(r.id as number))
    .map((r) => {
      return {
        id: r.id,
        name: r.name,
        club: r.club,
        decade: r.decade,
        games: r.games,
        goals: r.goals,
        disposals: r.disposals,
        marks: r.marks,
        tackles: r.tackles,
        hitouts: r.hitouts,
        clearances: r.clearances,
        inside50s: r.inside50s,
        kicks: r.kicks,
        handballs: r.handballs,
        rebounds: r.rebounds,
        position: POS_MAP[r.position as string] ?? r.position,
        secondaryPosition: r.secondaryPosition,
      };
    });

return res.json(rows);
} catch (e) {
  console.error(e);
  return res.status(500).json({ error: "DB error" });
}
});

router.get("/clubs", async (_req, res) => {
  const result = await db.execute("SELECT DISTINCT club FROM players ORDER BY club");
  res.json(result.rows.map((r) => r.club));
});

router.get("/decades", async (_req, res) => {
  const result = await db.execute("SELECT DISTINCT decade FROM players ORDER BY decade");
  res.json(result.rows.map((r) => r.decade));
});

export default router;