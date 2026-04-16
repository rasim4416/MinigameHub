import { useState, useCallback, useEffect, useRef } from "react";

const G = 11;

type Player = "red" | "blue";
type Pos = { row: number; col: number };
type WallSpec = { type: "H" | "V"; r: number; c: number };
type Phase = "idle" | "playing" | "finished";
type ActionMode = "move" | "wall";

const mkHWalls = (): boolean[][] =>
  Array.from({ length: G - 1 }, () => Array(G).fill(false));
const mkVWalls = (): boolean[][] =>
  Array.from({ length: G }, () => Array(G - 1).fill(false));

function inBounds(p: Pos): boolean {
  return p.row >= 0 && p.row < G && p.col >= 0 && p.col < G;
}

function wallBetween(from: Pos, to: Pos, hW: boolean[][], vW: boolean[][]): boolean {
  const dr = to.row - from.row;
  const dc = to.col - from.col;
  if (dr === -1 && to.row >= 0 && to.row < G - 1) return hW[to.row][from.col];
  if (dr === 1  && from.row >= 0 && from.row < G - 1) return hW[from.row][from.col];
  if (dc === -1 && to.col >= 0 && to.col < G - 1) return vW[from.row][to.col];
  if (dc === 1  && from.col >= 0 && from.col < G - 1) return vW[from.row][from.col];
  return false;
}

function orthNeighbors(p: Pos): Pos[] {
  return [
    { row: p.row - 1, col: p.col },
    { row: p.row + 1, col: p.col },
    { row: p.row, col: p.col - 1 },
    { row: p.row, col: p.col + 1 },
  ].filter(inBounds);
}

function canStep(from: Pos, to: Pos, hW: boolean[][], vW: boolean[][]): boolean {
  return inBounds(to) && !wallBetween(from, to, hW, vW);
}

function bfsCanReach(start: Pos, goalRow: number, hW: boolean[][], vW: boolean[][]): boolean {
  const visited = new Set<string>();
  const queue: Pos[] = [start];
  visited.add(`${start.row},${start.col}`);
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.row === goalRow) return true;
    for (const nb of orthNeighbors(cur)) {
      const k = `${nb.row},${nb.col}`;
      if (!visited.has(k) && canStep(cur, nb, hW, vW)) {
        visited.add(k);
        queue.push(nb);
      }
    }
  }
  return false;
}

function getValidMoves(pos: Pos, opp: Pos, hW: boolean[][], vW: boolean[][]): Pos[] {
  const result: Pos[] = [];
  for (const nb of orthNeighbors(pos)) {
    if (!canStep(pos, nb, hW, vW)) continue;
    if (nb.row === opp.row && nb.col === opp.col) {
      const dr = nb.row - pos.row;
      const dc = nb.col - pos.col;
      const straight = { row: nb.row + dr, col: nb.col + dc };
      if (inBounds(straight) && canStep(nb, straight, hW, vW)) {
        result.push(straight);
      } else {
        for (const side of orthNeighbors(nb)) {
          if ((side.row === pos.row && side.col === pos.col)) continue;
          if (side.row === straight.row && side.col === straight.col) continue;
          if (canStep(nb, side, hW, vW)) result.push(side);
        }
      }
    } else {
      result.push(nb);
    }
  }
  return result;
}

function canPlaceWall(
  w: WallSpec,
  hW: boolean[][],
  vW: boolean[][],
  rP: Pos,
  bP: Pos
): boolean {
  const { type, r, c } = w;
  if (r < 0 || r > G - 2 || c < 0 || c > G - 2) return false;

  if (type === "H") {
    if (hW[r][c] || hW[r][c + 1]) return false;
    if (c < G - 1 && vW[r][c] && vW[r + 1][c]) return false;
    const nH = hW.map((row) => [...row]);
    nH[r][c] = true;
    nH[r][c + 1] = true;
    return bfsCanReach(rP, G - 1, nH, vW) && bfsCanReach(bP, 0, nH, vW);
  } else {
    if (vW[r][c] || vW[r + 1][c]) return false;
    if (r < G - 1 && hW[r][c] && hW[r][c + 1]) return false;
    const nV = vW.map((row) => [...row]);
    nV[r][c] = true;
    nV[r + 1][c] = true;
    return bfsCanReach(rP, G - 1, hW, nV) && bfsCanReach(bP, 0, hW, nV);
  }
}

function wallFromInterlaced(ri: number, ci: number): WallSpec | null {
  const isHGap = ri % 2 === 1 && ci % 2 === 0;
  const isVGap = ri % 2 === 0 && ci % 2 === 1;
  if (isHGap) {
    const r = (ri - 1) / 2;
    const c = Math.min(Math.floor(ci / 2), G - 2);
    if (r < 0 || r > G - 2) return null;
    return { type: "H", r, c };
  }
  if (isVGap) {
    const r = Math.min(Math.floor(ri / 2), G - 2);
    const c = (ci - 1) / 2;
    if (c < 0 || c > G - 2) return null;
    return { type: "V", r, c };
  }
  return null;
}

function isHWallAt(hW: boolean[][], r: number, c: number): boolean {
  return r >= 0 && r < G - 1 && c >= 0 && c < G && hW[r][c];
}
function isVWallAt(vW: boolean[][], r: number, c: number): boolean {
  return r >= 0 && r < G && c >= 0 && c < G - 1 && vW[r][c];
}

interface InterlacedCell {
  ri: number;
  ci: number;
  type: "cell" | "hgap" | "vgap" | "corner";
  r: number;
  c: number;
}

function buildInterlaced(): InterlacedCell[] {
  const cells: InterlacedCell[] = [];
  for (let ri = 0; ri < G * 2 - 1; ri++) {
    for (let ci = 0; ci < G * 2 - 1; ci++) {
      const ev = ri % 2 === 0;
      const ec = ci % 2 === 0;
      if (ev && ec)       cells.push({ ri, ci, type: "cell",   r: ri / 2, c: ci / 2 });
      else if (!ev && ec) cells.push({ ri, ci, type: "hgap",   r: (ri-1)/2, c: ci/2 });
      else if (ev && !ec) cells.push({ ri, ci, type: "vgap",   r: ri/2, c: (ci-1)/2 });
      else                cells.push({ ri, ci, type: "corner", r: (ri-1)/2, c: (ci-1)/2 });
    }
  }
  return cells;
}

const INTERLACED = buildInterlaced();

const posKey = (p: Pos) => `${p.row},${p.col}`;

function useWindowWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return width;
}

