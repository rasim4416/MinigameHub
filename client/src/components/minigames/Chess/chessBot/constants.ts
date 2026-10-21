/** Minimum centipawn gain to cast a free spell (frost, blessed water). */
export const FREE_SPELL_THRESHOLD_CP = 30;

/** Minimum centipawn gain to spend turn on monolith vs moving. */
export const TURN_SPELL_THRESHOLD_CP = 50;

/** Main root search (MultiPV) once the opening is over. */
export const ROOT_MOVETIME_MS = 800;
/** Root search while the position is still close to book. */
export const OPENING_ROOT_MOVETIME_MS = 350;
export const OPENING_FULL_MOVES = 6;
/** Short fixed-depth probes used for spell/threat counterfactuals. */
export const PROBE_MOVETIME_MS = 100;
export const PROBE_MAX_DEPTH = 12;
/** Hard ceiling for one bot decision, including every probe. */
export const DECISION_BUDGET_MS = 2600;
/** Leave this much budget unspent before starting another probe. */
export const PROBE_RESERVE_MS = 140;
/** Root alternatives kept when augments can change the best move. */
export const ROOT_MULTI_PV = 3;

/** Weight applied to an enemy spell threat (a human may not see it). */
export const THREAT_WEIGHT = 0.85;

/**
 * Centipawn "price" of spending a limited spell charge. A spell only fires
 * when its gain beats the plain best move by more than this.
 */
export const SPELL_COST_CP: Record<string, number> = {
  frost: 70,
  "blessed-water-spell": 50,
  puppet: 80,
  "little-big-man": 150,
  impassable: 40,
  "bloodbending-plus": 50,
  bloodbending: 40,
  necromancer: 40,
  "necromancer-plus": 40,
  "necromancer-plus-plus": 30,
};

/** Stockfish scores an LBM pawn as a full queen; strip that phantom material. */
export const LBM_PHANTOM_CP = 850;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Reserve fraction of gold the bot keeps in reserve (higher = pickier). */
export function reserveFraction(scoreCp: number): number {
  return clamp(0.45 - scoreCp / 800, 0.15, 0.45);
}

export function spendableGold(gold: number, scoreCp: number): number {
  const reserve = Math.floor(gold * reserveFraction(scoreCp));
  return Math.max(0, gold - reserve);
}

export function auctionAggression(scoreCp: number): number {
  return clamp((-scoreCp + 100) / 400, 0, 1);
}
