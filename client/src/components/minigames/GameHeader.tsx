import { ChevronLeft, Gamepad2, Users, Volume2, VolumeX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAudio } from "@/lib/stores/useAudio";
import { useChips } from "@/lib/stores/useChips";
import { usePresence } from "@/hooks/usePresence";
import { useEffect, useState } from "react";

interface GameHeaderProps {
  title?: string;
  icon?: string;
  showHomeButton?: boolean;
}

const iconButton =
  "flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition-all hover:-translate-y-px hover:border-amber-300/40 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300";

const GameHeader = ({
  title,
  icon,
  showHomeButton = false,
}: GameHeaderProps) => {
  const navigate = useNavigate();
  const { isMuted, toggleMute, playSuccess } = useAudio();
  const chips = useChips((s) => s.chips);
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
    <header className="sticky top-0 z-40 w-full shrink-0 border-b border-white/[0.06] bg-[#04060d]/75 px-3 py-2.5 backdrop-blur-xl sm:px-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {showHomeButton && (
            <button
              type="button"
              onClick={goHome}
              aria-label="Return to menu"
              className={iconButton}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={showHomeButton ? goHome : undefined}
            className="flex min-w-0 items-center gap-2.5 text-left"
            tabIndex={showHomeButton ? 0 : -1}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 via-amber-400 to-orange-600 text-[#1a1204] shadow-[0_6px_18px_rgba(245,158,11,0.35),inset_0_1px_0_rgba(255,255,255,0.6)]">
              <Gamepad2 className="h-[18px] w-[18px]" strokeWidth={2.4} />
            </span>
            <span className="flex min-w-0 flex-col leading-none">
              <span className="text-[9px] font-extrabold uppercase tracking-[0.28em] text-amber-300/80">
                Minigame Hub
              </span>
              <span className="mt-1 truncate text-[15px] font-black tracking-tight text-white">
                {title ? (
                  <>
                    {icon && <span className="mr-1.5">{icon}</span>}
                    {title}
                  </>
                ) : (
                  "Play something"
                )}
              </span>
            </span>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-gradient-to-b from-amber-500/15 to-amber-900/10 py-1 pl-1 pr-3"
            title="Your chips — shared across games"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fde68a,#d4a017_58%,#713f12)] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.3),0_2px_6px_rgba(0,0,0,0.5)]">
              <span className="h-3 w-3 rounded-full border border-dashed border-white/60" />
            </span>
            <span className="text-[13px] font-black tabular-nums text-amber-200">
              {chips.toLocaleString()}
            </span>
          </div>
          {onlineCount !== null && (
            <div
              className="hidden items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1.5 text-emerald-300 sm:flex"
              title="Open tabs connected right now"
              aria-live="polite"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <Users className="h-3.5 w-3.5" aria-hidden />
              <span className="text-[11px] font-bold tabular-nums">{onlineCount}</span>
              <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-emerald-400/80">
                online
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
            className={iconButton}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default GameHeader;
