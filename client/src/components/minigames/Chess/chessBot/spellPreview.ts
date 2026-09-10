import {
  cloneBoard,
  getDerivedBoard,
  opp,
  syncStateFromBoard,
  type ChessState,
} from "../engine";
import { getBlessedWaterMovesLeft, getImproveLevel } from "../augments";
import type { BotSpellContext, SpellPreview } from "./types";

function isPermaFrostSquare(state: ChessState, r: number, c: number): boolean {
  return (
    state.permaFrozenSquares?.some((s) => s.row === r && s.col === c) ?? false
  );
}

export function previewFrost(
  game: ChessState,
  ctx: BotSpellContext,
  target: [number, number],
): SpellPreview {
  return {
    game: { ...game, turn: "black" },
    ctx: { ...ctx, frozenSquare: target },
    sideToMove: "black",
  };
}

export function previewBlessedWater(
  game: ChessState,
  ctx: BotSpellContext,
  target: [number, number],
): SpellPreview {
  const level = getImproveLevel(ctx.blackAugmentLevels, "blessed-water-spell");
  const movesLeft = getBlessedWaterMovesLeft(level);
  return {
    game: { ...game, turn: "black" },
    ctx: {
      ...ctx,
      blessedSquares: [
        ...ctx.blessedSquares,
        { row: target[0], col: target[1], movesLeft },
      ],
    },
    sideToMove: "black",
  };
}

export function previewMonolithPlace(
  game: ChessState,
  ctx: BotSpellContext,
  target: [number, number],
): SpellPreview {
  const [r, c] = target;
  const nb = cloneBoard(getDerivedBoard(game));
  nb[r][c] = { type: "M", color: "black" };
  const next = syncStateFromBoard(
    {
      ...game,
      turn: opp(game.turn),
      enPassantTarget: null,
    },
    nb,
  );
  return {
    game: next,
    ctx: {
      ...ctx,
      wallSquares: [...ctx.wallSquares, { row: r, col: c }],
    },
    sideToMove: "white",
  };
}

function revivalPieceType(
  spellId: string,
  ctx: BotSpellContext,
): "P" | "N" | "B" | "Q" | null {
  if (spellId === "necromancer") return "P";
  if (spellId === "necromancer-plus") {
    // ChessGame revives the most recently lost eligible minor for bot casts.
    // Mirror that deterministic selection in the preview rather than scoring
    // a bishop while the executor restores a knight.
    for (let i = (ctx.blackLostMinors?.length ?? 0) - 1; i >= 0; i--) {
      const type = ctx.blackLostMinors?.[i];
      if (type === "N" || type === "B") return type;
    }
    return null;
  }
  return spellId === "necromancer-plus-plus" ? "Q" : null;
}

/** Approximate a revival exactly as a new black piece on its legal target. */
export function previewRevival(
  spellId: string,
  game: ChessState,
  ctx: BotSpellContext,
  target: [number, number],
): SpellPreview | null {
  const type = revivalPieceType(spellId, ctx);
  const [r, c] = target;
  const board = getDerivedBoard(game);
  if (!type || board[r]?.[c]) return null;
  const next = syncStateFromBoard(
    { ...game, turn: opp(game.turn), enPassantTarget: null },
    board.map((row, rowIndex) =>
      row.map((piece, colIndex) =>
        rowIndex === r && colIndex === c
          ? { type, color: "black" as const }
          : piece,
      ),
    ),
  );
  return { game: next, ctx, sideToMove: "white" };
}

export function previewSpell(
  spellId: string,
  game: ChessState,
  ctx: BotSpellContext,
  target: [number, number],
): SpellPreview | null {
  if (isPermaFrostSquare(game, target[0], target[1]) && spellId === "impassable") {
    return null;
  }
  switch (spellId) {
    case "frost":
      return previewFrost(game, ctx, target);
    case "blessed-water-spell":
      return previewBlessedWater(game, ctx, target);
    case "impassable":
      return previewMonolithPlace(game, ctx, target);
    case "necromancer":
    case "necromancer-plus":
    case "necromancer-plus-plus":
      return previewRevival(spellId, game, ctx, target);
    default:
      return null;
  }
}

/** Frost preview: remove frozen white piece from board for SF approx. */
export function gameForFrostEval(preview: SpellPreview): ChessState {
  const [r, c] = preview.ctx.frozenSquare ?? [-1, -1];
  if (r < 0) return preview.game;
  const nb = cloneBoard(getDerivedBoard(preview.game));
  const p = nb[r][c];
  if (p && p.color === "white") nb[r][c] = null;
  return syncStateFromBoard({ ...preview.game, turn: "black" }, nb);
}

/** Monolith: block square in FEN by placing a black pawn for SF occupancy. */
export function gameForMonolithEval(preview: SpellPreview): ChessState {
  const wall = preview.ctx.wallSquares[preview.ctx.wallSquares.length - 1];
  if (!wall) return preview.game;
  const nb = cloneBoard(getDerivedBoard(preview.game));
  if (!nb[wall.row][wall.col]) {
    nb[wall.row][wall.col] = { type: "P", color: "black" };
  }
  return syncStateFromBoard(preview.game, nb);
}
