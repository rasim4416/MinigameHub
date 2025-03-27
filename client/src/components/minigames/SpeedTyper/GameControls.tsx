import React from 'react';
import { useSpeedTyper } from '@/lib/stores/useSpeedTyper';
import { Button } from '@/components/ui/button';
import { 
  RefreshCw, 
  PauseCircle, 
  PlayCircle, 
  Home,
  AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAudio } from '@/lib/stores/useAudio';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GameControlsProps {
  onRestart: () => void;
  onPauseToggle: () => void;
  isPaused: boolean;
  isGameOver: boolean;
  isPlaying: boolean;
}

const GameControls: React.FC<GameControlsProps> = ({
  onRestart,
  onPauseToggle,
  isPaused,
  isGameOver,
  isPlaying
}) => {
  const navigate = useNavigate();
  const { playSuccess } = useAudio();
  const { difficulty, setDifficulty } = useSpeedTyper();

  // Handle difficulty change
  const handleDifficultyChange = (value: string) => {
    setDifficulty(value as 'easy' | 'medium' | 'hard');
  };

  // Handle returning to menu
  const handleBackToMenu = () => {
    playSuccess();
    navigate('/minigames');
  };

  return (
    <div className="game-controls p-4 flex flex-wrap justify-between items-center gap-2 bg-card rounded-b-lg border-t border-border">
      <div className="flex gap-2">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleBackToMenu}
          className="flex items-center gap-1"
        >
          <Home className="h-4 w-4" />
          <span className="hidden sm:inline">Menu</span>
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onRestart}
          disabled={isPlaying && !isGameOver}
          className="flex items-center gap-1"
        >
          <RefreshCw className="h-4 w-4" />
          <span className="hidden sm:inline">Restart</span>
        </Button>
        
        {isPlaying && !isGameOver && (
          <Button
            variant="outline"
            size="sm"
            onClick={onPauseToggle}
            className="flex items-center gap-1"
          >
            {isPaused ? (
              <>
                <PlayCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Resume</span>
              </>
            ) : (
              <>
                <PauseCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Pause</span>
              </>
            )}
          </Button>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Difficulty:</span>
        <Select 
          value={difficulty} 
          onValueChange={handleDifficultyChange}
          disabled={isPlaying && !isGameOver && !isPaused}
        >
          <SelectTrigger className="w-[110px] h-9">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
        
        {difficulty === 'hard' && (
          <div className="hidden sm:flex items-center">
            <AlertTriangle className="h-4 w-4 text-yellow-500 mr-1" />
            <span className="text-xs text-yellow-500">Words fall faster!</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameControls;