import {
  cloneBoard,
  getDerivedBoard,
  getLegalMoves,
  syncStateFromBoard,
  type ChessState,
  type Color,
  type PieceType,
} from "../engine";
import type { Augment, AugmentUpgradeLevels } from "../augments";
import { getImproveLevel } from "../augments";
import type { BotMove } from "./types";

export type BotMoveContext = {
  wallSquares: { row: number; col: number }[];
  blessedSquares: { row: number; col: number; movesLeft: number }[];
  coldWindsSquares: [number, number][];
  coldWindsMovesLeft: number;
  frozenSquare: [number, number] | null;
  activePuppetSquare: [number, number] | null;
  activePuppetColor: Color | null;
  blackAugments: Augment[];
  blackAugmentLevels: AugmentUpgradeLevels;
};

function getAlternativeMoves(
  game: ChessState,
  r: number,
  c: number,
): [number, number][] {
  const piece = getDerivedBoard(game)[r][c];
  const bs = getDerivedBoard(game).length;
  const off = (bs - 8) / 2;
  if (!piece || piece.type !== "P" || (c !== 0 && c !== bs - 1)) return [];
  if (piece.color === "white") {
    const sr = 6 + off;
    if (r !== sr) return [];
    if (
      getDerivedBoard(game)[sr - 1][c] ||
      getDerivedBoard(game)[sr - 2][c] ||
      getDerivedBoard(game)[sr - 3][c]
    )
      return [];
    return [[sr - 3, c]];
  }
  const sr = 1 + off;
  if (r !== sr) return [];
  if (
    getDerivedBoard(game)[sr + 1][c] ||
    getDerivedBoard(game)[sr + 2][c] ||
    getDerivedBoard(game)[sr + 3][c]
  )
    return [];
  return [[sr + 3, c]];
}

function getAlternativePlusMoves(
  game: ChessState,
  r: number,
  c: number,
): [number, number][] {
  const piece = getDerivedBoard(game)[r][c];
  const bs = getDerivedBoard(game).length;
  const off = (bs - 8) / 2;
  if (!piece || piece.type !== "P" || piece.color === "orange") return [];
  const dir = piece.color === "white" ? -1 : 1;
  const startRow = piece.color === "white" ? 6 + off : 1 + off;
  if (r !== startRow) return [];
  const out: [number, number][] = [];
  for (let step = 1; step <= 3; step++) {
    const tr = r + dir * step;
    if (tr < 0 || tr >= bs) break;
    if (getDerivedBoard(game)[tr][c]) break;
    out.push([tr, c]);
  }
  return out;
}

function buildGameForMoveGen(
  game: ChessState,
  ctx: BotMoveContext,
): ChessState {
  const db0 = getDerivedBoard(game);
  const perm = game.permaFrozenSquares ?? [];
  if (ctx.wallSquares.length === 0 && perm.length === 0) return game;

  return syncStateFromBoard(
    { ...game },
    db0.map((row2, ri) =>
      row2.map((sq, ci) => {
        if (ctx.wallSquares.some((w) => w.row === ri && w.col === ci))
          return { type: "M" as PieceType, color: "white" as Color };
        if (perm.some((p) => p.row === ri && p.col === ci))
          return { type: "M" as PieceType, color: "white" as Color };
        return sq;
      }),
    ),
  );
}

function isColdWindFrozen(
  ctx: BotMoveContext,
  row: number,
  col: number,
): boolean {
  return (
    ctx.coldWindsMovesLeft > 0 &&
    ctx.coldWindsSquares.some(([fr, fc]) => fr === row && fc === col)
  );
}

function computeMovesForSquare(
  game: ChessState,
  ctx: BotMoveContext,
  pr: number,
  pc: number,
): BotMove[] {
  if (isColdWindFrozen(ctx, pr, pc)) return [];

  if (
    ctx.frozenSquare &&
    ctx.frozenSquare[0] === pr &&
    ctx.frozenSquare[1] === pc
  ) {
    const p = getDerivedBoard(game)[pr][pc];
    if (p?.color === "black") return [];
  }

  const gameForMoves = buildGameForMoveGen(game, ctx);
  let moves = getLegalMoves(gameForMoves, pr, pc);
  const p = getDerivedBoard(game)[pr][pc];

  const hasAlternative = ctx.blackAugments.some((a) => a.id === "alternative");
  const hasAlternativePlus =
    ctx.blackAugments.some((a) => a.id === "alternative-plus") ||
    getImproveLevel(ctx.blackAugmentLevels, "alternative") >= 1;

  if (hasAlternative && p?.type === "P") {
    for (const [er, ec] of getAlternativeMoves(game, pr, pc)) {
      if (!moves.some(([mr, mc]) => mr === er && mc === ec)) moves.push([er, ec]);
    }
  }
  if (hasAlternativePlus && p?.type === "P") {
    for (const [er, ec] of getAlternativePlusMoves(game, pr, pc)) {
      if (!moves.some(([mr, mc]) => mr === er && mc === ec)) moves.push([er, ec]);
    }
  }

  moves = moves.filter(
    ([tr, tc]) =>
      !getDerivedBoard(game)[tr][tc] ||
      !ctx.blessedSquares.some((b) => b.row === tr && b.col === tc),
  );

  const bs = getDerivedBoard(game).length;
  const out: BotMove[] = [];
  for (const [tr, tc] of moves) {
    const promo =
      p?.type === "P" && p.color === "black" && tr === bs - 1
        ? ("Q" as PieceType)
        : undefined;
    out.push({ from: [pr, pc], to: [tr, tc], promotion: promo });
  }
  return out;
}

/** All legal moves for black — mirrors ChessGame computeMoves filters. */
export function enumerateLegalMoves(
  game: ChessState,
  ctx: BotMoveContext,
): BotMove[] {
  if (game.turn !== "black") return [];

  const board = getDerivedBoard(game);
  const rows = board.length;
  const cols = board[0]?.length ?? rows;
  const all: BotMove[] = [];

  if (
    ctx.activePuppetColor === "black" &&
    ctx.activePuppetSquare
  ) {
    return computeMovesForSquare(
      game,
      ctx,
      ctx.activePuppetSquare[0],
      ctx.activePuppetSquare[1],
    );
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = board[r][c];
      if (!p || p.color !== "black") continue;
      all.push(...computeMovesForSquare(game, ctx, r, c));
    }
  }

  return all;
}

export function buildBotMoveContext(input: {
  wallSquares: { row: number; col: number }[];
  blessedSquares: { row: number; col: number; movesLeft: number }[];
  coldWindsSquares: [number, number][];
  coldWindsMovesLeft: number;
  frozenSquare: [number, number] | null;
  activePuppetSquare: [number, number] | null;
  activePuppetColor: Color | null;
  blackAugments: Augment[];
  blackAugmentLevels: AugmentUpgradeLevels;
}): BotMoveContext {
  return { ...input };
}
