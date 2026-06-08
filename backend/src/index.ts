import express from "express";
import cors from "cors";
import { initDb, db } from "./db";
import playersRouter from "./routes/players";
import spinRouter from "./routes/spin";
import simulateRouter from "./routes/simulate";
import fs from "fs";
import path from "path";
import { shareRouter } from "./routes/share";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: "*" }));
app.use(express.json());

app.use("/api/players", playersRouter);
app.use("/api/spin", spinRouter);
app.use("/api/simulate", simulateRouter);
app.use("/api/share", shareRouter);

app.get("/share/:id", (req, res) => {
  const id = req.params.id;
  const imageUrl = `https://skillful-quietude-production-5c71.up.railway.app/api/share/${id}/image`;
  const shareUrl = `https://skillful-quietude-production-5c71.up.railway.app/share/${id}`;

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>AFL Dream Draft</title>
  <meta property="og:title" content="AFL Dream Draft" />
  <meta property="og:description" content="Check out my All-Time AFL Dream Team!" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:width" content="800" />
  <meta property="og:image:height" content="600" />
  <meta property="og:url" content="${shareUrl}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${imageUrl}" />
  <meta name="twitter:title" content="AFL Dream Draft" />
  <meta name="twitter:description" content="Check out my All-Time AFL Dream Team!" />
  <meta http-equiv="refresh" content="0;url=/#/share/${id}" />
</head>
<body>
  <p>Redirecting...</p>
</body>
</html>`);
});

app.get("/health", (_req, res) => res.json({ ok: true }));

async function seedIfEmpty() {
  const result = await db.execute("SELECT COUNT(*) as count FROM players");
  const count = result.rows[0].count as number;
  console.log(`Player count: ${count}`);
  if (count > 0) return;
  console.log("Seeding database...");
  const DATA_PATH = path.resolve(process.cwd(), "data/players.json");
  console.log(`Loading from: ${DATA_PATH}`);
  const raw = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  console.log(`Found ${raw.length} players`);
  for (const p of raw) {
    await db.execute({
      sql: `INSERT INTO players (name, club, decade, games, goals, disposals, marks, tackles, hitouts, clearances, inside50s, kicks, handballs, rebounds, position, secondaryPosition) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [p.name, p.club, p.decade, p.games, p.goals, p.disposals, p.marks, p.tackles, p.hitouts, p.clearances, p.inside50s, p.kicks ?? 0, p.handballs ?? 0, p.rebounds ?? 0, p.position, p.secondaryPosition ?? null],
    });
  }
  console.log("Seeding done.");
}

async function start() {
  await initDb();
  await seedIfEmpty();
  app.listen(PORT, () => {
    console.log(`23-0 API running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);