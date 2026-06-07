import type { Player } from "../types";
import { TEAM_COLOURS } from "../types";

interface Props {
  player: Player;
  onPick: (player: Player) => void;
  showStats: boolean;
  isPositionFull: boolean;
}

function StatRow({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400 text-xs w-16 shrink-0">{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full"
          style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: "#1e3a5f" }}
        />
      </div>
      <span className="text-slate-600 text-xs w-8 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

export function PlayerCard({ player, onPick, showStats, isPositionFull }: Props) {
  const colours = TEAM_COLOURS[player.club] ?? { primary: "#1e3a5f", secondary: "#FFFFFF" };

  return (
    <button
      onClick={() => !isPositionFull && onPick(player)}
      disabled={isPositionFull}
      className="text-left w-full bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden"
    >
      <div
        className="px-4 py-3 flex items-start justify-between gap-2 rounded-t-lg"
        style={{ background: colours.primary, minHeight: "72px" }}
      >
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white text-base leading-tight">{player.name}</h3>
          <p className="text-xs mt-0.5" style={{ color: colours.secondary, opacity: 0.8 }}>{player.club}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0 mt-0.5">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded"
            style={{ background: colours.secondary, color: colours.primary }}
          >
            {player.position}
          </span>
          {player.secondaryPosition && (
            <span
              className="text-xs px-2 py-0.5 rounded opacity-70"
              style={{ background: colours.secondary, color: colours.primary }}
            >
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

        {showStats && (
          <div className="space-y-1.5">
            <StatRow label="Goals"      value={player.goals}      max={8}  />
            <StatRow label="Disposals"  value={player.disposals}  max={35} />
            <StatRow label="Marks"      value={player.marks}      max={12} />
            <StatRow label="Tackles"    value={player.tackles}    max={10} />
            <StatRow label="Hitouts"    value={player.hitouts}    max={40} />
            <StatRow label="Clearances" value={player.clearances} max={10} />
            <StatRow label="Inside 50s" value={player.inside50s}  max={10} />
          </div>
        )}
      </div>
    </button>
  );
}