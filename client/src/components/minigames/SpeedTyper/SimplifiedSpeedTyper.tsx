import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Home, Trophy, Clock, PauseCircle, PlayCircle, AlertTriangle } from 'lucide-react';
import { useAudio } from '@/lib/stores/useAudio';

// Define a type for falling words
interface FallingWord {
  id: string;
  word: string;
  x: number;  // horizontal position (%)
  y: number;  // vertical position (%)
  speed: number; // falling speed
  color: string; // text color
}

// List of word colors with enhanced visual effects
const wordColors = [
  'text-blue-500 drop-shadow-[0_0_10px_rgba(59,130,246,0.7)]',
  'text-green-500 drop-shadow-[0_0_10px_rgba(34,197,94,0.7)]',
  'text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.7)]',
  'text-purple-500 drop-shadow-[0_0_10px_rgba(168,85,247,0.7)]',
  'text-pink-500 drop-shadow-[0_0_10px_rgba(236,72,153,0.7)]',
  'text-indigo-500 drop-shadow-[0_0_10px_rgba(99,102,241,0.7)]',
  'text-teal-500 drop-shadow-[0_0_10px_rgba(20,184,166,0.7)]',
  'text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.7)]',
  'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.7)]',
];

// Word banks for different languages
const wordBanks = {
  english: [
    // Common 3-letter words
    "the", "and", "for", "are", "but", "not", "you", "all", "any", "can", 
    "had", "her", "was", "one", "our", "out", "day", "get", "has", "him",
    "his", "how", "new", "now", "old", "see", "two", "way", "who", "eye",
    // Common 4-letter words
    "book", "game", "life", "time", "year", "work", "code", "play", "fast",
    "slow", "good", "last", "long", "make", "many", "more", "most", "only",
    "over", "very", "word", "love", "help", "find", "look", "hand", "part",
    // Common 5-letter words
    "after", "again", "about", "below", "could", "every", "first", "found",
    "great", "house", "large", "learn", "never", "other", "place", "plant",
    "point", "right", "small", "sound", "spell", "still", "study", "think",
    "water", "where", "which", "world", "would", "write", "happy", "peace",
    // Longer words (6-8 letters)
    "around", "because", "between", "brought", "certain", "enough", "example",
    "explain", "message", "picture", "program", "quality", "receive", "science",
    "someone", "student", "success", "support", "through", "understand",
    // Tech-related words
    "coding", "browser", "computer", "software", "keyboard", "website", "internet",
    "network", "database", "function", "variable", "algorithm", "framework",
    "digital", "virtual", "amazing", "explore", "develop", "creative", "learning"
  ],
  
  türkçe: [
    // Common 3-letter Turkish words
    "bir", "çok", "göz", "yol", "son", "gün", "bak", "iki", "ben", "sen", 
    "git", "gel", "yer", "sev", "ara", "bul", "yap", "sor", "ver", "dün",
    // Common 4-letter Turkish words
    "daha", "hava", "çalı", "gece", "ayak", "balık", "anne", "baba", "kedi",
    "köpek", "masa", "kapı", "yemek", "ağaç", "deniz", "ayna", "boya", "kova",
    "toka", "okul", "renk", "sevgi", "güzel", "kitap", "kalem", "defter",
    // Common 5-letter Turkish words
    "bugün", "yarın", "sonra", "önce", "beyaz", "siyah", "elma", "armut",
    "üzüm", "kiraz", "kaşık", "çatal", "kenar", "fırın", "tarih", "müzik",
    "çiçek", "yaprak", "toprak", "tohum", "lamba", "ışık", "yıldız", "bulut",
    // Longer words (6-8 letters)
    "telefon", "bilgisayar", "internet", "kütüphane", "hastane", "öğrenci",
    "öğretmen", "arkadaş", "kelebek", "böcek", "balina", "yunus", "ördek",
    "martı", "güneş", "gezegen", "başarı", "mutluluk", "sağlık", "yaşam",
    // Tech-related Turkish words
    "ekran", "klavye", "fare", "yazılım", "uygulama", "veri", "bellek", 
    "bağlantı", "tarayıcı", "işlemci", "yüklemek", "indirmek", "çevrimiçi",
    "kablosuz", "dijital", "sanal", "dosya", "klasör", "şifre", "hesap"
  ]
};

