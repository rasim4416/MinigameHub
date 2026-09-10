import type { BotSpellContext } from "./types";
import type { ChessState } from "../engine";
import { getDerivedBoard, getLegalMoves } from "../engine";
import { isLostMercenaryPawn } from "../mercenaryMoves";

function isPermaFrostSquare(state: ChessState, r: number, c: number): boolean {
  return (
    state.permaFrozenSquares?.some((s) => s.row === r && s.col === c) ?? false
  );
}

function legalMovesForPiece(
  game: ChessState,
  row: number,
  col: number,
): [number, number][] {
  const piece = getDerivedBoard(game)[row]?.[col];
  if (!piece || piece.color === "orange") return [];
  // Engine legal-move generation validates the side to move. Target spells
  // inspect enemy pieces while black is to move, so switch only the preview
  // turn rather than mistaking every enemy target for immobile.
  return getLegalMoves({ ...game, turn: piece.color }, row, col);
}

export function enumerateFrostTargets(
  game: ChessState,
  ctx: BotSpellContext,
): [number, number][] {
  // The game stores one active frost. Casting over it discards the remaining
  // duration of the first spell, which is never a charge-efficient choice.
  if (ctx.frozenSquare) return [];
  const board = getDerivedBoard(game);
  const out: [number, number][] = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < (board[r]?.length ?? 0); c++) {
      const p = board[r][c];
      if (p && p.color !== game.turn && p.type !== "K") {
        out.push([r, c]);
      }
    }
  }
  return out;
}

export function enumerateBlessedWaterTargets(
  game: ChessState,
  _ctx: BotSpellContext,
): [number, number][] {
  const board = getDerivedBoard(game);
  const out: [number, number][] = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < (board[r]?.length ?? 0); c++) {
      const p = board[r][c];
      // Blessing an empty/enemy square has no defensive value.  Re-blessing an
      // already protected piece also wastes one of the scarce charges.
      if (
        p?.color === "black" &&
        p.type !== "K" &&
        !_ctx.blessedSquares.some((s) => s.row === r && s.col === c)
      ) {
        out.push([r, c]);
      }
    }
  }
  return out;
}

export function enumerateMonolithTargets(
  game: ChessState,
  _ctx: BotSpellContext,
): [number, number][] {
  const board = getDerivedBoard(game);
  const out: [number, number][] = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < (board[r]?.length ?? 0); c++) {
      if (!board[r][c] && !isPermaFrostSquare(game, r, c)) {
        out.push([r, c]);
      }
    }
  }
  return out;
}

export function enumerateContractTargets(
  game: ChessState,
  _ctx: BotSpellContext,
): [number, number][] {
  const board = getDerivedBoard(game);
  const out: [number, number][] = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < (board[r]?.length ?? 0); c++) {
      const p = board[r][c];
      if (
        p &&
        p.color !== game.turn &&
        p.color !== "orange" &&
        p.type !== "K" &&
        p.type !== "P" &&
        p.type !== "M" &&
        p.id
      ) {
        out.push([r, c]);
      }
    }
  }
  return out;
}

export function enumeratePuppetTargets(
  game: ChessState,
  _ctx: BotSpellContext,
): [number, number][] {
  const board = getDerivedBoard(game);
  const out: [number, number][] = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < (board[r]?.length ?? 0); c++) {
      const p = board[r][c];
      if (
        p &&
        p.color !== game.turn &&
        p.color !== "orange" &&
        p.type !== "K" &&
        p.type !== "M" &&
        // A piece with no legal move would leave the opponent with an
        // impossible forced turn.  ChessGame cannot resolve that as a legal
        // puppet action, so never emit such a target.
        legalMovesForPiece(game, r, c).length > 0
      ) {
        out.push([r, c]);
      }
    }
  }
  return out;
}

function blackBackRank(game: ChessState): number {
  return (getDerivedBoard(game).length - 8) / 2;
}

