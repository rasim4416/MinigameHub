import type { Rarity } from "../augments";
import { rarityRank } from "./augmentPriority";

/** Minimum centipawn gain to cast a free spell (frost, blessed water). */
export const FREE_SPELL_THRESHOLD_CP = 30;

/** Minimum centipawn gain to spend turn on monolith vs moving. */
export const TURN_SPELL_THRESHOLD_CP = 50;

/** Max spell targets to run Stockfish counterfactuals on per spell. */
export const MAX_SPELL_CANDIDATES = 4;

export const SPELL_EVAL_DEPTH = 16;
export const SPELL_EVAL_MOVETIME_MS = 800;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Reserve fraction of gold the bot keeps in reserve (higher = pickier). */
export function reserveFraction(scoreCp: number): number {
  return clamp(0.45 - scoreCp / 800, 0.15, 0.45);
}

export function spendableGold(gold: number, scoreCp: number): number {
  const reserve = Math.floor(gold * reserveFraction(scoreCp));
  return Math.max(0, gold - reserve);
}

export function minShopRarity(scoreCp: number): Rarity {
  if (scoreCp >= 100) return "rare";
  if (scoreCp <= -100) return "common";
  return "uncommon";
}

export function meetsMinShopRarity(rarity: Rarity, min: Rarity): boolean {
  return rarityRank(rarity) >= rarityRank(min);
}

export function auctionAggression(scoreCp: number): number {
  return clamp((-scoreCp + 100) / 400, 0, 1);
}
