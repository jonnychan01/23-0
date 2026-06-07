import { Router } from "express";
import { simulate, DraftedPlayer } from "../simulation";

const router = Router();

// POST /api/simulate
// Body: { roster: DraftedPlayer[] }
router.post("/", (req, res) => {
  const { roster } = req.body as { roster: DraftedPlayer[] };

  if (!Array.isArray(roster) || roster.length === 0) {
    return res.status(400).json({ error: "roster array required" });
  }

  const result = simulate(roster);
  return res.json(result);
});

export default router;
