import type { Color } from "../engine";
import type { GamePhase } from "../chessTypes";
import type { Augment } from "../augments";
import type { Language } from "../../../../lib/language";

export type TutorialCopy = string | string[] | Partial<Record<Language, string | string[]>>;

export type TutorialUiTarget =
  | "pawn-d2"
  | "spell-what"
  | "shop-button"
  | "shop-buy-miner";

export type TutorialCompletionType =
  | "next"
  | "move"
  | "augment"
  | "spell"
  | "shop-buy"
  | "auto";

export type TutorialAdvanceOn = "next" | "complete";

export type TutorialRestrictions = {
  blockAllBoardInput?: boolean;
  blockAllSpells?: boolean;
  blockShopToggle?: boolean;
  blockShopClose?: boolean;
  allowedMoves?: { from: [number, number]; to: [number, number] }[];
  allowedAugmentIds?: string[];
  allowedShopIds?: string[];
  allowSpellIds?: string[];
  highlightSquares?: [number, number][];
  highlightUi?: TutorialUiTarget[];
};

export type TutorialEvent =
  | { type: "move"; from: [number, number]; to: [number, number] }
  | { type: "augment"; id: string }
  | { type: "spell"; id: string }
  | { type: "shop-buy"; id: string };

export type TutorialBridge = {
  getPhase: () => GamePhase;
  setPhase: (p: GamePhase) => void;
  setOfferedToWhite: (a: Augment[]) => void;
  setShopOpen: (open: boolean) => void;
  setGoldWhite: (gold: number) => void;
  getTurn: () => Color;
  getWhiteWhatUsed: () => boolean;
  executeScriptedMove: (
    from: [number, number],
    to: [number, number],
  ) => void;
  findWhiteDPawnSquare: () => [number, number] | null;
};

export type TutorialStep = {
  id: string;
  title?: TutorialCopy;
  dialogue?: TutorialCopy;
  dialogueIndex?: number;
  advanceOn?: TutorialAdvanceOn;
  restrictions: TutorialRestrictions;
  completion: { type: TutorialCompletionType };
  highlightUi?: TutorialUiTarget[];
  onEnter?: (bridge: TutorialBridge) => void;
  /** Run after black auto-pass when step needs white to move */
  ensureWhiteTurn?: boolean;
};

export const EMPTY_RESTRICTIONS: TutorialRestrictions = {
  blockAllBoardInput: true,
  blockAllSpells: true,
  blockShopToggle: true,
};
