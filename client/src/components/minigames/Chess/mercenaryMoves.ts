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

/** Lost Mercenary pawn ids — excluded from Death Note, etc. */
export const MERCENARY_LOST_ID = "mercenary-event-lost";

/** Mercenary Patrol knight ids */
export const MERCENARY_PATROL_ID = "mercenary-event-patrol";

/** Siege Patrol event — knight + rook */
export const MERCENARY_SIEGE_ID = "mercenary-event-siege";

/** Crusaders event — Q B N R */
export const MERCENARY_CRUSADE_ID = "mercenary-event-crusade";

/** True for orange mercenary pieces (Lost Mercenary event, future rentals). */
export function isMercenaryPiece(p: Piece | null): boolean {
  return (
    !!p &&
    p.color === "orange" &&
    typeof p.id === "string" &&
    p.id.includes(MERCENARY_ID_MARKER)
  );
}

/** Orange lost-mercenary pawn (Death Note cannot target). */
export function isLostMercenaryPawn(p: Piece | null): boolean {
  return (
    !!p &&
    p.type === "P" &&
    p.color === "orange" &&
    typeof p.id === "string" &&
    p.id.includes(MERCENARY_LOST_ID)
  );
}

/** Orange patrol knight(s) spawned by Mercenary Patrol event. */
export function isMercenaryPatrolKnight(p: Piece | null): boolean {
  return (
    !!p &&
    p.type === "N" &&
    p.color === "orange" &&
    typeof p.id === "string" &&
    p.id.includes(MERCENARY_PATROL_ID)
  );
}

export type MercenaryStepContext = {
  wallSquares: { row: number; col: number }[];
  frozenSquare: [number, number] | null;
  coldWindsSquares: [number, number][];
  coldWindsMovesLeft: number;
  blessedSquares: { row: number; col: number; movesLeft: number }[];
  /** Permanent winter squares — mercenaries cannot enter or pass through. */
  permaFrozenSquares?: { row: number; col: number }[];
};

function isPermaFrozen(ctx: MercenaryStepContext, r: number, c: number): boolean {
  return ctx.permaFrozenSquares?.some((s) => s.row === r && s.col === c) ?? false;
}

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

