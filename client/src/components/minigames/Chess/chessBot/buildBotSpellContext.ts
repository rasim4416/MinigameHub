import type { BotMoveContext } from "./legalMoves";
import type { BotSpellContext } from "./types";
import type { Augment, AugmentUpgradeLevels } from "../augments";
import type { Color, ChessState } from "../engine";
import { getDerivedBoard } from "../engine";

export function buildBotSpellContext(input: {
  move: BotMoveContext;
  blackFreezeCharges: number;
  blackBlessedWaterCharges: number;
  blackAugments: Augment[];
  blackAugmentLevels: AugmentUpgradeLevels;
  augmentSpellBlockedFor: Color | null;
  blackMonolithPermRemoved: boolean;
  blackContractPieceId: string | null;
  blackPuppetUsed: boolean;
  blackDNUsed: boolean;
  game: ChessState;
}): BotSpellContext {
  const { game, move, blackMonolithPermRemoved } = input;
  const hasImpassable = input.blackAugments.some((a) => a.id === "impassable");
  const hasMonolithOnBoard = getDerivedBoard(game).some((row) =>
    row.some((sq) => sq?.type === "M" && sq.color === "black"),
  );
  return {
    ...move,
    blackFreezeCharges: input.blackFreezeCharges,
    blackBlessedWaterCharges: input.blackBlessedWaterCharges,
    blackAugments: input.blackAugments,
    blackAugmentLevels: input.blackAugmentLevels,
    augmentSpellBlockedFor: input.augmentSpellBlockedFor,
    monolithPlaceAvailable:
      hasImpassable && !blackMonolithPermRemoved && !hasMonolithOnBoard,
    contractAvailable:
      input.blackAugments.some((a) => a.id === "contract-killer") &&
      !input.blackContractPieceId,
    blackContractPieceId: input.blackContractPieceId,
    puppetAvailable:
      !input.blackPuppetUsed &&
      input.blackAugments.some((a) => a.id === "puppet"),
    deathNoteAvailable:
      !input.blackDNUsed &&
      input.blackAugments.some((a) => a.id === "death-note"),
  };
}
