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

  return (
    <Card
      className={cn(
        "w-full aspect-square flex items-center justify-center cursor-pointer transition-all duration-200 overflow-hidden",
        isHovered ? "shadow-lg scale-105 bg-accent" : "shadow-md bg-card",
        !game.isAvailable && "opacity-60 grayscale"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      data-testid={`game-icon-${index}`}
    >
      <div className="flex flex-col items-center justify-center p-2 text-center">
        <div className="text-4xl mb-2">
          {game.icon}
        </div>
        <div className={cn(
          "text-sm font-medium",
          isHovered ? "text-accent-foreground" : "text-foreground"
        )}>
          {game.title}
        </div>
      </div>
      
      {!game.isAvailable && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <span className="text-sm font-medium text-foreground">Coming Soon</span>
        </div>
      )}
    </Card>
  );
};

export default GameIcon;
