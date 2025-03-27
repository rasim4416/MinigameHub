import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAudio } from '@/lib/stores/useAudio';
import { Card } from '@/components/ui/card';
import { GameType } from '@/lib/stores/useMinigames';

interface GameIconProps {
  game: GameType;
  index: number;
}

const GameIcon = ({ game, index }: GameIconProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();
  const { playHit } = useAudio();
  
  const handleClick = () => {
    playHit();
    navigate(`/minigames/${game.id}`);
  };

  // Generate a vibrant color based on the game id for visual distinction
  const getGameColor = (id: string) => {
    const colors = [
      'from-blue-500 to-purple-600',
      'from-green-500 to-teal-600',
      'from-orange-500 to-amber-600',
      'from-pink-500 to-rose-600',
      'from-indigo-500 to-violet-600',
      'from-red-500 to-orange-600',
      'from-teal-500 to-cyan-600',
      'from-yellow-500 to-amber-600',
    ];
    
    // Use a simple hash function to pick a consistent color based on game id
    const hashCode = id.split('').reduce((hash, char) => {
      return ((hash << 5) - hash) + char.charCodeAt(0) | 0;
    }, 0);
    
    return colors[Math.abs(hashCode) % colors.length];
  };

  return (
    <Card
      className={cn(
        "w-full aspect-square flex items-center justify-center cursor-pointer transition-all duration-300 overflow-hidden relative",
        "border-2",
        isHovered ? "shadow-xl scale-105 border-primary" : "shadow-md border-transparent",
        !game.isAvailable && "opacity-70 grayscale"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      data-testid={`game-icon-${index}`}
    >
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-25",
        getGameColor(game.id),
        isHovered && "opacity-75"
      )} />
      
      <div className={cn(
        "flex flex-col items-center justify-center p-3 text-center z-10 bg-card/60 backdrop-blur-sm rounded-md w-full h-full",
        isHovered && "bg-card/30"
      )}>
        <div className={cn(
          "text-5xl mb-3 transition-transform duration-300",
          isHovered && "scale-110"
        )}>
          {game.icon}
        </div>
        <div className={cn(
          "text-sm font-bold",
          isHovered ? "text-primary" : "text-foreground"
        )}>
          {game.title}
        </div>
        
        {isHovered && game.isAvailable && (
          <div className="mt-2 px-3 py-1 bg-primary rounded-full text-xs font-semibold text-primary-foreground animate-fade-in">
            Play Now
          </div>
        )}
      </div>
      
      {!game.isAvailable && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-20">
          <span className="text-sm font-bold px-3 py-1 bg-muted rounded-full">Coming Soon</span>
        </div>
      )}
    </Card>
  );
};

export default GameIcon;
