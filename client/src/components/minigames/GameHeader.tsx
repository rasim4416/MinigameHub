import { ChevronLeft, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAudio } from '@/lib/stores/useAudio';
import { useEffect, useState } from 'react';

interface GameHeaderProps {
  title?: string;
  showHomeButton?: boolean;
}

const GameHeader = ({ title = "Minigame Collection", showHomeButton = false }: GameHeaderProps) => {
  const navigate = useNavigate();
  const { isMuted, toggleMute, playSuccess } = useAudio();
  const [audioLoaded, setAudioLoaded] = useState(false);

  useEffect(() => {
    if (!audioLoaded) {
      const bgMusic = new Audio('/sounds/background.mp3');
      bgMusic.loop = true;
      bgMusic.volume = 0.3;

      const hitSound = new Audio('/sounds/hit.mp3');
      hitSound.volume = 0.5;

      const successSound = new Audio('/sounds/success.mp3');
      successSound.volume = 0.5;

      useAudio.setState({
        backgroundMusic: bgMusic,
        hitSound: hitSound,
        successSound: successSound
      });

      setAudioLoaded(true);
    }
  }, [audioLoaded]);

  const goHome = () => {
    playSuccess();
    navigate('/minigames');
  };

  return (
    <header className="w-full bg-gray-950 border-b border-gray-800 px-4 py-3 shrink-0">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showHomeButton && (
            <button
              onClick={goHome}
              aria-label="Return to Menu"
              className="w-8 h-8 flex items-center justify-center rounded border border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500 hover:text-white transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <h1 className="text-lg font-bold text-white tracking-wide">
            {title}
          </h1>
        </div>

        <div className="flex gap-2">
          <button
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
            className="w-8 h-8 flex items-center justify-center rounded border border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500 hover:text-white transition-all"
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

        </div>
      </div>
    </header>
  );
};

export default GameHeader;
