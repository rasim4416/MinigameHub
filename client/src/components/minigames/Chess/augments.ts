// ─────────────────────────────────────────────────────────────────────────────
// Augment system — 5-tier rarity, weighted rolls, shop pricing
// ─────────────────────────────────────────────────────────────────────────────

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface Augment {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  icon: string;
}

// ─── Rarity appearance ───────────────────────────────────────────────────────

export const RARITY_META: Record<Rarity, {
  border: string; glow: string; badge: string; text: string; label: string;
  shimmer?: string;
}> = {
  common: {
    border: "#6b7280", glow: "rgba(156,163,175,0.15)",
    badge: "#1f2937", text: "#d1d5db", label: "Common",
  },
  uncommon: {
    border: "#22c55e", glow: "rgba(34,197,94,0.30)",
    badge: "#14532d", text: "#86efac", label: "Uncommon",
  },
  rare: {
    border: "#3b82f6", glow: "rgba(59,130,246,0.40)",
    badge: "#1d3a6e", text: "#93c5fd", label: "Rare",
  },
  epic: {
    border: "#a855f7", glow: "rgba(168,85,247,0.55)",
    badge: "#4c1d95", text: "#d8b4fe", label: "Epic",
  },
  legendary: {
    border: "#eab308", glow: "rgba(234,179,8,0.70)",
    badge: "#422006", text: "#fde047", label: "Legendary",
    shimmer: "linear-gradient(90deg,#eab308,#f59e0b,#fde047,#f59e0b,#eab308)",
  },
};

// ─── Shop pricing ─────────────────────────────────────────────────────────────

/** Base gold cost per rarity tier. */
export const BASE_COST: Record<Rarity, number> = {
  common: 5, uncommon: 10, rare: 20, epic: 40, legendary: 100,
};

/** Actual cost = baseCost * (number already bought of that tier + 1). */
export function getShopCost(rarity: Rarity, tierBought: number): number {
  return BASE_COST[rarity] * (tierBought + 1);
}

// ─── Shop improve (augment upgrades) ─────────────────────────────────────────

export type AugmentUpgradeLevels = Partial<Record<string, number>>;

export type ImproveTier = { cost: number; description: string };

/** Flat-gold improve tiers per augment id (only listed augments show Improve). */
export const AUGMENT_IMPROVEMENTS: Partial<Record<string, ImproveTier[]>> = {
  miner: [
    {
      cost: 10,
      description: "Earn 2 gold every 2 turns (was every 3). Infinitely stackable.",
    },
  ],
  alternative: [
    {
      cost: 15,
      description:
        "Every pawn may advance up to 3 squares on its first move (path must be clear).",
    },
  ],
  investment: [
    {
      cost: 20,
      description:
        "At the end of each full round, earn 1 gold per 10 gold you have (20g → 2g, 40g → 4g, etc.).",
    },
  ],
  efficient: [
    {
      cost: 8,
      description:
        "Gain +2 extra gold whenever you capture a piece (stacks with normal capture payout).",
    },
    {
      cost: 15,
      description:
        "Gain +3 extra gold whenever you capture a piece (stacks with normal capture payout).",
    },
  ],
  thief: [
    { cost: 5, description: "2% chance per Thief stack to gain 50 gold at end of turn." },
    { cost: 10, description: "5% chance per Thief stack to gain 50 gold at end of turn." },
    { cost: 15, description: "10% chance per Thief stack to gain 50 gold at end of turn." },
  ],
  "king-of-the-hill": [
    {
      cost: 18,
      description: "Each of your pieces on d4/d5/e4/e5 earns 2 gold per turn.",
    },
  ],
  jew: [
    {
      cost: 10,
      description: "When the enemy captures your pawns, you gain 3 gold per captured pawn.",
    },
    {
      cost: 30,
      description:
        "When the enemy captures your pawns: 3g for the first, 6g for the second, 9g for the third, and keeps scaling.",
    },
  ],
  "contract-killer": [
    {
      cost: 5,
      description:
        "Mark one enemy piece (not king or pawn). Capture it for 5× its base gold value instead of 3.",
    },
  ],
  "tax-man": [
    {
      cost: 10,
      description:
        "When you finish a half-move, earn 3 gold per 8 gold your opponent gained that half-move (per stack).",
    },
    {
      cost: 20,
      description:
        "When you finish a half-move, earn 3 gold per 5 gold your opponent gained that half-move (per stack).",
    },
  ],
  frost: [
    {
      cost: 30,
      description: "Freeze one enemy piece — it cannot move for 3 half-turns.",
    },
  ],
  "blessed-water-spell": [
    {
      cost: 10,
      description:
        "Bless any square. The piece on that square cannot be captured for 3 rounds.",
    },
  ],
  "pawn-shop": [
    {
      cost: 10,
      description:
        "Buy pawns from the shop; price starts at 5g and rises by 7g each purchase.",
    },
    {
      cost: 20,
      description:
        "Buy pawns from the shop for a flat 10g each (price no longer scales).",
    },
  ],
  "i-am-danger": [
    {
      cost: 15,
      description: "Each time you give check to the enemy king, gain 5 gold (per stack).",
    },
  ],
  bloodlust: [
    {
      cost: 40,
      description: "Every 3 enemy pieces you capture, gain 1 bonus augment pick.",
    },
    {
      cost: 100,
      description:
        "Every 3 enemy pieces you capture, gain 2 bonus augment picks.",
    },
  ],
  "royal-education": [
    {
      cost: 50,
      description:
        "Your king may move like a knight twice (spell has two charges).",
    },
  ],
  "death-note": [
    {
      cost: 30,
      description:
        "Cursed enemy piece dies after 12 half-moves (timer follows piece identity).",
    },
    {
      cost: 60,
      description:
        "Cursed enemy piece dies after 4 half-moves (timer follows piece identity).",
    },
    {
      cost: 60,
      description:
        "Cursed enemy piece dies instantly when selected (no timer).",
    },
  ],
};

