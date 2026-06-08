import { useState } from "react";
import type { Player, SpinResult, Position } from "../types";
import { TEAM_COLOURS } from "../types";

interface Props {
  round: number;
  spin: SpinResult;
  candidates: Player[];
  onPick: (player: Player) => void;
  onRespin: () => void;
  respinsRemaining: number;
  classicMode: boolean;
  isPositionFull: (pos: Position) => boolean;
  rosterIds: number[];
}

function MobilePlayerRow({ player, onPick, isPositionFull, classicMode }: {
  player: Player;
  onPick: (player: Player) => void;
  isPositionFull: boolean;
  classicMode: boolean;
}) {
  const colours = TEAM_COLOURS[player.club] ?? { primary: "#1e3a5f", secondary: "#FFFFFF" };

  return (
    <button
      onClick={() => !isPositionFull && onPick(player)}
      disabled={isPositionFull}
      className="w-full flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-100 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
    >
      <div
        className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: colours.primary }}
      >
        <span className="text-xs font-bold" style={{ color: colours.secondary }}>{player.position}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-800 text-sm leading-tight">{player.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">{player.position}{player.secondaryPosition ? ` · ${player.secondaryPosition}` : ""}</p>
        <p className="text-xs text-slate-400">{player.club} · {player.decade}</p>
      </div>
      {!classicMode && (
        <div className="flex gap-2 shrink-0">
          {[
            { label: "GL", value: player.goals },
            { label: "DI", value: player.disposals },
            { label: "MK", value: player.marks },
            { label: "TK", value: player.tackles },
            { label: "HO", value: player.hitouts },
          ].map(({ label, value }) => (
            <div key={label} className="text-center w-8">
              <p className="text-xs font-bold text-slate-800">{value.toFixed(1)}</p>
              <p className="text-xs text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      )}
      {isPositionFull && (
        <span className="text-xs text-red-400 font-medium shrink-0">Full</span>
      )}
    </button>
  );
}

function DesktopPlayerCard({ player, onPick, isPositionFull, classicMode }: {
  player: Player;
  onPick: (player: Player) => void;
  isPositionFull: boolean;
  classicMode: boolean;
}) {
  const colours = TEAM_COLOURS[player.club] ?? { primary: "#1e3a5f", secondary: "#FFFFFF" };

  return (
    <button
      onClick={() => !isPositionFull && onPick(player)}
      disabled={isPositionFull}
      className="text-left w-full bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden"
    >
      <div className="px-4 py-3 flex items-start justify-between gap-2 rounded-t-lg" style={{ background: colours.primary, minHeight: "72px" }}>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white text-base leading-tight">{player.name}</h3>
          <p className="text-xs mt-0.5" style={{ color: colours.secondary, opacity: 0.8 }}>{player.club}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0 mt-0.5">
          <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: colours.secondary, color: colours.primary }}>
            {player.position}
          </span>
          {player.secondaryPosition && (
            <span className="text-xs px-2 py-0.5 rounded opacity-70" style={{ background: colours.secondary, color: colours.primary }}>
              {player.secondaryPosition}
            </span>
          )}
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-400 text-xs">{player.decade}</span>
          <span className="text-slate-400 text-xs">{player.games} games</span>
          {isPositionFull && <span className="text-red-500 text-xs font-medium">Position Full</span>}
        </div>
        {!classicMode && (
          <div className="space-y-1.5">
            {[
              { label: "Goals",      value: player.goals,      max: 8  },
              { label: "Disposals",  value: player.disposals,  max: 35 },
              { label: "Marks",      value: player.marks,      max: 12 },
              { label: "Tackles",    value: player.tackles,    max: 10 },
              { label: "Hitouts",    value: player.hitouts,    max: 40 },
              { label: "Clearances", value: player.clearances, max: 10 },
              { label: "Inside 50s", value: player.inside50s,  max: 10 },
            ].map(({ label, value, max }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-slate-400 text-xs w-16 shrink-0">{label}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: "#1e3a5f" }} />
                </div>
                <span className="text-slate-600 text-xs w-8 text-right">{value.toFixed(1)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

export function PickingScreen({ round, spin, candidates, onPick, onRespin, respinsRemaining, classicMode, isPositionFull }: Props) {
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<Position | "All">("All");

  const availablePositions = ["All", ...Array.from(new Set(candidates.flatMap(p => [p.position, p.secondaryPosition].filter((x): x is string => !!x))))].sort((a, b) => a === "All" ? -1 : b === "All" ? 1 : a.localeCompare(b));

  const filtered = candidates.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesPos = posFilter === "All" || p.position === posFilter || p.secondaryPosition === posFilter;
    return matchesSearch && matchesPos;
  });

  return (
    <div className="flex flex-col h-full bg-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-widest">Round {round} of 18</p>
            <div className="flex items-baseline gap-3 mt-0.5 flex-wrap">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-800">{spin.club}</h2>
              <span className="text-sm font-semibold px-3 py-1 rounded-full text-white" style={{ background: "#1e3a5f" }}>{spin.decade}</span>
            </div>
          </div>
          <button
            onClick={onRespin}
            disabled={respinsRemaining <= 0}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {respinsRemaining > 0 ? `Respin (${respinsRemaining})` : "No respins"}
          </button>
        </div>

        {/* Search */}
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            placeholder="Search players..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-slate-400"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
            >
              Clear
            </button>
          )}
        </div>

        {/* Position filter pills */}
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {availablePositions.map(pos => (
            <button
              key={pos}
              onClick={() => setPosFilter(pos as Position | "All")}
              className="shrink-0 px-3 py-1 text-xs font-semibold rounded-full border transition-colors"
              style={{
                background: posFilter === pos ? "#1e3a5f" : "white",
                color: posFilter === pos ? "white" : "#64748b",
                borderColor: posFilter === pos ? "#1e3a5f" : "#e2e8f0",
              }}
            >
              {pos}
            </button>
          ))}
        </div>

        <p className="text-slate-400 text-xs mt-2">{filtered.length} of {candidates.length} players</p>
      </div>

      {/* Mobile list */}
      <div className="flex-1 overflow-y-auto lg:hidden">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">No players found</div>
        ) : (
          filtered.map(player => (
            <MobilePlayerRow
              key={player.id}
              player={player}
              onPick={onPick}
              isPositionFull={
                isPositionFull(player.position as Position) &&
                (!player.secondaryPosition || isPositionFull(player.secondaryPosition as Position))
              }
              classicMode={classicMode}
            />
          ))
        )}
      </div>

      {/* Desktop grid */}
      <div className="hidden lg:block flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">No players found</div>
        ) : (
          <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(player => (
              <DesktopPlayerCard
                key={player.id}
                player={player}
                onPick={onPick}
                isPositionFull={
                  isPositionFull(player.position as Position) &&
                  (!player.secondaryPosition || isPositionFull(player.secondaryPosition as Position))
                }
                classicMode={classicMode}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}