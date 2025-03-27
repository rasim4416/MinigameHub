import { create } from "zustand";

export interface FallingWord {
  id: string;
  word: string;
  x: number;  // horizontal position (%)
  y: number;  // vertical position (%)
  speed: number; // falling speed
  color: string; // text color
}

// Level data structure
export interface Level {
  number: number;
  spawnRate: number;  // spawn rate in seconds
  requiredPoints: number;  // points needed to advance to next level
}

// Game modes
export type GameMode = 'falling' | 'linear' | 'levels';

interface SpeedTyperState {
  // Game state
  score: number;
  isGameOver: boolean;
  isPaused: boolean;
  timeLeft: number;
  inputValue: string;
  fallingWords: FallingWord[];
  
  // Level mode state
  currentLevel: number;
  levels: Level[];
  targetScore: number;
  isLevelCompleted: boolean;
  isLevelTransition: boolean;
  
  // Game mode
  gameMode: GameMode;
  
  // Settings
  difficulty: 'easy' | 'medium' | 'hard';
  maxGameTime: number;
  
  // Word bank
  wordBank: string[];
  
  // Actions
  setScore: (score: number) => void;
  incrementScore: () => void;
  setGameOver: (isOver: boolean) => void;
  setPaused: (isPaused: boolean) => void;
  setTimeLeft: (time: number) => void;
  setInputValue: (value: string) => void;
  addFallingWord: (word: FallingWord) => void;
  removeFallingWord: (id: string) => void;
  updateFallingWordPosition: (id: string, y: number) => void;
  setFallingWords: (words: FallingWord[]) => void;
  setDifficulty: (difficulty: 'easy' | 'medium' | 'hard') => void;
  setGameMode: (mode: GameMode) => void;
  
  // Level mode actions
  setCurrentLevel: (level: number) => void;
  completeLevel: () => void;
  startNextLevel: () => void;
  setLevelTransition: (isTransitioning: boolean) => void;
  
  resetGame: () => void;
}

// Dictionary of 3-8 letter words for the game
const wordList = [
  // 3-letter words
  "act", "add", "age", "aim", "air", "all", "and", "ant", "any", "arm", "art", "ask", "bad", "bag", "bat", 
  "bed", "bee", "beg", "big", "bit", "box", "boy", "bug", "bus", "but", "buy", "can", "cap", "car", "cat", 
  "cow", "cry", "cup", "cut", "dad", "day", "dig", "dog", "dot", "dry", "ear", "eat", "egg", "end", "eye",
  
  // 4-letter words
  "able", "also", "area", "army", "away", "baby", "back", "ball", "bank", "base", "bear", "beat", "been", 
  "best", "bird", "blue", "boat", "body", "book", "born", "both", "call", "calm", "came", "card", "care", 
  "case", "cash", "city", "club", "coal", "coat", "cold", "come", "cook", "cool", "copy", "cost", "cute",
  
  // 5-letter words
  "about", "above", "actor", "adapt", "admit", "adopt", "after", "again", "agree", "ahead", "album", "allow",
  "alone", "along", "alter", "among", "anger", "angle", "angry", "ankle", "apart", "apple", "apply", "avoid",
  
  // 6-letter words
  "accept", "access", "across", "action", "active", "actual", "adjust", "admire", "advice", "advise", "affect",
  "afford", "afraid", "agency", "agenda", "agreed", "almost", "always", "amount", "animal", "annual", "answer",
  
  // 7-letter words
  "ability", "absence", "account", "achieve", "acquire", "address", "advance", "adverse", "advised", "adviser", 
  "against", "airline", "airport", "alcohol", "allergy", "allowed", "already", "amateur", "amazing", "amongst",
  
  // 8-letter words
  "absolute", "academic", "accepted", "accident", "accuracy", "accurate", "achieved", "acquired", "activity", 
  "actually", "addition", "adequate", "adjacent", "adjusted", "advanced", "advisory", "advocate", "affected", 
  "aircraft", "alliance"
];

// Define level data based on requirements
const levelData: Level[] = [
  { number: 1, spawnRate: 2.00, requiredPoints: 500 },
  { number: 2, spawnRate: 1.80, requiredPoints: 600 },
  { number: 3, spawnRate: 1.62, requiredPoints: 720 },
  { number: 4, spawnRate: 1.46, requiredPoints: 864 },
  { number: 5, spawnRate: 1.31, requiredPoints: 1037 },
  { number: 6, spawnRate: 1.18, requiredPoints: 1244 },
  { number: 7, spawnRate: 1.06, requiredPoints: 1493 },
  { number: 8, spawnRate: 0.95, requiredPoints: 1791 },
  { number: 9, spawnRate: 0.86, requiredPoints: 2149 },
  { number: 10, spawnRate: 0.77, requiredPoints: 2579 }
];

