// ─────────────────────────────────────────────────────────────────────────────
// Augment definitions — Phase 1: data & pool only, effects wired in Phase 2
// ─────────────────────────────────────────────────────────────────────────────

export type Rarity = "common" | "rare" | "epic";

export interface Augment {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  icon: string;
}

export const RARITY_META: Record<Rarity, {
  border: string; glow: string; badge: string; text: string; label: string;
}> = {
  common: {
    border: "#4b5563",
    glow: "rgba(75,85,99,0.25)",
    badge: "#1f2937",
    text: "#9ca3af",
    label: "Common",
  },
  rare: {
    border: "#3b82f6",
    glow: "rgba(59,130,246,0.35)",
    badge: "#1d3a6e",
    text: "#93c5fd",
    label: "Rare",
  },
  epic: {
    border: "#a855f7",
    glow: "rgba(168,85,247,0.45)",
    badge: "#4c1d95",
    text: "#d8b4fe",
    label: "Epic",
  },
};

export const AUGMENT_POOL: Augment[] = [
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
    id: "fortify",
    name: "Fortify",
    description: "Your rooks can move one additional square per turn.",
    rarity: "common",
    icon: "🏰",
  },
  {
    id: "merchants-eye",
    name: "Merchant's Eye",
    description: "Start the game with 3 bonus gold.",
    rarity: "common",
    icon: "💼",
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
  {
    id: "last-stand",
    name: "Last Stand",
    description: "When your queen is captured, earn gold equal to its value.",
    rarity: "rare",
    icon: "🏳️",
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
  {
    id: "undying-pawn",
    name: "Undying Pawn",
    description: "Once per game, one of your captured pawns is returned to its last square.",
    rarity: "epic",
    icon: "🔁",
  },
];

/** Return `count` random augments, optionally excluding certain IDs. */
export function rollAugments(count: number, exclude: string[] = []): Augment[] {
  const pool = AUGMENT_POOL.filter(a => !exclude.includes(a.id));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
