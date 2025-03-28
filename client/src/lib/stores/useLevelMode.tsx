import { create } from 'zustand';

interface LevelData {
  level: number;
  requiredScore: number;
}

export const levelThresholds: LevelData[] = [
  { level: 1, requiredScore: 500 },
  { level: 2, requiredScore: 1000 },
  { level: 3, requiredScore: 1600 },
  { level: 4, requiredScore: 2300 },
  { level: 5, requiredScore: 3100 },
  { level: 6, requiredScore: 4000 },
  { level: 7, requiredScore: 5000 },
  { level: 8, requiredScore: 6200 },
  { level: 9, requiredScore: 7500 },
  { level: 10, requiredScore: 9000 },
];

interface LevelModeState {
  // Game state
  currentLevel: number;
  targetScore: number;
  score: number;
  isLevelCompleted: boolean;
  isLevelTransition: boolean;
  isPlaying: boolean;
  
  // Actions
  setCurrentLevel: (level: number) => void;
  setScore: (score: number) => void;
  incrementScore: (points: number) => void;
  setLevelCompleted: (completed: boolean) => void;
  setLevelTransition: (transitioning: boolean) => void;
  setPlaying: (playing: boolean) => void;
  advanceToNextLevel: () => void;
  resetLevel: () => void;
  resetGame: () => void;
}

export const useLevelMode = create<LevelModeState>((set, get) => ({
  // Initial state
  currentLevel: 1,
  targetScore: levelThresholds[0].requiredScore,
  score: 0,
  isLevelCompleted: false,
  isLevelTransition: false,
  isPlaying: false,
  
  // Actions
  setCurrentLevel: (level: number) => {
    const levelIndex = Math.min(level - 1, levelThresholds.length - 1);
    const targetScore = levelThresholds[levelIndex].requiredScore;
    
    set({ 
      currentLevel: level,
      targetScore
    });
    
    console.log("Level mode data:", {
      currentLevel: level,
      targetScore,
      score: get().score,
      isLevelCompleted: get().isLevelCompleted,
      isLevelTransition: get().isLevelTransition,
      isPlaying: get().isPlaying
    });
  },
  
  setScore: (score: number) => set({ score }),
  
  incrementScore: (points: number) => {
    const { score, targetScore, isLevelCompleted } = get();
    const newScore = score + points;
    
    // Check if level is completed
    const levelComplete = !isLevelCompleted && newScore >= targetScore;
    
    set({ 
      score: newScore,
      isLevelCompleted: levelComplete
    });
    
    console.log("Level mode data:", {
      currentLevel: get().currentLevel,
      targetScore: get().targetScore,
      score: newScore,
      isLevelCompleted: levelComplete,
      isLevelTransition: get().isLevelTransition,
      isPlaying: get().isPlaying
    });
  },
  
  setLevelCompleted: (completed: boolean) => set({ isLevelCompleted: completed }),
  
  setLevelTransition: (transitioning: boolean) => set({ isLevelTransition: transitioning }),
  
  setPlaying: (playing: boolean) => {
    set({ isPlaying: playing });
    
    console.log("Level mode data:", {
      currentLevel: get().currentLevel,
      targetScore: get().targetScore,
      score: get().score,
      isLevelCompleted: get().isLevelCompleted,
      isLevelTransition: get().isLevelTransition,
      isPlaying: playing
    });
  },
  
  advanceToNextLevel: () => {
    const { currentLevel } = get();
    const nextLevel = currentLevel + 1;
    const isGameCompleted = nextLevel > levelThresholds.length;
    
    if (!isGameCompleted) {
      const levelIndex = Math.min(nextLevel - 1, levelThresholds.length - 1);
      const targetScore = levelThresholds[levelIndex].requiredScore;
      
      set({
        currentLevel: nextLevel,
        targetScore,
        score: 0,
        isLevelCompleted: false,
        isLevelTransition: false
      });
    }
  },
  
  resetLevel: () => {
    const { currentLevel } = get();
    const levelIndex = Math.min(currentLevel - 1, levelThresholds.length - 1);
    const targetScore = levelThresholds[levelIndex].requiredScore;
    
    set({
      score: 0,
      isLevelCompleted: false,
      isLevelTransition: false,
      targetScore
    });
  },
  
  resetGame: () => {
    set({
      currentLevel: 1,
      targetScore: levelThresholds[0].requiredScore,
      score: 0,
      isLevelCompleted: false,
      isLevelTransition: false,
      isPlaying: false
    });
  }
}));