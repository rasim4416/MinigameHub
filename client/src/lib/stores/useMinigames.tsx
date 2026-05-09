import { create } from "zustand";

export interface GameType {
  id: string;
  title: string;
  icon: string;
  description: string;
  isAvailable: boolean;
}

interface MinigamesState {
  games: GameType[];
}

// 16 game placeholders for the 4x4 grid
export const useMinigames = create<MinigamesState>(() => ({
  games: [
    {
      id: "speed-typer",
      title: "Speed Typer",
      icon: "⌨️",
      description: "Type falling words before they hit the bottom of the screen",
      isAvailable: true
    },
    {
      id: "barricade",
      title: "Barricade",
      icon: "🚧",
      description: "Local 2-player battle — reach the other side before your opponent blocks you",
      isAvailable: true
    },
    {
      id: "blackjack",
      title: "Blackjack",
      icon: "🃏",
      description: "Classic casino blackjack — wager your chips and beat the dealer",
      isAvailable: true
    },
    {
      id: "chess",
      title: "Chess",
      icon: "♟️",
      description: "Classic 2-player chess — roguelike augments coming soon",
      isAvailable: true
    },
    {
      id: "word-scramble",
      title: "Word Scramble",
      icon: "📝",
      description: "Unscramble words against the clock",
      isAvailable: false
    },
    {
      id: "reaction-test",
      title: "Reaction Test",
      icon: "⚡",
      description: "Test your reaction time",
      isAvailable: true
    },
    {
      id: "color-match",
      title: "Color Match",
      icon: "🎨",
      description: "Match colors before time runs out",
      isAvailable: false
    },
    {
      id: "simon-says",
      title: "Simon Says",
      icon: "👁️",
      description: "Remember and repeat the pattern",
      isAvailable: false
    },
    {
      id: "whack-a-mole",
      title: "Whack-a-Mole",
      icon: "🔨",
      description: "Tap the moles as they appear",
      isAvailable: false
    },
    {
      id: "puzzle-slide",
      title: "Puzzle Slide",
      icon: "🧩",
      description: "Slide tiles to solve the puzzle",
      isAvailable: false
    },
    {
      id: "shooting-gallery",
      title: "Shooting Gallery",
      icon: "🎯",
      description: "Shoot targets for points",
      isAvailable: false
    },
    {
      id: "snake-game",
      title: "Snake Game",
      icon: "🐍",
      description: "Grow your snake without hitting walls",
      isAvailable: false
    },
    {
      id: "balloon-pop",
      title: "Balloon Pop",
      icon: "🎈",
      description: "Pop balloons before they float away",
      isAvailable: false
    },
    {
      id: "maze-runner",
      title: "Maze Runner",
      icon: "🌀",
      description: "Find your way through the maze",
      isAvailable: false
    },
    {
      id: "brick-breaker",
      title: "Brick Breaker",
      icon: "🧱",
      description: "Break all bricks with a bouncing ball",
      isAvailable: false
    },
    {
      id: "flappy-bird",
      title: "Flappy Bird",
      icon: "🐦",
      description: "Navigate through obstacles",
      isAvailable: false
    },
    {
      id: "tic-tac-toe",
      title: "Tic Tac Toe",
      icon: "⭕",
      description: "Classic three-in-a-row game",
      isAvailable: false
    }
  ]
}));
