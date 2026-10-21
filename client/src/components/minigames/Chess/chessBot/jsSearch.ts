import {
  getDerivedBoard,
  getLegalMoves,
  isInCheck,
  makeMove,
  PIECE_VALUE,
  type ChessState,
  type Color,
} from "../engine";
import type { BotMove } from "./types";

export const MATE_CP = 10000;

/**
 * Built-in fallback when Stockfish can't take the position (non-8×8 boards,
 * Plot Armour checks, missing kings). Iterative-deepening alpha-beta over the
 * real engine rules with a capture-only quiescence search.
 */

const CENTER_BONUS = [0, 4, 8, 12, 12, 8, 4, 0];

function centrality(i: number, n: number): number {
  if (n === 8) return CENTER_BONUS[i] ?? 0;
  const mid = (n - 1) / 2;
  return Math.max(0, 12 - Math.abs(i - mid) * 3.5);
}

/** Static score from `side`'s point of view. */
export function staticEval(game: ChessState, side: Color): number {
  const board = getDerivedBoard(game);
  const rows = board.length;
  const cols = board[0]?.length ?? rows;
  let score = 0;
  let ownKing = false;
  let enemyKing = false;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = board[r][c];
      if (!p || p.type === "M") continue;
      const sign = p.color === side ? 1 : -1;
      if (p.type === "K") {
        if (sign > 0) ownKing = true;
        else enemyKing = true;
        continue;
      }
      let v = (PIECE_VALUE[p.type] ?? 0) * 100;
      if (p.type === "N" || p.type === "B") v += centrality(r, rows) + centrality(c, cols);
      if (p.type === "P") {
        const advance = p.color === "white" ? rows - 2 - r : r - 1;
        v += advance * 6 + centrality(c, cols) / 2;
      }
      score += sign * v;
    }
  }
  if (!ownKing) return -MATE_CP;
  if (!enemyKing) return MATE_CP;
  return score;
}

type Deadline = { at: number; hit: boolean };

function timeUp(d: Deadline): boolean {
  if (d.hit) return true;
  if (Date.now() >= d.at) d.hit = true;
  return d.hit;
}

function allMoves(game: ChessState, capturesOnly: boolean): BotMove[] {
  const board = getDerivedBoard(game);
  const side = game.turn;
  const rows = board.length;
  const out: BotMove[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < (board[r]?.length ?? 0); c++) {
      const p = board[r][c];
      if (!p || p.color !== side || p.type === "M") continue;
      for (const [tr, tc] of getLegalMoves(game, r, c)) {
        const victim = board[tr][tc];
        if (capturesOnly && !victim) continue;
        const promo = p.type === "P" && (tr === 0 || tr === rows - 1) ? "Q" : undefined;
        out.push({ from: [r, c], to: [tr, tc], promotion: promo });
      }
    }
  }
  return out;
}

function mvvLva(game: ChessState, moves: BotMove[]): BotMove[] {
  const board = getDerivedBoard(game);
  const score = (m: BotMove) => {
    const v = board[m.to[0]]?.[m.to[1]];
    const a = board[m.from[0]]?.[m.from[1]];
    const victim = v ? (PIECE_VALUE[v.type] ?? 0) * 10 : 0;
    const promo = m.promotion ? 80 : 0;
    return victim + promo - (a ? PIECE_VALUE[a.type] ?? 0 : 0);
  };
  return [...moves].sort((a, b) => score(b) - score(a));
}

function quiesce(game: ChessState, alpha: number, beta: number, qDepth: number, d: Deadline): number {
  const stand = staticEval(game, game.turn);
  if (Math.abs(stand) >= MATE_CP) return stand;
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  if (qDepth <= 0 || timeUp(d)) return alpha;
  for (const m of mvvLva(game, allMoves(game, true))) {
    let child: ChessState;
    try {
      child = makeMove(game, m.from, m.to, m.promotion);
    } catch {
      continue;
    }
    const score = -quiesce(child, -beta, -alpha, qDepth - 1, d);
    if (score >= beta) return score;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(
  game: ChessState,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  d: Deadline,
): number {
  if (depth <= 0) return quiesce(game, alpha, beta, 3, d);
  const moves = allMoves(game, false);
  if (moves.length === 0) {
    return isInCheck(game, game.turn) ? -(MATE_CP - ply * 10) : 0;
  }
  let best = -Infinity;
  for (const m of mvvLva(game, moves)) {
    if (timeUp(d)) break;
    let child: ChessState;
    try {
      child = makeMove(game, m.from, m.to, m.promotion);
    } catch {
      continue;
    }
    const score = -negamax(child, depth - 1, -beta, -alpha, ply + 1, d);
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best === -Infinity ? staticEval(game, game.turn) : best;
}

export type JsSearchResult = {
  /** Side-to-move POV. */
  cp: number;
  ranked: { move: BotMove; cp: number }[];
};

/**
 * Root moves come from the variant-aware generator; deeper plies use plain
 * engine rules (walls are already baked into `game` as blockers).
 */
export function jsSearch(
  game: ChessState,
  rootMoves: BotMove[],
  timeMs: number,
  maxDepth = 3,
): JsSearchResult {
  const d: Deadline = { at: Date.now() + timeMs, hit: false };
  let ranked = mvvLva(game, rootMoves).map((move) => ({ move, cp: -Infinity }));
  if (ranked.length === 0) {
    const cp = isInCheck(game, game.turn) ? -MATE_CP : 0;
    return { cp, ranked: [] };
  }
  for (let depth = 1; depth <= maxDepth; depth++) {
    const scored: { move: BotMove; cp: number }[] = [];
    let alpha = -Infinity;
    for (const { move } of ranked) {
      if (depth > 1 && timeUp(d)) break;
      let child: ChessState;
      try {
        child = makeMove(game, move.from, move.to, move.promotion);
      } catch {
        continue;
      }
      // Full window for the first few moves keeps MultiPV-style scores honest.
      const window = scored.length < 4 ? -Infinity : alpha;
      const cp = -negamax(child, depth - 1, -Infinity, -window, 1, d);
      scored.push({ move, cp });
      if (cp > alpha) alpha = cp;
    }
    if (scored.length === 0) break;
    if (depth > 1 && d.hit && scored.length < ranked.length) {
      // Partial iteration: trust it only for the moves it finished.
      const done = new Set(scored.map((s) => s.move));
      const rest = ranked.filter((r) => !done.has(r.move));
      ranked = [...scored.sort((a, b) => b.cp - a.cp), ...rest];
      break;
    }
    ranked = scored.sort((a, b) => b.cp - a.cp);
    if (d.hit) break;
  }
  const finite = ranked.filter((r) => Number.isFinite(r.cp));
  return { cp: finite[0]?.cp ?? staticEval(game, game.turn), ranked: finite };
}
