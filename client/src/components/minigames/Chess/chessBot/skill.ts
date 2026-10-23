import { BOT_SKILL_LEVEL, MAX_SKILL_LEVEL, SKILL_MULTI_PV } from "./constants";
import type { BotSpellContext } from "./types";

let rng: () => number = Math.random;

/** Tests pin the picker's randomness. */
export function setSkillRng(next: () => number): void {
  rng = next;
}

export function skillLevel(ctx: Pick<BotSpellContext, "difficulty">): number {
  return BOT_SKILL_LEVEL[ctx.difficulty ?? "hard"];
}

export function isWeakened(level: number): boolean {
  return level < MAX_SKILL_LEVEL;
}

/** Stockfish picks the weakened move once iterative deepening reaches this depth. */
export function skillDepth(level: number): number {
  return level + 1;
}

/**
 * Port of Stockfish's Skill::pick_best. `ranked` is sorted best first; each
 * line gets a push toward the top score plus a random share of the spread
 * (capped at a pawn), so weaker levels sometimes prefer a worse line but
 * never one that is far worse.
 */
export function pickWithSkill<T extends { score: number }>(ranked: T[], level: number): T | null {
  if (ranked.length === 0) return null;
  const n = Math.min(ranked.length, SKILL_MULTI_PV);
  const top = ranked[0]!.score;
  const delta = Math.min(top - ranked[n - 1]!.score, 100);
  const weakness = 120 - 2 * level;
  let best = ranked[0]!;
  let maxScore = -Infinity;
  for (let i = 0; i < n; i++) {
    const s = ranked[i]!.score;
    const push = (weakness * (top - s) + delta * Math.floor(rng() * weakness)) / 128;
    if (s + push >= maxScore) {
      maxScore = s + push;
      best = ranked[i]!;
    }
  }
  return best;
}
