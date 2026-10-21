import {
  getDerivedBoard,
  isSquareAttackedBy,
  PIECE_VALUE,
  type ChessState,
  type Piece,
} from "../engine";
import { applyMove, type Sq, type Side } from "./botRules";
import type { BotMove } from "./types";

export function value(p: Piece | null | undefined): number {
  if (!p || p.type === "M" || p.type === "K") return 0;
  return PIECE_VALUE[p.type] ?? 0;
}

const other = (s: Side): Side => (s === "white" ? "black" : "white");

/**
 * Cheapest material `side` must give up if it is forced to move the piece on
 * `from` (Puppet). Static: a destination attacked by the enemy costs the
 * piece when undefended, or roughly the trade-down when defended.
 */
export function forcedMoveLoss(game: ChessState, side: Side, moves: BotMove[]): number {
  if (moves.length === 0) return 0;
  const board = getDerivedBoard(game);
  let best = Infinity;
  for (const m of moves) {
    const mover = board[m.from[0]]?.[m.from[1]];
    if (!mover) continue;
    const gain = value(board[m.to[0]]?.[m.to[1]]);
    const after = applyMove(game, m, null);
    if (!after) continue;
    const [r, c] = m.to;
    let loss = 0;
    if (isSquareAttackedBy(after.state, r, c, other(side))) {
      const v = mover.type === "K" ? 0 : value(mover);
      const defended = isSquareAttackedBy(after.state, r, c, side);
      loss = defended ? Math.max(0, v - 3) : v;
    }
    best = Math.min(best, loss - gain);
    if (best <= 0) return 0;
  }
  return best === Infinity ? 0 : Math.max(0, best);
}

const QUEEN_DIRS: Sq[] = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/**
 * How much a pawn would hit if it moved like a queen (Little Big Man):
 * first enemy piece on each line, king counted as a check.
 */
export function queenLineScore(game: ChessState, sq: Sq, side: Side): number {
  const board = getDerivedBoard(game);
  const rows = board.length;
  const cols = board[0]?.length ?? rows;
  let score = 0;
  let reach = 0;
  for (const [dr, dc] of QUEEN_DIRS) {
    let r = sq[0] + dr;
    let c = sq[1] + dc;
    while (r >= 0 && r < rows && c >= 0 && c < cols) {
      const p = board[r][c];
      if (p) {
        if (p.color !== side && p.type !== "M") score += p.type === "K" ? 4 : value(p);
        break;
      }
      reach++;
      r += dr;
      c += dc;
    }
  }
  return score + reach * 0.15;
}

/** Pieces of `side` that are attacked and either undefended or worth more than a minor. */
export function hangingValue(game: ChessState, side: Side): number {
  const board = getDerivedBoard(game);
  let worst = 0;
  for (let r = 0; r < board.length; r++)
    for (let c = 0; c < (board[r]?.length ?? 0); c++) {
      const p = board[r][c];
      if (!p || p.color !== side || p.type === "K" || p.type === "M") continue;
      if (!isSquareAttackedBy(game, r, c, other(side))) continue;
      const defended = isSquareAttackedBy(game, r, c, side);
      const v = defended ? Math.max(0, value(p) - 3) : value(p);
      worst = Math.max(worst, v);
    }
  return worst;
}
