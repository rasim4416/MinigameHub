import { create } from "zustand";

export interface FallingWord {
  id: string;
  word: string;
  x: number;  // horizontal position (%)
  y: number;  // vertical position (%)
  speed: number; // falling speed
  color: string; // text color
}

interface SpeedTyperState {
  // Game state
  score: number;
  isGameOver: boolean;
  isPaused: boolean;
  timeLeft: number;
  inputValue: string;
  fallingWords: FallingWord[];
  
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

// Default initial state for the game
const initialState = {
  score: 0,
  isGameOver: false,
  isPaused: false,
  timeLeft: 60, // 60 seconds default game time
  inputValue: "",
  fallingWords: [],
  difficulty: 'medium' as const,
  maxGameTime: 60,
  wordBank: wordList
};

export const useSpeedTyper = create<SpeedTyperState>((set) => ({
  ...initialState,
  
  setScore: (score) => set({ score }),
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
  
  resetGame: () => set(() => ({
    ...initialState,
    fallingWords: []
  }))
}));