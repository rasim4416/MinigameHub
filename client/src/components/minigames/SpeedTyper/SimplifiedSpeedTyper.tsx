import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Home, Trophy, Clock, PauseCircle, PlayCircle } from 'lucide-react';
import { useAudio } from '@/lib/stores/useAudio';

const SimplifiedSpeedTyper: React.FC = () => {
  const navigate = useNavigate();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pointsRef = useRef<NodeJS.Timeout | null>(null);
  
  // Game state
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  
  // Sound effects
  const { playHit, playSuccess } = useAudio();

  // Timer effect
  useEffect(() => {
    // Only run the timer when game is playing and not paused
    if (isPlaying && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimeLeft((time) => {
          // Game over when time runs out
          if (time <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            if (pointsRef.current) clearInterval(pointsRef.current);
            setIsGameOver(true);
            setIsPlaying(false);
            playSuccess();
            return 0;
          }
          return time - 1;
        });
      }, 1000);
      
      // Clean up
      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [isPlaying, isPaused, playSuccess]);
  
  // Start the game
  const handleStartGame = () => {
    // Reset state
    setScore(0);
    setTimeLeft(60);
    setIsGameOver(false);
    setIsPaused(false);
    setIsPlaying(true);
    
    // Points demo - add points every few seconds
    pointsRef.current = setInterval(() => {
      if (!isPaused) {
        setScore(s => s + 10);
        playHit();
      }
    }, 3000);
    
    // Clean up points timer after max game time
    setTimeout(() => {
      if (pointsRef.current) {
        clearInterval(pointsRef.current);
        pointsRef.current = null;
      }
    }, 60000);
  };
  
  // Toggle pause
  const handleTogglePause = () => {
    setIsPaused(!isPaused);
  };
  
  // Go back to menu
  const handleBackToMenu = () => {
    // Clean up any timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (pointsRef.current) {
      clearInterval(pointsRef.current);
      pointsRef.current = null;
    }
    
    playSuccess();
    navigate('/minigames');
  };

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine time color based on remaining time
  const getTimeColor = (seconds: number): string => {
    if (seconds <= 10) return 'text-red-500';
    if (seconds <= 30) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Top section with game stats */}
      <div className="p-4 flex justify-between items-center bg-card rounded-t-lg border-b border-border">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <span className="font-semibold">Score:</span>
          <span className="text-lg font-bold text-primary">{score}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-500" />
          <span className="font-semibold">Time:</span>
          <span className={`text-lg font-bold ${getTimeColor(timeLeft)}`}>
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>
      
      {/* Game area */}
      <div className="relative flex-1 bg-muted/30 rounded-lg overflow-hidden">
        {isPlaying ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {isPaused ? (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-20">
                <div className="text-center">
                  <h3 className="text-3xl font-bold mb-4">Game Paused</h3>
                  <button
                    onClick={handleTogglePause}
                    className="px-6 py-2 bg-primary text-primary-foreground rounded-md"
                  >
                    Resume
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-3xl font-bold mb-4">Speed Typer Demo</p>
                <p className="text-xl">Your score increases automatically every 3 seconds!</p>
              </>
            )}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {isGameOver ? (
              <div className="text-center">
                <h3 className="text-3xl font-bold mb-2">Game Over!</h3>
                <p className="text-xl mb-6">Final Score: {score}</p>
                <button
                  onClick={handleStartGame}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-md"
                >
                  Play Again
                </button>
              </div>
            ) : (
              <div className="text-center">
                <h3 className="text-3xl font-bold mb-4">Speed Typer</h3>
                <p className="text-lg mb-6">
                  Type the falling words before they reach the bottom!
                </p>
                <button
                  onClick={handleStartGame}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-md"
                >
                  Start Game
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Game controls */}
      <div className="p-4 flex justify-between items-center bg-card rounded-b-lg border-t border-border">
        <div className="flex gap-2">
          <button 
            onClick={handleBackToMenu}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-transparent hover:bg-muted transition-colors"
          >
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Menu</span>
          </button>
          
          {isPlaying && (
            <button
              onClick={handleTogglePause}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-muted hover:bg-muted transition-colors"
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
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Difficulty:</span>
          <div className="flex items-center border rounded-md overflow-hidden h-9">
            {['easy', 'medium', 'hard'].map((level) => (
              <button
                key={level}
                disabled={isPlaying && !isPaused}
                className={`px-3 py-1 text-sm ${
                  level === 'medium' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-card hover:bg-muted'
                } ${
                  (isPlaying && !isPaused)
                    ? 'opacity-50 cursor-not-allowed' 
                    : ''
                }`}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimplifiedSpeedTyper;