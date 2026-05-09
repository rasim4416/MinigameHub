# Minigame Collection

A React-based minigame hub with a 4x4 grid menu. Each game is a self-contained component wired through a shared routing and store system.

## Architecture

- **Frontend**: React + TypeScript + Vite, Tailwind CSS, shadcn/ui
- **State**: Zustand stores per game
- **Routing**: React Router v6 at `/minigames` and `/minigames/:id`

## Key Files

| File | Purpose |
|------|---------|
| `client/src/lib/stores/useMinigames.tsx` | Central game registry (all 16 slots) |
| `client/src/components/minigames/GameArea.tsx` | Routes each game ID to its component |
| `client/src/pages/MinigamePage.tsx` | Page wrapper for individual games |
| `client/src/components/minigames/GameMenu.tsx` | 4x4 grid menu |

## Games

### Speed Typer (`speed-typer`) — COMPLETE
- Three modes: Falling Words, Linear Train, Level Mode
- Level Mode: 10 levels with score thresholds (500 → 9000)
- Language toggle: English / Türkçe
- Word spawn rate slider (0.25x – 3x, falling mode only)
- Time bonus on correct word in level mode
- Stores: `useSimplifiedGame`, `useLevelMode`
- Component: `client/src/components/minigames/SpeedTyper/SimplifiedSpeedTyper.tsx`

### Chess (`chess`) — COMPLETE (base game; roguelike augments planned for Phase 2)
- Full 2-player local chess engine (pure TypeScript, no libraries)
- All piece moves: King, Queen, Rook, Bishop, Knight, Pawn
- Special moves: castling (both sides), en passant, pawn promotion (dialog)
- Check / checkmate / stalemate detection
- Visual: classic chess.com-style board (#f0d9b5 / #b58863), Unicode pieces, selected/last-move/check highlights
- Captured pieces shown per player; material advantage indicator
- Engine file (`engine.ts`) is pure logic — ready for roguelike augment hooks in Phase 2
- Files: `client/src/components/minigames/Chess/ChessGame.tsx`, `client/src/components/minigames/Chess/engine.ts`

### Barricade (`barricade`) — IN PROGRESS
- Local 2-player game on an 11×11 grid
- Red player (top-center, WASD) vs Blue player (bottom-center, Arrow keys)
- Players leave permanent trails behind them
- Goal: reach the opponent's starting side
- Win condition: reach the opposite end row OR opponent has no valid moves
- Component: `client/src/components/minigames/Barricade/BarricadeGame.tsx`

## Adding a New Game

1. Update `useMinigames.tsx` — set `isAvailable: true` and update the description
2. Create a component at `client/src/components/minigames/<GameName>/<GameName>.tsx`
3. Add a `if (game.id === "<id>") return <YourComponent />;` block in `GameArea.tsx`
