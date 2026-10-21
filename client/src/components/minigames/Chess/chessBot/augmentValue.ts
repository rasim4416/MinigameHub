import type { Augment, AugmentUpgradeLevels } from "../augments";
import { getImproveLevel } from "../augments";
import { getDerivedBoard, type ChessState, type PieceType } from "../engine";
import { BOT_AUGMENT_DENYLIST } from "./augmentPriority";

/**
 * Context for valuing an augment, everything optional so a bare pick still
 * works (e.g. the pre-game draft before any board exists).
 */
export type AugmentContext = {
  game?: ChessState | null;
  /** Black POV engine score; behind = favour tempo-free swing spells. */
  scoreCp?: number;
  whiteAugments?: Augment[];
  blackLostMinors?: PieceType[];
  blackLostPawnCols?: number[];
  levels?: AugmentUpgradeLevels;
};

/** Approximate centipawn worth of one augment copy to the bot. */
const BASE_VALUE: Record<string, number> = {
  miner: 55,
  alternative: 18,
  mastermind: 45,
  "instant-cash": 70,
  "prize-money": 20,
  investment: 40,
  efficient: 25,
  thief: 12,
  "blind-rage": 30,
  anticipation: 10,
  "king-of-the-hill": 45,
  jew: 25,
  "alternative-plus": 30,
  "mastermind-plus": 60,
  "contract-killer": 55,
  "tax-man": 30,
  "free-passage": 20,
  augmented: 45,
  necromancer: 90,
  frost: 230,
  impassable: 120,
  "blessed-water-spell": 190,
  horde: 80,
  "mastermind-plus-plus": 70,
  "i-am-danger": 35,
  "double-gold": 90,
  "necromancer-plus": 220,
  bloodbending: 200,
  bloodlust: 120,
  "internal-combustion": 260,
  "death-note": 320,
  puppet: 300,
  "emperor-of-the-hill": 280,
  "plot-armour": 330,
  "little-big-man": 480,
  "bloodbending-plus": 700,
  "necromancer-plus-plus": 650,
};

/** Value of the stronger augment this one unlocks (prerequisite chains). */
const UNLOCK_VALUE: Record<string, number> = {
  necromancer: 40,
  "necromancer-plus": 120,
  bloodbending: 90,
  alternative: 8,
  mastermind: 20,
  "mastermind-plus": 20,
};

/** Gold/meta augments pay out over the rest of the game. */
const ECONOMY = new Set([
  "miner",
  "mastermind",
  "mastermind-plus",
  "mastermind-plus-plus",
  "investment",
  "efficient",
  "thief",
  "tax-man",
  "augmented",
  "double-gold",
  "bloodlust",
  "king-of-the-hill",
  "jew",
  "i-am-danger",
  "prize-money",
  "emperor-of-the-hill",
]);

/** White spells that Evade-style or defensive picks answer. */
const WHITE_THREAT_SPELLS = new Set([
  "frost",
  "puppet",
  "little-big-man",
  "bloodbending-plus",
  "death-note",
  "blessed-water-spell",
]);

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function augmentValue(aug: Augment, owned: Augment[], ctx: AugmentContext = {}): number {
  if (BOT_AUGMENT_DENYLIST.has(aug.id)) return -1;
  const moveNo = ctx.game?.fullMoveNumber ?? 1;
  let v = BASE_VALUE[aug.id] ?? 40;
  v += UNLOCK_VALUE[aug.id] ?? 0;

  // Economy decays: a miner on move 40 barely pays for itself.
  if (ECONOMY.has(aug.id)) v *= clamp(1.35 - moveNo / 40, 0.25, 1.35);

  const copies = owned.filter((a) => a.id === aug.id).length;
  if (copies > 0) v *= aug.id === "miner" || aug.id === "investment" ? 0.9 : 0.75;

  switch (aug.id) {
    case "blind-rage":
      if (moveNo > 4) v = 0;
      break;
    case "prize-money":
      if ((ctx.game?.capturedByBlack.length ?? 0) + (ctx.game?.capturedByWhite.length ?? 0) > 0) v = 0;
      break;
    case "necromancer":
      v += (ctx.blackLostPawnCols?.length ?? 0) * 25;
      break;
    case "necromancer-plus":
      v += (ctx.blackLostMinors?.some((t) => t === "N" || t === "B") ? 1 : 0) * 120;
      break;
    case "necromancer-plus-plus": {
      const hasQueen = ctx.game
        ? getDerivedBoard(ctx.game).some((row) =>
            row.some((p) => p?.type === "Q" && p.color === "black"),
          )
        : true;
      if (!hasQueen) v += 150;
      break;
    }
    case "internal-combustion": {
      const attackers = ctx.whiteAugments?.length ?? 0;
      v += Math.min(80, attackers * 10);
      break;
    }
    case "plot-armour":
      // Most valuable while White still has its heavy pieces.
      v *= clamp(1.2 - moveNo / 80, 0.6, 1.2);
      break;
    case "frost":
    case "blessed-water-spell":
    case "puppet":
      // Tactical spells shine more when White also holds spells to parry.
      if (ctx.whiteAugments?.some((a) => WHITE_THREAT_SPELLS.has(a.id))) v *= 1.1;
      break;
    case "bloodbending":
    case "bloodbending-plus":
    case "little-big-man":
      // Swing spells recover a lost position; keep their value when behind.
      if ((ctx.scoreCp ?? 0) < -150) v *= 1.15;
      break;
  }
  return Math.round(v);
}

/**
 * Gold → centipawn exchange rate for the shop. Auctions price material at
 * roughly 8–20 cp per gold, so the shop must clear a lower bar to be worth
 * it while the reserve still funds auctions.
 */
export const CP_PER_GOLD = 6;

/** Value of the next Improve tier on an owned augment, in centipawns. */
export function improveValue(augId: string, owned: Augment[], ctx: AugmentContext = {}): number {
  const level = getImproveLevel(ctx.levels ?? {}, augId);
  const moveNo = ctx.game?.fullMoveNumber ?? 1;
  const decay = clamp(1.3 - moveNo / 40, 0.25, 1.3);
  const stacks = owned.filter((a) => a.id === augId).length;
  switch (augId) {
    case "miner":
      return Math.round(45 * stacks * decay);
    case "investment":
      return Math.round(((ctx.game?.goldBlack ?? 0) >= 30 ? 60 : 25) * decay);
    case "efficient":
      return Math.round(20 * stacks * decay);
    case "frost":
      return 45;
    case "blessed-water-spell":
      return 35;
    case "death-note":
      return level === 2 ? 220 : level === 1 ? 120 : 80;
    case "contract-killer":
      return 30;
    case "king-of-the-hill":
      return Math.round(40 * decay);
    case "bloodlust":
      return Math.round((level === 0 ? 90 : 120) * decay);
    case "alternative":
      return moveNo <= 6 ? 30 : 0;
    default:
      return 0;
  }
}
