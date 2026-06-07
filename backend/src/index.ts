import express from "express";
import cors from "cors";
import { initDb } from "./db";
import playersRouter from "./routes/players";
import spinRouter from "./routes/spin";
import simulateRouter from "./routes/simulate";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: ["http://localhost:5173", "http://localhost:4173"] }));
app.use(express.json());

app.use("/api/players", playersRouter);
app.use("/api/spin", spinRouter);
app.use("/api/simulate", simulateRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`23-0 API running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);
