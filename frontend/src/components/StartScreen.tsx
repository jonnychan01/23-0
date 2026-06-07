import { useState } from "react";

interface Props {
  onStart: (classicMode: boolean) => void;
}

export function StartScreen({ onStart }: Props) {
  const [classicMode, setClassicMode] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-6 text-center">
        <div>
          <h1 className="text-8xl font-black text-navy-900 tracking-tight" style={{ color: "#0f172a" }}>23-0</h1>
          <p className="mt-2 text-slate-500 text-lg">Build the greatest AFL team of all time</p>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[["18", "Picks"], ["1", "Club Skip"], ["1", "Decade Skip"], ["23-0", "The Goal"]].map(([n, l]) => (
            <div key={l} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
              <div className="text-2xl font-bold" style={{ color: "#1e3a5f" }}>{n}</div>
              <div className="text-xs text-slate-400 mt-1">{l}</div>
            </div>
          ))}
        </div>

        <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
          <button
            onClick={() => setClassicMode(false)}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${!classicMode ? "text-white" : "text-slate-400 hover:text-slate-600"}`}
            style={{ background: !classicMode ? "#1e3a5f" : "transparent" }}
          >
            Classic (Stats)
          </button>
          <button
            onClick={() => setClassicMode(true)}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${classicMode ? "text-white" : "text-slate-400 hover:text-slate-600"}`}
            style={{ background: classicMode ? "#1e3a5f" : "transparent" }}
          >
            Draft IQ (No Stats)
          </button>
        </div>

        <button
          onClick={() => onStart(classicMode)}
          className="w-full py-4 text-white font-bold text-xl rounded-xl transition-colors shadow-md"
          style={{ background: "#1e3a5f" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#2d5491")}
          onMouseLeave={e => (e.currentTarget.style.background = "#1e3a5f")}
        >
          Draft Your Side
        </button>

        <p className="text-slate-400 text-sm">
          Each round: spin lands on a Club + Decade. Pick from the pool. Go undefeated.
        </p>
      </div>
    </div>
  );
}