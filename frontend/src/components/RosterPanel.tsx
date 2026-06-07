import { useRef, useState } from "react";
import type { Player, Position } from "../types";
import { TOTAL_ROUNDS, FIELD_POSITIONS, POSITION_LIMITS, TEAM_COLOURS } from "../types";

interface Props {
  roster: Player[];
  round: number;
  positionCounts: Record<Position, number>;
  classicMode: boolean;
  onReorder?: (newRoster: Player[]) => void;
  onMovePlayer?: (playerId: number, toPosition: Position) => void;
}

export function RosterPanel({ roster, round, positionCounts, onMovePlayer }: Props) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const selectedPlayer = roster.find(p => p.id === selectedPlayerId) ?? null;

  // Remember each player's eligible positions ONCE, so a player who moves to their
  // secondary position doesn't "forget" their primary and get stranded.
  const eligibleRef = useRef<Record<number, Position[]>>({});
  roster.forEach(p => {
    if (!eligibleRef.current[p.id]) {
      eligibleRef.current[p.id] = [p.position, p.secondaryPosition].filter(Boolean) as Position[];
    }
  });
  const eligibleFor = (id: number): Position[] => eligibleRef.current[id] ?? [];

  const handleSlotClick = (i: number) => {
    const slot = FIELD_POSITIONS[i];
    const pos = slot.position as Position;
    const samePosBefore = FIELD_POSITIONS.slice(0, i).filter(s => s.position === slot.position).length;
    const playersInPos = roster.filter(p => p.position === pos);
    const player = playersInPos[samePosBefore];

    if (!selectedPlayer) {
      // Select this player if slot is filled
      if (player) setSelectedPlayerId(player.id);
      return;
    }

    // If clicking the already selected player, deselect
    if (player?.id === selectedPlayer.id) {
      setSelectedPlayerId(null);
      return;
    }

    // Try to move selected player to this slot. Validity is checked against the
    // player's STABLE eligible set, not their current (mutating) position.
    const elig = eligibleFor(selectedPlayer.id);
    if (!elig.includes(pos) || pos === selectedPlayer.position) {
      // Invalid target — if clicking another filled slot, select that player instead
      if (player) {
        setSelectedPlayerId(player.id);
      } else {
        setSelectedPlayerId(null);
      }
      return;
    }

    const isFull = (positionCounts[pos] ?? 0) >= POSITION_LIMITS[pos];
    if (!isFull) {
      onMovePlayer?.(selectedPlayer.id, pos);
    }
    // Keep selected so they can keep moving
  };

  const canDropOn = (pos: Position): boolean => {
    if (!selectedPlayer) return false;
    const elig = eligibleFor(selectedPlayer.id);
    return elig.includes(pos) && pos !== selectedPlayer.position;
  };

  return (
    <div className="flex flex-col bg-white border-r border-slate-200">
      <div className="p-4 border-b border-slate-200" style={{ background: "#1e3a5f" }}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-white">Your Side</h2>
          <span className="text-sm text-blue-200">{Math.max(0, round - 1)}/{TOTAL_ROUNDS}</span>
        </div>
      </div>

      <div className="p-3 border-b border-slate-200 bg-slate-50">
        <div className="relative w-full" style={{ height: "380px" }}>
          <svg viewBox="-10 -10 220 320" className="w-full h-full">
            <clipPath id="fieldClip">
              <ellipse cx="100" cy="150" rx="105" ry="145"/>
            </clipPath>

            <ellipse cx="100" cy="150" rx="105" ry="145" fill="#3d8a45"/>

            <g clipPath="url(#fieldClip)">
              <rect x="-10" y="-10" width="30" height="330" fill="#3a8742" opacity="0.5"/>
              <rect x="50"  y="-10" width="30" height="330" fill="#3a8742" opacity="0.5"/>
              <rect x="110" y="-10" width="30" height="330" fill="#3a8742" opacity="0.5"/>
              <rect x="170" y="-10" width="30" height="330" fill="#3a8742" opacity="0.5"/>
            </g>

            <ellipse cx="100" cy="150" rx="105" ry="145" fill="none" stroke="white" strokeWidth="0.8"/>
            <path d="M 10 85 Q 100 145 190 85" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.7"/>
            <path d="M 10 215 Q 100 155 190 215" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.7"/>
            <rect x="65" y="120" width="70" height="60" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.7"/>
            <circle cx="100" cy="150" r="10" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.7"/>
            <circle cx="100" cy="150" r="1.5" fill="white"/>
            <rect x="81" y="5"   width="38" height="12" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.7)" strokeWidth="0.7"/>
            <rect x="81" y="283" width="38" height="12" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.7)" strokeWidth="0.7"/>

            <line x1="74"  y1="5"   x2="74"  y2="-2"  stroke="white" strokeWidth="1"   strokeLinecap="round"/>
            <line x1="81"  y1="5"   x2="81"  y2="-4"  stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="119" y1="5"   x2="119" y2="-4"  stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="126" y1="5"   x2="126" y2="-2"  stroke="white" strokeWidth="1"   strokeLinecap="round"/>
            <line x1="74"  y1="295" x2="74"  y2="302" stroke="white" strokeWidth="1"   strokeLinecap="round"/>
            <line x1="81"  y1="295" x2="81"  y2="304" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="119" y1="295" x2="119" y2="304" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="126" y1="295" x2="126" y2="302" stroke="white" strokeWidth="1"   strokeLinecap="round"/>

            <text x="74"  y="-4"  textAnchor="middle" fontSize="4" fill="white" fontWeight="bold">B</text>
            <text x="81"  y="-6"  textAnchor="middle" fontSize="4" fill="white" fontWeight="bold">G</text>
            <text x="119" y="-6"  textAnchor="middle" fontSize="4" fill="white" fontWeight="bold">G</text>
            <text x="126" y="-4"  textAnchor="middle" fontSize="4" fill="white" fontWeight="bold">B</text>
            <text x="74"  y="308" textAnchor="middle" fontSize="4" fill="white" fontWeight="bold">B</text>
            <text x="81"  y="310" textAnchor="middle" fontSize="4" fill="white" fontWeight="bold">G</text>
            <text x="119" y="310" textAnchor="middle" fontSize="4" fill="white" fontWeight="bold">G</text>
            <text x="126" y="308" textAnchor="middle" fontSize="4" fill="white" fontWeight="bold">B</text>

            {FIELD_POSITIONS.map((slot, i) => {
              const pos = slot.position as Position;
              const count = positionCounts[pos] ?? 0;
              const samePosBefore = FIELD_POSITIONS.slice(0, i).filter(s => s.position === slot.position).length;
              const filled = samePosBefore < count;
              const playersInPos = roster.filter(p => p.position === pos);
              const playerInSlot = playersInPos[samePosBefore];
              const isSelected = !!playerInSlot && selectedPlayer?.id === playerInSlot.id;
              const isValid = canDropOn(pos);
              const isFull = (positionCounts[pos] ?? 0) >= POSITION_LIMITS[pos];
              const cx = (slot.x / 100) * 200;
              const cy = (slot.y / 100) * 300;

              let fill = filled ? "#1e3a5f" : "rgba(255,255,255,0.15)";
              let stroke = filled ? "#1e3a5f" : "rgba(255,255,255,0.4)";
              let strokeWidth = 1;

              if (isSelected) {
                fill = "#f59e0b";
                stroke = "#f59e0b";
              } else if (selectedPlayer && isValid) {
                fill = isFull ? "rgba(255,255,255,0.05)" : "rgba(59,130,246,0.6)";
                stroke = isFull ? "rgba(255,255,255,0.1)" : "#3b82f6";
                strokeWidth = isFull ? 1 : 1.5;
              } else if (selectedPlayer && !isSelected) {
                fill = filled ? "rgba(30,58,95,0.4)" : "rgba(255,255,255,0.05)";
                stroke = filled ? "rgba(30,58,95,0.4)" : "rgba(255,255,255,0.1)";
              }

              return (
                <g
                  key={i}
                  style={{ cursor: filled || isValid ? "pointer" : "default" }}
                  onClick={() => handleSlotClick(i)}
                >
                  <circle cx={cx} cy={cy} r="13" fill="transparent"/>
                  <circle cx={cx} cy={cy} r="11" fill={fill} stroke={stroke} strokeWidth={strokeWidth}/>
                  <text x={cx} y={cy + 4} textAnchor="middle" fontSize="5" fontWeight="bold"
                    fill={filled ? "white" : "rgba(255,255,255,0.6)"}>
                    {slot.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        {selectedPlayer ? (
          <p className="text-xs text-center mt-1">
            <span className="font-semibold text-slate-700">{selectedPlayer.name}</span>
            <span className="text-slate-400"> — tap a green slot to move</span>
          </p>
        ) : (
          <p className="text-xs text-center text-slate-400 mt-1">Tap a player to move them</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {roster.map((p, i) => {
          const colours = TEAM_COLOURS[p.club] ?? { primary: "#1e3a5f", secondary: "#FFFFFF" };
          return (
            <div key={p.id} className="flex items-center gap-2 px-3 py-2">
              <span className="text-slate-300 text-xs w-4 shrink-0">{i + 1}</span>
              <div
                className="flex items-center justify-center px-1.5 py-0.5 rounded shrink-0"
                style={{ background: colours.primary }}
              >
                <span className="text-xs font-bold" style={{ color: colours.secondary }}>{p.position}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-700 text-sm truncate">{p.name}</p>
                <p className="text-slate-400 text-xs">{p.club} · {p.decade}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}