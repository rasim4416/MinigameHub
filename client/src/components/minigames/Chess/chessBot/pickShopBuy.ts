import {
  AUGMENT_POOL,
  augmentUnlockedForShop,
  canImproveAugment,
  getNextImproveTier,
  getShopCost,
  MAX_STACK,
  NON_PURCHASABLE,
  type Augment,
  type AugmentUpgradeLevels,
} from "../augments";
import type { TierBought } from "../chessTypes";
import { BOT_AUGMENT_DENYLIST } from "./augmentPriority";
import { augmentValue, CP_PER_GOLD, improveValue, type AugmentContext } from "./augmentValue";
import { spendableGold } from "./constants";
import type { PositionAssessment } from "./assessPosition";

export type ShopChoice =
  | { kind: "buy"; aug: Augment; cost: number; net: number }
  | { kind: "improve"; augId: string; cost: number; net: number };

function catalogBuyOnly(ownedAugments: Augment[]): Augment[] {
  const counts: Record<string, number> = {};
  for (const a of ownedAugments) counts[a.id] = (counts[a.id] || 0) + 1;
  const ownedIds = Object.keys(counts);
  const atMax = (id: string) => (counts[id] ?? 0) >= (MAX_STACK[id] ?? 1);

  return AUGMENT_POOL.filter((a) => {
    if (NON_PURCHASABLE.has(a.id)) return false;
    if (BOT_AUGMENT_DENYLIST.has(a.id)) return false;
    if (!augmentUnlockedForShop(a.id, ownedIds)) return false;
    if (atMax(a.id)) return false;
    return true;
  });
}

/** Minimum surplus (cp) over the gold's worth before the bot spends. */
const MIN_SHOP_SURPLUS_CP = 15;

/**
 * Best shop action by value minus the gold's opportunity cost. Gold kept in
 * reserve funds auctions, so only the spendable share is considered.
 */
export function pickShopBuy(input: {
  goldBlack: number;
  blackTierBought: TierBought;
  blackAugments: Augment[];
  blackAugmentLevels: AugmentUpgradeLevels;
  position: PositionAssessment;
  context?: AugmentContext;
  /** Per-purchase price increase multiplier from the advantage setup. */
  costScaling?: number;
}): ShopChoice | null {
  const { goldBlack, blackTierBought, blackAugments, blackAugmentLevels, position } = input;
  const budget = spendableGold(goldBlack, position.scoreCp);
  if (budget <= 0) return null;
  const ctx: AugmentContext = {
    ...input.context,
    scoreCp: position.scoreCp,
    levels: blackAugmentLevels,
  };

  const options: ShopChoice[] = [];
  for (const aug of catalogBuyOnly(blackAugments)) {
    const cost = getShopCost(aug.rarity, blackTierBought[aug.rarity], input.costScaling);
    if (cost > budget) continue;
    const net = augmentValue(aug, blackAugments, ctx) - cost * CP_PER_GOLD;
    options.push({ kind: "buy", aug, cost, net });
  }
  const owned = [...new Set(blackAugments.map((a) => a.id))];
  for (const augId of owned) {
    if (!canImproveAugment(blackAugmentLevels, augId, blackAugments)) continue;
    const tier = getNextImproveTier(augId, blackAugmentLevels);
    if (!tier || tier.cost > budget) continue;
    const net = improveValue(augId, blackAugments, ctx) - tier.cost * CP_PER_GOLD;
    options.push({ kind: "improve", augId, cost: tier.cost, net });
  }

  options.sort((a, b) => b.net - a.net || a.cost - b.cost);
  const best = options[0];
  if (!best || best.net < MIN_SHOP_SURPLUS_CP) return null;
  return best;
}