export function getImproveLevel(
  levels: AugmentUpgradeLevels,
  augId: string,
): number {
  return levels[augId] ?? 0;
}

export function ownsAugment(held: Augment[], augId: string): boolean {
  return held.some((a) => a.id === augId);
}

export function canImproveAugment(
  levels: AugmentUpgradeLevels,
  augId: string,
  held: Augment[],
): boolean {
  const tiers = AUGMENT_IMPROVEMENTS[augId];
  if (!tiers?.length) return false;
  if (!ownsAugment(held, augId)) return false;
  return getImproveLevel(levels, augId) < tiers.length;
}

export function getNextImproveTier(
  augId: string,
  levels: AugmentUpgradeLevels,
): ImproveTier | null {
  const tiers = AUGMENT_IMPROVEMENTS[augId];
  if (!tiers?.length) return null;
  const level = getImproveLevel(levels, augId);
  return tiers[level] ?? null;
}


/** Miner payout interval in half-moves (player turns). */
export function getMinerInterval(level: number): number {
  return level >= 1 ? 2 : 3;
}

export function getEfficientCaptureBonus(level: number): number {
  if (level >= 2) return 3;
  if (level >= 1) return 2;
  return 1;
}

export function getThiefProcRate(level: number): number {
  const rates = [0.01, 0.02, 0.05, 0.1];
  return rates[Math.min(level, rates.length - 1)]!;
}

export function getKingOfTheHillGoldPerPiece(level: number): number {
  return level >= 1 ? 2 : 1;
}

export function getJewPawnCaptureGold(level: number, lossIndex: number): number {
  if (level >= 2) return 3 * lossIndex;
  if (level >= 1) return 3;
  return 2;
}

export function getContractKillerMultiplier(level: number): number {
  return level >= 1 ? 5 : 3;
}

export function getTaxManParams(level: number): { divisor: number; goldPer: number } {
  if (level >= 2) return { divisor: 5, goldPer: 3 };
  if (level >= 1) return { divisor: 8, goldPer: 3 };
  return { divisor: 10, goldPer: 1 };
}

export function getFrostFreezeTurns(level: number): number {
  return level >= 1 ? 3 : 2;
}

export function getBlessedWaterMovesLeft(level: number): number {
  return level >= 1 ? 6 : 4;
}

export function getPawnShopPrice(
  level: number,
  buys: number,
): number {
  if (level >= 2) return 10;
  return 5 + 7 * buys;
}

export function getIAmDangerGoldPerStack(level: number): number {
  return level >= 1 ? 5 : 4;
}

export function getBloodlustThreshold(level: number): number {
  return level >= 1 ? 3 : 4;
}

export function getBloodlustPickCount(level: number): number {
  return level >= 2 ? 2 : 1;
}

