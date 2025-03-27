import { useEffect, useState } from "react";
import { GameType } from "@/lib/stores/useMinigames";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface GameAreaProps {
  game: GameType;
}

const GameArea = ({ game }: GameAreaProps) => {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Simulate loading time
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <Card className={cn(
      "w-full h-[50vh] md:h-[60vh] flex items-center justify-center transition-opacity duration-500 relative",
      isLoading ? "opacity-50" : "opacity-100"
    )}>
      {isLoading ? (
        <div className="animate-pulse">
          <div className="h-8 w-8 border-4 border-t-primary rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-full p-4">
          <div className="text-6xl mb-4">{game.icon}</div>
          <p className="text-xl font-medium mb-2">Game: {game.title}</p>
          <p className="text-muted-foreground mb-6">
            This game is a placeholder for future implementation
          </p>
          
          <div className="grid grid-cols-2 gap-4 w-full max-w-xs mx-auto">
            <Card className="p-4 text-center bg-muted">
              <p className="font-medium">Score</p>
              <p className="text-xl">0</p>
            </Card>
            <Card className="p-4 text-center bg-muted">
              <p className="font-medium">Level</p>
              <p className="text-xl">1</p>
            </Card>
          </div>
        </div>
      )}
    </Card>
  );
};

export default GameArea;
