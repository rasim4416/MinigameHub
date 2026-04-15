import { create } from 'zustand';

interface LevelData {
  level: number;
  requiredScore: number;
}

export const levelThresholds: LevelData[] = [
  { level: 1,  requiredScore: 500  },
  { level: 2,  requiredScore: 1000 },
  { level: 3,  requiredScore: 1600 },
  { level: 4,  requiredScore: 2300 },
  { level: 5,  requiredScore: 3100 },
  { level: 6,  requiredScore: 4000 },
  { level: 7,  requiredScore: 5000 },
  { level: 8,  requiredScore: 6200 },
  { level: 9,  requiredScore: 7500 },
  { level: 10, requiredScore: 9000 },
];

interface LevelModeState {
  currentLevel: number;
  targetScore: number;
  score: number;
  isLevelCompleted: boolean;
  isLevelTransition: boolean;
  isPlaying: boolean;

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
  currentLevel: 1,
  targetScore: levelThresholds[0].requiredScore,
  score: 0,
  isLevelCompleted: false,
  isLevelTransition: false,
  isPlaying: false,

  setCurrentLevel: (level: number) => {
    const idx = Math.min(level - 1, levelThresholds.length - 1);
    set({ currentLevel: level, targetScore: levelThresholds[idx].requiredScore });
  },

  setScore: (score: number) => set({ score }),

  incrementScore: (points: number) => {
    const { score, targetScore, isLevelCompleted } = get();
    const newScore = score + points;
    const levelComplete = !isLevelCompleted && newScore >= targetScore;
    set({ score: newScore, isLevelCompleted: levelComplete });
  },

  setLevelCompleted: (completed: boolean) => set({ isLevelCompleted: completed }),

  setLevelTransition: (transitioning: boolean) => set({ isLevelTransition: transitioning }),

  setPlaying: (playing: boolean) => set({ isPlaying: playing }),

  advanceToNextLevel: () => {
    const { currentLevel } = get();
    const nextLevel = currentLevel + 1;
    if (nextLevel > levelThresholds.length) return;
    const idx = nextLevel - 1;
    set({
      currentLevel: nextLevel,
      targetScore: levelThresholds[idx].requiredScore,
      score: 0,
      isLevelCompleted: false,
      isLevelTransition: false,
    });
  },

  resetLevel: () => {
    const { currentLevel } = get();
    const idx = Math.min(currentLevel - 1, levelThresholds.length - 1);
    set({ score: 0, isLevelCompleted: false, isLevelTransition: false, targetScore: levelThresholds[idx].requiredScore });
  },

  resetGame: () => set({
    currentLevel: 1,
    targetScore: levelThresholds[0].requiredScore,
    score: 0,
    isLevelCompleted: false,
    isLevelTransition: false,
    isPlaying: false,
  }),
}));
