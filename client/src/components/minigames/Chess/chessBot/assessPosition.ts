import { materialAdvantage, type ChessState } from "../engine";
import type { BotMoveContext } from "./legalMoves";
import { moveOnlySpellContext } from "./pickBotMove";
import { probe } from "./probe";
import { analyseRoot } from "./rootAnalysis";
import { rulesFromCtx } from "./botRules";
import type { BotSpellContext } from "./types";

export type PositionAssessment = {
  materialCp: number;
  evalCp: number | null;
  /** Black POV. Engine eval already includes material, so it is not added twice. */
  scoreCp: number;
  isAttacking: boolean;
  isAdvantaged: boolean;
  isDisadvantaged: boolean;
};

function build(materialCp: number, evalCp: number | null): PositionAssessment {
  const scoreCp = Math.max(-3000, Math.min(3000, evalCp ?? materialCp));
  return {
    materialCp,
    evalCp,
    scoreCp,
    isAttacking: scoreCp >= 0,
    isAdvantaged: scoreCp >= 100,
    isDisadvantaged: scoreCp <= -100,
  };
}

/**
 * Black-POV evaluation for shop/auction decisions. On Black's turn it runs
 * exactly the root search the move decision will make, so the move after a
 * purchase is a cache hit instead of a second search.
 */
export async function assessPosition(
  game: ChessState,
  ctx: BotMoveContext | BotSpellContext,
): Promise<PositionAssessment> {
  const adv = materialAdvantage(game);
  const materialCp = (adv.black - adv.white) * 100;
  const spellCtx = moveOnlySpellContext(ctx);
  try {
    if (game.turn === "black") {
      const root = await analyseRoot(game, spellCtx);
      if (root.result && root.result.source !== "terminal") return build(materialCp, root.result.cp);
    }
    const stm = game.turn === "white" ? "white" : "black";
    const res = await probe(game, stm, rulesFromCtx(spellCtx));
    return build(materialCp, res.cp);
  } catch {
    return build(materialCp, null);
  }
}
