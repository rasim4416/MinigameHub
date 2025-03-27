import GameHeader from "@/components/minigames/GameHeader";
import PlaceholderGame from "@/components/minigames/PlaceholderGame";
import { useMinigames } from "@/lib/stores/useMinigames";
import { useParams } from "react-router-dom";
import { useEffect } from "react";
import { useAudio } from "@/lib/stores/useAudio";
import GameArea from "@/components/minigames/GameArea";

const MinigamePage = () => {
  const { id } = useParams<{ id: string }>();
  const { games } = useMinigames();
  const { backgroundMusic } = useAudio();
  
  const game = games.find(g => g.id === id);
  
  // Pause background music on game page
  useEffect(() => {
    if (backgroundMusic) {
      backgroundMusic.pause();
    }
    
    return () => {
      if (backgroundMusic) {
        backgroundMusic.pause();
      }
    };
  }, [backgroundMusic]);
  
  return (
    <div className="flex flex-col min-h-screen">
      <GameHeader 
        title={game?.title || "Game"} 
        showHomeButton={true} 
      />
      
      <main className="flex-1 flex flex-col items-center justify-start p-4 md:p-8">
        {game && game.isAvailable ? (
          <GameArea game={game} />
        ) : (
          <PlaceholderGame />
        )}
      </main>
      
      <footer className="py-4 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Minigame Collection</p>
      </footer>
    </div>
  );
};

export default MinigamePage;