// Default initial state for the game
const initialState = {
  // Game state
  score: 0,
  isGameOver: false,
  isPaused: false,
  timeLeft: 60, // 60 seconds default game time
  inputValue: "",
  fallingWords: [],
  
  // Level mode state
  currentLevel: 1,
  levels: levelData,
  targetScore: levelData[0].requiredPoints,
  isLevelCompleted: false,
  isLevelTransition: false,
  
  // Game mode
  gameMode: 'falling' as GameMode,
  
  // Settings
  difficulty: 'medium' as const,
  maxGameTime: 60,
  
  // Word bank
  wordBank: wordList
};

export const useSpeedTyper = create<SpeedTyperState>((set, get) => ({
  ...initialState,
  
  setScore: (score) => set((state) => {
    const { gameMode, currentLevel, levels } = state;
    
    // Check if level target has been reached in level mode
    if (gameMode === 'levels' && 
        currentLevel <= levels.length && 
        score >= levels[currentLevel - 1].requiredPoints) {
      return {
        score,
        isLevelCompleted: true
      };
    }
    
    return { score };
  }),
  
  incrementScore: () => set((state) => ({ score: state.score + 1 })),
  
  setGameOver: (isOver) => set({ isGameOver: isOver }),
  setPaused: (isPaused) => set({ isPaused }),
  
  setTimeLeft: (time) => set({ timeLeft: time }),
  
  setInputValue: (value) => set({ inputValue: value }),
  
  addFallingWord: (word) => set((state) => ({ 
    fallingWords: [...state.fallingWords, word] 
  })),
  
  removeFallingWord: (id) => set((state) => ({ 
    fallingWords: state.fallingWords.filter(word => word.id !== id) 
  })),
  
  updateFallingWordPosition: (id, y) => set((state) => ({
    fallingWords: state.fallingWords.map(word => 
      word.id === id ? { ...word, y } : word
    )
  })),
  
  setFallingWords: (words) => set({ fallingWords: words }),
  
  setDifficulty: (difficulty) => set(() => {
    // Adjust max game time based on difficulty
    let maxGameTime = 60;
    switch (difficulty) {
      case 'easy':
        maxGameTime = 90;
        break;
      case 'medium':
        maxGameTime = 60;
        break;
      case 'hard':
        maxGameTime = 45;
        break;
    }
    
    return { 
      difficulty,
      maxGameTime,
      timeLeft: maxGameTime
    };
  }),
  
  setGameMode: (gameMode) => set(() => {
    // Reset time based on game mode
    let timeLeft = 60;
    
    if (gameMode === 'levels') {
      // Level mode starts with 60 seconds per level
      timeLeft = 60;
    }
    
    return { gameMode, timeLeft };
  }),
  
  // Level mode actions
  setCurrentLevel: (level) => set((state) => {
    const { levels } = state;
    const currentLevel = Math.min(Math.max(1, level), levels.length);
    const targetScore = levels[currentLevel - 1].requiredPoints;
    
    return {
      currentLevel,
      targetScore
    };
  }),
  
  completeLevel: () => set((state) => ({
    isLevelCompleted: true,
    isPaused: true,
    isLevelTransition: true,
    fallingWords: [] // Clear words on level completion
  })),
  
  startNextLevel: () => set((state) => {
    const { currentLevel, levels } = state;
    
    // Check if this was the final level
    if (currentLevel >= levels.length) {
      return {
        isGameOver: true,
        isPaused: false,
        isLevelCompleted: false,
        isLevelTransition: false
      };
    }
    
    // Move to next level
    const nextLevel = currentLevel + 1;
    const targetScore = levels[nextLevel - 1].requiredPoints;
    
    return {
      currentLevel: nextLevel,
      targetScore,
      timeLeft: 60, // Reset timer for next level
      isLevelCompleted: false,
      isLevelTransition: false,
      isPaused: false,
      fallingWords: [] // Start with clean board
    };
  }),
  
  setLevelTransition: (isTransitioning) => set({
    isLevelTransition: isTransitioning
  }),
  
  resetGame: () => set((state) => {
    const { gameMode } = state;
    
    const resetState = {
      score: 0,
      isGameOver: false,
      isPaused: false,
      inputValue: "",
      fallingWords: [],
      isLevelCompleted: false,
      isLevelTransition: false,
      // Keep the current game mode
      // Keep the current difficulty setting
      // Keep the current word bank
    };
    
    // Reset level-specific properties if in level mode
    if (gameMode === 'levels') {
      return {
        ...resetState,
        currentLevel: 1,
        targetScore: levelData[0].requiredPoints,
        timeLeft: 60
      };
    }
    
    // For other game modes
    return {
      ...resetState,
      timeLeft: state.maxGameTime
    };
  })
}));