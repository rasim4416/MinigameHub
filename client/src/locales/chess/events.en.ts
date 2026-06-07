import type { EventLocaleEntry } from "./types";

export const EVENTS_EN: Record<string, EventLocaleEntry> = {
  "golden-age": {
    "name": "Golden Age",
    "description": "Each player earns 10 gold instantly.",
    "flavor": "Prosperity fills the land."
  },
  "peace-treaty": {
    "name": "Peace Treaty",
    "description": "No gold earned from capturing pieces for the next 3 rounds.",
    "flavor": "A temporary ceasefire has been declared."
  },
  "blessed-waters": {
    "name": "Blessed Waters",
    "description": "A random square between ranks 3–6 is blessed. The piece standing on it cannot be captured for 3 rounds.",
    "flavor": "The waters protect the chosen."
  },
  "lost-mercenary": {
    "name": "Lost Mercenary",
    "description": "An orange mercenary pawn appears on the left flank. After each full move it marches east, or captures by sight (Q>R>N>B>P). It cannot take a king. After it reaches the last file, it departs on the next full move.",
    "flavor": "No banner, no master — only the next square."
  },
  "cold-winds": {
    "name": "Cold Winds",
    "description": "2 random pieces from each player (except kings) are frozen and cannot move for 1 round.",
    "flavor": "The battlefield falls silent."
  },
  "stock-crash": {
    "name": "Stock Crash",
    "description": "Both players lose 10 gold.",
    "flavor": "The markets have spoken."
  },
  "great-wall-of-hatay": {
    "name": "Great Wall of Hatay",
    "description": "3 consecutive free squares (horizontal or vertical) are walled off for 2 rounds. No piece may enter or pass through them. If no valid span exists, this event has no effect.",
    "flavor": "A wall rises overnight."
  },
  "tactical-nuke": {
    "name": "Tactical Nuke Incoming",
    "description": "A random 3×3 area is targeted. All pieces inside will be destroyed after 5 rounds.",
    "flavor": "\"Incoming!\""
  },
  "mercenary-patrol": {
    "name": "Mercenary Patrol",
    "description": "Two orange mercenary knights appear on the left and right files (a and i on an expanded board). After each full round each makes a random legal knight move until captured. They cannot take a king or land on monoliths.",
    "flavor": "Hooves in the dark — no allegiance, no rest."
  },
  "red-wedding": {
    "name": "Red Wedding",
    "description": "2 random pawns from each player are slain.",
    "flavor": "\"The Lannisters send their regards.\""
  },
  "siege-patrol": {
    "name": "Siege Patrol",
    "description": "An orange mercenary knight and rook appear on the left and right flank files. After each full round they each make one random legal move like other mercenaries.",
    "flavor": "Engines of war — no banner, no master."
  },
  "just-chaos": {
    "name": "Just Chaos",
    "description": "Board events now fire every 5 full rounds (instead of 5–13 at random) for the rest of the game.",
    "flavor": "\"Let the world burn.\""
  },
  "crusaders": {
    "name": "Crusaders",
    "description": "Four orange mercenaries — queen, bishop, knight, and rook — appear on random inner squares. Deus Vult.",
    "flavor": "Deus Vult."
  },
  "winter-has-come": {
    "name": "Winter Has Come",
    "description": "A random empty square is frozen forever. No piece may move onto or through it; pawn shop and similar placements are blocked.",
    "flavor": "The cold remembers."
  },
  "valar-morghulis": {
    "name": "Valar Morghulis",
    "description": "All normal white and black pawns are removed from the board. Orange mercenary pawns are spared. İlkkan is cleared if it was a pawn.",
    "flavor": "All men must die."
  },
  "more-more-moreeee": {
    "name": "More-More-MOREEEE",
    "description": "Both players gain an additional augment choosing option. Guaranteed rare or higher tier.",
    "flavor": "Both players gain an additional augment."
  },
  "tea-party": {
    "name": "Tea Party",
    "description": "Gain King of the Hill and 2 pawns on the hill squares. If you already own King of the Hill, improve it instead.",
    "flavor": "Gain King of the hill and 2 pawns."
  },
  "capitulations": {
    "name": "Capitulations",
    "description": "Shop prices reset to their original values. Improvements are not reverted.",
    "flavor": "Shop prices have been reset."
  },
  "common-knowledge": {
    "name": "Common Knowledge",
    "description": "Both players gain an additional augment choosing option. Guaranteed rare or lower tier.",
    "flavor": "Gain an additional augment option."
  },
  "apocalypse": {
    "name": "Apocalypse",
    "description": "Edge files and ranks are marked. After 10 full rounds, all pieces in those zones are destroyed.",
    "flavor": "Time is ticking."
  }
} as Record<string, EventLocaleEntry>;