export default function BarricadeGame() {
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 640;

  // Responsive grid sizing: fit the grid within the available width
  const availableWidth = Math.min(windowWidth - 16, 400);
  const CELL = isMobile
    ? Math.max(18, Math.floor(availableWidth / (G + (G - 1) * 0.4)))
    : 28;
  const GAP = isMobile ? Math.max(8, Math.floor(CELL * 0.35)) : 5;

  const [phase, setPhase] = useState<Phase>("idle");
  const [redPos, setRedPos] = useState<Pos>({ row: 0, col: 5 });
  const [bluePos, setBluePos] = useState<Pos>({ row: 10, col: 5 });
  const [hWalls, setHWalls] = useState<boolean[][]>(mkHWalls);
  const [vWalls, setVWalls] = useState<boolean[][]>(mkVWalls);
  const [turn, setTurn] = useState<Player>("red");
  const [redWallsLeft, setRedWallsLeft] = useState(10);
  const [blueWallsLeft, setBlueWallsLeft] = useState(10);
  const [actionMode, setActionMode] = useState<ActionMode>("move");
  const [hoverWall, setHoverWall] = useState<WallSpec | null>(null);
  const [winner, setWinner] = useState<Player | null>(null);
  const [flashMsg, setFlashMsg] = useState<string>("");

  const stateRef = useRef({
    phase, redPos, bluePos, hWalls, vWalls, turn, actionMode
  });
  stateRef.current = { phase, redPos, bluePos, hWalls, vWalls, turn, actionMode };

  const flash = useCallback((msg: string) => {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(""), 2000);
  }, []);

  const startGame = useCallback(() => {
    setPhase("playing");
    setRedPos({ row: 0, col: 5 });
    setBluePos({ row: 10, col: 5 });
    setHWalls(mkHWalls());
    setVWalls(mkVWalls());
    setTurn("red");
    setRedWallsLeft(10);
    setBlueWallsLeft(10);
    setActionMode("move");
    setHoverWall(null);
    setWinner(null);
    setFlashMsg("");
  }, []);

  const doMove = useCallback((player: Player, target: Pos) => {
    const opp = player === "red" ? stateRef.current.bluePos : stateRef.current.redPos;
    const valid = getValidMoves(
      player === "red" ? stateRef.current.redPos : stateRef.current.bluePos,
      opp,
      stateRef.current.hWalls,
      stateRef.current.vWalls
    );
    if (!valid.some(v => v.row === target.row && v.col === target.col)) return;

    if (player === "red") {
      setRedPos(target);
      if (target.row === G - 1) { setWinner("red"); setPhase("finished"); return; }
    } else {
      setBluePos(target);
      if (target.row === 0) { setWinner("blue"); setPhase("finished"); return; }
    }
    setTurn(player === "red" ? "blue" : "red");
    setActionMode("move");
  }, []);

  const moveCurrentPlayer = useCallback((dr: number, dc: number) => {
    const { phase, turn, redPos, bluePos, hWalls, vWalls, actionMode } = stateRef.current;
    if (phase !== "playing" || actionMode !== "move") return;
    const pos = turn === "red" ? redPos : bluePos;
    const opp = turn === "red" ? bluePos : redPos;
    const target = { row: pos.row + dr, col: pos.col + dc };
    const valid = getValidMoves(pos, opp, hWalls, vWalls);
    if (valid.some(v => v.row === target.row && v.col === target.col)) {
      doMove(turn, target);
    }
  }, [doMove]);

  // Keyboard movement
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const { phase, turn, actionMode, redPos, bluePos, hWalls, vWalls } = stateRef.current;
      if (phase !== "playing" || actionMode !== "move") return;

      let player: Player | null = null;
      let dir: Pos | null = null;

      if (e.key === "w" || e.key === "W") { player = "red"; dir = { row: -1, col: 0 }; }
      if (e.key === "s" || e.key === "S") { player = "red"; dir = { row: 1, col: 0 }; }
      if (e.key === "a" || e.key === "A") { player = "red"; dir = { row: 0, col: -1 }; }
      if (e.key === "d" || e.key === "D") { player = "red"; dir = { row: 0, col: 1 }; }
      if (e.key === "ArrowUp")    { player = "blue"; dir = { row: -1, col: 0 }; e.preventDefault(); }
      if (e.key === "ArrowDown")  { player = "blue"; dir = { row: 1, col: 0 };  e.preventDefault(); }
      if (e.key === "ArrowLeft")  { player = "blue"; dir = { row: 0, col: -1 }; e.preventDefault(); }
      if (e.key === "ArrowRight") { player = "blue"; dir = { row: 0, col: 1 };  e.preventDefault(); }

      if (!player || !dir || player !== turn) return;

      const pos = player === "red" ? redPos : bluePos;
      const opp = player === "red" ? bluePos : redPos;
      const target = { row: pos.row + dir.row, col: pos.col + dir.col };
      const valid = getValidMoves(pos, opp, hWalls, vWalls);
      if (valid.some(v => v.row === target.row && v.col === target.col)) {
        doMove(player, target);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [doMove]);

  const handleGapHover = useCallback((ri: number, ci: number) => {
    if (phase !== "playing" || actionMode !== "wall") { setHoverWall(null); return; }
    const w = wallFromInterlaced(ri, ci);
    setHoverWall(w);
  }, [phase, actionMode]);

  const handleGapClick = useCallback((ri: number, ci: number) => {
    const { phase, turn, hWalls, vWalls, redPos, bluePos } = stateRef.current;
    if (phase !== "playing" || stateRef.current.actionMode !== "wall") return;

    const wallsLeft = turn === "red" ? redWallsLeft : blueWallsLeft;
    if (wallsLeft <= 0) { flash("No walls left!"); return; }

    const w = wallFromInterlaced(ri, ci);
    if (!w) return;

    if (!canPlaceWall(w, hWalls, vWalls, redPos, bluePos)) {
      flash("Invalid wall placement!");
      return;
    }

    if (w.type === "H") {
      setHWalls(prev => {
        const n = prev.map(r => [...r]);
        n[w.r][w.c] = true;
        n[w.r][w.c + 1] = true;
        return n;
      });
    } else {
      setVWalls(prev => {
        const n = prev.map(r => [...r]);
        n[w.r][w.c] = true;
        n[w.r + 1][w.c] = true;
        return n;
      });
    }

    if (turn === "red") setRedWallsLeft(p => p - 1);
    else setBlueWallsLeft(p => p - 1);

    setHoverWall(null);
    setTurn(turn === "red" ? "blue" : "red");
    setActionMode("move");
  }, [redWallsLeft, blueWallsLeft, flash]);

  const validMovesSet = (() => {
    if (phase !== "playing" || actionMode !== "move") return new Set<string>();
    const pos = turn === "red" ? redPos : bluePos;
    const opp = turn === "red" ? bluePos : redPos;
    return new Set(getValidMoves(pos, opp, hWalls, vWalls).map(posKey));
  })();

  const isHoverSeg = (type: "H" | "V", r: number, c: number): boolean => {
    if (!hoverWall) return false;
    if (hoverWall.type !== type) return false;
    if (type === "H") {
      return hoverWall.r === r && (hoverWall.c === c || hoverWall.c + 1 === c);
    } else {
      return hoverWall.c === c && (hoverWall.r === r || hoverWall.r + 1 === r);
    }
  };

  const isValidHoverWall = hoverWall
    ? canPlaceWall(hoverWall, hWalls, vWalls, redPos, bluePos)
    : false;

  const wallsLeft = turn === "red" ? redWallsLeft : blueWallsLeft;

  const cellBg = (r: number, c: number): string => {
    if (redPos.row === r && redPos.col === c) return "bg-red-600";
    if (bluePos.row === r && bluePos.col === c) return "bg-blue-600";
    if (validMovesSet.has(`${r},${c}`)) return "bg-indigo-500/30";
    if (r === 0) return "bg-blue-900/30";
    if (r === G - 1) return "bg-red-900/30";
    return "bg-gray-900";
  };

  const toggleWallMode = () => {
    if (phase !== "playing") return;
    if (wallsLeft <= 0) { flash("No walls left!"); return; }
    setActionMode(prev => prev === "wall" ? "move" : "wall");
    setHoverWall(null);
  };

  const gridWidth = G * CELL + (G - 1) * GAP;
  const pieceSize = Math.max(10, Math.floor(CELL * 0.55));

  return (
    <div className="flex flex-col w-full h-full bg-gray-950 text-white select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-800 shrink-0">
        <div className={`flex items-center gap-1 px-2 py-1 rounded border transition-all ${
          turn === "red" && phase === "playing"
            ? "border-red-500 bg-red-500/15" : "border-transparent"
        }`}>
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="text-xs font-semibold text-red-400">Red</span>
          <span className="text-xs text-red-300">({redWallsLeft}🧱)</span>
          {!isMobile && <span className="text-[10px] text-red-300/60 ml-0.5">WASD</span>}
          {turn === "red" && phase === "playing" && (
            <span className="text-[10px] font-bold text-red-300 animate-pulse ml-1">▶ TURN</span>
          )}
        </div>

        <div className={`flex items-center gap-1 px-2 py-1 rounded border transition-all ${
          turn === "blue" && phase === "playing"
            ? "border-blue-500 bg-blue-500/15" : "border-transparent"
        }`}>
          {turn === "blue" && phase === "playing" && (
            <span className="text-[10px] font-bold text-blue-300 animate-pulse mr-1">TURN ◀</span>
          )}
          <span className="text-xs text-blue-300">({blueWallsLeft}🧱)</span>
          {!isMobile && <span className="text-[10px] text-blue-300/60 mr-0.5">↑↓←→</span>}
          <span className="text-xs font-semibold text-blue-400">Blue</span>
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
        </div>
      </div>

      {/* Goal label top (blue) */}
      <div className="text-center py-0.5 text-[10px] font-semibold text-blue-400 tracking-widest shrink-0">
        BLUE GOAL
      </div>

      {/* Grid */}
      <div className="flex items-center justify-center flex-1 min-h-0 overflow-hidden">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: Array.from({ length: G * 2 - 1 }, (_, i) =>
              i % 2 === 0 ? `${CELL}px` : `${GAP}px`
            ).join(" "),
            gridTemplateRows: Array.from({ length: G * 2 - 1 }, (_, i) =>
              i % 2 === 0 ? `${CELL}px` : `${GAP}px`
            ).join(" "),
            width: gridWidth,
          }}
          onMouseLeave={() => setHoverWall(null)}
        >
          {INTERLACED.map(({ ri, ci, type, r, c }) => {
            const key = `${ri}-${ci}`;
            if (type === "cell") {
              const isRed = redPos.row === r && redPos.col === c;
              const isBlue = bluePos.row === r && bluePos.col === c;
              const isValidMove = validMovesSet.has(`${r},${c}`);
              return (
                <div
                  key={key}
                  className={`flex items-center justify-center transition-colors duration-75 ${cellBg(r, c)} ${
                    isValidMove && actionMode === "move" ? "cursor-pointer ring-1 ring-indigo-400/50" : ""
                  }`}
                  onClick={() => {
                    if (phase !== "playing" || actionMode !== "move") return;
                    if (!isValidMove) return;
                    doMove(turn, { row: r, col: c });
                  }}
                >
                  {(isRed || isBlue) && (
                    <div
                      className={`rounded-full shadow-lg ${isRed ? "bg-red-200" : "bg-blue-200"}`}
                      style={{ width: pieceSize, height: pieceSize }}
                    />
                  )}
                </div>
              );
            }
            if (type === "hgap") {
              const placed = isHWallAt(hWalls, r, c);
              const hovered = isHoverSeg("H", r, c);
              return (
                <div
                  key={key}
                  className={`transition-colors duration-75 ${
                    placed ? "bg-yellow-400" : hovered
                      ? (isValidHoverWall ? "bg-yellow-300/70" : "bg-red-500/60")
                      : actionMode === "wall" ? "bg-gray-600/40 cursor-pointer" : "bg-gray-700/20"
                  }`}
                  onMouseEnter={() => handleGapHover(ri, ci)}
                  onClick={() => handleGapClick(ri, ci)}
                />
              );
            }
            if (type === "vgap") {
              const placed = isVWallAt(vWalls, r, c);
              const hovered = isHoverSeg("V", r, c);
              return (
                <div
                  key={key}
                  className={`transition-colors duration-75 ${
                    placed ? "bg-yellow-400" : hovered
                      ? (isValidHoverWall ? "bg-yellow-300/70" : "bg-red-500/60")
                      : actionMode === "wall" ? "bg-gray-600/40 cursor-pointer" : "bg-gray-700/20"
                  }`}
                  onMouseEnter={() => handleGapHover(ri, ci)}
                  onClick={() => handleGapClick(ri, ci)}
                />
              );
            }
            return <div key={key} className="bg-gray-700/30" />;
          })}
        </div>
      </div>

      {/* Goal label bottom (red) */}
      <div className="text-center py-0.5 text-[10px] font-semibold text-red-400 tracking-widest shrink-0">
        RED GOAL
      </div>

      {/* Bottom panel */}
      <div className="shrink-0 flex flex-col items-center gap-2 px-4 py-2 border-t border-gray-800">
        {phase === "idle" && (
          <>
            <p className="text-xs text-gray-400 text-center">
              Reach the opposite goal. Place walls to slow your opponent — but never fully block them!
            </p>
            <button
              onClick={startGame}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-all shadow"
            >
              Start Game
            </button>
          </>
        )}

        {phase === "playing" && (
          <div className="flex flex-col items-center gap-2 w-full">
            {/* Action row */}
            <div className="flex items-center gap-3 justify-center">
              <button
                onClick={toggleWallMode}
                disabled={wallsLeft <= 0}
                className={`px-3 py-1.5 text-xs font-semibold rounded border transition-all active:scale-95 ${
                  actionMode === "wall"
                    ? "bg-yellow-500 text-black border-yellow-400"
                    : "bg-gray-800 text-gray-300 border-gray-600"
                } ${wallsLeft <= 0 ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
              >
                {actionMode === "wall" ? "🧱 Tap a gap" : "🧱 Place Wall"}
              </button>

              {actionMode === "wall" && (
                <button
                  onClick={() => { setActionMode("move"); setHoverWall(null); }}
                  className="px-3 py-1.5 text-xs font-semibold rounded border border-gray-600 bg-gray-800 text-gray-300 active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
              )}

              {flashMsg && (
                <span className="text-xs text-red-400 font-medium animate-pulse">{flashMsg}</span>
              )}
            </div>

            {/* Mobile D-pad */}
            {isMobile && actionMode === "move" && (
              <div className="flex flex-col items-center gap-1 mt-1">
                <p className="text-[10px] text-gray-500 mb-0.5">
                  {turn === "red" ? "🔴 Red — tap to move" : "🔵 Blue — tap to move"}
                </p>
                <div className="flex flex-col items-center gap-1">
                  <button
                    onTouchStart={(e) => { e.preventDefault(); moveCurrentPlayer(-1, 0); }}
                    onClick={() => moveCurrentPlayer(-1, 0)}
                    className={`w-12 h-12 rounded-lg text-lg font-bold flex items-center justify-center active:scale-90 transition-transform shadow ${
                      turn === "red" ? "bg-red-700/80 text-red-100" : "bg-blue-700/80 text-blue-100"
                    }`}
                  >▲</button>
                  <div className="flex gap-1">
                    <button
                      onTouchStart={(e) => { e.preventDefault(); moveCurrentPlayer(0, -1); }}
                      onClick={() => moveCurrentPlayer(0, -1)}
                      className={`w-12 h-12 rounded-lg text-lg font-bold flex items-center justify-center active:scale-90 transition-transform shadow ${
                        turn === "red" ? "bg-red-700/80 text-red-100" : "bg-blue-700/80 text-blue-100"
                      }`}
                    >◀</button>
                    <div className="w-12 h-12" />
                    <button
                      onTouchStart={(e) => { e.preventDefault(); moveCurrentPlayer(0, 1); }}
                      onClick={() => moveCurrentPlayer(0, 1)}
                      className={`w-12 h-12 rounded-lg text-lg font-bold flex items-center justify-center active:scale-90 transition-transform shadow ${
                        turn === "red" ? "bg-red-700/80 text-red-100" : "bg-blue-700/80 text-blue-100"
                      }`}
                    >▶</button>
                  </div>
                  <button
                    onTouchStart={(e) => { e.preventDefault(); moveCurrentPlayer(1, 0); }}
                    onClick={() => moveCurrentPlayer(1, 0)}
                    className={`w-12 h-12 rounded-lg text-lg font-bold flex items-center justify-center active:scale-90 transition-transform shadow ${
                      turn === "red" ? "bg-red-700/80 text-red-100" : "bg-blue-700/80 text-blue-100"
                    }`}
                  >▼</button>
                </div>
              </div>
            )}

            {!isMobile && actionMode === "move" && !flashMsg && (
              <span className="text-xs text-gray-500">
                {turn === "red"
                  ? "Red: WASD to move or click a valid cell"
                  : "Blue: ↑↓←→ to move or click a valid cell"}
              </span>
            )}
          </div>
        )}

        {phase === "finished" && winner && (
          <div className="flex items-center gap-4">
            <div className={`text-sm font-bold ${winner === "red" ? "text-red-400" : "text-blue-400"}`}>
              {winner === "red" ? "🔴 Red wins!" : "🔵 Blue wins!"}
            </div>
            <button
              onClick={startGame}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-all"
            >
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
