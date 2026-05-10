import { useEffect, useState } from "react";
import { GameType } from "@/lib/stores/useMinigames";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Play, RotateCcw } from "lucide-react";
import SimplifiedSpeedTyper from "./SpeedTyper/SimplifiedSpeedTyper";
import BarricadeGame from "./Barricade/BarricadeGame";
import BlackjackGame from "./Blackjack/BlackjackGame";
import ChessHub from "./Chess/ChessHub";

interface GameAreaProps {
  game: GameType;
}

const GameArea = ({ game }: GameAreaProps) => {
  const isDedicatedGame = game.id === "speed-typer" || game.id === "barricade" || game.id === "blackjack" || game.id === "chess";
  const [isLoading, setIsLoading] = useState(!isDedicatedGame);
  const [gameStarted, setGameStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  
  useEffect(() => {
    if (isDedicatedGame) return;
    // Simulate loading time for placeholder games only
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    
    return () => clearTimeout(timer);
  }, [isDedicatedGame]);

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

  const handleStart = () => {
    setGameStarted(true);
    // Simulate earning points
    const interval = setInterval(() => {
      setScore(prev => prev + 10);
      if (score > 0 && score % 50 === 0) {
        setLevel(prev => prev + 1);
      }
    }, 2000);

    // Clean up interval after 10 seconds
    setTimeout(() => {
      clearInterval(interval);
    }, 10000);
  };

  const handleReset = () => {
    setGameStarted(false);
    setScore(0);
    setLevel(1);
  };
  
  // Render the appropriate game based on game ID
  const renderGameContent = () => {
    if (isLoading) {
      return (
        <div className="animate-pulse z-10">
          <div className="h-10 w-10 border-4 border-t-primary rounded-full animate-spin"></div>
        </div>
      );
    }
    
    // Speed Typer Game
    if (game.id === "speed-typer") {
      return <SimplifiedSpeedTyper />;
    }

    // Barricade Game
    if (game.id === "barricade") {
      return <BarricadeGame />;
    }

    // Blackjack Game
    if (game.id === "blackjack") {
      return <BlackjackGame />;
    }

    // Chess Game
    if (game.id === "chess") {
      return <ChessHub />;
    }

    // Default placeholder for other games
    return (
      <div className="flex flex-col items-center justify-center w-full h-full p-6 z-10">
        <div className={cn(
          "text-7xl mb-4 transition-all duration-500",
          gameStarted && "animate-pulse scale-110"
        )}>
          {game.icon}
        </div>
        
        <h2 className={cn(
          "text-2xl font-bold mb-2",
          "bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
        )}>
          {game.title}
        </h2>
        
        <p className="text-muted-foreground mb-6 text-center max-w-md">
          {game.description}
        </p>
        
        <div className="grid grid-cols-2 gap-4 w-full max-w-xs mx-auto mb-6">
          <Card className={cn(
            "p-4 text-center bg-card shadow-md transition-all duration-300",
            gameStarted && score > 0 && "border-primary"
          )}>
            <p className="font-medium text-muted-foreground">Score</p>
            <p className={cn(
              "text-2xl font-bold",
              gameStarted && score > 0 && "text-primary"
            )}>
              {score}
            </p>
          </Card>
          <Card className={cn(
            "p-4 text-center bg-card shadow-md transition-all duration-300",
            gameStarted && level > 1 && "border-primary"
          )}>
            <p className="font-medium text-muted-foreground">Level</p>
            <p className={cn(
              "text-2xl font-bold",
              gameStarted && level > 1 && "text-primary"
            )}>
              {level}
            </p>
          </Card>
        </div>
        
        <div className="flex gap-3">
          <Button
            variant={gameStarted ? "outline" : "default"}
            size="lg"
            onClick={handleStart}
            disabled={gameStarted}
            className={cn(
              gameStarted ? "opacity-50 cursor-not-allowed" : "animate-pulse"
            )}
          >
            <Play className="mr-2 h-4 w-4" />
            Start Game
          </Button>
          
          {gameStarted && (
            <Button 
              variant="outline"
              size="lg"
              onClick={handleReset}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <Card className={cn(
      "w-full h-[50vh] md:h-[65vh] transition-all duration-500 relative overflow-hidden border-2",
      isDedicatedGame
        ? "flex flex-col p-0"
        : "flex items-center justify-center",
      isLoading ? "opacity-50" : "opacity-100",
      isDedicatedGame ? "" : (gameStarted ? "border-primary" : "border-muted")
    )}>
      {/* Background gradient for non-dedicated games */}
      {!isDedicatedGame && (
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-10",
          getGameGradient(game.id),
          gameStarted && "opacity-25"
        )} />
      )}

      {renderGameContent()}
      
      {/* Static decorative elements for non-dedicated games */}
      {!isDedicatedGame && (
        <>
          <div className="absolute top-5 left-5 h-3 w-3 rounded-full bg-primary/20 animate-pulse"></div>
          <div className="absolute bottom-10 right-10 h-5 w-5 rounded-full bg-accent/20 animate-pulse"></div>
          <div className="absolute top-1/4 right-10 h-4 w-4 rounded-full bg-secondary/20 animate-pulse"></div>
        </>
      )}
    </Card>
  );
};

export default GameArea;