export function getRoyalEducationMaxUses(level: number): number {
  return level >= 1 ? 2 : 1;
}

export function getDeathNoteTurnsLeft(level: number): number {
  const timers = [16, 12, 4, 0];
  return timers[Math.min(level, timers.length - 1)]!;
}

// ─── Roll weight presets ──────────────────────────────────────────────────────

export type RarityWeights = Record<Rarity, number>;

export const DEFAULT_WEIGHTS: RarityWeights         = { common:40, uncommon:34, rare:20, epic:5,  legendary:1 };
export const MASTERMIND_WEIGHTS: RarityWeights      = { common:30, uncommon:30, rare:27, epic:10, legendary:3 };
export const MASTERMIND_PLUS_WEIGHTS: RarityWeights = { common:15, uncommon:18, rare:25, epic:30, legendary:12 };
export const MASTERMIND_BOTH_WEIGHTS: RarityWeights = { common:5,  uncommon:10, rare:20, epic:40, legendary:25 };
/** Mastermind++ alone — pushes rare+ even harder. */
export const MASTERMIND_PP_WEIGHTS: RarityWeights = { common:8, uncommon:12, rare:28, epic:32, legendary:20 };
/** Mastermind++ stacked with Mastermind+ */
export const MASTERMIND_PP_PLUS_WEIGHTS: RarityWeights = { common:4, uncommon:8, rare:22, epic:38, legendary:28 };
/** Mastermind++ stacked with Mastermind (no +) */
export const MASTERMIND_PP_MM_WEIGHTS: RarityWeights = { common:6, uncommon:10, rare:25, epic:35, legendary:24 };
/** All three mastermind tiers */
export const MASTERMIND_TRIPLE_WEIGHTS: RarityWeights = { common:2, uncommon:5, rare:18, epic:35, legendary:40 };

export function getWeightsForPlayer(augments: Augment[]): RarityWeights {
  const hasPPP = augments.some((a) => a.id === "mastermind-plus-plus");
  const hasMMP = augments.some((a) => a.id === "mastermind-plus");
  const hasMM = augments.some((a) => a.id === "mastermind");
  if (hasPPP && hasMMP && hasMM) return MASTERMIND_TRIPLE_WEIGHTS;
  if (hasPPP && hasMMP) return MASTERMIND_PP_PLUS_WEIGHTS;
  if (hasPPP && hasMM) return MASTERMIND_PP_MM_WEIGHTS;
  if (hasPPP) return MASTERMIND_PP_WEIGHTS;
  if (hasMMP && hasMM) return MASTERMIND_BOTH_WEIGHTS;
  if (hasMMP) return MASTERMIND_PLUS_WEIGHTS;
  if (hasMM) return MASTERMIND_WEIGHTS;
  return DEFAULT_WEIGHTS;
}

/** Child augment id → required augment id that must already be owned. */
export const AUGMENT_PREREQUISITE: Partial<Record<string, string>> = {
  "mastermind-plus": "mastermind",
  "mastermind-plus-plus": "mastermind-plus",
  "necromancer-plus": "necromancer",
  "alternative-plus": "alternative",
  "necromancer-plus-plus": "necromancer-plus",
  "bloodbending-plus": "bloodbending",
};

/** Subset used for guaranteed upgrade slots in bonus augment rolls. */
export const GUARANTEED_UPGRADE_PREREQUISITE: Partial<Record<string, string>> =
  Object.fromEntries(
    Object.entries(AUGMENT_PREREQUISITE).filter(
      ([childId]) =>
        childId !== "bloodbending-plus" &&
        childId !== "necromancer-plus-plus",
    ),
  ) as Partial<Record<string, string>>;

/** True if `augId` cannot be rolled or bought until `requiredId` is owned. */
export function augmentExcludedByPrereq(
  augId: string,
  ownedAugmentIds: string[],
): boolean {
  const req = AUGMENT_PREREQUISITE[augId];
  if (!req) return false;
  return !ownedAugmentIds.includes(req);
}

/** Shop: upgrade tiers appear only after their parent augment is owned. */
export function augmentUnlockedForShop(
  augId: string,
  ownedAugmentIds: string[],
): boolean {
  return !augmentExcludedByPrereq(augId, ownedAugmentIds);
}

function augmentById(id: string): Augment | undefined {
  return AUGMENT_POOL.find((a) => a.id === id);
}

