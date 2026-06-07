import { createClient } from "@libsql/client";
import path from "path";

const dbPath = path.resolve(process.cwd(), "data/game.db");

export const db = createClient({
  url: `file:${dbPath}`,
});

export async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS players (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      name              TEXT NOT NULL,
      club              TEXT NOT NULL,
      decade            TEXT NOT NULL,
      games             INTEGER DEFAULT 0,
      goals             REAL DEFAULT 0,
      disposals         REAL DEFAULT 0,
      marks             REAL DEFAULT 0,
      tackles           REAL DEFAULT 0,
      hitouts           REAL DEFAULT 0,
      clearances        REAL DEFAULT 0,
      inside50s         REAL DEFAULT 0,
      kicks             REAL DEFAULT 0,
      handballs         REAL DEFAULT 0,
      rebounds          REAL DEFAULT 0,
      position          TEXT DEFAULT 'MID',
      secondaryPosition TEXT DEFAULT NULL
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_club_decade ON players(club, decade)
  `);
}
