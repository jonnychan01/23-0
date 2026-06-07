import { useEffect, useState } from "react";
import type { Player, SimResult } from "../types";
import { TEAM_COLOURS } from "../types";

interface Props {
  roster: Player[];
  onSimulate: () => Promise<void>;
  simResult: SimResult | null;
  onRestart: () => void;
}

function StatBar({ label, value }: { label: string; value: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => { setTimeout(() => setWidth(value), 200); }, [value]);
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold" style={{ color: "#0f172a" }}>{value}</span>
      </div>
      <div className="bg-slate-100 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all duration-700"
          style={{
            width: `${width}%`,
            background: value >= 80 ? "#1e3a5f" : value >= 60 ? "#3b82f6" : "#94a3b8"
          }}
        />
      </div>
    </div>
  );
}

export function ResultScreen({ roster, onSimulate, simResult, onRestart }: Props) {
  useEffect(() => { onSimulate(); }, []);
  const perfect = simResult?.wins === 23;

  return (
    <div className="min-h-screen bg-slate-100 py-12 px-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <p className="text-slate-400 text-sm uppercase tracking-widest mb-2">Season Result</p>
          {!simResult ? (
            <p className="text-slate-400 animate-pulse text-xl">Simulating season...</p>
          ) : (
            <>
              <p className="text-8xl font-black" style={{ color: "#0f172a" }}>
                {simResult.wins}<span className="text-slate-300">-{simResult.losses}</span>
              </p>
              <p className="mt-2 font-bold text-lg" style={{ color: perfect ? "#1e3a5f" : simResult.wins >= 18 ? "#16a34a" : simResult.wins >= 12 ? "#64748b" : "#dc2626" }}>
                {perfect ? "★ Undefeated — Greatest Team Ever" : simResult.wins >= 20 ? "Premiership Contenders" : simResult.wins >= 16 ? "Finals Certainty" : simResult.wins >= 12 ? "Finals Chance" : simResult.wins >= 8 ? "Mid-Table" : "Wooden Spoon"}
              </p>
            </>
          )}
        </div>

        {simResult && (
          <>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center" style={{ background: "#1e3a5f" }}>
                <h3 className="font-bold text-white">Team Breakdown</h3>
                <span className="text-blue-200 text-sm">Rating: {simResult.teamRating}</span>
              </div>
              <div className="p-5 space-y-4">
                <StatBar label="Attacking"  value={simResult.breakdown.attacking} />
                <StatBar label="Midfield"   value={simResult.breakdown.midfield} />
                <StatBar label="Defensive"  value={simResult.breakdown.defensive} />
                <StatBar label="Ruck"       value={simResult.breakdown.ruck} />
                <StatBar label="Balance"    value={simResult.breakdown.balance} />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100" style={{ background: "#1e3a5f" }}>
                <h3 className="font-bold text-white">Final 18 · MVP: <span className="text-yellow-300">{simResult.mvp}</span></h3>
              </div>
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {roster.map((p, i) => {
                  const colours = TEAM_COLOURS[p.club] ?? { primary: "#1e3a5f", secondary: "#FFFFFF" };
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 rounded-lg overflow-hidden border border-slate-100"
                    >
                      <div
                        className="flex items-center justify-center px-2 py-3 shrink-0 w-10"
                        style={{ background: colours.primary }}
                      >
                        <span className="text-xs font-bold" style={{ color: colours.secondary }}>{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0 py-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0"
                            style={{ background: colours.primary, color: colours.secondary }}
                          >
                            {p.position}
                          </span>
                          <span className="text-slate-800 text-sm font-medium truncate">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-slate-400">{p.club}</span>
                          <span className="text-slate-300 text-xs">·</span>
                          <span className="text-xs text-slate-400">{p.decade}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={onRestart}
              className="w-full py-4 text-white font-bold text-lg rounded-xl transition-colors shadow-md"
              style={{ background: "#1e3a5f" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#2d5491")}
              onMouseLeave={e => (e.currentTarget.style.background = "#1e3a5f")}
            >
              Draft Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}