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

export const DEFAULT_WEIGHTS: RarityWeights     = { common:50, uncommon:30, rare:15, epic:5,  legendary:0 };
export const MASTERMIND_WEIGHTS: RarityWeights  = { common:35, uncommon:30, rare:20, epic:15, legendary:0 };
export const MASTERMIND_PLUS_WEIGHTS: RarityWeights = { common:30, uncommon:20, rare:30, epic:20, legendary:0 };
export const MASTERMIND_BOTH_WEIGHTS: RarityWeights = { common:15, uncommon:20, rare:40, epic:20, legendary:5 };

export function getWeightsForPlayer(augments: Augment[]): RarityWeights {
  const hasMM  = augments.some(a => a.id === "mastermind");
  const hasMMP = augments.some(a => a.id === "mastermind-plus");
  if (hasMM && hasMMP) return MASTERMIND_BOTH_WEIGHTS;
  if (hasMMP) return MASTERMIND_PLUS_WEIGHTS;
  if (hasMM)  return MASTERMIND_WEIGHTS;
  return DEFAULT_WEIGHTS;
}

// ─── Max stack per augment (how many times a player can hold it) ──────────────

/** 1 = cannot be bought/held twice; 2 = can stack once (up to 2 total). */
export const MAX_STACK: Record<string, number> = {
  "miner":               2,
  "alternative":         1,
  "mastermind":          1,
  "king-of-the-hill":    1,
  "oops":                2,
  "jew":                 2,
  "mastermind-plus":     1,
  "frost":               2,
  "what":                1,
  "necromancer":         2,
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
};

// ─── Augment pool ─────────────────────────────────────────────────────────────

export const AUGMENT_POOL: Augment[] = [
  // ── Common ────────────────────────────────────────────────────────────────
  { id:"miner",        name:"Miner",        rarity:"common",   icon:"⛏️",   description:"Earn 1 gold every 2 turns." },
  { id:"alternative",  name:"Alternative",  rarity:"common",   icon:"🛤️",   description:"Your rook-file pawns (a & h) may advance 3 squares on their first move." },
  { id:"mastermind",   name:"Mastermind",   rarity:"common",   icon:"🧠",   description:"Improves your augment roll chances (Common↓ Rare↑ Epic↑)." },
  // ── Uncommon ──────────────────────────────────────────────────────────────
  { id:"king-of-the-hill", name:"King of the Hill", rarity:"uncommon", icon:"⛰️", description:"Each of your pieces on d4/d5/e4/e5 earns 1 gold per turn." },
  { id:"oops",         name:"Oops",         rarity:"uncommon", icon:"↩️",   description:"Gain 1 undo. Roll back the last 2 half-moves once per game." },
  { id:"jew",          name:"Jew",          rarity:"uncommon", icon:"💎",   description:"When the enemy captures your pawns, you gain 1 gold per captured pawn." },
  { id:"mastermind-plus", name:"Mastermind+", rarity:"uncommon", icon:"🧠✨", description:"Further boosts roll chances (Rare↑↑ Epic↑↑). Stacks with Mastermind." },
  // ── Rare ──────────────────────────────────────────────────────────────────
  { id:"frost",        name:"Frost",        rarity:"rare",     icon:"❄️",   description:"Gain 1 freeze spell. Freeze one enemy piece — it cannot move for 1 turn." },
  { id:"what",         name:"What?",        rarity:"rare",     icon:"↔️",   description:"Once, one of your pawns may move one square sideways to an empty square." },
  { id:"impassable",       name:"Impassable",       rarity:"rare",   icon:"🗿",   description:"Place an immovable, indestructible monolith on any empty square (spends a turn). You may remove it for free at any time." },
  { id:"contract-killer",  name:"Contract Killer",  rarity:"common", icon:"🎯",   description:"Mark one enemy piece (not king or pawn). If you capture it, earn 4× its base gold value instead of 1." },
  { id:"blessed-water-spell", name:"Blessed Water", rarity:"rare",   icon:"💧",   description:"Bless any square (instant, free). The piece on that square cannot be captured for 2 rounds." },
  // ── Epic ──────────────────────────────────────────────────────────────────
  { id:"necromancer",  name:"Necromancer",  rarity:"epic",     icon:"💀",   description:"Bring one lost pawn back to its home square on the starting rank." },
  { id:"bloodlust",    name:"Bloodlust",    rarity:"epic",     icon:"🩸",   description:"Every 4 enemy pieces you capture, gain 1 bonus augment pick." },
  { id:"internal-combustion", name:"Internal Combustion", rarity:"epic", icon:"💥", description:"The first enemy piece that checks your king explodes — removed, granting no gold." },
  { id:"royal-education", name:"Royal Education", rarity:"epic", icon:"♞👑", description:"Once, your king may move like a knight." },
  // ── Legendary ─────────────────────────────────────────────────────────────
  { id:"sako-bosphorus", name:"Şako Bosphorus", rarity:"legendary", icon:"⚓", description:"Buy the Experience — once, teleport any of your pieces to an unoccupied square in your half of the board." },
  { id:"royal-household", name:"Royal Household", rarity:"legendary", icon:"🏰", description:"Trained by the finest knights — once, when your king is in check, it rampages UP TO 4 squares in a straight line, destroying every piece in its path (friend or foe)." },
  { id:"death-note", name:"Death Note", rarity:"epic", icon:"☠️", description:"Choose an enemy piece (not king or queen). It dies after 5 rounds. Pieces killed this way grant no gold, no augment, and don't count as captures." },
  { id:"puppet",     name:"Puppet",    rarity:"epic", icon:"🪆",  description:"Once per game: mark any enemy piece (not king). On their next turn, the opponent MUST move that piece." },
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
