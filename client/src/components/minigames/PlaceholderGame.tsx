import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate, useParams } from "react-router-dom";
import { useMinigames } from "@/lib/stores/useMinigames";
import { ArrowLeft, CalendarClock, LockKeyhole } from "lucide-react";
import { useAudio } from "@/lib/stores/useAudio";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

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

  // Get vibrant gradient based on game ID for visual consistency
  const getGameGradient = (id: string) => {
    const gradients = [
      'from-blue-500 to-purple-600',
      'from-green-500 to-teal-600',
      'from-orange-500 to-amber-600',
      'from-pink-500 to-rose-600',
      'from-indigo-500 to-violet-600',
      'from-red-500 to-orange-600',
      'from-teal-500 to-cyan-600',
      'from-yellow-500 to-amber-600',
    ];
    
    // Use a simple hash function to pick a consistent gradient based on game id
    const hashCode = id.split('').reduce((hash, char) => {
      return ((hash << 5) - hash) + char.charCodeAt(0) | 0;
    }, 0);
    
    return gradients[Math.abs(hashCode) % gradients.length];
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <div className="text-center mb-8 w-full max-w-xl">
        <div className="w-24 h-24 mx-auto bg-gradient-to-br rounded-full mb-6 flex items-center justify-center shadow-lg"
          style={{
            backgroundImage: `linear-gradient(to bottom right, var(--${getGameGradient(game.id).split(' ')[0].replace('from-', '')}), var(--${getGameGradient(game.id).split(' ')[1].replace('to-', '')}))`
          }}
        >
          <div className="text-6xl text-white">{game.icon}</div>
        </div>

        <h2 className={cn(
          "text-3xl font-bold mb-3",
          "bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
        )}>
          {game.title}
        </h2>
        
        <Card className="p-6 mb-8 border-primary/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br opacity-5"
            style={{
              backgroundImage: `linear-gradient(to bottom right, var(--${getGameGradient(game.id).split(' ')[0].replace('from-', '')}), var(--${getGameGradient(game.id).split(' ')[1].replace('to-', '')}))`
            }}
          />
          
          <div className="relative z-10">
            <p className="text-lg text-muted-foreground mb-6">
              {game.description}
            </p>
            
            <div className="flex items-center justify-center gap-3 mb-6 text-muted-foreground">
              {game.isAvailable ? (
                <CalendarClock className="h-5 w-5" />
              ) : (
                <LockKeyhole className="h-5 w-5" />
              )}
              <span>
                {game.isAvailable 
                  ? "This game is currently under construction" 
                  : "This game is coming soon to our collection"
                }
              </span>
            </div>
            
            <div className="mt-4 h-64 flex items-center justify-center bg-muted/50 rounded-md border border-muted-foreground/10">
              <div className="text-center">
                <div className="text-5xl mb-4 opacity-30">{game.icon}</div>
                <span className="text-muted-foreground">Game area will be implemented here</span>
              </div>
            </div>
          </div>
        </Card>
        
        <div className="flex justify-center gap-3">
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
          
          {game.isAvailable && (
            <Button 
              variant="outline"
              className="border-primary/40 hover:bg-primary/20 hover:text-primary transition-all duration-300"
              onClick={() => window.open(`https://github.com/search?q=${game.title}+game&type=repositories`, '_blank')}
            >
              View Similar Games
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaceholderGame;
