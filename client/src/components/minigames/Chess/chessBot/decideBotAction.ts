import type { ChessState } from "../engine";
import { pickBotMove } from "./pickBotMove";
import type { BotMove } from "./types";
import {
  evaluateFreeSpells,
  evaluateTurnSpellVsMove,
} from "./evaluateSpells";
import {
  contractCaptureMove,
  pickDeathNoteTarget,
  pickPuppetTarget,
} from "./evaluateMarkingSpells";
import { assessPosition } from "./assessPosition";
import type { BotAction, BotSpellContext } from "./types";

export async function decideBotAction(
  game: ChessState,
  ctx: BotSpellContext,
): Promise<BotAction | null> {
  if (game.turn !== "black") return null;

  const position = await assessPosition(game, ctx);

  const deathTarget = pickDeathNoteTarget(game, ctx);
  if (deathTarget) {
    return {
      type: "castSpell",
      spellId: "death-note",
      target: deathTarget,
    };
  }

  const freeSpell = await evaluateFreeSpells(game, ctx);
  if (freeSpell) {
    return {
      type: "castSpell",
      spellId: freeSpell.spellId,
      target: freeSpell.target,
    };
  }

  const puppetTarget = pickPuppetTarget(game, ctx, position);
  if (puppetTarget) {
    return {
      type: "castSpell",
      spellId: "puppet",
      target: puppetTarget,
    };
  }

  const bestMove = await pickBotMove(game, ctx);
  if (!bestMove) return null;

  const contract = contractCaptureMove(game, ctx, bestMove);
  if (contract) {
    return {
      type: "castSpellThenMove",
      spellId: "contract-killer",
      target: contract.target,
      move: contract.move,
    };
  }

  const turnSpell = await evaluateTurnSpellVsMove(game, ctx, bestMove);
  if (turnSpell) {
    return {
      type: "castSpell",
      spellId: turnSpell.spellId,
      target: turnSpell.target,
    };
  }

  return { type: "move", move: bestMove };
}