/** Force one offered slot to the next tier upgrade the player is eligible for (++ before +). */
export function applyGuaranteedUpgradeSlot(
  offered: Augment[],
  owned: Augment[],
  exclude: string[],
): Augment[] {
  if (offered.length === 0) return offered;
  const ownedIds = owned.map((a) => a.id);
  const has = (id: string) => ownedIds.includes(id);
  const candidates: { id: string; priority: number }[] = [];
  for (const [childId, parentId] of Object.entries(
    GUARANTEED_UPGRADE_PREREQUISITE,
  )) {
    if (has(childId) || exclude.includes(childId)) continue;
    if (!parentId || !has(parentId)) continue;
    const priority = childId.endsWith("-plus-plus") ? 2 : 1;
    candidates.push({ id: childId, priority });
  }
  if (candidates.length === 0) return offered;
  candidates.sort((a, b) => b.priority - a.priority);
  const candidate = candidates[0];
  if (!candidate) return offered;
  const forced = augmentById(candidate.id);
  if (!forced) return offered;
  const out = [...offered];
  // A normal roll may already have produced the guaranteed upgrade. It already
  // satisfies the guarantee, so keep the other unique choices intact.
  if (out.some((augment) => augment.id === forced.id)) return out;
  out[Math.floor(Math.random() * out.length)] = { ...forced };
  return out;
}

/** Weighted roll for bonus picks with upgrade-slot guarantee. */
export function rollBonusAugments(
  count: number,
  owned: Augment[],
  weights?: RarityWeights,
): Augment[] {
  const exclude = getRollExcludeIds(owned);
  const w = weights ?? getWeightsForPlayer(owned);
  const rolled = rollAugments(count, exclude, w);
  return applyGuaranteedUpgradeSlot(rolled, owned, exclude);
}

const RARITY_ORDER: Rarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
];

function applyRarityFilter(
  weights: RarityWeights,
  min?: Rarity,
  max?: Rarity,
): RarityWeights {
  const out = { ...weights };
  if (min) {
    const minIdx = RARITY_ORDER.indexOf(min);
    for (const r of RARITY_ORDER) {
      if (RARITY_ORDER.indexOf(r) < minIdx) out[r] = 0;
    }
  }
  if (max) {
    const maxIdx = RARITY_ORDER.indexOf(max);
    for (const r of RARITY_ORDER) {
      if (RARITY_ORDER.indexOf(r) > maxIdx) out[r] = 0;
    }
  }
  return out;
}

/** Bonus rolls with optional min/max rarity constraints (for board events). */
export function rollBonusAugmentsFiltered(
  count: number,
  owned: Augment[],
  opts?: {
    minRarity?: Rarity;
    maxRarity?: Rarity;
    weights?: RarityWeights;
  },
): Augment[] {
  const exclude = getRollExcludeIds(owned);
  let w = opts?.weights ?? getWeightsForPlayer(owned);
  w = applyRarityFilter(w, opts?.minRarity, opts?.maxRarity);
  const rolled = rollAugments(count, exclude, w);
  return applyGuaranteedUpgradeSlot(rolled, owned, exclude);
}

export const AUCTION_MIN_BID: Record<"P" | "N" | "B" | "R" | "Q", number> = {
  P: 5,
  N: 20,
  B: 20,
  R: 40,
  Q: 70,
};

export const AUCTION_PIECE_TYPES = ["P", "N", "B", "R", "Q"] as const;
export type AuctionPieceType = (typeof AUCTION_PIECE_TYPES)[number];

// ─── Max stack per augment ────────────────────────────────────────────────────

/** 1 = cannot be held twice; 99 = effectively infinite stacking. */
export const MAX_STACK: Record<string, number> = {
  "miner":               99,
  "alternative":         1,
  "mastermind":          1,
  "king-of-the-hill":    1,
  "oops":                2,
  "jew":                 2,
  "mastermind-plus":     1,
  "frost":               2,
  "what":                1,
  "necromancer":         2,
  "necromancer-plus":    1,
  "bloodlust":           1,
  "internal-combustion": 1,
  "royal-education":     1,
  "sako-bosphorus":      1,
  "royal-household":     1,
  "death-note":          1,
  "domain-expansion":    1,
  "impassable":          1,
  "puppet":              1,
  "contract-killer":     1,
  "sacrifice":           1,
  "blessed-water-spell": 2,
  "instant-cash":        99,
  "ilkkan":              1,
  "swap":                1,
  "prize-money":         1,
  "investment":          99,
  "efficient":           99,
  "thief":               99,
  "blind-rage":          1,
  "anticipation":        1,
  "evade":               2,
  "tax-man":             99,
  "free-passage":        1,
  "augmented":           1,
  "pawn-shop":           1,
  "mastermind-plus-plus": 1,
  "i-am-danger":         99,
  "alternative-plus":  1,
  "double-gold":       1,
  "horde":             1,
  "tall-politician":   1,
  "emperor-of-the-hill": 1,
  "plot-armour":       1,
  "bloodbending":      1,
  "bloodbending-plus": 1,
  "little-big-man":    1,
  "necromancer-plus-plus": 1,
};

