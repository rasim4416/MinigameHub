import { materialAdvantage, type ChessState } from "../engine";
import type { BotMoveContext } from "./legalMoves";
import { evalForBlack } from "./evalPosition";

export type PositionAssessment = {
  materialCp: number;
  evalCp: number | null;
  scoreCp: number;
  isAttacking: boolean;
  isAdvantaged: boolean;
  isDisadvantaged: boolean;
};

export async function assessPosition(
  game: ChessState,
  ctx: BotMoveContext,
): Promise<PositionAssessment> {
  const adv = materialAdvantage(game);
  const materialCp = (adv.black - adv.white) * 100;
  const evalCp = await evalForBlack(game, ctx, "black");
  const scoreCp = materialCp + (evalCp ?? 0);
  return {
    materialCp,
    evalCp,
    scoreCp,
    isAttacking: scoreCp >= 0,
    isAdvantaged: scoreCp >= 100,
    isDisadvantaged: scoreCp <= -100,
  };
}
