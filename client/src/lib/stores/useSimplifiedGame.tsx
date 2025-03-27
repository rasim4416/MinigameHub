import { create } from 'zustand';

interface SimplifiedGameState {
  score: number;
  timeLeft: number;
  isGameOver: boolean;
  isPaused: boolean;
  
  // Actions
  setScore: (score: number) => void;
  setTimeLeft: (time: number) => void;
  setGameOver: (isOver: boolean) => void;
  setPaused: (isPaused: boolean) => void;
  reset: () => void;
}

export const useSimplifiedGame = create<SimplifiedGameState>((set) => ({
  score: 0,
  timeLeft: 60,
  isGameOver: false,
  isPaused: false,
  
  setScore: (score) => set({ score }),
  setTimeLeft: (timeLeft) => set({ timeLeft }),
  setGameOver: (isGameOver) => set({ isGameOver }),
  setPaused: (isPaused) => set({ isPaused }),
  
  reset: () => set({
    score: 0,
    timeLeft: 60,
    isGameOver: false,
    isPaused: false
  })
}));