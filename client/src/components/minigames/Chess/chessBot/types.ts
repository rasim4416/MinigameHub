import type { PieceType } from "../engine";
import type { Augment, AugmentUpgradeLevels } from "../augments";
import type { Color } from "../engine";
import type { BotMoveContext } from "./legalMoves";

export type BotMove = {
  from: [number, number];
  to: [number, number];
  promotion?: PieceType;
};

export type RankedSearchOptions = {
  multiPv?: number;
  depth?: number;
  movetimeMs?: number;
};

export type EvalSearchOptions = {
  depth?: number;
  movetimeMs?: number;
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
};

export type BotAction =
  | { type: "pickAugment"; aug: import("../augments").Augment }
  | { type: "promote"; piece: PieceType }
  | { type: "castSpell"; spellId: string; target: [number, number] }
  | { type: "castSpellThenMove"; spellId: string; target: [number, number]; move: BotMove }
  | { type: "shopBuy"; aug: import("../augments").Augment }
  | { type: "move"; move: BotMove };

export type SpellCandidate = {
  spellId: string;
  target: [number, number];
  gainCp: number;
};

export type SpellPreview = {
  game: import("../engine").ChessState;
  ctx: BotSpellContext;
  sideToMove: "white" | "black";
};
