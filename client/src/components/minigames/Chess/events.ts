// ─────────────────────────────────────────────────────────────────────────────
// Events system — random board events every 15 full turns (30 half-moves)
// ─────────────────────────────────────────────────────────────────────────────

export type EventRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface GameEvent {
  id: string;
  name: string;
  rarity: EventRarity;
  description: string;
  flavor?: string;
  icon: string;
}

// ─── Rarity appearance ───────────────────────────────────────────────────────

export const EVENT_RARITY_META: Record<EventRarity, {
  border: string; glow: string; badge: string; text: string; label: string;
}> = {
  common: {
    border: "#6b7280", glow: "rgba(156,163,175,0.15)",
    badge: "#1f2937", text: "#d1d5db", label: "Common",
  },
  uncommon: {
    border: "#22c55e", glow: "rgba(34,197,94,0.30)",
    badge: "#052e16", text: "#86efac", label: "Uncommon",
  },
  rare: {
    border: "#3b82f6", glow: "rgba(59,130,246,0.40)",
    badge: "#1e3a5f", text: "#93c5fd", label: "Rare",
  },
  epic: {
    border: "#a855f7", glow: "rgba(168,85,247,0.45)",
    badge: "#3b0764", text: "#d8b4fe", label: "Epic",
  },
  legendary: {
    border: "#f59e0b", glow: "rgba(245,158,11,0.60)",
    badge: "#451a03", text: "#fde68a", label: "Legendary",
  },
};

// ─── Event pool ───────────────────────────────────────────────────────────────

export const EVENT_POOL: GameEvent[] = [
  {
    id: "golden-age",
    name: "Golden Age",
    rarity: "common",
    icon: "🌟",
    description: "Each player earns 10 gold instantly.",
    flavor: "Prosperity fills the land.",
  },
  {
    id: "peace-treaty",
    name: "Peace Treaty",
    rarity: "common",
    icon: "🕊️",
    description: "No gold earned from capturing pieces for the next 5 rounds.",
    flavor: "A temporary ceasefire has been declared.",
  },
  {
    id: "blessed-waters",
    name: "Blessed Waters",
    rarity: "uncommon",
    icon: "💧",
    description: "A random square between ranks 3–6 is blessed. The piece standing on it cannot be captured for 3 rounds.",
    flavor: "The waters protect the chosen.",
  },
  {
    id: "cold-winds",
    name: "Cold Winds",
    rarity: "uncommon",
    icon: "🌬️",
    description: "2 random pieces from each player (except kings) are frozen and cannot move for 1 round.",
    flavor: "The battlefield falls silent.",
  },
  {
    id: "stock-crash",
    name: "Stock Crash",
    rarity: "rare",
    icon: "📉",
    description: "Both players lose 10 gold.",
    flavor: "The markets have spoken.",
  },
  {
    id: "great-wall-of-hatay",
    name: "Great Wall of Hatay",
    rarity: "rare",
    icon: "🧱",
    description: "3 consecutive free squares (horizontal or vertical) are walled off for 2 rounds. No piece may enter or pass through them. If no valid span exists, this event has no effect.",
    flavor: "A wall rises overnight.",
  },
  {
    id: "tactical-nuke",
    name: "Tactical Nuke Incoming",
    rarity: "rare",
    icon: "☢️",
    description: "A random 3×3 area is targeted. All pieces inside will be destroyed after 5 rounds.",
    flavor: "\"Incoming!\"",
  },
  {
    id: "red-wedding",
    name: "Red Wedding",
    rarity: "epic",
    icon: "🩸",
    description: "2 random pawns from each player are slain.",
    flavor: "\"The Lannisters send their regards.\"",
  },
  {
    id: "just-chaos",
    name: "Just Chaos",
    rarity: "legendary",
    icon: "🌀",
    description: "Events now trigger every 5 rounds instead of 15, for the rest of the game.",
    flavor: "\"Let the world burn.\"",
  },
];

// ─── Weighted roll ────────────────────────────────────────────────────────────

const RARITY_WEIGHTS: Record<EventRarity, number> = {
  common:    44,
  uncommon:  25,
  rare:      20,
  epic:       9,
  legendary:  2,
};

export function rollEvent(): GameEvent {
  const total = (Object.values(RARITY_WEIGHTS) as number[]).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  let chosenRarity: EventRarity = "common";
  for (const entry of Object.entries(RARITY_WEIGHTS) as [EventRarity, number][]) {
    roll -= entry[1];
    if (roll <= 0) { chosenRarity = entry[0]; break; }
  }
  const pool = EVENT_POOL.filter(e => e.rarity === chosenRarity);
  if (!pool.length) return EVENT_POOL[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Returns 30 half-moves (15 full turns) between events (default). */
export function nextEventInterval(): number {
  return 30;
}
