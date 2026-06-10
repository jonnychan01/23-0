import type { Player, Position, SimResult, SpinResult } from "../types";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

export async function spinReel(
  excludeClubs: string[] = [],
  excludeDecades: string[] = []
): Promise<SpinResult> {
  const params = new URLSearchParams();
  if (excludeClubs.length)   params.set("exclude_clubs",   excludeClubs.join(","));
  if (excludeDecades.length) params.set("exclude_decades", excludeDecades.join(","));
  const res = await fetch(`${BASE}/spin?${params}`);
  if (!res.ok) throw new Error("Spin failed");
  return res.json();
}

export async function fetchCandidates(
  club: string,
  decade: string,
  excludeNames: string[] = [],
  availablePositions: string[] = []
): Promise<Player[]> {
  const params = new URLSearchParams({ club, decade });
  if (excludeNames.length) params.set("exclude_names", excludeNames.join(","));
  if (availablePositions.length) params.set("positions", availablePositions.join(","));
  const res = await fetch(`${BASE}/players/candidates?${params}`);
  if (!res.ok) throw new Error("Fetch candidates failed");
  return res.json();
}

export async function simulateSeason(roster: Player[]): Promise<SimResult> {
  const res = await fetch(`${BASE}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roster }),
  });
  if (!res.ok) throw new Error("Simulate failed");
  return res.json();
}