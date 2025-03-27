import { Button } from '@/components/ui/button';
import { Home, ChevronLeft, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAudio } from '@/lib/stores/useAudio';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

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
    <header className="w-full bg-gradient-to-r from-primary/10 to-accent/10 p-4 shadow-md border-b border-primary/20">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showHomeButton && (
            <Button 
              variant="outline" 
              size="icon"
              onClick={goHome}
              aria-label="Return to Menu"
              className="border-primary/40 hover:bg-primary/20 hover:text-primary transition-all duration-300"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className={cn(
            "text-2xl font-bold text-foreground bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent",
            showHomeButton ? "ml-0" : "ml-1"
          )}>
            {title}
          </h1>
        </div>
        
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
            className="border-primary/40 hover:bg-primary/20 hover:text-primary transition-all duration-300"
          >
            {isMuted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </Button>
          
          {!showHomeButton && (
            <Button 
              variant="default" 
              size="sm"
              onClick={() => window.open('https://github.com/your-username/minigame-collection', '_blank')}
              aria-label="View on GitHub"
              className="font-medium text-xs"
            >
              View Project
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default GameHeader;
