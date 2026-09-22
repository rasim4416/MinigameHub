import { ChevronLeft, Users, Volume2, VolumeX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAudio } from "@/lib/stores/useAudio";
import { usePresence } from "@/hooks/usePresence";
import { useEffect, useState } from "react";

interface GameHeaderProps {
  title?: string;
  showHomeButton?: boolean;
}

const GameHeader = ({
  title = "Minigame Collection",
  showHomeButton = false,
}: GameHeaderProps) => {
  const navigate = useNavigate();
  const { isMuted, toggleMute, playSuccess } = useAudio();
  const onlineCount = usePresence();
  const [audioLoaded, setAudioLoaded] = useState(false);

  useEffect(() => {
    if (!audioLoaded) {
      const bgMusic = new Audio("/sounds/background.mp3");
      bgMusic.loop = true;
      bgMusic.volume = 0.3;

      const hitSound = new Audio("/sounds/hit.mp3");
      hitSound.volume = 0.5;

      const successSound = new Audio("/sounds/success.mp3");
      successSound.volume = 0.5;

      useAudio.setState({
        backgroundMusic: bgMusic,
        hitSound: hitSound,
        successSound: successSound,
      });

      setAudioLoaded(true);
    }
  }, [audioLoaded]);

  const goHome = () => {
    playSuccess();
    navigate("/minigames");
  };

  return (
    <header className="w-full shrink-0 border-b border-gray-800 bg-gray-950 px-4 py-3">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <div className="flex items-center gap-3">
          {showHomeButton && (
            <button
              type="button"
              onClick={goHome}
              aria-label="Return to Menu"
              className="flex h-8 w-8 items-center justify-center rounded border border-gray-700 bg-gray-900 text-gray-300 transition-all hover:border-gray-500 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <h1 className="text-lg font-bold tracking-wide text-white">{title}</h1>
        </div>

        <div className="flex items-center gap-2">
          {onlineCount !== null && (
            <div
              className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-emerald-300"
              title="Open tabs connected right now"
              aria-live="polite"
            >
              <Users className="h-3.5 w-3.5" aria-hidden />
              <span className="text-[11px] font-bold tabular-nums tracking-wide">
                {onlineCount}
              </span>
              <span className="hidden text-[9px] font-extrabold uppercase tracking-[0.14em] text-emerald-400/80 sm:inline">
                online
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
            className="flex h-8 w-8 items-center justify-center rounded border border-gray-700 bg-gray-900 text-gray-300 transition-all hover:border-gray-500 hover:text-white"
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default GameHeader;