// Generate a random word from the word bank based on selected language
const getRandomWord = (lang: Language): string => {
  const words = wordBanks[lang];
  return words[Math.floor(Math.random() * words.length)];
};

// Generate a unique ID for a word
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

type Difficulty = 'easy' | 'medium' | 'hard';
type Language = 'english' | 'türkçe';

const SimplifiedSpeedTyper: React.FC = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wordSpawnerRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  
  // Game state
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [fallingWords, setFallingWords] = useState<FallingWord[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [language, setLanguage] = useState<Language>('english');
  
  // UI styles based on language
  const gameBackground = language === 'english' 
    ? 'bg-gradient-to-b from-blue-900/20 to-purple-900/20' 
    : 'bg-gradient-to-b from-red-900/20 to-orange-900/20';
  
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
            if (wordSpawnerRef.current) clearInterval(wordSpawnerRef.current);
            if (animationRef.current) clearInterval(animationRef.current);
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

  // Clean up function for all timers
  const cleanupTimers = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (wordSpawnerRef.current) {
      clearInterval(wordSpawnerRef.current);
      wordSpawnerRef.current = null;
    }
    if (animationRef.current) {
      clearInterval(animationRef.current);
      animationRef.current = null;
    }
  };
  
  // Start the game
  const handleStartGame = () => {
    // Reset state
    setScore(0);
    setTimeLeft(60);
    setIsGameOver(false);
    setIsPaused(false);
    setFallingWords([]);
    setInputValue('');
    setIsPlaying(true);
    
    // Start spawning words
    startWordSpawner();
    
    // Start falling animation
    startFallingAnimation();
    
    // Focus the input field
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };
  
  // Start the word spawner
  const startWordSpawner = () => {
    // Clear any existing spawner
    if (wordSpawnerRef.current) clearInterval(wordSpawnerRef.current);
    
    // Determine spawn rate based on difficulty
    let spawnRate: number;
    switch (difficulty) {
      case 'easy': spawnRate = 3000; break; // Spawn every 3 seconds
      case 'hard': spawnRate = 1000; break; // Spawn every 1 second
      case 'medium': 
      default: spawnRate = 2000; break; // Spawn every 2 seconds
    }
    
    // Start spawning words
    wordSpawnerRef.current = setInterval(() => {
      if (!isPaused) {
        // Create a new word using the current language
        const newWord: FallingWord = {
          id: generateId(),
          word: getRandomWord(language),
          x: Math.random() * 80 + 10, // Position between 10% and 90% horizontally
          y: 0, // Start at the top
          speed: difficulty === 'easy' ? 0.5 : 
                 difficulty === 'medium' ? 1 : 
                 1.5, // Speed based on difficulty
          color: wordColors[Math.floor(Math.random() * wordColors.length)]
        };
        
        // Add the word to the falling words array
        setFallingWords(words => [...words, newWord]);
      }
    }, spawnRate);
    
    return () => {
      if (wordSpawnerRef.current) clearInterval(wordSpawnerRef.current);
    };
  };
  
  // Animate falling words
  const startFallingAnimation = () => {
    // Clear any existing animation
    if (animationRef.current) clearInterval(animationRef.current);
    
    // Set animation frame rate
    const frameRate = 50; // ms per frame
    
    // Start animation loop
    animationRef.current = setInterval(() => {
      if (!isPaused) {
        setFallingWords(words => {
          // Move each word down based on its speed
          const updatedWords = words.map(word => ({
            ...word,
            y: word.y + word.speed
          }));
          
          // Remove words that have fallen off the bottom
          const remainingWords = updatedWords.filter(word => word.y < 100);
          
          // If a word was removed (reached the bottom), reduce score slightly
          if (remainingWords.length < updatedWords.length) {
            setScore(s => Math.max(0, s - 5));
          }
          
          return remainingWords;
        });
      }
    }, frameRate);
    
    return () => {
      if (animationRef.current) clearInterval(animationRef.current);
    };
  };
  
  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };
  
  // Handle form submission (when user presses enter)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (inputValue.trim()) {
      // Check for a match
      const matchedWordIndex = fallingWords.findIndex(
        word => word.word.toLowerCase() === inputValue.toLowerCase()
      );
      
      if (matchedWordIndex !== -1) {
        // Found a match
        const matchedWord = fallingWords[matchedWordIndex];
        
        // Remove the matched word
        setFallingWords(words => words.filter(w => w.id !== matchedWord.id));
        
        // Add points based on word length and difficulty
        const basePoints = matchedWord.word.length * 5;
        const difficultyMultiplier = 
          difficulty === 'easy' ? 1 :
          difficulty === 'medium' ? 1.5 :
          2; // Hard
        
        setScore(s => s + Math.floor(basePoints * difficultyMultiplier));
        
        // Play hit sound
        playHit();
      }
      
      // Clear input field
      setInputValue('');
    }
  };
  
  // Toggle pause
  const handleTogglePause = () => {
    setIsPaused(!isPaused);
    
    // Focus input when resuming
    if (isPaused) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };
  
  // Handle difficulty change
  const handleDifficultyChange = (level: Difficulty) => {
    if (!isPlaying || isPaused) {
      setDifficulty(level);
    }
  };
  
  // Handle language change
  const handleLanguageChange = (lang: Language) => {
    if (!isPlaying || isPaused) {
      setLanguage(lang);
    }
  };
  
  // Go back to menu
  const handleBackToMenu = () => {
    // Clean up any timers
    cleanupTimers();
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
      
      {/* Game area with language-specific background */}
      <div className={cn("relative flex-1 rounded-lg overflow-hidden", gameBackground)}>
        {isPlaying ? (
          <>
            {/* Falling words */}
            <div className="falling-words-container absolute inset-0">
              {fallingWords.map((word) => (
                <div
                  key={word.id}
                  className={cn(
                    "absolute font-bold transform -translate-x-1/2 transition-opacity duration-300",
                    word.color,
                    isPaused ? "animate-none" : ""
                  )}
                  style={{
                    left: `${word.x}%`,
                    top: `${word.y}%`,
                    // Apply font size based on word length - shorter words are bigger
                    fontSize: `${Math.max(22, 30 - word.word.length * 2)}px`,
                    // Add a subtle glow effect
                    textShadow: '0 0 5px currentColor',
                    opacity: isPaused ? 0.7 : 1
                  }}
                >
                  {word.word}
                </div>
              ))}
            </div>
            
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
                className="w-full max-w-md mx-auto px-4 py-2 border-2 border-primary/50 rounded-md bg-background/90 text-foreground text-center text-lg font-medium focus:border-primary focus:outline-none"
                placeholder="Type words and press Enter..."
                autoComplete="off"
                spellCheck="false"
              />
            </form>
            
            {/* Pause overlay */}
            {isPaused && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-20">
                <div className="text-center">
                  <h3 className="text-3xl font-bold mb-4">
                    {language === 'english' ? 'Game Paused' : 'Oyun Duraklatıldı'}
                  </h3>
                  <button
                    onClick={handleTogglePause}
                    className="px-6 py-2 bg-primary text-primary-foreground rounded-md"
                  >
                    {language === 'english' ? 'Resume' : 'Devam Et'}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {isGameOver ? (
              <div className="text-center">
                <h3 className="text-3xl font-bold mb-2">
                  {language === 'english' ? 'Game Over!' : 'Oyun Bitti!'}
                </h3>
                <p className="text-xl mb-6">
                  {language === 'english' ? 'Final Score: ' : 'Son Puan: '}{score}
                </p>
                <button
                  onClick={handleStartGame}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-md"
                >
                  {language === 'english' ? 'Play Again' : 'Tekrar Oyna'}
                </button>
              </div>
            ) : (
              <div className="text-center">
                <h3 className="text-3xl font-bold mb-2">
                  {language === 'english' ? 'Speed Typer' : 'Hızlı Yazma'}
                </h3>
                <p className="text-lg mb-3">
                  {language === 'english' 
                    ? 'Type the falling words before they reach the bottom!' 
                    : 'Düşen kelimeleri aşağıya ulaşmadan önce yaz!'}
                </p>
                
                <div className={cn(
                  "px-4 py-3 rounded-lg mb-6 inline-block",
                  language === 'english' 
                    ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                    : 'bg-red-100 text-red-800 border border-red-300'
                )}>
                  <p className="font-medium">
                    {language === 'english' 
                      ? 'Playing with English words' 
                      : 'Oynamak için Türkçe kelimeler'
                    }
                  </p>
                  <p className="text-sm mt-1 opacity-80">
                    {language === 'english'
                      ? 'Change language in settings below'
                      : 'Aşağıdaki ayarlardan dili değiştirin'
                    }
                  </p>
                </div>
                
                <button
                  onClick={handleStartGame}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-md"
                >
                  {language === 'english' ? 'Start Game' : 'Oyunu Başlat'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Game controls */}
      <div className="p-4 flex flex-col gap-3 bg-card rounded-b-lg border-t border-border">
        {/* Top row with menu and pause buttons */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <button 
              onClick={handleBackToMenu}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-transparent hover:bg-muted transition-colors"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">{language === 'english' ? 'Menu' : 'Menü'}</span>
            </button>
            
            {isPlaying && (
              <button
                onClick={handleTogglePause}
                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-muted hover:bg-muted transition-colors"
              >
                {isPaused ? (
                  <>
                    <PlayCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">{language === 'english' ? 'Resume' : 'Devam Et'}</span>
                  </>
                ) : (
                  <>
                    <PauseCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">{language === 'english' ? 'Pause' : 'Duraklat'}</span>
                  </>
                )}
              </button>
            )}
          </div>
          
          {/* Language selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{language === 'english' ? 'Language:' : 'Dil:'}</span>
            <div className="flex items-center border rounded-md overflow-hidden h-8">
              {(['english', 'türkçe'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => handleLanguageChange(lang)}
                  disabled={isPlaying && !isPaused}
                  className={`px-3 py-1 text-sm ${
                    lang === language
                      ? lang === 'english' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-red-500 text-white'
                      : 'bg-card hover:bg-muted'
                  } ${
                    (isPlaying && !isPaused)
                      ? 'opacity-50 cursor-not-allowed' 
                      : ''
                  }`}
                >
                  {lang.charAt(0).toUpperCase() + lang.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Bottom row with difficulty selector */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">{language === 'english' ? 'Difficulty:' : 'Zorluk:'}</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center border rounded-md overflow-hidden h-9">
              {(['easy', 'medium', 'hard'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => handleDifficultyChange(level)}
                  disabled={isPlaying && !isPaused}
                  className={`px-3 py-1 text-sm ${
                    level === difficulty
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-card hover:bg-muted'
                  } ${
                    (isPlaying && !isPaused)
                      ? 'opacity-50 cursor-not-allowed' 
                      : ''
                  }`}
                >
                  {language === 'english' 
                    ? level.charAt(0).toUpperCase() + level.slice(1)
                    : level === 'easy' ? 'Kolay' : level === 'medium' ? 'Orta' : 'Zor'
                  }
                </button>
              ))}
            </div>
            
            {difficulty === 'hard' && (
              <div className="hidden sm:flex items-center">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mr-1" />
                <span className="text-xs text-yellow-500">
                  {language === 'english' ? 'Words fall faster!' : 'Kelimeler daha hızlı düşer!'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimplifiedSpeedTyper;