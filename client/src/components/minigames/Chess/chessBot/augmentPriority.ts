/**
 * Bot augment pick order for Vs Bot (black).
 *
 * NEW augments added to AUGMENT_POOL must not be added here until the
 * maintainer confirms pick order for each rarity tier.
 */
import type { Rarity } from "../augments";
import { AUGMENT_PREREQUISITE } from "../augments";

export const BOT_AUGMENT_DENYLIST = new Set([
  "oops",
  "ilkkan",
  "pawn-shop",
  "tall-politician",
  "swap",
  "domain-expansion",
]);

export const BOT_AUGMENT_PRIORITY: Record<Rarity, readonly string[]> = {
  common: [
    "mastermind",
    "alternative",
    "blind-rage",
    "efficient",
    "prize-money",
    "miner",
    "investment",
    "instant-cash",
    "anticipation",
    "thief",
  ],
  uncommon: [
    "necromancer",
    "contract-killer",
    "evade",
    "free-passage",
    "augmented",
    "king-of-the-hill",
    "what",
    "sacrifice",
    "tax-man",
    "jew",
  ],
  rare: [
    "frost",
    "impassable",
    "blessed-water-spell",
    "horde",
    "i-am-danger",
    "double-gold",
    "mastermind-plus-plus",
  ],
  epic: [
    "puppet",
    "death-note",
    "royal-education",
    "internal-combustion",
    "bloodbending",
    "bloodlust",
  ],
  legendary: [
    "plot-armour",
    "little-big-man",
    "royal-household",
    "sako-bosphorus",
    "emperor-of-the-hill",
    "necromancer-plus-plus",
    "bloodbending-plus",
  ],
};

const RARITY_ORDER: Rarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
];

export function rarityRank(rarity: Rarity): number {
  return RARITY_ORDER.indexOf(rarity);
}

export function isPlusAugmentId(id: string): boolean {
  return id.includes("-plus");
}

/** ++ upgrades sort before + upgrades. */
export function plusUpgradeTier(id: string): number {
  if (id.endsWith("-plus-plus")) return 2;
  if (id.endsWith("-plus")) return 1;
  return 0;
}

export function isPlusEligible(id: string, ownedIds: string[]): boolean {
  const parent = AUGMENT_PREREQUISITE[id];
  if (!parent) return false;
  return ownedIds.includes(parent);
}

export function priorityIndex(rarity: Rarity, id: string): number {
  const list = BOT_AUGMENT_PRIORITY[rarity];
  const i = list.indexOf(id);
  return i === -1 ? list.length + 1 : i;
}
