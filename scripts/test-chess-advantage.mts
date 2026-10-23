/** Advantage setups and bot difficulty tiers. Run: npx tsx scripts/test-chess-advantage.mts */
import assert from "node:assert/strict";
import {
  ADVANTAGE_OPTIONS,
  describePerks,
  isAdvantageSetting,
  NO_ADVANTAGE,
  sideAdvantage,
} from "../client/src/components/minigames/Chess/advantage";
import {
  AUGMENT_POOL,
  DEFAULT_WEIGHTS,
  getShopCost,
  getWeightsForPlayer,
  MASTERMIND_PLUS_WEIGHTS,
  MASTERMIND_PP_MM_WEIGHTS,
  MASTERMIND_PP_WEIGHTS,
  MASTERMIND_WEIGHTS,
  rollBonusAugments,
  type Augment,
} from "../client/src/components/minigames/Chess/augments";
import { pickShopBuy } from "../client/src/components/minigames/Chess/chessBot/pickShopBuy";
import { pickWithSkill, setSkillRng, skillDepth, skillLevel } from "../client/src/components/minigames/Chess/chessBot/skill";

const aug = (id: string): Augment => {
  const found = AUGMENT_POOL.find((a) => a.id === id);
  assert.ok(found, `missing augment ${id}`);
  return found;
};

// ── Advantage perks, mirrored for both colours ──────────────────────────────
assert.equal(ADVANTAGE_OPTIONS.length, 7);
for (const color of ["white", "black"] as const) {
  const other = color === "white" ? "black" : "white";
  const high = sideAdvantage(`${color}-high`, color);
  assert.deepEqual(high, { startGold: 50, bonusPicks: 1, shopScaling: 0, mastermindTier: 3 });
  const med = sideAdvantage(`${color}-medium`, color);
  assert.deepEqual(med, { startGold: 20, bonusPicks: 1, shopScaling: 0.5, mastermindTier: 2 });
  const low = sideAdvantage(`${color}-low`, color);
  assert.deepEqual(low, { startGold: 0, bonusPicks: 1, shopScaling: 1, mastermindTier: 1 });
  for (const level of ["high", "medium", "low"] as const) {
    assert.deepEqual(sideAdvantage(`${color}-${level}`, other), NO_ADVANTAGE, "the other side gets nothing");
  }
}
assert.deepEqual(sideAdvantage("neutral", "white"), NO_ADVANTAGE);
assert.deepEqual(sideAdvantage("neutral", "black"), NO_ADVANTAGE);
assert.ok(isAdvantageSetting("black-medium"));
assert.ok(!isAdvantageSetting("black-huge"));
assert.ok(!isAdvantageSetting(null));
assert.deepEqual(describePerks(sideAdvantage("white-high", "white"), false), [
  "Start with 50 gold",
  "+1 bonus augment pick",
  "No shop price increase",
  "Mastermind++ roll odds",
]);
assert.deepEqual(describePerks(sideAdvantage("black-medium", "black"), false), [
  "Start with 20 gold",
  "+1 bonus augment pick",
  "Shop price increase 50% lower",
  "Mastermind+ roll odds",
]);
assert.deepEqual(describePerks(sideAdvantage("black-low", "black"), false), [
  "+1 bonus augment pick",
  "Mastermind roll odds",
]);

// ── Shop price increase scaling ─────────────────────────────────────────────
assert.deepEqual([0, 1, 2, 3].map((n) => getShopCost("rare", n)), [20, 40, 60, 80], "normal increase unchanged");
assert.deepEqual([0, 1, 2, 3].map((n) => getShopCost("rare", n, 0.5)), [20, 30, 40, 50], "medium: half the increase");
assert.deepEqual([0, 1, 2, 3].map((n) => getShopCost("rare", n, 0)), [20, 20, 20, 20], "high: flat price");
assert.equal(getShopCost("common", 1, 0.5), 8, "half-gold prices round");

