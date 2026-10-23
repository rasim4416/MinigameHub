import type { PieceType } from "../engine";
import type { Augment, AugmentUpgradeLevels } from "../augments";
import type { Color } from "../engine";
import type { BotMoveContext } from "./legalMoves";

export type BotMove = {
  from: [number, number];
  to: [number, number];
  promotion?: PieceType;
};

export type BotSpellContext = BotMoveContext & {
  blackFreezeCharges: number;
  blackBlessedWaterCharges: number;
  blackAugments: Augment[];
  blackAugmentLevels: AugmentUpgradeLevels;
  augmentSpellBlockedFor: Color | null;
  monolithPlaceAvailable: boolean;
  contractAvailable: boolean;
  blackContractPieceId: string | null;
  puppetAvailable: boolean;
  deathNoteAvailable: boolean;
  /**
   * Revival state is optional while older snapshot/executor paths are upgraded.
   * A missing value deliberately means the bot cannot cast that spell.
   */
  blackNecroCharges?: number;
  blackLostPawnCols?: number[];
  blackNecroPlusCharges?: number;
  blackLostMinors?: PieceType[];
  blackNecroPPCharges?: number;
  blackLittleBigManCharges?: number;
  blackBloodbendingCharges?: number;
  blackBloodbendingPlusCharges?: number;
  /** Half-moves the current frost still holds (ChessGame frozenTurnsLeft). */
  frozenTurnsLeft?: number;
  /** Black pieces cursed by White's Death Note — they die anyway. */
  blackDoomedPieceIds?: string[];

  /* What the opponent (white) can still throw at us. */
  whiteAugments?: Augment[];
  whiteAugmentLevels?: AugmentUpgradeLevels;
  whiteFreezeCharges?: number;
  whiteBlessedWaterCharges?: number;
  whitePuppetAvailable?: boolean;
  whiteLittleBigManCharges?: number;
  whiteBloodbendingPlusCharges?: number;
  /** White still has an unused Internal Combustion: our checking piece explodes. */
  whiteIcAvailable?: boolean;
  /** Move-strength tier; spell and economy logic is the same on every tier. */
  difficulty?: import("./constants").BotDifficulty;
};

export type BotAction =
  | { type: "pickAugment"; aug: import("../augments").Augment }
  | { type: "promote"; piece: PieceType }
  | { type: "castSpell"; spellId: string; target: [number, number] }
  | { type: "castSpellThenMove"; spellId: string; target: [number, number]; move: BotMove }
  | { type: "shopBuy"; aug: import("../augments").Augment }
  | { type: "move"; move: BotMove };

export type SpellPreview = {
  game: import("../engine").ChessState;
  ctx: BotSpellContext;
  sideToMove: "white" | "black";
};
