import { useEffect, useCallback, useState, useRef } from "react";

const GRID_SIZE = 11;

type CellState = "empty" | "red" | "blue" | "red-trail" | "blue-trail";
type Player = "red" | "blue";
type Direction = "up" | "down" | "left" | "right";
type GamePhase = "idle" | "playing" | "finished";

interface Position {
  row: number;
  col: number;
}

const INITIAL_RED: Position = { row: 0, col: 5 };
const INITIAL_BLUE: Position = { row: 10, col: 5 };

function buildInitialGrid(): CellState[][] {
  const grid: CellState[][] = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill("empty") as CellState[]
  );
  grid[INITIAL_RED.row][INITIAL_RED.col] = "red";
  grid[INITIAL_BLUE.row][INITIAL_BLUE.col] = "blue";
  return grid;
}

function movePos(pos: Position, dir: Direction): Position {
  switch (dir) {
    case "up":    return { row: pos.row - 1, col: pos.col };
    case "down":  return { row: pos.row + 1, col: pos.col };
    case "left":  return { row: pos.row, col: pos.col - 1 };
    case "right": return { row: pos.row, col: pos.col + 1 };
  }
}

function inBounds(pos: Position): boolean {
  return pos.row >= 0 && pos.row < GRID_SIZE && pos.col >= 0 && pos.col < GRID_SIZE;
}

function isBlocked(grid: CellState[][], pos: Position): boolean {
  const cell = grid[pos.row][pos.col];
  return cell === "red-trail" || cell === "blue-trail" || cell === "red" || cell === "blue";
}

function hasAnyMove(grid: CellState[][], pos: Position): boolean {
  const dirs: Direction[] = ["up", "down", "left", "right"];
  return dirs.some((d) => {
    const next = movePos(pos, d);
    return inBounds(next) && !isBlocked(grid, next);
  });
}

const KEY_MAP: Record<string, { player: Player; dir: Direction }> = {
  w: { player: "red", dir: "up" },
  s: { player: "red", dir: "down" },
  a: { player: "red", dir: "left" },
  d: { player: "red", dir: "right" },
  ArrowUp:    { player: "blue", dir: "up" },
  ArrowDown:  { player: "blue", dir: "down" },
  ArrowLeft:  { player: "blue", dir: "left" },
  ArrowRight: { player: "blue", dir: "right" },
};

