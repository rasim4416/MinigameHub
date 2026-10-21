import { getDerivedBoard, isInCheck, type ChessState } from "../engine";
import {
  OPENING_FULL_MOVES,
  OPENING_ROOT_MOVETIME_MS,
  ROOT_MOVETIME_MS,
  ROOT_MULTI_PV,
} from "./constants";
import { applyMove, legalMovesFor, rulesFromCtx, type RuleSet } from "./botRules";
import { probe, type ProbeResult } from "./probe";
import type { BotMove, BotSpellContext } from "./types";

export type RootAnalysis = {
  rules: RuleSet;
  legal: BotMove[];
  /** Legal moves handed to the engine (Internal Combustion checks removed). */
  searched: BotMove[];
  result: ProbeResult | null;
  multiPv: number;
};

/** Anything that can make the engine's #1 move wrong for this variant. */
export function augmentsInPlay(game: ChessState, ctx: BotSpellContext): boolean {
  const spellsOpen = ctx.augmentSpellBlockedFor !== "black";
  const ownSpells =
    spellsOpen &&
    (ctx.blackFreezeCharges > 0 ||
      ctx.blackBlessedWaterCharges > 0 ||
      ctx.puppetAvailable ||
      ctx.monolithPlaceAvailable ||
      (ctx.blackLittleBigManCharges ?? 0) > 0 ||
      (ctx.blackBloodbendingCharges ?? 0) > 0 ||
      (ctx.blackBloodbendingPlusCharges ?? 0) > 0 ||
      (ctx.blackNecroCharges ?? 0) > 0 ||
      (ctx.blackNecroPlusCharges ?? 0) > 0 ||
      (ctx.blackNecroPPCharges ?? 0) > 0);
  return (
    ownSpells ||
    enemyThreatsPresent(ctx) ||
    ctx.blessedSquares.length > 0 ||
    ctx.wallSquares.length > 0 ||
    (game.permaFrozenSquares?.length ?? 0) > 0 ||
    (ctx.blackDoomedPieceIds?.length ?? 0) > 0 ||
    getDerivedBoard(game).some((row) => row.some((p) => p?.type === "M"))
  );
}

export function enemyThreatsPresent(ctx: BotSpellContext): boolean {
  if (ctx.augmentSpellBlockedFor === "white") return false;
  return (
    (ctx.whiteFreezeCharges ?? 0) > 0 ||
    (ctx.whiteBlessedWaterCharges ?? 0) > 0 ||
    !!ctx.whitePuppetAvailable ||
    (ctx.whiteLittleBigManCharges ?? 0) > 0 ||
    (ctx.whiteBloodbendingPlusCharges ?? 0) > 0
  );
}

export function rootMovetime(game: ChessState, legalCount: number): number {
  if (legalCount <= 1) return 0;
  const opening = (game.fullMoveNumber ?? 1) <= OPENING_FULL_MOVES;
  return opening ? OPENING_ROOT_MOVETIME_MS : ROOT_MOVETIME_MS;
}

/**
 * Black's root search. Moves that give check into an unused enemy Internal
 * Combustion are pulled out (the checker just explodes) unless nothing else
 * is legal. Deterministic for a given position so callers share the cache.
 */
export async function analyseRoot(
  game: ChessState,
  ctx: BotSpellContext,
  opts: { legal?: BotMove[]; rules?: RuleSet } = {},
): Promise<RootAnalysis> {
  const rules = opts.rules ?? rulesFromCtx(ctx);
  const legal = opts.legal ?? legalMovesFor(game, "black", rules);
  let searched = legal;
  if (ctx.whiteIcAvailable && legal.length > 1) {
    const safe = legal.filter((m) => {
      const after = applyMove(game, m, null);
      return !after || !isInCheck(after.state, "white");
    });
    if (safe.length > 0) searched = safe;
  }
  const multiPv = augmentsInPlay(game, ctx) ? ROOT_MULTI_PV : 1;
  const movetimeMs = rootMovetime(game, searched.length);
  if (searched.length === 0) return { rules, legal, searched, result: null, multiPv };
  if (movetimeMs === 0) {
    return {
      rules,
      legal,
      searched,
      result: {
        cp: 0,
        best: searched[0]!,
        lines: [{ move: searched[0]!, cp: 0, pv: [] }],
        source: "terminal",
        depth: 0,
      },
      multiPv,
    };
  }
  const result = await probe(game, "black", rules, {
    moves: searched,
    multiPv,
    movetimeMs,
  });
  return { rules, legal, searched, result, multiPv };
}
