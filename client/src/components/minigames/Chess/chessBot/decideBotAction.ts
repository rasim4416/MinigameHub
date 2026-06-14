import type { ChessState } from "../engine";
import { pickBotMove } from "./pickBotMove";
import {
  evaluateFreeSpells,
  evaluateTurnSpellVsMove,
} from "./evaluateSpells";
import type { BotAction, BotSpellContext } from "./types";

export async function decideBotAction(
  game: ChessState,
  ctx: BotSpellContext,
): Promise<BotAction | null> {
  if (game.turn !== "black") return null;

  const freeSpell = await evaluateFreeSpells(game, ctx);
  if (freeSpell) {
    return {
      type: "castSpell",
      spellId: freeSpell.spellId,
      target: freeSpell.target,
    };
  }

  const turnSpell = await evaluateTurnSpellVsMove(game, ctx);
  if (turnSpell) {
    return {
      type: "castSpell",
      spellId: turnSpell.spellId,
      target: turnSpell.target,
    };
  }

  const move = await pickBotMove(game, ctx);
  if (!move) return null;
  return { type: "move", move };
}
