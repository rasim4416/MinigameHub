// ─────────────────────────────────────────────────────────────────────────────
// Mercenary units — move rules for third-party (orange) pieces on the board.
// IDs must include MERCENARY_ID_MARKER (e.g. "mercenary-event-lost-…") for
// filtering and future "rent a mercenary" features.
// ─────────────────────────────────────────────────────────────────────────────

import type { Board, ChessState, Piece, PieceType } from "./engine";
import {
  PIECE_VALUE,
  cloneBoard,
  getDerivedBoard,
  recomputeChessStatus,
  syncStateFromBoard,
} from "./engine";

export const MERCENARY_ID_MARKER = "mercenary";

/** True for orange mercenary pieces (Lost Mercenary event, future rentals). */
export function isMercenaryPiece(p: Piece | null): boolean {
  return (
    !!p &&
    p.color === "orange" &&
    typeof p.id === "string" &&
    p.id.includes(MERCENARY_ID_MARKER)
  );
}

export type MercenaryStepContext = {
  wallSquares: { row: number; col: number }[];
  frozenSquare: [number, number] | null;
  coldWindsSquares: [number, number][];
  coldWindsMovesLeft: number;
  blessedSquares: { row: number; col: number; movesLeft: number }[];
};

function isWall(ctx: MercenaryStepContext, r: number, c: number): boolean {
  return ctx.wallSquares.some((w) => w.row === r && w.col === c);
}

function isBlessedSquare(
  ctx: MercenaryStepContext,
  r: number,
  c: number,
): boolean {
  return ctx.blessedSquares.some((b) => b.row === r && b.col === c);
}

function isMercenaryFrozen(
  ctx: MercenaryStepContext,
  r: number,
  c: number,
): boolean {
  if (ctx.frozenSquare?.[0] === r && ctx.frozenSquare?.[1] === c) return true;
  if (
    ctx.coldWindsMovesLeft > 0 &&
    ctx.coldWindsSquares.some(([fr, fc]) => fr === r && fc === c)
  )
    return true;
  return false;
}

/** Board squares this Lost Mercenary pawn attacks (east-forward diagonals). */
export function lostMercenaryAttackOffsets(): [number, number][] {
  return [
    [-1, 1],
    [1, 1],
  ];
}

/** Find the Lost Mercenary pawn (orange P with mercenary id), if any. */
export function findLostMercenary(board: Board): [number, number] | null {
  const n = board.length;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const p = board[r][c];
      if (isMercenaryPiece(p) && p!.type === "P") return [r, c];
    }
  return null;
}

function victimCapturable(
  victim: Piece | null,
): victim is Piece & { type: Exclude<PieceType, "K" | "M"> } {
  if (!victim) return false;
  if (victim.color === "orange") return false;
  if (victim.type === "K" || victim.type === "M") return false;
  return true;
}

/** Q > R > N > B > P for Lost Mercenary capture preference. */
function mercenaryTargetRank(t: PieceType): number {
  if (t === "Q") return 6;
  if (t === "R") return 5;
  if (t === "N") return 4;
  if (t === "B") return 3;
  if (t === "P") return 2;
  return 0;
}

/**
 * After a full move (black just moved), advance the Lost Mercenary:
 * prefer capturing on sight (Q>R>N>B>P), else step one file east if clear.
 */
export function applyLostMercenaryAfterFullMove(
  state: ChessState,
  ctx: MercenaryStepContext,
): ChessState {
  const board = getDerivedBoard(state);
  const pos = findLostMercenary(board);
  if (!pos) return state;

  const [r, c] = pos;
  if (isMercenaryFrozen(ctx, r, c)) return state;

  const n = board.length;
  const candidates: { tr: number; tc: number; victim: Piece }[] = [];
  for (const [dr, dc] of lostMercenaryAttackOffsets()) {
    const tr = r + dr,
      tc = c + dc;
    if (tr < 0 || tr >= n || tc < 0 || tc >= n) continue;
    if (isWall(ctx, tr, tc)) continue;
    const victim = board[tr][tc];
    if (!victimCapturable(victim)) continue;
    if (isBlessedSquare(ctx, tr, tc)) continue;
    candidates.push({ tr, tc, victim });
  }

  let chosen: { tr: number; tc: number; victim: Piece } | null = null;
  for (const cand of candidates) {
    if (!chosen) {
      chosen = cand;
      continue;
    }
    const rank0 = mercenaryTargetRank(cand.victim.type);
    const rank1 = mercenaryTargetRank(chosen.victim.type);
    if (rank0 > rank1) chosen = cand;
    else if (rank0 === rank1) {
      const v0 = PIECE_VALUE[cand.victim.type];
      const v1 = PIECE_VALUE[chosen.victim.type];
      if (v0 > v1) chosen = cand;
      else if (v0 === v1) {
        if (cand.tr < chosen.tr || (cand.tr === chosen.tr && cand.tc < chosen.tc))
          chosen = cand;
      }
    }
  }

  const nb = cloneBoard(board);
  if (chosen) {
    const merc = nb[r][c]!;
    nb[r][c] = null;
    nb[chosen.tr][chosen.tc] = merc;
    const cbw = [...state.capturedByWhite];
    const cbb = [...state.capturedByBlack];
    if (chosen.victim.color === "white") cbw.push(chosen.victim.type);
    else cbb.push(chosen.victim.type);
    const next: ChessState = {
      ...state,
      capturedByWhite: cbw,
      capturedByBlack: cbb,
      enPassantTarget: null,
    };
    return recomputeChessStatus(syncStateFromBoard(next, nb));
  }

  const nc = c + 1;
  if (nc >= n) return state;
  if (isWall(ctx, r, nc)) return state;
  if (board[r][nc]?.type === "M") return state;
  if (board[r][nc]) return state;

  const merc = nb[r][c]!;
  nb[r][c] = null;
  nb[r][nc] = merc;
  return recomputeChessStatus(
    syncStateFromBoard({ ...state, enPassantTarget: null }, nb),
  );
}

/** Spawn Lost Mercenary on a random empty square on the left files (a–b lane). */
export function spawnLostMercenaryOnBoard(
  state: ChessState,
  wallSquares: { row: number; col: number }[] = [],
): ChessState {
  const board = getDerivedBoard(state);
  if (findLostMercenary(board)) return state;

  const n = board.length;
  const off = (n - 8) / 2;
  const leftCols = [off, off + 1].filter((col) => col >= 0 && col < n);
  const empties: [number, number][] = [];
  const wallCtx: MercenaryStepContext = {
    wallSquares,
    frozenSquare: null,
    coldWindsSquares: [],
    coldWindsMovesLeft: 0,
    blessedSquares: [],
  };
  for (const col of leftCols)
    for (let row = 0; row < n; row++) {
      if (!board[row][col] && !isWall(wallCtx, row, col)) empties.push([row, col]);
    }

  if (empties.length === 0) return state;
  const [sr, sc] = empties[Math.floor(Math.random() * empties.length)]!;
  const nb = cloneBoard(board);
  const id = `mercenary-event-lost-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  nb[sr][sc] = { type: "P", color: "orange", id };
  return recomputeChessStatus(syncStateFromBoard({ ...state, enPassantTarget: null }, nb));
}
