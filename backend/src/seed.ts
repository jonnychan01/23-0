import { db, initDb } from "./db";
import fs from "fs";
import path from "path";

const DATA_PATH = path.resolve(__dirname, "../data/players.json");

interface RawPlayer {
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
  kicks?: number;
  handballs?: number;
  rebounds?: number;
  secondaryPosition?: string;
}

async function seed() {
  console.log("Initialising DB...");
  await initDb();

  if (!fs.existsSync(DATA_PATH)) {
    console.error(`No players.json found at ${DATA_PATH}`);
    console.error("Run the scraper first: python scraper/scrape_players.py");
    process.exit(1);
  }

  const raw: RawPlayer[] = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  console.log(`Seeding ${raw.length} players...`);

  await db.execute("DELETE FROM players");

  for (const p of raw) {
    await db.execute({
      sql: `INSERT INTO players
              (name, club, decade, games, goals, disposals, marks, tackles,
              hitouts, clearances, inside50s, kicks, handballs, rebounds,
              position, secondaryPosition)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        p.name, p.club, p.decade, p.games,
        p.goals, p.disposals, p.marks, p.tackles,
        p.hitouts, p.clearances, p.inside50s,
        p.kicks ?? 0, p.handballs ?? 0, p.rebounds ?? 0,
        p.position, p.secondaryPosition ?? null,
      ],
    });
  }

  console.log("Done.");
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
