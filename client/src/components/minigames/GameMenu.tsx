import { useNavigate } from "react-router-dom";
import GameHeader from "./GameHeader";
import GameGrid from "./GameGrid";
import { useAudio } from "@/lib/stores/useAudio";
import { useChips, CHIP_DENOMINATIONS } from "@/lib/stores/useChips";
import { useEffect } from "react";
import { Gamepad2 } from "lucide-react";

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
            <div className="flex items-center gap-3 bg-gray-900 border border-yellow-700/40 rounded-2xl px-5 py-2.5 shadow-lg">
              <div className="flex -space-x-1">
                {[10000, 1000, 100].map(v => {
                  const chip = CHIP_DENOMINATIONS.find(c => c.value === v)!;
                  return (
                    <div key={v} className={`w-6 h-6 rounded-full ${chip.color} border ${chip.border} flex items-center justify-center text-[9px] font-bold ${chip.text} shadow`}>
                      {chip.label}
                    </div>
                  );
                })}
              </div>
              <span className="text-yellow-400 font-bold text-xl tracking-wide">{chips.toLocaleString()}</span>
              <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">chips</span>
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