/**
 * Necromancer returns a pawn to its original pawn rank and only to the file
 * where one was actually lost.  These are the same checks as ChessGame's
 * spell click handler, kept here so the bot never sends an ignored click.
 */
export function enumerateNecromancerTargets(
  game: ChessState,
  ctx: BotSpellContext,
): [number, number][] {
  if (
    (ctx.blackNecroCharges ?? 0) <= 0 ||
    !ctx.blackAugments.some((a) => a.id === "necromancer")
  )
    return [];
  const board = getDerivedBoard(game);
  const pawnRow = blackBackRank(game) + 1;
  return [...new Set(ctx.blackLostPawnCols ?? [])]
    .filter(
      (col) =>
        Number.isInteger(col) &&
        col >= 0 &&
        col < (board[pawnRow]?.length ?? 0) &&
        !board[pawnRow]?.[col],
    )
    .map((col) => [pawnRow, col] as [number, number]);
}

function enumerateBackRankRevivalTargets(
  game: ChessState,
  enabled: boolean,
): [number, number][] {
  if (!enabled) return [];
  const board = getDerivedBoard(game);
  const row = blackBackRank(game);
  const out: [number, number][] = [];
  for (let col = 0; col < (board[row]?.length ?? 0); col++) {
    if (!board[row]?.[col]) out.push([row, col]);
  }
  return out;
}

export function enumerateNecromancerPlusTargets(
  game: ChessState,
  ctx: BotSpellContext,
): [number, number][] {
  return enumerateBackRankRevivalTargets(
    game,
    (ctx.blackNecroPlusCharges ?? 0) > 0 &&
      (ctx.blackLostMinors ?? []).some((type) => type === "N" || type === "B") &&
      ctx.blackAugments.some((a) => a.id === "necromancer-plus"),
  );
}

export function enumerateNecromancerPlusPlusTargets(
  game: ChessState,
  ctx: BotSpellContext,
): [number, number][] {
  return enumerateBackRankRevivalTargets(
    game,
    (ctx.blackNecroPPCharges ?? 0) > 0 &&
      ctx.blackAugments.some((a) => a.id === "necromancer-plus-plus"),
  );
}

export function enumerateDeathNoteTargets(
  game: ChessState,
  _ctx: BotSpellContext,
): [number, number][] {
  const board = getDerivedBoard(game);
  const out: [number, number][] = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < (board[r]?.length ?? 0); c++) {
      const p = board[r][c];
      if (
        p &&
        p.color !== game.turn &&
        p.type !== "K" &&
        p.type !== "Q" &&
        p.type !== "M" &&
        p.id &&
        !isLostMercenaryPawn(p)
      ) {
        out.push([r, c]);
      }
    }
  }
  return out;
}

export function frostTargetHasLegalMoves(
  game: ChessState,
  target: [number, number],
): boolean {
  const [r, c] = target;
  return legalMovesForPiece(game, r, c).length > 0;
}

export function enumerateSpellTargets(
  spellId: string,
  game: ChessState,
  ctx: BotSpellContext,
): [number, number][] {
  switch (spellId) {
    case "frost":
      return enumerateFrostTargets(game, ctx);
    case "blessed-water-spell":
      return enumerateBlessedWaterTargets(game, ctx);
    case "impassable":
      return enumerateMonolithTargets(game, ctx);
    case "contract-killer":
      return enumerateContractTargets(game, ctx);
    case "puppet":
      return enumeratePuppetTargets(game, ctx);
    case "death-note":
      return enumerateDeathNoteTargets(game, ctx);
    case "necromancer":
      return enumerateNecromancerTargets(game, ctx);
    case "necromancer-plus":
      return enumerateNecromancerPlusTargets(game, ctx);
    case "necromancer-plus-plus":
      return enumerateNecromancerPlusPlusTargets(game, ctx);
    default:
      return [];
  }
}
