import { Router } from "express";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { simulate } from "../simulation";
import type { DraftedPlayer } from "../simulation";
import * as crypto from "crypto";
import * as path from "path";
import { db } from "../db";

export const shareRouter = Router();

GlobalFonts.registerFromPath(path.join(__dirname, "../fonts/NotoSans.ttf"), "NotoSans");
GlobalFonts.registerFromPath(path.join(__dirname, "../fonts/NotoSans-Bold.ttf"), "NotoSansBold");

const TEAM_COLOURS: Record<string, { primary: string; secondary: string }> = {
  "Adelaide":         { primary: "#002B5C", secondary: "#E21937" },
  "Brisbane Lions":   { primary: "#A30046", secondary: "#0054A4" },
  "Carlton":          { primary: "#0E1E2D", secondary: "#FFFFFF" },
  "Collingwood":      { primary: "#000000", secondary: "#FFFFFF" },
  "Essendon":         { primary: "#CC2031", secondary: "#000000" },
  "Fremantle":        { primary: "#2A1A54", secondary: "#FFFFFF" },
  "Geelong":          { primary: "#1C3C6B", secondary: "#FFFFFF" },
  "Gold Coast":       { primary: "#E8213B", secondary: "#FFD200" },
  "GWS Giants":       { primary: "#F15C22", secondary: "#000000" },
  "Hawthorn":         { primary: "#4D2004", secondary: "#FBBF15" },
  "Melbourne":        { primary: "#0F1131", secondary: "#CC2031" },
  "North Melbourne":  { primary: "#003B99", secondary: "#FFFFFF" },
  "Port Adelaide":    { primary: "#008AAB", secondary: "#000000" },
  "Richmond":         { primary: "#FFD200", secondary: "#000000" },
  "St Kilda":         { primary: "#ED0F05", secondary: "#000000" },
  "Sydney":           { primary: "#E3262C", secondary: "#FFFFFF" },
  "West Coast":       { primary: "#003087", secondary: "#F2A900" },
  "Western Bulldogs": { primary: "#014896", secondary: "#FFFFFF" },
};

function generateShareImage(roster: DraftedPlayer[], simResult: ReturnType<typeof simulate>): Buffer {
  const W = 800;
  const HEADER = 100;
  const ROW_H = 44;
  const PADDING = 20;
  const COLS = 2;
  const rows = Math.ceil(roster.length / COLS);
  const H = HEADER + rows * ROW_H + PADDING * 2 + 60;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#1e3a5f";
  ctx.fillRect(0, 0, W, HEADER);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 26px NotoSansBold";
  ctx.fillText("AFL Dream Draft", PADDING, 38);

  ctx.fillStyle = "#93c5fd";
  ctx.font = "14px NotoSans";
  ctx.fillText(`${simResult.wins}-${simResult.losses} · ${simResult.wins === 23 ? "Undefeated" : simResult.wins >= 20 ? "Premiership Contenders" : simResult.wins >= 16 ? "Finals Certainty" : simResult.wins >= 12 ? "Finals Chance" : simResult.wins >= 8 ? "Mid-Table" : "Wooden Spoon"} · Rating: ${simResult.teamRating}`, PADDING, 62);

  ctx.fillStyle = "#fde68a";
  ctx.font = "bold 14px NotoSansBold";
  ctx.fillText(`MVP: ${simResult.mvp}`, PADDING, 84);

  const COL_W = (W - PADDING * 2) / COLS;

  roster.forEach((p, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = PADDING + col * COL_W;
    const y = HEADER + PADDING + row * ROW_H;

    const colours = TEAM_COLOURS[p.club] ?? { primary: "#1e3a5f", secondary: "#FFFFFF" };

    ctx.fillStyle = colours.primary;
    ctx.beginPath();
    ctx.roundRect(x, y + 4, 32, 32, 4);
    ctx.fill();

    ctx.fillStyle = colours.secondary;
    ctx.font = "bold 12px NotoSansBold";
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), x + 16, y + 24);
    ctx.textAlign = "left";

    ctx.fillStyle = colours.primary;
    ctx.beginPath();
    ctx.roundRect(x + 38, y + 4, 36, 18, 3);
    ctx.fill();

    ctx.fillStyle = colours.secondary;
    ctx.font = "bold 10px NotoSansBold";
    ctx.textAlign = "center";
    ctx.fillText(p.position, x + 56, y + 16);
    ctx.textAlign = "left";

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 14px NotoSansBold";
    ctx.fillText(p.name, x + 80, y + 17);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px NotoSans";
    ctx.fillText(`${p.club} · ${p.decade}`, x + 80, y + 32);
  });

  const footerY = HEADER + PADDING + rows * ROW_H + 16;
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "12px NotoSans";
  ctx.textAlign = "center";
  ctx.fillText("23-0-production.up.railway.app", W / 2, footerY);

  return canvas.toBuffer("image/png") as unknown as Buffer;
}

db.execute(`
  CREATE TABLE IF NOT EXISTS shares (
    id TEXT PRIMARY KEY,
    roster TEXT NOT NULL,
    sim_result TEXT NOT NULL,
    image BLOB NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

shareRouter.post("/", async (req, res) => {
  try {
    const { roster } = req.body as { roster: DraftedPlayer[] };
    if (!roster || !Array.isArray(roster)) {
      return res.status(400).json({ error: "Invalid roster" });
    }

    const simResult = simulate(roster);
    const imageBuffer = generateShareImage(roster, simResult);
    const id = crypto.randomBytes(8).toString("hex");

    await db.execute({
      sql: `INSERT INTO shares (id, roster, sim_result, image, created_at) VALUES (?, ?, ?, ?, ?)`,
      args: [id, JSON.stringify(roster), JSON.stringify(simResult), imageBuffer, Date.now()],
    });

    res.json({ id, url: `/share/${id}` });
  } catch (err) {
    console.error("Share generation failed:", err);
    res.status(500).json({ error: "Failed to generate share image" });
  }
});

shareRouter.get("/:id/image", async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT image FROM shares WHERE id = ?`,
      args: [req.params.id],
    });
    if (!result.rows.length) return res.status(404).send("Not found");
    const image = Buffer.from(result.rows[0].image as ArrayBuffer);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.send(image);
  } catch (err) {
    res.status(500).send("Error");
  }
});

shareRouter.get("/:id/meta", async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT roster, sim_result FROM shares WHERE id = ?`,
      args: [req.params.id],
    });
    if (!result.rows.length) return res.status(404).json({ error: "Not found" });
    res.json({
      roster: JSON.parse(result.rows[0].roster as string),
      simResult: JSON.parse(result.rows[0].sim_result as string),
    });
  } catch (err) {
    res.status(500).json({ error: "Error" });
  }
});