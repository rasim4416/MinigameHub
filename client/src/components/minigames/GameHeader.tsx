import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';
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
  
  // Setup audio elements
  useEffect(() => {
    if (!audioLoaded) {
      // Create and configure audio elements
      const bgMusic = new Audio('/sounds/background.mp3');
      bgMusic.loop = true;
      bgMusic.volume = 0.3;
      
      const hitSound = new Audio('/sounds/hit.mp3');
      hitSound.volume = 0.5;
      
      const successSound = new Audio('/sounds/success.mp3');
      successSound.volume = 0.5;
      
      // Set the audio elements in the store
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
    <header className="w-full bg-card p-4 shadow-md">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-volume-x">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" x2="17" y1="9" y2="15" />
                <line x1="17" x2="23" y1="9" y2="15" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-volume-2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            )}
          </Button>
          
          {showHomeButton && (
            <Button 
              variant="default" 
              size="icon"
              onClick={goHome}
              aria-label="Return to Menu"
            >
              <Home className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default GameHeader;
