import {
  AUGMENT_POOL,
  augmentUnlockedForShop,
  getShopCost,
  MAX_STACK,
  NON_PURCHASABLE,
  type Augment,
  type AugmentUpgradeLevels,
} from "../augments";
import type { TierBought } from "../chessTypes";
import {
  BOT_AUGMENT_DENYLIST,
  priorityIndex,
  rarityRank,
} from "./augmentPriority";
import {
  meetsMinShopRarity,
  minShopRarity,
  spendableGold,
} from "./constants";
import type { PositionAssessment } from "./assessPosition";

function catalogBuyOnly(
  ownedAugments: Augment[],
  augmentLevels: AugmentUpgradeLevels,
): Augment[] {
  const counts: Record<string, number> = {};
  for (const a of ownedAugments) counts[a.id] = (counts[a.id] || 0) + 1;
  const ownedIds = Object.keys(counts);
  const atMax = (id: string) => (counts[id] ?? 0) >= (MAX_STACK[id] ?? 1);

  return AUGMENT_POOL.filter((a) => {
    if (NON_PURCHASABLE.has(a.id)) return false;
    if (BOT_AUGMENT_DENYLIST.has(a.id)) return false;
    if (!augmentUnlockedForShop(a.id, ownedIds)) return false;
    if (atMax(a.id)) return false;
    void augmentLevels;
    return true;
  });
}

export function pickShopBuy(input: {
  goldBlack: number;
  blackTierBought: TierBought;
  blackAugments: Augment[];
  blackAugmentLevels: AugmentUpgradeLevels;
  position: PositionAssessment;
}): { aug: Augment; cost: number } | null {
  const { goldBlack, blackTierBought, blackAugments, position } = input;
  const budget = spendableGold(goldBlack, position.scoreCp);
  if (budget <= 0) return null;

  const minRarity = minShopRarity(position.scoreCp);
  const catalog = catalogBuyOnly(blackAugments, input.blackAugmentLevels).filter(
    (a) => meetsMinShopRarity(a.rarity, minRarity),
  );
  if (catalog.length === 0) return null;

  const affordable: Augment[] = [];
  const costs = new Map<string, number>();
  for (const a of catalog) {
    const cost = getShopCost(a.rarity, blackTierBought[a.rarity]);
    if (cost <= budget) {
      affordable.push(a);
      costs.set(a.id, cost);
    }
  }
  if (affordable.length === 0) return null;

  // A shop offer charges for rarity again for every prior tier purchase.  The
  // usual pick order is right for free rewards, but can spend nearly all gold
  // on a marginal legendary here. Rank the legal affordable catalog by useful
  // priority per actual price instead.
  const pick = [...affordable].sort((a, b) => {
    const value = (aug: Augment) => {
      const tierValue = (rarityRank(aug.rarity) + 1) * 100;
      const orderValue = Math.max(0, 20 - priorityIndex(aug.rarity, aug.id)) * 4;
      return tierValue + orderValue;
    };
    const aCost = costs.get(a.id)!;
    const bCost = costs.get(b.id)!;
    const efficiency = value(b) / bCost - value(a) / aCost;
    if (efficiency !== 0) return efficiency;
    // Keep the free-pick strategy as a deterministic tie breaker.
    return (
      rarityRank(b.rarity) - rarityRank(a.rarity) ||
      priorityIndex(a.rarity, a.id) - priorityIndex(b.rarity, b.id) ||
      a.id.localeCompare(b.id)
    );
  })[0];
  if (!pick) return null;
  const cost = costs.get(pick.id);
  if (cost === undefined) return null;
  return { aug: pick, cost };
}
