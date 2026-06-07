import { useEffect, useRef, useState } from "react";
import type { SpinResult, Player } from "../types";
import { fetchCandidates, spinReel } from "../lib/api";

const CLUBS = ["Adelaide","Brisbane Lions","Carlton","Collingwood","Essendon","Fitzroy","Fremantle","Geelong","Gold Coast","GWS Giants","Hawthorn","Melbourne","North Melbourne","Port Adelaide","Richmond","St Kilda","Sydney","West Coast","Western Bulldogs"];
const DECADES = ["1890s","1900s","1910s","1920s","1930s","1940s","1950s","1960s","1970s","1980s","1990s","2000s","2010s","2020s"];

interface Props {
  round: number;
  existingRosterIds: number[];
  onComplete: (spin: SpinResult, candidates: Player[]) => void;
  lockedDecade?: string;
  lockedClub?: string;
  preloadedSpin?: SpinResult;
  preloadedCandidates?: Player[];
}

export function SpinningScreen({ round, existingRosterIds, onComplete, lockedDecade, lockedClub, preloadedSpin, preloadedCandidates }: Props) {
  const [clubDisplay, setClubDisplay] = useState(CLUBS[0]);
  const [decadeDisplay, setDecadeDisplay] = useState(DECADES[0]);
  const [done, setDone] = useState(false);
  const resultRef = useRef<{ spin: SpinResult; candidates: Player[] } | null>(null);
  const completedRef = useRef(false);

  const shownClub = (lockedClub && !done) ? lockedClub : clubDisplay;
  const shownDecade = (lockedDecade && !done) ? lockedDecade : decadeDisplay;

  // Fetch
  useEffect(() => {
    if (preloadedSpin && preloadedCandidates) {
      resultRef.current = { spin: preloadedSpin, candidates: preloadedCandidates };
      return;
    }
    spinReel().then(async (s) => {
      const c = await fetchCandidates(s.club, s.decade, existingRosterIds);
      resultRef.current = { spin: s, candidates: c };
    });
  }, []);

  // Animation
  useEffect(() => {
    let clubIdx = 0;
    let decadeIdx = 0;

    const fast = setInterval(() => {
      if (!lockedClub) { clubIdx = (clubIdx + 1) % CLUBS.length; setClubDisplay(CLUBS[clubIdx]); }
      if (!lockedDecade) { decadeIdx = (decadeIdx + 1) % DECADES.length; setDecadeDisplay(DECADES[decadeIdx]); }
    }, 60);

    const slowTimer = setTimeout(() => {
      clearInterval(fast);
      const slow = setInterval(() => {
        if (!lockedClub) { clubIdx = (clubIdx + 1) % CLUBS.length; setClubDisplay(CLUBS[clubIdx]); }
        if (!lockedDecade) { decadeIdx = (decadeIdx + 1) % DECADES.length; setDecadeDisplay(DECADES[decadeIdx]); }
      }, 180);
      setTimeout(() => {
        clearInterval(slow);
        const result = resultRef.current;
        if (result) {
          if (!lockedClub) setClubDisplay(result.spin.club);
          if (!lockedDecade) setDecadeDisplay(result.spin.decade);
        }
        setDone(true);
      }, 400);
    }, 1500);

    return () => { clearInterval(fast); clearTimeout(slowTimer); };
  }, []);

  // Transition
  useEffect(() => {
    if (!done) return;
    const interval = setInterval(() => {
      const result = resultRef.current;
      if (result && !completedRef.current) {
        completedRef.current = true;
        clearInterval(interval);
        setTimeout(() => onComplete(result.spin, result.candidates), 400 );
      }
    }, 100);
    return () => clearInterval(interval);
  }, [done]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">Round</p>
        <p className="text-6xl sm:text-7xl font-black" style={{ color: "#0f172a" }}>
          {round}<span className="text-2xl sm:text-3xl text-slate-400 ml-2">/ 18</span>
        </p>
      </div>

      <div className="flex gap-3 sm:gap-6 items-center w-full max-w-lg">
        <div className={`flex-1 border rounded-xl px-4 sm:px-8 py-5 text-center shadow-sm ${lockedClub ? "bg-slate-50 border-slate-200 opacity-60" : "bg-white border-slate-200"}`}>
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Club</p>
          <p className="text-xl sm:text-3xl font-bold leading-tight" style={{ color: lockedClub ? "#94a3b8" : "#1e3a5f" }}>{shownClub}</p>
          {lockedClub && <p className="text-xs text-slate-400 mt-1">locked</p>}
        </div>
        <div className="text-slate-300 text-xl font-bold shrink-0">×</div>
        <div className={`flex-1 border rounded-xl px-4 sm:px-8 py-5 text-center shadow-sm ${lockedDecade ? "bg-slate-50 border-slate-200 opacity-60" : "bg-white border-slate-200"}`}>
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Decade</p>
          <p className="text-xl sm:text-3xl font-bold" style={{ color: lockedDecade ? "#94a3b8" : "#0f172a" }}>{shownDecade}</p>
          {lockedDecade && <p className="text-xs text-slate-400 mt-1">locked</p>}
        </div>
      </div>

      <p className="text-slate-400 text-sm">{done ? `${clubDisplay} · ${decadeDisplay}` : "Spinning..."}</p>
    </div>
  );
}