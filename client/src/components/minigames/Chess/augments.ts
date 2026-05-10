// ─────────────────────────────────────────────────────────────────────────────
// Augment system — 5-tier rarity, weighted rolls, effect data
// ─────────────────────────────────────────────────────────────────────────────

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface Augment {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  icon: string;
}

// ─── Rarity appearance (glow increases with tier) ────────────────────────────

export const RARITY_META: Record<Rarity, {
  border: string; glow: string; badge: string; text: string; label: string;
  shimmer?: string; // extra gradient for legendary
}> = {
  common: {
    border: "#6b7280",
    glow: "rgba(156,163,175,0.15)",
    badge: "#1f2937",
    text: "#d1d5db",
    label: "Common",
  },
  uncommon: {
    border: "#22c55e",
    glow: "rgba(34,197,94,0.30)",
    badge: "#14532d",
    text: "#86efac",
    label: "Uncommon",
  },
  rare: {
    border: "#3b82f6",
    glow: "rgba(59,130,246,0.40)",
    badge: "#1d3a6e",
    text: "#93c5fd",
    label: "Rare",
  },
  epic: {
    border: "#a855f7",
    glow: "rgba(168,85,247,0.55)",
    badge: "#4c1d95",
    text: "#d8b4fe",
    label: "Epic",
  },
  legendary: {
    border: "#eab308",
    glow: "rgba(234,179,8,0.70)",
    badge: "#422006",
    text: "#fde047",
    label: "Legendary",
    shimmer: "linear-gradient(90deg,#eab308,#f59e0b,#fde047,#f59e0b,#eab308)",
  },
};

// ─── Roll weights ──────────────────────────────────────────────────────────────

export type RarityWeights = Record<Rarity, number>;

export const DEFAULT_WEIGHTS: RarityWeights = {
  common: 50, uncommon: 30, rare: 15, epic: 5, legendary: 0,
};

/** Applied when the rolling player owns the Mastermind augment. */
export const MASTERMIND_WEIGHTS: RarityWeights = {
  common: 35, uncommon: 30, rare: 20, epic: 15, legendary: 0,
};

// ─── Augment pool ─────────────────────────────────────────────────────────────

export const AUGMENT_POOL: Augment[] = [
  // ── Common (implemented) ──────────────────────────────────────────────────
  {
    id: "miner",
    name: "Miner",
    description: "Earn 1 gold every 2 turns.",
    rarity: "common",
    icon: "⛏️",
  },
  {
    id: "alternative",
    name: "Alternative",
    description: "Your rook-file pawns (a & h columns) may advance 3 squares on their first move.",
    rarity: "common",
    icon: "🛤️",
  },
  {
    id: "mastermind",
    name: "Mastermind",
    description: "Increases your chance of receiving higher-tier augments in all future rolls.",
    rarity: "common",
    icon: "🧠",
  },
  // ── Uncommon (implemented) ────────────────────────────────────────────────
  {
    id: "king-of-the-hill",
    name: "King of the Hill",
    description: "Each of your pieces on a center square (d4/d5/e4/e5) earns 1 gold per turn.",
    rarity: "uncommon",
    icon: "⛰️",
  },
  {
    id: "oops",
    name: "Oops",
    description: "Gain 1 undo. You may undo your last move once per game.",
    rarity: "uncommon",
    icon: "↩️",
  },
  {
    id: "jew",
    name: "Jew",
    description: "When the enemy captures your pawns, you gain 1 gold per captured pawn.",
    rarity: "uncommon",
    icon: "💎",
  },
  // ── Common ────────────────────────────────────────────────────────────────
  {
    id: "iron-pawns",
    name: "Iron Pawns",
    description: "Your pawns cannot be captured on the turn they first advance.",
    rarity: "common",
    icon: "🛡️",
  },
  {
    id: "bishops-tithe",
    name: "Bishop's Tithe",
    description: "Capturing with a bishop earns 2 bonus gold.",
    rarity: "common",
    icon: "✝️",
  },
  {
    id: "steady-march",
    name: "Steady March",
    description: "Each pawn that reaches rank 5 earns 1 bonus gold.",
    rarity: "common",
    icon: "🪖",
  },
  {
    id: "merchants-eye",
    name: "Merchant's Eye",
    description: "Start the game with 3 bonus gold.",
    rarity: "common",
    icon: "💼",
  },
  // ── Uncommon ──────────────────────────────────────────────────────────────
  {
    id: "fortify",
    name: "Fortify",
    description: "Your rooks can move one additional square per turn.",
    rarity: "uncommon",
    icon: "🏰",
  },
  {
    id: "last-stand",
    name: "Last Stand",
    description: "When your queen is captured, earn gold equal to its value.",
    rarity: "uncommon",
    icon: "🏳️",
  },
  // ── Rare ──────────────────────────────────────────────────────────────────
  {
    id: "gold-rush",
    name: "Gold Rush",
    description: "Earn double gold from all piece captures.",
    rarity: "rare",
    icon: "💰",
  },
  {
    id: "silver-rook",
    name: "Silver Rook",
    description: "Your rooks earn 2 bonus gold when capturing knights or bishops.",
    rarity: "rare",
    icon: "🥈",
  },
  {
    id: "berserker",
    name: "Berserker",
    description: "Your knights deal splash — also capturing pawns adjacent to their landing square.",
    rarity: "rare",
    icon: "⚔️",
  },
  {
    id: "shadow-bishop",
    name: "Shadow Bishop",
    description: "One of your bishops is hidden from your opponent's view.",
    rarity: "rare",
    icon: "🌑",
  },
  // ── Epic ──────────────────────────────────────────────────────────────────
  {
    id: "ghost-step",
    name: "Ghost Step",
    description: "Once per game, your king may pass through an occupied square.",
    rarity: "epic",
    icon: "👻",
  },
  {
    id: "royal-gambit",
    name: "Royal Gambit",
    description: "Once per game, your queen may move as a knight.",
    rarity: "epic",
    icon: "👑",
  },
  {
    id: "chain-capture",
    name: "Chain Capture",
    description: "After capturing a piece, you may immediately take one additional move.",
    rarity: "epic",
    icon: "🔗",
  },
  {
    id: "time-warp",
    name: "Time Warp",
    description: "Once per game, undo your last move after seeing the opponent's response.",
    rarity: "epic",
    icon: "⏪",
  },
  // ── Legendary ─────────────────────────────────────────────────────────────
  {
    id: "undying-pawn",
    name: "Undying Pawn",
    description: "Once per game, one of your captured pawns is returned to its last square.",
    rarity: "legendary",
    icon: "🔁",
  },
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

    const totalWeight = available.reduce((s, a) => s + weights[a.rarity], 0);
    if (totalWeight === 0) break;

    let rand = Math.random() * totalWeight;
    let picked = available[available.length - 1];
    for (const aug of available) {
      rand -= weights[aug.rarity];
      if (rand <= 0) { picked = aug; break; }
    }
    used.add(picked.id);
    result.push(picked);
  }

  return result;
}
