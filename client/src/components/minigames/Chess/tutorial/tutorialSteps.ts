import { AUGMENT_POOL } from "../augments";
import type { TutorialStep } from "./types";

export const D2: [number, number] = [6, 3];
export const D3: [number, number] = [5, 3];

export const WHAT_AUGMENT = AUGMENT_POOL.find((a) => a.id === "what")!;
export const MINER_AUGMENT = AUGMENT_POOL.find((a) => a.id === "miner")!;

/** Harmless black reply so white can act again */
export const BLACK_PASS_FROM: [number, number] = [1, 0];
export const BLACK_PASS_TO: [number, number] = [2, 0];

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "intro",
    dialogue:
      "This isn't your normal chess with special mechanics added.",
    advanceOn: "next",
    restrictions: {
      blockAllBoardInput: true,
      blockAllSpells: true,
      blockShopToggle: true,
    },
    completion: { type: "next" },
  },
  {
    id: "first-move",
    dialogue: "Make your first move.",
    advanceOn: "complete",
    restrictions: {
      allowedMoves: [{ from: D2, to: D3 }],
      highlightSquares: [D2],
      blockAllSpells: true,
      blockShopToggle: true,
    },
    completion: { type: "move" },
  },
  {
    id: "augment-intro",
    dialogue: "Augments give powerful effects and can change the game.",
    advanceOn: "next",
    restrictions: {
      blockAllBoardInput: true,
      blockAllSpells: true,
      blockShopToggle: true,
    },
    completion: { type: "next" },
    onEnter: (bridge) => {
      bridge.setOfferedToWhite([WHAT_AUGMENT]);
      bridge.setPhase("white-augment");
    },
  },
  {
    id: "augment-pick",
    dialogue: 'Pick "What?" to continue.',
    advanceOn: "complete",
    restrictions: {
      blockAllBoardInput: true,
      blockAllSpells: true,
      blockShopToggle: true,
      allowedAugmentIds: ["what"],
    },
    completion: { type: "augment" },
  },
  {
    id: "use-what",
    dialogue: 'Use "What?" on the highlighted piece.',
    advanceOn: "complete",
    ensureWhiteTurn: true,
    restrictions: {
      blockAllBoardInput: false,
      allowSpellIds: ["what"],
      blockShopToggle: true,
      highlightUi: ["spell-what"],
    },
    completion: { type: "spell" },
    onEnter: () => {},
  },
  {
    id: "market",
    dialogue: [
      "In market you can buy augments yourself.",
      "Economy is a strong part of this game. Build your economy early on.",
    ],
    advanceOn: "complete",
    ensureWhiteTurn: true,
    restrictions: {
      blockAllBoardInput: true,
      blockShopToggle: false,
      blockShopClose: true,
      allowedShopIds: ["miner"],
      highlightUi: ["shop-button", "shop-miner"],
    },
    completion: { type: "shop-buy" },
    onEnter: (bridge) => {
      bridge.setGoldWhite(5);
      bridge.setShopOpen(true);
    },
  },
  {
    id: "tips",
    dialogue: [
      "When you capture your first rook, knight, bishop you gain additional augments.",
      "Queen captures and promotions will give you additional augments.",
      "Sometimes random events happen on board. They affect both players positive or negative.",
      "Use your augments to your advantage and checkmate the enemy king.",
    ],
    advanceOn: "next",
    restrictions: {
      blockAllBoardInput: true,
      blockAllSpells: true,
      blockShopToggle: true,
    },
    completion: { type: "next" },
    onEnter: (bridge) => {
      bridge.setShopOpen(false);
    },
  },
  {
    id: "finish",
    dialogue: "Tutorial complete! Returning to menu…",
    advanceOn: "complete",
    restrictions: {
      blockAllBoardInput: true,
      blockAllSpells: true,
      blockShopToggle: true,
    },
    completion: { type: "auto" },
  },
];
