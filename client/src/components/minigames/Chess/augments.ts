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
};

// ─── Augments that cannot be purchased in the shop ────────────────────────────

export const NON_PURCHASABLE = new Set<string>([
  "mastermind",
  "mastermind-plus",
  "mastermind-plus-plus",
  "instant-cash",
]);

// ─── Augment pool ─────────────────────────────────────────────────────────────

export const AUGMENT_POOL: Augment[] = [
  // ── Common ────────────────────────────────────────────────────────────────
  { id:"miner",        name:"Miner",        rarity:"common",   icon:"⛏️",   description:"Earn 2 gold every 3 turns. Infinitely stackable." },
  { id:"alternative",  name:"Alternative",  rarity:"common",   icon:"🛤️",   description:"Your rook-file pawns (a & h) may advance 3 squares on their first move." },
  { id:"mastermind",   name:"Mastermind",   rarity:"common",   icon:"🧠",   description:"Improves your augment roll chances (Common↓ Rare↑ Epic↑). Cannot be purchased in shop." },
  { id:"instant-cash", name:"Instant Cash", rarity:"common",   icon:"💰",   description:"Grants 10 gold instantly. Cannot be purchased in shop." },
  { id:"prize-money", name:"Prize Money", rarity:"common", icon:"🏆", description:"Your first capture of the game grants double gold from the capture bonus." },
  { id:"investment", name:"Investment", rarity:"common", icon:"📈", description:"Earn +1 gold at the end of each of your turns when you have more than 20 gold." },
  { id:"efficient", name:"Efficient", rarity:"common", icon:"⚡", description:"Gain +1 extra gold whenever you capture a piece (stacks with the normal capture payout)." },
  { id:"thief", name:"Thief", rarity:"common", icon:"🥷", description:"Each time you finish a turn, you have a 1% chance per Thief stack to gain 50 gold instantly." },
  { id:"blind-rage", name:"Blind Rage", rarity:"common", icon:"😤", description:"If you capture a knight in your first 4 turns, gain one bonus augment pick (once per game)." },
  { id:"anticipation", name:"Anticipation", rarity:"common", icon:"🔮", description:"You do not lose gold from negative board events (e.g. Stock Crash)." },
  // ── Uncommon ──────────────────────────────────────────────────────────────
  { id:"king-of-the-hill", name:"King of the Hill", rarity:"uncommon", icon:"⛰️", description:"Each of your pieces on d4/d5/e4/e5 earns 1 gold per turn." },
  { id:"jew",          name:"Jew",          rarity:"uncommon", icon:"💎",   description:"When the enemy captures your pawns, you gain 2 gold per captured pawn." },
  { id:"mastermind-plus", name:"Mastermind+", rarity:"uncommon", icon:"🧠✨", description:"Further boosts roll chances (Rare↑↑ Epic↑↑ Legendary↑). Cannot be purchased in shop." },
  { id:"contract-killer",  name:"Contract Killer",  rarity:"uncommon", icon:"🎯", description:"Mark one enemy piece (not king or pawn). If you capture it, earn 4× its base gold value instead of 1. One mark per pick; the augment is spent when the contract ends (success or failure)." },
  { id:"evade", name:"Evade", rarity:"uncommon", icon:"💨", description:"Spend a charge: during your opponent's next turn, they cannot use augment spells or the shop." },
  { id:"tax-man", name:"Tax Man", rarity:"uncommon", icon:"🧾", description:"Whenever your opponent gains gold on a half-move, you earn 1 gold for each full 10 they gained (per stack)." },
  { id:"free-passage", name:"Free Passage", rarity:"uncommon", icon:"🚪", description:"Your king may castle even while in check (normal castling path rules otherwise apply)." },
  { id:"augmented", name:"Augmented", rarity:"uncommon", icon:"✨", description:"You are offered 4 augment choices instead of 3 when rolling bonus picks." },
  // ── Rare ──────────────────────────────────────────────────────────────────
  { id:"frost",        name:"Frost",        rarity:"rare",     icon:"❄️",   description:"Gain 1 freeze spell. Freeze one enemy piece — it cannot move for 1 turn." },
  { id:"what",         name:"What?",        rarity:"uncommon", icon:"↔️",   description:"Once, one of your pawns may move one square sideways to an empty square." },
  { id:"oops",         name:"Oops",         rarity:"rare",     icon:"↩️",   description:"Gain 1 undo. Roll back the last 2 half-moves once per game." },
  { id:"impassable",   name:"Impassable",   rarity:"rare",     icon:"🗿",   description:"Place an immovable, indestructible monolith on any empty square (spends a turn). Once removed, it is gone forever." },
  { id:"necromancer",  name:"Necromancer",  rarity:"rare",     icon:"💀",   description:"Bring one lost pawn back to its home square on the starting rank." },
  { id:"blessed-water-spell", name:"Blessed Water", rarity:"rare", icon:"💧", description:"Bless any square (instant, free). The piece on that square cannot be captured for 2 rounds." },
  { id:"ilkkan", name:"İlkkan", rarity:"rare", icon:"🧑", description:"You have no personality ilkkan. One of your pawns becomes İlkkan. If İlkkan captures a rook, bishop, or knight — it transforms into that piece." },
  { id:"swap", name:"Swap", rarity:"rare", icon:"🔀", description:"Once per game, exchange the positions of any two of your own pieces (free action). Frozen pieces cannot be moved." },
  { id:"pawn-shop", name:"Pawn Shop", rarity:"rare", icon:"♙", description:"Buy pawns from the shop; they appear on empty original pawn squares. First pawn costs 10g, then +10g each purchase." },
  { id:"mastermind-plus-plus", name:"Mastermind++", rarity:"rare", icon:"🧠💫", description:"Further improves your augment roll rarity. Cannot be purchased in shop." },
  { id:"i-am-danger", name:"I Am Danger", rarity:"rare", icon:"☠️👑", description:"Each time you give check to the enemy king, gain 4 gold (per stack)." },
  // ── Epic ──────────────────────────────────────────────────────────────────
  { id:"necromancer-plus", name:"Necromancer+", rarity:"epic", icon:"💀✨", description:"Revive your most recently lost knight or bishop to any empty square on your home rank." },
  { id:"bloodlust",    name:"Bloodlust",    rarity:"epic",     icon:"🩸",   description:"Every 4 enemy pieces you capture, gain 1 bonus augment pick." },
  { id:"internal-combustion", name:"Internal Combustion", rarity:"epic", icon:"💥", description:"The first enemy piece that checks your king explodes — removed, granting no gold." },
  { id:"royal-education", name:"Royal Education", rarity:"epic", icon:"♞👑", description:"Once, your king may move like a knight." },
  { id:"death-note", name:"Death Note", rarity:"epic", icon:"☠️", description:"Choose an enemy piece (not king or queen). It dies after 16 turns (each half-move ticks the timer); the curse follows that piece by identity. Pieces killed this way grant no gold, no augment, and don't count as captures." },
  { id:"puppet",     name:"Puppet",    rarity:"epic", icon:"🪆",  description:"Once per game: mark any enemy piece (not king). On their next turn, the opponent MUST move that piece." },
  // ── Legendary ─────────────────────────────────────────────────────────────
  { id:"sako-bosphorus", name:"Şako Bosphorus", rarity:"legendary", icon:"⚓", description:"Buy the Experience — once, teleport any of your pieces to an unoccupied square." },
  { id:"royal-household", name:"Royal Household", rarity:"legendary", icon:"🏰", description:"Trained by the finest knights — once, when your king is in check, it rampages UP TO 4 squares in a straight line, destroying every piece in its path (friend or foe)." },
  { id:"domain-expansion", name:"DOMAIN EXPANSION", rarity:"legendary", icon:"♾️", description:"Expand the board from 8×8 to 10×10. New peripheral squares (file x, file i, rank 0, rank 9) are added empty. No piece moves during expansion." },
];

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
