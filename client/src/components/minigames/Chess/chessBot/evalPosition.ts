import type { ChessState } from "../engine";
import type { BotMoveContext } from "./legalMoves";
import type { BotSpellContext } from "./types";
import { isStockfishEligible, toStockfishFen } from "./fen";
import { getEval } from "./stockfishEngine";

/** Centipawns from black's perspective. */
export function evalToBlackPov(
  sideToMove: "white" | "black",
  cp: number,
): number {
  return sideToMove === "black" ? cp : -cp;
}

export async function evalForBlack(
  game: ChessState,
  ctx: BotMoveContext,
  sideToMove: "white" | "black",
): Promise<number | null> {
  if (!isStockfishEligible(game)) return null;
  const fen = toStockfishFen({ ...game, turn: sideToMove }, sideToMove);
  void ctx;
  try {
    const cp = await getEval(fen);
    return evalToBlackPov(sideToMove, cp);
  } catch {
    // Stockfish is an optional optimiser. A worker/WASM failure must never
    // interrupt the bot turn; callers will use material or legal moves.
    return null;
  }
}

export async function evalBlackPovFromPreview(
  preview: { game: ChessState; sideToMove: "white" | "black" },
  ctx: BotSpellContext,
): Promise<number | null> {
  return evalForBlack(preview.game, ctx, preview.sideToMove);
}
