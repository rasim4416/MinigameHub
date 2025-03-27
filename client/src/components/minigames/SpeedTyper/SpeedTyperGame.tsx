import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSpeedTyper, FallingWord } from '@/lib/stores/useSpeedTyper';
import { useGame } from '@/lib/stores/useGame';
import { useAudio } from '@/lib/stores/useAudio';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { 
  RefreshCw, 
  PauseCircle, 
  PlayCircle, 
  Home,
  AlertTriangle,
  Clock,
  Trophy
} from 'lucide-react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Utility to generate a random id
const generateId = () => Math.random().toString(36).substring(2, 9);

// Generate a random color from a predefined set
const getRandomColor = () => {
  const colors = [
    'text-blue-500', 'text-green-500', 'text-purple-500', 
    'text-pink-500', 'text-yellow-500', 'text-red-500', 
    'text-indigo-500', 'text-teal-500'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

const SpeedTyperGame = () => {
  const {
    score, 
    timeLeft, 
    inputValue, 
    fallingWords,
    isGameOver,
    isPaused,
    difficulty,
    wordBank,
    
    incrementScore,
    setInputValue,
    addFallingWord,
    removeFallingWord,
    updateFallingWordPosition,
    setTimeLeft,
    setGameOver,
    setPaused,
    setDifficulty,
    resetGame
  } = useSpeedTyper();
  
  const { phase, start, end } = useGame();
  const { playHit, playSuccess } = useAudio();
  const inputRef = useRef<HTMLInputElement>(null);
  
  // References for animation frame and timers
  const requestRef = useRef<number>();
  const wordSpawnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Game speed settings based on difficulty
  const [gameSpeed, setGameSpeed] = useState(1);
  const [wordSpawnRate, setWordSpawnRate] = useState(2000); // ms between words
  
  // Focus input field when game starts
  useEffect(() => {
    if (phase === 'playing' && !isGameOver && !isPaused) {
      inputRef.current?.focus();
    }
  }, [phase, isGameOver, isPaused]);
  
  // Handle window focus/blur for pausing
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && phase === 'playing' && !isGameOver) {
        setPaused(true);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', () => phase === 'playing' && !isGameOver && setPaused(true));
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', () => {});
    };
  }, [phase, isGameOver, setPaused]);
  
  // Update difficulty settings when changed
  useEffect(() => {
    switch (difficulty) {
      case 'easy':
        setGameSpeed(0.7);
        setWordSpawnRate(2500);
        break;
      case 'medium':
        setGameSpeed(1);
        setWordSpawnRate(2000);
        break;
      case 'hard':
        setGameSpeed(1.3);
        setWordSpawnRate(1500);
        break;
    }
  }, [difficulty]);
  
  // Pick a random word from the word bank
  const getRandomWord = useCallback(() => {
    return wordBank[Math.floor(Math.random() * wordBank.length)];
  }, [wordBank]);
  
  // Generate a new falling word
  const generateWord = useCallback(() => {
    if (fallingWords.length >= 10) return; // Limit max words on screen
    
    const word = getRandomWord();
    // Ensure the word length is 3-8 letters
    if (word.length < 3 || word.length > 8) return generateWord();
    
    // Avoid duplicate words that are currently falling
    if (fallingWords.some(w => w.word === word)) return generateWord();
    
    const newWord: FallingWord = {
      id: generateId(),
      word,
      x: Math.random() * 80 + 10, // 10% to 90% of screen width
      y: 0, // Start at the top
      speed: (Math.random() * 0.3 + 0.7) * gameSpeed, // Random speed with game speed multiplier
      color: getRandomColor()
    };
    
    addFallingWord(newWord);
  }, [fallingWords, addFallingWord, getRandomWord, gameSpeed]);
  
  // Start the word spawning system
  const startWordSpawner = useCallback(() => {
    if (wordSpawnTimerRef.current) clearInterval(wordSpawnTimerRef.current);
    
    wordSpawnTimerRef.current = setInterval(() => {
      if (!isPaused && !isGameOver) {
        generateWord();
      }
    }, wordSpawnRate);
    
    return () => {
      if (wordSpawnTimerRef.current) clearInterval(wordSpawnTimerRef.current);
    };
  }, [generateWord, wordSpawnRate, isPaused, isGameOver]);
  
  // Start the game timer
  const startGameTimer = useCallback(() => {
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    
    gameTimerRef.current = setInterval(() => {
      if (!isPaused && !isGameOver) {
        // Update the time left
        if (timeLeft <= 1) {
          // Game over when time runs out
          setTimeLeft(0);
          setGameOver(true);
          end();
          if (gameTimerRef.current) clearInterval(gameTimerRef.current);
        } else {
          setTimeLeft(timeLeft - 1);
        }
      }
    }, 1000);
    
    return () => {
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    };
  }, [isPaused, isGameOver, timeLeft, setTimeLeft, setGameOver, end]);
  
  // Initialize the game
  useEffect(() => {
    if (phase === 'playing' && !isGameOver) {
      // Reset game state if not already reset
      if (score !== 0 || timeLeft !== 60 || fallingWords.length > 0) {
        resetGame();
      }
      
      // Start game systems
      const cleanupWordSpawner = startWordSpawner();
      const cleanupGameTimer = startGameTimer();
      
      // Focus input field
      inputRef.current?.focus();
      
      return () => {
        cleanupWordSpawner();
        cleanupGameTimer();
        cancelAnimationFrame(requestRef.current!);
      };
    }
  }, [phase, isGameOver, score, timeLeft, fallingWords.length, resetGame, startWordSpawner, startGameTimer]);
  
  // Handle animation for falling words
  useEffect(() => {
    if (isPaused || isGameOver) return;
    
    const animate = () => {
      // Update positions of all falling words
      fallingWords.forEach(word => {
        // Calculate new position based on speed
        const newY = word.y + word.speed * 0.1; // 0.1 is a speed multiplier
        
        if (newY >= 100) {
          // Word has reached bottom, remove it
          removeFallingWord(word.id);
        } else {
          updateFallingWordPosition(word.id, newY);
        }
      });
      
      // Continue animation
      requestRef.current = requestAnimationFrame(animate);
    };
    
    requestRef.current = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(requestRef.current!);
    };
  }, [fallingWords, isPaused, isGameOver, removeFallingWord, updateFallingWordPosition]);
  
  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };
  
  // Handle form submission (when user presses enter)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (inputValue.trim()) {
      // Check if the typed word matches any falling word
      const matchedWordIndex = fallingWords.findIndex(
        word => word.word.toLowerCase() === inputValue.toLowerCase()
      );
      
      if (matchedWordIndex !== -1) {
        // Found a match!
        const matchedWord = fallingWords[matchedWordIndex];
        
        // Remove the matched word
        removeFallingWord(matchedWord.id);
        
        // Increment score
        incrementScore();
        
        // Play hit sound
        playHit();
      }
      
      // Clear input field regardless of match
      setInputValue('');
    }
  };
  
  // Handle game restart
  const handleRestartGame = () => {
    resetGame();
    start(); // Restart the game
    playSuccess();
  };
  
  // Handle pause/resume
  const togglePause = () => {
    setPaused(!isPaused);
    
    if (isPaused) {
      // When resuming, immediately focus the input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
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
  
  const navigate = useNavigate();
  
  // Handle returning to menu
  const handleBackToMenu = () => {
    playSuccess();
    navigate('/minigames');
  };
  
  // Handle difficulty change
  const handleDifficultyChange = (value: string) => {
    setDifficulty(value as 'easy' | 'medium' | 'hard');
  };
  
  return (
    <div className="speed-typer-game w-full h-full flex flex-col">
      {/* Top section with game stats */}
      <div className="game-stats-container p-4 flex justify-between items-center bg-card rounded-t-lg border-b border-border">
        <div className="stat-item flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <span className="font-semibold">Score:</span>
          <span className="text-lg font-bold text-primary">{score}</span>
        </div>
        
        <div className="stat-item flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-500" />
          <span className="font-semibold">Time:</span>
          <span className={`text-lg font-bold ${getTimeColor(timeLeft)}`}>
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>
      
      {/* Game area with falling words */}
      <div className="game-area relative flex-1 bg-muted/30 rounded-lg overflow-hidden">
        {phase === 'playing' && !isGameOver ? (
          <>
            {/* Input field for typing */}
            <form 
              onSubmit={handleSubmit} 
              className="absolute bottom-4 left-0 right-0 z-10 px-4"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                disabled={isPaused || isGameOver}
                className="w-full mx-auto max-w-md px-4 py-2 border-2 border-primary/50 rounded-md bg-background/90 text-foreground text-center text-lg font-medium focus:border-primary focus:outline-none"
                placeholder="Type the falling words..."
              />
            </form>
            
            {/* Falling words */}
            <div className="falling-words-container absolute inset-0">
              {fallingWords.map((word) => (
                <div
                  key={word.id}
                  className={cn(
                    "absolute transform -translate-x-1/2 transition-opacity duration-300",
                    word.color,
                    isPaused ? "animate-none" : ""
                  )}
                  style={{
                    left: `${word.x}%`,
                    top: `${word.y}%`,
                    // Apply font size based on word length - shorter words are bigger
                    fontSize: `${Math.max(22, 32 - word.word.length * 2)}px`,
                    // Optional: Add a subtle glow effect based on color
                    textShadow: '0 0 5px currentColor',
                    opacity: isPaused ? 0.7 : 1
                  }}
                >
                  <span className="font-bold">{word.word}</span>
                </div>
              ))}
            </div>
            
            {/* Pause overlay */}
            {isPaused && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-20">
                <div className="text-center">
                  <h3 className="text-3xl font-bold mb-4">Game Paused</h3>
                  <button
                    onClick={togglePause}
                    className="px-6 py-2 bg-primary text-primary-foreground rounded-md"
                  >
                    Resume
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Game over or start screen */}
            {isGameOver ? (
              <div className="text-center">
                <h3 className="text-3xl font-bold mb-2">Game Over!</h3>
                <p className="text-xl mb-6">Final Score: {score}</p>
                <button
                  onClick={handleRestartGame}
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
                  onClick={start}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-md"
                >
                  Start Game
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Game controls (restart, pause, difficulty) */}
      <div className="game-controls p-4 flex flex-wrap justify-between items-center gap-2 bg-card rounded-b-lg border-t border-border">
        <div className="flex gap-2">
          <button 
            onClick={handleBackToMenu}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-transparent hover:bg-muted transition-colors"
          >
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Menu</span>
          </button>
          
          <button
            onClick={handleRestartGame}
            disabled={phase === 'playing' && !isGameOver}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-muted hover:bg-muted transition-colors",
              phase === 'playing' && !isGameOver && "opacity-50 cursor-not-allowed"
            )}
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Restart</span>
          </button>
          
          {phase === 'playing' && !isGameOver && (
            <button
              onClick={togglePause}
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
          <Select 
            value={difficulty} 
            onValueChange={handleDifficultyChange}
            disabled={phase === 'playing' && !isGameOver && !isPaused}
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
    </div>
  );
};

export default SpeedTyperGame;