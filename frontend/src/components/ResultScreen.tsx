import { useEffect, useRef, useState } from "react";
import type { Player, SimResult } from "../types";
import { TEAM_COLOURS } from "../types";
import html2canvas from "html2canvas";

interface Props {
  roster: Player[];
  onSimulate: () => Promise<void>;
  simResult: SimResult | null;
  onRestart: () => void;
}

const BASE = import.meta.env.VITE_API_URL ?? "/api";
const SITE = "https://23-0-production.up.railway.app";

export function ResultScreen({ roster, onSimulate, simResult, onRestart }: Props) {
  useEffect(() => { onSimulate(); }, []);
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const perfect = simResult?.wins === 23;

  const getTagline = () => {
    if (!simResult) return "";
    if (perfect) return "★ Undefeated — Greatest Team Ever";
    if (simResult.wins >= 20) return "Premiership Contenders";
    if (simResult.wins >= 16) return "Finals Certainty";
    if (simResult.wins >= 12) return "Finals Chance";
    if (simResult.wins >= 8) return "Mid-Table";
    return "Wooden Spoon";
  };

  const generateShareUrl = async (): Promise<string> => {
    const res = await fetch(`${BASE}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roster }),
    });
    const { id } = await res.json();
    return `${SITE}/share/${id}`;
  };

  const shareToTwitter = async () => {
    if (!simResult) return;
    setSharing(true);
    try {
      const shareUrl = await generateShareUrl();
      const text = [
        `I drafted my All-Time AFL Dream Team and went ${simResult.wins}-${simResult.losses}!`,
        `${getTagline()} · Team Rating: ${simResult.teamRating}`,
        `MVP: ${simResult.mvp}`,
        ``,
        shareUrl,
      ].join("\n");
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Share failed:", err);
    } finally {
      setSharing(false);
    }
  };

  const shareToBluesky = async () => {
    if (!simResult) return;
    setSharing(true);
    try {
      const shareUrl = await generateShareUrl();
      const text = [
        `I drafted my All-Time AFL Dream Team and went ${simResult.wins}-${simResult.losses}!`,
        `${getTagline()} · Rating: ${simResult.teamRating} · MVP: ${simResult.mvp}`,
        ``,
        shareUrl,
      ].join("\n");
      const url = `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Share failed:", err);
    } finally {
      setSharing(false);
    }
  };

  const copyShareText = async () => {
    if (!simResult) return;
    const text = [
      `My All-Time AFL Dream Team: ${simResult.wins}-${simResult.losses}`,
      `${getTagline()} · Rating: ${simResult.teamRating} · MVP: ${simResult.mvp}`,
      ``,
      roster.map((p, i) => `${i + 1}. ${p.position} ${p.name} (${p.club}, ${p.decade})`).join("\n"),
    ].join("\n");
    await navigator.clipboard.writeText(text);
  };

  const downloadTeamPNG = async () => {
    if (!cardRef.current || !simResult) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `afl-dream-team-${simResult.wins}w.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("PNG export failed:", err);
    } finally {
      setDownloading(false);
    }
  };

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
                {getTagline()}
              </p>
            </>
          )}
        </div>

        {simResult && (
          <>
            <div ref={cardRef} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center" style={{ background: "#1e3a5f" }}>
                <div>
                  <h3 className="font-bold text-white">Final 18 · MVP: <span className="text-yellow-300">{simResult.mvp}</span></h3>
                  <p className="text-blue-200 text-xs mt-0.5">{simResult.wins}-{simResult.losses} · {getTagline()}</p>
                </div>
                <span className="text-blue-300 text-xs font-mono">⭐ AFL Dream Draft</span>
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

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={shareToTwitter}
                disabled={sharing}
                className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-colors disabled:opacity-50"
                style={{ background: "#000000" }}
                onMouseEnter={e => { if (!sharing) e.currentTarget.style.background = "#1a1a1a"; }}
                onMouseLeave={e => (e.currentTarget.style.background = "#000000")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.741-8.861L2.25 2.25h6.988l4.255 5.618L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
                </svg>
                {sharing ? "Generating…" : "Share on X"}
              </button>

              <button
                onClick={shareToBluesky}
                disabled={sharing}
                className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-colors disabled:opacity-50"
                style={{ background: "#0085ff" }}
                onMouseEnter={e => { if (!sharing) e.currentTarget.style.background = "#006acc"; }}
                onMouseLeave={e => (e.currentTarget.style.background = "#0085ff")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.077 1.9.9 3.569c-.117 1.084-.222 4.45.08 6.7.552 4.05 4.124 5.484 7.102 4.862 2.972-.62 5.064-2.97 5.918-5.33Zm0 0c1.087-2.114 4.046-6.053 6.798-7.995 2.636-1.861 4.125-.905 4.302.764.117 1.084.222 4.45-.08 6.7-.552 4.05-4.124 5.484-7.102 4.862C13.746 14.48 11.654 12.13 12 10.8Z"/>
                </svg>
                {sharing ? "Generating…" : "Share on Bluesky"}
              </button>

              <button
                onClick={copyShareText}
                className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors border border-slate-200"
                style={{ background: "#f8fafc", color: "#334155" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#e2e8f0")}
                onMouseLeave={e => (e.currentTarget.style.background = "#f8fafc")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy Lineup
              </button>

              <button
                onClick={downloadTeamPNG}
                disabled={downloading}
                className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors border border-slate-200 disabled:opacity-50"
                style={{ background: "#f8fafc", color: "#334155" }}
                onMouseEnter={e => { if (!downloading) e.currentTarget.style.background = "#e2e8f0"; }}
                onMouseLeave={e => (e.currentTarget.style.background = "#f8fafc")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                {downloading ? "Exporting…" : "Save as PNG"}
              </button>
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