// ─── Augments that cannot be purchased in the shop ────────────────────────────

export const NON_PURCHASABLE = new Set<string>([
  "mastermind",
  "mastermind-plus",
  "mastermind-plus-plus",
  "instant-cash",
  "prize-money",
  "double-gold",
  "domain-expansion",
  "contract-killer",
]);

// ─── Augment pool ─────────────────────────────────────────────────────────────

export const AUGMENT_POOL: Augment[] = [
  // ── Common ────────────────────────────────────────────────────────────────
  { id:"miner",        name:"Miner",        rarity:"common",   icon:"⛏️",   description:"Earn 2 gold every 3 turns. Infinitely stackable." },
  { id:"alternative",  name:"Alternative",  rarity:"common",   icon:"🛤️",   description:"Your rook-file pawns (a & h) may advance 3 squares on their first move." },
  { id:"mastermind",   name:"Mastermind",   rarity:"common",   icon:"🧠",   description:"Improves your augment roll chances (Common↓ Rare↑ Epic↑). Cannot be purchased in shop." },
  { id:"instant-cash", name:"Instant Cash", rarity:"common",   icon:"💰",   description:"Grants 10 gold instantly. Cannot be purchased in shop." },
  { id:"prize-money", name:"Prize Money", rarity:"common", icon:"🏆", description:"The game's first capture doubles that mover's gold for the half-move if they have Prize Money (once per game for everyone). Cannot be purchased in shop." },
  { id:"investment", name:"Investment", rarity:"common", icon:"📈", description:"Earn +1 gold at the end of each of your turns when you have more than 20 gold." },
  { id:"efficient", name:"Efficient", rarity:"common", icon:"⚡", description:"Gain +1 extra gold whenever you capture a piece (stacks with the normal capture payout)." },
  { id:"thief", name:"Thief", rarity:"common", icon:"🥷", description:"Each time you finish a turn, you have a 1% chance per Thief stack to gain 50 gold instantly." },
  { id:"blind-rage", name:"Blind Rage", rarity:"common", icon:"😤", description:"If you capture a knight before both sides have each completed four moves (four full rounds), gain one bonus augment pick (once per game)." },
  { id:"anticipation", name:"Anticipation", rarity:"common", icon:"🔮", description:"You do not lose gold from negative random board events only (e.g. Stock Crash)." },
  // ── Uncommon ──────────────────────────────────────────────────────────────
  { id:"king-of-the-hill", name:"King of the Hill", rarity:"uncommon", icon:"⛰️", description:"Each of your pieces on d4/d5/e4/e5 earns 1 gold per turn." },
  { id:"jew",          name:"Jew",          rarity:"uncommon", icon:"💎",   description:"When the enemy captures your pawns, you gain 2 gold per captured pawn." },
  { id:"alternative-plus", name:"Alternative+", rarity:"uncommon", icon:"🛤️✨", description:"All of your pawns may advance up to 3 squares on their first move (requires Alternative)." },
  { id:"mastermind-plus", name:"Mastermind+", rarity:"uncommon", icon:"🧠✨", description:"Further boosts roll chances (Rare↑↑ Epic↑↑ Legendary↑). Cannot be purchased in shop." },
  { id:"contract-killer",  name:"Contract Killer",  rarity:"uncommon", icon:"🎯", description:"Mark one enemy piece (not king or pawn). If you capture it, earn 3× its base gold value instead of 1. One mark per pick; the augment is spent when the contract ends (success or failure). Cannot be purchased in shop." },
  { id:"evade", name:"Evade", rarity:"uncommon", icon:"💨", description:"Spend a charge: during your opponent's next turn, they cannot use augment spells (shop still allowed)." },
  { id:"sacrifice", name:"Sacrifice", rarity:"uncommon", icon:"♜", description:"Spell: sacrifice one of your rooks. Gain a minimum rare-tier augment pick." },
  { id:"tax-man", name:"Tax Man", rarity:"uncommon", icon:"🧾", description:"When you finish a half-move, you earn 1 gold per full 10 gold your opponent gained from any source that half-move (per stack)." },
  { id:"free-passage", name:"Free Passage", rarity:"uncommon", icon:"🚪", description:"Your king may castle even while in check (normal castling path rules otherwise apply)." },
  { id:"augmented", name:"Augmented", rarity:"uncommon", icon:"✨", description:"You are offered 4 augment choices instead of 3 when rolling bonus picks." },
  { id:"necromancer",  name:"Necromancer",  rarity:"uncommon", icon:"💀",   description:"Bring one lost pawn back to its home square on the starting rank." },
  // ── Rare ──────────────────────────────────────────────────────────────────
  { id:"frost",        name:"Frost",        rarity:"rare",     icon:"❄️",   description:"Gain 1 freeze spell. Freeze one enemy piece — it cannot move for 2 half-turns." },
  { id:"what",         name:"What?",        rarity:"uncommon", icon:"↔️",   description:"Once, one of your pawns may move one square sideways to an empty square." },
  { id:"oops",         name:"Oops",         rarity:"rare",     icon:"↩️",   description:"Gain 1 undo. Roll back the last 2 half-moves once per game." },
  { id:"impassable",   name:"Impassable",   rarity:"rare",     icon:"🗿",   description:"Place an immovable, indestructible monolith on any empty square (spends a turn). Once removed, it is gone forever." },
  { id:"blessed-water-spell", name:"Blessed Water", rarity:"rare", icon:"💧", description:"Bless any square (instant, free). The piece on that square cannot be captured for 2 rounds." },
  { id:"ilkkan", name:"İlkkan", rarity:"rare", icon:"🧑", description:"You have no personality ilkkan. One of your pawns becomes İlkkan. If İlkkan captures a rook, bishop, or knight — it transforms into that piece." },
  { id:"swap", name:"Swap", rarity:"rare", icon:"🔀", description:"Once per game, exchange the positions of any two of your own pieces (spends your turn). Frozen pieces cannot be moved." },
  { id:"horde", name:"Horde", rarity:"rare", icon:"🐺", description:"When acquired, each of your pawns tries to step one square forward into an empty square (no captures)." },
  { id:"tall-politician", name:"Tall Politician", rarity:"rare", icon:"🎩", description:"Pay your income as tax. I will help you in need. (Collect your stored tax when you need it.)" },
  { id:"pawn-shop", name:"Pawn Shop", rarity:"rare", icon:"♙", description:"Buy pawns from the shop; place on empty squares of your original pawn rank (second rank), even on a 10×10 board. Placement does not spend a turn. Price starts at 5g and rises by 7g each purchase." },
  { id:"mastermind-plus-plus", name:"Mastermind++", rarity:"rare", icon:"🧠💫", description:"Further improves your augment roll rarity. Cannot be purchased in shop." },
  { id:"i-am-danger", name:"I am the danger", rarity:"rare", icon:"☠️👑", description:"Each time you give check to the enemy king, gain 4 gold (per stack)." },
  { id:"double-gold", name:"Double Gold", rarity:"rare", icon:"💰💰", description:"For the next 5 full rounds, all gold you gain is doubled (captures, events, augments, shop sells, etc.). Cannot be purchased in shop." },
  // ── Epic ──────────────────────────────────────────────────────────────────
  { id:"necromancer-plus", name:"Necromancer+", rarity:"epic", icon:"💀✨", description:"Revive your most recently lost knight or bishop to any empty square on your home rank." },
  { id:"bloodbending", name:"Bloodbending", rarity:"epic", icon:"🩸🧙", description:"Spell: flip one enemy pawn to your color (spends your turn; cannot target pawns on their original rank)." },
  { id:"bloodlust",    name:"Bloodlust",    rarity:"epic",     icon:"🩸",   description:"Every 4 enemy pieces you capture, gain 1 bonus augment pick." },
  { id:"internal-combustion", name:"Internal Combustion", rarity:"epic", icon:"💥", description:"The first enemy piece that checks your king explodes — removed, granting no gold." },
  { id:"royal-education", name:"Royal Education", rarity:"epic", icon:"♞👑", description:"Once, your king may move like a knight — even while in check." },
  { id:"death-note", name:"Death Note", rarity:"epic", icon:"☠️", description:"Choose an enemy piece (not king or queen). It dies after 16 turns (each half-move ticks the timer); the curse follows that piece by identity. Pieces killed this way grant no gold, no augment, and don't count as captures." },
  { id:"puppet",     name:"Puppet",    rarity:"epic", icon:"🪆",  description:"Once per game: mark any enemy piece (not king). On their next turn, the opponent MUST move that piece." },
  // ── Legendary ─────────────────────────────────────────────────────────────
  { id:"sako-bosphorus", name:"Şako Bosphorus", rarity:"legendary", icon:"⚓", description:"Buy the Experience — once, teleport any of your pieces to an unoccupied square (spends your turn)." },
  { id:"emperor-of-the-hill", name:"Emperor of the Hill", rarity:"legendary", icon:"👑⛰️", description:"Gain King of the Hill. If a pawn stays on a hill square for 2 full rounds, it promotes to a queen." },
  { id:"plot-armour", name:"Plot Armour", rarity:"legendary", icon:"🛡️", description:"Your king is immune to check and checkmate for 5 full rounds." },
  { id:"royal-household", name:"Royal Household", rarity:"legendary", icon:"🏰", description:"Trained by the finest knights — once, when your king is in check, it rampages UP TO 4 squares in a straight line, destroying every piece in its path (friend or foe)." },
  { id:"domain-expansion", name:"DOMAIN EXPANSION", rarity:"legendary", icon:"♾️", description:"Each team with this augment may expand once (up to two per game). 1v1: 8×8→10×10 (files x/i, ranks 0/9) then 12×12 (y/j, -1/10). 2v2: 8×16→10×18 (files x/r, ranks 0/9) then 12×20 (y/s, -1/10) — two rooks per expansion (one for each teammate on that team). Pieces keep the same squares relative to the center." },
  { id:"little-big-man", name:"Little Big Man", rarity:"legendary", icon:"👶👑", description:"Spell: choose any of your pawns. For 4 full rounds it moves and captures like a queen, then reverts." },
  { id:"bloodbending-plus", name:"Bloodbending+", rarity:"legendary", icon:"🩸✨", description:"Spell: flip one enemy knight, bishop, or rook to your color (requires Bloodbending)." },
  { id:"necromancer-plus-plus", name:"Necromancer++", rarity:"legendary", icon:"💀💫", description:"Spell: place a revived queen on an empty home-rank square (requires Necromancer+)." },
];

