import type { ChessState } from "../engine";
import type { BotMoveContext } from "./legalMoves";
import { analyseRoot } from "./rootAnalysis";
import type { BotMove, BotSpellContext } from "./types";

/** A spell context with every spell unavailable — plain move selection. */
export function moveOnlySpellContext(ctx: BotMoveContext | BotSpellContext): BotSpellContext {
  if ("blackFreezeCharges" in ctx) return ctx;
  return {
    ...ctx,
    blackFreezeCharges: 0,
    blackBlessedWaterCharges: 0,
    augmentSpellBlockedFor: null,
    monolithPlaceAvailable: false,
    contractAvailable: false,
    blackContractPieceId: null,
    puppetAvailable: false,
    deathNoteAvailable: false,
  };
}

export async function pickBotMove(
  game: ChessState,
  ctx: BotMoveContext | BotSpellContext,
): Promise<BotMove | null> {
  if (game.turn !== "black") return null;
  const root = await analyseRoot(game, moveOnlySpellContext(ctx));
  return root.result?.best ?? root.searched[0] ?? root.legal[0] ?? null;
}
