import {
  augmentExcludedByPrereq,
  MAX_STACK,
  type Augment,
} from "../augments";
import {
  BOT_AUGMENT_DENYLIST,
  isPlusAugmentId,
  isPlusEligible,
  plusUpgradeTier,
  priorityIndex,
  rarityRank,
} from "./augmentPriority";

function isLegalPick(aug: Augment, owned: Augment[]): boolean {
  if (BOT_AUGMENT_DENYLIST.has(aug.id)) return false;
  const ownedIds = owned.map((a) => a.id);
  if (augmentExcludedByPrereq(aug.id, ownedIds)) return false;
  const count = owned.filter((a) => a.id === aug.id).length;
  if (count >= (MAX_STACK[aug.id] ?? 1)) return false;
  return true;
}

function pickBestAmong(candidates: Augment[]): Augment {
  return candidates.reduce((best, a) => {
    const pi = priorityIndex(a.rarity, a.id);
    const bi = priorityIndex(best.rarity, best.id);
    if (pi !== bi) return pi < bi ? a : best;
    return a.id < best.id ? a : best;
  });
}

/**
 * Pick highest-rarity legal augment; prefer + upgrades when parent owned;
 * then use BOT_AUGMENT_PRIORITY within tier.
 */
export function pickAugmentForBot(
  offered: Augment[],
  owned: Augment[],
): Augment | null {
  const legal = offered.filter((a) => isLegalPick(a, owned));
  if (legal.length === 0) return null;

  const ownedIds = owned.map((a) => a.id);
  const plusEligible = legal.filter(
    (a) => isPlusAugmentId(a.id) && isPlusEligible(a.id, ownedIds),
  );
  if (plusEligible.length > 0) {
    plusEligible.sort((a, b) => {
      const tier = plusUpgradeTier(b.id) - plusUpgradeTier(a.id);
      if (tier !== 0) return tier;
      return priorityIndex(a.rarity, a.id) - priorityIndex(b.rarity, b.id);
    });
    return plusEligible[0]!;
  }

  const topRarity = legal.reduce(
    (best, a) => (rarityRank(a.rarity) > rarityRank(best) ? a.rarity : best),
    legal[0]!.rarity,
  );
  const atTop = legal.filter((a) => a.rarity === topRarity);
  return pickBestAmong(atTop);
}