/** Exclude maxed stacks and augments whose prerequisite is not owned. */
export function getRollExcludeIds(held: Augment[]): string[] {
  const counts: Record<string, number> = {};
  for (const a of held) counts[a.id] = (counts[a.id] || 0) + 1;
  const maxed = Object.keys(counts).filter(
    (id) => counts[id] >= (MAX_STACK[id] ?? 1),
  );
  const ownedIds = Object.keys(counts);
  const prereqLocked = AUGMENT_POOL.filter((a) =>
    augmentExcludedByPrereq(a.id, ownedIds),
  ).map((a) => a.id);
  return Array.from(new Set([...maxed, ...prereqLocked]));
}

// ─── Weighted random roll ─────────────────────────────────────────────────────

export function rollAugments(
  count: number,
  exclude: string[] = [],
  weights: RarityWeights = DEFAULT_WEIGHTS,
): Augment[] {
  const pool = AUGMENT_POOL.filter(a => !exclude.includes(a.id) && weights[a.rarity] > 0);
  const result: Augment[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count; i++) {
    const available = pool.filter(a => !used.has(a.id));
    if (available.length === 0) break;
    const total = available.reduce((s, a) => s + weights[a.rarity], 0);
    if (total === 0) break;
    let rand = Math.random() * total;
    let picked = available[available.length - 1];
    for (const aug of available) { rand -= weights[aug.rarity]; if (rand <= 0) { picked = aug; break; } }
    used.add(picked.id);
    result.push(picked);
  }
  return result;
}

/** Bonus augment rolls: 4 choices with Augmented, otherwise 3. */
export function pickAugmentCount(heldAugments: Augment[]): number {
  return heldAugments.some((a) => a.id === "augmented") ? 4 : 3;
}
