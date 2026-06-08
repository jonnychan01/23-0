import { useCallback, useState } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { useGameState } from "./hooks/useGameState";
import { StartScreen }    from "./components/StartScreen";
import { SpinningScreen } from "./components/SpinningScreen";
import { PickingScreen }  from "./components/PickingScreen";
import { ResultScreen }   from "./components/ResultScreen";
import { RosterPanel }    from "./components/RosterPanel";
import { SharePage }      from "./components/SharePage";
import type { Player, SpinResult } from "./types";

function MainApp() {
  const {
    state,
    startGame,
    onSpinComplete,
    pickPlayer,
    respin,
    runSimulation,
    restart,
    isPositionFull,
    movePlayer,
    reorderRoster,
  } = useGameState();

  const [mobileTab, setMobileTab] = useState<"pick" | "side">("pick");
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  const { screen, round, roster, currentSpin, candidates, positionCounts, simResult, classicMode } = state;

  const handleSpinComplete = useCallback(
    (spin: SpinResult, cands: Player[]) => {
      onSpinComplete(spin, cands);
      setMobileTab("pick");
    },
    [onSpinComplete]
  );

  const handlePick = useCallback((player: Player) => {
    pickPlayer(player);
    setMobileTab("pick");
  }, [pickPlayer]);

  if (screen === "start") return <StartScreen onStart={startGame} />;
  if (screen === "result") return (
    <ResultScreen key="result" roster={roster} onSimulate={runSimulation} simResult={simResult} onRestart={restart} />
  );

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">
      <nav className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white shadow-sm z-10">
        <button onClick={() => setShowRestartConfirm(true)} className="font-black text-xl tracking-tight" style={{ color: "#1e3a5f" }}>
          23-0
        </button>
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-sm hidden sm:block">Round {round} of 18 · {roster.length} players</span>
          <button onClick={() => setShowRestartConfirm(true)} className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
            ← Home
          </button>
        </div>
      </nav>

      {showRestartConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowRestartConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-black text-xl mb-2" style={{ color: "#0f172a" }}>Go back to home?</h3>
            <p className="text-slate-400 text-sm mb-6">Your current draft will be lost.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowRestartConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50">Cancel</button>
              <button onClick={() => { restart(); setShowRestartConfirm(false); }} className="flex-1 py-2.5 rounded-xl text-white font-semibold" style={{ background: "#1e3a5f" }}>Go Home</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="hidden lg:flex flex-col shrink-0 border-r border-slate-200 h-full" style={{ width: "512px", minWidth: "512px" }}>
          <RosterPanel roster={roster} round={round} positionCounts={positionCounts} classicMode={classicMode} onReorder={reorderRoster} onMovePlayer={movePlayer} />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {screen === "spinning" && (
              <SpinningScreen
                round={round}
                existingRosterIds={roster.map(p => p.id)}
                onComplete={handleSpinComplete}
                lockedDecade={state.lockedDecade}
                lockedClub={state.lockedClub}
                preloadedSpin={state.preloadedSpin}
                preloadedCandidates={state.preloadedCandidates}
              />
            )}

            {screen === "picking" && currentSpin && mobileTab === "pick" && (
              <PickingScreen
                round={round}
                spin={currentSpin}
                candidates={candidates}
                onPick={handlePick}
                onRespin={respin}
                respinsRemaining={state.respinsRemaining}
                classicMode={classicMode}
                isPositionFull={isPositionFull}
                rosterIds={roster.map(p => p.id)}
              />
            )}

            {mobileTab === "side" && (
              <div className="lg:hidden">
                <RosterPanel roster={roster} round={round} positionCounts={positionCounts} classicMode={classicMode} onReorder={reorderRoster} onMovePlayer={movePlayer} />
              </div>
            )}

            {screen === "picking" && currentSpin && (
              <div className="hidden lg:block h-full">
                <PickingScreen
                  round={round}
                  spin={currentSpin}
                  candidates={candidates}
                  onPick={handlePick}
                  onRespin={respin}
                  respinsRemaining={state.respinsRemaining}
                  classicMode={classicMode}
                  isPositionFull={isPositionFull}
                  rosterIds={roster.map(p => p.id)}
                />
              </div>
            )}
          </div>

          <div className="shrink-0 flex lg:hidden border-t border-slate-200 bg-white">
            <button onClick={() => setMobileTab("pick")} className="flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors" style={{ color: mobileTab === "pick" ? "#1e3a5f" : "#94a3b8" }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="text-xs font-semibold">Draft</span>
            </button>
            <button onClick={() => setMobileTab("side")} className="flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors" style={{ color: mobileTab === "side" ? "#1e3a5f" : "#94a3b8" }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs font-semibold">Your Side ({roster.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/share/:id" element={<SharePage />} />
        <Route path="/*" element={<MainApp />} />
      </Routes>
    </HashRouter>
  );
}