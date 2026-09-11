import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAudio } from "@/lib/stores/useAudio";

/**
 * Full-viewport host for the Godot Web export at /rootbound/index.html.
 * Game assets stay under client/public/rootbound/ and load via relative paths.
 */
const RootboundPage = () => {
  const navigate = useNavigate();
  const { backgroundMusic, playSuccess } = useAudio();

  useEffect(() => {
    if (backgroundMusic) backgroundMusic.pause();
    return () => {
      if (backgroundMusic) backgroundMusic.pause();
    };
  }, [backgroundMusic]);

  const goHome = () => {
    playSuccess();
    navigate("/minigames");
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <button
        type="button"
        onClick={goHome}
        aria-label="Return to Menu"
        className="absolute left-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded border border-white/20 bg-black/60 text-white/90 backdrop-blur-sm transition-colors hover:border-white/50 hover:bg-black/80 hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <iframe
        title="Rootbound"
        src="/rootbound/index.html"
        className="h-full w-full flex-1 border-0"
        allow="autoplay; fullscreen; gamepad; keyboard-map; cross-origin-isolated"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
};

export default RootboundPage;
