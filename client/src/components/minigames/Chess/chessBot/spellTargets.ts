import type { BotSpellContext } from "./types";
import type { ChessState } from "../engine";
import { getDerivedBoard, getLegalMoves } from "../engine";
import { isLostMercenaryPawn } from "../mercenaryMoves";

function isPermaFrostSquare(state: ChessState, r: number, c: number): boolean {
  return (
    state.permaFrozenSquares?.some((s) => s.row === r && s.col === c) ?? false
  );
}

export function enumerateFrostTargets(
  game: ChessState,
  _ctx: BotSpellContext,
): [number, number][] {
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
      void board[r][c];
      out.push([r, c]);
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
        p.type !== "M"
      ) {
        out.push([r, c]);
      }
    }
  }
  return out;
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
  return getLegalMoves(game, r, c).length > 0;
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
    default:
      return [];
  }
}