export default function BarricadeGame() {
  const [grid, setGrid] = useState<CellState[][]>(buildInitialGrid);
  const [redPos, setRedPos] = useState<Position>(INITIAL_RED);
  const [bluePos, setBluePos] = useState<Position>(INITIAL_BLUE);
  const [turn, setTurn] = useState<Player>("red");
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [winner, setWinner] = useState<Player | null>(null);
  const [moveCount, setMoveCount] = useState(0);

  const gridRef = useRef(grid);
  const redRef = useRef(redPos);
  const blueRef = useRef(bluePos);
  const turnRef = useRef(turn);
  const phaseRef = useRef(phase);

  gridRef.current = grid;
  redRef.current = redPos;
  blueRef.current = bluePos;
  turnRef.current = turn;
  phaseRef.current = phase;

  const resetGame = useCallback(() => {
    const fresh = buildInitialGrid();
    setGrid(fresh);
    setRedPos(INITIAL_RED);
    setBluePos(INITIAL_BLUE);
    setTurn("red");
    setPhase("idle");
    setWinner(null);
    setMoveCount(0);
  }, []);

  const startGame = useCallback(() => {
    const fresh = buildInitialGrid();
    setGrid(fresh);
    setRedPos(INITIAL_RED);
    setBluePos(INITIAL_BLUE);
    setTurn("red");
    setPhase("playing");
    setWinner(null);
    setMoveCount(0);
  }, []);

  const applyMove = useCallback((player: Player, dir: Direction) => {
    if (phaseRef.current !== "playing") return;
    if (turnRef.current !== player) return;

    const currentPos = player === "red" ? redRef.current : blueRef.current;
    const next = movePos(currentPos, dir);

    if (!inBounds(next) || isBlocked(gridRef.current, next)) return;

    const newGrid = gridRef.current.map((row) => [...row]);
    newGrid[currentPos.row][currentPos.col] = `${player}-trail` as CellState;
    newGrid[next.row][next.col] = player as CellState;

    const winRow = player === "red" ? GRID_SIZE - 1 : 0;
    if (next.row === winRow) {
      setGrid(newGrid);
      if (player === "red") setRedPos(next); else setBluePos(next);
      setWinner(player);
      setPhase("finished");
      return;
    }

    const nextTurn: Player = player === "red" ? "blue" : "red";
    const nextOpponentPos = nextTurn === "red" ? redRef.current : blueRef.current;

    if (!hasAnyMove(newGrid, nextOpponentPos)) {
      setGrid(newGrid);
      if (player === "red") setRedPos(next); else setBluePos(next);
      setWinner(player);
      setPhase("finished");
      return;
    }

    setGrid(newGrid);
    if (player === "red") setRedPos(next); else setBluePos(next);
    setTurn(nextTurn);
    setMoveCount((c) => c + 1);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const binding = KEY_MAP[e.key];
      if (!binding) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
      }
      applyMove(binding.player, binding.dir);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [applyMove]);

  const getCellClass = (cell: CellState, row: number): string => {
    const goalTop = row === 0 ? "border-t-2 border-t-blue-500/50" : "";
    const goalBot = row === GRID_SIZE - 1 ? "border-b-2 border-b-red-500/50" : "";
    const base = `${goalTop} ${goalBot} border border-gray-700/40 flex items-center justify-center transition-colors duration-100`;

    switch (cell) {
      case "red":       return `${base} bg-red-600`;
      case "blue":      return `${base} bg-blue-600`;
      case "red-trail": return `${base} bg-red-900/70`;
      case "blue-trail":return `${base} bg-blue-900/70`;
      default:          return `${base} bg-gray-900/80`;
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-gray-950 text-white select-none">
      {/* Player turn banner */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 shrink-0">
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-all ${
          turn === "red" && phase === "playing"
            ? "border-red-500 bg-red-500/15"
            : "border-transparent"
        }`}>
          <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
          <span className="text-xs font-semibold text-red-400">Red — WASD</span>
          {turn === "red" && phase === "playing" && (
            <span className="text-[10px] font-bold text-red-300 animate-pulse ml-1">▶ YOUR TURN</span>
          )}
        </div>

        <span className="text-xs text-gray-500 font-mono">Move {moveCount}</span>

        <div className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-all ${
          turn === "blue" && phase === "playing"
            ? "border-blue-500 bg-blue-500/15"
            : "border-transparent"
        }`}>
          {turn === "blue" && phase === "playing" && (
            <span className="text-[10px] font-bold text-blue-300 animate-pulse mr-1">YOUR TURN ◀</span>
          )}
          <span className="text-xs font-semibold text-blue-400">Blue — ↑↓←→</span>
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
        </div>
      </div>

      {/* Goal label top */}
      <div className="text-center py-0.5 text-[10px] font-semibold text-blue-400 tracking-widest shrink-0">
        BLUE GOAL
      </div>

      {/* Grid — takes remaining space */}
      <div className="flex items-center justify-center flex-1 min-h-0 px-2">
        <div
          className="border border-gray-700 rounded overflow-hidden"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
            aspectRatio: "1 / 1",
            width: "min(100%, calc(100vh * 0.42))",
          }}
        >
          {grid.map((row, r) =>
            row.map((cell, c) => (
              <div key={`${r}-${c}`} className={getCellClass(cell, r)}>
                {(cell === "red" || cell === "blue") && (
                  <div className={`w-3/5 h-3/5 rounded-full shadow-lg ${
                    cell === "red" ? "bg-red-200" : "bg-blue-200"
                  }`} />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Goal label bottom */}
      <div className="text-center py-0.5 text-[10px] font-semibold text-red-400 tracking-widest shrink-0">
        RED GOAL
      </div>

      {/* Bottom panel */}
      <div className="shrink-0 flex items-center justify-center px-4 py-2 border-t border-gray-800">
        {phase === "idle" && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-gray-400 text-center">
              Reach the opposite end to win. Trails block movement — trap your opponent!
            </p>
            <button
              onClick={startGame}
              className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-all shadow"
            >
              Start Game
            </button>
          </div>
        )}

        {phase === "playing" && (
          <p className="text-xs text-gray-500 text-center">
            Red uses <kbd className="bg-gray-800 px-1 rounded">W A S D</kbd> · Blue uses <kbd className="bg-gray-800 px-1 rounded">↑ ↓ ← →</kbd>
          </p>
        )}

        {phase === "finished" && winner && (
          <div className="flex items-center gap-4">
            <div className={`text-sm font-bold ${winner === "red" ? "text-red-400" : "text-blue-400"}`}>
              {winner === "red" ? "🔴 Red wins!" : "🔵 Blue wins!"}
            </div>
            <button
              onClick={startGame}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-all"
            >
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
