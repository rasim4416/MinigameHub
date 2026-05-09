import { useNavigate } from "react-router-dom";
import GameHeader from "./GameHeader";
import GameGrid from "./GameGrid";
import { useAudio } from "@/lib/stores/useAudio";
import { useChips } from "@/lib/stores/useChips";
import { useEffect } from "react";
import { Gamepad2 } from "lucide-react";

const MENU_CHIPS = [
  { value: 10000, bg: "#eab308", light: "#fde047", dark: "#a16207", text: "#422006" },
  { value: 1000,  bg: "#06b6d4", light: "#67e8f9", dark: "#0e7490", text: "#083344" },
  { value: 100,   bg: "#1e293b", light: "#475569", dark: "#0f172a", text: "#e2e8f0" },
];

const GameMenu = () => {
  const navigate = useNavigate();
  const { backgroundMusic, isMuted } = useAudio();
  const { chips } = useChips();

  useEffect(() => {
    if (backgroundMusic && !isMuted) {
      backgroundMusic.play().catch(() => {});
    }
    return () => {
      if (backgroundMusic) backgroundMusic.pause();
    };
  }, [backgroundMusic, isMuted]);

  useEffect(() => {
    if (backgroundMusic) {
      if (isMuted) backgroundMusic.pause();
      else backgroundMusic.play().catch(() => {});
    }
  }, [isMuted, backgroundMusic]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-white">
      <GameHeader />

      <main className="flex-1 flex flex-col items-center py-10 px-4 gap-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Gamepad2 className="h-6 w-6 text-indigo-400" />
            <h2 className="text-2xl font-bold text-white tracking-wide">
              Mal Akın hahahah mal akın akın mal
            </h2>
            <Gamepad2 className="h-6 w-6 text-indigo-400" />
          </div>
          <p className="text-sm text-gray-500">
            Hemen tıkla oynamaya başla!
          </p>

          {/* Chip counter */}
          <div className="flex items-center justify-center mt-4">
            <div style={{
              display: "flex", alignItems: "center", gap: 14,
              background: "linear-gradient(135deg,#0f172a,#111827)",
              border: "1px solid rgba(234,179,8,0.25)",
              borderRadius: 20, padding: "10px 22px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}>
              {/* Stacked chips */}
              <div style={{ display: "flex", alignItems: "center" }}>
                {MENU_CHIPS.map((c, i) => (
                  <div key={c.value} style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: `radial-gradient(ellipse at 35% 30%, ${c.light}, ${c.bg} 55%, ${c.dark})`,
                    boxShadow: `0 3px 8px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(255,255,255,0.25), inset 0 0 0 5px ${c.bg}, inset 0 0 0 6px rgba(0,0,0,0.15)`,
                    marginLeft: i === 0 ? 0 : -10,
                    zIndex: 3 - i,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 8, fontWeight: 900, color: c.text, userSelect: "none" }}>
                      {c.value >= 10000 ? "10K" : c.value >= 1000 ? "1K" : "100"}
                    </span>
                  </div>
                ))}
              </div>
              <span style={{ fontSize: 22, fontWeight: 900, color: "#facc15", letterSpacing: "-0.02em", lineHeight: 1 }}>
                {chips.toLocaleString()}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                chips
              </span>
            </div>
          </div>
        </div>

        <div className="w-full">
          <GameGrid />
        </div>

        <button
          onClick={() => navigate('/')}
          className="mt-4 px-5 py-2 text-sm font-semibold rounded-lg border border-gray-700 bg-gray-900 text-gray-300 hover:border-indigo-500 hover:text-white transition-all"
        >
          More games coming soon!
        </button>
      </main>

      <footer className="py-4 text-center border-t border-gray-800">
        <p className="text-xs text-gray-600">© {new Date().getFullYear()} Minigame Collection</p>
        <div className="text-[11px] text-gray-700 flex justify-center gap-2 mt-1">
          <span>Fun Games</span>
          <span>•</span>
          <span>Play Anytime</span>
          <span>•</span>
          <span>Quick Challenges</span>
        </div>
      </footer>
    </div>
  );
};

export default GameMenu;
