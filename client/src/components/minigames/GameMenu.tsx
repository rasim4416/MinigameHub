import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import GameHeader from "./GameHeader";
import GameGrid from "./GameGrid";
import { useAudio } from "@/lib/stores/useAudio";
import { useEffect } from "react";
import { Sparkles, Gamepad2 } from "lucide-react";

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
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-background to-background/95">
      <GameHeader />
      
      <main className="flex-1 flex flex-col items-center justify-start py-8 gap-8 px-4">
        <div className="text-center mb-4 max-w-2xl">
          <div className="inline-flex items-center justify-center mb-3 gap-2">
            <Gamepad2 className="h-8 w-8 text-primary animate-pulse" />
            <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Mal Akın hahahah mal akın akın mal
            </h2>
            <Gamepad2 className="h-8 w-8 text-accent animate-pulse" style={{ animationDelay: '0.5s' }} />
          </div>
          <p className="text-muted-foreground text-lg">
            Select any game from our growing collection of minigames
          </p>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-32 left-[10%] w-2 h-2 rounded-full bg-primary/30 animate-ping" style={{ animationDuration: '3s' }}></div>
        <div className="absolute top-48 right-[15%] w-3 h-3 rounded-full bg-accent/30 animate-ping" style={{ animationDuration: '4s' }}></div>
        <div className="absolute bottom-32 left-[20%] w-2 h-2 rounded-full bg-secondary/30 animate-ping" style={{ animationDuration: '5s' }}></div>
        
        <div className="relative w-full">
          <GameGrid />
        </div>
        
        <div className="mt-8 flex justify-center">
          <Button
            variant="outline" 
            size="lg"
            onClick={() => navigate('/')}
            className="group relative overflow-hidden border-primary/40 hover:border-primary transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <Sparkles className="mr-2 h-4 w-4 text-primary animate-pulse" />
            <span className="relative z-10">More games coming soon!</span>
          </Button>
        </div>
      </main>
      
      <footer className="py-6 text-center border-t border-primary/10">
        <div className="flex flex-col items-center justify-center gap-2">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Minigame Collection
          </p>
          <div className="text-xs text-muted-foreground/60 flex gap-2">
            <span>Fun Games</span>
            <span>•</span>
            <span>Play Anytime</span>
            <span>•</span>
            <span>Quick Challenges</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default GameMenu;
