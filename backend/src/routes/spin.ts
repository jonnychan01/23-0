import { Router } from "express";
import { db } from "../db";

const router = Router();

router.get("/", async (req, res) => {
  const { exclude_clubs, exclude_decades } = req.query as Record<string, string>;

  const exClubs   = exclude_clubs   ? exclude_clubs.split(",")   : [];
  const exDecades = exclude_decades ? exclude_decades.split(",") : [];

  try {
    // Only pick combos that actually have players
    const result = await db.execute(
      "SELECT DISTINCT club, decade FROM players ORDER BY RANDOM()"
    );

    let combos = result.rows.filter(
      (r) => !exClubs.includes(r.club as string) && !exDecades.includes(r.decade as string)
    );

    if (combos.length === 0) {
      return res.status(400).json({ error: "No valid combinations remain" });
    }

    const picked = combos[0];
    return res.json({ club: picked.club, decade: picked.decade, playerCount: 1 });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Spin failed" });
  }
});

export default router;