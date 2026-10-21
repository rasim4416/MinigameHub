import {
  augmentExcludedByPrereq,
  MAX_STACK,
  type Augment,
} from "../augments";
import { BOT_AUGMENT_DENYLIST, priorityIndex, rarityRank } from "./augmentPriority";
import { augmentValue, type AugmentContext } from "./augmentValue";

function isLegalPick(aug: Augment, owned: Augment[]): boolean {
  if (BOT_AUGMENT_DENYLIST.has(aug.id)) return false;
  const ownedIds = owned.map((a) => a.id);
  if (augmentExcludedByPrereq(aug.id, ownedIds)) return false;
  const count = owned.filter((a) => a.id === aug.id).length;
  if (count >= (MAX_STACK[aug.id] ?? 1)) return false;
  return true;
}

/**
 * Pick the offered augment worth the most to the bot right now (phase,
 * lost pieces, enemy spells, prerequisite chains), not just the rarest one.
 */
export function pickAugmentForBot(
  offered: Augment[],
  owned: Augment[],
  ctx: AugmentContext = {},
): Augment | null {
  const legal = offered.filter((a) => isLegalPick(a, owned));
  if (legal.length === 0) return null;
  const scored = legal.map((aug) => ({ aug, v: augmentValue(aug, owned, ctx) }));
  scored.sort(
    (a, b) =>
      b.v - a.v ||
      rarityRank(b.aug.rarity) - rarityRank(a.aug.rarity) ||
      priorityIndex(a.aug.rarity, a.aug.id) - priorityIndex(b.aug.rarity, b.aug.id) ||
      a.aug.id.localeCompare(b.aug.id),
  );
  return scored[0]!.aug;
}
