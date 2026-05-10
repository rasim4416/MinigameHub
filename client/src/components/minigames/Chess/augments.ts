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
  shimmer?: string;
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

// ─── Roll weights ─────────────────────────────────────────────────────────────

export type RarityWeights = Record<Rarity, number>;

export const DEFAULT_WEIGHTS: RarityWeights = {
  common: 50, uncommon: 30, rare: 15, epic: 5, legendary: 0,
};

/** Applied when the rolling player owns the Mastermind augment. */
export const MASTERMIND_WEIGHTS: RarityWeights = {
  common: 35, uncommon: 30, rare: 20, epic: 15, legendary: 0,
};

// ─── Augment pool (only implemented augments) ─────────────────────────────────

export const AUGMENT_POOL: Augment[] = [
  // ── Common ────────────────────────────────────────────────────────────────
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
  // ── Uncommon ──────────────────────────────────────────────────────────────
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
    description: "Gain 1 undo. You may undo the last 2 half-moves once per game.",
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
  // ── Rare ──────────────────────────────────────────────────────────────────
  {
    id: "frost",
    name: "Frost",
    description: "Gain 1 freeze spell. Freeze one enemy piece — it cannot move for 1 turn.",
    rarity: "rare",
    icon: "❄️",
  },
  // ── Epic ──────────────────────────────────────────────────────────────────
  {
    id: "necromancer",
    name: "Necromancer",
    description: "Bring one of your lost pawns back to its last square. Cannot use if that square is occupied.",
    rarity: "epic",
    icon: "💀",
  },
  {
    id: "bloodlust",
    name: "Bloodlust",
    description: "Every 4 enemy pieces you capture, gain 1 bonus augment pick.",
    rarity: "epic",
    icon: "🩸",
  },
  {
    id: "internal-combustion",
    name: "Internal Combustion",
    description: "The first enemy piece that checks your king explodes — removed from the board, granting no gold.",
    rarity: "epic",
    icon: "💥",
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
