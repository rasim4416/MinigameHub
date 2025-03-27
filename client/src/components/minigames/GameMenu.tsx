import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import GameHeader from "./GameHeader";
import GameGrid from "./GameGrid";
import { useAudio } from "@/lib/stores/useAudio";
import { useEffect } from "react";

const GameMenu = () => {
  const navigate = useNavigate();
  const { backgroundMusic, isMuted } = useAudio();

  // Start background music when component mounts
  useEffect(() => {
    if (backgroundMusic && !isMuted) {
      backgroundMusic.play().catch(error => {
        console.log("Background music auto-play prevented:", error);
      });
    }
    
    return () => {
      if (backgroundMusic) {
        backgroundMusic.pause();
      }
    };
  }, [backgroundMusic, isMuted]);

  // Handle background music when mute state changes
  useEffect(() => {
    if (backgroundMusic) {
      if (isMuted) {
        backgroundMusic.pause();
      } else {
        backgroundMusic.play().catch(error => {
          console.log("Background music play prevented:", error);
        });
      }
    }
  }, [isMuted, backgroundMusic]);

  return (
    <div className="flex flex-col min-h-screen">
      <GameHeader />
      
      <main className="flex-1 flex flex-col items-center justify-start py-8 gap-8">
        <div className="text-center mb-4">
          <h2 className="text-3xl font-bold mb-2">Choose a Game</h2>
          <p className="text-muted-foreground">Select any game from our growing collection</p>
        </div>
        
        <GameGrid />
        
        <div className="mt-8 flex justify-center">
          <Button
            variant="outline" 
            size="lg"
            onClick={() => navigate('/')}
            className="animate-pulse"
          >
            More games coming soon!
          </Button>
        </div>
      </main>
      
      <footer className="py-4 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Minigame Collection</p>
      </footer>
    </div>
  );
};

export default GameMenu;
