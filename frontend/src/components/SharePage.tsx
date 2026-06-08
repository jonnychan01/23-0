import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const BASE = import.meta.env.VITE_API_URL ?? "/api";
const SITE = "https://skillful-quietude-production-5c71.up.railway.app";

export function SharePage() {
  const { id } = useParams<{ id: string }>();
  const [meta, setMeta] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`${BASE}/share/${id}/meta`)
      .then(r => r.json())
      .then(setMeta)
      .catch(() => setError(true));
  }, [id]);

  useEffect(() => {
    if (!meta || !id) return;
    const imageUrl = `${SITE}/api/share/${id}/image`;
    const setOG = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    setOG("og:image", imageUrl);
    setOG("og:title", `${meta.simResult.wins}-${meta.simResult.losses} · AFL Dream Draft`);
    setOG("og:description", `MVP: ${meta.simResult.mvp} · Rating: ${meta.simResult.teamRating}`);
    setOG("og:url", `${SITE}/share/${id}`);
  }, [meta, id]);

  if (error) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-slate-400">Share not found.</p>
    </div>
  );

  if (!meta) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-slate-400 animate-pulse">Loading...</p>
    </div>
  );

  const { simResult } = meta;
  const imageUrl = `${SITE}/api/share/${id}/image`;

  return (
    <div className="min-h-screen bg-slate-100 py-12 px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <p className="text-slate-400 text-sm uppercase tracking-widest mb-2">AFL Dream Draft</p>
          <p className="text-8xl font-black" style={{ color: "#0f172a" }}>
            {simResult.wins}<span className="text-slate-300">-{simResult.losses}</span>
          </p>
          <p className="mt-2 font-bold text-lg text-slate-500">MVP: {simResult.mvp}</p>
        </div>

        <img src={imageUrl} alt="Team card" className="w-full rounded-xl shadow-sm" />

        
        <a href="/"
          className="block w-full py-4 text-white font-bold text-lg rounded-xl text-center"
          style={{ background: "#1e3a5f" }}
        >
          Draft Your Own Team →
        </a>
      </div>
    </div>
  );
}