/** Find the Lost Mercenary pawn (orange P with lost-event id), if any. */
export function findLostMercenary(board: Board): [number, number] | null {
  const n = board.length;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const p = board[r][c];
      if (isLostMercenaryPawn(p)) return [r, c];
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
 * On the eastmost file with no capture, the mercenary leaves the board.
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
    if (isPermaFrozen(ctx, tr, tc)) continue;
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
  if (nc >= n) {
    nb[r][c] = null;
    return recomputeChessStatus(
      syncStateFromBoard({ ...state, enPassantTarget: null }, nb),
    );
  }
  if (isWall(ctx, r, nc)) return state;
  if (isPermaFrozen(ctx, r, nc)) return state;
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
  permaFrozenSquares: { row: number; col: number }[] = [],
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
    permaFrozenSquares,
  };
  for (const col of leftCols)
    for (let row = 0; row < n; row++) {
      if (
        !board[row][col] &&
        !isWall(wallCtx, row, col) &&
        !isPermaFrozen(wallCtx, row, col)
      )
        empties.push([row, col]);
    }

  if (empties.length === 0) return state;
  const [sr, sc] = empties[Math.floor(Math.random() * empties.length)]!;
  const nb = cloneBoard(board);
  const id = `${MERCENARY_LOST_ID}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  nb[sr][sc] = { type: "P", color: "orange", id };
  return recomputeChessStatus(syncStateFromBoard({ ...state, enPassantTarget: null }, nb));
}

const KNIGHT_OFFSETS: [number, number][] = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];

function shufflePositions(a: [number, number][]): [number, number][] {
  const copy = [...a];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function patrolKnightLegalDestinations(
  board: Board,
  r: number,
  c: number,
  ctx: MercenaryStepContext,
): [number, number][] {
  const n = board.length;
  const out: [number, number][] = [];
  for (const [dr, dc] of KNIGHT_OFFSETS) {
    const tr = r + dr,
      tc = c + dc;
    if (tr < 0 || tr >= n || tc < 0 || tc >= n) continue;
    if (isWall(ctx, tr, tc)) continue;
    if (isPermaFrozen(ctx, tr, tc)) continue;
    const occ = board[tr][tc];
    if (occ?.type === "M") continue;
    if (!occ) {
      out.push([tr, tc]);
      continue;
    }
    if (occ.color === "orange") continue;
    // Never move onto or capture any king (defense in depth).
    if (occ.type === "K") continue;
    if (isBlessedSquare(ctx, tr, tc)) continue;
    out.push([tr, tc]);
  }
  return out;
}

/** Orange mercenary combat pieces (not Lost Mercenary pawn). */
export function findNonLostOrangeMercenaryPositions(
  board: Board,
): [number, number][] {
  const n = board.length;
  const out: [number, number][] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const p = board[r][c];
      if (!p || p.color !== "orange") continue;
      if (typeof p.id !== "string" || !p.id.includes(MERCENARY_ID_MARKER))
        continue;
      if (isLostMercenaryPawn(p)) continue;
      if (p.type !== "N" && p.type !== "R" && p.type !== "B" && p.type !== "Q")
        continue;
      out.push([r, c]);
    }
  return out;
}

const ROOK_DIRS: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const BISHOP_DIRS: [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

function mercSliderDestinations(
  board: Board,
  r: number,
  c: number,
  ctx: MercenaryStepContext,
  mode: "rook" | "bishop" | "queen",
): [number, number][] {
  const dirs: [number, number][] =
    mode === "rook"
      ? ROOK_DIRS
      : mode === "bishop"
        ? BISHOP_DIRS
        : [...ROOK_DIRS, ...BISHOP_DIRS];
  const n = board.length;
  const out: [number, number][] = [];
  for (const [dr, dc] of dirs) {
    let tr = r + dr,
      tc = c + dc;
    while (tr >= 0 && tr < n && tc >= 0 && tc < n) {
      if (isWall(ctx, tr, tc)) break;
      if (isPermaFrozen(ctx, tr, tc)) break;
      const occ = board[tr][tc];
      if (occ?.type === "M") break;
      if (!occ) {
        out.push([tr, tc]);
        tr += dr;
        tc += dc;
        continue;
      }
      if (occ.color === "orange") break;
      if (occ.type === "K") break;
      if (isBlessedSquare(ctx, tr, tc)) break;
      out.push([tr, tc]);
      break;
    }
  }
  return out;
}

function mercenaryLegalDestinationsForPiece(
  board: Board,
  r: number,
  c: number,
  piece: Piece,
  ctx: MercenaryStepContext,
): [number, number][] {
  if (piece.type === "N") return patrolKnightLegalDestinations(board, r, c, ctx);
  if (piece.type === "R")
    return mercSliderDestinations(board, r, c, ctx, "rook");
  if (piece.type === "B")
    return mercSliderDestinations(board, r, c, ctx, "bishop");
  if (piece.type === "Q")
    return mercSliderDestinations(board, r, c, ctx, "queen");
  return [];
}

function applySingleOrangeMercRandomStep(
  st: ChessState,
  board: Board,
  r: number,
  c: number,
  ctx: MercenaryStepContext,
): ChessState {
  const piece = board[r][c];
  if (!piece || piece.color !== "orange") return st;
  if (typeof piece.id !== "string" || !piece.id.includes(MERCENARY_ID_MARKER))
    return st;
  if (isLostMercenaryPawn(piece)) return st;
  if (isMercenaryFrozen(ctx, r, c)) return st;
  const dests = mercenaryLegalDestinationsForPiece(board, r, c, piece, ctx);
  if (dests.length === 0) return st;
  const [tr, tc] = dests[Math.floor(Math.random() * dests.length)]!;
  const nb = cloneBoard(board);
  const merc = nb[r][c]!;
  const victim = nb[tr][tc];
  nb[r][c] = null;
  nb[tr][tc] = merc;
  const next: ChessState = { ...st, enPassantTarget: null };
  if (victim) {
    const cbw = [...st.capturedByWhite];
    const cbb = [...st.capturedByBlack];
    if (victim.color === "white") cbw.push(victim.type);
    else if (victim.color === "black") cbb.push(victim.type);
    return recomputeChessStatus(
      syncStateFromBoard({ ...next, capturedByWhite: cbw, capturedByBlack: cbb }, nb),
    );
  }
  return recomputeChessStatus(syncStateFromBoard(next, nb));
}

/**
 * After a full move (black just moved), each non-lost orange mercenary
 * (knight/rook/bishop/queen with mercenary id) makes at most one random legal step.
 */
export function applyMercenaryPatrolAfterFullMove(
  state: ChessState,
  ctx: MercenaryStepContext,
): ChessState {
  let st: ChessState = state;
  const positions = shufflePositions(
    findNonLostOrangeMercenaryPositions(getDerivedBoard(st)),
  );
  for (const [r, c] of positions) {
    const board = getDerivedBoard(st);
    const piece = board[r][c];
    if (!piece || piece.color !== "orange") continue;
    if (typeof piece.id !== "string" || !piece.id.includes(MERCENARY_ID_MARKER))
      continue;
    if (isLostMercenaryPawn(piece)) continue;
    if (isMercenaryFrozen(ctx, r, c)) continue;
    st = applySingleOrangeMercRandomStep(st, board, r, c, ctx);
  }
  return st;
}

/** @deprecated Prefer findNonLostOrangeMercenaryPositions for new code. */
export function findMercenaryPatrolKnights(board: Board): [number, number][] {
  const n = board.length;
  const out: [number, number][] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (isMercenaryPatrolKnight(board[r][c])) out.push([r, c]);
    }
  return out;
}

/**
 * Spawn two orange patrol knights: one on the left flank file, one on the right
 * (a-file / i-file on 10×10 with Domain Expansion padding). Skips a side if no
 * empty square in that column. Does not remove existing mercenaries — stacks
 * with repeated events.
 */
export function spawnMercenaryPatrolKnights(
  state: ChessState,
  wallSquares: { row: number; col: number }[] = [],
  permaFrozenSquares: { row: number; col: number }[] = [],
): ChessState {
  const board = getDerivedBoard(state);
  const n = board.length;
  const off = (n - 8) / 2;
  const leftCol = Math.max(0, Math.min(n - 1, off));
  const rightCol = Math.max(0, Math.min(n - 1, n - 1 - off));
  const nb = cloneBoard(board);
  const wallCtx: MercenaryStepContext = {
    wallSquares,
    frozenSquare: null,
    coldWindsSquares: [],
    coldWindsMovesLeft: 0,
    blessedSquares: [],
    permaFrozenSquares,
  };

  const pickRow = (b: Board, col: number): number | null => {
    const rows: number[] = [];
    for (let row = 0; row < n; row++) {
      if (
        !b[row][col] &&
        !isWall(wallCtx, row, col) &&
        !isPermaFrozen(wallCtx, row, col)
      )
        rows.push(row);
    }
    if (rows.length === 0) return null;
    return rows[Math.floor(Math.random() * rows.length)]!;
  };

  const ts = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const lr = pickRow(nb, leftCol);
  if (lr !== null) {
    nb[lr][leftCol] = {
      type: "N",
      color: "orange",
      id: `${MERCENARY_PATROL_ID}-${ts}-L`,
    };
  }
  const rr = pickRow(nb, rightCol);
  if (rr !== null && (leftCol !== rightCol || lr !== rr)) {
    nb[rr][rightCol] = {
      type: "N",
      color: "orange",
      id: `${MERCENARY_PATROL_ID}-${ts}-R`,
    };
  }

  return recomputeChessStatus(
    syncStateFromBoard({ ...state, enPassantTarget: null }, nb),
  );
}

/** Siege Patrol: orange mercenary knight (left file) + rook (right file). */
export function spawnMercenarySiegePatrol(
  state: ChessState,
  wallSquares: { row: number; col: number }[] = [],
  permaFrozenSquares: { row: number; col: number }[] = [],
): ChessState {
  const board = getDerivedBoard(state);
  const n = board.length;
  const off = (n - 8) / 2;
  const leftCol = Math.max(0, Math.min(n - 1, off));
  const rightCol = Math.max(0, Math.min(n - 1, n - 1 - off));
  const nb = cloneBoard(board);
  const wallCtx: MercenaryStepContext = {
    wallSquares,
    frozenSquare: null,
    coldWindsSquares: [],
    coldWindsMovesLeft: 0,
    blessedSquares: [],
    permaFrozenSquares,
  };
  const pickRow = (b: Board, col: number): number | null => {
    const rows: number[] = [];
    for (let row = 0; row < n; row++) {
      if (
        !b[row][col] &&
        !isWall(wallCtx, row, col) &&
        !isPermaFrozen(wallCtx, row, col)
      )
        rows.push(row);
    }
    if (rows.length === 0) return null;
    return rows[Math.floor(Math.random() * rows.length)]!;
  };
  const ts = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const lr = pickRow(nb, leftCol);
  if (lr !== null) {
    nb[lr][leftCol] = {
      type: "N",
      color: "orange",
      id: `${MERCENARY_SIEGE_ID}-${ts}-N`,
    };
  }
  const rr = pickRow(nb, rightCol);
  if (rr !== null && (leftCol !== rightCol || lr !== rr)) {
    nb[rr][rightCol] = {
      type: "R",
      color: "orange",
      id: `${MERCENARY_SIEGE_ID}-${ts}-R`,
    };
  }
  return recomputeChessStatus(
    syncStateFromBoard({ ...state, enPassantTarget: null }, nb),
  );
}

/** Crusaders: orange Q, B, N, R on random inner empty squares (best-effort). */
export function spawnMercenaryCrusaders(
  state: ChessState,
  wallSquares: { row: number; col: number }[] = [],
  permaFrozenSquares: { row: number; col: number }[] = [],
): ChessState {
  const board = getDerivedBoard(state);
  const n = board.length;
  const wallCtx: MercenaryStepContext = {
    wallSquares,
    frozenSquare: null,
    coldWindsSquares: [],
    coldWindsMovesLeft: 0,
    blessedSquares: [],
    permaFrozenSquares,
  };
  const innerEmpties = (): [number, number][] => {
    const out: [number, number][] = [];
    for (let r = 1; r < n - 1; r++)
      for (let c = 1; c < n - 1; c++) {
        if (board[r][c]) continue;
        if (isWall(wallCtx, r, c)) continue;
        if (isPermaFrozen(wallCtx, r, c)) continue;
        out.push([r, c]);
      }
    return shufflePositions(out);
  };
  const specs: { type: PieceType; suffix: string }[] = [
    { type: "Q", suffix: "Q" },
    { type: "B", suffix: "B" },
    { type: "N", suffix: "N" },
    { type: "R", suffix: "R" },
  ];
  const ts = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const slots = innerEmpties();
  if (slots.length < 4) return state;
  const chosen = slots.slice(0, 4);
  const nb = cloneBoard(board);
  for (let i = 0; i < 4; i++) {
    const [r, c] = chosen[i]!;
    const spec = specs[i]!;
    nb[r][c] = {
      type: spec.type,
      color: "orange",
      id: `${MERCENARY_CRUSADE_ID}-${ts}-${spec.suffix}`,
    };
  }
  return recomputeChessStatus(
    syncStateFromBoard({ ...state, enPassantTarget: null }, nb),
  );
}