{
  const tiers = { common: 0, uncommon: 0, rare: 3, epic: 0, legendary: 0 };
  const position = { materialCp: 0, evalCp: 0, scoreCp: 0, isAttacking: true, isAdvantaged: false, isDisadvantaged: false };
  const flat = pickShopBuy({
    goldBlack: 200,
    blackTierBought: tiers,
    blackAugments: [],
    blackAugmentLevels: {},
    position,
    costScaling: 0,
  });
  if (flat && flat.kind === "buy" && flat.aug.rarity === "rare") {
    assert.equal(flat.cost, 20, "bot pays the flat advantage price");
  }
  const normal = pickShopBuy({
    goldBlack: 200,
    blackTierBought: tiers,
    blackAugments: [],
    blackAugmentLevels: {},
    position,
  });
  if (normal && normal.kind === "buy" && normal.aug.rarity === "rare") {
    assert.equal(normal.cost, 80, "bot pays the escalated price without advantage");
  }
}

// ── Mastermind roll odds ────────────────────────────────────────────────────
assert.deepEqual(getWeightsForPlayer([]), DEFAULT_WEIGHTS);
assert.deepEqual(getWeightsForPlayer([], 1), MASTERMIND_WEIGHTS);
assert.deepEqual(getWeightsForPlayer([], 2), MASTERMIND_PLUS_WEIGHTS);
assert.deepEqual(getWeightsForPlayer([], 3), MASTERMIND_PP_WEIGHTS);
assert.deepEqual(getWeightsForPlayer([aug("mastermind")], 3), MASTERMIND_PP_MM_WEIGHTS, "stacks with owned Mastermind");
{
  // The advantage tier changes odds only; it doesn't count as owning the augment.
  const offers = Array.from({ length: 300 }, () => rollBonusAugments(3, [], getWeightsForPlayer([], 3))).flat();
  assert.ok(!offers.some((a) => a.id === "mastermind-plus"), "Mastermind+ still needs Mastermind");
  const excluded = rollBonusAugments(3, [], undefined, ["frost"]);
  assert.ok(!excluded.some((a) => a.id === "frost"), "extra exclusions are honoured");
}

// ── Stockfish Skill Level picker ────────────────────────────────────────────
assert.equal(skillLevel({ difficulty: "easy" }), 7);
assert.equal(skillLevel({ difficulty: "medium" }), 12);
assert.equal(skillLevel({ difficulty: "hard" }), 20);
assert.equal(skillLevel({}), 20, "default is the full-strength bot");
assert.equal(skillDepth(7), 8);
assert.equal(skillDepth(12), 13);

{
  let seed = 7;
  setSkillRng(() => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  });
  const lines = [{ score: 60 }, { score: 35 }, { score: 10 }, { score: -20 }];
  const rate = (level: number) => {
    let off = 0;
    for (let i = 0; i < 4000; i++) if (pickWithSkill(lines, level) !== lines[0]) off++;
    return off / 4000;
  };
  const easy = rate(7);
  const medium = rate(12);
  console.log(`skill picker: non-best rate easy ${(easy * 100).toFixed(1)}%, medium ${(medium * 100).toFixed(1)}%`);
  assert.ok(easy > medium, "easy deviates more often than medium");
  assert.ok(medium > 0.05, "medium does deviate");
  assert.ok(easy < 0.9, "easy still prefers good moves");

  // Skill keeps (128 - weakness)/128 of the gap against a line and adds at most
  // a pawn's worth of noise: easy never drops ~a queen, medium never ~3 pawns.
  const blunder = [{ score: 50 }, { score: 40 }, { score: -250 }, { score: -900 }];
  let easyMinor = 0;
  for (let i = 0; i < 4000; i++) {
    const e = pickWithSkill(blunder, 7)!;
    assert.notEqual(e.score, -900, "easy never hangs a queen-sized line");
    if (e.score === -250) easyMinor++;
    assert.ok(pickWithSkill(blunder, 12)!.score >= 40, "medium never picks a line 300cp worse");
  }
  console.log(`skill picker: easy chose the -300cp line ${(easyMinor / 40).toFixed(1)}% of the time`);
  const mate = [{ score: 9990 }, { score: 300 }, { score: 0 }];
  for (let i = 0; i < 500; i++) assert.equal(pickWithSkill(mate, 7), mate[0], "takes the mate");
  setSkillRng(Math.random);
}

console.log("chess advantage + difficulty tests passed");
