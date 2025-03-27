import { Button } from "@/components/ui/button";
import { useNavigate, useParams } from "react-router-dom";
import { useMinigames } from "@/lib/stores/useMinigames";
import { ArrowLeft } from "lucide-react";
import { useAudio } from "@/lib/stores/useAudio";
import { useEffect } from "react";

const PlaceholderGame = () => {
  const { id } = useParams<{ id: string }>();
  const { games } = useMinigames();
  const navigate = useNavigate();
  const { playSuccess } = useAudio();
  
  const game = games.find(g => g.id === id);
  
  // Redirect if game not found
  useEffect(() => {
    if (!game) {
      navigate('/minigames', { replace: true });
    }
  }, [game, navigate]);
  
  if (!game) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">{game.icon}</div>
        <h2 className="text-3xl font-bold mb-2">{game.title}</h2>
        <p className="text-lg text-muted-foreground mb-8">
          {game.isAvailable 
            ? "This game is under construction" 
            : "This game is coming soon"
          }
        </p>
        
        <div className="p-6 rounded-lg border border-border bg-card mb-8">
          <p className="text-xl">Game description will go here</p>
          <div className="mt-4 h-64 flex items-center justify-center bg-muted rounded-md">
            <span className="text-muted-foreground">Game area will be implemented here</span>
          </div>
        </div>
        
        <Button 
          onClick={() => {
            playSuccess();
            navigate('/minigames');
          }}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Game Menu
        </Button>
      </div>
    </div>
  );
};

export default PlaceholderGame;
